import fs from 'fs';

function formatCoord(lat: number, lon: number): string {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function getWikidataId(idUrl?: string): string | undefined {
    if (!idUrl) return undefined;
    return idUrl.split('/').pop();
}

async function main() {
    const outputWiki = './duplicates.wiki';
    let report = '';

    const duplicatesPath = './duplicates.json';
    if (!fs.existsSync(duplicatesPath)) {
        console.error('duplicates.json not found');
        return;
    }

    console.log('Generating report for proximity duplicates...');
    const data = JSON.parse(fs.readFileSync(duplicatesPath, 'utf-8'));

    for (const duplicate of data) {
        const e1 = duplicate.entry1;
        const e2 = duplicate.entry2;

        const formatEntry = (e: any) => {
            const wdId = getWikidataId(e.id);
            const nameLink = wdId ? `[[d:${wdId}|${e.name}]]` : `[[${e.name}]]`;
            const sourceLabel = e.source === 'wikidata' ? 'ויקינתונים' : 'ויקיפדיה';
            return `${sourceLabel} - ${nameLink} ${formatCoord(e.lat, e.lon)}`;
        };
        if (!e1.name.startsWith('יחסי') && !e2.name.startsWith('יחסי') &&
            !e1.name.startsWith('טיוטה:') && !e2.name.startsWith('טיוטה:') &&
            !e1.name.startsWith('פורטל:') && !e2.name.startsWith('פורטל:') &&
            !e1.name.startsWith('ויקיפדיה:') && !e2.name.startsWith('ויקיפדיה:') &&
            !e1.name.startsWith('שיחה:') && !e2.name.startsWith('שיחה:') &&
            !e1.name.startsWith('שיחת ') && !e2.name.startsWith('שיחת ') &&
            !e1.name.startsWith('תבנית:') && !e2.name.startsWith('תבנית:')
        ) {
            report += `# ${formatEntry(e1)}. ${formatEntry(e2)}. מרחק ${duplicate.distance.toFixed(2)}.\n`;
        }
    }

    fs.writeFileSync(outputWiki, report);
    console.log(`Successfully generated duplicates report in: ${outputWiki}`);
}

main().catch(console.error);
