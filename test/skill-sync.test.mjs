import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(repo, script, args = []) {
  return spawnSync(process.execPath, [path.join(repo, 'scripts', script), ...args], {
    cwd: repo,
    encoding: 'utf8',
  });
}

function git(repo, args) {
  return spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
}

function assertGit(repo, args) {
  const result = git(repo, args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function commitSource(source, message) {
  assertGit(source, ['add', '.']);
  assertGit(source, ['commit', '-m', message]);
  return assertGit(source, ['rev-parse', 'HEAD']);
}

async function fixture(t) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'spala-agent-skills-'));
  const repo = path.join(temp, 'repo');
  const source = path.join(temp, 'source');
  const sourceSkills = path.join(source, 'mcp', 'skills');
  await cp(path.join(root, 'scripts'), path.join(repo, 'scripts'), { recursive: true });
  await cp(path.join(root, 'skills'), path.join(repo, 'skills'), { recursive: true });
  await cp(path.join(root, 'package.json'), path.join(repo, 'package.json'));
  await cp(path.join(root, 'skills.lock.json'), path.join(repo, 'skills.lock.json'));
  const fixtureLock = JSON.parse(await readFile(path.join(repo, 'skills.lock.json'), 'utf8'));
  const fixturePackage = JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8'));
  fixturePackage.version = fixtureLock.distributionVersion;
  await writeFile(
    path.join(repo, 'package.json'),
    `${JSON.stringify(fixturePackage, null, 2)}\n`,
  );
  await mkdir(path.dirname(sourceSkills), { recursive: true });
  await cp(path.join(root, 'skills'), sourceSkills, { recursive: true });
  assertGit(source, ['init']);
  assertGit(source, ['config', 'user.name', 'Spala Test']);
  assertGit(source, ['config', 'user.email', 'test@example.invalid']);
  commitSource(source, 'canonical skills');
  t.after(() => rm(temp, { recursive: true, force: true }));
  return { repo, source, sourceSkills, temp };
}

test('skill mirror check detects local package drift', async t => {
  const { repo } = await fixture(t);
  assert.equal(run(repo, 'sync-skills.mjs', ['--check']).status, 0);

  await appendFile(path.join(repo, 'skills', 'spala-backend', 'SKILL.md'), '\nlocal drift\n');
  const result = run(repo, 'sync-skills.mjs', ['--check']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source tree digest does not match/i);
});

test('sync requires skill and distribution version bumps', async t => {
  const { repo, source, sourceSkills } = await fixture(t);

  await appendFile(path.join(sourceSkills, 'spala-backend', 'SKILL.md'), '\ncanonical change\n');
  commitSource(source, 'change backend skill');
  let result = run(repo, 'sync-skills.mjs', ['--source', source]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /without a skill version bump/i);

  await cp(path.join(root, 'skills'), sourceSkills, { recursive: true, force: true });
  await appendFile(
    path.join(sourceSkills, 'spala-developer', 'agents', 'openai.yaml'),
    '\n# metadata change\n',
  );
  commitSource(source, 'change developer metadata');
  result = run(repo, 'sync-skills.mjs', ['--source', source]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /without a distribution version bump/i);

  const packageJson = JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8'));
  const [major, minor, patch] = packageJson.version.split('.').map(Number);
  const nextVersion = `${major}.${minor}.${patch + 1}`;
  packageJson.version = nextVersion;
  await writeFile(path.join(repo, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  assert.equal(run(repo, 'sync-skills.mjs', ['--source', source]).status, 0);

  const lock = JSON.parse(await readFile(path.join(repo, 'skills.lock.json'), 'utf8'));
  assert.equal(lock.distributionVersion, nextVersion);
  assert.ok(lock.skills['spala-developer'].files['agents/openai.yaml']);
});

test('sync records committed source revision and deterministic tree digest', async t => {
  const { repo, source } = await fixture(t);
  const firstRevision = assertGit(source, ['rev-parse', 'HEAD']);

  let result = run(repo, 'sync-skills.mjs', ['--source', source]);
  assert.equal(result.status, 0, result.stderr);

  let lock = JSON.parse(await readFile(path.join(repo, 'skills.lock.json'), 'utf8'));
  assert.equal(lock.schemaVersion, 2);
  assert.deepEqual(Object.keys(lock.source).sort(), ['path', 'revision', 'treeSha256', 'type']);
  assert.equal(lock.source.type, 'git');
  assert.equal(lock.source.path, 'mcp/skills');
  assert.equal(lock.source.revision, firstRevision);
  assert.match(lock.source.treeSha256, /^[0-9a-f]{64}$/);
  const firstTreeDigest = lock.source.treeSha256;

  await writeFile(path.join(source, 'README.md'), 'unrelated source repository change\n');
  const secondRevision = commitSource(source, 'unrelated change');
  assert.notEqual(secondRevision, firstRevision);

  result = run(repo, 'sync-skills.mjs', ['--source', path.join(source, 'mcp', 'skills')]);
  assert.equal(result.status, 0, result.stderr);
  lock = JSON.parse(await readFile(path.join(repo, 'skills.lock.json'), 'utf8'));
  assert.equal(lock.source.revision, secondRevision);
  assert.equal(lock.source.treeSha256, firstTreeDigest);
  assert.equal(run(repo, 'sync-skills.mjs', ['--check']).status, 0);
  assert.equal(run(repo, 'sync-skills.mjs', ['--check', '--source', source]).status, 0);
});

test('write sync rejects dirty canonical source input', async t => {
  await t.test('tracked changes', async t => {
    const { repo, source, sourceSkills } = await fixture(t);
    const originalLock = await readFile(path.join(repo, 'skills.lock.json'), 'utf8');
    await appendFile(path.join(sourceSkills, 'spala-backend', 'SKILL.md'), '\ndirty change\n');

    const result = run(repo, 'sync-skills.mjs', ['--source', source]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /canonical mcp\/skills source is dirty/i);
    assert.equal(await readFile(path.join(repo, 'skills.lock.json'), 'utf8'), originalLock);
  });

  await t.test('untracked files', async t => {
    const { repo, source, sourceSkills } = await fixture(t);
    const untrackedDirectory = path.join(sourceSkills, 'spala-backend', 'scripts');
    await mkdir(untrackedDirectory, { recursive: true });
    await writeFile(path.join(untrackedDirectory, 'untracked.mjs'), 'export {};\n');

    const result = run(repo, 'sync-skills.mjs', ['--source', source]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /canonical mcp\/skills source is dirty/i);
  });
});

test('sync rejects arbitrary source paths even when they are committed', async t => {
  const { repo, source, temp } = await fixture(t);
  const arbitraryRepository = path.join(temp, 'arbitrary');
  const arbitrarySkills = path.join(arbitraryRepository, 'skills');
  await cp(path.join(root, 'skills'), arbitrarySkills, { recursive: true });
  assertGit(arbitraryRepository, ['init']);
  assertGit(arbitraryRepository, ['config', 'user.name', 'Spala Test']);
  assertGit(arbitraryRepository, ['config', 'user.email', 'test@example.invalid']);
  commitSource(arbitraryRepository, 'arbitrary skills');

  let result = run(repo, 'sync-skills.mjs', ['--source', arbitrarySkills]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be the repository's mcp\/skills directory/i);

  result = run(repo, 'sync-skills.mjs', ['--source', path.join(temp, 'missing-repository')]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be inside a Git repository/i);

  assert.equal(run(repo, 'sync-skills.mjs', ['--source', source]).status, 0);
});

test('checks validate recorded provenance and require supplied source to match', async t => {
  const { repo, source } = await fixture(t);
  let result = run(repo, 'sync-skills.mjs', ['--source', source]);
  assert.equal(result.status, 0, result.stderr);

  const lockPath = path.join(repo, 'skills.lock.json');
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));
  lock.source.revision = '0'.repeat(40);
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  result = run(repo, 'sync-skills.mjs', ['--check']);
  assert.equal(result.status, 0, result.stderr);
  result = run(repo, 'sync-skills.mjs', ['--check', '--source', source]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match recorded provenance/i);

  lock.source.revision = 'not-a-revision';
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  result = run(repo, 'sync-skills.mjs', ['--check']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid source provenance/i);

  lock.source.revision = assertGit(source, ['rev-parse', 'HEAD']);
  lock.source.treeSha256 = '0'.repeat(64);
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  result = run(repo, 'sync-skills.mjs', ['--check']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source tree digest does not match/i);
});

test('release guard rejects changed skill packages at the same distribution version', async t => {
  const { repo } = await fixture(t);
  assert.equal(git(repo, ['init']).status, 0);
  assert.equal(git(repo, ['config', 'user.name', 'Spala Test']).status, 0);
  assert.equal(git(repo, ['config', 'user.email', 'test@example.invalid']).status, 0);
  assert.equal(git(repo, ['add', '.']).status, 0);
  assert.equal(git(repo, ['commit', '-m', 'baseline']).status, 0);

  const lockPath = path.join(repo, 'skills.lock.json');
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));
  lock.skills['spala-developer'].files['agents/openai.yaml'] = '0'.repeat(64);
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const result = run(repo, 'check-skill-release.mjs');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /without a distribution version bump/i);
});
