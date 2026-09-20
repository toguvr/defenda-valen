import { BALISTA } from '../../protocol/index.js';
import { isAlive } from '../domain/combatant.js';
import { createProjectile } from './projectile.js';
/**
 * Operar a balista.
 *
 * O ponto da arma nao e o dano: e **outro jogador** poder assumir. CLAUDE.md
 * lista isso como sinergia real, em vez de bonus invisivel -- o Engenheiro
 * monta, alguem sem alcance sobe e passa a ter.
 *
 * Quem opera fica preso no lugar. E o preco, e o que torna "quem vai na
 * balista" uma decisao do time em vez de um upgrade gratis.
 */
/** Assume ou larga a arma na borda de subida da interacao contextual. */
export function stepSiegeUse(players, structures) {
    for (const player of players) {
        const pressed = player.interacting && !player.wasInteracting;
        player.wasInteracting = player.interacting;
        // Solta a arma sozinho quando cai, desconecta, ou a arma acaba.
        const current = structures.find((structure) => structure.id === player.operatingId);
        if (player.operatingId !== null &&
            (current === undefined || !isAlive(current) || !player.connected || !isAlive(player))) {
            if (current)
                current.operatorId = null;
            player.operatingId = null;
            continue;
        }
        if (!pressed)
            continue;
        if (player.operatingId !== null) {
            // Segunda vez: desce.
            if (current)
                current.operatorId = null;
            player.operatingId = null;
            continue;
        }
        const free = nearestFreeWeapon(player, structures);
        if (free === null)
            continue;
        free.operatorId = player.id;
        player.operatingId = free.id;
    }
}
/**
 * Arma livre ao alcance, do proprio time.
 *
 * Uma por vez: dois operadores na mesma balista dobrariam a cadencia sem
 * dobrar o custo de estar parado.
 */
function nearestFreeWeapon(player, structures) {
    let best = null;
    let bestDistance = BALISTA.useRange;
    for (const structure of structures) {
        if (structure.kind !== 'balista')
            continue;
        if (structure.team !== player.team)
            continue;
        if (structure.operatorId !== null)
            continue;
        if (!isAlive(structure))
            continue;
        const distance = Math.hypot(structure.position.x - player.position.x, structure.position.y - player.position.y);
        if (distance > bestDistance)
            continue;
        bestDistance = distance;
        best = structure;
    }
    return best;
}
/** Recarga das armas, e a mira que segue quem opera. */
export function stepSiegeWeapons(structures, players, elapsedMs) {
    for (const structure of structures) {
        if (structure.cooldownMs > 0) {
            structure.cooldownMs = Math.max(0, structure.cooldownMs - elapsedMs);
        }
        if (structure.operatorId === null)
            continue;
        const operator = players.find((player) => player.id === structure.operatorId);
        if (operator)
            structure.aim = { ...operator.aim };
    }
}
/** Quem esta na manivela nao anda. */
export function isOperating(player) {
    return player.operatingId !== null;
}
/**
 * Dispara a balista, se ela estiver carregada.
 *
 * Devolve `null` quando a arma ainda esta recarregando -- a recarga e da arma,
 * nao do jogador, entao revezar operador nao acelera nada.
 */
export function fireBolt(operator, weapon, aim) {
    if (weapon.cooldownMs > 0)
        return null;
    const magnitude = Math.hypot(aim.x, aim.y);
    const direction = magnitude === 0 ? { ...weapon.aim } : { x: aim.x / magnitude, y: aim.y / magnitude };
    weapon.cooldownMs = BALISTA.bolt.cooldownMs;
    weapon.aim = direction;
    operator.aim = direction;
    operator.attackAim = direction;
    return createProjectile({
        // O dono do virote e quem atira: o fogo amigo e responsabilidade de quem
        // puxou, nao de quem montou a arma.
        ownerId: operator.id,
        team: operator.team,
        origin: {
            x: weapon.position.x + direction.x * (weapon.radius + 10),
            y: weapon.position.y + direction.y * (weapon.radius + 10),
        },
        direction,
        speed: BALISTA.bolt.speed,
        maxRange: BALISTA.bolt.maxRange,
        radius: BALISTA.bolt.radius,
        damage: BALISTA.bolt.damage,
    });
}
//# sourceMappingURL=siege.js.map