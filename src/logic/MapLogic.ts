export const ARENA_RADIUS = 3750; // Increased by 3x (1250 -> 3750)
export const MAP_GAP = 400;

// Calculated Constants
const R = ARENA_RADIUS;
const SQRT3 = Math.sqrt(3);

// Flat-Topped Hexagon Geometry
const CENTER_DIST = (R * SQRT3) + MAP_GAP;

// Layout: 
// Arena 0 (Spawn): (0, 0)
export const ARENA_CENTERS = [
    { x: 0, y: 0, id: 0 }, // Left (Spawn)
    { x: Math.cos(-Math.PI / 6) * CENTER_DIST, y: Math.sin(-Math.PI / 6) * CENTER_DIST, id: 1 }, // Top Right
    { x: Math.cos(Math.PI / 6) * CENTER_DIST, y: Math.sin(Math.PI / 6) * CENTER_DIST, id: 2 }   // Bottom Right
];

export const SECTOR_NAMES: Record<number, string> = {
    0: "ECONOMIC HEX",
    1: "COMBAT HEX",
    2: "RESEARCH HEX"
};

// Flat-Topped Hexagon Math Helper
function textHex(x: number, y: number, r: number): boolean {
    const px = Math.abs(x);
    const py = Math.abs(y);

    if (px > r) return false;
    if (py > r * SQRT3 / 2) return false;

    return (py + px * SQRT3) <= (r * SQRT3);
}

// Check if point is inside any arena
export function isPointInHex(x: number, y: number, cx: number, cy: number, r: number): boolean {
    return textHex(x - cx, y - cy, r);
}

export function isInMap(x: number, y: number): boolean {
    for (const c of ARENA_CENTERS) {
        if (textHex(x - c.x, y - c.y, ARENA_RADIUS)) return true;
    }
    return false;
}

// Get the index of the arena closest to the point (or containing it)
export function getArenaIndex(x: number, y: number): number {
    for (const c of ARENA_CENTERS) {
        if (textHex(x - c.x, y - c.y, ARENA_RADIUS)) return c.id;
    }
    // Fallback: Closest center
    let minDist = Infinity;
    let index = 0;
    for (const c of ARENA_CENTERS) {
        const d = Math.hypot(x - c.x, y - c.y);
        if (d < minDist) {
            minDist = d;
            index = c.id;
        }
    }
    return index;
}

export function getRandomPositionInArena(arenaId: number): { x: number, y: number } {
    const arena = ARENA_CENTERS.find(c => c.id === arenaId) || ARENA_CENTERS[0];
    let x, y;
    while (true) {
        const rx = (Math.random() - 0.5) * 2 * ARENA_RADIUS;
        const ry = (Math.random() - 0.5) * 2 * ARENA_RADIUS;

        if (textHex(rx, ry, ARENA_RADIUS)) {
            x = arena.x + rx;
            y = arena.y + ry;
            break;
        }
    }
    return { x, y };
}

export function getRandomMapPosition(): { x: number, y: number } {
    // Randomly pick an arena
    const arenaId = Math.floor(Math.random() * ARENA_CENTERS.length);
    return getRandomPositionInArena(arenaId);
}
