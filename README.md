# Spala

Spala is a backend platform for apps built with AI coding agents. This plugin
lets Claude build and run a real application backend on Spala: data models,
API endpoints, authentication, ownership rules, background tasks and triggers.
Claude writes the backend into your Spala project, Spala validates it and
checks access rules, and only then is it published.

## What the plugin contains

- **Nine skills** that teach Claude how to work with Spala: planning the
  business scope, designing the architecture and data models, building
  endpoints and workflows, writing Step Script, setting up auth and tenant
  isolation, and auditing security before release.
- **One remote MCP server**, `https://mcp.spala.ai/mcp`, operated by Spala.
  It signs you in, finds or creates your Spala project, and hands Claude over
  to that project.

There are no hooks, commands, local servers or bundled executables.

## What it runs, sends and fetches

- The plugin itself runs no code on your machine. The skills are Markdown
  instructions.
- Claude calls the Spala MCP server only after you sign in to your Spala
  account in the browser (OAuth). No tokens or project credentials are stored
  in this package.
- Tool calls send Spala what is needed to build your backend: project and
  organization names, the models, endpoints and logic Claude writes, and test
  requests against your project. Nothing is sent to any other service.
- When you connect a project, the Spala server can return a version-pinned
  `@spala-ai/mcp-install` command that registers that project's own MCP
  server with your client. It runs under your client's normal permission
  prompts.

You need a Spala account. Create one at [spala.ai](https://spala.ai).

- Privacy policy: [spala.ai/privacy](https://spala.ai/privacy)
- Terms: [spala.ai/terms](https://spala.ai/terms)
- Documentation: [docs.spala.ai](https://docs.spala.ai)
- Support: [info@spala.ai](mailto:info@spala.ai)

## About this branch

This `claude-directory` branch is the copy of the Spala plugin that is listed
in the Claude plugin directory. It holds only the plugin manifest, the icon
and the skills. Packages for other coding agents, the validation scripts and
the tests live on the
[`main` branch](https://github.com/spala-ai/agent-integrations/tree/main).
