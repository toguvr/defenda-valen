import { CLASSES, CLASS_IDS } from './classes.js';
/**
 * Armas tomadas do inimigo.
 *
 * O jogador entra desarmado e arranca a primeira arma de quem veio derrubar o
 * portao. Quem cai melhor armado deixa melhor arma: um Soldado larga ferro
 * gasto, um Capitao larga o que um capitao carrega.
 *
 * Toda arma tem dono. Na mao errada rende quase nada, de proposito: se a
 * besta servisse ao Guerreiro nao haveria por que trocar, e sem troca a
 * mecanica seria so um atraso no comeco da partida.
 *
 * Nada disto sobrevive a missao. CLAUDE.md e explicito -- progressao dentro
 * da partida e temporaria, e a permanente e por personagem.
 */
/**
 * Como se luta de maos vazias.
 *
 * Igual para as oito classes: fraco, curto e rapido. Rapido de proposito --
 * lento **e** fraco faria o comeco parecer defeito em vez de escassez.
 *
 * Habilidade e especial continuam valendo sem arma. Tirar os tres de uma vez
 * deixaria as oito classes identicas nos primeiros minutos, e o CLAUDE.md
 * pede que a classe se reconheca de relance; alem disso um Suporte que nao
 * cura no comeco simplesmente perde o time.
 */
export const UNARMED = {
    damage: 4,
    range: 46,
    arcDegrees: 96,
    windupMs: 140,
    recoveryMs: 220,
    cooldownMs: 460,
};
/**
 * Quanto tempo uma arma fica no chao.
 *
 * Medido: sem prazo, uma missao de seis jogadores terminava com 11 a 16 armas
 * largadas. Cada uma com facho e anel, o patio virava um ferro-velho e a arma
 * que importa se perdia no meio das que ninguem quis.
 *
 * Um minuto e folgado para atravessar o patio e buscar o que o amigo largou,
 * e curto o bastante para o chao nao acumular a missao inteira. Os ultimos
 * dez segundos piscam, para sumir nao ser surpresa.
 */
export const GROUND = {
    lifetimeMs: 60_000,
    fadeMs: 10_000,
};
/** O que uma arma rende para quem nao e dono dela. */
export const WRONG_HANDS = {
    /** Soma ao dano de maos vazias. Melhor que nada, longe de servir. */
    damageBonus: 3,
};
export const TIER_DAMAGE = {
    1: 0.7,
    2: 1,
    3: 1.28,
};
export const TIER_NAMES = {
    1: 'gasta',
    2: 'boa',
    3: 'de mestre',
};
/** Nome da familia de arma de cada classe, por degrau. */
const FAMILIES = {
    guerreiro: ['Espada Lascada', 'Espada de Guarda', 'Espada do Castelao'],
    arqueiro: ['Arco Torto', 'Arco Longo', 'Arco de Tejo'],
    alquimista: ['Frascos Trincados', 'Cinto de Frascos', 'Frascos Selados'],
    suporte: ['Maca Amassada', 'Maca e Ataduras', 'Maca Bencida'],
    engenheiro: ['Marreta Velha', 'Martelo de Obra', 'Martelo do Mestre'],
    cacador: ['Besta Rachada', 'Besta', 'Besta de Aco'],
    mestre_caes: ['Faca de Mato', 'Espada Curta', 'Lamina do Adestrador'],
    barbaro: ['Machado Cego', 'Machado de Duas Maos', 'Machado Rompe-Escudo'],
};
/**
 * Arquivo de arte de cada classe, em `assets/weapons/`.
 *
 * A silhueta pertence a **classe**, nao ao degrau: e ela que diz de quem e a
 * arma no chao, e VISUAL_BIBLE.md pede que a classe se reconheca pela
 * silhueta. Os tres degraus de uma classe dividem o mesmo desenho e se
 * distinguem pelas marcas ao lado.
 */
export const WEAPON_SPRITES = {
    guerreiro: 'espada_de_guarda',
    arqueiro: 'arco_longo',
    alquimista: 'frascos',
    suporte: 'maca_e_ataduras',
    engenheiro: 'martelo_de_obra',
    cacador: 'besta',
    mestre_caes: 'espada_curta',
    barbaro: 'machado_de_duas_maos',
};
/** Os oito desenhos que a arte precisa cobrir. */
export const WEAPON_SPRITE_IDS = Object.values(WEAPON_SPRITES);
const DESCRIPTIONS = {
    guerreiro: 'Larga e pesada. Feita para segurar passagem.',
    arqueiro: 'Alcance que atravessa o patio.',
    alquimista: 'Vidro, estopim e area.',
    suporte: 'Golpeia pouco, cuida muito.',
    engenheiro: 'Prego, madeira e cabeca de ferro.',
    cacador: 'Lenta, forte, com recarga visivel.',
    mestre_caes: 'Leve, para quem luta ao lado do cao.',
    barbaro: 'Arco amplo. Perigoso para os dois lados.',
};
function buildWeapons() {
    const out = [];
    for (const classId of CLASS_IDS) {
        const family = FAMILIES[classId];
        for (const tier of [1, 2, 3]) {
            out.push({
                id: `${classId}_t${tier}`,
                name: family[tier - 1],
                classId,
                tier,
                description: DESCRIPTIONS[classId],
            });
        }
    }
    return out;
}
export const WEAPONS = buildWeapons();
export function weaponById(id) {
    return WEAPONS.find((weapon) => weapon.id === id) ?? null;
}
export function weaponFor(classId, tier) {
    return WEAPONS.find((weapon) => weapon.classId === classId && weapon.tier === tier);
}
/**
 * Quem cai armado deixa arma.
 *
 * O degrau vem do tipo do invasor, nao de sorteio: derrubar um Capitao tem
 * que valer mais que limpar Soldados, e o jogador precisa **saber** disso
 * olhando a tela antes de escolher o alvo. A chance existe para o chao nao
 * virar um tapete de ferro numa missao de seis minutos.
 */
export const LOOT = {
    soldado: { chance: 0.16, tier: 1 },
    lanceiro: { chance: 0.2, tier: 1 },
    arqueiro: { chance: 0.24, tier: 2 },
    bruto: { chance: 0.42, tier: 2 },
    capitao: { chance: 0.85, tier: 3 },
    ariete: { chance: 1, tier: 3 },
};
/**
 * Perfil de ataque de alguem desta classe segurando esta arma.
 *
 * Sem arma, maos vazias. Com a arma certa, o perfil da classe com o dano do
 * degrau. Com a errada, maos vazias com um empurraozinho -- o bastante para
 * nao ser inutil carregar ate encontrar o dono, longe do bastante para nao
 * valer ficar com ela.
 */
export function attackWith(classId, weaponId) {
    if (weaponId === null)
        return UNARMED;
    const weapon = weaponById(weaponId);
    if (weapon === null)
        return UNARMED;
    if (weapon.classId !== classId) {
        return { ...UNARMED, damage: UNARMED.damage + WRONG_HANDS.damageBonus };
    }
    const base = CLASSES[classId].attack;
    return { ...base, damage: Math.round(base.damage * TIER_DAMAGE[weapon.tier]) };
}
/** O projetil so existe quando a arma e a certa: maos vazias nao atiram. */
export function firesProjectile(classId, weaponId) {
    if (weaponId === null)
        return false;
    const weapon = weaponById(weaponId);
    return (weapon !== null && weapon.classId === classId && CLASSES[classId].attackKind === 'projectile');
}
//# sourceMappingURL=equipment.js.map