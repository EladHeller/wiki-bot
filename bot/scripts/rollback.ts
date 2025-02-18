import WikiApi from '../wiki/WikiApi';
import { asyncGeneratorMapWithSequence } from '../utilities';

export default async function rollback(
  editForRollbackSummary: string,
  rollbackSummary: string,
  hoursAgo: number,
  user: string,
) {
  const api = WikiApi();
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hoursAgo);
  const endTime = new Date();
  const contributionsGenereator = api.userContributes(user, startTime, endTime, 10);
  const failedRollbacks: string[] = [];
  let successCount = 0;
  await asyncGeneratorMapWithSequence(1, contributionsGenereator, (contribution) => async () => {
    if (contribution.comment !== editForRollbackSummary) {
      return;
    }
    try {
      await api.undo(contribution.title, rollbackSummary, contribution.revid);
      successCount += 1;
    } catch (error) {
      failedRollbacks.push(contribution.title);
      console.error('Failed to rollback', contribution.title, error.message || error.toString());
    }
  });
  console.log('Rollback finished', {
    successCount,
    failedRollbacksCount: failedRollbacks.length,
  });
  console.log('Failed rollbacks', JSON.stringify(failedRollbacks, null, 2));
}
