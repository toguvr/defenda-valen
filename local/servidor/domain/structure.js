import { ARENA, BALISTA, BARRICADA, ESTANDARTE, } from '../../protocol/index.js';
import { clamp } from './vector.js';
let nextStructureNumber = 0;
export function createBarricada(params) {
    nextStructureNumber += 1;
    return {
        id: `s${nextStructureNumber}`,
        kind: 'barricada',
        ownerId: params.ownerId,
        team: params.team,
        radius: BARRICADA.radius,
        position: {
            x: clamp(params.position.x, BARRICADA.radius, ARENA.width - BARRICADA.radius),
            y: clamp(params.position.y, BARRICADA.radius, ARENA.height - BARRICADA.radius),
        },
        health: BARRICADA.maxHealth,
        maxHealth: BARRICADA.maxHealth,
        combatState: 'ready',
        // Mesma razao do portao: derrubar a propria defesa por erro de mira e uma
        // perda que nao ensina nada.
        damagedByAllies: false,
        solid: true,
        remainingMs: BARRICADA.durationMs,
        operatorId: null,
        cooldownMs: 0,
        aim: { x: 0, y: -1 },
    };
}
/**
 * Balista: arma de cerco temporaria, operada por qualquer aliado.
 *
 * Nao e solida. Ela existe para alguem ficar *nela*, e empurrar quem chega
 * perto impediria justamente isso.
 */
export function createBalista(params) {
    nextStructureNumber += 1;
    return {
        id: `s${nextStructureNumber}`,
        kind: 'balista',
        ownerId: params.ownerId,
        team: params.team,
        radius: BALISTA.radius,
        position: {
            x: clamp(params.position.x, BALISTA.radius, ARENA.width - BALISTA.radius),
            y: clamp(params.position.y, BALISTA.radius, ARENA.height - BALISTA.radius),
        },
        health: BALISTA.maxHealth,
        maxHealth: BALISTA.maxHealth,
        combatState: 'ready',
        damagedByAllies: false,
        solid: false,
        remainingMs: BALISTA.durationMs,
        operatorId: null,
        cooldownMs: 0,
        aim: { x: 0, y: -1 },
    };
}
/**
 * Estandarte do Suporte: corpo pequeno, area grande.
 *
 * Nao e solido de proposito. Uma barricada existe para fechar passagem; este
 * existe para o time ficar em volta dele, e bloquear seria atrapalhar
 * justamente quem ele ajuda.
 */
export function createEstandarte(params) {
    nextStructureNumber += 1;
    return {
        id: `s${nextStructureNumber}`,
        kind: 'estandarte',
        ownerId: params.ownerId,
        team: params.team,
        radius: ESTANDARTE.radius,
        position: {
            x: clamp(params.position.x, ESTANDARTE.radius, ARENA.width - ESTANDARTE.radius),
            y: clamp(params.position.y, ESTANDARTE.radius, ARENA.height - ESTANDARTE.radius),
        },
        health: ESTANDARTE.maxHealth,
        maxHealth: ESTANDARTE.maxHealth,
        combatState: 'ready',
        damagedByAllies: false,
        solid: false,
        remainingMs: ESTANDARTE.durationMs,
        operatorId: null,
        cooldownMs: 0,
        aim: { x: 0, y: -1 },
    };
}
/** Estandarte vivo cobrindo este ponto? */
export function shelteringBanner(position, team, structures) {
    for (const structure of structures) {
        if (structure.kind !== 'estandarte')
            continue;
        if (structure.team !== team)
            continue;
        if (structure.health <= 0)
            continue;
        const gap = Math.hypot(position.x - structure.position.x, position.y - structure.position.y);
        if (gap <= ESTANDARTE.auraRadius)
            return structure;
    }
    return null;
}
/**
 * Degrau visual, igual ao do portao.
 *
 * VISUAL_BIBLE.md pede estados progressivos para barricadas tambem, nao so
 * para o portao.
 */
export function conditionOf(structure) {
    if (structure.health <= 0)
        return 'destroyed';
    const ratio = structure.health / structure.maxHealth;
    if (ratio > 0.66)
        return 'intact';
    if (ratio > 0.33)
        return 'damaged';
    return 'critical';
}
export function isGone(structure) {
    return structure.health <= 0 || structure.remainingMs <= 0;
}
/**
 * Espaco livre o bastante para construir aqui?
 *
 * O unico limite de terreno e nao erguer dentro da muralha. Chegou-se a testar
 * distancia minima do portao, mas isso proibia justamente o lugar onde a
 * barricada serve -- entre a invasao e o objetivo.
 */
export function hasRoomFor(position, existing, radius = BARRICADA.radius) {
    const margin = ARENA.wallThickness + radius;
    const insideWall = position.y < margin ||
        position.y > ARENA.height - margin ||
        position.x < margin ||
        position.x > ARENA.width - margin;
    if (insideWall)
        return false;
    return existing.every((structure) => Math.hypot(position.x - structure.position.x, position.y - structure.position.y) >=
        BARRICADA.minSpacing);
}
export function toSnapshot(structure) {
    return {
        id: structure.id,
        kind: structure.kind,
        x: Math.round(structure.position.x),
        y: Math.round(structure.position.y),
        radius: structure.radius,
        team: structure.team,
        health: Math.round(structure.health),
        maxHealth: structure.maxHealth,
        condition: conditionOf(structure),
        operated: structure.operatorId !== null,
        aimX: Math.round(structure.aim.x * 100) / 100,
        aimY: Math.round(structure.aim.y * 100) / 100,
    };
}
//# sourceMappingURL=structure.js.map