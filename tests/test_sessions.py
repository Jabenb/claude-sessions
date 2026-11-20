"""Tests of hooks/sessions.py on made-up chat files: python3 -m unittest discover -s tests -p 'test_*.py'"""

import contextlib
import io
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'hooks'))
import sessions  # noqa: E402

PARENT = '11111111-aaaa-bbbb-cccc-000000000001'
FORK = '22222222-aaaa-bbbb-cccc-000000000002'
LONE = '33333333-aaaa-bbbb-cccc-000000000003'
FOLDER = '-w-shop'


def user(sid, text, at, **extra):
    return dict({'parentUuid': None, 'type': 'user', 'sessionId': sid, 'cwd': '/w/shop', 'gitBranch': 'main', 'version': '2.1.0',
                 'entrypoint': 'cli', 'timestamp': at, 'message': {'role': 'user', 'content': text}}, **extra)


def answer(sid, msg_id, blocks, at, model='claude-opus-5-5', usage=None):
    return {'parentUuid': 'x', 'type': 'assistant', 'sessionId': sid, 'cwd': '/w/shop', 'gitBranch': 'feature/x', 'timestamp': at, 'effort': 'high',
            'message': {'id': msg_id, 'role': 'assistant', 'model': model, 'content': blocks,
                        'usage': usage or {'input_tokens': 10, 'output_tokens': 1000, 'cache_read_input_tokens': 1_000_000,
                                           'cache_creation_input_tokens': 100_000, 'cache_creation': {'ephemeral_1h_input_tokens': 100_000, 'ephemeral_5m_input_tokens': 0},
                                           'output_tokens_details': {'thinking_tokens': 300}}}}


def tool_result(sid, tool_id, text, at):
    return {'parentUuid': 'y', 'type': 'user', 'sessionId': sid, 'timestamp': at,
            'message': {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': tool_id, 'content': text}]}}


PARENT_LINES = [
    {'type': 'queue-operation', 'operation': 'enqueue', 'sessionId': PARENT},
    user(PARENT, 'Сделай драйвер Apaleo', '2026-10-07T10:00:00.000Z'),
    # One API message written as two records (thinking, then a tool call): its usage counts once.
    answer(PARENT, 'm1', [{'type': 'thinking', 'thinking': ''}], '2026-10-07T10:00:05.000Z'),
    answer(PARENT, 'm1', [{'type': 'tool_use', 'id': 't1', 'name': 'Edit', 'input': {'file_path': '/w/shop/app/Driver.php'}}], '2026-10-07T10:00:06.000Z'),
    tool_result(PARENT, 't1', 'The file was updated with Cache::lock', '2026-10-07T10:00:07.000Z'),
    answer(PARENT, 'm2', [{'type': 'text', 'text': 'Готово, драйвер Apaleo на месте.'}], '2026-10-07T10:00:09.000Z'),
    {'type': 'custom-title', 'customTitle': 'Apaleo PMS', 'sessionId': PARENT},
    {'type': 'api-request-blob', 'sessionId': PARENT, 'blob': 'Apaleo ' * 50},
    user(PARENT, '<local-command-stdout>ok</local-command-stdout>', '2026-10-07T10:00:10.000Z'),
    user(PARENT, 'hidden reminder', '2026-10-07T10:00:11.000Z', isMeta=True),
    {'type': 'cost-state', 'sessionId': PARENT, 'totalCostUSD': 0.5, 'totalAPIDuration': 9000, 'totalToolDuration': 1000, 'totalLinesAdded': 12, 'totalLinesRemoved': 3},
]

FORK_LINES = [
    # The fork's file starts with the parent's history, under the parent's id.
    user(PARENT, 'Сделай драйвер Apaleo', '2026-10-07T10:00:00.000Z'),
    answer(PARENT, 'm1', [{'type': 'tool_use', 'id': 't1', 'name': 'Edit', 'input': {'file_path': '/w/shop/app/Driver.php'}}], '2026-10-07T10:00:06.000Z'),
    answer(PARENT, 'm2', [{'type': 'text', 'text': 'Готово, драйвер Apaleo на месте.'}], '2026-10-07T10:00:09.000Z'),
    {'type': 'custom-title', 'customTitle': 'Apaleo PMS', 'sessionId': PARENT},
    user(FORK, 'А теперь через очередь', '2026-10-08T09:00:00.000Z'),
    answer(FORK, 'f1', [{'type': 'text', 'text': 'Сделал job раз в 10 минут.'}], '2026-10-08T09:00:30.000Z', model='claude-sonnet-5-5',
           usage={'input_tokens': 1_000_000, 'output_tokens': 100_000, 'cache_read_input_tokens': 0, 'cache_creation_input_tokens': 0}),
]


class SessionsTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.config = self.dir.name
        base = os.path.join(self.config, 'projects', FOLDER)
        os.makedirs(os.path.join(base, PARENT, 'subagents'))
        os.makedirs(os.path.join(self.config, 'sessions'))
        self.write(os.path.join(base, PARENT + '.jsonl'), PARENT_LINES)
        self.write(os.path.join(base, FORK + '.jsonl'), FORK_LINES)
        self.write(os.path.join(base, LONE + '.jsonl'), [user(LONE, 'привет', '2026-10-09T09:00:00.000Z')])
        self.write(os.path.join(base, PARENT, 'subagents', 'agent-a1.jsonl'), [
            dict(answer(PARENT, 's1', [{'type': 'text', 'text': 'found it'}], '2026-10-07T10:00:04.000Z', model='claude-haiku-5-5',
                        usage={'input_tokens': 1_000_000, 'output_tokens': 0, 'cache_read_input_tokens': 0, 'cache_creation_input_tokens': 0}), isSidechain=True),
        ])
        with open(os.path.join(base, PARENT, 'subagents', 'agent-a1.meta.json'), 'w') as handle:
            json.dump({'agentType': 'Explore'}, handle)
        with open(os.path.join(self.config, 'sessions', '%d.json' % os.getpid()), 'w') as handle:
            json.dump({'pid': os.getpid(), 'sessionId': LONE, 'hostSessionId': 'local_lone'}, handle)
        with open(os.path.join(self.config, 'settings.json'), 'w') as handle:
            json.dump({'cleanupPeriodDays': 10}, handle)
        self.cache = os.path.join(self.config, 'mods-data', 'sessions', 'cache.json')

    def tearDown(self):
        self.dir.cleanup()

    @staticmethod
    def write(path, lines, mode='w'):
        with open(path, mode, encoding='utf-8') as handle:
            for line in lines:
                handle.write(json.dumps(line, ensure_ascii=False, separators=(',', ':')) + '\n')

    def index(self):
        return {one['id']: one for one in sessions.index(self.config, self.cache)['sessions']}

    def test_a_session_is_summed_up_from_its_own_lines(self):
        parent = self.index()[PARENT]

        self.assertEqual(parent['title'], 'Apaleo PMS')
        self.assertEqual(parent['first'], 'Сделай драйвер Apaleo')
        self.assertEqual((parent['prompts'], parent['answers'], parent['n']), (1, 1, 3))
        self.assertEqual(parent['branches'], ['main', 'feature/x'])
        self.assertEqual(parent['tools'], {'Edit': 1})
        self.assertEqual(parent['files'], ['/w/shop/app/Driver.php'])
        self.assertEqual((parent['added'], parent['removed'], parent['apiMs']), (12, 3, 9000))
        self.assertEqual(parent['subagents'], {'Explore': 1})
        self.assertIsNone(parent['parent'])

    def test_usage_counts_once_per_message_and_takes_the_subagents_in(self):
        parent = self.index()[PARENT]
        # Opus 5.5 twice (m1, m2): 10 in, 1000 out, 1M cache read, 100k 1-hour cache write; Haiku subagent: 1M in.
        opus = 2 * (10 * 4 + 1000 * 20 + 1_000_000 * 0.2 + 100_000 * 8) / 1e6
        haiku = 1_000_000 * 0.1 / 1e6

        self.assertEqual(parent['tokens']['out'], 2000)
        self.assertEqual(parent['tokens']['cw1'], 200_000)
        self.assertEqual(parent['tokens']['think'], 600)
        self.assertAlmostEqual(parent['cost'], round(opus + haiku, 4))
        self.assertAlmostEqual(parent['subagentCost'], haiku)

    def test_a_fork_names_its_parent_and_counts_only_its_own_lines(self):
        fork = self.index()[FORK]

        self.assertEqual((fork['parent'], fork['forkN'], fork['n']), (PARENT, 3, 5))
        self.assertEqual(fork['title'], '')
        self.assertEqual((fork['first'], fork['prompts'], fork['answers']), ('А теперь через очередь', 1, 1))
        self.assertEqual(fork['models'], ['claude-sonnet-5-5'])
        self.assertAlmostEqual(fork['cost'], 1_000_000 * 2 / 1e6 + 100_000 * 10 / 1e6)

    def test_live_sessions_are_known_by_their_process_and_the_others_get_a_deletion_date(self):
        found = self.index()

        self.assertTrue(found[LONE]['live'])
        self.assertIsNone(found[LONE]['deleteAt'])
        self.assertEqual(found[PARENT]['deleteAt'], found[PARENT]['mtime'] + 10 * 86400000)

    def test_the_app_id_of_a_session_is_kept_after_its_process_ends(self):
        found = self.index()

        self.assertEqual((found[LONE]['app'], found[PARENT]['app']), ('local_lone', None))
        self.assertGreater(found[LONE]['memMb'], 0)
        self.assertIsNone(found[PARENT]['memMb'])
        os.remove(os.path.join(self.config, 'sessions', '%d.json' % os.getpid()))
        again = self.index()

        self.assertEqual((again[LONE]['app'], again[LONE]['live'], again[LONE]['memMb']), ('local_lone', False, None))

    def test_a_file_that_grew_is_read_on_from_where_it_stopped(self):
        self.index()
        path = os.path.join(self.config, 'projects', FOLDER, LONE + '.jsonl')
        self.write(path, [answer(LONE, 'l1', [{'type': 'text', 'text': 'Привет!'}], '2026-10-09T09:00:02.000Z')], mode='a')
        again = sessions.index(self.config, self.cache)

        self.assertEqual(again['readBytes'], os.path.getsize(path) - len(json.dumps(user(LONE, 'привет', '2026-10-09T09:00:00.000Z'), ensure_ascii=False, separators=(',', ':')).encode()) - 1)
        self.assertEqual({one['id']: one for one in again['sessions']}[LONE]['answers'], 1)

    def test_search_finds_text_in_any_case_and_leaves_copied_history_to_the_parent(self):
        found = sessions.search(self.config, 'APALEO', False, 60)

        self.assertEqual(sorted({hit['sid'] for hit in found['hits']}), [PARENT])
        self.assertEqual([(hit['n'], hit['role']) for hit in found['hits']], [(1, 'user'), (3, 'claude')])
        self.assertEqual(found['hits'][0]['snip'], ['Сделай драйвер ', 'Apaleo', ''])
        self.assertEqual(sessions.search(self.config, 'apaleo pms', False, 60)['hits'], [])

    def test_search_in_other_scripts_and_in_tool_output(self):
        self.assertEqual([hit['sid'] for hit in sessions.search(self.config, 'очередь', False, 60)['hits']], [FORK])
        self.assertEqual(sessions.search(self.config, 'cache::lock', False, 60)['hits'], [])
        with_tools = sessions.search(self.config, 'cache::lock', True, 60)['hits']

        self.assertEqual([(hit['sid'], hit['n'], hit['role'], hit['tool']) for hit in with_tools], [(PARENT, 2, 'output', 'Edit')])

    def test_the_transcript_numbers_messages_as_the_search_does_and_marks_what_was_taken_over(self):
        read = sessions.transcript(self.config, FORK, 1, 10, True)

        self.assertEqual(read['total'], 5)
        self.assertEqual([(item['n'], item['role'], item['copied']) for item in read['items']],
                         [(1, 'user', True), (2, 'tool', True), (3, 'claude', True), (4, 'user', False), (5, 'claude', False)])
        self.assertEqual(read['items'][1]['tool'], 'Edit')
        window = sessions.transcript(self.config, PARENT, 2, 1, True)

        self.assertEqual([(item['n'], item.get('out')) for item in window['items']], [(2, 'The file was updated with Cache::lock')])
        self.assertTrue(sessions.transcript(self.config, 'nope', 1, 10, False)['missing'])

    def test_the_command_line_prints_json(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            sys.argv = ['sessions.py', 'search', '--config', self.config, '--query', 'apaleo']
            sessions.main()

        self.assertEqual(json.loads(out.getvalue())['sessions'], 1)


class PricesTest(unittest.TestCase):
    def test_dated_and_suffixed_model_ids_find_their_price(self):
        self.assertEqual(sessions.price_of('claude-opus-5-5'), sessions.PRICES['claude-opus-5-5'])
        self.assertEqual(sessions.price_of('claude-opus-4-5-20251101'), sessions.PRICES['claude-opus-4-5'])
        self.assertEqual(sessions.price_of('claude-opus-5-5[1m]'), sessions.PRICES['claude-opus-5-5'])
        self.assertEqual(sessions.price_of('claude-sonnet-5'), sessions.PRICES['claude-sonnet-5'])
        self.assertIsNone(sessions.price_of('gpt-x'))


if __name__ == '__main__':
    unittest.main()
