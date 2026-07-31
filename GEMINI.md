# Spala Integration

Use Spala only when the user asks to use Spala as the backend for a customer
application or asks to operate a hosted Spala project.

The configured `spala_public_mcp` server is the public front door. It handles
authentication, account and project discovery, project creation or selection,
and project MCP handoff. It does not mutate project backend resources.

When the user asks to use Spala:

1. Call authenticated `spala_start` on the public MCP before inspecting,
   planning, scaffolding, coding, testing, or QA for the application.
2. Complete any authentication or setup action returned by the tool instead of
   asking the user to remind you.
3. Never guess, construct, or rewrite a project MCP URL.
4. After project selection, follow the returned project handoff.
5. On the project MCP, call `spala_start` for the current work phase, run its
   mandatory inspections, and follow its focused workflow.

Do not use this integration for Spala platform source-code development. Work
directly with a platform repository and its local instructions in that case.
