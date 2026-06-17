const rows = document.getElementById('rows');
const tableHead = document.getElementById('tableHead');
const searchInput = document.getElementById('searchInput');
const suggestionsToggle = document.getElementById('suggestionsToggle');
const suggestionsControl = document.getElementById('suggestionsControl');
const statusText = document.getElementById('statusText');
const resultCount = document.getElementById('resultCount');
const showCount = document.getElementById('showCount');
const upcomingCount = document.getElementById('upcomingCount');
const storageUsed = document.getElementById('storageUsed');
const lastUpdated = document.getElementById('lastUpdated');
const tabs = [...document.querySelectorAll('[data-tab]')];

let shows = [];
let upcoming = [];
let snapshot = null;
let upcomingSnapshot = null;
let activeTab = 'current';
const expandedGroups = new Set();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}

function formatDuration(ms) {
  const minutes = Math.round(Number(ms || 0) / 60000);
  if (!minutes) return '-';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${minutes}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function captureTime(show) {
  const time = new Date(show.captureDate || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function scheduledTime(show) {
  const time = new Date(show.scheduledStartTime || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function matchesSearch(show, query) {
  if (!query) return true;
  return [
    show.title,
    show.episodeTitle,
    show.description,
    show.sourceChannel,
    show.sourceStation,
    show.rating,
    show.state
  ].some(value => normalize(value).includes(query));
}

function filteredShows() {
  const query = normalize(searchInput.value.trim());
  const source = activeTab === 'upcoming' ? upcoming : shows;
  return source
    .filter(show => activeTab === 'upcoming' || suggestionsToggle.checked || !show.isSuggestion)
    .filter(show => matchesSearch(show, query));
}

function groupedShows(sourceShows) {
  const groups = new Map();
  for (const show of sourceShows) {
    const title = show.title || 'Untitled';
    const key = normalize(title.trim()) || 'untitled';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title,
        shows: [],
        latestCaptureTime: 0,
        durationMs: 0,
        sizeBytes: 0,
        suggestionCount: 0
      });
    }

    const group = groups.get(key);
    group.shows.push(show);
    group.latestCaptureTime = Math.max(group.latestCaptureTime, captureTime(show));
    group.durationMs += Number(show.durationMs || 0);
    group.sizeBytes += Number(show.sizeBytes || 0);
    if (show.isSuggestion) group.suggestionCount += 1;
  }

  return [...groups.values()]
    .map(group => ({
      ...group,
      shows: group.shows.slice().sort((a, b) => captureTime(b) - captureTime(a)
        || String(a.episodeTitle || '').localeCompare(String(b.episodeTitle || '')))
    }))
    .sort((a, b) => b.latestCaptureTime - a.latestCaptureTime
      || String(a.title || '').localeCompare(String(b.title || '')));
}

function renderCurrent(visible) {
  const groups = groupedShows(visible);
  const groupLabel = groups.length === 1 ? 'show' : 'shows';
  const recordingLabel = visible.length === 1 ? 'recording' : 'recordings';
  resultCount.textContent = `${groups.length} ${groupLabel} · ${visible.length} ${recordingLabel}`;

  if (!visible.length) {
    rows.innerHTML = '<tr><td colspan="7" class="empty">No shows match that search.</td></tr>';
    return;
  }

  rows.innerHTML = groups.map(group => {
    const groupTitle = escapeHtml(group.title || 'Untitled');
    const latest = group.latestCaptureTime ? formatDate(group.latestCaptureTime) : '-';
    const count = group.shows.length === 1 ? '1 recording' : `${group.shows.length} recordings`;
    const suggestion = group.suggestionCount
      ? `<span class="badge suggestion-badge">${group.suggestionCount === 1 ? 'Suggested' : `${group.suggestionCount} suggested`}</span>`
      : '';
    const expanded = expandedGroups.has(group.key);
    const groupRow = `
      <tr class="group-row${group.suggestionCount ? ' suggestion-row' : ''}">
        <td colspan="4">
          <button class="expand-btn" type="button" data-group-key="${escapeHtml(group.key)}" aria-expanded="${expanded ? 'true' : 'false'}" aria-label="${expanded ? 'Hide' : 'Show'} recordings for ${groupTitle}">${expanded ? '▾' : '▸'}</button>
          <span class="group-title">${groupTitle}${suggestion}</span>
          <span class="group-meta">${count}${expanded ? '' : ' · hidden'}</span>
        </td>
        <td>${escapeHtml(latest)}</td>
        <td>${escapeHtml(formatDuration(group.durationMs))}</td>
        <td>${escapeHtml(formatBytes(group.sizeBytes))}</td>
      </tr>
    `;

    if (!expanded) return groupRow;

    const showRows = group.shows.map(show => {
      const title = escapeHtml(show.title || 'Untitled');
      const episode = escapeHtml(show.episodeTitle || '-');
      const channel = escapeHtml([show.sourceChannel, show.sourceStation].filter(Boolean).join(' · ') || '-');
      const rating = escapeHtml(show.rating || '-');
      const description = show.description
        ? `<span class="description">${escapeHtml(show.description)}</span>`
        : '';
      const suggestion = show.isSuggestion ? '<span class="badge suggestion-badge">Suggested</span>' : '';

      return `
        <tr class="${show.isSuggestion ? 'suggestion-row' : ''}">
          <td><span class="show-title">${title}${suggestion}</span>${description}</td>
          <td>${episode}</td>
          <td>${channel}</td>
          <td>${rating}</td>
          <td>${escapeHtml(formatDate(show.captureDate))}</td>
          <td>${escapeHtml(formatDuration(show.durationMs))}</td>
          <td>${escapeHtml(formatBytes(show.sizeBytes))}</td>
        </tr>
      `;
    }).join('');

    return groupRow + showRows;
  }).join('');
}

function renderUpcoming(visible) {
  resultCount.textContent = `${visible.length} ${visible.length === 1 ? 'upcoming recording' : 'upcoming recordings'}`;

  if (!visible.length) {
    rows.innerHTML = '<tr><td colspan="6" class="empty">No upcoming recordings match that search.</td></tr>';
    return;
  }

  rows.innerHTML = visible
    .slice()
    .sort((a, b) => scheduledTime(a) - scheduledTime(b)
      || String(a.title || '').localeCompare(String(b.title || '')))
    .map(show => {
      const title = escapeHtml(show.title || 'Untitled');
      const episode = escapeHtml(show.episodeTitle || '-');
      const channel = escapeHtml([show.sourceChannel, show.sourceStation].filter(Boolean).join(' · ') || '-');
      const rating = escapeHtml(show.rating || '-');
      const state = show.isInProgress
        ? '<span class="badge progress-badge">Recording now</span>'
        : escapeHtml(show.state || 'Scheduled');
      const description = show.description
        ? `<span class="description">${escapeHtml(show.description)}</span>`
        : '';

      return `
        <tr>
          <td><span class="show-title">${title}</span>${description}</td>
          <td>${episode}</td>
          <td>${channel}</td>
          <td>${rating}</td>
          <td>${escapeHtml(formatDate(show.scheduledStartTime))}</td>
          <td>${escapeHtml(formatDuration(show.durationMs))}<span class="description">${state}</span></td>
        </tr>
      `;
    }).join('');
}

function updateTableHead() {
  const headings = activeTab === 'upcoming'
    ? ['Show', 'Episode', 'Channel', 'Rating', 'Scheduled', 'Duration']
    : ['Show', 'Episode', 'Channel', 'Rating', 'Recorded', 'Duration', 'Size'];
  tableHead.innerHTML = headings.map(heading => `<th>${heading}</th>`).join('');
}

function updateTabs() {
  for (const tab of tabs) {
    const isActive = tab.dataset.tab === activeTab;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
  suggestionsControl.hidden = activeTab === 'upcoming';
}

function render() {
  updateTabs();
  updateTableHead();
  const visible = filteredShows();
  if (activeTab === 'upcoming') renderUpcoming(visible);
  else renderCurrent(visible);
}

function updateSummary() {
  const total = Number(snapshot?.loadedItems || snapshot?.totalItems || shows.length);
  const upcomingTotal = Number(upcomingSnapshot?.loadedItems || upcomingSnapshot?.totalItems || upcoming.length);
  const used = snapshot?.storage?.usedBytes
    ?? shows.reduce((sum, show) => sum + Number(show.sizeBytes || 0), 0);

  showCount.textContent = total.toLocaleString();
  upcomingCount.textContent = upcomingTotal.toLocaleString();
  storageUsed.textContent = formatBytes(used);
  lastUpdated.textContent = formatDate(snapshot?.updatedAt);
}

async function fetchSnapshot(path, label) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${label} failed (${response.status})`);
  return response.json();
}

async function load() {
  try {
    [snapshot, upcomingSnapshot] = await Promise.all([
      fetchSnapshot('./tivo-shows.json', 'Current snapshot'),
      fetchSnapshot('./tivo-upcoming.json', 'Upcoming snapshot')
    ]);
    shows = Array.isArray(snapshot.shows) ? snapshot.shows : [];
    upcoming = Array.isArray(upcomingSnapshot.shows) ? upcomingSnapshot.shows : [];
    shows.sort((a, b) => captureTime(b) - captureTime(a)
      || String(a.title || '').localeCompare(String(b.title || ''))
      || String(a.episodeTitle || '').localeCompare(String(b.episodeTitle || '')));
    upcoming.sort((a, b) => scheduledTime(a) - scheduledTime(b)
      || String(a.title || '').localeCompare(String(b.title || '')));
    statusText.textContent = snapshot.cached || upcomingSnapshot.cached
      ? 'Showing the latest published TiVo snapshots.'
      : 'Showing freshly published TiVo snapshots.';
    updateSummary();
    render();
  } catch (error) {
    console.error(error);
    statusText.textContent = `Could not load TiVo snapshots: ${error.message}`;
    rows.innerHTML = '<tr><td colspan="7" class="empty">TiVo snapshots unavailable.</td></tr>';
  }
}

searchInput.addEventListener('input', render);
suggestionsToggle.addEventListener('change', render);
for (const tab of tabs) {
  tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    render();
  });
}
rows.addEventListener('click', event => {
  const button = event.target.closest('[data-group-key]');
  if (!button || activeTab !== 'current') return;

  const key = button.dataset.groupKey;
  if (expandedGroups.has(key)) expandedGroups.delete(key);
  else expandedGroups.add(key);
  render();
});

load();
