// Netlify Function: Hämtar Zalando-sida och extraherar JSON-LD Product
export async function handler(event) {
  // CORS (GET räcker med denna)
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const url = (event.queryStringParameters && event.queryStringParameters.url) || '';
    if (!url) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing url' }) };
    }

    // Hämta HTML
    const res = await fetch(url, {
      headers: {
        // Enkel UA för att få “riktig” sida
        'user-agent': 'Mozilla/5.0 (compatible; NetlifyFunction/1.0)'
      }
    });
    if (!res.ok) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: `fetch ${res.status}` }) };
    }
    const html = await res.text();

    // Plocka alla <script type="application/ld+json">…</script>
    const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)]
      .map(m => m[1]?.trim())
      .filter(Boolean);

    let product = null;
    for (const block of scripts) {
      // Vissa sajter har flera JSON-objekt ihop utan komma → försök båda
      const candidates = tryParseMany(block);
      for (const data of candidates) {
        const p = findProductNode(data);
        if (p) { product = p; break; }
      }
      if (product) break;
    }

    // Fallback via meta-taggar om JSON-LD saknas
    if (!product) {
      const ogTitle = meta(html, 'og:title');
      const ogPrice = meta(html, 'product:price:amount');
      const skuMeta = metaItemprop(html, 'sku');
      const out = {
        name: ogTitle || '',
        sku: skuMeta || '',
        priceIncl: ogPrice ? Number(ogPrice.replace(',', '.')) : 0,
        currency: meta(html, 'product:price:currency') || 'SEK',
        source: url
      };
      return { statusCode: 200, headers, body: JSON.stringify(out) };
    }

    const out = extractFromProduct(product);
    out.source = url;
    return { statusCode: 200, headers, body: JSON.stringify(out) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(err) }) };
  }
}

// --- Helpers ---
function tryParseMany(txt) {
  const arr = [];
  try { arr.push(JSON.parse(txt)); } catch { /* ignore */ }
  // Om flera JSON-objekt i följd utan komma: splitta grovt på }{
  if (!arr.length) {
    const splits = txt.split(/}\s*{\s*/).map((chunk, i, all) => {
      let s = chunk;
      if (i > 0) s = '{' + s;
      if (i < all.length - 1) s = s + '}';
      return s;
    });
    for (const s of splits) {
      try { arr.push(JSON.parse(s)); } catch { /* ignore */ }
    }
  }
  return arr;
}

function isProduct(x) {
  if (!x) return false;
  const t = x['@type'];
  return t === 'Product' || (Array.isArray(t) && t.includes('Product'));
}

function findProductNode(data) {
  if (isProduct(data)) return data;
  if (Array.isArray(data?.['@graph'])) {
    const p = data['@graph'].find(isProduct);
    if (p) return p;
  }
  if (Array.isArray(data)) {
    const p = data.find(isProduct);
    if (p) return p;
  }
  if (isProduct(data?.mainEntity)) return data.mainEntity;
  return null;
}

function extractFromProduct(prod) {
  const name = prod.name || '';
  const sku  = prod.sku || prod.mpn || prod.productID || '';
  let price = 0, currency = 'SEK';
  let offers = prod.offers;
  if (Array.isArray(offers)) offers = offers[0];
  if (offers) {
    price    = num(offers.price) || num(offers?.priceSpecification?.price) || num(offers?.lowPrice) || num(offers?.highPrice);
    currency = offers.priceCurrency || offers?.priceSpecification?.priceCurrency || currency;
  }
  return { name, sku, priceIncl: price, currency };
}

function meta(html, prop){
  const m = html.match(new RegExp(`<meta[^>]+property=["']${escapeReg(prop)}["'][^>]+content=["']([^"']+)["']`, 'i'));
  return m ? decode(m[1]) : '';
}
function metaItemprop(html, name){
  const m = html.match(new RegExp(`<meta[^>]+itemprop=["']${escapeReg(name)}["'][^>]+content=["']([^"']+)["']`, 'i'));
  return m ? decode(m[1]) : '';
}

function num(v){ const n = Number(String(v||'').replace(',','.')); return Number.isFinite(n)?n:0; }
function decode(s){ try { return decodeURIComponent(s); } catch { return s; } }
function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
