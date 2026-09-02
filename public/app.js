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

async function loadWeatherTomorrow() {
  const el = document.getElementById('weather-tomorrow');
  const r = await fetch('/api/weather/tomorrow');
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

let currentUser = null;

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  const r = await fetch('/api/items/' + id, { method: 'DELETE' });
  if (r.ok) {
    loadItems();
  }
}

async function loadItems() {
  const r = await fetch('/api/items?after=0');
  const items = await r.json();
  document.getElementById('items').innerHTML = items.map(function (i) {
    const cls = i.status === 'available' ? 'available' : 'out';
    let row = '<tr><td>' + i.name + '</td><td>' + i.category + '</td>' +
              '<td><span class="pill ' + cls + '">' + i.status + '</span></td>';
    if (currentUser) {
      row += '<td><button onclick="deleteItem(' + i.id + ')" class="delete-btn">Delete</button></td>';
    }
    row += '</tr>';
    return row;
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
    currentUser = data;
    msg.className = 'ok';
    msg.textContent = 'Signed in as ' + data.username + ' (' + data.role + ')';
    loadItems();
  } else {
    msg.className = 'bad';
    msg.textContent = 'Wrong username or password.';
  }
};

loadWeather();
loadWeatherTomorrow();
loadItems();
