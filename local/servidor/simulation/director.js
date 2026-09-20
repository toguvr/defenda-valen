import { ARIETE, ARQUEIRO, BRUTO, CAPITAO, DIRECTOR, LANCEIRO, SOLDADO, } from '../../protocol/index.js';
export function createDirector() {
    return {
        // Comeca com orcamento para a leva de abertura: a missao nao comeca vazia.
        budget: DIRECTOR.soldadoThreatCost * DIRECTOR.openingSoldados,
        elapsedMs: 0,
        phase: { kind: 'assault', assaultIndex: 0 },
        spawned: 0,
        pendingKind: null,
    };
}
export function assaultDurationMs(index) {
    return DIRECTOR.firstAssaultMs + index * DIRECTOR.assaultGrowthMs;
}
export function lullDurationMs(index) {
    return Math.max(DIRECTOR.minLullMs, DIRECTOR.firstLullMs - index * DIRECTOR.lullShrinkMs);
}
/**
 * Em que fase a missao esta num dado instante.
 *
 * Calculado a partir do tempo decorrido, nao acumulado tick a tick: assim o
 * plano da missao e uma funcao pura do relogio e da para testar qualquer
 * instante sem simular ate la.
 */
export function phaseAt(elapsedMs) {
    let cursor = 0;
    let index = 0;
    // Missoes sao curtas; este laco anda poucas dezenas de vezes no pior caso.
    for (;;) {
        const assault = assaultDurationMs(index);
        if (elapsedMs < cursor + assault)
            return { kind: 'assault', assaultIndex: index };
        cursor += assault;
        const lull = lullDurationMs(index);
        if (elapsedMs < cursor + lull)
            return { kind: 'lull', assaultIndex: index };
        cursor += lull;
        index += 1;
    }
}
/**
 * Peso do time para efeito de ameaca.
 *
 * O primeiro defensor conta inteiro; cada um depois dele conta menos. Ver
 * `additionalDefenderWeight`.
 */
export function effectiveDefenders(defenderCount) {
    if (defenderCount <= 0)
        return 0;
    return 1 + (defenderCount - 1) * DIRECTOR.additionalDefenderWeight;
}
/** Ameaca gerada por segundo agora, dado o time em campo. */
export function threatPerSecond(phase, defenderCount) {
    if (defenderCount <= 0)
        return 0;
    const escalation = 1 + phase.assaultIndex * DIRECTOR.escalationPerAssault;
    const base = DIRECTOR.assaultThreatPerPlayer * effectiveDefenders(defenderCount) * escalation;
    return phase.kind === 'assault' ? base : base * DIRECTOR.lullThreatFactor;
}
/**
 * Teto de invasores simultaneos para o tamanho do time.
 *
 * Um piso baixo para quem joga sozinho, crescendo rapido a partir do segundo
 * defensor. Quantos invasores cabem em campo ao mesmo tempo e o que mais mexe
 * no risco do portao -- e tambem o que mais rapido torna a missao impossivel
 * para um jogador so, que nao tem com quem dividir a atencao.
 */
export function concurrentLimit(defenderCount) {
    const extra = Math.max(0, effectiveDefenders(defenderCount) - 1);
    return Math.min(DIRECTOR.maxConcurrentCap, DIRECTOR.baseConcurrent + Math.round(extra * DIRECTOR.maxConcurrentPerPlayer));
}
/**
 * Avanca o Director e devolve quantos invasores devem entrar neste tick.
 *
 * Nao gasta orcamento quando o campo esta cheio -- o excedente fica guardado e
 * sai assim que houver espaco, o que faz a pressao "represar" quando o time
 * nao esta dando conta de limpar.
 */
export function stepDirector(state, defenderCount, aliveInvaders, elapsedMs, random = Math.random) {
    state.elapsedMs += elapsedMs;
    state.phase = phaseAt(state.elapsedMs);
    state.budget += threatPerSecond(state.phase, defenderCount) * (elapsedMs / 1000);
    const limit = concurrentLimit(defenderCount);
    let room = Math.max(0, limit - aliveInvaders);
    const spawns = [];
    while (room > 0) {
        // Sorteia so quando nao ha compromisso pendente.
        const kind = state.pendingKind ?? pickEnemyKind(state.phase.assaultIndex, random(), defenderCount);
        state.pendingKind = kind;
        const cost = threatCostOf(kind);
        if (state.budget < cost)
            break;
        state.budget -= cost;
        state.pendingKind = null;
        spawns.push(kind);
        room -= 1;
    }
    // Teto de orcamento guardado: sem isso, um time que limpa devagar levaria
    // uma enxurrada impossivel no instante em que abre espaco.
    // Teto proporcional ao inimigo mais caro: sem isso, um Ariete nunca sairia.
    const reserveCap = ARIETE.threatCost * Math.max(2, limit);
    if (state.budget > reserveCap)
        state.budget = reserveCap;
    state.spawned += spawns.length;
    return spawns;
}
const THREAT_COST = {
    soldado: SOLDADO.threatCost,
    lanceiro: LANCEIRO.threatCost,
    arqueiro: ARQUEIRO.threatCost,
    bruto: BRUTO.threatCost,
    capitao: CAPITAO.threatCost,
    ariete: ARIETE.threatCost,
};
const EMPTY_COMPOSITION = {
    soldado: 1,
    lanceiro: 0,
    arqueiro: 0,
    bruto: 0,
    capitao: 0,
    ariete: 0,
};
/**
 * Pesos de composicao vigentes num dado assalto e tamanho de time.
 *
 * Os tipos que exigem coordenacao so entram quando ha time para coordenar.
 */
export function compositionFor(assaultIndex, defenderCount = Number.POSITIVE_INFINITY) {
    let current = { ...EMPTY_COMPOSITION };
    for (const entry of DIRECTOR.composition) {
        if (assaultIndex >= entry.fromAssault)
            current = { ...entry.weights };
    }
    for (const [kind, minimum] of Object.entries(DIRECTOR.minDefendersFor)) {
        if (defenderCount < minimum)
            current[kind] = 0;
    }
    return current;
}
/**
 * Sorteia o proximo invasor pela composicao do assalto atual.
 *
 * Sorteio, e nao rodizio fixo, para que o time nao decore a ordem -- CLAUDE.md
 * pede pressao e eventos, nao padrao memorizavel.
 */
export function pickEnemyKind(assaultIndex, random, defenderCount = Number.POSITIVE_INFINITY) {
    const weights = compositionFor(assaultIndex, defenderCount);
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    if (total <= 0)
        return 'soldado';
    let roll = random * total;
    for (const [kind, weight] of Object.entries(weights)) {
        roll -= weight;
        if (roll <= 0)
            return kind;
    }
    return 'soldado';
}
export function threatCostOf(kind) {
    return THREAT_COST[kind];
}
/** Fracao da missao ja cumprida, de 0 a 1. */
export function missionProgress(state) {
    return Math.min(1, state.elapsedMs / DIRECTOR.missionDurationMs);
}
export function missionComplete(state) {
    return state.elapsedMs >= DIRECTOR.missionDurationMs;
}
//# sourceMappingURL=director.js.map