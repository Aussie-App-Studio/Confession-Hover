/**
 * Confession Hover — Options Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const Registry = globalThis.ConfessionHoverRegistry || {};

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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

  // Save toast
  const saveToast = document.getElementById('saveToast');
  let toastTimer = null;
  function showSaveToast() {
    if (!saveToast) return;
    saveToast.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { saveToast.style.opacity = '0'; }, 1800);
  }

  // Tab switching
  const navItems = document.querySelectorAll('.nav-item[data-tab]');
  const tabPanes = document.querySelectorAll('.tab-pane');

  function switchTab(tabId) {
    if (!tabId) return;
    navItems.forEach(item => item.classList.toggle('active', item.dataset.tab === tabId));
    tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === tabId));
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      switchTab(item.dataset.tab);
      window.location.hash = item.dataset.tab.replace('tab-', '');
    });
  });

  if (window.location.hash) {
    const hashTab = `tab-${window.location.hash.replace('#', '')}`;
    if (document.getElementById(hashTab)) switchTab(hashTab);
  }

  // Load config
  const stored = await chrome.storage.local.get([
    'enabled', 'scanMode', 'theme', 'fontSize', 'bodyFont',
    'underlineStyle', 'underlineColor', 'hoverDelay', 'minimalistMode',
    'showExternalLinks', 'showSettingsButton', 'riskyAliasMode',
    'disabledDocIds', 'disabledDomains', 'installedPackRegistry'
  ]);

  const config = {
    enabled: stored.enabled !== false,
    scanMode: stored.scanMode || 'auto',
    theme: stored.theme || 'auto',
    fontSize: stored.fontSize || 'medium',
    bodyFont: stored.bodyFont || 'sans',
    underlineStyle: stored.underlineStyle || 'dotted',
    underlineColor: stored.underlineColor || '#9f1239',
    hoverDelay: typeof stored.hoverDelay === 'number' ? stored.hoverDelay : 120,
    minimalistMode: Boolean(stored.minimalistMode),
    showExternalLinks: stored.showExternalLinks !== false,
    showSettingsButton: stored.showSettingsButton !== false,
    riskyAliasMode: stored.riskyAliasMode || 'context',
    disabledDocIds: Array.isArray(stored.disabledDocIds) ? stored.disabledDocIds : [],
    disabledDomains: Array.isArray(stored.disabledDomains) ? stored.disabledDomains : [...DEFAULT_DISABLED_DOMAINS],
    installedPackRegistry: Array.isArray(stored.installedPackRegistry) ? stored.installedPackRegistry : []
  };

  function syncRegistry() {
    Registry.setCustomPacks?.(config.installedPackRegistry);
    Registry.setDisabledDocs?.(config.disabledDocIds);
  }
  syncRegistry();

  function saveConfig(patch) {
    Object.assign(config, patch);
    syncRegistry();
    updateLivePreview();
    chrome.storage.local.set(patch, showSaveToast);
  }

  // Global Toggle
  const globalToggle = document.getElementById('globalToggle');
  const globalStatusLabel = document.getElementById('globalStatusLabel');
  if (globalToggle) {
    globalToggle.checked = config.enabled;
    globalStatusLabel.textContent = config.enabled ? 'Extension Active' : 'Extension Disabled';
    globalToggle.addEventListener('change', () => {
      globalStatusLabel.textContent = globalToggle.checked ? 'Extension Active' : 'Extension Disabled';
      saveConfig({ enabled: globalToggle.checked });
    });
  }

  // --- TAB 1: Appearance & Preview ---
  const themeSelect = document.getElementById('themeSelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const bodyFont = document.getElementById('bodyFont');
  const underlineStyle = document.getElementById('underlineStyle');
  const underlineColor = document.getElementById('underlineColor');
  const hoverDelay = document.getElementById('hoverDelay');
  const hoverDelayVal = document.getElementById('hoverDelayVal');
  const scanMode = document.getElementById('scanMode');
  const showExternalLinks = document.getElementById('showExternalLinks');
  const showSettingsButton = document.getElementById('showSettingsButton');
  const minimalistMode = document.getElementById('minimalistMode');

  const previewCard = document.getElementById('previewCard');
  const sampleAnchor = document.getElementById('sampleAnchor');
  const previewSampleWcf = document.getElementById('previewSampleWcf');
  const previewSampleHc = document.getElementById('previewSampleHc');
  let activePreviewSample = 'wcf';

  themeSelect.value = config.theme;
  fontSizeSelect.value = config.fontSize;
  bodyFont.value = config.bodyFont;
  underlineStyle.value = config.underlineStyle;
  underlineColor.value = config.underlineColor;
  hoverDelay.value = config.hoverDelay;
  hoverDelayVal.textContent = `${config.hoverDelay}ms`;
  scanMode.value = config.scanMode;
  showExternalLinks.checked = config.showExternalLinks;
  showSettingsButton.checked = config.showSettingsButton;
  minimalistMode.checked = config.minimalistMode;

  function updateLivePreview() {
    if (!previewCard) return;
    let effectiveTheme = config.theme;
    if (effectiveTheme === 'auto') {
      effectiveTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    const minClass = config.minimalistMode ? 'ch-minimalist' : '';
    previewCard.className = `ch-preview-card theme-${effectiveTheme} font-${config.fontSize} font-family-${config.bodyFont} ${minClass}`.trim();

    const accent = config.underlineColor || '#9f1239';
    if (sampleAnchor) {
      sampleAnchor.style.color = accent;
      sampleAnchor.style.textDecorationColor = accent;
      if (config.underlineStyle === 'highlight') {
        sampleAnchor.style.textDecorationLine = 'underline';
        sampleAnchor.style.textDecorationStyle = 'solid';
        sampleAnchor.style.backgroundColor = `${accent}22`;
      } else if (config.underlineStyle === 'none') {
        sampleAnchor.style.textDecorationLine = 'none';
        sampleAnchor.style.backgroundColor = 'transparent';
      } else {
        sampleAnchor.style.textDecorationLine = 'underline';
        sampleAnchor.style.textDecorationStyle = config.underlineStyle;
        sampleAnchor.style.backgroundColor = 'transparent';
      }
    }

    const previewBadge = document.getElementById('previewBadge');
    if (previewBadge) previewBadge.style.backgroundColor = accent;

    const previewSettingsWrapper = document.getElementById('previewSettingsWrapper');
    if (previewSettingsWrapper) {
      previewSettingsWrapper.style.display = (config.showSettingsButton && !config.minimalistMode) ? 'inline-flex' : 'none';
    }
    const previewExternalLink = document.getElementById('previewExternalLink');
    if (previewExternalLink) {
      previewExternalLink.style.display = config.showExternalLinks ? 'inline-flex' : 'none';
    }

    const titleEl = document.getElementById('previewTitle');
    const subbarEl = document.getElementById('previewSubbar');
    const bodyEl = document.getElementById('previewBody');
    const footerLeft = document.getElementById('previewFooterLeft');

    if (activePreviewSample === 'wcf') {
      titleEl.textContent = 'WCF 1.2';
      previewBadge.textContent = 'WCF';
      subbarEl.textContent = 'Ch. 1: Of the Holy Scripture';
      footerLeft.textContent = 'Westminster Confession (1647)';
      bodyEl.innerHTML = `<span style="font-weight:700; color:${accent}; margin-right:6px;">1.2</span>Under the name of Holy Scripture, or the Word of God written, are now contained all the books of the Old and New Testaments, all which are given by inspiration of God to be the rule of faith and life.`;
    } else {
      titleEl.textContent = 'HC Q. 1';
      previewBadge.textContent = 'HC';
      subbarEl.textContent = "Lord's Day 1";
      footerLeft.textContent = 'Heidelberg Catechism (1563)';
      bodyEl.innerHTML = `<div style="font-weight:700; margin-bottom:6px;"><span style="color:${accent};">Q.1</span> What is your only comfort in life and death?</div><div><span style="color:${accent}; font-weight:700;">A.</span> That I am not my own, but belong with body and soul, both in life and in death, to my faithful Saviour Jesus Christ.</div>`;
    }
  }

  previewSampleWcf?.addEventListener('click', () => {
    activePreviewSample = 'wcf';
    previewSampleWcf.classList.add('active');
    previewSampleHc.classList.remove('active');
    updateLivePreview();
  });
  previewSampleHc?.addEventListener('click', () => {
    activePreviewSample = 'hc';
    previewSampleHc.classList.add('active');
    previewSampleWcf.classList.remove('active');
    updateLivePreview();
  });

  themeSelect.addEventListener('change', () => saveConfig({ theme: themeSelect.value }));
  fontSizeSelect.addEventListener('change', () => saveConfig({ fontSize: fontSizeSelect.value }));
  bodyFont.addEventListener('change', () => saveConfig({ bodyFont: bodyFont.value }));
  underlineStyle.addEventListener('change', () => saveConfig({ underlineStyle: underlineStyle.value }));
  underlineColor.addEventListener('input', () => saveConfig({ underlineColor: underlineColor.value }));
  document.querySelectorAll('.swatch').forEach(s => {
    s.addEventListener('click', () => {
      underlineColor.value = s.dataset.color;
      saveConfig({ underlineColor: s.dataset.color });
    });
  });
  hoverDelay.addEventListener('input', () => {
    hoverDelayVal.textContent = `${hoverDelay.value}ms`;
    saveConfig({ hoverDelay: parseInt(hoverDelay.value, 10) });
  });
  scanMode.addEventListener('change', () => saveConfig({ scanMode: scanMode.value }));
  showExternalLinks.addEventListener('change', () => saveConfig({ showExternalLinks: showExternalLinks.checked }));
  showSettingsButton.addEventListener('change', () => saveConfig({ showSettingsButton: showSettingsButton.checked }));
  minimalistMode.addEventListener('change', () => saveConfig({ minimalistMode: minimalistMode.checked }));

  updateLivePreview();

  // --- TAB 2: Standards & Ambiguity ---
  const ambiguityGrid = document.getElementById('ambiguityGrid');
  const docsGrid = document.getElementById('docsGrid');

  function updateAmbiguityCards() {
    ambiguityGrid?.querySelectorAll('.comm-mode-card').forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      const active = card.dataset.mode === config.riskyAliasMode;
      card.classList.toggle('selected', active);
      if (radio) radio.checked = active;
    });
    const labelMap = { context: 'Context-Aware', strict: 'Strict', always: 'Always Match' };
    const lbl = document.getElementById('sandboxAmbiguityLabel');
    if (lbl) lbl.textContent = labelMap[config.riskyAliasMode] || 'Context-Aware';
  }

  ambiguityGrid?.querySelectorAll('.comm-mode-card').forEach(card => {
    card.addEventListener('click', () => {
      saveConfig({ riskyAliasMode: card.dataset.mode });
      updateAmbiguityCards();
    });
  });
  updateAmbiguityCards();

  function renderDocsGrid() {
    if (!docsGrid) return;
    docsGrid.innerHTML = '';
    const allDocs = Registry.getAllDocs ? Registry.getAllDocs() : [];
    const disabledSet = new Set(config.disabledDocIds);

    for (const doc of allDocs) {
      const enabled = !disabledSet.has(doc.id);
      const card = document.createElement('label');
      card.className = `trans-card ${enabled ? 'checked' : ''}`;

      const aliasesPreview = [...(doc.aliases || []), ...(doc.riskyAliases || []).map(r => `${r}*`)].slice(0, 4).join(', ');
      card.innerHTML = `
        <div class="trans-card-info">
          <span class="trans-tag">${escapeHtml(doc.shortName || doc.id.toUpperCase())}</span>
          <div class="trans-names">
            <span class="trans-main-name">${escapeHtml(doc.name)}</span>
            <span class="trans-meta-label">${escapeHtml(doc.year || 'Historic')} • ${escapeHtml(doc.entryCount || '')} entries • ${escapeHtml(aliasesPreview)}</span>
          </div>
        </div>
        <input type="checkbox" ${enabled ? 'checked' : ''}>
      `;
      const cb = card.querySelector('input');
      cb.addEventListener('change', () => {
        const nextDisabled = new Set(config.disabledDocIds);
        if (cb.checked) nextDisabled.delete(doc.id);
        else nextDisabled.add(doc.id);
        card.classList.toggle('checked', cb.checked);
        saveConfig({ disabledDocIds: Array.from(nextDisabled) });
      });
      docsGrid.appendChild(card);
    }
  }
  renderDocsGrid();

  document.getElementById('btnEnableAllDocs')?.addEventListener('click', () => {
    saveConfig({ disabledDocIds: [] });
    renderDocsGrid();
  });

  // --- TAB 3: Community Packs (1-Click Chips + URL + File Import) ---
  const catalogCategoriesContainer = document.getElementById('catalogCategoriesContainer');
  const packActionStatus = document.getElementById('packActionStatus');
  const installedPacksList = document.getElementById('installedPacksList');
  const statInstalledPacks = document.getElementById('statInstalledPacks');
  const statTotalEntries = document.getElementById('statTotalEntries');
  const importFeedback = document.getElementById('importFeedback');

  function showImportFeedback(msg, kind = '') {
    if (!importFeedback) return;
    importFeedback.textContent = msg;
    importFeedback.className = `dash-alert ${kind}`.trim();
    importFeedback.style.display = 'block';
  }

  function showPackStatus(msg) {
    if (!packActionStatus) return;
    packActionStatus.textContent = msg;
    packActionStatus.style.display = 'inline-block';
  }

  async function refreshPacksFromBackground() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_PACK_STATUS' }, (res) => {
        if (res && res.ok) {
          config.installedPackRegistry = res.installed || [];
          syncRegistry();
        }
        renderPacksUI();
        renderDocsGrid();
        resolve();
      });
    });
  }

  function renderPacksUI() {
    const installed = config.installedPackRegistry || [];
    const installedIds = new Set(installed.map(p => p.id));

    if (statInstalledPacks) statInstalledPacks.textContent = String(installed.length);
    const totalEntries = (Registry.getAllDocs ? Registry.getAllDocs() : [])
      .reduce((sum, d) => sum + (d.entryCount || 0), 0);
    if (statTotalEntries) statTotalEntries.textContent = String(totalEntries);

    // 1-Click Catalog Chips
    if (catalogCategoriesContainer && Registry.COMMUNITY_PACK_CATALOG) {
      catalogCategoriesContainer.innerHTML = '';
      const categories = new Map();
      for (const item of Registry.COMMUNITY_PACK_CATALOG) {
        if (!categories.has(item.category)) categories.set(item.category, []);
        categories.get(item.category).push(item);
      }

      for (const [catName, items] of categories.entries()) {
        const block = document.createElement('div');
        block.className = 'catalog-category';
        const heading = document.createElement('div');
        heading.className = 'catalog-cat-title';
        heading.textContent = catName;
        block.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'pack-chips-grid';

        for (const item of items) {
          const isInstalled = installedIds.has(item.id);
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = `pack-chip ${isInstalled ? 'installed' : ''}`;
          chip.title = `${item.description} (${item.aliases.join(', ')})`;
          chip.innerHTML = `
            <span class="pack-chip-action">${isInstalled ? '✓' : '+'}</span>
            <span>${escapeHtml(item.name)}</span>
            <span class="pack-chip-year">${escapeHtml(item.year)}</span>
          `;

          chip.addEventListener('click', async () => {
            if (chip.classList.contains('loading')) return;
            chip.classList.add('loading');

            if (isInstalled) {
              showPackStatus(`Removing ${item.name}...`);
              chrome.runtime.sendMessage({ type: 'DELETE_PACK', id: item.id }, (res) => {
                chip.classList.remove('loading');
                if (res && res.ok) {
                  showPackStatus(`Removed ${item.name}`);
                  refreshPacksFromBackground();
                } else {
                  showPackStatus(res?.error || 'Remove failed');
                }
              });
            } else {
              showPackStatus(`Downloading ${item.name}...`);
              chrome.runtime.sendMessage({
                type: 'INSTALL_PACK_FROM_URL',
                url: item.url,
                catalogMeta: {
                  id: item.id,
                  name: item.name,
                  shortName: item.shortName,
                  year: item.year,
                  tradition: item.tradition,
                  structure: item.structure,
                  sourceUrl: item.sourceUrl,
                  aliases: item.aliases,
                  riskyAliases: item.riskyAliases
                }
              }, (res) => {
                chip.classList.remove('loading');
                if (res && res.ok) {
                  showPackStatus(`✓ Added ${item.name} (${res.descriptor?.entryCount || 1} entries)`);
                  showSaveToast();
                  refreshPacksFromBackground();
                } else {
                  showPackStatus(`Error: ${res?.error || 'Download failed'}`);
                }
              });
            }
          });
          grid.appendChild(chip);
        }

        block.appendChild(grid);
        catalogCategoriesContainer.appendChild(block);
      }
    }

    // Installed Packs Table
    if (installedPacksList) {
      installedPacksList.innerHTML = '';
      if (installed.length === 0) {
        installedPacksList.innerHTML = `<div style="font-size:12.5px; color:var(--text-secondary); padding:8px 0;">No community or custom packs installed yet. Click any chip above to add one in 1 click!</div>`;
      } else {
        const bundledIds = new Set((Registry.BUNDLED_DOCS || []).map(d => d.id));
        for (const p of installed) {
          const overridesBundled = bundledIds.has(p.id);
          const overrideBadge = overridesBundled
            ? `<span class="trans-tag" style="background:rgba(245,158,11,0.14); color:#b45309; margin-left:6px;">Overrides Bundled</span>`
            : '';
          const row = document.createElement('div');
          row.className = 'offline-row';
          row.innerHTML = `
            <div class="offline-row-info">
              <span class="trans-tag">${escapeHtml(p.shortName || p.id)}</span>
              <div>
                <div style="font-weight:600; font-size:13px;">${escapeHtml(p.name)}${overrideBadge}</div>
                <div style="font-size:11px; color:var(--text-secondary);">${escapeHtml(p.structure)} • ${escapeHtml(p.entryCount || 1)} entries • Aliases: ${escapeHtml((p.aliases || []).join(', '))}</div>
              </div>
            </div>
            <div class="offline-row-actions">
              <button type="button" class="dash-mini-btn export-pack-btn">Export JSON</button>
              <button type="button" class="dash-mini-btn remove-pack-btn" style="color:var(--danger-color);">${overridesBundled ? 'Restore Bundled' : 'Remove'}</button>
            </div>
          `;

          row.querySelector('.export-pack-btn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'EXPORT_PACK', id: p.id }, (res) => {
              if (!res || !res.ok || !res.pack) return;
              const blob = new Blob([JSON.stringify(res.pack, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${p.id}.json`;
              a.click();
              URL.revokeObjectURL(url);
            });
          });

          row.querySelector('.remove-pack-btn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'DELETE_PACK', id: p.id }, () => {
              refreshPacksFromBackground();
            });
          });

          installedPacksList.appendChild(row);
        }
      }
    }
  }

  // Import from Custom URL (requests optional_host_permissions for non-GitHub hosts)
  const customUrlInput = document.getElementById('customUrlInput');
  const customUrlImportBtn = document.getElementById('customUrlImportBtn');

  customUrlImportBtn?.addEventListener('click', async () => {
    const url = (customUrlInput.value || '').trim();
    if (!url) return;

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      showImportFeedback('Please enter a valid https:// JSON URL.', 'error');
      return;
    }

    if (parsedUrl.hostname !== 'raw.githubusercontent.com' && chrome.permissions?.request) {
      try {
        const granted = await chrome.permissions.request({ origins: [`${parsedUrl.origin}/*`] });
        if (!granted) {
          showImportFeedback('Permission to fetch from that domain was declined.', 'error');
          return;
        }
      } catch (err) {
        showImportFeedback(`Permission request failed: ${err.message}`, 'error');
        return;
      }
    }

    customUrlImportBtn.disabled = true;
    showImportFeedback('Downloading and validating JSON pack...');
    chrome.runtime.sendMessage({ type: 'INSTALL_PACK_FROM_URL', url }, (res) => {
      customUrlImportBtn.disabled = false;
      if (res && res.ok) {
        customUrlInput.value = '';
        showImportFeedback(`✓ Installed "${res.descriptor.name}" (${res.descriptor.entryCount} entries).`, 'success');
        refreshPacksFromBackground();
      } else {
        showImportFeedback(`Import failed: ${res?.error || 'Unknown error'}`, 'error');
      }
    });
  });

  // Upload local JSON file
  const dropZone = document.getElementById('dropZone');
  const jsonFileInput = document.getElementById('jsonFileInput');
  const browseFileBtn = document.getElementById('browseFileBtn');

  async function handleJsonFile(file) {
    if (!file) return;
    const MAX_PACK_FILE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_PACK_FILE_BYTES) {
      showImportFeedback('Pack file is too large (max 5 MB).', 'error');
      return;
    }
    try {
      const text = await file.text();
      chrome.runtime.sendMessage({ type: 'IMPORT_PACK_JSON', jsonText: text }, (res) => {
        if (res && res.ok) {
          showImportFeedback(`✓ Imported "${res.descriptor.name}" (${res.descriptor.entryCount} entries).`, 'success');
          refreshPacksFromBackground();
        } else {
          showImportFeedback(`Invalid pack file: ${res?.error || 'Could not normalize JSON'}`, 'error');
        }
      });
    } catch (err) {
      showImportFeedback(`Could not read file: ${err.message}`, 'error');
    }
  }

  browseFileBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    jsonFileInput?.click();
  });
  dropZone?.addEventListener('click', () => jsonFileInput?.click());
  dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer?.files?.[0]) handleJsonFile(e.dataTransfer.files[0]);
  });
  jsonFileInput?.addEventListener('change', () => {
    if (jsonFileInput.files?.[0]) handleJsonFile(jsonFileInput.files[0]);
    jsonFileInput.value = '';
  });

  document.getElementById('downloadTemplateBtn')?.addEventListener('click', () => {
    const template = {
      schemaVersion: 1,
      id: 'sample_confession',
      name: 'Sample Modern Confession',
      shortName: 'SMC',
      year: '2026',
      tradition: 'Community Pack',
      structure: 'chapter_section',
      sourceUrl: 'https://example.org/confession',
      aliases: ['Sample Modern Confession', 'SMC'],
      riskyAliases: [],
      chapters: { '1': 'Of Holy Scripture' },
      entries: {
        '1.1': 'Holy Scripture is the only sufficient, certain, and infallible rule of saving knowledge, faith, and obedience.'
      }
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'confession-hover-pack-template.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  refreshPacksFromBackground();

  // --- TAB 4: Disabled Sites ---
  const addDomainInput = document.getElementById('addDomainInput');
  const addDomainBtn = document.getElementById('addDomainBtn');
  const disabledSitesList = document.getElementById('disabledSitesList');

  function renderDisabledSites() {
    if (!disabledSitesList) return;
    disabledSitesList.innerHTML = '';
    if (config.disabledDomains.length === 0) {
      disabledSitesList.innerHTML = `<div style="font-size:12.5px; color:var(--text-secondary);">No disabled domains. Confession Hover is active everywhere.</div>`;
      return;
    }
    for (const domain of config.disabledDomains) {
      const row = document.createElement('div');
      row.className = 'disabled-site-item';
      row.innerHTML = `<span>${escapeHtml(domain)}</span><button type="button" class="dash-mini-btn" style="color:var(--danger-color);">Remove</button>`;
      row.querySelector('button').addEventListener('click', () => {
        saveConfig({ disabledDomains: config.disabledDomains.filter(d => d !== domain) });
        renderDisabledSites();
      });
      disabledSitesList.appendChild(row);
    }
  }

  addDomainBtn?.addEventListener('click', () => {
    let val = (addDomainInput.value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!val) return;
    if (!config.disabledDomains.includes(val)) {
      saveConfig({ disabledDomains: [...config.disabledDomains, val] });
      renderDisabledSites();
    }
    addDomainInput.value = '';
  });

  document.getElementById('restoreDefaultDomainsBtn')?.addEventListener('click', () => {
    const merged = Array.from(new Set([...config.disabledDomains, ...DEFAULT_DISABLED_DOMAINS]));
    saveConfig({ disabledDomains: merged });
    renderDisabledSites();
  });
  renderDisabledSites();

  // --- TAB 5: Citation Sandbox ---
  const sandboxInput = document.getElementById('sandboxInput');
  const sandboxSearchBtn = document.getElementById('sandboxSearchBtn');
  const sandboxResultBox = document.getElementById('sandboxResultBox');
  const sandboxResultTitle = document.getElementById('sandboxResultTitle');
  const sandboxResultSubtitle = document.getElementById('sandboxResultSubtitle');
  const sandboxResultBody = document.getElementById('sandboxResultBody');
  const sandboxContextBtn = document.getElementById('sandboxContextBtn');
  const sandboxCopyBtn = document.getElementById('sandboxCopyBtn');

  let lastSandboxEntry = null;
  let sandboxFullContext = false;

  function renderSandboxItems(data) {
    sandboxResultBody.innerHTML = '';
    for (const item of data.items || []) {
      const p = document.createElement('div');
      p.style.marginBottom = '10px';
      if (data.structure === 'catechism') {
        p.innerHTML = `${item.question ? `<div style="font-weight:700; margin-bottom:3px;">Q.${escapeHtml(item.number)}: ${escapeHtml(item.question)}</div>` : ''}<div>${item.question ? '<strong>A.</strong> ' : ''}${escapeHtml(item.answer)}</div>`;
      } else {
        p.innerHTML = `${item.label ? `<strong style="color:var(--accent-color); margin-right:6px;">${escapeHtml(item.label)}</strong>` : ''}${escapeHtml(item.text)}`;
      }
      sandboxResultBody.appendChild(p);
    }
  }

  function runSandboxLookup() {
    const q = (sandboxInput.value || '').trim();
    if (!q) return;
    const parsed = Registry.parseSingleReference ? Registry.parseSingleReference(q) : null;
    sandboxResultBox.style.display = 'block';
    if (!parsed) {
      sandboxResultTitle.textContent = 'Invalid or Disabled Citation';
      sandboxResultSubtitle.textContent = '';
      sandboxResultBody.textContent = 'Try WCF 1.2, HC 26, Lord\'s Day 12, BC Art. 33, Canons of Dort 3/4.3, WLC 7, WSC 1, or 2LBCF 26.1.';
      lastSandboxEntry = null;
      return;
    }

    sandboxFullContext = false;
    sandboxContextBtn.textContent = 'Full Context';
    chrome.runtime.sendMessage({ type: 'GET_CONFESSION_ENTRY', parsedRef: parsed }, (res) => {
      if (!res || !res.ok) {
        sandboxResultTitle.textContent = parsed.canonicalLabel;
        sandboxResultSubtitle.textContent = '';
        sandboxResultBody.textContent = res?.error || 'Could not load entry.';
        return;
      }
      lastSandboxEntry = res;
      sandboxResultTitle.textContent = `${res.canonicalLabel} (${res.shortName})`;
      sandboxResultSubtitle.textContent = res.subtitle || res.docName;
      sandboxContextBtn.style.display = res.contextInfo && res.structure !== 'creed' ? 'inline-block' : 'none';
      renderSandboxItems(res);
    });
  }

  sandboxSearchBtn?.addEventListener('click', runSandboxLookup);
  sandboxInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSandboxLookup(); });

  sandboxContextBtn?.addEventListener('click', () => {
    if (!lastSandboxEntry || !lastSandboxEntry.contextInfo) return;
    sandboxFullContext = !sandboxFullContext;
    if (!sandboxFullContext) {
      sandboxContextBtn.textContent = 'Full Context';
      sandboxResultTitle.textContent = `${lastSandboxEntry.canonicalLabel} (${lastSandboxEntry.shortName})`;
      renderSandboxItems(lastSandboxEntry);
      return;
    }
    chrome.runtime.sendMessage({
      type: 'GET_CONTEXT_GROUP',
      docId: lastSandboxEntry.docId,
      groupKey: lastSandboxEntry.contextInfo.groupKey
    }, (ctxRes) => {
      if (!ctxRes || !ctxRes.ok) return;
      sandboxContextBtn.textContent = 'Cited Only';
      sandboxResultTitle.textContent = ctxRes.groupTitle || lastSandboxEntry.docName;
      renderSandboxItems(ctxRes);
    });
  });

  sandboxCopyBtn?.addEventListener('click', () => {
    if (!lastSandboxEntry) return;
    const text = sandboxResultBody.innerText;
    navigator.clipboard.writeText(`${text}\n— ${sandboxResultTitle.textContent}`).then(() => {
      sandboxCopyBtn.textContent = 'Copied!';
      setTimeout(() => { sandboxCopyBtn.textContent = 'Copy'; }, 1400);
    }).catch(() => {});
  });

  // Paragraph Detection Tester
  const sandboxParagraphInput = document.getElementById('sandboxParagraphInput');
  const sandboxMatchesList = document.getElementById('sandboxMatchesList');

  function runParagraphScan() {
    if (!sandboxParagraphInput || !sandboxMatchesList) return;
    const text = sandboxParagraphInput.value || '';
    const matches = Registry.findReferencesInText
      ? Registry.findReferencesInText(text, { riskyAliasMode: config.riskyAliasMode })
      : [];

    sandboxMatchesList.innerHTML = '';
    if (matches.length === 0) {
      sandboxMatchesList.innerHTML = `<span style="font-size:12.5px; color:var(--text-secondary);">No citations detected with current settings.</span>`;
      return;
    }
    for (const m of matches) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'sandbox-match-pill';
      pill.title = 'Click to look up this citation above';
      pill.innerHTML = `<span>"${escapeHtml(m.matchText)}"</span> → <strong style="color:var(--accent-color);">${escapeHtml(m.parsed.canonicalLabel)}</strong>`;
      pill.addEventListener('click', () => {
        if (sandboxInput) {
          sandboxInput.value = m.parsed.canonicalLabel || m.matchText;
          runSandboxLookup();
          sandboxResultBox?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      sandboxMatchesList.appendChild(pill);
    }
  }

  document.getElementById('sandboxScanBtn')?.addEventListener('click', runParagraphScan);
  runParagraphScan();

  // Live storage sync if popup or another window changes settings
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area !== 'local') return;
    let shouldUpdatePreview = false;
    let shouldUpdatePacks = false;
    let shouldUpdateDocs = false;

    for (const [k, { newValue }] of Object.entries(changes)) {
      if (!(k in config)) continue;
      config[k] = newValue;
      if (k === 'enabled' && globalToggle) {
        globalToggle.checked = newValue !== false;
        if (globalStatusLabel) globalStatusLabel.textContent = globalToggle.checked ? 'Extension Active' : 'Extension Disabled';
      } else if (k === 'theme' && themeSelect) {
        themeSelect.value = newValue || 'auto';
        shouldUpdatePreview = true;
      } else if (k === 'fontSize' && fontSizeSelect) {
        fontSizeSelect.value = newValue || 'medium';
        shouldUpdatePreview = true;
      } else if (k === 'bodyFont' && bodyFont) {
        bodyFont.value = newValue || 'sans';
        shouldUpdatePreview = true;
      } else if (k === 'underlineStyle' && underlineStyle) {
        underlineStyle.value = newValue || 'dotted';
        shouldUpdatePreview = true;
      } else if (k === 'underlineColor' && underlineColor) {
        underlineColor.value = newValue || '#9f1239';
        shouldUpdatePreview = true;
      } else if (k === 'hoverDelay' && hoverDelay) {
        hoverDelay.value = typeof newValue === 'number' ? newValue : 120;
        if (hoverDelayVal) hoverDelayVal.textContent = `${hoverDelay.value}ms`;
      } else if (k === 'scanMode' && scanMode) {
        scanMode.value = newValue || 'auto';
      } else if (k === 'showExternalLinks' && showExternalLinks) {
        showExternalLinks.checked = newValue !== false;
        shouldUpdatePreview = true;
      } else if (k === 'showSettingsButton' && showSettingsButton) {
        showSettingsButton.checked = newValue !== false;
        shouldUpdatePreview = true;
      } else if (k === 'minimalistMode' && minimalistMode) {
        minimalistMode.checked = Boolean(newValue);
        shouldUpdatePreview = true;
      } else if (k === 'riskyAliasMode') {
        updateAmbiguityCards();
        runParagraphScan();
      } else if (k === 'disabledDomains') {
        renderDisabledSites();
      } else if (k === 'disabledDocIds') {
        shouldUpdateDocs = true;
      } else if (k === 'installedPackRegistry') {
        shouldUpdatePacks = true;
        shouldUpdateDocs = true;
      }
    }

    if (shouldUpdateDocs || shouldUpdatePacks) syncRegistry();
    if (shouldUpdatePacks) renderPacksUI();
    if (shouldUpdateDocs) {
      renderDocsGrid();
      runParagraphScan();
    }
    if (shouldUpdatePreview) updateLivePreview();
  });
});
