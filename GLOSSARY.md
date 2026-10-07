# Claude Wrapper

An HTTP server that presents vendor-compatible chat APIs to clients and fulfils them by driving the locally installed Claude Code CLI, so tools built against those APIs can run on a Claude Code login.

## Language

### Surfaces

**Surface**:
One vendor-compatible HTTP API shape the wrapper presents to clients. The wrapper has an OpenAI surface today and is gaining an Anthropic surface.
_Avoid_: endpoint set, API flavor, compatibility mode, compat layer

**OpenAI surface**:
The surface that mirrors the OpenAI Chat Completions API (`/v1/chat/completions`).

**Anthropic surface**:
The surface that mirrors the Anthropic Messages API (`/v1/messages` and its companion endpoints).
_Avoid_: Anthropic-compatible API, proxy

**Upstream**:
The Claude Code CLI process the wrapper drives to produce an answer.
_Avoid_: backend, Claude, the model, engine

**Catalogue**:
The surface's own list of the models it serves, each with its id, aliases and limits. What `/v1/models` lists and what a request's `model` must resolve in.
_Avoid_: model list, model registry, supported models

**Operator-side failure**:
An upstream failure whose remedy lies with the person running the wrapper (its Claude Code login, subscription or billing), not with the client's request or credential.
_Avoid_: auth error (unqualified), upstream 401, server-side error

### Conversation

**Turn**:
One request/response exchange on a surface. The client sends its full history and receives one assistant message.

**Run**:
One invocation of upstream. A run may make several model calls and use built-in tools; a turn may need more than one run, and a run may outlive a turn.
_Avoid_: execution, call, invocation

**Model call**:
One Messages API request upstream makes inside a run. A run makes one or more; a built-in tool call separates two.
_Avoid_: iteration, API call, sub-message

**Turn stream**:
The single Messages API event sequence the surface emits for one turn, flattened from every model call in it.
_Avoid_: SSE stream, event stream (unqualified), response stream

**Commit**:
The moment a turn's HTTP status and headers become final: the first `message_start` the surface relays. A failure before it is an HTTP error; after it, an SSE `error` event.
_Avoid_: headers flushed, first byte, response started

**Cut**:
A turn the surface ends itself at an output limit (`max_tokens`, a stop sequence, or the one-token `count_tokens` measurement), interrupting upstream and forgetting the upstream session.
_Avoid_: truncation, early stop, abort

**Upstream session**:
A Claude Code conversation identified by Claude Code's own session id and resumable by Claude Code.
_Avoid_: Claude session, CLI session

**Wrapper session**:
The wrapper's own server-side message history keyed by a client-supplied `session_id` (the `/v1/sessions` endpoints on the OpenAI surface).
_Avoid_: session (unqualified)

**Fingerprint**:
The normalised form of a conversation's history that identifies the upstream session which produced its last assistant turn.
_Avoid_: session key, history hash, cache key

**Continued turn**:
A turn served by resuming the upstream session whose transcript matches the request's history, sending only the new user message.
_Avoid_: warm turn, cache hit, session match

**Replayed turn**:
A turn served by a fresh upstream run with the request's history rendered into the prompt.
_Avoid_: cold turn, text replay, fresh-run fallback

**Run-bound parameter**:
A request parameter fixed when a run is spawned (model, output limit, thinking, effort, output format, system prompt), so a turn that resumes a held-open run cannot change it.
_Avoid_: spawn-time setting, process parameter

### Tools

**Client tool**:
A tool the client defines in the request (name, description, input schema) and executes itself. The surface hands the client a tool call and accepts the result back on the next turn.
_Avoid_: function, custom tool, user tool

**Built-in tool**:
A tool Claude Code executes itself inside an upstream run (WebSearch, WebFetch, Read, Bash, and the rest).
_Avoid_: native tool, CLI tool, local tool

**Server tool**:
A tool type the Anthropic API executes on Anthropic's side (`web_search_20260209` and similar). A client asks for one on the Anthropic surface; the wrapper fulfils it with a built-in tool.
_Avoid_: hosted tool, Anthropic tool

**Tool bridge**:
The mechanism by which a client tool call made inside an upstream run reaches the client as a tool call, and the client's result gets back into the run.
_Avoid_: tool proxy, tool relay

**Bridge server**:
The MCP server the wrapper hosts to expose client tools to upstream.
_Avoid_: proxy server, tool server, MCP shim

**Control server**:
The wrapper's loopback HTTP listener that an upstream run calls back into: it carries the bridge server and the hook endpoint for each run.
_Avoid_: callback server, sidecar, internal API

**Connector**:
A remote MCP server the client names in its request and upstream calls directly. Its tools are neither client tools nor built-in tools.
_Avoid_: MCP server (unqualified), remote tool, passthrough server

**Held-open run**:
An upstream run kept alive past the end of a turn, blocked inside the tool bridge, so a later turn can continue it.
_Avoid_: parked process, sticky run, long-lived session

**Park**:
The moment a turn ends with `stop_reason: tool_use` while its run stays held open. A parked run is waiting for the client's results.
_Avoid_: suspend, pause

**Pre-delivered result**:
A client tool result that arrived before upstream asked the bridge for that call.
_Avoid_: early result, cached result
