// Fakturagenerator – 600 DPI PDF, luftigare UI, 11-siffrigt kundnummer,
// radstandard moms 25 %, juridisk fotnot längst ned, och exakt textstil i .foot.
(function(){
  const $ = (id)=>document.getElementById(id);

  // === Konstanter ===
  const CSS_DPI = 96;
  const EXPORT_DPI = 600;
  const ORDER_LEN   = 14;
  const INVOICE_LEN = 12;
  const DEFAULT_VAT_PCT = 25; // per rad

  // === Init datum ===
  const today = new Date().toISOString().slice(0,10);
  setVal('invoiceDate', today);
  setVal('deliveryDate', today);

  // === Inputs som triggar render (live) ===
  const bindLive = (ids)=>ids.forEach(id=>{
    const el = $(id); if(!el) return;
    ['input','change'].forEach(evt=>el.addEventListener(evt, render));
  });
  bindLive([
    'companyAddress','buyerName','invoiceAddress','deliveryAddress',
    'customerNo','orderNo','invoiceNo','invoiceDate','deliveryDate',
    'greeting','notes','paymentMethod','paymentMethodOther'
  ]);

  // === Betalsätt "Annat" ===
  const paymentSelect = $('paymentMethod');
  const paymentOtherWrap = $('paymentMethodOtherWrap');
  function togglePaymentOther(){
    if (!paymentSelect) return;
    paymentOtherWrap.style.display = paymentSelect.value === 'other' ? '' : 'none';
    if (paymentSelect.value !== 'other') { const o = $('paymentMethodOther'); if (o) o.value=''; }
  }
  if (paymentSelect) { paymentSelect.addEventListener('change', togglePaymentOther); togglePaymentOther(); }

  // === Nummerfält (order/invoice autogen) ===
  const orderNoInput = $('orderNo');
  const invoiceNoInput = $('invoiceNo');
  if (!orderNoInput.value)   orderNoInput.value   = genNumericId(ORDER_LEN);
  if (!invoiceNoInput.value) invoiceNoInput.value = genNumericId(INVOICE_LEN);
  orderNoInput.addEventListener('blur', ()=>{ if(!orderNoInput.value.trim()){ orderNoInput.value = genNumericId(ORDER_LEN); render(); }});
  invoiceNoInput.addEventListener('blur', ()=>{ if(!invoiceNoInput.value.trim()){ invoiceNoInput.value = genNumericId(INVOICE_LEN); render(); }});

  // Kundnummer: tillåt bara siffror, max 11
  const customerNoInput = $('customerNo');
  if (customerNoInput){
    customerNoInput.addEventListener('input', ()=>{
      customerNoInput.value = customerNoInput.value.replace(/\D+/g,'').slice(0,11);
    });
  }

  // === Rader ===
  const itemsHost = $('items');
  function addRow(preset){
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <input class="qty"   type="number" min="0" step="1" value="${preset?.qty ?? 1}" title="Antal"/>
      <input class="sku"   placeholder="Artikelnummer"       value="${preset?.sku ?? ''}"/>
      <input class="desc"  placeholder="Produktnamn / beskrivning" value="${preset?.desc ?? ''}"/>
      <input class="unit"  type="number" step="0.01" placeholder="Pris inkl. moms/st (SEK)" value="${preset?.unitGross ?? ''}"/>
      <input class="total" type="text"   placeholder="Moms SEK (auto)" disabled/>
      <input class="vatp"  type="number" step="0.01" placeholder="Moms %" value="${preset?.vatp ?? DEFAULT_VAT_PCT}"/>
      <button type="button" class="btn btn-ghost remove" aria-label="Ta bort rad">✕</button>
    `;
    row.querySelector('.remove').addEventListener('click', ()=>{ row.remove(); render(); });
    row.querySelectorAll('input').forEach(i=> i.addEventListener('input', render));
    itemsHost.appendChild(row);
    render();
  }
  $('addRowBtn').addEventListener('click', ()=>addRow());
  addRow(); // start med en rad

  // === Zoom i förhandsgranskning ===
  const zoomButtons = document.querySelectorAll('.seg-btn');
  const zoomLabel   = $('zoomLabel');
  zoomButtons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      zoomButtons.forEach(b=>b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const z = Number(btn.dataset.zoom || 1) || 1;
      document.documentElement.style.setProperty('--preview-zoom', String(z));
      zoomLabel.textContent = Math.round(z*100) + '%';
    });
  });

  // === Export: rendera canvas i 600 DPI ===
  function renderCanvas600DPI(){
    const node = document.querySelector('#preview .paper');
    if(!node) throw new Error('Inget att exportera.');

    const clone = node.cloneNode(true);
    const holder = document.createElement('div');
    holder.style.position = 'fixed';
    holder.style.left = '-10000px';
    holder.style.top = '0';
    holder.style.opacity = '0';
    holder.style.pointerEvents = 'none';
    holder.style.background = '#fff';
    clone.style.transform = 'none';
    clone.style.boxShadow = 'none';
    clone.style.margin = '0';
    holder.appendChild(clone);
    document.body.appendChild(holder);

    const rect = clone.getBoundingClientRect();
    const pxW = Math.max(1, Math.ceil(rect.width));
    const pxH = Math.max(1, Math.ceil(rect.height));
    const scale = EXPORT_DPI / CSS_DPI;

    return html2canvas(clone, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      scrollX: 0, scrollY: 0,
      windowWidth: pxW, windowHeight: pxH,
      width: pxW, height: pxH,
      letterRendering: true
    }).then(canvas => { holder.remove(); return canvas; })
      .catch(err => { holder.remove(); throw err; });
  }

  // === Validering: kundnummer (11 siffror) ===
  function validateBeforeExport(){
    const el = $('customerNo');
    el.parentElement.classList.remove('error');
    const val = (el.value || '').trim();
    const ok = /^[0-9]{11}$/.test(val);
    if(!ok){
      el.parentElement.classList.add('error');
      alert('Kundnummer måste bestå av exakt 11 siffror.');
      el.focus();
    }
    return ok;
  }

  // === Nedladdning: PDF (600 DPI) ===
  async function downloadPdf600(){
    if(!validateBeforeExport()) return;
    await document.fonts.ready; // säkerställ att fonter är laddade
    render(); // säkerställ att datan är aktuell
    try{
      const canvas = await renderCanvas600DPI();
      const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
      const doc = new jsPDFCtor({ unit:'mm', format:[210,297], orientation:'portrait' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      const mmPerPx = Math.min(pageW / canvas.width, pageH / canvas.height);
      const imgW = canvas.width  * mmPerPx;
      const imgH = canvas.height * mmPerPx;
      const x = (pageW - imgW) / 2;
      const y = (pageH - imgH) / 2;

      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', x, y, imgW, imgH, undefined, 'FAST');

      const d = getData();
      doc.save(`${d.invoiceNo || genNumericId(12)}_600dpi.pdf`);
    }catch(e){
      console.error(e);
      alert('Kunde inte rendera PDF.');
    }
  }

  // === Knappar ===
  $('downloadPdfTop')?.addEventListener('click', downloadPdf600);
  $('downloadPdfBottom')?.addEventListener('click', downloadPdf600);

  // === Hjälpare ===
  function setVal(id, v){ const el = $(id); if(el) el.value = v; }
  function genNumericId(len){ let s = String(Math.floor(Math.random()*9)+1); while (s.length < len) s += String(Math.floor(Math.random()*10)); return s; }
  function num(v){ const n = Number(String(v ?? '').trim().replace(',','.')); return Number.isFinite(n) ? n : 0; }
  function fmtSEK(n){ return new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK'}).format(n); }
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m])); }

  // === Data ===
  function getItems(){
    const rows=[...document.querySelectorAll('#items .row')];
    const defaultVat = DEFAULT_VAT_PCT / 100;
    return rows.map(r=>{
      const qty        = num(r.querySelector('.qty').value);
      const unitGross  = num(r.querySelector('.unit').value);      // inkl. moms/st
      const vatpInput  = num(r.querySelector('.vatp').value || 0)/100;
      const vatp       = vatpInput>0 ? vatpInput : defaultVat;

      const unitNet = vatp>0 ? unitGross / (1 + vatp) : unitGross;
      const unitVat = unitGross - unitNet;

      const net   = qty * unitNet;
      const vat   = qty * unitVat;
      const gross = qty * unitGross;

      const vatField = r.querySelector('.total');
      vatField.value = vat ? fmtSEK(vat) : '';

      return {
        qty,
        sku:  r.querySelector('.sku').value.trim(),
        desc: r.querySelector('.desc').value.trim(),
        unitNet, vatp, net, vat, gross
      };
    }).filter(i => i.qty>0 && (i.sku || i.desc || i.unitNet>0));
  }

  function getPaymentMethod(){
    const sel = $('paymentMethod')?.value || 'Faktura';
    if (sel === 'other') {
      const txt = $('paymentMethodOther')?.value.trim();
      return txt || 'Annat';
    }
    return sel;
  }

  function getData(){
    const d = {
      companyAddress: $('companyAddress')?.value.trim() || '',
      buyerName: $('buyerName').value.trim(),
      invoiceAddress: $('invoiceAddress').value.trim(),
      deliveryAddress: $('deliveryAddress').value.trim(),
      customerNo: $('customerNo').value.trim(),
      orderNo: $('orderNo').value.trim() || genNumericId(ORDER_LEN),
      invoiceNo: $('invoiceNo').value.trim() || genNumericId(INVOICE_LEN),
      invoiceDate: $('invoiceDate').value,
      deliveryDate: $('deliveryDate').value,
      paymentMethod: getPaymentMethod(),
      greeting: $('greeting').value.trim(),
      notes: $('notes').value.trim(),
      items: getItems()
    };
    d.sub   = d.items.reduce((s,i)=>s+i.net,0);
    d.vat   = d.items.reduce((s,i)=>s+i.vat,0);
    d.total = d.items.reduce((s,i)=>s+i.gross,0);
    return d;
  }

  // === Fakturans HTML ===
  function headerHTML(){
    return `
      <div class="header">
        <h1>Faktura/Kvitto</h1>
        <img class="logo-img" src="logga.png" alt="Logotyp">
      </div>
      <div class="sida">Sida 1 av 1</div>
    `;
  }

  function addressesHTML(d){
    return `
      <div class="addresses">
        <div class="addr">
          <h3>Fakturaadress :</h3>
          <p>${esc(d.buyerName)}\n${esc(d.invoiceAddress)}</p>
        </div>
        <div class="addr">
          <h3>Leveransadress :</h3>
          <p>${esc(d.buyerName)}\n${esc(d.deliveryAddress)}</p>
        </div>
        <div class="facts">
          <div class="row"><div class="key">Kundnummer :</div><div class="val">${esc(d.customerNo)}</div></div>
          <div class="row"><div class="key">Beställningsnummer :</div><div class="val">${esc(d.orderNo)}</div></div>
          <div class="row"><div class="key">Faktura/kvittonummer :</div><div class="val">${esc(d.invoiceNo)}</div></div>
          <div class="row"><div class="key">Faktura från den</div><div class="val">${esc(d.invoiceDate)}</div></div>
          <div class="row"><div class="key">Levererades den</div><div class="val">${esc(d.deliveryDate)}</div></div>
        </div>
      </div>
    `;
  }

  function greetingHTML(d){
    const namePart = d.buyerName ? ` ${d.buyerName}` : '';
    const defaultGreeting = `Hej${namePart},\nTack för att du handlar hos oss. Här följer din\nbeställningsöversikt.`;
    const g = (d.greeting && d.greeting.trim().length)
      ? d.greeting.replace('{namn}', d.buyerName || '')
      : defaultGreeting;

    const [firstLine, ...rest] = g.split('\n');
    return `
      <hr class="rule" />
      <p class="hello">${esc(firstLine)}</p>
      <p class="intro">${esc(rest.join('\n'))}</p>
    `;
  }

  function tableHTML(d){
    const nf = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const rows = d.items.map(i=>`
      <tr>
        <td class="col-antal">${i.qty}</td>
        <td class="col-artnr">${esc(i.sku)}</td>
        <td class="col-produkt">${esc(i.desc).replace(/\n/g,'<br/>')}</td>
        <td class="col-netto">${nf.format(i.unitNet + i.vat / (i.qty || 1))}</td>
        <td class="col-total">${nf.format(i.vat)}</td>
        <td class="col-moms">${Math.round(i.vatp*100)} %</td>
      </tr>
    `).join('');
    return `
      <table class="tbl">
        <thead>
          <tr>
            <th class="col-antal">Antal</th>
            <th class="col-artnr">Artikelnummer</th>
            <th class="col-produkt">Produkt</th>
            <th class="col-netto">Pris inkl. moms</th>
            <th class="col-total">   tot  moms</th>
            <th class="col-moms">Moms %</th>
          </tr>
        </thead>
        <tbody>${rows || `
          <tr>
            <td class="col-antal">0</td>
            <td class="col-artnr">—</td>
            <td class="col-produkt">Lägg till rader</td>
            <td class="col-netto">0,00</td>
            <td class="col-total">0,00</td>
            <td class="col-moms">0 %</td>
          </tr>`}
        </tbody>
      </table>
    `;
  }

  function legalHTML(){
    // exakt text från referensen
    const t = `Zalando SE Valeska-Gert-Straße 5 10243 Berlin Registrerat vid Amtsgericht Charlottenburg, HRB 158855 B Momsregistreringsnummer: SE502074958501 Styrelse: Robert Gentz och David Schröder (båda styrelseordföranden), Dr. Astrid Arndt, David Schneider Ordförande i tillsynsrådet: Kelly Bennett Registrerat kontor: Berlin | Zalando SE har överlåtit sin rätt till betalning för ovanstående köp till Zalando Payments GmbH`;
    return `<div class="legal">${esc(t)}</div>`;
  }

  // *** Exakt textblock som i din referens (Arial-lik, liten, sista raden fet) ***
  function notesHTML(d){
    const text = `Du har valt mot faktura som betalningssätt för denna beställning.
Du kan inte få tillbaka moms för den här fakturan då köpet är för privat bruk.`;

    const thanks = `Vi på Team Zalando tackar dig än en gång för din beställning och hoppas att du får stor glädje av den!`;

    return `
      <hr class="rule" />
      <div class="foot">
        <p>${esc(text)}</p>
        <p class="foot-strong">${esc(thanks)}</p>
      </div>
      ${legalHTML()}
    `;
  }

  function totalsHTML(d){
    const nf = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `
      <div class="totals">
        <div class="row"><div class="label">Totalsumma (netto) SEK</div><div class="value">${nf.format(d.sub)}</div></div>
        <div class="row"><div class="label">Total moms SEK</div><div class="value">${nf.format(d.vat)}</div></div>
        <hr class="muted-rule" />
        <div class="row grand"><div class="label">Totalsumma inkl. moms SEK</div><div class="value">${nf.format(d.total)}</div></div>
      </div>
    `;
  }

  function buildHTML(d){
    return `
      <div class="paper-frame">
        <div class="paper">
          ${headerHTML()}
          ${addressesHTML(d)}
          ${greetingHTML(d)}
          ${tableHTML(d)}
          ${totalsHTML(d)}
          ${notesHTML(d)}
        </div>
      </div>
    `;
  }

  function render(){
    const d = getData();
    $('preview').innerHTML = buildHTML(d);
    $('sumNet').textContent = fmtSEK(d.sub);
    $('sumVat').textContent = fmtSEK(d.vat);
    $('sumTot').textContent = fmtSEK(d.total);
  }

  // Första render
  render();

  // ==== Helpers ====
  function setVal(id, v){ const el = $(id); if(el) el.value = v; }
  function genNumericId(len){ let s = String(Math.floor(Math.random()*9)+1); while (s.length < len) s += String(Math.floor(Math.random()*10)); return s; }
  function num(v){ const n = Number(String(v ?? '').trim().replace(',','.')); return Number.isFinite(n) ? n : 0; }
  function fmtSEK(n){ return new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK'}).format(n); }
  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m])); }
})();
