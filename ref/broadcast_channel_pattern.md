# BroadcastChannel Student-View Pattern

This document outlines the standardized pattern for implementing a **Host/Student dual-window sync system** using the Web `BroadcastChannel` API, as established in the **Arcane VTT Map** and **Flashcard Displayer** tools. Adopt this pattern for any KlassKit tool that needs a "present to students" feature.

---

## 1. How It Works (Architecture Overview)

Two same-origin tabs/windows share a named `BroadcastChannel`. One window is the **Host** (Teacher) and one or more windows are **Students** (audience).

```
Host Window  ──── state-update ────►  Student Window(s)
             ◄─── player-ready ──────
```

- The Student window detects it is a student via a `?player` URL query parameter.
- On load, the Student pings the Host with `player-ready`.
- The Host responds with a full state sync (`broadcastFullState`).
- After that, every Host state change calls `broadcastState()`, which throttles outgoing messages to 60fps.
- The Student receives `state-update` messages and re-renders itself.
- Heavy assets (maps, images) are loaded independently by the Student from a shared local store (IndexedDB), not transferred over the channel.

---

## 2. Setup (Constants & Channel Init)

Place this near the top of your `script.js`, after global state is declared:

```javascript
// ==================== BROADCAST CHANNEL ====================
const BROADCAST_CHANNEL = 'my-tool-sync'; // unique name per tool
const IS_PLAYER_WINDOW = new URLSearchParams(location.search).has('player');
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BROADCAST_CHANNEL) : null;
```

| Constant | Purpose |
| :--- | :--- |
| `BROADCAST_CHANNEL` | Shared channel name — must be identical in both windows |
| `IS_PLAYER_WINDOW` | `true` when `?player` is in the URL — drives all branching logic |
| `bc` | The channel instance; `null` if API is unavailable (e.g. Firefox private mode) |

---

## 3. Host Side — Sending State

### A. Performance Globals

```javascript
let _lastBroadcastMapId = null;    // Only re-send heavy refs when they change
let _broadcastThrottle = null;     // Throttle timer handle
let _lastBroadcastTime = 0;        // Last dispatch timestamp
let _assetCacheSent = new Set();   // Track which asset IDs have been sent
```

### B. Public Throttled Entry Point

Call `broadcastState()` after every state mutation (tool change, token move, settings toggle, etc.).

```javascript
function broadcastState(options = {}) {
    if (!bc || IS_PLAYER_WINDOW) return; // Host-only guard

    const now = performance.now();
    const minInterval = options.immediate ? 0 : 16; // 60fps cap

    if (_broadcastThrottle) clearTimeout(_broadcastThrottle);

    const doBroadcast = () => {
        _lastBroadcastTime = performance.now();
        _performBroadcast(options);
    };

    const elapsed = now - _lastBroadcastTime;
    if (elapsed >= minInterval) {
        doBroadcast();
    } else {
        _broadcastThrottle = setTimeout(doBroadcast, minInterval - elapsed);
    }
}
```

### C. Inner Broadcast Builder

`_performBroadcast` builds the payload. **Never send large binary data** (images, audio) on every tick — send a lightweight reference ID and let the Player fetch independently.

```javascript
function _performBroadcast(options) {
    const resourceId = state.currentResource?.id || null;

    // Send resource reference only when it changes
    if (resourceId && resourceId !== _lastBroadcastMapId) {
        _lastBroadcastMapId = resourceId;
        _assetCacheSent.clear();
        bc.postMessage({
            type: 'resource-ref',
            resourceId,
            resourceName: state.currentResource?.name,
        });
    }

    // Delta-optimize item payloads — only include src/image for new items
    const itemPayload = state.items.map(item => {
        const isNew = !_assetCacheSent.has(item.id);
        if (isNew && item.src) _assetCacheSent.add(item.id);
        return {
            id: item.id,
            x: item.x, y: item.y,
            // ... other cheap scalar fields
            src: isNew ? item.src : undefined, // omit if already cached by player
        };
    });

    bc.postMessage({
        type: 'state-update',
        resourceId,
        items: itemPayload,
        // ... other state scalars
        settings: state.settings,
    });
}
```

### D. Full Re-Sync

Use this when a new Player window joins. It clears the asset sent-cache so all images are re-sent once.

```javascript
function broadcastFullState() {
    _assetCacheSent.clear();
    broadcastState({ immediate: true });
}
```

---

## 4. Player Side — Receiving State

This block runs **only in the Player window**. Place it before `window.addEventListener('load', ...)`.

```javascript
if (bc && IS_PLAYER_WINDOW) {

    // Consolidated re-render function — call after any state mutation
    const playerDoRender = () => {
        renderBackground();
        renderItems();
        renderOverlays();
        // ... any other render passes your tool needs
    };

    bc.onmessage = async ({ data }) => {

        // 1. Handle resource/asset reference change
        if (data.type === 'resource-ref') {
            if (data.resourceId !== state.currentResource?.id) {
                await loadResourceForPlayer(data.resourceId);
            }
            return;
        }

        // 2. Ignore unknown message types
        if (data.type !== 'state-update') return;

        // 3. Stop retry interval (first successful sync)
        if (window._playerRetryInterval) {
            clearInterval(window._playerRetryInterval);
            window._playerRetryInterval = null;
        }

        // 4. Remove loading overlay once connected
        window._playerLoadingEl?.remove();
        window._playerLoadingEl = null;

        // 5. Apply incoming state
        state.settings  = data.settings;
        // ... spread other scalar state fields

        // 6. Load images for items that are new (have .src), reuse cache for others
        const imageCache = window._playerImageCache || (window._playerImageCache = new Map());
        state.items = await Promise.all(data.items.map(async td => {
            let img = imageCache.get(td.id);
            if (!img && td.src) {
                img = new Image();
                await new Promise(res => { img.onload = res; img.onerror = res; img.src = td.src; });
                imageCache.set(td.id, img);
            }
            return { ...td, img };
        }));

        // 7. Re-render
        playerDoRender();
    };
}
```

---

## 5. Initialization Split (window.onload)

Inside `window.addEventListener('load', ...)`, branch on `IS_PLAYER_WINDOW` to set up each side:

```javascript
window.addEventListener('load', async () => {
    // Shared init (both windows need these)
    initDB();
    initUI();

    if (IS_PLAYER_WINDOW) {
        // ── STUDENT WINDOW ──
        document.documentElement.classList.add('player-mode'); // drives student-specific CSS
        document.title = 'Student View | My Tool';

        // Hide all Host-only chrome
        document.querySelector('header')?.style.setProperty('display', 'none');
        document.getElementById('host-sidebar')?.style.setProperty('display', 'none');

        // Show student-specific UI
        document.getElementById('player-toolbar')?.classList.remove('hidden');

        // Show loading indicator
        const loadingEl = document.createElement('div');
        loadingEl.id = 'player-loading';
        loadingEl.innerHTML = `<span>Connecting to teacher...</span>`;
        document.body.appendChild(loadingEl);
        window._playerLoadingEl = loadingEl;

        // Ping Host with retries until first state-update arrives
        const ping = () => bc?.postMessage({ type: 'player-ready' });
        ping();
        window._playerRetryInterval = setInterval(ping, 2000);

    } else {
        // ── HOST WINDOW ──
        // Respond to player-ready pings with a full state broadcast
        if (bc) {
            bc.onmessage = (evt) => {
                if (evt.data?.type === 'player-ready') {
                    broadcastFullState();
                }
            };
        }
    }

    // Wire the "Open Student View" button
    document.getElementById('btn-open-player')?.addEventListener('click', () => {
        window.open(
            location.pathname + '?player=1',
            'my-tool-student-view',
            'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no'
        );
    });
});
```

---

## 6. HTML Requirements

### A. "Open Student View" Button (Host UI)

The button **must be prominent and immediately visible** to the teacher — not buried in a header or next to utility buttons like dark mode.

**Placement:** As its own `shrink-0` block between the panel header and the scrollable content `<div class="flex-1 ...">`. This keeps it pinned at the top and always visible, even when the settings list is scrolled.

```html
<!-- Placed between the panel header and the scrollable settings area -->
<div class="px-4 pt-4 pb-2 shrink-0">
    <button id="btn-open-player" title="Open Student View"
        class="w-full py-3 rounded-xl text-sm font-black tracking-widest flex items-center justify-center gap-2 transition-all"
        style="background:#16a34a;color:#ffffff;border:2px solid #15803d;box-shadow:0 4px 0 #14532d;">
        <i data-lucide="monitor" class="w-5 h-5"></i> OPEN STUDENT VIEW
    </button>
</div>
```

> **Why inline style for color?** Tailwind's `bg-green` utility resolves to a custom theme colour that may render as a muted tone in some palettes. Using explicit hex values (`#16a34a`) guarantees a vivid, accessible green in both light and dark mode without relying on Tailwind's JIT scan.

> **Rules:**
> - Never place this as an icon-only button next to other utility buttons (e.g. dark mode toggle).
> - Must have a visible text label ("OPEN STUDENT VIEW") and stand alone.
> - Must be `shrink-0` so it is never scrolled out of view.
> - Must be above the primary settings/controls scroll area.

### B. Student-Only UI Elements

Mark student-only elements with `class="hidden"` — the init code removes `hidden` when `IS_PLAYER_WINDOW` is true.

```html
<!-- Hidden by default; shown only in student window -->
<div id="player-toolbar" class="hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 ...">
    <span>Student View</span>
    <!-- student controls (fit to screen, etc.) -->
</div>
```

---

## 7. Loading State (Student Window)

The Student shows a loading overlay until the first `state-update` arrives. Two-phase design:

| Phase | Indicator | Trigger |
| :--- | :--- | :--- |
| **Connecting** | Spinning icon + "Connecting to teacher..." | Immediately on student load |
| **Loading Resource** | Pulsing icon + "Loading..." | On receiving `resource-ref` |
| **Done** | Overlay removed | On receiving first `state-update` |

The overlay element is stored in `window._playerLoadingEl` so any async handler can remove it.

---

## 8. Message Type Reference

| `type` | Direction | Purpose |
| :--- | :--- | :--- |
| `player-ready` | Student → Host | Initial ping; requests full state dump |
| `resource-ref` | Host → Student | Lightweight ID for a new resource to load |
| `state-update` | Host → Student | Full scalar state + delta-optimized item payload |
| `map-image` *(legacy)* | Host → Student | Full image blob — kept for backward compat only |

---

## 9. Performance Rules

1. **Never send binary/blob data on every tick.** Send an ID reference; let the Player fetch from IndexedDB or a URL.
2. **Throttle at 60fps (16ms).** Use the `_broadcastThrottle` pattern. Pass `{ immediate: true }` only for one-off events (resource change, full re-sync).
3. **Delta-optimize item payloads.** Track sent asset IDs in `_assetCacheSent`. Omit `src` if the Player already has it cached.
4. **Clear caches on resource change.** `_assetCacheSent.clear()` whenever the active resource/map switches.
5. **Reuse images on the Player.** Keep `window._playerImageCache` (Map) across messages to avoid re-decoding the same image.
6. **Cap in-memory image cache size.** If you cache map bitmaps, evict the oldest when size > N (e.g., keep last 3).

---

## 9. Hidden Content Behaviour

Hosts and students must see different states for hidden/revealed items. Use the `.player-mode` class (added to `<html>` on student load) to drive this via pure CSS — no JS branching needed at render time.

```css
/* Host view: hidden items are dimmed + badged — content still visible to teacher */
.fc-card.hidden-card {
    opacity: 0.45;
    outline: 2.5px dashed #FF6B95;
}
.fc-card.hidden-card .card-flipper { transform: none; }

/* Student view: hidden items show the flipped back face — content concealed */
.player-mode .fc-card.hidden-card {
    opacity: 1 !important;
    outline: none !important;
}
.player-mode .fc-card.hidden-card .card-flipper {
    transform: rotateY(180deg) !important;
}
```

> **Rule:** Never use `display: none` on hidden items in student view — the item should remain spatially present (occupying space, showing a back face) so students don't get confused by the layout shifting.

---

## 10. Guard Checklist

Before calling `broadcastState()` anywhere, verify:

- [ ] `bc` is not `null` (API available)
- [ ] `IS_PLAYER_WINDOW` is `false` (only Host sends)
- [ ] The call site is a real state mutation, not a read-only render pass

---

> [!TIP]
> The `BroadcastChannel` API only works between same-origin pages in the same browser. It does **not** work across devices or browsers — it is a local presentation mode, not a network multiplayer system. For multi-device sync, pair this with a WebSocket or Supabase Realtime layer.
