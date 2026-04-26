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

  if (deletionPercentage > deletionThreshold) {
    throw new Error(
      `Deleted ${deletionPercentage.toFixed(1)}% of records in ${templateName} (${deletedCount} out of ${oldCount}). Exceeds 20% threshold, aborting update.`,
    );
  }

  if (deletionPercentage > warningThreshold) {
    logger.logWarning(
      `Warning: Deleted ${deletionPercentage.toFixed(1)}% of records in ${templateName} (${deletedCount} out of ${oldCount}).`,
    );
  }
}
