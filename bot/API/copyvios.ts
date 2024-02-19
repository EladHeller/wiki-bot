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
        url?: string;
        confidence: number;
        violation: CopyViolaionRank;
    };
    sources?: {
        url?: string;
        confidence: number;
        violation: CopyViolaionRank;
        skipped: boolean;
        excluded: boolean;
    }[];
}

export default async function checkCopyViolations(
  title: string,
  lang: string,
  url?: string,
): Promise<CopyViolationRespons> {
  const sharedParams = `version=1&project=wikipedia&lang=${lang}&title=${encodeURIComponent(title)}`;
  if (url) {
    const res = await fetch(`${baseUrl}?action=compare&${sharedParams}&url=${encodeURIComponent(url)}`);

    return res.json();
  }
  const res = await fetch(`${baseUrl}?action=search&${sharedParams}`);

  return res.json();
}
