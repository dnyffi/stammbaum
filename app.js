(function(){
  const SEALS = ['var(--red)','var(--green)','var(--dark-blue)','var(--gold)'];
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
    if (!CFG.anonKey || !CFG.anonKey.startsWith('sb_')){
      h['Authorization'] = 'Bearer ' + CFG.anonKey;
    }
    if (withPin) h['x-family-pin'] = CFG.pin || '';
    return h;
  }

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
    if (kind === 'db'){
      window.displayDataSource('Datenbank verbunden', 'ok');
    } else if (kind === 'db-error'){
      window.displayDataSource('Datenbank nicht erreichbar (lokal)', 'warn');
    } else {
      window.displayDataSource('Lokal gespeichert (keine Datenbank)', 'warn');
    }
  }

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

  function personCardHTML(p){
    const dates = fmtDates(p);
    const sym = genderSymbol(p.geschlecht);
    return `<div class="card" data-pid="${p.id}" data-name="${escapeHtml(fullName(p).toLowerCase())}">
        <button class="edit-btn" data-edit-id="${p.id}" title="Bearbeiten" aria-label="Bearbeiten">✎</button>
        <div class="name">${escapeHtml(fullName(p))} ${sym ? `<span class="gender">${sym}</span>` : ''}</div>
        <div class="dates">${escapeHtml(dates)}</div>
      </div>`;
  }

  function personDetailCardHTML(p){
    const sym = genderSymbol(p.geschlecht);
    const dates = fmtDates(p);
    const spouse_txt = (p.ehepartner_ids && p.ehepartner_ids[0] != null)
      ? escapeHtml(fullName(PERSONS.byId[p.ehepartner_ids[0]])) : (p.ehepartner_raw ? escapeHtml(p.ehepartner_raw) : '?');
    const rel_txt = p.beziehungsstatus || 'unbekannt';
    return `
      <div class="detail-card">
        <button class="edit-btn" data-edit-id="${p.id}" title="Bearbeiten">✎</button>
        <div class="name">${escapeHtml(fullName(p))} ${sym}</div>
        <div class="dates">${escapeHtml(dates)}</div>
        <dl class="detail-fields">
          ${p.geburtsort ? `<dt>Geburtsort</dt><dd>${escapeHtml(p.geburtsort)}</dd>` : ''}
          ${p.heimatort ? `<dt>Heimatort</dt><dd>${escapeHtml(p.heimatort)}</dd>` : ''}
          ${p.sterbe ? `<dt>Sterbedatum</dt><dd>${escapeHtml(p.sterbe)}</dd>` : ''}
          ${p.beziehungsstatus ? `<dt>Beziehung</dt><dd>${escapeHtml(rel_txt)}</dd>` : ''}
          ${p.ehepartner_ids && p.ehepartner_ids[0] != null ? `<dt>⚭ Partner</dt><dd>${spouse_txt}</dd>` : ''}
          ${p.ehepartner_raw && (!p.ehepartner_ids || !p.ehepartner_ids[0]) ? `<dt>⚭ Partner (Text)</dt><dd>${escapeHtml(p.ehepartner_raw)}</dd>` : ''}
          ${p.bem ? `<dt>Bemerkungen</dt><dd>${escapeHtml(p.bem)}</dd>` : ''}
        </dl>
      </div>
    `;
  }

  function personOptionsHTML(self_id){
    return Object.values(PERSONS.byId)
      .filter(p => p.id !== self_id)
      .map(p => `<option value="${escapeHtml(fullName(p))}">${escapeHtml(fullName(p))}</option>`)
      .join('');
  }

  const branchesMap = {};
  function registerBranch(title, seal, ids){
    branchesMap[title] = { seal, ids };
  }

  const treeCache = {};
  function buildTreeHTML(rootId, branchTitle){
    const key = String(rootId);
    if (treeCache[key]) return treeCache[key];
    
    const visited = new Set();
    function traverse(id){
      if (visited.has(id)) return '';
      visited.add(id);
      const p = PERSONS.byId[id];
      if (!p) return '';
      const kids = Object.values(PERSONS.byId).filter(pp => pp.vater_id === id || pp.mutter_id === id);
      const spouses = (p.ehepartner_ids || []).map(sid => PERSONS.byId[sid]).filter(Boolean);
      const html = personCardHTML(p);
      let item = `<li class="node-li ${kids.length ? '' : 'no-children'}">
        ${html}
        ${kids.length ? '<div class="connector-down"></div>' : ''}
      `;
      if (kids.length){
        item += `<div class="children-wrap">
          <ul class="tree">
            ${kids.map(k => traverse(k.id)).join('')}
          </ul>
        </div>
        <button class="toggle" data-toggle="${id}" title="Toggle">${p.kinder_collapsed ? '+' : '−'}</button>
        `;
      }
      item += '</li>';
      return item;
    }
    
    const content = traverse(rootId);
    treeCache[key] = content;
    return content;
  }

  const roots = {};
  function registerRoot(title, seal, rootId){
    roots[title] = { seal, rootId };
  }

  function route(){
    const loc = window.location.hash.slice(1);
    if (loc.startsWith('person/')){
      const pid = Number(loc.slice(7));
      showDetailView(pid);
    } else {
      showOverviewView();
    }
  }

  function showOverviewView(){
    document.getElementById('view-overview').style.display = '';
    document.getElementById('view-detail').style.display = 'none';
    window.location.hash = '';
  }

  function showDetailView(pid){
    const p = PERSONS.byId[pid];
    if (!p) { showOverviewView(); return; }
    document.getElementById('view-overview').style.display = 'none';
    document.getElementById('view-detail').style.display = '';
    
    const root = document.getElementById('detail-root');
    root.innerHTML = `<a href="#" class="back-link">← Zurück zur Übersicht</a>`;
    root.querySelector('.back-link').addEventListener('click', (e) => {
      e.preventDefault();
      showOverviewView();
    });

    root.innerHTML += personDetailCardHTML(p);

    const vater = p.vater_id ? PERSONS.byId[p.vater_id] : null;
    const mutter = p.mutter_id ? PERSONS.byId[p.mutter_id] : null;
    if (vater || mutter){
      const ancestorHtml = `<div class="ancestor-ladder">
        <div class="ancestor-row">
          ${vater ? personDetailCardHTML(vater) : ''}
          ${mutter ? personDetailCardHTML(mutter) : ''}
        </div>
      </div>`;
      root.innerHTML += ancestorHtml;
    }

    const kids = Object.values(PERSONS.byId).filter(pp => pp.vater_id === pid || pp.mutter_id === pid);
    if (kids.length){
      root.innerHTML += `<h3 style="color: var(--cream); text-align: center; margin-top: 2rem;">Kinder</h3>
        <div class="tree-scroll"><ul class="tree">
          ${kids.map(k => buildTreeHTML(k.id, '')).join('')}
        </ul></div>`;
    }

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(Number(btn.dataset.editId));
      });
    });
  }

  function renderOverview(){
    if (!Object.keys(PERSONS.byId).length){
      main.innerHTML = '<p style="color: var(--text-light); text-align: center;">Keine Daten vorhanden.</p>';
      return;
    }

    const allPeople = Object.values(PERSONS.byId);
    const roots = [];
    const seenIds = new Set();
    
    const byFam = {};
    allPeople.forEach(p => {
      const fam = p.nachname || 'Unbekannt';
      if (!byFam[fam]) byFam[fam] = [];
      byFam[fam].push(p);
    });

    Object.keys(byFam).sort().forEach(fam => {
      const people = byFam[fam];
      const roots_in_fam = people.filter(p => !p.vater_id && !p.mutter_id && !seenIds.has(p.id));
      roots_in_fam.forEach(r => {
        roots.push({ title: `Linie ${fam}`, seal: SEALS[roots.length % SEALS.length], root: r });
        seenIds.add(r.id);
      });
    });

    main.innerHTML = roots.map((root, idx) => {
      const branchHtml = `
        <div class="branch">
          <div class="branch-title">
            <span class="branch-dot" style="background: ${root.seal}"></span>
            ${escapeHtml(root.title)}
          </div>
          <div class="tree-scroll">
            <ul class="tree">
              <li class="node-li">${buildTreeHTML(root.root.id, root.title)}</li>
            </ul>
          </div>
        </div>
      `;
      return branchHtml;
    }).join('');

    attachEventHandlers();
  }

  function attachEventHandlers(){
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => {
        const pid = Number(card.dataset.pid);
        window.location.hash = '#person/' + pid;
      });
    });

    document.querySelectorAll('.toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.toggle);
        const p = PERSONS.byId[id];
        if (p) {
          p.kinder_collapsed = !p.kinder_collapsed;
          const wrap = btn.parentElement.querySelector('.children-wrap');
          if (wrap) wrap.classList.toggle('collapsed');
          btn.textContent = p.kinder_collapsed ? '+' : '−';
        }
      });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(Number(btn.dataset.editId));
      });
    });
  }

  let searchTimer;
  function updateSearch(){
    const query = document.getElementById('search').value.toLowerCase().trim();
    const allCards = document.querySelectorAll('.card');
    let matchCount = 0;
    allCards.forEach(card => {
      const name = card.dataset.name || '';
      const matches = !query || name.includes(query);
      card.classList.toggle('match', matches && query);
      card.classList.toggle('dim', query && !matches);
      if (matches && query) matchCount++;
    });
    document.getElementById('search-count').textContent = query ? `${matchCount} Treffer` : '';
  }

  document.getElementById('search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(updateSearch, 200);
  });

  document.getElementById('jump').addEventListener('change', (e) => {
    const fam = e.target.value;
    if (fam){
      const section = document.querySelector(`[data-family="${fam}"]`);
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    }
  });

  document.addEventListener('expandAll', () => {
    Object.values(PERSONS.byId).forEach(p => { p.kinder_collapsed = false; });
    document.querySelectorAll('.children-wrap').forEach(w => w.classList.remove('collapsed'));
    document.querySelectorAll('.toggle').forEach(t => { t.textContent = '−'; });
  });

  document.addEventListener('collapseAll', () => {
    Object.values(PERSONS.byId).forEach(p => { p.kinder_collapsed = true; });
    document.querySelectorAll('.children-wrap').forEach(w => w.classList.add('collapsed'));
    document.querySelectorAll('.toggle').forEach(t => { t.textContent = '+'; });
  });

  function openEditModal(id){
    const p = PERSONS.byId[id];
    if (!p) return;
    const modalRoot = document.getElementById('modal-root');
    const currentKids = new Set(p.kinder_ids || []);

    const personList = Object.values(PERSONS.byId)
      .map(pp => `<option value="${escapeHtml(fullName(pp))}">${escapeHtml(fullName(pp))}</option>`)
      .join('');

    modalRoot.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-card">
          <div class="modal-head">
            <h2>Bearbeiten: ${escapeHtml(fullName(p))}</h2>
            <button class="modal-close" id="modal-close">×</button>
          </div>
          <div class="modal-body">
            <label>Geschlecht
              <select id="f-geschlecht">
                <option value="">–</option>
                <option value="m" ${p.geschlecht==='m'?'selected':''}>Männlich</option>
                <option value="w" ${p.geschlecht==='w'?'selected':''}>Weiblich</option>
                <option value="divers" ${p.geschlecht==='divers'?'selected':''}>Divers</option>
              </select>
            </label>
            <div class="row2">
              <label>Vorname<input type="text" id="f-vorname" value="${escapeHtml(p.vorname||'')}"></label>
              <label>Zweiter Name<input type="text" id="f-zweitname" value="${escapeHtml(p.zweitname||'')}"></label>
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
            <span>🔒</span>
            <input type="text" id="pin-input" placeholder="Familien-PIN">
            <button id="pin-confirm">Bestätigen</button>
          </div>
          <p class="saved-msg" id="saved-msg"></p>
          <p class="error-msg" id="error-msg"></p>
        </div>
      </div>
      <datalist id="person-datalist">${personList}</datalist>
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
        document.getElementById('pin-input').style.borderColor = 'var(--red)';
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
        : 'Gespeichert (nur lokal in diesem Browser).';
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

  // Init
  (async () => {
    await loadPersons();
    renderOverview();
    route();
  })();
})();
