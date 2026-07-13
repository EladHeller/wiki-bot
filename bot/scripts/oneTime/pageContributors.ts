import { IWikiApi } from '../../wiki/WikiApi';
import { Revision } from '../../types';

export default async function pageContributors(
  api: IWikiApi,
  pageTitle: string,
  max = 1000,
): Promise<Record<string, number>> {
  const revisions: Revision[] = [];
  for await (const batch of api.getArticleRevisions(pageTitle, 500, 'user')) {
    revisions.push(...batch);
    if (revisions.length >= max) {
      break;
    }
  }

  if (revisions.length === 0) {
    throw new Error(`Page "${pageTitle}" not found.`);
  }

  const userContributions: Record<string, number> = {};
  for (const rev of revisions) {
    const user = rev.user ?? 'Unknown/Hidden';
    userContributions[user] = (userContributions[user] || 0) + 1;
  }

  return userContributions;
}
