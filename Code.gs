// =====================================================================
// Stammbaum Apps Script Backend
// Ersetzt Supabase: liest/schreibt direkt in die drei Google-Sheets
// "Stammbaum - Personen", "Stammbaum - Beziehungen", "Stammbaum - Aenderungen"
// (drei separate Dateien, ueber ihre feste Datei-ID angesprochen)
// =====================================================================

var PIN = 'Nyffi'; // muss mit dem PIN in config.js (app.js) uebereinstimmen

// Spalten, die immer als Klartext behandelt werden muessen (nie als
// Datum interpretieren) - sonst wandelt Google Sheets z.B. "09.01.2022"
// automatisch in ein echtes Datum um (Risiko: Tag/Monat vertauscht je
// nach Spracheinstellung, und beim Zurueücklesen kommt ein ISO-Zeitstempel
// statt des eingegebenen Textes raus).
var TEXT_COLUMNS = ['geburt', 'sterbe', 'von_datum', 'bis_datum'];

var FILE_ID_PERSONEN    = '1KuoHWoWLRsT2bOA2pJSFUcTjmbGX7L-T6RpXxgNQNFU';
var FILE_ID_BEZIEHUNGEN = '12VgRJFVkZ5Bkv8ZO1IILVaBGEJo8QEac8lMxUdyW9YU';
var FILE_ID_AENDERUNGEN = '16npUQBS9DnGrF1IgiuWgWuHCB280GnBoTYAscpT7nVg';

// ---------- Web-App-Einstiegspunkte ----------

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var resource = (e.parameter && e.parameter.resource) || 'all';
    var data;
    if (resource === 'all') {
      data = {
        personen: readSheet(FILE_ID_PERSONEN),
        beziehungen: readSheet(FILE_ID_BEZIEHUNGEN),
        aenderungen: readSheet(FILE_ID_AENDERUNGEN)
      };
    } else {
      data = readSheet(resourceToFileId(resource));
    }
    return jsonOutput(data);
  } catch (err) {
    return jsonOutput({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.pin !== PIN) {
      return jsonOutput({ error: 'invalid_pin' });
    }

    var result;
    if (body.action === 'batch') {
      result = body.items.map(function (item) {
        return upsertRow(resourceToFileId(item.resource), item.id, item.data, !item.id);
      });
      body.items.forEach(function (item) { logChange(item.resource, item); });
    } else if (body.action === 'insert' || body.action === 'update') {
      var fileId = resourceToFileId(body.resource);
      result = upsertRow(fileId, body.id || null, body.data, body.action === 'insert');
      logChange(body.resource, body);
    } else {
      return jsonOutput({ error: 'unknown_action' });
    }

    return jsonOutput({ ok: true, result: result });
  } catch (err) {
    return jsonOutput({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------- Helfer ----------

function resourceToFileId(resource) {
  if (resource === 'personen') return FILE_ID_PERSONEN;
  if (resource === 'beziehungen') return FILE_ID_BEZIEHUNGEN;
  throw new Error('unbekannte resource: ' + resource);
}

// Jede Datei hat genau ein (erstes) Tabellenblatt - unabhaengig von dessen Namen.
function getSheet(fileId) {
  return SpreadsheetApp.openById(fileId).getSheets()[0];
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function readSheet(fileId) {
  var sheet = getSheet(fileId);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.join('') === '') continue; // leere Zeile ueberspringen
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var val = row[c];
      if (val === '' || val === null || val === undefined) {
        obj[headers[c]] = null;
      } else if (val instanceof Date) {
        obj[headers[c]] = val.toISOString();
      } else {
        obj[headers[c]] = val;
      }
    }
    rows.push(obj);
  }
  return rows;
}

// Legt eine Zeile an (isInsert=true, id wird automatisch vergeben) oder
// aktualisiert eine bestehende Zeile (per id in Spalte "id").
function upsertRow(fileId, id, data, isInsert) {
  var sheet = getSheet(fileId);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');
  if (idCol === -1) throw new Error('Spalte "id" fehlt in Datei ' + fileId);

  if (isInsert) {
    var maxId = 0;
    for (var r = 1; r < values.length; r++) {
      var v = Number(values[r][idCol]);
      if (!isNaN(v) && v > maxId) maxId = v;
    }
    id = maxId + 1;
  }

  var rowIndex = -1;
  for (var r2 = 1; r2 < values.length; r2++) {
    if (String(values[r2][idCol]) === String(id)) { rowIndex = r2; break; }
  }

  var rowData = headers.map(function (h) {
    if (h === 'id') return id;
    if (h === 'updated_at') return new Date().toISOString();
    if (data && Object.prototype.hasOwnProperty.call(data, h)) {
      var v = data[h];
      return (v === null || v === undefined) ? '' : v;
    }
    return (rowIndex >= 0) ? values[rowIndex][headers.indexOf(h)] : '';
  });

  // Zielzeile bestimmen: bestehende Zeile aktualisieren, oder neue Zeile
  // direkt hinter der letzten anhaengen (statt appendRow, damit wir VOR dem
  // Schreiben noch das Zellformat setzen koennen - siehe unten).
  var targetRow = (rowIndex >= 0) ? rowIndex + 1 : values.length + 1;

  // Text-Spalten (siehe TEXT_COLUMNS) auf Klartext-Format setzen, BEVOR der
  // Wert reinkommt - sonst erkennt Google Sheets z.B. "09.01.2022" selbst
  // als Datum und wandelt die Zelle um; ein nachtraeglicher Formatwechsel
  // wuerde den schon falsch gespeicherten Wert nicht mehr reparieren.
  headers.forEach(function (h, c) {
    if (TEXT_COLUMNS.indexOf(h) !== -1) {
      sheet.getRange(targetRow, c + 1).setNumberFormat('@');
    }
  });

  sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowData]);
  return { id: id };
}

// Haengt einen Eintrag im Aenderungsverlauf an (serverseitig, Client schreibt
// diese Tabelle nie direkt).
function logChange(resource, body) {
  try {
    var sheet = getSheet(FILE_ID_AENDERUNGEN);
    var values = sheet.getDataRange().getValues();
    var maxId = 0;
    for (var r = 1; r < values.length; r++) {
      var v = Number(values[r][0]);
      if (!isNaN(v) && v > maxId) maxId = v;
    }
    var personId = body.id || (body.data && body.data.person_id) || '';
    var hinweis = JSON.stringify(body.data || {}).substring(0, 400);
    sheet.appendRow([
      maxId + 1,
      new Date().toISOString(),
      personId,
      body.action,
      'Familie (PIN)',
      hinweis
    ]);
  } catch (err) {
    // Protokollierung darf das eigentliche Speichern nie verhindern
  }
}
