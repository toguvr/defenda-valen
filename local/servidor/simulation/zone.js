import { ARMADILHA, ARENA, CHUVA_DE_FLECHAS, COMBAT, INCENDIO, OLEO, } from '../../protocol/index.js';
import { isAlive } from '../domain/combatant.js';
import { clamp } from '../domain/vector.js';
let nextZoneNumber = 0;
/** Raio e duracao de cada tipo. O fogo herda os da poca que queimou. */
function specFor(kind) {
    switch (kind) {
        case 'oleo':
            return OLEO;
        case 'armadilha':
            return ARMADILHA;
        case 'flechas':
            return {
                radius: CHUVA_DE_FLECHAS.radius,
                durationMs: CHUVA_DE_FLECHAS.telegraphMs +
                    CHUVA_DE_FLECHAS.volleys * CHUVA_DE_FLECHAS.volleyIntervalMs,
            };
        case 'fogo':
            return { radius: OLEO.radius, durationMs: INCENDIO.durationMs };
    }
}
export function createZone(params) {
    nextZoneNumber += 1;
    const spec = specFor(params.kind);
    const radius = params.radius ?? spec.radius;
    return {
        id: `z${nextZoneNumber}`,
        kind: params.kind,
        ownerId: params.ownerId,
        team: params.team,
        position: {
            x: clamp(params.position.x, radius, ARENA.width - radius),
            y: clamp(params.position.y, radius, ARENA.height - radius),
        },
        radius,
        remainingMs: spec.durationMs,
        durationMs: spec.durationMs,
        triggered: false,
        elapsedMs: 0,
        pulses: 0,
    };
}
/**
 * Troca a poca de oleo por fogo, no mesmo lugar e com o mesmo tamanho.
 *
 * Substituir em vez de sobrepor: uma poca em chamas nao continua sendo poca, e
 * deixar as duas juntas faria o alvo escorregar *e* queimar com dois efeitos
 * somados que ninguem consegue ler em tela.
 */
export function ignite(zone, byPlayerId) {
    return createZone({
        kind: 'fogo',
        ownerId: byPlayerId,
        team: zone.team,
        position: zone.position,
        radius: zone.radius,
    });
}
/** O oleo e o unico terreno que pega fogo. */
export function isFlammable(zone) {
    return zone.kind === 'oleo' && OLEO.flammable && !zone.triggered;
}
/** Ponto de destino de uma zona lancada, limitado pelo alcance da habilidade. */
export function landingSpot(origin, aim, range) {
    const magnitude = Math.hypot(aim.x, aim.y);
    if (magnitude === 0)
        return { ...origin };
    return {
        x: origin.x + (aim.x / magnitude) * range,
        y: origin.y + (aim.y / magnitude) * range,
    };
}
function isInside(zone, target) {
    return (Math.hypot(target.position.x - zone.position.x, target.position.y - zone.position.y) <=
        zone.radius + target.radius);
}
/**
 * Fracao da velocidade que o corpo mantem, dadas as zonas em campo.
 *
 * O Oleo pega todo mundo: e terreno. Multiplicar (em vez de somar) mantem o
 * efeito previsivel quando pocas se sobrepoem.
 */
export function zoneSpeedFactor(zones, target) {
    let factor = 1;
    for (const zone of zones) {
        if (zone.kind !== 'oleo' || zone.triggered)
            continue;
        if (!isInside(zone, target))
            continue;
        factor *= OLEO.speedFactor;
    }
    return factor;
}
/**
 * Avanca as zonas um tick e resolve o que elas disparam.
 *
 * Devolve os disparos. Quem chama remove as zonas expiradas.
 */
export function stepZones(zones, candidates, elapsedMs) {
    const triggers = [];
    for (const zone of zones) {
        zone.remainingMs -= elapsedMs;
        zone.elapsedMs += elapsedMs;
        if (zone.triggered)
            continue;
        switch (zone.kind) {
            case 'armadilha': {
                const hit = springTrap(zone, candidates);
                if (hit)
                    triggers.push({ zone, hits: [hit] });
                break;
            }
            case 'flechas': {
                const hits = rainArrows(zone, candidates);
                if (hits.length > 0)
                    triggers.push({ zone, hits });
                break;
            }
            case 'fogo': {
                const hits = burn(zone, candidates);
                if (hits.length > 0)
                    triggers.push({ zone, hits });
                break;
            }
            case 'oleo':
                break;
        }
    }
    return triggers;
}
/** Armadilha: pega o primeiro invasor que pisa, e so ele. */
function springTrap(zone, candidates) {
    for (const candidate of candidates) {
        // Aliado nao ativa: CLAUDE.md e explicito para evitar frustracao.
        if (candidate.team === zone.team)
            continue;
        if (!isAlive(candidate))
            continue;
        if (!isInside(zone, candidate))
            continue;
        const damage = ARMADILHA.damage;
        candidate.health = Math.max(0, candidate.health - damage);
        if ('msSinceDamage' in candidate)
            candidate.msSinceDamage = 0;
        if ('rootedMs' in candidate) {
            ;
            candidate.rootedMs = ARMADILHA.rootMs;
        }
        const incapacitated = candidate.health === 0;
        if (incapacitated)
            candidate.combatState = 'incapacitated';
        zone.triggered = true;
        // Some logo depois de disparar: o corpo da armadilha ja cumpriu o papel.
        zone.remainingMs = Math.min(zone.remainingMs, 600);
        return {
            targetId: candidate.id,
            targetTeam: candidate.team,
            damage,
            friendly: false,
            incapacitated,
        };
    }
    return null;
}
/**
 * Chuva de Flechas: avisa, depois cai em salvas.
 *
 * O aviso nao e enfeite -- e o que da ao aliado a chance de sair, e ao
 * Arqueiro a responsabilidade de escolher o momento. Sem ele, a area seria
 * so dano que cai do ceu.
 */
function rainArrows(zone, candidates) {
    if (zone.elapsedMs < CHUVA_DE_FLECHAS.telegraphMs)
        return [];
    const since = zone.elapsedMs - CHUVA_DE_FLECHAS.telegraphMs;
    const due = Math.min(CHUVA_DE_FLECHAS.volleys, Math.floor(since / CHUVA_DE_FLECHAS.volleyIntervalMs) + 1);
    if (due <= zone.pulses)
        return [];
    zone.pulses = due;
    return sweep(zone, candidates, CHUVA_DE_FLECHAS.damagePerVolley);
}
/** Fogo: queima em intervalos legiveis, nao num fluxo continuo de numeros. */
function burn(zone, candidates) {
    const due = Math.floor(zone.elapsedMs / INCENDIO.tickMs);
    if (due <= zone.pulses)
        return [];
    zone.pulses = due;
    return sweep(zone, candidates, INCENDIO.damagePerTick);
}
/**
 * Aplica dano a todo corpo dentro da zona.
 *
 * Nao poupa aliado: area e area. O aliado leva a fracao de fogo amigo, a
 * mesma do resto do jogo -- e o portao continua fora, porque defensor nao
 * derruba o proprio objetivo por erro de mira.
 */
function sweep(zone, candidates, baseDamage) {
    const hits = [];
    for (const candidate of candidates) {
        if (!isAlive(candidate))
            continue;
        if (!isInside(zone, candidate))
            continue;
        const friendly = candidate.team === zone.team;
        if (friendly && !candidate.damagedByAllies)
            continue;
        const damage = Math.max(1, Math.round(friendly ? baseDamage * COMBAT.friendlyFireMultiplier : baseDamage));
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
export function isExpired(zone) {
    return zone.remainingMs <= 0;
}
//# sourceMappingURL=zone.js.map