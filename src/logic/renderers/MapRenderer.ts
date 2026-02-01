import type { GameState } from '../types';
import { ARENA_CENTERS, ARENA_RADIUS, PORTALS, getHexWallLine } from '../MapLogic';

export function renderBackground(ctx: CanvasRenderingContext2D, state: GameState, logicalWidth: number, logicalHeight: number) {
    const { camera } = state;

    // BACKGROUND GRID (Hexagons)
    const drawHexGrid = (r: number) => {
        const hDist = 1.5 * r;
        const vDist = Math.sqrt(3) * r;

        const scale = 0.58;
        const vW = logicalWidth / scale;
        const vH = logicalHeight / scale;
        const cX = camera.x;
        const cY = camera.y;

        const startX = Math.floor((cX - vW / 2) / hDist) - 1;
        const endX = Math.ceil((cX + vW / 2) / hDist) + 1;
        const startY = Math.floor((cY - vH / 2) / vDist) - 1;
        const endY = Math.ceil((cY + vH / 2) / vDist) + 2;

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.25;

        for (let i = startX; i <= endX; i++) {
            for (let j = startY; j <= endY; j++) {
                const x = i * hDist;
                const y = j * vDist + (i % 2 === 0 ? 0 : vDist / 2);

                ctx.beginPath();
                for (let k = 0; k < 6; k++) {
                    const ang = (Math.PI / 3) * k;
                    const px = x + r * Math.cos(ang);
                    const py = y + r * Math.sin(ang);
                    if (k === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1.0;
    };

    drawHexGrid(120);
}

export function renderMapBoundaries(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 30;
    ctx.globalAlpha = 0.3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ARENA_CENTERS.forEach(c => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const ang = Math.PI / 3 * i;
            const hx = c.x + ARENA_RADIUS * Math.cos(ang);
            const hy = c.y + ARENA_RADIUS * Math.sin(ang);
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
    });
    ctx.restore();
}


export function renderArenaVignette(ctx: CanvasRenderingContext2D, state: GameState, logicalWidth: number, logicalHeight: number) {
    const { camera } = state;

    // Bounds check to avoid drawing huge fog when far (though camera is locked)
    // We draw a large rectangle covering the viewport and subtract the arenas.

    const scale = 0.58;
    const vW = logicalWidth / scale;
    const vH = logicalHeight / scale;

    // Safety margin
    const margin = 500;
    const left = camera.x - vW / 2 - margin;
    const top = camera.y - vH / 2 - margin;
    const w = vW + margin * 2;
    const h = vH + margin * 2;

    ctx.save();

    // Dark Fog Color
    ctx.fillStyle = '#020617'; // Match background deep dark

    // Shadow to create soft "Depth" falloff at the edge
    ctx.shadowColor = '#020617';
    ctx.shadowBlur = 150; // Large soft blur

    ctx.beginPath();
    // 1. Outer Box (The Fog)
    ctx.rect(left, top, w, h);

    // 2. Cutouts (The Arenas)
    ARENA_CENTERS.forEach((c) => {
        // Hexagon Path
        const r = ARENA_RADIUS;
        for (let i = 0; i < 6; i++) {
            const ang = Math.PI / 3 * i;
            const hx = c.x + r * Math.cos(ang);
            const hy = c.y + r * Math.sin(ang);
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
    });

    // Fill using even-odd rule (Rect is filled, Hexes are holes)
    ctx.fill("evenodd");

    ctx.restore();
}

export function renderPortals(ctx: CanvasRenderingContext2D, state: GameState) {
    if (state.portalState === 'closed') return;

    PORTALS.forEach(p => {
        const isFrom = p.from === state.currentArena;
        const isTo = p.to === state.currentArena;

        if (!isFrom && !isTo) return;

        const center = ARENA_CENTERS.find(c => c.id === (isFrom ? p.from : p.to));
        if (!center) return;

        const wall = getHexWallLine(center.x, center.y, ARENA_RADIUS, p.wall);

        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.strokeStyle = p.color;

        ctx.lineCap = 'round';

        if (state.portalState === 'warn') {
            ctx.globalAlpha = 0.5 + Math.sin(state.gameTime * 10) * 0.5;
            ctx.setLineDash([50, 50]);
            ctx.lineWidth = 10;
        } else {
            ctx.globalAlpha = 1.0;
            ctx.lineWidth = 15 + Math.sin(state.gameTime * 20) * 5;
        }

        ctx.beginPath();
        ctx.moveTo(wall.x1, wall.y1);
        ctx.lineTo(wall.x2, wall.y2);
        ctx.stroke();

        ctx.restore();
    });
}
