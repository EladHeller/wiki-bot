import NewWikiApi, { IWikiApi } from '../wiki/NewWikiApi';
import { getArguments } from './getArguments';

export interface CallbackArgs {
    wikiApi?: IWikiApi;
}
const injetionDictionary = {
  wikiApi: () => NewWikiApi(),
} satisfies Record<keyof CallbackArgs, (...args: any[]) => any>;

const implemtationDictionary: Partial<Record<keyof CallbackArgs, any>> = {};

export default function injectionDecorator<R>(
  cb: (args?: CallbackArgs) => R,
  overrideInjetionDictionary?: typeof injetionDictionary, // For testing
  overrideImplemtationDictionary?: typeof implemtationDictionary, // For testing
) {
  const currentImplemtationDictionary = overrideImplemtationDictionary ?? implemtationDictionary;
  const currentInjetionDictionary = overrideInjetionDictionary ?? injetionDictionary;
  return async function injection(): Promise<R> {
    let actualArgs: CallbackArgs | null = null;
    if (cb.length > 0) {
      const [callbackArgs] = getArguments(cb);
      if (callbackArgs instanceof Array) {
        const argsDictoary = {} satisfies CallbackArgs;
        callbackArgs.forEach((arg) => {
          if (arg in currentInjetionDictionary) {
            argsDictoary[arg] = currentImplemtationDictionary[arg] ?? currentInjetionDictionary[arg]();
            currentImplemtationDictionary[arg] = argsDictoary[arg];
          }
        });
        actualArgs = argsDictoary;
      }
    }

    return cb(actualArgs ?? undefined);
  };
}
