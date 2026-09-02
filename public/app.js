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
    return '<tr>' +
      '<td>' + i.name + '</td>' +
      '<td>' + i.category + '</td>' +
      '<td><span class="pill ' + cls + '">' + i.status + '</span></td>' +
      '<td><button class="delete-btn" data-id="' + i.id + '">Delete</button></td>' +
      '</tr>';
  }).join('');

  document.querySelectorAll('.delete-btn').forEach(function (button) {
    button.onclick = async function () {
      const id = button.getAttribute('data-id');
      const r = await fetch('/api/items/' + id, { method: 'DELETE' });
      if (r.ok) {
        loadItems();
      }
    };
  });
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
