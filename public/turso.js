/* ============================================================
   Backend API Sync Layer
   All data stored in Turso via Express backend
   ============================================================ */

let _saveTimer = null;

// Debounced save to backend
function tursoSaveDebounced(a, b, portfolio) {
  // Always save to localStorage as cache
  localStorage.setItem('ns_a', JSON.stringify(a));
  localStorage.setItem('ns_b', JSON.stringify(b));
  localStorage.setItem('ns_p', JSON.stringify(portfolio));

  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a, b })
      });
      await fetch('/api/orgs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgs: portfolio })
      });
    } catch (e) {
      console.warn('Backend save failed, data cached locally:', e);
    }
  }, 600);
}

// Load all data from backend
async function loadFromBackend() {
  try {
    const resp = await fetch('/api/config');
    if (!resp.ok) throw new Error('Backend error ' + resp.status);
    return await resp.json();
  } catch (e) {
    console.warn('Backend load failed, using localStorage:', e);
    return null;
  }
}

// Save single org
async function saveOrgToBackend(org) {
  try {
    await fetch('/api/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(org)
    });
  } catch (e) {
    console.warn('Org save failed:', e);
  }
}

// Delete single org
async function deleteOrgFromBackend(id) {
  try {
    await fetch('/api/org/' + id, { method: 'DELETE' });
  } catch (e) {
    console.warn('Org delete failed:', e);
  }
}
