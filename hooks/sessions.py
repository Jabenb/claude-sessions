#!/usr/bin/env python3
"""
The mod's reader of Claude Code's chat files (~/.claude/projects/<folder>/<session>.jsonl). Standard library only.

  index      --config DIR --cache FILE          the index of every session, as JSON on stdout; the cache keeps what
                                                 each file gave, so a file that grew is read from where it stopped
  search     --config DIR --query TEXT [--tools] [--limit N]
                                                 full-text search in what was written, as JSON on stdout
  transcript --config DIR --session ID [--start N] [--count N] [--tools]
                                                 the messages of one session, a window of them, as JSON on stdout

A file of a forked or resumed session starts with a copy of its parent's history: those lines keep the parent's
`sessionId`. They count for the numbering of messages (so a message has the same number in the parent and in the
fork), but not for the fork's own figures, and the parent is the last other session id seen before the fork's own.
"""

import argparse
import json
import os
import sys
import time

CACHE_VERSION = 4
MAX_FILES = 200
MAX_PROMPT = 400
TOOL_OUTPUT = 1500
MESSAGE_TEXT = 6000
SKIPPED_PREFIXES = (
    '{"type":"api-request', '{"type":"atis-latch"', '{"type":"queue-operation"', '{"type":"frame-link"',
    '{"type":"artifact-', '{"type":"dev-mods"', '{"type":"bridge-session"', '{"type":"session-owner"',
)
FILE_TOOLS = {'Edit', 'Write', 'MultiEdit', 'NotebookEdit'}
SKIPPED_PROMPTS = ('<local-command-', '<command-name>', '<command-message>', '<bash-stdout>', '<bash-stderr>', '<task-notification>')

# $ per million tokens: input, output, cache read, cache write (5 minutes), cache write (1 hour).
PRICES = {
    'claude-fable-5-2': (8.0, 40.0, 0.20, 10.0, 16.0),
    'claude-mythos-5-2': (8.0, 40.0, 0.20, 10.0, 16.0),
    'claude-fable-5-1': (10.0, 50.0, 1.0, 12.5, 20.0),
    'claude-mythos-5-1': (10.0, 50.0, 1.0, 12.5, 20.0),
    'claude-fable-5': (10.0, 50.0, 1.0, 12.5, 20.0),
    'claude-opus-5-5': (4.0, 20.0, 0.20, 5.0, 8.0),
    'claude-opus-5': (5.0, 25.0, 0.5, 6.25, 10.0),
    'claude-opus-4-8': (5.0, 25.0, 0.5, 6.25, 10.0),
    'claude-opus-4-7': (5.0, 25.0, 0.5, 6.25, 10.0),
    'claude-opus-4-6': (5.0, 25.0, 0.5, 6.25, 10.0),
    'claude-opus-4-5': (5.0, 25.0, 0.5, 6.25, 10.0),
    'claude-sonnet-5-5': (2.0, 10.0, 0.10, 2.5, 4.0),
    'claude-sonnet-5': (2.0, 10.0, 0.2, 2.5, 4.0),
    'claude-sonnet-4-6': (3.0, 15.0, 0.3, 3.75, 6.0),
    'claude-sonnet-4-5': (3.0, 15.0, 0.3, 3.75, 6.0),
    'claude-haiku-5-5': (0.10, 0.50, 0.01, 0.125, 0.20),
    'claude-haiku-4-5': (1.0, 5.0, 0.1, 1.25, 2.0),
}


def price_of(model):
    """The prices of a model id, a dated or suffixed spelling included; None for one this table does not know."""
    for name in sorted(PRICES, key=len, reverse=True):
        if model == name or model.startswith(name + '-') or model.startswith(name + '['):
            return PRICES[name]
    return None


def cost_of(usage):
    """Dollars for the usage by model, and whether every model's price was known."""
    total, known = 0.0, True
    for model, u in usage.items():
        price = price_of(model)
        if price is None:
            known = False
            continue
        total += (u['in'] * price[0] + u['out'] * price[1] + u['cr'] * price[2] + u['cw5'] * price[3] + u['cw1'] * price[4]) / 1e6
    return total, known


def iso_ms(stamp):
    """Milliseconds since the epoch of an ISO time as the chat files write it, or 0."""
    if not isinstance(stamp, str) or len(stamp) < 19:
        return 0
    try:
        base = time.strptime(stamp[:19], '%Y-%m-%dT%H:%M:%S')
        millis = int(stamp[20:23]) if len(stamp) >= 23 and stamp[19] == '.' else 0
        return int((time.mktime(base) - time.timezone) * 1000) + millis
    except ValueError:
        return 0


def clip(text, size):
    text = ' '.join(str(text).split()) if size <= MAX_PROMPT else str(text)
    return text if len(text) <= size else text[:size - 1] + '…'


def text_of(content):
    """The text of a message's content: a string, or the text blocks of a list."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(block.get('text', '') for block in content if isinstance(block, dict) and block.get('type') == 'text')
    return ''


def tool_output_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(block.get('text', '') for block in content if isinstance(block, dict) and block.get('type') == 'text')
    return ''


def tool_summary(name, data):
    """One line saying what a tool call did: its command, path, pattern or the like."""
    if not isinstance(data, dict):
        return ''
    for key in ('command', 'file_path', 'notebook_path', 'pattern', 'url', 'query', 'description', 'prompt', 'skill', 'path'):
        value = data.get(key)
        if isinstance(value, str) and value.strip() != '':
            return clip(value, 160)
    return clip(json.dumps(data, ensure_ascii=False), 160)


def is_prompt(record):
    """Whether a user record is something the person wrote (not a tool's result, a hidden reminder or a command's echo)."""
    if record.get('isMeta') or record.get('isSidechain') or record.get('isCompactSummary'):
        return False
    content = (record.get('message') or {}).get('content')
    if isinstance(content, list) and any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in content):
        return False
    text = text_of(content).strip()
    return text != '' and not text.startswith(SKIPPED_PROMPTS)


def items_of(record):
    """The numbered things a record shows in the transcript: the person's message, Claude's text, a tool call."""
    kind = record.get('type')
    message = record.get('message') or {}
    if kind == 'user' and is_prompt(record):
        return [{'role': 'user', 'text': text_of(message.get('content')).strip()}]
    if kind == 'assistant' and not record.get('isSidechain'):
        found = []
        for block in message.get('content') or []:
            if not isinstance(block, dict):
                continue
            if block.get('type') == 'text' and block.get('text', '').strip() != '':
                found.append({'role': 'claude', 'text': block['text'].strip()})
            elif block.get('type') == 'tool_use':
                found.append({'role': 'tool', 'tool': block.get('name', ''), 'text': tool_summary(block.get('name', ''), block.get('input')), 'id': block.get('id', '')})
        return found
    return []


def outputs_of(record):
    """The tool results a user record carries: tool_use id -> text."""
    content = (record.get('message') or {}).get('content')
    if record.get('type') != 'user' or not isinstance(content, list):
        return {}
    return {b.get('tool_use_id', ''): tool_output_of(b.get('content')) for b in content if isinstance(b, dict) and b.get('type') == 'tool_result'}


def records(path, start=0):
    """The records of a chat file from byte `start`, with the byte offset after the last whole line."""
    with open(path, 'rb') as handle:
        handle.seek(start)
        data = handle.read()
    end = data.rfind(b'\n') + 1
    found = []
    for raw in data[:end].split(b'\n'):
        if raw == b'':
            continue
        line = raw.decode('utf-8', 'replace')
        if line.startswith(SKIPPED_PREFIXES):
            continue
        try:
            found.append(json.loads(line))
        except ValueError:
            continue
    return found, start + end


def blank(own):
    return {
        'own': own, 'parents': [], 'n': 0, 'forkN': 0, 'start': 0, 'last': 0, 'cwd': '', 'branches': [], 'models': [], 'effort': '',
        'version': '', 'entry': '', 'perm': '', 'custom': '', 'ai': '', 'first': '', 'lastPrompt': '', 'prompts': 0, 'answers': 0,
        'tools': {}, 'files': [], 'usage': {}, 'web': 0, 'lastMsg': '', 'lastAnswer': '', 'costState': None,
    }


def add_to_list(values, value):
    if isinstance(value, str) and value != '' and (not values or values[-1] != value) and value not in values:
        values.append(value)


def take(acc, record):
    """Adds one record to a file's figures."""
    own = acc['own']
    sid = record.get('sessionId')
    is_own = sid in (None, own)
    shown = items_of(record)
    acc['n'] += len(shown)

    if not is_own:
        if sid not in acc['parents']:
            acc['parents'].append(sid)
        else:
            acc['parents'].remove(sid)
            acc['parents'].append(sid)
        acc['forkN'] = acc['n']
        return

    kind = record.get('type')
    stamp = iso_ms(record.get('timestamp'))
    if stamp and kind in ('user', 'assistant', 'system'):
        acc['start'] = acc['start'] or stamp
        acc['last'] = max(acc['last'], stamp)

    if kind == 'custom-title' and isinstance(record.get('customTitle'), str):
        acc['custom'] = record['customTitle']
    elif kind == 'ai-title' and isinstance(record.get('aiTitle'), str):
        acc['ai'] = record['aiTitle']
    elif kind == 'permission-mode' and isinstance(record.get('permissionMode'), str):
        acc['perm'] = record['permissionMode']
    elif kind == 'cost-state':
        acc['costState'] = {key: record.get(key) for key in ('totalCostUSD', 'totalAPIDuration', 'totalToolDuration', 'totalLinesAdded', 'totalLinesRemoved')}

    if kind not in ('user', 'assistant'):
        return

    acc['cwd'] = acc['cwd'] or record.get('cwd') or ''
    add_to_list(acc['branches'], record.get('gitBranch'))
    acc['version'] = record.get('version') or acc['version']
    acc['entry'] = record.get('entrypoint') or acc['entry']
    acc['perm'] = record.get('permissionMode') or acc['perm']
    message = record.get('message') or {}

    if kind == 'user':
        if shown:
            acc['prompts'] += 1
            text = clip(shown[0]['text'], MAX_PROMPT)
            acc['first'] = acc['first'] or text
            acc['lastPrompt'] = text
        return

    model = message.get('model') or ''
    if model.startswith('<') or model == '':
        return
    add_to_list(acc['models'], model)
    acc['effort'] = record.get('effort') or acc['effort']
    msg_id = message.get('id') or record.get('requestId') or record.get('uuid')

    if any(item['role'] == 'claude' for item in shown) and msg_id != acc['lastAnswer']:
        acc['answers'] += 1
        acc['lastAnswer'] = msg_id

    for block in message.get('content') or []:
        if isinstance(block, dict) and block.get('type') == 'tool_use':
            name = block.get('name', '')
            acc['tools'][name] = acc['tools'].get(name, 0) + 1
            data = block.get('input') if isinstance(block.get('input'), dict) else {}
            path = data.get('file_path') or data.get('notebook_path')
            if name in FILE_TOOLS and isinstance(path, str) and path not in acc['files'] and len(acc['files']) < MAX_FILES:
                acc['files'].append(path)

    usage = message.get('usage')
    if isinstance(usage, dict) and msg_id != acc['lastMsg']:
        acc['lastMsg'] = msg_id
        made = usage.get('cache_creation') if isinstance(usage.get('cache_creation'), dict) else {}
        hour = made.get('ephemeral_1h_input_tokens') or 0
        written = usage.get('cache_creation_input_tokens') or 0
        u = acc['usage'].setdefault(model, {'in': 0, 'out': 0, 'cr': 0, 'cw5': 0, 'cw1': 0, 'think': 0})
        u['in'] += usage.get('input_tokens') or 0
        u['out'] += usage.get('output_tokens') or 0
        u['cr'] += usage.get('cache_read_input_tokens') or 0
        u['cw1'] += hour
        u['cw5'] += max(0, written - hour)
        u['think'] += (usage.get('output_tokens_details') or {}).get('thinking_tokens') or 0
        acc['web'] += (usage.get('server_tool_use') or {}).get('web_search_requests') or 0


def config_paths(config):
    return os.path.join(config, 'projects'), os.path.join(config, 'sessions'), os.path.join(config, 'settings.json')


def live_sessions(folder):
    """The ids of the sessions whose process runs: ~/.claude/sessions/<pid>.json names each process's session."""
    live = {}
    try:
        names = os.listdir(folder)
    except OSError:
        return live
    for name in names:
        if not name.endswith('.json'):
            continue
        try:
            with open(os.path.join(folder, name), encoding='utf-8') as handle:
                held = json.load(handle)
            pid = int(held.get('pid') or name[:-5])
            if os.path.exists('/proc/%d' % pid) and isinstance(held.get('sessionId'), str):
                live[held['sessionId']] = pid
        except (OSError, ValueError, TypeError):
            continue
    return live


def keep_days(settings):
    try:
        with open(settings, encoding='utf-8') as handle:
            days = json.load(handle).get('cleanupPeriodDays')
        return int(days) if isinstance(days, (int, float)) and days >= 0 else 30
    except (OSError, ValueError, AttributeError):
        return 30


def chat_files(projects, with_subagents=False):
    """(folder, session id, path, size, mtime) of every main chat file; with `with_subagents`, of its subagents' files too."""
    found = []
    try:
        folders = sorted(os.listdir(projects))
    except OSError:
        return found
    for folder in folders:
        base = os.path.join(projects, folder)
        try:
            names = os.listdir(base)
        except OSError:
            continue
        for name in names:
            if not name.endswith('.jsonl'):
                continue
            path = os.path.join(base, name)
            try:
                stat = os.stat(path)
            except OSError:
                continue
            found.append((folder, name[:-6], path, stat.st_size, int(stat.st_mtime * 1000)))
            if with_subagents:
                found.extend(subagent_files(base, folder, name[:-6]))
    return found


def subagent_files(base, folder, sid):
    """The chat files of a session's subagents: their usage counts for the session."""
    found = []
    folder_of = os.path.join(base, sid, 'subagents')
    try:
        names = os.listdir(folder_of)
    except OSError:
        return found
    for name in names:
        if name.endswith('.jsonl'):
            path = os.path.join(folder_of, name)
            try:
                stat = os.stat(path)
            except OSError:
                continue
            found.append((folder, sid, path, stat.st_size, int(stat.st_mtime * 1000)))
    return found


def subagents_of(projects, folder, sid):
    found = {}
    base = os.path.join(projects, folder, sid, 'subagents')
    try:
        names = os.listdir(base)
    except OSError:
        return found
    for name in names:
        if not name.endswith('.meta.json'):
            continue
        try:
            with open(os.path.join(base, name), encoding='utf-8') as handle:
                kind = json.load(handle).get('agentType') or 'agent'
        except (OSError, ValueError):
            kind = 'agent'
        found[kind] = found.get(kind, 0) + 1
    return found


def index(config, cache_path):
    projects, sessions_dir, settings = config_paths(config)
    try:
        with open(cache_path, encoding='utf-8') as handle:
            cache = json.load(handle)
        if cache.get('v') != CACHE_VERSION:
            cache = {}
    except (OSError, ValueError):
        cache = {}
    files = cache.get('files', {})
    kept = {}
    read_bytes = 0

    for folder, sid, path, size, mtime in chat_files(projects, with_subagents=True):
        held = files.get(path)
        if held is None or size < held['offset']:
            held = {'size': 0, 'mtime': 0, 'offset': 0, 'acc': blank(sid)}
        if size != held['size'] or mtime != held['mtime']:
            found, offset = records(path, held['offset'])
            read_bytes += offset - held['offset']
            for record in found:
                take(held['acc'], record)
            held = {'size': size, 'mtime': mtime, 'offset': offset, 'acc': held['acc']}
        held['folder'] = folder
        held['isSub'] = os.sep + 'subagents' + os.sep in path
        kept[path] = held

    tmp = cache_path + '.tmp'
    os.makedirs(os.path.dirname(cache_path) or '.', exist_ok=True)
    with open(tmp, 'w', encoding='utf-8') as handle:
        json.dump({'v': CACHE_VERSION, 'files': kept}, handle, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, cache_path)

    live = live_sessions(sessions_dir)
    days = keep_days(settings)
    helpers = {}
    for held in kept.values():
        if held['isSub']:
            into = helpers.setdefault(held['acc']['own'], {'usage': {}, 'web': 0})
            into['web'] += held['acc']['web']
            for model, u in held['acc']['usage'].items():
                total = into['usage'].setdefault(model, {key: 0 for key in u})
                for key, value in u.items():
                    total[key] = total.get(key, 0) + value

    out = []
    for path, held in kept.items():
        acc = held['acc']
        if held['isSub'] or (acc['n'] == 0 and acc['prompts'] == 0):
            continue
        usage = {model: dict(u) for model, u in acc['usage'].items()}
        helper = helpers.get(acc['own'], {'usage': {}, 'web': 0})
        for model, u in helper['usage'].items():
            total = usage.setdefault(model, {key: 0 for key in u})
            for key, value in u.items():
                total[key] = total.get(key, 0) + value
        cost, known = cost_of(usage)
        helper_cost = cost_of(helper['usage'])[0]
        # Claude Code's own sum also counts its side calls (titles, checks), which no chat file shows; it covers the last run only.
        state = acc['costState'] or {}
        tokens = {key: sum(u[key] for u in usage.values()) for key in ('in', 'out', 'cr', 'cw5', 'cw1', 'think')}
        out.append({
            'id': acc['own'], 'folder': held['folder'], 'cwd': acc['cwd'], 'parent': acc['parents'][-1] if acc['parents'] else None,
            'forkN': acc['forkN'] if acc['parents'] else 0, 'n': acc['n'],
            'title': acc['custom'] or acc['ai'], 'first': acc['first'], 'lastPrompt': acc['lastPrompt'],
            'start': acc['start'] or held['mtime'], 'last': acc['last'] or held['mtime'], 'mtime': held['mtime'], 'size': held['size'],
            'live': acc['own'] in live, 'branches': acc['branches'], 'models': acc['models'], 'effort': acc['effort'], 'perm': acc['perm'],
            'entry': acc['entry'], 'version': acc['version'], 'prompts': acc['prompts'], 'answers': acc['answers'],
            'tools': acc['tools'], 'files': acc['files'], 'web': acc['web'] + helper['web'], 'subagentCost': round(helper_cost, 4), 'subagents': subagents_of(projects, held['folder'], acc['own']),
            'cost': round(max(cost, state.get('totalCostUSD') or 0), 4), 'costKnown': known, 'tokens': tokens,
            'byModel': {model: dict(u, cost=round(cost_of({model: u})[0], 4)) for model, u in usage.items()},
            'apiMs': state.get('totalAPIDuration'), 'toolMs': state.get('totalToolDuration'),
            'added': state.get('totalLinesAdded'), 'removed': state.get('totalLinesRemoved'),
            'deleteAt': None if acc['own'] in live else held['mtime'] + days * 86400000,
        })
    out.sort(key=lambda one: one['last'], reverse=True)
    return {'sessions': out, 'keepDays': days, 'readBytes': read_bytes, 'at': int(time.time() * 1000)}


def find_file(projects, sid):
    for folder, own, path, _size, _mtime in chat_files(projects):
        if own == sid:
            return path
    return None


def snippet(text, at, size):
    start = max(0, at - 70)
    end = min(len(text), at + size + 90)
    return [('…' if start > 0 else '') + ' '.join(text[start:at].split(' ')), text[at:at + size], ' '.join(text[at + size:end].split(' ')) + ('…' if end < len(text) else '')]


def search(config, query, with_tools, limit):
    """Messages whose text holds `query` (any case), at most three per session; copied history belongs to the parent."""
    projects, _sessions, _settings = config_paths(config)
    needle = query.strip().lower()
    hits, scanned, started = [], 0, time.time()
    per_session = {}
    if needle == '':
        return {'hits': [], 'scanned': 0, 'ms': 0}

    is_ascii = needle.isascii()
    spellings = {needle.encode(), query.strip().encode(), needle.upper().encode(), needle.capitalize().encode(), needle.title().encode()}

    for _folder, sid, path, _size, _mtime in chat_files(projects):
        try:
            with open(path, 'rb') as handle:
                whole = handle.read()
        except OSError:
            continue
        scanned += 1
        # A cheap look at the bytes first: ASCII folds case there; other scripts are looked for in their usual spellings.
        if (needle.encode() not in whole.lower()) if is_ascii else not any(spelling in whole for spelling in spellings):
            continue
        n = 0
        last_tool = {}
        for raw in whole.split(b'\n'):
            if not raw.startswith(b'{"parentUuid"'):
                continue
            try:
                record = json.loads(raw)
            except ValueError:
                continue
            own = record.get('sessionId') in (None, sid)
            for item in items_of(record):
                n += 1
                if item['role'] == 'tool':
                    last_tool[item.get('id', '')] = (n, item['tool'])
                if not own or per_session.get(sid, 0) >= 3:
                    continue
                text = item['text']
                at = text.lower().find(needle)
                if at >= 0:
                    hits.append({'sid': sid, 'n': n, 'role': item['role'], 'tool': item.get('tool', ''), 'snip': snippet(text, at, len(needle))})
                    per_session[sid] = per_session.get(sid, 0) + 1
            if with_tools and own and per_session.get(sid, 0) < 3:
                for tool_id, output in outputs_of(record).items():
                    at = output.lower().find(needle)
                    if at >= 0 and tool_id in last_tool:
                        hits.append({'sid': sid, 'n': last_tool[tool_id][0], 'role': 'output', 'tool': last_tool[tool_id][1], 'snip': snippet(output, at, len(needle))})
                        per_session[sid] = per_session.get(sid, 0) + 1
                        break
        if len(per_session) >= limit:
            break
    return {'hits': hits, 'scanned': scanned, 'sessions': len(per_session), 'ms': int((time.time() - started) * 1000), 'isCut': len(per_session) >= limit}


def transcript(config, sid, start, count, with_tools):
    """Messages `start`..`start+count-1` of a session (numbered from 1), the tool outputs beside their calls."""
    projects, _sessions, _settings = config_paths(config)
    path = find_file(projects, sid)
    if path is None:
        return {'sid': sid, 'items': [], 'total': 0, 'missing': True}
    found, _offset = records(path)
    items, n = [], 0
    by_tool = {}
    end = start + count
    for record in found:
        own = record.get('sessionId') in (None, sid)
        for item in items_of(record):
            n += 1
            if start <= n < end:
                shown = {'n': n, 'role': item['role'], 'text': clip(item['text'], MESSAGE_TEXT), 'at': iso_ms(record.get('timestamp')), 'copied': not own}
                if item['role'] == 'tool':
                    shown['tool'] = item['tool']
                    by_tool[item.get('id', '')] = shown
                items.append(shown)
        if with_tools:
            for tool_id, output in outputs_of(record).items():
                if tool_id in by_tool:
                    by_tool[tool_id]['out'] = clip(output, TOOL_OUTPUT)
    return {'sid': sid, 'items': items, 'total': n, 'start': start}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['index', 'search', 'transcript'])
    parser.add_argument('--config', required=True)
    parser.add_argument('--cache')
    parser.add_argument('--query', default='')
    parser.add_argument('--tools', action='store_true')
    parser.add_argument('--limit', type=int, default=60)
    parser.add_argument('--session', default='')
    parser.add_argument('--start', type=int, default=1)
    parser.add_argument('--count', type=int, default=200)
    args = parser.parse_args()

    if args.command == 'index':
        result = index(args.config, args.cache or os.path.join(args.config, 'mods-data', 'sessions', 'cache.json'))
    elif args.command == 'search':
        result = search(args.config, args.query, args.tools, max(1, args.limit))
    else:
        result = transcript(args.config, args.session, max(1, args.start), max(1, min(args.count, 1000)), args.tools)
    json.dump(result, sys.stdout, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
