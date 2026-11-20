# Privacy Policy for Confession Hover

**Effective Date:** 2026-11-20

Confession Hover is committed to respecting your privacy. The extension is engineered to run completely locally in your browser without telemetry, user tracking, analytics, advertisements, or external data collection.

## 1. Information We Do Not Collect
Confession Hover **does not** collect, log, sell, share, or transmit:
- Your browsing history, visited URLs, or webpage contents
- Search queries or hover lookups you perform in the popup, options dashboard, or on webpages
- Personal identifiers, account credentials, IP addresses, or device telemetry
- Analytics, crash reports, or third-party tracking cookies

## 2. Offline Text Storage & Community Packs
- **Bundled Standards (0ms Offline):** The 8 core standards (Westminster Confession of Faith 1647, Westminster Larger Catechism, Westminster Shorter Catechism, Heidelberg Catechism, Belgic Confession, Canons of Dort, 1689 London Baptist Confession, and CRCA Book of Order 2022) are bundled directly inside the extension package and never require network requests.
- **1-Click Community Packs:** When you click a community pack chip in Settings, the extension fetches that single static JSON file directly from `raw.githubusercontent.com` using standard CORS without requiring broad install-time host permissions.
- **Custom URL & Local `.json` Import:** If you choose to import a pack from a custom `https://` URL, Chrome prompts you for temporary/optional access (`optional_host_permissions`) solely for that domain so the JSON file can be downloaded. Local `.json` files imported via file picker or drag-and-drop are read strictly on your device and never uploaded anywhere.
- **Local IndexedDB Storage:** Downloaded and imported community packs are cached locally in your browser's IndexedDB (`ConfessionHoverDB`) so they load offline afterward.

## 3. Local Settings (`chrome.storage.local`)
All extension preferences—such as enabled/disabled state, theme, font family, font size, underline style/color, short-alias detection mode (`riskyAliasMode`), per-document toggles, disabled domains, and installed pack descriptors—are saved locally via Chrome's `chrome.storage.local` API and never sent to external servers.

## 4. Permissions Explained
- `storage`: Saves your visual preferences, disabled sites, and pack registry locally.
- `activeTab`: Allows the popup to read the active tab's hostname so you can pause/resume Confession Hover on the current website (or display guidance on PDFs/Google Docs/local files).
- `optional_host_permissions` (`https://*/*`): Requested **only** when you explicitly enter a custom third-party URL to import a community pack JSON file. Install-time host permissions are **none**.

## 5. Optional External Links
Hover cards and the Reader Drawer optionally include a `"Read Online ↗"` link (for example to `reformedstandards.com`) when you click it directly. You can hide external links completely at any time from the extension popup or Options Dashboard.

## 6. Open Source Transparency
Confession Hover is free and open-source software licensed under GPL-3.0. All bundled texts are Public Domain (Unlicense). If you have privacy questions or want to inspect the source code, review the extension repository directly.
