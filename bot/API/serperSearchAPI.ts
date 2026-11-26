import { logger } from '../utilities/logger';

interface SerperSearchResponse {
  organic?: { link: string }[];
}

export default async function serperSearch(searchText: string, site?: string): Promise<string | null> {
  const { SERPER_API_KEY } = process.env;
  if (!SERPER_API_KEY) {
    throw new Error('Missing Serper Search API credentials');
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: site ? `site:${site.replace(/^\*\./, '')} ${searchText}` : searchText,
        num: 1,
        gl: 'il',
        hl: 'he',
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Serper Search HTTP error! status: ${response.status}`);
    }

    const data: SerperSearchResponse = await response.json();
    return data.organic?.[0]?.link ?? null;
  } catch (error) {
    logger.logError(`Error searching Serper for ${searchText}: ${error.message}`);
    throw error;
  }
}
