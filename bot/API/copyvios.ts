const baseUrl = 'https://copyvios.toolforge.org/api.json';

export type CopyViolaionRank = 'suspected' | 'possible' | 'none';

export type CopyViolationResponse = {
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
): Promise<CopyViolationResponse> {
  const sharedParams = `version=1&project=wikipedia&lang=${lang}&title=${encodeURIComponent(title)}`;
  if (url) {
    const res = await fetch(`${baseUrl}?action=compare&${sharedParams}&url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
    });

    return res.json();
  }

  const res = await fetch(`${baseUrl}?action=search&${sharedParams}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
  });
  return res.json();
}
