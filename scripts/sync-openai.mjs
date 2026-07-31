import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceSkills = path.join(root, 'skills');
const targetRoot = path.join(root, 'plugins', 'spala');
const targetSkills = path.join(targetRoot, 'skills');
const sourceMcp = path.join(root, '.mcp.json');
const targetMcp = path.join(targetRoot, '.mcp.json');
const checkOnly = process.argv.includes('--check');

async function filesUnder(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await filesUnder(path.join(directory, entry.name), relative));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

async function digest(directory) {
  const hash = createHash('sha256');
  for (const relative of await filesUnder(directory)) {
    hash.update(relative);
    hash.update(await readFile(path.join(directory, relative)));
  }
  return hash.digest('hex');
}

if (checkOnly) {
  const [sourceDigest, targetDigest, sourceMcpText, targetMcpText] = await Promise.all([
    digest(sourceSkills),
    digest(targetSkills),
    readFile(sourceMcp, 'utf8'),
    readFile(targetMcp, 'utf8'),
  ]);
  if (sourceDigest !== targetDigest || sourceMcpText !== targetMcpText) {
    throw new Error('Generated OpenAI plugin assets are stale. Run pnpm sync:openai.');
  }
  process.stdout.write('OpenAI plugin assets are synchronized.\n');
} else {
  await rm(targetSkills, { recursive: true, force: true });
  await mkdir(targetRoot, { recursive: true });
  await cp(sourceSkills, targetSkills, { recursive: true });
  await cp(sourceMcp, targetMcp);
  process.stdout.write('Synchronized OpenAI plugin skills and MCP definition.\n');
}
