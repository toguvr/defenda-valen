import { PROGRESSION, UPGRADES, UPGRADE_EFFECT, UPGRADE_IDS, } from '../../protocol/index.js';
export function createProgression() {
    return { xp: 0, level: 0 };
}
export function xpFor(kind) {
    return PROGRESSION.xpPerInvader[kind];
}
/**
 * XP necessario para o proximo degrau, dado o tamanho do time.
 *
 * Escala com o time porque o XP tambem escala: sem isto, o time cheio pegaria
 * as tres escolhas no primeiro terco da missao e o solo nao pegaria nenhuma.
 */
export function thresholdFor(level, defenders) {
    const base = PROGRESSION.levelThresholds[level];
    if (base === undefined)
        return Number.POSITIVE_INFINITY;
    const factor = 1 + Math.max(0, defenders - 1) * PROGRESSION.additionalDefenderCost;
    return base * factor;
}
/**
 * Soma o XP e devolve as ofertas quando um degrau e cruzado.
 *
 * Uma oferta por jogador de pe. Quem esta caido nao escolhe agora, mas nao
 * perde: a oferta fica pendente ate ele voltar -- ver `pendingOffers`.
 */
export function addXp(progression, amount, _players, _random) {
    if (amount <= 0)
        return [];
    progression.xp += amount;
    return [];
}
/**
 * Um degrau de melhoria, pago por um suprimento aberto.
 *
 * A melhoria deixou de chegar sozinha ao cruzar um limite de XP e passou a
 * estar dentro de uma caixa, longe do portao. O XP continua sendo contado --
 * serve ao fim de missao e a Companhia -- mas nao oferece mais nada por
 * conta propria: o que oferece e alguem ter ido buscar.
 *
 * A oferta e do **time**, nao de quem abriu. CLAUDE.md pede XP compartilhado
 * para nao haver disputa por abate; premiar so quem abre criaria a mesma
 * disputa, agora por caixa, e o que se quer e o contrario -- que o time
 * decida quem vai.
 */
export function grantUpgradeLevel(progression, players, random) {
    if (progression.level >= PROGRESSION.levelThresholds.length)
        return [];
    progression.level += 1;
    const offers = [];
    for (const player of players) {
        const options = drawOptions(player, random);
        if (options.length === 0)
            continue;
        player.pendingOffers.push({ level: progression.level, options });
        offers.push({ playerId: player.id, level: progression.level, options });
    }
    return offers;
}
/**
 * Sorteia as opcoes deste jogador, sem repetir o que ele ja tem.
 *
 * Quando sobram menos que o tamanho da oferta, oferece o que sobrou: mostrar
 * uma opcao ja pega seria uma escolha falsa.
 */
function drawOptions(player, random) {
    const available = UPGRADE_IDS.filter((id) => !player.upgrades.includes(id) && !isOffered(player, id));
    const drawn = [];
    const pool = [...available];
    while (drawn.length < PROGRESSION.offerSize && pool.length > 0) {
        const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
        const [picked] = pool.splice(index, 1);
        if (picked)
            drawn.push(picked);
    }
    return drawn;
}
function isOffered(player, id) {
    return player.pendingOffers.some((offer) => offer.options.includes(id));
}
/**
 * Aceita a escolha, se ela estava mesmo na oferta.
 *
 * Devolve `null` quando nao estava. O client escolhe; quem decide e o servidor.
 */
export function takeUpgrade(player, id) {
    const index = player.pendingOffers.findIndex((offer) => offer.options.includes(id));
    if (index < 0)
        return null;
    const chosen = id;
    if (!UPGRADES[chosen])
        return null;
    player.pendingOffers.splice(index, 1);
    player.upgrades.push(chosen);
    return chosen;
}
export function hasUpgrade(body, id) {
    const player = body;
    return Array.isArray(player.upgrades) && player.upgrades.includes(id);
}
/** Multiplicador do dano causado, vindo das melhorias. */
export function upgradeDamageFactor(attacker) {
    return hasUpgrade(attacker, 'lamina_afiada') ? UPGRADE_EFFECT.damageFactor : 1;
}
/** Multiplicador do dano recebido, vindo das melhorias. */
export function upgradeDefenseFactor(target) {
    return hasUpgrade(target, 'couro_grosso') ? 1 - UPGRADE_EFFECT.damageReduction : 1;
}
/**
 * Multiplicador do fogo amigo que este corpo causa.
 *
 * `maos_firmes` nao desliga o fogo amigo -- corta pela metade. Desligar
 * tiraria do jogo um dos pilares; cortar muda o quanto arriscar vale a pena.
 */
export function upgradeFriendlyFireFactor(attacker) {
    return hasUpgrade(attacker, 'maos_firmes') ? UPGRADE_EFFECT.friendlyFireFactor : 1;
}
/** Multiplicador da velocidade, vindo das melhorias. */
export function upgradeSpeedFactor(player) {
    return hasUpgrade(player, 'passo_largo') ? UPGRADE_EFFECT.speedFactor : 1;
}
/** Quanto a espera da recuperacao encurta. */
export function upgradeRegenDelayCutMs(player) {
    return hasUpgrade(player, 'respiro_curto') ? UPGRADE_EFFECT.regenDelayCutMs : 0;
}
/** Multiplicador da recarga de habilidade. */
export function upgradeAbilityCooldownFactor(player) {
    return hasUpgrade(player, 'prontidao') ? UPGRADE_EFFECT.abilityCooldownFactor : 1;
}
//# sourceMappingURL=progression.js.map