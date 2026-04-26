import { logger } from './logger';

export default function validateDataChanges(
  oldData: Record<string, string>,
  newData: Record<string, any>,
  templateName: string,
  deletionThreshold = 20,
  warningThreshold = 10,
): void {
  const oldKeys = Object.keys(oldData);
  const newKeys = Object.keys(newData);
  const oldCount = oldKeys.length;
  const newCount = newKeys.length;

  if (oldCount === 0) {
    return;
  }

  const deletedCount = oldCount - newCount;
  const deletionPercentage = (deletedCount / oldCount) * 100;
  const exceedsDeletionThreshold = (deletedCount * 100) > (oldCount * deletionThreshold);
  const exceedsWarningThreshold = (deletedCount * 100) > (oldCount * warningThreshold);

  if (exceedsDeletionThreshold) {
    throw new Error(
      `Deleted ${deletionPercentage.toFixed(1)}% of records in ${templateName} (${deletedCount} out of ${oldCount}). Exceeds ${deletionThreshold}% threshold, aborting update.`,
    );
  }

  if (exceedsWarningThreshold) {
    logger.logWarning(
      `Warning: Deleted ${deletionPercentage.toFixed(1)}% of records in ${templateName} (${deletedCount} out of ${oldCount}).`,
    );
  }
}
