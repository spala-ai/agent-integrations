---
name: spala-endpoint-workflow
version: 1.4.18
description: "Design, build, repair, validate, and publish customer app endpoints, flows, tasks, triggers, agents, channels, and runtime API behavior through Spala MCP."
---

# Spala Endpoint Workflow

Use this skill when a Spala app backend needs API or executable-resource work:
endpoints, flows, tasks, triggers, agents, channels, Step Script candidates,
publish, runtime smoke tests, or `project_test_review`.

## Start

1. Call `spala_start({ workPhase: "logic" })`.
2. Run its mandatory inspections. Before editing an existing executable
   resource, inspect `builder_get_step_script_history`; use matching authored
   provenance only after checking its `redacted` state, otherwise generate
   current Step Script with `builder_get_*({ mode: "step-script" })`.
3. If the work changes into an auth or security phase, call
   `spala_start({ workPhase: "auth" })` and follow the newly returned focused
   route instead of loading unrelated skills in parallel.

## Endpoint Rules

- Before a database read, write, filter, join, or cross-model value flow, read
  `project_get_builder_context.schema.models` and its compact relationship
  safety guidance. Request `responseMode: "full"` only when the complete
  `contract.relationshipSafety` detail is required. Use the reported primary-key/field types and explicit
  `Table Reference` fields; never guess an identifier type from an `*_id`
  name.
- Use native Spala steps and value-chain filters first.
- Use Find Many joins for related-model filters and supported related fields, then shape the result with value-chain filters. Use Find Many `groupBy`/`aggregations` and native filters for simple aggregates before SQL.
- Use Custom Code or direct SQL only when native steps cannot express the
  behavior.
- Inputs must match the request contract; path params, query params, and body
  fields should have clear names and types.
- Protected endpoints must use `authRequired=true`.
- Create/update/delete endpoints must set or prove owner/tenant fields from
  authenticated context when the model is scoped.
- Responses should return only fields needed by the frontend or API contract.
- Never return invisible/internal fields.

## Flows, Tasks, Triggers, Agents, Channels

- Use flows for reusable backend logic called by endpoints/tasks/triggers.
- Use tasks for scheduled automation or explicitly invoked task workflows.
  Distinguish synchronous completion from an async queued receipt; a receipt
  alone does not prove successful execution. Check the connected server and
  export target capability contract before relying on background execution.
- Supported automatic agent webhooks require persistent Node, the generated
  destination environment bindings and sender verification. Signature validity
  does not establish a product-user or tenant identity. Schedule, database-change
  and socket automatic agent activation, and Vercel agent webhooks, remain
  rejected even where ordinary task schedules or DB triggers are supported.
- Use triggers only for model-event automation that must run after data writes.
- Use agents/channels only when product behavior requires messaging, realtime,
  external events, or addon-backed automation.
- Resolve addon and environment requirements before enabling external behavior.
- Keep side effects idempotent when retries are possible.

## Build Loop

1. For one supported CRUD, owner-scoped CRUD, status-transition, or
   parent-child endpoint, create a version-1 typed plan and run
   `builder_preview_operation_plan`. If it passes, apply the identical plan
   with `builder_apply_operation_plan` and the returned `reviewReceipt`, then
   continue at step 7. If the
   compiler rejects the operation as unsupported, continue with Step Script.
2. Draft complete Step Script for the changed resources (grammar reference:
   `spala-step-script` skill).
3. Run `step_script_to_json` with `applySafeRepairs=true` and
   `includeRepairedScript=true`.
4. Run `builder_preview_step_script` with the repaired script.
5. If preview returns blockers, repair only the named resource/step group.
6. Apply with `builder_apply_step_script` only after preview passes; use
   `publish=true` to save and publish the same reviewed candidate atomically.
7. Run `project_validate`.
8. For resources not published in the apply step, publish with explicit `resourceIds`
   (per-resource selection keeps the repair diff small and avoids unrelated
   blockers).
9. If publish fails with `stale_publish_selection`, call `project_get_state`
   to refresh saved resource state, then retry `project_publish` with the same
   `resourceIds`. Do not call `project_apply_repairs` for a stale selection.
10. If publish fails with `PUBLISH_REPAIR_REQUIRED`: do not blind-retry and do
   not rewrite unrelated resources. Use `resourcesByRepair` to review the
   mutated subset, but do not derive apply scope from it. Call
   `project_apply_repairs` echoing the exact `repairCodes`, `resourceIds`, and
   `candidateFingerprint` returned by the failure; `resourceIds` is the full
   scope covered by the fingerprint. The tool resolves the current generation
   epoch itself. That saves the repaired drafts; review the diff, then publish
   the same selection again.
11. Run `project_test_review`.
12. Smoke relevant endpoints with `project_run_endpoint` or the app frontend —
    `status: synced` alone does not prove the route serves. For a related set,
    pass up to ten sequential `cases`, each with an exact `expectedStatus`.
    Successful 2xx/3xx cases also require `expectedBodyContains`, unless the
    case explicitly sets `allowStatusOnlySuccess=true`. Expected 401/403 checks
    pass on exact status; any mismatch, including an unexpected 500, fails.

## Typed Operation Plan v1

The plan is a JSON object. Common resource fields are `type: "endpoint"`,
`method`, `path`, plus optional `endpointId`, `description`, and
`authRequired`. Use only exact model and field names from builder context.

CRUD and owner-scoped CRUD:

```json
{"version":1,"kind":"crud-operation","operation":"get_owner","resource":{"type":"endpoint","method":"GET","path":"/api/notes/{id}"},"target":{"model":"notes"}}
```

`operation` is one of `list`, `list_owner`, `get`, `get_owner`, `create`,
`create_owner`, `update`, `update_owner`, `delete`, or `delete_owner`.
`target` accepts `model` and optional `idField`, `bodyFields`, `ownerField`, and
`ownerMode` (`none`, `explicit`, or `auto`).

Status transition:

```json
{"version":1,"kind":"status-transition-operation","resource":{"type":"endpoint","method":"POST","path":"/api/orders/{id}/status"},"target":{"model":"orders","stateField":"status","stateInputName":"status","ownerMode":"auto"}}
```

The target also accepts optional `idField`, `idInputName`, `stateValue`,
`ownerField`, and `actorScope` (`model`, `field`, optional `idField`,
`ownerField`, and `ownerMode`).

Parent-child operation:

```json
{"version":1,"kind":"parent-child-operation","operation":"list_children","resource":{"type":"endpoint","method":"GET","path":"/api/projects/{project_id}/tasks"},"parent":{"model":"projects","idInputName":"project_id","ownerMode":"auto"},"child":{"model":"tasks","parentField":"project_id"}}
```

`operation` is one of `list_children`, `create_child`, `get_child`,
`update_child`, or `delete_child`. `parent` accepts `model` plus optional
`idField`, `idInputName`, `ownerField`, and `ownerMode`. `child` accepts
`model`, `parentField`, and optional `idField`, `idInputName`, and `bodyFields`.
Compiler failure is a stop signal: use the reported exact name/type issue, or
fall back to Step Script for `UNSUPPORTED_INTENT` or
`UNSUPPORTED_OPERATION`.

## Repair Policy

- Review `POSSIBLE_HARDCODED_SECRET` as a nonblocking advisory about an
  explicitly authored literal, using its resource, step, and field location.
  Use runtime environment references for confidential values. The warning
  alone does not require a repair or prevent publish; other validation blockers
  still apply. Exports redact environment, database, and addon configuration
  fields. The final artifact check rejects detected stored credential values
  absent from authored executable content; values already present in executable
  source or its static literal AST remain exportable even if also stored in env.
- Use `builder_get_logic_steps` and `builder_patch_logic_steps` for small
  targeted repairs when validation names a specific step group.
- Do not rewrite the whole project for one endpoint issue.
- Do not make behavioral publish probes project-wide blockers for unrelated
  selected-resource publishes.
- Existing unrelated project issues should be reported separately from selected
  publish blockers.

## Done Criteria

The endpoint/workflow change is done only when preview, apply, validation,
publish, and `project_test_review` all pass or when the remaining item is an
explicit user/product decision.

Saved environment settings take effect on the next HTTP endpoint execution;
secret rotation does not require publishing workflow changes. Verify without
returning or logging secret values. In-flight work may retain its earlier values.
