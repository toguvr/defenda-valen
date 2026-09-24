import { GROUND, PLAYER } from '../../protocol/index.js';
/** Distancia para pegar do chao. Igual ao alcance de socorrer um aliado. */
export const PICKUP_RANGE = PLAYER.radius + 42;
let nextItemNumber = 0;
export function createGroundItem(weaponId, position) {
    nextItemNumber += 1;
    return {
        id: `g${nextItemNumber}`,
        weaponId,
        position: { ...position },
        lockedMs: 400,
        remainingMs: GROUND.lifetimeMs,
    };
}
export function toSnapshot(item) {
    return {
        id: item.id,
        x: item.position.x,
        y: item.position.y,
        weaponId: item.weaponId,
        // Fracao do tempo que resta, so na reta final: o client pisca com ela.
        fading: Math.max(0, Math.min(1, item.remainingMs / GROUND.fadeMs)),
    };
}
//# sourceMappingURL=ground-item.js.map