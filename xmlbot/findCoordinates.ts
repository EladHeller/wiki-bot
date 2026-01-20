import { parseStringPromise } from 'xml2js';
import fs from 'fs';
import { findTemplates, getTemplateArrayData } from '../bot/wiki/newTemplateParser';

const coordinateTemplateName = 'coord';
const startCaseTemplateName = 'Coord';

type WikidataItem = {
  item: string;
  itemLabel: string;
  coord: string; // "Point(lon lat)"
};

type Page = {
  title?: string[];
  revision?: { text?: { _: string }[] }[];
};

type WikiCoordEntry = {
  title: string;
  coords: { lat: number; lon: number }[];
};

type LocationEntry = {
  source: 'wiki' | 'wikidata';
  name: string;
  id?: string;
  lat: number;
  lon: number;
};

// Parse Wikidata coordinate format "Point(longitude latitude)"
function parseWikidataCoord(coordString: string): { lat: number; lon: number } | null {
  const match = coordString.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!match) return null;
  return { lon: parseFloat(match[1]), lat: parseFloat(match[2]) };
}

function parseWikiCoord(templateParams: string[]): { lat: number; lon: number } | null {
  if (templateParams.length === 0) return null;
  const params = templateParams.filter(p => p && !p.includes('='));
  if (params.length === 0) return null;

  if (params.length >= 8) {
    const latDeg = parseFloat(params[0]), latMin = parseFloat(params[1]), latSec = parseFloat(params[2]), latDir = params[3].toUpperCase();
    const lonDeg = parseFloat(params[4]), lonMin = parseFloat(params[5]), lonSec = parseFloat(params[6]), lonDir = params[7].toUpperCase();
    if (!isNaN(latDeg) && !isNaN(latMin) && !isNaN(latSec) && (latDir === 'N' || latDir === 'S') &&
      !isNaN(lonDeg) && !isNaN(lonMin) && !isNaN(lonSec) && (lonDir === 'E' || lonDir === 'W')) {
      const lat = latDeg + latMin / 60 + latSec / 3600;
      const lon = lonDeg + lonMin / 60 + lonSec / 3600;
      return { lat: latDir === 'S' ? -lat : lat, lon: lonDir === 'W' ? -lon : lon };
    }
  }
  if (params.length >= 6) {
    const latDeg = parseFloat(params[0]), latMin = parseFloat(params[1]), latDir = params[2].toUpperCase();
    const lonDeg = parseFloat(params[3]), lonMin = parseFloat(params[4]), lonDir = params[5].toUpperCase();
    if (!isNaN(latDeg) && !isNaN(latMin) && (latDir === 'N' || latDir === 'S') &&
      !isNaN(lonDeg) && !isNaN(lonMin) && (lonDir === 'E' || lonDir === 'W')) {
      const lat = latDeg + latMin / 60, lon = lonDeg + lonMin / 60;
      return { lat: latDir === 'S' ? -lat : lat, lon: lonDir === 'W' ? -lon : lon };
    }
  }
  if (params.length >= 2) {
    const lat = parseFloat(params[0]), lon = parseFloat(params[1]);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
  }
  return null;
}

function calculateDistance(coord1: { lat: number; lon: number }, coord2: { lat: number; lon: number }): number {
  const R = 6371000;
  const φ1 = coord1.lat * Math.PI / 180, φ2 = coord2.lat * Math.PI / 180;
  const Δφ = (coord2.lat - coord1.lat) * Math.PI / 180, Δλ = (coord2.lon - coord1.lon) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

console.debug = () => { };

async function main() {
  const intermediateFiles: string[] = [];
  let currentWikiCoords: WikiCoordEntry[] = [];

  console.log('--- Phase 1: Collecting Wikipedia Coordinates ---');
  for (let i = 0; i <= 18; i += 1) {
    console.log(`Processing chunk ${i}...`);
    const chunk = fs.readFileSync(`./data${i}.xml`, 'utf-8');
    const xml = await parseStringPromise(`<xml>${chunk}</xml>`);

    xml.xml.page.forEach((page: Page) => {
      const text = page.revision?.[0]?.text?.[0]?._ || '';
      const title = page.title?.[0] || '';
      if (!text || !title || !text.match(/\{\{coord/i)) return;

      const templates = findTemplates(text, coordinateTemplateName, title)
        .concat(findTemplates(text, startCaseTemplateName, title));

      const pageCoords: { lat: number; lon: number }[] = [];
      for (const template of templates) {
        let params = getTemplateArrayData(template, coordinateTemplateName, title, true);
        if (params.length === 0) params = getTemplateArrayData(template, startCaseTemplateName, title, true);
        const coord = parseWikiCoord(params);
        if (coord) pageCoords.push(coord);
      }
      if (pageCoords.length > 0) currentWikiCoords.push({ title, coords: pageCoords });
    });

    if ((i + 1) % 3 === 0 || i === 18) {
      const filename = `wiki_coords_part_${Math.floor(i / 3)}.json`;
      fs.writeFileSync(filename, JSON.stringify(currentWikiCoords));
      intermediateFiles.push(filename);
      currentWikiCoords = [];
    }
  }

  console.log('\n--- Phase 2: Loading All Data ---');
  const allLocations: LocationEntry[] = [];
  const wikiTitlesMap = new Map<string, { lat: number; lon: number }[]>();

  for (const file of intermediateFiles) {
    const data: WikiCoordEntry[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const entry of data) {
      wikiTitlesMap.set(entry.title, entry.coords);
      for (const c of entry.coords) {
        allLocations.push({ source: 'wiki', name: entry.title, lat: c.lat, lon: c.lon });
      }
    }
  }

  const queryData: WikidataItem[] = JSON.parse(fs.readFileSync('./query.json', 'utf-8'));
  const wikidataEntries: { item: string; label: string; lat: number; lon: number }[] = [];
  for (const item of queryData) {
    const c = parseWikidataCoord(item.coord);
    if (c) {
      allLocations.push({ source: 'wikidata', name: item.itemLabel, id: item.item, lat: c.lat, lon: c.lon });
      wikidataEntries.push({ item: item.item, label: item.itemLabel, lat: c.lat, lon: c.lon });
    }
  }
  console.log(`Count: Wikipedia ${allLocations.filter(x => x.source === 'wiki').length}, Wikidata ${wikidataEntries.length}`);

  console.log('\n--- Task 1: Finding All Duplicates (Distance < 0.1m) ---');
  const duplicates: any[] = [];
  const DUPLICATE_THRESHOLD = 0.1;

  // Use a simple grid index for $O(N)$ candidate filtering
  // Round to ~6 decimal places (approx 0.1m)
  const grid = new Map<string, LocationEntry[]>();
  for (const loc of allLocations) {
    const key = `${loc.lat.toFixed(6)}|${loc.lon.toFixed(6)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(loc);
  }

  for (const [key, entries] of grid.entries()) {
    if (entries.length > 1) {
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          // Skip if both are from Wikidata
          if (entries[i].source === 'wikidata' && entries[j].source === 'wikidata') continue;

          // Skip if they have the same name (same Wiki page, or Wikidata item matching Wiki page title)
          if (entries[i].name === entries[j].name) continue;

          const d = calculateDistance(entries[i], entries[j]);
          if (d < DUPLICATE_THRESHOLD) {
            duplicates.push({ entry1: entries[i], entry2: entries[j], distance: d });
          }
        }
      }
    }
    // Also check neighboring grid cells if necessary, but at 0.1m threshold 
    // and 6 decimals, most true duplicates will land in the same bucket.
  }
  fs.writeFileSync('duplicates.json', JSON.stringify(duplicates, null, 2));

  console.log('\n--- Task 2: Matching by Label/Title ---');
  const nameMatches: any[] = [];
  for (const wd of wikidataEntries) {
    if (wikiTitlesMap.has(wd.label)) {
      nameMatches.push({
        wikidata: wd,
        wikipedia: { title: wd.label, coords: wikiTitlesMap.get(wd.label) }
      });
    }
  }
  fs.writeFileSync('wikidata_and_wikipedia.json', JSON.stringify(nameMatches, null, 2));

  console.log('Done!');
}

main();