import { ARENA, ARIETE, BREACH, openBreaches, ARQUEIRO, BRUTO, CAPITAO, LANCEIRO, SOLDADO, } from '../../protocol/index.js';
let nextEnemyNumber = 0;
function baseEnemy(params) {
    nextEnemyNumber += 1;
    return {
        id: `${params.kind}-${nextEnemyNumber}`,
        kind: params.kind,
        team: 'invaders',
        radius: params.radius,
        damagedByAllies: true,
        position: { ...params.position },
        // Entram pelo portao, virados para o patio.
        aim: { x: 0, y: 1 },
        health: params.maxHealth,
        maxHealth: params.maxHealth,
        speed: params.speed,
        engageRange: params.engageRange,
        ranged: params.ranged,
        objectiveOnly: params.objectiveOnly ?? false,
        commands: params.commands ?? false,
        led: false,
        markedMs: 0,
        combatState: 'ready',
        attackTimerMs: 0,
        attackCooldownMs: 0,
        attackAim: { x: 0, y: 1 },
        attack: params.attack,
        targetId: null,
        retargetTimerMs: 0,
        despawnTimerMs: params.despawnDelayMs,
        rootedMs: 0,
    };
}
export function createSoldado(position) {
    return baseEnemy({
        kind: 'soldado',
        position,
        radius: SOLDADO.radius,
        maxHealth: SOLDADO.maxHealth,
        speed: SOLDADO.speed,
        engageRange: SOLDADO.engageRange,
        attack: SOLDADO.attack,
        despawnDelayMs: SOLDADO.despawnDelayMs,
        ranged: false,
    });
}
export function createLanceiro(position) {
    return baseEnemy({
        kind: 'lanceiro',
        position,
        radius: LANCEIRO.radius,
        maxHealth: LANCEIRO.maxHealth,
        speed: LANCEIRO.speed,
        engageRange: LANCEIRO.engageRange,
        attack: LANCEIRO.attack,
        despawnDelayMs: LANCEIRO.despawnDelayMs,
        ranged: false,
    });
}
export function createArqueiro(position) {
    return baseEnemy({
        kind: 'arqueiro',
        position,
        radius: ARQUEIRO.radius,
        maxHealth: ARQUEIRO.maxHealth,
        speed: ARQUEIRO.speed,
        engageRange: ARQUEIRO.preferredRange,
        // O arco tem perfil proprio; o alcance aqui e o do tiro.
        attack: {
            damage: ARQUEIRO.shot.damage,
            range: ARQUEIRO.shot.maxRange,
            arcDegrees: 12,
            windupMs: ARQUEIRO.shot.windupMs,
            recoveryMs: ARQUEIRO.shot.recoveryMs,
            cooldownMs: ARQUEIRO.shot.cooldownMs,
        },
        despawnDelayMs: ARQUEIRO.despawnDelayMs,
        ranged: true,
    });
}
export function createBruto(position) {
    return baseEnemy({
        kind: 'bruto',
        position,
        radius: BRUTO.radius,
        maxHealth: BRUTO.maxHealth,
        speed: BRUTO.speed,
        engageRange: BRUTO.engageRange,
        attack: BRUTO.attack,
        despawnDelayMs: BRUTO.despawnDelayMs,
        ranged: false,
    });
}
export function createCapitao(position) {
    return baseEnemy({
        kind: 'capitao',
        position,
        radius: CAPITAO.radius,
        maxHealth: CAPITAO.maxHealth,
        speed: CAPITAO.speed,
        engageRange: CAPITAO.engageRange,
        attack: CAPITAO.attack,
        despawnDelayMs: CAPITAO.despawnDelayMs,
        ranged: false,
        commands: true,
    });
}
export function createAriete(position) {
    return baseEnemy({
        kind: 'ariete',
        position,
        radius: ARIETE.radius,
        maxHealth: ARIETE.maxHealth,
        speed: ARIETE.speed,
        engageRange: ARIETE.engageRange,
        attack: ARIETE.attack,
        despawnDelayMs: ARIETE.despawnDelayMs,
        ranged: false,
        objectiveOnly: true,
    });
}
export function createEnemy(kind, position) {
    switch (kind) {
        case 'lanceiro':
            return createLanceiro(position);
        case 'arqueiro':
            return createArqueiro(position);
        case 'bruto':
            return createBruto(position);
        case 'capitao':
            return createCapitao(position);
        case 'ariete':
            return createAriete(position);
        default:
            return createSoldado(position);
    }
}
/**
 * Brechas na muralha norte, em fracao da largura da arena.
 *
 * Tres rotas afastadas, nao uma. CLAUDE.md pede multiplas rotas convergindo
 * para o portao, e a razao e de jogo: com uma entrada so, um time pequeno
 * tapa tudo e o objetivo nunca corre risco. Com tres, cobrir todas exige
 * dividir o time -- e dividir e a decisao.
 */
/**
 * Ponto de entrada de uma brecha, ja dentro da arena.
 *
 * `lane` afasta invasores da mesma brecha para que nao nascam empilhados --
 * ao longo da parede, entao o eixo depende do lado.
 */
function breachPoint(breach, lane) {
    const margin = ARENA.wallThickness + SOLDADO.radius + BREACH.inset;
    const spread = 56;
    const offset = lane * spread;
    switch (breach.side) {
        case 'south':
            return { x: ARENA.width * breach.at + offset, y: ARENA.height - margin };
        case 'west':
            return { x: margin, y: ARENA.height * breach.at + offset };
        case 'east':
            return { x: ARENA.width - margin, y: ARENA.height * breach.at + offset };
        default:
            return { x: ARENA.width * breach.at + offset, y: margin };
    }
}
/**
 * Pontos de entrada da invasao, distribuidos pelas brechas **abertas**.
 *
 * Quais estao abertas depende do degrau da invasao: a muralha vai cedendo, e
 * com ela a direcao de onde o ataque vem.
 */
export function gateSpawnPoints(count, assaultIndex = 0, defenderCount = 1) {
    const open = openBreaches(assaultIndex, defenderCount);
    const points = [];
    // Nunca menos pontos que brechas abertas.
    //
    // O numero de pontos era fixo em cinco e as brechas eram percorridas em
    // ciclo, entao a sexta -- a do sul, a ultima a abrir -- nunca recebia ponto
    // nenhum: a muralha cedia na tela e ninguem entrava por ali. Passava
    // despercebido porque os testes pediam pontos de sobra.
    const total = Math.max(count, open.length);
    for (let index = 0; index < total; index += 1) {
        const breach = open[index % open.length];
        if (!breach)
            continue;
        points.push(breachPoint(breach, Math.floor(index / open.length) - 1));
    }
    return points;
}
export function isDown(enemy) {
    return enemy.combatState === 'incapacitated';
}
//# sourceMappingURL=enemy.js.map