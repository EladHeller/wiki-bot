export function companiesWithMayaId() {
  return `SELECT ?entity ?entityLabel ?mayaId ?hebrewArticle WHERE {
        ?entity wdt:P10817 ?mayaId.  # Has MAYA site company ID

        ?hebrewArticle schema:about ?entity;
                        schema:isPartOf <https://he.wikipedia.org/>.  # Ensures article in Hebrew Wikipedia

        SERVICE wikibase:label { bd:serviceParam wikibase:language "he". }
    }`;
}

export function personWithBirthdayInDay(day: number, month: number) {
  return `SELECT ?person ?personLabel ?birthDate ?hebrewArticle WHERE {
        ?person wdt:P31 wd:Q5;  # Instance of human
                wdt:P569 ?birthDate.  # Birthdate
                
        FILTER(MONTH(?birthDate) = ${month} && DAY(?birthDate) = ${day})
        
        FILTER NOT EXISTS { ?person wdt:P570 ?deathDate }  # Exclude deceased people
      
        ?hebrewArticle schema:about ?person;
                       schema:isPartOf <https://he.wikipedia.org/>.
        
        SERVICE wikibase:label { bd:serviceParam wikibase:language "he". }
    }`;
}
