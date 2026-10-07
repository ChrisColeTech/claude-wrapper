# 23: App factory prefactor

Spec: [spec.md](../spec.md), section 16, Testing Decisions

**What to build:** The server is built by a factory that takes its dependencies, so a test can build the app with a replay runner and a fake clock injected, and two factory calls give two independent apps. The running wrapper behaves exactly as today: `startServer` still listens on the configured port with the OpenAI surface, Swagger UI, auth middleware and error handler wired as before. This is the prefactor that makes every later integration test possible.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [ ] `createServer(deps)` returns a fresh Express app on each call; module load no longer builds one
- [ ] The dependency object has a slot for every injectable the spec's composition root names (runner, catalogue, sessions, control server, clock), all optional for now, so later tickets add implementations without changing the signature
- [ ] `startServer` and the default export keep today's behaviour; the CLI and daemon start paths are unchanged
- [ ] Every existing unit, integration and e2e test passes unchanged
- [ ] No OpenAI-surface route, middleware or response changes

## Comments

- Resolved by merge 7c2cb32 on anthropic-compat-api.
