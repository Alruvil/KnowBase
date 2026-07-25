# Changelog

All notable changes to KnowBase are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); this project uses [semantic
versioning](https://semver.org/).

## [Unreleased]

### Added

- **Diff viewer with per-file revert.** The status bar's new **View diff** button opens a layer
  listing every changed file (added/removed counts), with each file expandable into its actual
  unified diff. A **Revert file** action discards just that one file instead of everything —
  fixing the case where a global Revert would also wipe out unrelated manual edits made while
  the AI was working. Each file in a console diff summary is now a clickable link into the same
  view.

## [0.2.0] - 2026-07-25

### Added

- **Markdown preview + Copy HTML** — render a document to clean HTML (no markdown
  syntax visible) and copy it to the clipboard for pasting into WordPress or any
  rich-text editor.
- **Per-folder `_index.json`** — a one-click "Update index" action that asks the AI
  to build/refresh a folder's file→description index. Diffed by file modification
  time first, so only new or changed files get re-read and re-described — keeps
  updates cheap as a folder grows toward dozens or hundreds of files.
- **Proactive auth-status banner** — the console now shows a clear warning with a
  one-click link to Settings when no AI credentials are configured, instead of a
  silent failure on send.
- Richer diagnostic logging (`apiKeySource`, resolved env keys) for auth issues.
- `ROADMAP.md` — a dedicated home for deferred ideas (vector search, cross-cutting
  tag indexes, a stateful-session toggle, etc.), split out of the README.
- `CHANGELOG.md` (this file).

### Changed

- **AI calls are now stateless** — each turn depends only on the composed
  `_prompt.md` cascade, the files the agent reads (including `@`-referenced
  ones), and the console prompt text. No cross-turn memory. This also removes
  the SDK session-resume machinery entirely.
- `_index.md` → **`_index.json`** — switched the index format from a markdown
  bullet list to a JSON array, for robust parsing and more reliable AI output.
- README split further: the feature list already lived in `FEATURES.md`; the
  roadmap now lives in `ROADMAP.md`, keeping the README a short orientation doc.

### Fixed

- A bug where successful AI answers (with tokens billed) sometimes never
  rendered in the console — a React StrictMode double-invocation issue in the
  message-append logic.
- The "No conversation found with session ID" error (a side effect of session
  resume, now moot since sessions were removed).
- Native app menu (File/Edit/View/Window) removed — it added no value.

## [0.1.0] - 2026-07-23

Initial release: a markdown knowledge base with an embedded AI assistant.

### Added

- **Project-based file tree** — one root folder, each top-level folder a project;
  create/rename/delete files and folders, with quick-access hover actions.
- **Markdown editor** (CodeMirror 6) with Obsidian-style live styling, autosave, a
  formatting toolbar, and automatic reload when a file changes on disk (e.g. from
  an AI edit) — with conflict protection if you have unsaved changes.
- **Per-level AI instructions** — a `_prompt.md` at any project or folder level,
  cascading root → project → folder into the AI's system prompt via a config cog
  in the tree and editor breadcrumb.
- **AI console** powered by the Claude Agent SDK, scoped to a folder at a time —
  the AI reads/edits only within that scope. Supports `@` file references and
  follows the file you're editing (with manual re-scoping).
- **Flexible auth** — Claude subscription (OAuth), an existing Claude Code login,
  or an Anthropic API key, plus a model picker (default/Opus/Sonnet/Haiku).
- **Per-project conversation history** — persisted to disk, restored when you
  switch back to a project.
- **Git-backed content safety net** — the knowledge root is its own git repo,
  separate from the app's code. Auto-checkpoint before every AI call, a diff
  summary after, and a global Save/Revert bar for both AI and manual changes.
- **Diagnostics** — a file logger covering auth, AI turns, and errors, with a
  one-click reveal from Settings.
- Test suite (vitest) and MIT-licensed source.
