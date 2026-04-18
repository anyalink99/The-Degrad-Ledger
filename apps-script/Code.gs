/**
 * THE DEGRAD LEDGER — Google Apps Script backend.
 *
 * DEPLOY:
 *   1. Create a new Google Sheet. Name it whatever you like.
 *   2. Extensions → Apps Script. Delete the starter code. Paste THIS file.
 *   3. Save (Ctrl+S). Give the project any name.
 *   4. Deploy → New deployment → type "Web app".
 *        · Execute as: Me
 *        · Who has access: Anyone (required for the static frontend to POST; audit log handles trust)
 *   5. Authorize when prompted. Copy the Web App URL that ends in /exec.
 *   6. Paste that URL into the frontend's setup screen on first open.
 *
 * The frontend POSTs with Content-Type text/plain to avoid the CORS preflight
 * that Apps Script web apps do not support.
 */

const SHEET_PEOPLE = 'people';
const SHEET_RATINGS = 'ratings';
const PROP_ADMIN = 'ADMIN_ID';

const PEOPLE_COLS = ['id', 'name', 'created_at', 'created_by'];
const RATINGS_COLS = ['ts', 'date', 'kind', 'rater_id', 'ratee_id', 'value', 'note'];

// -------- Sheet bootstrap --------
function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let p = ss.getSheetByName(SHEET_PEOPLE);
  if (!p) {
    p = ss.insertSheet(SHEET_PEOPLE);
    p.getRange(1, 1, 1, PEOPLE_COLS.length).setValues([PEOPLE_COLS]).setFontWeight('bold');
    // Force text format on created_at so timestamps survive as strings
    p.getRange('C:C').setNumberFormat('@');
  }
  let r = ss.getSheetByName(SHEET_RATINGS);
  if (!r) {
    r = ss.insertSheet(SHEET_RATINGS);
    r.getRange(1, 1, 1, RATINGS_COLS.length).setValues([RATINGS_COLS]).setFontWeight('bold');
    r.getRange('A:A').setNumberFormat('@'); // ts
    r.getRange('B:B').setNumberFormat('@'); // date
  }
  return { ss, p, r };
}

// -------- Readers --------
function readAll_(sheet, cols) {
  const range = sheet.getDataRange().getValues();
  if (range.length < 2) return [];
  const [headers, ...rows] = range;
  const idx = cols.map(c => headers.indexOf(c));
  return rows.map(row => {
    const o = {};
    cols.forEach((c, i) => {
      let v = idx[i] >= 0 ? row[idx[i]] : '';
      if (v instanceof Date) {
        if (c === 'date') v = Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd');
        else v = v.toISOString();
      }
      o[c] = v;
    });
    return o;
  }).filter(o => o.id || o.ts);
}

function appendRow_(sheet, cols, obj) {
  sheet.appendRow(cols.map(c => obj[c] === undefined || obj[c] === null ? '' : obj[c]));
}

// -------- Utils --------
function uid_() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function nowIso_() {
  return Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
}
function todayStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// -------- HTTP handlers --------
function doGet(e) {
  return route_('bootstrap', {});
}

function doPost(e) {
  let payload = {};
  try { payload = JSON.parse(e.postData.contents); } catch (_) {}
  const action = payload.action;
  delete payload.action;
  return route_(action, payload);
}

function route_(action, p) {
  try {
    const fn = ACTIONS[action];
    const res = fn ? fn(p) : { ok: false, error: 'Неизвестная операция: ' + action };
    return jsonOut_(res);
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message || String(err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// -------- Actions --------
const ACTIONS = {
  bootstrap() {
    const { p, r } = ensureSheets_();
    const people = readAll_(p, PEOPLE_COLS);
    const ratings = readAll_(r, RATINGS_COLS).map(x => ({
      ts: String(x.ts || ''),
      date: String(x.date || '').slice(0, 10),
      kind: String(x.kind || ''),
      rater_id: String(x.rater_id || ''),
      ratee_id: String(x.ratee_id || ''),
      value: x.value === '' || x.value === null ? null : Number(x.value),
      note: x.note === '' || x.note === null ? '' : String(x.note),
    }));
    const adminId = PropertiesService.getScriptProperties().getProperty(PROP_ADMIN) || null;
    return { ok: true, people, ratings, adminId };
  },

  create_person(args) {
    const name = String(args.name || '').trim();
    if (!name) return { ok: false, error: 'Пустое имя' };
    const { p } = ensureSheets_();
    const props = PropertiesService.getScriptProperties();
    let adminId = props.getProperty(PROP_ADMIN);

    if (!adminId) {
      const newId = uid_();
      appendRow_(p, PEOPLE_COLS, { id: newId, name, created_at: nowIso_(), created_by: newId });
      props.setProperty(PROP_ADMIN, newId);
      return { ok: true, person: { id: newId, name }, founder: true };
    }

    if (String(args.rater_id) !== String(adminId)) {
      return { ok: false, error: 'Добавлять в редакцию может только редактор' };
    }

    const newId = uid_();
    appendRow_(p, PEOPLE_COLS, { id: newId, name, created_at: nowIso_(), created_by: String(args.rater_id) });
    return { ok: true, person: { id: newId, name } };
  },

  set_initial(args) {
    const rater = String(args.rater_id || '');
    const ratee = String(args.ratee_id || '');
    if (!rater || !ratee) return { ok: false, error: 'rater/ratee отсутствуют' };
    if (rater === ratee) return { ok: false, error: 'Оценивать себя нельзя' };
    const v = Math.round(Number(args.value));
    if (!Number.isFinite(v) || v < 0 || v > 50) return { ok: false, error: 'Начальное значение 0–50' };
    const { r } = ensureSheets_();
    appendRow_(r, RATINGS_COLS, {
      ts: nowIso_(), date: todayStr_(), kind: 'initial',
      rater_id: rater, ratee_id: ratee, value: v, note: '',
    });
    return { ok: true };
  },

  set_delta(args) {
    const rater = String(args.rater_id || '');
    const ratee = String(args.ratee_id || '');
    if (!rater || !ratee) return { ok: false, error: 'rater/ratee отсутствуют' };
    if (rater === ratee) return { ok: false, error: 'Оценивать себя нельзя' };
    const d = Number(args.delta);
    if (![-1, 0, 1].includes(d)) return { ok: false, error: 'Дельта должна быть −1 / 0 / +1' };
    const { r } = ensureSheets_();
    appendRow_(r, RATINGS_COLS, {
      ts: nowIso_(), date: todayStr_(), kind: 'delta',
      rater_id: rater, ratee_id: ratee, value: d, note: String(args.note || ''),
    });
    return { ok: true };
  },

  edit_note(args) {
    const rater = String(args.rater_id || '');
    const ratee = String(args.ratee_id || '');
    const date = String(args.date || '').slice(0, 10);
    if (!rater || !ratee || !date) return { ok: false, error: 'Параметры отсутствуют' };
    const { r } = ensureSheets_();
    const rows = readAll_(r, RATINGS_COLS);
    const existing = rows.filter(x =>
      String(x.rater_id) === rater &&
      String(x.ratee_id) === ratee &&
      String(x.date).slice(0, 10) === date &&
      x.kind === 'delta'
    ).sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1))[0];
    if (!existing) return { ok: false, error: 'Нет такой записи' };
    appendRow_(r, RATINGS_COLS, {
      ts: nowIso_(), date, kind: 'delta',
      rater_id: rater, ratee_id: ratee,
      value: Number(existing.value), note: String(args.note || ''),
    });
    return { ok: true };
  },

  delete_note(args) {
    const rater = String(args.rater_id || '');
    const ratee = String(args.ratee_id || '');
    const date = String(args.date || '').slice(0, 10);
    if (!rater || !ratee || !date) return { ok: false, error: 'Параметры отсутствуют' };
    const { r } = ensureSheets_();
    const rows = readAll_(r, RATINGS_COLS);
    const existing = rows.filter(x =>
      String(x.rater_id) === rater &&
      String(x.ratee_id) === ratee &&
      String(x.date).slice(0, 10) === date &&
      x.kind === 'delta'
    ).sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1))[0];
    if (!existing) return { ok: false, error: 'Нет такой записи' };
    appendRow_(r, RATINGS_COLS, {
      ts: nowIso_(), date, kind: 'delta',
      rater_id: rater, ratee_id: ratee,
      value: Number(existing.value), note: '',
    });
    return { ok: true };
  },
};

// -------- Manual admin override (run from editor if needed) --------
function setAdminByName(name) {
  const { p } = ensureSheets_();
  const people = readAll_(p, PEOPLE_COLS);
  const found = people.find(x => x.name === name);
  if (!found) throw new Error('Не найдено: ' + name);
  PropertiesService.getScriptProperties().setProperty(PROP_ADMIN, found.id);
  return found.id;
}
