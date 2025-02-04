#!/usr/bin/env bash

ONE_YEAR_AGO=$(date -v-1y +%s)

for pkg in $(jq -r '.dependencies, .devDependencies | keys[]' package.json); do
  latest=$(npm show "$pkg" version 2>/dev/null || echo '')
  lastModified=$(npm view "$pkg" time["$latest"] 2>/dev/null || echo '')
  # echo "$pkg: $latest ($lastModified)"
  if [[ -n "$lastModified" ]]; then
    stripped=$(echo "$lastModified" | sed -E 's/\.[0-9]+Z$/Z/')
    pkgTimestamp=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$stripped" +%s 2>/dev/null || echo 0)
    if [[ $pkgTimestamp -lt $ONE_YEAR_AGO ]]; then
      timeDiffSeconds=$(($(date +%s) - pkgTimestamp))
      timeDiffMonts=$((timeDiffSeconds / 86400 / 30))
      echo "$pkg was last updated $timeDiffMonts months ago ($lastModified)"
    fi
  fi
done