import { encodeSnapshot, SIMULATION_TICK_MS, SNAPSHOT_INTERVAL_MS } from '../../protocol/index.js';
/**
 * Quantos ticks o loop aceita recuperar de uma vez.
 *
 * Sem esse teto, uma pausa longa do processo (GC, suspensao da maquina) faria
 * a simulacao "correr" para compensar e teleportar todo mundo.
 */
const MAX_CATCHUP_STEPS = 5;
/** Intervalo da limpeza de reconexoes vencidas e salas vazias. */
const SWEEP_INTERVAL_MS = 1000;
/**
 * Relogio do servidor.
 *
 * Um unico loop atende todas as salas do processo: simulacao em passo fixo e
 * snapshots numa frequencia menor, ambos configurados em @valen/protocol.
 */
export class SimulationLoop {
    deps;
    timer = null;
    previousTime;
    simulationDebt = 0;
    snapshotDebt = 0;
    sweepDebt = 0;
    constructor(deps) {
        this.deps = deps;
        this.previousTime = deps.now();
    }
    start() {
        if (this.timer !== null)
            return;
        this.previousTime = this.deps.now();
        // Acorda mais rapido que o tick para que o passo fixo nao acumule atraso.
        this.timer = setInterval(() => {
            this.advance(this.deps.now());
        }, Math.floor(SIMULATION_TICK_MS / 2));
        this.timer.unref?.();
    }
    stop() {
        if (this.timer === null)
            return;
        clearInterval(this.timer);
        this.timer = null;
    }
    /** Exposto para os testes conduzirem o tempo sem timers reais. */
    advance(now) {
        const elapsed = Math.max(0, now - this.previousTime);
        this.previousTime = now;
        this.simulationDebt += elapsed;
        this.snapshotDebt += elapsed;
        this.sweepDebt += elapsed;
        let steps = 0;
        while (this.simulationDebt >= SIMULATION_TICK_MS && steps < MAX_CATCHUP_STEPS) {
            this.stepRooms();
            this.simulationDebt -= SIMULATION_TICK_MS;
            steps += 1;
        }
        if (steps === MAX_CATCHUP_STEPS) {
            // Desistiu de recuperar: melhor perder tempo simulado que dar teleporte.
            this.simulationDebt = 0;
        }
        if (this.snapshotDebt >= SNAPSHOT_INTERVAL_MS) {
            this.snapshotDebt %= SNAPSHOT_INTERVAL_MS;
            this.sendSnapshots(now);
        }
        if (this.sweepDebt >= SWEEP_INTERVAL_MS) {
            this.sweepDebt %= SWEEP_INTERVAL_MS;
            this.sweep(now);
        }
    }
    stepRooms() {
        const now = this.deps.now();
        for (const room of this.deps.rooms.list()) {
            const wasPlaying = room.status === 'playing';
            const attacks = room.step();
            // Golpes vao fora do snapshot: sao eventos, nao estado. Se fossem
            // esperar o proximo snapshot, o retorno de acerto chegaria atrasado.
            for (const attack of attacks) {
                this.deps.handler.broadcast(room, {
                    type: 'combat_event',
                    tick: room.tick,
                    attackerId: attack.attackerId,
                    attackerTeam: attack.attackerTeam,
                    originX: attack.originX,
                    originY: attack.originY,
                    aimX: attack.aimX,
                    aimY: attack.aimY,
                    range: attack.range,
                    arcDegrees: attack.arcDegrees,
                    hits: attack.hits,
                });
            }
            // Impactos de flecha: evento proprio, para o client animar o acerto no
            // ponto exato em vez de deduzir do snapshot seguinte.
            for (const impact of room.takeProjectileImpacts()) {
                this.deps.handler.broadcast(room, {
                    type: 'projectile_hit',
                    tick: room.tick,
                    projectileId: impact.projectile.id,
                    attackerId: impact.projectile.ownerId,
                    attackerTeam: impact.projectile.team,
                    x: impact.x,
                    y: impact.y,
                    hits: impact.hits,
                    splashRadius: impact.projectile.splashRadius,
                });
            }
            for (const event of room.takeAbilityEvents()) {
                this.deps.handler.broadcast(room, {
                    type: 'ability_event',
                    tick: room.tick,
                    playerId: event.playerId,
                    abilityId: event.abilityId,
                    x: Math.round(event.x),
                    y: Math.round(event.y),
                    aimX: event.aimX,
                    aimY: event.aimY,
                    targetId: event.targetId,
                    hits: event.hits,
                });
            }
            for (const event of room.takeZoneEvents()) {
                this.deps.handler.broadcast(room, {
                    type: 'zone_event',
                    tick: room.tick,
                    zoneId: event.zone.id,
                    kind: event.zone.kind,
                    x: Math.round(event.zone.position.x),
                    y: Math.round(event.zone.position.y),
                    hits: event.hits,
                });
            }
            for (const event of room.takeSpecialEvents()) {
                this.deps.handler.broadcast(room, {
                    type: 'special_event',
                    tick: room.tick,
                    playerId: event.playerId,
                    specialId: event.specialId,
                    x: Math.round(event.x),
                    y: Math.round(event.y),
                    aimX: event.aimX,
                    aimY: event.aimY,
                    durationMs: event.durationMs,
                });
            }
            // Oferta vai so para quem escolhe: as opcoes sao dele.
            for (const offer of room.takeUpgradeOffers()) {
                this.deps.handler.sendTo(room, offer.playerId, {
                    type: 'upgrade_offer',
                    tick: room.tick,
                    level: offer.level,
                    options: offer.options,
                });
            }
            // A escolha, ao contrario, e do time saber: ela muda o que esperar
            // daquele aliado pelo resto da missao.
            for (const taken of room.takeUpgradesTaken()) {
                this.deps.handler.broadcast(room, {
                    type: 'upgrade_taken',
                    playerId: taken.playerId,
                    upgradeId: taken.upgradeId,
                });
            }
            // A sala sai de `playing` no mesmo tick em que a missao termina.
            if (wasPlaying && room.status === 'finished') {
                const ended = room.toMatchEnded(now);
                if (ended !== null) {
                    this.deps.logger.info('partida encerrada', {
                        roomCode: room.code,
                        outcome: ended.outcome,
                        reason: ended.reason,
                        invadersDefeated: ended.invadersDefeated,
                    });
                    this.deps.handler.broadcast(room, ended);
                    // Progressao permanente: melhor-esforco, fora do caminho do fim de
                    // partida. Perder o registro e ruim; travar a sala e pior.
                    void this.deps.handler.recordMission(room, ended.outcome === 'victory', ended.invadersDefeated);
                    this.deps.handler.broadcastLobbyState(room);
                }
            }
        }
    }
    sendSnapshots(now) {
        for (const room of this.deps.rooms.list()) {
            if (room.status !== 'playing')
                continue;
            for (const player of room.listPlayers()) {
                if (!player.connected)
                    continue;
                const connection = this.deps.handler.getConnectionByPlayerId(player.id);
                // Compactado no fio: e a maior fonte de banda do jogo, e o alvo e
                // celular. Ver `snapshot-wire.ts`.
                connection?.send(encodeSnapshot(room.toSnapshotFor(player.id, now)));
            }
        }
    }
    sweep(now) {
        const result = this.deps.rooms.sweep(now);
        for (const entry of result.expiredPlayers) {
            this.deps.logger.info('players removidos por janela de reconexao expirada', {
                roomCode: entry.roomCode,
                playerIds: entry.playerIds,
            });
            const room = this.deps.rooms.getByCode(entry.roomCode);
            if (room)
                this.deps.handler.broadcastLobbyState(room);
        }
        for (const roomCode of result.destroyedRoomCodes) {
            this.deps.logger.info('sala destruida', { roomCode });
        }
    }
}
//# sourceMappingURL=loop.js.map