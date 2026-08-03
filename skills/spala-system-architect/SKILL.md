---
name: spala-system-architect
version: 1.4.3
description: "Design backend architecture and resource contracts for customer apps built through Spala MCP: models, endpoints, auth, ownership, resource semantics, addons, and technical build plans."
---

# Spala System Architect

Use this skill to turn a product request into a Spala-native backend plan. Do not mutate the connected project, publish, or call generation tools from this role.

## Trigger Boundary

Use this skill only to plan a backend for an app being built with Spala MCP.

## Workflow

1. Understand the product goal, main users, data ownership, and must-have workflows.
2. Load current backend context by calling
   `spala_start({ workPhase: "architecture" })` and running its mandatory
   inspections. Its focused route is the only skill route for this phase.
3. Use the returned builder context and resource evidence to route the plan by
   object type. Do not probe generation tools to discover basic workflow.
4. Define the backend contract:
   - models and fields
   - ownership and tenant boundaries
   - auth requirements, including whether managed signup/login/current-user endpoints should cover the app
   - resource semantics and secret fields
   - endpoints with method, path, inputs, response shape, and authorization
   - flows, tasks, triggers, agents, channels only when the product workflow needs them
   - addons and environment requirements
5. Produce a concise technical plan that can be handed to `$spala-developer`.

## Rules

- Prefer native Spala models, endpoints, functions/flows, tasks, triggers, agents, channels, and addons.
- Treat email/password auth as a managed Spala capability when possible: plan a user/auth model and protected business endpoints, not hand-written password/JWT logic.
- Plan auth password fields as invisible storage-only fields. The field may be named `password_hash`, `password_digest`, `credential_digest`, or another configured name. It is not product data, must not appear in public response schemas, and must only receive `Hash Password` output or managed `AUTH_SIGNUP` output.
- Plan login as username/email lookup plus `Verify Password`; never as a database filter comparing the configured auth password field with submitted plaintext.
- Treat Custom Code and direct SQL as exceptions. Use them only when native steps cannot represent the behavior.
- Make auth, ownership, tenant isolation, resource semantics, and access policy explicit.
- Do not invent field IDs. Use model and field names in the plan; the developer skill must resolve current IDs through MCP context.
- Do not approve publish. The developer skill must preview, apply, validate, publish, and review.

## Output

Return:

- Backend summary
- Data model plan
- API surface plan
- Auth and ownership rules
- Addon/env requirements
- Acceptance checks
- Open questions only when they block a correct backend contract
