let currentUser = null;

function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return days + 'd ' + hours + 'h';
  if (hours > 0) return hours + 'h ' + minutes + 'm';
  return minutes + 'm';
}

function formatCheckedOut(item) {
  if (item.status !== 'checked out' || !item.checked_out_by) return '';
  const since = new Date(item.checked_out_at);
  return '<span class="who">' + item.checked_out_by + '</span>' +
    '<span class="meta">since ' + since.toLocaleString() +
    ' &middot; ' + formatDuration(Date.now() - since.getTime()) + '</span>';
}

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
    const actionBtn = i.status === 'available'
      ? (currentUser ? '<button class="checkoutBtn" data-id="' + i.id + '">Check Out</button>' : '')
      : (currentUser === i.checked_out_by ? '<button class="returnBtn" data-id="' + i.id + '">Return</button>' : '');
    return '<tr><td>' + i.name + '</td><td>' + i.category + '</td>' +
           '<td><span class="pill ' + cls + '">' + i.status + '</span></td>' +
           '<td>' + formatCheckedOut(i) + '</td>' +
           '<td><div class="actions">' + actionBtn +
           '<button class="deleteBtn btn-ghost" data-id="' + i.id + '">Delete</button></div></td></tr>';
  }).join('');
}

async function deleteItem(id) {
  await fetch('/api/items/' + id, { method: 'DELETE' });
  loadItems();
}

async function checkoutItem(id) {
  await fetch('/api/items/' + id + '/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser })
  });
  loadItems();
}

async function returnItem(id) {
  await fetch('/api/items/' + id + '/return', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser })
  });
  loadItems();
}

document.getElementById('items').addEventListener('click', function (e) {
  if (e.target.classList.contains('deleteBtn')) {
    deleteItem(e.target.dataset.id);
  } else if (e.target.classList.contains('checkoutBtn')) {
    checkoutItem(e.target.dataset.id);
  } else if (e.target.classList.contains('returnBtn')) {
    returnItem(e.target.dataset.id);
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
    currentUser = data.username;
    loadItems();
  } else {
    msg.className = 'bad';
    msg.textContent = 'Wrong username or password.';
  }
};

loadWeather();
loadItems();
