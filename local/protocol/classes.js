export const CLASS_IDS = [
    'guerreiro',
    'arqueiro',
    'alquimista',
    'suporte',
    'engenheiro',
    'cacador',
    'mestre_caes',
    'barbaro',
];
/**
 * Recarga base dos especiais.
 *
 * Numero de partida, nao numero medido: numa missao de 6 minutos da cerca de
 * seis usos por jogador. Vale ajustar quando houver playtest com gente.
 */
export const SPECIAL_COOLDOWN_MS = 50_000;
/**
 * Ultima Linha do Guerreiro: ele para de andar e vira parede.
 *
 * O preco e a mobilidade inteira -- nao parte dela, como no Escudo. Em troca
 * ele nao cede espaco: quem esbarra e empurrado, e nao o contrario. E o que
 * CLAUDE.md chama de controle de passagem.
 */
export const ULTIMA_LINHA = {
    durationMs: 6_000,
    /** Fracao do dano absorvida, venha de onde vier. */
    damageReduction: 0.75,
};
/**
 * Furia do Barbaro: bate muito mais, apanha muito mais.
 *
 * O ganho de velocidade existe para a Furia ser *avanco*, nao posicao: o
 * Barbaro em Furia parado no meio do time e so um aliado fragil com machado.
 */
export const FURIA = {
    durationMs: 8_000,
    /** Multiplicador do dano causado. */
    damageFactor: 1.6,
    /** Multiplicador do dano recebido. */
    vulnerability: 1.5,
    /** Multiplicador da velocidade. */
    speedFactor: 1.15,
};
/** Escudo do Guerreiro: reduz dano vindo de frente, custa mobilidade. */
export const SHIELD = {
    /** Fracao do dano frontal que o escudo absorve. */
    damageReduction: 0.7,
    /** Abertura coberta, em graus. Custas as costas ficam abertas. */
    arcDegrees: 150,
    /** Fracao da velocidade mantida enquanto defende. */
    speedFactor: 0.45,
};
/** Curativo do Suporte: cura por proximidade, interrompivel. */
export const HEAL = {
    range: 120,
    perSecond: 16,
    /**
     * Quanto tempo o Curativo corre depois de um clique.
     *
     * Um clique so: ele cuida ate o tempo acabar ou ate ser cortado. Antes era
     * "mantenha o botao", e na pratica virava marteladas no botao no meio da
     * briga.
     *
     * Quatro segundos sao uma aposta visivel: 64 de vida para cada um dos dois,
     * e quatro segundos parado no meio de uma invasao e tempo de sobra para o
     * inimigo cobrar.
     */
    durationMs: 4_000,
    /** Tempo travado depois de levar dano: e o "pode ser interrompido". */
    interruptMs: 1200,
};
/** Quebra-Linha do Barbaro: avanco que rompe formacao. */
export const CHARGE = {
    distance: 190,
    durationMs: 260,
    damage: 22,
    /** Raio que o corpo varre durante o avanco. */
    radius: 34,
    /** Empurrao aplicado em quem e atingido. */
    knockback: 70,
};
/**
 * Oleo do Alquimista: zona de controle.
 *
 * Nao causa dano -- atrasa quem passa. Territorio nao distingue de que lado
 * voce esta, entao aliado tambem afunda: a decisao e *onde* derramar.
 *
 * `flammable` e o gancho do Incendio, o especial que ainda nao existe.
 */
export const OLEO = {
    radius: 92,
    durationMs: 12_000,
    /** Fracao da velocidade mantida dentro da poca. */
    speedFactor: 0.45,
    /** Distancia maxima do ponto onde o frasco e derramado. */
    throwRange: 260,
    flammable: true,
};
/**
 * Armadilha do Cacador: imobiliza o primeiro invasor que pisa.
 *
 * Aliado nao dispara. CLAUDE.md e explicito sobre isso -- pisar na armadilha
 * do proprio time seria frustracao sem licao.
 */
export const ARMADILHA = {
    radius: 30,
    durationMs: 45_000,
    /** Tempo preso depois de disparada. */
    rootMs: 2_400,
    damage: 12,
    throwRange: 200,
};
/**
 * Barricada do Engenheiro: estrutura solida que fecha passagem.
 *
 * Nao mata ninguem -- compra tempo. O invasor que esbarra nela **para e bate**
 * em vez de contornar, e e isso que a torna util: cada segundo gasto quebrando
 * madeira e um segundo em que o portao nao esta sendo atacado.
 *
 * Fogo amigo nao a danifica, pela mesma razao do portao: derrubar a propria
 * defesa por erro de mira e uma perda que nao ensina nada.
 */
export const BARRICADA = {
    maxHealth: 190,
    radius: 32,
    durationMs: 60_000,
    /** Quantas o mesmo Engenheiro mantem em campo. A mais antiga cede lugar. */
    maxPerEngineer: 2,
    /** Distancia a frente em que e construida. */
    placeRange: 110,
    /** Espaco minimo de outra estrutura, para nao empilhar muro. */
    minSpacing: 62,
};
/**
 * O cao do Mestre dos Caes.
 *
 * Existe fisicamente no mapa: ocupa espaco, leva dano -- inclusive de fogo
 * amigo -- e pode cair. Nao morre em definitivo: fica incapacitado e se
 * levanta, porque perder o companheiro no primeiro erro tiraria a classe do
 * jogador pelo resto da missao.
 *
 * VISUAL_BIBLE.md: cao reconhecivel mesmo no caos, e nunca criatura
 * fantastica -- e um animal treinado.
 */
export const CAO = {
    maxHealth: 55,
    /** Mais rapido que o dono: e ele quem fecha distancia. */
    speed: 268,
    radius: 11,
    /** Distancia em que fica do dono quando so acompanha. */
    followDistance: 62,
    /** Alcance em que aceita uma ordem apontada. */
    commandRange: 360,
    /** Tempo caido antes de se levantar sozinho. */
    recoveryMs: 9_000,
    /** Volta com esta fracao do HP: de pe, mas precisa de cuidado. */
    recoveredFraction: 0.5,
    attack: {
        damage: 11,
        range: 44,
        arcDegrees: 70,
        windupMs: 200,
        recoveryMs: 180,
        cooldownMs: 780,
    },
};
/** Teto de estruturas simultaneas por sala. */
export const STRUCTURE = { maxPerRoom: 12 };
/** Teto de zonas simultaneas por sala, para tela e banda nao estourarem. */
export const ZONE = { maxPerRoom: 24 };
/**
 * Chuva de Flechas do Arqueiro: salvas numa area distante.
 *
 * O aviso antes da primeira salva e o que separa isto de dano gratuito: o
 * circulo aparece, todo mundo ve, e quem estiver la tem tempo de sair --
 * inclusive o aliado. CLAUDE.md pede friendly fire aqui, e sem o aviso o
 * friendly fire viraria acidente em vez de decisao.
 */
export const CHUVA_DE_FLECHAS = {
    radius: 120,
    /** Aviso antes da primeira salva. */
    telegraphMs: 1_100,
    /** Salvas, e o intervalo entre elas. */
    volleys: 4,
    volleyIntervalMs: 420,
    /** Dano por salva. Quem fica ate o fim leva tudo. */
    damagePerVolley: 14,
    /**
     * Alcance. Limitado pelo que o jogador *ve*, nao pelo que o arco alcanca.
     *
     * Com o zoom de camera atual, a tela mostra cerca de 457 unidades para os
     * lados. Largar uma area de dano onde nem da para conferir se ha aliado
     * contraria a regra do CLAUDE.md de que o fogo amigo precisa ser legivel.
     * O limite vertical e mais apertado (~257) e afeta tambem o Oleo -- ver a
     * secao de limitacoes no README.
     */
    throwRange: 380,
};
/**
 * Estandarte do Suporte: sustenta o grupo em volta.
 *
 * Nao cura nem empurra -- faz o time aguentar mais tempo no mesmo lugar. E a
 * diferenca entre o Curativo, que salva uma pessoa por vez com o Suporte
 * parado, e o Estandarte, que vale para todos e continua valendo depois que
 * ele sai de perto.
 *
 * A estrutura pode ser atacada, como CLAUDE.md pede: o invasor tem resposta,
 * e o time tem algo a defender alem do portao.
 */
export const ESTANDARTE = {
    maxHealth: 130,
    radius: 20,
    /** Alcance do efeito. Bem maior que o corpo: e area, nao obstaculo. */
    auraRadius: 190,
    durationMs: 22_000,
    /** Plantado logo a frente: e posicao de grupo, nao alcance de arremesso. */
    placeRange: 70,
    /** Fracao do dano absorvida por quem esta sob ele. */
    damageReduction: 0.25,
    /** Multiplicador da recuperacao fora de combate. */
    regenFactor: 2.2,
    /** Multiplicador da velocidade de reanimacao. */
    reviveFactor: 1.8,
};
/**
 * Balista do Engenheiro: arma de cerco que qualquer aliado opera.
 *
 * O ponto dela nao e o dano -- e **outro jogador** poder assumir. CLAUDE.md
 * lista isso como sinergia real em vez de bonus invisivel: o Engenheiro monta,
 * alguem que nao tem alcance sobe e passa a ter. Quem opera fica preso no
 * lugar, entao a decisao e de quem pode se dar ao luxo de parar.
 */
export const BALISTA = {
    maxHealth: 160,
    radius: 26,
    durationMs: 30_000,
    /** Montada logo a frente, como a barricada. */
    placeRange: 80,
    /** Distancia em que da para assumir a arma. */
    useRange: 70,
    bolt: {
        damage: 52,
        speed: 980,
        maxRange: 760,
        radius: 7,
        /** Recarga da arma, nao do jogador: trocar de operador nao acelera. */
        cooldownMs: 1_700,
    },
};
/**
 * Soltar os Caes do Mestre dos Caes: a matilha, por um tempo.
 *
 * Nao sao companheiros -- sao pressao. Chegam, mordem o que estiver perto e
 * vao embora. O companheiro principal continua sendo um so, porque e dele que
 * vem o controle; estes sao volume.
 */
export const MATILHA = {
    count: 3,
    durationMs: 14_000,
};
/**
 * Cacada do Cacador: marca um alvo prioritario.
 *
 * Nao e dano -- e coordenacao. A marca diz ao time inteiro em quem bater, e o
 * bonus so existe para que concentrar fogo no alvo certo valha mais do que
 * cada um escolher o seu. Vale para todos os defensores, nao so para quem
 * marcou: e o especial mais cooperativo do roster.
 */
export const CACADA = {
    /** Alcance da marca, e do cone de leitura ao apontar. */
    range: 480,
    durationMs: 12_000,
    /** Dano extra que o alvo marcado recebe de qualquer defensor. */
    damageBonus: 0.35,
};
/**
 * Incendio do Alquimista: poe fogo no oleo ja derramado.
 *
 * Nao cria fogo do nada -- CLAUDE.md diz "incendeia areas preparadas". E a
 * sinergia central da classe: o Oleo sozinho atrasa, o Incendio sozinho nao
 * faz nada, e os dois juntos negam uma rota inteira. Vale tambem para o oleo
 * de *outro* Alquimista, que e o que torna isso cooperacao e nao combo solo.
 */
export const INCENDIO = {
    /** Alcance em que o oleo pega fogo, medido do jogador. */
    igniteRange: 320,
    durationMs: 5_000,
    /** Queimadura periodica. Intervalo legivel em vez de dano continuo. */
    tickMs: 500,
    damagePerTick: 11,
};
/** Disparo Preciso do Arqueiro: tiro carregado, caro e decisivo. */
export const AIMED_SHOT = {
    damageMultiplier: 2.6,
    speedMultiplier: 1.35,
    rangeMultiplier: 1.2,
    /** Puxada longa: o alvo tem tempo de sair da linha. */
    windupMs: 700,
};
export const CLASSES = {
    /**
     * Frontline. Aguenta mais que qualquer um e segura passagem.
     *
     * O dano e mediano de proposito: se ele fosse o mais duro *e* o que mais
     * bate, nao haveria motivo para levar outra coisa. O valor dele esta em
     * ficar de pe onde ninguem mais fica.
     */
    guerreiro: {
        id: 'guerreiro',
        name: 'Guerreiro',
        role: 'Segura a linha',
        maxHealth: 130,
        speed: 198,
        attackKind: 'melee',
        attack: {
            damage: 16,
            range: 78,
            arcDegrees: 100,
            windupMs: 160,
            recoveryMs: 240,
            cooldownMs: 760,
        },
        ability: {
            id: 'escudo',
            name: 'Escudo',
            description: 'Defesa frontal direcional. Reduz mobilidade.',
            sustained: true,
            cooldownMs: 0,
            available: true,
        },
        special: {
            id: 'ultima_linha',
            name: 'Última Linha',
            description: 'Fixa posição, absorve 75% do dano e não cede passagem.',
            cooldownMs: SPECIAL_COOLDOWN_MS,
            durationMs: ULTIMA_LINHA.durationMs,
            available: true,
        },
    },
    /**
     * Alcance puro. A flecha acerta o primeiro corpo na trajetoria, entao
     * atirar com aliado na frente e problema de quem atira.
     */
    arqueiro: {
        id: 'arqueiro',
        name: 'Arqueiro',
        role: 'Ameaca a distancia',
        maxHealth: 84,
        speed: 236,
        attackKind: 'projectile',
        attack: {
            damage: 22,
            range: 460,
            arcDegrees: 8,
            /** Puxada do arco: a antecipacao e parte da identidade. */
            windupMs: 280,
            recoveryMs: 220,
            cooldownMs: 900,
        },
        projectile: { speed: 660, maxRange: 460, radius: 5, splashRadius: 0 },
        ability: {
            id: 'disparo_preciso',
            name: 'Disparo Preciso',
            description: 'Tiro carregado contra alvo prioritario.',
            sustained: false,
            cooldownMs: 7000,
            available: true,
        },
        special: {
            id: 'chuva_de_flechas',
            name: 'Chuva de Flechas',
            description: 'Salva numa área distante. Acerta quem estiver lá, de qualquer lado.',
            cooldownMs: SPECIAL_COOLDOWN_MS,
            durationMs: 0,
            available: true,
        },
    },
    /**
     * Controle territorial. O frasco estoura numa area pequena -- pega grupo,
     * e pega aliado no grupo tambem.
     */
    alquimista: {
        id: 'alquimista',
        name: 'Alquimista',
        role: 'Controle de area',
        maxHealth: 92,
        speed: 214,
        attackKind: 'projectile',
        attack: {
            damage: 14,
            range: 300,
            arcDegrees: 8,
            windupMs: 300,
            recoveryMs: 280,
            cooldownMs: 1300,
        },
        projectile: { speed: 400, maxRange: 300, radius: 7, splashRadius: 64 },
        ability: {
            id: 'oleo',
            name: 'Oleo',
            description: 'Zona inflamavel e de controle.',
            sustained: false,
            cooldownMs: 12000,
            available: true,
        },
        special: {
            id: 'incendio',
            name: 'Incêndio',
            description: 'Ateia fogo no óleo já derramado.',
            cooldownMs: SPECIAL_COOLDOWN_MS,
            durationMs: 0,
            available: true,
        },
    },
    /** Sustentacao. Arma curta e fraca: o valor dele nao esta no dano. */
    suporte: {
        id: 'suporte',
        name: 'Suporte',
        role: 'Mantem o time de pe',
        maxHealth: 106,
        speed: 218,
        attackKind: 'melee',
        attack: {
            damage: 13,
            range: 62,
            arcDegrees: 88,
            windupMs: 140,
            recoveryMs: 200,
            cooldownMs: 620,
        },
        ability: {
            id: 'curativo',
            name: 'Curativo',
            description: 'Cuida de si e do aliado mais proximo. Andar ou apanhar corta.',
            // Um clique inicia o cuidado; ele corre sozinho ate acabar ou ser
            // cortado. Nao e "mantida": segurar o botao nao muda nada.
            sustained: false,
            cooldownMs: 0,
            available: true,
        },
        special: {
            id: 'estandarte',
            name: 'Estandarte',
            description: 'Planta um estandarte que sustenta o grupo em volta.',
            cooldownMs: SPECIAL_COOLDOWN_MS,
            durationMs: 0,
            available: true,
        },
    },
    /** Fortificacao. Martelo curto e firme; o papel dele vem com as estruturas. */
    engenheiro: {
        id: 'engenheiro',
        name: 'Engenheiro',
        role: 'Altera o campo',
        maxHealth: 114,
        speed: 206,
        attackKind: 'melee',
        attack: {
            damage: 18,
            range: 66,
            arcDegrees: 78,
            windupMs: 200,
            recoveryMs: 280,
            cooldownMs: 820,
        },
        ability: {
            id: 'barricada',
            name: 'Barricada',
            description: 'Construcao fisica que fecha passagem.',
            sustained: false,
            cooldownMs: 14000,
            available: true,
        },
        special: {
            id: 'balista',
            name: 'Balista',
            description: 'Monta uma balista que qualquer aliado pode operar.',
            cooldownMs: SPECIAL_COOLDOWN_MS,
            durationMs: BALISTA.durationMs,
            available: true,
        },
    },
    /**
     * Besta: lenta, forte, com recarga explicita.
     *
     * O tempo de recarga e a identidade -- errar custa caro, acertar resolve.
     */
    cacador: {
        id: 'cacador',
        name: 'Cacador',
        role: 'Alvo prioritario',
        maxHealth: 90,
        speed: 212,
        attackKind: 'projectile',
        attack: {
            damage: 40,
            range: 520,
            arcDegrees: 6,
            windupMs: 220,
            /** Recarga visivel: o Cacador fica exposto depois de atirar. */
            recoveryMs: 520,
            cooldownMs: 1950,
        },
        projectile: { speed: 820, maxRange: 520, radius: 5, splashRadius: 0 },
        ability: {
            id: 'armadilha',
            name: 'Armadilha',
            description: 'Imobiliza inimigo. Aliados nao ativam.',
            sustained: false,
            cooldownMs: 11000,
            available: true,
        },
        special: {
            id: 'cacada',
            name: 'Caçada',
            description: 'Marca um alvo prioritário para o time.',
            cooldownMs: SPECIAL_COOLDOWN_MS,
            durationMs: 0,
            available: true,
        },
    },
    /** Pressao movel. O cao vem na proxima etapa; por ora, espada curta. */
    mestre_caes: {
        id: 'mestre_caes',
        name: 'Mestre dos Caes',
        role: 'Pressao movel',
        maxHealth: 100,
        speed: 228,
        attackKind: 'melee',
        attack: {
            damage: 15,
            range: 66,
            arcDegrees: 84,
            windupMs: 140,
            recoveryMs: 200,
            cooldownMs: 600,
        },
        ability: {
            id: 'comandar_cao',
            name: 'Comandar Cao',
            description: 'Aponta o cao para atacar, guardar ou proteger.',
            sustained: false,
            cooldownMs: 3000,
            available: true,
        },
        special: {
            id: 'soltar_os_caes',
            name: 'Soltar os Cães',
            description: 'Chama três cães extras por 14 s.',
            cooldownMs: SPECIAL_COOLDOWN_MS,
            durationMs: MATILHA.durationMs,
            available: true,
        },
    },
    /**
     * Ruptura, alto risco.
     *
     * Arco de 150 graus e dano 30: e a classe em que o fogo amigo deixa de ser
     * acidente e vira decisao. Girar o machado no meio do time custa caro.
     */
    barbaro: {
        id: 'barbaro',
        name: 'Barbaro',
        role: 'Rompe formacao',
        maxHealth: 122,
        speed: 194,
        attackKind: 'melee',
        attack: {
            damage: 30,
            range: 92,
            arcDegrees: 150,
            windupMs: 320,
            recoveryMs: 420,
            cooldownMs: 1150,
        },
        ability: {
            id: 'quebra_linha',
            name: 'Quebra-Linha',
            description: 'Avanco que rompe formacao.',
            sustained: false,
            cooldownMs: 8500,
            available: true,
        },
        special: {
            id: 'furia',
            name: 'Fúria',
            description: 'Bate 60% mais forte e apanha 50% mais. Dura pouco.',
            cooldownMs: SPECIAL_COOLDOWN_MS,
            durationMs: FURIA.durationMs,
            available: true,
        },
    },
};
export const DEFAULT_CLASS = 'guerreiro';
export function isClassId(value) {
    return CLASS_IDS.includes(value);
}
//# sourceMappingURL=classes.js.map