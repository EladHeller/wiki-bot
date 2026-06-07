# wiki-bot

Hebrew Wikipedia/Wikidata bot on AWS Lambda (`nodejs24.x`). Read `package.json`, `tsconfig.json`, and `.eslintrc.yml` for stack, layout, and lint rules.

## Style (team preference, not in linter)

- No comments or JSDoc unless truly necessary
- Prefer functional style (map/filter/reduce over imperative loops)
- Hebrew only in user-facing messages; not in logs or docs
- Production: `console` for informational messages only; errors and warnings via `logger`
- All new logic needs unit tests; aim for 100% coverage and never reduce coverage on existing tests

## When to load skills

- `wiki-bot-dependencies`: changing `package.json` or production dependencies
- `wiki-bot-editing`: wiki markup, templates, MediaWiki/Wikidata API behavior
