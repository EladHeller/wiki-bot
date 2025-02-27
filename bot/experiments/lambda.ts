import WikiDataAPI from '../wiki/WikidataAPI';

const SANDBOX_ITEM = 'Q4115189';
const ELEVATION_ABOVE_SEA_LEVEL_ID = 'P2044';
// eslint-disable-next-line no-empty-function
export async function main() {
  const api = WikiDataAPI();
  await api.login();
  const claims = await api.getClaim(SANDBOX_ITEM, ELEVATION_ABOVE_SEA_LEVEL_ID);
  const currentClaim = claims[0];
  if (claims.length !== 1) {
    throw new Error('Claim is not valid');
  }
  const currentLevel = Number(currentClaim.mainsnak.datavalue.value.amount);
  const newLevel = Number(-208);

  if (Math.abs(currentLevel - newLevel) < 0.02) {
    console.log('No need to update wikidata');
    return;
  }
  const revId = await api.getRevId(SANDBOX_ITEM);
  currentClaim.mainsnak.datavalue.value.amount = newLevel.toString();
  if (currentClaim.references?.[0].snaks?.P813[0].datavalue.value.time) {
    const now = new Date();
    now.setHours(0);
    now.setMinutes(0 - now.getTimezoneOffset());
    now.setSeconds(0);
    const formatted = `+${now.toISOString().replace(/\.\d{3}Z$/, 'Z')}`;
    currentClaim.references[0].snaks.P813[0].datavalue.value.time = formatted;
  }
  const updateRes = await api.setClaim(currentClaim, 'Update Sea of Galilee elevation', revId);
  if (updateRes.success !== 1) {
    throw new Error('Failed to update wikidata');
  }
  console.log(updateRes);
}

export default main;
