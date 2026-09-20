import { CAO } from '../../protocol/index.js';
let nextPackNumber = 0;
export function createCompanion(ownerId, position, 
/** Tempo em campo. Ausente = companheiro permanente. */
leavesInMs) {
    // Os caes chamados precisam de id proprio: o do companheiro e derivado do
    // dono justamente para haver so um por Mestre.
    const id = leavesInMs === undefined ? `cao-${ownerId}` : `cao-${ownerId}-${(nextPackNumber += 1)}`;
    return {
        id,
        ownerId,
        team: 'defenders',
        radius: CAO.radius,
        // Fogo amigo fere o cao: e parte do preco de ter um corpo a mais em campo.
        damagedByAllies: true,
        // Invasor encara o cao, mas so quando nao ha gente a alcance: ele e um
        // corpo real, nao o alvo preferido.
        secondaryTarget: true,
        position: { ...position },
        aim: { x: 0, y: -1 },
        health: CAO.maxHealth,
        maxHealth: CAO.maxHealth,
        speed: CAO.speed,
        combatState: 'ready',
        attackTimerMs: 0,
        attackCooldownMs: 0,
        attackAim: { x: 0, y: -1 },
        attack: CAO.attack,
        msSinceDamage: Number.POSITIVE_INFINITY,
        rootedMs: 0,
        order: 'follow',
        orderTargetId: null,
        guardPosition: null,
        recoveryMs: 0,
        leavesInMs: leavesInMs ?? null,
    };
}
/** O cao chamado ja cumpriu o tempo dele? */
export function hasLeft(companion) {
    return companion.leavesInMs !== null && companion.leavesInMs <= 0;
}
/** Volta o cao ao estado inicial, no comeco da partida. */
export function resetCompanion(companion, position) {
    companion.position = { ...position };
    companion.health = CAO.maxHealth;
    companion.combatState = 'ready';
    companion.attackTimerMs = 0;
    companion.attackCooldownMs = 0;
    companion.rootedMs = 0;
    companion.recoveryMs = 0;
    companion.order = 'follow';
    companion.orderTargetId = null;
    companion.guardPosition = null;
}
export function isDown(companion) {
    return companion.combatState === 'incapacitated';
}
export function toSnapshot(companion) {
    return {
        id: companion.id,
        ownerId: companion.ownerId,
        x: Math.round(companion.position.x),
        y: Math.round(companion.position.y),
        aimX: Math.round(companion.aim.x * 100) / 100,
        aimY: Math.round(companion.aim.y * 100) / 100,
        health: Math.round(companion.health),
        maxHealth: companion.maxHealth,
        state: companion.combatState,
        order: companion.order,
        orderTargetId: companion.orderTargetId,
        guardX: companion.guardPosition ? Math.round(companion.guardPosition.x) : null,
        guardY: companion.guardPosition ? Math.round(companion.guardPosition.y) : null,
        recovery: companion.recoveryMs > 0
            ? Math.round((1 - companion.recoveryMs / CAO.recoveryMs) * 100) / 100
            : 0,
    };
}
//# sourceMappingURL=companion.js.map