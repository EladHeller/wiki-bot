export const hebrewMonthNames: Record<string, number> = {
  ינואר: 0,
  פברואר: 1,
  מרץ: 2,
  אפריל: 3,
  מאי: 4,
  יוני: 5,
  יולי: 6,
  אוגוסט: 7,
  ספטמבר: 8,
  אוקטובר: 9,
  נובמבר: 10,
  דצמבר: 11,
};

export function extractSignatureDates(paragraphContent: string): Date[] {
  const signatureRegex = /(\d{1,2}):(\d{2}),\s+(\d{1,2})\s+ב([א-ת]+)\s+(\d{4})/gu;

  return Array.from(paragraphContent.matchAll(signatureRegex))
    .map((match) => {
      const day = parseInt(match[3], 10);
      const monthName = match[4];
      const year = parseInt(match[5], 10);
      const monthIndex = hebrewMonthNames[monthName];

      return monthIndex != null ? new Date(year, monthIndex, day) : null;
    })
    .filter((date): date is Date => date != null)
    .sort((a, b) => a.getTime() - b.getTime());
}

export function extractLastSignatureDate(paragraphContent: string): Date | null {
  const dates = extractSignatureDates(paragraphContent);
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

export function extractFirstSignatureDate(paragraphContent: string): Date | null {
  const dates = extractSignatureDates(paragraphContent);
  return dates[0] ?? null;
}

export function isInactiveForDays(lastActivityDate: Date, days: number): boolean {
  const now = new Date();
  const diffInMs = now.getTime() - lastActivityDate.getTime();
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
  return diffInDays >= days;
}
