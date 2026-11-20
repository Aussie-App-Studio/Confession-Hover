/**
 * Confession Hover — Background Service Worker
 * 0ms Bundled Offline Packs + IndexedDB Community Pack Manager + Reference Resolver
 */

importScripts('../shared/confession-schema.js', '../shared/confession-registry.js');

const Schema = globalThis.ConfessionHoverSchema;
const Registry = globalThis.ConfessionHoverRegistry;

const DEFAULT_DISABLED_DOMAINS = [
  'docs.google.com',
  'googledocs.com',
  'sheets.google.com',
  'github.com',
  'stackoverflow.com',
  'learn.microsoft.com',
  'reformedstandards.com',
  'thewestminsterstandard.org',
  'threeforms.org',
  '1689londonbaptistconfession.com'
];

const DEFAULT_SETTINGS = {
  enabled: true,
  scanMode: 'auto', // 'auto' | 'selection'
  theme: 'auto',    // 'auto' | 'light' | 'dark' | 'sepia'
  fontSize: 'medium', // 'small' | 'medium' | 'large'
  bodyFont: 'sans',   // 'sans' | 'serif' | 'garamond' | 'humanist' | 'dyslexic' | 'mono'
  underlineStyle: 'dotted', // 'dotted' | 'dashed' | 'solid' | 'highlight' | 'none'
  underlineColor: '#9f1239',
  hoverDelay: 120,
  minimalistMode: false,
  showExternalLinks: true,
  showSettingsButton: true,
  riskyAliasMode: 'context', // 'context' | 'strict' | 'always'
  disabledDocIds: [],
  disabledDomains: DEFAULT_DISABLED_DOMAINS,
  installedPackRegistry: [],
  installDate: null,
  lastPromptDate: null,
  hasRatedOrShared: false,
  confessionHoverCount: 0
};

// In-memory LRU pack cache (fast 0ms lookups once loaded)
const MAX_LOADED_PACKS = 16;
const loadedPacks = new Map(); // docId -> Promise<pack>

function getCachedPackPromise(id) {
  if (!loadedPacks.has(id)) return null;
  const val = loadedPacks.get(id);
  loadedPacks.delete(id);
  loadedPacks.set(id, val);
  return val;
}

function setCachedPackPromise(id, promise) {
  if (loadedPacks.has(id)) loadedPacks.delete(id);
  while (loadedPacks.size >= MAX_LOADED_PACKS) {
    const oldest = loadedPacks.keys().next().value;
    loadedPacks.delete(oldest);
  }
  loadedPacks.set(id, promise);
}

// IndexedDB for installed community / custom packs
const DB_NAME = 'ConfessionHoverDB';
const DB_VERSION = 1;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('packs')) {
        db.createObjectStore('packs', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function idbGetPack(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('packs', 'readonly');
    const req = tx.objectStore('packs').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutPack(pack) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('packs', 'readwrite');
    const req = tx.objectStore('packs').put(pack);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeletePack(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('packs', 'readwrite');
    const req = tx.objectStore('packs').delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAllPacks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('packs', 'readonly');
    const req = tx.objectStore('packs').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function syncInstalledPackRegistry() {
  const allCustom = await idbGetAllPacks();
  const descriptors = allCustom.map(p => ({
    ...Schema.extractPackDescriptor(p),
    installedAt: p.installedAt || Date.now(),
    sourcePackUrl: p.sourcePackUrl || ''
  }));
  Registry.setCustomPacks(descriptors);
  await chrome.storage.local.set({ installedPackRegistry: descriptors });
  return descriptors;
}

async function loadPack(docId) {
  const cached = getCachedPackPromise(docId);
  if (cached) return cached;

  const p = (async () => {
    // Check IndexedDB first so a user-installed pack can override or extend bundled docs
    try {
      const customPack = await idbGetPack(docId);
      if (customPack && customPack.entries) {
        return customPack;
      }
    } catch (err) {
      console.warn('IDB read error:', err);
    }

    const bundledMeta = Registry.BUNDLED_DOCS.find(d => d.id === docId);
    if (!bundledMeta || !bundledMeta.dataFile) {
      throw new Error(`Confession pack "${docId}" is not installed.`);
    }

    const res = await fetch(chrome.runtime.getURL(bundledMeta.dataFile));
    if (!res.ok) {
      throw new Error(`Failed to load bundled pack ${docId}`);
    }
    return res.json();
  })();

  setCachedPackPromise(docId, p);
  p.catch(() => loadedPacks.delete(docId));
  return p;
}

function buildContextKey(pack, parsedRef) {
  const first = parsedRef.segments && parsedRef.segments[0];
  if (!first) return null;

  if (pack.structure === 'chapter_section') {
    return {
      groupKey: `ch:${first.chapter}`,
      label: `Full Chapter ${first.chapter}`
    };
  }

  if (pack.structure === 'dort') {
    return {
      groupKey: `head:${first.head}`,
      label: `Full Head ${first.head}`
    };
  }

  if (pack.structure === 'catechism') {
    if (parsedRef.mode === 'lords_day' && pack.lordDays) {
      return {
        groupKey: `ld:${first.start}`,
        label: `Full Lord's Day ${first.start}`
      };
    }
    const qEntry = pack.entries[String(first.start)];
    if (pack.id === 'hc' && qEntry && qEntry.lordDay) {
      return {
        groupKey: `ld:${qEntry.lordDay}`,
        label: `Full Lord's Day ${qEntry.lordDay}`
      };
    }
    const blockStart = Math.max(1, Math.floor((first.start - 1) / 10) * 10 + 1);
    const maxQ = (pack.bounds && pack.bounds.maxNumber) || first.end;
    const blockEnd = Math.min(maxQ, blockStart + 9);
    return {
      groupKey: `range:${blockStart}-${blockEnd}`,
      label: `Questions ${blockStart}–${blockEnd}`
    };
  }

  if (pack.structure === 'article') {
    return {
      groupKey: 'all',
      label: `All ${pack.shortName} Articles`
    };
  }

  if (pack.structure === 'creed') {
    return {
      groupKey: 'all',
      label: pack.name
    };
  }

  return null;
}

function resolveReferenceItems(pack, parsedRef) {
  const items = [];
  let subtitle = '';

  if (pack.structure === 'creed') {
    const entry = pack.entries['1'];
    if (entry) {
      items.push({
        key: '1',
        label: '',
        title: entry.title || pack.name,
        text: entry.text
      });
    }
    subtitle = pack.year ? `${pack.tradition || 'Ecumenical Creed'} (${pack.year})` : '';
    return { items, subtitle };
  }

  if (parsedRef.mode === 'lords_day' && pack.lordDays) {
    const ldTitles = [];
    for (const seg of parsedRef.segments) {
      for (let ld = seg.start; ld <= seg.end; ld++) {
        const range = pack.lordDays[String(ld)];
        if (!range) continue;
        ldTitles.push(`Lord's Day ${ld} (Q. ${range[0]}–${range[1]})`);
        for (let q = range[0]; q <= range[1]; q++) {
          const entry = pack.entries[String(q)];
          if (entry) {
            items.push({
              key: String(q),
              number: q,
              lordDay: ld,
              question: entry.question || '',
              answer: entry.answer || entry.text || ''
            });
          }
        }
      }
    }
    subtitle = ldTitles.join(' • ');
    return { items, subtitle };
  }

  if (pack.structure === 'catechism') {
    const lds = new Set();
    for (const seg of parsedRef.segments) {
      for (let q = seg.start; q <= seg.end; q++) {
        const entry = pack.entries[String(q)];
        if (entry) {
          if (entry.lordDay) lds.add(entry.lordDay);
          items.push({
            key: String(q),
            number: q,
            lordDay: entry.lordDay || null,
            question: entry.question || '',
            answer: entry.answer || entry.text || ''
          });
        }
      }
    }
    if (lds.size > 0) {
      subtitle = Array.from(lds).map(ld => `Lord's Day ${ld}`).join(', ');
    } else if (pack.year) {
      subtitle = `${pack.tradition} (${pack.year})`;
    }
    return { items, subtitle };
  }

  if (pack.structure === 'article') {
    const titles = new Set();
    for (const seg of parsedRef.segments) {
      for (let a = seg.start; a <= seg.end; a++) {
        const entry = pack.entries[String(a)];
        if (entry) {
          if (entry.title) titles.add(entry.title);
          items.push({
            key: String(a),
            label: `Art. ${a}`,
            title: entry.title || '',
            text: entry.text || ''
          });
        }
      }
    }
    subtitle = titles.size === 1 ? Array.from(titles)[0] : '';
    return { items, subtitle };
  }

  if (pack.structure === 'chapter_section') {
    const titles = new Set();
    for (const seg of parsedRef.segments) {
      if (pack.chapters && pack.chapters[String(seg.chapter)]) {
        titles.add(`Ch. ${seg.chapter}: ${pack.chapters[String(seg.chapter)]}`);
      }
      for (let s = seg.start; s <= seg.end; s++) {
        const key = `${seg.chapter}.${s}`;
        const entry = pack.entries[key];
        if (entry) {
          if (entry.title && !pack.chapters) titles.add(entry.title);
          items.push({
            key,
            label: `${seg.chapter}.${s}`,
            title: entry.title || '',
            text: entry.text || ''
          });
        }
      }
    }
    subtitle = Array.from(titles).slice(0, 2).join(' • ');
    return { items, subtitle };
  }

  if (pack.structure === 'dort') {
    const titles = new Set();
    for (const seg of parsedRef.segments) {
      if (pack.chapters && pack.chapters[seg.head]) {
        titles.add(`Head ${seg.head}: ${pack.chapters[seg.head]}`);
      }
      if (seg.isWholeHead) {
        const bound = pack.bounds && pack.bounds.heads && pack.bounds.heads[seg.head];
        const maxA = (bound && bound.articles) || 18;
        const maxR = (bound && bound.rejections) || 9;
        for (let a = 1; a <= maxA; a++) {
          const key = `${seg.head}.A${a}`;
          const entry = pack.entries[key];
          if (entry) {
            items.push({ key, kind: 'article', label: `Art. ${a}`, title: entry.title || '', text: entry.text });
          }
        }
        for (let r = 1; r <= maxR; r++) {
          const key = `${seg.head}.R${r}`;
          const entry = pack.entries[key];
          if (entry) {
            items.push({ key, kind: 'rejection', label: `Rejection of Errors ${r}`, title: entry.title || '', text: entry.text });
          }
        }
      } else {
        const prefix = seg.kind === 'rejection' ? 'R' : 'A';
        for (let n = seg.start; n <= seg.end; n++) {
          const key = `${seg.head}.${prefix}${n}`;
          const entry = pack.entries[key];
          if (entry) {
            items.push({
              key,
              kind: seg.kind,
              label: seg.kind === 'rejection' ? `Rejection ${n}` : `Art. ${n}`,
              title: entry.title || '',
              text: entry.text || ''
            });
          }
        }
      }
    }
    subtitle = Array.from(titles).slice(0, 2).join(' • ');
    return { items, subtitle };
  }

  return { items, subtitle };
}

async function resolveContextGroup(docId, groupKey) {
  const pack = await loadPack(docId);
  const items = [];
  let groupTitle = pack.name;
  let nav = null;

  if (groupKey && groupKey.startsWith('ch:') && pack.structure === 'chapter_section') {
    const ch = groupKey.slice(3);
    const chNum = parseInt(ch, 10);
    const chBounds = (pack.bounds && Array.isArray(pack.bounds.chapters)) ? pack.bounds.chapters : [];
    const maxSec = chBounds[chNum - 1] || 0;
    const chTitle = (pack.chapters && pack.chapters[ch]) || '';
    groupTitle = chTitle ? `${pack.shortName} Chapter ${ch}: ${chTitle}` : `${pack.shortName} Chapter ${ch}`;
    for (let s = 1; s <= maxSec; s++) {
      const key = `${ch}.${s}`;
      const entry = pack.entries[key];
      if (entry) {
        items.push({ key, label: `${ch}.${s}`, title: entry.title || '', text: entry.text || '' });
      }
    }
    nav = {};
    if (chNum > 1) {
      nav.prevKey = `ch:${chNum - 1}`;
      nav.prevLabel = `← Ch. ${chNum - 1}`;
    }
    if (chBounds.length > 0 && chNum < chBounds.length) {
      nav.nextKey = `ch:${chNum + 1}`;
      nav.nextLabel = `Ch. ${chNum + 1} →`;
    }
  } else if (groupKey && groupKey.startsWith('head:') && pack.structure === 'dort') {
    const head = groupKey.slice(5);
    const allHeads = ['1', '2', '3/4', '5'].filter(h => pack.bounds && pack.bounds.heads && pack.bounds.heads[h]);
    const bound = (pack.bounds && pack.bounds.heads && pack.bounds.heads[head]) || { articles: 0, rejections: 0 };
    const headTitle = (pack.chapters && pack.chapters[head]) || '';
    groupTitle = headTitle ? `Canons of Dort Head ${head}: ${headTitle}` : `Canons of Dort Head ${head}`;
    for (let a = 1; a <= bound.articles; a++) {
      const key = `${head}.A${a}`;
      const entry = pack.entries[key];
      if (entry) items.push({ key, kind: 'article', label: `Article ${a}`, text: entry.text });
    }
    for (let r = 1; r <= bound.rejections; r++) {
      const key = `${head}.R${r}`;
      const entry = pack.entries[key];
      if (entry) items.push({ key, kind: 'rejection', label: `Rejection of Errors ${r}`, text: entry.text });
    }
    const idx = allHeads.indexOf(head);
    if (idx !== -1) {
      nav = {};
      if (idx > 0) {
        nav.prevKey = `head:${allHeads[idx - 1]}`;
        nav.prevLabel = `← Head ${allHeads[idx - 1]}`;
      }
      if (idx < allHeads.length - 1) {
        nav.nextKey = `head:${allHeads[idx + 1]}`;
        nav.nextLabel = `Head ${allHeads[idx + 1]} →`;
      }
    }
  } else if (groupKey && groupKey.startsWith('ld:') && pack.lordDays) {
    const ld = groupKey.slice(3);
    const ldNum = parseInt(ld, 10);
    const range = pack.lordDays[ld];
    groupTitle = `${pack.name} — Lord's Day ${ld}`;
    if (range) {
      for (let q = range[0]; q <= range[1]; q++) {
        const entry = pack.entries[String(q)];
        if (entry) {
          items.push({
            key: String(q),
            number: q,
            lordDay: ldNum,
            question: entry.question || '',
            answer: entry.answer || entry.text || ''
          });
        }
      }
    }
    nav = {};
    if (ldNum > 1 && pack.lordDays[String(ldNum - 1)]) {
      nav.prevKey = `ld:${ldNum - 1}`;
      nav.prevLabel = `← LD ${ldNum - 1}`;
    }
    if (pack.lordDays[String(ldNum + 1)]) {
      nav.nextKey = `ld:${ldNum + 1}`;
      nav.nextLabel = `LD ${ldNum + 1} →`;
    }
  } else if (groupKey && groupKey.startsWith('range:') && pack.structure === 'catechism') {
    const [sStr, eStr] = groupKey.slice(6).split('-');
    const start = parseInt(sStr, 10) || 1;
    const end = parseInt(eStr, 10) || start + 9;
    const maxNum = (pack.bounds && pack.bounds.maxNumber) || end;
    groupTitle = `${pack.shortName} Questions ${start}–${end}`;
    for (let q = start; q <= end; q++) {
      const entry = pack.entries[String(q)];
      if (entry) {
        items.push({
          key: String(q),
          number: q,
          question: entry.question || '',
          answer: entry.answer || entry.text || ''
        });
      }
    }
    nav = {};
    if (start > 1) {
      const ps = Math.max(1, start - 10);
      const pe = start - 1;
      nav.prevKey = `range:${ps}-${pe}`;
      nav.prevLabel = `← Q. ${ps}–${pe}`;
    }
    if (end < maxNum) {
      const ns = end + 1;
      const ne = Math.min(maxNum, end + 10);
      nav.nextKey = `range:${ns}-${ne}`;
      nav.nextLabel = `Q. ${ns}–${ne} →`;
    }
  } else {
    // Full document (e.g. Belgic Confession all 37 articles, Creeds)
    groupTitle = pack.name;
    const entries = Object.entries(pack.entries || {});
    entries.sort((a, b) => {
      const na = /^\d+$/.test(a[0]) ? parseInt(a[0], 10) : Number.MAX_SAFE_INTEGER;
      const nb = /^\d+$/.test(b[0]) ? parseInt(b[0], 10) : Number.MAX_SAFE_INTEGER;
      return na - nb;
    });
    for (const [key, entry] of entries) {
      if (pack.structure === 'catechism') {
        items.push({
          key,
          number: entry.number || key,
          question: entry.question || '',
          answer: entry.answer || entry.text || ''
        });
      } else {
        items.push({
          key,
          label: pack.structure === 'article' ? `Article ${key}` : (entry.title || key),
          title: entry.title || '',
          text: entry.text || ''
        });
      }
    }
  }

  if (nav && !nav.prevKey && !nav.nextKey) nav = null;

  return {
    ok: true,
    docId: pack.id,
    docName: pack.name,
    shortName: pack.shortName,
    structure: pack.structure,
    groupKey,
    groupTitle,
    sourceUrl: pack.sourceUrl || '',
    nav,
    items
  };
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const toSet = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (stored[k] === undefined) toSet[k] = v;
  }
  if (stored.installDate === undefined || stored.installDate === null) {
    toSet.installDate = Date.now();
  }
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }

  await syncInstalledPackRegistry().catch(() => {});

  if (details?.reason === 'install') {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html') });
    } catch (err) {
      console.warn('[Confession Hover] Could not open welcome page:', err);
    }
  }
});

chrome.runtime.onStartup?.addListener(() => {
  syncInstalledPackRegistry().catch(() => {});
});

// Only increment confessionHoverCount up to the rating-prompt threshold (5), so hovering
// doesn't trigger storage writes and chrome.storage.onChanged broadcasts forever.
const HOVER_COUNT_CAP = 5;
let hoverCountCapped = false;
let hoverCountUpdating = false;

function recordConfessionHover() {
  if (hoverCountCapped || hoverCountUpdating) return;
  hoverCountUpdating = true;
  chrome.storage.local.get('confessionHoverCount', (data) => {
    hoverCountUpdating = false;
    const current = data?.confessionHoverCount || 0;
    if (current >= HOVER_COUNT_CAP) {
      hoverCountCapped = true;
      return;
    }
    const next = current + 1;
    if (next >= HOVER_COUNT_CAP) {
      hoverCountCapped = true;
    }
    chrome.storage.local.set({ confessionHoverCount: next });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  (async () => {
    try {
      switch (message.type) {
        case 'GET_CONFESSION_ENTRY': {
          const parsedRef = message.parsedRef;
          if (!parsedRef || !parsedRef.docId) {
            throw new Error('Missing confession reference.');
          }
          const pack = await loadPack(parsedRef.docId);
          const { items, subtitle } = resolveReferenceItems(pack, parsedRef);
          if (items.length === 0) {
            throw new Error(`Entry not found for ${parsedRef.canonicalLabel}.`);
          }
          recordConfessionHover();
          const contextInfo = buildContextKey(pack, parsedRef);
          const externalUrl = Registry.getExternalUrl(pack, parsedRef);
          const isFullContextAlready = Boolean(
            pack.structure === 'creed'
            || (parsedRef.mode === 'lords_day' && parsedRef.segments?.length === 1)
            || (parsedRef.segments?.length === 1 && (parsedRef.segments[0].isWholeChapter || parsedRef.segments[0].isWholeHead))
          );

          sendResponse({
            ok: true,
            docId: pack.id,
            docName: pack.name,
            shortName: pack.shortName,
            year: pack.year || '',
            tradition: pack.tradition || '',
            structure: pack.structure,
            mode: parsedRef.mode,
            canonicalLabel: parsedRef.canonicalLabel,
            subtitle,
            items,
            contextInfo,
            isFullContextAlready,
            externalUrl,
            sourceUrl: pack.sourceUrl || ''
          });
          break;
        }

        case 'GET_CONTEXT_GROUP': {
          const res = await resolveContextGroup(message.docId, message.groupKey);
          sendResponse(res);
          break;
        }

        case 'INSTALL_PACK_FROM_URL': {
          const url = String(message.url || '').trim();
          if (!/^https?:\/\/.+/i.test(url)) {
            throw new Error('Please enter a valid http(s) JSON URL.');
          }
          const res = await fetch(url, {
            headers: { Accept: 'application/json' }
          });
          if (!res.ok) {
            throw new Error(`Failed to fetch pack (HTTP ${res.status}).`);
          }
          const rawJson = await res.json();
          const overrideMeta = {
            ...(message.catalogMeta || {}),
            bundled: false,
            custom: true
          };
          const normalized = Schema.normalizePack(rawJson, overrideMeta);
          normalized.installedAt = Date.now();
          normalized.sourcePackUrl = url;

          await idbPutPack(normalized);
          loadedPacks.delete(normalized.id);
          const descriptors = await syncInstalledPackRegistry();
          const descriptor = descriptors.find(d => d.id === normalized.id);
          sendResponse({ ok: true, descriptor });
          break;
        }

        case 'IMPORT_PACK_JSON': {
          const rawJson = typeof message.jsonText === 'string'
            ? JSON.parse(message.jsonText)
            : message.rawJson;
          const normalized = Schema.normalizePack(rawJson, {
            bundled: false,
            custom: true
          });
          normalized.installedAt = Date.now();
          normalized.sourcePackUrl = '';

          await idbPutPack(normalized);
          loadedPacks.delete(normalized.id);
          const descriptors = await syncInstalledPackRegistry();
          const descriptor = descriptors.find(d => d.id === normalized.id);
          sendResponse({ ok: true, descriptor });
          break;
        }

        case 'DELETE_PACK': {
          const id = String(message.id || '').trim();
          if (!id) throw new Error('Missing pack ID.');
          await idbDeletePack(id);
          loadedPacks.delete(id);
          const descriptors = await syncInstalledPackRegistry();
          sendResponse({ ok: true, id, installedPackRegistry: descriptors });
          break;
        }

        case 'EXPORT_PACK': {
          const id = String(message.id || '').trim();
          const pack = await loadPack(id);
          sendResponse({ ok: true, pack });
          break;
        }

        case 'GET_PACK_STATUS': {
          const descriptors = await syncInstalledPackRegistry();
          sendResponse({
            ok: true,
            bundled: Registry.BUNDLED_DOCS,
            installed: descriptors
          });
          break;
        }

        case 'SET_BADGE_COUNT': {
          if (sender?.tab?.id) {
            const count = message.count || 0;
            const text = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
            chrome.action.setBadgeText({ tabId: sender.tab.id, text }).catch(() => {});
            chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#7f1d1d' }).catch(() => {});
          }
          sendResponse({ ok: true });
          break;
        }

        case 'OPEN_OPTIONS': {
          const hash = message.hash ? `#${message.hash.replace(/^#/, '')}` : '';
          const optionsUrl = chrome.runtime.getURL(`options/options.html${hash}`);
          chrome.tabs.create({ url: optionsUrl });
          sendResponse({ ok: true });
          break;
        }

        case 'OPEN_WELCOME': {
          chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html') });
          sendResponse({ ok: true });
          break;
        }

        default:
          sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();

  return true;
});
