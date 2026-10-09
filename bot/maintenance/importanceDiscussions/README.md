# Daily importance discussions

The Lambda is scheduled once daily at 10:00 UTC. It uses the existing logging and
Sabbath/holiday wrapper. Reserved concurrency is one.

The deployment initially sets `IMPORTANCE_DISCUSSIONS_DRY_RUN=true`: candidates
are reported in the regular bot run log without modifying talk pages or state.
Set it to the exact value `false` in the deployment configuration to enable edits
after reviewing the reports. No wiki template changes are required.

The bot scans mainspace and article talk pages transcluding the substituted
importance template or either of its two entry templates. Restoration discussions,
multiple templates, redirects and unreadable history require manual review.
History identifies the placer and timestamp of the current uninterrupted template
placement; templates younger than 30 minutes or at least seven days old are skipped.
A declared template date that differs from the placement date is left for manual
review, so a restored old template does not silently start a new week.
History scanning is capped at 500 revisions per source page.

Before opening a section, it compares the talk page with its revision from one day
before placement, including discussions started before the template was added.
An unchanged old discussion does not block a new one. A changed section mentioning
importance, or a template already inside a section, counts as an existing discussion.
Other new or changed text is ambiguous and is reported for manual review. This is
conservative text matching, not a guarantee of semantic discussion recognition.

New sections include the article name, original placement date in Israel, placer
mention, source diff and bot signature. The creator is not automatically mentioned.
Source and talk revisions are rechecked before saving. Existing talk pages are saved
with `baserevid`, and missing pages with `createonly` through the existing API helpers.

Persistent JSON state lives at `User:<BOT_NAME>/בוט חשיבות/מצב` (Hebrew user namespace).
Each key is `<source page ID>:<placement revision ID>`. A `pending` claim is saved
before any talk edit, then changed to `done` after confirmed success. Existing
manual discussions are also recorded as `done`. Neither status is automatically
retried, so deleted bot messages and uncertain network outcomes do not cause
repeated sections or mentions. If a run fails after claiming, inspect the talk
history: mark the entry `done` if it was written, or remove the entry to permit a
retry only after confirming no discussion was created. Do not erase state as routine
cleanup. State writes also use revision checks; corrupt state aborts the run.
