import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  const openai = await json('.codex-plugin/plugin.json');

  assert.deepEqual(Object.keys(shared.mcpServers), ['spala_public_mcp']);
  assert.deepEqual(Object.keys(claude.mcpServers), ['spala_public_mcp']);
  assert.deepEqual(Object.keys(gemini.mcpServers), ['spala_public_mcp']);
  assert.equal(shared.mcpServers.spala_public_mcp.url, PUBLIC_MCP_URL);
  assert.equal(claude.mcpServers.spala_public_mcp.url, PUBLIC_MCP_URL);
  assert.equal(gemini.mcpServers.spala_public_mcp.httpUrl, PUBLIC_MCP_URL);
  assert.equal(openai.mcpServers, './.mcp.json');
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
  const claudeMarketplace = await json('.claude-plugin/marketplace.json');
  assert.deepEqual(
    Object.keys(manifest.clients).sort(),
    ['claude-code', 'cursor', 'gemini-cli', 'openai', 'vscode-copilot'],
  );
  assert.equal(claudeMarketplace.name, 'spala-marketplace');
  assert.equal(manifest.fallbackInstaller.package, '@spala-ai/mcp-install');
  assert.match(manifest.fallbackInstaller.publicCommand, /--public --yes$/);
});

test('all clients share one canonical skill and MCP package', async () => {
  const manifest = await json('integration.manifest.json');
  const claudeMarketplace = await json('.claude-plugin/marketplace.json');
  const cursor = await json('.cursor-plugin/plugin.json');
  const cursorMarketplace = await json('.cursor-plugin/marketplace.json');
  const gemini = await json('gemini-extension.json');
  const openai = await json('.codex-plugin/plugin.json');
  const openaiMarketplace = await json('.agents/plugins/marketplace.json');

  assert.equal(manifest.clients.openai.manifest, '.codex-plugin/plugin.json');
  assert.equal(claudeMarketplace.plugins[0]?.source, '.');
  assert.equal(cursor.skills, './skills/');
  assert.equal(cursor.mcpServers, './.mcp.json');
  assert.equal(cursorMarketplace.plugins[0]?.source, '.');
  assert.equal(gemini.contextFileName, 'GEMINI.md');
  assert.equal(openai.skills, './skills/');
  assert.equal(openai.mcpServers, './.mcp.json');
  assert.equal(openaiMarketplace.plugins[0]?.source?.path, '.');
  assert.equal((await filesUnder(root)).some(file => file.startsWith('plugins/spala/')), false);
});

test('bundled skill lock records every local skill version and digest', async () => {
  const lock = await json('skills.lock.json');
  const skillNames = (await readdir(path.join(root, 'skills'), { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  assert.equal(lock.schemaVersion, 2);
  assert.deepEqual(Object.keys(lock.source).sort(), ['path', 'revision', 'treeSha256', 'type']);
  assert.equal(lock.source.type, 'git');
  assert.equal(lock.source.path, 'mcp/skills');
  assert.match(lock.source.revision, /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
  assert.match(lock.source.treeSha256, /^[0-9a-f]{64}$/);
  assert.equal(lock.distributionVersion, (await json('package.json')).version);
  assert.deepEqual(Object.keys(lock.skills).sort(), skillNames);

  for (const name of skillNames) {
    const content = await readFile(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const version = content.match(/^version:\s*["']?([^"'\n]+)["']?$/m)?.[1];
    const digest = createHash('sha256').update(content).digest('hex');
    assert.equal(lock.skills[name].version, version);
    assert.equal(lock.skills[name].sha256, digest);

    const packageFiles = (await filesUnder(path.join(root, 'skills', name))).sort();
    assert.deepEqual(Object.keys(lock.skills[name].files).sort(), packageFiles);
    for (const relative of packageFiles) {
      const file = await readFile(path.join(root, 'skills', name, relative));
      assert.equal(
        lock.skills[name].files[relative],
        createHash('sha256').update(file).digest('hex'),
      );
    }
  }
});
