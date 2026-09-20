import { GATE } from '../../protocol/index.js';
export function createGate() {
    return {
        id: 'gate',
        team: 'defenders',
        radius: GATE.radius,
        halfExtents: { x: GATE.halfWidth, y: GATE.halfHeight },
        position: { x: GATE.x, y: GATE.y },
        health: GATE.maxHealth,
        maxHealth: GATE.maxHealth,
        combatState: 'ready',
        damagedByAllies: GATE.damagedByDefenders,
    };
}
/**
 * Degrau visual do portao.
 *
 * VISUAL_BIBLE.md: feedback progressivo em vez de barra de HP. O jogador
 * precisa saber como esta o objetivo de relance, no meio do combate.
 */
export function conditionOf(gate) {
    if (gate.health <= 0)
        return 'destroyed';
    const ratio = gate.health / gate.maxHealth;
    if (ratio > 0.66)
        return 'intact';
    if (ratio > 0.33)
        return 'damaged';
    return 'critical';
}
export function isDestroyed(gate) {
    return gate.health <= 0;
}
export function toSnapshot(gate) {
    return {
        health: gate.health,
        maxHealth: gate.maxHealth,
        condition: conditionOf(gate),
        x: gate.position.x,
        y: gate.position.y,
        radius: gate.radius,
    };
}
//# sourceMappingURL=gate.js.map