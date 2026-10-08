---
name: spala-step-script
version: 1.4.18
description: "Step Script grammar reference: resource blocks, directives, and step command forms accepted by the Spala compiler, plus what Step Script cannot express and the discovery loop. Use when writing or repairing Step Script for models, endpoints, flows, tasks, triggers, agents, or channels."
---

# Spala Step Script Grammar

Compact reference for the Step Script surface. The compiler's own error messages
enumerate supported forms and always win over this document. When unsure, run
`step_script_validate` / `step_script_to_json` and follow the error text.
`step_script_validate` checks compiler syntax and conversion only; it does not
prove publish readiness. Use `builder_preview_step_script` for publish-candidate
validation before applying.

On an opt-in guided MCP connection, preview/apply responses default to compact:
validation, fingerprints, generated typed-plan Step Script, and write outcomes
remain authoritative, while duplicate preflight aliases and converted-preview
bodies are omitted. Request `responseMode: "full"` or `includePreview: true`
only when that additional payload is needed for review.

For supported CRUD, owner-scoped CRUD, status-transition, and parent-child
endpoints, prefer the deterministic typed-plan path documented by
`spala-endpoint-workflow`; its compiler emits reviewable Step Script and uses
the same candidate validation/apply boundary. Use this grammar for everything
outside that deliberately narrow operation set.

When editing an existing resource, call
`builder_get_step_script_history({ resourceType, id })` first. Use its
`recommended.source`. Saved authored revisions whose version does not match the
current canonical resource are marked `reference-only-stale-source`; do not
apply them without reconciling against current state. If no matching authored
revision exists, the recommendation is generated from current canonical JSON.
Inspect `redacted` before reusing authored source. A recommendation containing
`[REDACTED]` placeholders is not directly re-applicable: repair the script and
move credentials to environment variables. Provenance redaction is defense in
depth and must never be treated as secret storage.

## Native vector search

Use `Vector` fields for embeddings and native `Similarity Search` with the
required owner/tenant filters. Do not store search embeddings in JSON arrays
or compute cosine similarity in Custom Code. Keep dimensions and embedding
model consistent. If pgvector is missing, request operator setup; do not
fallback to JSON. Migrating existing JSON embeddings requires approval.

## Document Shape

A script is a sequence of resource blocks. Each block is a header line,
directives, then step lines:

```
MODEL invoices
FIELD amount number required
FIELD status Enum(draft,sent,paid)

ENDPOINT POST /api/invoices
AUTH true
INPUT amount number required
CREATE invoices AS invoice SET amount=inputs.amount, status='draft'
RETURN invoice
```

Blocks: `MODEL`, `ENDPOINT`, `FLOW`, `TASK`, `TRIGGER`, `CHANNEL`, `AGENT`.

## Directives

- ENDPOINT: method and path live on the header line —
  `ENDPOINT GET|POST|PUT|PATCH|DELETE /path`. Body directives: `AUTH true` /
  `PUBLIC`, `NAME`, `INPUT name [location] type required|optional`, `RESPONSE`.
  Inputs default to required when the modifier is omitted; write `optional`
  explicitly for partial updates. CRUD shorthand:
  `OPERATION list|get|create|update|delete` paired with `MODEL table_name`.
- TASK: `SCHEDULE "0 9 * * *"` (cron, validated) or
  `SCHEDULE {"frequency":1,"frequencyUnit":"minutes"}`, `ACTIVE`, `RUN_ASYNC`.
- TRIGGER: `ON model_name`, `EVENTS`, `WHEN`, `ENABLED`.
- CHANNEL / AGENT: `TYPE`, `MESSAGE`, `REQUIRED_ENV`, `ENABLED`.

## MODEL Fields

`FIELD name type [modifiers]`

- Types: text, number, boolean, date, datetime, timestamp, json, uuid, id, email, password,
  vector, storage, geography, table reference, `Enum(value1,value2)`.
- Modifiers: required, optional, primary, primaryKey, auto, secret, invisible, hidden,
  unique, `ref=model_name`. Unknown types/modifiers throw and list valid options.

A scalar field name ending in `_id` remains scalar. Names are advisory and do
not create a relationship, parent lookup, or database foreign key. Declare an
actual relationship explicitly, for example:

```text
FIELD archive_id Table Reference required ref=archives
```

Use a scalar `UUID`, `ID`, or `text` field when the value is intentionally an
external identifier, future record identifier, or correlation key.

Before drafting a database read, write, filter, join, or cross-model value
flow, inspect `project_get_builder_context.schema.models` and use each model's
reported `primaryKey` and field types. A new Step Script model receives a
numeric auto-increment `ID` by default; do not assume UUID because a field ends
in `_id`. When a create result's `id` is written into another project model,
make the destination an explicit `Table Reference` or an intentionally scalar
field with the exact compatible type.

## Scoped Membership Semantics

A model's `RESOURCE_SEMANTICS` JSON may include an explicit scoped delegation:

```text
RESOURCE_SEMANTICS {"delegatedMemberships":[{"roles":["Support"],"organizationIdEnv":"SUPPORT_ORGANIZATION_ID"}]}
```

Merge this with the model's intended ownership/read/write semantics rather than
replacing them. Each delegation accepts only nonempty `roles` and an
`organizationIdEnv` environment-key name, not a request expression. The key
names an operator-configured organization; the declaration does not authorize
`auth.role`, import database RLS, or create a membership.

Before delegated access, use an unconditional native `Find Many` of active
memberships for `auth.userId` and the exact declared `env` organization, with an
INNER join through the role reference and an allowed role-name predicate. Use
AND predicates and actual `Table Reference` relationships. Require a nonempty
result before the protected step. Aggregates, conditional guards, reassigned
results, and helper names do not substitute for this proof. Keep target scope
validation separate. Check compiler and candidate-preview support on the
connected server and retain ordinary tenant guards for undelegated access.

## Data Commands (canonical forms)

```
CREATE model_name AS variable SET field=value, other_field=value
UPDATE model_name WHERE field == value SET field=value AS variable [ALLOW_MISSING]
DELETE model_name WHERE field == value
FIND_ONE model_name WHERE field == value AS variable
FIND_MANY model_name WHERE [IF_PRESENT inputs.field: ]field == value AS variable [ORDER_BY field] [LIMIT n] [OFFSET n]
FIND model_name WHERE ... AS variable          # Find One
STEP "Find or Create" AS variable SET model=model_name, where=..., create=...
BULK_CREATE / CREATE_MANY model_name ...
```

Plain `FIND_ONE` and `FIND_MANY` omit invisible fields. Append
`INCLUDE_INVISIBLE` only when internal logic intentionally needs one, such as a
manual password verification lookup, and never return the raw secret-bearing
record. Prefer `AUTH_LOGIN` for normal login flows.

A trailing `WHEN <condition>` on a compact data command inserts a 403
Precondition before the step.

For counters, balances, inventory, capacity, and quotas, use the typed atomic
form instead of read-then-write arithmetic:

```
TRANSACTION
  UPDATE events WHERE booked < COLUMN capacity SET booked = booked + 1 AS updated ALLOW_MISSING
  REQUIRE updated EXISTS ELSE THROW 409 "Capacity exhausted"
  CREATE bookings AS booking SET event_id=inputs.event_id, user_id=auth.userId
END_TRANSACTION
```

`COLUMN field` compares two columns in the same row. `field = field + amount`
and `field = field - amount` compile to one guarded SQL update. The transaction
makes dependent writes commit together or roll back together.

## Owner-Scoped Variants

`OWNER_FIND_MANY`, `OWNER_FIND_ONE`, `OWNER_CREATE`, `OWNER_UPDATE`,
`OWNER_DELETE` — same shapes as above, but the owner filter/assignment is added
automatically from the authenticated user. Prefer these for user-owned data.

## Auth Macros

```
AUTH_SIGNUP model_name EMAIL inputs.email PASSWORD inputs.password [NAME inputs.name] AS result
AUTH_LOGIN model_name EMAIL inputs.email PASSWORD inputs.password AS result
AUTH_LOGIN model_name AS result USER vars.user WHEN vars.passwordOk == true
AUTH_ME [model_name] AS currentUser
```

`AUTH_LOGIN ... USER` without `WHEN` requires the immediately preceding
`VERIFY_PASSWORD` to assign the default `passwordOk` result.

## Guards and Preconditions

```
GUARD vars.record EXISTS ELSE THROW 404 "Not found"
GUARD vars.record NOT_EXISTS ELSE RETURN vars.record
GUARD vars.record EXISTS ELSE SET x = fallback
GUARD expr IS [NOT] NULL ELSE THROW 400 "..."
IF vars.record EXISTS ELSE THROW 404 "Not found"      # single-line only
REQUIRE vars.record [ELSE THROW code "message"]
REQUIRE left == right [MESSAGE "message"]
REQUIRE vars.list CONTAINS value
```

For ordinary membership/role checks, load the record with
`FIND_ONE ... AS variable` first, then `REQUIRE` it. Explicit scoped delegation
uses the joined `Find Many` and nonempty precondition described above instead.

For public machine credentials, declare the trusted record provenance on the
verifying read. This supplements the credential comparison; it does not replace
it:

```text
FIND_ONE devices WHERE api_key_hash == input.api_key_hash AS device ACCESS_PROOF api_key TENANT_FIELD id
REQUIRE vars.device EXISTS ELSE THROW 401 "Invalid device credential"
```

Supported proof kinds are `api_key`, `token`, `webhook_tenant`, and `external`.
Use `TENANT_FIELD` when the trusted record identifies the tenant used by later
tenant-scoped reads or writes.

## Other Commands

`SET var = expr` · `ENV NAME AS variable` · `HTTP` (external call) · `SQL` (read-only,
single SELECT) · `HMAC` · `HASH_PASSWORD` / `VERIFY_PASSWORD` ·
`GENERATE_TOKEN` · `JSON_PARSE` / `JSON_STRINGIFY` · `BROADCAST` (channel
event) · `EMBED` (embedding) · `LOG` · `THROW code "msg"` /
`CONTROLLED_ERROR code "msg"` · `RETURN expr` ·
`ADDON "Exact Step Name" AS var SET input=value` (pass-through to any engine
step type) · `STEP "Get User Context" AS ctx` · `STEP "Authorize Tenant Role"`.

`now` and `now()` both mean the current timestamp. Arithmetic in forms such as
`now() + 900000` or `now - 60000` is applied to epoch milliseconds before the
result is converted to an ISO timestamp.

## What Step Script CANNOT Express

The engine supports ~58 step types; the compact grammar covers roughly half.
Not expressible in Step Script — author these through
`builder_get_logic_steps` + `builder_patch_logic_steps` (full typed step JSON)
after scaffolding:

- Loops: For Each, While, Loop, Break, Continue.
- Multi-step If/Else bodies, Switch, Try/Catch, Transaction.
- Function Call, Run Task, Run Agent.
- Similarity Search, Geo Nearby/Within, file steps, most crypto steps.

Do not fake unsupported behavior with Custom Code when a native engine step
exists — use `ADDON "Step Name"` pass-through or the builder JSON tools.

## Native joins and aggregates

For related-model filtering and simple summaries, use a native `Find Many`
step with explicit typed properties rather than SQL or Custom Code:

```text
STEP "Find Many" AS rows SET modelId="orders", joins=[...], groupBy=["status"], aggregations=[{"function":"count","field":"*","alias":"count"}]
```

For joins, use typed model and field references expected by the builder JSON
shape. Supported aggregation functions are `count`, `sum`, `avg`, `min`, and
`max`. Joined reads crossing an authenticated boundary should project only
the primary model's fields.

## Secure Data-Access Contract

Prefer native database steps. Custom Code must not access the database: do not
use `db`, positional `arguments` to reach an adapter, `findMany`, `findOne`,
`directSQL`, or raw `query` calls.

Use native `Find Many` joins for related-model filtering and supported related
fields, then shape results with value-chain filters. Use `Find Many`
`groupBy`/`aggregations` and native filters for simple aggregates before
reaching for SQL. In generic Step Script, represent this as
`STEP "Find Many" AS rows SET modelId="orders", joins=[...], groupBy=["status"], aggregations=[{"function":"count","field":"*","alias":"count"}]`.

SQL Query is a restricted escape hatch. Use it only for a single-model,
authenticated read and include `resultModelId` and `resultScope: "auth_user"`.
Pass `auth.userId` as the authenticated parameter, use a top-level AND equality
against the model owner field such as `model.user_id = $1`, and project only
columns from the declared result model. Unscoped queries, OR predicates,
CROSS/comma joins, subqueries, and joined-table output are rejected by publish
validation. Prefer `FIND_ONE`/`FIND_MANY` whenever they can express the query.

## Gotchas

- Optional query filters: a missing optional input compared with `==` becomes
  SQL `IS NULL` and returns empty rows. Declare the input `optional` (Step Script
  auto-attaches `skipIf` on plain-input Find Many/Count filters, including nested
  branches; value chains with transformations retain their authored behavior) or write
  `IF_PRESENT inputs.status: status == inputs.status`. Do not use `skipIf` on
  Update/Delete filters — omitting a condition widens mutations.
- Paginated non-aggregate, non-distinct `FIND_MANY` without `ORDER_BY` defaults
  to primary-key ASC. Aggregate and distinct projections need a compatible
  explicit order when ordering matters. Concurrent writes can still shift
  `LIMIT`/`OFFSET` pages.
- `STEP "Send Email"` currently compiles to a **Log step — no email is sent**.
  Never use it to satisfy an email requirement; use a mail addon step and
  declare `REQUIRED_ENV`.
- `GUIND` is accepted as a typo alias of `GUARD`; write `GUARD`.
- Cron strings in `SCHEDULE` are validated; invalid expressions throw.
- Compiler errors name the supported form — copy that form exactly.

## Discovery Loop

1. `step_script_to_json` with `applySafeRepairs=true`,
   `includeRepairedScript=true` — read the repaired script diff.
2. `builder_preview_step_script` — fix only the named resource/step blockers.
3. After a clean preview, call `builder_apply_step_script` with `apply=true`,
   `validate=true`, and `publish=true` to save and publish that reviewed
   candidate. Use `publish=false` only when an intentional draft is required.

Custom Code is literal JavaScript: encode `code` as a JSON string in generic
`STEP "Custom Code" ... SET code=...`; do not rewrite JS as Step Script.
Web Crypto (`crypto.subtle`, `crypto.randomUUID`, `crypto.getRandomValues`) is
available in the sandbox. Use it instead of hand-written cryptography.
