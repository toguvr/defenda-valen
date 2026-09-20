import { ARENA, COMBAT, PROJECTILE } from '../../protocol/index.js';
import { isAlive } from '../domain/combatant.js';
import { roundForWire } from '../domain/vector.js';
import { shieldReduction } from './ability.js';
import { incomingDamageFactor } from './special.js';
import { upgradeFriendlyFireFactor } from './progression.js';
let nextProjectileNumber = 0;
export function createProjectile(params) {
    nextProjectileNumber += 1;
    const magnitude = Math.hypot(params.direction.x, params.direction.y) || 1;
    return {
        id: `p${nextProjectileNumber}`,
        ownerId: params.ownerId,
        team: params.team,
        position: { ...params.origin },
        direction: { x: params.direction.x / magnitude, y: params.direction.y / magnitude },
        speed: params.speed,
        radius: params.radius,
        damage: params.damage,
        splashRadius: params.splashRadius ?? 0,
        remainingRange: params.maxRange,
    };
}
/**
 * Primeiro alvo atingido no trecho percorrido neste tick.
 *
 * Resolve a distancia ao longo do segmento em que o projetil encosta em cada
 * candidato e devolve o mais proximo. Funcao pura e exportada porque e a regra
 * que o jogador precisa conseguir prever olhando a tela.
 */
export function firstTargetAlong(from, to, projectileRadius, candidates, ownerId) {
    const segmentX = to.x - from.x;
    const segmentY = to.y - from.y;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
    let best = null;
    for (const candidate of candidates) {
        if (candidate.id === ownerId)
            continue;
        if (!isAlive(candidate))
            continue;
        const reach = candidate.radius + projectileRadius;
        const toCandidateX = candidate.position.x - from.x;
        const toCandidateY = candidate.position.y - from.y;
        // Ponto do segmento mais proximo do centro do alvo.
        const t = segmentLengthSquared === 0
            ? 0
            : Math.max(0, Math.min(1, (toCandidateX * segmentX + toCandidateY * segmentY) / segmentLengthSquared));
        const closestX = from.x + segmentX * t;
        const closestY = from.y + segmentY * t;
        const gap = Math.hypot(candidate.position.x - closestX, candidate.position.y - closestY);
        if (gap > reach)
            continue;
        if (best === null || t < best.t)
            best = { target: candidate, t };
    }
    return best;
}
/**
 * Fator de fogo amigo de quem atirou.
 *
 * Buscado na lista em vez de guardado no projetil: o dono ja esta ali, e
 * carregar o numero no projetil obrigaria todos os pontos de criacao --
 * habilidade, balista, arco de invasor -- a lembrar de passa-lo.
 */
function friendlyFireFactorOf(projectile, candidates) {
    const owner = candidates.find((candidate) => candidate.id === projectile.ownerId);
    return owner ? upgradeFriendlyFireFactor(owner) : 1;
}
function damageFor(base, friendly) {
    const raw = friendly ? base * COMBAT.friendlyFireMultiplier : base;
    return Math.max(1, Math.round(raw));
}
/**
 * Avanca todos os projeteis um tick e resolve os impactos.
 *
 * Devolve os projeteis que sairam de campo neste tick, com o acerto quando
 * houve. Quem chama remove os impactados da lista.
 */
export function stepProjectiles(projectiles, candidates, elapsedMs) {
    const impacts = [];
    const seconds = elapsedMs / 1000;
    for (const projectile of projectiles) {
        const travel = Math.min(projectile.speed * seconds, projectile.remainingRange);
        const from = { ...projectile.position };
        const to = {
            x: from.x + projectile.direction.x * travel,
            y: from.y + projectile.direction.y * travel,
        };
        const found = firstTargetAlong(from, to, projectile.radius, candidates, projectile.ownerId);
        if (found) {
            const target = found.target;
            const friendly = target.team === projectile.team;
            // Mesmo respeito ao portao: aliado nao derruba o proprio objetivo.
            if (friendly && !target.damagedByAllies) {
                projectile.position = to;
                projectile.remainingRange -= travel;
            }
            else {
                const reduction = shieldReduction(target, from.x, from.y);
                const damage = Math.max(1, Math.round(damageFor(projectile.damage, friendly) *
                    (1 - reduction) *
                    incomingDamageFactor(target) *
                    // Maos Firmes vale para flecha tambem: a melhoria e de quem
                    // atira, nao do tipo de arma.
                    (friendly ? friendlyFireFactorOf(projectile, candidates) : 1)));
                target.health = Math.max(0, target.health - damage);
                if ('msSinceDamage' in target)
                    target.msSinceDamage = 0;
                const incapacitated = target.health === 0;
                if (incapacitated) {
                    target.combatState = 'incapacitated';
                    if ('attackTimerMs' in target)
                        target.attackTimerMs = 0;
                }
                const impactX = from.x + (to.x - from.x) * found.t;
                const impactY = from.y + (to.y - from.y) * found.t;
                const hits = [
                    { targetId: target.id, targetTeam: target.team, damage, friendly, incapacitated },
                ];
                // Frasco do Alquimista: pega quem esta em volta, aliado incluso.
                if (projectile.splashRadius > 0) {
                    hits.push(...applySplash({ x: impactX, y: impactY }, projectile, candidates, new Set([target.id])));
                }
                impacts.push({
                    projectile,
                    hits,
                    x: roundForWire(impactX),
                    y: roundForWire(impactY),
                });
                continue;
            }
        }
        else {
            projectile.position = to;
            projectile.remainingRange -= travel;
        }
        const outOfBounds = projectile.position.x < 0 ||
            projectile.position.y < 0 ||
            projectile.position.x > ARENA.width ||
            projectile.position.y > ARENA.height;
        if (projectile.remainingRange <= 0 || outOfBounds) {
            // Frasco que cai no chao ainda estoura: e a arma de area do Alquimista,
            // nao um tiro que precisa acertar alguem.
            const hits = projectile.splashRadius > 0
                ? applySplash(projectile.position, projectile, candidates, new Set())
                : [];
            impacts.push({
                projectile,
                hits,
                x: roundForWire(projectile.position.x),
                y: roundForWire(projectile.position.y),
            });
        }
    }
    return impacts;
}
/**
 * Dano em area no ponto de impacto.
 *
 * Nao poupa aliado: area e area. O Alquimista existe para controlar terreno,
 * e o preco disso e que o terreno nao distingue de que lado voce esta.
 */
function applySplash(center, projectile, candidates, alreadyHit) {
    const hits = [];
    for (const candidate of candidates) {
        if (alreadyHit.has(candidate.id))
            continue;
        if (candidate.id === projectile.ownerId)
            continue;
        if (!isAlive(candidate))
            continue;
        const gap = Math.hypot(candidate.position.x - center.x, candidate.position.y - center.y);
        if (gap > projectile.splashRadius + candidate.radius)
            continue;
        const friendly = candidate.team === projectile.team;
        if (friendly && !candidate.damagedByAllies)
            continue;
        const damage = Math.max(1, Math.round(damageFor(projectile.damage, friendly) *
            incomingDamageFactor(candidate) *
            (friendly ? friendlyFireFactorOf(projectile, candidates) : 1)));
        candidate.health = Math.max(0, candidate.health - damage);
        if ('msSinceDamage' in candidate)
            candidate.msSinceDamage = 0;
        const incapacitated = candidate.health === 0;
        if (incapacitated) {
            candidate.combatState = 'incapacitated';
            if ('attackTimerMs' in candidate)
                candidate.attackTimerMs = 0;
        }
        hits.push({
            targetId: candidate.id,
            targetTeam: candidate.team,
            damage,
            friendly,
            incapacitated,
        });
    }
    return hits;
}
export function canSpawnProjectile(current) {
    return current < PROJECTILE.maxInFlight;
}
//# sourceMappingURL=projectile.js.map