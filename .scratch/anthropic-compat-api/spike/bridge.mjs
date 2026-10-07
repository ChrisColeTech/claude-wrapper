// PROTOTYPE, THROWAWAY. Wayfinder ticket 06 (spike: client tool round trip).
//
// The one piece of this spike worth lifting later: a pure tool-bridge state
// machine. No I/O, no process, no DOM. The harness (spike.mjs) feeds it the
// frames it sees from upstream and the results it gets from the simulated
// client; the machine decides when the surface may end the turn with
// `stop_reason: tool_use` ("park") and when the run may continue.
//
// Vocabulary (GLOSSARY.md): upstream = the Claude Code CLI run; client tool =
// a tool the HTTP client defines and executes; tool bridge = how a client tool
// call inside the run reaches the client and its result comes back.
//
// Two facts from the live runs shape this machine:
//  1. Upstream executes the tool_use blocks of one assistant message ONE AT A
//     TIME: the MCP tools/call for block 2 is not issued until block 1's
//     handler returns. So the surface must park as soon as the assistant
//     message is complete (message_delta stop_reason=tool_use), not wait for
//     every handler to register, and it must keep results the client delivers
//     for calls upstream has not asked for yet ("pre-delivered").
//  2. The tools/call can in principle arrive before the assistant frame that
//     names its tool_use id (claudegate's race), so a handler may register for
//     an id that is not announced yet; it is simply held until the client
//     answers.

export function createBridge({ prefix, now = () => Date.now() } = {}) {
  if (!prefix) throw new Error('prefix required, e.g. "mcp__spike__"');

  const state = {
    phase: 'idle',            // idle | running | parked | abandoned | done
    assistantMessageDone: false,
    announced: new Map(),     // tool_use id -> { name, input, at }        (from assistant frames)
    pending: new Map(),       // tool_use id -> { name, args, at, settle } (handler waiting on the client)
    predelivered: new Map(),  // tool_use id -> { content, isError }      (client answered before upstream asked)
    delivered: new Set(),     // ids the client has answered this park
    history: [],              // { id, at, latencyFromParkMs }
    events: [],               // ordered trace for display
  };

  const trace = (kind, detail = {}) => state.events.push({ at: now(), kind, ...detail });
  const isClientTool = (upstreamName) => upstreamName.startsWith(prefix);
  const clientName = (upstreamName) => upstreamName.slice(prefix.length);
  const lastParkAt = () => state.events.findLast((e) => e.kind === 'park')?.at;

  // Park when upstream has finished the assistant message and it announced at
  // least one client tool_use. Built-in tools (WebSearch, ...) never register
  // here, so they never cause a park: the run just continues through them.
  function maybePark() {
    if (state.phase !== 'running' || !state.assistantMessageDone || state.announced.size === 0) return null;
    state.phase = 'parked';
    const toolUses = [...state.announced.entries()].map(([id, a]) => ({ id, name: a.name, input: a.input }));
    trace('park', { toolUses });
    return toolUses;
  }

  // Resume once every announced call has a client answer (delivered to a
  // waiting handler or parked as pre-delivered for a handler still to come).
  function maybeResume() {
    if (state.phase !== 'parked') return null;
    for (const id of state.announced.keys()) if (!state.delivered.has(id)) return null;
    state.phase = 'running';
    state.assistantMessageDone = false;
    state.announced.clear();
    state.delivered.clear();
    trace('resumed');
    return 'resumed';
  }

  return {
    state,
    isClientTool,
    clientName,

    turnStarted() { state.phase = 'running'; state.assistantMessageDone = false; trace('turn_started'); },

    // An `assistant` frame carried a tool_use block.
    assistantToolUse({ id, name, input }) {
      if (!isClientTool(name)) { trace('builtin_tool_use', { id, name }); return { kind: 'builtin' }; }
      state.announced.set(id, { name: clientName(name), input, at: now() });
      trace('client_tool_use_announced', { id, name: clientName(name) });
      return { kind: 'client', park: maybePark() };
    },

    // message_delta with stop_reason tool_use (or message_stop) for the
    // assistant message that holds the tool_use blocks.
    assistantMessageComplete({ stopReason } = {}) {
      state.assistantMessageDone = true;
      trace('assistant_message_complete', { stopReason });
      return { park: maybePark() };
    },

    // Upstream invoked the MCP handler for a client tool. Returns a promise the
    // handler must await. Settles at once if the client already answered.
    mcpCall({ toolUseId, name, args }) {
      const early = !state.announced.has(toolUseId) && !state.predelivered.has(toolUseId);
      const pre = state.predelivered.get(toolUseId);
      if (pre) {
        state.predelivered.delete(toolUseId);
        trace('mcp_call_served_from_predelivered', { toolUseId, name });
        return { promise: Promise.resolve(pre), early: false, servedFromPredelivered: true, park: null };
      }
      let settle;
      const promise = new Promise((resolve, reject) => { settle = { resolve, reject }; });
      state.pending.set(toolUseId, { name, args, at: now(), settle });
      trace('mcp_call_registered', { toolUseId, name, early });
      return { promise, early, servedFromPredelivered: false, park: maybePark() };
    },

    // The client's next turn carried a tool_result for this id.
    clientResult({ toolUseId, content, isError = false }) {
      const result = { content, isError };
      const p = state.pending.get(toolUseId);
      if (p) {
        state.pending.delete(toolUseId);
        p.settle.resolve(result);
        trace('client_result_delivered_to_waiting_handler', { toolUseId, isError });
      } else if (state.announced.has(toolUseId)) {
        state.predelivered.set(toolUseId, result);
        trace('client_result_predelivered', { toolUseId, isError });
      } else {
        trace('client_result_unknown', { toolUseId });
        return { status: 'unknown_tool_use_id' };
      }
      state.delivered.add(toolUseId);
      state.history.push({ id: toolUseId, at: now(), latencyFromParkMs: now() - (lastParkAt() ?? now()) });
      const resumed = maybeResume();
      return resumed ? { status: 'resumed' } : { status: 'partial', stillMissing: [...state.announced.keys()].filter((id) => !state.delivered.has(id)) };
    },

    // The client never answered (TTL, disconnect). Caller must interrupt the
    // run BEFORE calling this, or upstream answers the rejection with another
    // model call (prior-art lesson, confirmed by the sdk-timeout run).
    abandon(reason) {
      state.phase = 'abandoned';
      for (const [id, p] of state.pending) { p.settle.reject(new Error(`abandoned: ${reason}`)); trace('pending_rejected', { toolUseId: id }); }
      state.pending.clear(); state.predelivered.clear(); state.announced.clear(); state.delivered.clear();
      trace('abandoned', { reason });
    },

    turnEnded() { state.phase = 'done'; trace('turn_ended'); },

    snapshot() {
      return {
        phase: state.phase,
        assistantMessageDone: state.assistantMessageDone,
        announced: [...state.announced.keys()],
        waitingHandlers: [...state.pending.keys()],
        predelivered: [...state.predelivered.keys()],
        delivered: [...state.delivered],
      };
    },
  };
}
