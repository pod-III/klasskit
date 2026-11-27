// ==================== LOS RAYCASTING ENGINE ====================

// Ray-segment intersection. Returns t along the ray, or null.
function raySegmentIntersect(ox, oy, dx, dy, x1, y1, x2, y2) {
    const sdx = x2 - x1, sdy = y2 - y1;
    const denom = dx * sdy - dy * sdx;
    if (Math.abs(denom) < 1e-10) return null;
    const t = ((x1 - ox) * sdy - (y1 - oy) * sdx) / denom;
    const u = ((x1 - ox) * dy  - (y1 - oy) * dx)  / denom;
    if (t >= -1e-9 && u >= -1e-9 && u <= 1 + 1e-9) return Math.max(0, t);
    return null;
}

// Cast one ray, return nearest hit point
function castRay(ox, oy, angle, segments) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let minT = Infinity;
    for (const seg of segments) {
        const t = raySegmentIntersect(ox, oy, dx, dy, seg.x1, seg.y1, seg.x2, seg.y2);
        if (t !== null && t < minT) minT = t;
    }
    // minT should always be finite because boundary segments are included
    if (!isFinite(minT)) minT = 0;
    return { x: ox + dx * minT, y: oy + dy * minT };
}

// Normalise angle to [-π, π]
function normaliseAngle(a) {
    while (a >  Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
}

// Build the map-boundary segments so rays always terminate at the edge
function buildBoundarySegments(W, H) {
    const pad = 1;
    return [
        { x1: -pad, y1: -pad,   x2: W+pad, y2: -pad   }, // top
        { x1: W+pad, y1: -pad,  x2: W+pad, y2: H+pad  }, // right
        { x1: W+pad, y1: H+pad, x2: -pad,  y2: H+pad  }, // bottom
        { x1: -pad,  y1: H+pad, x2: -pad,  y2: -pad   }  // left
    ];
}

// Compute the visibility polygon for one origin, given all occluder+boundary segments
function computeVisibilityPolygon(ox, oy, allSegs) {
    const EPS = 0.00005;

    // Collect candidate angles toward every segment endpoint ±ε
    const rawAngles = [];
    for (const seg of allSegs) {
        for (const [px, py] of [[seg.x1, seg.y1], [seg.x2, seg.y2]]) {
            const a = Math.atan2(py - oy, px - ox); // native atan2 range [-π, π]
            rawAngles.push(a - EPS, a, a + EPS);
        }
    }

    // Normalise all to [-π, π] and sort
    const angles = rawAngles
        .map(normaliseAngle)
        .sort((a, b) => a - b);

    // Cast ray at each angle; sort result pairs by angle from origin to guarantee
    // correct CCW winding regardless of floating-point drift
    const pairs = angles.map(a => {
        const pt = castRay(ox, oy, a, allSegs);
        // Re-derive angle from the actual hit point to avoid winding issues
        return { a: Math.atan2(pt.y - oy, pt.x - ox), x: pt.x, y: pt.y };
    });

    // Sort strictly by angle from origin
    pairs.sort((a, b) => a.a - b.a);

    return pairs.map(p => ({ x: p.x, y: p.y }));
}

// LOS cache — visibility polygons keyed by token id, invalidated on any mutation
const losCache = {
    polygons: new Map(), // tokenId -> [{x,y}]
    dirty: true          // recompute needed
};

function invalidateLOSCache() {
    losCache.dirty = true;
    losCache.polygons.clear();
}

function rebuildLOSCache() {
    if (!state.losEnabled || !state.mapImage) { losCache.dirty = false; return; }
    losCache.polygons.clear();

    const hasWalls = state.wallSegments.length > 0 || state.openingSegments.length > 0;
    if (hasWalls) {
        // Wall mode: raycasting through occluders
        const boundary = buildBoundarySegments(state.mapImage.width, state.mapImage.height);
        const closedOpenings = state.openingSegments.filter(o => !o.isOpen);
        const occluders = [...state.wallSegments, ...closedOpenings, ...boundary];
        for (const token of state.tokens) {
            if (token.x == null || !token.isPC) continue;
            losCache.polygons.set(token.id, computeVisibilityPolygon(token.x, token.y, occluders));
        }
    }
    // Open-world mode: no polygons needed — view distance circle handles it in renderLOS
    losCache.dirty = false;
}

// Render LOS — only recomputes when cache is dirty
function renderLOS() {
    const W = dom.losCanvas.width;
    const H = dom.losCanvas.height;
    const ctx = dom.losCtx;
    ctx.clearRect(0, 0, W, H);

    if (!state.losEnabled || !state.mapImage) return;
    const pcTokens = state.tokens.filter(t => t.isPC !== false);
    if (pcTokens.length === 0) return;

    if (losCache.dirty) rebuildLOSCache();

    const hasWalls = state.wallSegments.length > 0 || state.openingSegments.length > 0;
    const viewDistPx = (state.losViewDistance / state.gridMetresPerSquare) * state.gridSize;

    if (hasWalls) {
        // ── WALL MODE: raycasting polygons, no distance limit, no dark overlay ──
        if (state.isDMMode) {
            for (const [tokenId, poly] of losCache.polygons.entries()) {
                if (poly.length < 3) continue;
                ctx.beginPath();
                ctx.moveTo(poly[0].x, poly[0].y);
                for (const p of poly) ctx.lineTo(p.x, p.y);
                ctx.closePath();
                ctx.fillStyle = 'rgba(34,197,94,0.08)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(34,197,94,0.25)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        } else {
            // Player: dark overlay, punch out each LOS polygon
            ctx.fillStyle = 'rgba(0,0,0,1)';
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'destination-out';
            for (const [, poly] of losCache.polygons.entries()) {
                if (poly.length < 3) continue;
                ctx.beginPath();
                ctx.moveTo(poly[0].x, poly[0].y);
                for (const p of poly) ctx.lineTo(p.x, p.y);
                ctx.closePath();
                ctx.fillStyle = 'rgba(0,0,0,1)';
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        }
    } else {
        // ── OPEN-WORLD MODE: dark overlay + view distance circle per PC token ──
        if (state.isDMMode) {
            // DM: show view distance rings only
            for (const token of pcTokens) {
                if (token.x == null) continue;
                ctx.beginPath();
                ctx.arc(token.x, token.y, viewDistPx, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(34,197,94,0.06)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(34,197,94,0.35)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        } else {
            // Player open-world:
            // losDarkMap ON  → full black outside view circles
            // losDarkMap OFF → 50% dim outside view circles
            const outerAlpha = state.losDarkMap ? 1.0 : 0.5;
            ctx.fillStyle = `rgba(0,0,0,${outerAlpha})`;
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'destination-out';
            for (const token of pcTokens) {
                if (token.x == null) continue;
                ctx.beginPath();
                ctx.arc(token.x, token.y, viewDistPx, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,1)';
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}

// ==================== WALL SEGMENT SYSTEM ====================
const WALL_NODE_RADIUS = 8;
const WALL_SNAP_RADIUS = 14; // px screen space

// Collect all unique endpoints from all segments (walls + openings)
function allWallNodes() {
    const nodes = [];
    for (const seg of state.wallSegments) {
        nodes.push({ x: seg.x1, y: seg.y1 });
        nodes.push({ x: seg.x2, y: seg.y2 });
    }
    for (const seg of state.openingSegments) {
        nodes.push({ x: seg.x1, y: seg.y1 });
        nodes.push({ x: seg.x2, y: seg.y2 });
    }
    return nodes;
}

// Snap pos to nearest existing endpoint within WALL_SNAP_RADIUS (screen px)
// excludeSegId + excludeEndpoint lets us skip the point being dragged
function snapToNearestWallNode(pos, excludeSegId = null, excludeEndpoint = null) {
    const r = WALL_SNAP_RADIUS / state.transform.scale;
    let best = null, bestDist = r;
    // Check wall segments
    for (const seg of state.wallSegments) {
        for (const [ep, px, py] of [['start', seg.x1, seg.y1], ['end', seg.x2, seg.y2]]) {
            if (seg.id === excludeSegId && ep === excludeEndpoint) continue;
            const d = Math.hypot(pos.x - px, pos.y - py);
            if (d < bestDist) { bestDist = d; best = { x: px, y: py }; }
        }
    }
    // Check opening segments (doors/windows)
    for (const seg of state.openingSegments) {
        for (const [ep, px, py] of [['start', seg.x1, seg.y1], ['end', seg.x2, seg.y2]]) {
            if (seg.id === excludeSegId && ep === excludeEndpoint) continue;
            const d = Math.hypot(pos.x - px, pos.y - py);
            if (d < bestDist) { bestDist = d; best = { x: px, y: py }; }
        }
    }
    return best;
}

// Point-to-segment distance helper
function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// --- WALL DRAW (drag) ---
function handleWallDragStart(pos) {
    const snapped = snapToNearestWallNode(pos) || pos;
    state.wallDrag.active = true;
    state.wallDrag.x1 = snapped.x;
    state.wallDrag.y1 = snapped.y;
    state.wallDrag.x2 = snapped.x;
    state.wallDrag.y2 = snapped.y;
    renderFog();
}

function snapToAngle(x1, y1, x2, y2, snapDegrees = 45) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return { x: x2, y: y2 };

    const angle = Math.atan2(dy, dx); // radians, 0 is right (positive x)
    const snapRad = (snapDegrees * Math.PI) / 180;
    const snappedAngle = Math.round(angle / snapRad) * snapRad;

    return {
        x: x1 + Math.cos(snappedAngle) * dist,
        y: y1 + Math.sin(snappedAngle) * dist
    };
}

function handleWallDragMove(pos) {
    if (!state.wallDrag.active) return;
    let targetPos = snapToNearestWallNode(pos) || pos;

    // Angle snapping when holding Shift (snap to 90° increments for strict horizontal/vertical)
    if (state.shiftKey) {
        targetPos = snapToAngle(state.wallDrag.x1, state.wallDrag.y1, targetPos.x, targetPos.y, 90);
        console.log('[AngleSnap] Snapped to:', targetPos.x.toFixed(1), targetPos.y.toFixed(1));
    }

    state.wallDrag.x2 = targetPos.x;
    state.wallDrag.y2 = targetPos.y;
    renderFog();
}

function handleWallDragEnd(pos) {
    if (!state.wallDrag.active) return;
    state.wallDrag.active = false;
    // Use the preview position (already snapped during move) for consistency
    const x1 = state.wallDrag.x1, y1 = state.wallDrag.y1;
    const x2 = state.wallDrag.x2, y2 = state.wallDrag.y2;
    // Only add if the segment has some length
    if (Math.hypot(x2 - x1, y2 - y1) > 3 / state.transform.scale) {
        state.wallSegments.push({ id: newId(), x1, y1, x2, y2 });
        invalidateLOSCache();
        pushHistory();
        saveCurrentMap();
    }
    renderFog();
}

// --- WALL EDIT (drag endpoints) ---
function handleWallEditDown(pos) {
    const we = state.wallEdit;
    const r = WALL_NODE_RADIUS / state.transform.scale;
    // Find the nearest endpoint within r (check both walls and openings)
    let best = null, bestDist = r, isOpening = false;
    // Check wall segments first
    for (const seg of state.wallSegments) {
        for (const [ep, px, py] of [['start', seg.x1, seg.y1], ['end', seg.x2, seg.y2]]) {
            const d = Math.hypot(pos.x - px, pos.y - py);
            if (d < bestDist) { bestDist = d; best = { seg, ep, px, py }; isOpening = false; }
        }
    }
    // Check opening segments (doors/windows) - they can also be edited
    for (const seg of state.openingSegments) {
        for (const [ep, px, py] of [['start', seg.x1, seg.y1], ['end', seg.x2, seg.y2]]) {
            const d = Math.hypot(pos.x - px, pos.y - py);
            if (d < bestDist) { bestDist = d; best = { seg, ep, px, py }; isOpening = true; }
        }
    }
    if (best) {
        we.segId = best.seg.id;
        we.endpoint = best.ep;
        we.nodeX = best.px;  // world-space position of the grabbed joint
        we.nodeY = best.py;
        we.isDragging = true;
        we.isOpening = isOpening;
    } else {
        we.segId = null; we.endpoint = null; we.nodeX = null; we.nodeY = null; we.isDragging = false; we.isOpening = false;
    }
    renderFog();
}

function handleWallEditMove(pos) {
    const we = state.wallEdit;
    if (!we.isDragging || !we.segId || we.nodeX == null) return;
    const snapped = snapToNearestWallNode(pos, we.segId, we.endpoint) || pos;
    // Move all endpoints that share the current joint position (connected nodes)
    const TOL = 1; // world-space px; snapped nodes are exactly coincident
    // Update wall segments
    for (const seg of state.wallSegments) {
        if (Math.hypot(seg.x1 - we.nodeX, seg.y1 - we.nodeY) < TOL) {
            seg.x1 = snapped.x; seg.y1 = snapped.y;
        }
        if (Math.hypot(seg.x2 - we.nodeX, seg.y2 - we.nodeY) < TOL) {
            seg.x2 = snapped.x; seg.y2 = snapped.y;
        }
    }
    // Also update opening segments (doors/windows) - same edit behavior
    for (const seg of state.openingSegments) {
        if (Math.hypot(seg.x1 - we.nodeX, seg.y1 - we.nodeY) < TOL) {
            seg.x1 = snapped.x; seg.y1 = snapped.y;
        }
        if (Math.hypot(seg.x2 - we.nodeX, seg.y2 - we.nodeY) < TOL) {
            seg.x2 = snapped.x; seg.y2 = snapped.y;
        }
    }
    // Track the joint's new position for the next move event
    we.nodeX = snapped.x;
    we.nodeY = snapped.y;
    renderFog();
}

function handleWallEditUp() {
    if (state.wallEdit.isDragging) {
        state.wallEdit.isDragging = false;
        invalidateLOSCache();
        pushHistory();
        saveCurrentMap();
    }
}

// --- WALL ERASE ---
function removeWallAt(pos) {
    const r = 8 / state.transform.scale;
    for (let i = state.wallSegments.length - 1; i >= 0; i--) {
        const seg = state.wallSegments[i];
        if (distToSegment(pos.x, pos.y, seg.x1, seg.y1, seg.x2, seg.y2) < r) {
            state.wallSegments.splice(i, 1);
            invalidateLOSCache();
            pushHistory();
            saveCurrentMap();
            renderFog();
            return;
        }
    }
}

// ==================== DOOR / WINDOW SYSTEM ====================

const DOOR_HIT_RADIUS = 10; // px screen space

// Closest point on segment AB to point P
function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-10) return { x: x1, y: y1, t: 0 };
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return { x: x1 + t * dx, y: y1 + t * dy, t };
}

// Place an opening segment from drag (reuses wallDrag state)
// isDoor: true = door, false = window
function handleOpeningDragEnd(pos, isDoor) {
    if (!state.wallDrag.active) return;
    state.wallDrag.active = false;
    // Use the preview position (already snapped during move) for consistency
    const x1 = state.wallDrag.x1, y1 = state.wallDrag.y1;
    const x2 = state.wallDrag.x2, y2 = state.wallDrag.y2;
    if (Math.hypot(x2 - x1, y2 - y1) > 3 / state.transform.scale) {
        state.openingSegments.push({ id: newId(), x1, y1, x2, y2, isOpen: isDoor ? false : true, isDoor });
        invalidateLOSCache();
        pushHistory();
        saveCurrentMap();
    }
    renderFog();
}

// Toggle an opening open/closed — called on any click near an opening
function toggleOpeningAt(pos) {
    const r = DOOR_HIT_RADIUS / state.transform.scale;
    for (const op of state.openingSegments) {
        const cp = closestPointOnSegment(pos.x, pos.y, op.x1, op.y1, op.x2, op.y2);
        if (Math.hypot(cp.x - pos.x, cp.y - pos.y) < r) {
            op.isOpen = !op.isOpen;
            invalidateLOSCache();
            renderFog();
            pushHistory();
            saveCurrentMap();
            return true;
        }
    }
    return false;
}

// Remove nearest opening at pos
function removeOpeningAt(pos) {
    const r = DOOR_HIT_RADIUS / state.transform.scale;
    for (let i = state.openingSegments.length - 1; i >= 0; i--) {
        const seg = state.openingSegments[i];
        const cp = closestPointOnSegment(pos.x, pos.y, seg.x1, seg.y1, seg.x2, seg.y2);
        if (Math.hypot(cp.x - pos.x, cp.y - pos.y) < r) {
            state.openingSegments.splice(i, 1);
            invalidateLOSCache();
            pushHistory();
            saveCurrentMap();
            renderFog();
            return true;
        }
    }
    return false;
}

// --- FILL ROOM (bucket fog) ---
function fillRoomAt(pos) {
    if (!state.mapImage) return;
    const W = state.mapImage.width;
    const H = state.mapImage.height;

    // 1. Build offscreen canvas at map resolution, draw all segments as thick lines
    const oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    const ctx = oc.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(4, 8 / state.transform.scale);
    ctx.lineCap = 'round';
    for (const seg of state.wallSegments) {
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
    }

    // 2. Flood fill from click position (BFS on pixels)
    const px = Math.round(pos.x);
    const py = Math.round(pos.y);
    if (px < 0 || py < 0 || px >= W || py >= H) return;

    const imgData = ctx.getImageData(0, 0, W, H);
    const data = imgData.data;

    // Clicked on a wall? abort
    const startIdx = (py * W + px) * 4;
    if (data[startIdx] > 128) return; // white = wall pixel

    // Stack-based flood fill — faster than BFS queue for large areas
    const MAX_FILL_PX = W * H * 0.5; // abort if more than 50% of map filled (open area)
    const visited = new Uint8Array(W * H);
    const stack = [py * W + px];
    visited[py * W + px] = 1;
    let minX = px, maxX = px, minY = py, maxY = py;
    let fillCount = 0;

    while (stack.length) {
        const idx = stack.pop();
        const x = idx % W;
        const y = (idx / W) | 0;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        fillCount++;
        if (fillCount > MAX_FILL_PX) return; // open area — no enclosure
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const ni = ny * W + nx;
            if (visited[ni]) continue;
            if (data[ni * 4] > 128) continue; // wall pixel
            visited[ni] = 1;
            stack.push(ni);
        }
    }

    if (fillCount === 0) return;

    // 3. Build a simple bounding-box polygon from the fill extent
    // For a more precise result we walk the border pixels
    // Simple approach: collect border pixels (adjacent to wall or edge), then convex-hull-ish outline
    // Practical approach: just use the tight axis-aligned bounding rect of filled pixels
    // But for non-rectangular rooms, march the outer edge
    // We'll use a scanline contour: for each row find leftmost/rightmost filled pixel
    const points = [];
    // Top edge: left to right
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            if (visited[y * W + x]) { points.push({ x, y }); break; }
        }
    }
    // Right edge: top to bottom
    for (let y = minY; y <= maxY; y++) {
        for (let x = maxX; x >= minX; x--) {
            if (visited[y * W + x]) { points.push({ x, y }); break; }
        }
    }
    // Bottom edge: right to left
    for (let x = maxX; x >= minX; x--) {
        for (let y = maxY; y >= minY; y--) {
            if (visited[y * W + x]) { points.push({ x, y }); break; }
        }
    }
    // Left edge: bottom to top
    for (let y = maxY; y >= minY; y--) {
        for (let x = minX; x <= maxX; x++) {
            if (visited[y * W + x]) { points.push({ x, y }); break; }
        }
    }

    if (points.length < 3) return;

    // Deduplicate consecutive identical points
    const poly = points.filter((p, i) => i === 0 || p.x !== points[i-1].x || p.y !== points[i-1].y);

    state.fogShapes.push({ id: newId(), type: 'wall-fill', points: poly, isHidden: true });
    pushHistory();
    saveCurrentMap();
    renderFog();
}

// --- CLEAR ALL ---
function clearAllWalls() {
    state.wallSegments = [];
    state.openingSegments = [];
    state.fogShapes = state.fogShapes.filter(s => s.type !== 'wall-fill');
    invalidateLOSCache();
    pushHistory();
    saveCurrentMap();
    renderFog();
}

function onPointerMove(e) {
    if (!state.activePointers.has(e.pointerId)) return;
    state.activePointers.set(e.pointerId, e);
    state.mousePos = getPointerPos(e);

    if (state.activePointers.size === 2) {
        handlePinchMove(e);
        return;
    }

    // Single pointer
    if (Math.hypot(e.clientX - state.lastPointerCenter.x, e.clientY - state.lastPointerCenter.y) > MOVE_THRESHOLD) {
        state.pointerMoved = true;
        clearLongPressTimer();
    }

    if (state.isPanning) {
        state.transform.x += e.clientX - state.lastPointerCenter.x;
        state.transform.y += e.clientY - state.lastPointerCenter.y;
        state.lastPointerCenter = { x: e.clientX, y: e.clientY };
        updateTransform();
        clearRuler();
        return;
    }

    // Ruler drag update
    if (state.rulerActive && state.rulerStart) {
        state.rulerEnd = { x: state.mousePos.x, y: state.mousePos.y };
        drawRuler(state.rulerStart, state.rulerEnd);
        return;
    }

    if (state.activeToken) {
        dom.container.style.cursor = 'grabbing';
        const snapped = snapToGrid(state.mousePos.x, state.mousePos.y, state.activeToken.size || 1);
        state.activeToken.x = snapped.x;
        state.activeToken.y = snapped.y;
        renderTokens();
        broadcastState();
        // LOS updates only on grid snap — not every pixel during drag
    } else if (state.isDMMode && state.wallDrag.active) {
        handleWallDragMove(state.mousePos);
    } else if (state.isDMMode && state.wallEdit.isDragging) {
        handleWallEditMove(state.mousePos);
    } else if (state.isDMMode && state.isDrawing) {
        if (state.currentTool === TOOLS.FOG_DRAW) {
            renderFog(); // Preview line
        } else if (state.currentTool === TOOLS.FOG_RECT) {
            const start = state.currentDrawPoints[0];
            state.currentDrawPoints = [
                start,
                { x: state.mousePos.x, y: start.y },
                { x: state.mousePos.x, y: state.mousePos.y },
                { x: start.x, y: state.mousePos.y }
            ];
            renderFog();
        }
    }
}

function handlePinchMove(e) {
    const pts = Array.from(state.activePointers.values());
    const currentDist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
    const currentCenter = {
        x: (pts[0].clientX + pts[1].clientX) / 2,
        y: (pts[0].clientY + pts[1].clientY) / 2
    };

    if (state.lastPinchDist && state.lastPointerCenter) {
        // Pan
        state.transform.x += currentCenter.x - state.lastPointerCenter.x;
        state.transform.y += currentCenter.y - state.lastPointerCenter.y;

        // Zoom
        const zoom = currentDist / state.lastPinchDist;
        let newScale = state.transform.scale * zoom;
        newScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
        state.transform.x = currentCenter.x - (currentCenter.x - state.transform.x) * (newScale / state.transform.scale);
        state.transform.y = currentCenter.y - (currentCenter.y - state.transform.y) * (newScale / state.transform.scale);
        state.transform.scale = newScale;
        updateTransform();
    }

    state.lastPinchDist = currentDist;
    state.lastPointerCenter = currentCenter;
}

function onPointerUp(e) {
    const wasTap = !state.pointerMoved && state.activePointers.size === 1;

    state.activePointers.delete(e.pointerId);
    dom.fogCanvas.releasePointerCapture(e.pointerId);
    clearLongPressTimer();

    if (state.activePointers.size < 2) state.lastPinchDist = null;
    if (state.activePointers.size === 0) state.isPanning = false;

    if (state.activePointers.size === 1) {
        const remaining = Array.from(state.activePointers.values())[0];
        state.lastPointerCenter = { x: remaining.clientX, y: remaining.clientY };
    }

    if (state.activeToken) {
        state.activeToken = null;
        dom.container.style.cursor = toolCursors[state.currentTool] || 'default';
        invalidateLOSCache();
        renderFog();
        pushHistory();
        saveCurrentMap();
    } else if (state.isDMMode && state.isDrawing && state.currentTool === TOOLS.FOG_RECT) {
        // Finish rectangle
        state.isDrawing = false;
        if (state.currentDrawPoints.length === 4) {
            state.fogShapes.push({ id: newId(), points: state.currentDrawPoints, isHidden: true });
            pushHistory();
            saveCurrentMap();
        }
        state.currentDrawPoints = [];
        renderFog();
    } else if (!state.isDMMode && wasTap && state.playerTool === 'fog') {
        // Player tap to reveal fog (only in fog tool mode)
        const pos = getPointerPos(e);
        processFogTapPlayer(pos);
    }

    // Wall / door / window drag finish
    const upPos = getPointerPos(e);
    if (state.currentTool === TOOLS.WALL) {
        handleWallDragEnd(upPos);
    } else if (state.currentTool === TOOLS.OPENING) {
        handleOpeningDragEnd(upPos, state._openingIsDoor);
    } else if (state.currentTool === TOOLS.WALL_EDIT) {
        handleWallEditUp();
    }

    // Toggle opening on tap (no drag) — any tool, any mode
    if (wasTap) toggleOpeningAt(upPos);
    // Ruler finish
    if (state.rulerActive) {
        state.rulerActive = false;
        // Keep ruler visible until next interaction
    }
}

function clearLongPressTimer() {
    if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
    }
}

// ==================== FOG UTILITIES ====================
function processFogTap(pos) {
    for (let i = state.fogShapes.length - 1; i >= 0; i--) {
        const shape = state.fogShapes[i];
        dom.fogCtx.beginPath();
        dom.fogCtx.moveTo(shape.points[0].x, shape.points[0].y);
        for (const p of shape.points) dom.fogCtx.lineTo(p.x, p.y);
        dom.fogCtx.closePath();
        if (dom.fogCtx.isPointInPath(pos.x, pos.y)) {
            shape.isHidden = !shape.isHidden;
            renderFog();
            pushHistory();
            saveCurrentMap();
            break;
        }
    }
}

function processFogErase(pos) {
    for (let i = state.fogShapes.length - 1; i >= 0; i--) {
        const shape = state.fogShapes[i];
        dom.fogCtx.beginPath();
        dom.fogCtx.moveTo(shape.points[0].x, shape.points[0].y);
        for (const p of shape.points) dom.fogCtx.lineTo(p.x, p.y);
        dom.fogCtx.closePath();
        if (dom.fogCtx.isPointInPath(pos.x, pos.y)) {
            state.fogShapes.splice(i, 1);
            renderFog();
            pushHistory();
            saveCurrentMap();
            break;
        }
    }
}

function processFogTapPlayer(pos) {
    for (let i = state.fogShapes.length - 1; i >= 0; i--) {
        const shape = state.fogShapes[i];
        if (!shape.isHidden) continue;
        dom.fogCtx.beginPath();
        dom.fogCtx.moveTo(shape.points[0].x, shape.points[0].y);
        for (const p of shape.points) dom.fogCtx.lineTo(p.x, p.y);
        dom.fogCtx.closePath();
        if (dom.fogCtx.isPointInPath(pos.x, pos.y)) {
            shape.isHidden = false;
            renderFog();
            pushHistory();
            saveCurrentMap();
            break;
        }
    }
}

