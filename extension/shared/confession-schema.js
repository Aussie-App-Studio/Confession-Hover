/**
 * Confession Hover — Unified Pack Schema & Normalizer
 * Supports native Confession Hover Pack v1 JSON (full or simplified)
 * and NonlinearFruit/Creeds.json source files.
 * Zero dependencies. Runs in Content Scripts, Service Worker, and Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.ConfessionHoverSchema = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 1;

  // Canonical 52 Lord's Days of the Heidelberg Catechism (Q1–Q129)
  const HEIDELBERG_LORDS_DAYS = {
    '1': [1, 2], '2': [3, 5], '3': [6, 8], '4': [9, 11],
    '5': [12, 15], '6': [16, 19], '7': [20, 23], '8': [24, 25],
    '9': [26, 26], '10': [27, 28], '11': [29, 30], '12': [31, 32],
    '13': [33, 34], '14': [35, 36], '15': [37, 39], '16': [40, 44],
    '17': [45, 45], '18': [46, 49], '19': [50, 52], '20': [53, 53],
    '21': [54, 56], '22': [57, 58], '23': [59, 61], '24': [62, 64],
    '25': [65, 68], '26': [69, 71], '27': [72, 74], '28': [75, 77],
    '29': [78, 79], '30': [80, 82], '31': [83, 85], '32': [86, 87],
    '33': [88, 91], '34': [92, 95], '35': [96, 98], '36': [99, 100],
    '37': [101, 102], '38': [103, 103], '39': [104, 104], '40': [105, 107],
    '41': [108, 109], '42': [110, 111], '43': [112, 112], '44': [113, 115],
    '45': [116, 119], '46': [120, 121], '47': [122, 122], '48': [123, 123],
    '49': [124, 124], '50': [125, 125], '51': [126, 126], '52': [127, 129]
  };

  function getLordsDayForQuestion(qNum) {
    const n = parseInt(qNum, 10);
    if (!Number.isFinite(n) || n < 1 || n > 129) return null;
    for (const [ld, range] of Object.entries(HEIDELBERG_LORDS_DAYS)) {
      if (n >= range[0] && n <= range[1]) return parseInt(ld, 10);
    }
    return null;
  }

  function cleanText(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function slugifyId(name) {
    const base = String(name || 'custom_pack')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return base || 'custom_pack';
  }

  function makeShortName(name, aliases) {
    if (Array.isArray(aliases)) {
      const short = aliases.find(a => /^[A-Z0-9]{2,8}$/.test(String(a).trim()));
      if (short) return String(short).trim();
    }
    const words = String(name || 'PACK').split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 8).toUpperCase();
    return words
      .filter(w => !/^(of|the|and|for|in|on|at|to)$/i.test(w))
      .map(w => w[0])
      .join('')
      .slice(0, 6)
      .toUpperCase() || 'PACK';
  }

  function uniqueStrings(arr) {
    const seen = new Set();
    const out = [];
    for (const item of arr || []) {
      const clean = String(item || '').trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(clean);
      }
    }
    return out;
  }

  function inferStructureFromEntries(entries, declared) {
    if (declared && ['chapter_section', 'catechism', 'article', 'dort', 'creed'].includes(declared)) {
      return declared;
    }
    const keys = Object.keys(entries || {});
    if (keys.some(k => /^\d+(?:\/4)?\.[AR]\d+$/i.test(k))) return 'dort';
    if (keys.some(k => /^\d+\.\d+$/.test(k))) return 'chapter_section';
    const values = Object.values(entries || {});
    if (values.some(v => v && typeof v === 'object' && ('question' in v || 'answer' in v))) {
      return 'catechism';
    }
    if (keys.length === 1 && keys[0] === '1') return 'creed';
    return 'article';
  }

  function computeBoundsFromEntries(structure, entries) {
    const keys = Object.keys(entries || {});
    if (structure === 'chapter_section') {
      const counts = new Map();
      let maxChapter = 0;
      for (const k of keys) {
        const m = k.match(/^(\d+)\.(\d+)$/);
        if (!m) continue;
        const ch = parseInt(m[1], 10);
        const sec = parseInt(m[2], 10);
        if (ch > maxChapter) maxChapter = ch;
        counts.set(ch, Math.max(counts.get(ch) || 0, sec));
      }
      const chapters = [];
      for (let c = 1; c <= maxChapter; c++) {
        chapters.push(counts.get(c) || 0);
      }
      return { chapters };
    }

    if (structure === 'dort') {
      const heads = {};
      for (const k of keys) {
        const m = k.match(/^([^.]+)\.([AR])(\d+)$/i);
        if (!m) continue;
        const head = m[1];
        const kind = m[2].toUpperCase();
        const num = parseInt(m[3], 10);
        if (!heads[head]) heads[head] = { articles: 0, rejections: 0 };
        if (kind === 'A') heads[head].articles = Math.max(heads[head].articles, num);
        else heads[head].rejections = Math.max(heads[head].rejections, num);
      }
      return { heads };
    }

    if (structure === 'creed') {
      return { maxNumber: 1 };
    }

    let maxNumber = 0;
    for (const k of keys) {
      if (/^\d+$/.test(k)) {
        const n = parseInt(k, 10);
        if (n > maxNumber) maxNumber = n;
      }
    }
    return { maxNumber: maxNumber || keys.length };
  }

  function normalizeNativePack(raw, overrideMeta) {
    const meta = overrideMeta || {};
    const name = meta.name || raw.name || raw.title || 'Custom Confession Pack';
    const id = meta.id || raw.id || slugifyId(name);
    const structure = inferStructureFromEntries(raw.entries, meta.structure || raw.structure);
    const chapters = (meta.chapters || raw.chapters) ? { ...(raw.chapters || {}), ...(meta.chapters || {}) } : {};
    const entries = {};

    for (const [rawKey, rawVal] of Object.entries(raw.entries || {})) {
      const key = String(rawKey).trim();
      if (!key || rawVal == null) continue;

      if (typeof rawVal === 'string') {
        const text = cleanText(rawVal);
        if (!text) continue;
        if (structure === 'chapter_section') {
          const [ch, sec] = key.split('.');
          entries[key] = {
            chapter: ch,
            section: sec || '1',
            ...(chapters[ch] ? { title: chapters[ch] } : {}),
            text
          };
        } else if (structure === 'catechism') {
          const num = /^\d+$/.test(key) ? parseInt(key, 10) : key;
          const ld = id === 'hc' ? getLordsDayForQuestion(num) : undefined;
          entries[key] = {
            number: num,
            question: '',
            answer: text,
            ...(ld ? { lordDay: ld } : {})
          };
        } else if (structure === 'dort') {
          const m = key.match(/^([^.]+)\.([AR])(\d+)$/i);
          entries[key] = {
            head: m ? m[1] : '1',
            kind: m && m[2].toUpperCase() === 'R' ? 'rejection' : 'article',
            number: m ? parseInt(m[3], 10) : 1,
            ...(m && chapters[m[1]] ? { title: chapters[m[1]] } : {}),
            text
          };
        } else if (structure === 'creed') {
          entries[key] = { title: name, text };
        } else {
          entries[key] = { article: key, text };
        }
      } else if (typeof rawVal === 'object') {
        const item = { ...rawVal };
        if (typeof item.text === 'string') item.text = cleanText(item.text);
        if (typeof item.question === 'string') item.question = cleanText(item.question);
        if (typeof item.answer === 'string') item.answer = cleanText(item.answer);
        if (typeof item.content === 'string' && !item.text) {
          item.text = cleanText(item.content);
          delete item.content;
        }
        if (structure === 'catechism' && item.text && !item.answer) {
          item.answer = item.text;
          delete item.text;
        }
        if (structure === 'catechism' && item.number === undefined && /^\d+$/.test(key)) {
          item.number = parseInt(key, 10);
        }
        entries[key] = item;
      }
    }

    const aliases = uniqueStrings(meta.aliases || raw.aliases || [name]);
    const riskyAliases = uniqueStrings(meta.riskyAliases || raw.riskyAliases || []);
    const shortName = meta.shortName || raw.shortName || makeShortName(name, aliases);
    const bounds = meta.bounds || raw.bounds || computeBoundsFromEntries(structure, entries);
    const lordDays = meta.lordDays || raw.lordDays || (id === 'hc' ? HEIDELBERG_LORDS_DAYS : undefined);

    const normalized = {
      schemaVersion: SCHEMA_VERSION,
      id,
      name,
      shortName,
      year: String(meta.year || raw.year || '').trim(),
      tradition: meta.tradition || raw.tradition || 'Community Pack',
      structure,
      bundled: Boolean(meta.bundled !== undefined ? meta.bundled : raw.bundled),
      custom: Boolean(meta.custom !== undefined ? meta.custom : (raw.custom !== undefined ? raw.custom : !meta.bundled && !raw.bundled)),
      sourceUrl: meta.sourceUrl || raw.sourceUrl || '',
      externalUrlPattern: meta.externalUrlPattern || raw.externalUrlPattern || '',
      ...(meta.wholeChapterUrlPattern || raw.wholeChapterUrlPattern ? { wholeChapterUrlPattern: meta.wholeChapterUrlPattern || raw.wholeChapterUrlPattern } : {}),
      ...(meta.lordsDayUrlPattern || raw.lordsDayUrlPattern ? { lordsDayUrlPattern: meta.lordsDayUrlPattern || raw.lordsDayUrlPattern } : {}),
      aliases,
      riskyAliases,
      ...(meta.lordsDayAliases || raw.lordsDayAliases ? { lordsDayAliases: uniqueStrings(meta.lordsDayAliases || raw.lordsDayAliases) } : {}),
      ...(meta.lordsDayRiskyAliases || raw.lordsDayRiskyAliases ? { lordsDayRiskyAliases: uniqueStrings(meta.lordsDayRiskyAliases || raw.lordsDayRiskyAliases) } : {}),
      bounds,
      ...(Object.keys(chapters).length > 0 ? { chapters } : {}),
      ...(lordDays ? { lordDays } : {}),
      entries
    };

    if (Object.keys(normalized.entries).length === 0) {
      throw new Error('Pack contains no valid entries.');
    }
    return normalized;
  }

  function normalizeCreedsJsonPack(raw, overrideMeta) {
    const meta = overrideMeta || {};
    const srcMeta = raw.Metadata || {};
    const name = meta.name || srcMeta.Title || 'Confession Pack';
    const id = meta.id || slugifyId(name);
    const fmt = String(srcMeta.CreedFormat || '').toLowerCase();
    const data = raw.Data;

    const entries = {};
    const chapters = {};
    let structure = meta.structure || 'article';

    if (fmt === 'creed' || (!Array.isArray(data) && data && typeof data.Content === 'string')) {
      structure = 'creed';
      const content = cleanText(data.Content || '');
      if (!content) throw new Error('Creed pack has empty Content.');
      entries['1'] = { title: name, text: content };
    } else if (fmt === 'catechism') {
      structure = 'catechism';
      for (const item of data || []) {
        const numStr = String(item.Number != null ? item.Number : '').trim();
        if (!numStr) continue;
        const num = /^\d+$/.test(numStr) ? parseInt(numStr, 10) : numStr;
        const ld = id === 'hc' ? getLordsDayForQuestion(num) : undefined;
        entries[numStr] = {
          number: num,
          question: cleanText(item.Question || ''),
          answer: cleanText(item.Answer || ''),
          ...(ld ? { lordDay: ld } : {})
        };
      }
    } else if (fmt === 'canon') {
      structure = 'article';
      for (const item of data || []) {
        const artKey = String(item.Article != null ? item.Article : '').trim();
        if (!artKey) continue;
        entries[artKey] = {
          article: artKey,
          title: cleanText(item.Title || ''),
          text: cleanText(item.Content || '')
        };
      }
    } else if (fmt === 'confession') {
      const isDort =
        meta.structure === 'dort' ||
        id === 'dort' ||
        /canons of dort/i.test(name) ||
        (Array.isArray(data) && data.some(ch => Array.isArray(ch.Sections) && ch.Sections.some(s => /^[AR]\d+$/i.test(String(s.Section || '')))));

      if (isDort) {
        structure = 'dort';
        let sawCombinedHead = false;
        for (const ch of data || []) {
          let headKey = String(ch.Chapter || '').trim();
          const chTitle = cleanText(ch.Title || '');
          if (headKey === '3&4' || headKey === '3-4' || headKey === '3/4') {
            headKey = '3/4';
            sawCombinedHead = true;
          } else if (headKey === '4' && (sawCombinedHead || /perseverance/i.test(chTitle))) {
            // Fix Creeds.json upstream bug where Head 5 is labeled Chapter "4"
            headKey = '5';
          }
          if (chTitle) chapters[headKey] = chTitle;

          for (const sec of ch.Sections || []) {
            const secId = String(sec.Section || '').trim().toUpperCase();
            const m = secId.match(/^([AR])(\d+)$/);
            if (!m) continue;
            const kind = m[1] === 'R' ? 'rejection' : 'article';
            const num = parseInt(m[2], 10);
            const entryKey = `${headKey}.${m[1]}${num}`;
            entries[entryKey] = {
              head: headKey,
              kind,
              number: num,
              ...(chTitle ? { title: chTitle } : {}),
              text: cleanText(sec.Content || '')
            };
          }
        }
      } else {
        structure = 'chapter_section';
        for (const ch of data || []) {
          const chKey = String(ch.Chapter != null ? ch.Chapter : '').trim();
          if (!chKey) continue;
          const chTitle = cleanText(ch.Title || '');
          if (chTitle) chapters[chKey] = chTitle;

          const sections = Array.isArray(ch.Sections) ? ch.Sections : [];
          for (let i = 0; i < sections.length; i++) {
            const sec = sections[i];
            const secKey = String(sec.Section != null ? sec.Section : i + 1).trim();
            const entryKey = `${chKey}.${secKey}`;
            entries[entryKey] = {
              chapter: chKey,
              section: secKey,
              ...(chTitle ? { title: chTitle } : {}),
              text: cleanText(sec.Content || '')
            };
          }
        }
      }
    } else {
      throw new Error(`Unsupported Creeds.json format: ${srcMeta.CreedFormat || 'unknown'}`);
    }

    const defaultAliases = [name, ...(Array.isArray(srcMeta.AlternativeTitles) ? srcMeta.AlternativeTitles : [])];
    const aliases = uniqueStrings(meta.aliases || defaultAliases);
    const riskyAliases = uniqueStrings(meta.riskyAliases || []);
    const shortName = meta.shortName || makeShortName(name, aliases);
    const bounds = meta.bounds || computeBoundsFromEntries(structure, entries);
    const lordDays = meta.lordDays || (id === 'hc' ? HEIDELBERG_LORDS_DAYS : undefined);

    const normalized = {
      schemaVersion: SCHEMA_VERSION,
      id,
      name,
      shortName,
      year: String(meta.year || srcMeta.Year || '').trim(),
      tradition: meta.tradition || 'Reformed & Historic Standards',
      structure,
      bundled: Boolean(meta.bundled),
      custom: meta.custom !== undefined ? Boolean(meta.custom) : !meta.bundled,
      sourceUrl: meta.sourceUrl || srcMeta.SourceUrl || '',
      externalUrlPattern: meta.externalUrlPattern || '',
      ...(meta.wholeChapterUrlPattern ? { wholeChapterUrlPattern: meta.wholeChapterUrlPattern } : {}),
      ...(meta.lordsDayUrlPattern ? { lordsDayUrlPattern: meta.lordsDayUrlPattern } : {}),
      aliases,
      riskyAliases,
      ...(meta.lordsDayAliases ? { lordsDayAliases: uniqueStrings(meta.lordsDayAliases) } : {}),
      ...(meta.lordsDayRiskyAliases ? { lordsDayRiskyAliases: uniqueStrings(meta.lordsDayRiskyAliases) } : {}),
      bounds,
      ...(Object.keys(chapters).length > 0 ? { chapters } : {}),
      ...(lordDays ? { lordDays } : {}),
      entries
    };

    if (Object.keys(normalized.entries).length === 0) {
      throw new Error('Normalized pack has no entries.');
    }
    return normalized;
  }

  /**
   * Normalizes either a native Confession Hover pack or a NonlinearFruit/Creeds.json pack.
   */
  function normalizePack(rawJson, overrideMeta = {}) {
    if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) {
      throw new Error('Invalid JSON pack: expected an object.');
    }
    if (rawJson.Metadata && rawJson.Data !== undefined) {
      return normalizeCreedsJsonPack(rawJson, overrideMeta);
    }
    if (rawJson.entries && typeof rawJson.entries === 'object' && !Array.isArray(rawJson.entries)) {
      return normalizeNativePack(rawJson, overrideMeta);
    }
    throw new Error('Unrecognized pack format. Expected { id, name, structure, entries } or Creeds.json { Metadata, Data }.');
  }

  /**
   * Strips heavy `entries` text for lightweight metadata storage & content-script sync.
   */
  function extractPackDescriptor(pack) {
    return {
      schemaVersion: pack.schemaVersion || SCHEMA_VERSION,
      id: pack.id,
      name: pack.name,
      shortName: pack.shortName,
      year: pack.year || '',
      tradition: pack.tradition || '',
      structure: pack.structure,
      bundled: Boolean(pack.bundled),
      custom: Boolean(pack.custom),
      sourceUrl: pack.sourceUrl || '',
      externalUrlPattern: pack.externalUrlPattern || '',
      ...(pack.wholeChapterUrlPattern ? { wholeChapterUrlPattern: pack.wholeChapterUrlPattern } : {}),
      ...(pack.lordsDayUrlPattern ? { lordsDayUrlPattern: pack.lordsDayUrlPattern } : {}),
      aliases: Array.isArray(pack.aliases) ? [...pack.aliases] : [pack.name],
      riskyAliases: Array.isArray(pack.riskyAliases) ? [...pack.riskyAliases] : [],
      ...(pack.lordsDayAliases ? { lordsDayAliases: [...pack.lordsDayAliases] } : {}),
      ...(pack.lordsDayRiskyAliases ? { lordsDayRiskyAliases: [...pack.lordsDayRiskyAliases] } : {}),
      bounds: pack.bounds || {},
      ...(pack.chapters ? { chapters: pack.chapters } : {}),
      ...(pack.lordDays ? { lordDays: pack.lordDays } : {}),
      entryCount: pack.entries ? Object.keys(pack.entries).length : (pack.entryCount || 0)
    };
  }

  return {
    SCHEMA_VERSION,
    HEIDELBERG_LORDS_DAYS,
    getLordsDayForQuestion,
    cleanText,
    slugifyId,
    normalizePack,
    extractPackDescriptor
  };
});
