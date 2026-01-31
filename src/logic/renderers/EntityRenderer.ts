import type { GameState } from '../types';

export function renderPlayer(ctx: CanvasRenderingContext2D, state: GameState) {
    const { player } = state;
    ctx.save();
    ctx.translate(player.x, player.y);


    const cellSize = 15.7;

    const drawHexagon = (x: number, y: number, r: number) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const px = x + r * Math.cos(angle);
            const py = y + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    };

    ctx.strokeStyle = '#22d3ee';
    ctx.fillStyle = '#020617';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (state.spawnTimer > 0) {
        ctx.shadowBlur = 30 * (state.spawnTimer / 3.0);
        ctx.shadowColor = '#22d3ee';

        const progress = Math.max(0, 3.0 - state.spawnTimer) / 3.0;
        const ease = 1 - Math.pow(1 - progress, 3);
        const spin = (1.0 - ease) * Math.PI * 4;
        ctx.rotate(spin);

        const scale = Math.min(1, ease * 1.5);
        if (scale > 0) {
            ctx.save();
            ctx.scale(scale, scale);
            drawHexagon(0, 0, cellSize);
            ctx.restore();
        }

        const finalDist = cellSize * Math.sqrt(3);
        const startDist = finalDist * 5;
        const currentDist = startDist - (startDist - finalDist) * ease;

        ctx.globalAlpha = Math.min(1, ease * 2);
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + Math.PI / 6;
            const cx = currentDist * Math.cos(angle);
            const cy = currentDist * Math.sin(angle);
            drawHexagon(cx, cy, cellSize);
        }
        ctx.globalAlpha = 1;
    } else {
        ctx.shadowBlur = 0;
        drawHexagon(0, 0, cellSize);
        const cellDistance = cellSize * Math.sqrt(3);
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + Math.PI / 6;
            const cx = cellDistance * Math.cos(angle);
            const cy = cellDistance * Math.sin(angle);
            drawHexagon(cx, cy, cellSize);
        }
    }

    ctx.restore();

    // Stun VFX
    if (player.stunnedUntil && Date.now() < player.stunnedUntil) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00FFFF';
        ctx.shadowBlur = 10;
        const arcCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < arcCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 25 + Math.random() * 10;
            const startX = Math.cos(angle) * 15;
            const startY = Math.sin(angle) * 15;
            const endX = Math.cos(angle) * dist;
            const endY = Math.sin(angle) * dist;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            const midX = (startX + endX) / 2 + (Math.random() - 0.5) * 20;
            const midY = (startY + endY) / 2 + (Math.random() - 0.5) * 20;
            ctx.lineTo(midX, midY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
        ctx.restore();
    }
}

export function renderEnemies(ctx: CanvasRenderingContext2D, state: GameState, meteoriteImages: Record<string, HTMLImageElement>) {
    const { enemies } = state;

    // 1. Draw Merging Lines
    enemies.forEach(e => {
        if (e.mergeState === 'warming_up' && e.mergeTimer && !e.mergeHost) {
            const host = enemies.find(h => h.mergeId === e.mergeId && h.mergeHost);
            if (host) {
                ctx.save();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.5 + Math.sin(state.gameTime * 20) * 0.5;
                ctx.setLineDash([10, 10]);
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(host.x, host.y);
                ctx.stroke();
                ctx.restore();
            }
        }
    });

    enemies.forEach(e => {
        if (e.dead && !e.isZombie) return;
        ctx.save();
        ctx.translate(e.x, e.y);

        // SLOW VFX
        if (e.slowFactor && e.slowFactor > 0.5) {
            ctx.save();
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(0, 0, e.size * 1.3, 0, Math.PI * 2);
            ctx.stroke();
            for (let i = 0; i < 4; i++) {
                const ang = (i * Math.PI / 2) + state.gameTime * 2;
                ctx.beginPath();
                ctx.moveTo(Math.cos(ang) * e.size, Math.sin(ang) * e.size);
                ctx.lineTo(Math.cos(ang) * e.size * 1.5, Math.sin(ang) * e.size * 1.5);
                ctx.stroke();
            }
            ctx.restore();
        }

        // ZOMBIE RENDERER
        if (e.isZombie) {
            const zombieImg = (meteoriteImages as any).zombie;
            if (zombieImg && zombieImg.complete) {
                ctx.save();
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#4ade80';
                const zSize = e.size * 2;
                if (e.zombieState === 'rising') {
                    const timeLeft = (e.zombieTimer || 0) - (state.gameTime * 1000);
                    const totalRiseTime = 1500;
                    const progress = 1 - Math.max(0, timeLeft / totalRiseTime);
                    const shake = (1 - progress) * 8;
                    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
                    ctx.fillStyle = '#5d4037';
                    const particleCount = progress < 0.4 ? 10 : 5;
                    for (let i = 0; i < particleCount; i++) {
                        const dr = Math.sin(i * 123 + state.gameTime * 20) * e.size * (1 + progress);
                        const da = i * (Math.PI * 2 / particleCount);
                        ctx.fillRect(Math.cos(da) * dr, Math.sin(da) * dr, 4, 4);
                    }
                    if (progress > 0.4) {
                        const zProgress = (progress - 0.4) / 0.6;
                        ctx.globalAlpha = zProgress;
                        ctx.translate(0, (1 - zProgress) * 25);
                        ctx.scale(zProgress, zProgress);
                        ctx.drawImage(zombieImg, -zSize / 2, -zSize / 2, zSize, zSize);
                    }
                } else if (e.zombieState !== 'dead') {
                    // Frenzy Glow
                    if (e.isEnraged) {
                        ctx.save();
                        ctx.shadowBlur = 20;
                        ctx.shadowColor = '#ef4444';
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(0, 0, zSize * 0.6, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }

                    // Mirroring logic: PNG faces LEFT. If vx > 0 (moving right), flip.
                    const isMovingRight = (e.vx || 0) > 0.1;
                    ctx.save();
                    if (isMovingRight) {
                        ctx.scale(-1, 1);
                    }
                    ctx.drawImage(zombieImg, -zSize / 2, -zSize / 2, zSize, zSize);
                    ctx.restore();

                    // Heart Indicators (3 Pips)
                    if (e.zombieHearts !== undefined) {
                        const hCount = e.zombieHearts;
                        const startX = -15;
                        for (let i = 0; i < 3; i++) {
                            ctx.fillStyle = i < hCount ? '#4ade80' : 'rgba(255,255,255,0.1)';
                            ctx.fillRect(startX + i * 12, -zSize / 2 - 10, 8, 4);
                        }
                    }
                }
                ctx.restore();
            }
            ctx.restore();
            return;
        }

        if (e.rotationPhase) ctx.rotate(e.rotationPhase);

        // ELITE AURA
        if (e.isElite) {
            ctx.save();
            ctx.rotate(-(e.rotationPhase || 0) * 2);
            ctx.strokeStyle = e.palette[0];
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            const r = e.size * 1.5;
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i;
                if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
                else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }

        const pulse = 1.0 + (Math.sin(e.pulsePhase || 0) * 0.05);
        ctx.scale(pulse, pulse);

        let coreColor = e.palette[0];
        let innerColor = e.palette[1];
        let outerColor = e.palette[2];

        let chaosLevel = 0;
        if (e.boss) {
            chaosLevel = Math.min(1, Math.max(0, (state.gameTime / 60 - 2) / 10));
        }

        const drawShape = (size: number, isWarpedLimit: boolean = false) => {
            ctx.beginPath();
            const warpAmp = isWarpedLimit && e.boss ? (0.1 + chaosLevel * 0.2) * size : 0;
            const wp = (px: number, py: number) => {
                if (warpAmp === 0) return { x: px, y: py };
                const offset = Math.sin((py / size) * 4 + (state.gameTime * 10)) * warpAmp;
                return { x: px + offset, y: py };
            };
            if (e.shape === 'circle') {
                if (warpAmp > 0) {
                    for (let i = 0; i <= 20; i++) {
                        const theta = (i / 20) * Math.PI * 2;
                        const p = wp(Math.cos(theta) * size, Math.sin(theta) * size);
                        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                    }
                } else ctx.arc(0, 0, size, 0, Math.PI * 2);
            } else if (e.shape === 'minion') {
                const isStun = !!e.stunOnHit;
                if (isStun) {
                    const p1 = wp(size * 2.5, 0); const p2 = wp(-size * 1.5, -size * 0.8);
                    const p3 = wp(-size * 0.5, -size * 0.4); const p4 = wp(-size * 2.5, -size * 0.8);
                    const p5 = wp(-size * 1.5, 0); const p6 = wp(-size * 2.5, size * 0.8);
                    const p7 = wp(-size * 0.5, size * 0.4); const p8 = wp(-size * 1.5, size * 0.8);
                    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
                    ctx.lineTo(p5.x, p5.y); ctx.lineTo(p6.x, p6.y); ctx.lineTo(p7.x, p7.y); ctx.lineTo(p8.x, p8.y);
                } else {
                    const p1 = wp(size, 0); const p2 = wp(-size, size * 0.7);
                    const p3 = wp(-size * 0.3, 0); const p4 = wp(-size, -size * 0.7);
                    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
                }
                ctx.closePath();
            } else if (e.shape === 'triangle') {
                const p1 = wp(0, -size); const p2 = wp(size * 0.866, size * 0.5); const p3 = wp(-size * 0.866, size * 0.5);
                ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath();
            } else if (e.shape === 'square') {
                const p1 = wp(-size, -size); const p2 = wp(size, -size); const p3 = wp(size, size); const p4 = wp(-size, size);
                ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.closePath();
            } else if (e.shape === 'diamond') {
                const p1 = wp(0, -size * 1.3); const p2 = wp(size, 0); const p3 = wp(0, size * 1.3); const p4 = wp(-size, 0);
                ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.closePath();
            } else if (e.shape === 'pentagon') {
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
                    const p = wp(Math.cos(angle) * size, Math.sin(angle) * size);
                    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                }
                ctx.closePath();
            } else if (e.shape === 'snitch') {
                const bodyR = size * 0.7;
                if (warpAmp > 0) {
                    for (let i = 0; i <= 20; i++) {
                        const theta = (i / 20) * Math.PI * 2;
                        const p = wp(Math.cos(theta) * bodyR, Math.sin(theta) * bodyR);
                        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                    }
                } else ctx.arc(0, 0, bodyR, 0, Math.PI * 2);
                ctx.closePath();
                const drawBlade = (side: number, angle: number, lengthMult: number, widthMult: number) => {
                    const start = wp(side * bodyR * 0.8, side * bodyR * angle);
                    const mid = wp(side * size * 2.2 * lengthMult, side * size * (angle + 0.4) * widthMult);
                    const end = wp(side * size * 2.0 * lengthMult, side * size * angle * widthMult);
                    const back = wp(side * bodyR * 0.8, side * bodyR * (angle - 0.2));
                    ctx.moveTo(start.x, start.y); ctx.lineTo(mid.x, mid.y); ctx.lineTo(end.x, end.y); ctx.lineTo(back.x, back.y); ctx.closePath();
                };
                drawBlade(-1, -0.6, 1.0, 1.0); drawBlade(-1, 0, 1.2, 0.5); drawBlade(-1, 0.6, 1.0, 1.0);
                drawBlade(1, -0.6, 1.0, 1.0); drawBlade(1, 0, 1.2, 0.5); drawBlade(1, 0.6, 1.0, 1.0);
            }
        };

        if (e.shape === 'pentagon') {
            const motherAge = state.gameTime - (e.spawnedAt || 0);
            const isAngry = (e.angryUntil && Date.now() < e.angryUntil);
            if (e.suicideTimer !== undefined) {
                const suicideProgress = (state.gameTime - e.suicideTimer!) / 5.0;
                const pVal = (Math.sin(e.pulsePhase || 0) + 1) / 2;
                outerColor = pVal > 0.3 ? '#FF0000' : '#880000';
                innerColor = pVal > 0.5 ? '#FF5555' : '#440000';
                ctx.scale(1.0 + (pVal * 0.2 * suicideProgress), 1.0 + (pVal * 0.2 * suicideProgress));
            } else if (!isAngry && motherAge < 60) {
                const pVal = (Math.sin(e.pulsePhase || 0) + 1) / 2;
                if (pVal > 0.6) { outerColor = '#4ade80'; innerColor = '#22c55e'; }
            }
            coreColor = '#FFFFFF';
        }

        if (e.critGlitchUntil && Date.now() < e.critGlitchUntil) {
            ctx.save();
            const shift = 4 + Math.random() * 4;
            ctx.save(); ctx.translate(shift, 0); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#FF0000'; drawShape(e.size * 1.05); ctx.stroke(); ctx.restore();
            ctx.save(); ctx.translate(-shift, 0); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#0000FF'; drawShape(e.size * 1.05); ctx.stroke(); ctx.restore();
            ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; drawShape(e.size * 1.1); ctx.stroke();
            ctx.restore();
            ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
        }

        if ((e.glitchPhase && e.glitchPhase > 0) || e.boss) {
            const intensity = e.boss ? chaosLevel * 15 : 10;
            if (e.boss && Math.random() < chaosLevel * 0.3) ctx.translate((Math.random() - 0.5) * intensity, -(Math.random() - 0.5) * intensity);
            else if (e.glitchPhase && !e.boss) ctx.translate((Math.random() - 0.5) * 10, -(Math.random() - 0.5) * 10);
            if (Math.random() > (e.boss ? 0.8 - (chaosLevel * 0.2) : 0.8)) ctx.globalAlpha = 0.6;
        }

        if (e.boss && e.trails) {
            e.trails.forEach(t => {
                ctx.save(); ctx.translate(-e.x, -e.y); ctx.translate(t.x, t.y); ctx.scale(pulse, pulse); ctx.rotate(t.rotation);
                ctx.strokeStyle = outerColor; ctx.lineWidth = 1; ctx.globalAlpha = t.alpha * 0.5; drawShape(e.size, false); ctx.stroke(); ctx.restore();
            });
        }

        if (e.boss) {
            const redAlpha = (0.6 + Math.sin(state.gameTime * 10) * 0.4) * (Math.random() > 0.5 ? 1 : 0.8);
            ctx.strokeStyle = '#FF0000'; ctx.lineWidth = 3; ctx.shadowColor = '#FF0000'; ctx.shadowBlur = 20; ctx.globalAlpha = redAlpha; drawShape(e.size * 1.25, true); ctx.stroke(); ctx.globalAlpha = 1.0;
        }

        ctx.strokeStyle = outerColor; ctx.lineWidth = 1.5;
        if (e.boss) { ctx.shadowBlur = 8; ctx.shadowColor = outerColor; }
        drawShape(e.size * 1.1, true); ctx.stroke();
        ctx.fillStyle = innerColor; ctx.globalAlpha = 1.0; ctx.shadowBlur = 0; drawShape(e.size, true); ctx.fill();

        if (e.boss) {
            ctx.save(); ctx.clip(); ctx.fillStyle = '#000000'; ctx.globalAlpha = 0.8;
            const seed = Math.floor(state.gameTime * 10);
            for (let k = 0; k < 2 + Math.floor(chaosLevel * 4); k++) {
                ctx.beginPath();
                const r = (n: number) => { const sin = Math.sin(n + (e.id || 0)); return sin - Math.floor(sin); };
                const cx = (r(seed + k) - 0.5) * e.size * 1.2; const cy = (r(seed + k + 100) - 0.5) * e.size * 1.2;
                for (let v = 0; v < 4; v++) {
                    const ang = v * (Math.PI / 2) + r(k + v); const dist = 5 + r(k * v) * 15;
                    if (v === 0) ctx.moveTo(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist);
                    else ctx.lineTo(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist);
                }
                ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }

        ctx.fillStyle = coreColor; ctx.globalAlpha = 1.0; drawShape(e.size * 0.5, true); ctx.fill();

        if (e.deathMarkExpiry && e.deathMarkExpiry > state.gameTime) {
            const dmImg = (meteoriteImages as any).deathMark;
            if (dmImg) {
                const s = 64; ctx.save(); ctx.rotate(-(e.rotationPhase || 0)); ctx.translate(0, -e.size * 1.5 - 25);
                const sPulse = 1 + Math.sin(state.gameTime * 5) * 0.1; ctx.scale(sPulse, sPulse); ctx.drawImage(dmImg, -s / 2, -s / 2, s, s); ctx.restore();
            }
        }
        ctx.restore();
    });

    // Diamond Elite Laser
    enemies.forEach(e => {
        if (e.isElite && e.shape === 'diamond' && e.eliteState === 2 && e.lockedTargetX !== undefined && e.lockedTargetY !== undefined) {
            ctx.save();
            const pulse = 0.8 + Math.sin(state.gameTime * 20) * 0.2;
            const baseWidth = 4 * pulse;
            ctx.strokeStyle = e.palette[1]; ctx.lineWidth = baseWidth * 5; ctx.globalAlpha = 0.15;
            ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.lockedTargetX, e.lockedTargetY); ctx.stroke();
            ctx.lineWidth = baseWidth * 2.5; ctx.globalAlpha = 0.35;
            ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.lockedTargetX, e.lockedTargetY); ctx.stroke();
            ctx.strokeStyle = e.palette[0]; ctx.lineWidth = baseWidth; ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.lockedTargetX, e.lockedTargetY); ctx.stroke();
            ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = baseWidth * 0.3; ctx.globalAlpha = 1.0;
            ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.lockedTargetX, e.lockedTargetY); ctx.stroke();
            ctx.restore();
        }
    });
}

export function renderProjectiles(ctx: CanvasRenderingContext2D, state: GameState) {
    state.bullets.forEach(b => {
        ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill();
    });
    state.enemyBullets.forEach(b => {
        ctx.fillStyle = b.color || '#ef4444'; ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill();
    });
}

export function renderDrones(ctx: CanvasRenderingContext2D, state: GameState) {
    state.drones.forEach(d => {
        ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(d.x, d.y, 5, 0, Math.PI * 2); ctx.fill();
    });
}

export function renderMeteorites(ctx: CanvasRenderingContext2D, state: GameState, meteoriteImages: Record<string, HTMLImageElement>) {
    state.meteorites.forEach(m => {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.translate(0, Math.sin(state.gameTime * 3 + m.id) * 5);
        if (m.magnetized) ctx.translate((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);

        const imgKey = `M${m.visualIndex}${m.quality}`;
        const img = meteoriteImages[imgKey];
        if (img && img.complete && img.naturalWidth !== 0) {
            const size = 32;
            ctx.drawImage(img, -size / 2, -size / 2, size, size);
            if (m.rarity !== 'scrap') {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.4;
                ctx.drawImage(img, -size / 2 - 2, -size / 2 - 2, size + 4, size + 4);
                ctx.globalAlpha = 1.0;
                ctx.globalCompositeOperation = 'source-over';
            }
        } else {
            let color = '#9ca3af';
            if (m.rarity === 'anomalous') color = '#14b8a6';
            else if (m.rarity === 'quantum') color = '#06b6d4';
            else if (m.rarity === 'astral') color = '#a855f7';
            else if (m.rarity === 'radiant') color = '#eab308';
            ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.fillStyle = color;
            ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, -6); ctx.lineTo(12, 6); ctx.lineTo(0, 12); ctx.lineTo(-10.5, 7.5); ctx.lineTo(-9, -7.5); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.restore();
    });
}

export function renderBossIndicator(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number, camera: { x: number, y: number }, scaleFactor: number) {
    const dpr = window.devicePixelRatio || 1;
    const zoom = scaleFactor * 0.58 * dpr;
    state.enemies.filter(e => e.boss && !e.dead).forEach(e => {
        const screenX = (e.x - camera.x) * zoom + width / 2;
        const screenY = (e.y - camera.y) * zoom + height / 2;
        const pad = 40 * dpr;
        if (screenX < pad || screenX > width - pad || screenY < pad || screenY > height - pad) {
            const ix = Math.max(pad, Math.min(width - pad, screenX));
            const iy = Math.max(pad, Math.min(height - pad, screenY));
            ctx.save(); ctx.translate(ix, iy); ctx.scale(1 + Math.sin(Date.now() / 150) * 0.15, 1 + Math.sin(Date.now() / 150) * 0.15);
            ctx.fillStyle = '#ef4444'; ctx.shadowBlur = 10; ctx.shadowColor = '#ef4444';
            const size = 15;
            ctx.beginPath(); ctx.arc(0, -size * 0.2, size * 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(-size * 0.4, size * 0.3, size * 0.8, size * 0.4);
            ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(-size * 0.3, 0, size * 0.2, 0, Math.PI * 2); ctx.arc(size * 0.3, 0, size * 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, size * 0.2); ctx.lineTo(-size * 0.1, size * 0.4); ctx.lineTo(size * 0.1, size * 0.4); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
    });
}
