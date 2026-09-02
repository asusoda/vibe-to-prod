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

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

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
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 32px 20px;
    background: #f5f6f8;
    color: #1c1e21;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .sub { color: #65686c; font-size: 14px; margin: 0 0 24px; }
  .card {
    background: #fff;
    border: 1px solid #dcdfe3;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }
  .card h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .04em;
             color: #65686c; margin: 0 0 14px; }
  label { display: block; font-size: 13px; margin-bottom: 4px; color: #3a3d42; }
  input {
    width: 100%; padding: 9px 10px; margin-bottom: 12px;
    border: 1px solid #c8ccd1; border-radius: 6px; font-size: 14px;
    font-family: inherit;
  }
  button {
    background: #2f6fed; color: #fff; border: 0; border-radius: 6px;
    padding: 9px 18px; font-size: 14px; cursor: pointer; font-family: inherit;
  }
  button:hover { background: #2559c4; }
  #loginMsg { margin-top: 12px; font-size: 14px; min-height: 20px; }
  .ok { color: #1a7f4b; }
  .bad { color: #c0392b; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-size: 12px; text-transform: uppercase;
       color: #65686c; border-bottom: 1px solid #dcdfe3; padding: 0 8px 8px; }
  td { padding: 10px 8px; border-bottom: 1px solid #eef0f2; }
  tr:last-child td { border-bottom: 0; }
  .pill { font-size: 12px; padding: 2px 8px; border-radius: 999px; }
  .pill.available { background: #e4f5eb; color: #1a7f4b; }
  .pill.out { background: #fdeceb; color: #c0392b; }
  .weather { display: flex; align-items: baseline; gap: 10px; }
  .weather .temp { font-size: 30px; font-weight: 600; }
  .weather .meta { color: #65686c; font-size: 14px; }
</style>
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

<script>
  async function loadWeather() {
    const el = document.getElementById('weather');
    const r = await fetch('/api/weather');
    if (!r.ok) {
      el.innerHTML = '<span class="meta bad">Weather unavailable (' + r.status + ')</span>';
      return;
    }
    const w = await r.json();
    el.innerHTML =
      '<span class="temp">' + w.tempF + '&deg;F</span>' +
      '<span class="meta">' + w.conditions + ' &middot; ' + w.location +
      ' &middot; ' + w.humidity + '% humidity</span>';
  }

  async function loadItems() {
    const r = await fetch('/api/items?after=0');
    const items = await r.json();
    document.getElementById('items').innerHTML = items.map(function (i) {
      const cls = i.status === 'available' ? 'available' : 'out';
      return '<tr><td>' + i.name + '</td><td>' + i.category + '</td>' +
             '<td><span class="pill ' + cls + '">' + i.status + '</span></td></tr>';
    }).join('');
  }

  document.getElementById('loginBtn').onclick = async function () {
    const msg = document.getElementById('loginMsg');
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('u').value,
        password: document.getElementById('p').value
      })
    });
    const data = await r.json();
    if (data.ok) {
      msg.className = 'ok';
      msg.textContent = 'Signed in as ' + data.username + ' (' + data.role + ')';
    } else {
      msg.className = 'bad';
      msg.textContent = 'Wrong username or password.';
    }
  };

  loadWeather();
  loadItems();
</script>
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

const server = http.createServer(async function (req, res) {

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(PAGE);
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
    const after = new URL(req.url, 'http://localhost').searchParams.get('after') || '0';
    const rows = db.prepare(
      "SELECT * FROM items WHERE id > " + after + " ORDER BY id"
    ).all();
    json(res, 200, rows);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/login') {
    const body = await readBody(req);
    const query =
      "SELECT * FROM users WHERE username = '" + body.username +
      "' AND password = '" + body.password + "'";
    const user = db.prepare(query).get();
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
