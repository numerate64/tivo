const rows = document.getElementById('rows');
const searchInput = document.getElementById('searchInput');
const suggestionsToggle = document.getElementById('suggestionsToggle');
const statusText = document.getElementById('statusText');
const resultCount = document.getElementById('resultCount');
const showCount = document.getElementById('showCount');
const storageUsed = document.getElementById('storageUsed');
const lastUpdated = document.getElementById('lastUpdated');

let shows = [];
let snapshot = null;
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
    show.rating
  ].some(value => normalize(value).includes(query));
}

function filteredShows() {
  const query = normalize(searchInput.value.trim());
  return shows
    .filter(show => suggestionsToggle.checked || !show.isSuggestion)
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

function render() {
  const visible = filteredShows();
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

function updateSummary() {
  const total = Number(snapshot?.loadedItems || snapshot?.totalItems || shows.length);
  const used = snapshot?.storage?.usedBytes
    ?? shows.reduce((sum, show) => sum + Number(show.sizeBytes || 0), 0);

  showCount.textContent = total.toLocaleString();
  storageUsed.textContent = formatBytes(used);
  lastUpdated.textContent = formatDate(snapshot?.updatedAt);
}

async function load() {
  try {
    const response = await fetch('./tivo-shows.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Snapshot failed (${response.status})`);
    snapshot = await response.json();
    shows = Array.isArray(snapshot.shows) ? snapshot.shows : [];
    shows.sort((a, b) => captureTime(b) - captureTime(a)
      || String(a.title || '').localeCompare(String(b.title || ''))
      || String(a.episodeTitle || '').localeCompare(String(b.episodeTitle || '')));
    statusText.textContent = snapshot.cached
      ? 'Showing the latest published TiVo snapshot.'
      : 'Showing a freshly published TiVo snapshot.';
    updateSummary();
    render();
  } catch (error) {
    console.error(error);
    statusText.textContent = `Could not load TiVo snapshot: ${error.message}`;
    rows.innerHTML = '<tr><td colspan="7" class="empty">TiVo snapshot unavailable.</td></tr>';
  }
}

searchInput.addEventListener('input', render);
suggestionsToggle.addEventListener('change', render);
rows.addEventListener('click', event => {
  const button = event.target.closest('[data-group-key]');
  if (!button) return;

  const key = button.dataset.groupKey;
  if (expandedGroups.has(key)) expandedGroups.delete(key);
  else expandedGroups.add(key);
  render();
});

load();
