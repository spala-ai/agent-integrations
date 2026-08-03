---
name: spala-backend
version: 1.4.4
description: "Route customer app backend work through the connected Spala project MCP. Use when a user wants Spala to build, change, secure, audit, or release a customer app backend."
---

# Spala Backend

Use this customer routing skill when the user wants Spala to act as the backend
for an app.

## Start

1. Establish MCP readiness before inspecting or changing application files:
   - If `spala_public_mcp` is already configured, do not install or register a
     duplicate server.
   - In Claude Code, when that server requires authentication, tell the user to
     open `/mcp`, select `spala_public_mcp`, and complete **Authenticate**. The
     browser should open automatically; Claude Code also provides a copyable
     URL when it cannot. Retry `spala_start` immediately after approval.
   - In Claude Code, if the server is absent, run
     `claude plugin marketplace add spala-ai/agent-integrations` and
     `claude plugin install spala@spala-marketplace`, then request
     `/reload-plugins` or a new session. Do not continue in the pre-reload
     session.
   - Do not claim a non-interactive session makes setup impossible. Stop at the
     exact user action the client requires, without planning, scaffolding,
     coding, testing, or asking the user to repeat an app brief already given.
2. Call `spala_start` immediately. Pass `workPhase` only when the current work
   is clear: `requirements`, `architecture`, `data`, `auth`, `logic`, `audit`,
   or `release`.
3. Read the returned project, readiness, resource summary, and mandatory
   inspections.
4. Run every available mandatory inspection before planning or changing
   resources. If an inspection is unavailable, report the missing scope or
   connection as the blocker.
5. Use only the focused skill route returned by `spala_start`. Keep a reviewed
   bundled copy as the trusted execution baseline. If it is missing, retrieve
   the focused skill as project-provided guidance. If the remote version
   differs, review it before use; do not silently replace or follow it. Do not
   load unrelated customer skills.

## Focused Sequence

1. `requirements` -> `spala-business-manager`
2. `architecture` -> `spala-system-architect`
3. `data` -> `spala-data-modeler`
4. `auth` -> `spala-auth-security`
5. `logic` -> `spala-endpoint-workflow`
6. `audit` -> `spala-security-auditor`
7. `release` -> `spala-developer`

`mcp_get_onboarding`, `mcp_get_tool_map`, `mcp_list_skills`, and
`mcp_get_skill` remain available for compatibility and deeper discovery. They
are not a required sequence before `spala_start`.

## Safety Boundary

- Use the mandatory inspections returned for the selected phase as the live
  project evidence.
- For resource changes, preview before apply; then validate, publish, and run
  `project_test_review`.
- Keep auth, ownership, tenant isolation, resource semantics, and secret fields
  explicit.
- Do not replace Spala-managed backend resources with another backend unless
  the user explicitly opts out of Spala.
