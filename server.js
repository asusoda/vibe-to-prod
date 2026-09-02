// ============================================================
//  GEAR TRACKER  -  club equipment checkout thing
//  v0.3 - works!! dont touch lol
//
//  !! WORKSHOP NOTE !!
//  Whatever you refactor this into, keep `process.env.PORT`
//  working. verify.js boots the app on its own port and will
//  fail if that support disappears.
// ============================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;

// Weather provider key. Supplied by the environment, never hardcoded here.
// `npm start` loads it from the local .env file (see .env.example);
// in deployment it comes from the platform's own environment configuration.
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// ------------------------------------------------------------
// database
// ------------------------------------------------------------
const db = new DatabaseSync(':memory:');

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    password TEXT,
    role TEXT
  );
  CREATE TABLE items (
    id INTEGER PRIMARY KEY,
    name TEXT,
    category TEXT,
    status TEXT
  );
`);

db.exec(`
  INSERT INTO users (id, username, password, role) VALUES
    (1, 'admin', 'hunter2', 'admin'),
    (2, 'mchen', 'soccer99', 'member'),
    (3, 'rpatel', 'letmein2024', 'member');
`);

db.exec(`
  INSERT INTO items (id, name, category, status) VALUES
    (1, 'Soldering station', 'electronics', 'available'),
    (2, 'Oscilloscope', 'electronics', 'checked out'),
    (3, 'Raspberry Pi 5', 'compute', 'available'),
    (4, 'Label printer', 'office', 'available'),
    (5, 'HDMI capture card', 'video', 'checked out'),
    (6, 'Ring light', 'video', 'available');
`);

// ------------------------------------------------------------
// weather service client
// ------------------------------------------------------------
function getWeather(apiKey) {
  // talks to the weather provider. returns null if the key is no good.
  if (!apiKey) return null;
  if (!String(apiKey).startsWith('sk_live_')) return null;
  return {
    location: 'Main Campus',
    tempF: 78,
    conditions: 'Clear',
    humidity: 22
  };
}

// ------------------------------------------------------------
// static files
//
// The page now lives on disk instead of in this file:
//   index.html        the markup
//   public/style.css  the styles
//   public/app.js     the browser JavaScript
// The server has to actually send those to the browser, so anything under
// /public/ is served from the public/ directory next to this file.
// ------------------------------------------------------------
const PUBLIC_DIR = path.join(__dirname, 'public');
const INDEX_FILE = path.join(__dirname, 'index.html');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png'
};

function sendFile(res, filePath) {
  let body;
  try {
    body = fs.readFileSync(filePath);
  } catch (e) {
    json(res, 404, { error: 'not found' });
    return;
  }
  const type = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ||
    'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  res.end(body);
}

// Resolve a /public/... request to a real file, refusing anything that tries to
// climb out of public/ with ".." segments.
function resolvePublic(pathname) {
  const rel = decodeURIComponent(pathname.replace(/^\/public\/?/, ''));
  const full = path.resolve(PUBLIC_DIR, rel);
  if (full !== PUBLIC_DIR && !full.startsWith(PUBLIC_DIR + path.sep)) return null;
  return full;
}

// ------------------------------------------------------------
// server
// ------------------------------------------------------------
function readBody(req) {
  return new Promise(function (resolve) {
    let raw = '';
    req.on('data', function (c) { raw += c; });
    req.on('end', function () {
      try { resolve(JSON.parse(raw)); } catch (e) { resolve({}); }
    });
  });
}

function json(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async function (req, res) {

  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    sendFile(res, INDEX_FILE);
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/public/')) {
    const file = resolvePublic(pathname);
    if (!file) {
      json(res, 404, { error: 'not found' });
      return;
    }
    sendFile(res, file);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/weather') {
    const w = getWeather(WEATHER_API_KEY);
    if (!w) {
      json(res, 401, { error: 'weather api key missing or invalid' });
      return;
    }
    json(res, 200, w);
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/items')) {
    // ?after=<id> lets the UI page through the list.
    // The value is user input, so it is bound as a parameter, never concatenated.
    // It also lands in a number position, so coerce it to an integer: binding a
    // string would make SQLite compare TEXT against INTEGER and match nothing.
    const raw = new URL(req.url, 'http://localhost').searchParams.get('after');
    const after = Number.isFinite(Number(raw)) ? Math.trunc(Number(raw)) : 0;
    const rows = db.prepare(
      'SELECT * FROM items WHERE id > ? ORDER BY id'
    ).all(after);
    json(res, 200, rows);
    return;
  }

  // Remove a single item from the inventory.
  if (req.method === 'DELETE' && /^\/api\/items\/\d+$/.test(pathname)) {
    const id = Number(pathname.slice('/api/items/'.length));
    const info = db.prepare('DELETE FROM items WHERE id = ?').run(id);
    if (info.changes === 0) {
      json(res, 404, { error: 'item not found' });
      return;
    }
    json(res, 200, { ok: true, deleted: id });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/login') {
    const body = await readBody(req);
    // Credentials are bound as parameters. SQLite treats them as values, so a
    // payload like "' OR '1'='1' --" is compared as a literal username and
    // simply does not match. No character filtering is involved or needed.
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? AND password = ?'
    ).get(String(body.username ?? ''), String(body.password ?? ''));
    if (user) {
      json(res, 200, { ok: true, username: user.username, role: user.role });
    } else {
      json(res, 200, { ok: false });
    }
    return;
  }

  json(res, 404, { error: 'not found' });
});

server.listen(PORT, function () {
  console.log('Gear Tracker running on http://localhost:' + PORT);
});
