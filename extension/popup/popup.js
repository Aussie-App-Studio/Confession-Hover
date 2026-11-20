/**
 * Confession Hover — Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const Registry = globalThis.ConfessionHoverRegistry || {};

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

  // Elements
  const globalToggle = document.getElementById('globalToggle');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const quickResult = document.getElementById('quickResult');
  const resultTitle = document.getElementById('resultTitle');
  const resultBody = document.getElementById('resultBody');
  const resultCopyBtn = document.getElementById('resultCopyBtn');

  const currentDomainEl = document.getElementById('currentDomain');
  const siteLabelEl = document.getElementById('siteLabel');
  const siteCard = document.getElementById('siteCard');
  const sitePowerBtn = document.getElementById('sitePowerBtn');
  const siteToggleSwitch = document.getElementById('siteToggleSwitch');
  const siteStatusDot = document.getElementById('siteStatusDot');
  const siteStatusText = document.getElementById('siteStatusText');
  const siteDetailsClickArea = document.getElementById('siteDetailsClickArea');
  const siteNoticeCard = document.getElementById('siteNoticeCard');

  const riskyAliasMode = document.getElementById('riskyAliasMode');
  const themeSelect = document.getElementById('themeSelect');
  const bodyFont = document.getElementById('bodyFont');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const underlineStyle = document.getElementById('underlineStyle');
  const underlineColor = document.getElementById('underlineColor');
  const showExternalLinks = document.getElementById('showExternalLinks');
  const showSettingsButton = document.getElementById('showSettingsButton');
  const minimalistMode = document.getElementById('minimalistMode');
  const installedPacksCount = document.getElementById('installedPacksCount');

  let disabledDomains = [...DEFAULT_DISABLED_DOMAINS];
  let lastCopyText = '';

  function isHostMatchingEntry(host, entry) {
    const h = String(host || '').toLowerCase().trim();
    const d = String(entry || '').toLowerCase().trim();
    if (!h || !d) return false;
    return h === d || h.endsWith('.' + d) || d === 'www.' + h;
  }

  function extractFileName(pathname, fallback) {
    try {
      const last = String(pathname || '').split('/').filter(Boolean).pop();
      return last ? decodeURIComponent(last) : fallback;
    } catch {
      return fallback;
    }
  }

  function analyzeTabUrl(rawUrl) {
    const fallback = { kind: 'system', domain: '', displayDomain: 'Browser System Page', label: 'Browser Page', isPublishedDoc: false };
    if (!rawUrl) return fallback;
    try {
      const url = new URL(rawUrl);
      const protocol = url.protocol.toLowerCase();
      const host = url.hostname.toLowerCase();
      const pathname = url.pathname || '';
      const isChromePdfViewer = protocol === 'chrome-extension:' && host === 'mhjfbmdgcfjbbpaeojofohoefgiehjai';

      if (pathname.toLowerCase().endsWith('.pdf') || isChromePdfViewer) {
        return { kind: 'pdf', domain: '', displayDomain: extractFileName(pathname, 'PDF Document'), label: 'PDF Document', isPublishedDoc: false };
      }
      if (protocol === 'file:') {
        return { kind: 'local_file', domain: '', displayDomain: extractFileName(pathname, 'Local File'), label: 'Local File', isPublishedDoc: false };
      }
      if (protocol.startsWith('http')) {
        const isDocsHost = host === 'docs.google.com' || host.endsWith('.docs.google.com') || host === 'googledocs.com' || host.endsWith('.googledocs.com');
        const isPublishedDoc = isDocsHost && /\/pub(html)?(\/|$)/i.test(pathname);
        if (isPublishedDoc) return { kind: 'web', domain: host, displayDomain: host, label: 'Published Google Doc', isPublishedDoc: true };
        if (host === 'sheets.google.com' || host.endsWith('.sheets.google.com') || (isDocsHost && /^\/spreadsheets\//i.test(pathname))) {
          return { kind: 'google_sheets', domain: host, displayDomain: host, label: 'Google Sheets', isPublishedDoc: false };
        }
        if (isDocsHost && !/^\/forms\//i.test(pathname)) {
          return { kind: 'google_docs', domain: host, displayDomain: host, label: 'Google Docs Editor', isPublishedDoc: false };
        }
        return { kind: 'web', domain: host, displayDomain: host, label: 'Current Website', isPublishedDoc: false };
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  let tabInfo = analyzeTabUrl('');
  let currentDomain = '';
  let isFileAccessAllowed = null;

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.url) {
      tabInfo = analyzeTabUrl(tabs[0].url);
      currentDomain = tabInfo.domain;
    }
  } catch {}

  if (tabInfo.kind === 'local_file' && chrome.extension?.isAllowedFileSchemeAccess) {
    try {
      isFileAccessAllowed = await new Promise(resolve => {
        chrome.extension.isAllowedFileSchemeAccess(allowed => resolve(Boolean(allowed)));
      });
    } catch {}
  }

  const stored = await chrome.storage.local.get([
    'enabled', 'riskyAliasMode', 'theme', 'bodyFont', 'fontSize',
    'underlineStyle', 'underlineColor', 'showExternalLinks', 'showSettingsButton',
    'minimalistMode', 'disabledDomains', 'disabledDocIds', 'installedPackRegistry'
  ]);

  if (stored) {
    if (stored.enabled !== undefined) globalToggle.checked = stored.enabled;
    if (stored.riskyAliasMode) riskyAliasMode.value = stored.riskyAliasMode;
    if (stored.theme) themeSelect.value = stored.theme;
    if (stored.bodyFont) bodyFont.value = stored.bodyFont;
    if (stored.fontSize) fontSizeSelect.value = stored.fontSize;
    if (stored.underlineStyle) underlineStyle.value = stored.underlineStyle;
    if (stored.underlineColor) underlineColor.value = stored.underlineColor;
    if (stored.showExternalLinks !== undefined) showExternalLinks.checked = stored.showExternalLinks;
    if (stored.showSettingsButton !== undefined) showSettingsButton.checked = stored.showSettingsButton;
    if (stored.minimalistMode !== undefined) minimalistMode.checked = stored.minimalistMode;
    if (Array.isArray(stored.disabledDomains)) disabledDomains = stored.disabledDomains;

    if (Registry.setCustomPacks && Array.isArray(stored.installedPackRegistry)) {
      Registry.setCustomPacks(stored.installedPackRegistry);
    }
    if (Registry.setDisabledDocs && Array.isArray(stored.disabledDocIds)) {
      Registry.setDisabledDocs(stored.disabledDocIds);
    }
    const packCount = Array.isArray(stored.installedPackRegistry) ? stored.installedPackRegistry.length : 0;
    if (installedPacksCount) {
      installedPacksCount.textContent = packCount === 1 ? '1 installed' : `${packCount} installed`;
    }
  }

  // Site toggle helpers
  function canToggleCurrentSite() {
    return tabInfo.kind === 'web' && Boolean(currentDomain);
  }

  function isCurrentSiteDisabled() {
    if (!currentDomain) return false;
    if (tabInfo.isPublishedDoc) {
      return disabledDomains.some(d => String(d || '').toLowerCase().trim() === 'docs.google.com/pub');
    }
    return disabledDomains.some(d => isHostMatchingEntry(currentDomain, d));
  }

  function renderSiteNotice() {
    if (!siteNoticeCard) return;
    siteNoticeCard.innerHTML = '';
    if (tabInfo.kind === 'local_file' && isFileAccessAllowed !== true) {
      siteNoticeCard.innerHTML = `
        <div class="site-notice-header"><span>📁</span><span class="site-notice-title">Local file access is turned off</span></div>
        <p class="site-notice-desc">Turn on <strong>Allow access to file URLs</strong> in Extension Details to hover local HTML files.</p>
      `;
      if (chrome.runtime?.id && chrome.tabs?.create) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'site-notice-action-btn';
        btn.textContent = 'Open Extension Details ↗';
        btn.addEventListener('click', () => {
          chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
        });
        siteNoticeCard.appendChild(btn);
      }
      siteNoticeCard.style.display = 'flex';
    } else if (tabInfo.kind === 'google_docs' || tabInfo.kind === 'pdf' || tabInfo.kind === 'google_sheets') {
      const msg = tabInfo.kind === 'pdf'
        ? 'Chrome’s built-in PDF viewer blocks extension text scanning. Use Quick Lookup above to look up any citation!'
        : 'Google Docs/Sheets editors draw canvas cells rather than standard HTML text. Use File → Share → Publish to web or Quick Lookup above.';
      siteNoticeCard.innerHTML = `
        <div class="site-notice-header"><span>ℹ️</span><span class="site-notice-title">Not scannable on this page</span></div>
        <p class="site-notice-desc">${msg}</p>
      `;
      siteNoticeCard.style.display = 'flex';
    } else {
      siteNoticeCard.style.display = 'none';
    }
  }

  function updateSiteToggleUI() {
    if (siteLabelEl) siteLabelEl.textContent = tabInfo.label;
    currentDomainEl.textContent = tabInfo.displayDomain;
    currentDomainEl.title = tabInfo.displayDomain;

    if (!canToggleCurrentSite()) {
      siteCard.classList.add('paused');
      sitePowerBtn.classList.add('paused');
      sitePowerBtn.disabled = true;
      siteToggleSwitch.checked = false;
      siteToggleSwitch.disabled = true;
      siteDetailsClickArea.classList.add('non-interactive');
      siteStatusDot.className = tabInfo.kind === 'local_file' && isFileAccessAllowed === true ? 'site-status-dot' : 'site-status-dot notice';
      siteStatusText.className = tabInfo.kind === 'local_file' && isFileAccessAllowed === true ? 'site-status-text' : 'site-status-text notice';
      siteStatusText.textContent = tabInfo.kind === 'local_file' && isFileAccessAllowed === true
        ? 'Active on local HTML files'
        : 'Use Quick Lookup above';
      renderSiteNotice();
      return;
    }

    sitePowerBtn.disabled = false;
    siteToggleSwitch.disabled = false;
    siteDetailsClickArea.classList.remove('non-interactive');
    const paused = isCurrentSiteDisabled();
    siteCard.classList.toggle('paused', paused);
    sitePowerBtn.classList.toggle('paused', paused);
    siteToggleSwitch.checked = !paused;
    siteStatusDot.className = paused ? 'site-status-dot paused' : 'site-status-dot';
    siteStatusText.className = paused ? 'site-status-text paused' : 'site-status-text';
    siteStatusText.textContent = paused ? 'Paused on this site' : 'Active on this site';
    renderSiteNotice();
  }

  function toggleCurrentSite() {
    if (!canToggleCurrentSite()) return;
    if (tabInfo.isPublishedDoc) {
      if (isCurrentSiteDisabled()) {
        disabledDomains = disabledDomains.filter(d => String(d || '').toLowerCase().trim() !== 'docs.google.com/pub');
      } else {
        disabledDomains.push('docs.google.com/pub');
      }
    } else if (isCurrentSiteDisabled()) {
      disabledDomains = disabledDomains.filter(d => !isHostMatchingEntry(currentDomain, d));
    } else {
      const cleanDomain = currentDomain.replace(/^www\./, '');
      if (!disabledDomains.includes(cleanDomain)) disabledDomains.push(cleanDomain);
    }
    chrome.storage.local.set({ disabledDomains }, updateSiteToggleUI);
  }

  sitePowerBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleCurrentSite(); });
  siteToggleSwitch?.addEventListener('change', toggleCurrentSite);
  siteDetailsClickArea?.addEventListener('click', toggleCurrentSite);
  updateSiteToggleUI();

  // Quick Reference Lookup
  async function performLookup() {
    const query = searchInput.value.trim();
    if (!query) return;

    const parsed = Registry.parseSingleReference ? Registry.parseSingleReference(query) : null;
    if (!parsed) {
      quickResult.style.display = 'block';
      resultTitle.textContent = 'Invalid Citation';
      resultBody.textContent = 'Try: WCF 1.2, HC 26, Lord\'s Day 12, BC 33, Dort 3/4.3, WLC 7, WSC 1, or 2LBCF 26.1.';
      lastCopyText = '';
      return;
    }

    quickResult.style.display = 'block';
    resultTitle.textContent = `${parsed.canonicalLabel}`;
    resultBody.textContent = 'Loading...';

    chrome.runtime.sendMessage({ type: 'GET_CONFESSION_ENTRY', parsedRef: parsed }, (res) => {
      if (chrome.runtime.lastError || !res || !res.ok) {
        resultBody.textContent = res?.error || 'Failed to load entry.';
        lastCopyText = '';
        return;
      }
      resultTitle.textContent = `${res.canonicalLabel} (${res.shortName})`;
      resultBody.innerHTML = '';

      const copyLines = [];
      for (const item of res.items || []) {
        const div = document.createElement('div');
        div.style.marginBottom = '8px';
        if (res.structure === 'catechism') {
          const qText = item.question ? `Q.${item.number}: ${item.question}` : '';
          if (qText) {
            const qEl = document.createElement('div');
            qEl.style.fontWeight = '700';
            qEl.style.marginBottom = '3px';
            qEl.textContent = qText;
            div.appendChild(qEl);
          }
          const aEl = document.createElement('div');
          aEl.textContent = item.question ? `A. ${item.answer}` : item.answer;
          div.appendChild(aEl);
          copyLines.push(qText ? `${qText}\nA. ${item.answer}` : item.answer);
        } else {
          const prefix = item.label ? `${item.label} ` : '';
          div.textContent = `${prefix}${item.text}`;
          copyLines.push(`${prefix}${item.text}`);
        }
        resultBody.appendChild(div);
      }
      lastCopyText = `${copyLines.join('\n\n')}\n— ${res.canonicalLabel}`;
    });
  }

  searchBtn?.addEventListener('click', performLookup);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performLookup();
  });

  resultCopyBtn?.addEventListener('click', () => {
    if (!lastCopyText) return;
    navigator.clipboard.writeText(lastCopyText).then(() => {
      resultCopyBtn.textContent = 'Copied!';
      setTimeout(() => { resultCopyBtn.textContent = 'Copy'; }, 1400);
    }).catch(() => {});
  });

  // Setting persistence listeners
  globalToggle?.addEventListener('change', () => chrome.storage.local.set({ enabled: globalToggle.checked }));
  riskyAliasMode?.addEventListener('change', () => chrome.storage.local.set({ riskyAliasMode: riskyAliasMode.value }));
  themeSelect?.addEventListener('change', () => chrome.storage.local.set({ theme: themeSelect.value }));
  bodyFont?.addEventListener('change', () => chrome.storage.local.set({ bodyFont: bodyFont.value }));
  fontSizeSelect?.addEventListener('change', () => chrome.storage.local.set({ fontSize: fontSizeSelect.value }));
  underlineStyle?.addEventListener('change', () => chrome.storage.local.set({ underlineStyle: underlineStyle.value }));
  underlineColor?.addEventListener('input', () => chrome.storage.local.set({ underlineColor: underlineColor.value }));
  showExternalLinks?.addEventListener('change', () => chrome.storage.local.set({ showExternalLinks: showExternalLinks.checked }));
  showSettingsButton?.addEventListener('change', () => chrome.storage.local.set({ showSettingsButton: showSettingsButton.checked }));
  minimalistMode?.addEventListener('change', () => chrome.storage.local.set({ minimalistMode: minimalistMode.checked }));

  document.querySelectorAll('.color-preset').forEach(dot => {
    dot.addEventListener('click', () => {
      const col = dot.dataset.color;
      underlineColor.value = col;
      chrome.storage.local.set({ underlineColor: col });
    });
  });

  function openExtPage(path) {
    chrome.tabs.create({ url: chrome.runtime.getURL(path) });
  }

  document.getElementById('openDashboardBtn')?.addEventListener('click', () => openExtPage('options/options.html'));
  document.getElementById('footerDashboardLink')?.addEventListener('click', (e) => { e.preventDefault(); openExtPage('options/options.html'); });
  document.getElementById('managePacksBtn')?.addEventListener('click', () => openExtPage('options/options.html#packs'));
  document.getElementById('footerWelcomeLink')?.addEventListener('click', (e) => { e.preventDefault(); openExtPage('welcome/welcome.html'); });
  document.getElementById('footerTestPageLink')?.addEventListener('click', (e) => { e.preventDefault(); openExtPage('test-page.html'); });

  // Live storage sync if Options Dashboard modifies settings while popup is open
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled) globalToggle.checked = changes.enabled.newValue !== false;
    if (changes.riskyAliasMode) riskyAliasMode.value = changes.riskyAliasMode.newValue || 'context';
    if (changes.theme) themeSelect.value = changes.theme.newValue || 'auto';
    if (changes.bodyFont) bodyFont.value = changes.bodyFont.newValue || 'sans';
    if (changes.fontSize) fontSizeSelect.value = changes.fontSize.newValue || 'medium';
    if (changes.underlineStyle) underlineStyle.value = changes.underlineStyle.newValue || 'dotted';
    if (changes.underlineColor) underlineColor.value = changes.underlineColor.newValue || '#9f1239';
    if (changes.showExternalLinks) showExternalLinks.checked = changes.showExternalLinks.newValue !== false;
    if (changes.showSettingsButton) showSettingsButton.checked = changes.showSettingsButton.newValue !== false;
    if (changes.minimalistMode) minimalistMode.checked = Boolean(changes.minimalistMode.newValue);
    if (changes.disabledDomains && Array.isArray(changes.disabledDomains.newValue)) {
      disabledDomains = changes.disabledDomains.newValue;
      updateSiteToggleUI();
    }
    if (changes.disabledDocIds && Registry.setDisabledDocs) {
      Registry.setDisabledDocs(Array.isArray(changes.disabledDocIds.newValue) ? changes.disabledDocIds.newValue : []);
    }
    if (changes.installedPackRegistry) {
      const nextPacks = Array.isArray(changes.installedPackRegistry.newValue) ? changes.installedPackRegistry.newValue : [];
      if (Registry.setCustomPacks) Registry.setCustomPacks(nextPacks);
      if (installedPacksCount) {
        installedPacksCount.textContent = nextPacks.length === 1 ? '1 installed' : `${nextPacks.length} installed`;
      }
    }
  });

  // --- Organic Share & Rate Prompt System ---
  const STORE_ID = chrome.runtime?.id || '';
  const STORE_BASE_URL = STORE_ID
    ? `https://chromewebstore.google.com/detail/${STORE_ID}`
    : 'https://chromewebstore.google.com/search/Confession%20Hover';
  const STORE_REVIEWS_URL = STORE_ID ? `${STORE_BASE_URL}/reviews` : STORE_BASE_URL;
  const SHARE_TEXT = 'Check out Confession Hover — instant 0ms hover previews for historic Christian confessions, catechisms & creeds in your browser. 100% free with no ads!';

  const shareBanner = document.getElementById('shareBanner');
  const shareRateBtn = document.getElementById('shareRateBtn');
  const shareFriendsBtn = document.getElementById('shareFriendsBtn');
  const shareLinksDrawer = document.getElementById('shareLinksDrawer');
  const shareBannerDismissBtn = document.getElementById('shareBannerDismissBtn');
  const shareRemindLaterBtn = document.getElementById('shareRemindLaterBtn');
  const shareThanksNotice = document.getElementById('shareThanksNotice');
  const shareCopyLinkBtn = document.getElementById('shareCopyLinkBtn');
  const shareCopyText = document.getElementById('shareCopyText');
  const shareEmailBtn = document.getElementById('shareEmailBtn');
  const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
  const shareXBtn = document.getElementById('shareXBtn');

  async function checkAndRenderSharePrompt() {
    const data = await chrome.storage.local.get([
      'installDate',
      'lastPromptDate',
      'hasRatedOrShared',
      'confessionHoverCount'
    ]);

    if (data.hasRatedOrShared) {
      if (shareBanner) shareBanner.style.display = 'none';
      return;
    }

    const now = Date.now();
    let installDate = data.installDate;
    if (!installDate) {
      installDate = now;
      chrome.storage.local.set({ installDate: now });
    }

    const daysSinceInstall = (now - installDate) / (1000 * 60 * 60 * 24);
    const lastPrompt = data.lastPromptDate;
    const daysSinceLastPrompt = lastPrompt ? (now - lastPrompt) / (1000 * 60 * 60 * 24) : 9999;
    const hovers = data.confessionHoverCount || 0;

    let shouldShow = false;

    if (!lastPrompt) {
      // First prompt window once user has tested it (>= 5 hovers or >= 3 days installed)
      if (daysSinceInstall >= 3 || hovers >= 5) {
        shouldShow = true;
      }
    } else {
      // Annual recurring prompt: at least 365 days after the previous prompt
      if (daysSinceLastPrompt >= 365) {
        shouldShow = true;
      }
    }

    if (shouldShow && shareBanner) {
      shareBanner.style.display = 'block';
    }
  }

  function dismissPrompt() {
    if (!shareBanner) return;
    shareBanner.style.display = 'none';
    chrome.storage.local.set({
      lastPromptDate: Date.now()
    });
  }

  function handlePromptCompleted() {
    chrome.storage.local.set({
      hasRatedOrShared: true,
      lastPromptDate: Date.now()
    });
    const actions = document.getElementById('shareBannerActions');
    const footer = document.getElementById('shareBannerFooter');
    if (actions) actions.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (shareLinksDrawer) shareLinksDrawer.style.display = 'none';
    if (shareThanksNotice) shareThanksNotice.style.display = 'block';
    setTimeout(() => {
      if (shareBanner) shareBanner.style.display = 'none';
    }, 3500);
  }

  shareRateBtn?.addEventListener('click', () => {
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: STORE_REVIEWS_URL });
    } else {
      window.open(STORE_REVIEWS_URL, '_blank');
    }
    handlePromptCompleted();
  });

  shareFriendsBtn?.addEventListener('click', () => {
    if (shareLinksDrawer) {
      shareLinksDrawer.style.display = shareLinksDrawer.style.display === 'none' ? 'block' : 'none';
    }
  });

  shareCopyLinkBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT}\n${STORE_BASE_URL}`);
      if (shareCopyText) shareCopyText.textContent = 'Copied!';
      setTimeout(() => {
        if (shareCopyText) shareCopyText.textContent = 'Copy Link';
        handlePromptCompleted();
      }, 1000);
    } catch {
      handlePromptCompleted();
    }
  });

  shareEmailBtn?.addEventListener('click', () => {
    const subject = encodeURIComponent('Helpful free study tool: Confession Hover');
    const body = encodeURIComponent(`Hi!\n\nI've been using this free Chrome extension called Confession Hover. Whenever you hover over any confessional, catechism, or creed reference online (like WCF 1.2, Heidelberg Catechism 26, or Canons of Dort 1.7), it instantly shows the full text with zero delay.\n\nIt's completely free with no ads or tracking:\n${STORE_BASE_URL}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    handlePromptCompleted();
  });

  shareWhatsAppBtn?.addEventListener('click', () => {
    const text = encodeURIComponent(`Check out Confession Hover — free instant confession & catechism previews in your browser:\n${STORE_BASE_URL}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    handlePromptCompleted();
  });

  shareXBtn?.addEventListener('click', () => {
    const text = encodeURIComponent('Check out Confession Hover — instant 0ms hover previews for historic Christian confessions, catechisms & creeds in your browser. Free & open source:');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(STORE_BASE_URL)}`, '_blank');
    handlePromptCompleted();
  });

  shareBannerDismissBtn?.addEventListener('click', dismissPrompt);
  shareRemindLaterBtn?.addEventListener('click', dismissPrompt);

  checkAndRenderSharePrompt();
  window.checkAndRenderSharePrompt = checkAndRenderSharePrompt;
});
