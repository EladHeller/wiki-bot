---
name: editing
description: Guides Hebrew Wikipedia and Wikidata editing, parsing, and API usage in wiki-bot. Use when parsing or generating wikitext, templates, calling MediaWiki/Wikidata APIs, or working with Commons.
---

# wiki-bot wiki editing

## Parsing and generation

- Prefer existing helpers under `bot/wiki/` (e.g. `wikiParser.ts`) over ad-hoc parsing
- Be robust to formatting variations in real article text
- Template syntax (`{{Name|key=value}}`) is common — validate round-trips when generating or stripping templates

## APIs

- Reuse types from `bot/types.ts` (`WikiPage`, `WikiDataEntity`, `WikiApiConfig`, etc.)
- **Wikimedia Commons**: Hebrew Wikipedia credentials work there, but the bot may lack a bot flag — use `assertBot: false` in `WikiApiConfig` (see `bot/maintenance/aiGeneratedImages/index.ts`). Wikidata defaults already set this in `bot/wiki/WikidataAPI.ts`
- Secrets: `.env` via `tsx --env-file=.env` — never commit credentials
