# Changelog

## 1.3.1

- Keep reviewed bundled skills as the trusted execution baseline.
- Treat project MCP skill versions as review advisories and MCP-provided hashes
  as transfer-integrity checks rather than publisher authentication.
- Record verifiable canonical source provenance in the skill release lock.

## 1.3.0

- Added recursive skill-package synchronization and a deterministic lock for
  bundled skills, metadata, references, scripts, and assets.
- Added release guards requiring skill and integration version bumps when
  packaged guidance changes.
- Kept local bundled skills as the reliable installation baseline and focused
  project MCP skill retrieval as the optional runtime freshness path.

## 1.2.0

- Unified Claude Code, OpenAI/Codex, Gemini CLI, Cursor, and VS Code Copilot
  integrations around one reviewed skill set.
- Configured only the public Spala MCP for authentication, project discovery,
  and project handoff.
- Added manifest-alignment, generated-asset, and public-package security checks.
- Preserved Claude Code's established `spala-marketplace` identifier while
  consolidating the Claude-only plugin into this multi-client repository.
- Unified the Codex plugin at the repository root so every client consumes the
  same skills and MCP definition without generated copies.
