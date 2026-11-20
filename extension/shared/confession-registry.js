/**
 * Confession Hover — Document Registry, Catalog, & Context-Aware Citation Parser
 * Zero dependencies. Runs in Content Scripts, Service Worker, and Node tests.
 */
(function (root, factory) {
  const Schema =
    (typeof root !== 'undefined' && root.ConfessionHoverSchema) ||
    (typeof require === 'function' ? require('./confession-schema.js') : null);
  const api = factory(Schema);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.ConfessionHoverRegistry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Schema) {
  'use strict';

  const HEIDELBERG_LORDS_DAYS = (Schema && Schema.HEIDELBERG_LORDS_DAYS) || {
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

  // Bundled Core 7 Standards (0ms offline via extension/data/<id>.json)
  const BUNDLED_DOCS = [
    {
      id: 'hc',
      name: 'Heidelberg Catechism',
      shortName: 'HC',
      year: '1563',
      tradition: 'Three Forms of Unity',
      structure: 'catechism',
      bundled: true,
      dataFile: 'data/hc.json',
      sourceUrl: 'https://reformedstandards.com/three-forms-of-unity/heidelberg-catechism.html',
      externalUrlPattern: 'https://reformedstandards.com/three-forms-of-unity/heidelberg-catechism.html#question-{number}',
      lordsDayUrlPattern: 'https://reformedstandards.com/three-forms-of-unity/heidelberg-catechism.html#ld-{ld}',
      aliases: ['Heidelberg Catechism', 'HC'],
      riskyAliases: ['Heidelberg'],
      lordsDayAliases: ["Lord's Day", 'Lords Day'],
      lordsDayRiskyAliases: ['LD'],
      bounds: { maxNumber: 129, maxLordsDay: 52 },
      lordDays: HEIDELBERG_LORDS_DAYS,
      entryCount: 129
    },
    {
      id: 'bc',
      name: 'Belgic Confession',
      shortName: 'BC',
      year: '1561',
      tradition: 'Three Forms of Unity',
      structure: 'article',
      bundled: true,
      dataFile: 'data/bc.json',
      sourceUrl: 'https://reformedstandards.com/three-forms-of-unity/belgic-confession.html',
      externalUrlPattern: 'https://reformedstandards.com/three-forms-of-unity/belgic-confession.html#chapter-{article}',
      aliases: ['Belgic Confession of Faith', 'Belgic Confession'],
      riskyAliases: ['Belgic', 'BC'],
      bounds: { maxNumber: 37 },
      entryCount: 37
    },
    {
      id: 'dort',
      name: 'Canons of Dort',
      shortName: 'Dort',
      year: '1619',
      tradition: 'Three Forms of Unity',
      structure: 'dort',
      bundled: true,
      dataFile: 'data/dort.json',
      sourceUrl: 'https://reformedstandards.com/three-forms-of-unity/canons-of-dort.html',
      externalUrlPattern: 'https://reformedstandards.com/three-forms-of-unity/canons-of-dort.html',
      aliases: ['Canons of Dort', 'Canons of Dordrecht', 'CoD'],
      riskyAliases: ['Dort', 'CD'],
      bounds: {
        heads: {
          '1': { articles: 18, rejections: 9 },
          '2': { articles: 9, rejections: 7 },
          '3/4': { articles: 17, rejections: 9 },
          '5': { articles: 15, rejections: 9 }
        }
      },
      entryCount: 93
    },
    {
      id: 'wcf',
      name: 'Westminster Confession of Faith',
      shortName: 'WCF',
      year: '1647',
      tradition: 'Westminster Standards',
      structure: 'chapter_section',
      bundled: true,
      dataFile: 'data/wcf.json',
      sourceUrl: 'https://reformedstandards.com/westminster/wcf.html',
      externalUrlPattern: 'https://reformedstandards.com/westminster/wcf.html#article-{chapter}-{section}',
      wholeChapterUrlPattern: 'https://reformedstandards.com/westminster/wcf.html#chapter-{chapter}',
      aliases: ['Westminster Confession of Faith', 'Westminster Confession', 'WCF'],
      riskyAliases: [],
      bounds: {
        chapters: [10,3,8,2,7,6,6,8,5,4,6,1,3,3,6,7,3,4,7,4,8,7,4,6,6,3,5,7,8,4,5,3,3]
      },
      entryCount: 172
    },
    {
      id: 'wlc',
      name: 'Westminster Larger Catechism',
      shortName: 'WLC',
      year: '1647',
      tradition: 'Westminster Standards',
      structure: 'catechism',
      bundled: true,
      dataFile: 'data/wlc.json',
      sourceUrl: 'https://reformedstandards.com/westminster/wlc.html',
      externalUrlPattern: 'https://reformedstandards.com/westminster/wlc.html#question-{number}',
      aliases: ['Westminster Larger Catechism', 'Larger Catechism', 'WLC'],
      riskyAliases: ['LC'],
      bounds: { maxNumber: 196 },
      entryCount: 196
    },
    {
      id: 'wsc',
      name: 'Westminster Shorter Catechism',
      shortName: 'WSC',
      year: '1647',
      tradition: 'Westminster Standards',
      structure: 'catechism',
      bundled: true,
      dataFile: 'data/wsc.json',
      sourceUrl: 'https://reformedstandards.com/westminster/wsc.html',
      externalUrlPattern: 'https://reformedstandards.com/westminster/wsc.html#question-{number}',
      aliases: ['Westminster Shorter Catechism', 'Shorter Catechism', 'WSC'],
      riskyAliases: ['SC'],
      bounds: { maxNumber: 107 },
      entryCount: 107
    },
    {
      id: 'lbcf1689',
      name: '1689 London Baptist Confession',
      shortName: '2LBCF',
      year: '1689',
      tradition: 'Reformed Baptist',
      structure: 'chapter_section',
      bundled: true,
      dataFile: 'data/lbcf1689.json',
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
      riskyAliases: ['LBC', '1689'],
      bounds: {
        chapters: [10,3,7,3,7,5,3,10,5,4,6,1,3,3,5,7,3,4,7,4,3,8,5,3,4,15,2,2,4,8,3,3]
      },
      entryCount: 160
    },
    {
      id: 'crca_co',
      name: 'CRCA Book of Order',
      shortName: 'CRCA BOO',
      year: '2022',
      tradition: 'CRCA',
      structure: 'article',
      bundled: true,
      dataFile: 'data/crca_co.json',
      sourceUrl: '',
      externalUrlPattern: '',
      aliases: [
        'CRCA Book of Order',
        'CRCA Church Order',
        'CRCA Book of Church Order',
        'Church Order of the CRCA',
        'CRCA CO',
        'CRCA BOO'
      ],
      riskyAliases: ['Church Order', 'Book of Order', 'CO', 'BOO'],
      bounds: { maxNumber: 86 },
      entryCount: 86
    }
  ];

  // Curated 1-Click Public Domain Community Packs (hosted by NonlinearFruit/Creeds.json under Unlicense)
  // Pinned to verified immutable commit SHA for long-term stability; excludes copyrighted texts in Creeds.json README.
  const CREEDS_COMMIT_SHA = '2ae21a4c5387ecc91f474c9d3d67c826d2a6b9d5';
  const CREEDS_RAW_BASE = `https://raw.githubusercontent.com/NonlinearFruit/Creeds.json/${CREEDS_COMMIT_SHA}/creeds`;
  const REPO_PACKS_BASE = 'https://raw.githubusercontent.com/Aussie-App-Studio/Confession-Hover/main/community_packs';
  const COMMUNITY_PACK_CATALOG = [
    // Ecumenical Creeds
    {
      id: 'apostles_creed',
      name: "Apostles' Creed",
      shortName: 'Apostles',
      year: 'AD ~710',
      category: 'Ecumenical Creeds',
      tradition: 'Ecumenical Creeds',
      structure: 'creed',
      description: 'Classic baptismal summary of historic Christian faith.',
      url: `${CREEDS_RAW_BASE}/apostles_creed.json`,
      sourceUrl: 'https://www.crcna.org/welcome/beliefs/creeds/apostles-creed',
      aliases: ["Apostles' Creed", 'Apostles Creed', 'Apostolic Creed'],
      riskyAliases: []
    },
    {
      id: 'nicene_creed',
      name: 'Nicene Creed',
      shortName: 'Nicene',
      year: 'AD 381',
      category: 'Ecumenical Creeds',
      tradition: 'Ecumenical Creeds',
      structure: 'creed',
      description: 'Ecumenical confession of the Trinity from Nicaea & Constantinople.',
      url: `${CREEDS_RAW_BASE}/nicene_creed.json`,
      sourceUrl: 'https://www.crcna.org/welcome/beliefs/creeds/nicene-creed',
      aliases: ['Nicene Creed', 'Niceno-Constantinopolitan Creed'],
      riskyAliases: []
    },
    {
      id: 'athanasian_creed',
      name: 'Athanasian Creed',
      shortName: 'Athanasian',
      year: 'AD ~500',
      category: 'Ecumenical Creeds',
      tradition: 'Ecumenical Creeds',
      structure: 'creed',
      description: 'Detailed Trinitarian and Christological confession (Quicunque Vult).',
      url: `${CREEDS_RAW_BASE}/athanasian_creed.json`,
      sourceUrl: 'https://www.crcna.org/welcome/beliefs/creeds/athanasian-creed',
      aliases: ['Athanasian Creed', 'Quicunque Vult'],
      riskyAliases: []
    },
    {
      id: 'chalcedonian_definition',
      name: 'Chalcedonian Definition',
      shortName: 'Chalcedon',
      year: 'AD 451',
      category: 'Ecumenical Creeds',
      tradition: 'Ecumenical Creeds',
      structure: 'creed',
      description: 'Definition of the two natures of Christ in one person.',
      url: `${CREEDS_RAW_BASE}/chalcedonian_definition.json`,
      sourceUrl: 'https://reformedstandards.com/ancient-church/chalcedonian-definition.html',
      aliases: ['Chalcedonian Definition', 'Chalcedonian Creed', 'Definition of Chalcedon'],
      riskyAliases: []
    },

    // Reformed Confessions
    {
      id: 'scots_confession',
      name: 'Scots Confession',
      shortName: 'Scots',
      year: '1560',
      category: 'Reformed Confessions',
      tradition: 'Scottish Reformation',
      structure: 'article',
      description: '25-article confession drafted by John Knox and the Six Johns (modern English, James Bulloch / Book of Confessions).',
      url: `${REPO_PACKS_BASE}/scots_confession.json`,
      sourceUrl: 'https://reformedstandards.com/scottish/scots-confession.html',
      externalUrlPattern: 'https://reformedstandards.com/scottish/scots-confession.html#chapter-{article}',
      aliases: ['Scots Confession', 'Scottish Confession of Faith', 'Scots Confession of 1560'],
      riskyAliases: []
    },
    {
      id: 'second_helvetic',
      name: 'Second Helvetic Confession',
      shortName: '2HC',
      year: '1566',
      category: 'Reformed Confessions',
      tradition: 'Swiss Reformation',
      structure: 'chapter_section',
      description: '30-chapter Reformed confession authored by Heinrich Bullinger.',
      url: `${CREEDS_RAW_BASE}/second_helvetic_confession.json`,
      sourceUrl: 'https://reformedstandards.com/swiss/second-helvetic.html',
      externalUrlPattern: 'https://reformedstandards.com/swiss/second-helvetic.html#chapter-{chapter}',
      aliases: ['Second Helvetic Confession', '2nd Helvetic Confession', 'Second Helvetic'],
      riskyAliases: ['2HC', 'SHC']
    },
    {
      id: 'french_confession',
      name: 'French Confession of Faith',
      shortName: 'French',
      year: '1559',
      category: 'Reformed Confessions',
      tradition: 'French Reformation',
      structure: 'article',
      description: 'Gallican Confession of the French Reformed churches (40 articles).',
      url: `${CREEDS_RAW_BASE}/french_confession_of_faith.json`,
      sourceUrl: 'https://www.ccel.org/ccel/schaff/creeds3.iv.vii.html',
      aliases: ['French Confession of Faith', 'French Confession', 'Gallican Confession'],
      riskyAliases: []
    },
    {
      id: 'first_helvetic',
      name: 'First Helvetic Confession',
      shortName: '1HC',
      year: '1536',
      category: 'Reformed Confessions',
      tradition: 'Swiss Reformation',
      structure: 'article',
      description: 'Joint confession of Swiss Reformed cities (19 articles, modernized spelling).',
      url: `${REPO_PACKS_BASE}/first_helvetic_confession.json`,
      sourceUrl: '',
      aliases: ['First Helvetic Confession', '1st Helvetic Confession', 'First Helvetic'],
      riskyAliases: ['1HC']
    },
    {
      id: 'council_of_orange',
      name: 'Council of Orange',
      shortName: 'Orange',
      year: 'AD 529',
      category: 'Reformed Confessions',
      tradition: 'Early Church',
      structure: 'article',
      description: '25 canons affirming Augustinian doctrines of grace.',
      url: `${CREEDS_RAW_BASE}/council_of_orange.json`,
      sourceUrl: '',
      aliases: ['Council of Orange', 'Second Council of Orange', 'Canons of Orange'],
      riskyAliases: []
    },
    {
      id: 'thirty_nine_articles',
      name: 'Thirty-Nine Articles',
      shortName: '39 Articles',
      year: '1571',
      category: 'Reformed Confessions',
      tradition: 'Anglican Reformation',
      structure: 'article',
      description: '39 Articles of Religion of the Church of England (1571 / BCP).',
      url: `${REPO_PACKS_BASE}/thirty_nine_articles.json`,
      sourceUrl: 'https://anglicansonline.org/basics/thirty-nine_articles.html',
      aliases: ['Thirty-Nine Articles of Religion', 'Thirty-Nine Articles', 'Articles of Religion', '39 Articles'],
      riskyAliases: ['39A']
    },

    // Baptist & Puritan Standards
    {
      id: 'baptist_catechism_1695',
      name: '1695 Baptist Catechism',
      shortName: '1695 BC',
      year: '1695',
      category: 'Baptist & Puritan Standards',
      tradition: 'Reformed Baptist',
      structure: 'catechism',
      description: 'Historic Particular Baptist catechism (114 Q&As).',
      url: `${CREEDS_RAW_BASE}/1695_baptist_catechism.json`,
      sourceUrl: '',
      aliases: ['1695 Baptist Catechism', 'Baptist Catechism'],
      riskyAliases: []
    },
    {
      id: 'keachs_catechism',
      name: "Keach's Catechism",
      shortName: 'Keach',
      year: '1693',
      category: 'Baptist & Puritan Standards',
      tradition: 'Reformed Baptist',
      structure: 'catechism',
      description: 'Benjamin Keach\'s classic Baptist catechism (118 Q&As).',
      url: `${CREEDS_RAW_BASE}/keachs_catechism.json`,
      sourceUrl: 'https://reformedstandards.com/second-london/keach.html',
      externalUrlPattern: 'https://reformedstandards.com/second-london/keach.html#question-{number}',
      aliases: ["Keach's Catechism", 'Keach Catechism', "Benjamin Keach's Catechism"],
      riskyAliases: []
    },
    {
      id: 'puritan_catechism',
      name: "Spurgeon's Puritan Catechism",
      shortName: 'Spurgeon',
      year: '1855',
      category: 'Baptist & Puritan Standards',
      tradition: 'Reformed Baptist',
      structure: 'catechism',
      description: 'Charles Spurgeon\'s 82-question catechism for his congregation.',
      url: `${CREEDS_RAW_BASE}/puritan_catechism.json`,
      sourceUrl: '',
      aliases: ["Spurgeon's Puritan Catechism", 'Puritan Catechism', "Spurgeon's Catechism"],
      riskyAliases: []
    },
    {
      id: 'abstract_of_principles',
      name: 'Abstract of Principles',
      shortName: 'Abstract',
      year: '1858',
      category: 'Baptist & Puritan Standards',
      tradition: 'Southern Baptist',
      structure: 'article',
      description: '20-article founding confession of Southern Baptist Seminary.',
      url: `${CREEDS_RAW_BASE}/abstract_of_principles.json`,
      sourceUrl: 'https://reformedstandards.com/second-london/1858-abstract-of-principles.html',
      externalUrlPattern: 'https://reformedstandards.com/second-london/1858-abstract-of-principles.html#chapter-{article}',
      aliases: ['Abstract of Principles'],
      riskyAliases: []
    },
    {
      id: 'catechism_young_children',
      name: 'Catechism for Young Children',
      shortName: 'CFYC',
      year: '1840',
      category: 'Baptist & Puritan Standards',
      tradition: 'Presbyterian',
      structure: 'catechism',
      description: '145 simple Q&As (First Catechism) introduction to WSC.',
      url: `${CREEDS_RAW_BASE}/catechism_for_young_children.json`,
      sourceUrl: 'https://reformedstandards.com/miscellany/catechism-young-children.html',
      externalUrlPattern: 'https://reformedstandards.com/miscellany/catechism-young-children.html#question-{number}',
      aliases: ['Catechism for Young Children', 'First Catechism', "Children's Catechism"],
      riskyAliases: ['CFYC']
    }
  ];

  // Runtime active registry state
  let customDocs = [];
  let disabledDocIds = new Set();

  // Derived lookup caches (rebuilt lazily when docs change)
  let _cacheDirty = true;
  let _allDocs = [];
  let _docById = new Map();
  let _aliasLookup = new Map();       // normalizedAlias -> { doc, isRisky, isLordsDay }
  let _numberedRegex = null;
  let _creedRegex = null;
  let _chainRegex = null;
  let _probeDocRegex = null;

  function normalizeAliasKey(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[\u2018\u2019\u02BC]/g, "'")
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function invalidateCache() {
    _cacheDirty = true;
    _numberedRegex = null;
    _creedRegex = null;
    _chainRegex = null;
    _probeDocRegex = null;
  }

  function setCustomPacks(descriptors) {
    customDocs = Array.isArray(descriptors) ? descriptors.filter(d => d && d.id) : [];
    invalidateCache();
  }

  function setDisabledDocs(ids) {
    disabledDocIds = new Set(Array.isArray(ids) ? ids : []);
    invalidateCache();
  }

  function getAllDocs() {
    const map = new Map();
    for (const d of BUNDLED_DOCS) map.set(d.id, d);
    for (const d of customDocs) map.set(d.id, d);
    return Array.from(map.values());
  }

  function getEnabledDocs() {
    return getAllDocs().filter(d => !disabledDocIds.has(d.id));
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function aliasToRegexPattern(alias) {
    // Allow optional curly/straight apostrophe and flexible whitespace
    const normalized = alias.replace(/[\u2018\u2019\u02BC]/g, "'");
    let pat = '';
    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized[i];
      if (ch === "'") {
        pat += "['\\u2018\\u2019]?";
      } else if (ch === ' ') {
        pat += '\\s+';
      } else {
        pat += escapeRegex(ch);
      }
    }
    return pat;
  }

  function ensureBuilt() {
    if (!_cacheDirty) return;
    _cacheDirty = false;

    _allDocs = getEnabledDocs();
    _docById = new Map();
    _aliasLookup = new Map();

    const numberedAliases = [];
    const creedAliases = [];

    for (const doc of _allDocs) {
      _docById.set(doc.id, doc);

      const addAlias = (alias, isRisky, isLordsDay) => {
        const key = normalizeAliasKey(alias);
        if (!key) return;
        const entry = { doc, isRisky: Boolean(isRisky), isLordsDay: Boolean(isLordsDay), raw: alias };
        // Prefer non-risky if duplicate key exists
        const existing = _aliasLookup.get(key);
        if (!existing || (existing.isRisky && !entry.isRisky)) {
          _aliasLookup.set(key, entry);
        }
        if (doc.structure === 'creed') {
          creedAliases.push(alias);
        } else {
          numberedAliases.push(alias);
        }
      };

      for (const a of doc.aliases || []) addAlias(a, false, false);
      for (const a of doc.riskyAliases || []) addAlias(a, true, false);
      for (const a of doc.lordsDayAliases || []) addAlias(a, false, true);
      for (const a of doc.lordsDayRiskyAliases || []) addAlias(a, true, true);
    }

    const sortLongestFirst = (arr) =>
      Array.from(new Set(arr)).sort((a, b) => b.length - a.length);

    const DASH = '[-\\u2013\\u2014\\u2212]';
    // Strict Roman numerals 1..399 (excludes invalid combos like "LC", "VL", etc.)
    const STRICT_ROMAN = '(?:C{1,3}(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})|(?:XC|XL|L?X{1,3})(?:IX|IV|V?I{0,3})|L(?:IX|IV|V?I{0,3})|(?:IX|IV|V?I{1,3}|V))';
    const NUM_OR_ROMAN = `(?:\\d{1,3}|${STRICT_ROMAN})`;
    const ORDINAL_HEAD = '(?:First|1st|Second|2nd|Third(?:\\s*(?:&|and|/|\\u2013|-)\\s*Fourth)?|3rd|Fourth|4th|Fifth|5th)\\s+Head';
    // Dort head: 1, 2, 3/4, 3&4, 3-4, 5, I, II, III/IV, III-IV, V, or "First Head"
    const HEAD_OR_NUM = `(?:${ORDINAL_HEAD}|(?:3\\s*[/&-]\\s*4|III\\s*[/&-]\\s*IV)|${NUM_OR_ROMAN})`;
    // Optional structural marker directly after a doc alias (e.g. "HC Lord's Day 12", "HC Q&A 26", "BC Art. 33")
    const STRUCT_MARKER =
      "(?:(?:Lord['\\u2018\\u2019]?s\\s+Day|Lords\\s+Day|LD|Head|Chapters?|Chaps?\\.?|Ch\\.?|Paragraphs?|Paras?\\.?|Pars?\\.?|Articles?|Arts?\\.?|Questions?|Q\\.?\\s*&\\s*A\\.?|Q\\.?\\s*\\/\\s*A\\.?|Q\\.?\\s*A\\.?|Q\\.?|A\\.|Errors?|Rejections?|RE|R)\\s*)";
    // Optional sub-marker inside a citation: e.g. "WCF ch. 1, sec. 2", "2LBCF 26, par. 1", "Dort 1, Error 3", "CD 1.R.3"
    const SEP_PART =
      '(?:[:.]\\s*(?:(?:Sections?|Secs?\\.?|Paragraphs?|Paras?\\.?|Pars?\\.?|P\\.?|S\\.?|Articles?|Arts?\\.?|Rejections?|Errors?|RE|R|E|A)\\s*[:.]?\\s*)?|\\s*[,;]?\\s*(?:Sections?|Secs?\\.?|Paragraphs?|Paras?\\.?|Pars?\\.?|P\\.?|Articles?|Arts?\\.?|Rejections?|Errors?|RE|R)\\s*[:.]?\\s*)';

    const SINGLE_ITEM = `${HEAD_OR_NUM}(?:${SEP_PART}${NUM_OR_ROMAN})?(?:\\s*${DASH}\\s*${HEAD_OR_NUM}(?:${SEP_PART}${NUM_OR_ROMAN})?)?`;
    // Continuation after a comma: numeric/dotted items or explicit section/paragraph/article/rejection cue (never swallow another doc alias)
    const SUB_CUE = '(?:(?:Sections?|Secs?\\.?|Paragraphs?|Paras?\\.?|Pars?\\.?|Articles?|Arts?\\.?|Rejections?|Errors?)\\s*[:.]?\\s*)?';
    const SAFE_COMMA_TAIL = `(?:\\s*,\\s*(?!1689\\s+\\d+[:.])${SUB_CUE}\\d{1,3}(?:[:.]\\d{1,3})?(?:\\s*${DASH}\\s*\\d{1,3}(?:[:.]\\d{1,3})?)?)*`;
    const SPEC_GROUP = `((?:${STRUCT_MARKER})?${SINGLE_ITEM}${SAFE_COMMA_TAIL})`;

    if (numberedAliases.length > 0) {
      const escapedNumbered = sortLongestFirst(numberedAliases).map(aliasToRegexPattern);
      _numberedRegex = new RegExp(
        `(?<![\\p{L}\\p{N}_])((?:${escapedNumbered.join('|')})\\.?(?:\\s*[,:])?)\\s+${SPEC_GROUP}(?![\\p{L}\\p{N}])`,
        'giu'
      );
      _probeDocRegex = new RegExp(`^(?:${escapedNumbered.join('|')})(?:\\.?\\s|\\b)`, 'iu');
    }

    if (creedAliases.length > 0) {
      const escapedCreeds = sortLongestFirst(creedAliases).map(aliasToRegexPattern);
      _creedRegex = new RegExp(
        `(?<![\\p{L}\\p{N}_])(${escapedCreeds.join('|')})(?![\\p{L}\\p{N}_])`,
        'giu'
      );
    }

    // Chained continuation immediately after a matched reference: e.g., ", 27" or "; 2.1" or ", 4-5"
    _chainRegex = new RegExp(
      `^(\\s*(?:([,;])\\s*)?(?:(?:and|&|cf\\.?|see\\s+also)\\s+)?)${SPEC_GROUP}(?![\\p{L}\\p{N}])`,
      'iu'
    );
  }

  // Roman numeral parser (1..399) with anti-pronoun guards
  const ROMAN_MAP = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  function romanToInt(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const s = raw.toUpperCase();
    if (!/^(?:C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/.test(s) || s.length === 0) {
      return null;
    }
    let total = 0;
    for (let i = 0; i < s.length; i++) {
      const cur = ROMAN_MAP[s[i]];
      const next = i + 1 < s.length ? ROMAN_MAP[s[i + 1]] : 0;
      if (cur < next) total -= cur;
      else total += cur;
    }
    return total > 0 ? total : null;
  }

  function parseNumberToken(token, allowBareSingleI, allowLowercaseI = false) {
    if (!token) return null;
    const trimmed = token.trim();
    if (/^\d{1,3}$/.test(trimmed)) {
      return { value: parseInt(trimmed, 10), isRoman: false };
    }
    if (/^[IVXLC]{1,7}$/i.test(trimmed)) {
      // Guard against English pronoun "I" unless explicitly allowed (and disallow bare lowercase "i" unless explicitly flagged after ".")
      if (trimmed.toLowerCase() === 'i' && (!allowBareSingleI || (trimmed === 'i' && !allowLowercaseI))) {
        return null;
      }
      // Single-letter lowercase Roman (v, x, l, c) shouldn't match without structural context
      if (trimmed.length === 1 && trimmed === trimmed.toLowerCase() && !allowBareSingleI && !allowLowercaseI) {
        return null;
      }
      const val = romanToInt(trimmed);
      return val !== null ? { value: val, isRoman: true } : null;
    }
    return null;
  }

  // 2-tier Context Analyzer for smart ambiguity gating:
  // Strong phrases immediately indicate theological/confessional content; weak single words require >= 2 distinct hits.
  const STRONG_THEO_CONTEXT_REGEX =
    /\b(?:heidelberg\s+catechism|westminster\s+(?:confession|catechism|shorter|larger|standards|divines)|belgic\s+confession|canons\s+of\s+dort|london\s+baptist\s+confession|three\s+forms\s+of\s+unity|christian\s+reformed\s+churches\s+of\s+australia|crca|catechism(?:s)?|predestination|sanctification|covenant\s+theology|reformed\s+theology|sola\s+(?:scriptura|fide|gratia)|christology|soteriology|ecclesiology|lord['’]?s\s+day\s+\d|confessional\s+reformed|2lbcf|2lcf|wsc|wlc)\b/i;

  const WEAK_THEO_CONTEXT_REGEX =
    /\b(?:reformed|confession(?:s|al)?|calvin(?:ist|ism)?|reformation|synod|sacrament(?:s)?|scripture(?:s)?|gospel|trinity|providence|baptist|presbyterian|puritan|creed(?:s)?|justification|atonement|election|regeneration|theology|theological|pastor|sermon|homily|ecumenical)\b/gi;

  const TECH_WCF_REGEX =
    /(?:(?<![\w])\.net\b|\bc#(?![\w#])|\b(?:dotnet|csharp|wcf\s+service|windows\s+communication\s+foundation|soap|wsdl|servicemodel|endpoint|datacontract|aspnet|asp\.net|visual\s+studio|microsoft|iis|binding)\b)/i;

  function normalizeWeakStem(word) {
    const w = word.toLowerCase();
    if (w.startsWith('confess')) return 'confess';
    if (w.startsWith('calvin')) return 'calvin';
    if (w.startsWith('reform')) return 'reform';
    if (w.startsWith('sacrament')) return 'sacrament';
    if (w.startsWith('scripture')) return 'scripture';
    if (w.startsWith('creed')) return 'creed';
    if (w.startsWith('theolog')) return 'theolog';
    return w;
  }

  function analyzePageContext(sampleText) {
    const str = String(sampleText || '');
    let hasTheologicalContext = STRONG_THEO_CONTEXT_REGEX.test(str);
    if (!hasTheologicalContext) {
      const hits = new Set();
      WEAK_THEO_CONTEXT_REGEX.lastIndex = 0;
      let m;
      while ((m = WEAK_THEO_CONTEXT_REGEX.exec(str)) !== null) {
        hits.add(normalizeWeakStem(m[0]));
        if (hits.size >= 2) {
          hasTheologicalContext = true;
          break;
        }
      }
    }
    return {
      hasTheologicalContext,
      hasTechWcfContext: TECH_WCF_REGEX.test(str)
    };
  }

  function getDocById(id) {
    ensureBuilt();
    return _docById.get(id) || getAllDocs().find(d => d.id === id) || null;
  }

  function resolveAlias(rawAlias) {
    ensureBuilt();
    // Strip trailing punctuation like "." or ":" or ","
    const cleaned = rawAlias.replace(/[\s.,:]+$/g, '');
    return _aliasLookup.get(normalizeAliasKey(cleaned)) || null;
  }

  function hasStructuralCue(rawAlias, rawSpec) {
    if (/(?:Lord['’]?s\s+Day|Lords\s+Day|Head|Chapters?|Chaps?\.?|Ch\.?|Paragraphs?|Paras?\.?|Pars?\.?|Articles?|Arts?\.?|Questions?|Q\.?\s*&?\s*A\.?|Q\.?\s*\/\s*A\.?|Q\.?\s*A\.?|Q\.|A\.|Errors?|Rejections?|RE|R|Secs?\.?|Sections?)/i.test(rawSpec)) {
      return true;
    }
    if (/\.$/.test(rawAlias.trim())) return true;
    if (/3\s*[/&-]\s*4|III\s*[/&-]\s*IV/i.test(rawSpec)) return true;
    if (/^\s*Q\d+/i.test(rawSpec)) return true;
    return false;
  }

  function hasChapterSectionSeparator(spec) {
    return /\d\s*[:.]\s*\d|[IVXLC]\s*[:.]\s*(?:\d|[IVXLC])/i.test(spec);
  }

  function normalizeDortHead(headStr) {
    const raw = String(headStr || '').trim();
    if (/^(?:First|1st)\s+Head$/i.test(raw)) return '1';
    if (/^(?:Second|2nd)\s+Head$/i.test(raw)) return '2';
    if (/^(?:Third(?:\s*(?:&|and|\/|–|-)\s*Fourth)?|3rd|Fourth|4th)\s+Head$/i.test(raw)) return '3/4';
    if (/^(?:Fifth|5th)\s+Head$/i.test(raw)) return '5';

    const clean = raw.replace(/\s+/g, '').toUpperCase();
    if (clean === '3/4' || clean === '3&4' || clean === '3-4' || clean === 'III/IV' || clean === 'III&IV' || clean === 'III-IV') {
      return '3/4';
    }
    const parsed = parseNumberToken(clean, true);
    if (!parsed) return null;
    if (parsed.value === 3 || parsed.value === 4) return '3/4';
    if (parsed.value === 1) return '1';
    if (parsed.value === 2) return '2';
    if (parsed.value === 5) return '5';
    return null;
  }

  function parseDortSpec(doc, rawSpec, hasCue) {
    const headsBounds = (doc.bounds && doc.bounds.heads) || {};
    const parts = rawSpec.split(/\s*,\s*/);
    const segments = [];
    let currentHead = null;
    let currentKind = 'article';

    const headOnlyRegex =
      /^(?:(?:Head\s*)?(?:3\s*[/&-]\s*4|III\s*[/&-]\s*IV|\d{1,2}|[IVXLC]{1,5})|(?:First|1st|Second|2nd|Third(?:\s*(?:&|and|\/|–|-)\s*Fourth)?|3rd|Fourth|4th|Fifth|5th)\s+Head)$/i;

    // Merge "Dort 1, Error 3", "Canons of Dort, I, 7", "Canons of Dort III-IV, 3", "Canons of Dort, First Head, Article 7"
    const mergedParts = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      if (!p) continue;
      if (
        i === 0 &&
        parts.length >= 2 &&
        headOnlyRegex.test(p) &&
        (/^(?:Articles?|Arts?\.?|Rejections?|Errors?|RE|R)\s*\.?\s*/i.test(parts[1].trim()) || /^\d{1,2}(?:\s*[-–—−]\s*\d{1,2})?$/.test(parts[1].trim()))
      ) {
        mergedParts.push(`${p} ${parts[1].trim()}`);
        i++;
      } else {
        mergedParts.push(p);
      }
    }

    for (const part of mergedParts) {
      const m = part.match(
        /^(?:Head\s*)?((?:First|1st|Second|2nd|Third(?:\s*(?:&|and|\/|–|-)\s*Fourth)?|3rd|Fourth|4th|Fifth|5th)\s+Head|3\s*[/&-]\s*4|III\s*[/&-]\s*IV|\d{1,3}|[IVXLC]{1,5})(?:\s*(?:[:.]|\s+,?)\s*(?:(Articles?|Arts?\.?|A|Rejections?(?:\s+of\s+Errors)?|Errors?|RE|R|E)\s*[:.]?\s*)?(\d{1,3}|[IVXLC]{1,5})(?:\s*[-–—−]\s*(\d{1,3}|[IVXLC]{1,5}))?)?$/i
      );

      if (m && !/^(?:Articles?|Arts?\.?|Rejections?|Errors?|RE|R|E)\b/i.test(part)) {
        const headKey = normalizeDortHead(m[1]);
        if (!headKey || !headsBounds[headKey]) return null;
        const headBound = headsBounds[headKey];

        const kindToken = (m[2] || '').toUpperCase();
        const isRejection = /^R|^E/i.test(kindToken);
        const kind = isRejection ? 'rejection' : 'article';

        if (!m[3]) {
          if (m[2]) return null;
          if (/^I$/i.test(m[1]) && !hasCue) return null;
          segments.push({
            head: headKey,
            kind: 'all',
            start: 1,
            end: headBound.articles || 1,
            isWholeHead: true
          });
          currentHead = headKey;
          currentKind = 'article';
          continue;
        }

        const n1 = parseNumberToken(m[3], true, true);
        const n2 = m[4] ? parseNumberToken(m[4], true, true) : n1;
        if (!n1 || !n2) return null;
        const maxAllowed = kind === 'rejection' ? headBound.rejections : headBound.articles;
        if (!maxAllowed || n1.value < 1 || n1.value > maxAllowed || n2.value < n1.value || n2.value > maxAllowed) {
          return null;
        }

        segments.push({ head: headKey, kind, start: n1.value, end: n2.value, isWholeHead: false });
        currentHead = headKey;
        currentKind = kind;
        continue;
      }

      if (currentHead && headsBounds[currentHead]) {
        const cm = part.match(
          /^(?:(Articles?|Arts?\.?|A|Rejections?|Errors?|RE|R|E)\s*[:.]?\s*)?(\d{1,3}|[IVXLC]{1,5})(?:\s*[-–—−]\s*(\d{1,3}|[IVXLC]{1,5}))?$/i
        );
        if (!cm) return null;
        const kind = cm[1] ? (/^R|^E/i.test(cm[1]) ? 'rejection' : 'article') : currentKind;
        const n1 = parseNumberToken(cm[2], true, true);
        const n2 = cm[3] ? parseNumberToken(cm[3], true, true) : n1;
        if (!n1 || !n2) return null;
        const maxAllowed = kind === 'rejection' ? headsBounds[currentHead].rejections : headsBounds[currentHead].articles;
        if (!maxAllowed || n1.value < 1 || n1.value > maxAllowed || n2.value < n1.value || n2.value > maxAllowed) {
          return null;
        }
        segments.push({ head: currentHead, kind, start: n1.value, end: n2.value, isWholeHead: false });
        currentKind = kind;
        continue;
      }

      return null;
    }

    if (segments.length === 0) return null;
    return segments;
  }

  function parseChapterSectionSpec(doc, rawSpec, hasCue) {
    const chBounds = (doc.bounds && doc.bounds.chapters) || [];
    if (chBounds.length === 0) return null;

    const parts = rawSpec.split(/\s*,\s*/);
    const segments = [];
    let currentChapter = null;

    // Merge "Ch. 1, Sec. 2", "Chapter 26, Paragraph 1", "26, par. 1", or "I, 2" (Roman chapter + Arabic section)
    const mergedParts = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      if (!p) continue;
      if (i === 0 && parts.length >= 2) {
        const nextP = parts[1].trim();
        const isChHead = /^(?:Chapters?|Chaps?\.?|Ch\.?)?\s*(?:\d{1,3}|[IVXLC]{1,7})$/i.test(p);
        const isRomanHead = /^(?:Chapters?|Chaps?\.?|Ch\.?)?\s*[IVXLC]{1,7}$/i.test(p);
        const isExplicitSub = /^(?:Sections?|Secs?\.?|Paragraphs?|Paras?\.?|Pars?\.?|P\.?|S\.?)\s*\d/i.test(nextP);
        const isBareDigits = /^\d{1,3}(?:\s*[-–—−]\s*\d{1,3})?$/.test(nextP);
        if (isChHead && (isExplicitSub || (isRomanHead && isBareDigits))) {
          mergedParts.push(`${p} ${nextP}`);
          i++;
          continue;
        }
      }
      mergedParts.push(p);
    }

    for (const part of mergedParts) {
      // Chapter.Section or Chapter:Section or "Ch. 1 Sec. 2-4" or "Chapter 26 Paragraph 1"
      const csMatch = part.match(
        /^(?:Chapters?|Chaps?\.?|Ch\.?)?\s*(\d{1,3}|[IVXLC]{1,7})\s*(?:[:.]\s*(?:Sections?|Secs?\.?|Paragraphs?|Paras?\.?|Pars?\.?|P\.?|S\.?)?\s*|\s+(?:Sections?|Secs?\.?|Paragraphs?|Paras?\.?|Pars?\.?|P\.?|S\.?)?\s*[:.]?\s*)(\d{1,3}|[IVXLC]{1,7})(?:\s*[-–—−]\s*(\d{1,3}|[IVXLC]{1,7}))?$/i
      );
      if (csMatch) {
        const ch = parseNumberToken(csMatch[1], true);
        const s1 = parseNumberToken(csMatch[2], true, true);
        const s2 = csMatch[3] ? parseNumberToken(csMatch[3], true, true) : s1;
        if (!ch || !s1 || !s2) return null;
        if (ch.value < 1 || ch.value > chBounds.length) return null;
        const maxSec = chBounds[ch.value - 1] || 0;
        if (s1.value < 1 || s1.value > maxSec || s2.value < s1.value || s2.value > maxSec) return null;

        segments.push({ chapter: ch.value, start: s1.value, end: s2.value, isWholeChapter: false });
        currentChapter = ch.value;
        continue;
      }

      // Bare number or range
      const bareMatch = part.match(
        /^(?:(?:Chapters?|Chaps?\.?|Ch\.?|Sections?|Secs?\.?|Paragraphs?|Paras?\.?|Pars?\.?)\s*)?(\d{1,3}|[IVXLC]{1,7})(?:\s*[-–—−]\s*(\d{1,3}|[IVXLC]{1,7}))?$/i
      );
      if (bareMatch) {
        const isExplicitSub = /^(?:Sections?|Secs?\.?|Paragraphs?|Paras?\.?|Pars?\.?)/i.test(part);
        const hasPrefix = /^(?:Chapters?|Chaps?\.?|Ch\.?|Sections?|Secs?\.?|Paragraphs?|Paras?\.?|Pars?\.?)/i.test(part);
        const n1 = parseNumberToken(bareMatch[1], hasPrefix || hasCue);
        const n2 = bareMatch[2] ? parseNumberToken(bareMatch[2], hasPrefix || hasCue) : n1;
        if (!n1 || !n2) return null;

        const prevWasWholeChapter = segments.length > 0 && segments[segments.length - 1].isWholeChapter;
        if (currentChapter !== null && !/^(?:Chapters?|Chaps?\.?|Ch\.?)/i.test(part) && (!prevWasWholeChapter || isExplicitSub)) {
          const maxSec = chBounds[currentChapter - 1] || 0;
          if (n1.value < 1 || n1.value > maxSec || n2.value < n1.value || n2.value > maxSec) return null;
          segments.push({ chapter: currentChapter, start: n1.value, end: n2.value, isWholeChapter: false });
        } else {
          // Whole chapter (single chapter only, not range like "WCF 1-3")
          if (bareMatch[2]) return null;
          if (n1.value < 1 || n1.value > chBounds.length) return null;
          const maxSec = chBounds[n1.value - 1] || 0;
          segments.push({ chapter: n1.value, start: 1, end: maxSec, isWholeChapter: true });
          currentChapter = n1.value;
        }
        continue;
      }

      return null;
    }

    return segments.length > 0 ? segments : null;
  }

  function parseSingleDimSpec(doc, rawSpec, isLordsDayMode, hasCue) {
    const maxNum = isLordsDayMode
      ? (doc.bounds && doc.bounds.maxLordsDay) || 52
      : (doc.bounds && doc.bounds.maxNumber) || 1;

    const cleaned = rawSpec
      .replace(/^(?:Lord['’]?s\s+Day|Lords\s+Day|LD|Articles?|Arts?\.?|Questions?|Q\.?\s*&\s*A\.?|Q\.?\s*\/\s*A\.?|Q\.?\s*A\.?|Q\.?|A\.)\s*/i, '')
      .trim();
    if (!cleaned) return null;

    const parts = cleaned.split(/\s*,\s*/);
    const segments = [];

    for (const part of parts) {
      const p = part
        .trim()
        .replace(/^(?:Questions?|Q\.?\s*&\s*A\.?|Q\.?\s*\/\s*A\.?|Q\.?\s*A\.?|Q\.?|A\.|Articles?|Arts?\.?|Lord['’]?s\s+Day|LD)\s*/i, '')
        .trim();
      const m = p.match(/^(\d{1,3}|[IVXLC]{1,7})(?:\s*[-–—−]\s*(\d{1,3}|[IVXLC]{1,7}))?$/i);
      if (!m) return null;

      const n1 = parseNumberToken(m[1], hasCue || isLordsDayMode);
      const n2 = m[2] ? parseNumberToken(m[2], hasCue || isLordsDayMode) : n1;
      if (!n1 || !n2) return null;
      if (n1.value < 1 || n1.value > maxNum || n2.value < n1.value || n2.value > maxNum) return null;

      segments.push({ start: n1.value, end: n2.value });
    }

    return segments.length > 0 ? segments : null;
  }

  function formatCanonicalLabel(doc, mode, segments) {
    if (doc.structure === 'creed') return doc.name;
    if (!segments || segments.length === 0) return doc.shortName || doc.name;

    if (mode === 'lords_day') {
      const labels = segments.map(s => (s.start === s.end ? `${s.start}` : `${s.start}–${s.end}`));
      return `Heidelberg Catechism — Lord's Day ${labels.join(', ')}`;
    }

    if (doc.structure === 'catechism') {
      const labels = segments.map(s => (s.start === s.end ? `${s.start}` : `${s.start}–${s.end}`));
      return `${doc.shortName} Q. ${labels.join(', ')}`;
    }

    if (doc.structure === 'article') {
      const labels = segments.map(s => (s.start === s.end ? `${s.start}` : `${s.start}–${s.end}`));
      return `${doc.name} Art. ${labels.join(', ')}`;
    }

    if (doc.structure === 'dort') {
      const parts = segments.map(s => {
        if (s.isWholeHead) return `${s.head}`;
        const range = s.start === s.end ? `${s.start}` : `${s.start}–${s.end}`;
        return s.kind === 'rejection' ? `${s.head}.R.${range}` : `${s.head}.${range}`;
      });
      return `Canons of Dort ${parts.join(', ')}`;
    }

    if (doc.structure === 'chapter_section') {
      const parts = [];
      let lastCh = null;
      for (const s of segments) {
        if (s.isWholeChapter) {
          parts.push(`Ch. ${s.chapter}`);
          lastCh = s.chapter;
          continue;
        }
        const range = s.start === s.end ? `${s.start}` : `${s.start}–${s.end}`;
        if (s.chapter === lastCh) {
          parts[parts.length - 1] += `, ${range}`;
        } else {
          parts.push(`${s.chapter}.${range}`);
          lastCh = s.chapter;
        }
      }
      return `${doc.shortName} ${parts.join('; ')}`;
    }

    return doc.name;
  }

  function parseAndValidateSpec(doc, rawAlias, rawSpec, isLordsDayAlias, options) {
    const opts = options || {};
    const isLordsDay =
      doc.id === 'hc' &&
      (isLordsDayAlias || /^(?:Lord['’]?s\s+Day|Lords\s+Day|LD)\b/i.test(rawSpec.trim()));

    const hasCue = hasStructuralCue(rawAlias, rawSpec);
    const cleanAlias = normalizeAliasKey(rawAlias);

    // Pure numeric aliases (like "1689") require explicit chapter.section separator (e.g. "1689 26.1")
    if (/^\d+$/.test(cleanAlias) && !hasChapterSectionSeparator(rawSpec)) {
      return null;
    }

    // Ambiguity gating for risky aliases & WCF tech collisions
    const mode = opts.riskyAliasMode || 'context'; // 'context' | 'strict' | 'always'
    const pageContext = opts.pageContext || {};
    const isRisky = Boolean(opts.isRisky);

    if (doc.id === 'wcf' && pageContext.hasTechWcfContext && !pageContext.hasTheologicalContext) {
      return null;
    }

    if (isRisky) {
      // Never match bare "I" or ambiguous single word on risky aliases
      if (/^[a-z]{1,4}$/i.test(cleanAlias) && /^[IVXLC]+$/i.test(rawSpec.trim()) && !hasCue) {
        return null;
      }
      if (mode === 'strict' && !hasCue) {
        return null;
      }
      if (mode === 'context' && !hasCue && !pageContext.hasTheologicalContext) {
        return null;
      }
    }

    let segments = null;
    if (doc.structure === 'dort') {
      segments = parseDortSpec(doc, rawSpec, hasCue);
    } else if (doc.structure === 'chapter_section') {
      segments = parseChapterSectionSpec(doc, rawSpec, hasCue);
    } else {
      segments = parseSingleDimSpec(doc, rawSpec, isLordsDay, hasCue);
    }

    if (!segments) return null;

    const refMode = isLordsDay ? 'lords_day' : doc.structure;
    return {
      docId: doc.id,
      docName: doc.name,
      shortName: doc.shortName,
      structure: doc.structure,
      mode: refMode,
      segments,
      canonicalLabel: formatCanonicalLabel(doc, refMode, segments)
    };
  }

  /**
   * Scans plain text and returns validated confession/catechism/creed matches:
   * [{ startIndex, endIndex, matchText, parsed, isRisky }]
   */
  function findReferencesInText(text, options = {}) {
    if (!text || text.length < 4) return [];
    ensureBuilt();

    const opts = {
      riskyAliasMode: options.riskyAliasMode || 'context',
      pageContext: options.pageContext || analyzePageContext(text),
      ignoreRiskyGate: Boolean(options.ignoreRiskyGate)
    };

    const rawMatches = [];

    // Pass 1: Numbered documents (Confessions, Catechisms, Canons of Dort, Lord's Days)
    if (_numberedRegex) {
      _numberedRegex.lastIndex = 0;
      let match;
      while ((match = _numberedRegex.exec(text)) !== null) {
        const fullMatch = match[0];
        const rawAlias = match[1];
        const rawSpec = match[2];
        const startIndex = match.index;
        const endIndex = startIndex + fullMatch.length;

        const aliasEntry = resolveAlias(rawAlias);
        if (!aliasEntry) continue;

        // Guard against "500 BC 33" / "44 BC. 12" / "AD 33" / "BCE"
        if (aliasEntry.isRisky && normalizeAliasKey(rawAlias) === 'bc') {
          const prefixSlice = text.slice(Math.max(0, startIndex - 16), startIndex);
          if (/(?:\d|AD|BCE?)\s*$/i.test(prefixSlice)) continue;
        }

        // Guard against "WCF 1.0", semvers like "WCF 4.5.1", percentages, or bare-number units/ordinals ("Heidelberg 12 km", "Shorter Catechism 101 class", "LD 50 toxicity")
        const trailing = text.slice(endIndex, endIndex + 24);
        if (/^\s*\.\s*\d/.test(trailing) || /^\s*%/.test(trailing)) continue;
        if (
          !hasChapterSectionSeparator(rawSpec) &&
          /^\s*(?:km|mi(?:les?)?|m\b|cm|mm|ft|in(?:ches?)?|kg|lbs?|°|deg|stars?\b|-star\b|mins?|minutes?|hrs?|hours?|days?|weeks?|months?|years?|centur(?:y|ies)|million|billion|thousand|st\b|nd\b|rd\b|th\b|x\b|\/7\b|class\b|course\b|edition\b|toxicity\b|dose\b)/i.test(trailing)
        ) {
          continue;
        }
        if (aliasEntry.isLordsDay && normalizeAliasKey(rawAlias) === 'ld') {
          const near = text.slice(Math.max(0, startIndex - 20), Math.min(text.length, endIndex + 30));
          if (/\b(?:toxic|toxicity|lethal|dose|mg\/kg|rat|mice|poison)\b/i.test(near)) continue;
        }

        const parsed = parseAndValidateSpec(
          aliasEntry.doc,
          rawAlias,
          rawSpec,
          aliasEntry.isLordsDay,
          {
            riskyAliasMode: opts.ignoreRiskyGate ? 'always' : opts.riskyAliasMode,
            pageContext: opts.pageContext,
            isRisky: aliasEntry.isRisky
          }
        );

        if (!parsed) {
          // If chained comma/range spec failed as a whole, allow shorter retry? No, fail cleanly to prevent false positives.
          continue;
        }

        rawMatches.push({
          startIndex,
          endIndex,
          matchText: fullMatch,
          parsed,
          isRisky: aliasEntry.isRisky
        });

        // Upgrade theological context for subsequent risky aliases in the same string if this one wasn't risky
        if (!aliasEntry.isRisky && !opts.pageContext.hasTheologicalContext) {
          opts.pageContext = { ...opts.pageContext, hasTheologicalContext: true };
        }

        // Handle chained continuations immediately following (e.g., "; 2.1" or ", 27")
        let cursor = endIndex;
        let lastDoc = aliasEntry.doc;
        let lastMode = parsed.mode;
        let lastSeg = parsed.segments[parsed.segments.length - 1];

        while (cursor < text.length) {
          const remaining = text.slice(cursor);
          const chainMatch = _chainRegex && _chainRegex.exec(remaining);
          if (!chainMatch) break;

          const prefix = chainMatch[1];
          const chainSpec = chainMatch[3];
          const afterPrefix = remaining.slice(prefix.length);

          if (_probeDocRegex && _probeDocRegex.test(afterPrefix)) break;
          if (_creedRegex) {
            _creedRegex.lastIndex = 0;
            const cm = _creedRegex.exec(afterPrefix);
            if (cm && cm.index === 0) break;
          }

          let effectiveSpec = chainSpec;
          if (lastDoc.structure === 'chapter_section' && !hasChapterSectionSeparator(chainSpec) && lastSeg && !lastSeg.isWholeChapter) {
            effectiveSpec = `${lastSeg.chapter}.${chainSpec}`;
          } else if (lastDoc.structure === 'dort' && !hasChapterSectionSeparator(chainSpec) && !/3\s*[/&-]\s*4|III\s*[/&-]\s*IV/i.test(chainSpec) && lastSeg && !lastSeg.isWholeHead) {
            effectiveSpec = lastSeg.kind === 'rejection'
              ? `${lastSeg.head}.R.${chainSpec}`
              : `${lastSeg.head}.${chainSpec}`;
          }

          // Handle "Lord's Day 12, Q&A 31" switching from Lord's Day mode into Question mode
          let nextIsLordsDay = lastMode === 'lords_day';
          if (
            lastDoc.id === 'hc' &&
            lastMode === 'lords_day' &&
            /^(?:Questions?|Q\.?\s*&?\s*A\.?|Q\.?\s*\/?\s*A\.?|Q\.?\s*A\.?|Q\.?|A\.)\s*/i.test(chainSpec.trim())
          ) {
            nextIsLordsDay = false;
          }

          const chainParsed = parseAndValidateSpec(
            lastDoc,
            lastDoc.name,
            effectiveSpec,
            nextIsLordsDay,
            {
              riskyAliasMode: 'always',
              pageContext: opts.pageContext,
              isRisky: false
            }
          );
          if (!chainParsed) break;
          lastMode = chainParsed.mode;

          const refStart = cursor + prefix.length;
          const refEnd = cursor + chainMatch[0].length;
          rawMatches.push({
            startIndex: refStart,
            endIndex: refEnd,
            matchText: text.slice(refStart, refEnd),
            parsed: chainParsed,
            isRisky: false
          });

          lastSeg = chainParsed.segments[chainParsed.segments.length - 1];
          cursor = refEnd;
          _numberedRegex.lastIndex = cursor;
        }
      }
    }

    // Pass 2: Standalone Ecumenical Creeds (if any creed pack is installed & enabled)
    if (_creedRegex) {
      _creedRegex.lastIndex = 0;
      let match;
      while ((match = _creedRegex.exec(text)) !== null) {
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;
        // Skip if already covered by an earlier match
        if (rawMatches.some(r => startIndex < r.endIndex && endIndex > r.startIndex)) {
          continue;
        }
        const aliasEntry = resolveAlias(match[1]);
        if (!aliasEntry || aliasEntry.doc.structure !== 'creed') continue;

        rawMatches.push({
          startIndex,
          endIndex,
          matchText: match[0],
          parsed: {
            docId: aliasEntry.doc.id,
            docName: aliasEntry.doc.name,
            shortName: aliasEntry.doc.shortName,
            structure: 'creed',
            mode: 'creed',
            segments: [{ start: 1, end: 1 }],
            canonicalLabel: aliasEntry.doc.name
          },
          isRisky: false
        });
      }
    }

    rawMatches.sort((a, b) => a.startIndex - b.startIndex);
    return rawMatches;
  }

  function parseSingleReference(inputStr) {
    if (!inputStr || typeof inputStr !== 'string') return null;
    const trimmed = inputStr.trim();
    const matches = findReferencesInText(trimmed, { ignoreRiskyGate: true });
    return matches.length > 0 ? matches[0].parsed : null;
  }

  function getExternalUrl(docDescriptor, parsedRef) {
    if (!docDescriptor) return '';
    const pattern = docDescriptor.externalUrlPattern;
    const base = docDescriptor.sourceUrl || '';
    if (!pattern) return base;

    const first = parsedRef && parsedRef.segments && parsedRef.segments[0];
    if (!first) return base;

    if (docDescriptor.structure === 'chapter_section' && first.chapter) {
      if (first.isWholeChapter) {
        if (docDescriptor.wholeChapterUrlPattern) {
          return docDescriptor.wholeChapterUrlPattern.replace(/\{chapter\}/g, String(first.chapter));
        }
        return pattern
          .replace(/#article-\{chapter\}-\{section\}/g, `#chapter-${first.chapter}`)
          .replace(/\{chapter\}/g, String(first.chapter))
          .replace(/\{section\}/g, '1');
      }
      return pattern
        .replace(/\{chapter\}/g, String(first.chapter))
        .replace(/\{section\}/g, String(first.start || 1));
    }

    if (docDescriptor.structure === 'article' && first.start) {
      return pattern.replace(/\{article\}/g, String(first.start));
    }

    if (docDescriptor.structure === 'catechism') {
      if (parsedRef.mode === 'lords_day') {
        if (docDescriptor.lordsDayUrlPattern && first.start) {
          return docDescriptor.lordsDayUrlPattern.replace(/\{ld\}/g, String(first.start));
        }
        let qNum = first.start;
        if (docDescriptor.lordDays && docDescriptor.lordDays[String(first.start)]) {
          qNum = docDescriptor.lordDays[String(first.start)][0];
        }
        if (qNum) return pattern.replace(/\{number\}/g, String(qNum));
      } else if (first.start) {
        return pattern.replace(/\{number\}/g, String(first.start));
      }
    }

    if (docDescriptor.structure === 'dort' && first.head) {
      if (base.includes('reformedstandards.com')) {
        const rsHead = first.head === '3/4' ? '3' : first.head === '5' ? '4' : first.head;
        if (first.isWholeHead) return `${base}#chapter-${rsHead}`;
        if (first.kind === 'rejection') return `${base}#article-r${rsHead}-${first.start || 1}`;
        return `${base}#article-${rsHead}-${first.start || 1}`;
      }
    }

    return base;
  }

  return {
    BUNDLED_DOCS,
    COMMUNITY_PACK_CATALOG,
    HEIDELBERG_LORDS_DAYS,
    setCustomPacks,
    setDisabledDocs,
    getAllDocs,
    getEnabledDocs,
    getDocById,
    romanToInt,
    analyzePageContext,
    findReferencesInText,
    parseSingleReference,
    getExternalUrl
  };
});
