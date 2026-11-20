/**
 * Confession Hover — Welcome Page Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const Registry = globalThis.ConfessionHoverRegistry || {};

  const wTheme = document.getElementById('wTheme');
  const wFont = document.getElementById('wFont');
  const wUnderline = document.getElementById('wUnderline');
  const welcomePreviewCard = document.getElementById('welcomePreviewCard');
  const wPreviewBadge = document.getElementById('wPreviewBadge');
  const wQTag = document.getElementById('wQTag');
  const wATag = document.getElementById('wATag');
  const welcomeCreedChips = document.getElementById('welcomeCreedChips');
  const welcomeCreedStatus = document.getElementById('welcomeCreedStatus');

  const stored = await chrome.storage.local.get([
    'theme', 'bodyFont', 'underlineStyle', 'underlineColor', 'installedPackRegistry'
  ]);

  const config = {
    theme: stored.theme || 'auto',
    bodyFont: stored.bodyFont || 'sans',
    underlineStyle: stored.underlineStyle || 'dotted',
    underlineColor: stored.underlineColor || '#9f1239',
    installedPackRegistry: Array.isArray(stored.installedPackRegistry) ? stored.installedPackRegistry : []
  };

  if (wTheme) wTheme.value = config.theme;
  if (wFont) wFont.value = config.bodyFont;
  if (wUnderline) wUnderline.value = config.underlineStyle;

  function renderPreview() {
    let effTheme = config.theme;
    if (effTheme === 'auto') {
      effTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (welcomePreviewCard) {
      welcomePreviewCard.className = `ch-preview-card theme-${effTheme} font-medium font-family-${config.bodyFont}`;
    }
    const accent = config.underlineColor || '#9f1239';
    if (wPreviewBadge) wPreviewBadge.style.backgroundColor = accent;
    if (wQTag) wQTag.style.color = accent;
    if (wATag) wATag.style.color = accent;
  }

  function savePatch(patch) {
    Object.assign(config, patch);
    renderPreview();
    chrome.storage.local.set(patch);
  }

  wTheme?.addEventListener('change', () => savePatch({ theme: wTheme.value }));
  wFont?.addEventListener('change', () => savePatch({ bodyFont: wFont.value }));
  wUnderline?.addEventListener('change', () => savePatch({ underlineStyle: wUnderline.value }));
  document.querySelectorAll('.swatch').forEach(s => {
    s.addEventListener('click', () => savePatch({ underlineColor: s.dataset.color }));
  });
  renderPreview();

  // Render Ecumenical Creeds quick-add chips
  function renderCreedChips() {
    if (!welcomeCreedChips || !Registry.COMMUNITY_PACK_CATALOG) return;
    welcomeCreedChips.innerHTML = '';
    const installedIds = new Set((config.installedPackRegistry || []).map(p => p.id));
    const creeds = Registry.COMMUNITY_PACK_CATALOG.filter(c => c.category === 'Ecumenical Creeds');

    for (const item of creeds) {
      const isInstalled = installedIds.has(item.id);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `pack-chip ${isInstalled ? 'installed' : ''}`;
      chip.innerHTML = `<span class="pack-chip-action">${isInstalled ? '✓' : '+'}</span><span>${item.name}</span><span class="pack-chip-year">${item.year}</span>`;

      chip.addEventListener('click', () => {
        if (chip.classList.contains('loading')) return;
        chip.classList.add('loading');
        welcomeCreedStatus.style.display = 'block';

        if (isInstalled) {
          welcomeCreedStatus.textContent = `Removing ${item.name}...`;
          chrome.runtime.sendMessage({ type: 'DELETE_PACK', id: item.id }, (res) => {
            chip.classList.remove('loading');
            if (res && res.ok) {
              config.installedPackRegistry = res.installedPackRegistry || [];
              welcomeCreedStatus.textContent = `Removed ${item.name}.`;
              renderCreedChips();
            }
          });
        } else {
          welcomeCreedStatus.textContent = `Adding ${item.name}...`;
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
              config.installedPackRegistry.push(res.descriptor);
              welcomeCreedStatus.textContent = `✓ ${item.name} added! Hover "${item.name}" anywhere on the web.`;
              renderCreedChips();
            } else {
              welcomeCreedStatus.textContent = `Could not add ${item.name}: ${res?.error || 'Network error'}`;
            }
          });
        }
      });
      welcomeCreedChips.appendChild(chip);
    }
  }
  renderCreedChips();

  // Navigation buttons
  const openDash = (hash = '') => chrome.tabs.create({ url: chrome.runtime.getURL(`options/options.html${hash}`) });
  const openTest = () => chrome.tabs.create({ url: chrome.runtime.getURL('test-page.html') });

  document.getElementById('openDashboardBtn')?.addEventListener('click', () => openDash());
  document.getElementById('bottomDashboardBtn')?.addEventListener('click', () => openDash());
  document.getElementById('openPacksTabBtn')?.addEventListener('click', () => openDash('#packs'));
  document.getElementById('launchVerifyBtn')?.addEventListener('click', openTest);
  document.getElementById('bottomLaunchBtn')?.addEventListener('click', openTest);

  const welcomeRateBtn = document.getElementById('welcomeRateBtn');
  welcomeRateBtn?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ hasRatedOrShared: true, lastPromptDate: Date.now() });
    }
  });
});
