---
name: wiki-bot-editing
description: Guides Hebrew Wikipedia and Wikidata editing, parsing, and API usage in wiki-bot. Use when parsing or generating wikitext, templates, calling MediaWiki/Wikidata APIs, or working with Commons.
---

# wiki-bot wiki editing

## Parsing and generation

- Prefer existing helpers under `bot/wiki/` (e.g. `wikiParser.ts`) over ad-hoc parsing
- Be robust to formatting variations in real article text
- Template syntax (`{{Name|key=value}}`) is common; validate round-trips when generating or stripping templates

## Generator and collection style

- Prefer functional transformations (`map`, `filter`, `reduce`, `flatMap`, `Object.entries`, `Object.fromEntries`) over imperative loops when the logic is naturally a transformation, selection, grouping, or projection.
- When processing async generators, prefer `asyncGeneratorMapWithSequence` so generated items are transformed through the existing project helper instead of hand-written `for await` mapping loops.
- Use `asyncGeneratorMapWithSequence` especially when each yielded page/entity/revision needs async follow-up work, API enrichment, parsing, or conversion before being consumed downstream.
- Keep generator pipelines lazy where practical: transform yielded items as they flow through the pipeline instead of eagerly accumulating arrays unless later logic truly needs random access, sorting, deduplication, or total counts.
- If sequential behavior matters for wiki/API safety, rate limits, logging order, or deterministic edits, preserve that ordering explicitly. Do not replace sequential generator processing with broad parallelism unless the surrounding code already establishes that parallel calls are safe.
- Reserve explicit `for await` loops for cases with side effects that cannot be expressed cleanly as a transformation, such as early exits, edit submission with per-item error handling, or stateful batching. Even then, keep the body small and delegate parsing/transformation work to named functions.
- Avoid mixing parsing, API calls, filtering, and edit decisions in one loop. Prefer small pure helpers and pipeline-style composition so each step can be tested independently.

## APIs

- Prefer typed, reusable methods on `IWikiApi`/`WikiApi` over calling `api.request` from bot code. When an operation is missing, add or extend a generic WikiApi method, with tests and mocks. Reserve direct `api.request` calls for exceptionally specific operations that cannot reasonably be expressed by a generic method.

- Reuse types from `bot/types.ts` (`WikiPage`, `WikiDataEntity`, `WikiApiConfig`, etc.)
- **Wikimedia Commons**: Hebrew Wikipedia credentials work there, but the bot may lack a bot flag; use `assertBot: false` in `WikiApiConfig` (see `bot/maintenance/aiGeneratedImages/index.ts`). Wikidata defaults already set this in `bot/wiki/WikidataAPI.ts`
