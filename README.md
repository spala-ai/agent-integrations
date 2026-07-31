# Spala Agent Integrations

Official Spala plugins and extensions for leading AI coding agents.

One repository supplies the same reviewed Spala skills and public MCP
connection to:

- Claude Code
- ChatGPT and Codex
- Gemini CLI
- Cursor
- Visual Studio Code with GitHub Copilot

The package configures only `https://mcp.spala.ai/mcp`. That public server
authenticates the user, finds or creates the intended Spala project, and
returns the selected project's handoff. Project URLs and credentials are never
bundled in this repository.

## Claude Code

```text
/plugin marketplace add spala-ai/agent-integrations
/plugin install spala@spala-marketplace
/reload-plugins
```

Use `/mcp` if Claude Code asks you to complete browser authentication.

The `spala-marketplace` identifier is retained from the earlier
`spala-ai/claude-plugins` repository so the plugin install name does not
change. To migrate an existing Claude-only marketplace:

```text
/plugin marketplace remove spala-marketplace
/plugin marketplace add spala-ai/agent-integrations
/plugin install spala@spala-marketplace
/reload-plugins
```

## ChatGPT And Codex

For local Codex testing:

```bash
codex plugin marketplace add spala-ai/agent-integrations
codex plugin add spala@spala-integrations
```

The `.codex-plugin` package is also suitable for submission to the shared
ChatGPT and Codex plugin directory.

## Gemini CLI

```bash
gemini extensions install https://github.com/spala-ai/agent-integrations --auto-update
```

Restart Gemini CLI after installation.

## Cursor

Add the repository as a plugin marketplace:

```bash
cursor-agent plugin marketplace add https://github.com/spala-ai/agent-integrations
```

Then open `/plugin`, select the marketplace, and install **Spala**. Cursor does
not currently expose a non-interactive plugin-install command.

## Visual Studio Code

Run **Chat: Install Plugin From Source** from the Command Palette and enter:

```text
https://github.com/spala-ai/agent-integrations
```

VS Code recognizes the repository's Claude-compatible plugin manifest and
loads its skills and public MCP server.

## Other MCP Clients

Use the universal installer for Windsurf, Cline, Roo Code, Zed, Antigravity,
Claude Desktop, or direct MCP configuration:

```bash
npx --yes @spala-ai/mcp-install --public --yes
```

## Safety Boundary

- The public MCP discovers accounts and projects and issues project handoffs.
- The selected project MCP performs backend inspection and mutation.
- No platform source, project credentials, project MCP URLs, deployment files,
  or private infrastructure belong in this repository.
- Installing this package does not grant access by itself. Spala OAuth and
  project authorization remain authoritative.

## Validate

```bash
pnpm install
pnpm run ci
pnpm test:links
```

After the public repository is created, run the release-only repository check:

```bash
pnpm test:links:release
```

The OpenAI marketplace package contains synchronized copies because its
marketplace layout requires a nested plugin directory. Edit the root
`skills/` or `.mcp.json`, then run:

```bash
pnpm sync:openai
```

## License

See [LICENSE](LICENSE).
