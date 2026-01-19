import fs from 'fs';
import path from 'path';

/**
 * Calculates the distance between two coordinates in meters using the Haversine formula.
 */
function calculateDistance(coord1: { lat: number; lon: number }, coord2: { lat: number; lon: number }): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = coord1.lat * Math.PI / 180;
    const φ2 = coord2.lat * Math.PI / 180;
    const Δφ = (coord2.lat - coord1.lat) * Math.PI / 180;
    const Δλ = (coord2.lon - coord1.lon) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function formatCoord(lat: number, lon: number): string {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function getWikidataId(idUrl?: string): string | undefined {
    if (!idUrl) return undefined;
    return idUrl.split('/').pop();
}

async function main() {
    const outputWiki = './report.wiki';
    let report = '';

    // Handle name matches (Wikidata label matches Wikipedia title)
    const nameMatchesPath = './wikidata_and_wikipedia.json';
    if (fs.existsSync(nameMatchesPath)) {
        console.log('Generating report for name matches...');
        const data = JSON.parse(fs.readFileSync(nameMatchesPath, 'utf-8'));
        report += '== הכללות שם (ויקיפדיה וויקינתונים עם אותו שם) ==\n';
        for (const entry of data) {
            const wikiTitle = entry.wikipedia.title;
            const wd = entry.wikidata;
            const wdLink = `[[d:${wd.item}|${wd.label}]]`;

            for (const wikiCoord of entry.wikipedia.coords) {
                const distance = calculateDistance({ lat: wd.lat, lon: wd.lon }, wikiCoord);
                // Format: # [[WikiTitle]] lat, lon. ויקינתונים - [[d:QID|Label]] lat, lon. מרחק distance.
                report += `# [[${wikiTitle}]] ${formatCoord(wikiCoord.lat, wikiCoord.lon)}. ויקינתונים - ${wdLink} ${formatCoord(wd.lat, wd.lon)}. מרחק ${distance.toFixed(2)}.\n`;
            }
        }
    }

    // Handle proximity duplicates
    const duplicatesPath = './duplicates.json';
    if (fs.existsSync(duplicatesPath)) {
        console.log('Generating report for proximity duplicates...');
        const data = JSON.parse(fs.readFileSync(duplicatesPath, 'utf-8'));
        report += '\n== כפילויות (מרחק קטן מ-100 מטר) ==\n';
        for (const duplicate of data) {
            const e1 = duplicate.entry1;
            const e2 = duplicate.entry2;

            const formatEntry = (e: any) => {
                const wdId = getWikidataId(e.id);
                const nameLink = wdId ? `[[d:${wdId}|${e.name}]]` : `[[${e.name}]]`;
                const sourceLabel = e.source === 'wikidata' ? 'ויקינתונים' : 'ויקיפדיה';
                return `${sourceLabel} - ${nameLink} ${formatCoord(e.lat, e.lon)}`;
            };

            report += `# [[${e1.name}]] ${formatCoord(e1.lat, e1.lon)}. ${formatEntry(e2)}. מרחק ${duplicate.distance}.\n`;
        }
    }

    fs.writeFileSync(outputWiki, report);
    console.log(`Successfully generated Wikipedia report in: ${outputWiki}`);
}

main().catch(console.error);
