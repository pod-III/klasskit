# 🍎 KlassKit: The Ultimate Classroom Command Center

![Version](https://img.shields.io/badge/version-1.4.6-blue?style=for-the-badge)
![Activities](https://img.shields.io/badge/activities-52+-green?style=for-the-badge)
![Status](https://img.shields.io/badge/status-Active%20Development-orange?style=for-the-badge)
![Aesthetic](https://img.shields.io/badge/aesthetic-Soft%20Brutalism-pink?style=for-the-badge)

KlassKit is a curated, **high-performance ecosystem of 50+ interactive tools and games** designed specifically for the modern classroom. Built by educators for educators, it transforms any browser into a professional teaching dashboard with zero installation.

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
- **Theming Engine**: A centralized CSS variable system allows for instant switching between light and dark modes across all 50+ activities.

---

## 🎨 Our Design Signature: Soft Brutalism

We believe that educational software should be as beautiful as it is functional. KlassKit follows a strict design system called **Soft Brutalism**:

- **Typography**: `Fredoka` for punchy, energetic headings and `Nunito` for elegant, readable body text.
- **Tactile UI**: Bold 4px borders and "Hard Shadows" that give every element an extruded, physical feel.
- **Glassmorphism**: Sophisticated frosted-glass panels (`backdrop-filter: blur`) for overlays and sidebars.
- **Micro-Interactions**: Every card, button, and modal features smooth, high-frame-rate animations and satisfying hover states.

---

## 🧩 The KlassKit Library

The ecosystem is divided into four specialized zones, each designed for a specific part of your teaching day.

### 🏡 My Space: The Productivity Hub
*Your personal administrative command center.*

| App | Description |
|:--- |:--- |
| **Professional Weekly Planner** | Master your schedule with drag-and-drop planning and integrated task tracking. |
| **Advanced Classroom Manager** | A comprehensive hub for student success tracking and pedagogical reflection. |
| **Smart Productivity Hub** | Stay ahead of your workload with a sleek, personalized task management system. |
| **Strategic Admin Tracker** | Track unit readiness and planning status across all your scheduled classes. |

### 🛠 Classroom Workshop
*Powerful utilities for prepping and optimizing educational assets.*

| Tool | Description |
|:--- |:--- |
| **Pro Text Processing Suite** | A powerful suite of utilities for transforming and analyzing educational text. |
| **Advanced Image Utility Lab** | A professional lab for prepping and optimizing classroom visual assets. |
| **Progress Update Comment Engine** | Generate highly personalized, professional progress comments in seconds. |
| **Smart Lesson Content Parser** | Automatically extract core vocabulary and grammar from any lesson plan text. |

### 🎮 Learning Games
*High-engagement battles and logic challenges for the classroom.*

| Game | Description |
|:--- |:--- |
| **Pro Quiz Creation Engine** | The ultimate tool for building and hosting epic classroom quiz battles. |
| **The Ultimate Word Rescue** | A classic race against time to rescue the word through spelling (Hangman). |
| **Strategic Team Battle** | A classic vertical strategy showdown for two competing teams (Connect Four). |
| **Visual Memory Challenge** | A high-stakes memory matching game to reinforce vocabulary recognition. |
| **Social Deduction Mystery** | A thrilling game of undercover roles and linguistic deception. |

### 🧰 Teacher Tools
*Essential utilities for real-time classroom management.*

| Tool | Description |
|:--- |:--- |
| **Interactive Bingo Studio** | Design and host professional Bingo sessions for vocabulary and concept review. |
| **Positive Engagement Tracker** | Boost classroom morale by tracking positive behaviors and participation. |
| **Precision Time Management** | Keep your lessons on track with a multi-functional clock and timer suite. |
| **High-Impact Visual Gallery** | A digital gallery for displaying vocabulary banks and high-quality posters. |
| **Flashcard Generator** | Create stunning, ready-to-print flashcards with customizable layouts. |

---

## 🛠 Technology Stack

We believe in modern, standard-compliant tech that runs everywhere.

- **Engine**: Vanilla ES6+ JavaScript
- **Styling**: Tailwind CSS + Custom CSS Variables for the "Soft Brutalism" system
- **Backend**: Supabase (PostgreSQL with RLS) for Cloud Persistence
- **Storage**: Hybrid LocalStorage & IndexedDB for instant Sandbox performance
- **Visuals**: Lucide Icons & CSS-native animations

---

## 🚀 Get Started

### Developers
KlassKit is designed with a **no-build** philosophy. You can run the entire repository by simply opening `index.html` in a modern browser.

```bash
# Clone the repository
git clone https://github.com/pod-III/klasskit.git

# Navigate to the directory
cd klasskit

# No npm install needed! Simply host with any static server (like Live Server) or open directly.
```

### Contributing a New Activity
Adding to the hub is as simple as adding an entry to `games.json`:
1. Create your self-contained module in the appropriate directory.
2. Register your app in `games.json` using the standard schema.
3. Your app will automatically inherit system-wide features like **Tabs, Pins, Search, and Dark Mode**.

---

## 🙏 Credits & Vision

Built with ❤️ by **Fahrul Ahyan**.
KlassKit is a passion project dedicated to the global community of teachers. It is, and always will be, **100% Free**.

*Current Version: 1.3.9 — Active Development.*
