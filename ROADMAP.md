# Roadmap

Ideas and planned work that aren't built yet. See [FEATURES.md](FEATURES.md) for what's
actually shipped. Entries here are things we've discussed and deliberately deferred — add to
this file rather than letting ideas live only in conversation.

## Search & retrieval

- **Cross-cutting tag indexes (faceted classification).** The per-folder `_index.json` is a
  hierarchical/enumerative classification — one physical place per file. Tags add an
  orthogonal facet: a file can belong to many topics regardless of which folder it lives in
  (like WordPress tags or library subject headings). This directly serves cross-folder /
  cross-project synthesis ("use everything I've written about leadership"), which the folder
  index alone can't. Proposed shape, consistent with the app's plain-file + deterministic-code
  philosophy: **YAML frontmatter in each file** (`tags: [leadership, management]`) as the
  source of truth (travels with content, survives moves, greppable, Obsidian/WordPress-
  compatible), plus a **derived aggregated tag index** (tag → files) built by scanning
  frontmatter with the same mtime-diff trick as the folder index — living higher up (project
  or knowledge root) since tags are inherently cross-folder. **The hard part is vocabulary
  hygiene** (the folksonomy failure mode: leadership/Leadership/leaders/mgmt drift): mitigate
  by surfacing the existing tag set for autocomplete and having the AI propose tags consistent
  with what already exists rather than inventing new ones. Complements rather than competes
  with the vector-DB idea below — tags = curated/precise/transparent, vectors = fuzzy/recall.
  (Idea from the user's library-science background.)
- **Vector database for semantic search.** Combined with the per-folder `_index.json` files,
  embeddings could meaningfully improve relevance and cut tokens further for cross-file
  questions — instead of the AI reading an index and guessing which files matter, a similarity
  search could point straight at them. Non-trivial: needs an embedding choice, a chunking
  strategy, a local vector store, and probably re-ranking. Deferred until there's a real,
  felt need for it (per the project's "don't build for potential" philosophy) — revisit once
  cross-file search over dozens+ files in a project actually feels slow or low-quality with
  the current index-first approach.
- **Index-first retrieval at scale.** The AI is already instructed to check `_index.json`
  before scanning a folder, but this hasn't been exercised on a folder with dozens+ files yet
  — validate it actually holds up as content grows, before reaching for anything heavier
  (like the vector DB above).

## AI configuration & observability

- **Stateful/session mode toggle.** Calls are currently stateless — each turn depends only on
  the `_prompt.md` cascade, referenced/read files, and the console prompt, with no memory of
  prior turns. This is the right default for "improve this artifact / answer over these files."
  A future setting could opt into a conversational session (SDK resume) for the occasional
  "iterate with me over several turns" flow. Deferred until that flow is actually wanted.
- **"View effective prompt" action.** A way to see, on demand, the exact composed system
  prompt for the current console scope (base instructions + every `_prompt.md` that
  contributed, in cascade order) — so it's possible to visually confirm a folder's prompt is
  actually being included, without trusting the log's character count alone.
- **Config-driven prompt cascade logic — considered, decided against for now.** The idea was
  a YAML/JSON file describing how folder prompts combine, so the logic is inspectable/editable
  outside code. Decided this doesn't actually address the real concern (silent, unnoticed
  breakage) — a bug in a config-interpreting engine is just as invisible as a bug in code, and
  the current cascade logic (`prompt-service.composeSystemPrompt`) is already covered by a
  test asserting order and inclusion. The "View effective prompt" action above is a more
  direct fix for the actual worry. Revisit only if a concrete need for user-editable prompt
  *logic* (not just prompt *content*, which `_prompt.md` already covers) shows up.

## Distribution & integrations

- **Packaging for distribution** — bundle the Agent SDK's native binary via `asarUnpack` so
  the app can ship as an installer instead of running from source. Deferred until there's a
  real non-developer user to hand it to.
- **Jira integration and project-status reports**, via MCP.

## Content versioning

- **Optional per-project content versioning** — Save/Revert are currently global to the whole
  content repo (all projects share one git history). Per-project scoping would be more
  precise but adds real complexity; revisit if the global scope ever actually causes a
  problem in practice.
