/**
 * Confession Hover — Parser & Schema Unit Tests
 * Run with: node --test tests/parser.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Schema = require('../extension/shared/confession-schema.js');
const Registry = require('../extension/shared/confession-registry.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../extension/data');

test('Core 7 citation formats: single citations across all bundled standards', () => {
  const cases = [
    ['See WCF 1.2 for Scripture authority.', 'wcf', 'WCF 1.2', [{ chapter: 1, start: 2, end: 2 }]],
    ['Compare WCF 1:2 as well.', 'wcf', 'WCF 1.2', [{ chapter: 1, start: 2, end: 2 }]],
    ['Westminster Confession of Faith 3.1 teaches God\'s decree.', 'wcf', 'WCF 3.1', [{ chapter: 3, start: 1, end: 1 }]],
    ['Read HC 26 today.', 'hc', 'HC Q. 26', [{ start: 26, end: 26 }]],
    ['Heidelberg Catechism Q. 26 speaks of Providence.', 'hc', 'HC Q. 26', [{ start: 26, end: 26 }]],
    ['In Lord\'s Day 12 we confess Christ\'s offices.', 'hc', "Heidelberg Catechism — Lord's Day 12", [{ start: 12, end: 12 }]],
    ['Curly quote Lord’s Day 9 is creation.', 'hc', "Heidelberg Catechism — Lord's Day 9", [{ start: 9, end: 9 }]],
    ['WLC 7 describes God.', 'wlc', 'WLC Q. 7', [{ start: 7, end: 7 }]],
    ['WSC 1 is famous.', 'wsc', 'WSC Q. 1', [{ start: 1, end: 1 }]],
    ['Belgic Confession Art. 33 treats sacraments.', 'bc', 'Belgic Confession Art. 33', [{ start: 33, end: 33 }]],
    ['BC Art. 33 works even in strict mode.', 'bc', 'Belgic Confession Art. 33', [{ start: 33, end: 33 }]],
    ['Canons of Dort 1.7 explains election.', 'dort', 'Canons of Dort 1.7', [{ head: '1', kind: 'article', start: 7, end: 7 }]],
    ['See 2LBCF 26.1 on the church.', 'lbcf1689', '2LBCF 26.1', [{ chapter: 26, start: 1, end: 1 }]],
    ['1689 London Baptist Confession 1.1', 'lbcf1689', '2LBCF 1.1', [{ chapter: 1, start: 1, end: 1 }]]
  ];

  for (const [text, expectedDoc, expectedLabel, expectedSegs] of cases) {
    const matches = Registry.findReferencesInText(text, { riskyAliasMode: 'strict' });
    assert.equal(matches.length, 1, `Expected 1 match for "${text}", got ${matches.length}`);
    assert.equal(matches[0].parsed.docId, expectedDoc, `Doc mismatch for "${text}"`);
    assert.equal(matches[0].parsed.canonicalLabel, expectedLabel, `Label mismatch for "${text}"`);
    assert.deepEqual(
      matches[0].parsed.segments.map(({ isWholeChapter, isWholeHead, ...rest }) => rest),
      expectedSegs
    );
  }
});

test('Ranges, comma lists, chained references, Roman numerals, and Dort 3/4 + Rejections', () => {
  // Ranges & lists
  let m = Registry.findReferencesInText('WCF 1.6–8 and HC 26, 27.');
  assert.equal(m.length, 2);
  assert.equal(m[0].parsed.canonicalLabel, 'WCF 1.6–8');
  assert.deepEqual(m[0].parsed.segments, [{ chapter: 1, start: 6, end: 8, isWholeChapter: false }]);
  assert.equal(m[1].parsed.canonicalLabel, 'HC Q. 26, 27');
  assert.deepEqual(m[1].parsed.segments, [{ start: 26, end: 26 }, { start: 27, end: 27 }]);

  // Chained WCF
  m = Registry.findReferencesInText('See WCF 1.2, 4; 2.1 for more.');
  assert.equal(m.length, 2);
  assert.equal(m[0].parsed.canonicalLabel, 'WCF 1.2, 4');
  assert.equal(m[1].parsed.canonicalLabel, 'WCF 2.1');

  // Roman numerals
  m = Registry.findReferencesInText('Compare WCF III.2 and WCF I.ii and Lord\'s Day XII.');
  assert.equal(m.length, 3);
  assert.equal(m[0].parsed.canonicalLabel, 'WCF 3.2');
  assert.equal(m[1].parsed.canonicalLabel, 'WCF 1.2');
  assert.equal(m[2].parsed.canonicalLabel, "Heidelberg Catechism — Lord's Day 12");

  // Canons of Dort 3/4 & Head 5 & Rejection of Errors
  const dortCases = [
    ['Canons of Dort III/IV.3', 'Canons of Dort 3/4.3', { head: '3/4', kind: 'article', start: 3, end: 3 }],
    ['In Reformed theology, Dort 3&4.11 explains grace.', 'Canons of Dort 3/4.11', { head: '3/4', kind: 'article', start: 11, end: 11 }],
    ['CoD 3-4.7', 'Canons of Dort 3/4.7', { head: '3/4', kind: 'article', start: 7, end: 7 }],
    ['Canons of Dort 5.15', 'Canons of Dort 5.15', { head: '5', kind: 'article', start: 15, end: 15 }],
    ['Canons of Dort 1.R.3', 'Canons of Dort 1.R.3', { head: '1', kind: 'rejection', start: 3, end: 3 }],
    ['CoD I.RE.3', 'Canons of Dort 1.R.3', { head: '1', kind: 'rejection', start: 3, end: 3 }],
    ['In Reformed theology, Dort 1, Error 3 rejects Pelagianism.', 'Canons of Dort 1.R.3', { head: '1', kind: 'rejection', start: 3, end: 3 }],
    ['Canons of Dort 3/4.R.4-6', 'Canons of Dort 3/4.R.4–6', { head: '3/4', kind: 'rejection', start: 4, end: 6 }]
  ];

  for (const [text, expectedLabel, expectedSeg] of dortCases) {
    const res = Registry.findReferencesInText(text);
    assert.equal(res.length, 1, `Expected 1 Dort match for "${text}"`);
    assert.equal(res[0].parsed.canonicalLabel, expectedLabel);
    assert.deepEqual(
      { head: res[0].parsed.segments[0].head, kind: res[0].parsed.segments[0].kind, start: res[0].parsed.segments[0].start, end: res[0].parsed.segments[0].end },
      expectedSeg
    );
  }
});

test('Context-aware ambiguity gating and false-positive rejection', () => {
  // Without theological context, bare risky aliases should NOT trigger in context/strict mode
  assert.equal(Registry.findReferencesInText('In BC 33 the Roman legions marched.', { riskyAliasMode: 'context' }).length, 0);
  assert.equal(Registry.findReferencesInText('CD 1.7 is on track 7.', { riskyAliasMode: 'context' }).length, 0);
  assert.equal(Registry.findReferencesInText('LD 12 means something else in gaming.', { riskyAliasMode: 'context' }).length, 0);
  assert.equal(Registry.findReferencesInText('SC 1 and LC 7 are codes.', { riskyAliasMode: 'context' }).length, 0);
  assert.equal(Registry.findReferencesInText('In 1689 26 people met.', { riskyAliasMode: 'context' }).length, 0);

  // WITH theological context, bare risky aliases SHOULD trigger in context mode
  const theoText = 'In our Reformed theology study, compare BC 33 with CD 1.7, LD 12, SC 1, LC 7, and 1689 26.1.';
  const theoMatches = Registry.findReferencesInText(theoText, { riskyAliasMode: 'context' });
  assert.deepEqual(
    theoMatches.map(m => m.parsed.docId),
    ['bc', 'dort', 'hc', 'wsc', 'wlc', 'lbcf1689']
  );

  // Strict mode blocks bare risky aliases even WITH theological context, unless explicit cue like "BC Art. 33"
  const strictMatches = Registry.findReferencesInText(theoText, { riskyAliasMode: 'strict' });
  assert.equal(strictMatches.length, 0);
  assert.equal(
    Registry.findReferencesInText('In Reformed theology, see BC Art. 33 and SC Q. 1.', { riskyAliasMode: 'strict' }).length,
    2
  );

  // Historic era "500 BC 33" must NEVER match even in 'always' mode
  assert.equal(Registry.findReferencesInText('Rome in 500 BC 33 years before.', { riskyAliasMode: 'always' }).length, 0);
  assert.equal(Registry.findReferencesInText('Julius Caesar in 44 BC 12 months later.', { riskyAliasMode: 'always' }).length, 0);

  // Tech ".NET / WCF" pages must suppress WCF false positives unless theological context is also present
  const techText = 'Migrating a WCF 3.5 SOAP ServiceModel endpoint in .NET Framework and C#.';
  assert.equal(Registry.findReferencesInText(techText).length, 0);

  // English pronoun "I" after Heidelberg or Dort must NEVER match
  assert.equal(Registry.findReferencesInText('In Heidelberg I saw a castle.').length, 0);
  assert.equal(Registry.findReferencesInText('At Dort I ate lunch.').length, 0);

  // Out-of-bounds citations must ALL be rejected
  const invalidRefs = [
    'HC 200',
    'HC 0',
    "Lord's Day 53",
    'BC Art. 38',
    'WCF 4.5',       // Ch 4 only has 2 sections!
    'WCF 34.1',      // WCF only has 33 chapters
    'WSC 108',
    'WLC 197',
    '2LBCF 33.1',
    '2LBCF 1.15',    // Ch 1 only has 10 sections
    'Canons of Dort 1.19',
    'Canons of Dort 1.R.10',
    'Canons of Dort 6.1',
    'Dort 1618',     // 4-digit year
    'WCF 1.2.3'      // Semver
  ];
  for (const bad of invalidRefs) {
    assert.equal(Registry.findReferencesInText(bad, { riskyAliasMode: 'always' }).length, 0, `Should reject invalid ref "${bad}"`);
  }
});

test('Bundled data files match expected structure and entry lookups', async () => {
  const files = ['hc.json', 'bc.json', 'dort.json', 'wcf.json', 'wlc.json', 'wsc.json', 'lbcf1689.json'];
  for (const f of files) {
    const raw = await fs.readFile(path.join(DATA_DIR, f), 'utf8');
    const json = JSON.parse(raw);
    assert.ok(json.id && json.entries && Object.keys(json.entries).length > 0, `${f} valid`);
  }

  const dort = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'dort.json'), 'utf8'));
  assert.ok(dort.entries['1.A7'].text.length > 40);
  assert.ok(dort.entries['1.R3'].text.length > 40);
  assert.ok(dort.entries['3/4.A3'].text.length > 40);
  assert.ok(dort.entries['5.A15'].text.length > 40);

  const hc = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'hc.json'), 'utf8'));
  assert.equal(hc.entries['1'].lordDay, 1);
  assert.equal(hc.entries['26'].lordDay, 9);
  assert.equal(hc.entries['129'].lordDay, 52);
});

test('Schema normalizer accepts simple community JSON packs and Creed packs, and Registry dynamically detects them', () => {
  const simpleCommunityPack = Schema.normalizePack({
    id: 'test_catechism',
    name: 'Test Catechism',
    shortName: 'TC',
    aliases: ['Test Catechism', 'TC'],
    structure: 'catechism',
    entries: {
      '1': 'God is sovereign.',
      '2': { question: 'Why?', answer: 'For His glory.' }
    }
  });

  assert.equal(simpleCommunityPack.bounds.maxNumber, 2);
  assert.equal(simpleCommunityPack.entries['1'].answer, 'God is sovereign.');

  const creedPack = Schema.normalizePack({
    Metadata: { Title: "Apostles' Creed", Year: '710', CreedFormat: 'Creed' },
    Data: { Content: 'I believe in God, the Father almighty...' }
  }, {
    id: 'apostles_creed',
    aliases: ["Apostles' Creed", 'Apostles Creed']
  });

  Registry.setCustomPacks([
    Schema.extractPackDescriptor(simpleCommunityPack),
    Schema.extractPackDescriptor(creedPack)
  ]);

  const m1 = Registry.findReferencesInText("Compare TC 2 with the Apostles' Creed.");
  assert.equal(m1.length, 2);
  assert.equal(m1[0].parsed.docId, 'test_catechism');
  assert.equal(m1[1].parsed.docId, 'apostles_creed');

  // Clean up registry state
  Registry.setCustomPacks([]);
});

test('Audit regression: natural-language prose citations, ordinal Dort heads, QA/Paragraph shorthands, and Lord\'s Day + Q&A combos', () => {
  const combo1 = Registry.findReferencesInText('Lord\'s Day 12, Q&A 31 teaches Christ\'s anointing.', { riskyAliasMode: 'strict' });
  assert.deepEqual(combo1.map(m => m.parsed.canonicalLabel), ["Heidelberg Catechism — Lord's Day 12", 'HC Q. 31']);
  assert.deepEqual(combo1.map(m => m.parsed.docId), ['hc', 'hc']);

  const combo2 = Registry.findReferencesInText('See Lord\'s Day 1, Q. 1 for our comfort.', { riskyAliasMode: 'strict' });
  assert.deepEqual(combo2.map(m => m.parsed.canonicalLabel), ["Heidelberg Catechism — Lord's Day 1", 'HC Q. 1']);

  const cases = [
    ['HC QA 1 is beloved.', 'hc', 'HC Q. 1', [{ start: 1, end: 1 }]],
    ['Compare HC A. 26 on providence.', 'hc', 'HC Q. 26', [{ start: 26, end: 26 }]],
    ['Read WCF 1, 2 for the canon.', 'wcf', 'WCF Ch. 1; Ch. 2', [{ chapter: 1, start: 1, end: 10 }, { chapter: 2, start: 1, end: 3 }]],
    ['Read WCF 1, sec. 2 for the canon.', 'wcf', 'WCF 1.2', [{ chapter: 1, start: 2, end: 2 }]],
    ['Read WCF I, 2 for the canon.', 'wcf', 'WCF 1.2', [{ chapter: 1, start: 2, end: 2 }]],
    ['Read WCF I.i on the necessity of Scripture.', 'wcf', 'WCF 1.1', [{ chapter: 1, start: 1, end: 1 }]],
    ['Canons of Dort III-IV, 3 explains human inability.', 'dort', 'Canons of Dort 3/4.3', [{ head: '3/4', kind: 'article', start: 3, end: 3 }]],
    ['Canons of Dort, I, 7 teaches unconditional election.', 'dort', 'Canons of Dort 1.7', [{ head: '1', kind: 'article', start: 7, end: 7 }]],
    ['Canons of Dort, First Head, Article 7 teaches unconditional election.', 'dort', 'Canons of Dort 1.7', [{ head: '1', kind: 'article', start: 7, end: 7 }]],
    ['1689 London Baptist Confession, Chapter 26, Paragraph 1 defines the church.', 'lbcf1689', '2LBCF 26.1', [{ chapter: 26, start: 1, end: 1 }]],
    ['2LBCF 26, par. 1 defines the church.', 'lbcf1689', '2LBCF 26.1', [{ chapter: 26, start: 1, end: 1 }]],
    ['2LBCF 26, para. 1 defines the church.', 'lbcf1689', '2LBCF 26.1', [{ chapter: 26, start: 1, end: 1 }]],
    ['Compare 2LCF 26.1 today.', 'lbcf1689', '2LBCF 26.1', [{ chapter: 26, start: 1, end: 1 }]],
    ['Compare 1689 LBCF 26.1 today.', 'lbcf1689', '2LBCF 26.1', [{ chapter: 26, start: 1, end: 1 }]],
    ['Compare LBCF 1689 26.1 today.', 'lbcf1689', '2LBCF 26.1', [{ chapter: 26, start: 1, end: 1 }]]
  ];

  for (const [text, expectedDoc, expectedLabel, expectedSegs] of cases) {
    const matches = Registry.findReferencesInText(text, { riskyAliasMode: 'strict' });
    assert.equal(matches.length, 1, `Expected 1 match for "${text}", got ${matches.length}`);
    assert.equal(matches[0].parsed.docId, expectedDoc, `Doc mismatch for "${text}"`);
    assert.equal(matches[0].parsed.canonicalLabel, expectedLabel, `Label mismatch for "${text}"`);
    assert.deepEqual(
      matches[0].parsed.segments.map(({ isWholeChapter, isWholeHead, ...rest }) => rest),
      expectedSegs
    );
  }
});

test('Audit regression: 2-tier context gating and false-positive traps', () => {
  const traps = [
    'We drove from Mannheim to Heidelberg 12 km before sunset.',
    'The train leaves Dort 12 minutes after noon.',
    'Enroll in Shorter Catechism 101 class on Tuesdays.',
    'In this reformed toxicology paper, LD 50 indicates lethal dose.',
    'Even when visiting Westminster Abbey, upgrading a .NET WCF 3.5 service requires C# refactoring.',
    'Before flying to Providence, RI we visited the museum exhibit on ancient BC 33 coins.',
    'After beating Assassin\'s Creed Odyssey, disc CD 1.7 failed to load.'
  ];
  for (const trap of traps) {
    const matches = Registry.findReferencesInText(trap, { riskyAliasMode: 'context' });
    assert.equal(matches.length, 0, `Trap should produce 0 matches: "${trap}" (matched: ${matches.map(m => m.matchText).join(', ')})`);
  }

  // Genuine theological prose with Reformed/confessional keywords should activate risky aliases cleanly
  const authenticProse = 'As the Three Forms of Unity teach regarding justification and predestination, see LD 12, BC 33, Dort 1.7, and Heidelberg 26.';
  const authenticMatches = Registry.findReferencesInText(authenticProse, { riskyAliasMode: 'context' });
  assert.deepEqual(
    authenticMatches.map(m => m.parsed.docId),
    ['hc', 'bc', 'dort', 'hc']
  );
});

test('External reformedstandards.com deep-link URLs map accurately for all 7 bundled docs', async () => {
  const docs = {
    wcf: JSON.parse(await fs.readFile(path.join(DATA_DIR, 'wcf.json'), 'utf8')),
    wlc: JSON.parse(await fs.readFile(path.join(DATA_DIR, 'wlc.json'), 'utf8')),
    wsc: JSON.parse(await fs.readFile(path.join(DATA_DIR, 'wsc.json'), 'utf8')),
    hc: JSON.parse(await fs.readFile(path.join(DATA_DIR, 'hc.json'), 'utf8')),
    bc: JSON.parse(await fs.readFile(path.join(DATA_DIR, 'bc.json'), 'utf8')),
    dort: JSON.parse(await fs.readFile(path.join(DATA_DIR, 'dort.json'), 'utf8')),
    lbcf1689: JSON.parse(await fs.readFile(path.join(DATA_DIR, 'lbcf1689.json'), 'utf8'))
  };

  const urlChecks = [
    ['WCF 1.2', docs.wcf, 'https://reformedstandards.com/westminster/wcf.html#article-1-2'],
    ['WCF 1', docs.wcf, 'https://reformedstandards.com/westminster/wcf.html#chapter-1'],
    ['WLC 7', docs.wlc, 'https://reformedstandards.com/westminster/wlc.html#question-7'],
    ['WSC 1', docs.wsc, 'https://reformedstandards.com/westminster/wsc.html#question-1'],
    ['HC 26', docs.hc, 'https://reformedstandards.com/three-forms-of-unity/heidelberg-catechism.html#question-26'],
    ["Lord's Day 12", docs.hc, 'https://reformedstandards.com/three-forms-of-unity/heidelberg-catechism.html#ld-12'],
    ['Belgic Confession Art. 33', docs.bc, 'https://reformedstandards.com/three-forms-of-unity/belgic-confession.html#chapter-33'],
    ['2LBCF 26.1', docs.lbcf1689, 'https://reformedstandards.com/second-london/1689-confession.html#article-26-1'],
    ['2LBCF 26', docs.lbcf1689, 'https://reformedstandards.com/second-london/1689-confession.html#chapter-26'],
    ['Canons of Dort 1.7', docs.dort, 'https://reformedstandards.com/three-forms-of-unity/canons-of-dort.html#article-1-7'],
    ['Canons of Dort 1.R.3', docs.dort, 'https://reformedstandards.com/three-forms-of-unity/canons-of-dort.html#article-r1-3'],
    ['Canons of Dort 3/4.3', docs.dort, 'https://reformedstandards.com/three-forms-of-unity/canons-of-dort.html#article-3-3'],
    ['Canons of Dort 5.15', docs.dort, 'https://reformedstandards.com/three-forms-of-unity/canons-of-dort.html#article-4-15'],
    ['Canons of Dort 5.R.1', docs.dort, 'https://reformedstandards.com/three-forms-of-unity/canons-of-dort.html#article-r4-1'],
    ['Canons of Dort 5', docs.dort, 'https://reformedstandards.com/three-forms-of-unity/canons-of-dort.html#chapter-4']
  ];

  for (const [citation, pack, expectedUrl] of urlChecks) {
    const parsed = Registry.parseSingleReference(citation);
    assert.ok(parsed, `Expected citation to parse: "${citation}"`);
    const actualUrl = Registry.getExternalUrl(pack, parsed);
    assert.equal(actualUrl, expectedUrl, `URL mismatch for "${citation}"`);
  }
});

test('CRCA Book of Order 2022 is bundled, enabled by default, parses citations, and toggles off cleanly', async () => {
  const crca = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'crca_co.json'), 'utf8'));
  assert.equal(crca.id, 'crca_co');
  assert.equal(crca.structure, 'article');
  assert.equal(crca.bounds.maxNumber, 86);
  assert.equal(Object.keys(crca.entries).length, 86);
  for (let i = 1; i <= 86; i++) {
    const entry = crca.entries[String(i)];
    assert.ok(entry && entry.title && entry.text, `Missing or incomplete CRCA article ${i}`);
  }
  assert.ok(crca.entries['3'].text.includes('b. No one shall hold or exercise an office'), 'Article 3 should include clause b.');

  // Enabled by default
  Registry.setDisabledDocs([]);
  assert.ok(Registry.getEnabledDocs().some(d => d.id === 'crca_co'));

  const citations = [
    ['CRCA Book of Order Art. 23', 23, 23],
    ['CRCA Church Order 1', 1, 1],
    ['Church Order Art. 51', 51, 51],
    ['Book of Order Art. 86', 86, 86],
    ['CRCA CO 10-12', 10, 12]
  ];
  for (const [text, start, end] of citations) {
    const parsed = Registry.parseSingleReference(text);
    assert.ok(parsed, `Expected CRCA citation to parse: "${text}"`);
    assert.equal(parsed.docId, 'crca_co');
    assert.equal(parsed.segments[0].start, start);
    assert.equal(parsed.segments[0].end, end);
  }

  // Easy to toggle off
  Registry.setDisabledDocs(['crca_co']);
  assert.equal(Registry.getEnabledDocs().some(d => d.id === 'crca_co'), false);
  assert.equal(Registry.parseSingleReference('CRCA Book of Order Art. 23'), null);
  Registry.setDisabledDocs([]);
});
