---
name: spala-developer
version: 1.4.18
description: "Build, validate, publish, review, or hand off a customer app backend for external deployment through Spala MCP from a local CLI or IDE agent."
---

# Spala Developer

Use this skill when the local CLI or IDE agent should use Spala as the backend
platform through MCP. Spala is the system of record for backend schema,
auth, validation, publish, and runtime review. Do not bypass MCP by editing
project files directly.

## Native vector search

Use `Vector` fields for embeddings and native `Similarity Search` with the
required owner/tenant filters. Do not store search embeddings in JSON arrays
or compute cosine similarity in Custom Code. Keep dimensions and embedding
model consistent. If pgvector is missing, request operator setup; do not
fallback to JSON. Migrating existing JSON embeddings requires approval.

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
- **Typed operation plan**: use for supported CRUD, owner-scoped CRUD, status
  transitions, and parent-child endpoints. It compiles deterministically
  against the live schema and can be more compact for guarded operations.
  Preview with `builder_preview_operation_plan`, retain its `reviewReceipt`,
  then apply the identical plan and receipt with
  `builder_apply_operation_plan` only after preview passes.
- **Surgical repair**: use when validation names one resource, step, or step
  group. Patch only that scope; do not rewrite the whole project.

Start release and final implementation work by calling
`spala_start({ workPhase: "release" })`. Run its mandatory inspections and
treat the returned builder context, state, validation, and test-review evidence
as the live capability contract for the connected Spala server. Legacy
onboarding and tool-map calls remain optional compatibility guidance.

The default/full MCP URL retains every tool. An opt-in `profile=guided` URL
advertises a smaller normal build, publish, validation, test, and runtime-data
surface. Use guided for ordinary backend work; reconnect to the same URL
without `profile=guided` only when addon lifecycle, hosted AI, frontend hosting,
raw builder CRUD, or deployment handoff is actually required.

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
- Use candidate tools (`builder_preview_operation_plan`,
  `builder_apply_operation_plan`, `step_script_to_json`,
  `step_script_validate`, `builder_preview_step_script`,
  `builder_apply_step_script`) for typed operations, local Step Script
  creation, and draft saves.
- Use publish-boundary tools (`project_validate`, `project_publish`,
  `project_test_review`, `project_run_endpoint`, `project_get_sdk`) only after
  candidate apply or when verifying a published/runtime surface.
- Use `project_run_endpoint.cases` for up to ten sequential assertions with an
  exact non-5xx `expectedStatus`. Successful 2xx/3xx cases require
  `expectedBodyContains` unless `allowStatusOnlySuccess=true` explicitly marks
  an intentionally status-only probe. Exact 401/403 authorization outcomes
  pass on status; an unexpected status or any server error fails.
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
- For Deploy Anywhere, use the project-scope runtime handoff tools. Spala
  prepares the artifact with stored credentials stripped and verifies the result; the local agent
  owns provider CLI, SSH, and production database migration execution. Keep
  database and infrastructure credentials local; never send them through MCP.
- For approved example frontend clones, use only the server-advertised clone
  workflow and catalog asset. Review any declared colour-theme contract,
  activate only after validation, and verify the cloned frontend points at the
  destination project's backend. This is bounded static hosting, not SSR.
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
   When authorized values are supplied, use `project_update_config` as a partial
   patch, require its exact updated-key acknowledgement, then re-read environment
   requirements. A successful response confirms key metadata, not secret values;
   never expect or request those values back.
12. If `retryManifest` is present, pass it back to `ai_build_start`/`ai_build`
   to retry only the failed resources or missing contracts.
13. Run `project_validate`, publish only when blockers are gone, then run
   `project_test_review`.
14. Review every warning before declaring the backend ready. Classify warnings
   as `must_fix`, `acceptable`, or `needs_user_decision` against the product
   plan when warning triage is required. `POSSIBLE_HARDCODED_SECRET` remains
   advisory and does not itself require a triage decision, repair, or publish
   override; use environment references for confidential values.
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
   - `project_get_builder_context.schema.models` and
     `contract.relationshipSafety` before any database read, write, filter,
     join, or cross-model value flow
4. Write a complete Step Script candidate for the changed resources.
5. Convert and normalize without saving by calling `step_script_to_json` with
   `applySafeRepairs=true` and `includeRepairedScript=true`.
6. Preview the full candidate before any write by calling
   `builder_preview_step_script` with the repaired script and `upsert=true`.
7. If preview returns blockers, read `blockingIssues` and `repairFeedback`,
   return a complete corrected Step Script for the affected resource, and
   preview again before applying.
8. After preview is valid, save and publish the same reviewed candidate with
   `builder_apply_step_script` using `apply=true`, `validate=true`,
   `publish=true`, and `upsert=true`.
9. Verify with `project_validate` and `project_test_review`. Use
   `project_publish` only for an already-saved UI/raw draft or an intentionally
   draft-only Step Script write, and pass the exact `resourceIds` returned by
   that write.
10. If frontend code needs a typed client after publish, call
    `project_get_sdk`.

For a supported single-endpoint operation, replace steps 4–8 with a version-1
typed operation plan. Use exact model and field names from builder context,
preview with `builder_preview_operation_plan`, and apply the identical plan
with `builder_apply_operation_plan` plus the returned `reviewReceipt`. Review
its generated Step Script and
compiler diagnostics. If the compiler returns `UNSUPPORTED_INTENT` or
`UNSUPPORTED_OPERATION`, use the normal Step Script loop; do not force an
approximate plan.

## Dynamic Capability Discovery

Do not rely on a memorized Step Script surface. Discover what the connected
Spala server supports each time.

- Use `spala_start.mandatoryInspections` and the MCP client's advertised tool
  list to choose callable tools. Guided builder context is schema-first and
  intentionally omits the full tool catalog; request
  `project_get_builder_context({ responseMode: "full" })` only when its complete
  policy, API-surface, or tool-family metadata is needed.
- Use `project_get_builder_context.schema` for current model names, field
  aliases, auth config, resource semantics, addons, and external API contracts.
- Before editing an existing resource, call
  `builder_get_step_script_history({ resourceType, id })`. Use its
  `recommended.source`; an authored revision is recommended only when its
  version matches current canonical state. Treat
  `reference-only-stale-source` revisions as historical context, never as a
  replacement draft. Inspect the recommendation's `redacted` state before
  reuse. Repair any `[REDACTED]` placeholders or move those values to project
  environment variables; history redaction is defense in depth, not a secret
  storage mechanism.
- Use `builder_get_<resource>({ mode: "step-script" })` to export compact
  Step Script generated from current canonical JSON when authored provenance
  is unavailable or stale.
- Use `builder_get_<resource>({ mode: "logic" })` or `mode: "gherkin"` only
  for human-readable understanding.
- Use `builder_get_<resource>({ mode: "json" })` only when exact raw fields are
  required or Step Script mode is unavailable.
- If the server exposes newer tools or stricter instructions in
  `project_get_builder_context.contract`, follow the live contract over this
  static skill text.

## Deploy Anywhere Handoff

Use this only after the intended resource versions are published.
Deployment tools are intentionally absent from `profile=guided`; reconnect to
the unchanged full MCP URL for this separate phase.

Exports strip stored environment, database, and addon credentials. Explicitly
authored executable literals remain intact, with nonblocking, value-free
`POSSIBLE_HARDCODED_SECRET` warnings for suspected credentials. Review these
warnings and use runtime environment references for confidential values; the
export does not automatically externalize literals or expose public export-policy
modes. The final JSON and runtime-artifact check rejects detected stored
credential values absent from authored executable content. Values already
present in executable source or its static literal AST remain exportable even
when the same value exists in configuration; environment, database, and addon
configuration fields themselves remain redacted.

Validated flat addon `credentialBindings` maps preserve runtime environment-variable
names as nonsecret references. Configure their actual values at the destination;
do not replace binding names with credentials. Malformed binding values are
omitted from exported config and remain subject to secret collection.

An export failure with `UNSUPPORTED_RELEASE_CAPABILITIES` (HTTP 422) identifies
unsupported resources and steps. Use the returned IDs and capability reasons to
choose supported steps or keep those resources on the hosted runtime. This is
separate from nonblocking authored-literal warnings.

1. Review and publish the exact intended draft-only changes, then run
   `project_validate` and `project_test_review` before export.
2. Call `project_prepare_runtime_export`. Download the ZIP from the local TUI
   with its short-lived bearer capability and verify the returned SHA-256. Do
   not repeat or commit the capability.
3. Read `recipe.providerCompatibility` before choosing a destination. Run
   `bundle.js` on SSH, SFTP, Railway, Render, and container targets. The archive
   also includes a root `index.js` Vercel Node adapter and `vercel.json`.
   Supported scheduled tasks, background workers and realtime channels need
   a persistent runtime; the Vercel HTTP adapter does not supply those services.
   Check release capabilities rather than assuming complete hosted parity on
   persistent Node. Netlify still requires a separate adapter.
   Supported agent webhooks also require persistent Node. Read exact current
   and optional rotation secret names from `runtime-env.schema.json` and
   `.env.example`; supply values only at the destination. Stored webhook
   credentials are stripped, not copied from hosted config. A valid signature
   does not assign product-user identity. Schedule/database/socket automatic
   agent activation and Vercel agent webhooks remain rejected.
4. Keep the production database credentials only in the local TUI/CI
   environment. Never pass a connection string, password, provider token, or
   other database credential through MCP.
5. From the extracted archive, run `node database-migrate.mjs check` against
   the actual production database before applying anything. Review the reported
   operations. Then run `node database-migrate.mjs apply` for an approved
   non-destructive migration. If `check` reports destructive operations, stop
   for explicit user approval and add `--allow-destructive` only after that
   review. The packaged `database-schema.sql` remains an empty-database
   baseline; use the migration runner as the release-to-database workflow.
6. Configure the returned environment-variable names and
   `SPALA_DEPLOYMENT_CHALLENGE` at the target. Use local user-owned provider or
   SSH tooling to deploy the selected runtime entrypoint.
7. Call `project_register_production_environment`, then
   `project_verify_production_environment`. Pass `provider: "vercel"` for a
   Vercel deployment so verification avoids its reserved `/.well-known` path.
   Treat ownership, reachability,
   artifact integrity, and release identity as separate results.
   Artifact integrity covers Spala's retained prepared ZIP; the remote runtime
   is identified through `X-Spala-Build-Id`, not a remote file-by-file hash.
8. Use `project_list_production_environments` for control-plane records and
   `project_remove_production_environment` only when the user wants to remove
   the Spala registration; removal does not stop the external service.

## Auth Contract

Spala has managed JWT auth support. Use it instead of reimplementing auth
unless the user explicitly asks for a custom provider flow.

- Before creating or changing auth, read `project_get_builder_context.schema.auth`
  and the compact safety guidance. Request `responseMode: "full"` when the
  complete `contract.authSafety` is needed. Those are the source of truth
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
- Do not bypass the matching typed-operation or Step Script preview before
  saving locally generated backend resources.
- Do not publish while preview, `project_validate`, `operator_guidance`, or
  `project_test_review` has blockers.
- Do not directly edit persisted project JSON or server project files.
- Do not silently change auth, ownership, tenant isolation,
  `resourceSemantics`, secret fields, or access policy.
- Do not invent UUIDs or field IDs. Load current schema aliases from
  `project_get_builder_context`; use stable model/field names where Step
  Script supports them.
- Do not infer an identifier type from an `*_id` name. New Step Script models
  default to numeric auto-increment IDs. Inspect the target model's reported
  primary key and use an explicit `Table Reference` for project-model
  relationships; use scalar identifier fields only when they are intentional
  and exactly type-compatible.
- Prefer native Spala steps and value-chain filters. Use Custom Code or direct
  SQL only when explicitly required by the product behavior.
- Treat deterministic repairs from `step_script_to_json` as syntax/reference
  normalization only. Business meaning and security semantics must remain
  explicit.
- Do not mutate production schema through normal database selection or
  introspection. Author changes in staging and use the explicit reviewed
  promotion or packaged migration workflow for production.

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
