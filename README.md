# Sessions for Claude Code

English | [Русский](README.ru.md)

Every Claude Code session on the machine on one browser page: a tree of host → project → session → forks, a card with everything known about a session, its cost and when Claude Code will delete it, and search in what was written.

It is a mod for [Claude Hub](https://github.com/jabenb/claude-webhub): the page lives in the hub, beside the pages of your other mods, under **Whole machine**.

## What you get

- **The tree.** Sessions grouped by project (the folder they ran in); a fork or a resumed session sits under the one it came from, at any depth. Live sessions are marked; rows show the branch, last activity, cost, messages and forks.
- **The card.** Name, first and last prompt, branches, models, effort, permission mode, where it ran (desktop app or CLI), version; time spent; tokens by kind and by model and the cost (≈, from the tokens at API prices); tools used, files changed, lines added and removed, subagents; the parent and where it branched off, the child forks and the cost of the whole fork tree; a button that copies `claude --resume <id>`.
- **Lifetime.** When Claude Code will delete the chat file (`cleanupPeriodDays` in `~/.claude/settings.json`, 30 days by default, counted from the last change), a mark on rows that go within a week, and a filter for them.
- **Search.** Instant search over names, prompts, branches, projects and files, with `host:`, `project:`, `branch:`, `after:`, `before:`, `model:` and `"exact phrase"`. Search in the text of every chat (Enter with «search in text»), optionally in tools' output too. Search by meaning (off by default): one model call that costs tokens, the model set in the options.
- **The chat.** A session's messages, tool calls with their output, what a fork took over from its parent, and where its own forks branched off.

Nothing it shows spends tokens, except search by meaning when you turn it on.

## Requirements

- [Claude Hub](https://github.com/jabenb/claude-webhub) **0.2.0 or later** (the page of the whole machine, `scope: 'global'`).
- `python3` on the machine where Claude Code runs: the mod reads the chat files with a small script of the standard library.

## Install

```bash
claude plugin install webhub --marketplace jabenb/claude-webhub --scope user
claude plugin install sessions --marketplace jabenb/claude-sessions --scope user
```

Install both at the same scope: the page belongs to the whole machine, so `user` is the natural one.

## Use

Run `/sessions` in any session for the page's address, or open the hub (`/hub`) and pick **Sessions** under **Whole machine**. Over SSH, forward the hub's port as the hub's README says.

The page is filled by the sessions that have the mod: one of them reads the chat files every 15 seconds (only what changed since the last time), and the one you wrote in last answers the page's searches. With no Claude Code session running, the page shows what it had and says the data is not updating.

### Options

| Option | Default | What it is |
|---|---|---|
| `semanticModel` | `haiku` | The model search by meaning asks: an alias (`haiku`, `sonnet`, `opus`) or a full model id. |

## Where the data lives

The mod keeps its index cache in `~/.claude/mods-data/sessions/` (under `$CLAUDE_CONFIG_DIR` when set). It only reads `~/.claude/projects` and `~/.claude/sessions`; it never changes or deletes a chat.

## License

MIT, see [LICENSE](LICENSE).
