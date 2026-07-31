import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_MCP_URL = 'https://mcp.spala.ai/mcp';

async function filesUnder(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    assert.equal(entry.isSymbolicLink(), false, `Symlink is not allowed: ${path.join(prefix, entry.name)}`);
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await filesUnder(path.join(directory, entry.name), relative));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

async function json(relative) {
  return JSON.parse(await readFile(path.join(root, relative), 'utf8'));
}

test('all native manifests expose only the public Spala MCP', async () => {
  const shared = await json('.mcp.json');
  const claude = await json('.claude-plugin/plugin.json');
  const gemini = await json('gemini-extension.json');
  const openai = await json('plugins/spala/.mcp.json');

  assert.deepEqual(Object.keys(shared.mcpServers), ['spala_public_mcp']);
  assert.deepEqual(Object.keys(claude.mcpServers), ['spala_public_mcp']);
  assert.deepEqual(Object.keys(gemini.mcpServers), ['spala_public_mcp']);
  assert.deepEqual(Object.keys(openai.mcpServers), ['spala_public_mcp']);
  assert.equal(shared.mcpServers.spala_public_mcp.url, PUBLIC_MCP_URL);
  assert.equal(claude.mcpServers.spala_public_mcp.url, PUBLIC_MCP_URL);
  assert.equal(gemini.mcpServers.spala_public_mcp.httpUrl, PUBLIC_MCP_URL);
  assert.equal(openai.mcpServers.spala_public_mcp.url, PUBLIC_MCP_URL);
});

test('public package contains no credentials, private infrastructure, or project MCP URLs', async () => {
  const forbidden = [
    /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bnpm_[A-Za-z0-9]{20,}\b/,
    /\bAIza[0-9A-Za-z_-]{30,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
    /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    /Authorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]{20,}/i,
    /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^/\s:@]+:[^@\s/]+@/i,
    /\/home\/[^/\s]+\/[^/\s]+/,
    /\/Users\/[^/\s]+\//,
    /\b(?:ftp|psql)\.tools\b/i,
    /https:\/\/(?:shared|api|[a-z0-9-]+)\.spala\.ai\/p[a-z0-9]+\/mcp/i,
    /https:\/\/p[a-z0-9]+\.spala\.ai\/mcp/i,
  ];

  for (const relative of await filesUnder(root)) {
    const text = await readFile(path.join(root, relative), 'utf8').catch(() => null);
    if (text === null) continue;
    for (const pattern of forbidden) {
      assert.equal(pattern.test(text), false, `${relative} matches forbidden pattern ${pattern}.`);
    }
  }
});

test('the package has no executable hooks or deployment code', async () => {
  const files = await filesUnder(root);
  assert.equal(files.some(file => /(^|\/)hooks?\//i.test(file)), false);
  assert.equal(files.some(file => /(^|\/)deploy(?:ment)?[-./]/i.test(file)), false);
});

test('client coverage and fallback installer are explicit', async () => {
  const manifest = await json('integration.manifest.json');
  assert.deepEqual(
    Object.keys(manifest.clients).sort(),
    ['claude-code', 'cursor', 'gemini-cli', 'openai', 'vscode-copilot'],
  );
  assert.equal(manifest.fallbackInstaller.package, '@spala-ai/mcp-install');
  assert.match(manifest.fallbackInstaller.publicCommand, /--public --yes$/);
});

test('generated OpenAI assets exactly match the canonical skills and MCP config', async () => {
  assert.equal(
    await readFile(path.join(root, 'plugins/spala/.mcp.json'), 'utf8'),
    await readFile(path.join(root, '.mcp.json'), 'utf8'),
  );

  const canonicalSkills = (await readdir(path.join(root, 'skills'))).sort();
  const generatedSkills = (await readdir(path.join(root, 'plugins/spala/skills'))).sort();
  assert.deepEqual(generatedSkills, canonicalSkills);

  for (const skill of canonicalSkills) {
    assert.equal(
      await readFile(path.join(root, 'plugins/spala/skills', skill, 'SKILL.md'), 'utf8'),
      await readFile(path.join(root, 'skills', skill, 'SKILL.md'), 'utf8'),
    );
  }
});
