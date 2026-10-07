#!/usr/bin/env python3
"""Summarise one ticket-21 probe stream (stdout jsonl) for the findings. usage: s-summarise.py <file.jsonl>"""
import json, sys, collections
from urllib.parse import urlsplit
f = sys.argv[1]
frames = []
for i, line in enumerate(open(f), 1):
    line = line.strip()
    if not line: continue
    try: frames.append((i, json.loads(line)))
    except Exception as e: print(f'L{i} UNPARSEABLE: {line[:120]}')
counts = collections.Counter()
for i, o in frames:
    t = o.get('type'); st = o.get('subtype')
    if t == 'stream_event': st = o['event'].get('type')
    counts[f'{t}/{st}' if st else t] += 1
print('FRAME COUNTS:', dict(counts))
for i, o in frames:
    t = o.get('type')
    if t == 'system' and o.get('subtype') == 'init':
        print(f'L{i} system/init tools={o.get("tools")} permissionMode={o.get("permissionMode")} version={o.get("claude_code_version")} model={o.get("model")}')
    elif t == 'system' and o.get('subtype') != 'init':
        print(f'L{i} system/{o.get("subtype")}: {json.dumps({k: v for k, v in o.items() if k not in ("uuid","session_id")})[:1200]}')
    elif t in ('hook_started', 'hook_response', 'hook_progress'):
        print(f'L{i} {t}: {json.dumps({k: v for k, v in o.items() if k not in ("uuid","session_id")})[:1500]}')
    elif t == 'rate_limit_event':
        w = o['rate_limit_info'].get('unifiedWindows', {})
        print(f'L{i} rate_limit_event five_hour={w.get("five_hour",{}).get("utilization")} seven_day={w.get("seven_day",{}).get("utilization")} status={o["rate_limit_info"].get("status")}')
    elif t == 'stream_event' and o['event'].get('type') == 'message_start':
        m = o['event']['message']; u = m.get('usage', {})
        print(f'L{i} message_start id={m.get("id")} input_tokens={u.get("input_tokens")} cache_creation={u.get("cache_creation_input_tokens")} cache_read={u.get("cache_read_input_tokens")}')
    elif t == 'assistant':
        for b in o['message'].get('content', []):
            if b.get('type') == 'tool_use':
                print(f'L{i} assistant/tool_use id={b.get("id")} name={b.get("name")} input={json.dumps(b.get("input"))} wire_tool_inputs={json.dumps(o.get("wire_tool_inputs"))}')
            elif b.get('type') == 'text':
                print(f'L{i} assistant/text: {b.get("text")[:1200]!r}')
            elif b.get('type') == 'thinking':
                print(f'L{i} assistant/thinking len={len(b.get("thinking",""))}')
    elif t == 'user':
        for b in o['message'].get('content', []):
            if isinstance(b, dict) and b.get('type') == 'tool_result':
                c = b.get('content'); ctext = c if isinstance(c, str) else json.dumps(c)
                print(f'L{i} user/tool_result tool_use_id={b.get("tool_use_id")} is_error={b.get("is_error")} content[:700]={ctext[:700]!r}')
        tur = o.get('tool_use_result')
        if tur is not None:
            if isinstance(tur, dict) and 'results' in tur:
                hosts = []
                for r in tur.get('results', []):
                    if isinstance(r, dict):
                        for c in r.get('content', []):
                            if isinstance(c, dict) and c.get('url'): hosts.append(urlsplit(c['url']).hostname)
                print(f'L{i}   tool_use_result query={tur.get("query")!r} searchCount={tur.get("searchCount")} durationSeconds={tur.get("durationSeconds")} n_urls={len(hosts)} hosts={sorted(set(hosts))}')
                for r in tur.get('results', []):
                    if isinstance(r, dict):
                        print(f'L{i}     srv tool_use_id={r.get("tool_use_id")} urls={[c.get("url") for c in r.get("content", []) if isinstance(c, dict)]}')
                    else:
                        print(f'L{i}     summary[:300]={str(r)[:300]!r}')
            else:
                print(f'L{i}   tool_use_result={json.dumps(tur)[:1000]}')
    elif t == 'result':
        keys = ('subtype','is_error','num_turns','stop_reason','terminal_reason','total_cost_usd','permission_denials','api_error_status','errors')
        print(f'L{i} result ' + ' '.join(f'{k}={json.dumps(o.get(k))}' for k in keys if k in o))
        print(f'L{i}   usage.server_tool_use={json.dumps(o.get("usage",{}).get("server_tool_use"))} modelUsage=' + json.dumps({m: {k: v for k, v in mu.items() if k in ('inputTokens','outputTokens','webSearchRequests','costUSD')} for m, mu in o.get('modelUsage', {}).items()}))
        print(f'L{i}   result.text[:600]={str(o.get("result"))[:600]!r}')
