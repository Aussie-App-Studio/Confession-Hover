/**
 * Downloads the 7 Public Domain source files from NonlinearFruit/Creeds.json,
 * normalizes them into Confession Hover Pack v1 format, validates exact counts,
 * and writes compact JSON packs to extension/data/.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Schema = require('../extension/shared/confession-schema.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../extension/data');

const CREEDS_COMMIT_SHA = '2ae21a4c5387ecc91f474c9d3d67c826d2a6b9d5';
const BASE_URL = `https://raw.githubusercontent.com/NonlinearFruit/Creeds.json/${CREEDS_COMMIT_SHA}/creeds`;

const BUNDLED_SOURCES = [
  {
    file: 'heidelberg_catechism.json',
    outName: 'hc.json',
    meta: {
      id: 'hc',
      name: 'Heidelberg Catechism',
      shortName: 'HC',
      year: '1563',
      tradition: 'Three Forms of Unity',
      structure: 'catechism',
      bundled: true,
      custom: false,
      sourceUrl: 'https://reformedstandards.com/three-forms-of-unity/heidelberg-catechism.html',
      externalUrlPattern: 'https://reformedstandards.com/three-forms-of-unity/heidelberg-catechism.html#question-{number}',
      lordsDayUrlPattern: 'https://reformedstandards.com/three-forms-of-unity/heidelberg-catechism.html#ld-{ld}',
      aliases: ['Heidelberg Catechism', 'HC'],
      riskyAliases: ['Heidelberg'],
      lordsDayAliases: ["Lord's Day", 'Lords Day'],
      lordsDayRiskyAliases: ['LD'],
      lordDays: Schema.HEIDELBERG_LORDS_DAYS
    },
    verify(pack) {
      assert.equal(Object.keys(pack.entries).length, 129, 'HC must have 129 questions');
      assert.equal(pack.bounds.maxNumber, 129);
      assert.equal(Object.keys(pack.lordDays).length, 52, 'HC must have 52 Lord\'s Days');
    }
  },
  {
    file: 'belgic_confession_of_faith.json',
    outName: 'bc.json',
    meta: {
      id: 'bc',
      name: 'Belgic Confession',
      shortName: 'BC',
      year: '1561',
      tradition: 'Three Forms of Unity',
      structure: 'article',
      bundled: true,
      custom: false,
      sourceUrl: 'https://reformedstandards.com/three-forms-of-unity/belgic-confession.html',
      externalUrlPattern: 'https://reformedstandards.com/three-forms-of-unity/belgic-confession.html#chapter-{article}',
      aliases: ['Belgic Confession of Faith', 'Belgic Confession'],
      riskyAliases: ['Belgic', 'BC']
    },
    verify(pack) {
      assert.equal(Object.keys(pack.entries).length, 37, 'BC must have 37 articles');
      assert.equal(pack.bounds.maxNumber, 37);
    }
  },
  {
    file: 'canons_of_dort.json',
    outName: 'dort.json',
    meta: {
      id: 'dort',
      name: 'Canons of Dort',
      shortName: 'Dort',
      year: '1619',
      tradition: 'Three Forms of Unity',
      structure: 'dort',
      bundled: true,
      custom: false,
      sourceUrl: 'https://reformedstandards.com/three-forms-of-unity/canons-of-dort.html',
      externalUrlPattern: 'https://reformedstandards.com/three-forms-of-unity/canons-of-dort.html',
      aliases: ['Canons of Dort', 'Canons of Dordrecht', 'CoD'],
      riskyAliases: ['Dort', 'CD']
    },
    verify(pack) {
      const heads = pack.bounds.heads;
      const sortedHeads = Object.keys(heads).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      assert.deepEqual(sortedHeads, ['1', '2', '3/4', '5'], 'Dort must have heads 1, 2, 3/4, 5');
      assert.equal(heads['1'].articles, 18);
      assert.equal(heads['1'].rejections, 9);
      assert.equal(heads['2'].articles, 9);
      assert.equal(heads['2'].rejections, 7);
      assert.equal(heads['3/4'].articles, 17);
      assert.equal(heads['3/4'].rejections, 9);
      assert.equal(heads['5'].articles, 15);
      assert.equal(heads['5'].rejections, 9);
      assert.ok(pack.entries['5.A15'] && pack.entries['5.R9'], 'Head 5 entries must exist');
    }
  },
  {
    file: 'westminster_confession_of_faith.json',
    outName: 'wcf.json',
    meta: {
      id: 'wcf',
      name: 'Westminster Confession of Faith',
      shortName: 'WCF',
      year: '1647',
      tradition: 'Westminster Standards',
      structure: 'chapter_section',
      bundled: true,
      custom: false,
      sourceUrl: 'https://reformedstandards.com/westminster/wcf.html',
      externalUrlPattern: 'https://reformedstandards.com/westminster/wcf.html#article-{chapter}-{section}',
      wholeChapterUrlPattern: 'https://reformedstandards.com/westminster/wcf.html#chapter-{chapter}',
      aliases: ['Westminster Confession of Faith', 'Westminster Confession', 'WCF'],
      riskyAliases: []
    },
    verify(pack) {
      assert.equal(pack.bounds.chapters.length, 33, 'WCF must have 33 chapters');
      assert.equal(pack.bounds.chapters[0], 10, 'WCF Ch 1 has 10 sections');
      assert.equal(pack.bounds.chapters[3], 2, 'WCF Ch 4 has 2 sections');
    }
  },
  {
    file: 'westminster_larger_catechism.json',
    outName: 'wlc.json',
    meta: {
      id: 'wlc',
      name: 'Westminster Larger Catechism',
      shortName: 'WLC',
      year: '1647',
      tradition: 'Westminster Standards',
      structure: 'catechism',
      bundled: true,
      custom: false,
      sourceUrl: 'https://reformedstandards.com/westminster/wlc.html',
      externalUrlPattern: 'https://reformedstandards.com/westminster/wlc.html#question-{number}',
      aliases: ['Westminster Larger Catechism', 'Larger Catechism', 'WLC'],
      riskyAliases: ['LC']
    },
    verify(pack) {
      assert.equal(Object.keys(pack.entries).length, 196, 'WLC must have 196 questions');
      assert.equal(pack.bounds.maxNumber, 196);
    }
  },
  {
    file: 'westminster_shorter_catechism.json',
    outName: 'wsc.json',
    meta: {
      id: 'wsc',
      name: 'Westminster Shorter Catechism',
      shortName: 'WSC',
      year: '1647',
      tradition: 'Westminster Standards',
      structure: 'catechism',
      bundled: true,
      custom: false,
      sourceUrl: 'https://reformedstandards.com/westminster/wsc.html',
      externalUrlPattern: 'https://reformedstandards.com/westminster/wsc.html#question-{number}',
      aliases: ['Westminster Shorter Catechism', 'Shorter Catechism', 'WSC'],
      riskyAliases: ['SC']
    },
    verify(pack) {
      assert.equal(Object.keys(pack.entries).length, 107, 'WSC must have 107 questions');
      assert.equal(pack.bounds.maxNumber, 107);
    }
  },
  {
    file: 'london_baptist_1689.json',
    outName: 'lbcf1689.json',
    meta: {
      id: 'lbcf1689',
      name: '1689 London Baptist Confession',
      shortName: '2LBCF',
      year: '1689',
      tradition: 'Reformed Baptist',
      structure: 'chapter_section',
      bundled: true,
      custom: false,
      sourceUrl: 'https://reformedstandards.com/second-london/1689-confession.html',
      externalUrlPattern: 'https://reformedstandards.com/second-london/1689-confession.html#article-{chapter}-{section}',
      wholeChapterUrlPattern: 'https://reformedstandards.com/second-london/1689-confession.html#chapter-{chapter}',
      aliases: [
        '1689 London Baptist Confession of Faith',
        '1689 London Baptist Confession',
        'Second London Baptist Confession',
        'Second London Confession',
        'London Baptist Confession',
        '1689 Baptist Confession',
        '1689 Confession',
        '2nd London Confession',
        '1689 LBCF',
        'LBCF 1689',
        '2nd LBCF',
        '2LBCF',
        '2LCF',
        'LBCF'
      ],
      riskyAliases: ['LBC', '1689']
    },
    verify(pack) {
      assert.equal(pack.bounds.chapters.length, 32, '2LBCF must have 32 chapters');
      assert.equal(pack.bounds.chapters[25], 15, '2LBCF Ch 26 has 15 sections');
    }
  }
];

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  let totalBytes = 0;

  for (const src of BUNDLED_SOURCES) {
    const url = `${BASE_URL}/${src.file}`;
    console.log(`Fetching ${url}...`);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ConfessionHover-Builder/1.0' }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    const rawJson = await res.json();
    const pack = Schema.normalizePack(rawJson, src.meta);
    src.verify(pack);

    const outPath = path.join(OUT_DIR, src.outName);
    const serialized = JSON.stringify(pack);
    await fs.writeFile(outPath, serialized, 'utf8');
    totalBytes += Buffer.byteLength(serialized, 'utf8');

    const desc = Schema.extractPackDescriptor(pack);
    console.log(
      `  ✓ ${src.outName} (${(Buffer.byteLength(serialized, 'utf8') / 1024).toFixed(1)} KB, ${desc.entryCount} entries, bounds=${JSON.stringify(desc.bounds)})`
    );
  }

  console.log(`\nBuilt all 7 bundled packs: ${(totalBytes / 1024).toFixed(1)} KB total.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
