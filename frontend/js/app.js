// ---------- Toast notifications ----------

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ---------- Photo capture (camera + file) ----------

let selectedImageBlob = null; // set by either file picker or camera capture
let cameraStream = null;

function handleFileChosen(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedImageBlob = file;
  showImagePreview(URL.createObjectURL(file));
}

async function openCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    document.getElementById('cameraVideo').srcObject = cameraStream;
    document.getElementById('cameraPanel').style.display = 'block';
  } catch (err) {
    showToast('Could not access camera: ' + err.message, 'error');
  }
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  document.getElementById('cameraPanel').style.display = 'none';
}

function capturePhoto() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('cameraCanvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(blob => {
    selectedImageBlob = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
    showImagePreview(URL.createObjectURL(blob));
    closeCamera();
  }, 'image/jpeg', 0.9);
}

function showImagePreview(url) {
  document.getElementById('imagePreview').src = url;
  document.getElementById('imagePreviewWrap').style.display = 'block';
}

function clearImageSelection() {
  selectedImageBlob = null;
  document.getElementById('newItemImage').value = '';
  document.getElementById('imagePreviewWrap').style.display = 'none';
}

// ---------- Auth screen ----------

function setAuthMode(mode) {
  document.getElementById('showLoginBtn').classList.toggle('active', mode === 'login');
  document.getElementById('showRegisterBtn').classList.toggle('active', mode === 'register');
  document.getElementById('loginForm').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('authError').textContent = '';
}

async function handleRegister() {
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const errEl = document.getElementById('authError');
  if (!username || !password) { errEl.textContent = 'Username and password are required.'; return; }
  try {
    await Api.register(username, email, password);
    await Api.login(username, password);
    enterApp();
  } catch (err) {
    errEl.textContent = describeError(err);
  }
}

async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('authError');
  try {
    await Api.login(username, password);
    enterApp();
  } catch (err) {
    errEl.textContent = describeError(err);
  }
}

function handleLogout() {
  Api.logout().finally(() => {
    document.getElementById('appShell').style.display = 'none';
    document.getElementById('authScreen').style.display = 'block';
  });
}

function describeError(err) {
  if (err.data && typeof err.data === 'object') {
    const firstKey = Object.keys(err.data)[0];
    if (firstKey) {
      const val = err.data[firstKey];
      return Array.isArray(val) ? val[0] : String(val);
    }
  }
  return err.message || 'Something went wrong.';
}

function enterApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'block';
  document.getElementById('userLabel').textContent = Auth.username || '';
  switchView('today');
}

// ---------- View switching ----------

let currentView = 'today';

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  if (view === 'today') loadSuggestion();
  if (view === 'wardrobe') loadWardrobe();
  if (view === 'history') loadHistory();
}

// ---------- Tag card rendering (signature element) ----------

const CATEGORY_ICON = {
  top: '👕', bottom: '👖', dress: '👗', outerwear: '🧥', shoes: '👟', accessory: '👜',
};

function renderTagCard(item, { deletable = false } = {}) {
  const thumbStyle = item.image_url
    ? `background-image:url('${item.image_url}')`
    : '';
  const icon = item.image_url ? '' : (CATEGORY_ICON[item.category] || '');
  const wornLine = typeof item.times_worn === 'number'
    ? `<div class="worn-count">WORN ${item.times_worn}×</div>`
    : '';
  const costLine = item.cost_per_wear != null
    ? `<div class="cost-per-wear">$${item.cost_per_wear}/wear</div>`
    : '';
  const deleteBtn = deletable
    ? `<button class="delete-x" onclick="event.stopPropagation(); handleDeleteItem(${item.id})">✕</button>`
    : '';
  return `
    <div class="tag-card" data-item-id="${item.id}">
      ${deleteBtn}
      <div class="thumb" style="${thumbStyle}">${icon}</div>
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-meta">${item.color || ''} · ${item.season}/${item.occasion}</div>
      ${wornLine}
      ${costLine}
    </div>
  `;
}

function renderEmptyTagCard(label) {
  return `<div class="tag-card empty">${label}</div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Today view ----------

let lastSuggestion = null;

async function loadSuggestion(coords) {
  const occasion = document.getElementById('todayOccasion').value;
  const flatlay = document.getElementById('flatlay');
  flatlay.innerHTML = `<div class="empty-state">Laying out today's outfit…</div>`;
  try {
    const params = { occasion };
    if (coords) { params.lat = coords.lat; params.lon = coords.lon; }
    const result = await Api.suggestOutfit(params);
    lastSuggestion = result;
    renderFlatlay(result);
  } catch (err) {
    flatlay.innerHTML = `<div class="empty-state">Couldn't load a suggestion: ${escapeHtml(describeError(err))}</div>`;
  }
}

function renderFlatlay(result) {
  const flatlay = document.getElementById('flatlay');
  const outfit = result.outfit;
  const order = ['dress', 'top', 'bottom', 'outerwear', 'shoes', 'accessory'];
  const labels = { dress: 'Dress', top: 'Top', bottom: 'Bottom', outerwear: 'Outerwear', shoes: 'Shoes', accessory: 'Accessory' };

  const cardsHtml = order
    .filter(key => !(key === 'top' || key === 'bottom' ? outfit.dress : false)) // hide top/bottom slot if dress fills it
    .map(key => {
      const item = outfit[key];
      return item ? renderTagCard(item) : renderEmptyTagCard(`No ${labels[key].toLowerCase()} tagged<br>for this weather/occasion`);
    })
    .join('');

  flatlay.innerHTML = cardsHtml;

  const weatherPill = document.getElementById('weatherPill');
  if (result.weather) {
    weatherPill.style.display = 'inline-block';
    weatherPill.textContent = `${Math.round(result.weather.temp_c)}°C · ${result.season_used} weather`;
  } else {
    weatherPill.style.display = 'inline-block';
    weatherPill.textContent = `${result.season_used} weather (no location set)`;
  }
}

function useLocationAndSuggest() {
  if (!navigator.geolocation) { loadSuggestion(); return; }
  navigator.geolocation.getCurrentPosition(
    pos => loadSuggestion({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => loadSuggestion()
  );
}

async function markTodayWorn() {
  const statusEl = document.getElementById('markWornStatus');
  if (!lastSuggestion) { statusEl.textContent = 'Nothing to mark yet.'; return; }
  const itemIds = Object.values(lastSuggestion.outfit).filter(Boolean).map(i => i.id);
  if (itemIds.length === 0) { statusEl.textContent = 'No items in this outfit.'; return; }
  try {
    const today = new Date().toISOString().slice(0, 10);
    await Api.logWorn(itemIds, lastSuggestion.occasion, today);
    statusEl.textContent = '';
    showToast('Outfit logged for today ✓');
    loadSuggestion(); // refresh worn counts
  } catch (err) {
    statusEl.textContent = describeError(err);
  }
}

// ---------- Wardrobe view ----------

let activeCategoryFilter = '';
let showingLeastWorn = false;

function setFilter(cat) {
  activeCategoryFilter = cat;
  document.querySelectorAll('#filterChips .chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.cat === cat);
  });
  loadWardrobe();
}

function toggleLeastWorn() {
  showingLeastWorn = !showingLeastWorn;
  const btn = document.getElementById('leastWornToggle');
  btn.classList.toggle('active', showingLeastWorn);
  btn.textContent = showingLeastWorn ? '✓ Showing neglected items' : '💤 Show neglected items';
  loadWardrobe();
}

async function loadWardrobe() {
  const grid = document.getElementById('wardrobeGrid');
  grid.innerHTML = `<div class="empty-state">Loading your closet…</div>`;
  try {
    let items;
    if (showingLeastWorn) {
      items = await Api.leastWorn();
    } else {
      const filters = activeCategoryFilter ? { category: activeCategoryFilter } : {};
      items = await Api.listItems(filters);
    }
    const searchTerm = document.getElementById('wardrobeSearch').value.trim().toLowerCase();
    if (searchTerm) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm) ||
        (item.color || '').toLowerCase().includes(searchTerm)
      );
    }
    if (items.length === 0) {
      grid.innerHTML = `<div class="empty-state">No items match — try adding one above or adjusting filters.</div>`;
      return;
    }
    grid.innerHTML = items.map(item => renderTagCard(item, { deletable: true })).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Couldn't load wardrobe: ${escapeHtml(describeError(err))}</div>`;
  }
}

async function handleAddItem() {
  const statusEl = document.getElementById('addItemStatus');
  const name = document.getElementById('newItemName').value.trim();
  if (!name) { statusEl.textContent = 'Name is required.'; return; }
  const price = document.getElementById('newItemPrice').value;
  const values = {
    name,
    category: document.getElementById('newItemCategory').value,
    color: document.getElementById('newItemColor').value.trim(),
    season: document.getElementById('newItemSeason').value,
    occasion: document.getElementById('newItemOccasion').value,
  };
  if (price) values.price = price;
  try {
    await Api.createItem(values, selectedImageBlob);
    statusEl.textContent = '';
    document.getElementById('newItemName').value = '';
    document.getElementById('newItemColor').value = '';
    document.getElementById('newItemPrice').value = '';
    clearImageSelection();
    showToast(`${name} added to your wardrobe`);
    loadWardrobe();
  } catch (err) {
    statusEl.textContent = describeError(err);
  }
}

async function handleDeleteItem(id) {
  if (!confirm('Remove this item from your wardrobe?')) return;
  try {
    await Api.deleteItem(id);
    showToast('Item removed');
    loadWardrobe();
  } catch (err) {
    showToast(describeError(err), 'error');
  }
}

// ---------- History view ----------

async function loadHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = `<div class="empty-state">Loading history…</div>`;
  try {
    const logs = await Api.wearHistory();
    if (logs.length === 0) {
      list.innerHTML = `<div class="empty-state">No outfits logged yet — mark today's outfit as worn to start your history.</div>`;
      return;
    }
    list.innerHTML = logs.map(log => {
      const items = log.items_detail || [];
      const thumbsHtml = items.map(item => `
        <div class="history-thumb" style="${item.image_url ? `background-image:url('${item.image_url}')` : ''}">
          ${item.image_url ? '' : (CATEGORY_ICON[item.category] || '')}
        </div>
      `).join('');
      return `
        <div class="history-row">
          <div class="history-thumbs">${thumbsHtml}</div>
          <div class="history-info">
            <div class="history-date">${log.worn_on}</div>
            <div class="history-items">${items.map(i => escapeHtml(i.name)).join(', ') || `${items.length} item(s)`}</div>
          </div>
          <div class="history-occasion">${log.occasion}</div>
          <button class="delete-x" style="opacity:1; position:static;" onclick="handleDeleteHistory(${log.id})">✕</button>
        </div>
      `;
    }).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Couldn't load history: ${escapeHtml(describeError(err))}</div>`;
  }
}

async function handleDeleteHistory(id) {
  if (!confirm('Delete this wear history entry?')) return;
  try {
    await Api.deleteHistoryEntry(id);
    showToast('History entry removed');
    loadHistory();
  } catch (err) {
    showToast(describeError(err), 'error');
  }
}
