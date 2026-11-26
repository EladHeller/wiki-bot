import Exa from 'exa-js';

const exa = new Exa(process.env.EXA_API_KEY);

export default async function exaSearch(title: string, domains?: string[]) {
  const response = await exa.search(title, {
    type: 'lite',
    includeDomains: domains,
    numResults: 10,
  });

  return response.results.map((result) => ({
    url: result.url,
    title: result.title,
  }));
}
