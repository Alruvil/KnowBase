# Features

The full, current feature list for KnowBase. See [README.md](README.md) for a general
introduction, requirements, and getting started.

## Files & projects

- One configurable **root folder** (default `~/Knowledge`); each top-level folder is a
  **project**. Change the root with the `⌂` button.
- File tree with create / rename / delete (deletes go to the system trash). Hover a folder for
  quick **＋ new file** / **⊞ new folder**; the top **＋** makes a new project.
- **Markdown editor** (CodeMirror 6) with Obsidian-style live styling — you see the markdown
  source, but headings, bold, code, links, etc. render inline. Autosaves ~0.6 s after you stop
  typing (and on `Ctrl/Cmd+S`).
- **Markdown toolbar** along the bottom of the editor: heading levels, bold / italic /
  strikethrough / inline code, link, bullet / numbered / task lists, quote, code block, table,
  divider.
- **Editor auto-reloads** when a file changes on disk (e.g. the AI edited it). If you have
  unsaved edits, it shows a **⟳ changed on disk — reload** button instead of clobbering your
  work.
- **Breadcrumb** above the editor (`Project › Folder › file`) with a config **⚙ cog** on each
  folder segment.

## Preview & publishing

- **Preview mode** — toggle between editing and a clean, rendered view of the current document
  via the **👁 Preview** button in the editor header. No markdown syntax visible — headings,
  bold, links, lists, and tables render as real formatting. Reflects unsaved edits, not just
  what's on disk.
- **Copy HTML** — while in Preview, copies the rendered document to the clipboard as real HTML
  (with a plain-text fallback), so pasting into WordPress's editor, or any other rich-text
  target, preserves formatting instead of dumping raw markdown.
- Local image paths in notes don't resolve on an external site — upload images there separately.

## Per-level AI instructions

- Every folder/project has a **⚙ cog** (in the tree and the breadcrumb) that opens its
  `_prompt.md` — instructions for the AI at that level. These cascade **root → project →
  folder** into the assistant's system prompt.
- `_prompt.md` and `_index.md` are hidden from the tree (managed through the cog / tree
  actions instead).

## Indexes (`_index.md`)

- Every folder has a **🗂 Update index** action (hover the folder row, or right-click) that
  asks the AI to build or refresh that folder's `_index.md` — a one-line-per-file summary
  (`- \`file.md\` — description.`), non-recursive.
- **Token-frugal by design**: the app diffs the folder against the existing index by file
  modification time *before* asking the AI anything. Unchanged files are handed to the AI as
  already-correct descriptions — it never re-reads them. Only new or changed files get
  actually read and described, and removed files are dropped. This is what keeps updates
  cheap as a folder grows toward dozens or hundreds of files.
- The AI console already prefers checking `_index.md` (when present) over reading every file
  when it needs to find something relevant — see **AI console** below.

## AI console

- Runs the **Claude Agent SDK** scoped to the folder shown in the "Runs in" breadcrumb — the AI
  reads/edits only within that folder.
- The scope **follows the file you're editing**, but you can click a level to re-scope the AI
  independently (with a **↺ follow file** button to snap back). It's blocked at the root — the
  AI always works inside a project.
- Type **`@`** to reference a file (autocomplete over the current scope).
- **Conversation history per project**, saved to disk and restored when you switch back — so
  you can drift between projects and pick up where you left off.
- Each answer shows the **model used and token counts**.

## Content versioning (undo the AI)

- Your knowledge root is a **git repository** (separate from this app's code). Before every AI
  call the content is committed as a restore point.
- After a call, the console shows a **diff summary** (`✎ N files changed · +X −Y`, with the
  file list).
- The bottom **status bar** shows a **Save** / **Revert** pair whenever the content differs
  from the last commit (covers manual edits too). **Revert** drops everything back to the last
  commit; **Save** commits the current state as a new restore point. Conversation history is
  never versioned or lost on revert.

## Auth & settings (console ⚙)

- **Claude subscription (OAuth)** — recommended; uses your Pro/Max plan.
- **Existing Claude Code login** — reuse a `claude` login already on the machine.
- **Anthropic API key** — pay-per-use fallback.
- **Model** — Default (your plan) / Opus / Sonnet / Haiku.
- **Diagnostics** — path to the log file, with a Reveal button.
