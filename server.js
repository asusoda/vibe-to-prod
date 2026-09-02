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

const WEATHER_API_KEY = process.env.WEATHER_API_KEY || '';

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
// the page
// ------------------------------------------------------------
const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gear Tracker</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="wrap">

  <h1>Gear Tracker</h1>
  <p class="sub">Club equipment checkout</p>

  <div class="card">
    <h2>Conditions</h2>
    <div id="weather" class="weather"><span class="meta">Loading…</span></div>
  </div>

  <div class="card">
    <h2>Sign in</h2>
    <label for="u">Username</label>
    <input id="u" autocomplete="off">
    <label for="p">Password</label>
    <input id="p" type="password" autocomplete="off">
    <button id="loginBtn">Sign in</button>
    <div id="loginMsg"></div>
  </div>

  <div class="card">
    <h2>Inventory</h2>
    <table>
      <thead>
        <tr><th>Item</th><th>Category</th><th>Status</th></tr>
      </thead>
      <tbody id="items"></tbody>
    </table>
  </div>

</div>

<script src="/app.js"></script>
</body>
</html>`;

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

function serveStatic(res, relativePath) {
  const safePath = path.normalize(relativePath).replace(/^\.\.(?:[\\/]|$)/, '');
  const filePath = path.join(__dirname, 'public', safePath);

  fs.readFile(filePath, function (err, data) {
    if (err) {
      json(res, 404, { error: 'not found' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = {
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8'
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }

  if (req.method === 'GET' && (pathname === '/styles.css' || pathname === '/app.js')) {
    serveStatic(res, pathname.slice(1));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/weather') {
    const w = getWeather(WEATHER_API_KEY);
    if (!w) {
      json(res, 401, { error: 'weather api key missing or invalid' });
      return;
    }
    json(res, 200, w);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/items') {
    const afterRaw = url.searchParams.get('after') || '0';
    const after = Number.parseInt(afterRaw, 10);
    const safeAfter = Number.isFinite(after) ? after : 0;
    const rows = db.prepare('SELECT * FROM items WHERE id > ? ORDER BY id').all(safeAfter);
    json(res, 200, rows);
    return;
  }

  if (req.method === 'DELETE' && /^\/api\/items\/\d+$/.test(pathname)) {
    const id = Number.parseInt(pathname.split('/').pop(), 10);
    const result = db.prepare('DELETE FROM items WHERE id = ?').run(id);
    if (result.changes === 0) {
      json(res, 404, { error: 'item not found' });
      return;
    }
    json(res, 200, { ok: true, id });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    const body = await readBody(req);
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
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
