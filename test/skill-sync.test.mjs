import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFile,
  cp,
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

async function fixture(t) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'spala-agent-skills-'));
  const repo = path.join(temp, 'repo');
  const source = path.join(temp, 'source');
  await cp(path.join(root, 'scripts'), path.join(repo, 'scripts'), { recursive: true });
  await cp(path.join(root, 'skills'), path.join(repo, 'skills'), { recursive: true });
  await cp(path.join(root, 'skills'), source, { recursive: true });
  await cp(path.join(root, 'package.json'), path.join(repo, 'package.json'));
  await cp(path.join(root, 'skills.lock.json'), path.join(repo, 'skills.lock.json'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  return { repo, source };
}

test('skill mirror check detects local package drift', async t => {
  const { repo } = await fixture(t);
  assert.equal(run(repo, 'sync-skills.mjs', ['--check']).status, 0);

  await appendFile(path.join(repo, 'skills', 'spala-backend', 'SKILL.md'), '\nlocal drift\n');
  const result = run(repo, 'sync-skills.mjs', ['--check']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /skills\.lock\.json does not match/i);
});

test('sync requires skill and distribution version bumps', async t => {
  const { repo, source } = await fixture(t);

  await appendFile(path.join(source, 'spala-backend', 'SKILL.md'), '\ncanonical change\n');
  let result = run(repo, 'sync-skills.mjs', ['--source', source]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /without a skill version bump/i);

  await cp(path.join(root, 'skills'), source, { recursive: true, force: true });
  await appendFile(
    path.join(source, 'spala-developer', 'agents', 'openai.yaml'),
    '\n# metadata change\n',
  );
  result = run(repo, 'sync-skills.mjs', ['--source', source]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /without a distribution version bump/i);

  const packageJson = JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8'));
  packageJson.version = '1.3.1';
  await writeFile(path.join(repo, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  assert.equal(run(repo, 'sync-skills.mjs', ['--source', source]).status, 0);

  const lock = JSON.parse(await readFile(path.join(repo, 'skills.lock.json'), 'utf8'));
  assert.equal(lock.distributionVersion, '1.3.1');
  assert.ok(lock.skills['spala-developer'].files['agents/openai.yaml']);
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
