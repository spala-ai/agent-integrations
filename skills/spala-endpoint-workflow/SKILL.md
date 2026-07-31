---
name: spala-endpoint-workflow
version: 1.4.1
description: "Design, build, repair, validate, and publish customer app endpoints, flows, tasks, triggers, agents, channels, and runtime API behavior through Spala MCP."
---

# Spala Endpoint Workflow

Use this skill when a Spala app backend needs API or executable-resource work:
endpoints, flows, tasks, triggers, agents, channels, Step Script candidates,
publish, runtime smoke tests, or `project_test_review`.

## Start

1. Call `spala_start({ workPhase: "logic" })`.
2. Run its mandatory inspections, then inspect specific resources with
   `builder_get_*({ mode: "step-script" })` as needed.
3. If the work changes into an auth or security phase, call
   `spala_start({ workPhase: "auth" })` and follow the newly returned focused
   route instead of loading unrelated skills in parallel.

## Endpoint Rules

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
- Use tasks only for scheduled/time-based automation.
- Use triggers only for model-event automation that must run after data writes.
- Use agents/channels only when product behavior requires messaging, realtime,
  external events, or addon-backed automation.
- Resolve addon and environment requirements before enabling external behavior.
- Keep side effects idempotent when retries are possible.

## Build Loop

1. Draft complete Step Script for the changed resources (grammar reference:
   `spala-step-script` skill).
2. Run `step_script_to_json` with `applySafeRepairs=true` and
   `includeRepairedScript=true`.
3. Run `builder_preview_step_script` with the repaired script.
4. If preview returns blockers, repair only the named resource/step group.
5. Apply with `builder_apply_step_script` only after preview passes; use
   `publish=true` to save and publish the same reviewed candidate atomically.
6. Run `project_validate`.
7. For resources not published in step 5, publish with explicit `resourceIds`
   (per-resource selection keeps the repair diff small and avoids unrelated
   blockers).
8. If publish fails with `stale_publish_selection`, call `project_get_state`
   to refresh saved resource state, then retry `project_publish` with the same
   `resourceIds`. Do not call `project_apply_repairs` for a stale selection.
9. If publish fails with `PUBLISH_REPAIR_REQUIRED`: do not blind-retry and do
   not rewrite unrelated resources. Use `resourcesByRepair` to review the
   mutated subset, but do not derive apply scope from it. Call
   `project_apply_repairs` echoing the exact `repairCodes`, `resourceIds`, and
   `candidateFingerprint` returned by the failure; `resourceIds` is the full
   scope covered by the fingerprint. The tool resolves the current generation
   epoch itself. That saves the repaired drafts; review the diff, then publish
   the same selection again.
10. Run `project_test_review`.
11. Smoke relevant endpoints with `project_run_endpoint` or the app frontend —
    `status: synced` alone does not prove the route serves.

## Repair Policy

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
