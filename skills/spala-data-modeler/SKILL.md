---
name: spala-data-modeler
version: 1.4.3
description: "Design or review customer app backend models, fields, relationships, resource semantics, product database switching, and schema contracts through Spala MCP."
---

# Spala Data Modeler

Use this skill when a Spala app backend needs model/schema work: tables,
fields, relationships, ownership columns, resource semantics, imported product
database tables, or schema repairs.

## Start

1. Call `spala_start({ workPhase: "data" })`.
2. Run its mandatory inspections, including the builder context, existing
   models, graph, and resource semantics requirements, before changing schema.
3. If switching or introspecting product databases, inspect the product DB
   contract from builder context and current project state first.

## Modeling Rules

- Model product nouns directly. Avoid generic `items`, `records`, or `data`
  models unless the product domain really needs them.
- Use stable field names in Step Script. Do not invent UUIDs or persisted field
  ids.
- Prefer explicit enum/status fields over free text when the workflow has known
  states.
- Add ownership or tenant fields at model-design time when access will be
  scoped.
- Mark secret fields as invisible/internal resource semantics before endpoints
  can return them.
- Keep auth password fields out of product responses and filters. If the work
  changes from data modeling into auth implementation, call
  `spala_start({ workPhase: "auth" })` and follow the newly returned focused
  route.
- Avoid duplicate models that represent the same business object with slightly
  different names.
- Do not remove or rename existing fields without checking endpoint, flow, task,
  trigger, agent, channel, and frontend usage through `project_get_graph`.

## Relationships

- Use references only when the product needs a real relationship.
- Keep parent/child lifecycle behavior explicit: deletion policy, nested reads,
  and child creation paths.
- For multi-tenant data, every child model that can leak tenant data needs a
  tenant proof path either directly or through a parent relationship.
- Do not trust user-supplied parent ids without verifying access to that parent.

## Product Database Work

- If a managed Spala DB is selected, project creation should initialize required
  tables, folders, config, and migrations so the app works immediately.
- If a custom DB is connected, never drop or overwrite existing user tables
  unless the user explicitly approves it.
- Imported existing tables should become draft models with clear metadata and
  resource semantics.
- For deletion/archive behavior, distinguish Spala-managed resources from
  custom user-owned databases; only Spala-managed DBs should be deleted by
  platform cleanup.

## Validation Path

1. Use Step Script `MODEL` blocks for schema changes.
2. Run `step_script_to_json` with `applySafeRepairs=true`.
3. Run `builder_preview_step_script`.
4. Run `project_validate` and `project_get_graph`.
5. Publish only selected changed resources plus dependency closure.

Treat stale field references, broken relationship paths, duplicate model
meaning, secret response exposure, and unscoped tenant relationships as
blockers.
