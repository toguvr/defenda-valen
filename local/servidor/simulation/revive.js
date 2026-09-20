import { REVIVE } from '../../protocol/index.js';
import { bannerReviveFactor } from './banner.js';
/**
 * Socorro a aliado caido.
 *
 * CLAUDE.md: jogador incapacitado pode ser reanimado. Exige proximidade e
 * tempo mantido, entao socorrer e uma decisao tatica -- alguem para de lutar e
 * fica exposto para trazer o companheiro de volta.
 *
 * O progresso decai quando ninguem esta socorrendo, em vez de zerar. Levar um
 * golpe no meio do socorro atrasa; nao apaga o esforco.
 */
export function stepRevives(players, elapsedMs) {
    const revived = [];
    const seconds = elapsedMs / 1000;
    for (const downed of players) {
        if (downed.combatState !== 'incapacitated') {
            downed.reviveProgress = 0;
            continue;
        }
        const helpers = countHelpers(downed, players);
        if (helpers === 0) {
            downed.reviveProgress = Math.max(0, downed.reviveProgress - REVIVE.decayPerSecond * seconds);
            continue;
        }
        // Mais gente socorrendo acelera: cooperacao deve ter efeito visivel. O
        // Estandarte acelera junto -- e para isso que ele e plantado onde se cai.
        downed.reviveProgress += (helpers * bannerReviveFactor(downed) * elapsedMs) / REVIVE.durationMs;
        if (downed.reviveProgress >= 1) {
            downed.reviveProgress = 0;
            // Fracao do HP da classe, nao valor fixo: voltar com 40 seria
            // generoso para o Arqueiro e insuficiente para o Guerreiro.
            downed.health = Math.round(downed.maxHealth * REVIVE.restoredFraction);
            downed.combatState = 'ready';
            // Quem acabou de voltar nao se recupera de imediato: precisa sair da
            // briga primeiro, como todo mundo.
            downed.msSinceDamage = 0;
            downed.attackTimerMs = 0;
            downed.attackCooldownMs = 0;
            revived.push(downed.id);
        }
    }
    return revived;
}
/** Aliados de pe, conectados, segurando a interacao e dentro do alcance. */
function countHelpers(downed, players) {
    let helpers = 0;
    for (const helper of players) {
        if (helper.id === downed.id)
            continue;
        if (!helper.interacting || !helper.connected)
            continue;
        if (helper.combatState !== 'ready')
            continue;
        const distance = Math.hypot(helper.position.x - downed.position.x, helper.position.y - downed.position.y);
        if (distance <= REVIVE.range + downed.radius)
            helpers += 1;
    }
    return helpers;
}
//# sourceMappingURL=revive.js.map