export function companiesWithMayaId() {
  return `SELECT ?entityId ?mayaId ?articleName WHERE {
      ?entity wdt:P10817 ?mayaId.  # Has MAYA site company ID

      ?article schema:about ?entity ; 
              schema:isPartOf <https://he.wikipedia.org/> ;   
              schema:name ?articleName . 

      BIND(STRAFTER(STR(?entity), "entity/") AS ?entityId)  # Extract only QID
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
