(function(){
  const SEALS = ['var(--seal-red)','var(--seal-green)','var(--seal-blue)','var(--seal-orange)'];
  const main = document.getElementById('main');

  const CFG = window.SUPABASE_CONFIG || {};
  const DB_READY = !!(CFG.url && CFG.anonKey
    && CFG.url.indexOf('DEINE-PROJECT-URL') === -1
    && CFG.anonKey.indexOf('DEIN-ANON-KEY') === -1);
  const REST = DB_READY ? CFG.url.replace(/\/$/, '') + '/rest/v1/personen' : null;

  const PERSONS = { byId: {} };

  function dbHeaders(withPin){
    const h = {
      'apikey': CFG.anonKey,
      'Content-Type': 'application/json',
    };
    // Neues Supabase-Schluesselformat (sb_publishable_..., sb_secret_...) ist kein JWT
    // und gehoert nur in den apikey-Header. Das alte Format (eyJ...) braucht zusaetzlich
    // den Authorization-Header - beide Faelle werden hier abgedeckt.
    if (!CFG.anonKey || !CFG.anonKey.startsWith('sb_')){
      h['Authorization'] = 'Bearer ' + CFG.anonKey;
    }
    if (withPin) h['x-family-pin'] = CFG.pin || '';
    return h;
  }

  // ---------------------------------------------------------------
  // Laden: zuerst aus der Datenbank (falls config.js ausgefuellt ist),
  // sonst aus den eingebetteten Daten (forest_embed.js) als Offline-Fallback.
  // ---------------------------------------------------------------
  async function loadPersons(){
    if (DB_READY){
      try {
        const res = await fetch(REST + '?select=*', { headers: dbHeaders(false) });
        if (res.ok){
          const rows = await res.json();
          if (rows.length){
            rows.forEach(r => { PERSONS.byId[r.id] = r; });
            markSource('db');
            return;
          }
        } else {
          console.warn('Supabase-Antwort nicht ok:', res.status, await res.text());
        }
      } catch(e){
        console.warn('Supabase nicht erreichbar, nutze lokale Daten:', e);
      }
    }
    (window.ALL_PERSONS || []).forEach(p => { PERSONS.byId[p.id] = Object.assign({}, p); });
    markSource(DB_READY ? 'db-error' : 'offline');
    applyStoredEdits();
  }

  function markSource(kind){
    const el = document.getElementById('data-source');
    if (!el) return;
    if (kind === 'db'){
      el.textContent = 'Datenbank verbunden — Änderungen gelten für alle';
      el.classList.add('ok');
    } else if (kind === 'db-error'){
      el.textContent = 'Datenbank nicht erreichbar — zeige letzten bekannten Stand, Änderungen nur lokal';
      el.classList.add('warn');
    } else {
      el.textContent = 'Keine Datenbank verbunden — Änderungen werden nur lokal in diesem Browser gespeichert';
      el.classList.add('warn');
    }
  }

  // Lokaler Fallback (nur wenn keine Datenbank konfiguriert ist / nicht erreichbar)
  function persistLocal(person){
    try {
      const raw = localStorage.getItem('stammbaum_edits') || '{}';
      const edits = JSON.parse(raw);
      edits[person.id] = person;
      localStorage.setItem('stammbaum_edits', JSON.stringify(edits));
    } catch(e){}
  }

  function applyStoredEdits(){
    try {
      const raw = localStorage.getItem('stammbaum_edits');
      if (!raw) return;
      const edits = JSON.parse(raw);
      Object.keys(edits).forEach(id => {
        if (PERSONS.byId[id]) Object.assign(PERSONS.byId[id], edits[id]);
      });
    } catch(e){}
  }

  // Speichern: in die Datenbank (mit PIN) wenn verbunden, sonst nur lokal.
  async function persistPerson(person, pin){
    if (!DB_READY){
      persistLocal(person);
      return { ok: true, mode: 'local' };
    }
    const body = {
      vorname: person.vorname, zweitname: person.zweitname, nachname: person.nachname,
      maedchenname: person.maedchenname, geschlecht: person.geschlecht,
      geburt: person.geburt, jg: person.jg, geburtsort: person.geburtsort,
      heimatort: person.heimatort, sterbe: person.sterbe, todesjahr: person.todesjahr,
      beziehungsstatus: person.beziehungsstatus, ehepartner_raw: person.ehepartner_raw,
      ehepartner_ids: person.ehepartner_ids && person.ehepartner_ids.length ? person.ehepartner_ids : null,
      vater_id: person.vater_id, mutter_id: person.mutter_id, bem: person.bem,
    };
    const headers = dbHeaders(true);
    headers['x-family-pin'] = pin;
    try {
      const res = await fetch(REST + '?id=eq.' + person.id, {
        method: 'PATCH', headers, body: JSON.stringify(body)
      });
      if (!res.ok){
        const txt = await res.text();
        return { ok: false, mode: 'db', error: txt };
      }
      return { ok: true, mode: 'db' };
    } catch(e){
      return { ok: false, mode: 'db', error: String(e) };
    }
  }

  // Wenn sich Kinder-Zuordnung aendert, muessen auch die betroffenen
  // Kinder-Zeilen (vater_id/mutter_id) in der Datenbank aktualisiert werden.
  async function persistChildLinks(changedChildren, pin){
    if (!DB_READY) return true;
    const headers = dbHeaders(true);
    headers['x-family-pin'] = pin;
    let allOk = true;
    for (const child of changedChildren){
      try {
        const res = await fetch(REST + '?id=eq.' + child.id, {
          method: 'PATCH', headers,
          body: JSON.stringify({ vater_id: child.vater_id, mutter_id: child.mutter_id })
        });
        if (!res.ok) allOk = false;
      } catch(e){ allOk = false; }
    }
    return allOk;
  }

  function escapeHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function fullName(p){
    const parts = [p.vorname];
    if (p.zweitname) parts.push(p.zweitname);
    parts.push(p.nachname);
    let n = parts.filter(Boolean).join(' ');
    if (p.maedchenname && p.maedchenname !== p.nachname) n += ` (geb. ${p.maedchenname})`;
    return n || '(ohne Namen)';
  }

  function fmtDates(p){
    const b = p.geburt || (p.jg ? String(p.jg) : '?');
    if (!p.sterbe && !p.todesjahr) return '*' + b;
    return '*' + b + '  †' + (p.sterbe || p.todesjahr || '?');
  }

  function genderSymbol(g){
    if (g === 'm') return '♂';
    if (g === 'w') return '♀';
    if (g === 'divers') return '⚧';
    return '';
  }

  // Schlanke Karte: nur Name + Jahre + Geschlecht-Symbol. Alle weiteren Details
  // gibt es auf der Personen-Detailseite (Klick auf die Karte).
  function personCardHTML(p){
    const dates = fmtDates(p);
    const sym = genderSymbol(p.geschlecht);
    return `<div class="card" data-pid="${p.id}" data-name="${escapeHtml(fullName(p).toLowerCase())}">
        <button class="edit-btn" data-edit-id="${p.id}" title="Bearbeiten" aria-label="Bearbeiten">&#9998;</button>
        <div class="name">${escapeHtml(fullName(p))} ${sym ? `<span class="gender">${sym}</span>` : ''}</div>
        <div class="dates">${escapeHtml(dates)}</div>
      </div>`;
  }

  // Grosse Karte fuer die Detailansicht: alle Felder.
  function personDetailCardHTML(p){
    const sym = genderSymbol(p.geschlecht);
    const dates = fmtDates(p);
    const rows = [];
    if (p.geburtsort) rows.push(['Geburtsort', p.geburtsort]);
    if (p.heimatort) rows.push(['Heimatort', p.heimatort]);
    if (p.beziehungsstatus || p.ehepartner_raw) {
      const partnerName = p.ehepartner_ids && p.ehepartner_ids.length && PERSONS.byId[p.ehepartner_ids[0]]
        ? fullName(PERSONS.byId[p.ehepartner_ids[0]]) : (p.ehepartner_raw || '');
      rows.push(['Beziehung', [p.beziehungsstatus, partnerName].filter(Boolean).join(' — ')]);
    }
    if (p.bem) rows.push(['Bemerkungen', p.bem]);
    return `<div class="detail-card" data-pid="${p.id}">
        <button class="edit-btn" data-edit-id="${p.id}" title="Bearbeiten" aria-label="Bearbeiten">&#9998;</button>
        <div class="name">${escapeHtml(fullName(p))} ${sym ? `<span class="gender">${sym}</span>` : ''}</div>
        <div class="dates">${escapeHtml(dates)}</div>
        ${rows.length ? `<dl class="detail-fields">${rows.map(([k,v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>` : ''}
      </div>`;
  }

  function renderNode(node){
    const li = document.createElement('li');
    li.className = 'node-li';

    const unit = document.createElement('div');
    unit.className = 'unit';
    unit.innerHTML = personCardHTML(node);

    (node.spouses||[]).forEach(sp => {
      const link = document.createElement('span');
      link.className = 'spouse-link';
      link.textContent = '⚭';
      unit.appendChild(link);
      const wrap = document.createElement('div');
      wrap.innerHTML = personCardHTML(sp);
      unit.appendChild(wrap.firstElementChild);
    });

    li.appendChild(unit);

    const hasKids = node.children && node.children.length;
    if (hasKids){
      const toggle = document.createElement('button');
      toggle.className = 'toggle';
      toggle.textContent = '−';
      toggle.title = 'Nachkommen ein-/ausblenden';
      unit.style.position = 'relative';
      unit.appendChild(toggle);

      const childUl = document.createElement('ul');
      childUl.className = 'tree children-wrap';
      node.children.forEach(c => childUl.appendChild(renderNode(c)));
      li.appendChild(childUl);

      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const collapsed = childUl.classList.toggle('collapsed');
        toggle.textContent = collapsed ? '+' : '−';
      });
    } else {
      li.classList.add('no-children');
    }

    return li;
  }

  function countDescendants(node){
    let n = 0;
    (node.children||[]).forEach(c => { n += 1 + countDescendants(c); });
    return n;
  }

  const jumpSelect = document.getElementById('jump');

  function renderAll(forest){
    main.innerHTML = '';
    jumpSelect.innerHTML = '<option value="">Zweig springen zu …</option>';
    forest.forEach((root, i) => {
      const section = document.createElement('div');
      section.className = 'branch';
      section.id = 'branch-' + i;

      const title = document.createElement('div');
      title.className = 'branch-title';
      const kidCount = countDescendants(root);
      const dotColor = SEALS[i % SEALS.length];
      title.innerHTML = `<span class="branch-dot" style="background:${dotColor}"></span>${escapeHtml(root.name)} <span class="n">(${kidCount} Nachkommen)</span>`;
      section.appendChild(title);

      const scroller = document.createElement('div');
      scroller.className = 'tree-scroll';
      const ul = document.createElement('ul');
      ul.className = 'tree';
      ul.appendChild(renderNode(root));
      scroller.appendChild(ul);
      section.appendChild(scroller);

      main.appendChild(section);

      const opt = document.createElement('option');
      opt.value = 'branch-' + i;
      opt.textContent = root.name + (root.jg ? ' (*' + root.jg + ')' : '');
      jumpSelect.appendChild(opt);
    });
  }

  function computeChildrenOf(){
    const byId = PERSONS.byId;
    const childrenOf = {};
    Object.keys(byId).forEach(id => childrenOf[id] = []);
    Object.values(byId).forEach(p => {
      if (p.vater_id != null && childrenOf[p.vater_id]) childrenOf[p.vater_id].push(p.id);
      if (p.mutter_id != null && childrenOf[p.mutter_id] && !(childrenOf[p.vater_id]||[]).includes(p.id)) childrenOf[p.mutter_id].push(p.id);
    });
    Object.keys(childrenOf).forEach(k => {
      const uniq = [...new Set(childrenOf[k])];
      uniq.sort((a,b) => (byId[a].jg||9999) - (byId[b].jg||9999));
      childrenOf[k] = uniq;
    });
    return childrenOf;
  }

  function personObj(p){ return Object.assign({}, p, { name: fullName(p) }); }

  function buildNode(id, childrenOf, stack){
    const byId = PERSONS.byId;
    const p = byId[id];
    const spouseObjs = [];
    (p.ehepartner_ids||[]).forEach(sid => {
      if (byId[sid]) { spouseObjs.push(personObj(byId[sid])); }
    });
    let kidIds = [...(childrenOf[id]||[])];
    (p.ehepartner_ids||[]).forEach(sid => {
      (childrenOf[sid]||[]).forEach(cid => { if (!kidIds.includes(cid)) kidIds.push(cid); });
    });
    kidIds.sort((a,b) => (byId[a].jg||9999) - (byId[b].jg||9999));
    const kids = [];
    kidIds.forEach(cid => {
      if (stack.has(id) || cid === id) return;
      kids.push(buildNode(cid, childrenOf, new Set([...stack, id])));
    });
    const node = personObj(p);
    node.spouses = spouseObjs;
    node.children = kids;
    return node;
  }

  function rebuildForest(){
    const byId = PERSONS.byId;
    const childrenOf = computeChildrenOf();
    const visited = new Set();

    function build(id, stack){ visited.add(id); const n = buildNode(id, childrenOf, stack); (n.spouses||[]).forEach(s => visited.add(s.id)); return n; }

    const allIds = Object.values(byId).sort((a,b) => (a.jg||9999)-(b.jg||9999)).map(p => p.id);
    const roots = allIds.filter(id => byId[id].vater_id == null && byId[id].mutter_id == null);
    const forest = [];
    roots.forEach(id => { if (!visited.has(id)) forest.push(build(id, new Set())); });
    allIds.forEach(id => { if (!visited.has(id)) forest.push(build(id, new Set())); });
    return forest;
  }

  // Teilbaum ab genau einer Person (fuer die Detailansicht: "darunter").
  function buildSubtreeFor(id){
    const childrenOf = computeChildrenOf();
    return buildNode(id, childrenOf, new Set());
  }

  // Generationen direkter Vorfahren (Vater/Mutter, Grosseltern, …) fuer die Detailansicht: "darueber".
  // generations[0] = Eltern, generations[1] = Grosseltern, usw. Keine Geschwister/Seitenlinien.
  function buildAncestorGenerations(id){
    const byId = PERSONS.byId;
    const generations = [];
    let currentGen = [id];
    const seen = new Set([id]);
    while (generations.length < 12){
      const parents = [];
      currentGen.forEach(pid => {
        const p = byId[pid];
        if (!p) return;
        if (p.vater_id != null && byId[p.vater_id] && !seen.has(p.vater_id)){ parents.push(p.vater_id); seen.add(p.vater_id); }
        if (p.mutter_id != null && byId[p.mutter_id] && !seen.has(p.mutter_id)){ parents.push(p.mutter_id); seen.add(p.mutter_id); }
      });
      if (!parents.length) break;
      generations.push(parents);
      currentGen = parents;
    }
    return generations;
  }

  // ---------------------------------------------------------------
  // Detailansicht: eine Person zentriert, mit direkter Linie
  // (Vorfahren) darueber und allen Nachkommen darunter.
  // ---------------------------------------------------------------
  const viewOverview = document.getElementById('view-overview');
  const viewDetail = document.getElementById('view-detail');
  const detailRoot = document.getElementById('detail-root');

  function renderDetailView(id){
    const p = PERSONS.byId[id];
    if (!p){ location.hash = ''; return; }
    detailRoot.innerHTML = '';

    const back = document.createElement('a');
    back.href = '#';
    back.className = 'back-link';
    back.textContent = '← Zurück zur Gesamtübersicht';
    back.addEventListener('click', (e) => { e.preventDefault(); location.hash = ''; });
    detailRoot.appendChild(back);

    // --- Vorfahren-Leiter (darueber) ---
    const generations = buildAncestorGenerations(id);
    if (generations.length){
      const ancWrap = document.createElement('div');
      ancWrap.className = 'ancestor-ladder';
      [...generations].reverse().forEach(gen => {
        const row = document.createElement('div');
        row.className = 'ancestor-row';
        gen.forEach(pid => {
          const c = document.createElement('div');
          c.innerHTML = personCardHTML(PERSONS.byId[pid]);
          row.appendChild(c.firstElementChild);
        });
        ancWrap.appendChild(row);
        const conn = document.createElement('div');
        conn.className = 'ladder-connector';
        ancWrap.appendChild(conn);
      });
      detailRoot.appendChild(ancWrap);
    }

    // --- Fokus-Person + Ehepartner ---
    const focusWrap = document.createElement('div');
    focusWrap.className = 'focus-wrap';
    focusWrap.innerHTML = personDetailCardHTML(p);
    (p.ehepartner_ids||[]).forEach(sid => {
      const sp = PERSONS.byId[sid];
      if (!sp) return;
      const link = document.createElement('span');
      link.className = 'spouse-link';
      link.textContent = '⚭';
      focusWrap.appendChild(link);
      const wrap = document.createElement('div');
      wrap.innerHTML = personDetailCardHTML(sp);
      focusWrap.appendChild(wrap.firstElementChild);
    });
    detailRoot.appendChild(focusWrap);

    // --- Nachkommen (darunter) ---
    const subtree = buildSubtreeFor(id);
    if (subtree.children && subtree.children.length){
      const conn = document.createElement('div');
      conn.className = 'ladder-connector';
      detailRoot.appendChild(conn);
      const scroller = document.createElement('div');
      scroller.className = 'tree-scroll';
      const ul = document.createElement('ul');
      ul.className = 'tree';
      subtree.children.forEach(c => ul.appendChild(renderNode(c)));
      scroller.appendChild(ul);
      detailRoot.appendChild(scroller);
    }

    window.scrollTo(0, 0);
  }

  function showOverview(){
    viewDetail.style.display = 'none';
    viewOverview.style.display = '';
    jumpSelect.style.display = '';
    renderAll(rebuildForest());
  }

  function showDetail(id){
    viewOverview.style.display = 'none';
    viewDetail.style.display = '';
    jumpSelect.style.display = 'none';
    renderDetailView(id);
  }

  function route(){
    const m = location.hash.match(/^#\/person\/(\d+)/);
    if (m && PERSONS.byId[Number(m[1])]) showDetail(Number(m[1]));
    else showOverview();
  }
  window.addEventListener('hashchange', route);
  loadPersons().then(route);

  // Klick auf eine Karte (aber nicht auf den Bearbeiten-Stift) oeffnet die Detailansicht.
  document.addEventListener('click', (e) => {
    if (e.target.closest('.edit-btn') || e.target.closest('.toggle') || e.target.closest('.back-link')) return;
    const card = e.target.closest('.card, .detail-card');
    if (card && card.dataset.pid){
      location.hash = '#/person/' + card.dataset.pid;
    }
  });

  jumpSelect.addEventListener('change', () => {
    const id = jumpSelect.value;
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({behavior:'smooth', block:'start'});
  });

  document.getElementById('expandAll').addEventListener('click', () => {
    document.querySelectorAll('.children-wrap.collapsed').forEach(el => el.classList.remove('collapsed'));
    document.querySelectorAll('.toggle').forEach(t => t.textContent = '−');
  });
  document.getElementById('collapseAll').addEventListener('click', () => {
    document.querySelectorAll('.children-wrap').forEach(el => el.classList.add('collapsed'));
    document.querySelectorAll('.toggle').forEach(t => t.textContent = '+');
  });
  const searchInput = document.getElementById('search');
  const searchCount = document.getElementById('search-count');
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 150);
  });

  function runSearch(){
    const q = searchInput.value.trim().toLowerCase();
    const allCards = document.querySelectorAll('.card');
    allCards.forEach(c => c.classList.remove('match'));
    if (!q){ searchCount.textContent = ''; return; }
    let matches = [];
    allCards.forEach(c => {
      if (c.dataset.name && c.dataset.name.includes(q)){
        c.classList.add('match');
        matches.push(c);
      }
    });
    searchCount.textContent = matches.length + ' Treffer';
    if (matches.length){
      let p = matches[0].closest('.children-wrap.collapsed');
      while(p){
        p.classList.remove('collapsed');
        p = p.parentElement.closest('.children-wrap.collapsed');
      }
      matches[0].scrollIntoView({behavior:'smooth', block:'center', inline:'center'});
    }
  }

  const modalRoot = document.getElementById('modal-root');

  function personOptionsHTML(excludeId){
    return Object.values(PERSONS.byId)
      .filter(p => p.id !== excludeId)
      .sort((a,b) => fullName(a).localeCompare(fullName(b), 'de'))
      .map(p => `<option value="${escapeHtml(fullName(p))}"></option>`)
      .join('');
  }

  function openEditModal(id){
    const p = PERSONS.byId[id];
    if (!p) return;
    const currentKids = new Set(p.kinder_ids || []);

    modalRoot.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-card" role="dialog" aria-modal="true" aria-label="Person bearbeiten">
          <div class="modal-head">
            <h2>${escapeHtml(fullName(p))}</h2>
            <button class="modal-close" id="modal-close" aria-label="Schliessen">&times;</button>
          </div>
          <div class="modal-body">
            <label>Geschlecht
              <select id="f-geschlecht">
                <option value="">–</option>
                <option value="m" ${p.geschlecht==='m'?'selected':''}>männlich</option>
                <option value="w" ${p.geschlecht==='w'?'selected':''}>weiblich</option>
                <option value="divers" ${p.geschlecht==='divers'?'selected':''}>divers</option>
              </select>
            </label>
            <div class="row2">
              <label>Vorname<input type="text" id="f-vorname" value="${escapeHtml(p.vorname||'')}"></label>
              <label>Zweitname<input type="text" id="f-zweitname" value="${escapeHtml(p.zweitname||'')}"></label>
            </div>
            <div class="row2">
              <label>Nachname<input type="text" id="f-nachname" value="${escapeHtml(p.nachname||'')}"></label>
              <label>Mädchenname<input type="text" id="f-maedchenname" value="${escapeHtml(p.maedchenname||'')}"></label>
            </div>
            <div class="row2">
              <label>Geburtsdatum<input type="text" id="f-geburt" placeholder="TT.MM.JJJJ oder JJJJ" value="${escapeHtml(p.geburt || p.jg || '')}"></label>
              <label>Geburtsort<input type="text" id="f-geburtsort" value="${escapeHtml(p.geburtsort||'')}"></label>
            </div>
            <div class="row2">
              <label>Heimatort<input type="text" id="f-heimatort" value="${escapeHtml(p.heimatort||'')}"></label>
              <label>Gestorben am<input type="text" id="f-sterbe" placeholder="TT.MM.JJJJ oder JJJJ" value="${escapeHtml(p.sterbe || p.todesjahr || '')}"></label>
            </div>
            <label>Beziehung
              <select id="f-beziehung">
                <option value="">–</option>
                <option value="Partner" ${p.beziehungsstatus==='Partner'?'selected':''}>Partner</option>
                <option value="Verlobt" ${p.beziehungsstatus==='Verlobt'?'selected':''}>Verlobt</option>
                <option value="Verheiratet" ${p.beziehungsstatus==='Verheiratet'?'selected':''}>Verheiratet</option>
                <option value="Geschieden" ${p.beziehungsstatus==='Geschieden'?'selected':''}>Geschieden</option>
                <option value="Getrennt" ${p.beziehungsstatus==='Getrennt'?'selected':''}>Getrennt</option>
              </select>
            </label>
            <label>von: (Partner)
              <input type="text" id="f-partner" list="person-datalist" placeholder="Namen tippen …" value="${escapeHtml(p.ehepartner_raw || (p.ehepartner_ids&&p.ehepartner_ids[0]!=null ? fullName(PERSONS.byId[p.ehepartner_ids[0]]) : ''))}">
            </label>
            <label>Kinder
              <input type="text" id="f-kinder-search" placeholder="Person suchen zum Hinzufügen …">
            </label>
            <div class="kinder-box" id="f-kinder-box"></div>
            <label>Bemerkungen/Infos
              <textarea id="f-bem" rows="3">${escapeHtml(p.bem||'')}</textarea>
            </label>
          </div>
          <div class="modal-foot">
            <button id="modal-cancel">Abbrechen</button>
            <button id="modal-save" class="primary">Speichern</button>
          </div>
          <div class="pin-row" id="pin-row">
            <span>&#128274;</span>
            <input type="text" id="pin-input" placeholder="Familien-PIN">
            <button id="pin-confirm">Bestätigen</button>
          </div>
          <p class="saved-msg" id="saved-msg"></p>
          <p class="error-msg" id="error-msg"></p>
        </div>
      </div>
      <datalist id="person-datalist">${personOptionsHTML(id)}</datalist>
    `;

    const kindsBox = document.getElementById('f-kinder-box');
    function renderKidsBox(filter){
      const q = (filter||'').trim().toLowerCase();
      const items = Object.values(PERSONS.byId)
        .filter(pp => pp.id !== id)
        .filter(pp => !q || fullName(pp).toLowerCase().includes(q) || currentKids.has(pp.id))
        .sort((a,b) => {
          const as = currentKids.has(a.id) ? 0 : 1;
          const bs = currentKids.has(b.id) ? 0 : 1;
          if (as !== bs) return as - bs;
          return fullName(a).localeCompare(fullName(b), 'de');
        })
        .slice(0, 60);
      kindsBox.innerHTML = items.map(pp => `
        <label class="kid-row">
          <input type="checkbox" data-kid="${pp.id}" ${currentKids.has(pp.id) ? 'checked' : ''}>
          ${escapeHtml(fullName(pp))}${pp.jg ? ' (*' + pp.jg + ')' : ''}
        </label>`).join('') || '<p class="hint">keine Treffer</p>';
      kindsBox.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
          const kid = Number(cb.dataset.kid);
          if (cb.checked) currentKids.add(kid); else currentKids.delete(kid);
        });
      });
    }
    renderKidsBox('');
    document.getElementById('f-kinder-search').addEventListener('input', (e) => renderKidsBox(e.target.value));

    function close(){ modalRoot.innerHTML = ''; }
    document.getElementById('modal-close').addEventListener('click', close);
    document.getElementById('modal-cancel').addEventListener('click', close);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') close();
    });

    document.getElementById('modal-save').addEventListener('click', () => {
      document.getElementById('pin-row').classList.add('show');
      document.getElementById('saved-msg').classList.remove('show');
    });

    document.getElementById('pin-confirm').addEventListener('click', async () => {
      const pin = document.getElementById('pin-input').value.trim();
      const errEl = document.getElementById('error-msg');
      errEl.classList.remove('show');
      if (!pin){
        document.getElementById('pin-input').style.borderColor = 'var(--seal-red)';
        return;
      }
      const confirmBtn = document.getElementById('pin-confirm');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Speichert …';
      const ok = await applyEdits(pin);
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Bestätigen';
      if (!ok){
        errEl.textContent = DB_READY
          ? 'Konnte nicht speichern — PIN falsch oder keine Verbindung zur Datenbank.'
          : 'Konnte nicht speichern.';
        errEl.classList.add('show');
        return;
      }
      document.getElementById('pin-row').classList.remove('show');
      document.getElementById('saved-msg').textContent = DB_READY
        ? 'Gespeichert — sichtbar für alle.'
        : 'Gespeichert (nur lokal in diesem Browser — noch keine Datenbank verbunden).';
      document.getElementById('saved-msg').classList.add('show');
      setTimeout(close, 1100);
    });

    async function applyEdits(pin){
      p.geschlecht = document.getElementById('f-geschlecht').value || null;
      p.vorname = document.getElementById('f-vorname').value.trim() || null;
      p.zweitname = document.getElementById('f-zweitname').value.trim() || null;
      p.nachname = document.getElementById('f-nachname').value.trim() || null;
      p.maedchenname = document.getElementById('f-maedchenname').value.trim() || null;

      const geb = document.getElementById('f-geburt').value.trim();
      if (/^\d{4}$/.test(geb)) { p.geburt = null; p.jg = Number(geb); }
      else if (geb) { p.geburt = geb; const m = geb.match(/(\d{4})$/); p.jg = m ? Number(m[1]) : p.jg; }
      else { p.geburt = null; p.jg = null; }

      p.geburtsort = document.getElementById('f-geburtsort').value.trim() || null;
      p.heimatort = document.getElementById('f-heimatort').value.trim() || null;

      const st = document.getElementById('f-sterbe').value.trim();
      if (/^\d{4}$/.test(st)) { p.sterbe = null; p.todesjahr = Number(st); }
      else if (st) { p.sterbe = st; const m = st.match(/(\d{4})$/); p.todesjahr = m ? Number(m[1]) : p.todesjahr; }
      else { p.sterbe = null; p.todesjahr = null; }

      p.beziehungsstatus = document.getElementById('f-beziehung').value || null;

      const partnerTyped = document.getElementById('f-partner').value.trim();
      p.ehepartner_raw = partnerTyped || null;
      const match = Object.values(PERSONS.byId).find(pp => fullName(pp).toLowerCase() === partnerTyped.toLowerCase());
      p.ehepartner_ids = match ? [match.id] : [];

      p.bem = document.getElementById('f-bem').value.trim() || null;

      const slot = p.geschlecht === 'w' ? 'mutter_id' : 'vater_id';
      const changedChildren = [];
      Object.values(PERSONS.byId).forEach(pp => {
        let touched = false;
        if (pp.vater_id === id && !currentKids.has(pp.id)) { pp.vater_id = null; touched = true; }
        if (pp.mutter_id === id && !currentKids.has(pp.id)) { pp.mutter_id = null; touched = true; }
        if (touched) changedChildren.push(pp);
      });
      currentKids.forEach(kid => {
        const child = PERSONS.byId[kid];
        if (!child) return;
        if (child.vater_id === id || child.mutter_id === id) return;
        if (slot === 'vater_id' && child.vater_id == null) child.vater_id = id;
        else if (slot === 'mutter_id' && child.mutter_id == null) child.mutter_id = id;
        else if (child.vater_id == null) child.vater_id = id;
        else if (child.mutter_id == null) child.mutter_id = id;
        changedChildren.push(child);
      });
      p.kinder_ids = [...currentKids];

      const result = await persistPerson(p, pin);
      if (!result.ok) return false;
      await persistChildLinks(changedChildren, pin);

      route();
      return true;
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-btn');
    if (btn) openEditModal(Number(btn.dataset.editId));
  });
})();
