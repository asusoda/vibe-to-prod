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

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

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
    serveFile(res, path.join(__dirname, 'index.html'), 'text/html');
    return;
  }

  if (req.method === 'GET' && req.url === '/snake') {
    serveFile(res, path.join(__dirname, 'snake.html'), 'text/html');
    return;
  }

  if (req.method === 'GET' && req.url === '/public/style.css') {
    serveFile(res, path.join(__dirname, 'public', 'style.css'), 'text/css');
    return;
  }

  if (req.method === 'GET' && req.url === '/public/app.js') {
    serveFile(res, path.join(__dirname, 'public', 'app.js'), 'application/javascript');
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
    const rawAfter = new URL(req.url, 'http://localhost').searchParams.get('after') ?? '0';
    const after = Number.parseInt(rawAfter, 10);
    if (!Number.isFinite(after)) {
      json(res, 400, { error: 'invalid after value' });
      return;
    }

    const rows = db.prepare(
      'SELECT * FROM items WHERE id > ? ORDER BY id'
    ).all(after);
    json(res, 200, rows);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/login') {
    const body = await readBody(req);
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? AND password = ?'
    ).get(username, password);

    if (user) {
      json(res, 200, { ok: true, username: user.username, role: user.role });
    } else {
      json(res, 200, { ok: false });
    }
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/items/')) {
    const id = Number.parseInt(req.url.split('/').pop(), 10);
    if (!Number.isInteger(id)) {
      json(res, 400, { error: 'invalid item id' });
      return;
    }

    const result = db.prepare('DELETE FROM items WHERE id = ?').run(id);
    json(res, 200, { ok: true, deleted: result.changes > 0 });
    return;
  }

  json(res, 404, { error: 'not found' });
});

server.listen(PORT, function () {
  console.log('Gear Tracker running on http://localhost:' + PORT);
});
