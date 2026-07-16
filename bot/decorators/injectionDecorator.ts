import WikiApi, { IWikiApi } from '../wiki/WikiApi';
import { getArguments } from './getArguments';

export interface CallbackArgs {
    wikiApi?: IWikiApi;
}
const injetionDictionary = {
  wikiApi: () => WikiApi(),
} satisfies Record<keyof CallbackArgs, (...args: any[]) => any>;

const implemtationDictionary: Partial<CallbackArgs> = {};

export default function injectionDecorator<R>(
  cb: (args: CallbackArgs) => R,
  overrideInjetionDictionary?: typeof injetionDictionary, // For testing
  overrideImplemtationDictionary?: typeof implemtationDictionary, // For testing
) {
  const currentImplemtationDictionary = overrideImplemtationDictionary ?? implemtationDictionary;
  const currentInjetionDictionary = overrideInjetionDictionary ?? injetionDictionary;
  return async function injection(): Promise<R | undefined> {
    let actualArgs: CallbackArgs | null = null;
    if (cb.length > 0) {
      const [callbackArgs] = getArguments(cb);
      if (callbackArgs instanceof Array) {
        const argsDictoary: CallbackArgs = {};
        callbackArgs.forEach((arg) => {
          if (arg in currentInjetionDictionary) {
            const injectionKey = arg as keyof CallbackArgs;
            argsDictoary[injectionKey] = currentImplemtationDictionary[injectionKey]
              ?? currentInjetionDictionary[injectionKey]();
            currentImplemtationDictionary[injectionKey] = argsDictoary[injectionKey];
          }
        });
        actualArgs = argsDictoary;
      }
    }

    return actualArgs ? cb(actualArgs) : (cb as () => R)();
  };
}
