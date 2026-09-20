/**
 * Progressao dentro da partida.
 *
 * CLAUDE.md e especifico: upgrades temporarios, poucos e relevantes, XP
 * compartilhado para evitar disputa por kills, cerca de tres escolhas numa
 * partida padrao, e **tudo desaparece ao fim da missao**.
 *
 * O XP e do time inteiro, entao ninguem ganha nada por roubar abate. Quando o
 * time sobe de nivel, **cada jogador** escolhe a propria melhoria: o ritmo e
 * coletivo, a decisao e individual. Isso evita tanto a disputa por kills
 * quanto uma votacao no meio de uma missao de seis minutos.
 */
/**
 * O catalogo.
 *
 * Seis, de proposito: com tres escolhas por partida, o jogador pega metade e
 * deixa metade. Um catalogo grande faria cada escolha valer menos, e CLAUDE.md
 * pede poucas e relevantes.
 *
 * Nenhuma delas e so um numero maior. `maos_firmes` muda como voce se posiciona
 * no meio do time; `respiro_curto` muda quando vale a pena recuar; `prontidao`
 * muda o ritmo da classe. Sao decisoes, nao acumulo.
 */
export const UPGRADES = {
    lamina_afiada: {
        id: 'lamina_afiada',
        name: 'Lâmina Afiada',
        description: 'Seu ataque básico causa 25% mais dano.',
    },
    passo_largo: {
        id: 'passo_largo',
        name: 'Passo Largo',
        description: 'Você anda 12% mais rápido.',
    },
    couro_grosso: {
        id: 'couro_grosso',
        name: 'Couro Grosso',
        description: 'Você recebe 18% menos dano.',
    },
    maos_firmes: {
        id: 'maos_firmes',
        name: 'Mãos Firmes',
        description: 'O dano que você causa a aliados cai pela metade.',
    },
    respiro_curto: {
        id: 'respiro_curto',
        name: 'Respiro Curto',
        description: 'Você começa a se recuperar 2,5 s antes.',
    },
    prontidao: {
        id: 'prontidao',
        name: 'Prontidão',
        description: 'Sua habilidade recarrega 25% mais rápido.',
    },
};
export const UPGRADE_IDS = Object.keys(UPGRADES);
/** Efeito de cada melhoria. Um lugar so, para o servidor e os testes lerem. */
export const UPGRADE_EFFECT = {
    /** Multiplicador do dano causado por `lamina_afiada`. */
    damageFactor: 1.25,
    /** Multiplicador da velocidade por `passo_largo`. */
    speedFactor: 1.12,
    /** Fracao do dano absorvida por `couro_grosso`. */
    damageReduction: 0.18,
    /** Multiplicador do fogo amigo causado por `maos_firmes`. */
    friendlyFireFactor: 0.5,
    /** Quanto `respiro_curto` encurta a espera da recuperacao. */
    regenDelayCutMs: 2_500,
    /** Multiplicador da recarga de habilidade por `prontidao`. */
    abilityCooldownFactor: 0.75,
};
export const PROGRESSION = {
    /** Opcoes oferecidas por vez. CLAUDE.md: oferecer 3 e escolher 1. */
    offerSize: 3,
    /**
     * XP por invasor abatido, por tipo.
     *
     * O que ameaca mais vale mais -- derrubar um Capitao antes que ele acelere
     * a linha inteira deve render mais que somar Soldados.
     */
    xpPerInvader: {
        soldado: 10,
        lanceiro: 12,
        arqueiro: 14,
        bruto: 20,
        capitao: 26,
        ariete: 30,
    },
    /**
     * XP acumulado para cada escolha, para **um** defensor.
     *
     * Tres degraus, porque CLAUDE.md pede cerca de tres escolhas numa partida
     * padrao. Medidos com a simulacao de missao, nao escolhidos no olho: uma
     * missao solo rende cerca de 310 de XP, entao os degraus ficam em torno de
     * 25%, 55% e 85% disso.
     */
    levelThresholds: [80, 175, 265],
    /**
     * Quanto cada defensor alem do primeiro encarece os degraus.
     *
     * Time maior enfrenta mais invasores e junta XP mais rapido -- medido: 310
     * de XP no solo contra 1074 com seis. Sem escalar, o time cheio pegaria as
     * tres escolhas no primeiro terco e o solo nao pegaria nenhuma. O numero
     * acompanha a escala sublinear do Director pela mesma razao: o que muda com
     * o tamanho do time e a pressao, nao o ritmo da progressao.
     */
    additionalDefenderCost: 0.5,
};
//# sourceMappingURL=upgrades.js.map