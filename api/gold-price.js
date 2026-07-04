import { fetchNaverMetalPrices } from '../lib/parseNaverMetalPrices.js';

const CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=600';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const data = await fetchNaverMetalPrices();

    res.setHeader('Cache-Control', CACHE_CONTROL);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[api/gold-price]', error);

    return res.status(502).json({
      error: 'Failed to fetch metal prices from Naver',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
