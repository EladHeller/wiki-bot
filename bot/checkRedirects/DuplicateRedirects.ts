import { WikiPage } from '../types';
import { IWikiApi } from '../wiki/WikiApi';

// WIP
export default async function DuplicateRedirects(api: IWikiApi) {
  await api.login();
  const generator = api.getRedirectsFrom(0, 0, 50);
  let res: IteratorResult<WikiPage[], void> = { done: false, value: [] };
  do {
    try {
      res = await generator.next();
      if (res.value) {
        const releventPages = res.value?.filter((x) => x.links?.length === 1);

        const infos = await api.info(releventPages.map((x) => x.links?.[0].title ?? '').filter((x) => x));
        const redirectWithProblem = infos.filter((x) => x.missing || x.redirect);
        if (redirectWithProblem.length > 0) {
          console.log(redirectWithProblem);
        }
      }
    } catch (error) {
      console.log(error?.data || error?.message || error?.toString());
      if (global.continueObject) {
        console.log('continue', global.continueObject);
      }
    }
  } while (!res.done);
}
