import { ARENA, CAO } from '../../protocol/index.js';
import { isAlive } from '../domain/combatant.js';
import { clamp } from '../domain/vector.js';
import { beginAttack, canMove, canStartAttack } from './combat.js';
/**
 * Traduz um gesto de apontar numa ordem.
 *
 * Inimigo na direcao vira ataque; aliado vira protecao; chao vazio vira
 * guarda. A precedencia e essa porque apontar para uma briga quase sempre
 * significa "morde aquele", nao "fica ali".
 */
export function resolveCommand(owner, aim, enemies, allies) {
    const magnitude = Math.hypot(aim.x, aim.y);
    const direction = magnitude === 0 ? { ...owner.aim } : { x: aim.x / magnitude, y: aim.y / magnitude };
    const enemy = nearestAlong(owner.position, direction, enemies);
    if (enemy)
        return { order: 'attack', targetId: enemy.id, position: null };
    const ally = nearestAlong(owner.position, direction, allies.filter((candidate) => candidate.id !== owner.id));
    if (ally)
        return { order: 'protect', targetId: ally.id, position: null };
    return {
        order: 'guard',
        targetId: null,
        position: {
            x: clamp(owner.position.x + direction.x * CAO.commandRange, CAO.radius, ARENA.width - CAO.radius),
            y: clamp(owner.position.y + direction.y * CAO.commandRange, CAO.radius, ARENA.height - CAO.radius),
        },
    };
}
/**
 * Candidato mais proximo na direcao apontada.
 *
 * Usa um cone generoso porque apontar com o mouse no meio do combate nao e
 * preciso -- exigir mira fina transformaria um comando em teste de pontaria.
 */
function nearestAlong(origin, direction, candidates) {
    const halfCone = Math.PI / 5;
    let best;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
        if (!isAlive(candidate))
            continue;
        const dx = candidate.position.x - origin.x;
        const dy = candidate.position.y - origin.y;
        const distance = Math.hypot(dx, dy);
        if (distance === 0 || distance > CAO.commandRange)
            continue;
        const cosine = (dx * direction.x + dy * direction.y) / distance;
        if (Math.acos(Math.min(1, Math.max(-1, cosine))) > halfCone)
            continue;
        if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
        }
    }
    return best;
}
/** Um passo de decisao e movimento do cao. */
export function stepCompanion(companion, owner, enemies, allies, elapsedMs, terrainFactor = 1) {
    if (companion.recoveryMs > 0) {
        companion.recoveryMs -= elapsedMs;
        if (companion.recoveryMs <= 0) {
            // Levanta sozinho: o companheiro nao se perde por um erro.
            companion.recoveryMs = 0;
            companion.combatState = 'ready';
            companion.health = Math.round(companion.maxHealth * CAO.recoveredFraction);
            companion.order = 'follow';
            companion.orderTargetId = null;
            companion.guardPosition = null;
        }
        return;
    }
    if (!isAlive(companion)) {
        companion.recoveryMs = CAO.recoveryMs;
        return;
    }
    if (companion.rootedMs > 0) {
        companion.rootedMs = Math.max(0, companion.rootedMs - elapsedMs);
        return;
    }
    const destination = resolveDestination(companion, owner, enemies, allies);
    if (destination === null)
        return;
    const hostile = nearestHostile(companion, enemies);
    const contact = hostile
        ? Math.hypot(hostile.position.x - companion.position.x, hostile.position.y - companion.position.y)
        : Number.POSITIVE_INFINITY;
    // Morde o que estiver ao alcance, seja qual for a ordem: cao nao ignora
    // quem esta em cima dele.
    if (hostile && contact <= CAO.attack.range * 0.8 + hostile.radius) {
        face(companion, hostile.position);
        if (canStartAttack(companion))
            beginAttack(companion, companion.aim);
        return;
    }
    if (!canMove(companion))
        return;
    const gap = Math.hypot(destination.x - companion.position.x, destination.y - companion.position.y);
    if (gap <= destination.stopWithin) {
        if (hostile && contact < CAO.commandRange)
            face(companion, hostile.position);
        return;
    }
    face(companion, destination);
    const step = Math.min(companion.speed * terrainFactor * (elapsedMs / 1000), gap);
    companion.position = {
        x: clamp(companion.position.x + companion.aim.x * step, companion.radius, ARENA.width - companion.radius),
        y: clamp(companion.position.y + companion.aim.y * step, companion.radius, ARENA.height - companion.radius),
    };
}
/** Para onde o cao vai, dada a ordem atual. */
function resolveDestination(companion, owner, enemies, allies) {
    if (companion.order === 'attack') {
        const target = enemies.find((enemy) => enemy.id === companion.orderTargetId);
        if (target && isAlive(target)) {
            return { x: target.position.x, y: target.position.y, stopWithin: CAO.attack.range * 0.6 };
        }
        // Alvo caiu: volta a acompanhar em vez de ficar parado no vazio.
        companion.order = 'follow';
        companion.orderTargetId = null;
    }
    if (companion.order === 'protect') {
        const ward = allies.find((ally) => ally.id === companion.orderTargetId);
        if (ward && ward.connected) {
            return { x: ward.position.x, y: ward.position.y, stopWithin: CAO.followDistance };
        }
        companion.order = 'follow';
        companion.orderTargetId = null;
    }
    if (companion.order === 'guard' && companion.guardPosition) {
        return { ...companion.guardPosition, stopWithin: CAO.followDistance * 0.5 };
    }
    if (!owner || !owner.connected)
        return null;
    return { x: owner.position.x, y: owner.position.y, stopWithin: CAO.followDistance };
}
function nearestHostile(companion, enemies) {
    let best;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of enemies) {
        if (!isAlive(enemy))
            continue;
        const distance = Math.hypot(enemy.position.x - companion.position.x, enemy.position.y - companion.position.y);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = enemy;
        }
    }
    return best;
}
function face(companion, point) {
    const dx = point.x - companion.position.x;
    const dy = point.y - companion.position.y;
    const length = Math.hypot(dx, dy);
    if (length > 0)
        companion.aim = { x: dx / length, y: dy / length };
}
//# sourceMappingURL=companion-ai.js.map