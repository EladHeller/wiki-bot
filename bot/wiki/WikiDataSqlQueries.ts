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
