---
name: spala-auth-security
version: 1.4.3
description: "Design, build, or review auth, password handling, ownership, tenant isolation, roles, sessions, invitations, and secret fields for customer apps built with Spala MCP."
---

# Spala Auth Security

Use this skill when a Spala app backend touches authentication, users,
sessions, roles, invitations, ownership, tenant isolation, access policy, or
secret fields. This skill is focused on generated/customer apps built through
Spala MCP.

## Start

1. Call `spala_start({ workPhase: "auth" })`.
2. Run its mandatory inspections before planning or changing auth, especially
   `project_get_builder_context.contract.authSafety`, `schema.auth`, existing
   auth config, and auth endpoints.

## Password Fields

- The auth password storage field may be named `password_hash`,
  `password_digest`, `credential_digest`, or another configured field.
- Treat the configured auth password field as invisible storage, not product
  data.
- Signup should use `AUTH_SIGNUP` when available.
- If using native steps, signup must run `Hash Password` on the submitted
  password and write only the hash output variable to the configured password
  field.
- Login should load the auth user by username/email, include invisible fields
  only when required for verification, then run `Verify Password`.
- Never write `inputs.password`, `input.password`, request body password, or any
  submitted plaintext directly into the configured password field.
- Never filter `Find One`, `Find Many`, SQL, Custom Code, or addon reads by the
  configured password field compared to submitted plaintext.
- Never return password fields, reset secrets, confirmation secrets, API keys,
  tokens, or session secrets from public endpoints.

## Ownership And Tenant Isolation

- Protected business endpoints must set `authRequired=true`.
- Scope user-owned data from the authenticated principal, not from a trusted
  request body owner id.
- For organization/tenant data, prove tenant access from current user
  membership, role, token claim, or admin-approved context before reads or
  writes.
- Create/update steps must set owner or tenant fields from proven auth context.
- Read/update/delete steps must scope by owner or tenant unless the endpoint is
  explicitly public and safe.
- Invitation acceptance must authenticate or otherwise prove invitation
  authority before creating tenant membership.

## Review Checklist

- Auth model secret fields are invisible/internal.
- Signup stores only hash output.
- Login uses verify, not password-field filters.
- `/api/me` never leaks secret fields.
- Tenant reads/writes are scoped to proven membership or role.
- Public endpoints do not expose private models by accident.
- Custom Code and direct SQL follow the same hash/verify and tenant-proof rules.

## Validation Path

Use the normal Spala write boundary:

1. Build or repair with Step Script.
2. Run `step_script_to_json` with safe repairs when useful.
3. Run `builder_preview_step_script`.
4. Apply only after preview passes.
5. Run `project_validate`, `project_publish`, and `project_test_review`.

Treat any auth, ownership, tenant, access-policy, or secret-field warning as a
must-fix item unless the product plan explicitly proves it is safe.
