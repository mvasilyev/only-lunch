(function () {
  const addForm = document.getElementById('add-form');
  const nameInput = document.getElementById('name-input');
  const list = document.getElementById('participants-list');
  const groupSizeInput = document.getElementById('group-size');
  const rollBtn = document.getElementById('roll-btn');
  const clearBtn = document.getElementById('clear-btn');
  const results = document.getElementById('results');
  const hint = document.getElementById('hint');

  const STORAGE_KEY = 'only-lunch:v1';
  let state = {
    participants: [],
    groupSize: 2,
  };

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.participants)) state.participants = parsed.participants;
      if (typeof parsed.groupSize === 'number' && parsed.groupSize > 1) state.groupSize = parsed.groupSize;
    } catch (_) {}
  }

  function renderParticipants() {
    list.innerHTML = '';
    if (state.participants.length === 0) {
      list.innerHTML = '<div class="hint">No participants yet. Add some above.</div>';
      return;
    }
    for (const name of state.participants) {
      const el = document.createElement('div');
      el.className = 'chip';
      el.innerHTML = `<span class="name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>`;
      const rm = document.createElement('button');
      rm.className = 'remove';
      rm.type = 'button';
      rm.setAttribute('aria-label', `Remove ${name}`);
      rm.textContent = '✕';
      rm.addEventListener('click', () => removeParticipant(name));
      el.appendChild(rm);
      list.appendChild(el);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function addParticipant(nameRaw) {
    const name = String(nameRaw || '').trim();
    if (!name) return;
    // de-duplicate (case-insensitive), keep first casing
    const exists = state.participants.some(p => p.toLowerCase() === name.toLowerCase());
    if (exists) {
      setHint(`"${name}" already added.`);
      return;
    }
    state.participants.push(name);
    state.participants.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    setHint(`${state.participants.length} participant${state.participants.length === 1 ? '' : 's'}.`);
    save();
    renderParticipants();
  }

  function removeParticipant(name) {
    state.participants = state.participants.filter(p => p !== name);
    setHint(`${state.participants.length} participant${state.participants.length === 1 ? '' : 's'}.`);
    save();
    renderParticipants();
  }

  function clearAll() {
    if (!confirm('Remove all participants?')) return;
    state.participants = [];
    results.innerHTML = '';
    setHint('Cleared.');
    save();
    renderParticipants();
  }

  function setHint(text) { hint.textContent = text || ''; }

  function setGroupSize(n) {
    const val = Number(n);
    if (!Number.isFinite(val) || val < 2) {
      setHint('Group size must be 2 or more.');
      return false;
    }
    state.groupSize = Math.floor(val);
    save();
    return true;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function chunkBySize(arr, size) {
    const groups = [];
    for (let i = 0; i < arr.length; i += size) {
      groups.push(arr.slice(i, i + size));
    }
    return groups;
  }

  function roll() {
    results.innerHTML = '';
    if (state.participants.length < 2) {
      setHint('Add at least 2 participants.');
      return;
    }
    if (state.groupSize < 2) {
      setHint('Group size must be >= 2.');
      return;
    }

    // Shuffle and form groups of equal size as much as possible.
    // If leftover remains, distribute one by one to existing groups to balance sizes.
    const shuffled = shuffle(state.participants);
    const baseGroups = chunkBySize(shuffled, state.groupSize);

    if (baseGroups.length > 1) {
      // Balance: move extras from the last (possibly short) group into earlier ones
      const last = baseGroups[baseGroups.length - 1];
      if (last.length > 0 && last.length < state.groupSize) {
        let idx = 0;
        while (last.length) {
          baseGroups[idx % (baseGroups.length - 1)].push(last.shift());
          idx++;
        }
        baseGroups.pop(); // remove now-empty last group
      }
    }

    // Render
    baseGroups.forEach((group, i) => {
      const card = document.createElement('div');
      card.className = 'group';
      const title = document.createElement('h3');
      title.textContent = `Group ${i + 1} (${group.length})`;
      const list = document.createElement('ol');
      for (const name of group) {
        const li = document.createElement('li');
        li.textContent = name;
        list.appendChild(li);
      }
      card.appendChild(title);
      card.appendChild(list);
      results.appendChild(card);
    });

    setHint(`Created ${baseGroups.length} group${baseGroups.length === 1 ? '' : 's'}.`);
  }

  // Wire up events
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addParticipant(nameInput.value);
    nameInput.value = '';
    nameInput.focus();
  });
  groupSizeInput.addEventListener('change', (e) => setGroupSize(e.target.value));
  rollBtn.addEventListener('click', roll);
  clearBtn.addEventListener('click', clearAll);

  // Init
  load();
  groupSizeInput.value = String(state.groupSize);
  renderParticipants();
  if (state.participants.length) setHint(`${state.participants.length} participant${state.participants.length === 1 ? '' : 's'}.`);
})();
