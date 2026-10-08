---
name: spala-auth-security
version: 1.4.18
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
   `project_get_builder_context.schema.auth`, the compact `safety` guidance,
   existing auth config, and auth endpoints. Request builder context with
   `responseMode: "full"` only when the complete `contract.authSafety` detail
   is required.

## Password Fields

- The auth password storage field may be named `password_hash`,
  `password_digest`, `credential_digest`, or another configured field.
- Treat the configured auth password field as invisible storage, not product
  data.
- Signup should use `AUTH_SIGNUP` when available.
- If using native steps, signup must run `Hash Password` on the submitted
  password and write only the hash output variable to the configured password
  field.
- Plain `FIND_ONE` and `FIND_MANY` exclude invisible fields. Login should use
  `AUTH_LOGIN` when available; a manual login may add `INCLUDE_INVISIBLE` to the
  username/email lookup only when required for `Verify Password`, and must never
  return that raw record.
- Never write `inputs.password`, `input.password`, request body password, or any
  submitted plaintext directly into the configured password field.
- Never filter `Find One`, `Find Many`, SQL, Custom Code, or addon reads by the
  configured password field compared to submitted plaintext.
- Never return password fields, reset secrets, confirmation secrets, API keys,
  tokens, or session secrets from public endpoints.
- Use runtime environment references for confidential credentials. Explicitly
  authored executable literals are preserved with nonblocking, value-free
  `POSSIBLE_HARDCODED_SECRET` warnings for suspected credentials. Review the
  intended value and its use; this diagnostic alone is not a publish blocker.
  Environment, database, and addon configuration fields are redacted. The
  final artifact check rejects detected stored credential values absent from
  authored executable content; values already present in executable source or
  its static literal AST remain exportable even when also stored in configuration.
  Do not treat authored-history redaction as secret storage. If retrieved
  source contains `[REDACTED]`, replace the value with an environment-variable
  reference before preview or apply.

## Ownership And Tenant Isolation

- Protected business endpoints must set `authRequired=true`.
- Scope user-owned data from the authenticated principal, not from a trusted
  request body owner id.
- For organization/tenant data, prove tenant access from current user
  membership, role, token claim, or admin-approved context before reads or
  writes.
- Create/update steps must set owner or tenant fields from proven auth context,
  or be authorized by an explicit delegated policy and guard.
- Read/update/delete steps must scope by owner or tenant unless the endpoint is
  explicitly public and safe, or an explicit delegated policy and guard
  authorizes the broader access.
- Invitation acceptance must authenticate or otherwise prove invitation
  authority before creating tenant membership.
- `ACCESS_PROOF` is static-analysis metadata, not runtime authentication. Keep
  the actual API-key or token comparison, reject a missing credential record,
  and bind downstream access to the proven owner or tenant.

### Scoped Delegated Membership

Use scoped delegation only when the product explicitly requires it. On the
protected model, `delegatedMemberships` declares allowed `roles` and a fixed,
operator-configured `organizationIdEnv` key, for example
`SUPPORT_ORGANIZATION_ID`. It does not grant authority to a bare `auth.role`
check or to a membership in a caller-selected organization.

The recognized proof uses an unconditional native `Find Many` membership read:
the authenticated user reference equals `auth.userId`, status is `active`, the
organization reference equals the exact declared `env` key, and an INNER join
through the role reference selects an explicitly allowed role. A nonempty-result
precondition must precede the protected operation. Keep the proof immutable;
conditional checks, overwritten results, or a helper's name are not authority.
Target-organization validation is still a separate business requirement.

Keep ordinary owner/tenant guards for undelegated access. Confirm support using
the connected server's compiler and candidate preview, then test denied cases
for ordinary members, inactive membership and caller-selected organizations.
The metadata and a passing static preview do not alone prove runtime security.

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
4. After preview passes, call `builder_apply_step_script` with `apply=true`,
   `validate=true`, and `publish=true`.
5. Run `project_validate` and `project_test_review`. Use `project_publish` only
   for an already-saved draft and pass the exact `resourceIds` returned by its
   write.

Treat any auth, ownership, tenant, access-policy, or secret-field warning as a
must-fix item unless the product plan explicitly proves it is safe.
The advisory `POSSIBLE_HARDCODED_SECRET` diagnostic is reviewed under the
literal guidance above; it does not establish an auth or access-control flaw.
