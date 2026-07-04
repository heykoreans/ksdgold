import { fetchNaverMetalPrices } from '../lib/parseNaverMetalPrices.js';

function inRange(value, min, max) {
  return value >= min && value <= max;
}

async function main() {
  const data = await fetchNaverMetalPrices();

  console.log(JSON.stringify(data, null, 2));
  console.log('');

  const goldOk =
    inRange(data.gold.perGram, 198000, 205000) &&
    inRange(data.gold.perDon, 742000, 770000);
  const silverOk =
    inRange(data.silver.perGram, 2800, 2950) &&
    inRange(data.silver.perDon, 10500, 11100);

  console.log('Validation (approximate ranges):');
  console.log(
    `  gold   perGram=${data.gold.perGram.toLocaleString()} perDon=${data.gold.perDon.toLocaleString()} => ${goldOk ? 'OK' : 'OUT OF RANGE (market may have moved)'}`
  );
  console.log(
    `  silver perGram=${data.silver.perGram.toLocaleString()} perDon=${data.silver.perDon.toLocaleString()} => ${silverOk ? 'OK' : 'OUT OF RANGE (market may have moved)'}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
