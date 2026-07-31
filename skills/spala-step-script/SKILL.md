---
name: spala-step-script
version: 1.4.2
description: "Step Script grammar reference: resource blocks, directives, and step command forms accepted by the Spala compiler, plus what Step Script cannot express and the discovery loop. Use when writing or repairing Step Script for models, endpoints, flows, tasks, triggers, agents, or channels."
---

# Spala Step Script Grammar

Compact reference for the Step Script surface. The compiler's own error messages
enumerate supported forms and always win over this document. When unsure, run
`step_script_validate` / `step_script_to_json` and follow the error text.

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
  `PUBLIC`, `NAME`, `INPUT name type [required]`, `RESPONSE`. CRUD shorthand:
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

## Data Commands (canonical forms)

```
CREATE model_name AS variable SET field=value, other_field=value
UPDATE model_name WHERE field == value SET field=value AS variable
DELETE model_name WHERE field == value
FIND_ONE model_name WHERE field == value AS variable
FIND_MANY model_name WHERE field == value AS variable [ORDER_BY field DESC] [LIMIT n] [OFFSET n]
FIND model_name WHERE ... AS variable          # Find One
STEP "Find or Create" AS variable SET model=model_name, where=..., create=...
BULK_CREATE / CREATE_MANY model_name ...
```

A trailing `WHEN <condition>` on a compact data command inserts a 403
Precondition before the step.

For counters, balances, inventory, capacity, and quotas, use the typed atomic
form instead of read-then-write arithmetic:

```
TRANSACTION
  UPDATE events WHERE booked < COLUMN capacity SET booked = booked + 1 AS updated
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

For membership/role checks: load the record with `FIND_ONE ... AS variable`
first, then `REQUIRE` it.

## Other Commands

`SET var = expr` · `ENV NAME AS variable` · `HTTP` (external call) · `SQL` (read-only,
single SELECT) · `HMAC` · `HASH_PASSWORD` / `VERIFY_PASSWORD` ·
`GENERATE_TOKEN` · `JSON_PARSE` / `JSON_STRINGIFY` · `BROADCAST` (channel
event) · `EMBED` (embedding) · `LOG` · `THROW code "msg"` /
`CONTROLLED_ERROR code "msg"` · `RETURN expr` ·
`ADDON "Exact Step Name" AS var SET input=value` (pass-through to any engine
step type) · `STEP "Get User Context" AS ctx` · `STEP "Authorize Tenant Role"`.

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
3. `builder_apply_step_script` after a clean preview.
