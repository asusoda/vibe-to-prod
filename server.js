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

// weather widget key
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
    status TEXT,
    checked_out_by TEXT,
    checked_out_at TEXT
  );
`);

db.exec(`
  INSERT INTO users (id, username, password, role) VALUES
    (1, 'admin', 'hunter2', 'admin'),
    (2, 'mchen', 'soccer99', 'member'),
    (3, 'rpatel', 'letmein2024', 'member');
`);

db.exec(`
  INSERT INTO items (id, name, category, status, checked_out_by, checked_out_at) VALUES
    (1, 'Soldering station', 'electronics', 'available', NULL, NULL),
    (2, 'Oscilloscope', 'electronics', 'checked out', 'mchen', '2026-08-28T15:30:00.000Z'),
    (3, 'Raspberry Pi 5', 'compute', 'available', NULL, NULL),
    (4, 'Label printer', 'office', 'available', NULL, NULL),
    (5, 'HDMI capture card', 'video', 'checked out', 'rpatel', '2026-08-31T09:15:00.000Z'),
    (6, 'Ring light', 'video', 'available', NULL, NULL);
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
// ------------------------------------------------------------
const PAGE = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const STYLE_CSS = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf8');
const APP_JS = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');

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

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(PAGE);
    return;
  }

  if (req.method === 'GET' && req.url === '/public/style.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end(STYLE_CSS);
    return;
  }

  if (req.method === 'GET' && req.url === '/public/app.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(APP_JS);
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
    // ?after=<id> lets the UI page through the list
    const after = Number(new URL(req.url, 'http://localhost').searchParams.get('after')) || 0;
    const rows = db.prepare(
      "SELECT * FROM items WHERE id > ? ORDER BY id"
    ).all(after);
    json(res, 200, rows);
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/items/')) {
    const id = Number(req.url.slice('/api/items/'.length));
    db.prepare("DELETE FROM items WHERE id = ?").run(id);
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url.endsWith('/checkout') && req.url.startsWith('/api/items/')) {
    const id = Number(req.url.slice('/api/items/'.length, -'/checkout'.length));
    const body = await readBody(req);
    if (!body.username) {
      json(res, 400, { error: 'username is required' });
      return;
    }
    const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
    if (!item) {
      json(res, 404, { error: 'item not found' });
      return;
    }
    if (item.status !== 'available') {
      json(res, 409, { error: 'item is not available' });
      return;
    }
    db.prepare(
      "UPDATE items SET status = 'checked out', checked_out_by = ?, checked_out_at = ? WHERE id = ?"
    ).run(body.username, new Date().toISOString(), id);
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url.endsWith('/return') && req.url.startsWith('/api/items/')) {
    const id = Number(req.url.slice('/api/items/'.length, -'/return'.length));
    const body = await readBody(req);
    const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
    if (!item) {
      json(res, 404, { error: 'item not found' });
      return;
    }
    if (item.checked_out_by !== body.username) {
      json(res, 403, { error: 'only the person who checked this out can return it' });
      return;
    }
    db.prepare(
      "UPDATE items SET status = 'available', checked_out_by = NULL, checked_out_at = NULL WHERE id = ?"
    ).run(id);
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/login') {
    const body = await readBody(req);
    const user = db.prepare(
      "SELECT * FROM users WHERE username = ? AND password = ?"
    ).get(body.username, body.password);
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
