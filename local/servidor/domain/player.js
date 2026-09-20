import { ARENA, CLASSES, DEFAULT_CLASS, INPUT, GATE, PLAYER, ROOM, } from '../../protocol/index.js';
import { clamp } from './vector.js';
export function createPlayerState(params) {
    return {
        id: params.id,
        name: params.name,
        slot: params.slot,
        reconnectToken: params.reconnectToken,
        ready: false,
        connected: true,
        disconnectedAt: null,
        team: 'defenders',
        classId: DEFAULT_CLASS,
        maxHealth: CLASSES[DEFAULT_CLASS].maxHealth,
        radius: PLAYER.radius,
        damagedByAllies: true,
        position: spawnPointForSlot(params.slot),
        aim: { x: 0, y: 1 },
        health: CLASSES[DEFAULT_CLASS].maxHealth,
        combatState: 'ready',
        attackTimerMs: 0,
        attackCooldownMs: 0,
        attackAim: { x: 0, y: 1 },
        attack: CLASSES[DEFAULT_CLASS].attack,
        interacting: false,
        wasInteracting: false,
        operatingId: null,
        upgrades: [],
        pendingOffers: [],
        msSinceDamage: Number.POSITIVE_INFINITY,
        abilityHeld: false,
        abilityActive: false,
        healChannelMs: 0,
        movedByInput: false,
        abilityCooldownMs: 0,
        specialActiveMs: 0,
        specialCooldownMs: 0,
        sheltered: false,
        shelterOwnerId: null,
        rootedMs: 0,
        healTargetId: null,
        reviveProgress: 0,
        inputQueue: [],
        lastProcessedInputSeq: 0,
    };
}
/**
 * Spawns no patio, em linha diante do portao.
 *
 * Centrados no objetivo de proposito: numa missao sobre defender o portao, o
 * time precisa comecar de frente para ele, nao espalhado pelo mapa.
 *
 * Posicao provisoria do slice tecnico: quando o mapa da Fortaleza de Valen
 * existir, os pontos vem do mapa, nao de um calculo.
 */
export function spawnPointForSlot(slot) {
    const spacing = 76;
    // Alterna em torno do centro (0, +1, -1, +2, -2, ...) para que o primeiro
    // slot fique de frente para o portao. Um jogador sozinho comeca encarando
    // o objetivo, nao na ponta de uma fila.
    const step = Math.ceil(slot / 2);
    const offset = step * spacing * (slot % 2 === 1 ? 1 : -1);
    return {
        x: clamp(GATE.x + offset, PLAYER.radius, ARENA.width - PLAYER.radius),
        // Atras do portao, de frente para a brecha: o objetivo cabe na tela desde
        // o primeiro frame, e o primeiro passo em direcao a linha e uma escolha.
        y: GATE.y + 170,
    };
}
/**
 * Enfileira um comando de input.
 *
 * Descarta comandos fora de ordem (rede UDP-like nao se aplica aqui, mas
 * reenvio duplicado sim) e limita a fila para que flood nao vire vantagem.
 */
export function enqueueInput(player, command) {
    const lastQueued = player.inputQueue.at(-1);
    const lastSeq = lastQueued?.seq ?? player.lastProcessedInputSeq;
    if (command.seq <= lastSeq)
        return false;
    player.inputQueue.push(command);
    if (player.inputQueue.length > INPUT.maxQueuedInputs) {
        player.inputQueue.splice(0, player.inputQueue.length - INPUT.maxQueuedInputs);
    }
    return true;
}
/**
 * Aplica a classe escolhida.
 *
 * So no lobby: trocar de classe no meio da partida mudaria HP e alcance sob
 * os pes do time.
 */
export function applyClass(player, classId) {
    const profile = CLASSES[classId];
    player.classId = classId;
    player.maxHealth = profile.maxHealth;
    player.health = profile.maxHealth;
    player.attack = profile.attack;
}
/** Volta o personagem ao estado inicial de combate, no comeco da partida. */
export function resetCombat(player) {
    player.health = player.maxHealth;
    player.combatState = 'ready';
    player.attackTimerMs = 0;
    player.attackCooldownMs = 0;
    player.attackAim = { ...player.aim };
    player.interacting = false;
    player.wasInteracting = false;
    player.operatingId = null;
    // Progressao de partida nao sobrevive a partida.
    player.upgrades = [];
    player.pendingOffers = [];
    player.msSinceDamage = Number.POSITIVE_INFINITY;
    player.abilityHeld = false;
    player.abilityActive = false;
    player.healChannelMs = 0;
    player.movedByInput = false;
    player.abilityCooldownMs = 0;
    player.specialActiveMs = 0;
    player.specialCooldownMs = 0;
    player.sheltered = false;
    player.shelterOwnerId = null;
    player.anchored = false;
    player.rootedMs = 0;
    player.healTargetId = null;
    player.reviveProgress = 0;
}
export function isReconnectWindowExpired(player, now) {
    if (player.connected || player.disconnectedAt === null)
        return false;
    return now - player.disconnectedAt > ROOM.reconnectWindowMs;
}
//# sourceMappingURL=player.js.map