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

function render() {
  const visible = filteredShows();
  resultCount.textContent = `${visible.length} shown`;

  if (!visible.length) {
    rows.innerHTML = '<tr><td colspan="7" class="empty">No shows match that search.</td></tr>';
    return;
  }

  rows.innerHTML = visible.map(show => {
    const title = escapeHtml(show.title || 'Untitled');
    const episode = escapeHtml(show.episodeTitle || '-');
    const channel = escapeHtml([show.sourceChannel, show.sourceStation].filter(Boolean).join(' · ') || '-');
    const rating = escapeHtml(show.rating || '-');
    const description = show.description
      ? `<span class="description">${escapeHtml(show.description)}</span>`
      : '';
    const suggestion = show.isSuggestion ? '<span class="badge">Suggested</span>' : '';

    return `
      <tr>
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
    shows.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''))
      || new Date(b.captureDate || 0) - new Date(a.captureDate || 0));
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

load();
