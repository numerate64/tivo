const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const SOURCE_URL = process.env.TIVO_SOURCE_URL || 'https://127.0.0.1/tivo/api/shows?refresh=1';
const UPCOMING_SOURCE_URL = process.env.TIVO_UPCOMING_SOURCE_URL || 'https://127.0.0.1/tivo/api/upcoming?refresh=1';
const OUT_PATH = path.join(__dirname, '..', 'tivo-shows.json');
const UPCOMING_OUT_PATH = path.join(__dirname, '..', 'tivo-upcoming.json');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'http:' ? http : https;
    const options = parsed.protocol === 'https:'
      ? { rejectUnauthorized: false, timeout: 180000 }
      : { timeout: 180000 };
    const request = client.get(url, options, response => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`Request failed with ${response.statusCode}`));
        response.resume();
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('TiVo snapshot request timed out'));
    });
    request.on('error', reject);
  });
}

function publicShow(show = {}) {
  return {
    title: show.title || 'Untitled',
    episodeTitle: show.episodeTitle || '',
    description: show.description || '',
    sourceChannel: show.sourceChannel || '',
    sourceStation: show.sourceStation || '',
    rating: show.rating || '',
    isSuggestion: Boolean(show.isSuggestion),
    durationMs: Number(show.durationMs || 0),
    sizeBytes: Number(show.sizeBytes || 0),
    captureDate: show.captureDate || ''
  };
}

function publicUpcoming(show = {}) {
  return {
    title: show.title || 'Untitled',
    episodeTitle: show.episodeTitle || '',
    description: show.description || '',
    sourceChannel: show.sourceChannel || '',
    sourceStation: show.sourceStation || '',
    rating: show.rating || '',
    state: show.state || '',
    durationMs: Number(show.durationMs || 0),
    scheduledStartTime: show.scheduledStartTime || '',
    scheduledEndTime: show.scheduledEndTime || '',
    isInProgress: Boolean(show.isInProgress)
  };
}

function publicSnapshot(payload = {}) {
  const shows = Array.isArray(payload.shows) ? payload.shows.map(publicShow) : [];
  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    sourceUpdatedAt: payload.updatedAt || null,
    sourceCacheUpdatedAt: payload.cacheUpdatedAt || null,
    source: 'Local TiVo API',
    totalItems: Number(payload.totalItems || shows.length),
    loadedItems: Number(payload.loadedItems || shows.length),
    cached: Boolean(payload.cached),
    storage: payload.storage || null,
    shows
  };
}

function publicUpcomingSnapshot(payload = {}) {
  const shows = Array.isArray(payload.shows) ? payload.shows.map(publicUpcoming) : [];
  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    sourceUpdatedAt: payload.updatedAt || null,
    sourceCacheUpdatedAt: payload.cacheUpdatedAt || null,
    source: 'Local TiVo API',
    totalItems: Number(payload.totalItems || shows.length),
    loadedItems: Number(payload.loadedItems || shows.length),
    cached: Boolean(payload.cached),
    shows
  };
}

async function main() {
  const [payload, upcomingPayload] = await Promise.all([
    fetchJson(SOURCE_URL),
    fetchJson(UPCOMING_SOURCE_URL)
  ]);
  const snapshot = publicSnapshot(payload);
  const upcomingSnapshot = publicUpcomingSnapshot(upcomingPayload);
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  fs.writeFileSync(UPCOMING_OUT_PATH, `${JSON.stringify(upcomingSnapshot, null, 2)}\n`);
  console.log(`Synced ${snapshot.shows.length} TiVo shows to ${path.basename(OUT_PATH)}`);
  console.log(`Synced ${upcomingSnapshot.shows.length} upcoming recordings to ${path.basename(UPCOMING_OUT_PATH)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
