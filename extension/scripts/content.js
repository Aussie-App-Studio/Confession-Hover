/**
 * Confession Hover — Content Script
 * High-performance non-destructive DOM citation scanner (TreeWalker + MutationObserver)
 * Isolated Shadow DOM Hover Card + Full-Context / Commentary-Placeholder Side Drawer.
 */

(function () {
  'use strict';

  if (window.__CONFESSION_HOVER_INITIALIZED__) return;
  window.__CONFESSION_HOVER_INITIALIZED__ = true;

  const Registry =
    (typeof window !== 'undefined' ? window.ConfessionHoverRegistry : null) ||
    globalThis.ConfessionHoverRegistry ||
    {};

  // Configuration state (synced with chrome.storage.local)
  let config = {
    enabled: true,
    scanMode: 'auto', // 'auto' | 'selection'
    theme: 'auto',
    fontSize: 'medium',
    bodyFont: 'sans',
    underlineStyle: 'dotted',
    underlineColor: '#9f1239',
    hoverDelay: 120,
    minimalistMode: false,
    showExternalLinks: true,
    showSettingsButton: true,
    riskyAliasMode: 'context', // 'context' | 'strict' | 'always'
    disabledDocIds: [],
    disabledDomains: [
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
    ],
    installedPackRegistry: []
  };
  const CONFIG_KEYS = Object.keys(config);
  const CONFIG_KEY_SET = new Set(CONFIG_KEYS);

  // Runtime state
  let isSiteDisabled = false;
  let detectedRefCount = 0;
  let observer = null;
  let bodySwapObserver = null;
  let observedBody = null;
  let cachedPageContext = null;
  let cachedContextUrl = '';

  // Shadow DOM & Tooltip controller state
  let hostEl = null;
  let shadowRoot = null;
  let tooltipEl = null;
  let drawerEl = null;
  let backdropEl = null;
  let activeTarget = null;
  let currentRefData = null;
  let resCachedEntry = null;
  let showTimer = null;
  let hideTimer = null;
  let isMouseOverTooltip = false;
  let isMouseOverTarget = false;
  let showingFullContext = false;
  let isDrawerOpen = false;
  let activeDrawerTab = 'context';

  const IGNORE_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT',
    'CODE', 'PRE', 'KBD', 'SAMP', 'VAR', 'OUTPUT', 'BUTTON',
    'SVG', 'svg', 'MATH', 'math', 'CANVAS', 'IFRAME', 'VIDEO', 'AUDIO'
  ]);

  const IGNORE_CLASSES = new Set([
    // Confession Hover & Bible Hover coexistence guards
    'ch-ref', 'ch-preview-card', 'no-ch-scan',
    'bh-ref', 'bh-preview-card', 'w-preview-box', 'no-bh-scan',
    // Code & Rich-text editors
    'monaco-editor', 'monaco-diff-editor', 'monaco-mouse-cursor-text', 'view-lines', 'view-line',
    'CodeMirror', 'cm-editor', 'cm-content', 'cm-scroller', 'cm-line',
    'ace_editor', 'ace_content', 'ace_text-layer',
    'kix-appview-editor', 'kix-canvas-tile-content', 'kix-page', 'kix-paginateddocumentplugin',
    'docs-editor', 'docs-editor-container', 'waffle-grid-container',
    'ql-editor', 'ql-container', 'DraftEditor-root', 'DraftEditor-editorContainer', 'public-DraftEditor-content',
    'ProseMirror', 'ck-editor', 'ck-content', 'mce-content-body', 'tox-edit-area', 'fr-element', 'fr-wrapper',
    'blob-code', 'blob-code-inner', 'react-code-text', 'react-code-lines', 'diff-table', 'hljs'
  ]);

  function shouldIgnoreElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (IGNORE_TAGS.has(el.nodeName)) return true;
    if (el.isContentEditable) return true;
    if (el.id === 'confession-hover-root' || el.id === 'bible-hover-root' || el.id === 'welcomePreviewCard') {
      return true;
    }

    const cl = el.classList;
    if (cl && cl.length > 0) {
      for (let i = 0; i < cl.length; i++) {
        if (IGNORE_CLASSES.has(cl[i])) return true;
      }
    }

    if (typeof el.getAttribute === 'function') {
      const ce = el.getAttribute('contenteditable');
      if (ce === 'true' || ce === '' || ce === 'plaintext-only') return true;
      const role = el.getAttribute('role');
      if (role === 'textbox' || role === 'code') return true;
      if (el.hasAttribute('data-slate-editor') || el.hasAttribute('data-lexical-editor')) return true;
    }

    return false;
  }

  function hasIgnoredAncestor(el, cache) {
    if (!cache) {
      let cur = el;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        if (shouldIgnoreElement(cur)) return true;
        cur = cur.parentElement;
      }
      return false;
    }

    const visited = [];
    let cur = el;
    let ignored = false;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const cached = cache.get(cur);
      if (cached !== undefined) {
        ignored = cached;
        break;
      }
      visited.push(cur);
      if (shouldIgnoreElement(cur)) {
        ignored = true;
        break;
      }
      cur = cur.parentElement;
    }
    for (let i = 0; i < visited.length; i++) {
      cache.set(visited[i], ignored);
    }
    return ignored;
  }

  function isPublishedGoogleDoc(host, pathname) {
    return (host === 'docs.google.com' || host.endsWith('.docs.google.com')) &&
      /\/pub(html)?(\/|$)/i.test(pathname || '');
  }

  function checkSiteDisabled(disabledDomains) {
    if (!Array.isArray(disabledDomains)) return false;
    const host = window.location.hostname.toLowerCase();
    const publishedDoc = isPublishedGoogleDoc(host, window.location.pathname);
    return disabledDomains.some(d => {
      const clean = String(d || '').toLowerCase().trim();
      if (!clean) return false;
      if (clean === 'docs.google.com/pub') return publishedDoc;
      if (publishedDoc && (clean === 'docs.google.com' || clean === 'googledocs.com')) return false;
      return host === clean || host.endsWith('.' + clean) || clean === 'www.' + host;
    });
  }

  function disconnectObservers() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (bodySwapObserver) {
      bodySwapObserver.disconnect();
      bodySwapObserver = null;
    }
    observedBody = null;
  }

  function safeSendMessage(msg, callback) {
    if (!chrome.runtime?.id) {
      disconnectObservers();
      return;
    }
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) return;
        if (callback) callback(response);
      });
    } catch {
      disconnectObservers();
    }
  }

  function syncRegistryFromConfig() {
    if (Registry.setCustomPacks) {
      Registry.setCustomPacks(config.installedPackRegistry || []);
    }
    if (Registry.setDisabledDocs) {
      Registry.setDisabledDocs(config.disabledDocIds || []);
    }
  }

  function getPageContext() {
    const currentUrl = location.href;
    if (cachedPageContext && cachedContextUrl === currentUrl) {
      return cachedPageContext;
    }
    cachedContextUrl = currentUrl;
    const title = document.title || '';
    const primaryEl = document.querySelector('article, main, [role="main"]') || document.body;
    const bodyText = primaryEl ? (primaryEl.innerText || primaryEl.textContent || '').slice(0, 12000) : '';
    cachedPageContext = Registry.analyzePageContext
      ? Registry.analyzePageContext(`${title}\n${bodyText}`)
      : { hasTheologicalContext: false, hasTechWcfContext: false };
    return cachedPageContext;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatProseHtml(text) {
    const clean = String(text || '').trim();
    if (!clean) return '';
    return clean
      .split(/\n{2,}/)
      .map(p => `<p class="ch-para">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  // --- Shadow DOM Initialization ---
  function initShadowHost() {
    if (hostEl) {
      if (!hostEl.isConnected && document.body) {
        document.body.appendChild(hostEl);
      }
      return;
    }

    hostEl = document.createElement('div');
    hostEl.id = 'confession-hover-root';
    hostEl.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    shadowRoot = hostEl.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        --ch-accent: #9f1239;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      * { box-sizing: border-box; }

      .ch-tooltip {
        position: fixed;
        width: 455px;
        max-width: calc(100vw - 32px);
        max-height: min(500px, calc(100vh - 24px));
        border-radius: 12px;
        box-shadow: 0 14px 36px -4px rgba(0, 0, 0, 0.24), 0 4px 12px rgba(0, 0, 0, 0.12);
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(6px) scale(0.98);
        transition: opacity 0.15s ease, transform 0.15s ease;
        visibility: hidden;
        overflow: hidden;
        border: 1px solid rgba(0, 0, 0, 0.1);
        line-height: 1.55;
        font-size: 14px;
      }
      .ch-tooltip.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
        visibility: visible;
      }

      /* Themes */
      .ch-tooltip.theme-light, .ch-drawer.theme-light {
        background: #ffffff;
        color: #1f2937;
        border-color: #e5e7eb;
      }
      .ch-tooltip.theme-light .ch-header, .ch-drawer.theme-light .ch-drawer-header {
        background: #fafaf9;
        border-bottom: 1px solid #e7e5e4;
      }
      .ch-tooltip.theme-light .ch-subbar {
        background: #f5f5f4;
        color: #57534e;
        border-bottom: 1px solid #e7e5e4;
      }
      .ch-tooltip.theme-light .ch-footer {
        background: #fafaf9;
        border-top: 1px solid #e7e5e4;
      }

      .ch-tooltip.theme-dark, .ch-drawer.theme-dark {
        background: #18181b;
        color: #e4e4e7;
        border-color: #27272a;
      }
      .ch-tooltip.theme-dark .ch-header, .ch-drawer.theme-dark .ch-drawer-header {
        background: #1f1f23;
        border-bottom: 1px solid #27272a;
      }
      .ch-tooltip.theme-dark .ch-subbar {
        background: #232329;
        color: #a1a1aa;
        border-bottom: 1px solid #27272a;
      }
      .ch-tooltip.theme-dark .ch-footer {
        background: #1f1f23;
        border-top: 1px solid #27272a;
      }

      .ch-tooltip.theme-sepia, .ch-drawer.theme-sepia {
        background: #fdf6e2;
        color: #433422;
        border-color: #e6dcbe;
      }
      .ch-tooltip.theme-sepia .ch-header, .ch-drawer.theme-sepia .ch-drawer-header {
        background: #f7edd4;
        border-bottom: 1px solid #e6dcbe;
      }
      .ch-tooltip.theme-sepia .ch-subbar {
        background: #f3e6c5;
        color: #6b5335;
        border-bottom: 1px solid #e6dcbe;
      }
      .ch-tooltip.theme-sepia .ch-footer {
        background: #f7edd4;
        border-top: 1px solid #e6dcbe;
      }

      /* Font Sizes */
      .ch-tooltip.font-small { font-size: 13px; }
      .ch-tooltip.font-small .ch-ref-title { font-size: 14px; }
      .ch-tooltip.font-medium { font-size: 14.5px; }
      .ch-tooltip.font-medium .ch-ref-title { font-size: 15.5px; }
      .ch-tooltip.font-large { font-size: 16px; }
      .ch-tooltip.font-large .ch-ref-title { font-size: 17px; }

      /* Typography Stacks */
      .ch-tooltip.font-family-sans .ch-body, .ch-drawer.font-family-sans .ch-drawer-body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .ch-tooltip.font-family-serif .ch-body, .ch-drawer.font-family-serif .ch-drawer-body {
        font-family: Georgia, "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif;
        line-height: 1.68;
      }
      .ch-tooltip.font-family-garamond .ch-body, .ch-drawer.font-family-garamond .ch-drawer-body {
        font-family: Garamond, "EB Garamond", "Baskerville", "Times New Roman", serif;
        line-height: 1.7;
      }
      .ch-tooltip.font-family-humanist .ch-body, .ch-drawer.font-family-humanist .ch-drawer-body {
        font-family: "Candara", "Calibri", "Segoe UI", Optima, Arial, sans-serif;
        line-height: 1.65;
      }
      .ch-tooltip.font-family-dyslexic .ch-body, .ch-drawer.font-family-dyslexic .ch-drawer-body {
        font-family: "OpenDyslexic", "Comic Sans MS", "Verdana", sans-serif;
        letter-spacing: 0.04em;
        word-spacing: 0.08em;
        line-height: 1.82;
      }
      .ch-tooltip.font-family-mono .ch-body, .ch-drawer.font-family-mono .ch-drawer-body {
        font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace;
        font-size: 0.93em;
        line-height: 1.6;
      }

      /* Header */
      .ch-header {
        padding: 10px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        user-select: none;
        flex-shrink: 0;
        gap: 8px;
      }
      .ch-title-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
      }
      .ch-ref-title {
        font-weight: 700;
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        user-select: text;
        cursor: text;
      }
      .ch-badge {
        font-size: 10.5px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: var(--ch-accent);
        color: #ffffff;
        flex-shrink: 0;
      }
      .ch-subbar {
        padding: 5px 14px;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex-shrink: 0;
      }

      .ch-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }
      .ch-btn {
        background: transparent;
        border: none;
        outline: none;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 500;
        color: inherit;
        text-decoration: none;
        opacity: 0.75;
        transition: opacity 0.15s, background-color 0.15s;
      }
      .ch-btn:hover {
        opacity: 1;
        background-color: rgba(128, 128, 128, 0.15);
      }
      .ch-btn svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        stroke-width: 2;
        fill: none;
      }

      .ch-settings-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
      }
      .ch-settings-tooltip {
        position: absolute;
        top: calc(100% + 7px);
        right: -4px;
        background: #111827;
        color: #f9fafb;
        padding: 6px 10px;
        border-radius: 7px;
        font-size: 11px;
        line-height: 1.35;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-4px);
        transition: opacity 0.15s ease, transform 0.15s ease;
        box-shadow: 0 8px 20px -2px rgba(0, 0, 0, 0.35);
        z-index: 1000;
        text-align: right;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }
      .ch-settings-wrapper:hover .ch-settings-tooltip {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
      .ch-settings-tooltip-title { font-weight: 600; font-size: 11.5px; color: #fff; }
      .ch-settings-tooltip-sub { font-size: 10px; color: #9ca3af; margin-top: 1px; }

      /* Minimalist Mode */
      .ch-tooltip.ch-minimalist {
        width: 400px;
        box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      .ch-tooltip.ch-minimalist .ch-actions,
      .ch-tooltip.ch-minimalist .ch-badge,
      .ch-tooltip.ch-minimalist .ch-subbar,
      .ch-tooltip.ch-minimalist .ch-footer {
        display: none !important;
      }
      .ch-tooltip.ch-minimalist .ch-header {
        padding: 9px 14px 3px 14px;
        border-bottom: none;
        background: transparent;
      }
      .ch-tooltip.ch-minimalist .ch-ref-title {
        font-size: 13.5px;
        opacity: 0.88;
      }
      .ch-tooltip.ch-minimalist .ch-body {
        padding: 4px 14px 14px 14px;
        cursor: pointer;
        user-select: text;
      }

      /* Body Content */
      .ch-body {
        padding: 13px 16px;
        overflow-y: auto;
        flex: 1 1 auto;
        min-height: 0;
        overscroll-behavior: contain;
      }
      .ch-body::-webkit-scrollbar, .ch-drawer-body::-webkit-scrollbar { width: 6px; }
      .ch-body::-webkit-scrollbar-thumb, .ch-drawer-body::-webkit-scrollbar-thumb {
        background: rgba(128, 128, 128, 0.3);
        border-radius: 3px;
      }

      .ch-entry-item {
        margin-bottom: 12px;
        padding: 2px 4px;
        border-radius: 6px;
      }
      .ch-entry-item:last-child { margin-bottom: 0; }
      .ch-entry-item.highlight {
        background: rgba(159, 18, 57, 0.11);
        border-left: 3px solid var(--ch-accent);
        padding: 6px 10px;
      }
      .ch-tooltip.theme-dark .ch-entry-item.highlight,
      .ch-drawer.theme-dark .ch-entry-item.highlight {
        background: rgba(251, 113, 133, 0.12);
      }

      .ch-entry-label {
        display: inline-block;
        font-weight: 700;
        font-size: 0.84em;
        color: var(--ch-accent);
        margin-right: 6px;
        user-select: none;
      }
      .ch-tooltip.theme-dark .ch-entry-label,
      .ch-drawer.theme-dark .ch-entry-label {
        color: #fb7185;
      }
      .ch-entry-label.is-rejection {
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(185, 28, 28, 0.12);
        color: #b91c1c;
      }
      .ch-tooltip.theme-dark .ch-entry-label.is-rejection,
      .ch-drawer.theme-dark .ch-entry-label.is-rejection {
        background: rgba(248, 113, 113, 0.16);
        color: #fca5a5;
      }
      .ch-para {
        margin: 0 0 8px 0;
      }
      .ch-para:last-child { margin-bottom: 0; }

      .ch-qa-block {
        margin-bottom: 14px;
        padding: 2px 4px;
        border-radius: 6px;
      }
      .ch-qa-block:last-child { margin-bottom: 0; }
      .ch-qa-block.highlight {
        background: rgba(159, 18, 57, 0.11);
        border-left: 3px solid var(--ch-accent);
        padding: 8px 10px;
      }
      .ch-question {
        font-weight: 700;
        margin-bottom: 6px;
        line-height: 1.45;
      }
      .ch-q-tag, .ch-a-tag {
        color: var(--ch-accent);
        font-weight: 800;
        margin-right: 4px;
      }
      .ch-tooltip.theme-dark .ch-q-tag,
      .ch-tooltip.theme-dark .ch-a-tag,
      .ch-drawer.theme-dark .ch-q-tag,
      .ch-drawer.theme-dark .ch-a-tag {
        color: #fb7185;
      }
      .ch-answer {
        line-height: 1.58;
      }

      /* Loading / Error */
      .ch-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 24px 0;
        opacity: 0.75;
      }
      .ch-spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(128, 128, 128, 0.3);
        border-top-color: var(--ch-accent);
        border-radius: 50%;
        animation: ch-spin 0.6s linear infinite;
      }
      @keyframes ch-spin { to { transform: rotate(360deg); } }
      .ch-error {
        color: #ef4444;
        padding: 16px 0;
        text-align: center;
        font-size: 13px;
      }

      /* Footer */
      .ch-footer {
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11.5px;
        user-select: none;
        flex-shrink: 0;
        gap: 8px;
        flex-wrap: wrap;
      }
      .ch-footer-left {
        opacity: 0.75;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 170px;
      }
      .ch-footer-right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .ch-link-btn {
        color: var(--ch-accent);
        text-decoration: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 600;
        font-size: 11px;
        white-space: nowrap;
        padding: 3px 9px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.04);
        border: 1px solid rgba(0, 0, 0, 0.08);
        transition: all 0.15s ease;
      }
      .ch-link-btn:hover {
        background: rgba(159, 18, 57, 0.11);
        border-color: rgba(159, 18, 57, 0.3);
      }
      .ch-tooltip.theme-dark .ch-link-btn,
      .ch-drawer.theme-dark .ch-link-btn {
        color: #fda4af;
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.12);
      }
      .ch-tooltip.theme-dark .ch-link-btn:hover,
      .ch-drawer.theme-dark .ch-link-btn:hover {
        background: rgba(251, 113, 133, 0.2);
        border-color: rgba(251, 113, 133, 0.4);
      }
      .ch-tooltip.theme-sepia .ch-link-btn,
      .ch-drawer.theme-sepia .ch-link-btn {
        color: #881337;
        background: rgba(136, 19, 55, 0.06);
        border-color: rgba(136, 19, 55, 0.14);
      }

      /* Side Drawer Backdrop & Drawer */
      .ch-drawer-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.36);
        backdrop-filter: blur(2px);
        z-index: 2147483646;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.24s ease;
      }
      .ch-drawer-backdrop.open {
        opacity: 1;
        pointer-events: auto;
      }
      .ch-drawer {
        position: fixed;
        top: 0;
        right: 0;
        width: 520px;
        max-width: 92vw;
        height: 100vh;
        box-shadow: -8px 0 32px rgba(0, 0, 0, 0.28);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        transform: translateX(105%);
        transition: transform 0.26s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto;
        border-left: 1px solid rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        line-height: 1.55;
      }
      .ch-drawer.open { transform: translateX(0); }
      .ch-drawer-header {
        padding: 13px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
        gap: 10px;
      }
      .ch-drawer-title-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .ch-drawer-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ch-drawer-title {
        font-size: 15.5px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ch-drawer-subtitle {
        font-size: 12px;
        opacity: 0.72;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ch-drawer-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }
      .ch-drawer-nav {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 18px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        flex-shrink: 0;
      }
      .ch-drawer.theme-dark .ch-drawer-nav {
        border-bottom-color: rgba(255, 255, 255, 0.08);
      }
      .ch-drawer-tab {
        background: none;
        border: 1px solid rgba(0, 0, 0, 0.14);
        border-radius: 14px;
        padding: 5px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        color: inherit;
        opacity: 0.8;
        transition: all 0.15s ease;
      }
      .ch-drawer.theme-dark .ch-drawer-tab {
        border-color: rgba(255, 255, 255, 0.16);
      }
      .ch-drawer-tab:hover { opacity: 1; border-color: var(--ch-accent); }
      .ch-drawer-tab.active {
        opacity: 1;
        background: var(--ch-accent);
        color: #ffffff;
        border-color: var(--ch-accent);
      }
      .ch-drawer-body {
        padding: 16px 20px;
        overflow-y: auto;
        flex: 1;
      }

      /* Commentary v2 Placeholder Card in Drawer */
      .ch-placeholder-card {
        padding: 20px;
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.025);
        border: 1px solid rgba(0, 0, 0, 0.08);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .ch-drawer.theme-dark .ch-placeholder-card {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.1);
      }
      .ch-placeholder-badge {
        align-self: flex-start;
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 3px 8px;
        border-radius: 6px;
        background: rgba(159, 18, 57, 0.12);
        color: var(--ch-accent);
      }
      .ch-drawer.theme-dark .ch-placeholder-badge {
        background: rgba(251, 113, 133, 0.15);
        color: #fda4af;
      }
      .ch-placeholder-title { font-size: 16px; font-weight: 700; margin: 0; }
      .ch-placeholder-desc { font-size: 13.5px; line-height: 1.62; opacity: 0.88; margin: 0; }
      .ch-placeholder-list {
        margin: 0;
        padding-left: 18px;
        font-size: 13px;
        line-height: 1.65;
        opacity: 0.85;
      }
      .ch-drawer-btn-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
      .ch-drawer-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 7px;
        font-size: 12.5px;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .ch-drawer-btn.primary { background: var(--ch-accent); color: #ffffff; }
      .ch-drawer-btn.secondary {
        background: transparent;
        color: inherit;
        border-color: rgba(128, 128, 128, 0.3);
      }
      .ch-drawer-pager {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 18px;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        flex-shrink: 0;
      }
      .ch-drawer.theme-dark .ch-drawer-pager {
        border-top-color: rgba(255, 255, 255, 0.09);
      }
      .ch-drawer.theme-sepia .ch-drawer-pager {
        border-top-color: rgba(180, 145, 95, 0.25);
      }
      .ch-drawer-pager-btn {
        background: transparent;
        border: 1px solid rgba(128, 128, 128, 0.28);
        border-radius: 7px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        color: var(--ch-accent);
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .ch-drawer-pager-btn:hover {
        background: var(--ch-accent);
        color: #ffffff;
        border-color: var(--ch-accent);
      }
      .ch-drawer.theme-dark .ch-drawer-pager-btn {
        color: #fda4af;
        border-color: rgba(255, 255, 255, 0.16);
      }
      .ch-drawer.theme-dark .ch-drawer-pager-btn:hover {
        color: #ffffff;
        border-color: var(--ch-accent);
      }
    `;
    shadowRoot.appendChild(style);

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'ch-tooltip';
    tooltipEl.innerHTML = `
      <div class="ch-header">
        <div class="ch-title-group">
          <span class="ch-ref-title">Reference</span>
          <span class="ch-badge" id="chBadge">CONF</span>
        </div>
        <div class="ch-actions">
          <button class="ch-btn" id="chCopyBtn" title="Copy text">
            <svg viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            <span id="chCopyText" style="margin-left:4px;">Copy</span>
          </button>
          <div class="ch-settings-wrapper" id="chSettingsWrapper">
            <button class="ch-btn" id="chSettingsBtn" aria-label="Confession Hover Settings" title="Confession Hover Settings">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
              </svg>
            </button>
            <div class="ch-settings-tooltip">
              <div class="ch-settings-tooltip-title">Settings &amp; Packs</div>
              <div class="ch-settings-tooltip-sub">Can be hidden in Settings</div>
            </div>
          </div>
          <button class="ch-btn" id="chCloseBtn" title="Close (Esc)">
            <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="ch-subbar" id="chSubbar" style="display:none;"></div>
      <div class="ch-body" id="chBody"></div>
      <div class="ch-footer" id="chFooter">
        <div class="ch-footer-left" id="chFooterLeft"></div>
        <div class="ch-footer-right" id="chFooterRight"></div>
      </div>
    `;
    shadowRoot.appendChild(tooltipEl);

    backdropEl = document.createElement('div');
    backdropEl.className = 'ch-drawer-backdrop';
    backdropEl.addEventListener('click', closeReaderDrawer);
    shadowRoot.appendChild(backdropEl);

    drawerEl = document.createElement('div');
    drawerEl.className = 'ch-drawer';
    drawerEl.innerHTML = `
      <div class="ch-drawer-header">
        <div class="ch-drawer-title-group">
          <div class="ch-drawer-title-row">
            <span class="ch-drawer-title" id="chDrawerTitle">Confessional Reader</span>
            <span class="ch-badge" id="chDrawerBadge">CONF</span>
          </div>
          <div class="ch-drawer-subtitle" id="chDrawerSubtitle"></div>
        </div>
        <div class="ch-drawer-actions">
          <button class="ch-btn" id="chDrawerCopyBtn" title="Copy section">
            <svg viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            <span id="chDrawerCopyText" style="margin-left:4px;">Copy</span>
          </button>
          <button class="ch-btn" id="chDrawerSettingsBtn" title="Open Settings">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"></path></svg>
          </button>
          <button class="ch-btn" id="chDrawerCloseBtn" title="Close Drawer (Esc)">
            <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="ch-drawer-nav" id="chDrawerNav">
        <button class="ch-drawer-tab active" data-tab="context">📖 Full Context</button>
        <button class="ch-drawer-tab" data-tab="commentaries">💬 Commentaries</button>
      </div>
      <div class="ch-drawer-body" id="chDrawerBody"></div>
      <div class="ch-drawer-pager" id="chDrawerPager" style="display:none;"></div>
    `;
    shadowRoot.appendChild(drawerEl);
    document.body.appendChild(hostEl);

    applyAccentColor();
    updateSettingsButtonVisibility();

    // Events
    tooltipEl.addEventListener('mouseenter', () => {
      isMouseOverTooltip = true;
      clearTimeout(hideTimer);
    });
    tooltipEl.addEventListener('mouseleave', () => {
      isMouseOverTooltip = false;
      scheduleHideTooltip();
    });

    shadowRoot.getElementById('chCloseBtn').addEventListener('click', () => hideTooltip(true));
    shadowRoot.getElementById('chCopyBtn').addEventListener('click', handleCopyEntry);
    shadowRoot.getElementById('chBody').addEventListener('click', () => {
      if (config.minimalistMode && !window.getSelection()?.toString().trim()) {
        handleCopyEntry();
      }
    });

    const openOpts = (e) => {
      e.stopPropagation();
      e.preventDefault();
      safeSendMessage({ type: 'OPEN_OPTIONS' });
    };
    shadowRoot.getElementById('chSettingsBtn')?.addEventListener('click', openOpts);
    shadowRoot.getElementById('chDrawerSettingsBtn')?.addEventListener('click', openOpts);
    shadowRoot.getElementById('chDrawerCloseBtn')?.addEventListener('click', closeReaderDrawer);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isDrawerOpen) closeReaderDrawer();
        else hideTooltip(true);
      }
    });

    window.addEventListener('scroll', () => {
      if (activeTarget && tooltipEl && tooltipEl.classList.contains('visible')) {
        positionTooltip(activeTarget);
      }
    }, { passive: true });

    window.addEventListener('resize', () => {
      if (activeTarget && tooltipEl && tooltipEl.classList.contains('visible')) {
        positionTooltip(activeTarget);
      }
    }, { passive: true });
  }

  function applyAccentColor() {
    if (!hostEl) return;
    hostEl.style.setProperty('--ch-accent', config.underlineColor || '#9f1239');
  }

  function updateSettingsButtonVisibility() {
    const wrapper = shadowRoot?.getElementById('chSettingsWrapper');
    if (wrapper) {
      wrapper.style.display = (config.showSettingsButton !== false && !config.minimalistMode) ? 'inline-flex' : 'none';
    }
    const drawerBtn = shadowRoot?.getElementById('chDrawerSettingsBtn');
    if (drawerBtn) {
      drawerBtn.style.display = (config.showSettingsButton !== false) ? 'inline-flex' : 'none';
    }
  }

  function resolveTheme() {
    if (config.theme === 'auto') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return config.theme || 'light';
  }

  function positionTooltip(target) {
    if (!tooltipEl || !target) return;
    const rect = target.getBoundingClientRect();
    const ttWidth = tooltipEl.offsetWidth || 455;
    const ttHeight = tooltipEl.offsetHeight || 260;
    const padding = 12;

    let top = rect.bottom + 8;
    let left = rect.left;

    if (top + ttHeight > window.innerHeight - padding) {
      const topAbove = rect.top - ttHeight - 8;
      if (topAbove >= padding) top = topAbove;
      else top = Math.max(padding, window.innerHeight - ttHeight - padding);
    }

    if (left + ttWidth > window.innerWidth - padding) {
      left = window.innerWidth - ttWidth - padding;
    }
    if (left < padding) left = padding;

    tooltipEl.style.top = `${Math.round(top)}px`;
    tooltipEl.style.left = `${Math.round(left)}px`;
  }

  function renderItemsIntoContainer(containerEl, data, highlightKeys = null) {
    containerEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    let firstHighlight = null;

    for (const item of data.items || []) {
      const isHL = highlightKeys && highlightKeys.has(item.key);
      if (data.structure === 'catechism') {
        const block = document.createElement('div');
        block.className = `ch-qa-block ${isHL ? 'highlight' : ''}`;
        block.innerHTML = `
          ${item.question ? `<div class="ch-question"><span class="ch-q-tag">Q.${escapeHtml(item.number)}</span> ${escapeHtml(item.question)}</div>` : ''}
          <div class="ch-answer">${item.question ? '<span class="ch-a-tag">A.</span> ' : `<span class="ch-q-tag">${escapeHtml(item.number)}.</span> `}${formatProseHtml(item.answer)}</div>
        `;
        frag.appendChild(block);
        if (isHL && !firstHighlight) firstHighlight = block;
      } else {
        const block = document.createElement('div');
        block.className = `ch-entry-item ${isHL ? 'highlight' : ''}`;
        const labelHtml = item.label
          ? `<span class="ch-entry-label ${item.kind === 'rejection' ? 'is-rejection' : ''}">${escapeHtml(item.label)}</span>`
          : '';
        const titleHtml = (data.structure === 'article' && item.title && data.items.length > 1)
          ? `<strong>${escapeHtml(item.title)}:</strong> `
          : '';
        block.innerHTML = `${labelHtml}${titleHtml}${formatProseHtml(item.text)}`;
        frag.appendChild(block);
        if (isHL && !firstHighlight) firstHighlight = block;
      }
    }

    containerEl.appendChild(frag);
    if (firstHighlight) {
      requestAnimationFrame(() => {
        const topOffset = firstHighlight.offsetTop - containerEl.offsetTop;
        containerEl.scrollTop = Math.max(0, topOffset - 40);
      });
    }
  }

  function updateCardFooter(res) {
    const footerLeft = shadowRoot.getElementById('chFooterLeft');
    const footerRight = shadowRoot.getElementById('chFooterRight');
    if (!footerRight || !res) return;

    footerLeft.textContent = res.year ? `${res.docName} (${res.year})` : res.docName;
    footerRight.innerHTML = '';

    // Inline Full Context toggle (when available and not already single creed or full chapter/head/LD)
    if (res.contextInfo && res.structure !== 'creed') {
      if (!res.isFullContextAlready) {
        const ctxToggle = document.createElement('span');
        ctxToggle.className = 'ch-link-btn';
        ctxToggle.textContent = showingFullContext ? 'Cited Only' : res.contextInfo.label;
        ctxToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleInlineContext();
        });
        footerRight.appendChild(ctxToggle);
      }

      const drawerBtn = document.createElement('span');
      drawerBtn.className = 'ch-link-btn';
      drawerBtn.textContent = '📖 Reader Drawer';
      drawerBtn.title = 'Open full-height reader & commentary drawer';
      drawerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openReaderDrawer(res);
      });
      footerRight.appendChild(drawerBtn);
    }

    if (config.showExternalLinks !== false) {
      const extUrl = res.externalUrl || res.sourceUrl;
      if (extUrl && /^https?:\/\//i.test(extUrl)) {
        const link = document.createElement('a');
        link.className = 'ch-link-btn';
        link.href = extUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Read Online ↗';
        footerRight.appendChild(link);
      }
    }
  }

  function loadConfessionEntry(parsedRef) {
    const body = shadowRoot.getElementById('chBody');
    const badge = shadowRoot.getElementById('chBadge');
    const subbar = shadowRoot.getElementById('chSubbar');

    body.innerHTML = `
      <div class="ch-loading">
        <div class="ch-spinner"></div>
        <span>Loading text...</span>
      </div>
    `;
    subbar.style.display = 'none';

    safeSendMessage({
      type: 'GET_CONFESSION_ENTRY',
      parsedRef
    }, (res) => {
      if (currentRefData !== parsedRef) return;
      if (!res || !res.ok) {
        body.innerHTML = `<div class="ch-error">${escapeHtml(res?.error || 'Could not load reference.')}</div>`;
        return;
      }

      resCachedEntry = res;
      badge.textContent = res.shortName || res.docId.toUpperCase();
      if (res.subtitle) {
        subbar.textContent = res.subtitle;
        subbar.style.display = 'block';
      } else {
        subbar.style.display = 'none';
      }

      updateCardFooter(res);
      renderItemsIntoContainer(body, res);
      if (activeTarget) positionTooltip(activeTarget);
    });
  }

  function toggleInlineContext() {
    if (!resCachedEntry || !resCachedEntry.contextInfo) return;
    const body = shadowRoot.getElementById('chBody');
    showingFullContext = !showingFullContext;

    if (!showingFullContext) {
      renderItemsIntoContainer(body, resCachedEntry);
      updateCardFooter(resCachedEntry);
      if (activeTarget) positionTooltip(activeTarget);
      return;
    }

    const highlightKeys = new Set((resCachedEntry.items || []).map(i => i.key));
    body.innerHTML = `<div class="ch-loading"><div class="ch-spinner"></div><span>Loading context...</span></div>`;
    updateCardFooter(resCachedEntry);

    safeSendMessage({
      type: 'GET_CONTEXT_GROUP',
      docId: resCachedEntry.docId,
      groupKey: resCachedEntry.contextInfo.groupKey
    }, (ctxRes) => {
      if (!showingFullContext || !ctxRes || !ctxRes.ok) {
        showingFullContext = false;
        renderItemsIntoContainer(body, resCachedEntry);
        updateCardFooter(resCachedEntry);
        return;
      }
      renderItemsIntoContainer(body, ctxRes, highlightKeys);
      if (activeTarget) positionTooltip(activeTarget);
    });
  }

  function buildCopyTextFromItems(data) {
    if (!data || !Array.isArray(data.items)) return '';
    const lines = data.items.map(item => {
      if (data.structure === 'catechism') {
        const q = item.question ? `Q.${item.number}: ${item.question}\n` : '';
        return `${q}A. ${item.answer}`;
      }
      const prefix = item.label ? `${item.label} ` : '';
      return `${prefix}${item.text}`;
    });
    return `${lines.join('\n\n')}\n— ${data.canonicalLabel || data.groupTitle || data.docName}`;
  }

  function handleCopyEntry() {
    if (!resCachedEntry) return;
    const textToCopy = buildCopyTextFromItems(resCachedEntry);
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      const copyText = shadowRoot.getElementById('chCopyText');
      if (copyText) {
        const orig = copyText.textContent;
        copyText.textContent = 'Copied!';
        setTimeout(() => { copyText.textContent = orig; }, 1400);
      }
      const titleEl = shadowRoot.querySelector('.ch-ref-title');
      if (titleEl && config.minimalistMode) {
        const origTitle = titleEl.textContent;
        titleEl.textContent = `${origTitle} • Copied!`;
        setTimeout(() => { titleEl.textContent = origTitle; }, 1400);
      }
    }).catch(() => {});
  }

  // --- Side Reader Drawer ---
  function openReaderDrawer(entryRes) {
    if (!drawerEl || !entryRes) return;
    hideTooltip(true);

    const theme = resolveTheme();
    const fontFam = `font-family-${config.bodyFont || 'sans'}`;
    drawerEl.className = `ch-drawer theme-${theme} ${fontFam} open`;
    backdropEl?.classList.add('open');
    isDrawerOpen = true;

    drawerEl.querySelector('#chDrawerTitle').textContent = entryRes.canonicalLabel || entryRes.docName;
    drawerEl.querySelector('#chDrawerBadge').textContent = entryRes.shortName || 'CONF';
    drawerEl.querySelector('#chDrawerSubtitle').textContent = entryRes.subtitle || entryRes.docName;

    const navEl = drawerEl.querySelector('#chDrawerNav');
    const bodyEl = drawerEl.querySelector('#chDrawerBody');
    const pagerEl = drawerEl.querySelector('#chDrawerPager');
    const copyBtnEl = drawerEl.querySelector('#chDrawerCopyBtn');
    const copyTextEl = drawerEl.querySelector('#chDrawerCopyText');
    const initialGroupKey = entryRes.contextInfo ? entryRes.contextInfo.groupKey : 'all';
    const highlightKeys = new Set((entryRes.items || []).map(i => i.key));
    let currentGroupKey = initialGroupKey;
    let loadedContextData = null;

    if (copyTextEl) copyTextEl.textContent = 'Copy';
    if (copyBtnEl) {
      clearTimeout(copyBtnEl._copyTimer);
      copyBtnEl.onclick = () => {
        const txt = buildCopyTextFromItems(loadedContextData || entryRes);
        if (!txt) return;
        navigator.clipboard.writeText(txt).then(() => {
          if (copyTextEl) {
            copyTextEl.textContent = '✓ Copied!';
            clearTimeout(copyBtnEl._copyTimer);
            copyBtnEl._copyTimer = setTimeout(() => { copyTextEl.textContent = 'Copy'; }, 1400);
          }
        }).catch(() => {});
      };
    }

    function renderDrawerPager(nav) {
      if (!pagerEl) return;
      if (activeDrawerTab !== 'context' || !nav || (!nav.prevKey && !nav.nextKey)) {
        pagerEl.style.display = 'none';
        pagerEl.innerHTML = '';
        return;
      }
      pagerEl.style.display = 'flex';
      pagerEl.innerHTML = `
        <button type="button" class="ch-drawer-pager-btn" id="chDrawerPrevBtn" ${nav.prevKey ? '' : 'disabled'}>${nav.prevKey ? escapeHtml(nav.prevLabel) : ''}</button>
        <button type="button" class="ch-drawer-pager-btn" id="chDrawerNextBtn" ${nav.nextKey ? '' : 'disabled'}>${nav.nextKey ? escapeHtml(nav.nextLabel) : ''}</button>
      `;
      const prevBtn = pagerEl.querySelector('#chDrawerPrevBtn');
      const nextBtn = pagerEl.querySelector('#chDrawerNextBtn');
      if (nav.prevKey && prevBtn) {
        prevBtn.addEventListener('click', () => loadGroupIntoDrawer(nav.prevKey, nav.prevKey === initialGroupKey));
      } else if (prevBtn) {
        prevBtn.style.visibility = 'hidden';
      }
      if (nav.nextKey && nextBtn) {
        nextBtn.addEventListener('click', () => loadGroupIntoDrawer(nav.nextKey, nav.nextKey === initialGroupKey));
      } else if (nextBtn) {
        nextBtn.style.visibility = 'hidden';
      }
    }

    function loadGroupIntoDrawer(groupKey, useHighlight) {
      currentGroupKey = groupKey;
      loadedContextData = null;
      bodyEl.innerHTML = `<div class="ch-loading"><div class="ch-spinner"></div><span>Loading full context...</span></div>`;
      renderDrawerPager(null);

      safeSendMessage({
        type: 'GET_CONTEXT_GROUP',
        docId: entryRes.docId,
        groupKey
      }, (ctxRes) => {
        if (!isDrawerOpen || currentGroupKey !== groupKey) return;
        if (activeDrawerTab !== 'context') return;
        if (!ctxRes || !ctxRes.ok) {
          renderItemsIntoContainer(bodyEl, entryRes);
          renderDrawerPager(null);
          return;
        }
        loadedContextData = ctxRes;
        drawerEl.querySelector('#chDrawerSubtitle').textContent = ctxRes.groupTitle || entryRes.docName;
        renderItemsIntoContainer(bodyEl, ctxRes, useHighlight ? highlightKeys : null);
        if (!useHighlight) bodyEl.scrollTop = 0;
        renderDrawerPager(ctxRes.nav);
      });
    }

    function renderDrawerTab(tab) {
      activeDrawerTab = tab;
      navEl.querySelectorAll('.ch-drawer-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });

      if (tab === 'context') {
        if (loadedContextData) {
          renderItemsIntoContainer(bodyEl, loadedContextData, currentGroupKey === initialGroupKey ? highlightKeys : null);
          renderDrawerPager(loadedContextData.nav);
          return;
        }
        loadGroupIntoDrawer(currentGroupKey, currentGroupKey === initialGroupKey);
      } else {
        renderDrawerPager(null);
        const extUrl = entryRes.externalUrl || entryRes.sourceUrl;
        const extBtnHtml = (config.showExternalLinks !== false && extUrl)
          ? `<a class="ch-drawer-btn primary" href="${escapeHtml(extUrl)}" target="_blank" rel="noopener noreferrer">Read Full Standard Online ↗</a>`
          : '';
        bodyEl.innerHTML = `
          <div class="ch-placeholder-card">
            <span class="ch-placeholder-badge">Coming in v2 • Roadmap</span>
            <h3 class="ch-placeholder-title">Confessional Commentaries &amp; Scripture Proofs</h3>
            <p class="ch-placeholder-desc">
              This reader drawer is ready for classic Reformed confessional expositions and interactive Scripture proof lookups in a future update, including:
            </p>
            <ul class="ch-placeholder-list">
              <li><strong>Heidelberg Catechism:</strong> Zacharias Ursinus' <em>Commentary on the Heidelberg Catechism</em></li>
              <li><strong>Westminster Confession:</strong> Robert Shaw's <em>Exposition</em> &amp; A.A. Hodge's <em>Commentary</em></li>
              <li><strong>Westminster Shorter Catechism:</strong> Thomas Vincent &amp; John Flavel expositions</li>
              <li><strong>Scripture Proof Popups:</strong> Clickable or hoverable proof-text integration</li>
            </ul>
            <div class="ch-drawer-btn-row">
              ${extBtnHtml}
              <button type="button" class="ch-drawer-btn secondary" id="chBackToCtxBtn">← Back to Full Context</button>
            </div>
          </div>
        `;
        bodyEl.querySelector('#chBackToCtxBtn')?.addEventListener('click', () => renderDrawerTab('context'));
      }
    }

    navEl.querySelectorAll('.ch-drawer-tab').forEach(btn => {
      btn.onclick = () => renderDrawerTab(btn.dataset.tab);
    });
    renderDrawerTab('context');
  }

  function closeReaderDrawer() {
    if (!drawerEl) return;
    drawerEl.classList.remove('open');
    backdropEl?.classList.remove('open');
    isDrawerOpen = false;
  }

  function showTooltipFor(target, parsedRef) {
    initShadowHost();
    applyAccentColor();
    updateSettingsButtonVisibility();

    activeTarget = target;
    currentRefData = parsedRef;
    resCachedEntry = null;
    showingFullContext = false;

    const theme = resolveTheme();
    const minClass = config.minimalistMode ? 'ch-minimalist' : '';
    const fontFam = `font-family-${config.bodyFont || 'sans'}`;
    tooltipEl.className = `ch-tooltip theme-${theme} font-${config.fontSize} ${fontFam} ${minClass}`.trim();

    shadowRoot.querySelector('.ch-ref-title').textContent = parsedRef.canonicalLabel;
    shadowRoot.getElementById('chBadge').textContent = parsedRef.shortName || parsedRef.docId.toUpperCase();

    tooltipEl.classList.add('visible');
    loadConfessionEntry(parsedRef);
    positionTooltip(target);
  }

  function scheduleHideTooltip() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isMouseOverTooltip && !isMouseOverTarget) {
        hideTooltip();
      }
    }, 200);
  }

  function hideTooltip() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (!tooltipEl) return;
    tooltipEl.classList.remove('visible');
    activeTarget = null;
  }

  // --- Dynamic Underline Styling ---
  let dynamicStyleEl = null;
  function updateDynamicUnderlineStyles() {
    if (!dynamicStyleEl) {
      if (detectedRefCount === 0) return;
      const targetHead = document.head || document.documentElement;
      if (!targetHead) return;
      dynamicStyleEl = document.createElement('style');
      dynamicStyleEl.id = 'confession-hover-dynamic-style';
      targetHead.appendChild(dynamicStyleEl);
    } else if (!dynamicStyleEl.isConnected) {
      const targetHead = document.head || document.documentElement;
      if (targetHead) targetHead.appendChild(dynamicStyleEl);
    }

    if (!config.enabled || isSiteDisabled) {
      dynamicStyleEl.textContent = `
        .ch-ref {
          text-decoration: none !important;
          background-color: transparent !important;
          cursor: inherit !important;
        }
      `;
      return;
    }

    const col = config.underlineColor || '#9f1239';
    let decoration = 'none';
    let background = 'transparent';

    switch (config.underlineStyle) {
      case 'dotted': decoration = `underline dotted ${col}`; break;
      case 'dashed': decoration = `underline dashed ${col}`; break;
      case 'solid': decoration = `underline solid ${col}`; break;
      case 'highlight':
        background = `${col}22`;
        decoration = `underline solid ${col}`;
        break;
      case 'none':
      default:
        decoration = 'none';
        break;
    }

    dynamicStyleEl.textContent = `
      .ch-ref {
        text-decoration: ${decoration} !important;
        text-decoration-skip-ink: none !important;
        text-underline-offset: 3px !important;
        background-color: ${background} !important;
        cursor: pointer !important;
        border-radius: 2px !important;
        transition: background-color 0.15s ease !important;
      }
      .ch-ref:hover {
        background-color: ${col}33 !important;
      }
    `;
  }

  // --- Event Delegation ---
  let delegatedBody = null;
  function setupHoverDelegation() {
    if (!document.body || delegatedBody === document.body) return;
    delegatedBody = document.body;

    document.body.addEventListener('mouseover', (e) => {
      if (!config.enabled || isSiteDisabled) return;
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      const span = target.classList?.contains('ch-ref') ? target : target.closest('.ch-ref');
      if (!span) return;
      if (e.relatedTarget && span.contains(e.relatedTarget)) return;

      let parsed = span._chParsedRef;
      if (!parsed && span.dataset.chRef) {
        try {
          parsed = JSON.parse(span.dataset.chRef);
          span._chParsedRef = parsed;
        } catch {
          return;
        }
      }
      if (!parsed) return;

      isMouseOverTarget = true;
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      showTimer = setTimeout(() => {
        showTooltipFor(span, parsed);
      }, config.hoverDelay);
    });

    document.body.addEventListener('mouseout', (e) => {
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      const span = target.classList?.contains('ch-ref') ? target : target.closest('.ch-ref');
      if (!span) return;
      if (e.relatedTarget && span.contains(e.relatedTarget)) return;

      isMouseOverTarget = false;
      clearTimeout(showTimer);
      scheduleHideTooltip();
    });

    // Immediate tap/click open for touchscreens & laptop trackpads (does not hijack actual links)
    document.body.addEventListener('click', (e) => {
      if (!config.enabled || isSiteDisabled) return;
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('a[href]')) return;
      const span = target.classList?.contains('ch-ref') ? target : target.closest('.ch-ref');
      if (!span) return;

      let parsed = span._chParsedRef;
      if (!parsed && span.dataset.chRef) {
        try {
          parsed = JSON.parse(span.dataset.chRef);
          span._chParsedRef = parsed;
        } catch {
          return;
        }
      }
      if (!parsed) return;

      isMouseOverTarget = true;
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      showTooltipFor(span, parsed);
    });
  }

  // Fast pre-filter (also bypasses digit/Roman requirement if any Creed pack is enabled)
  const QUICK_PREFILTER = /\d{1,3}(?!\d)|\b(?:I{2,3}|IV|VI{0,3}|IX|XI{0,3}|XL|L[XV]?|creed|chalcedon|quicunque)\b/i;

  function hasCustomCreedEnabled() {
    if (!Registry.getEnabledDocs) return false;
    return Registry.getEnabledDocs().some(d => d.structure === 'creed');
  }

  function passesQuickPrefilter(text) {
    if (!text || text.length < 4) return false;
    if (QUICK_PREFILTER.test(text)) return true;
    return hasCustomCreedEnabled();
  }

  function tagTextNode(textNode) {
    const text = textNode.nodeValue;
    if (!passesQuickPrefilter(text)) return;

    const ctx = getPageContext();
    const matches = Registry.findReferencesInText
      ? Registry.findReferencesInText(text, {
          riskyAliasMode: config.riskyAliasMode || 'context',
          pageContext: ctx
        })
      : [];
    if (matches.length === 0) return;

    // Upgrade page context if any unambiguous citation was detected on this page
    if (ctx && !ctx.hasTheologicalContext && matches.some(m => !m.isRisky && !m.parsed?.isRisky)) {
      ctx.hasTheologicalContext = true;
    }

    const parent = textNode.parentNode;
    if (!parent) return;

    const frag = document.createDocumentFragment();
    let lastIdx = 0;

    for (const m of matches) {
      if (m.startIndex > lastIdx) {
        frag.appendChild(document.createTextNode(text.substring(lastIdx, m.startIndex)));
      }
      const span = document.createElement('span');
      span.className = 'ch-ref';
      span.textContent = text.substring(m.startIndex, m.endIndex);
      span.dataset.chRef = JSON.stringify(m.parsed);
      span._chParsedRef = m.parsed;

      frag.appendChild(span);
      detectedRefCount++;
      lastIdx = m.endIndex;
    }

    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.substring(lastIdx)));
    }
    parent.replaceChild(frag, textNode);
  }

  function scanElement(rootElement, skipBadgeUpdate = false, ancestorIgnoreCache = null) {
    if (!rootElement || !config.enabled || isSiteDisabled) return;
    if (rootElement.nodeType === Node.ELEMENT_NODE && hasIgnoredAncestor(rootElement, ancestorIgnoreCache)) return;

    setupHoverDelegation();

    const walker = document.createTreeWalker(
      rootElement,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            return shouldIgnoreElement(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
          }
          const text = node.nodeValue;
          if (!passesQuickPrefilter(text)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodesToProcess = [];
    while (walker.nextNode()) {
      nodesToProcess.push(walker.currentNode);
    }

    for (const node of nodesToProcess) {
      tagTextNode(node);
    }

    if ((!dynamicStyleEl || !dynamicStyleEl.isConnected) && detectedRefCount > 0) {
      updateDynamicUnderlineStyles();
    }

    if (!skipBadgeUpdate) {
      queueBadgeUpdate();
    }
  }

  function removeAllTags() {
    if (!document.body) return;
    const spans = document.body.querySelectorAll('span.ch-ref');
    const touchedParents = new Set();
    spans.forEach(span => {
      const parent = span.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(span.textContent || ''), span);
      touchedParents.add(parent);
    });
    touchedParents.forEach(p => {
      try { p.normalize(); } catch {}
    });
    detectedRefCount = 0;
    lastSentBadgeCount = -1;
    cachedPageContext = null;
    cachedContextUrl = '';
  }

  let badgeTimer = null;
  let lastSentBadgeCount = -1;
  function queueBadgeUpdate() {
    if (badgeTimer) return;
    badgeTimer = setTimeout(() => {
      badgeTimer = null;
      if (detectedRefCount === lastSentBadgeCount) return;
      lastSentBadgeCount = detectedRefCount;
      safeSendMessage({ type: 'SET_BADGE_COUNT', count: detectedRefCount });
    }, 250);
  }

  const scheduleIdleTask = typeof window.requestIdleCallback === 'function'
    ? (cb) => window.requestIdleCallback(cb, { timeout: 500 })
    : (cb) => window.setTimeout(() => {
        const start = performance.now();
        cb({ didTimeout: false, timeRemaining: () => Math.max(0, 12 - (performance.now() - start)) });
      }, 50);

  function ensureBodySwapObserver() {
    if (bodySwapObserver || !document.documentElement) return;
    bodySwapObserver = new MutationObserver(() => {
      if (!config.enabled || isSiteDisabled || config.scanMode === 'selection') return;
      if (!document.body || document.body === observedBody) return;

      hideTooltip();
      detectedRefCount = 0;
      lastSentBadgeCount = -1;
      cachedPageContext = null;
      cachedContextUrl = '';
      scanElement(document.body);
      setupMutationObserver();
    });
    bodySwapObserver.observe(document.documentElement, { childList: true });
  }

  function setupMutationObserver() {
    if (observer) observer.disconnect();
    if (!document.body) return;
    observedBody = document.body;

    let debounceTimerId = null;
    let idleCallbackId = null;
    const pendingNodes = new Set();

    function processPendingSlice(deadline) {
      idleCallbackId = null;
      if (!config.enabled || isSiteDisabled) {
        pendingNodes.clear();
        return;
      }

      const sliceStart = performance.now();
      const prevCount = detectedRefCount;
      const ancestorIgnoreCache = new Map();
      const iterator = pendingNodes.values();
      let step = iterator.next();

      while (!step.done) {
        const el = step.value;
        pendingNodes.delete(el);
        if (el.isConnected) {
          scanElement(el, true, ancestorIgnoreCache);
        }
        step = iterator.next();
        if (
          !step.done &&
          ((deadline && typeof deadline.timeRemaining === 'function' && deadline.timeRemaining() <= 1) ||
            (performance.now() - sliceStart > 10))
        ) {
          break;
        }
      }

      if (detectedRefCount > prevCount) {
        queueBadgeUpdate();
      }
      if (pendingNodes.size > 0 && !idleCallbackId) {
        idleCallbackId = scheduleIdleTask(processPendingSlice);
      }
    }

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const added of m.addedNodes) {
          if (added.nodeType === Node.ELEMENT_NODE && !shouldIgnoreElement(added)) {
            pendingNodes.add(added);
          }
        }
      }
      if (pendingNodes.size > 0 && !debounceTimerId && !idleCallbackId) {
        debounceTimerId = setTimeout(() => {
          debounceTimerId = null;
          if (!idleCallbackId && pendingNodes.size > 0) {
            idleCallbackId = scheduleIdleTask(processPendingSlice);
          }
        }, 120);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    ensureBodySwapObserver();
  }

  let selectionListenerAttached = false;
  function setupSelectionLookup() {
    if (selectionListenerAttached) return;
    selectionListenerAttached = true;

    let selectionTimer = null;
    const handleSelectionCheck = (e) => {
      if (!config.enabled || isSiteDisabled || config.scanMode !== 'selection') return;
      if (hostEl && (e.target === hostEl || hostEl.contains(e.target))) return;

      clearTimeout(selectionTimer);
      selectionTimer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          if (!isMouseOverTooltip) hideTooltip();
          return;
        }
        const text = sel.toString().trim();
        if (!text || text.length < 4 || text.length > 160) return;

        const matches = Registry.findReferencesInText
          ? Registry.findReferencesInText(text, { ignoreRiskyGate: true })
          : [];
        if (matches.length === 0) return;

        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        showTooltipFor({ getBoundingClientRect: () => range.getBoundingClientRect() }, matches[0].parsed);
      }, 20);
    };

    document.addEventListener('mouseup', handleSelectionCheck, { passive: true });
    document.addEventListener('keyup', (e) => {
      if (e.key && (e.key.startsWith('Arrow') || e.key === 'Shift')) {
        handleSelectionCheck(e);
      }
    }, { passive: true });
  }

  function applyScanningMode() {
    syncRegistryFromConfig();
    updateDynamicUnderlineStyles();
    applyAccentColor();

    if (!config.enabled || isSiteDisabled) {
      hideTooltip();
      disconnectObservers();
      lastSentBadgeCount = 0;
      safeSendMessage({ type: 'SET_BADGE_COUNT', count: 0 });
      return;
    }

    if (config.scanMode === 'selection') {
      removeAllTags();
      setupSelectionLookup();
      disconnectObservers();
      queueBadgeUpdate();
    } else {
      scanElement(document.body);
      setupMutationObserver();
    }
  }

  // Initialize from chrome.storage.local
  try {
    if (chrome.runtime?.id && chrome.storage?.local) {
      chrome.storage.local.get(CONFIG_KEYS, (stored) => {
        if (!chrome.runtime?.id || chrome.runtime.lastError) return;
        if (stored) config = { ...config, ...stored };

        syncRegistryFromConfig();
        isSiteDisabled = checkSiteDisabled(config.disabledDomains);
        if (!config.enabled || isSiteDisabled) return;

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', applyScanningMode);
        } else {
          applyScanningMode();
        }
      });
    }
  } catch {}

  // Live settings sync
  try {
    if (chrome.runtime?.id && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (!chrome.runtime?.id || area !== 'local') {
          if (!chrome.runtime?.id) disconnectObservers();
          return;
        }

        let configChanged = false;
        let stylesNeedUpdate = false;
        let rescanNeeded = false;

        for (const [k, v] of Object.entries(changes)) {
          if (!CONFIG_KEY_SET.has(k)) continue;
          configChanged = true;
          config[k] = v.newValue;
          if (k === 'underlineStyle' || k === 'underlineColor') stylesNeedUpdate = true;
          if (k === 'installedPackRegistry' || k === 'disabledDocIds' || k === 'riskyAliasMode') {
            rescanNeeded = true;
          }
        }
        if (!configChanged) return;

        if (changes.disabledDomains) {
          isSiteDisabled = checkSiteDisabled(config.disabledDomains);
        }
        if (stylesNeedUpdate) {
          applyAccentColor();
          updateDynamicUnderlineStyles();
        }
        if (changes.showSettingsButton || changes.minimalistMode) {
          updateSettingsButtonVisibility();
        }
        if (changes.showExternalLinks && resCachedEntry) {
          updateCardFooter(resCachedEntry);
        }
        if (rescanNeeded) {
          syncRegistryFromConfig();
          removeAllTags();
          applyScanningMode();
        } else if (changes.enabled || changes.disabledDomains || changes.scanMode) {
          applyScanningMode();
        }
      });
    }
  } catch {}
})();
