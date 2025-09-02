(function(){
  const y = document.getElementById('y'); if (y) y.textContent = new Date().getFullYear();
  const gallery = document.getElementById('gallery');

  function card(t){
    const tags = (t.tags||[]).map(x=>`<span class="tag">${x}</span>`).join('');
    return `<article class="card">
      <div class="ph">${t.preview ? `<img src="${t.preview}" alt="${t.name}">` : ''}</div>
      <div class="body">
        <h3>${t.name}</h3>
        <p>${t.description||''}</p>
        <div class="tags">${tags}</div>
      </div>
      <div class="actions">
        <a class="btn btn-primary" href="${t.path}">Öppna mall</a>
        <a class="btn btn-ghost" href="/builder/index.html">Skapa egen</a>
      </div>
    </article>`;
  }

  fetch('/templates/manifest.json')
    .then(r=>r.json())
    .then(list=>{
      if (!Array.isArray(list) || !list.length){
        gallery.innerHTML = '<p>Inga mallar ännu. Lägg till via <code>/templates/manifest.json</code>.</p>';
        return;
      }
      gallery.innerHTML = list.map(card).join('');
    })
    .catch(()=>{
      gallery.innerHTML = '<p>Kunde inte läsa manifestet.</p>';
    });
})();