import { CLASSES } from './classes.js';
/**
 * Armas achadas em campo.
 *
 * O jogador entra desarmado. A arma da classe esta numa caixa em algum lugar
 * do patio, e pode nao ser ele quem a encontra -- e ai a unica saida e largar
 * no chao e avisar. CLAUDE.md poe cooperacao e comunicacao acima de volume de
 * inimigos; esta e a mecanica que cobra as duas.
 *
 * Toda arma tem dono. Na mao errada ela rende quase nada, de proposito: se a
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
/** O que uma arma rende para quem nao e dono dela. */
export const WRONG_HANDS = {
    /** Soma ao dano de maos vazias. Melhor que nada, longe de servir. */
    damageBonus: 3,
};
/**
 * Uma arma por classe.
 *
 * O perfil de ataque nao e repetido aqui: e o da propria classe. Uma segunda
 * tabela de numeros divergiria da primeira no primeiro ajuste de equilibrio.
 */
export const WEAPONS = {
    guerreiro: {
        id: 'espada_de_guarda',
        name: 'Espada de Guarda',
        classId: 'guerreiro',
        description: 'Larga e pesada. Feita para segurar passagem.',
    },
    arqueiro: {
        id: 'arco_longo',
        name: 'Arco Longo',
        classId: 'arqueiro',
        description: 'Alcance que atravessa o patio.',
    },
    alquimista: {
        id: 'frascos',
        name: 'Cinto de Frascos',
        classId: 'alquimista',
        description: 'Vidro, estopim e area.',
    },
    suporte: {
        id: 'maca_e_ataduras',
        name: 'Maca e Ataduras',
        classId: 'suporte',
        description: 'Golpeia pouco, cuida muito.',
    },
    engenheiro: {
        id: 'martelo_de_obra',
        name: 'Martelo de Obra',
        classId: 'engenheiro',
        description: 'Prego, madeira e cabeca de ferro.',
    },
    cacador: {
        id: 'besta',
        name: 'Besta',
        classId: 'cacador',
        description: 'Lenta, forte, com recarga visivel.',
    },
    mestre_caes: {
        id: 'espada_curta',
        name: 'Espada Curta',
        classId: 'mestre_caes',
        description: 'Leve, para quem luta ao lado do cao.',
    },
    barbaro: {
        id: 'machado_de_duas_maos',
        name: 'Machado de Duas Maos',
        classId: 'barbaro',
        description: 'Arco amplo. Perigoso para os dois lados.',
    },
};
export const WEAPON_IDS = Object.values(WEAPONS).map((weapon) => weapon.id);
export function weaponById(id) {
    return Object.values(WEAPONS).find((weapon) => weapon.id === id) ?? null;
}
/**
 * Perfil de ataque de alguem desta classe segurando esta arma.
 *
 * Sem arma, maos vazias. Com a arma certa, o perfil cheio da classe. Com a
 * errada, maos vazias com um empurraozinho -- o bastante para nao ser inutil
 * carregar ate encontrar o dono, longe do bastante para nao valer ficar com
 * ela.
 */
export function attackWith(classId, weaponId) {
    if (weaponId === null)
        return UNARMED;
    const weapon = weaponById(weaponId);
    if (weapon === null)
        return UNARMED;
    if (weapon.classId === classId)
        return CLASSES[classId].attack;
    return { ...UNARMED, damage: UNARMED.damage + WRONG_HANDS.damageBonus };
}
/** O projetil so existe quando a arma e a certa: maos vazias nao atiram. */
export function firesProjectile(classId, weaponId) {
    if (weaponId === null)
        return false;
    const weapon = weaponById(weaponId);
    return weapon !== null && weapon.classId === classId && CLASSES[classId].attackKind === 'projectile';
}
//# sourceMappingURL=equipment.js.map