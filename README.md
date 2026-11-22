# 🍎 KlassKit: The Ultimate Classroom Command Center

![Version](https://img.shields.io/badge/version-1.7.0-blue?style=for-the-badge)
![Activities](https://img.shields.io/badge/activities-78%20Active-green?style=for-the-badge)
![Status](https://img.shields.io/badge/status-Active%20Development-orange?style=for-the-badge)
![Aesthetic](https://img.shields.io/badge/aesthetic-Soft%20Brutalism-pink?style=for-the-badge)

KlassKit is a curated, **no-build ecosystem of 78 active interactive tools, printables, and classroom games** (plus 15 modules in active development) built for ELT and modern classrooms. Tailored for students aged 3–18, it turns any browser into a fast, zero-installation teaching dashboard optimized for classroom projectors and 1366×768 Chromebooks.

> **Explore the Hub:** [klasskit.fun](https://klasskit.fun)

---

## 🌟 The KlassKit Experience

KlassKit isn't just a collection of apps; it's a unified teaching workspace designed to eliminate "teacher friction" during live lessons.

### ⚡ Core Features
- **📌 Smart Pinning & Recents**: Pin your go-to tools directly from Icon, Card, or List view and resume recent activities in one click.
- **🔍 Global Instant Search**: Press `/` anywhere in the Hub to fuzzy-search across tools, games, printables, and tags in milliseconds.
- **📑 Multi-App Tabbing & Split Screen**: Open multiple activities in persistent workspace tabs, cycle with `Ctrl/Cmd+Tab`, or run two apps side-by-side in Split Screen (stacking vertically on mobile).
- **⏱️ Universal Floating Timer & Focus Mode**: Launch a draggable countdown timer across any activity and toggle distraction-free Focus Mode when presenting.
- **⌨️ Unified Keyboard Shortcuts**: Navigate fast with `/`, `Esc` (layered modal/drawer dismissal), `Alt+H` (Home), `Ctrl/Cmd+R` (reload active tab), `Ctrl/Cmd+W` (close tab), `Alt+1–8` (switch tabs), and `F` (My Space fullscreen)—bridged seamlessly into same-origin activity iframes.
- **📥 Guided Bulk Import & CEFR Presets**: Paste plain text with live parser previews, one-click templates, and A1–B2 starter packs (`KlassKitBulkImport`) across supported games and printable makers.
- **🖥️ Dual-Window Student View**: Selected tools (such as **Flashcard Displayer** and **D&D Hub**'s Arcane VTT) support a dedicated `?player` presentation window synced in real time via `BroadcastChannel`.
- **🌓 OLED-Ready Dark Mode & Audio Feedback**: Deep slate dark mode paired with synthesized Web Audio API sound effects and an integrated **Media Manager** for local IndexedDB and cloud assets.

---

## 📽️ Built for Projectors & Chromebooks

Most educational tools are built for individual study. KlassKit is built for the **entire room**:

- **High-Visibility Typography**: Large, legible typefaces tuned for classroom projectors and shared screens.
- **1366×768 Chromebook Fit**: Key tools and game stages are sized to fit standard school laptops without awkward scrolling.
- **Chunky Interaction Zones**: Oversized buttons and high-contrast palettes resist washout under bright classroom lighting.

---

## 🛡️ Choose Your Path: Privacy or Sync?

KlassKit supports two modes of operation depending on your classroom setup:

| Feature | 🧪 KlassKit Sandbox (Local) | ☁️ KlassKit Cloud |
| :--- | :--- | :--- |
| **Setup** | Instant / No Account | Google or Email Login |
| **Privacy** | 100% On-Device | Secure Cloud Storage (Supabase RLS) |
| **Connectivity** | Offline-ready after load (`sw.js`) | Requires Internet |
| **Persistence** | `localStorage` & `IndexedDB` | Multi-Device Cloud Sync |
| **Best For** | Quick lessons & zero-login privacy | Long-term tracking, planning & Pro tools |

> **Note:** The **My Space** productivity suite is currently gated to `pro` and `admin` accounts while under active refinement.

---

## 🏗️ System Architecture

KlassKit is a vanilla ES6+ Single Page Application engineered for speed, offline resilience, and modularity:

- **Modular Activity Sandbox**: Each activity lives as a self-contained HTML/JS module loaded inside workspace tabs, with shared UI components (`components/bulk-import-modal.js`, `components/input-modal.js`, `components/media-manager.js`).
- **Dual-Window Sync (`BroadcastChannel`)**: Host/Teacher views broadcast throttled state updates to `?player` student windows without duplicating heavy assets.
- **Persistent State Engine**: Combines `localStorage` for configs/lists and `IndexedDB` for images, presets, and media assets—inspectable from the unified Media Manager.
- **Theming Engine**: Centralized CSS variables (`css/base.css`) drive instant Light and OLED Dark Mode switching across the Hub and modules.
- **PWA Offline Support**: Service Worker (`sw.js`) pre-caches core assets and uses stale-while-revalidate caching while keeping Supabase API traffic network-only.
- **Auth & Backend**: Powered by Supabase (PostgreSQL with Row Level Security) for authentication, user profiles, announcements, bug reports, and role-based access (`teacher`, `pro`, `admin`).

---

## 🎨 Our Design Signature: Soft Brutalism

Educational software should be as joyful as it is reliable. KlassKit follows a cohesive **Soft Brutalism** design system:

- **Typography**: `Fredoka` for bold, energetic headings and `Nunito` for clean, readable body copy.
- **Tactile UI**: Distinct 3px–4px dark borders, pronounced rounded corners, and extruded "Hard Shadows" paired with `.btn-chunky` press physics.
- **Glassmorphism**: Frosted-glass overlays (`backdrop-filter: blur(16px)`) for floating headers, side panels, and modals.
- **Accessible Motion**: Micro-interactions, `animate-pop-in` modals, `focus-visible` rings, and `prefers-reduced-motion` safeguards.

---

## 🧩 The KlassKit Library

The catalog in `games.json` organizes **78 active modules** into five core zones, plus **15 Work in Progress** modules:

### 🖨️ Printables (18)
*Ready-to-print A4 worksheets, handouts, flashcards, and classroom puzzles.*

| Printable | Description |
|:--- |:--- |
| **Bingo Maker** | Interactive Bingo Studio |
| **Cards Maker** | Flashcard Generator |
| **Domino Maker** | Printable Domino Card Maker |
| **Crossword** | Dynamic Puzzle Studio |
| **Puzzle Maker** | Printable Puzzle Line Maker |
| **Word Search** | The Hidden Word Quest |
| **Worksheet Maker** | Universal Worksheet Generator |
| **Word Snake** | Printable Word Snake Puzzle Maker |
| **Info Gap Maker** | Paired Speaking & Reading Handout Builder |
| **Running Dictation** | Wall Reading & Cloze Worksheet Generator |
| **Interview Maker** | Customizable Class Survey & Interview Sheet |
| **Paper Grass** | Tear-Strip Sentence Puzzles |
| **Path Board** | Printable Path Board Game Maker |
| **Chutes & Ladders** | Printable Chutes & Ladders Board Maker |
| **Tracing Maker** | Handwriting & Fun Path Tracing Sheet Maker |
| **Dice Maker** | Printable 3D Paper Dice & Cube Net Maker |
| **Maze Maker** | Word Path & Wall Maze Handout Generator |
| **Labyrinth Quest** | Point-Hunting Classroom Maze & Prompt Maker |

### 🧰 Teaching Tools (17)
*Essential utilities for real-time classroom management and live instruction.*

| Tool | Description |
|:--- |:--- |
| **Activity Bank** | 140+ Curated Activities, Lesson Flow Builder & Live Teach Mode |
| **Class Tally** | Positive Engagement Tracker |
| **Clock** | Precision Time Management |
| **Notes** | Smart Pedagogical Journal |
| **Poster Studio** | Creative Poster Lab |
| **Scoreboard** | High-Visibility Score Hub |
| **Scrambler** | Spelling Scramble Studio |
| **Slides** | Dynamic Slide Engine |
| **Smart Dictionary** | Pro Vocabulary Reference |
| **Speedy Slides** | Rapid Slide Generator |
| **Spin Wheel** | Premium Randomizer Wheel |
| **Task Assigner** | Smart Responsibility Assigner |
| **Team Picker** | Instant Group Generator |
| **Tracer Whiteboard** | Interactive Handwriting & Shape Tracing Studio |
| **Whiteboard** | Infinite Canvas for Ideas |
| **Word List** | Precision Word Selector |
| **YouTube Library** | Curated Video Resource Library |

### 🎮 Classroom Games (33)
*High-engagement battles, team challenges, and language games.*

| Game | Description |
|:--- |:--- |
| **Card Match** | Visual Memory Challenge |
| **Connect Four** | Strategic Team Battle |
| **D&D Hub** | Fantasy RPG toolkit with character roster, arcane tabletop VTT, and dungeon printer |
| **Fill in The Blank** | Grammar Mastery Tool |
| **Fix-Em** | Grammar Error Detective |
| **Flashcard Displayer** | Interactive Flashcard Display Board |
| **Flashcards** | Digital Flashcard Suite |
| **Freeze Dance** | High-Energy Movement Game |
| **Guess the Emoji** | Emoji Decryption Quiz |
| **Guess Who?** | Character Deduction Battle |
| **Hangman** | The Ultimate Word Rescue |
| **Hot Seat** | The Pressure Guessing Game |
| **Magic Cups** | The Great Cup Shuffle |
| **Memory Block** | Sensory Pattern Challenge |
| **Memory Card** | The Memory Blitz |
| **Mystery Tiles** | Surprise Tile Quiz & Power-Up Team Battle |
| **Quiz Block** | Block-Based Quiz Battle |
| **Quiz Maker** | Pro Quiz Creation Engine |
| **Reveal Pic** | The Tile Reveal Mystery |
| **Role & Speak** | Dice-Powered Grammar Jam |
| **Secret Code** | Crypto-Linguistic Challenge |
| **Sentence Fix** | Grammar Flow Engine |
| **Spell It** | Phonics Spelling Arena |
| **Stop the Bus** | High-Speed Vocabulary Race |
| **Story Dice** | Creative Story Catalyst |
| **Story Order** | Narrative Logic Studio |
| **This or That** | Dynamic Opinion Poll |
| **Tic-Tac-Toe** | Classic Grid Strategy |
| **Undercover** | Social Deduction Mystery |
| **Unscramble** | Precision Spelling Challenge |
| **Word Animator** | High-Speed Flash Words |
| **Word Rush** | The Final Countdown Race |
| **Word Sort** | Strategic Categorization Battle |

### 🛠️ Classroom Workshop (5)
*Utilities for prepping texts, visuals, and student feedback.*

| Tool | Description |
|:--- |:--- |
| **Text Workshop** | Pro Text Processing Suite |
| **Image Workshop** | Advanced Image Utility Lab |
| **PU Helper** | Progress Update Comment Engine |
| **Report Helper** | Full Report Comment Architect |
| **Lesson Extractor** | Smart Lesson Content Parser |

### 🏡 My Space (5 — Pro / Admin)
*Personal teacher workspace for planning, tasks, and class records.*

| App | Description |
|:--- |:--- |
| **My Space** | Your Personal Workspace Dashboard |
| **My Task** | Smart Productivity Hub |
| **My Schedule** | Professional Weekly Planner |
| **My Class** | Advanced Classroom Manager |
| **My Admin** | Strategic Admin & Planning Hub |

### 🚧 Work in Progress (15)
*Early-access prototypes and tools currently being refined or rebuilt.*

| App | Description |
|:--- |:--- |
| **Class Sheet** | Visual Classroom Data Sheet |
| **Classroom Visualizer** | Next-Gen Classroom Visualizer |
| **Cookbook** | Culinary Lesson Planner |
| **Detective Game** | Narrative Deduction Game |
| **Downtime Screen** | Smart Transition Manager |
| **Labeling Blitz** | Extreme Labeling Game |
| **Media Studio** | Classroom Media Studio |
| **Neo-Messenger** | Smart Classroom Messaging |
| **Observation Form** | Classroom Observation Form |
| **Poster Display** | High-Impact Visual Gallery |
| **Random Card Shuffle** | Random Card Shuffler |
| **Sentence Hangman** | Sentence Hangman Game |
| **Skill Tracker** | Student Skill Tracker |
| **Teacher Library** | Teacher's Resource Library |
| **Tense Diver** | Grammar Tense Exploration |

---

## 🛡️ Admin Panel

A dedicated admin dashboard at `/admin/` provides system-wide oversight for authorized `admin` users:

- **Dashboard Statistics**: Panels for Community, Engagement, Cloud Sync, and My Space metrics.
- **User Management**: View, filter, and manage registered users with a built-in user excluder for analytics.
- **Data Details**: Drill down into Progress, Notes, Schedules, Tracker data, Tasks, and Student Management records.
- **Cloud Usage & Audit**: Monitor global storage consumption, sync activity, and real-time system audit logs.
- **Settings**: App configuration with WIP indicators for features under construction.

---

## 📁 Repository Structure

```text
klasskit/
├── index.html              # Public landing / marketing page
├── hub.html                # Main activity hub & workspace shell
├── login.html              # Authentication gateway (OAuth, Email, Sandbox)
├── 404.html                # Custom fallback page
├── games.json              # Central catalog registry (93 entries, 78 active)
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker for offline caching
├── supabase.js             # Supabase client, auth helpers, and role guards
├── js/
│   └── hub/                # Modular Hub scripts (core, ui, views, workspace, timer, app)
├── bump.js                 # Version bumper (games.json, README.md, sw.js, package.json)
├── package.json            # Project metadata, Tailwind CLI scripts, & Playwright dev dependencies
├── tailwind.config.js      # Shared Tailwind CSS v3 configuration & Soft Brutalism tokens
├── playwright.config.js    # Cross-browser E2E test configuration
│
├── apps/                   # Self-contained activity modules
│   ├── printables/         # A4 printable generators & word puzzle makers (18)
│   ├── tools/              # Live teaching tools & classroom utilities (17)
│   ├── games/              # Interactive classroom games (33)
│   ├── workshop/           # Text, image, lesson parser, & report utilities (5)
│   ├── my-space/           # Teacher productivity suite (5, Pro/Admin)
│   └── wip/                # Early-access prototypes & rebuilds (15)
│
├── components/             # Shared UI modules (app-bootstrap, bulk-import-modal, input-modal, media-manager)
├── css/                    # Global stylesheets (tailwind.input, tailwind.generated, base, components, home, side-panel)
├── admin/                  # Admin dashboard (index.html, style.css, js/*.js)
├── api/                    # Auth & error pages (confirmation, reset-password, 500, unauthorized)
├── supabase/sql/           # Database schema, RLS, VTT, and storage trigger SQL files
├── media/                  # App icons, WebP previews, and PWA assets
├── tests/                  # Playwright E2E test specs
├── ref/                    # Architecture patterns (BroadcastChannel, modals, tooltips, sets)
├── scratch/                # Maintenance scripts (path fixers, guard checks)
└── .github/workflows/      # CI workflow (Playwright E2E tests)
```

---

## 🛠 Technology Stack

- **Engine**: Vanilla ES6+ JavaScript (no-build architecture)
- **Styling**: Tailwind CSS + Custom CSS Variables ("Soft Brutalism")
- **Backend & Auth**: Supabase (PostgreSQL with Row Level Security, OAuth, Email Auth)
- **Storage & Sync**: `localStorage`, `IndexedDB`, `BroadcastChannel`, and Service Worker (`sw.js`)
- **Visuals & Audio**: Lucide Icons, Chart.js (Admin dashboard), Web Audio API
- **Testing & CI**: Playwright (`chromium`, `firefox`, `webkit`) via GitHub Actions

---

## 🚀 Get Started

### Developers
KlassKit follows a **no-build** philosophy—serve the static files with any local HTTP server (or `npx serve . -p 3000`):

```bash
# Clone the repository
git clone https://github.com/pod-III/klasskit.git

# Navigate to the directory
cd klasskit

# Serve locally (no build step required)
npx serve . -p 3000

# Optional: Install dev dependencies for Tailwind CSS build & E2E testing
npm install

# Rebuild precompiled Tailwind CSS (used by Hub, Landing, Login, Admin, & API pages)
npm run css:build

# Run Playwright E2E tests (automatically starts `npx serve . -p 3000`)
npx playwright test
```

### Version Management
Use the built-in version bumper to keep version numbers synchronized across `games.json`, `README.md`, `sw.js`, and `package.json`:

```bash
node bump.js 1.7.0
```

### Contributing a New Activity
1. Create your self-contained module inside the appropriate `apps/` subdirectory.
2. Register your app entry in `games.json` under its category (`printable`, `tool`, `game`, `workshop`, `myspace`, or `under-construction`).
3. Your module automatically inherits Hub features including **Tabs, Split Screen, Pins, Search, Timer, and Dark Mode**.

---

## 🙏 Credits & Vision

Built with ❤️ by **Fahrul Ahyan**.
KlassKit is a passion project dedicated to teachers everywhere. It is, and always will be, **100% Free**.

*Current Version: 1.7.0 — Active Development.*
