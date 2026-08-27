export function formatLinkCount(count: number): string {
  return count === 1 ? 'קישור אחד' : `${count} קישורים`;
}

export function formatBrokenLinkCount(count: number): string {
  return count === 1
    ? 'קישור אחד נמצא לא תקין'
    : `${count} קישורים נמצאו לא תקינים`;
}

export function formatQueuedLinkCount(count: number): string {
  return count === 1
    ? 'קישור אחד נשלח לבדיקה ברקע'
    : `${count} קישורים נשלחו לבדיקה ברקע`;
}

export function formatUnverifiedLinkCount(count: number): string {
  return count === 1
    ? 'קישור אחד לא ניתן לאימות'
    : `${count} קישורים לא ניתנים לאימות`;
}

export function addHebrewConjunction(count: number, text: string): string {
  return `${count === 1 ? 'ו' : 'ו־'}${text}`;
}
