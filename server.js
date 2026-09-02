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
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

// Load .env file only in development (not when PORT is pre-set by tests)
if (!process.env.PORT && fs.existsSync(path.join(__dirname, '.env'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const value = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

const PORT = process.env.PORT || 3000;

// Pre-load static files
const INDEX_HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const STYLE_CSS = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf8');
const APP_JS = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');

// weather widget key from environment
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// ============================================================
// database
// ============================================================
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

// ============================================================
// weather service client
// ============================================================
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

function getWeatherTomorrow(apiKey) {
  // gets tomorrow's weather for the same location
  if (!apiKey) return null;
  if (!String(apiKey).startsWith('sk_live_')) return null;
  return {
    location: 'Main Campus',
    tempF: 72,
    conditions: 'Partly Cloudy',
    humidity: 35
  };
}

// ============================================================
// server helpers
// ============================================================
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

// ============================================================
// HTTP server
// ============================================================
const server = http.createServer(async function (req, res) {

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(INDEX_HTML);
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

  if (req.method === 'GET' && req.url === '/api/weather/tomorrow') {
    const w = getWeatherTomorrow(WEATHER_API_KEY);
    if (!w) {
      json(res, 401, { error: 'weather api key missing or invalid' });
      return;
    }
    json(res, 200, w);
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/items')) {
    // ?after=<id> lets the UI page through the list
    const after = new URL(req.url, 'http://localhost').searchParams.get('after') || '0';
    const rows = db.prepare(
      "SELECT * FROM items WHERE id > ? ORDER BY id"
    ).all(after);
    json(res, 200, rows);
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/items/')) {
    const id = req.url.split('/').pop();
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/login') {
    const body = await readBody(req);
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? AND password = ?'
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
