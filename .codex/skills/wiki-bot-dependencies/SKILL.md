---
name: wiki-bot-dependencies
description: Validates production dependency changes for wiki-bot Lambda compatibility. Use when editing package.json, upgrading npm packages, or adding production dependencies, especially jsdom.
---

# wiki-bot dependencies

## Lambda constraint

Production code runs on **AWS Lambda Node.js 24** (`nodejs24.x`). Dependencies must work in that runtime, not only on the dev machine.

## jsdom (known regression)

- Pinned stable range: `^26.1.0` (see `package.json`)
- `jsdom@28+` caused `ERR_REQUIRE_ESM` in Lambda; treat jsdom upgrades as high risk

## Required validation

After any change:

```bash
npm run test:ci
```
