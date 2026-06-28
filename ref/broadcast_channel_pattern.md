# BroadcastChannel Player-View Pattern

This document outlines the standardized pattern for implementing a **Host/Player dual-window sync system** using the Web `BroadcastChannel` API, as established in the **Arcane VTT Map** tool. Adopt this pattern for any KlassKit tool that needs a "present to audience" or "player view" feature.

---

## 1. How It Works (Architecture Overview)

Two same-origin tabs/windows share a named `BroadcastChannel`. One window is the **Host** (DM/Teacher) and one or more windows are **Players** (audience/students).

```
Host Window  ──── state-update ────►  Player Window(s)
             ◄─── player-ready ──────
```

- The Player window detects it is a player via a `?player` URL query parameter.
- On load, the Player pings the Host with `player-ready`.
- The Host responds with a full state sync (`broadcastFullState`).
- After that, every Host state change calls `broadcastState()`, which throttles outgoing messages to 60fps.
- The Player receives `state-update` messages and re-renders itself.
- Heavy assets (maps, images) are loaded independently by the Player from a shared local store (IndexedDB), not transferred over the channel.

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
        // ── PLAYER WINDOW ──
        document.title = 'Player View | My Tool';

        // Hide all Host-only chrome
        document.querySelector('header')?.style.setProperty('display', 'none');
        document.getElementById('host-sidebar')?.style.setProperty('display', 'none');

        // Show player-specific UI
        document.getElementById('player-toolbar')?.classList.remove('hidden');

        // Show loading indicator
        const loadingEl = document.createElement('div');
        loadingEl.id = 'player-loading';
        loadingEl.innerHTML = `<span>Connecting...</span>`;
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

    // Wire the "Open Player View" button
    document.getElementById('btn-open-player')?.addEventListener('click', () => {
        window.open(
            location.pathname + '?player=1',
            'player-view',
            'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no'
        );
    });
});
```

---

## 6. HTML Requirements

### A. "Open Player View" Button (Host UI)

```html
<button id="btn-open-player" title="Open Player View">
    Open Player View
</button>
```

### B. Player-Only UI Elements

Mark player-only elements with `class="hidden"` — the init code removes `hidden` when `IS_PLAYER_WINDOW` is true.

```html
<!-- Hidden by default; shown only in player window -->
<div id="player-toolbar" class="hidden fixed left-4 top-1/2 -translate-y-1/2 z-40 ...">
    <!-- player controls -->
</div>
```

---

## 7. Loading State (Player Window)

The Player shows a loading overlay until the first `state-update` arrives. Two-phase design:

| Phase | Indicator | Trigger |
| :--- | :--- | :--- |
| **Connecting** | Spinning icon + "Connecting..." | Immediately on player load |
| **Loading Resource** | Pulsing icon + "Loading..." | On receiving `resource-ref` |
| **Done** | Overlay removed | On receiving first `state-update` |

The overlay element is stored in `window._playerLoadingEl` so any async handler can remove it.

---

## 8. Message Type Reference

| `type` | Direction | Purpose |
| :--- | :--- | :--- |
| `player-ready` | Player → Host | Initial ping; requests full state dump |
| `resource-ref` | Host → Player | Lightweight ID for a new resource to load |
| `state-update` | Host → Player | Full scalar state + delta-optimized item payload |
| `map-image` *(legacy)* | Host → Player | Full image blob — kept for backward compat only |

---

## 9. Performance Rules

1. **Never send binary/blob data on every tick.** Send an ID reference; let the Player fetch from IndexedDB or a URL.
2. **Throttle at 60fps (16ms).** Use the `_broadcastThrottle` pattern. Pass `{ immediate: true }` only for one-off events (resource change, full re-sync).
3. **Delta-optimize item payloads.** Track sent asset IDs in `_assetCacheSent`. Omit `src` if the Player already has it cached.
4. **Clear caches on resource change.** `_assetCacheSent.clear()` whenever the active resource/map switches.
5. **Reuse images on the Player.** Keep `window._playerImageCache` (Map) across messages to avoid re-decoding the same image.
6. **Cap in-memory image cache size.** If you cache map bitmaps, evict the oldest when size > N (e.g., keep last 3).

---

## 10. Guard Checklist

Before calling `broadcastState()` anywhere, verify:

- [ ] `bc` is not `null` (API available)
- [ ] `IS_PLAYER_WINDOW` is `false` (only Host sends)
- [ ] The call site is a real state mutation, not a read-only render pass

---

> [!TIP]
> The `BroadcastChannel` API only works between same-origin pages in the same browser. It does **not** work across devices or browsers — it is a local presentation mode, not a network multiplayer system. For multi-device sync, pair this with a WebSocket or Supabase Realtime layer.
