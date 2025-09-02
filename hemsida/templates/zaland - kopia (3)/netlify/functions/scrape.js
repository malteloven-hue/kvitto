// /netlify/functions/scrape.js
// Netlify Function: Hämta produktsida och extrahera namn, sku, pris (inkl) och valuta.
export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const url = event.queryStringParameters?.url || '';
    if (!url) {
      return json(400, { error: 'missing url' }, headers);
    }

    // Hämta HTML från källan
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        // Undvik bot-block: sänd normal UA + språk
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache'
      }
    });

    if (!res.ok) {
      return json(res.status, { error: `upstream ${res.status}` }, headers);
    }
    const html = await res.text();

    // 1) Försök JSON-LD Product
    const product = extractJSONLDProduct(html);
    if (product) {
      return json(200, extractFromJSONLD(product, url), headers);
    }

    // 2) Fallback via meta-taggar
    const ogTitle = meta(html, 'og:title');
    const ogPrice = meta(html, 'product:price:amount');
    const skuMeta = metaItemprop(html, 'sku');
    const currency = meta(html, 'product:price:currency') || 'SEK';
    const out = {
      name: ogTitle || '',
      sku: skuMeta || '',
      priceIncl: ogPrice ? toNum(ogPrice) : 0,
      currency,
      source: url
    };
    return json(200, out, headers);
  } catch (err) {
    return json(500, { error: String(err?.message || err) }, headers);
  }
}

// ===== Helpers =====
function json(statusCode, body, headers) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function extractJSONLDProduct(html) {
  // Plocka ut alla <script type="application/ld+json"> och leta Product
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of scripts) {
    const raw = m[1]?.trim();
    if (!raw) continue;

    // Rensa eventuella HTML-entities
    const clean = decodeHTMLEntities(raw);

    // En del sidor har flera JSON-objekt i en array
    try {
      const data = JSON.parse(clean);
      const candidates = Array.isArray(data) ? data : [data];

      // Leta efter @type Product, ev. inbäddat i graph
      for (const c of candidates) {
        const found = findProductInAny(c);
        if (found) return found;
      }
    } catch {
      // Fortsätt till nästa <script>
    }
  }
  return null;
}

function findProductInAny(obj) {
  if (!obj || typeof obj !== 'object') return null;

  // Exakta Product
  if (isType(obj, 'Product')) return obj;

  // @graph
  if (Array.isArray(obj['@graph'])) {
    for (const node of obj['@graph']) {
      if (isType(node, 'Product')) return node;
    }
  }

  // Sök rekursivt
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === 'object') {
      const hit = findProductInAny(v);
      if (hit) return hit;
    }
  }
  return null;
}

function isType(node, want) {
  const t = node && node['@type'];
  if (!t) return false;
  return (Array.isArray(t) ? t : [t]).some(x => String(x).toLowerCase() === want.toLowerCase());
}

function extractFromJSONLD(p, sourceUrl) {
  // Namn
  const name = str(p.name) || str(p.title) || '';

  // SKU
  const sku = str(p.sku) || str(p.mpn) || '';

  // Pris inkl. moms och valuta
  // Ofta ligger priset i offers eller aggregateOffer
  let priceIncl = 0;
  let currency = 'SEK';

  const offers = p.offers || p.offer || p.offers?.offers || p.aggregateOffer;
  const candidates = []
    .concat(offers || [])
    .concat(Array.isArray(offers?.offers) ? offers.offers : []);

  for (const o of (Array.isArray(candidates) ? candidates : [offers]).filter(Boolean)) {
    if (o.price != null) {
      priceIncl = toNum(o.price);
    } else if (o.priceSpecification && o.priceSpecification.price != null) {
      priceIncl = toNum(o.priceSpecification.price);
    }
    if (o.priceCurrency) currency = String(o.priceCurrency);
    if (priceIncl) break;
  }

  // Om inget pris hittades i offers: prova direkt på Product (vissa JSON-LD gör så)
  if (!priceIncl && p.price != null) priceIncl = toNum(p.price);
  if (!currency && p.priceCurrency) currency = String(p.priceCurrency);

  return { name, sku, priceIncl, currency: currency || 'SEK', source: sourceUrl };
}

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+property=["']${escapeReg(prop)}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? decodeHTMLEntities(m[1]) : '';
}
function metaItemprop(html, name) {
  const re = new RegExp(`<meta[^>]+itemprop=["']${escapeReg(name)}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? decodeHTMLEntities(m[1]) : '';
}

function toNum(v) {
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
function str(v) {
  return (v == null) ? '' : String(v);
}
function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function decodeHTMLEntities(s) {
  return String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
