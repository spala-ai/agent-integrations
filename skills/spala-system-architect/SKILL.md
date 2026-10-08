---
name: spala-system-architect
version: 1.4.18
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
- Plan project-model relationships as explicit `Table Reference` contracts and
  derive identifier types from the current model schema. Do not assume UUIDs
  from `*_id` names; new Step Script models default to numeric auto-increment
  IDs unless UUID is explicitly part of the design.
- Distinguish mutable staging schema work from production inspection and
  reviewed schema promotion; do not plan direct production schema editing.
- Treat `ACCESS_PROOF` as declarative static-analysis metadata, never as the
  credential check itself. Require a real credential comparison, missing-record
  guard, and downstream owner or tenant binding.
- Plan exported releases with stored environment, database, and addon
  credentials stripped. Explicitly authored executable literals are preserved
  with nonblocking, value-free warnings for suspected credentials, even when
  the same value exists in stored configuration. Configuration fields remain
  redacted. The final artifact check rejects detected known configuration
  credential values absent from authored executable source or its static
  literal AST.
  Do not assume automatic externalization of literals or public export-policy
  modes. Persistent Node is the target for supported persistent features, not
  a promise of complete hosted-feature parity. Review release capabilities and
  provider compatibility before planning background tasks, agents or database
  policies. Vercel is HTTP-focused and does not supply a persistent scheduler,
  background worker or Socket.IO service; Netlify requires a separate adapter.
  Destination secrets remain outside Spala MCP.
- Supported agent webhooks require persistent Node and destination-supplied
  secrets from the generated environment contract. Valid webhook signatures
  authenticate senders, not product users. Schedule, database-change and socket
  automatic agent activation, and Vercel agent webhooks, remain rejected; do not
  substitute no-ops or assume ordinary task/trigger support activates agents.
- Treat validated addon `credentialBindings` maps as nonsecret references to
  runtime environment-variable names. Exports retain these references while
  redacting actual credential values; malformed binding values are omitted.
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
