export const API = 'https://www.saferproducts.gov/RestWebServices/Recall';
export const API_GUIDE = 'https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information';
export function officialURL(value) {
  if (typeof value !== 'string' || value.length > 450 || !/^https:\/\/www\.cpsc\.gov\/Recalls\/\d{4}\/[a-zA-Z0-9-]+$/.test(value)) throw Error('A canonical official CPSC recall URL is required.');
  return value;
}
const clean = (value, max = 1500) => typeof value === 'string' ? value.slice(0, max) : '';
const words = s => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
export function normalizeNotices(rows) {
  if (!Array.isArray(rows) || rows.length > 15000) throw Error('Unexpected CPSC catalogue response.');
  const seen = new Set();
  return rows.flatMap(row => {
    try {
      const url = officialURL(row.URL);
      if (seen.has(url) || !clean(row.Title).trim()) return [];
      seen.add(url);
      return [{url, title: clean(row.Title, 600), date: clean(row.RecallDate, 10), number: clean(row.RecallNumber, 24), description: clean(row.Description, 10000), models: (Array.isArray(row.Products) ? row.Products : []).map(x => clean(x.Model, 600)).join(' ')}];
    } catch { return []; }
  });
}
export function rankNotices(notices, brand, model = '') {
  const brandWords = words(brand), modelWords = words(model);
  return notices.map(n => {
    const tokens = new Set(words(n.title + ' ' + n.description + ' ' + n.models));
    const score = brandWords.filter(w => tokens.has(w)).length * 5 + modelWords.filter(w => tokens.has(w)).length * 12;
    return {...n, score};
  }).sort((a,b) => b.score-a.score || b.date.localeCompare(a.date) || a.url.localeCompare(b.url));
}
export async function discover(brand, model = '', fetcher = globalThis.fetch) {
  brand = brand.trim();
  if (brand.length < 2 || brand.length > 120) throw Error('Enter a brand or title keyword of 2–120 characters.');
  const query = new URL(API); query.searchParams.set('format','json'); query.searchParams.set('RecallTitle',brand);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetcher(query.href, {signal:controller.signal, credentials:'omit', redirect:'error'});
    if (!response.ok) throw Error('CPSC search returned HTTP ' + response.status);
    const rows = await response.json(), notices = normalizeNotices(rows);
    if (rows.length && !notices.length) throw Error('CPSC returned no usable official notice URLs.');
    return {source:query.href, retrieved_at:new Date().toISOString(), mode:'LIVE_API', query:brand, model, total:notices.length, notices:rankNotices(notices,brand,model)};
  } catch (error) { throw Error('Official search unavailable. Retry later, use an official URL, or explicitly load the dated saved catalogue. ' + error.message); }
  finally { clearTimeout(timer); }
}
