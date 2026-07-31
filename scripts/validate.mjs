import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_MCP_URL = 'https://mcp.spala.ai/mcp';
const VERSION = '1.2.0';

async function json(relative) {
  return JSON.parse(await readFile(path.join(root, relative), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertOnlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    assert(allowed.has(key), `${label} contains unsupported field ${key}.`);
  }
}

const integration = await json('integration.manifest.json');
const claude = await json('.claude-plugin/plugin.json');
const claudeMarketplace = await json('.claude-plugin/marketplace.json');
const cursor = await json('.cursor-plugin/plugin.json');
const cursorMarketplace = await json('.cursor-plugin/marketplace.json');
const gemini = await json('gemini-extension.json');
const openai = await json('plugins/spala/.codex-plugin/plugin.json');
const openaiMarketplace = await json('.agents/plugins/marketplace.json');
const mcp = await json('.mcp.json');

assertOnlyKeys(cursor, new Set([
  'name',
  'displayName',
  'description',
  'version',
  'author',
  'publisher',
  'homepage',
  'repository',
  'license',
  'logo',
  'keywords',
  'category',
  'tags',
  'commands',
  'agents',
  'skills',
  'rules',
  'hooks',
  'mcpServers',
]), 'Cursor plugin');
assertOnlyKeys(cursorMarketplace, new Set([
  'name',
  'owner',
  'metadata',
  'plugins',
]), 'Cursor marketplace');

for (const [label, version] of Object.entries({
  integration: integration.version,
  claude: claude.version,
  claudeMarketplace: claudeMarketplace.plugins[0]?.version,
  cursor: cursor.version,
  gemini: gemini.version,
  openai: openai.version,
})) {
  assert(version === VERSION, `${label} version must be ${VERSION}.`);
}

assert(integration.publicMcp.url === PUBLIC_MCP_URL, 'Integration manifest MCP URL drifted.');
assert(mcp.mcpServers?.spala_public_mcp?.url === PUBLIC_MCP_URL, 'Shared MCP URL drifted.');
assert(claude.mcpServers?.spala_public_mcp?.url === PUBLIC_MCP_URL, 'Claude MCP URL drifted.');
assert(gemini.mcpServers?.spala_public_mcp?.httpUrl === PUBLIC_MCP_URL, 'Gemini MCP URL drifted.');
assert(cursor.mcpServers === './.mcp.json', 'Cursor must use the shared MCP definition.');
assert(openai.mcpServers === './.mcp.json', 'OpenAI must use its synchronized MCP definition.');
assert(cursorMarketplace.plugins.some(plugin => plugin.name === 'spala' && plugin.source === '.'), 'Cursor marketplace is not wired to the root plugin.');
assert(claudeMarketplace.plugins.some(plugin => plugin.name === 'spala' && plugin.source === '.'), 'Claude marketplace is not wired to the root plugin.');
assert(openaiMarketplace.plugins.some(plugin => plugin.name === 'spala'), 'OpenAI marketplace is not wired to the Spala plugin.');

const skillDirs = (await readdir(path.join(root, 'skills'), { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();
assert(skillDirs.length === 9, `Expected 9 canonical skills, found ${skillDirs.length}.`);

for (const skill of skillDirs) {
  const text = await readFile(path.join(root, 'skills', skill, 'SKILL.md'), 'utf8');
  assert(text.startsWith('---\n'), `${skill} is missing YAML frontmatter.`);
  assert(text.includes(`name: ${skill}\n`), `${skill} frontmatter name does not match its directory.`);
  assert(/\ndescription:\s*["']?.+\n/.test(text), `${skill} is missing a description.`);
}

assert(integration.projectMcp.resolvedDynamically === true, 'Project MCPs must be resolved dynamically.');
assert(integration.projectMcp.credentialsBundled === false, 'Project credentials must never be bundled.');
assert(integration.projectMcp.urlsBundled === false, 'Project MCP URLs must never be bundled.');

process.stdout.write('All integration manifests are valid and aligned.\n');
