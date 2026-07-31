#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targetRoot = join(root, 'skills');
const lockPath = join(root, 'skills.lock.json');
const distributionVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const checkOnly = process.argv.includes('--check');
const sourceArgument = argumentValue('--source');

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

function lockFor(skills) {
  return {
    schemaVersion: 1,
    source: 'spala-platform:mcp/skills',
    distributionVersion,
    skills: Object.fromEntries(SKILL_NAMES.map(name => [
      name,
      {
        version: skills[name].version,
        sha256: skills[name].sha256,
        files: Object.fromEntries(Object.entries(skills[name].files).map(([file, value]) => [
          file,
          value.sha256,
        ])),
      },
    ])),
  };
}

function comparable(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function resolveSource(value) {
  if (!value) return null;
  const candidate = resolve(value);
  const nested = join(candidate, 'mcp', 'skills');
  return existsSync(nested) ? nested : candidate;
}

const bundled = readSkillSet(targetRoot);
const bundledLock = lockFor(bundled);

if (checkOnly) {
  const recorded = JSON.parse(readFileSync(lockPath, 'utf8'));
  if (comparable(recorded) !== comparable(bundledLock)) {
    throw new Error('skills.lock.json does not match the bundled skills. Run pnpm sync:skills.');
  }

  const sourceRoot = resolveSource(sourceArgument);
  if (sourceRoot) {
    const source = readSkillSet(sourceRoot);
    if (comparable(lockFor(source)) !== comparable(bundledLock)) {
      throw new Error('Bundled skills do not match the supplied canonical MCP skill source.');
    }
  }

  process.stdout.write('[skills] bundled mirror and lock are aligned.\n');
  process.exit(0);
}

const sourceRoot = resolveSource(sourceArgument);
if (!sourceRoot) {
  throw new Error(
    'Provide the canonical platform skills with --source <platform-repo-or-mcp-skills-path>.',
  );
}

const source = readSkillSet(sourceRoot);
const sourceLock = lockFor(source);
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
  for (const [relative, file] of Object.entries(source[name].files)) {
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
