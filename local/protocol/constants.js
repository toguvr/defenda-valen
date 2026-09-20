/**
 * Constantes do protocolo e da simulacao.
 *
 * Fonte unica de verdade: o servidor importa daqui e o client Godot recebe um
 * espelho gerado por `pnpm --filter @valen/protocol gen:gdscript`.
 * Nao espalhar numeros magicos fora deste arquivo.
 */
/** Incrementar sempre que o formato das mensagens mudar de forma incompativel. */
export const PROTOCOL_VERSION = 1;
export const TIMING = {
    /** Passos de simulacao por segundo no servidor. */
    simulationTickHz: 30,
    /** Snapshots de mundo enviados por segundo para cada client. */
    snapshotHz: 20,
    /** Frequencia com que o client envia intencao de input. */
    inputSendHz: 30,
    /** Atraso de render dos players remotos, para ter dois snapshots no buffer. */
    interpolationDelayMs: 100,
    /** Conexao sem nenhuma mensagem por este tempo e considerada morta. */
    connectionTimeoutMs: 15_000,
    /** Intervalo de ping do client. */
    pingIntervalMs: 2_000,
    /**
     * Prazo para o `hello_accepted` chegar depois do socket abrir.
     *
     * Sem isso, apontar o client para uma URL que nao e um game server deixa a
     * tela parada em "conectado" e todo comando enfileirado em silencio.
     */
    handshakeTimeoutMs: 5_000,
};
export const SIMULATION_TICK_MS = 1000 / TIMING.simulationTickHz;
export const SNAPSHOT_INTERVAL_MS = 1000 / TIMING.snapshotHz;
export const ROOM = {
    maxPlayers: 6,
    codeLength: 4,
    /** Sem I, O, 0 e 1 para evitar erro de leitura em tela de celular. */
    codeAlphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    /** Janela em que um player desconectado ainda pode reassumir seu slot. */
    reconnectWindowMs: 30_000,
    /** Sala sem nenhum player conectado e destruida apos este tempo. */
    emptyRoomTtlMs: 30_000,
};
export const PLAYER = {
    /** Velocidade base. Cada classe define a sua; esta e o piso de referencia. */
    speed: 220,
    /** Raio de colisao usado para manter o player dentro da arena. */
    radius: 16,
    nameMinLength: 1,
    nameMaxLength: 16,
    /**
     * Quanto de uma sobreposicao entre aliados e desfeita por tick.
     *
     * CLAUDE.md: a colisao entre aliados e leve -- personagens nao ocupam o
     * mesmo ponto, mas deslizam uns pelos outros em vez de travar. Valor baixo
     * empurra devagar (desliza); 1.0 separaria de uma vez (trava).
     */
    separationStrength: 0.4,
};
/** Arena do slice tecnico: retangulo simples, origem no canto superior esquerdo. */
export const ARENA = {
    width: 1600,
    height: 900,
    /**
     * Espessura da muralha que cerca a arena.
     *
     * Compartilhada porque o client a desenha e o servidor precisa respeita-la:
     * nao da para construir dentro da pedra.
     */
    wallThickness: 48,
};
export const INPUT = {
    /**
     * Cada comando de input vale um passo fixo de tempo. Client e servidor usam
     * o mesmo passo, o que mantem a prediction do client identica a simulacao.
     */
    stepSeconds: 1 / TIMING.inputSendHz,
    /** Fila maxima por player; excedente descarta os comandos mais antigos. */
    maxQueuedInputs: 15,
    /** Comandos consumidos por tick. Limita ganho de velocidade por flood. */
    maxInputsPerTick: 2,
};
/**
 * Combate corpo a corpo do slice tecnico.
 *
 * Ainda nao ha classes: este e um golpe em arco generico, o mesmo para todos.
 * Todo numero aqui e de balanceamento e deve ser ajustavel em playtest.
 */
export const COMBAT = {
    maxHealth: 100,
    /** Dano cheio do ataque basico. */
    basicAttackDamage: 20,
    /**
     * Fracao do dano aplicada em aliados.
     *
     * CLAUDE.md manda comecar playtests em ~35%. E um numero de balanceamento,
     * nao uma constante fisica: mexer aqui e esperado.
     */
    friendlyFireMultiplier: 0.35,
    /** Alcance do arco, medido do centro do personagem. */
    basicAttackRange: 78,
    /** Abertura total do arco, em graus. */
    basicAttackArcDegrees: 100,
    /**
     * Antecipacao entre soltar o botao e o golpe sair.
     *
     * Existe para o ataque ser legivel: quem esta na trajetoria precisa ter um
     * instante para reagir, e a animacao precisa de antecipacao -> impacto.
     */
    basicAttackWindupMs: 160,
    /** Recuperacao depois do golpe, em que o personagem nao ataca de novo. */
    basicAttackRecoveryMs: 240,
    /** Tempo minimo entre dois ataques, contado do inicio do windup. */
    basicAttackCooldownMs: 700,
};
/**
 * Soldado: o inimigo base da invasao.
 *
 * Mais lento que o jogador e com antecipacao bem maior que a dele. Isso e
 * deliberado: o golpe precisa ser visto e evitado, senao o combate vira troca
 * de dano em vez de posicionamento.
 */
export const SOLDADO = {
    threatCost: 10,
    maxHealth: 60,
    speed: 128,
    radius: 15,
    /** Distancia em que para de avancar e comeca a golpear. */
    engageRange: 54,
    /** Reavalia o alvo neste intervalo, nao a cada tick. */
    retargetIntervalMs: 600,
    /** Tempo que o corpo fica em tela depois de cair, para o abate ser legivel. */
    despawnDelayMs: 900,
    attack: {
        /**
         * Baixo de proposito.
         *
         * A ameaca do Soldado vem do numero e da insistencia no portao, nao de
         * cada golpe ser devastador. Com dano alto, o defensor morria antes de o
         * objetivo correr risco -- a missao virava sobre sobreviver, nao sobre
         * defender.
         */
        damage: 7,
        range: 62,
        arcDegrees: 90,
        windupMs: 420,
        recoveryMs: 320,
        cooldownMs: 1500,
    },
};
/**
 * Brechas na muralha, por onde a invasao entra.
 *
 * As tres do norte existem desde o inicio: CLAUDE.md pede multiplas rotas
 * convergindo para o portao, e a razao e de jogo -- com uma entrada so, um
 * time pequeno tapa tudo e o objetivo nunca corre risco.
 *
 * As outras abrem durante a missao, e mudam a pergunta em vez de so aumentar
 * o volume. Os flancos obrigam a virar a linha sem largar o portao; a do sul,
 * tarde, poe invasores **atras** da linha, perto da fonte -- quem estava
 * curando vira alvo. Escalonadas, e nao simultaneas: duas paredes cedendo
 * juntas nao deixam ninguem decidir nada, so correr.
 *
 * Quem manda e o tempo; `minDefenders` so atrasa. Na primeira versao era o
 * contrario, e o efeito foi que jogando sozinho nenhuma delas abria: a
 * muralha nunca cedia e a missao inteira vinha do norte, como antes.
 *
 * Os flancos ficam a uns 750 px do portao, contra 250 a 450 das brechas do
 * norte. Medido, isso **alivia** o portao em vez de castiga-lo -- o invasor
 * gasta o dobro do tempo atravessando o patio. O que eles cobram e
 * reposicionamento, nao dano: e a linha que precisa virar.
 */
export const BREACHES = [
    { side: 'north', at: 0.22, fromAssault: 0, minDefenders: 1 },
    { side: 'north', at: 0.5, fromAssault: 0, minDefenders: 1 },
    { side: 'north', at: 0.78, fromAssault: 0, minDefenders: 1 },
    { side: 'west', at: 0.38, fromAssault: 2, minDefenders: 1 },
    { side: 'east', at: 0.38, fromAssault: 4, minDefenders: 2 },
    { side: 'south', at: 0.35, fromAssault: 5, minDefenders: 3 },
];
export const BREACH = {
    /** Largura do rombo desenhado na muralha. */
    width: 150,
    /** Recuo do ponto de entrada para dentro da arena. */
    inset: 20,
};
/** Brechas abertas neste degrau da invasao, para este tamanho de time. */
export function openBreaches(assaultIndex, defenderCount = 1) {
    return BREACHES.filter((breach) => breach.fromAssault <= assaultIndex && breach.minDefenders <= defenderCount);
}
export const GATE = {
    /**
     * Resistencia do portao.
     *
     * Dimensionada para uma missao de seis minutos: o portao aguenta vazamento
     * ocasional, mas nao aguenta ser ignorado.
     */
    maxHealth: 2200,
    /** Meia-largura da estrutura, usada como raio de acerto. */
    radius: 110,
    /**
     * Caixa real do portao. Desenho e colisao saem daqui, dos mesmos numeros.
     *
     * O portao e largo e baixo, e tratava-lo como disco de raio 110 fazia o
     * invasor vindo do norte parar a 110 px do portao **desenhado** -- batendo
     * nele de longe, fora do alcance de quem tentava defende-lo. Medido: 54 px
     * pelo lado (certo) contra 110 pelo norte e 138 pelo sul.
     */
    halfWidth: 110,
    halfHeight: 40,
    /**
     * Centro do portao: ao meio do patio, nao na muralha.
     *
     * CLAUDE.md descreve rotas convergindo para portao/patio. Com o portao
     * colado na entrada, os invasores nasciam em contato com o objetivo -- nao
     * havia trajeto para interceptar, nem passagem para o Engenheiro fechar.
     * A distancia entre a brecha e o portao **e** o campo de jogo.
     */
    x: ARENA.width / 2,
    y: 330,
    /**
     * Fogo amigo NAO danifica o portao.
     *
     * Um defensor derrubar o proprio objetivo por erro de mira e uma derrota
     * que nao ensina nada. Se virar decisao de design, e so ligar aqui.
     */
    damagedByDefenders: false,
};
/**
 * Distancia em que um defensor rouba a atencao do invasor.
 *
 * Calibrado logo acima do alcance efetivo do golpe do jogador
 * (`basicAttackRange` + raio do alvo). A regra fica simples de ler: se voce
 * chegou perto o bastante para golpear, ele responde. Nao ha como fustigar de
 * graca, nem ha como ser atacado por alguem que voce nao alcanca.
 *
 * Com um raio grande demais, todo invasor no portao atacava todo defensor que
 * chegasse para defender -- e interceptar deixava de ser uma escolha de
 * posicao para virar castigo automatico.
 */
export const INVADER_THREAT_RANGE = 100;
/**
 * Lanceiro: alcance maior, guarda mais fechada.
 *
 * A lanca denuncia o alcance -- e o inimigo que pune aproximacao descuidada.
 * Arco estreito de proposito: quem circula por fora passa, quem vem de frente
 * apanha.
 */
export const LANCEIRO = {
    maxHealth: 55,
    speed: 116,
    radius: 15,
    engageRange: 86,
    retargetIntervalMs: 600,
    despawnDelayMs: 900,
    threatCost: 13,
    attack: {
        damage: 9,
        range: 98,
        arcDegrees: 46,
        windupMs: 500,
        recoveryMs: 340,
        cooldownMs: 1800,
    },
};
/**
 * Arqueiro: a ameaca que quebra a linha parada.
 *
 * Mantem distancia e atira. E ele quem torna insustentavel plantar o time
 * colado no portao -- para silenciar um Arqueiro e preciso sair da linha,
 * que e exatamente a decisao de posicionamento que faltava na missao.
 *
 * Fragil de perto: quem chega, resolve.
 */
export const ARQUEIRO = {
    maxHealth: 38,
    speed: 112,
    radius: 14,
    /** Distancia que tenta manter do alvo. */
    preferredRange: 290,
    /** Abaixo disso, recua em vez de atirar. */
    minRange: 180,
    retargetIntervalMs: 700,
    despawnDelayMs: 900,
    threatCost: 16,
    shot: {
        /**
         * Cadencia baixa de proposito.
         *
         * Recuar nao escapa de flecha: a resposta correta e fechar a distancia e
         * calar o arqueiro. Com cadencia alta, o defensor morria antes de
         * conseguir aplicar essa resposta -- e a ameaca virava punicao, nao
         * problema a resolver.
         */
        damage: 7,
        /** Unidades por segundo. Lento o bastante para a flecha ser vista. */
        speed: 540,
        maxRange: 400,
        radius: 5,
        /** Antecipacao longa: a puxada do arco e o aviso. */
        windupMs: 640,
        recoveryMs: 280,
        cooldownMs: 3400,
    },
};
/**
 * Bruto: o golpe que nao se aguenta de frente.
 *
 * Lento, pesado e muito telegrafado. Existe para punir quem trata combate como
 * troca de dano: a antecipacao longa da tempo de sair, e quem nao sai paga
 * caro. Arco largo para que circular por fora tambem nao seja de graca.
 */
export const BRUTO = {
    threatCost: 24,
    maxHealth: 115,
    speed: 94,
    radius: 20,
    engageRange: 66,
    retargetIntervalMs: 700,
    despawnDelayMs: 1100,
    attack: {
        damage: 17,
        range: 82,
        arcDegrees: 124,
        /** Bem longa: o golpe precisa ser evitavel, nao apenas sofrido. */
        windupMs: 720,
        recoveryMs: 480,
        cooldownMs: 2400,
    },
};
/**
 * Capitao: alvo prioritario.
 *
 * Nao e o mais forte -- e o que faz os outros serem piores. Enquanto estiver
 * vivo, os invasores por perto golpeiam mais rapido. Isso cria a decisao de
 * coordenacao que o CLAUDE.md pede: focar um alvo em vez de bater no que
 * estiver mais perto.
 *
 * O efeito e de ritmo, nao de numero inflado: CLAUDE.md e explicito que
 * dificuldade nao vem de inflar atributos.
 */
export const CAPITAO = {
    threatCost: 32,
    maxHealth: 95,
    speed: 126,
    radius: 17,
    engageRange: 58,
    retargetIntervalMs: 600,
    despawnDelayMs: 1100,
    /** Raio em que os aliados dele sentem o comando. */
    auraRadius: 190,
    /** Fracao do cooldown que os liderados economizam. */
    auraCooldownReduction: 0.3,
    attack: {
        damage: 11,
        range: 70,
        arcDegrees: 100,
        windupMs: 400,
        recoveryMs: 300,
        cooldownMs: 1400,
    },
};
/**
 * Ariete: a ameaca que obriga a interceptar cedo.
 *
 * Nao luta. Nao persegue ninguem. Anda devagar ate o portao e bate nele com
 * forca que nenhum outro invasor tem. Ignorar e perder a missao.
 *
 * E a peca que faltava no desenho: o Arqueiro obriga a sair da linha, mas nada
 * obrigava a parar uma ameaca *antes* de ela chegar. CLAUDE.md o descreve como
 * "objetivo/estrutura movel" da primeira missao.
 */
export const ARIETE = {
    /**
     * Caro no orcamento.
     *
     * O dano dele no portao e concentrado e inevitavel -- diferente do Soldado,
     * que e interceptado no caminho. Precificado pelo estrago que causa quando
     * ignorado, nao pelo HP que tem.
     */
    threatCost: 78,
    maxHealth: 340,
    speed: 52,
    radius: 34,
    engageRange: 40,
    retargetIntervalMs: 1000,
    despawnDelayMs: 1400,
    attack: {
        /** Contra o portao apenas. Um golpe vale por muitos de Soldado. */
        damage: 65,
        range: 78,
        arcDegrees: 70,
        windupMs: 900,
        recoveryMs: 600,
        cooldownMs: 3200,
    },
};
/**
 * Projeteis.
 *
 * CLAUDE.md: projetil fisico acerta o primeiro corpo na trajetoria, inclusive
 * aliado. Nao ha alvo travado nem passagem livre por cima de quem esta na
 * frente -- e o que torna a linha de tiro uma decisao de posicionamento para
 * os dois lados.
 */
export const PROJECTILE = {
    /** Teto por sala, para nao estourar snapshot nem tela. */
    maxInFlight: 48,
};
/**
 * Invasion Director: quem decide a pressao da missao.
 *
 * Nao existem "waves numeradas". O Director gera orcamento de ameaca por
 * segundo e gasta esse orcamento colocando invasores em campo. A missao
 * alterna assaltos e calmarias: o assalto e a pressao, a calmaria e a janela
 * para socorrer caidos e reposicionar. Cada assalto e mais intenso que o
 * anterior.
 *
 * O orcamento escala com o numero de defensores, para que a missao exista
 * tanto para um jogador quanto para seis. CLAUDE.md: dificuldade nao vem de
 * inflar HP, vem de pressao e composicao.
 *
 * Todos estes numeros sao de balanceamento, ajustados por simulacao.
 */
export const DIRECTOR = {
    /** Duracao alvo da missao. CLAUDE.md: 4-8 minutos, referencia ~6. */
    missionDurationMs: 6 * 60 * 1000,
    /** Custo de ameaca de um Soldado. */
    soldadoThreatCost: 10,
    /**
     * Quantos defensores sao necessarios para um tipo entrar em campo.
     *
     * Bruto, Capitao e Ariete sao testes de coordenacao: exigem foco de fogo ou
     * alguem segurando enquanto outro bate. Nao ha coordenacao possivel com um
     * jogador so, entao lanca-los contra ele nao e dificuldade -- e injustica.
     *
     * CLAUDE.md lista "coordenacao exigida" como alavanca de dificuldade. Esta e
     * a alavanca sendo usada.
     */
    minDefendersFor: {
        soldado: 1,
        lanceiro: 1,
        arqueiro: 1,
        bruto: 2,
        capitao: 3,
        ariete: 3,
    },
    /**
     * Composicao da invasao ao longo da missao.
     *
     * O Soldado abre sozinho: o time precisa de um assalto para entender o
     * basico. O Lanceiro entra em seguida, punindo aproximacao descuidada. O
     * Arqueiro chega por ultimo, quando a linha ja esta estabelecida -- e ele
     * quem obriga o time a sair dela.
     *
     * Pesos relativos, sorteados a cada entrada.
     */
    composition: [
        {
            fromAssault: 0,
            weights: { soldado: 1, lanceiro: 0, arqueiro: 0, bruto: 0, capitao: 0, ariete: 0 },
        },
        {
            fromAssault: 1,
            weights: { soldado: 3, lanceiro: 1, arqueiro: 0, bruto: 0, capitao: 0, ariete: 0 },
        },
        {
            fromAssault: 2,
            weights: { soldado: 3, lanceiro: 2, arqueiro: 1, bruto: 1, capitao: 0, ariete: 0 },
        },
        {
            fromAssault: 3,
            weights: { soldado: 3, lanceiro: 2, arqueiro: 2, bruto: 1, capitao: 1, ariete: 1 },
        },
        {
            fromAssault: 5,
            weights: { soldado: 2, lanceiro: 2, arqueiro: 2, bruto: 2, capitao: 1, ariete: 2 },
        },
    ],
    /** Ameaca por segundo, pelo primeiro defensor, durante o primeiro assalto. */
    assaultThreatPerPlayer: 1.25,
    /**
     * Peso de cada defensor alem do primeiro.
     *
     * Sublinear de proposito. Um time de seis nao rende seis vezes mais que um
     * jogador sozinho: gente se atrapalha, revezа para se recuperar e gasta
     * tempo socorrendo caido. Escalar linearmente fazia a missao ficar mais
     * dificil quanto maior o time -- o contrario do que um jogo cooperativo
     * deve entregar.
     */
    additionalDefenderWeight: 0.9,
    /** Quanto cada assalto seguinte e mais intenso que o anterior. */
    escalationPerAssault: 0.18,
    /** Fracao da ameaca que continua entrando durante a calmaria. */
    lullThreatFactor: 0.12,
    firstAssaultMs: 30_000,
    /** Cada assalto dura um pouco mais que o anterior. */
    assaultGrowthMs: 5_000,
    firstLullMs: 18_000,
    /** Cada calmaria e mais curta: o respiro vai sumindo. */
    lullShrinkMs: 2_500,
    minLullMs: 8_000,
    /**
     * Invasores simultaneos com um defensor sozinho.
     *
     * Chegou a ser 3, para responder a um playtest em que um jogador parado
     * terminava a missao com o portao em 26%: nao havia como perder por omissao.
     * A medicao estava certa e o diagnostico errado. O que nao ameacava o portao
     * nao era a quantidade -- era a brecha esquerda, cujos invasores paravam na
     * quina e nunca batiam. Um terco da invasao era inerte contra o objetivo.
     *
     * Com a quina corrigida, 3 deixava o jogador sozinho em 0/5. De volta a 2,
     * medido: sozinho 1/5 com o portao em 45%, parado perde aos 244s, e quem
     * intercepta continua rendendo mais que quem espera no portao.
     */
    baseConcurrent: 2,
    /**
     * Invasores simultaneos a mais, por defensor efetivo alem do primeiro.
     *
     * Este e o numero que mais mexe no dano que o portao toma: o que passa da
     * capacidade do time de interceptar vai direto bater no objetivo.
     */
    maxConcurrentPerPlayer: 3.2,
    /** Teto absoluto, para a tela e a banda nao explodirem. */
    maxConcurrentCap: 20,
    /** Invasores que ja entram em campo no primeiro instante da missao. */
    openingSoldados: 2,
};
/**
 * Reanimacao de aliado caido.
 *
 * CLAUDE.md: jogador incapacitado pode ser reanimado. Exige proximidade e
 * tempo, entao socorrer e uma decisao tatica -- alguem para de lutar para isso.
 */
/**
 * Recuperacao fora de combate.
 *
 * Sem nenhuma forma de recuperar vida, uma missao de seis minutos e uma conta
 * fechada: todo dano e permanente, entao o time cai por acumulo, nao por erro.
 * Ate o Suporte existir com o Curativo, esta e a unica recuperacao do jogo.
 *
 * Lenta e condicionada a sair da briga de proposito: recuar vira uma decisao
 * tatica, e a calmaria do Director ganha funcao mecanica em vez de ser so
 * "menos inimigos". Nao substitui o Suporte, que curara rapido, com alvo e
 * dentro do combate.
 */
/**
 * Geometria da folha de sprites dos personagens.
 *
 * Fonte unica: a ferramenta que gera as folhas e o cliente que as desenha leem
 * daqui. Ja divergiram uma vez -- a folha saiu com quadro de 44x50 e o cliente
 * recortava 64x64, entao cada personagem aparecia com o vizinho da direita e a
 * cabeca da fileira de baixo coladas nele.
 *
 * Coluna 0 e a parada; 1 a 4 caminhada; 5 antecipacao, 6 impacto, 7 recuperacao.
 * As fileiras seguem `facings`. A folga acomoda armas durante os ataques.
 */
export const SPRITE_SHEET = {
    frameWidth: 112,
    frameHeight: 112,
    columns: 8,
    walkFrames: 4,
    attackStart: 5,
    attackFrames: 3,
    rows: 8,
    /**
     * Fileira em que os pes pousam dentro do quadro.
     *
     * O resto abaixo e folga. O cliente alinha por aqui para o personagem pisar
     * na sombra, que e o que marca a pegada real (VISUAL_BIBLE.md).
     */
    footRow: 98,
    /** Ordem das fileiras. O cliente indexa por esta ordem. */
    facings: ['south', 'east', 'north', 'west', 'southeast', 'northeast', 'northwest', 'southwest'],
};
/**
 * Fonte do patio.
 *
 * Existe porque a recuperacao passiva saiu e o Suporte so aparece a partir do
 * terceiro jogador: sem ela, um ou dois defensores nao teriam **nenhuma**
 * fonte de cura, e CLAUDE.md diz que a missao e para 1 a 6.
 *
 * Fica ao sul do portao, longe das brechas da muralha norte. Curar passa a ser
 * decisao de posicao -- largar a linha por alguns segundos -- e nao consequencia
 * de esperar parado. O Suporte continua muito melhor: ele cura onde voce esta.
 */
export const FOUNTAIN = {
    x: 800,
    y: 640,
    /** Raio de efeito. Generoso: achar a fonte nao e o desafio. */
    radius: 70,
};
export const REGEN = {
    /** Tempo sem levar dano antes de comecar a recuperar. */
    delayAfterDamageMs: 6_000,
    /**
     * HP por segundo depois desse tempo, **so sob o Estandarte**.
     *
     * Nao ha recuperacao passiva: quem se feriu depende do Suporte. Curar e
     * trabalho de alguem, nao consequencia de esperar -- e isso e o que faz o
     * Suporte valer uma vaga no time de seis.
     */
    perSecond: 5,
};
export const REVIVE = {
    durationMs: 2600,
    range: 48,
    /** Fracao do HP da classe com que o aliado volta: de pe, mas fragil. */
    restoredFraction: 0.4,
    /** Progresso perdido por segundo quando ninguem esta socorrendo. */
    decayPerSecond: 0.6,
};
export const LIMITS = {
    /** Mensagem maior que isso e descartada antes mesmo do parse. */
    maxMessageBytes: 2048,
    maxClientVersionLength: 32,
    maxInputSeq: 2 ** 31 - 1,
    reconnectTokenLength: 32,
};
/**
 * Portas padrao, compartilhadas porque o client precisa saber onde achar o
 * servidor sem que ninguem digite nada.
 *
 * Quando a pagina e servida pelo proprio game server, o socket esta na mesma
 * origem -- e uma URL so, um certificado so. Quando vem do servidor estatico
 * de desenvolvimento, o jogo esta no mesmo host, na porta do game server.
 */
export const NETWORK = {
    gamePort: 8080,
    /** Porta do servidor estatico de desenvolvimento (`pnpm dev:web`). */
    devWebPort: 8000,
};
export const RATE_LIMIT = {
    windowMs: 1000,
    /** input (30Hz) + ping + folga de jitter. */
    maxGameplayMessagesPerWindow: 60,
    /** create_room, join_room, set_ready, hello. */
    maxLobbyMessagesPerWindow: 10,
};
export const ERROR_CODE = {
    PROTOCOL_VERSION_MISMATCH: 'protocol_version_mismatch',
    INVALID_MESSAGE: 'invalid_message',
    MESSAGE_TOO_LARGE: 'message_too_large',
    RATE_LIMITED: 'rate_limited',
    NOT_AUTHENTICATED: 'not_authenticated',
    ALREADY_IN_ROOM: 'already_in_room',
    NOT_IN_ROOM: 'not_in_room',
    ROOM_NOT_FOUND: 'room_not_found',
    ROOM_FULL: 'room_full',
    ROOM_NOT_JOINABLE: 'room_not_joinable',
    INVALID_RECONNECT_TOKEN: 'invalid_reconnect_token',
    INTERNAL_ERROR: 'internal_error',
};
//# sourceMappingURL=constants.js.map