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
    if (withPin){ const n = editorName(); if (n) h['x-editor-name'] = encodeURIComponent(n); }
    return h;
  }
  // Wer bearbeitet? (für den Änderungsverlauf, im Browser gemerkt)
  function editorName(){ try { return localStorage.getItem('stammbaum.editor') || ''; } catch(e){ return ''; } }
  function setEditorName(n){ try { localStorage.setItem('stammbaum.editor', n); } catch(e){} }
  // Gibt es die Heiratsfelder schon in der Datenbank?
  let HAS_HEIRAT = false;

  // ---------------------------------------------------------------
  // Laden: zuerst aus der Datenbank (falls config.js ausgefuellt ist),
  // sonst aus den eingebetteten Daten (forest_embed.js) als Offline-Fallback.
  // ---------------------------------------------------------------
  // IDs immer als Zahlen fuehren (die Datenbank kann sie je nach Einstellung als Text liefern)
  function normalizeIds(r){
    const num = v => (v === null || v === undefined || v === '') ? null : Number(v);
    r.id = num(r.id);
    r.vater_id = num(r.vater_id);
    r.mutter_id = num(r.mutter_id);
    r.ehepartner_ids = (r.ehepartner_ids || []).map(num).filter(v => v !== null && !isNaN(v));
    return r;
  }

  async function loadPersons(){
    if (DB_READY){
      try {
        const res = await fetch(REST + '?select=*', { headers: dbHeaders(false) });
        if (res.ok){
          const rows = await res.json();
          if (rows.length){
            HAS_HEIRAT = rows.some(r => Object.prototype.hasOwnProperty.call(r, 'heirat_datum'));
            rows.forEach(r => { normalizeIds(r); PERSONS.byId[r.id] = r; });
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
    (window.ALL_PERSONS || []).forEach(p => { const c = normalizeIds(Object.assign({}, p)); PERSONS.byId[c.id] = c; });
    markSource(DB_READY ? 'db-error' : 'offline');
    applyStoredEdits();
  }

  function markSource(kind){
    const el = document.getElementById('data-source');
    if (!el) return;
    if (kind === 'db'){
      el.textContent = 'Datenbank verbunden. Änderungen gelten für alle.';
      el.classList.add('ok');
    } else if (kind === 'db-error'){
      el.textContent = 'Datenbank nicht erreichbar. Es wird der letzte bekannte Stand gezeigt, Änderungen nur lokal.';
      el.classList.add('warn');
    } else {
      el.textContent = 'Keine Datenbank verbunden. Änderungen werden nur in diesem Browser gespeichert.';
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
    if (HAS_HEIRAT){ body.heirat_datum = person.heirat_datum || null; body.heirat_ort = person.heirat_ort || null; }
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

  // Neue Person in der Datenbank anlegen (mit PIN)
  async function insertPerson(person, pin){
    if (!DB_READY){ persistLocal(person); return { ok: true, mode: 'local' }; }
    const body = {
      id: person.id,
      vorname: person.vorname, zweitname: person.zweitname, nachname: person.nachname,
      maedchenname: person.maedchenname, geschlecht: person.geschlecht,
      geburt: person.geburt, jg: person.jg, geburtsort: person.geburtsort,
      heimatort: person.heimatort, sterbe: person.sterbe, todesjahr: person.todesjahr,
      beziehungsstatus: person.beziehungsstatus, ehepartner_raw: person.ehepartner_raw,
      ehepartner_ids: person.ehepartner_ids && person.ehepartner_ids.length ? person.ehepartner_ids : null,
      vater_id: person.vater_id, mutter_id: person.mutter_id, bem: person.bem,
    };
    if (HAS_HEIRAT){ body.heirat_datum = person.heirat_datum || null; body.heirat_ort = person.heirat_ort || null; }
    const headers = dbHeaders(true);
    headers['x-family-pin'] = pin;
    headers['Prefer'] = 'return=representation';
    async function post(b){
      const res = await fetch(REST, { method: 'POST', headers, body: JSON.stringify(b) });
      return { res, txt: res.ok ? '' : await res.text() };
    }
    try {
      let { res, txt } = await post(body);
      // falls die Datenbank die ID selbst vergibt ("generated always"), ohne ID nochmals versuchen
      if (!res.ok && /generated always|identity/i.test(txt)){
        const b2 = Object.assign({}, body); delete b2.id;
        ({ res, txt } = await post(b2));
      }
      if (!res.ok) return { ok: false, mode: 'db', error: txt };
      const rows = await res.json().catch(() => []);
      if (rows && rows[0] && rows[0].id != null) person.id = Number(rows[0].id);
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
      rows.push(['Beziehung', [p.beziehungsstatus, partnerName].filter(Boolean).join(' mit ')]);
    }
    if (p.heirat_datum || p.heirat_ort) rows.push(['Heirat', [p.heirat_datum, p.heirat_ort ? 'in ' + p.heirat_ort : ''].filter(Boolean).join(' ')]);
    if (p.bem) rows.push(['Bemerkungen', p.bem]);
    return `<div class="detail-card" data-pid="${p.id}">
        <button class="edit-btn" data-edit-id="${p.id}" title="Bearbeiten" aria-label="Bearbeiten">&#9998;</button>
        <div class="name">${escapeHtml(fullName(p))} ${sym ? `<span class="gender">${sym}</span>` : ''}</div>
        <div class="dates">${escapeHtml(dates)}</div>
        ${rows.length ? `<dl class="detail-fields">${rows.map(([k,v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>` : ''}
      </div>`;
  }

  // Kinder und Partnergruppen in der richtigen Reihenfolge (nach Geburtsjahr) anhaengen
  function childItems(node){
    const items = [...(node.children||[])];
    (node.groups||[]).forEach(g => items.push(g));
    const key = n => n.isGroup ? Math.min(...n.children.map(c => c.jg||9999)) : (n.jg||9999);
    return items.sort((a,b) => key(a) - key(b));
  }

  function renderNode(node){
    const li = document.createElement('li');
    li.className = 'node-li' + (node.isGroup ? ' group-li' : '');

    const unit = document.createElement('div');
    unit.className = 'unit';
    if (node.isGroup){
      const sym = node.isEx ? '⚮' : '+';
      const txt = node.isEx ? 'getrennt / geschieden' : 'weiterer Elternteil';
      unit.innerHTML = `<div class="group-head"><span class="group-label"><span class="sym">${sym}</span> ${txt}</span>${personCardHTML(node.partner)}</div>`;
      unit.querySelector('.card').classList.add('ex-card');
    } else {
      unit.innerHTML = personCardHTML(node);
    }

    (node.isGroup ? [] : (node.spouses||[])).forEach(sp => {
      const link = document.createElement('span');
      link.className = 'spouse-link';
      link.textContent = '⚭';
      unit.appendChild(link);
      const wrap = document.createElement('div');
      wrap.innerHTML = personCardHTML(sp);
      unit.appendChild(wrap.firstElementChild);
    });

    li.appendChild(unit);

    const items = childItems(node);
    const hasKids = items.length > 0;
    if (hasKids){
      const toggle = document.createElement('button');
      toggle.className = 'toggle';
      toggle.textContent = '−';
      toggle.title = 'Nachkommen ein-/ausblenden';
      unit.style.position = 'relative';
      unit.appendChild(toggle);

      const childUl = document.createElement('ul');
      childUl.className = 'tree children-wrap';
      items.forEach(c => childUl.appendChild(renderNode(c)));
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
    (node.groups||[]).forEach(g => { n += countDescendants(g); });
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
      section.style.setProperty('--tinct', dotColor);
      title.innerHTML = `<span class="branch-dot" style="background:${dotColor}"></span>${escapeHtml(root.name)} <span class="n">${kidCount} Nachkommen</span>`;
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
    const stats = document.getElementById('stats');
    if (stats) stats.textContent = Object.keys(PERSONS.byId).length + ' Personen';
    buildStammBar(forest);
    document.dispatchEvent(new CustomEvent('tree:rendered'));
  }

  // ---------------------------------------------------------------
  // Stammbaum-Auswahl: die 4 grössten Stämme als eigene Ansicht,
  // die übrigen Zweige unter "Weitere", plus "Alle".
  // ---------------------------------------------------------------
  const STAMM_KEY = 'stammbaum.stamm';
  const MAIN_STAEMME = 4;
  let stammList = [];          // [{key, label, count, sections:[id]}]
  function savedStamm(){ try { return localStorage.getItem(STAMM_KEY) || ''; } catch(e){ return ''; } }
  function saveStamm(k){ try { localStorage.setItem(STAMM_KEY, k); } catch(e){} }

  function buildStammBar(forest){
    const bar = document.getElementById('stamm-bar');
    const sel = document.getElementById('stamm-select');
    if (!bar && !sel) return;
    // alle Personen-IDs eines Zweigs (Nachkommen inkl. Partner)
    function collect(node, set){
      set.add(node.id);
      (node.spouses || []).forEach(sp => set.add(sp.id));
      (node.children || []).forEach(c => collect(c, set));
      (node.groups || []).forEach(g => { set.add(g.partner.id); g.children.forEach(c => collect(c, set)); });
      return set;
    }
    const items = forest.map((root, i) => {
      const p = PERSONS.byId[root.id];
      const label = (p && p.nachname) || root.name;
      const ids = collect(root, new Set());
      // wie viele tragen den Namen des Stammvaters? (entscheidet bei gleich grossen Zweigen)
      let same = 0; ids.forEach(id => { const q = PERSONS.byId[id]; if (q && q.nachname && q.nachname.split('-').includes(label)) same++; });
      const kidIds = [...(root.children || []), ...(root.groups || []).flatMap(g => g.children)].map(c => c.id);
      return { id: 'branch-' + i, label, count: countDescendants(root), ids, same, rootId: root.id, kidIds };
    }).sort((a, b) => b.count - a.count || b.same - a.same);
    // Zweige, die schon in einem grösseren Stamm stecken (Stammvater ist dort Partner,
    // oder alle seine Kinder sind dort eingeheiratet), zählen nicht als eigener Stamm.
    const main = [], rest = [];
    items.forEach(it => {
      const covered = main.some(m => m.ids.has(it.rootId) ||
        (it.kidIds.length > 0 && it.kidIds.every(id => m.ids.has(id))));
      if (main.length < MAIN_STAEMME && !covered && it.count > 0) main.push(it); else rest.push(it);
    });
    stammList = main.map(it => ({ key: 'n:' + it.label, label: it.label, count: it.count, sections: [it.id] }));
    if (rest.length) stammList.push({ key: 'weitere', label: 'Weitere', count: rest.length, sections: rest.map(r => r.id), isRest: true });
    stammList.push({ key: 'alle', label: 'Alle', count: forest.length, sections: items.map(r => r.id), isAll: true });

    if (bar){
      bar.innerHTML = '<span class="stamm-label">Stammbaum</span>' + stammList.map(st => {
        const sub = st.isAll ? st.count + ' Zweige' : (st.isRest ? st.count + ' Zweige' : st.count + ' Nachkommen');
        return `<button type="button" class="stamm-chip" data-stamm="${escapeHtml(st.key)}">${escapeHtml(st.label)}<small>${escapeHtml(sub)}</small></button>`;
      }).join('');
      bar.querySelectorAll('.stamm-chip').forEach(b => b.addEventListener('click', () => applyStamm(b.dataset.stamm, true)));
    }
    if (sel){
      sel.innerHTML = stammList.map(st => {
        const txt = st.isAll ? 'Alle Zweige' : st.isRest ? 'Weitere Zweige (' + st.count + ')' : 'Stamm ' + st.label + ' (' + st.count + ')';
        return `<option value="${escapeHtml(st.key)}">${escapeHtml(txt)}</option>`;
      }).join('');
    }
    const statsEl = document.getElementById('stats');
    if (statsEl){
      const nMain = stammList.filter(x => !x.isAll && !x.isRest).length;
      const nRest = (stammList.find(x => x.isRest) || { count: 0 }).count;
      statsEl.textContent = nMain + ' Stämme' + (nRest ? ', ' + nRest + ' kleinere Zweige' : '') + ', ' + Object.keys(PERSONS.byId).length + ' Personen';
    }

    let want = savedStamm();
    if (!stammList.some(st => st.key === want)){
      const nyff = stammList.find(st => st.key === 'n:Nyffenegger');
      want = nyff ? nyff.key : stammList[0].key;
    }
    applyStamm(want, false);
  }

  function stammOfSection(sectionId){
    const st = stammList.find(x => !x.isAll && x.sections.includes(sectionId));
    return st ? st.key : 'alle';
  }

  function applyStamm(key, userAction){
    const st = stammList.find(x => x.key === key) || stammList[stammList.length - 1];
    if (!st) return;
    const show = new Set(st.sections);
    main.querySelectorAll('.branch').forEach(sec => { sec.style.display = show.has(sec.id) ? '' : 'none'; });
    const sel = document.getElementById('stamm-select');
    if (sel) sel.value = st.key;
    document.querySelectorAll('#stamm-bar .stamm-chip').forEach(b => {
      const on = b.dataset.stamm === st.key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    saveStamm(st.key);
    if (userAction){
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.dispatchEvent(new CustomEvent('tree:rendered'));
    }
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

  // Getrennt/geschieden: reicht, wenn es bei einer der beiden Personen steht.
  function isExStatus(x){ return /geschieden|getrennt/i.test((x && x.beziehungsstatus) || ''); }

  // Aktuelle Partner von p: verknuepft, nicht getrennt, und nicht inzwischen mit jemand anderem verknuepft.
  function currentSpouseIds(p){
    const byId = PERSONS.byId;
    return (p.ehepartner_ids||[]).filter(sid => {
      const sp = byId[sid];
      if (!sp || sid === p.id) return false;
      // Wer selbst "Geschieden" ist, hat keinen aktuellen Partner; ist der Partner geschieden, ebenfalls nicht mehr
      if (isExStatus(sp) || isExStatus(p)) return false;
      const back = sp.ehepartner_ids || [];
      return !(back.length && !back.includes(p.id));
    });
  }

  function buildNode(id, childrenOf, stack){
    const byId = PERSONS.byId;
    const p = byId[id];
    const curIds = currentSpouseIds(p);
    const spouseObjs = curIds.map(sid => personObj(byId[sid]));
    let kidIds = [...(childrenOf[id]||[])];
    curIds.forEach(sid => {
      (childrenOf[sid]||[]).forEach(cid => { if (!kidIds.includes(cid)) kidIds.push(cid); });
    });
    kidIds.sort((a,b) => (byId[a].jg||9999) - (byId[b].jg||9999));
    const kids = [];
    const groupMap = {};
    kidIds.forEach(cid => {
      if (stack.has(id) || cid === id) return;
      const child = byId[cid];
      const built = buildNode(cid, childrenOf, new Set([...stack, id]));
      // anderer Elternteil dieses Kindes (aus Sicht von p)
      let other = null;
      if (child.vater_id === id) other = child.mutter_id;
      else if (child.mutter_id === id) other = child.vater_id;
      if (other != null && byId[other] && !curIds.includes(other)){
        (groupMap[other] = groupMap[other] || []).push(built);
      } else {
        kids.push(built);
      }
    });
    const node = personObj(p);
    node.spouses = spouseObjs;
    node.children = kids;
    node.groups = Object.keys(groupMap).map(oid => {
      const partner = byId[oid];
      const ex = isExStatus(partner) || (p.ehepartner_ids||[]).includes(Number(oid)) || (partner.ehepartner_ids||[]).includes(id);
      return { isGroup:true, isEx:ex, id:partner.id, partner:personObj(partner), children:groupMap[oid], groups:[] };
    });
    return node;
  }

  function rebuildForest(){
    const byId = PERSONS.byId;
    const childrenOf = computeChildrenOf();
    const visited = new Set();

    // Alle Personen eines gebauten Zweigs (inkl. Nachkommen und Ehepartner) als gezeigt markieren,
    // damit niemand zusaetzlich als eigener Zweig auftaucht.
    function markAll(n){
      visited.add(n.id);
      (n.spouses||[]).forEach(s => visited.add(s.id));
      (n.children||[]).forEach(markAll);
      (n.groups||[]).forEach(g => { visited.add(g.partner.id); g.children.forEach(markAll); });
    }
    function build(id, stack){ const n = buildNode(id, childrenOf, stack); markAll(n); return n; }

    const hasParents = id => !!byId[id] && (byId[id].vater_id != null || byId[id].mutter_id != null);
    const allIds = Object.values(byId).sort((a,b) => (a.jg||9999)-(b.jg||9999)).map(p => p.id);
    // Stammeltern: ohne Eltern im Baum. Eingeheiratete (Partner hat Eltern) erscheinen beim Partner.
    // Mit wem hat diese Person gemeinsame Kinder?
    const coParents = id => (childrenOf[id]||[]).map(c => byId[c].vater_id === id ? byId[c].mutter_id : byId[c].vater_id).filter(x => x != null);
    const roots = allIds.filter(id => !hasParents(id) && ![...(byId[id].ehepartner_ids||[]), ...coParents(id)].some(hasParents));
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
      link.textContent = currentSpouseIds(p).includes(sid) ? '⚭' : '⚮';
      link.title = link.textContent === '⚮' ? 'getrennt / geschieden' : 'verheiratet / Partner';
      focusWrap.appendChild(link);
      const wrap = document.createElement('div');
      wrap.innerHTML = personDetailCardHTML(sp);
      focusWrap.appendChild(wrap.firstElementChild);
    });
    detailRoot.appendChild(focusWrap);

    // --- Nachkommen (darunter) ---
    const subtree = buildSubtreeFor(id);
    if (childItems(subtree).length){
      const conn = document.createElement('div');
      conn.className = 'ladder-connector';
      detailRoot.appendChild(conn);
      const scroller = document.createElement('div');
      scroller.className = 'tree-scroll';
      const ul = document.createElement('ul');
      ul.className = 'tree';
      childItems(subtree).forEach(c => ul.appendChild(renderNode(c)));
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

  // ---------------------------------------------------------------
  // Datenpruefung: findet Widersprueche in den aktuellen Daten
  // ---------------------------------------------------------------
  function yearOf(d, j){ if (j) return Number(j); const m = String(d||'').match(/(\d{4})/); return m ? Number(m[1]) : null; }

  function runChecks(){
    const byId = PERSONS.byId, all = Object.values(byId);
    const groups = [];
    const G = (title, help) => { const g = { title, help, rows: [] }; groups.push(g); return g; };
    const link = x => x ? `<a href="#/person/${x.id}">${escapeHtml(fullName(x))}</a>${yearOf(x.geburt,x.jg) ? ' *' + yearOf(x.geburt,x.jg) : ''}` : '?';

    const gSelf = G('Person ist als eigener Elternteil eingetragen', 'Vater oder Mutter zeigt auf die Person selbst. Meist wurde bei gleichem Namen (Vater und Sohn) die falsche Person gewählt.');
    const gAge = G('Unplausibles Alter der Eltern', 'Vater jünger als 15 oder älter als 70, Mutter jünger als 14 oder älter als 50 bei der Geburt. Oft eine Verwechslung bei gleichem Namen oder ein Tippfehler im Jahr.');
    const gDeath = G('Widersprüchliche Lebensdaten', 'Tod vor der Geburt oder Geburt nach dem Tod eines Elternteils.');
    const gSex = G('Geschlecht passt nicht zur Rolle', 'Als Vater eingetragen, aber weiblich, oder umgekehrt.');
    const gNoSex = G('Geschlecht fehlt', 'Ohne Geschlecht kann beim Zuordnen von Kindern nicht entschieden werden, ob Vater oder Mutter gemeint ist.');
    const gOne = G('Partner nur einseitig verknüpft', 'A verweist auf B, aber B nicht auf A. Häufig wurde bei gleichem Namen die falsche Person verknüpft, oder es ist eine frühere Beziehung (dann bei der Person Beziehung auf Geschieden setzen).');
    const gText = G('Partner nur als Text eingetragen', 'Der Name steht im Feld Partner, ist aber mit keiner Person verknüpft. Tipp: im Bearbeiten-Fenster den Namen aus der Vorschlagsliste wählen.');
    const gPair = G('Eltern eines Kindes sind kein Paar', 'Vater und Mutter sind eingetragen, aber nicht als Partner miteinander verknüpft.');
    const gDup = G('Möglicher Doppeleintrag', 'Gleicher Vorname, passender Nachname oder Mädchenname und kein widersprechendes Geburtsjahr.');
    const gLone = G('Person ohne jede Verbindung', 'Keine Eltern, keine Kinder, kein verknüpfter Partner. Diese Personen hängen lose im Baum.');
    const gCycle = G('Kreis in der Abstammung', 'Die Person ist über mehrere Generationen ihr eigener Vorfahre. Das ist immer ein Verknüpfungsfehler.');
    const gSameDeath = G('Gleicher Todestag wie ein Elternteil', 'Kind und Elternteil haben dasselbe genaue Todesdatum. Kann stimmen (Unglück), ist aber oft ein Kopierfehler.');
    const gFormat = G('Datum im falschen Format', 'Erlaubt sind TT.MM.JJJJ oder JJJJ (bei unbekanntem Tod auch "?"). Ungültige Tage wie 31.02. werden ebenfalls gemeldet.');
    const gJg = G('Jahrgang passt nicht zum Geburtsdatum', 'Das Feld Jahrgang und das Jahr im Geburtsdatum sind verschieden.');
    const gOld = G('Vermutlich verstorben, Todesdatum fehlt', 'Über 105 Jahre alt und ohne Todesdatum. Bitte Todesjahr eintragen oder "?" setzen.');
    const gMarr = G('Unplausible Heirat', 'Heirat vor dem 16. Altersjahr, nach dem Tod, oder die beiden Partner haben verschiedene Heiratsdaten.');
    const gMissing = G('Elternteil fehlt, Partner wäre bekannt', 'Nur ein Elternteil ist eingetragen, dieser hat aber genau einen verknüpften Partner. Vermutlich ist das der andere Elternteil.');
    const gSib = G('Geschwister mit gleichem Vornamen', 'Zwei Kinder derselben Eltern heissen gleich. Früher üblich, wenn das erste Kind jung starb; sonst oft ein Doppeleintrag.');

    all.forEach(p => {
      const v = byId[p.vater_id], m = byId[p.mutter_id];
      const b = yearOf(p.geburt, p.jg), d = yearOf(p.sterbe, p.todesjahr);
      if (p.vater_id === p.id || p.mutter_id === p.id) gSelf.rows.push(link(p));
      if (b && d && d < b) gDeath.rows.push(`${link(p)}: gestorben ${d} vor Geburt ${b}`);
      [['Vater', v, 15, 70], ['Mutter', m, 14, 50]].forEach(([r, x, mn, mx]) => {
        if (!x || x.id === p.id) return;
        const xb = yearOf(x.geburt, x.jg), xd = yearOf(x.sterbe, x.todesjahr);
        if (b && xb && (b - xb < mn || b - xb > mx)) gAge.rows.push(`${link(p)}: ${r} ${link(x)} wäre bei der Geburt ${b - xb} Jahre alt`);
        if (b && xd && b > xd + (r === 'Vater' ? 1 : 0)) gDeath.rows.push(`${link(p)}: geboren nach dem Tod von ${r} ${link(x)} †${xd}`);
      });
      if (v && v.geschlecht === 'w') gSex.rows.push(`${link(p)}: Vater ${link(v)} ist weiblich eingetragen`);
      if (m && m.geschlecht === 'm') gSex.rows.push(`${link(p)}: Mutter ${link(m)} ist männlich eingetragen`);
      if (!p.geschlecht) gNoSex.rows.push(link(p));
      (p.ehepartner_ids||[]).forEach(sid => {
        const sp = byId[sid];
        if (sp && sid !== p.id && !(sp.ehepartner_ids||[]).includes(p.id) && !isExStatus(p))
          gOne.rows.push(`${link(p)} verweist auf ${link(sp)}, umgekehrt fehlt der Verweis`);
      });
      if (p.ehepartner_raw && !(p.ehepartner_ids||[]).length){
        const t = p.ehepartner_raw.trim().toLowerCase();
        const hit = all.filter(x => x.id !== p.id && [x.vorname, x.nachname].filter(Boolean).join(' ').toLowerCase() === t);
        gText.rows.push(`${link(p)}: "${escapeHtml(p.ehepartner_raw)}"` + (hit.length ? `, passende Person vorhanden: ${hit.map(link).join(', ')}` : ''));
      }
      if (v && m && !(v.ehepartner_ids||[]).includes(m.id) && !(m.ehepartner_ids||[]).includes(v.id))
        gPair.rows.push(`${link(p)}: ${link(v)} und ${link(m)}`);
      const hasKids = all.some(x => x.vater_id === p.id || x.mutter_id === p.id);
      const linkedByOthers = all.some(x => (x.ehepartner_ids||[]).includes(p.id));
      if (p.vater_id == null && p.mutter_id == null && !(p.ehepartner_ids||[]).length && !hasKids && !linkedByOthers) gLone.rows.push(link(p));

      // Datumsformat
      const okDate = t => {
        if (t == null || t === '') return true;
        const s = String(t).trim();
        if (s === '?' || /^(ca\.?\s*)?\d{4}$/.test(s) || /^nach\s+\d{4}$/i.test(s) || /^vor\s+\d{4}$/i.test(s)) return true;
        const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (!m) return false;
        const dd = +m[1], mm = +m[2], yy = +m[3];
        if (mm < 1 || mm > 12) return false;
        return dd >= 1 && dd <= new Date(yy, mm, 0).getDate();
      };
      [['Geburt', p.geburt], ['Tod', p.sterbe], ['Heirat', p.heirat_datum]].forEach(([w, t]) => {
        if (!okDate(t)) gFormat.rows.push(`${link(p)}: ${w} "${escapeHtml(t)}"`);
      });
      const gy = (String(p.geburt || '').match(/(\d{4})/) || [])[1];
      if (p.jg && gy && Number(gy) !== Number(p.jg)) gJg.rows.push(`${link(p)}: Jahrgang ${p.jg}, Geburtsdatum ${escapeHtml(p.geburt)}`);
      if (b && !p.sterbe && !p.todesjahr && new Date().getFullYear() - b > 105) gOld.rows.push(`${link(p)}: wäre ${new Date().getFullYear() - b} Jahre alt`);

      // gleicher Todestag wie Elternteil
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(String(p.sterbe || '').trim())){
        [v, m].forEach(x => { if (x && x.id !== p.id && String(x.sterbe || '').trim() === String(p.sterbe).trim()) gSameDeath.rows.push(`${link(p)} und ${link(x)}: beide † ${escapeHtml(p.sterbe)}`); });
      }

      // Heirat
      const hy = yearOf(p.heirat_datum, null);
      if (hy){
        if (b && hy - b < 16) gMarr.rows.push(`${link(p)}: Heirat ${hy} mit ${hy - b} Jahren`);
        if (d && hy > d) gMarr.rows.push(`${link(p)}: Heirat ${hy} nach dem Tod ${d}`);
        const sp = byId[(p.ehepartner_ids || [])[0]];
        if (sp && sp.id > p.id && (sp.ehepartner_ids || [])[0] === p.id && sp.heirat_datum && sp.heirat_datum !== p.heirat_datum)
          gMarr.rows.push(`${link(p)} (${escapeHtml(p.heirat_datum)}) und ${link(sp)} (${escapeHtml(sp.heirat_datum)}): verschiedene Heiratsdaten`);
      }

      // fehlender Elternteil, Partner bekannt
      const one = v && !m ? v : (m && !v ? m : null);
      if (one && (one.ehepartner_ids || []).length === 1 && byId[one.ehepartner_ids[0]])
        gMissing.rows.push(`${link(p)}: ${one === v ? 'Mutter' : 'Vater'} fehlt, vermutlich ${link(byId[one.ehepartner_ids[0]])}`);
    });

    // Kreise in der Abstammung
    all.forEach(p => {
      const seen = new Set(); let stack = [p.vater_id, p.mutter_id], loop = false, guard = 0;
      while (stack.length && guard++ < 5000){
        const x = stack.pop();
        if (x == null || !byId[x] || seen.has(x)) continue;
        if (x === p.id){ loop = true; break; }
        seen.add(x); stack.push(byId[x].vater_id, byId[x].mutter_id);
      }
      if (loop && p.vater_id !== p.id && p.mutter_id !== p.id) gCycle.rows.push(link(p));
    });

    // Geschwister mit gleichem Vornamen
    const sibs = {};
    all.forEach(p => { if (p.vater_id == null && p.mutter_id == null) return; const k = p.vater_id + '|' + p.mutter_id + '|' + (p.vorname || '').toLowerCase(); (sibs[k] = sibs[k] || []).push(p); });
    Object.values(sibs).forEach(list => { if (list.length > 1 && list[0].vorname) gSib.rows.push(list.map(link).join(' und ')); });

    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++){
      const a = all[i], c = all[j];
      if (!a.vorname || (a.vorname||'').toLowerCase() !== (c.vorname||'').toLowerCase()) continue;
      const na = [a.nachname, a.maedchenname].filter(Boolean).map(x => x.toLowerCase());
      const nc = [c.nachname, c.maedchenname].filter(Boolean).map(x => x.toLowerCase());
      if (!na.some(x => nc.some(y => x.includes(y) || y.includes(x)))) continue;
      const ya = yearOf(a.geburt, a.jg), yc = yearOf(c.geburt, c.jg);
      if (ya && yc && ya !== yc) continue;
      gDup.rows.push(`${link(a)} und ${link(c)}`);
    }
    return groups;
  }

  function renderChecks(){
    const groups = runChecks();
    const total = groups.reduce((n, g) => n + g.rows.length, 0);
    detailRoot.innerHTML = `<a href="#" class="back-link">← Zurück zur Gesamtübersicht</a>
      <div class="check-page">
        <h2>Datenprüfung</h2>
        <p class="check-intro">${total ? `${total} Hinweise in ${groups.filter(g => g.rows.length).length} Bereichen.` : 'Keine Auffälligkeiten gefunden.'}
        Die Prüfung läuft auf dem aktuellen Stand. Nicht jeder Hinweis ist ein Fehler, aber jeder ist einen Blick wert. Namen antippen öffnet die Person.</p>
        ${groups.filter(g => g.rows.length).map(g => `
          <details class="check-group" open>
            <summary>${escapeHtml(g.title)} <span class="count">${g.rows.length}</span></summary>
            <p class="check-help">${escapeHtml(g.help)}</p>
            <ul>${g.rows.map(r => `<li>${r}</li>`).join('')}</ul>
          </details>`).join('')}
      </div>`;
    detailRoot.querySelector('.back-link').addEventListener('click', e => { e.preventDefault(); location.hash = ''; });
    window.scrollTo(0, 0);
  }

  function updateCheckBadge(){
    const el = document.getElementById('check-count');
    if (el) el.textContent = runChecks().reduce((n, g) => n + g.rows.length, 0) || '';
  }
  document.addEventListener('tree:rendered', updateCheckBadge);

  function route(){
    if (location.hash === '#/pruefung'){
      viewOverview.style.display = 'none';
      viewDetail.style.display = '';
      jumpSelect.style.display = 'none';
      renderChecks();
      updateCheckBadge();
      return;
    }
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

  const stammSelect = document.getElementById('stamm-select');
  if (stammSelect) stammSelect.addEventListener('change', () => {
    const key = stammSelect.value;
    saveStamm(key);
    if (location.hash && location.hash !== '#'){ location.hash = ''; }   // route() zeigt die Übersicht mit dem gewählten Stamm
    else applyStamm(key, true);
  });

  jumpSelect.addEventListener('change', () => {
    const id = jumpSelect.value;
    if (!id) return;
    const el = document.getElementById(id);
    if (el && el.style.display === 'none'){ applyStamm(stammOfSection(id), false); document.dispatchEvent(new CustomEvent('tree:rendered')); }
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

  // Trefferliste unter dem Suchfeld: jede Person nur einmal, mit Jahrgang und Eltern
  const searchResults = document.getElementById('search-results');
  function renderSearchList(q){
    if (!searchResults) return 0;
    if (!q){ searchResults.innerHTML = ''; return 0; }
    const words = q.split(/\s+/).filter(Boolean);
    const hits = Object.values(PERSONS.byId)
      .filter(p => { const n = fullName(p).toLowerCase(); return words.every(w => n.includes(w)); })
      .sort((a, b) => fullName(a).localeCompare(fullName(b), 'de') || (a.jg || 9999) - (b.jg || 9999));
    const byId = PERSONS.byId;
    searchResults.innerHTML = hits.slice(0, 40).map(p => {
      const y = p.jg || ((String(p.geburt || '').match(/(\d{4})/) || [])[1]);
      const dy = p.todesjahr || ((String(p.sterbe || '').match(/(\d{4})/) || [])[1]);
      const yrs = y ? (dy ? y + '–' + dy : (p.sterbe ? y + '–?' : '*' + y)) : (p.sterbe ? '†' : '');
      const par = [byId[p.vater_id], byId[p.mutter_id]].filter(Boolean).map(x => x.vorname || fullName(x));
      const sp = (p.ehepartner_ids || []).map(id => byId[id]).filter(Boolean).map(fullName)[0] || p.ehepartner_raw || '';
      const sub = par.length ? 'Kind von ' + par.join(' und ') : (sp ? '⚭ ' + sp : '');
      return `<a class="search-hit" href="#/person/${p.id}">
          <span class="sh-name">${escapeHtml(fullName(p))}${yrs ? ` <span class="sh-yrs">${escapeHtml(yrs)}</span>` : ''}</span>
          ${sub ? `<span class="sh-sub">${escapeHtml(sub)}</span>` : ''}
        </a>`;
    }).join('') + (hits.length > 40 ? `<p class="sh-more">… und ${hits.length - 40} weitere. Bitte genauer suchen.</p>` : '')
      + (!hits.length ? '<p class="sh-more">Keine Person gefunden.</p>' : '');
    return hits.length;
  }

  function runSearch(){
    const q = searchInput.value.trim().toLowerCase();
    const allCards = document.querySelectorAll('.card');
    allCards.forEach(c => c.classList.remove('match'));
    const nHits = renderSearchList(q);
    if (!q){ searchCount.textContent = ''; return; }
    let matches = [];
    allCards.forEach(c => {
      if (c.dataset.name && c.dataset.name.includes(q)){
        c.classList.add('match');
        matches.push(c);
      }
    });
    searchCount.textContent = nHits === 1 ? '1 Person gefunden – antippen zum Öffnen' : nHits + ' Personen gefunden – antippen zum Öffnen';
    // im Baum nur hervorheben und hinscrollen, wenn das Menü den Baum nicht verdeckt
    if (document.body.classList.contains('drawer-open') && !window.matchMedia('(min-width: 1100px)').matches) return;
    if (matches.length){
      const visible = matches.filter(c => { const sec = c.closest('.branch'); return !sec || sec.style.display !== 'none'; });
      if (!visible.length){
        const sec = matches[0].closest('.branch');
        if (sec){ applyStamm(stammOfSection(sec.id), false); document.dispatchEvent(new CustomEvent('tree:rendered')); }
      } else if (visible[0] !== matches[0]){
        matches.splice(matches.indexOf(visible[0]), 1); matches.unshift(visible[0]);
      }
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
      .map(p => `<option value="${escapeHtml(personLabel(p))}"></option>`)
      .join('');
  }

  // Name mit Geburtsjahr, damit gleichnamige Personen (Vater und Sohn) unterscheidbar sind
  function personLabel(p){
    const y = p.jg || ((String(p.geburt||'').match(/(\d{4})/)||[])[1]);
    return fullName(p) + (y ? ` (*${y})` : '');
  }

  function openEditModal(id){
    const isNew = id == null;
    const p = isNew ? { id: null, vorname: null, zweitname: null, nachname: null, maedchenname: null,
      geschlecht: null, geburt: null, jg: null, geburtsort: null, heimatort: null, sterbe: null,
      todesjahr: null, beziehungsstatus: null, ehepartner_raw: null, ehepartner_ids: [],
      vater_id: null, mutter_id: null, bem: null } : PERSONS.byId[id];
    if (!p) return;
    const labelOfId = pid => (pid != null && PERSONS.byId[pid]) ? personLabel(PERSONS.byId[pid]) : '';
    // ohne die Person selbst: so wird ein falscher Eintrag "eigener Elternteil" beim Speichern entfernt
    const currentKids = new Set(Object.values(PERSONS.byId).filter(x => x.id !== id && (x.vater_id === id || x.mutter_id === id)).map(x => x.id));

    modalRoot.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-card" role="dialog" aria-modal="true" aria-label="Person bearbeiten">
          <div class="modal-head">
            <h2>${isNew ? 'Neue Person erfassen' : escapeHtml(fullName(p))}</h2>
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
            <div class="row2">
              <label>Vater<input type="text" id="f-vater" list="person-datalist" placeholder="Namen tippen …" value="${escapeHtml(labelOfId(p.vater_id))}"></label>
              <label>Mutter<input type="text" id="f-mutter" list="person-datalist" placeholder="Namen tippen …" value="${escapeHtml(labelOfId(p.mutter_id))}"></label>
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
              <input type="text" id="f-partner" list="person-datalist" placeholder="Namen tippen …" value="${escapeHtml(p.ehepartner_ids&&p.ehepartner_ids[0]!=null&&PERSONS.byId[p.ehepartner_ids[0]] ? personLabel(PERSONS.byId[p.ehepartner_ids[0]]) : (p.ehepartner_raw || ''))}">
            </label>
            ${HAS_HEIRAT ? `<div class="row2">
              <label>Heirat am<input type="text" id="f-heirat" placeholder="TT.MM.JJJJ oder JJJJ" value="${escapeHtml(p.heirat_datum || '')}"></label>
              <label>Heirat in<input type="text" id="f-heiratsort" value="${escapeHtml(p.heirat_ort || '')}"></label>
            </div>` : ''}
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
            <input type="text" id="editor-input" placeholder="Dein Name" value="${escapeHtml(editorName())}" autocomplete="name">
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
      const edName = (document.getElementById('editor-input') || {}).value;
      if (edName != null) setEditorName(edName.trim());
      const errEl = document.getElementById('error-msg');
      errEl.classList.remove('show');
      if (!pin){
        document.getElementById('pin-input').style.borderColor = 'var(--seal-red)';
        return;
      }
      const confirmBtn = document.getElementById('pin-confirm');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Speichert …';
      let ok = false, why = '';
      try { ok = await applyEdits(pin); } catch(e){ why = e.message || String(e); }
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Bestätigen';
      if (!ok){
        errEl.textContent = why || (DB_READY
          ? 'Konnte nicht speichern. PIN falsch oder keine Verbindung zur Datenbank.'
          : 'Konnte nicht speichern.');
        errEl.classList.add('show');
        return;
      }
      document.getElementById('pin-row').classList.remove('show');
      document.getElementById('saved-msg').textContent = DB_READY
        ? 'Gespeichert, sichtbar für alle.'
        : 'Gespeichert (nur lokal in diesem Browser, keine Datenbank verbunden).';
      document.getElementById('saved-msg').classList.add('show');
      setTimeout(close, 1100);
    });

    // Person aus einem Eingabefeld finden (mit Geburtsjahr exakt, sonst eindeutiger Name)
    function resolvePerson(typed, what){
      const t = (typed || '').trim();
      if (!t) return null;
      const low = t.toLowerCase();
      const others = Object.values(PERSONS.byId).filter(pp => pp.id !== id);
      let m = others.find(pp => personLabel(pp).toLowerCase() === low);
      if (!m){ const byName = others.filter(pp => fullName(pp).toLowerCase() === low); if (byName.length === 1) m = byName[0]; }
      if (!m) throw new Error(what + ' "' + t + '" nicht gefunden. Bitte aus der Vorschlagsliste wählen oder das Feld leeren.');
      return m.id;
    }

    async function applyEdits(pin){
      const vaterId = resolvePerson(document.getElementById('f-vater').value, 'Vater');
      const mutterId = resolvePerson(document.getElementById('f-mutter').value, 'Mutter');
      if (isNew && !document.getElementById('f-vorname').value.trim() && !document.getElementById('f-nachname').value.trim()){
        throw new Error('Bitte mindestens Vorname oder Nachname eingeben.');
      }
      p.vater_id = vaterId;
      p.mutter_id = mutterId;
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
      const low = partnerTyped.toLowerCase();
      const others = Object.values(PERSONS.byId).filter(pp => pp.id !== id);
      // 1. exakt mit Geburtsjahr gewaehlt, 2. sonst nur eindeutiger Name (bei Namensgleichheit nicht raten)
      let match = others.find(pp => personLabel(pp).toLowerCase() === low);
      if (!match){
        const byName = others.filter(pp => fullName(pp).toLowerCase() === low);
        if (byName.length === 1) match = byName[0];
      }
      p.ehepartner_raw = match ? fullName(match) : (partnerTyped || null);
      p.ehepartner_ids = match ? [match.id] : [];

      p.bem = document.getElementById('f-bem').value.trim() || null;
      let heiratChanged = false;
      if (HAS_HEIRAT){
        const hd = document.getElementById('f-heirat').value.trim() || null;
        const ho = document.getElementById('f-heiratsort').value.trim() || null;
        heiratChanged = hd !== (p.heirat_datum || null) || ho !== (p.heirat_ort || null);
        p.heirat_datum = hd; p.heirat_ort = ho;
      }

      const slot = p.geschlecht === 'w' ? 'mutter_id' : 'vater_id';
      const changedChildren = [];
      if (!isNew) Object.values(PERSONS.byId).forEach(pp => {
        let touched = false;
        if (pp.vater_id === id && !currentKids.has(pp.id)) { pp.vater_id = null; touched = true; }
        if (pp.mutter_id === id && !currentKids.has(pp.id)) { pp.mutter_id = null; touched = true; }
        if (touched) changedChildren.push(pp);
      });
      currentKids.forEach(kid => {
        const child = PERSONS.byId[kid];
        if (!child) return;
        if (isNew){ changedChildren.push(child); return; }   // wird nach dem Anlegen gesetzt
        if (child.vater_id === id || child.mutter_id === id) return;
        if (slot === 'vater_id' && child.vater_id == null) child.vater_id = id;
        else if (slot === 'mutter_id' && child.mutter_id == null) child.mutter_id = id;
        else if (child.vater_id == null) child.vater_id = id;
        else if (child.mutter_id == null) child.mutter_id = id;
        changedChildren.push(child);
      });
      p.kinder_ids = [...currentKids];

      if (isNew){
        // zuerst die neue Person anlegen, dann Kinder und Partner verknüpfen
        p.id = Math.max(0, ...Object.keys(PERSONS.byId).map(Number)) + 1;
        const res = await insertPerson(p, pin);
        if (!res.ok){ console.warn(res.error); throw new Error('Neue Person konnte nicht gespeichert werden (PIN falsch oder Anlegen in der Datenbank nicht erlaubt). ' + String(res.error || '').slice(0, 160)); }
        PERSONS.byId[p.id] = p;
        changedChildren.forEach(ch => {
          if (slot === 'vater_id' && ch.vater_id == null) ch.vater_id = p.id;
          else if (slot === 'mutter_id' && ch.mutter_id == null) ch.mutter_id = p.id;
          else if (ch.vater_id == null) ch.vater_id = p.id;
          else if (ch.mutter_id == null) ch.mutter_id = p.id;
        });
        // Partner: Verknüpfung auch beim Partner eintragen, wenn dort noch keiner steht
        const sp = p.ehepartner_ids && p.ehepartner_ids[0] != null ? PERSONS.byId[p.ehepartner_ids[0]] : null;
        if (sp && !(sp.ehepartner_ids && sp.ehepartner_ids.length)){
          sp.ehepartner_ids = [p.id];
          if (!sp.ehepartner_raw) sp.ehepartner_raw = fullName(p);
          if (!sp.beziehungsstatus && p.beziehungsstatus) sp.beziehungsstatus = p.beziehungsstatus;
          await persistPerson(sp, pin);
        }
      } else {
        const result = await persistPerson(p, pin);
        if (!result.ok) return false;
      }
      await persistChildLinks(changedChildren, pin);

      // Heiratsdaten auch beim Partner eintragen (wenn dieser auf diese Person verweist oder frei ist)
      if (HAS_HEIRAT && heiratChanged && p.ehepartner_ids && p.ehepartner_ids[0] != null){
        const sp = PERSONS.byId[p.ehepartner_ids[0]];
        if (sp && (!(sp.ehepartner_ids || []).length || sp.ehepartner_ids[0] === p.id)){
          sp.heirat_datum = p.heirat_datum; sp.heirat_ort = p.heirat_ort;
          await persistPerson(sp, pin);
        }
      }

      route();
      if (isNew) setTimeout(() => { location.hash = '#/person/' + p.id; }, 1150);
      return true;
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-btn');
    if (btn) openEditModal(Number(btn.dataset.editId));
    const nb = e.target.closest('#newPerson');
    if (nb){ e.preventDefault(); openEditModal(null); }
  });
})();
