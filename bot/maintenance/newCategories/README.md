# New categories

To find deleted categories whose surviving talk pages were created in a given year:

```typescript
const categories = await NewCategoriesModel(api).getDeletedCategoriesForTalkPagesCreatedIn(2026);
```

The function returns sorted, unique category titles. It searches category talk pages
by creation year, checks the corresponding category pages in batches, and verifies
that each missing category has a page-deletion log entry dated on or after the talk
page's earliest surviving revision. Deletions in later years are included. Existing
categories (including restored or recreated pages and redirects) are excluded.

This is a read-only function and is not called by the scheduled bot. It uses the
existing authenticated API instance. Errors propagate instead of returning a partial
report. Requests are sequential so API failures remain visible to the caller.

The report is based on current talk-page titles and visible history. It cannot find
talk pages that were themselves deleted, trace category renames, or prove deletions
whose log entries are hidden. A talk page's creation year does not establish the
category's creation year.
