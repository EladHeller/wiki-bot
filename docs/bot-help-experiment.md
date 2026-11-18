# Bot help index experiment

This isolated spike evaluates a daily-snapshot design before adding a public help command. It never edits Wikipedia, reads AWS, changes the production vector store, or deploys a bot. The sample contains five public wiki pages, seven repository sources, and two short sets of verified archive rules.

Run `npm run build && node scripts/bot-help-experiment.mjs --prepare` to collect and validate a sample without an API key. Run `npm run build && node scripts/bot-help-experiment.mjs` with `OPENAI_API_KEY` to execute the hosted retrieval and answer experiment. `BOT_HELP_MODEL` defaults to the existing `gpt-4o-mini` baseline and can be overridden locally. The model comparison evaluated the generative benchmark with gpt-4o-mini and gpt-4.1-mini. CI now runs the read-only tag preview described below.

The GitHub Actions workflow uses the existing production environment solely to obtain `OPENAI_API_KEY`; it requests no AWS credentials, OIDC token or wiki password. Environment protection rules may require approval. The workflow runs on pushes to the experiment branch in the original repository.

The live run creates an isolated one-day-expiring vector store, uploads the selected sources, waits for indexing, and runs 13 Hebrew cases. The benchmark provides the known archiver as a topic label. Each case performs one top-five-chunk search, filtered by topic when known, and one answer call, capped at 600 output tokens. Retries are disabled. Generated answers and partial results are saved after every completed case. A `finally` block attempts to delete the temporary store and every uploaded file. Failed deletions are reported. These bounds limit work, not a guaranteed monetary charge; storage and model usage remain billable under the account's pricing.

The report separates expected-source hits and evidence-text hits from answer correctness. Multiple chunks may come from one source. The expected source lists allow alternatives rather than requiring every source. Cases requiring current information have no static retrieval denominator. Every answer includes a human review rubric. Six cases check both the example ID selected by the model and the exact copy-ready output. The model returns its explanation and an optional verified example ID in separate fields. The renderer wraps the selected example in nested code and nowiki tags. Model-authored template references are allowed, while direct embedding or HTML is recorded as a formatting failure.

The snapshot records source URLs, wiki revision IDs, code revision, timestamps and hashes internally. End-user instructions suppress those implementation details. The benchmark questions and rubrics are not uploaded to the vector store or supplied to the answering model. One case reads the current configuration and last revision timestamp for a public discussion page at run time. The configuration uses the same parser as the archiver. A separate case checks that the runner asks for the page before requesting a diagnosis when the benchmark has marked that context as required. The experiment does not check live activity logs or decide whether an individual discussion is eligible.

Outputs are written to `experiment-output/bot-help/`: `manifest.json`, `corpus.json`, `results.json` and `report.md`. These files are ignored by git; Actions retains an artifact for seven days. Do not interpret an incomplete run as a successful experiment.

Before connecting a public command, review all answers, add held-out paraphrases, and add topic detection and live tools for individual discussions. Daily incremental refresh and atomic index activation are subsequent work, not features demonstrated by this spike.

## Read-only tag preview

Run the preparation command above and then run `node scripts/bot-help-preview.mjs` with the OpenAI key. The preview feeds synthetic Hebrew Wikipedia mention notifications into the same command matcher used by the tag bot. It compares the original question set with new paraphrases and out-of-scope cases. The model only classifies the question. The program renders the reviewed answer and builds template references and copy-ready snippets. For the live timing case, the program uses the current public configuration that preparation collected.

The preview runner neither logs in to Wikipedia nor publishes a response. The ordinary tag handler registers the help command after deployment. It uses the existing permissions check and reads current configuration for timing questions. It covers the two archivers. Questions about an actual incident still need the specific discussion and evidence of the bot's activity.

## Documentation refresh

After merge, GitHub Actions builds the public help index on the initial push to master, on relevant source changes, and on Sundays at 07:25 UTC. The job uses the existing OpenAI secret. The tag bot discovers the newest ready index. The index covers an explicit list of public documentation pages, maintenance instructions, and archive templates. Live archive rules and page-specific activity are outside the snapshot.

Each refresh fingerprints the content. An unchanged snapshot requires no uploads. A new snapshot reattaches unchanged files and uploads changed documents. It becomes visible only after every document has been processed. The prior snapshot is retained while the replacement indexes, and the latest two ready snapshots are retained after publication. Known archive answers run without the documentation index. When the documentation index is unavailable or offers no supported answer, the command falls back to its existing clarification.

The branch workflow validates the refresh using a randomly named disposable index. It tests the initial refresh, a no-op refresh, a change to one file, and retrieval for a documented bot operation.
