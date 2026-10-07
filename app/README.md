# Claude Wrapper

[![CI Status](https://github.com/ChrisColeTech/claude-wrapper/workflows/Continuous%20Integration/badge.svg)](https://github.com/ChrisColeTech/claude-wrapper/actions)
[![NPM Version](https://img.shields.io/npm/v/claude-wrapper.svg)](https://www.npmjs.com/package/claude-wrapper)
[![NPM Downloads](https://img.shields.io/npm/dm/claude-wrapper.svg)](https://www.npmjs.com/package/claude-wrapper)
[![GitHub Stars](https://img.shields.io/github/stars/ChrisColeTech/claude-wrapper.svg)](https://github.com/ChrisColeTech/claude-wrapper/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Node Version](https://img.shields.io/node/v/claude-wrapper.svg)](https://nodejs.org/)
[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](https://github.com/ChrisColeTech/claude-wrapper)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/ChrisColeTech/claude-wrapper/pulls)

**OpenAI-compatible HTTP API wrapper for Claude Code CLI with Session Management**

Transform your Claude Code CLI into a powerful HTTP API server with intelligent session management, streaming responses, and OpenAI-compatible tool calling.

It also serves the Anthropic Messages API, so the official Anthropic SDKs run unmodified on your Claude Code login: see [Anthropic surface](#anthropic-surface).

## 🛠️ Tools-First Philosophy

**Claude Wrapper provides OpenAI Tools API compatibility:**

- **Client-Side Execution**: Tools run in your local environment
- **OpenAI Standard**: Uses standard `tools` array format from OpenAI specification
- **MCP Compatible**: Works with your local MCP tool installations

This approach gives you **maximum flexibility** with Claude's tool capabilities.

## Key Features

- **OpenAI Compatible**: Drop-in replacement for OpenAI Chat Completions API
- **Anthropic Compatible**: The official Anthropic SDKs work unmodified against `/v1/messages` ([Anthropic surface](#anthropic-surface))
- **Session Management**: Automatic message history accumulation for conversation continuity
- **Streaming Support**: Real-time response streaming with Server-Sent Events

## 📦 Installation

```bash
# Install globally from npm
npm install -g claude-wrapper
```

After installation, you can use the CLI with either:

- `wrapper` (recommended short command)
- `claude-wrapper` (full package name)

## 🚀 Quick Start

```bash
wrapper
```

You'll see an interactive prompt asking if you want API key protection:

```bash
🚀 Starting Claude Wrapper...
🔐 API Key Protection Setup
Would you like to enable API key protection? (y/n):


- **Choose 'y'** to generate a secure API key for protection
- **Choose 'n' or press Enter** to run without authentication
```

Server starts at `http://localhost:8000` - you're ready to make API calls!

## 📋 CLI Options

```bash
Usage: wrapper [options] [port]

Claude API wrapper with OpenAI compatibility

Arguments:
  port                 port to run server on (default: 8000) - alternative to
                       --port option

Options:
  -v, --version        output the version number
  -p, --port <port>    port to run server on (default: 8000)
  -d, --debug          enable debug mode (runs in foreground)
  -k, --api-key <key>  set API key for endpoint protection
  -n, --no-interactive disable interactive API key setup
  -P, --production     enable production server management features
  -H, --health-monitoring enable health monitoring system
  -s, --stop           stop background server
  -t, --status         check background server status
  -h, --help           display help for command
```

### Authentication Options

**Authentication is completely optional!** You can also bypass the interactive setup:

```bash
# Skip interactive setup (no authentication)
wrapper --no-interactive
wrapper -n                         # shorthand

# Or provide API key directly
wrapper --api-key my-secure-key
wrapper -k my-secure-key           # shorthand
```

## 📡 API Endpoints

| Method   | Endpoint                    | Description                                   |
| -------- | --------------------------- | --------------------------------------------- |
| `POST`   | `/v1/chat/completions`      | Main chat completions with session support    |
| `GET`    | `/v1/models`                | List available Claude models (sonnet, opus); with `anthropic-version`, the Anthropic surface's models |
| `GET`    | `/v1/sessions`              | List all active sessions                      |
| `GET`    | `/v1/sessions/stats`        | Get session statistics                        |
| `GET`    | `/v1/sessions/:id`          | Get specific session details                  |
| `DELETE` | `/v1/sessions/:id`          | Delete a specific session                     |
| `POST`   | `/v1/sessions/:id/messages` | Add messages to a session                     |
| `GET`    | `/v1/auth/status`           | Check authentication configuration and status |
| `GET`    | `/health`                   | Service health check                          |
| `GET`    | `/docs`                     | Swagger UI                                    |
| `GET`    | `/swagger.json`             | OpenAPI 3.0 specification JSON schema         |
| `POST`   | `/v1/messages`              | Anthropic surface: one turn ([Anthropic surface](#anthropic-surface)) |
| `POST`   | `/v1/messages/count_tokens` | Anthropic surface: count input tokens         |
| `GET`    | `/v1/models/:id`            | Anthropic surface: one model (with `anthropic-version`) |
| `GET`    | `/docs/anthropic-openapi.json` | Anthropic surface: OpenAPI 3.0 document    |

## Anthropic surface

The wrapper also serves the **Anthropic Messages API**, beside the OpenAI surface, on the same port and behind the same optional API key. Tools built on the official Anthropic SDKs (TypeScript, Python, and everything built on them) run on your Claude Code login once you change their base URL.

It is a **pure model endpoint**: no request ever runs Claude Code's file or shell tools on your machine. What it serves:

- Real token-by-token streaming
- Client tools that round-trip through the model's own tool calls
- Conversations that continue Claude Code's own session
- Web search and web fetch, served by Claude Code's built-in tools
- Base64 images and PDFs, structured outputs, thinking and effort
- A measured `count_tokens`
- Connectors (`mcp_servers`), if you opt in

Where Claude Code cannot do what the real API does, the surface answers with a 400 rather than ignoring the parameter. [Known deviations](#known-deviations-from-the-real-api) lists every difference.

### Pointing an SDK at it

Both official SDKs read `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY`:

```bash
export ANTHROPIC_BASE_URL=http://localhost:8000
export ANTHROPIC_API_KEY=<the wrapper's API key>   # any placeholder if the wrapper runs without one
```

Or pass them to the client:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ baseURL: 'http://localhost:8000', apiKey: '<the wrapper key>' });
const message = await client.messages.create({
  model: 'sonnet',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude' }]
});
```

```python
import anthropic

client = anthropic.Anthropic(base_url="http://localhost:8000", api_key="<the wrapper key>")
message = client.messages.create(
    model="sonnet", max_tokens=1024, messages=[{"role": "user", "content": "Hello, Claude"}]
)
```

```bash
curl http://localhost:8000/v1/messages \
  -H 'content-type: application/json' \
  -H 'anthropic-version: 2023-06-01' \
  -H 'x-api-key: <the wrapper key>' \
  -d '{"model": "sonnet", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello, Claude"}]}'
```

- **The key.** When the wrapper runs with an API key (`--api-key` or `API_KEY`), send it as `x-api-key` or `Authorization: Bearer`. Without one, the surface is open and accepts any key the SDK sends. The key only gates access; it never reaches Claude Code, which runs on the operator's own login.
- **Headers.** The SDKs send `anthropic-version` themselves. Raw HTTP needs `anthropic-version: 2023-06-01` on the `/v1/messages` endpoints. `anthropic-beta` values are accepted; `mcp-client-2025-11-20` enables connectors. Every response carries a `request-id` header, and every error body carries the same `request_id`: quote it to the operator.
- **Models.** Name a model by id or alias. The response's `model` is always the canonical id that ran.

| Model | Aliases |
| - | - |
| `claude-fable-5-1` | `fable` |
| `claude-opus-5-5` | `opus` |
| `claude-sonnet-5-5` | `sonnet` |
| `claude-haiku-4-5-20251001` | `haiku`, `claude-haiku-4-5` |

### Endpoints

| Method | Endpoint | Description |
| - | - | - |
| `POST` | `/v1/messages` | One turn, as JSON or as server-sent events with `stream: true`. Bodies up to 32 MB. |
| `POST` | `/v1/messages/count_tokens` | Input tokens, measured by a one-token run on Claude Code (it costs one minimal model call). |
| `GET` | `/v1/models` | With `anthropic-version`: the models this surface serves, newest first. Without it: the OpenAI surface's list, unchanged. |
| `GET` | `/v1/models/{model_id}` | With `anthropic-version`: one model, by id or alias. |

The contract is an OpenAPI document at `/docs/anthropic-openapi.json`. It is also in the Swagger UI at `/docs`: choose "Anthropic surface" in the definition picker. The [runbook](docs/ANTHROPIC_SURFACE_RUNBOOK.md) lists every setting with its default, how to run the real-CLI test scenarios and how to re-scrub the test fixtures.

### Operator warning

Read this before you expose the Anthropic surface to anyone. The wrapper listens on all interfaces, so set an API key before other machines can reach the port.

**The model knows about your machine and your account.** Claude Code prepends one line of its own to the client's system prompt: "You are a Claude agent, built on Anthropic's Claude Agent SDK." It also adds context to the first user turn of every session:

- the working directory, which is a path under your home directory unless `XDG_STATE_HOME` moves it
- the platform, shell and OS version
- the model's identity and knowledge cutoff
- token and spending budgets
- today's date
- **your Claude Code account's email address**

So the model calls itself "Claude, built on Anthropic's Claude Agent SDK" (never Claude Code). Asked directly, it will quote your email address. Nothing removes this context on a subscription login: the switches that would remove it either refuse that login or silently change the model. It costs about 500 input tokens on every run, and `count_tokens` includes them.

**Redaction hides your account strings, with limits.** Redaction is on by default. At start, the wrapper reads Claude Code's account file and arms your account's email address, display name and full name. The file is `.claude.json` in the `CLAUDE_CONFIG_DIR` that `CLAUDE_WRAPPER_UPSTREAM_ENV` sets, else in your home directory. The log says `Redaction armed` with the number of strings, never the strings. `CLAUDE_WRAPPER_REDACT` adds more, comma-separated, such as your OS username. If nothing can be armed, the wrapper starts with a warning that redaction is unarmed. That happens on an API-key login, for instance, whose account file holds no account.

Each armed string is replaced with `[redacted]`, ignoring case and matching whole words. Redaction covers streamed text, and the input of every tool call: client tools, web search and fetch, connectors and structured output. It does **not** cover:

- a paraphrase or a spelled-out form ("user at example dot invalid");
- an armed string run together with other letters or digits;
- a response cut partway through an armed string, by `max_tokens` or a stop sequence: the partial text is relayed;
- inside tool-call input, a value written with `\u` escapes, or an armed string that contains `"` or `\`;
- the content of web search, web fetch and connector result blocks;
- your OS username in the working-directory path, unless you add it to `CLAUDE_WRAPPER_REDACT`;
- Claude Code's own transcripts on your disk, which keep the real text until they are deleted.

**Connectors are off until you list hosts.** For `mcp_servers`, Claude Code connects to the client's server from your machine. Unrestricted, any client could make your machine open connections inside your network. The real API's connectors connect from Anthropic and never can. So a request with `mcp_servers` is a 400 naming `CLAUDE_WRAPPER_CONNECTOR_HOSTS` until you list the hosts clients may use, such as `CLAUDE_WRAPPER_CONNECTOR_HOSTS=mcp.example.com,tools.example.com:8443`. `*` allows every host. A client's `authorization_token` is written only to the run's private config file, kept out of every log, and removed when the run ends.

**Web fetch also runs from your machine.** A client that declares a `web_fetch` tool makes Claude Code fetch the URL from the machine the wrapper runs on. The only domain limits are the ones the client sends; the wrapper has no operator setting for web fetch.

**Which login Claude Code runs on is your choice.** Every request runs on the Claude Code login of the machine. All clients share its usage limits and its account identity. The wrapper passes none of its own `CLAUDE*` or `ANTHROPIC*` environment variables to Claude Code, so a stale token in its environment cannot silently replace that login. To run on a specific credential, put it in `CLAUDE_WRAPPER_UPSTREAM_ENV`, for example `{"ANTHROPIC_API_KEY": "<key>"}` or `{"CLAUDE_CODE_OAUTH_TOKEN": "<token>"}`. The [runbook](docs/ANTHROPIC_SURFACE_RUNBOOK.md#claude_wrapper_upstream_env) covers the details.

Anthropic's [legal and compliance page](https://code.claude.com/docs/en/legal-and-compliance) says that developers building products, including with the Agent SDK, should use API-key authentication. It says OAuth is for ordinary use of Claude Code. A [support article](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan) says Agent SDK and `-p` use draws on your plan's limits. Which login you use, and whether your use fits its terms, is for you to decide; the wrapper decides nothing.

**Login and billing failures are yours to fix.** When your login expires or your account has a billing problem, clients get a 500 `api_error` with `x-should-retry: false` and a message naming the upstream login. They do not get a 401 about their own key. Since late September 2026 the API behind Claude Code has answered some third-party wrappers with a 400 "Third-party apps now draw from extra usage…". Reports tie it to text appended to the system prompt. The surface adds no system text of its own and relays that 400 verbatim.

**Other things that are visible to anyone who can reach the port:**

- `/health` lists the run counts and the session ids of conversations with queued turns.
- `/docs` and `/docs/anthropic-openapi.json` are public.
- The body is parsed before the key is checked, so a client without a key can still make the wrapper parse up to 32 MB.

### Known deviations from the real API

Context, output and usage:

- **Residual context and self-identification.** The model knows it is "a Claude agent, built on Anthropic's Claude Agent SDK". It also knows the working directory, platform, date and the operator's account email. The email, display name and full name are redacted on output; a paraphrase is not.
- **`max_tokens` applies to each model call.** A turn with web search, web fetch or connector calls makes several model calls, so it can emit more than `max_tokens` in total.
- **A stop-sequence cut reports an estimated `output_tokens`** for the call it cut. It is the only inexact usage figure.
- **`count_tokens` counts the context Claude Code adds** (about 500 tokens) and, for a request with history, that history as rendered into the prompt. Each count makes one minimal model call: it spends quota, takes a run slot and can fail like a turn (429, 504, 529). `thinking.enabled` on a count is measured with thinking off.
- **`usage.server_tool_use` counts only the searches and fetches that ran.** A denied or failed one counts zero.
- **Thinking text is always empty** (display omitted), whatever `thinking.display` asks.
- **Hitting the run's turn limit is a 500 `api_error`**, not the real API's `pause_turn`.
- **Haiku 4.5's output cap may be lower than the catalogue says.** The catalogue lets Haiku 4.5 ask for `max_tokens` up to 64,000, as the API does. Claude Code reports 32,000 as its own cap for that model, and what happens above that is unverified.

Parameters and validation:

- **Sampling parameters are a 400 on every model.** That means a `temperature` other than 1.0, a `top_p` below 0.99, or any `top_k`. It includes Haiku 4.5, where the real API still accepts them.
- **`tool_choice` `any` and `tool` are a 400 on every model**, Haiku 4.5 included.
- **`max_tokens: 0`** (the real API's cache pre-warm) is a 400.
- **Client tool names are limited to 115 characters**, not 128: Claude Code prefixes them with `mcp__client__`.
- **`user_location`, `disable_parallel_tool_use`, `service_tier`, `metadata.user_id`, `inference_geo`, `diagnostics` and `cache_control` are accepted and ignored.** The response's `diagnostics` is always null.
- **Some blocks are a 400**: URL-sourced images and documents, `file` sources, `search_result`, and the newer connector blocks (`mcp_tool_listing` and the tool-change blocks).
- **Unknown `anthropic-beta` names are accepted** rather than rejected.
- **Some 400 messages use the surface's own wording**, where the real API's text was never recorded. These are the messages for sampling, `container`, unsupported blocks and tool types, the thinking budget and effort checks, and duplicate tool names. A `system` prompt containing a NUL character is a 400.
- **Mixed document citations give a 400 that indexes Claude Code's messages.** When citations are enabled on some documents but not all, the 400 is relayed from upstream, and its message counts Claude Code's own messages (`messages.9`), not yours.

Tools, web search and connectors:

- **Web search results have no citations**, an opaque `encrypted_content`, and `page_age: null`.
- **Web fetch returns Claude Code's extraction of the page**, not the page itself.
- **A message that calls a client tool before a web or connector tool ends the turn early.** The turn ends with a `server_tool_use` block and no result block, and the result opens the next turn's message.
- **Nothing may follow the `tool_result` blocks** in the message that answers a parked tool call: it is a 400, where the real API accepts trailing text. The held-open run can take only the tool results, so send the text in the next turn.
- **Lost tool results reach the model as text.** If no parked run holds the results (the park timed out, or the wrapper restarted), the request is still answered, but the model sees the results as text in the replayed history rather than as real tool results.
- **Structured output keeps only the JSON.** Prose text blocks are dropped, a stop sequence can cut inside the JSON, and a schema Claude Code refuses at startup is a 400 `output_config.format.schema <reason>`.
- **Connectors are off by default** and gated by the operator's host list.
- **Some connector settings are ignored or restricted.** `defer_loading` is ignored. `enabled: false` is honoured, but disabling one tool in `configs`, while the toolset enables tools by default, needs that server's `tool_configuration.allowed_tools`; otherwise it is a 400.
- **Connector names are restricted.** They may hold only letters, digits, `_` and `-`, never `__`, and `client` is reserved. A pinned `tools` listing in an `mcp_toolset` is a 400.
- **Connector results keep only text items.** Other item types are dropped.
- **A connector that cannot connect may give a 504.** Both of Claude Code's connect waits (`MCP_CONNECT_TIMEOUT_MS`, `MCP_TIMEOUT`) are pinned at 5 s, inside the 20 s startup timer, so it should report the server as not connected and the turn get the 400 that names it; that is unverified, and a 504 from the startup timer remains possible.

Conversations:

- **Edits to earlier history are ignored on the turn that answers a parked tool call.** The held run continues with the history Claude Code holds. A regenerate, or an edit on any other turn, is a replayed turn, not a fork.
- **Some parameters cannot change while a run is held open.** On that same turn, a different `model`, `max_tokens`, `system`, `thinking`, `output_config`, `tools` or `mcp_servers` is ignored, because the held run keeps the values it started with. `message.model` always names the model that ran.
- **A request that continues a conversation waits up to 10 s for the conversation's previous run to end.** Then that run is ended: a run parked on a tool call the client abandoned has its tool calls rejected, and the request is answered as a replayed turn.

Errors and headers:

- **Login and billing failures of the operator are a 500**, never a 401 or 402.
- **No `anthropic-ratelimit-*` headers.**

## 🚀 CLI Usage

### Starting the Server

```bash
# Start server on default port (8000)
wrapper

# Start server on specific port
wrapper 9999
wrapper --port 8080
wrapper -p 8080                    # shorthand

# Show version
wrapper --version
wrapper -v                         # shorthand

# Start with debug information (runs in foreground)
wrapper --debug
wrapper -d                         # shorthand
```

### Managing the Background Service

```bash
# Check if server is running
wrapper --status
wrapper -t                         # shorthand

# Stop the background server
wrapper --stop
wrapper -s                         # shorthand
```

## 📚 Documentation

📖 **[Full Documentation](docs/README.md)** - Comprehensive guide with detailed examples, production deployment, troubleshooting, and advanced configuration.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

⭐ **Star this repository** if you find it useful!  
🐛 **Report issues** or suggest features at [GitHub Issues](https://github.com/ChrisColeTech/claude-wrapper/issues)

**Get started today** - `npm install -g claude-wrapper` and run `wrapper` to transform your Claude CLI into a powerful HTTP API!
