/* eslint-disable no-var, vars-on-top */

declare global {
  var continueObject: Record<string, string> | string | undefined;
  var injetionDictionary: { wikiApi: (...args: unknown[]) => unknown } | undefined;
}

export {};
