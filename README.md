# Confession Hover 📜⚡

> Instant 0ms hover previews for historic Christian confessions, catechisms & creeds — designed as a companion to [Bible Hover](https://github.com/Aussie-App-Studio/Bible-Hover).

Confession Hover scans web pages non-destructively for references to historic Christian standards (such as *WCF 1.2*, *Heidelberg Catechism Q. 26*, *Lord's Day 12*, *Belgic Confession Art. 33*, *Canons of Dort 3/4.3*, and *2LBCF 26.1*) and displays instant hover previews in an isolated Shadow DOM card.

---

## ✨ Key Features

### ⚡ 8 Foundational Standards Bundled Offline (0ms)
Works out of the box with zero network requests and zero setup:
- **Heidelberg Catechism (1563)** — all 129 Q&As + all 52 canonical **Lord's Days** (`HC 26`, `Lord's Day 12`)
- **Belgic Confession (1561)** — all 37 Articles (`Belgic Confession Art. 33`, `BC Art. 33`)
- **Canons of Dort (1619)** — Heads 1, 2, 3/4, and 5, including **Rejection of Errors** (`Canons of Dort 1.7`, `Canons of Dort III/IV.3`, `Dort 1, Error 3`, `Canons of Dort 1.R.3`)
- **Westminster Confession of Faith (1647)** — all 33 Chapters (`WCF 1.2`, `WCF 1:2`, `WCF III.2`, `WCF 1.6–8`)
- **Westminster Larger Catechism (1647)** — all 196 Q&As (`WLC 7`)
- **Westminster Shorter Catechism (1647)** — all 107 Q&As (`WSC 1`)
- **1689 London Baptist Confession** — all 32 Chapters (`2LBCF 26.1`, `1689 Confession 1.1`)
- **CRCA Book of Order (2022)** — all 86 Articles (`CRCA Book of Order Art. 23`, `CRCA Church Order 1`, `Church Order Art. 51`)

### 🧩 1-Click Public Domain Community Packs & Custom JSON Import
Add 14+ extra public-domain documents in one click from [`NonlinearFruit/Creeds.json`](https://github.com/NonlinearFruit/Creeds.json) directly inside the Dashboard:
- **Ecumenical Creeds:** Apostles' Creed, Nicene Creed, Athanasian Creed, Chalcedonian Definition
- **Reformed Confessions:** Scots Confession (1560), Second Helvetic Confession (1566), French Confession of Faith (1559), First Helvetic Confession (1536), Council of Orange (529)
- **Baptist & Puritan Standards:** 1695 Baptist Catechism, Keach's Catechism, Spurgeon's Puritan Catechism, Abstract of Principles (1858), Catechism for Young Children (1840)

You can also **import from any raw JSON URL** or **drag-and-drop a local `.json` file** (for example, to load personal or modern-English packs), and **export** packs cleanly.

### 🧠 Context-Aware Ambiguity Guard
- Automatically recognizes unambiguous references everywhere while gating ambiguous short abbreviations (`BC 33`, `CD 1.7`, `LD 12`, `SC 1`, `LC 7`, `1689 26.1`) based on surrounding theological context or explicit markers (`BC Art. 33`).
- Rejects out-of-bounds references (`WCF 4.5`, `HC 200`, `Lord's Day 53`) and non-theological collisions (`500 BC`, `BC Highway 33`, `.NET WCF`).

### 🎨 Companion Design & Coexistence
- **Distinct Default Palette:** Deep **Burgundy (`#9f1239`)** by default so confessional citations stand visually apart from **Bible Hover's blue (`#3b82f6`)** when both extensions run together.
- **Themes & Typography:** Auto, Crisp Light, OLED Dark, Warm Sepia; 6 font families including Dyslexia-Friendly; Pure Text Minimalist Mode; customizable underline style & color.
- **Slide-Out Reader Drawer:** Read full chapters, full Lord's Days, or full Heads of Doctrine in a full-height drawer (with a **Commentaries** placeholder ready for v2).

---

## 🛠 Installation & Local Development

### Load Unpacked in Chrome / Edge / Brave
1. Open `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.

### Run Automated Tests
```powershell
node --test tests/parser.test.mjs
```

### Rebuild Bundled Offline Data
```powershell
node scripts/build_bundled_data.mjs
```

### Build Store Release ZIP
```powershell
.\package_extension.ps1
```

---

## 📦 Shareable Community Pack JSON Schema

Confession Hover accepts both `NonlinearFruit/Creeds.json` files and simple native Confession Hover JSON packs:

```json
{
  "id": "my_confession",
  "name": "My Modern Confession",
  "shortName": "MMC",
  "year": "2026",
  "aliases": ["My Modern Confession", "MMC"],
  "structure": "chapter_section",
  "chapters": { "1": "Of Holy Scripture" },
  "entries": {
    "1.1": "Holy Scripture is the only sufficient, certain, and infallible rule..."
  }
}
```

---

## 🔒 Privacy

Confession Hover runs completely locally in your browser with zero telemetry, analytics, or external tracking. See the full [Privacy Policy (Markdown)](store_assets/PRIVACY_POLICY.md) or [Privacy Policy (HTML)](store_assets/PRIVACY_POLICY.html).

---

## 📄 License

GNU General Public License v3.0 (GPL-3.0). See [LICENSE](LICENSE) for details.
Public-domain confessional texts bundled in `extension/data/` are sourced from [NonlinearFruit/Creeds.json](https://github.com/NonlinearFruit/Creeds.json) (Unlicense).
