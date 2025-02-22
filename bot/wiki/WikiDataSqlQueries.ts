export function companiesWithMayaId() {
  return `
SELECT ?entityId ?mayaId ?articleName WHERE {
  ?entity wdt:P10817 ?mayaId.
  ?article schema:about ?entity;
    schema:isPartOf <https://he.wikipedia.org/>;
    schema:name ?articleName.
  BIND(STRAFTER(STR(?entity), "entity/") AS ?entityId)
}`;
}

export function personWithBirthdayInDay(day: number, month: number) {
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

export function companiesWithTicker() {
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
