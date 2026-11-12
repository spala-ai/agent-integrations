# Spala

Spala is a backend platform for apps built with AI coding agents. This plugin
lets Claude build and run a real application backend on Spala: data models,
API endpoints, authentication, ownership rules, background tasks and triggers.
Claude writes the backend into your Spala project, Spala validates it and
checks access rules, and only then is it published.

## What the plugin contains

- **Nine skills** that teach Claude how to work with Spala: planning the
  business scope, designing the architecture and data models, building
  endpoints and workflows, writing Step Script, setting up auth and tenant
  isolation, and auditing security before release.
- **One remote MCP server**, `https://mcp.spala.ai/mcp`, operated by Spala.
  It signs you in, finds or creates your Spala project, and hands Claude over
  to that project.

There are no hooks, commands, local servers or bundled executables.

## What it runs, sends and fetches

- The plugin itself runs no code on your machine. The skills are Markdown
  instructions.
- Claude calls the Spala MCP server only after you sign in to your Spala
  account in the browser (OAuth). No tokens or project credentials are stored
  in this package.
- Tool calls send Spala what is needed to build your backend: project and
  organization names, the models, endpoints and logic Claude writes, and test
  requests against your project. Nothing is sent to any other service.
- When you connect a project, the Spala server can return a version-pinned
  `@spala-ai/mcp-install` command that registers that project's own MCP
  server with your client. It runs under your client's normal permission
  prompts.

You need a Spala account. Create one at [spala.ai](https://spala.ai).

- Privacy policy: [spala.ai/privacy](https://spala.ai/privacy)
- Terms: [spala.ai/terms](https://spala.ai/terms)
- Documentation: [docs.spala.ai](https://docs.spala.ai)
- Support: [info@spala.ai](mailto:info@spala.ai)

## Other coding agents

The same repository supplies the same reviewed skills and public MCP
connection to ChatGPT and Codex, Gemini CLI, Cursor, and Visual Studio Code
with GitHub Copilot. Project URLs and credentials are never bundled in this
repository.

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

All clients use the same root `skills/` directory and the same public MCP
endpoint. Codex and Cursor reference `.mcp.json`; Claude and Gemini express
that endpoint in their native manifests. There are no generated
client-specific copies.

## Skill Source And Updates

The project MCP package is the source of truth for the nine customer-facing
skills. This repository carries one reviewed mirror so installed clients have
the guidance immediately, including before OAuth completes or when the MCP is
temporarily unavailable.

At runtime, `spala_start` returns the focused skill version and SHA from the
selected project MCP. The reviewed bundled copy remains the trusted execution
baseline. If the local skill is missing, a client may fetch the focused skill
with `mcp_get_skill` as project-provided guidance. If the remote version
differs, the client may fetch it for review but must not silently replace or
follow the bundled instructions.

The version is a freshness advisory. The SHA-256 value verifies transfer
consistency only: because the skill content and hash come from the same project
MCP, it does not authenticate the publisher. A remote update becomes trusted
only after it matches an independently reviewed integration release recorded
in `skills.lock.json`, or after explicit review and approval. Runtime downloads
are therefore a compatibility and review path, not an installation dependency,
and must never rewrite the installed plugin package automatically.

Release maintainers refresh the bundle from a platform checkout with:

```bash
pnpm sync:skills -- --source <platform-repository>
pnpm check:skills -- --source <platform-repository>
```

`skills.lock.json` records the version and SHA-256 digest of every bundled
skill package file. CI verifies the lock against the package, requires a skill
version bump for `SKILL.md` changes, and requires a distribution version bump
for any bundled skill package change.

## License

See [LICENSE](LICENSE).
