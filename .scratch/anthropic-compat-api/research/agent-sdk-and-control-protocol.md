# Agent SDK and the stream-json control protocol

Commissioned by: [issues/04-agent-sdk-and-control-protocol.md](../issues/04-agent-sdk-and-control-protocol.md)
Date: 2026-10-04

Versions examined: `@anthropic-ai/claude-agent-sdk@0.3.289` (bundles Claude Code 2.1.289) installed with `npm install` into the session scratchpad at `/tmp/claude-1000/-home-anas-Work-claude-wrapper/7b43bed2-a295-4731-bc49-d229156f3702/scratchpad/agent-sdk/`; the user's installed upstream, Claude Code 2.1.284 at `/home/anas/.local/share/mise/installs/claude/latest/claude`. File references below are relative to `node_modules/@anthropic-ai/claude-agent-sdk/` in that scratchpad. `sdk.mjs` is minified (148 lines), so its references are `sdk.mjs:LINE:COLUMN`. Two live probes were run (see "Probes"); their raw output is in the scratchpad as `probe-output.json` and `probe2-wire.ndjson`.

Vocabulary follows `GLOSSARY.md`: *upstream* is the Claude Code CLI process, a *run* is one invocation of it, a *client tool* is defined and executed by the HTTP client, a *built-in tool* is executed by upstream, and the *tool bridge* is how a client tool call inside a run reaches the client and its result returns.

## Sources

Docs (fetched 2026-10-04):

- [overview] https://code.claude.com/docs/en/agent-sdk/overview
- [ts-ref] https://code.claude.com/docs/en/agent-sdk/typescript
- [custom-tools] https://code.claude.com/docs/en/agent-sdk/custom-tools
- [streaming] https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
- [user-input] https://code.claude.com/docs/en/agent-sdk/user-input
- [hooks] https://code.claude.com/docs/en/agent-sdk/hooks
- [permissions] https://code.claude.com/docs/en/agent-sdk/permissions
- [sessions] https://code.claude.com/docs/en/agent-sdk/sessions
- [hosting] https://code.claude.com/docs/en/agent-sdk/hosting
- [quickstart] https://code.claude.com/docs/en/agent-sdk/quickstart
- [auth] https://code.claude.com/docs/en/authentication
- [legal] https://code.claude.com/docs/en/legal-and-compliance
- [headless] https://code.claude.com/docs/en/headless
- [env-vars] https://code.claude.com/docs/en/env-vars
- [mcp] https://code.claude.com/docs/en/mcp
- [consumer-terms] https://www.anthropic.com/legal/consumer-terms (effective date shown on the page: October 8, 2025)
- [support-plan] https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan

Package and binaries:

- [pkg] `package.json`; [manifest] `manifest.json`; [readme] `README.md`; [license] `LICENSE.md`
- [sdk.mjs], [sdk.d.ts]
- [native-pkg] `node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/{package.json,claude}`
- [cli-help] `claude --help` of the installed 2.1.284 binary
- [cli-bin] strings extracted from the installed 2.1.284 ELF binary (byte offsets given)
- [probe1], [probe2] the two live runs described under "Probes"

## Probes

Both probes ran from the scratchpad with `pathToClaudeCodeExecutable` set to the mise-installed 2.1.284 binary, `maxTurns: 1`, `permissionMode: 'default'` (no bypass), `tools: []` (no built-in tools), `settingSources: []`, `persistSession: false`, a one-line prompt, and a `spawnClaudeCodeProcess` wrapper that logged the exact argv and (probe 2) every stdin/stdout line. The environment had no `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or `CLAUDE_CODE_OAUTH_TOKEN` set; `~/.claude/.credentials.json` existed with a `claudeAiOauth` entry (`subscriptionType: "team"`, `rateLimitTier: "default_claude_max_5x"`; token values were not read). The probes ran inside a Claude Code session, so the child inherited that session's `CLAUDE_CODE_ENTRYPOINT=cli`, `CLAUDECODE=1` and similar variables from `process.env`.

- Probe 1: prompt "Reply with the single word: pong". Completed in 2,335 ms with `result.subtype: "success"`, `result: "pong"`, `stop_reason: "end_turn"`, `total_cost_usd: 0.002859`. `system/init` carried `apiKeySource: "none"`, `claude_code_version: "2.1.284"`, `capabilities: ["interrupt_receipt_v1","interrupt_cancel_queued_v1","msg_lifecycle_v1","mcp_read_resource_v1","mcp_tool_ui_meta_v1"]`. A `rate_limit_event` frame followed init. [probe1]
- Probe 2: one in-process MCP tool (`ping`) whose handler blocked 8,000 ms before returning; prompt asked the model to call it once. The tool was called over the control channel, the CLI waited for the handler, the `tool_result` came back, and the run ended with `error_max_turns` because `maxTurns: 1`. Frame timeline and verbatim frames are in section 2. [probe2]

## 1. How the SDK drives the CLI

**It spawns a `claude` subprocess and talks stream-json over stdio.** "When your code calls `query()`, the SDK spawns a separate `claude` CLI process and talks to it over stdio. That subprocess owns the shell, the working directory, and the JSONL session transcripts on local disk." [hosting, "The subprocess model"]. "One agent session maps to one subprocess." [hosting]

**Which binary.** By default a native binary shipped as a platform-specific optional dependency: `optionalDependencies` lists `@anthropic-ai/claude-agent-sdk-{linux-x64,linux-arm64,linux-x64-musl,linux-arm64-musl,darwin-x64,darwin-arm64,win32-x64,win32-arm64}` all pinned to `0.3.289`, and `"claudeCodeVersion": "2.1.289"` [pkg]. The linux-x64 package is a single `claude` file, `ELF 64-bit LSB executable, x86-64 ... not stripped`, 246,107,320 bytes; running it with `--version` prints `2.1.289 (Claude Code)` [native-pkg]. `manifest.json` lists per-platform checksums and sizes, `"version": "2.1.289"`, `"buildDate": "2026-10-03T19:38:35Z"`, and `"sdkCompat": { "testedWrapperVersions": ["0.3.250", ..., "0.3.285"], "harnessSchema": 1 }` [manifest]. "Both the TypeScript and Python SDKs bundle a native Claude Code binary, so most installs need no separate Claude Code install." [quickstart]. "The bundled binary is pinned to the SDK package version, so updating the SDK is how you update the CLI." [hosting, "Runtime dependencies"]

**Resolution and override.** `pathToClaudeCodeExecutable` wins; otherwise the SDK resolves the native package and throws if absent:

```
ny=d.pathToClaudeCodeExecutable;if(!ny){let Kt=qBe(import.meta.url),gn=GBe(Kt),Cr=a2((Zi)=>gn.resolve(Zi));if(!Cr)throw Error(`Native CLI binary for ${process.platform}-${process.arch} not found. Reinstall @anthropic-ai/claude-agent-sdk without --omit=optional, or set options.pathToClaudeCodeExecutable.`);ny=Cr}
```
[sdk.mjs:142:21169]. Docs: `pathToClaudeCodeExecutable` — "Auto-resolved from bundled native binary | Path to Claude Code executable. Only needed if optional dependencies were skipped during install or your platform isn't in the supported set" [ts-ref]; "install Claude Code natively and set `pathToClaudeCodeExecutable` to its path" [quickstart, install note]. If the path is not a native binary the SDK runs it through a JS runtime: `let dt=rBe(l),xt=dt?l:s,bt=dt?[...i,...B]:[...i,l,...B]` where `s` is `executable` (`'bun' | 'deno' | 'node'`, default `xa()?"bun":"node"`) and `i` is `executableArgs` [sdk.mjs:136:98735, 136:92926]. **Confirmed live:** both probes spawned `/home/anas/.local/share/mise/installs/claude/latest/claude` (2.1.284) under SDK 0.3.289 and completed [probe1, probe2].

**Spawn mechanics.** `child_process.spawn(command, args, {cwd, stdio:["pipe","pipe","pipe"], signal, env, windowsHide:!0})` [sdk.mjs:136:92926, `spawnLocalProcess`]. A custom `spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess` replaces it [sdk.d.ts:2444, 9437-9523]. The `signal` passed to spawn is "a **forwarded** signal owned by `ProcessTransport` ... It aborts only after the SDK's graceful-close path has run: stdin EOF → `GRACEFUL_EXIT_TIMEOUT_MS` (~2 s) grace window." [sdk.d.ts:9503-9506]. Observed: stdin EOF at t=12,422 ms, process exit at t=13,404 ms [probe2].

**Flags passed.** The base argv is fixed:

```
let B=["--output-format","stream-json","--verbose","--input-format","stream-json"];
```
[sdk.mjs:136:95517]. Then, conditionally (same function, sdk.mjs:136:95517 through 136:98735): `--thinking adaptive|disabled` or `--max-thinking-tokens N`, `--thinking-display`, `--effort`, `--max-turns N`, `--max-budget-usd`, `--task-budget`, `--model`, `--agent`, `--betas a,b`, `--json-schema <json>`, `--debug-file` / `--debug`, `--permission-prompt-tool stdio` (when `canUseTool` is set; the SDK throws if `permissionPromptToolName` is also set) or `--permission-prompt-tool <name>`, `--permission-prompts host|none`, `--continue`, `--resume=<id>`, `--allowedTools a,b`, `--disallowedTools a,b`, `--tools a,b` / `--tools ""` / `--tools default`, `--mcp-config '{"mcpServers":{...}}'` (process-transport servers only, see section 2), `--setting-sources=a,b`, `--strict-mcp-config`, `--permission-mode <mode>`, `--allow-dangerously-skip-permissions`, `--fallback-model`, `--include-hook-events`, `--include-partial-messages`, `--session-mirror`, `--project-config-root=`, `--add-dir <dir>` per `additionalDirectories`, `--await-initialize` or `--plugin-dir`/`--plugin-dir-no-mcp`, `--fork-session`, `--resume-session-at=`, `--resume-drops-turn=`, `--session-id=<uuid>`, `--no-session-persistence`, `--managed-settings`, then every `extraArgs`/`settings` entry as `--<key>` (null value) or `--<key> <value>`. The SDK does **not** pass `-p`/`--print` (observed argv below), although `claude --help` says `--input-format` and `--output-format` "only works with --print" [cli-help]; the probes ran non-interactively regardless.

Observed argv, probe 1: `["--output-format","stream-json","--verbose","--input-format","stream-json","--max-turns","1","--tools","","--setting-sources=","--permission-mode","default","--no-session-persistence"]` [probe1]. Probe 2 added `"--allowedTools","mcp__probe__ping"` and nothing else: the in-process server did not appear in argv [probe2].

**Environment handed to the child.** `env` defaults to `{...process.env}`; when given it *replaces* the environment: "When set, this replaces the subprocess environment instead of merging with `process.env`, so pass `{ ...process.env, YOUR_VAR: 'value' }` to keep inherited variables like `PATH`." [ts-ref]. The SDK then sets, only if unset: `CLAUDE_CODE_ENTRYPOINT="sdk-ts"`, `CLAUDE_AGENT_SDK_VERSION="0.3.289"`, `CLAUDE_CODE_SDK_READS_SESSION_STATE="1"`; sets `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING="true"` when `enableFileCheckpointing`; deletes `NODE_OPTIONS`; sets `DEBUG="1"` when `DEBUG_CLAUDE_AGENT_SDK` is truthy, else deletes `DEBUG` [sdk.mjs:142:21562, 136:98735]. It also sets `process.env.CLAUDE_AGENT_SDK_VERSION="0.3.289"` in the *host* process [sdk.mjs:142:18893]. It sets no credential variable anywhere (no assignment to `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` exists in `sdk.mjs`; the only reads are a credentials-copy path for `sessionStore` resume at sdk.mjs:142:16584). `CLAUDE_CODE_ENTRYPOINT` is documented as "Entry point name when launching Claude Code as a library or module" [env-vars].

## 2. In-process MCP tools and the control protocol

### 2.1 `tool()` and `createSdkMcpServer()`

```ts
export declare function tool<Schema extends AnyZodRawShape>(_name: string, _description: string, _inputSchema: Schema, _handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>, _extras?: { annotations?: ToolAnnotations; searchHint?: string; alwaysLoad?: boolean; }): SdkMcpToolDefinition<Schema>;
export declare function createSdkMcpServer(_options: CreateSdkMcpServerOptions): McpSdkServerConfigWithInstance;
declare type CreateSdkMcpServerOptions = { name: string; version?: string; instructions?: string; tools?: Array<SdkMcpToolDefinition<any>>; alwaysLoad?: boolean; timeout?: number; };
export declare type McpSdkServerConfig = { type: 'sdk'; name: string; timeout?: number; };
export declare type McpSdkServerConfigWithInstance = McpSdkServerConfig & { instance: McpServer; };
```
[sdk.d.ts:9716-9720, 615, 617-645, 1195-1210]. `createSdkMcpServer` builds an `@modelcontextprotocol/sdk` `McpServer` and returns `{type:"sdk",name:e.name,instance:t,...n!==void 0&&{timeout:n}}` [sdk.mjs:117:57283]. "The server runs in-process inside your application, not as a separate process." [custom-tools]. Tool names on the wire are `mcp__{server_name}__{tool_name}` and must be listed in `allowedTools` to run without a permission prompt [custom-tools]. "Tool search is on by default and defers SDK MCP tools"; `alwaysLoad: true` keeps the schema in the initial prompt [custom-tools]. Errors: "The SDK's in-process MCP server catches uncaught exceptions and returns them as error results"; a handler may return `isError: true` to compose the message [custom-tools].

The `timeout` option: "Per-server tool-call timeout in milliseconds. Overrides the MCP_TOOL_TIMEOUT environment variable for this server. Hard wall-clock limit per call; progress notifications do not extend it. Values below 1000ms are ignored (falls through to MCP_TOOL_TIMEOUT or the default). Applies when the server is first registered" [sdk.d.ts:1198-1201]; "Requires TypeScript Agent SDK v0.3.248 or later" [ts-ref].

### 2.2 How an in-process server reaches the CLI

SDK-type servers are not passed in `--mcp-config` (probe 2 argv has none). Each is connected to an in-memory transport whose send function writes to the CLI: `connectSdkMcpServer(e,t){let n=new kx((o)=>this.sendMcpServerMessageToCli(e,o)),r=t.instance.connect(n)...;this.sdkMcpServers.set(e,{transport:n,timeout:Zu(t.timeout),connection:r})}` [sdk.mjs:141:1443]. The servers are announced in the first `initialize` control request: `return{subtype:"initialize",hooks:this.initHooksPayload,sdkMcpServers:t,sdkMcpServerConfigs:r,sdkMcpServerManifests:e,jsonSchema:...,systemPrompt:...,appendSystemPrompt:...,...}` [sdk.mjs:138:7137], where `sdkMcpServers` is the list of server names and `sdkMcpServerManifests` holds each server's own `initialize` and `tools/list` results, which the SDK obtains by handshaking with the in-process server itself before spawn so "registering N in-process servers costs no mcp_message control round trips before the first turn; tools/call and everything after the handshake still flow as mcp_message exactly as before" [sdk.d.ts:4478].

CLI → SDK tool call: a `control_request` with `request.subtype: "mcp_message"`; the SDK hands `message` to the server transport and returns the server's JSON-RPC reply as `response.mcp_response`:

```
else if(e.request.subtype==="mcp_message"){let n=e.request,r=this.sdkMcpServers.get(n.server_name)?.transport;if(!r)throw Error(`SDK MCP server not found: ${n.server_name}`);if(c2(n.message))return{mcp_response:await this.handleMcpControlRequest(n.server_name,n,r)};else{if(r.onmessage)r.onmessage(n.message);return{mcp_response:{jsonrpc:"2.0",result:{},id:0}}}}
```
[sdk.mjs:138:2410] (`c2` = "has `method` and non-null `id`", i.e. a JSON-RPC request [sdk.mjs:136:107773]). SDK → CLI server-initiated messages (e.g. `notifications/tools/list_changed`) travel the other way as `{type:"control_request",request_id,request:{subtype:"mcp_message",server_name,message}}` [sdk.mjs:141:2640].

### 2.3 Envelope and request types, verbatim from `sdk.d.ts`

```ts
export declare type SDKControlRequest = {
    type: 'control_request';
    /** Chosen by the sender, unique among its in-flight requests; the control_response (and any control_cancel_request) for this request echoes it. */
    request_id: string;
    request: SDKControlRequestInner;
};                                                                                   // sdk.d.ts:4979-4988
export declare type SDKControlResponse = { type: 'control_response'; response: ControlResponse | ControlErrorResponse; };   // 5030-5036
declare type ControlResponse = {
    subtype: 'success';
    request_id: string;
    /** The success payload, shaped as documented for the answered request's subtype; absent or {} for requests that are merely acknowledged. */
    response?: Record<string, unknown>;
    pending_permission_requests?: SDKControlRequest[];
    pending_user_dialog_requests?: SDKControlRequest[];
};                                                                                   // 404-422
declare type ControlErrorResponse = { subtype: 'error'; request_id: string; error: string; pending_permission_requests?: SDKControlRequest[]; pending_user_dialog_requests?: SDKControlRequest[]; };  // 380-399
declare type SDKControlCancelRequest = { type: 'control_cancel_request'; /** The request_id of the control_request being withdrawn. */ request_id: string; };  // 3887-3893
```

`SDKControlRequestInner` is a union of 40 subtypes [sdk.d.ts:4990]: `interrupt | can_use_tool | initialize | set_permission_mode | set_model | set_max_thinking_tokens | rename_session | set_color | mcp_status | get_context_usage | get_session_cost | list_models | get_usage | get_binary_version | mcp_call | file_suggestions | hook_callback | mcp_message | rewind_files | cancel_async_message | read_file | seed_read_state | mcp_set_servers | register_repo_root | reload_plugins | reload_skills | reload_output_styles | mcp_reconnect | mcp_toggle | stop_task | background_tasks | get_task_output | apply_flag_settings | get_settings | get_hooks_listing | update_settings | elicitation | request_user_dialog | list_permission_rules | mcp_read_resource`. The ones the ticket asked about:

```ts
declare type SDKControlInitializeRequest = {            // sdk.d.ts:4464-4543 (SDK -> CLI, first frame)
    subtype: 'initialize';
    hooks?: Partial<Record<coreTypes.HookEvent, SDKHookCallbackMatcher[]>>;
    sdkMcpServers?: string[];
    sdkMcpServerConfigs?: Record<string, { timeout?: number; }>;
    sdkMcpServerManifests?: Record<string, { initializeResult: Record<string, unknown>; toolsListResult?: Record<string, unknown>; }>;
    sdkMcpServerManifestsOrigin?: 'host_per_send';
    jsonSchema?: Record<string, unknown>;
    systemPrompt?: string[];
    appendSystemPrompt?: string;
    systemPromptSnapshot?: boolean;
    planModeInstructions?: string;
    toolAliases?: Record<string, string>;
    excludeDynamicSections?: boolean;
    agents?: Record<string, coreTypes.AgentDefinition>;
    title?: string;
    skills?: string[];
    promptSuggestions?: boolean;
    agentProgressSummaries?: boolean;
    forwardSubagentText?: boolean;
    supportedDialogKinds?: string[];
    perTaskStopAffordance?: boolean;
    plugins?: coreTypes.SdkPluginConfig[];
};
export declare type SDKControlInitializeResponse = {    // 4548-4594 (CLI -> SDK, as control_response.response)
    commands: coreTypes.SlashCommand[]; agents: coreTypes.AgentInfo[]; output_style: string; available_output_styles: string[];
    models: coreTypes.ModelInfo[]; account: coreTypes.AccountInfo;
    hooks_applied?: boolean; plugins_applied?: boolean;
    sdk_mcp_manifests_parked?: Record<string, 'parked' | 'already_connected' | 'protocol_version_mismatch' | 'malformed' | 'not_honoured'>;
    fast_mode_state?: coreTypes.FastModeState; fast_mode_disabled_reason?: coreTypes.FastModeDisabledReason;
};
declare type SDKControlPermissionRequest = {            // 4783-4831 (CLI -> SDK)
    subtype: 'can_use_tool';
    tool_name: string;
    mcp_server?: coreTypes.McpServerProvenance;
    input: Record<string, unknown>;
    permission_suggestions?: coreTypes.PermissionUpdate[];
    blocked_path?: string;
    decision_reason?: string;
    decision_reason_type?: 'rule' | 'mode' | 'subcommandResults' | 'permissionPromptTool' | 'hook' | 'asyncAgent' | 'sandboxOverride' | 'workingDir' | 'safetyCheck' | 'classifier' | 'other';
    classifier_approvable?: boolean;
    suppress_always_allow_rule?: boolean;
    default_to_no?: boolean;
    matched_ask_rule?: { source: string; tool_name: string; rule_content?: string; };
    title?: string; display_name?: string;
    tool_use_id: string;
    agent_id?: string;
    description?: string;
    requires_user_interaction?: boolean;
};
declare type SDKHookCallbackRequest = {                 // 5188-5195 (CLI -> SDK)
    subtype: 'hook_callback';
    callback_id: string;
    input: coreTypes.HookInput;
    tool_use_id?: string;
};
declare type SDKHookCallbackMatcher = {                 // 5176-5183 (inside initialize.hooks)
    matcher?: string;
    /** Opaque ids chosen by the client, one per hook function it registered for this matcher. When the hook fires the CLI sends a hook_callback control request carrying one of these ids as callback_id; the client maps it back to its function. */
    hookCallbackIds: string[];
    timeout?: number;
};
declare type SDKControlMcpMessageRequest = {            // 4702-4709 (both directions)
    subtype: 'mcp_message';
    server_name: string;
    /** A JSON-RPC 2.0 message as defined by the Model Context Protocol (request, notification, or response object). */
    message: JSONRPCMessage;
};
declare type SDKControlInterruptRequest = { subtype: 'interrupt'; cancel_queued?: boolean; };                     // 4599-4608 (SDK -> CLI)
export declare type SDKControlInterruptResponse = { still_queued: string[]; cancelled?: string[]; };             // 4613-4623
declare type SDKControlSetPermissionModeRequest = { subtype: 'set_permission_mode'; mode: coreTypes.PermissionMode; };  // 5088-5095
declare type SDKControlSetModelRequest = { subtype: 'set_model'; /** Omitted, null, or 'default' resets to the session default model. */ model?: string | null; };  // 5076-5083
declare type SDKControlMcpSetServersRequest = { subtype: 'mcp_set_servers'; servers: Record<string, coreTypes.McpServerConfigForProcessTransport>; };  // 4756-4762
declare type SDKControlElicitationRequest = { subtype: 'elicitation'; mcp_server_name: string; message: string; mode?: 'form' | 'url'; url?: string; elicitation_id?: string; requested_schema?: Record<string, unknown>; title?: string; display_name?: string; description?: string; };  // 3898-3918
```

The `can_use_tool` answer is the `PermissionResult` plus `toolUseID` (`return{...r,toolUseID:e.request.tool_use_id}` [sdk.mjs:138:633]):

```ts
export declare type PermissionResult = {
    behavior: 'allow'; updatedInput?: Record<string, unknown>; updatedPermissions?: PermissionUpdate[]; toolUseID?: string; decisionClassification?: PermissionDecisionClassification;
} | {
    behavior: 'deny'; message: string; interrupt?: boolean; toolUseID?: string; decisionClassification?: PermissionDecisionClassification;
};                                                                                   // sdk.d.ts:2507-2519
```

### 2.4 Dispatch, ordering and ids (source)

- The SDK reads stdout line by line, JSON-parses each line, and routes: `control_response` → the pending promise keyed by `response.request_id` (unmatched ones are kept, max 1024); `control_request` → `handleControlRequest`; `control_cancel_request` → abort the matching in-flight handler; `keep_alive` → ignored; `transcript_mirror` → session store; everything else is yielded to the consumer [sdk.mjs:136:113086].
- Handling a CLI request: `handleControlRequest` creates an `AbortController` per `request_id`, awaits `processControlRequest`, then writes `{type:"control_response",response:{subtype:"success",request_id,response:r}}` or `{subtype:"error",request_id,error}`; a `null` return from `canUseTool` (`Wl`, "suppressControlResponse") writes nothing [sdk.mjs:136:116379, 138:633]. Requests whose subtype is in `["remote_tool_call","remote_plumbing_call","remote_tools_probe","remote_tools_reannounce"]` are deliberately left unanswered [sdk.mjs:138:633, 136:108628].
- Sending a request: `request_id = Math.random().toString(36).substring(2,15)`; the frame is `{request_id, type:"control_request", request}` followed by `\n`; abort of the caller's signal writes `{type:"control_cancel_request",request_id}`; every request except the first `initialize` waits until `initialize` has been written [sdk.mjs:138:17000-139:296]. The CLI used a UUID as `request_id` for its own request in probe 2.
- Hook registration assigns one callback id per function and sends `{matcher, hookCallbackIds, timeout}` arrays under `initialize.hooks`; `hook_callback` requests are resolved by `this.hookCallbacks.get(callback_id)` and the handler's return value is the response [sdk.mjs:138:7137, 141:1443, 138:2265].

### 2.5 Verbatim frames recorded in probe 2

Timeline (ms from spawn, direction, frame):

```
    31 sdk->cli control_request subtype=initialize            684 B
    32 sdk->cli user                                           208 B
   770 cli->sdk control_response success (initialize)        19417 B
   806 cli->sdk system/session_state_changed state=running
   852 cli->sdk system/init
  1939 cli->sdk rate_limit_event
  4364 cli->sdk assistant (tool_use mcp__probe__ping)
  4376 cli->sdk control_request subtype=mcp_message tools/call
  4383 cli->sdk rate_limit_event
 12391 sdk->cli control_response success mcp_response          (handler blocked 8,000 ms)
 12405 cli->sdk user (tool_result)
 12417 cli->sdk result/error_max_turns
 12422 cli->sdk system/session_state_changed state=idle
 12422 sdk->cli <stdin EOF>
 13404 proc     <exit code=1>
```

Frames (whitespace unchanged except line breaks added by the recorder):

```json
{"request_id":"9act6r5ypdt","type":"control_request","request":{"subtype":"initialize","sdkMcpServers":["probe"],"sdkMcpServerManifests":{"probe":{"initializeResult":{"protocolVersion":"2025-11-25","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"probe","version":"1.0.0"}},"toolsListResult":{"tools":[{"name":"ping","description":"Returns pong after a delay. Call it exactly once.","inputSchema":{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"label":{"type":"string","description":"any short label"}},"required":["label"]},"execution":{"taskSupport":"forbidden"},"_meta":{"anthropic/alwaysLoad":true}}]}}},"systemPrompt":[""]}}
```
```json
{"type":"user","session_id":"","message":{"role":"user","content":[{"type":"text","text":"Call the ping tool once with label \"x\", then reply with exactly the text it returned."}]},"parent_tool_use_id":null}
```
```json
{"type":"system","subtype":"session_state_changed","state":"running","sdk_host_only":true,"uuid":"893a33ed-f1c9-4873-9415-b43a0a8c0c56","session_id":"910ec8c0-f168-4834-8192-bc85ba374b80"}
```
```json
{"type":"control_request","request_id":"1600753d-f947-4bf0-ba1c-208040a252ba","request":{"subtype":"mcp_message","server_name":"probe","message":{"method":"tools/call","params":{"name":"ping","arguments":{"label":"x"},"_meta":{"claudecode/toolUseId":"toolu_01YbjfAG22HazBbe32Y8Aahw","progressToken":2}},"jsonrpc":"2.0","id":2}}}
```
```json
{"type":"control_response","response":{"subtype":"success","request_id":"1600753d-f947-4bf0-ba1c-208040a252ba","response":{"mcp_response":{"result":{"content":[{"type":"text","text":"pong:x"}]},"jsonrpc":"2.0","id":2}}}}
```
```json
{"type":"user","message":{"role":"user","content":[{"tool_use_id":"toolu_01YbjfAG22HazBbe32Y8Aahw","type":"tool_result","content":[{"type":"text","text":"pong:x"}]}]},"parent_tool_use_id":null,"session_id":"910ec8c0-f168-4834-8192-bc85ba374b80","uuid":"89988983-fe12-47ca-ae62-39b342a12b7d","timestamp":"2026-10-04T10:13:55.133Z","tool_use_result":[{"type":"text","text":"pong:x"}]}
```
```json
{"type":"system","subtype":"session_state_changed","state":"idle","sdk_host_only":true,"uuid":"ffbcea10-aa5e-4e6c-81d6-4cdc2778eafa","session_id":"910ec8c0-f168-4834-8192-bc85ba374b80"}
```

The `result` frame (1,984 B) carried `"subtype":"error_max_turns"`, `"is_error":true`, `"num_turns":2`, `"stop_reason":"tool_use"`, `"errors":["Reached maximum number of turns (1)"]`, `"terminal_reason":"max_turns"`, `"queued_turn_count":0`, `"result_index":0`, `usage`, `modelUsage` (per model, with `webSearchRequests`, `costUSD`, `contextWindow`, `provider:"firstParty"`), `permission_denials:[]`, `total_cost_usd`, `duration_ms`, `duration_api_ms` [probe2]. `system/init` carried `"tools":["mcp__probe__ping"]` and `"mcp_servers":[{"name":"probe","status":"connected","source":"sdk"}]` [probe2].

### 2.6 Can a tool handler block arbitrarily long?

- SDK side: no timer. `processControlRequest` simply `await`s the handler (`await this.canUseTool(...)`, `await this.handleHookCallbacks(...)`, `await this.handleMcpControlRequest(...)`) [sdk.mjs:138:633, 138:2265, 138:2410]; the only interruption is a `control_cancel_request` from the CLI aborting the per-request `AbortController` [sdk.mjs:136:116379].
- CLI side, MCP tool calls: the per-call limit is the per-server `timeout` (≥ 1000 ms) else `MCP_TOOL_TIMEOUT` else a default. The installed 2.1.284 binary contains `var lr=1e8` and `function Ro(e){let n=(e?.timeout!==void 0&&e.timeout>=1000?e.timeout:void 0)??a.MCP_TOOL_TIMEOUT??lr;return Math.min(Math.max(n,1000),Sm)}` [cli-bin, offsets 231404178 and 231405297], i.e. a default of 100,000,000 ms (about 27.8 hours) clamped below by 1000 ms and above by `Sm`, a constant imported from another bundle chunk whose value this research did not resolve. The MCP doc agrees with the binary: "Values below 1000 are ignored and fall through to `MCP_TOOL_TIMEOUT`, or to its default of about 28 hours when that variable is unset." [mcp]. The env-vars page disagrees: "`MCP_TOOL_TIMEOUT` | Timeout in milliseconds for MCP tool calls (default: 600000, or 10 minutes)" [env-vars]. The binary also has a per-tool idle timer that is **disabled for sdk-type servers**: `hr=new Set(["sse-ide","ws-ide","sdk"]);function gr(e){let r=e?.type??"stdio";if(hr.has(r))return 0;let n=a.CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT??(r==="stdio"?fr:mr);...}` with `mr=300000, fr=1800000` [cli-bin, offset 231405297]. "Stdio and WebSocket servers have no per-request timer." [mcp]
- CLI side, `canUseTool`: "The callback can stay pending indefinitely. Execution remains paused until your callback returns." [user-input]; "permission prompts don't time out" [ts-ref]; "permission prompts have no park deadline" [sdk.d.ts:206-210]. A `Notification` hook with type `permission_prompt` fires "once a permission request has waited about six seconds on your `canUseTool` callback" [hooks].
- CLI side, hooks: "Claude Code runs each callback with a timeout, which you set in seconds with the `timeout` field on its `HookMatcher`. When you don't set one, Claude Code uses the event's default: 600 seconds for most events, 30 seconds for `UserPromptSubmit`, `PreModelSwitch`, and `PostModelSwitch`, and 10 seconds for `MessageDisplay`." On `PreToolUse` timeout "Claude Code doesn't run the tool call, Claude receives a tool result stating the hook didn't respond before its timeout, and the turn continues." [hooks, "Hook timeout"]
- Run-level: "No top-level session timeout | A session does not time out on its own. Set `maxTurns` ... to bound how many tool-use round trips the agent takes before stopping." [hosting, "Known limitations"]
- Observed: an 8,000 ms block was waited out with no warning or timeout [probe2]. Longer blocks were not probed.

## 3. Streaming input mode

"The Claude Agent SDK supports two distinct input modes ... Streaming Input Mode: a persistent, interactive session; Single Message Input: one-shot queries that use session state and resuming." "It allows the agent to operate as a long lived process that takes in user input, handles interruptions, surfaces permission requests, and handles session management." Benefits listed: image uploads, "Queued messages: send multiple messages that process sequentially, with ability to interrupt", tool integration, real-time feedback, context persistence. Single message input "does **not** support: Direct image attachments in messages, Dynamic message queueing, Real-time interruption, Natural multi-turn conversations" [streaming]. `interrupt()`, `setPermissionMode()`, `setModel()`, `applyFlagSettings()` are "only available in streaming input mode" [ts-ref].

**Both modes use the same CLI flags** (`--input-format stream-json` is always passed, section 1). The difference is what the SDK writes to stdin and when it closes it [sdk.mjs:143:34, function `Kx`]:

- `prompt: string` → one line `{"type":"user","session_id":"","message":{"role":"user","content":[{"type":"text","text":<prompt>}]},"parent_tool_use_id":null}` written after `initialize` (verbatim in section 2.5), and `isSingleUserTurn = true`.
- `prompt: AsyncIterable<SDKUserMessage>` → `streamInput(prompt)`.

`streamInput` [sdk.mjs:140:4544 to 141:252]: waits until `initialize` has been written; for each message from the iterable it resets `runEnded`/`resultReceived`, clears the run-end ceiling, and writes the message as one JSON line (adding `client_composed: true` when `verbatimPrompts`). When the iterable finishes: `if(t>0&&this.hasBidirectionalNeeds()) await this.waitForRunEnd(); ... this.transport.endInput()` — stdin is closed only after the iterable is exhausted and, if the host has callbacks, after the current run ends. `hasBidirectionalNeeds()` is `this.sdkMcpServers.size>0||this.hooks!==void 0&&Object.keys(this.hooks).length>0||this.canUseTool!==void 0||this.onElicitation!==void 0||this.onUserDialog!==void 0||this.getOAuthToken!==void 0||this.getHostAuthToken!==void 0||this.workSecretAnswerer!==void 0` [sdk.mjs:136:109523]. So a string prompt with `canUseTool`, hooks or in-process servers still keeps stdin open until the run ends, which is why the TypeScript `user-input` examples use a plain string prompt with `canUseTool` [user-input]; the Python SDK needs the documented "dummy hook keeps the stream open for can_use_tool" workaround [user-input].

**Idling between messages.** With stdin open the CLI waits: "In single-prompt (non-streaming-input) mode the process exits after the turn." [sdk.d.ts:5727]; "The CLI emits exactly one result message per turn, after that turn's assistant, user and stream_event messages; treat it as the turn-complete signal" [sdk.d.ts:5727]. The CLI reports `{"type":"system","subtype":"session_state_changed","state":"idle"|"running"|"requires_action","sdk_host_only":true,...}` [sdk.d.ts:5861-5867; probe2]. Run-end logic in the SDK: on `result`, `if(this.sessionState===void 0||this.sessionState==="idle"||!this.hasBidirectionalNeeds())this.endRun();else this.armRunEndCeiling()`; on `session_state_changed` `idle` after a result, `endRun()`; the ceiling is `Vh=600000` ms by default and logs "No 'idle' ${ms}ms after the last result, ending the run" [sdk.mjs:136:114513, 136:107773, 141:310]. For `isSingleUserTurn`, `endRun()` closes stdin [sdk.mjs:141:252]. For long-running sessions the docs say: "use `streamInput()` to add turns to an active session. Call `startup()` to pre-warm subprocesses ahead of incoming traffic." [hosting, "Long-running sessions"]. Messages sent during a running turn carry `priority?: 'now' | 'next' | 'later'`, `shouldQuery?: boolean` ("set it to `false` to append the message to the transcript without triggering an assistant turn"), `client_composed?: true` [ts-ref; sdk.d.ts:6224-6237]; a result reports `queued_turn_count` [sdk.d.ts:5797]. Costs on results are "cumulative across turns in streaming-input sessions — each result carries the running total so far" [sdk.d.ts:5781].

**Ending a run.** Normal: the iterable returns → stdin EOF → the CLI finishes and exits (probe 2: EOF at 12,422 ms, exit at 13,404 ms). Forced: `close()` — "This forcefully ends the query, cleaning up all resources including pending requests, MCP transports, and the CLI subprocess." [sdk.d.ts:3237-3243]; or `abortController.abort()`. The graceful path is stdin EOF then ~2 s grace before the forwarded signal kills the child [sdk.d.ts:9505-9506]. On SIGTERM the CLI "exits with code 143 ... leaves the turn that was in progress unfinished and records no result for it. To end the turn instead, send SIGINT, or call the Agent SDK's `interrupt()`" and "If your program closes the session through the Agent SDK, the SDK ends Claude Code's input before sending any signal, and Claude Code cancels the prompt as soon as the input ends." [headless]. Background subagents can keep a `-p` run open up to `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` (default 600,000 ms) [headless; env-vars].

## 4. `canUseTool` and hooks: intercepting built-in tools

**Evaluation order** ("When Claude requests a tool, the SDK checks permissions in this order"): 1 Hooks ("A hook can deny the call outright or pass it on. A hook that returns `allow` does not skip the deny and ask rules below"), 2 Deny rules, 3 Ask rules ("falls through to your `canUseTool` callback"), 4 Permission mode, 5 Allow rules ("A call the tool approves on its own is resolved at this step too, with no rule needed: for example a file read inside your working directories or a read-only Bash command"), 6 `canUseTool` callback ("If not resolved by any of the above ... In `dontAsk` mode, this step is skipped and the tool is denied.") [permissions]. "**The callback never fires for auto-approved tools.** ... For logic that must apply to every tool call, use a `PreToolUse` hook, which executes before the rest of the flow and can allow, deny, or modify requests." [user-input]. `permissionPrompts: 'none'`: "your callback isn't called at this step. A `PermissionRequest` hook still gets a chance to decide, and if it doesn't, Claude Code denies the call. The option requires Claude Code v2.1.259 or later." [permissions]

**Before execution, with input.** `PreToolUse` hook input: `{ hook_event_name: 'PreToolUse'; tool_name: string; tool_input: unknown; tool_use_id: string; mcp_server?: McpServerProvenance }` plus `session_id`, `cwd` [sdk.d.ts:2740-2746; hooks]. Output: `hookSpecificOutput: { hookEventName: 'PreToolUse'; permissionDecision?: 'allow'|'deny'|'ask'|'defer'; permissionDecisionReason?: string; updatedInput?: Record<string, unknown>; additionalContext?: string }` [sdk.d.ts:2748-2754; hooks]. "If you return `"defer"`, the turn ends with a result message whose `stop_reason` is `"tool_deferred"`, so you can resume the call later" [hooks]. Matchers match tool names: "Built-in tools include `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebFetch`, `Agent`, and others"; "MCP tools use the pattern `mcp__<server>__<action>`" [hooks]. `canUseTool` also receives the full `input` but only when the flow reaches a prompt (above).

**After execution, with result.** `PostToolUse` input: `{ hook_event_name: 'PostToolUse'; tool_name; tool_input; tool_response: unknown; tool_use_id; duration_ms?; mcp_server? }` [sdk.d.ts:2657-2668]. Output: `additionalContext`, `updatedToolOutput` ("Replaces the tool output before it is sent to the model"), `classifierContext` [sdk.d.ts:2670-2685; hooks]. `PostToolUseFailure` exists for failures [hooks].

**Without hooks**, the message stream already shows every built-in tool call and result: `assistant` messages carry `tool_use` blocks in `message.content` (a `BetaMessage`), and `user` messages carry `tool_result` blocks plus `tool_use_result?: unknown` — "the tool's full Output object, not the string content sent to the model" [sdk.d.ts:6224-6235; ts-ref]. The probe-2 `user` frame above is one such message. WebSearch and WebFetch have one quirk: "A call that stepped aside for a message the user sent (today a WebFetch or WebSearch call) carries `{ detachedToolCall: true }` in place of its Output: the call is still running, and its result reaches the model in a later turn." [sdk.d.ts:6233]. Result `usage` includes `server_tool_use: { web_search_requests, web_fetch_requests }` and `modelUsage[model].webSearchRequests` [probe1, probe2].

**Hook limits.** "Hooks may not fire when the agent hits the `max_turns` limit because the session ends before hooks can execute" [hooks]. Timeouts as in section 2.6. "When an event fires, all matching hooks run in parallel. For permission decisions, the most restrictive result applies" [hooks]. All `HookEvent` values: `'PreToolUse' | 'PostToolUse' | 'PostToolUseFailure' | 'PostToolBatch' | 'Notification' | 'UserPromptSubmit' | 'UserPromptExpansion' | 'SessionStart' | 'SessionEnd' | 'Stop' | 'StopFailure' | 'SubagentStart' | 'SubagentStop' | 'PreCompact' | 'PostCompact' | 'PreModelSwitch' | 'PostModelSwitch' | 'PermissionRequest' | 'PermissionDenied' | 'Setup' | 'TeammateIdle' | 'TaskCreated' | 'TaskCompleted' | 'Elicitation' | 'ElicitationResult' | 'ConfigChange' | 'WorktreeCreate' | 'WorktreeRemove' | 'InstructionsLoaded' | 'CwdChanged' | 'FileChanged' | 'DirectoryAdded' | 'MessageDisplay'` [sdk.d.ts:978].

## 5. Sessions

Options and the flags they become:

| Option | Doc comment (sdk.d.ts) | Flag (sdk.mjs) |
| - | - | - |
| `resume?: string` | "Session ID to resume. Loads the conversation history from the specified session." (2084-2087) | `--resume=<id>` (136:96626) |
| `continue?: boolean` | "Continue the most recent conversation in the current directory instead of starting a new one. Mutually exclusive with `resume`." (1591-1594) | `--continue` (136:96626) |
| `forkSession?: boolean` | "When true, resumed sessions will fork to a new session ID rather than continuing the previous session. Use with `resume`." (1706-1709) | `--fork-session` (136:97666) |
| `persistSession?: boolean` (default true) | ts-ref: "When `false`, disables session persistence to disk. Sessions cannot be resumed later" | `--no-session-persistence` (136:98434) |
| `sessionId?: string` | "Use a specific session ID for the conversation instead of an auto-generated one. Must be a valid UUID. Cannot be used with `continue` or `resume` unless `forkSession` is also set" (2089-2093) | `--session-id=<uuid>` (136:98434) |
| `resumeSessionAt?: string` | "When resuming, only resume messages up to and including the message with this UUID." (2095-2101) | `--resume-session-at=` (136:97666) |

CLI help for the same flags: `--fork-session  When resuming, create a new session ID instead of reusing the original (use with --resume or --continue)`; `--no-session-persistence  Disable session persistence - sessions will not be saved to disk and cannot be resumed (only works with --print)`; `-r, --resume [value]  Resume a conversation by session ID, or open interactive picker with optional search term`; `--session-id <uuid>  Use a specific session ID for the conversation (must be a valid UUID)` [cli-help].

Session id: "Read it from the `session_id` field on the result message ... In TypeScript the ID is also available earlier as a direct field on the init `SystemMessage`" [sessions]; every stream message carries `session_id` (section 2.5). Storage: "Claude Code stores sessions under `~/.claude/projects/<encoded-cwd>/*.jsonl`. If you set the `CLAUDE_CONFIG_DIR` environment variable, look under `$CLAUDE_CONFIG_DIR/projects/` instead." Encoding: "replace every non-alphanumeric character in the absolute working directory with `-`" [sessions]. "You can resume from any working directory ... Same machine only ... Before v2.1.223, the lookup was scoped to the current project directory and its git worktrees" [sessions]. `--resume` also accepts "the absolute path to a session's `.jsonl` transcript file" [headless]. Fork: "creates a new session that starts with a copy of the original's history but diverges from that point. The fork gets its own session ID; the original's ID and history stay unchanged." [sessions]. Continue vs resume: "Continue finds the most recent session in the current directory ... Resume takes a specific session ID." [sessions]. Resumed runs report cumulative cost "a resumed or forked session continues from the total its transcript saved" [sdk.d.ts:5781]. Cross-host: `sessionStore` adapter mirrors transcripts; "Mirror, not replacement" [hosting]. Helper functions: `listSessions()`, `getSessionMessages()`, `getSessionInfo()`, `renameSession()`, `tagSession()` [sessions]. In single-message mode "`continue: true` resumes the most recent session" and "The experimental V2 session API ... was removed in TypeScript Agent SDK 0.3.142" [sessions].

## 6. Auth

**What the SDK does.** Nothing credential-specific: it forwards `env` (default `{...process.env}`) and sets no credential variable (section 1). Credential selection happens in the CLI by its documented precedence: "1. Cloud provider credentials ... 2. `ANTHROPIC_AUTH_TOKEN` ... 3. `ANTHROPIC_API_KEY` environment variable. Sent as the `X-Api-Key` header ... In non-interactive mode (`-p`), the key is always used when present. 4. `apiKeyHelper` script output ... 5. `CLAUDE_CODE_OAUTH_TOKEN` environment variable. A long-lived OAuth token generated by `claude setup-token` ... 6. Anthropic profile and federation credentials ... 7. Subscription OAuth credentials from `/login`. This is the default for Claude Pro, Max, Team, and Enterprise users." [auth, "Authentication precedence"]. "`apiKeyHelper`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_AUTH_TOKEN` apply to the CLI and the surfaces that wrap it, including the VS Code extension, the Agent SDK, and GitHub Actions." [auth]. Credentials live in "`~/.claude/.credentials.json` with file mode `0600`" on Linux [auth, "Credential management"]. `init.apiKeySource` reports `'ANTHROPIC_API_KEY' | 'apiKeyHelper' | '/login managed key' | 'none'`, where `'none'` means "no API key in use - e.g. claude.ai OAuth login, a bearer token, or a third-party cloud provider" [sdk.d.ts:5914, 131]. `accountInfo()` returns `{ email?, organization?, subscriptionType?, tokenSource?, apiKeySource?, apiProvider? }` [sdk.d.ts:23-33].

**Observed.** With no credential variables in the environment and a `claudeAiOauth` entry in `~/.claude/.credentials.json`, the SDK-driven run reported `apiKeySource: "none"`, emitted `rate_limit_event` frames ("Rate limit information for claude.ai subscription users" [sdk.d.ts:5636]) with `rateLimitType: "five_hour"` and `unifiedWindows.five_hour/seven_day` utilisation, and completed. The SDK therefore picked up the CLI's existing subscription login [probe1, probe2]. `total_cost_usd` was still populated; the docs call it "An estimate, not a billing statement" [sdk.d.ts:5781].

**What the SDK docs say about credentials.** Quickstart prerequisites: "An **Anthropic account**"; step "Set your API key": "Get an API key from the Claude Console, then set it as an environment variable ... The SDK reads the key from the environment of the process that runs your agent; it doesn't load `.env` files automatically." Also Bedrock/Vertex/Foundry/Claude Platform on AWS via `CLAUDE_CODE_USE_*` variables [quickstart]. Hosting: "the subprocess reads `ANTHROPIC_API_KEY` from its environment. Supply it from your secret manager, or set `ANTHROPIC_BASE_URL` to route model calls through a proxy that injects the key outside the container." [hosting]. The Note that appears on both the overview and the quickstart: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods described in the Quickstart instead." [overview; quickstart]. `CLAUDE_CODE_OAUTH_TOKEN`: "OAuth access token for claude.ai authentication. Alternative to `/login` for SDK and automated environments. Takes precedence over keychain-stored credentials." [env-vars]; "This token authenticates with your Claude subscription and requires a Pro, Max, Team, or Enterprise plan. It can only make model requests" [auth]. `ANTHROPIC_API_KEY`: "When set, this key is used instead of your Claude Pro, Max, Team, or Enterprise subscription even if you are logged in. In non-interactive mode (`-p`), the key is always used when present." [env-vars]. Bare mode: "In bare mode, Claude Code never reads OAuth credentials or the system keychain." and "`--bare` is the recommended mode for scripted and SDK calls, and will become the default for `-p` in a future release." [headless].

**Terms and policy statements that bear on a subscription login driven by another program.**

- Overview, "License and terms": "Use of the Claude Agent SDK is governed by Anthropic's Commercial Terms of Service, including when you use it to power products and services that you make available to your own customers and end users" [overview]. The package `LICENSE.md` reads: "© Anthropic PBC. All rights reserved. Use is subject to the Legal Agreements outlined here: https://code.claude.com/docs/en/legal-and-compliance." [license].
- Legal and compliance, "License": "Your use of Claude Code is subject to: Commercial Terms of Service - for Team, Enterprise, and Claude API users; Consumer Terms of Service - for Free, Pro, and Max users" [legal].
- Legal and compliance, "Can customers offer Claude Code in their products?": "Unless we've mutually agreed otherwise, preinstalling or running Claude Code in your products or services (e.g. in hosted sandboxes or other agent infrastructure) requires agreeing to our Commercial Terms of Service and complying with the conditions below: **The Claude Code binary must not be modified.** Claude Code must be installed and run as published by Anthropic, and customers may not remove, disable, or restrict any authentication method built into it (including methods that permit signing in with a Claude account or the user's own API key). **Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf.** Each end user must authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider credential" [legal].
- Legal and compliance, "Authentication and credential use": "**OAuth authentication** is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications." "**Developers** building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider. Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens — sign-in to a Claude account must complete through Anthropic's own flow." "This does not restrict how customers provision and manage their own API keys ... Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code as described under *Can customers offer Claude Code in their products?* above." "Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice." [legal]
- Legal and compliance, "Acceptable use": "Claude Code usage is subject to the Anthropic Usage Policy. Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK." [legal]
- Consumer Terms (effective October 8, 2025), Section 3 "Use of our Services", among the things you may not do: "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise." and "To develop any products or services that compete with our Services, including to develop or train any artificial intelligence or machine learning algorithms or models or resell the Services." The opening note: "Our Commercial Terms of Service govern your use of any Anthropic API key, the Anthropic Console, or any other Anthropic offerings that reference the Commercial Terms. For clarity, this does not include Claude.ai or Claude Pro use for individuals or entities." Claude Code and the Agent SDK are not named in the Consumer Terms [consumer-terms].
- Support article "Use the Claude Agent SDK with your Claude plan": "**Update June 15:** We're pausing the changes to Claude Agent SDK usage described below. For now, nothing has changed: Claude Agent SDK, `claude -p`, and third-party app usage still draw from your subscription's usage limits." The paused plan would have covered "Claude Agent SDK usage in your own projects (Python or TypeScript)", "The `claude -p` command in Claude Code (non-interactive mode)", and "Third-party apps that authenticate with your Claude subscription through the Agent SDK", and said "Teams running shared production automation should use Claude Platform with an API key" [support-plan].

## 7. Partial messages

`includePartialMessages?: boolean` — "Include partial/streaming message events in the output. When true, `SDKPartialAssistantMessage` events will be emitted during streaming." [sdk.d.ts:1859-1862]; it becomes `--include-partial-messages` [sdk.mjs:136:97666]. CLI help: `--include-partial-messages  Include partial message chunks as they arrive (only works with --print and --output-format=stream-json)` [cli-help]. The message type:

```ts
export declare type SDKPartialAssistantMessage = {
    type: 'stream_event';
    /** One Anthropic Messages API streaming event (message_start, content_block_start, content_block_delta, content_block_stop, message_delta, message_stop) as defined for the streaming Messages API. */
    event: BetaRawMessageStreamEvent;
    parent_tool_use_id: string | null;
    uuid: UUID;
    session_id: string;
    ttft_ms?: number;
    user_message_uuid?: string;
    user_message_uuids?: string[];
    resume_reason?: string;
};                                                                                   // sdk.d.ts:5482-5505
```

So yes: the raw API `stream_event`s are exposed, each wrapped with `parent_tool_use_id`, `uuid`, `session_id`. The headless docs show the same frames from the CLI and filter them with `jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'` [headless]. The complete `assistant` message that follows carries `message: BetaMessage` ("It includes fields like `id`, `content`, `model`, `stop_reason`, and `usage`" [ts-ref]); in probe 1 the `assistant` frame had `"stop_reason":null` while the `result` frame had `"stop_reason":"end_turn"` [probe1]. An interrupted assistant message carries `aborted: true` and "has no `stop_reason`" [ts-ref]. If the consumer reads slowly, "Claude Code waits for the queued output to drain before exiting, scaling the wait with how much is still queued, capped at 30 seconds" [headless].

## 8. Costs of adoption

- **Package.** `@anthropic-ai/claude-agent-sdk@0.3.289`, `"type": "module"`, `"main": "sdk.mjs"`, `"types": "sdk.d.ts"`; `exports` offers only `.mjs`/`.js` default entries (`.`, `./core`, `./extract`, `./browser`, `./bridge`) [pkg]. On disk: 5.3 MB (`sdk.mjs` 1,214,390 B; `sdk.d.ts` 529,139 B; `bridge.mjs` 1,315,383 B; `browser-sdk.js` 1,405,276 B; `sdk-tools.d.ts` 167,726 B) [ls]. `"engines": { "node": ">=18.0.0" }` [pkg]; README badge "Node.js 18+" [readme]; "Node.js 18+ for the TypeScript SDK" [hosting]. The `/core` entry "does **not** inline the SDK's peer dependencies" and "Import from **either** the root **or** `/core` in a given process, not both" [readme].
- **Peer dependencies** (npm installed them automatically): `@anthropic-ai/sdk >=0.93.0` (got 0.131.0, 18 MB), `@modelcontextprotocol/sdk ^1.29.0` (got 1.32.0, 6.2 MB), `zod ^4.0.0` (got 4.6.5, 8.1 MB) [pkg; ls]. A fresh `npm install` produced a 287 MB `node_modules`, of which the native binary package is 235 MB (246,107,320 B) [ls; native-pkg].
- **CLI pinning.** Exact-version optional dependencies (`0.3.289`) and `claudeCodeVersion: "2.1.289"` [pkg]; `manifest.json` `version: "2.1.289"` with `sdkCompat.testedWrapperVersions` 0.3.250 to 0.3.285 [manifest]. "The SDK follows semver: take patch releases continuously and review the TypeScript ... changelog before taking a minor." [hosting]. Docs gate many behaviours on CLI versions, for example `requestId`/`null` return from `canUseTool` "require Claude Code v2.1.199 or later", `permissionPrompts` "requires Claude Code v2.1.259 or later", `reinitialize()` "Requires Claude Code v2.1.195 or later", `interrupt_receipt_v1` since v2.1.205 [ts-ref; permissions].
- **Coexistence with the mise-installed CLI.** `pathToClaudeCodeExecutable` pointed the SDK at `~/.local/share/mise/installs/claude/latest/claude` (2.1.284, 243,059,896 B) and both probes completed under SDK 0.3.289 [probe1, probe2]. The bundled 2.1.289 binary stays in `node_modules` unused in that configuration. `init.capabilities` lets the host feature-detect the CLI it is given ("Protocol capabilities this CLI supports, so SDK consumers can feature-detect instead of version-sniffing" [sdk.d.ts:5978]); 2.1.284 advertised `interrupt_receipt_v1, interrupt_cancel_queued_v1, msg_lifecycle_v1, mcp_read_resource_v1, mcp_tool_ui_meta_v1` [probe1].
- **Runtime footprint.** "1 GiB RAM, 5 GiB disk, and 1 CPU per agent is a reasonable starting point ... Memory usage grows with session length and tool activity" [hosting]; a parked pre-warmed process "holds roughly 230–260 MB and is otherwise idle" [sdk.d.ts:2771]. "Each session runs in its own subprocess, so concurrency on a host is bounded by how many subprocesses its RAM can hold." [hosting]
- **Telemetry.** The README states: "When you use the Claude Agent SDK, we collect feedback, which includes usage data (such as code acceptance or rejections), associated conversation data, and user feedback submitted via the /bug command." [readme]. `DISABLE_TELEMETRY`: "Set to any non-empty value to disable telemetry" [env-vars].
- **Machine.** Node v24.21.0, npm 11.19.0 were used for the install.

## Implications for the tool bridge

Facts bearing on the three questions, with the sources above.

**Can an in-process SDK tool handler block for an HTTP round trip to the client and back (minutes)?**

- The SDK imposes no deadline on a handler (section 2.6, sdk.mjs:138:2410). The CLI's per-call limit for an sdk-type server is the `timeout` given to `createSdkMcpServer` (any value ≥ 1000 ms), else `MCP_TOOL_TIMEOUT`, else the default, which in the installed 2.1.284 binary is `1e8` ms (~27.8 h) clamped by an unresolved constant `Sm` [cli-bin], and which the MCP doc also states as "about 28 hours" [mcp] while the env-vars page states 10 minutes [env-vars]. The per-tool idle timer is 0 for sdk-type servers [cli-bin]. The run itself has "No top-level session timeout" [hosting]. The 8 s block in probe 2 was waited out silently [probe2]. A bridge that passes an explicit `timeout` on the server does not depend on which documented default is right.
- The alternative interception points have their own clocks: `canUseTool` has none ("permission prompts have no park deadline" [sdk.d.ts:210]) but is only reached when the permission flow falls through to a prompt [permissions], and it answers with allow/deny (optionally `updatedInput`), not with a tool result; a `PreToolUse` hook defaults to 600 s and on expiry the tool is not run and Claude receives a tool result saying so [hooks]; a `PreToolUse` `defer` decision ends the turn with `stop_reason: "tool_deferred"` for later resumption from the persisted session [hooks].
- A tool call reaches the host as a `control_request` carrying the MCP `tools/call` with `_meta["claudecode/toolUseId"]` equal to the `tool_use` block id (`toolu_...`) from the preceding `assistant` message [probe2], so a bridge can correlate the Messages-API `tool_use.id` the client sees with the pending control request.

**Can the host see built-in tool calls and results (for example WebSearch)?**

- Yes, three ways, all documented: the message stream (`assistant` with `tool_use` blocks; `user` with `tool_result` blocks and `tool_use_result`, the tool's full Output object) [sdk.d.ts:6224-6235; probe2]; `PreToolUse`/`PostToolUse` hooks with `tool_input` and `tool_response`, which can also rewrite input (`updatedInput`) and output (`updatedToolOutput`) and run "before every other step" [sdk.d.ts:2740-2685; permissions]; and `canUseTool`, only for calls that would prompt [user-input]. `WebSearch`/`WebFetch` may be reported as `{ detachedToolCall: true }` when the call steps aside for a queued user message, with the result arriving in a later turn [sdk.d.ts:6233]. Result `usage.server_tool_use.web_search_requests` and `modelUsage[].webSearchRequests` count searches [probe1].

**Can a run be held open between user messages?**

- Yes, in streaming input mode: while the host's `AsyncIterable` has not returned, stdin stays open and the CLI idles after each turn, signalling `session_state_changed` `idle` and emitting exactly one `result` per turn [sdk.d.ts:5727, 5861-5867; sdk.mjs:140:4544-141:252]; `streamInput()` adds turns to the running process [hosting]. The SDK only closes stdin when the iterable ends (after the current run ends if it has callbacks or in-process servers), on `close()`, or on abort; the CLI exits about one second after EOF in the probe [probe2; sdk.d.ts:9505]. Each held run is one subprocess of roughly 230 MB idle [sdk.d.ts:2771], and hosting guidance is to pin a session to one container/process ("consistent hashing on `sessionId`") [hosting]. The alternative to holding a process is `resume` by session id in a new run, which continues cost totals and conversation history [sessions; sdk.d.ts:5781].

## Not determined

- The numeric value of `Sm`, the upper clamp on the MCP tool-call timeout in the CLI binary (imported from another bundle chunk).
- Which `MCP_TOOL_TIMEOUT` default statement is current: 600,000 ms [env-vars] or `1e8` ms [mcp; cli-bin for 2.1.284]. The bundled 2.1.289 binary was not inspected for this constant.
- Behaviour for handler blocks longer than the 8 s probed.
- Why the CLI accepts `--input-format stream-json` without `-p` (the SDK never passes `--print`; the help text says the flag "only works with --print").
