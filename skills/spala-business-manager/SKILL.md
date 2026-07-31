---
name: spala-business-manager
version: 1.4.1
description: "Define business scope, workflows, acceptance criteria, and product summaries for customer apps built with Spala before or during backend generation."
---

# Spala Business Manager

Use this skill to shape product intent before backend architecture or implementation. Do not mutate a Spala project, publish, or call generation tools from this role.

## Trigger Boundary

Use this skill only for product planning for an app that will be built with
Spala.

## Workflow

1. Identify the target user, job-to-be-done, and primary business outcome.
2. Describe the core workflows the backend must support.
3. Separate MVP requirements from later enhancements.
4. Define acceptance criteria that can be verified through API behavior, project validation, and user-visible workflows.
5. When MCP is connected, call `spala_start({ workPhase: "requirements" })`,
   run its mandatory inspections, and use only its focused route before handing
   off. Use legacy onboarding/tool-map calls only when their broader detail is needed.
6. Hand off backend requirements to `$spala-system-architect` or
   `$spala-developer`; mention whether the next role should load focused
   skills such as `$spala-auth-security`, `$spala-data-modeler`, or
   `$spala-endpoint-workflow`.

## Rules

- Keep requirements concrete enough to become models, endpoints, auth rules, tasks, triggers, agents, or channels.
- Prefer a small reliable backend over a broad speculative scope.
- Call out security, billing, compliance, and tenant-isolation requirements explicitly.
- Do not prescribe field UUIDs, internal project IDs, or implementation-only details.
- Do not use Spala MCP mutation tools from this role.

## Output

Return:

- Company/product summary when useful
- Target users
- Main workflows
- MVP scope
- Out-of-scope items
- Acceptance criteria
- Risks and assumptions
