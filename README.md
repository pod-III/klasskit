# 🍎 KlassKit: The Ultimate Classroom Command Center

![Version](https://img.shields.io/badge/version-1.4.6-blue?style=for-the-badge)
![Activities](https://img.shields.io/badge/activities-65+-green?style=for-the-badge)
![Status](https://img.shields.io/badge/status-Active%20Development-orange?style=for-the-badge)
![Aesthetic](https://img.shields.io/badge/aesthetic-Soft%20Brutalism-pink?style=for-the-badge)

KlassKit is a curated, **high-performance ecosystem of 65+ interactive tools and games** designed specifically for the modern classroom. Built by educators for educators, it transforms any browser into a professional teaching dashboard with zero installation.

> **Explore the Hub:** [klasskit.fun](https://klasskit.fun)

---

## 🌟 The KlassKit Experience

KlassKit isn't just a collection of apps; it's a unified environment designed to reduce "teacher friction" during live lessons.

### ⚡ Core Features
- **📌 Smart Pinning**: Keep your most-used tools pinned to the top of your dashboard for instant access.
- **🔍 Global Instant Search**: Find any game, tool, or workshop utility in milliseconds with our fuzzy-search engine.
- **📑 Multi-App Tabbing**: Open multiple activities in persistent tabs and switch between them without losing your score or progress.
- **🌓 OLED-Ready Dark Mode**: A deep slate theme designed to maximize contrast on classroom projectors while reducing eye strain.
- **🔊 Haptic & Audio Feedback**: Every interaction is backed by subtle, high-quality synthesized sound effects for a more tactile experience.
- **📱 Ultra-Responsive**: Designed for the big screen, but fully optimized for teacher tablets and laptops.

---

## 📽️ Built for the Projector

Most educational tools are built for the individual student. KlassKit is built for the **entire class**.

- **High-Visibility Typography**: We use large, clear fonts that remain legible even on older projectors.
- **Chunky Interaction Zones**: Buttons and inputs are oversized to ensure they are easy to click with a wireless presenter or from across the room.
- **Contrast First**: Our color palette is specifically tuned to be vibrant without being washed out by high-ambient classroom lighting.

---

## 🛡️ Choose Your Path: Privacy or Sync?

KlassKit offers two distinct modes of operation to suit your specific classroom environment.

| Feature | 🧪 KlassKit Sandbox (Local) | ☁️ KlassKit Cloud (Pro) |
| :--- | :--- | :--- |
| **Setup** | Instant / No Account | Google or Email Login |
| **Privacy** | 100% On-Device | Secure Cloud Storage |
| **Connectivity** | Works Offline (after load) | Requires Internet |
| **Persistence** | Browser Cache (Local) | Multi-Device Sync |
| **Best For** | Quick lessons & privacy | Long-term tracking & planning |

---

## 🏗️ System Architecture

KlassKit is a modern SPA (Single Page Application) built with a focus on speed and modularity.

- **Modular Design**: Each activity is a self-contained HTML/JS module that communicates with the Hub via a standardized postMessage API (for state sync).
- **Persistent State Engine**: Uses a hybrid of `localStorage` and `IndexedDB` to ensure that even in Sandbox mode, your data survives browser restarts.
- **Theming Engine**: A centralized CSS variable system allows for instant switching between light and dark modes across all activities.
- **PWA Support**: A dedicated Service Worker (`sw.js`) provides offline caching, asset pre-loading, and stale-while-revalidate strategies for core files.
- **Auth & Backend**: Powered by Supabase (PostgreSQL with Row Level Security) for user authentication, cloud persistence, and role-based access control.

---

## 🎨 Our Design Signature: Soft Brutalism

We believe that educational software should be as beautiful as it is functional. KlassKit follows a strict design system called **Soft Brutalism**:

- **Typography**: `Fredoka` for punchy, energetic headings and `Nunito` for elegant, readable body text.
- **Tactile UI**: Bold 4px borders and "Hard Shadows" that give every element an extruded, physical feel.
- **Glassmorphism**: Sophisticated frosted-glass panels (`backdrop-filter: blur`) for overlays and sidebars.
- **Micro-Interactions**: Every card, button, and modal features smooth, high-frame-rate animations and satisfying hover states.

---

## 🧩 The KlassKit Library

The ecosystem is divided into five specialized zones, each designed for a specific part of your teaching day.

### 🏡 My Space: The Productivity Hub
*Your personal administrative command center.*

| App | Description |
|:--- |:--- |
| **My Space Dashboard** | Your personal workspace dashboard with quick links to all productivity tools. |
| **Professional Weekly Planner** | Master your schedule with drag-and-drop planning and integrated task tracking. |
| **Smart Productivity Hub** | Stay ahead of your workload with a sleek, personalized task management system. |
| **Advanced Classroom Manager** | A comprehensive hub for student success tracking and pedagogical reflection. |
| **Strategic Admin Tracker** | Track unit readiness and planning status across all your scheduled classes. |

### 🛠 Classroom Workshop
*Powerful utilities for prepping and optimizing educational assets.*

| Tool | Description |
|:--- |:--- |
| **Pro Text Processing Suite** | A powerful suite of utilities for transforming and analyzing educational text. |
| **Advanced Image Utility Lab** | A professional lab for prepping and optimizing classroom visual assets. |
| **Progress Update Comment Engine** | Generate highly personalized, professional progress comments in seconds. |
| **Full Report Comment Architect** | An intelligent framework for building comprehensive end-of-term student reports. |
| **Smart Lesson Content Parser** | Automatically extract core vocabulary and grammar from any lesson plan text. |

### 🎮 Learning Games
*High-engagement battles and logic challenges for the classroom.*

| Game | Description |
|:--- |:--- |
| **Pro Quiz Creation Engine** | The ultimate tool for building and hosting epic classroom quiz battles. |
| **Quiz Block** | A high-stakes block selection game that turns quizzes into a tactical battle. |
| **The Ultimate Word Rescue** | A classic race against time to rescue the word through spelling (Hangman). |
| **Strategic Team Battle** | A classic vertical strategy showdown for two competing teams (Connect Four). |
| **Visual Memory Challenge** | A high-stakes memory matching game to reinforce vocabulary recognition. |
| **Memory Card Blitz** | A high-speed memorization challenge for vocabulary and image sets. |
| **Memory Block** | A rhythm and memory battle that tests focus and pattern recognition. |
| **Social Deduction Mystery** | A thrilling game of undercover roles and linguistic deception. |
| **Guess Who?** | Sharpen deductive reasoning and descriptive English in this classic battle. |
| **Hot Seat** | A fast-paced verbal challenge where students describe words under pressure. |
| **Magic Cups** | A classic test of focus and visual tracking. |
| **Freeze Dance** | Perfect for brain breaks: a rhythm-based movement challenge. |
| **Emoji Decryption Quiz** | A visual logic game where students decode phrases from emoji sequences. |
| **Fill in The Blank** | Create custom Cloze-test style challenges to reinforce sentence structure. |
| **Digital Flashcard Suite** | A modern take on flashcards for high-speed vocabulary review. |
| **Flashcard Display Board** | A dynamic digital board for displaying and manipulating word and image flashcards. |
| **Crypto-Linguistic Challenge** | Engage students with secret messages and cryptographic puzzles. |
| **Sentence Fix** | A tactile approach to mastering syntax and sentence construction. |
| **The Tile Reveal Mystery** | Build anticipation and vocabulary recognition through gradual image reveal. |
| **Dice-Powered Grammar Jam** | Transform sentence building into a high-speed dice challenge. |
| **Phonics Spelling Arena** | An interactive spelling environment for young learners and phonics practice. |
| **High-Speed Vocabulary Race** | A digital take on the classic category race for vocabulary mastery. |
| **Creative Story Catalyst** | Ignite imagination with a digital dice set that generates unique story prompts. |
| **Narrative Logic Studio** | Challenge students to reconstruct scrambled narratives through logic and context. |
| **Dynamic Opinion Poll** | A high-movement icebreaker that gets students moving and speaking. |
| **Classic Grid Strategy** | A clean, digital version of the classic strategic alignment game. |
| **Precision Spelling Challenge** | Test and improve spelling accuracy with high-speed unscrambling rounds. |
| **Unscramble** | Watch as words appear scrambled; students race to type the correct spelling. |
| **High-Speed Flash Words** | Rapid-fire vocabulary display for high-intensity reading practice. |
| **The Final Countdown Race** | A high-pressure vocabulary game where every second counts. |
| **Strategic Categorization Battle** | Test student logic by sorting vocabulary into their correct semantic zones. |
| **The Hidden Word Quest** | Generate custom, high-density word search puzzles for your classroom. |
| **Word Sort** | Drag and drop words into their corresponding category columns. |

### 🧰 Teacher Tools
*Essential utilities for real-time classroom management.*

| Tool | Description |
|:--- |:--- |
| **Interactive Bingo Studio** | Design and host professional Bingo sessions for vocabulary and concept review. |
| **Positive Engagement Tracker** | Boost classroom morale by tracking positive behaviors and participation. |
| **Precision Time Management** | Keep your lessons on track with a multi-functional clock and timer suite. |
| **High-Visibility Score Hub** | A professional scoreboard for tracking points across multiple teams. |
| **Premium Randomizer Wheel** | A beautifully animated wheel for making random selections in style. |
| **Instant Group Generator** | Break the ice and randomize teams with a professional group generator. |
| **Smart Responsibility Assigner** | Fairly and randomly assign classroom roles and tasks to your students. |
| **Precision Word Selector** | A sleek, digital list for making fair and random selections instantly. |
| **Flashcard Generator** | Create stunning, ready-to-print flashcards with customizable layouts. |
| **Spelling Scramble Studio** | Generate instantly scrambled word puzzles to challenge spelling accuracy. |
| **Creative Poster Lab** | Design custom educational posters with modular, easy-to-use templates. |
| **Dynamic Slide Engine** | Build and present sleek, text-based slides with a streamlined workflow. |
| **Rapid Slide Generator** | Convert simple lists into professional presentations in a single click. |
| **Universal Worksheet Generator** | A comprehensive printable worksheet maker for creating homework and quizzes. |
| **Printable Puzzle Line Maker** | Upload images and overlay customizable puzzle cut lines for jigsaw activities. |
| **Interactive Handwriting & Shape Tracing Studio** | A versatile handwriting and shape tracing studio with interactive guidelines. |
| **Infinite Canvas for Ideas** | A professional digital canvas for sketching, explaining, and brainstorming. |
| **Classroom Media Studio** | A versatile media studio for local audio/video/images and YouTube playback. |
| **Smart Pedagogical Journal** | A streamlined digital notebook for drafting and archiving your lesson plans. |
| **Premium Activity Library** | Explore, save, and integrate curated classroom activities into your lesson plans. |
| **Pro Vocabulary Reference** | A comprehensive digital dictionary for exploring and collecting vocabulary. |
| **Class Sheet** | A lightweight classroom spreadsheet tool for tracking grades, scores, and attendance. |
| **Smart Transition Manager** | Guide students through transitions with clear, visual downtime instructions. |
| **Curated Video Resource Library** | Build and host a professional library of YouTube resources for your lessons. |

### 🚧 Work in Progress
*Early access and upcoming features currently in development.*

| App | Description |
|:--- |:--- |
| **Classroom Visualizer** | A revolutionary way to visualize classroom data (early access). |
| **Culinary Lesson Planner** | A next-generation recipe and lesson-building engine. |
| **Detective Game** | A high-stakes narrative deduction game in active development. |
| **Neo-Messenger** | The future of in-app classroom messaging and roleplay. |
| **Labeling Blitz** | A high-speed labeling race for the whole school. |
| **Teacher's Resource Library** | A comprehensive cloud-synced library for all your teaching assets. |
| **Observation Form** | A data-driven approach to professional classroom observation. |
| **Advanced Puzzle Generator** | Our most advanced puzzle generation engine yet. |
| **Random Card Shuffler** | A high-performance randomizer for deck-based classroom games. |
| **Sentence Hangman** | A team-based competitive twist on the classic Hangman. |
| **Skill Tracker** | A granular, data-driven skill tracking system for every student. |
| **Tense Diver** | An immersive journey through English tenses and syntax. |

---

## 🛡️ Admin Panel

A dedicated admin dashboard at `/admin/` provides system-wide oversight for authorized users:

- **Dashboard Statistics**: High-impact panels for Community, Engagement, Cloud Sync, and My Space metrics.
- **User Management**: View, filter, and manage registered users with a built-in user excluder for data analysis.
- **Data Details**: Drill down into Progress, Notes, Schedules, Tracker data, Tasks, and Student Management records.
- **Cloud Usage**: Monitor global storage consumption and latest sync activity.
- **System Audit**: Real-time activity log stream for tracking system events.
- **Settings**: App configuration with clearly marked WIP badges for features under construction.

---

## 📁 Repository Structure

```
klasskit/
├── index.html              # Main landing / marketing page
├── hub.html                # Authenticated activity hub
├── login.html              # Authentication gateway (OAuth + Email)
├── games.json              # Central registry for all activities (65+ entries)
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker for offline caching
├── supabase.js             # Supabase client, auth helpers, and role guards
├── script.js               # Core hub logic (tabs, pins, search, theming)
├── bump.js                 # Version bumping utility (games.json, README, sw.js, package.json)
├── package.json            # Project metadata and dev dependencies
├── playwright.config.js    # E2E test configuration
│
├── apps/                   # All interactive modules
│   ├── games/              # 30+ learning games
│   ├── my-space/           # Teacher productivity dashboard & tools
│   ├── tools/              # 20+ real-time classroom utilities
│   ├── workshop/           # Content prep & report generators
│   └── wip/                # 12+ features in active development
│
├── admin/                  # Admin dashboard (index.html, script.js, style.css)
├── api/                    # Standalone HTML pages (confirmation, reset-password, 500, unauthorized)
├── components/             # Shared JS components (input-modal, media-manager)
├── css/                    # Global styles (base, components, home, side-panel)
├── media/                  # Icons, previews (PNG/WebP), and PWA assets
├── tests/                  # Playwright E2E test specs
├── ref/                    # Internal design patterns and documentation
└── scratch/                # Utility scripts (path fixers, guard checks)
```

---

## 🛠 Technology Stack

We believe in modern, standard-compliant tech that runs everywhere.

- **Engine**: Vanilla ES6+ JavaScript (no-build philosophy)
- **Styling**: Tailwind CSS + Custom CSS Variables for the "Soft Brutalism" system
- **Backend & Auth**: Supabase (PostgreSQL with RLS) for Cloud Persistence, OAuth, and Role Management
- **Storage**: Hybrid LocalStorage & IndexedDB for instant Sandbox performance
- **Visuals**: Lucide Icons, Chart.js (admin dashboards), and CSS-native animations
- **Testing**: Playwright for cross-browser E2E testing (Chromium, Firefox, WebKit)

---

## 🚀 Get Started

### Developers
KlassKit is designed with a **no-build** philosophy. You can run the entire repository by simply opening `index.html` in a modern browser.

```bash
# Clone the repository
git clone https://github.com/pod-III/klasskit.git

# Navigate to the directory
cd klasskit

# No npm install needed for the app itself!
# Simply host with any static server (like Live Server) or open directly.

# Optional: Install dev dependencies if running tests
npm install

# Run E2E tests
npx playwright test
```

### Version Management
Use the built-in version bumper to sync version numbers across all relevant files:

```bash
node bump.js 1.4.7
```

This automatically updates `games.json`, `README.md`, `sw.js`, and `package.json`.

### Contributing a New Activity
Adding to the hub is as simple as adding an entry to `games.json`:
1. Create your self-contained module in the appropriate `apps/` subdirectory.
2. Register your app in `games.json` using the standard schema.
3. Your app will automatically inherit system-wide features like **Tabs, Pins, Search, and Dark Mode**.

---

## 🙏 Credits & Vision

Built with ❤️ by **Fahrul Ahyan**.
KlassKit is a passion project dedicated to the global community of teachers. It is, and always will be, **100% Free**.

*Current Version: 1.4.6 — Active Development.*
