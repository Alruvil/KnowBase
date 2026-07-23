# KnowBase

A markdown-based knowledge base (Electron desktop app) with an embedded AI assistant that can read, retrieve, analyze, edit, and generate your notes — scoped to one project at a time, with full undo via git.

Think of it as an Obsidian-like editor where the console is an agent that actually works on your files, and every AI change is a reviewable, revertible commit.

---

## Layout

```
┌────────────┬─────────────────────────────────┐
│            │  Breadcrumb  ·  Blog › Opinion    │
│  Project   │  ┌───────────────────────────┐   │
│  tree      │  │  Markdown editor           │  │
│  (left)    │  │  (CodeMirror, live styling)│  │
│            │  └───────────────────────────┘   │
│            │  [ H  B I S  ‹›  🔗  List  … ]    │  ← markdown toolbar
│            │ ───────────────────────────────  │
│            │  Console · Runs in: Blog › …  ⚙  │
│            │  AI transcript + input (@ files) │  │
├────────────┴─────────────────────────────────┤
│  Content · ● 2 unsaved   [Save] [Revert]      │  ← status bar
└───────────────────────────────────────────────┘
```

---

## Features

**Files & projects**
- One configurable **root folder** (default `~/Knowledge`); each top-level folder is a **project**. Change the root with the `⌂` button.
- File tree with create / rename / delete (deletes go to the system trash). Hover a folder for quick **＋ new file** / **⊞ new folder**; the top **＋** makes a new project.
- **Markdown editor** (CodeMirror 6) with Obsidian-style live styling — you see the markdown source, but headings, bold, code, links, etc. render inline. Autosaves ~0.6 s after you stop typing (and on `Ctrl/Cmd+S`).
- **Markdown toolbar** along the bottom of the editor: heading levels, bold / italic / strikethrough / inline code, link, bullet / numbered / task lists, quote, code block, table, divider.
- **Editor auto-reloads** when a file changes on disk (e.g. the AI edited it). If you have unsaved edits, it shows a **⟳ changed on disk — reload** button instead of clobbering your work.
- **Breadcrumb** above the editor (`Project › Folder › file`) with a config **⚙ cog** on each folder segment.

**Per-level AI instructions**
- Every folder/project has a **⚙ cog** (in the tree and the breadcrumb) that opens its `_prompt.md` — instructions for the AI at that level. These cascade **root → project → folder** into the assistant's system prompt.
- `_prompt.md` and `_index.md` are hidden from the tree (managed through the cog).

**AI console**
- Runs the **Claude Agent SDK** scoped to the folder shown in the "Runs in" breadcrumb — the AI reads/edits only within that folder.
- The scope **follows the file you're editing**, but you can click a level to re-scope the AI independently (with a **↺ follow file** button to snap back). It's blocked at the root — the AI always works inside a project.
- Type **`@`** to reference a file (autocomplete over the current scope).
- **Conversation history per project**, saved to disk and restored when you switch back — so you can drift between projects and pick up where you left off.
- Each answer shows the **model used and token counts**.

**Content versioning (undo the AI)**
- Your knowledge root is a **git repository** (separate from this app's code). Before every AI call the content is committed as a restore point.
- After a call, the console shows a **diff summary** (`✎ N files changed · +X −Y`, with the file list).
- The bottom **status bar** shows a **Save** / **Revert** pair whenever the content differs from the last commit (covers manual edits too). **Revert** drops everything back to the last commit; **Save** commits the current state as a new restore point. Conversation history is never versioned or lost on revert.

**Auth & settings** (console **⚙**)
- **Claude subscription (OAuth)** — recommended; uses your Pro/Max plan.
- **Existing Claude Code login** — reuse a `claude` login already on the machine.
- **Anthropic API key** — pay-per-use fallback.
- **Model** — Default (your plan) / Opus / Sonnet / Haiku.
- **Diagnostics** — path to the log file, with a Reveal button.

---

## Requirements

- **Node.js ≥ 20**
- **git** (for content versioning; the app still runs without it, just without Save/Revert)
- A **Claude subscription** (Pro/Max) or an **Anthropic API key** for the AI console

---

## Getting started

```bash
npm install
npm run dev        # launch in development (hot reload)
```

Other scripts:

```bash
npm run build      # production build → out/
npm run typecheck  # TypeScript checks (main + renderer)
npm test           # unit tests (vitest)
npm start          # preview a production build
```

### First run — connect the AI

The AI console needs credentials once. Easiest path (subscription):

```bash
npm install -g @anthropic-ai/claude-code
claude setup-token     # opens a browser, logs into your Claude plan, prints a token
```

Then in the app: console **⚙ → "Claude subscription (OAuth)" → paste the token → Save**. (Or paste an Anthropic API key under "Anthropic API key".)

Now open a file inside a project and ask the console to do something — retrieve, summarize, analyze, optimize, or write notes. Watch the diff summary and the Save/Revert bar react.

---

## How your data is stored

Everything is plain files under your root folder (default `~/Knowledge`):

```
~/Knowledge/
├── .git/                     # content version history (managed by the app)
├── .gitignore                # ignores .knowledge/
├── Blog/                     # a project
│   ├── _prompt.md            # AI instructions for this project (hidden in the tree)
│   ├── Opinion/
│   │   ├── _prompt.md        # AI instructions for this subfolder
│   │   └── a-post.md
│   └── .knowledge/
│       └── history.jsonl     # AI conversation history for this project (not versioned)
└── …
```

- **Your notes are human-readable markdown** you can edit or back up outside the app.
- **`.knowledge/`** holds internal state (conversation history) and is git-ignored — it stays out of your diffs and survives reverts.
- This content is **completely separate from this app's source code**; pushing the app to GitHub never includes your notes.

---

## Project structure (for developers)

```
src/
├── main/         # Electron main process (Node)
│   ├── index.ts            # window, IPC wiring, watcher
│   ├── fs-service.ts       # sandboxed file ops (safePath guards traversal)
│   ├── agent-service.ts    # Claude Agent SDK turn: streaming, scoping, session resume
│   ├── prompt-service.ts   # cascading _prompt.md → system prompt
│   ├── history-service.ts  # per-project conversation persistence
│   ├── git-service.ts      # content versioning (checkpoint / diff / revert)
│   ├── numstat.ts          # pure git-numstat parser
│   ├── settings.ts         # root dir, auth mode/token, model
│   └── logger.ts           # file logger (~/.config/knowledge-app/knowledge-app.log)
├── preload/      # typed contextBridge API (window.api)
├── renderer/     # React UI
│   └── src/
│       ├── App.tsx
│       ├── components/     # FileTree, Editor, Console, Breadcrumb, MarkdownToolbar,
│       │                   #   SettingsModal, StatusBar
│       └── lib/            # markdown-commands, mention (pure, tested)
└── shared/       # types shared across processes
```

Architecture notes:
- The **renderer never touches the filesystem or the agent directly** — the main process owns all I/O behind a typed IPC bridge (`window.api`), with `contextIsolation` on and path-traversal guards.
- The **Agent SDK runs in the main process** and spawns a bundled Claude Code binary; auth flows through it via `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY`.

### Tests

Unit tests (vitest) cover the pure, regression-prone logic:

- `numstat` — git diff parsing (binary files, paths with spaces)
- `fs-service.safePath` — path-traversal rejection (security)
- `history-service.projectOf` — project resolution
- `prompt-service.composeSystemPrompt` — cascade order
- `mention.detectMention` — `@`-reference parsing

```bash
npm test          # run once
npm run test:watch
```

---

## Troubleshooting

- **The console does nothing / errors about login** — set your auth in console **⚙**. `/login` can't run inside the app; generate a token with `claude setup-token` in a terminal, or use an API key.
- **Everything is logged** to `~/.config/knowledge-app/knowledge-app.log` (auth mode, each AI turn, tool use, model, errors). Tail it: `tail -f ~/.config/knowledge-app/knowledge-app.log`, or open it from console **⚙ → Diagnostics → Reveal**. Tokens are never logged.

---

## Notes & limitations

- **Subscription auth is for individual use** — each person runs the app with their own Claude login or API key. Don't route multiple users through one subscription.
- **Save/Revert are global** to the whole content repo, not per-project. Because a checkpoint is committed before every AI call, the revert window is normally just the latest turn plus any unsaved manual edits.
- **Indexes** (`_index.md`) are referenced by the assistant when present but are not yet auto-generated.

## Roadmap

- `_index.md` generation and index-first retrieval
- Packaging for distribution (bundle the Agent SDK binary via `asarUnpack`)
- Jira integration and project-status reports (via MCP)
- Optional per-project content versioning

## License

[MIT](LICENSE) — this project's own code. Dependencies retain their own licenses;
AI usage is governed by your own Claude subscription or Anthropic API terms.
