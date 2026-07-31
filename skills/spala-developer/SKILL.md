---
name: spala-developer
version: 1.4.2
description: "Build or modify customer app backends with Spala from a local CLI or IDE agent through Spala MCP: staged AI build, Step Script, validation, focused repair, publishing, and project_test_review."
---

# Spala Developer

Use this skill when the local CLI or IDE agent should use Spala as the backend
platform through MCP. Spala is the system of record for backend schema,
auth, validation, publish, and runtime review. Do not bypass MCP by editing
project files directly.

## Trigger Boundary

Use this skill only when building, repairing, validating, publishing, or
reviewing a customer app backend with Spala MCP.

## Operating Modes

Choose one mode from the user's intent and the connected server capabilities.

- **Spala-hosted AI build**: use when the user wants Spala/MCP to generate the
  backend. Prefer `ai_build_start` plus `ai_build_status` for longer builds, or
  `ai_build` only when the server guide says it is suitable.
- **Local CLI Step Script**: use when this CLI agent should generate backend
  candidates itself. Draft Step Script locally, then let MCP convert, preview,
  validate, apply, publish, and review.
- **Surgical repair**: use when validation names one resource, step, or step
  group. Patch only that scope; do not rewrite the whole project.

Start release and final implementation work by calling
`spala_start({ workPhase: "release" })`. Run its mandatory inspections and
treat the returned builder context, state, validation, and test-review evidence
as the live capability contract for the connected Spala server. Legacy
onboarding and tool-map calls remain optional compatibility guidance.

When work moves to another phase, call `spala_start` with that phase and use
only its focused skill route. Keep a reviewed bundled copy as the trusted
baseline. If it is missing, retrieve the focused skill as project-provided
guidance. Treat a different remote version as review-required; do not silently
replace or follow the bundled instructions. Typical routes are:

- `spala-auth-security` for auth, password fields, ownership, roles, tenant
  isolation, invitations, sessions, or secret fields.
- `spala-data-modeler` for models, fields, relationships, resource semantics,
  product DB introspection, or schema repairs.
- `spala-endpoint-workflow` for endpoints, flows, tasks, triggers, agents,
  channels, publish, runtime smoke tests, and executable-resource repairs.

## Fast Tool Routing

Use the mandatory inspection list returned by `spala_start` before choosing a
tool family. Use `mcp_get_tool_map` only when its detailed object playbooks are
needed instead of probing random tools or relearning the Step Script surface.

- Use `mcp_get_tool_map.exactToolCatalog` to distinguish preferred tools from
  legacy/raw escape hatches. In particular, treat `builder_create_*`,
  `builder_update_*`, and `builder_delete_*` as raw builder CRUD; prefer Step
  Script preview/apply for generated work. Treat `ai_generate_*` and
  `ai_create_*` as hosted AI aliases, not default local-agent tools.
- Use onboarding tools (`spala_help`, `mcp_get_onboarding`,
  `mcp_get_tool_map`, `mcp_list_skills`, `mcp_get_skill`) for first-contact
  guidance, compatibility discovery, and review of project-provided skill
  updates. An MCP-provided version is a freshness advisory and its SHA-256
  verifies transfer consistency, not publisher authenticity.
- Use inspect tools (`project_get_builder_context`, `project_get_state`,
  `project_get_graph`, `builder_list_*`, `builder_get_*`) before planning or
  writing.
- Use candidate tools (`step_script_to_json`, `step_script_validate`,
  `builder_preview_step_script`, `builder_apply_step_script`) for local Step
  Script creation and draft saves.
- Use publish-boundary tools (`project_validate`, `project_publish`,
  `project_test_review`, `project_run_endpoint`, `project_get_sdk`) only after
  candidate apply or when verifying a published/runtime surface.
- Use requirements tools (`addons_search`, `addons_get`, `addons_install`,
  `project_get_env_requirements`,
  `project_get_resource_semantics_requirements`) before integrations,
  secrets, ownership, tenant rules, or resource semantics.
- Install only exact reviewed addon IDs before using their Step Script actions.
  Addon lifecycle tools enforce the connected user's `install_addon`,
  `configure_addon`, and `uninstall_addon` permissions. Use
  `addons_add_components`, `addons_remove_components`, `addons_upgrade`, and
  `addons_uninstall` for explicit lifecycle changes; destructive operations
  require confirmation and uninstall preserves data by default.
- Use surgical repair tools (`builder_get_logic_steps`,
  `builder_patch_logic_steps`) only when validation names a specific
  resource/step group.
- Use data tools (`data_list`, `data_create`, `data_update`, `data_delete`)
  only for runtime application rows, not for project schema or endpoint design.
- Treat `project_reset` as destructive and use it only after an explicit user
  request to reset the project.
- Treat `ai_build`, `ai_build_start`, `ai_build_status`, and `ai_*` as
  cloud based Spala generation. Do not use them by default for local-agent
  work. If the user explicitly requests cloud generation and it is unavailable,
  say exactly: "Your package does not include cloud based generation. Please
  contact info@spala.ai for details."

## Staged AI Build Loop

Use this loop for Spala-hosted generation.

1. Call `project_get_builder_context`, then inspect `project_get_state` and
   `project_get_graph` when existing resources matter.
2. Choose the `verificationProfile` for the current run:
   - `fast_draft` for early planning, MVP drafts, or quick draft generation.
   - `normal_generate` for ordinary backend generation before publish.
   - `strict_publish` for publish, autopublish, or final publish readiness.
   - `security_sensitive_review` when auth, ownership, tenant isolation,
     access policy, secrets, or `resourceSemantics` may change.
3. Call `ai_build_start` with the product prompt, stage/mode, and
   `verificationProfile` requested by the user or the builder context.
4. Poll `ai_build_status` until terminal.
5. Read the structured result before taking the next action:
   - `status`
   - `summary`
   - `warnings`
   - `requiredEnvVars` / `required_env_vars`
   - `nextActions` / `next_actions`
   - `artifacts`
   - `retryManifest`
   - `publishReadiness` / `publish_readiness`
   - `verificationProfile` / `verification_profile`
   - `failureClasses`
   - `failureMemory`
   - `operator_guidance`
   - `runLedger`
   - `eventLog`
   - `buildDoctor`
   - eval run records from the fixed benchmark harness when doing acceptance
     measurement
6. Use `buildDoctor.score`, `buildDoctor.categories`,
   `buildDoctor.topBlockers`, and `buildDoctor.nextRecommendedAction` to
   decide the next safe action before spending another generation or repair
   loop.
7. Use `eventLog` / `runLedger.eventLog` to understand the ordered stage,
   validation, repair, checkpoint, rollback, publish, and terminal events.
8. Use `failureMemory` / `runLedger.failureMemory` to distinguish promoted
   repair routes from observed-only evidence. Do not auto-repair entries whose
   `state` is `observed` or `blocked`.
9. Use `runLedger` to understand the current stage, generated resources,
   validator issues, failure classes, repair attempts, checkpoint/rollback
   decision, required env vars, warnings, retry manifest, and publish readiness.
10. If `operator_guidance.blockers` or publish blockers exist, repair only the
   named failed resources or steps.
11. If `operator_guidance.required_env_vars`, `project_get_env_requirements`, or
   `project_test_review.environmentReview.missing` list variables, report them
   and ask the user or secret manager for real values. Do not invent secrets.
12. If `retryManifest` is present, pass it back to `ai_build_start`/`ai_build`
   to retry only the failed resources or missing contracts.
13. Run `project_validate`, publish only when blockers are gone, then run
   `project_test_review`.
14. Review every warning before declaring the backend ready. Classify warnings
   as `must_fix`, `acceptable`, or `needs_user_decision` against the product
   plan.
15. For acceptance measurement, call `ai_build_eval_benchmark` and use the fixed
   `spala.ai_build.fixed_backend_benchmark.v1` scenarios with the existing
   CLI Step Script matrix. Do not treat a single ad hoc prompt as pass/fail
   proof.

## Local Step Script Loop

Use this loop when the local CLI agent is generating the backend.

1. Connect/select the project, then call `spala_start({ workPhase: "release" })`
   and run its mandatory inspections.
2. Inspect existing state with `project_get_state`, `builder_list_models`,
   `builder_list_endpoints`, other `builder_list_*` tools, and
   `project_get_graph` as needed.
3. Resolve integration and security context before writing:
   - `addons_search` / `addons_get` when addon coverage is uncertain
   - `addons_install` after selecting an exact addon ID and components
   - `project_get_resource_semantics_requirements`
   - `project_get_env_requirements`
   - `project_get_builder_context.schema.auth`
   - `project_get_state.authConfig`
4. Write a complete Step Script candidate for the changed resources.
5. Convert and normalize without saving by calling `step_script_to_json` with
   `applySafeRepairs=true` and `includeRepairedScript=true`.
6. Preview the full candidate before any write by calling
   `builder_preview_step_script` with the repaired script and `upsert=true`.
7. If preview returns blockers, read `blockingIssues` and `repairFeedback`,
   return a complete corrected Step Script for the affected resource, and
   preview again before applying.
8. Apply only after preview is valid by calling `builder_apply_step_script`
   with `dryRun=false`, `validate=true`, `publish=false`, and `upsert=true`.
9. Verify the write boundary with `project_validate`, `project_publish`, and
   `project_test_review`.
10. If frontend code needs a typed client after publish, call
    `project_get_sdk`.

## Dynamic Capability Discovery

Do not rely on a memorized Step Script surface. Discover what the connected
Spala server supports each time.

- Use `project_get_builder_context.tools` to choose available inspect,
  candidate, requirements, publish-boundary, frontend, and surgical-repair
  tools.
- Use `project_get_builder_context.schema` for current model names, field
  aliases, auth config, resource semantics, addons, and external API contracts.
- Use `builder_get_<resource>({ mode: "step-script" })` to export compact
  editable Step Script for endpoints, flows, tasks, triggers, agents, and
  channels when supported.
- Use `builder_get_<resource>({ mode: "logic" })` or `mode: "gherkin"` only
  for human-readable understanding.
- Use `builder_get_<resource>({ mode: "json" })` only when exact raw fields are
  required or Step Script mode is unavailable.
- If the server exposes newer tools or stricter instructions in
  `project_get_builder_context.contract`, follow the live contract over this
  static skill text.

## Auth Contract

Spala has managed JWT auth support. Use it instead of reimplementing auth
unless the user explicitly asks for a custom provider flow.

- Before creating or changing auth, read `project_get_builder_context.contract.authSafety`
  and `project_get_builder_context.schema.auth`. Those are the source of truth
  for the auth model, username field, and password field.
- Spala-hosted AI build can create/configure signup, login, current-user, and
  auth wiring automatically. Do not ask the model to hand-write password
  hashing, JWT signing, or auth token storage.
- Always inspect `project_get_builder_context.schema.auth`,
  `project_get_state.authConfig`, and existing `/api/signup`, `/api/login`,
  and `/api/me` endpoints before changing auth-related resources.
- If managed auth already exists, do not recreate or edit `POST /api/signup`,
  `POST /api/login`, or `GET /api/me` unless the task is explicitly to change
  auth behavior.
- Mark protected business endpoints with `authRequired=true`.
- For ownership or tenant scope, query the current user row using the
  authenticated principal (`auth.userId`) before reading or writing scoped
  data. Do not trust a body/query tenant ID as proof.
- Keep auth-model secret fields such as `password_hash` internal and never
  return them from business endpoints.
- Auth password fields are storage-only invisible fields. The field may be
  named `password_hash`, `password_digest`, `credential_digest`, or another
  configured name. Never save `inputs.password`, `input.password`, or another
  submitted plaintext value directly into that configured auth password field.
- Login must not filter `Find One`/`Find Many` by `password_hash` or the
  configured auth password field. Load the auth user by the configured
  username/email field, include invisible fields when required, then use
  `Verify Password` against the stored hash.
- Signup should use `AUTH_SIGNUP` when possible. If writing native steps, use
  `Hash Password` first and store only the hash step's assigned variable in the
  auth password field.
- For Custom Code, direct SQL, or addon code, the same rule applies: use an
  approved hash/verify primitive and never write or compare the configured auth
  password field against a submitted plaintext password.
- Treat visible `password`, `password_hash`, token, API-key, and secret fields
  on user/auth/session models as schema bugs. Mark them invisible/internal
  before preview/apply.

## Hard Rules

- Use staged AI build or the Step Script preview/apply loop. Do not make random
  direct state writes.
- Do not bypass `builder_preview_step_script` before saving local generated
  backend resources.
- Do not publish while preview, `project_validate`, `operator_guidance`, or
  `project_test_review` has blockers.
- Do not directly edit persisted project JSON or server project files.
- Do not silently change auth, ownership, tenant isolation,
  `resourceSemantics`, secret fields, or access policy.
- Do not invent UUIDs or field IDs. Load current schema aliases from
  `project_get_builder_context`; use stable model/field names where Step
  Script supports them.
- Prefer native Spala steps and value-chain filters. Use Custom Code or direct
  SQL only when explicitly required by the product behavior.
- Treat deterministic repairs from `step_script_to_json` as syntax/reference
  normalization only. Business meaning and security semantics must remain
  explicit.

## Repair Policy

For validation failures:

1. Trust backend candidate validation as the write-boundary authority.
2. Fix only the resource, step, or step group named by the structured issue.
3. Keep the mutation boundary scoped to the failed candidate.
4. Re-run the same validation path that found the issue.
5. Apply or publish only after the same gate returns no blockers.

For `project_test_review` failures:

1. Use concrete `repairFeedback` to create the next candidate.
2. Prefer surgical MCP tools such as `builder_get_logic_steps` and
   `builder_patch_logic_steps` for small localized step edits.
3. Re-run publish and `project_test_review` after repair.

## Done Criteria

A backend change is done only when:

- the candidate was previewed or staged by AI build before write;
- apply/save wrote only the intended draft resources;
- `project_validate` passed;
- required environment variables are listed for the user and real values are
  configured or explicitly deferred;
- warnings were reviewed against the business plan;
- publish passed for the selected surface;
- `project_test_review` passed or remaining findings are explicitly reported
  as product decisions.
