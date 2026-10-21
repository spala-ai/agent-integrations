# Community marketplace submission

Submitting `spala` to Anthropic's `claude-community` marketplace so users no longer
have to add our own marketplace first.

## Why this matters

Today a user must run `/plugin marketplace add spala-ai/agent-integrations` — adding a
third-party marketplace they have no reason to trust yet. Anthropic's warning is shown
at that moment:

> Make sure you trust a plugin before installing it. Anthropic doesn't control what MCP
> servers, files, or other software are included in plugins.

After listing, that becomes `/plugin marketplace add anthropics/claude-plugins-community`
— an Anthropic-owned repo, safety-screened, with our plugin pinned to a reviewed commit
SHA. Same number of steps, materially better trust story.

`claude-plugins-official` would remove the marketplace step entirely, because Claude Code
registers it automatically on first interactive launch. It is curated at Anthropic's
discretion with no application process, so it cannot be pursued directly — the community
listing is the actionable route.

## Where to submit

- **Console (use this one):** https://platform.claude.com/plugins/submit
- claude.ai: https://claude.ai/admin-settings/directory/submissions/plugins/new —
  requires a Team or Enterprise org with directory management access.

## Pre-submission checks — all passing as of 2026-08-04

| Check | Result |
|---|---|
| `claude plugin validate .` | `✔ Validation passed` |
| Repository public | `api.github.com/repos/spala-ai/agent-integrations` → 200 |
| `.claude-plugin/marketplace.json` | present, `spala-marketplace`, plugin `spala` v1.3.2 |
| `.claude-plugin/plugin.json` | present, declares `mcpServers.spala_public_mcp` |
| `README.md` / `LICENSE` | present |
| Skills | 9 under `skills/` |
| MCP URL canonical | `https://mcp.spala.ai/mcp` in both manifests |
| No credentials in manifests | confirmed — OAuth only, nothing embedded |

Run `claude plugin validate . --strict` before submitting if you want warnings treated
as errors; the review pipeline runs the same validation.

## What users get after listing

```
/plugin marketplace add anthropics/claude-plugins-community
/plugin install spala@claude-community
/reload-plugins
```

Installing registers `spala_public_mcp` automatically, because `plugin.json` declares it
under `mcpServers`. OAuth is still a separate explicit step: `/mcp` → `spala_public_mcp`
→ **Authenticate**, or `claude mcp login spala_public_mcp`.

## After approval

The plugin is pinned to a commit SHA in the community catalog and CI bumps the pin as we
push. The public catalog syncs nightly, so there is a delay between approval and the
plugin being installable. Check by searching for `spala` in:
https://github.com/anthropics/claude-plugins-community/blob/main/.claude-plugin/marketplace.json

## Known cleanup, not blocking

`plugin.json` (`mcpServers`) and the root `.mcp.json` declare the same server with
identical config. Same server name and identical config, so there is no double
registration today, but the duplication can drift if only one is updated. Consider
keeping a single declaration.
