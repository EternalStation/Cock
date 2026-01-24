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

/**
 * Calculates the shortest distance to a hex boundary and the normal of that boundary.
 * For any point in the map, find the nearest hex edge.
 */
export function getHexDistToWall(x: number, y: number): { dist: number; normal: { x: number; y: number } } {
    let minDist = Infinity;
    let bestNormal = { x: 0, y: 0 };

    ARENA_CENTERS.forEach(c => {
        const dx = x - c.x;
        const dy = y - c.y;

        // Plane equations for flat-topped hex:
        // 1. px = r (right)
        // 2. px = -r (left)
        // 3. x*sqrt3 + y = r*sqrt3 
        // 4. x*sqrt3 - y = r*sqrt3
        // 5. -x*sqrt3 + y = r*sqrt3
        // 6. -x*sqrt3 - y = r*sqrt3

        // Inward Normals:
        const normals = [
            { x: -1, y: 0 }, { x: 1, y: 0 },
            { x: -SQRT3 / 2, y: -0.5 }, { x: -SQRT3 / 2, y: 0.5 },
            { x: SQRT3 / 2, y: -0.5 }, { x: SQRT3 / 2, y: 0.5 }
        ];

        const r = ARENA_RADIUS;

        // Distances to the 6 lines
        const dists = [
            r - dx, r + dx, // Vertical flat sides
            (r * SQRT3 - (dx * SQRT3 + dy)) / 2,
            (r * SQRT3 - (dx * SQRT3 - dy)) / 2,
            (r * SQRT3 - (-dx * SQRT3 + dy)) / 2,
            (r * SQRT3 - (-dx * SQRT3 - dy)) / 2
        ];

        dists.forEach((d, i) => {
            if (d < minDist) {
                minDist = d;
                bestNormal = normals[i];
            }
        });
    });

    return { dist: minDist, normal: bestNormal };
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
