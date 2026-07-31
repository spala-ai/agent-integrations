#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const currentLock = JSON.parse(readFileSync(resolve(root, 'skills.lock.json'), 'utf8'));
const currentPackage = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const explicitBase = argumentValue('--base');

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a Git revision.`);
  return value;
}

function git(args, allowFailure = false) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

function jsonAt(revision, path) {
  const content = git(['show', `${revision}:${path}`], true);
  return content ? JSON.parse(content) : null;
}

if (currentLock.distributionVersion !== currentPackage.version) {
  throw new Error(
    `skills.lock.json targets ${currentLock.distributionVersion}, but package.json is ${currentPackage.version}.`,
  );
}

let base = explicitBase;
if (!base) {
  const workingTreeChanged = git(
    ['diff', '--quiet', 'HEAD', '--', 'skills.lock.json', 'package.json'],
    true,
  ) === null;
  base = workingTreeChanged ? 'HEAD' : 'HEAD^';
}

const baseLock = jsonAt(base, 'skills.lock.json');
const basePackage = jsonAt(base, 'package.json');
if (!baseLock || !basePackage) {
  process.stdout.write('[skills] no prior lock found; initial locked release accepted.\n');
  process.exit(0);
}

for (const [name, current] of Object.entries(currentLock.skills)) {
  const previous = baseLock.skills?.[name];
  if (previous && previous.sha256 !== current.sha256 && previous.version === current.version) {
    throw new Error(`${name} changed without a skill version bump (${current.version}).`);
  }
}

if (
  JSON.stringify(baseLock.skills) !== JSON.stringify(currentLock.skills)
  && basePackage.version === currentPackage.version
) {
  throw new Error(
    `Bundled skill packages changed without a distribution version bump (${currentPackage.version}).`,
  );
}

process.stdout.write(`[skills] release freshness is valid against ${base}.\n`);
