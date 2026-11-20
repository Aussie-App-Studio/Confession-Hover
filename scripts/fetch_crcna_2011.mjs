/**
 * Fetches the 2011 CRCNA / RCA translations of the Three Forms of Unity
 * (Heidelberg Catechism, Belgic Confession, Canons of Dort) from crcna.org,
 * normalizes them into Confession Hover Pack v1 format, validates exact counts
 * and cleanliness, and writes compact JSON packs to extension/data/.
 *
 * Translation © 2011, Faith Alive Christian Resources.
 * Approved by Synod 2011 of the Christian Reformed Church in North America
 * and by General Synod 2011 of the Reformed Church in America.
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

function decodeEntities(str) {
  return String(str || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rsquo;/gi, '’')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/&hellip;/gi, '…')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\u00ad/g, '') // remove soft hyphens
    .replace(/\u00a0/g, ' ');
}

function stripTags(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Removes inline superscript footnote numbers from HC / BC 2011 text.
 * On crcna.org, footnote numbers appear directly attached to punctuation
 * or end-of-word without a space (e.g., "own,1", "death—2", "Christ.3", "way6", "him.10", "us.”44").
 * Carefully avoids stripping Bible verse numbers after colons (e.g. "Matthew 22:37-40").
 */
function stripInlineFootnotes(text) {
  let s = text;
  // Handle trailing footnote asterisks like "**" or "*" (e.g., Q&A 80, Q&A 119, BC Art. 4)
  s = s.replace(/\*+$/g, '');
  // Remove 1-2 digit footnote markers attached after punctuation or letters (NOT colon!)
  s = s.replace(/([a-zA-Z,.;!?—–”’"'\]\)])(\d{1,2})(?=\s|$|[,.;:!?—–”’"'\)\]\*])/g, '$1');
  // Normalize em-dash spacing created when joining <p>/<br> line breaks
  s = s.replace(/\s*—\s*/g, '—');
  return s.replace(/\s+/g, ' ').trim();
}

function isProofTextParagraph(pHtml) {
  const plain = stripTags(pHtml);
  // Proof text paragraphs start with a footnote number (with or without space) followed by a Bible link or Bible ref,
  // or are purely footnote explanations starting with * or **
  if (/^\d+\s*/.test(plain) && /<a\s[^>]*biblegateway\.com/i.test(pHtml)) return true;
  if (/^\d+\s*(?:[1-3]\s+)?[A-Z][a-z]+\.?\s+\d+:\d+/.test(plain)) return true;
  if (/^\*+/.test(plain)) return true;
  return false;
}

function extractLordDayForQuestion(qNum) {
  for (const [ld, [start, end]] of Object.entries(Schema.HEIDELBERG_LORDS_DAYS)) {
    if (qNum >= start && qNum <= end) return Number(ld);
  }
  throw new Error(`No Lord's Day found for Q.${qNum}`);
}

async function fetchHtml(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function buildHeidelberg() {
  const url = 'https://www.crcna.org/welcome/beliefs/confessions/heidelberg-catechism';
  const html = await fetchHtml(url);

  // Slice from Lord's Day 1 to the end of the main text body (before sidebar)
  const startIdx = html.indexOf('Lord’s Day 1');
  assert.ok(startIdx !== -1, 'Could not find Lord’s Day 1 in HC HTML');
  const endIdx = html.indexOf('</article>', startIdx);
  const body = html.slice(startIdx, endIdx !== -1 ? endIdx : undefined);

  // Split by Q &amp; A <num> markers (excluding any stray ones in prose by requiring line/tag boundary)
  const qRegex = /(?:^|[\r\n>])\s*Q\s*&amp;\s*A\s+(\d+)\*?(?=\s*(?:<|$|[\r\n]))/gi;
  const markers = [];
  let m;
  while ((m = qRegex.exec(body)) !== null) {
    markers.push({ num: Number(m[1]), index: m.index, end: m.index + m[0].length });
  }

  // Deduplicate by keeping the sequential 1..129 occurrences
  const entries = {};
  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i];
    if (cur.num < 1 || cur.num > 129) continue;
    if (entries[String(cur.num)]) continue; // already captured

    const nextIdx = i + 1 < markers.length ? markers[i + 1].index : body.length;
    const chunk = body.slice(cur.end, nextIdx);

    // Stop at next <h4> (Lord's Day heading) or <h3> (Part heading) if present
    const stopMatch = chunk.match(/<h[234][^>]*>/i);
    const qChunk = stopMatch ? chunk.slice(0, stopMatch.index) : chunk;

    const pMatches = [...qChunk.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(x => x[1]);
    assert.ok(pMatches.length >= 2, `HC Q.${cur.num} should have at least 2 paragraphs, got ${pMatches.length}`);

    let question = '';
    const answerParts = [];
    let inAnswer = false;

    for (const pHtml of pMatches) {
      if (isProofTextParagraph(pHtml)) continue;
      const plain = stripTags(pHtml);
      if (!plain) continue;

      if (!inAnswer && /^Q\.\s*/.test(plain)) {
        question = stripInlineFootnotes(plain.replace(/^Q\.\s*/, ''));
      } else if (!inAnswer && /^A\.\s*/.test(plain)) {
        inAnswer = true;
        const cleaned = stripInlineFootnotes(plain.replace(/^A\.\s*/, ''));
        if (cleaned) answerParts.push(cleaned);
      } else if (inAnswer) {
        const cleaned = stripInlineFootnotes(plain);
        if (cleaned) answerParts.push(cleaned);
      } else if (question) {
        // Multi-paragraph question continuation
        question += ' ' + stripInlineFootnotes(plain);
      }
    }

    assert.ok(question.length > 5, `HC Q.${cur.num} empty question`);
    assert.ok(answerParts.length > 0, `HC Q.${cur.num} empty answer`);

    // For Q.23 (Apostles' Creed) and Q.92 (Ten Commandments), keep paragraph breaks nicely
    const joiner = (cur.num === 23 || cur.num === 92) ? '\n\n' : ' ';
    const answer = answerParts.join(joiner).replace(/[ \t]*—[ \t]*/g, '—').replace(/[ \t]+([,.;:!?])/g, '$1').trim();

    entries[String(cur.num)] = {
      number: cur.num,
      question,
      answer,
      lordDay: extractLordDayForQuestion(cur.num)
    };
  }

  assert.equal(Object.keys(entries).length, 129, `Expected 129 HC questions, got ${Object.keys(entries).length}`);

  const pack = {
    schemaVersion: 1,
    id: 'hc',
    name: 'Heidelberg Catechism',
    shortName: 'HC',
    year: '1563',
    translation: 'CRCNA/RCA 2011',
    tradition: 'Three Forms of Unity',
    structure: 'catechism',
    bundled: true,
    custom: false,
    sourceUrl: url,
    externalUrlPattern: 'https://reformedstandards.com/three-forms-of-unity/heidelberg-catechism.html#question-{number}',
    lordsDayUrlPattern: 'https://reformedstandards.com/three-forms-of-unity/heidelberg-catechism.html#ld-{ld}',
    aliases: ['Heidelberg Catechism', 'HC'],
    riskyAliases: ['Heidelberg'],
    lordsDayAliases: ["Lord's Day", 'Lords Day'],
    lordsDayRiskyAliases: ['LD'],
    bounds: { maxNumber: 129 },
    lordDays: Schema.HEIDELBERG_LORDS_DAYS,
    entries
  };

  await fs.writeFile(path.join(OUT_DIR, 'hc.json'), JSON.stringify(pack), 'utf8');
  console.log(`✓ hc.json — 129 questions (CRCNA/RCA 2011)`);
  console.log(`  Sample Q.1: ${entries['1'].question}`);
  console.log(`  Sample A.1: ${entries['1'].answer.slice(0, 140)}...`);
}

async function buildBelgic() {
  const url = 'https://www.crcna.org/welcome/beliefs/confessions/belgic-confession';
  const html = await fetchHtml(url);

  const startIdx = html.indexOf('Article 1: The Only God');
  assert.ok(startIdx !== -1, 'Could not find Article 1 in BC HTML');
  const endIdx = html.indexOf('</article>', startIdx);
  const body = html.slice(startIdx - 10, endIdx !== -1 ? endIdx : undefined);

  const artRegex = /<h3[^>]*>\s*Article\s+(\d+)\s*:\s*([^<]+)<\/h3>/gi;
  const markers = [];
  let m;
  while ((m = artRegex.exec(body)) !== null) {
    markers.push({
      num: Number(m[1]),
      title: decodeEntities(m[2]).trim(),
      index: m.index,
      end: m.index + m[0].length
    });
  }

  assert.equal(markers.length, 37, `Expected 37 BC articles, got ${markers.length}`);

  const entries = {};
  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i];
    const nextIdx = i + 1 < markers.length ? markers[i + 1].index : body.length;
    const chunk = body.slice(cur.end, nextIdx);

    const pMatches = [...chunk.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(x => x[1]);
    const paras = [];
    for (const pHtml of pMatches) {
      if (isProofTextParagraph(pHtml)) continue;
      const plain = stripTags(pHtml);
      if (!plain) continue;
      // Stop if we hit Copyright/Permissions or footer notes at the end of Article 37
      if (/^Translation © 2011/i.test(plain) || /^All rights reserved/i.test(plain)) break;
      const cleaned = stripInlineFootnotes(plain);
      if (cleaned) paras.push(cleaned);
    }

    assert.ok(paras.length > 0, `BC Art.${cur.num} has no text`);
    // Join short poetic line-broken <p> tags smoothly; CRCNA BC uses <p> for clause-level breaks
    const text = paras.join(' ').replace(/\s*—\s*/g, '—').replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();

    entries[String(cur.num)] = {
      article: String(cur.num),
      title: cur.title,
      text
    };
  }

  assert.equal(Object.keys(entries).length, 37);

  const pack = {
    schemaVersion: 1,
    id: 'bc',
    name: 'Belgic Confession',
    shortName: 'BC',
    year: '1561',
    translation: 'CRCNA/RCA 2011',
    tradition: 'Three Forms of Unity',
    structure: 'article',
    bundled: true,
    custom: false,
    sourceUrl: url,
    externalUrlPattern: 'https://reformedstandards.com/three-forms-of-unity/belgic-confession.html#chapter-{article}',
    aliases: ['Belgic Confession of Faith', 'Belgic Confession'],
    riskyAliases: ['Belgic', 'BC'],
    bounds: { maxNumber: 37 },
    entries
  };

  await fs.writeFile(path.join(OUT_DIR, 'bc.json'), JSON.stringify(pack), 'utf8');
  console.log(`✓ bc.json — 37 articles (CRCNA/RCA 2011)`);
  console.log(`  Sample Art.1: ${entries['1'].title} — ${entries['1'].text.slice(0, 140)}...`);
}

function romanToInt(roman) {
  const map = { I: 1, V: 5, X: 10 };
  const s = roman.trim().toUpperCase();
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]] || 0;
    const next = map[s[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

async function buildDort() {
  const url = 'https://www.crcna.org/welcome/beliefs/confessions/canons-dort';
  const html = await fetchHtml(url);

  const headSpecs = [
    {
      head: '1',
      headingMatch: 'The First Main Point of Doctrine',
      chapterTitle: 'Divine Election and Reprobation',
      expectedArticles: 18,
      expectedRejections: 9
    },
    {
      head: '2',
      headingMatch: 'The Second Main Point of Doctrine',
      chapterTitle: "Christ's Death and Human Redemption Through It",
      expectedArticles: 9,
      expectedRejections: 7
    },
    {
      head: '3/4',
      headingMatch: 'The Third and Fourth Main Points of Doctrine',
      chapterTitle: 'Human Corruption, Conversion to God, and the Way It Occurs',
      expectedArticles: 17,
      expectedRejections: 9
    },
    {
      head: '5',
      headingMatch: 'The Fifth Main Point of Doctrine',
      chapterTitle: 'The Perseverance of the Saints',
      expectedArticles: 15,
      expectedRejections: 9
    }
  ];

  const conclusionIdx = html.indexOf('<h2>Conclusion</h2>') !== -1
    ? html.indexOf('<h2>Conclusion</h2>')
    : html.search(/<h2[^>]*>\s*Conclusion\s*<\/h2>/i);
  assert.ok(conclusionIdx !== -1, 'Could not find Conclusion heading in Dort HTML');

  const positions = headSpecs.map(spec => {
    const idx = html.indexOf(spec.headingMatch);
    assert.ok(idx !== -1, `Could not find "${spec.headingMatch}" in Dort HTML`);
    return { ...spec, idx };
  });

  const chapters = {};
  const entries = {};
  const boundsHeads = {};

  for (let i = 0; i < positions.length; i++) {
    const spec = positions[i];
    const nextIdx = i + 1 < positions.length ? positions[i + 1].idx : conclusionIdx;
    const sectionHtml = html.slice(spec.idx, nextIdx);
    chapters[spec.head] = spec.chapterTitle;

    // Split section into positive Articles and Rejection of the Errors
    const rejHeadingMatch = sectionHtml.match(/<h3[^>]*>\s*Rejection of the Errors[\s\S]*?<\/h3>/i);
    assert.ok(rejHeadingMatch, `Could not find Rejection of the Errors in Dort Head ${spec.head}`);

    const articlesHtml = sectionHtml.slice(0, rejHeadingMatch.index);
    const rejectionsHtml = sectionHtml.slice(rejHeadingMatch.index + rejHeadingMatch[0].length);

    // Parse Articles
    const artRegex = /<h3[^>]*>\s*Article\s+(\d+)\s*:\s*([^<]+)<\/h3>/gi;
    const artMarkers = [];
    let m;
    while ((m = artRegex.exec(articlesHtml)) !== null) {
      artMarkers.push({
        num: Number(m[1]),
        title: decodeEntities(m[2]).trim(),
        index: m.index,
        end: m.index + m[0].length
      });
    }
    assert.equal(artMarkers.length, spec.expectedArticles, `Dort Head ${spec.head} expected ${spec.expectedArticles} articles, got ${artMarkers.length}`);

    for (let j = 0; j < artMarkers.length; j++) {
      const cur = artMarkers[j];
      const endPos = j + 1 < artMarkers.length ? artMarkers[j + 1].index : articlesHtml.length;
      const chunk = articlesHtml.slice(cur.end, endPos);
      const paras = [...chunk.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map(x => stripTags(x[1]))
        .filter(Boolean);
      assert.ok(paras.length > 0, `Dort ${spec.head}.A${cur.num} empty`);
      entries[`${spec.head}.A${cur.num}`] = {
        head: spec.head,
        kind: 'article',
        number: cur.num,
        title: cur.title,
        text: paras.join('\n\n')
      };
    }

    // Parse Rejections (headed by <h4>I</h4>, <h4>II</h4>, etc., or <h4>1</h4>)
    const rejRegex = /<h4[^>]*>\s*(?:Paragraph\s+|Error\s+)?([IVX]+|\d+)\s*<\/h4>/gi;
    const rejMarkers = [];
    while ((m = rejRegex.exec(rejectionsHtml)) !== null) {
      const rawNum = m[1];
      const num = /^\d+$/.test(rawNum) ? Number(rawNum) : romanToInt(rawNum);
      rejMarkers.push({
        num,
        index: m.index,
        end: m.index + m[0].length
      });
    }
    assert.equal(rejMarkers.length, spec.expectedRejections, `Dort Head ${spec.head} expected ${spec.expectedRejections} rejections, got ${rejMarkers.length}`);

    for (let j = 0; j < rejMarkers.length; j++) {
      const cur = rejMarkers[j];
      const endPos = j + 1 < rejMarkers.length ? rejMarkers[j + 1].index : rejectionsHtml.length;
      const chunk = rejectionsHtml.slice(cur.end, endPos);
      const paras = [...chunk.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map(x => stripTags(x[1]))
        .filter(Boolean);
      assert.ok(paras.length > 0, `Dort ${spec.head}.R${cur.num} empty`);
      entries[`${spec.head}.R${cur.num}`] = {
        head: spec.head,
        kind: 'rejection',
        number: cur.num,
        title: `Rejection of Errors — ${spec.chapterTitle}`,
        text: paras.join('\n\n')
      };
    }

    boundsHeads[spec.head] = {
      articles: artMarkers.length,
      rejections: rejMarkers.length
    };
  }

  const pack = {
    schemaVersion: 1,
    id: 'dort',
    name: 'Canons of Dort',
    shortName: 'Dort',
    year: '1619',
    translation: 'CRCNA/RCA 2011',
    tradition: 'Three Forms of Unity',
    structure: 'dort',
    bundled: true,
    custom: false,
    translationSourceUrl: url,
    sourceUrl: 'https://reformedstandards.com/three-forms-of-unity/canons-of-dort.html',
    externalUrlPattern: 'https://reformedstandards.com/three-forms-of-unity/canons-of-dort.html',
    aliases: ['Canons of Dort', 'Canons of Dordrecht', 'CoD'],
    riskyAliases: ['Dort', 'CD'],
    bounds: { heads: boundsHeads },
    chapters,
    entries
  };

  await fs.writeFile(path.join(OUT_DIR, 'dort.json'), JSON.stringify(pack), 'utf8');
  console.log(`✓ dort.json — ${Object.keys(entries).length} entries (CRCNA/RCA 2011)`);
  console.log(`  Sample 1.A1: ${entries['1.A1'].title} — ${entries['1.A1'].text.slice(0, 120)}...`);
  console.log(`  Sample 1.R1: ${entries['1.R1'].text.slice(0, 120)}...`);
}

async function main() {
  console.log('Fetching CRCNA/RCA 2011 Three Forms of Unity...');
  await buildHeidelberg();
  await buildBelgic();
  await buildDort();
  console.log('All 3 CRCNA 2011 packs built and verified.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
