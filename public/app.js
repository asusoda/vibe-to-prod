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
           '<td><span class="pill ' + cls + '">' + i.status + '</span></td>' +
           '<td class="actions"><button class="danger" data-remove="' + i.id +
           '" aria-label="Remove ' + i.name + '">Remove</button></td></tr>';
  }).join('');
}

// One delegated listener on the table body, so it keeps working after a redraw.
document.getElementById('items').addEventListener('click', async function (ev) {
  const btn = ev.target.closest('button[data-remove]');
  if (!btn) return;

  const id = btn.getAttribute('data-remove');
  const row = btn.closest('tr');
  const name = row ? row.firstElementChild.textContent : 'this item';
  if (!confirm('Remove "' + name + '" from the inventory?')) return;

  btn.disabled = true;
  const r = await fetch('/api/items/' + encodeURIComponent(id), { method: 'DELETE' });
  if (r.ok) {
    await loadItems();
  } else {
    btn.disabled = false;
    alert('Could not remove that item (HTTP ' + r.status + ').');
  }
});

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
