/**
 * Progressao permanente.
 *
 * CLAUDE.md separa duas coisas que crescem: o **personagem**, que tem classe e
 * nivel proprios, e a **Companhia**, que e do jogador e serve a desbloqueios
 * macro. Progresso de Guerreiro nao mexe em Arqueiro -- por isso o nivel vive
 * no personagem, nao na conta.
 *
 * "Evitar pay-to-win e crescimento bruto exagerado de atributos": por enquanto
 * o nivel **nao da atributo nenhum**. Ele registra o que foi jogado. A arvore
 * e a especializacao vem depois, e CLAUDE.md e explicito que especializacao so
 * deve existir quando o jogador ja conhece a classe.
 */
export const PROGRESSION_PERMANENT = {
    /**
     * XP por missao, para o personagem jogado e para a Companhia.
     *
     * Vitoria vale mais, mas derrota **tambem vale**: uma missao perdida de seis
     * minutos nao pode valer zero, ou o jogo pune quem tentou o time pequeno.
     */
    characterXp: { victory: 100, defeat: 45 },
    companyXp: { victory: 120, defeat: 55 },
    /** Bonus por invasor abatido, dividido igualmente: o XP em partida ja e do time. */
    xpPerInvader: 2,
    /**
     * Curva de nivel: cada nivel custa mais que o anterior, sem explodir.
     *
     * `custo(n) = base * n`. Nivel 2 custa 200, o 3 custa 400, e assim por
     * diante -- previsivel de ler e facil de ajustar num numero so.
     */
    levelBaseXp: 200,
    maxLevel: 20,
};
/** XP acumulado necessario para chegar a este nivel. */
export function xpForLevel(level) {
    if (level <= 1)
        return 0;
    let total = 0;
    for (let step = 2; step <= level; step += 1) {
        total += PROGRESSION_PERMANENT.levelBaseXp * (step - 1);
    }
    return total;
}
/** Nivel correspondente a um total de XP. */
export function levelForXp(xp) {
    let level = 1;
    while (level < PROGRESSION_PERMANENT.maxLevel && xp >= xpForLevel(level + 1)) {
        level += 1;
    }
    return level;
}
//# sourceMappingURL=company.js.map