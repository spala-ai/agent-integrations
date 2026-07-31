---
name: spala-backend
version: 1.4.1
description: "Route customer app backend work through the connected Spala project MCP. Use when a user wants Spala to build, change, secure, audit, or release a customer app backend."
---

# Spala Backend

Use this customer routing skill when the user wants Spala to act as the backend
for an app.

## Start

1. Complete MCP authentication when required.
2. Call `spala_start` immediately. Pass `workPhase` only when the current work
   is clear: `requirements`, `architecture`, `data`, `auth`, `logic`, `audit`,
   or `release`.
3. Read the returned project, readiness, resource summary, and mandatory
   inspections.
4. Run every available mandatory inspection before planning or changing
   resources. If an inspection is unavailable, report the missing scope or
   connection as the blocker.
5. Fetch and follow only the `focusedSkill` returned by `spala_start` when the
   client needs local skill text. Do not load unrelated customer skills.

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
