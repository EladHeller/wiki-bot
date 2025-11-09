export async function querySparql(query: string): Promise<Record<string, string>[]> {
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`, {
    headers: {
      'User-Agent': 'Sapper-bot/1.0 (https://he.wikipedia.org/wiki/User:Sapper-bot)',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to query sql: ${await res.text()}`);
  }
  const data = await res.json();
  console.debug(`Response returns from ${res.headers.get('x-served-by')} host`);
  return data.results.bindings.map(
    (binding: Record<string, { value: string }>) => Object.fromEntries(
      Object.entries(binding).map((entry) => [entry[0], entry[1].value]),
    ),
  );
}

function companiesWithMayaIdQuery() {
  return `
  SELECT ?entityId ?mayaId ?articleName WHERE {
    ?entity wdt:P10817 ?mayaId .
  
    OPTIONAL {
      ?article schema:about ?entity ;
               schema:name ?articleName ;
               schema:isPartOf <https://he.wikipedia.org/> .
    }
  
    BIND(STRAFTER(STR(?entity), "entity/") AS ?entityId) .
  
    SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en" ; }
  }`;
}

function personWithBirthdayInDayQuery(day: number, month: number) {
  return `
  SELECT ?person ?personLabel ?birthDate ?hebrewArticle WHERE {
    ?person wdt:P31 wd:Q5;
      wdt:P569 ?birthDate.
    FILTER(((MONTH(?birthDate)) = ${month} ) && ((DAY(?birthDate)) = ${day} ))
    FILTER(NOT EXISTS { ?person wdt:P570 ?deathDate. })
    ?hebrewArticle schema:about ?person;
      schema:isPartOf <https://he.wikipedia.org/>.
    SERVICE wikibase:label { bd:serviceParam wikibase:language "he". }
  }`;
}

function companiesWithTickerQuery() {
  return `SELECT ?companyId ?companyLabel ?exchangeLabel ?exchangeShortName ?ticker ?articleName WHERE {
      ?company p:P414 ?statement.
      ?statement ps:P414 ?exchange.
      OPTIONAL { ?statement pq:P249 ?ticker. }
      OPTIONAL { ?exchange wdt:P1813 ?exchangeShortName. }
  
      ?article schema:about ?company;
              schema:isPartOf <https://he.wikipedia.org/>;
              schema:name ?articleName.
  
      SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en". }
  
      BIND(STRAFTER(STR(?company), "entity/") AS ?companyId)
    }`;
}

export type CompaniesWithMayaIdResult = {
  entityId: string;
  mayaId: string;
  articleName?: string;
}

export async function companiesWithMayaId(): Promise<CompaniesWithMayaIdResult[]> {
  return querySparql(companiesWithMayaIdQuery()).then((results) => results.map((result) => ({
    entityId: result.entityId,
    mayaId: result.mayaId,
    articleName: result.articleName,
  })));
}

export type PersonWithBirthdayInDayResult = {
  person: string;
  personLabel: string;
  birthDate: string;
  hebrewArticle: string;
}
export async function personWithBirthdayInDay(day: number, month: number): Promise<PersonWithBirthdayInDayResult[]> {
  return querySparql(personWithBirthdayInDayQuery(day, month)).then((results) => results.map((result) => ({
    person: result.person,
    personLabel: result.personLabel,
    birthDate: result.birthDate,
    hebrewArticle: result.hebrewArticle,
  })));
}

export type CompaniesWithTickerResult = {
  companyId: string;
  companyLabel: string;
  exchangeLabel: string;
  exchangeShortName: string;
  ticker: string;
  articleName: string;
}

export async function companiesWithTicker(): Promise<CompaniesWithTickerResult[]> {
  return querySparql(companiesWithTickerQuery()).then((results) => results.map((result) => ({
    companyId: result.companyId,
    companyLabel: result.companyLabel,
    exchangeLabel: result.exchangeLabel,
    exchangeShortName: result.exchangeShortName,
    ticker: result.ticker,
    articleName: result.articleName,
  })));
}
