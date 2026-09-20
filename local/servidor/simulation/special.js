import { BALISTA, CACADA, CHUVA_DE_FLECHAS, CLASSES, ESTANDARTE, FURIA, INCENDIO, MATILHA, ULTIMA_LINHA, } from '../../protocol/index.js';
import { createBalista, createEstandarte } from '../domain/structure.js';
import { createZone, landingSpot } from './zone.js';
import { upgradeDamageFactor, upgradeDefenseFactor, upgradeSpeedFactor } from './progression.js';
/** Especial pronto para uso agora? */
export function canUseSpecial(player) {
    const profile = CLASSES[player.classId].special;
    if (!profile.available)
        return false;
    if (player.combatState === 'incapacitated')
        return false;
    // Nao acumula: usar de novo enquanto o efeito corre so gastaria a recarga.
    if (player.specialActiveMs > 0)
        return false;
    return player.specialCooldownMs <= 0;
}
/**
 * Registra a intencao do client.
 *
 * Os especiais de corpo (Ultima Linha, Furia) resolvem-se no tick, lendo o
 * tempo restante. Os de terreno devolvem o que a sala precisa criar: uma zona,
 * ou o pedido de incendiar o que ja esta no chao.
 */
export function requestSpecial(player, aim) {
    const profile = CLASSES[player.classId].special;
    if (!canUseSpecial(player))
        return null;
    const magnitude = Math.hypot(aim.x, aim.y);
    const direction = magnitude === 0 ? { ...player.aim } : { x: aim.x / magnitude, y: aim.y / magnitude };
    player.specialCooldownMs = profile.cooldownMs;
    player.specialActiveMs = profile.durationMs;
    applyBodyState(player);
    const announcement = {
        playerId: player.id,
        specialId: profile.id,
        x: player.position.x,
        y: player.position.y,
        aimX: direction.x,
        aimY: direction.y,
        durationMs: profile.durationMs,
    };
    switch (profile.id) {
        case 'chuva_de_flechas': {
            const spot = landingSpot(player.position, direction, CHUVA_DE_FLECHAS.throwRange);
            const zone = createZone({
                kind: 'flechas',
                ownerId: player.id,
                team: player.team,
                position: spot,
            });
            return { ...announcement, x: zone.position.x, y: zone.position.y, zone };
        }
        case 'balista': {
            const spot = landingSpot(player.position, direction, BALISTA.placeRange);
            const structure = createBalista({
                ownerId: player.id,
                team: player.team,
                position: spot,
            });
            return { ...announcement, x: structure.position.x, y: structure.position.y, structure };
        }
        case 'estandarte': {
            const spot = landingSpot(player.position, direction, ESTANDARTE.placeRange);
            const structure = createEstandarte({
                ownerId: player.id,
                team: player.team,
                position: spot,
            });
            return {
                ...announcement,
                x: structure.position.x,
                y: structure.position.y,
                structure,
            };
        }
        case 'soltar_os_caes':
            // Quem cria corpos em campo e a sala.
            return { ...announcement, pack: { count: MATILHA.count, durationMs: MATILHA.durationMs } };
        case 'cacada':
            // Quem esta na direcao apontada e a sala que sabe.
            return {
                ...announcement,
                mark: { x: direction.x, y: direction.y, range: CACADA.range },
            };
        case 'incendio':
            // Quem sabe onde ha oleo e a sala, nao a classe.
            return {
                ...announcement,
                ignite: {
                    x: player.position.x,
                    y: player.position.y,
                    range: INCENDIO.igniteRange,
                },
            };
        default:
            return announcement;
    }
}
/** Avanca recarga e duracao. Chamado uma vez por tick, por jogador. */
export function stepSpecial(player, elapsedMs) {
    if (player.specialCooldownMs > 0) {
        player.specialCooldownMs = Math.max(0, player.specialCooldownMs - elapsedMs);
    }
    if (player.specialActiveMs > 0) {
        player.specialActiveMs = Math.max(0, player.specialActiveMs - elapsedMs);
    }
    // Cair cancela o efeito: um Guerreiro caido nao esta segurando passagem
    // nenhuma, e deixar a ancora ligada travaria o corpo dele no lugar.
    if (player.combatState === 'incapacitated')
        player.specialActiveMs = 0;
    applyBodyState(player);
}
/** Reflete o especial em curso nas propriedades que o resto da simulacao le. */
function applyBodyState(player) {
    player.anchored = activeSpecial(player) === 'ultima_linha';
}
/** Especial em curso neste corpo, se houver. */
export function activeSpecial(body) {
    const player = body;
    if (!player.classId || player.specialActiveMs <= 0)
        return null;
    const profile = CLASSES[player.classId]?.special;
    if (!profile?.available)
        return null;
    return profile.id;
}
/**
 * Multiplicador do dano que este corpo causa.
 *
 * O Barbaro em Furia bate 60% mais forte -- inclusive no aliado que entrar no
 * arco. O especial nao suspende o fogo amigo; agrava.
 */
export function outgoingDamageFactor(attacker) {
    const special = activeSpecial(attacker) === 'furia' ? FURIA.damageFactor : 1;
    return special * upgradeDamageFactor(attacker);
}
/**
 * Multiplicador do dano que este corpo recebe.
 *
 * Um lugar so para tudo que muda o dano recebido: os especiais que o proprio
 * corpo usou, o Estandarte que o cobre e a marca da Cacada. Espalhar isso pelo
 * combate e pelos projeteis faria as regras divergirem com o tempo.
 */
export function incomingDamageFactor(target) {
    let factor = 1;
    switch (activeSpecial(target)) {
        case 'ultima_linha':
            factor *= 1 - ULTIMA_LINHA.damageReduction;
            break;
        case 'furia':
            factor *= FURIA.vulnerability;
            break;
        default:
            break;
    }
    // Estandarte: sustentacao para quem esta em volta.
    if (target.sheltered)
        factor *= 1 - ESTANDARTE.damageReduction;
    // Cacada: o alvo marcado apanha mais de *qualquer* defensor, nao so de quem
    // marcou. E o que faz concentrar fogo valer mais que cada um escolher o seu.
    const marked = target.markedMs;
    if (marked !== undefined && marked > 0)
        factor *= 1 + CACADA.damageBonus;
    return factor * upgradeDefenseFactor(target);
}
/** Multiplicador da velocidade dado o especial em curso. */
export function specialSpeedFactor(player) {
    switch (activeSpecial(player)) {
        case 'ultima_linha':
            // Zero, nao "pouco": a Ultima Linha e trocar a perna pela parede.
            return 0;
        case 'furia':
            return FURIA.speedFactor * upgradeSpeedFactor(player);
        default:
            return upgradeSpeedFactor(player);
    }
}
//# sourceMappingURL=special.js.map