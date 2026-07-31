# Repository Scope

This public repository distributes Spala integrations for agent clients. It
contains public agent skills and the public Spala MCP connection only.

Do not add platform source code, project MCP credentials, project-specific MCP
URLs, deployment scripts, hosting account names, server paths, private
endpoints, production configuration, tokens, or credentials.

The public MCP is for discovery, authentication, project selection, and
handoff. Project mutations belong to the selected project's MCP.

Before committing, run:

```bash
pnpm run ci
git diff --check
```
