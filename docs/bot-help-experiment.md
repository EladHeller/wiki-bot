# Bot help index experiment

This isolated spike evaluates a daily-snapshot design before adding a public help command. It never edits Wikipedia, reads AWS, changes the production vector store, or deploys a bot. The sample contains five public wiki pages and seven repository sources covering both archivers, shared helpers and selected tests.

Run `npm run build && node scripts/bot-help-experiment.mjs --prepare` to collect and validate a sample without an API key. Run `npm run build && node scripts/bot-help-experiment.mjs` with `OPENAI_API_KEY` to execute the hosted retrieval and answer experiment. `BOT_HELP_MODEL` defaults to the existing `gpt-4o-mini` baseline and can be overridden explicitly for a separate comparison.

The GitHub Actions workflow uses the existing production environment solely to obtain `OPENAI_API_KEY`; it requests no AWS credentials, OIDC token or wiki password. Environment protection rules may require approval. It accepts same-repository pull requests from the experiment branch, plus explicit manual runs once the workflow is on the default branch.

The live run creates an isolated one-day-expiring vector store, uploads the selected sources, waits for indexing, and runs 12 Hebrew cases. Each case performs one top-five-chunk search and one answer call, capped at 600 output tokens. Retries are disabled. Generated answers and partial results are saved after every completed case. A `finally` block attempts to delete the temporary store and every uploaded file. Failed deletions are reported. These bounds limit work, not a guaranteed monetary charge; storage and model usage remain billable under the account's pricing.

The report separates expected-source hits and evidence-text hits from answer correctness. Multiple chunks may come from one source. The expected source lists allow alternatives rather than requiring every source. Cases requiring current information have no static retrieval denominator. Every answer includes a human review rubric. A keyword match is never an answer-quality score.

The snapshot records source URLs, wiki revision IDs, code revision, timestamps and hashes internally. End-user instructions suppress those implementation details. The benchmark questions and rubrics are not uploaded to the vector store or supplied to the answering model. Wiki logs, user talk pages and user-specific settings are deliberately not indexed. The spike measures whether the model requests missing live information; it does not implement live tools yet.

Outputs are written to `experiment-output/bot-help/`: `manifest.json`, `corpus.json`, `results.json` and `report.md`. These files are ignored by git; Actions retains an artifact for seven days. Do not interpret an incomplete run as a successful experiment.

Before connecting a public command, review all answers, add held-out paraphrases, compare an explicitly selected alternative model, and implement live context/tools. Daily incremental refresh and atomic index activation are subsequent work, not features demonstrated by this spike.
