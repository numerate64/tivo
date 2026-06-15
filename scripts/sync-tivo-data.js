const fs = require('fs');
const https = require('https');
const path = require('path');

const SOURCE_URL = process.env.TIVO_SOURCE_URL || 'https://127.0.0.1/tivo/api/shows?refresh=1';
const OUT_PATH = path.join(__dirname, '..', 'tivo-shows.json');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { rejectUnauthorized: false, timeout: 180000 }, response => {
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

async function main() {
  const payload = await fetchJson(SOURCE_URL);
  const snapshot = publicSnapshot(payload);
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Synced ${snapshot.shows.length} TiVo shows to ${path.basename(OUT_PATH)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
