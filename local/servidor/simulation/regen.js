import { FOUNTAIN, REGEN } from '../../protocol/index.js';
import { bannerMends, bannerRegenFactor } from './banner.js';
import { upgradeRegenDelayCutMs } from './progression.js';
/**
 * Recuperacao sob o Estandarte.
 *
 * Nao existe mais recuperacao passiva: heroi ferido so volta a subir de vida
 * se o Suporte agir -- Curativo em quem esta perto, Estandarte para o grupo.
 * Antes ela existia porque, sem nenhuma recuperacao, uma missao longa matava o
 * time por acumulo em vez de por erro, e o Suporte ainda nao existia. Ele
 * existe; a muleta saiu.
 *
 * Ainda exige um tempo sem levar dano, e nunca vale para quem esta caido --
 * quem caiu volta por socorro, nao sozinho.
 */
export function stepRegen(players, elapsedMs) {
    for (const player of players) {
        if (player.combatState === 'incapacitated') {
            player.msSinceDamage = 0;
            continue;
        }
        if (player.msSinceDamage !== Number.POSITIVE_INFINITY) {
            player.msSinceDamage += elapsedMs;
        }
        if (player.health >= player.maxHealth)
            continue;
        // Duas fontes, as duas exigindo algo: o Estandarte exige um Suporte no
        // time; a fonte exige largar a linha e ir ao fundo do patio.
        if (!bannerMends(player) && !atFountain(player.position))
            continue;
        if (player.msSinceDamage < REGEN.delayAfterDamageMs - upgradeRegenDelayCutMs(player)) {
            continue;
        }
        player.health = Math.min(player.maxHealth, 
        // Sustentacao em area, nao cura pontual: o Curativo e que devolve vida
        // depressa, e cobra o Suporte parado e perto.
        player.health + REGEN.perSecond * bannerRegenFactor(player) * (elapsedMs / 1000));
    }
}
/** Dentro do alcance da fonte do patio. */
export function atFountain(position) {
    return Math.hypot(position.x - FOUNTAIN.x, position.y - FOUNTAIN.y) <= FOUNTAIN.radius;
}
//# sourceMappingURL=regen.js.map