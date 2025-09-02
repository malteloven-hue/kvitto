(function(){
  const brand = document.getElementById('brand');
  const c1 = document.getElementById('c1');
  const c2 = document.getElementById('c2');
  const logo = document.getElementById('logo');
  const p_brand = document.getElementById('p_brand');
  const p_logo = document.getElementById('p_logo');
  const year = document.getElementById('year');
  const btn = document.getElementById('export');

  year.textContent = new Date().getFullYear();

  brand.addEventListener('input', ()=>{
    p_brand.textContent = brand.value || 'Ditt varumärke';
    document.querySelector('.foot').innerHTML = `© ${new Date().getFullYear()} ${brand.value || 'Ditt varumärke'}`;
  });
  c1.addEventListener('input', ()=>document.documentElement.style.setProperty('--c1', c1.value));
  c2.addEventListener('input', ()=>document.documentElement.style.setProperty('--c2', c2.value));

  logo.addEventListener('change', ()=>{
    const f = logo.files && logo.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = e => { p_logo.src = e.target.result; };
    reader.readAsDataURL(f);
  });

  btn.addEventListener('click', ()=>{
    const html = buildSingleFile();
    const file = new Blob([html], {type:'text/html;charset=utf-8'});
    const a = document.createElement('a');
    const name = (brand.value || 'mall').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    a.href = URL.createObjectURL(file);
    a.download = `${name || 'mall'}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function buildSingleFile(){
    // Inline minimal CSS with current colors and embedded logo (if any)
    const css = document.querySelector('style[data-inline]')?.textContent || '';
    const styles = document.querySelector('link[rel="stylesheet"]');
    // Grab current theme vars
    const c1v = getComputedStyle(document.documentElement).getPropertyValue('--c1').trim();
    const c2v = getComputedStyle(document.documentElement).getPropertyValue('--c2').trim();
    const brandName = brand.value || 'Ditt varumärke';
    const logoSrc = p_logo.getAttribute('src') || '';

    const inlineCSS = `:root{--c1:${c1v};--c2:${c2v};--ink:#0f172a;--bg:#f7fafc;--card:#ffffff;--line:#e5e7eb;--font:"Inter",-apple-system,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
*{box-sizing:border-box}html,body{height:100%}body{margin:0;font-family:var(--font);color:var(--ink);background:#f3f4f6}
.doc{max-width:960px;margin:0 auto;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.hero{padding:36px 28px;background:linear-gradient(180deg,var(--c2),var(--c1));color:#fff;text-align:center}
.hero .logo{height:64px;object-fit:contain;display:block;margin:0 auto 10px}
.hero h2{margin:8px 0 6px 0}
.hero .cta{display:inline-block;margin-top:12px;background:#fff;color:#111827;padding:10px 14px;border-radius:12px;text-decoration:none;font-weight:700}
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;padding:14px}
.features article{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px}
.foot{padding:12px;border-top:1px solid var(--line);text-align:center;color:#6b7280}`;

    const body = `<div class="doc">
  <header class="hero">
    ${logoSrc ? `<img class="logo" alt="Logotyp" src="${logoSrc}">` : ``}
    <h2>${escapeHtml(brandName)}</h2>
    <p>En kort payoff som beskriver din tjänst. Säljande men tydlig.</p>
    <a class="cta">Kom igång</a>
  </header>
  <section class="features">
    <article><h3>Snabbt</h3><p>Kom igång på minuter.</p></article>
    <article><h3>Flexibelt</h3><p>Anpassa färger, logga och innehåll.</p></article>
    <article><h3>Export</h3><p>Ladda ned som ren HTML.</p></article>
  </section>
  <footer class="foot">© ${new Date().getFullYear()} ${escapeHtml(brandName)}</footer>
</div>`;

    return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(brandName)}</title>
  <style>${inlineCSS}</style>
</head>
<body>
${body}
</body>
</html>`;
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);
  }
})();