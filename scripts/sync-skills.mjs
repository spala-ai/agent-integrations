#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targetRoot = join(root, 'skills');
const lockPath = join(root, 'skills.lock.json');
const distributionVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const checkOnly = process.argv.includes('--check');
const sourceArgument = argumentValue('--source');
const CANONICAL_SOURCE_PATH = 'mcp/skills';
const GIT_REVISION_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const SKILL_NAMES = [
  'spala-auth-security',
  'spala-backend',
  'spala-business-manager',
  'spala-data-modeler',
  'spala-developer',
  'spala-endpoint-workflow',
  'spala-security-auditor',
  'spala-step-script',
  'spala-system-architect',
];
const ALLOWED_TOP_LEVEL_ENTRIES = new Set([
  'SKILL.md',
  'agents',
  'assets',
  'references',
  'scripts',
]);

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a path.`);
  }
  return value;
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function git(directory, args, failureMessage) {
  try {
    return execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error(failureMessage);
  }
}

function parseFrontmatter(content, file) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`${file} is missing YAML frontmatter.`);

  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const entry = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!entry) continue;
    metadata[entry[1]] = entry[2].replace(/^["']|["']$/g, '');
  }
  return metadata;
}

function assertRegularFile(file) {
  const stat = lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`Skill source must be a regular file: ${file}`);
  }
}

function assertExactDirectories(directory) {
  const actual = readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
  const expected = [...SKILL_NAMES].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected exactly ${expected.join(', ')} in ${directory}; found ${actual.join(', ')}.`,
    );
  }
}

function filesUnder(directory, relative = '') {
  const files = [];
  for (const entry of readdirSync(join(directory, relative), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const childRelative = join(relative, entry.name);
    const stat = lstatSync(join(directory, childRelative));
    if (stat.isSymbolicLink()) {
      throw new Error(`Symlinks are not allowed in skill packages: ${childRelative}`);
    }
    if (stat.isDirectory()) {
      files.push(...filesUnder(directory, childRelative));
      continue;
    }
    if (!stat.isFile()) {
      throw new Error(`Only regular files are allowed in skill packages: ${childRelative}`);
    }
    const topLevel = childRelative.split(/[\\/]/)[0];
    if (!ALLOWED_TOP_LEVEL_ENTRIES.has(topLevel)) {
      throw new Error(`Unsupported top-level skill package entry: ${childRelative}`);
    }
    files.push(childRelative);
  }
  return files;
}

function readSkillSet(directory) {
  const rootStat = lstatSync(directory);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`Skills root must be a real directory: ${directory}`);
  }
  assertExactDirectories(directory);

  const skills = {};
  for (const name of SKILL_NAMES) {
    const skillDirectory = join(directory, name);
    const directoryStat = lstatSync(skillDirectory);
    if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
      throw new Error(`Skill directory must be a real directory: ${skillDirectory}`);
    }

    const packageFiles = filesUnder(skillDirectory);
    if (!packageFiles.includes('SKILL.md')) {
      throw new Error(`${skillDirectory} is missing SKILL.md.`);
    }

    const files = {};
    for (const relative of packageFiles) {
      const file = join(skillDirectory, relative);
      assertRegularFile(file);
      const content = readFileSync(file);
      files[relative] = {
        sha256: sha256(content),
        content,
      };
    }

    const skillFile = join(skillDirectory, 'SKILL.md');
    const skillContent = files['SKILL.md'].content.toString('utf8');
    const metadata = parseFrontmatter(skillContent, skillFile);
    if (metadata.name !== name) {
      throw new Error(`${skillFile} declares name "${metadata.name}" instead of "${name}".`);
    }
    if (!metadata.version) {
      throw new Error(`${skillFile} is missing a version.`);
    }
    skills[name] = {
      version: metadata.version,
      sha256: files['SKILL.md'].sha256,
      files,
    };
  }
  return skills;
}

function skillEntriesForLock(skills) {
  return Object.fromEntries(SKILL_NAMES.map(name => [
    name,
    {
      version: skills[name].version,
      sha256: skills[name].sha256,
      files: Object.fromEntries(Object.entries(skills[name].files).map(([file, value]) => [
        file,
        value.sha256,
      ])),
    },
  ]));
}

function sourceTreeDigest(skills) {
  const entries = [];
  for (const name of SKILL_NAMES) {
    for (const [file, value] of Object.entries(skills[name].files)
      .sort(([left], [right]) => left.localeCompare(right))) {
      entries.push({
        path: `${name}/${file.split(sep).join('/')}`,
        sha256: value.sha256,
      });
    }
  }
  return sha256(JSON.stringify(entries));
}

function lockFor(skills, source) {
  return {
    schemaVersion: 2,
    source,
    distributionVersion,
    skills: skillEntriesForLock(skills),
  };
}

function comparable(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function relativeGitPath(from, to) {
  return relative(from, to).split(sep).join('/');
}

function resolveCanonicalSource(value) {
  if (!value) return null;
  const resolvedCandidate = resolve(value);
  if (!existsSync(resolvedCandidate)) {
    throw new Error(`Canonical source must be inside a Git repository: ${resolvedCandidate}`);
  }
  const candidate = realpathSync(resolvedCandidate);
  const nested = join(candidate, 'mcp', 'skills');
  const sourceRoot = realpathSync(existsSync(nested) ? nested : candidate);
  const repositoryRoot = realpathSync(git(
    candidate,
    ['rev-parse', '--show-toplevel'],
    `Canonical source must be inside a Git repository: ${candidate}`,
  ));
  const sourcePath = relativeGitPath(repositoryRoot, sourceRoot);
  if (sourcePath !== CANONICAL_SOURCE_PATH) {
    throw new Error(
      `Canonical source must be the repository's ${CANONICAL_SOURCE_PATH} directory; found ${sourcePath}.`,
    );
  }

  return {
    repositoryRoot,
    sourcePath,
    sourceRoot,
  };
}

function assertCommittedSourceFiles(source, skills) {
  const trackedOutput = git(
    source.repositoryRoot,
    ['ls-files', '-z', '--cached', '--', source.sourcePath],
    `Could not inspect committed canonical source files in ${source.sourceRoot}.`,
  );
  const tracked = new Set(trackedOutput ? trackedOutput.split('\0') : []);
  for (const name of SKILL_NAMES) {
    for (const file of Object.keys(skills[name].files)) {
      const repositoryPath = `${source.sourcePath}/${name}/${file.split(sep).join('/')}`;
      if (!tracked.has(repositoryPath)) {
        throw new Error(`Canonical source file is not committed to Git: ${repositoryPath}`);
      }
    }
  }
}

function readCanonicalSource(value) {
  const source = resolveCanonicalSource(value);
  const revision = git(
    source.repositoryRoot,
    ['rev-parse', 'HEAD'],
    `Canonical source repository has no committed revision: ${source.repositoryRoot}`,
  );
  const dirty = git(
    source.repositoryRoot,
    ['status', '--porcelain=v1', '--untracked-files=all', '--', source.sourcePath],
    `Could not inspect canonical source status in ${source.repositoryRoot}.`,
  );
  if (dirty) {
    throw new Error(
      `Canonical ${CANONICAL_SOURCE_PATH} source is dirty; commit or discard its changes before syncing.`,
    );
  }

  const skills = readSkillSet(source.sourceRoot);
  assertCommittedSourceFiles(source, skills);
  const revisionAfterRead = git(
    source.repositoryRoot,
    ['rev-parse', 'HEAD'],
    `Canonical source repository has no committed revision: ${source.repositoryRoot}`,
  );
  const dirtyAfterRead = git(
    source.repositoryRoot,
    ['status', '--porcelain=v1', '--untracked-files=all', '--', source.sourcePath],
    `Could not inspect canonical source status in ${source.repositoryRoot}.`,
  );
  if (revisionAfterRead !== revision || dirtyAfterRead) {
    throw new Error(`Canonical ${CANONICAL_SOURCE_PATH} source changed while it was being read.`);
  }

  return {
    skills,
    provenance: {
      type: 'git',
      path: CANONICAL_SOURCE_PATH,
      revision,
      treeSha256: sourceTreeDigest(skills),
    },
  };
}

function validateRecordedProvenance(recorded, bundled) {
  if (recorded.schemaVersion === 1) {
    if (recorded.source !== 'spala-platform:mcp/skills') {
      throw new Error('skills.lock.json has invalid legacy source provenance.');
    }
    return;
  }
  if (recorded.schemaVersion !== 2) {
    throw new Error(`skills.lock.json has unsupported schema version ${recorded.schemaVersion}.`);
  }

  const source = recorded.source;
  const keys = source && typeof source === 'object' && !Array.isArray(source)
    ? Object.keys(source).sort()
    : [];
  if (comparable(keys) !== comparable(['path', 'revision', 'treeSha256', 'type'])) {
    throw new Error('skills.lock.json has invalid source provenance fields.');
  }
  if (
    source.type !== 'git'
    || source.path !== CANONICAL_SOURCE_PATH
    || !GIT_REVISION_PATTERN.test(source.revision)
    || !SHA256_PATTERN.test(source.treeSha256)
  ) {
    throw new Error('skills.lock.json has invalid source provenance.');
  }
  if (source.treeSha256 !== sourceTreeDigest(bundled)) {
    throw new Error('skills.lock.json source tree digest does not match the bundled skills.');
  }
}

function lockForRecordedBundle(recorded, bundled) {
  return {
    schemaVersion: recorded.schemaVersion,
    source: recorded.source,
    distributionVersion,
    skills: skillEntriesForLock(bundled),
  };
}

const bundled = readSkillSet(targetRoot);

if (checkOnly) {
  const recorded = JSON.parse(readFileSync(lockPath, 'utf8'));
  validateRecordedProvenance(recorded, bundled);
  if (comparable(recorded) !== comparable(lockForRecordedBundle(recorded, bundled))) {
    throw new Error('skills.lock.json does not match the bundled skills. Run pnpm sync:skills.');
  }

  if (sourceArgument) {
    const source = readCanonicalSource(sourceArgument);
    if (comparable(source.provenance) !== comparable(recorded.source)) {
      throw new Error('Supplied canonical MCP skill source does not match recorded provenance.');
    }
    if (comparable(skillEntriesForLock(source.skills)) !== comparable(recorded.skills)) {
      throw new Error('Bundled skills do not match the supplied canonical MCP skill source.');
    }
  }

  process.stdout.write('[skills] bundled mirror and lock are aligned.\n');
  process.exit(0);
}

if (!sourceArgument) {
  throw new Error(
    'Provide the canonical platform skills with --source <platform-repo-or-mcp-skills-path>.',
  );
}

const source = readCanonicalSource(sourceArgument);
const sourceLock = lockFor(source.skills, source.provenance);
if (existsSync(lockPath)) {
  const previousLock = JSON.parse(readFileSync(lockPath, 'utf8'));
  for (const name of SKILL_NAMES) {
    const previous = previousLock.skills?.[name];
    const next = sourceLock.skills[name];
    if (previous && previous.sha256 !== next.sha256 && previous.version === next.version) {
      throw new Error(
        `${name} content changed without a skill version bump (${next.version}).`,
      );
    }
  }
  if (
    comparable(previousLock.skills) !== comparable(sourceLock.skills)
    && previousLock.distributionVersion === distributionVersion
  ) {
    throw new Error(
      `Bundled skill packages changed without a distribution version bump (${distributionVersion}).`,
    );
  }
}

for (const name of SKILL_NAMES) {
  const directory = join(targetRoot, name);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  for (const [relative, file] of Object.entries(source.skills[name].files)) {
    const target = join(directory, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content);
  }
}

for (const entry of readdirSync(targetRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || SKILL_NAMES.includes(entry.name)) continue;
  rmSync(join(targetRoot, entry.name), { recursive: true });
}

writeFileSync(lockPath, comparable(sourceLock));
process.stdout.write(`[skills] synchronized ${SKILL_NAMES.length} skills from the canonical MCP source.\n`);
