---
name: spala-security-auditor
version: 1.4.1
description: "Audit and repair security issues in customer app backends built with Spala MCP, including auth, tenant scope, secrets, integrations, SQL/custom code, webhooks, destructive actions, and generated API safety."
---

# Spala Security Auditor

Use this skill to run a security pass on a Spala-generated app backend before
declaring it ready. The baseline is OWASP secure coding / ASVS style review plus
Spala-specific builder rules: auth must be explicit, tenant proof must be derived
from trusted context, secrets must remain invisible, and repairs must go through
Spala preview/apply/validation.

This skill is for generated/customer app projects.

The deliverable is not a generic security essay. Produce one of these concrete
outcomes:

- A finding-backed audit report with exact resources, evidence, severity, and
  Spala-supported repairs.
- A repaired candidate that has passed preview/apply/validation for the named
  findings.
- A clear "no blocking findings found" result that names the resources and
  checks actually inspected plus remaining untested areas.

## Baseline

Use these standards as the mental model, but express findings in Spala resource
terms:

- OWASP ASVS: technical verification for auth, access control, validation,
  secrets, APIs, and configuration.
- OWASP Secure Coding Practices: practical checklist coverage for input
  validation, output handling, auth, session management, access control,
  cryptography, errors, logging, data protection, and database security.
- OWASP Top 10: risk categories such as broken access control, cryptographic
  failures, injection, insecure design, security misconfiguration, and
  identification/authentication failures.
- NIST SSDF: fix root causes, use repeatable secure-development checks, and
  verify before release.

## Start

1. If unauthenticated, start MCP OAuth/browser authentication immediately, then
   retry the failed tool call.
2. Call `spala_start({ workPhase: "audit" })`.
3. Run its mandatory inspections before changing anything. Do not load
   unrelated customer skills for the audit phase.
5. If the user asks for cloud based Spala generation and it is unavailable,
   say exactly: `Your package does not include cloud based generation. Please contact info@spala.ai for details.`

## Evidence Collection

Work from live project evidence, not assumptions:

1. Read builder context and state: `project_get_builder_context`,
   `project_get_state`, and `project_get_graph`.
2. Read validation evidence: `project_validate` and `project_test_review`.
3. Read requirements evidence: `project_get_env_requirements` and
   `project_get_resource_semantics_requirements` when available.
4. For every suspicious endpoint/flow/task/trigger/agent, inspect its logic
   steps with `builder_get_logic_steps` or the equivalent state/graph detail.
5. For every finding, record the resource id/name/path, the exact step or field,
   the unsafe data path, and the trusted proof that should replace it.

Do not mark something safe because validation is green. Validation is evidence,
not a substitute for reviewing auth, tenancy, secrets, SQL/custom code, webhooks,
and response shape.

## Audit Scope

Build an inventory before judging risk:

- Models and fields: ownership fields, tenant fields, secret/internal fields,
  auth password storage, tokens, API keys, webhook secrets, OAuth credentials,
  external provider ids, and resource semantics.
- Endpoints, flows, tasks, triggers, agents, and channels: public vs
  authenticated, inputs, filters, mutations, response shape, custom code, SQL,
  external API calls, addon calls, and destructive actions.
- Auth config and env: configured auth model, password field name, JWT/session
  secrets, addon env requirements, OAuth/webhook secrets, and missing/placeholder
  values.
- Publish/runtime evidence: validation issues, behavioral probe issues,
  generated-resource warnings, and test-review warnings.

## Must-Fix Checks

Treat these as blockers unless the product plan gives a concrete, safe reason.

- Authentication: protected business endpoints must require auth; public
  endpoints must only expose intentionally public data.
- Password handling: never store submitted plaintext in the configured password
  field, whatever it is named. Use `AUTH_SIGNUP`/`AUTH_LOGIN` or `Hash Password`
  plus `Verify Password`. Never filter reads by password fields.
- Ownership and tenant isolation: reads, updates, deletes, and creates must
  scope or set owner/tenant fields from authenticated user, membership, token
  claims, or admin-approved context. Never trust request-body owner or tenant ids
  as proof.
- Secret exposure: password fields, reset/confirmation tokens, OAuth tokens,
  API keys, webhook secrets, session secrets, and private credentials must be
  invisible/internal and excluded from responses, logs, SDK examples, and test
  output.
- SQL and custom code: prefer native Spala steps. If SQL/custom code is used, it
  must use parameterized values, apply the same auth/tenant checks as native
  steps, avoid string-built queries, and avoid returning raw records with secret
  fields.
- External calls and webhooks: verify provider contract, required env vars,
  signature validation for inbound webhooks, allowlisted/known URLs for outbound
  calls, and no secrets in query strings unless the provider explicitly requires
  it.
- Destructive actions: update/delete/bulk endpoints must be authenticated,
  scoped, guarded by record ownership/tenant proof, and avoid full-table
  mutation unless the product explicitly requires an admin operation.
- Background behavior: tasks, triggers, channels, and agents must be idempotent
  where retries can happen and must preserve tenant/owner context across calls.

## Scan Playbooks

Run these passes in order. Stop to repair critical issues when the user asked you
to fix, otherwise keep collecting findings before reporting.

### Auth And Passwords

- Identify `authConfig` and the configured auth model, username field, and
  password field from builder context/state.
- Verify signup uses `AUTH_SIGNUP` or `Hash Password` before writing the
  configured password field.
- Verify login loads by username/email and then uses `AUTH_LOGIN` or
  `Verify Password`.
- Flag any `Find One` or `Find Many` filter on the password field.
- Flag any write of `inputs.password`, `input.password`, or equivalent plaintext
  into the configured password field, even when the field is not named
  `password_hash`.

### Tenant And Ownership

- For each model with owner, user, organization, tenant, workspace, account, or
  membership fields, identify its trusted scope source.
- For every read/update/delete on those models, verify the filter contains a
  trusted auth/membership/token/admin proof.
- For every create, verify owner/tenant fields are set from trusted context, not
  request body.
- Flag update/delete/bulk actions that can operate without a per-record scoped
  filter.

### Secret And Response Shape

- Build a secret field list from auth config, resource semantics, invisible
  fields, field names, and addon/env requirements.
- Verify endpoint responses omit secret fields for single records, arrays,
  joined records, custom code results, and raw SQL results.
- Flag logs, examples, or generated output that include tokens, private keys,
  API keys, OAuth refresh tokens, webhook secrets, or password hashes.

### Injection And Custom Execution

- Prefer native Spala read/write/filter steps over raw SQL or custom code.
- For SQL/custom code that remains, verify parameterized inputs, no string-built
  queries, no untrusted path/URL/command execution, no filesystem access to
  tenant data without scope, and no raw response of sensitive rows.
- Flag custom code that performs writes but lacks the same auth/tenant proof
  required of native steps.

### External Integrations And Webhooks

- For inbound webhooks, verify signature or shared-secret validation before
  mutation and replay/idempotency protection where the provider can retry.
- For outbound calls, verify required env vars, expected provider URLs, safe
  redirect/callback handling, and no secrets in logs or query strings unless the
  provider contract requires it.
- For OAuth flows, verify state/nonce/callback validation and token storage as
  secret/internal data.

### Agents, Tasks, And Background Work

- Verify background tasks, triggers, channels, and agents do not silently run as
  a global superuser unless they are explicit admin/system jobs.
- Verify retries are idempotent or guarded by unique keys/status checks.
- Verify any tool/action called by an agent preserves the same tenant/owner proof
  as a normal endpoint.

## Repair Rules

- Do not edit JSON/pub files directly.
- Repair with Step Script, `builder_preview_step_script`, and
  `builder_apply_step_script`, or with a focused `builder_patch_logic_steps`
  change when validation names an exact resource and step.
- Keep each repair scoped to one finding or tightly related findings.
- Do not weaken auth, ownership, tenant isolation, resource semantics, or secret
  classification to make validation pass.
- Do not invent real secret values. If env values are missing, report the exact
  keys and use `project_update_config` only with user-provided or secret-manager
  values.
- After repair, rerun `project_validate`; if publishing is in scope, run
  `project_publish` and `project_test_review`.

## Repair Playbooks

- Plaintext password write: replace with `AUTH_SIGNUP`; if unavailable, insert
  `Hash Password`, write only the hash variable to the configured auth password
  field, and keep the field invisible/internal/secret.
- Password-based lookup: change lookup to username/email, include the invisible
  password field only for verification, then run `AUTH_LOGIN` or
  `Verify Password`.
- Missing endpoint auth: enable authentication and add owner/tenant filters or
  role checks before reading or mutating protected resources.
- Body-trusted owner/tenant: replace request-body ids with `auth.userId`,
  membership lookup, token claim verified by Spala auth, or admin-approved tenant
  context.
- Secret response exposure: add explicit response shaping with omit/select steps
  for every object and array path, including joined data and custom-code/SQL
  results.
- Unsafe SQL/custom code: convert to native steps when possible; otherwise
  parameterize inputs, add scoped filters/checks, and narrow the response.
- Unverified webhook: add provider signature/shared-secret verification before
  mutation and return a clean 401/403/400 on failed verification.
- Unsafe destructive operation: add auth, scoped `Find One`/membership proof, and
  a constrained update/delete filter; require admin role for product-wide bulk
  actions.

## Report Format

Lead with real findings, not a generic checklist.

- `Critical`: unauthenticated sensitive access, plaintext password storage,
  secret response exposure, unscoped destructive mutation, or tenant bypass.
- `High`: missing auth on business data, body-trusted owner/tenant, unsafe
  custom SQL/code, webhook without verification, or provider credentials exposed.
- `Medium`: missing idempotency, broad responses, incomplete resource semantics,
  missing env review, weak role checks, or ambiguous public data.
- `Low`: naming/documentation issues that do not change runtime security.

For each finding include resource type/name/path, evidence, why it matters, and
the exact Spala-supported repair. When obvious, include a standard mapping such
as OWASP Top 10 category, ASVS area, or CWE family, but do not spend time forcing
a mapping when the Spala evidence is clearer.

If no issue is found, say what was inspected and what remains untested.

## Completion Gate

Before saying the generated backend is security-reviewed:

- All Critical and High findings are fixed or explicitly accepted by the user
  with the business reason recorded.
- `project_validate` passes after the final repair.
- If publish was requested, `project_publish` succeeds for the intended scope and
  `project_test_review` has no unresolved security repair feedback.
- The final answer names the inspected models/endpoints/tasks/triggers/agents and
  any areas not covered by available evidence.
