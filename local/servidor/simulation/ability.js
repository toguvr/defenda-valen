import { AIMED_SHOT, ARENA, ARMADILHA, BARRICADA, CHARGE, CLASSES, HEAL, OLEO, SHIELD, } from '../../protocol/index.js';
import { isAlive } from '../domain/combatant.js';
import { clamp } from '../domain/vector.js';
import { damageFor } from './combat.js';
import { createProjectile } from './projectile.js';
import { createZone, landingSpot } from './zone.js';
import { createBarricada } from '../domain/structure.js';
import { upgradeAbilityCooldownFactor } from './progression.js';
/** Habilidade pronta para uso agora? */
export function canUseAbility(player) {
    const profile = CLASSES[player.classId].ability;
    if (!profile.available)
        return false;
    if (player.combatState === 'incapacitated')
        return false;
    return player.abilityCooldownMs <= 0;
}
/**
 * Registra a intencao do client.
 *
 * Para as sustentadas, apenas liga e desliga a flag -- o efeito e aplicado no
 * tick. Para as instantaneas, dispara aqui e devolve o resultado.
 */
export function requestAbility(player, active, aim, targets) {
    const profile = CLASSES[player.classId].ability;
    if (!profile.available)
        return null;
    if (profile.sustained) {
        // Sustentada nao "dispara": guarda a **intencao**, que dura enquanto o
        // dedo estiver no botao. O efeito e reavaliado a cada tick, em
        // `stepAbilityCooldown`; aqui ele tambem e aplicado de imediato para o
        // botao responder no mesmo quadro em que foi apertado.
        player.abilityHeld = active;
        player.abilityActive = active && player.combatState === 'ready';
        return null;
    }
    if (!active || !canUseAbility(player))
        return null;
    if (profile.id === 'curativo') {
        // Um clique enche o tempo. Clicar de novo recomeca -- e o que o jogador
        // espera de um botao que ele ja apertou uma vez para ligar.
        player.healChannelMs = HEAL.durationMs;
        player.abilityActive = true;
        return null;
    }
    const magnitude = Math.hypot(aim.x, aim.y);
    const direction = magnitude === 0 ? { ...player.aim } : { x: aim.x / magnitude, y: aim.y / magnitude };
    // Prontidao encurta a recarga: cobrada na hora do uso, nao no relogio.
    player.abilityCooldownMs = profile.cooldownMs * upgradeAbilityCooldownFactor(player);
    switch (profile.id) {
        case 'quebra_linha':
            return chargeThrough(player, direction, targets);
        case 'disparo_preciso':
            return aimedShot(player, direction);
        case 'oleo':
            return dropZone(player, direction, 'oleo', OLEO.throwRange);
        case 'armadilha':
            return dropZone(player, direction, 'armadilha', ARMADILHA.throwRange);
        case 'barricada':
            return buildBarricade(player, direction);
        case 'comandar_cao':
            // Resolvida pela sala, que e quem conhece o cao e o resto do campo.
            return {
                playerId: player.id,
                abilityId: 'comandar_cao',
                x: player.position.x,
                y: player.position.y,
                aimX: direction.x,
                aimY: direction.y,
                targetId: null,
                hits: [],
                command: direction,
            };
        default:
            return null;
    }
}
/**
 * Escudo: reduz o dano que chega de frente.
 *
 * Direcional de proposito -- as costas ficam abertas. Um Guerreiro defendendo
 * a frente errada nao esta defendendo nada, e e isso que torna posicionar o
 * escudo uma decisao em vez de um botao de sobrevivencia.
 */
export function shieldReduction(target, fromX, fromY) {
    const player = target;
    if (!player.abilityActive)
        return 0;
    if (CLASSES[player.classId]?.ability.id !== 'escudo')
        return 0;
    const toAttackerX = fromX - player.position.x;
    const toAttackerY = fromY - player.position.y;
    const distance = Math.hypot(toAttackerX, toAttackerY);
    if (distance === 0)
        return SHIELD.damageReduction;
    const facing = Math.hypot(player.aim.x, player.aim.y) || 1;
    const cosine = (toAttackerX * player.aim.x + toAttackerY * player.aim.y) / (distance * facing);
    const angle = Math.acos(Math.min(1, Math.max(-1, cosine)));
    return angle <= ((SHIELD.arcDegrees / 2) * Math.PI) / 180 ? SHIELD.damageReduction : 0;
}
/** Fracao da velocidade que o personagem mantem agora. */
export function speedFactor(player) {
    if (!player.abilityActive)
        return 1;
    return CLASSES[player.classId].ability.id === 'escudo' ? SHIELD.speedFactor : 1;
}
/** Quem esta curando nao ataca: as duas coisas ocupam as maos. */
export function blocksAttack(player) {
    return player.abilityActive && CLASSES[player.classId].ability.id === 'curativo';
}
/**
 * Curativo: cura o aliado ferido mais proximo enquanto o botao e mantido.
 *
 * Interrompido por dano -- e o preco de curar dentro do combate em vez de
 * atras da linha.
 */
export function stepHeal(players, elapsedMs) {
    const events = [];
    for (const healer of players) {
        if (CLASSES[healer.classId].ability.id !== 'curativo')
            continue;
        if (healer.healChannelMs <= 0)
            continue;
        // Tres jeitos de cortar. Os tres sao coisas que o jogador ve acontecer, e
        // e isso que faz o Curativo ser uma aposta e nao um botao de sempre.
        const cut = healer.combatState !== 'ready' ||
            healer.msSinceDamage < HEAL.interruptMs ||
            healer.movedByInput;
        if (cut) {
            endHealChannel(healer);
            continue;
        }
        healer.healChannelMs = Math.max(0, healer.healChannelMs - elapsedMs);
        healer.abilityActive = healer.healChannelMs > 0;
        // Cuida de si **e** do ferido mais proximo. O Suporte que se esquece morre
        // com o time inteiro de pe, e ai ninguem mais cura ninguem.
        const ally = nearestWoundedAlly(healer, players);
        const amount = HEAL.perSecond * (elapsedMs / 1000);
        const mended = [healer, ally].filter((body) => body !== null);
        let touched = false;
        for (const body of mended) {
            const healed = Math.min(body.maxHealth - body.health, amount);
            if (healed <= 0)
                continue;
            body.health += healed;
            touched = true;
        }
        healer.healTargetId = ally?.id ?? null;
        // Canal cumprido ate o fim: cobra a recarga igual a qualquer outro fim.
        if (healer.healChannelMs === 0)
            endHealChannel(healer);
        if (!touched)
            continue;
        events.push({
            playerId: healer.id,
            abilityId: 'curativo',
            x: healer.position.x,
            y: healer.position.y,
            aimX: healer.aim.x,
            aimY: healer.aim.y,
            targetId: ally?.id ?? null,
            hits: [],
        });
    }
    return events;
}
/**
 * Fecha o canal e cobra a recarga.
 *
 * A recarga e o tempo que ficou curando, nao um numero fixo.
 *
 * Antes nao havia recarga nenhuma: o Curativo era a unica habilidade que saia
 * de `useAbility` antes de armar o cooldown, entao cortar e apertar de novo
 * devolvia a cura na hora -- curar era infinito, bastava insistir. Um valor
 * fixo tambem nao serve: quem foi cortado no primeiro segundo pagaria o mesmo
 * que quem curou os quatro, e o corte ja e a punicao.
 */
function endHealChannel(healer) {
    const used = Math.max(0, HEAL.durationMs - healer.healChannelMs);
    const base = CLASSES[healer.classId].ability.cooldownMs * upgradeAbilityCooldownFactor(healer);
    healer.abilityCooldownMs = Math.max(healer.abilityCooldownMs, base, used);
    healer.healChannelMs = 0;
    healer.abilityActive = false;
    healer.healTargetId = null;
}
function nearestWoundedAlly(healer, players) {
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const ally of players) {
        if (ally.id === healer.id)
            continue;
        if (!ally.connected || !isAlive(ally))
            continue;
        if (ally.health >= ally.maxHealth)
            continue;
        const gap = Math.hypot(ally.position.x - healer.position.x, ally.position.y - healer.position.y);
        if (gap > HEAL.range + ally.radius)
            continue;
        if (gap < bestDistance) {
            bestDistance = gap;
            best = ally;
        }
    }
    return best;
}
/**
 * Quebra-Linha: avanco que atravessa a formacao.
 *
 * Resolve o deslocamento inteiro num tick -- nao ha estado de "avancando"
 * para o client ter que reconciliar. Acerta e empurra quem estiver na faixa,
 * inclusive aliado: e um avanco, nao uma passagem livre.
 */
function chargeThrough(player, direction, targets) {
    const from = { ...player.position };
    const to = {
        x: clamp(from.x + direction.x * CHARGE.distance, player.radius, ARENA.width - player.radius),
        y: clamp(from.y + direction.y * CHARGE.distance, player.radius, ARENA.height - player.radius),
    };
    const hits = [];
    for (const target of targets) {
        if (target.id === player.id || !isAlive(target))
            continue;
        if (!withinSweep(from, to, target, CHARGE.radius))
            continue;
        const friendly = target.team === player.team;
        if (friendly && !target.damagedByAllies)
            continue;
        const damage = damageFor({ ...player.attack, damage: CHARGE.damage }, friendly);
        target.health = Math.max(0, target.health - damage);
        if ('msSinceDamage' in target)
            target.msSinceDamage = 0;
        // Empurrao: e o que "rompe formacao" em vez de so causar dano.
        const away = Math.hypot(target.position.x - from.x, target.position.y - from.y);
        if (away > 0) {
            target.position = {
                x: clamp(target.position.x + ((target.position.x - from.x) / away) * CHARGE.knockback, target.radius, ARENA.width - target.radius),
                y: clamp(target.position.y + ((target.position.y - from.y) / away) * CHARGE.knockback, target.radius, ARENA.height - target.radius),
            };
        }
        const incapacitated = target.health === 0;
        if (incapacitated)
            target.combatState = 'incapacitated';
        hits.push({ targetId: target.id, targetTeam: target.team, damage, friendly, incapacitated });
    }
    player.position = to;
    player.inputQueue.length = 0;
    // Recuperacao curta: o avanco compromete, como todo golpe.
    player.combatState = 'recovering';
    player.attackTimerMs = CHARGE.durationMs;
    return {
        playerId: player.id,
        abilityId: 'quebra_linha',
        x: to.x,
        y: to.y,
        aimX: direction.x,
        aimY: direction.y,
        targetId: null,
        hits,
    };
}
/** O alvo esta na faixa varrida entre dois pontos? */
function withinSweep(from, to, target, sweepRadius) {
    const segmentX = to.x - from.x;
    const segmentY = to.y - from.y;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    const t = lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((target.position.x - from.x) * segmentX + (target.position.y - from.y) * segmentY) /
            lengthSquared));
    const closestX = from.x + segmentX * t;
    const closestY = from.y + segmentY * t;
    return (Math.hypot(target.position.x - closestX, target.position.y - closestY) <=
        sweepRadius + target.radius);
}
/**
 * Disparo Preciso: tiro carregado.
 *
 * Muito mais dano, puxada longa. A antecipacao e o equilibrio -- o alvo tem
 * tempo de sair da linha, e continua valendo a regra de acertar o primeiro
 * corpo na trajetoria.
 */
function aimedShot(player, direction) {
    const profile = CLASSES[player.classId];
    const base = profile.projectile;
    const projectile = createProjectile({
        ownerId: player.id,
        team: player.team,
        origin: {
            x: player.position.x + direction.x * (player.radius + 6),
            y: player.position.y + direction.y * (player.radius + 6),
        },
        direction,
        speed: (base?.speed ?? 600) * AIMED_SHOT.speedMultiplier,
        maxRange: (base?.maxRange ?? 400) * AIMED_SHOT.rangeMultiplier,
        radius: base?.radius ?? 5,
        damage: Math.round(profile.attack.damage * AIMED_SHOT.damageMultiplier),
        splashRadius: base?.splashRadius ?? 0,
    });
    player.attackAim = { ...direction };
    player.combatState = 'recovering';
    player.attackTimerMs = profile.attack.recoveryMs;
    return {
        playerId: player.id,
        abilityId: 'disparo_preciso',
        x: player.position.x,
        y: player.position.y,
        aimX: direction.x,
        aimY: direction.y,
        targetId: null,
        hits: [],
        projectile,
    };
}
/**
 * Oleo e Armadilha: postas no chao, na direcao da mira.
 *
 * Nao seguem alvo nem exigem acerto -- sao preparacao de terreno. O que decide
 * se valeram e *onde* foram postas, e isso e uma leitura de mapa.
 */
function dropZone(player, direction, kind, range) {
    const spot = landingSpot(player.position, direction, range);
    const zone = createZone({ kind, ownerId: player.id, team: player.team, position: spot });
    return {
        playerId: player.id,
        abilityId: kind,
        x: zone.position.x,
        y: zone.position.y,
        aimX: direction.x,
        aimY: direction.y,
        targetId: null,
        hits: [],
        zone,
    };
}
/**
 * Barricada: construida a frente, na direcao da mira.
 *
 * Quem chama decide se ha espaco -- aqui so se monta a estrutura. Se o lugar
 * estiver ocupado, a recarga e devolvida: cobrar por uma construcao que nao
 * aconteceu seria punir o jogador por um limite que ele nao ve.
 */
function buildBarricade(player, direction) {
    const spot = landingSpot(player.position, direction, BARRICADA.placeRange);
    const structure = createBarricada({
        ownerId: player.id,
        team: player.team,
        position: spot,
    });
    return {
        playerId: player.id,
        abilityId: 'barricada',
        x: structure.position.x,
        y: structure.position.y,
        aimX: direction.x,
        aimY: direction.y,
        targetId: null,
        hits: [],
        structure,
    };
}
/** Avanca a recarga da habilidade. */
export function stepAbilityCooldown(player, elapsedMs) {
    if (player.abilityCooldownMs > 0) {
        player.abilityCooldownMs = Math.max(0, player.abilityCooldownMs - elapsedMs);
    }
    if (player.rootedMs > 0) {
        player.rootedMs = Math.max(0, player.rootedMs - elapsedMs);
    }
    if (player.combatState === 'incapacitated') {
        player.abilityHeld = false;
        player.abilityActive = false;
        player.healChannelMs = 0;
        player.healTargetId = null;
        return;
    }
    // O efeito da sustentada e decidido aqui, todo tick, e nao no instante em
    // que a mensagem chega. Sem isto, apertar curar durante a recuperacao de um
    // golpe -- o que acontece o tempo todo numa briga -- descartava a intencao
    // em silencio, e so um novo clique a trazia de volta.
    if (CLASSES[player.classId].ability.sustained) {
        player.abilityActive = player.abilityHeld && player.combatState === 'ready';
        if (!player.abilityActive)
            player.healTargetId = null;
    }
}
//# sourceMappingURL=ability.js.map