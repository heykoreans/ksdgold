const TROY_OZ_TO_GRAM = 31.1034768;

const NAVER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://finance.naver.com/marketindex/',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

const ENDPOINTS = {
  goldDetail: 'https://finance.naver.com/marketindex/goldDetail.naver',
  marketIndexGold: 'https://finance.naver.com/marketindex/?tabSel=gold',
};

function decodeHtml(html) {
  return html.toString('latin1');
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function parseNumber(text) {
  if (text == null || text === '') return null;
  const normalized = String(text).replace(/,/g, '').replace(/[^\d.+-]/g, '');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractDealVal(html) {
  const match = html.match(/var\s+DEAL_VAL\s*=\s*([0-9.]+)/);
  return match ? parseNumber(match[1]) : null;
}

function extractReferenceRate(html) {
  const match = html.match(/class="th_ex13"[\s\S]*?<td[^>]*>\s*([0-9,]+(?:\.[0-9]+)?)/i);
  if (match) {
    return parseNumber(match[1]);
  }

  const fxMatch = html.match(/FX_USDKRW[\s\S]*?<td[^>]*class="num"[^>]*>\s*([0-9,]+(?:\.[0-9]+)?)/i);
  return fxMatch ? parseNumber(fxMatch[1]) : null;
}

function extractPreciousMetalsTable(html) {
  const sectionMatch = html.match(/class="h_gold"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);

  if (!sectionMatch) {
    throw new Error('Failed to locate precious metals table on Naver market index page');
  }

  return sectionMatch[1];
}

function parseMarketRow(tableHtml, marker) {
  const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const row = rows.find((entry) => entry.includes(marker));

  if (!row) {
    throw new Error(`Failed to locate ${marker} row on Naver market index page`);
  }

  const nums = [...row.matchAll(/<td[^>]*class="num"[^>]*>([\s\S]*?)<\/td>/gi)].map(
    (match) => stripTags(match[1])
  );

  if (nums.length < 3) {
    throw new Error(`Failed to parse ${marker} row values`);
  }

  const price = parseNumber(nums[0]);
  const change = parseNumber(nums[1]);
  const changeRate = parseNumber(nums[2]);

  if (price == null || change == null || changeRate == null) {
    throw new Error(`Failed to parse numeric values for ${marker}`);
  }

  const direction =
    row.includes('class="down"') || row.includes('ico_down') ? -1 : 1;

  return {
    price,
    change: direction * Math.abs(change),
    changeRate: direction * Math.abs(changeRate),
  };
}

function toDomesticGramPrice(usdPerOz, usdKrw) {
  return Math.round((usdPerOz * usdKrw) / TROY_OZ_TO_GRAM);
}

function toDomesticChange(usdChange, usdKrw) {
  return Math.round(((usdChange * usdKrw) / TROY_OZ_TO_GRAM) * 100) / 100;
}

function buildMetalQuote({ perGram, change, changeRate }) {
  return {
    perGram,
    perDon: Math.round(perGram * 3.75),
    change,
    changeRate,
  };
}

async function fetchNaverHtml(url) {
  const response = await fetch(url, { headers: NAVER_HEADERS });

  if (!response.ok) {
    throw new Error(`Naver request failed (${response.status}) for ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('latin1');
}

function parseNaverMetalPrices(goldDetailHtml, marketIndexHtml) {
  const goldDetail = decodeHtml(goldDetailHtml);
  const marketIndex = decodeHtml(marketIndexHtml);

  const dealVal = extractDealVal(goldDetail);
  const usdKrw = extractReferenceRate(goldDetail);
  const metalsTable = extractPreciousMetalsTable(marketIndex);
  const goldRow = parseMarketRow(metalsTable, "ogo.glist', 'CMDT_GD'");
  const silverInternational = parseMarketRow(metalsTable, "ogo.glist', 'CMDT_SI'");

  if (usdKrw == null) {
    throw new Error('Failed to parse USD/KRW reference rate from Naver gold detail page');
  }

  const goldPerGram = dealVal ?? goldRow.price;

  return {
    gold: buildMetalQuote({
      perGram: goldPerGram,
      change: goldRow.change,
      changeRate: goldRow.changeRate,
    }),
    silver: buildMetalQuote({
      perGram: toDomesticGramPrice(silverInternational.price, usdKrw),
      change: toDomesticChange(silverInternational.change, usdKrw),
      changeRate: silverInternational.changeRate,
    }),
    updatedAt: new Date().toISOString(),
    source: 'naver',
  };
}

async function fetchNaverMetalPrices() {
  const [goldDetailHtml, marketIndexHtml] = await Promise.all([
    fetchNaverHtml(ENDPOINTS.goldDetail),
    fetchNaverHtml(ENDPOINTS.marketIndexGold),
  ]);

  return parseNaverMetalPrices(goldDetailHtml, marketIndexHtml);
}

export {
  TROY_OZ_TO_GRAM,
  ENDPOINTS,
  NAVER_HEADERS,
  parseNaverMetalPrices,
  fetchNaverMetalPrices,
};
