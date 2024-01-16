const baseUrl = 'https://copyvios.toolforge.org/api.json';

export type CopyViolaionRank = 'suspected' | 'possible' | 'none';

export type CopyViolationRespons = {
    status: 'ok' | 'error';
    error?: {
        code: string;
        info: string;
    }
    meta: {
        time: number;
        queries: number;
        cached: boolean;
        redirected: boolean;
    };
    page: {
        title: string;
        url: string;
    };
    best?: {
        url: string;
        confidence: number;
        violation: CopyViolaionRank;
    };
    sources: {
        url: string;
        confidence: number;
        violation: CopyViolaionRank;
        skipped: boolean;
        excluded: boolean;
    }[];
}

export default async function checkCopyViolations(title: string, lang = 'he'): Promise<CopyViolationRespons> {
  const res = await fetch(`${baseUrl}?version=1&action=search&project=wikipedia&lang=${lang}&title=${encodeURIComponent(title)}`);

  return res.json();
}
