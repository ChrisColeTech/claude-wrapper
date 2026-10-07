#!/usr/bin/env python3
"""Summarise one probe: python3 r-summarise.py <name>. Prints line-numbered facts from out/<name>.jsonl and out/<name>.transcript.jsonl."""
import json, os, sys
name = sys.argv[1]
print(f'== {name}.jsonl')
for i, l in enumerate(open(f'{name}.jsonl'), 1):
    d = json.loads(l); t = d.get('type')
    if t == 'system' and d.get('subtype') == 'init':
        print(f'L{i} init model={d.get("model")} apiKeySource={d.get("apiKeySource")} tools={d.get("tools")} slash_commands={len(d.get("slash_commands") or [])} skills={len(d.get("skills") or [])}')
    elif t == 'stream_event' and d['event'].get('type') == 'message_start':
        u = d['event']['message']['usage']; print(f'L{i} message_start usage input={u.get("input_tokens")} cache_creation={u.get("cache_creation_input_tokens")} cache_read={u.get("cache_read_input_tokens")} model={d["event"]["message"].get("model")}')
    elif t == 'assistant':
        for c in d['message']['content']:
            if c['type'] == 'text': print(f'L{i} assistant text: {json.dumps(c["text"])}')
        if d.get('error'): print(f'L{i} assistant error={d.get("error")}')
    elif t == 'rate_limit_event':
        w = d['rate_limit_info'].get('unifiedWindows') or {}
        print(f'L{i} rate_limit five_hour={w.get("five_hour")} seven_day={w.get("seven_day")}')
    elif t == 'result':
        u = d.get('usage') or {}
        print(f'L{i} result subtype={d.get("subtype")} is_error={d.get("is_error")} num_turns={d.get("num_turns")} cost={d.get("total_cost_usd")} duration_api_ms={d.get("duration_api_ms")} input={u.get("input_tokens")} output={u.get("output_tokens")} thinking={(u.get("output_tokens_details") or {}).get("thinking_tokens")} api_error_status={d.get("api_error_status")}')
tp = f'{name}.transcript.jsonl'
if os.path.exists(tp):
    print(f'== {tp}')
    for i, l in enumerate(open(tp), 1):
        d = json.loads(l); a = d.get('attachment') or {}; t = d.get('type')
        if t == 'attachment':
            rendered = ''.join(r.get('content', '') for r in d.get('rendered') or [])
            extra = ''
            if a.get('type') == 'prompt_snapshot': extra = json.dumps({k: a.get(k) for k in ('systemPrompt', 'cliPrefix', 'tools')})
            if a.get('type') == 'session_context': extra = json.dumps(a.get('context'))[:200]
            if a.get('type') == 'environment': extra = json.dumps(a.get('snapshot'))[:120]
            print(f'L{i} attachment type={a.get("type")} renderedRole={d.get("renderedRole")} rendered_chars={len(rendered)} {extra}')
        elif t in ('user', 'assistant'):
            m = d.get('message') or {}; c = m.get('content')
            if isinstance(c, list): c = [x.get('text', x.get('type')) if isinstance(x, dict) else x for x in c]
            print(f'L{i} {t} content={json.dumps(c)[:200]}')
        else:
            print(f'L{i} {t}')
