(function () {
  const addForm = document.getElementById('add-form');
  const nameInput = document.getElementById('name-input');
  const localInput = document.getElementById('local-input');
  const list = document.getElementById('participants-list');
  const groupSizeInput = document.getElementById('group-size');
  const rollBtn = document.getElementById('roll-btn');
  const clearBtn = document.getElementById('clear-btn');
  const saveBtn = document.getElementById('save-btn');
  const results = document.getElementById('results');
  const hint = document.getElementById('hint');

  const STORAGE_KEY = 'only-lunch:v2';
  let state = {
    participants: [], // [{ name: string, local: boolean }]
    groupSize: 2,
    history: [], // array of sessions, each session is array of groups, each group is array of names
  };

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.participants)) {
        // migrate from ["Name"] to [{name, local:false}]
        state.participants = parsed.participants.map(p => {
          if (typeof p === 'string') return { name: p, local: false };
          return { name: String(p.name || '').trim(), local: !!p.local };
        }).filter(p => p.name);
      }
      if (typeof parsed.groupSize === 'number' && parsed.groupSize > 1) state.groupSize = parsed.groupSize;
      if (Array.isArray(parsed.history)) state.history = parsed.history.filter(isValidSession);
    } catch (_) {}
  }

  function isValidSession(s) {
    return Array.isArray(s) && s.every(g => Array.isArray(g) && g.every(n => typeof n === 'string'));
  }

  function renderParticipants() {
    list.innerHTML = '';
    if (state.participants.length === 0) {
      list.innerHTML = '<div class="hint">No participants yet. Add some above.</div>';
      return;
    }
    for (const person of state.participants) {
      const el = document.createElement('div');
      el.className = 'chip';
      const nameHtml = `<span class=\"name\" title=\"${escapeHtml(person.name)}\">${escapeHtml(person.name)}</span>`;
      const badges = `<span class=\"badges\">${person.local ? '<span class=\"badge local\">Local</span>' : ''}</span>`;
      el.innerHTML = nameHtml + badges;
      const rm = document.createElement('button');
      rm.className = 'remove';
      rm.type = 'button';
      rm.setAttribute('aria-label', `Remove ${person.name}`);
      rm.textContent = '✕';
      rm.addEventListener('click', () => removeParticipant(person.name));
      // Toggle local on name click
      el.querySelector('.name').addEventListener('click', () => toggleLocal(person.name));
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

  function addParticipant(nameRaw, isLocal) {
    const name = String(nameRaw || '').trim();
    if (!name) return;
    // de-duplicate (case-insensitive), keep first casing
    const exists = state.participants.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setHint(`"${name}" already added.`);
      return;
    }
    state.participants.push({ name, local: !!isLocal });
    state.participants.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    setHint(`${state.participants.length} participant${state.participants.length === 1 ? '' : 's'}.`);
    save();
    renderParticipants();
  }

  function removeParticipant(name) {
    state.participants = state.participants.filter(p => p.name !== name);
    setHint(`${state.participants.length} participant${state.participants.length === 1 ? '' : 's'}.`);
    save();
    renderParticipants();
  }

  function toggleLocal(name) {
    const p = state.participants.find(p => p.name === name);
    if (!p) return;
    p.local = !p.local;
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
  const locals = shuffled.filter(p => p.local);
  const nonLocals = shuffled.filter(p => !p.local);

    // Determine number of groups: we need at least one local per group
    const desiredGroups = Math.ceil(state.participants.length / state.groupSize);
    const groupsCount = Math.max(1, Math.min(desiredGroups, locals.length || 1));

    // Seed groups with one local each (or as many as we can)
  const groups = Array.from({ length: groupsCount }, () => []);
    for (let i = 0; i < groupsCount && locals.length; i++) {
      const person = locals.shift();
      groups[i].push(person);
    }

    // If locals left, distribute round-robin
    let gi = 0;
    while (locals.length) {
      groups[gi % groupsCount].push(locals.shift());
      gi++;
    }

    // Build a penalty map for pairs that have already met
    const penalty = buildPenaltyMap();

    // Helper to score adding a candidate to a target group
    function scoreCandidate(group, candidate) {
      // Base preference: keep groups near target size
      let score = group.length; // lower is better; fewer members preferred initially
      // Add penalties for prior pairings
      for (const member of group) {
        const pairKey = pair(member.name, candidate.name);
        score += (penalty.get(pairKey) || 0) * 10; // heavy weight to avoid repeats
      }
      // Encourage at least one local per group
      if (!group.some(p => p.local) && !candidate.local) score += 20;
      return score;
    }

    // Greedy assignment of non-locals to minimize repeat pairings
    while (nonLocals.length) {
      const candidate = nonLocals.shift();
      let bestIdx = 0;
      let bestScore = Infinity;
      for (let i = 0; i < groups.length; i++) {
        const s = scoreCandidate(groups[i], candidate);
        if (s < bestScore) { bestScore = s; bestIdx = i; }
      }
      groups[bestIdx].push(candidate);
    }

    // Optional re-balance if some groups are much larger than others
    // Keep simple: sort by size and move one from largest to smallest while diff > 1 and moving doesn't break local-per-group
    function hasLocal(arr) { return arr.some(p => p.local); }
    let guard = 100; // prevent infinite loops
    while (guard-- > 0) {
      groups.sort((a, b) => b.length - a.length);
      const max = groups[0].length;
      const min = groups[groups.length - 1].length;
      if (max - min <= 1) break;
      // find a movable person from largest group (prefer non-local)
      const from = groups[0];
      let idx = from.findIndex(p => !p.local);
      if (idx === -1) {
        // only move a local if the group keeps at least one local
        idx = from.findIndex(p => p.local);
        if (idx === -1) break;
        const leavingLocal = from[idx];
        if (from.filter(p => p.local).length <= 1) { // can't move last local
          break;
        }
      }
      const person = from.splice(idx, 1)[0];
      // move to smallest group
      groups[groups.length - 1].push(person);
    }

    // Render
    groups.forEach((group, i) => {
      const card = document.createElement('div');
      card.className = 'group';
      const title = document.createElement('h3');
      title.textContent = `Group ${i + 1} (${group.length})`;
      const list = document.createElement('ol');
      for (const person of group) {
        const li = document.createElement('li');
        li.textContent = person.name + (person.local ? ' · Local' : '');
        list.appendChild(li);
      }
      card.appendChild(title);
      card.appendChild(list);
      results.appendChild(card);
    });

    setHint(`Created ${groups.length} group${groups.length === 1 ? '' : 's'}.`);
    saveBtn.disabled = groups.length === 0;
    // store last generated groups in memory for saving
    lastGenerated = groups.map(g => g.map(p => p.name));
  }

  function pair(a, b) { return a < b ? a + '::' + b : b + '::' + a; }

  function buildPenaltyMap() {
    const map = new Map();
    for (const session of state.history) {
      for (const group of session) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const key = pair(group[i], group[j]);
            map.set(key, (map.get(key) || 0) + 1);
          }
        }
      }
    }
    return map;
  }

  let lastGenerated = [];

  function saveCurrentGroups() {
    if (!lastGenerated || !lastGenerated.length) return;
    // Only include names that are still in participants
    const allowed = new Set(state.participants.map(p => p.name));
    const cleaned = lastGenerated
      .map(g => g.filter(n => allowed.has(n)))
      .filter(g => g.length >= 2);
    if (!cleaned.length) { setHint('Nothing to save.'); return; }
    state.history.push(cleaned);
    save();
    setHint('Saved this lunch. Future rolls will avoid repeat pairs.');
    saveBtn.disabled = true;
  }

  // Wire up events
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addParticipant(nameInput.value, localInput.checked);
    nameInput.value = '';
    localInput.checked = false;
    nameInput.focus();
  });
  groupSizeInput.addEventListener('change', (e) => setGroupSize(e.target.value));
  rollBtn.addEventListener('click', roll);
  clearBtn.addEventListener('click', clearAll);
  saveBtn.addEventListener('click', saveCurrentGroups);

  // Init
  load();
  groupSizeInput.value = String(state.groupSize);
  renderParticipants();
  if (state.participants.length) setHint(`${state.participants.length} participant${state.participants.length === 1 ? '' : 's'}.`);
  saveBtn.disabled = true;
})();
