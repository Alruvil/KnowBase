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

KnowBase pairs a familiar markdown editor (file tree, live-styled CodeMirror, autosave) with
an AI assistant that reads, writes, and reasons about your notes from inside the app — scoped
per project, with every change reversible via git.

See **[FEATURES.md](FEATURES.md)** for the full, up-to-date feature list.

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
│   ├── index-service.ts    # _index.json diffing (mtime-based) and update-prompt builder
│   ├── settings.ts         # root dir, auth mode/token, model
│   └── logger.ts           # file logger (~/.config/knowledge-app/knowledge-app.log)
├── preload/      # typed contextBridge API (window.api)
├── renderer/     # React UI
│   └── src/
│       ├── App.tsx
│       ├── components/     # FileTree, Editor, Console, Breadcrumb, MarkdownToolbar,
│       │                   #   MarkdownPreview, SettingsModal, StatusBar
│       └── lib/            # markdown-commands, mention, render-markdown (pure, tested)
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
- `render-markdown` — markdown → HTML (headings, links, GFM tables) and HTML → plain text
- `index-service` — `_index.json` parsing and the mtime-based changed/unchanged/removed diff

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
- **Indexes are per-folder and non-recursive** — a folder's `_index.json` covers only files directly in it, not subfolders (each subfolder has its own).

## Roadmap

Ideas and deferred work live in **[ROADMAP.md](ROADMAP.md)** — add to it rather than letting
ideas live only in conversation.

## Changelog

What actually shipped in each version: **[CHANGELOG.md](CHANGELOG.md)**.

## License

[MIT](LICENSE) — this project's own code. Dependencies retain their own licenses;
AI usage is governed by your own Claude subscription or Anthropic API terms.
