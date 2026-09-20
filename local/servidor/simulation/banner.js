import { ESTANDARTE } from '../../protocol/index.js';
import { shelteringBanner } from '../domain/structure.js';
/**
 * Efeito do Estandarte sobre quem esta em volta.
 *
 * O estado e recalculado por tick e guardado no proprio corpo, porque quem
 * resolve dano, recuperacao e reanimacao nao conhece estruturas -- so corpos.
 * Mesmo padrao de `anchored`, da Ultima Linha.
 *
 * O efeito nao e cura: e sustentacao. Ele nao devolve vida de graca, faz o
 * time aguentar mais tempo no mesmo lugar -- que e o papel do Suporte quando
 * o Curativo, que exige ele parado e perto, nao alcanca todo mundo.
 */
export function stepBanners(players, structures) {
    for (const player of players) {
        const banner = shelteringBanner(player.position, player.team, structures);
        player.sheltered = banner !== null;
        player.shelterOwnerId = banner?.ownerId ?? null;
    }
}
/** Multiplicador da recuperacao sob o Estandarte. */
export function bannerRegenFactor(player) {
    return bannerMends(player) ? ESTANDARTE.regenFactor : 1;
}
/**
 * O Estandarte devolve vida a este jogador?
 *
 * Nao para quem o plantou. Proteger a si mesmo faz sentido -- ele planta a
 * bandeira e fica atras dela; recuperar vida sozinho, nao: o Suporte e quem
 * cura o time, e um curandeiro que se cura de graca nao precisa de ninguem.
 * Ele continua com a reducao de dano e com a reanimacao acelerada.
 */
export function bannerMends(player) {
    return player.sheltered && player.shelterOwnerId !== player.id;
}
/** Multiplicador da velocidade de reanimacao de quem esta caido sob ele. */
export function bannerReviveFactor(player) {
    return player.sheltered ? ESTANDARTE.reviveFactor : 1;
}
//# sourceMappingURL=banner.js.map