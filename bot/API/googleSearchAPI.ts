import { logger } from '../utilities/logger';

const { GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX } = process.env;
let isGoogleSearchEnabled = true;
export default async function googleSearch(searchText: string): Promise<string | null> {
  if (!isGoogleSearchEnabled) {
    logger.logWarning('Google Search is disabled');
    return null;
  }
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
    throw new Error('Missing Google Search API credentials');
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.append('key', GOOGLE_SEARCH_API_KEY);
    url.searchParams.append('cx', GOOGLE_SEARCH_CX);
    url.searchParams.append('q', searchText);
    url.searchParams.append('num', '1');

    const response = await fetch(url.toString());
    if (!response.ok) {
      try {
        const body = await response.json();
        logger.logError(body);
      } catch {
        // Ignore JSON parse error
      }
      if (response.status === 429) {
        isGoogleSearchEnabled = false;
      }
      logger.logError(`HTTP error! status: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    const { items } = data;
    if (items && items.length > 0) {
      return items[0].link;
    }
    return null;
  } catch (error) {
    logger.logError(`Error searching for ${searchText}: ${error.message}`);
    throw error;
  }
}
