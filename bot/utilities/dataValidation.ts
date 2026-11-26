import { logger } from './logger';

export function validateCountChanges(
  oldCount: number,
  newCount: number,
  recordName: string,
  deletionThreshold = 20,
  warningThreshold = 10,
): void {
  if (oldCount === 0) {
    return;
  }

  const deletedCount = oldCount - newCount;
  const deletionPercentage = (deletedCount / oldCount) * 100;
  const exceedsDeletionThreshold = (deletedCount * 100) > (oldCount * deletionThreshold);
  const exceedsWarningThreshold = (deletedCount * 100) > (oldCount * warningThreshold);

  if (exceedsDeletionThreshold) {
    throw new Error(
      `Deleted ${deletionPercentage.toFixed(1)}% of records in ${recordName} (${deletedCount} out of ${oldCount}). Exceeds ${deletionThreshold}% threshold, aborting update.`,
    );
  }

  if (exceedsWarningThreshold) {
    logger.logWarning(
      `Warning: Deleted ${deletionPercentage.toFixed(1)}% of records in ${recordName} (${deletedCount} out of ${oldCount}).`,
    );
  }
}

export default function validateDataChanges(
  oldData: Record<string, string>,
  newData: Record<string, any>,
  templateName: string,
  deletionThreshold?: number,
  warningThreshold?: number,
): void {
  validateCountChanges(
    Object.keys(oldData).length,
    Object.keys(newData).length,
    templateName,
    deletionThreshold,
    warningThreshold,
  );
}
