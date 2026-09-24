import { ARENA, CACADA, firesProjectile, LOOT, weaponById, weaponFor, REVIVE, CLASSES, DEFAULT_DIFFICULTY, COMBAT, ZONE, STRUCTURE, BARRICADA, INPUT, PLAYER, DIRECTOR, ROOM, SIMULATION_TICK_MS, } from '../../protocol/index.js';
import { applyClass, applyWeapon, createPlayerState, isReconnectWindowExpired, resetCombat, spawnPointForSlot, } from './player.js';
import { positionForWire, roundForWire, seededStream } from './vector.js';
import { stepPlayer } from '../simulation/movement.js';
import { beginAttack, canMove, stepCombat } from '../simulation/combat.js';
import { resolveOverlaps } from '../simulation/separation.js';
import { requestSpecial, specialSpeedFactor, stepSpecial, } from '../simulation/special.js';
import { createEnemy, gateSpawnPoints } from './enemy.js';
import { applyCommand, createArrowFor, stepDespawn, stepInvader } from '../simulation/enemy-ai.js';
import { ignite, isExpired, isFlammable, stepZones, zoneSpeedFactor, } from '../simulation/zone.js';
import { hasRoomFor, isGone, toSnapshot as structureToSnapshot, } from './structure.js';
import { resolveStructureCollisions } from '../simulation/collision.js';
import { createGroundItem, PICKUP_RANGE, toSnapshot as groundToSnapshot, } from './ground-item.js';
import { stepBanners } from '../simulation/banner.js';
import { addXp, createProgression, takeUpgrade, thresholdFor, xpFor, } from '../simulation/progression.js';
import { fireBolt, isOperating, stepSiegeUse, stepSiegeWeapons } from '../simulation/siege.js';
import { createCompanion, hasLeft, resetCompanion, toSnapshot as companionToSnapshot, } from './companion.js';
import { resolveCommand, stepCompanion } from '../simulation/companion-ai.js';
import { canSpawnProjectile, createProjectile, stepProjectiles, } from '../simulation/projectile.js';
import { stepRevives } from '../simulation/revive.js';
import { stepRegen } from '../simulation/regen.js';
import { blocksAttack, requestAbility, stepAbilityCooldown, stepHeal, } from '../simulation/ability.js';
import { createGate, toSnapshot as gateToSnapshot } from './gate.js';
import { evaluateMatch } from '../simulation/match-end.js';
import { createDirector, missionProgress, stepDirector, } from '../simulation/director.js';
/** Pontos de entrada da invasao ao longo do portao. */
const SPAWN_POINT_COUNT = 5;
/**
 * Sala em memoria.
 *
 * Nao conhece WebSocket nem serializacao de rede: recebe intencao ja validada
 * e expoe estado. Isso mantem as regras testaveis sem subir servidor.
 */
export class Room {
    id;
    code;
    createdAt;
    status = 'lobby';
    hostPlayerId = null;
    /**
     * Dificuldade escolhida no lobby, pelo anfitriao.
     *
     * Vive na sala e nao no jogador: a missao e uma so, e o time inteiro joga a
     * mesma. Fica travada quando a partida comeca -- mudar a pressao no meio da
     * briga seria mudar a regra durante a jogada.
     */
    difficulty = DEFAULT_DIFFICULTY;
    /** Armas largadas no chao. */
    ground = [];
    startedAt = null;
    tick = 0;
    players = new Map();
    enemies = new Map();
    gate = createGate();
    projectiles = [];
    zones = [];
    structures = [];
    /** Indexado pelo id do cao, nao do dono: a matilha tem varios por Mestre. */
    companions = new Map();
    director = createDirector();
    invadersDefeated = 0;
    /**
     * Abates por jogador, para o placar de fim.
     *
     * Em mapa, e nao no `PlayerState`: quem cai da conexao no ultimo minuto
     * continua no placar. O que ele fez aconteceu.
     */
    defeatsByPlayer = new Map();
    progression = createProgression();
    upgradeOffers = [];
    upgradesTaken = [];
    lastImpacts = [];
    abilityEvents = [];
    specialEvents = [];
    zoneEvents = [];
    /** Resultado da missao, preenchido quando a partida termina. */
    result = null;
    /** Momento em que a sala ficou sem nenhum player conectado. */
    emptySince;
    /**
     * `random` e injetavel para que a simulacao de missao seja reproduzivel.
     * Sem isso, duas execucoes identicas dao resultados diferentes e os numeros
     * de equilibrio viram ruido.
     */
    constructor(params) {
        this.id = params.id;
        this.code = params.code;
        this.createdAt = params.now;
        this.emptySince = params.now;
        this.random = params.random ?? Math.random;
        // Fluxo proprio, semeado pela sala: sortear melhoria nao pode deslocar a
        // sequencia do Director. Ver `seededStream`.
        this.progressionRandom = seededStream(`${params.code}:progressao`);
    }
    random;
    progressionRandom;
    get playerCount() {
        return this.players.size;
    }
    get connectedPlayerCount() {
        let total = 0;
        for (const player of this.players.values()) {
            if (player.connected)
                total += 1;
        }
        return total;
    }
    getPlayer(playerId) {
        return this.players.get(playerId);
    }
    listPlayers() {
        return [...this.players.values()].sort((a, b) => a.slot - b.slot);
    }
    listEnemies() {
        return [...this.enemies.values()];
    }
    /** Todo mundo que ocupa espaco e pode ser atingido. */
    listCombatants() {
        return [...this.listPlayers(), ...this.listEnemies(), ...this.companions.values()];
    }
    listCompanions() {
        return [...this.companions.values()];
    }
    listStructures() {
        return [...this.structures];
    }
    listZones() {
        return [...this.zones];
    }
    listProjectiles() {
        return [...this.projectiles];
    }
    /**
     * Garante um cao para cada Mestre dos Caes em campo, e nenhum a mais.
     *
     * Chamado no inicio da partida: trocar de classe so vale no lobby, entao a
     * lista nao muda no meio da missao.
     */
    syncCompanions() {
        // A matilha nao sobrevive ao reinicio: ela e um momento, nao um estado.
        for (const companion of [...this.companions.values()]) {
            if (companion.leavesInMs !== null)
                this.companions.delete(companion.id);
        }
        const handlers = new Set(this.listPlayers()
            .filter((player) => CLASSES[player.classId].ability.id === 'comandar_cao')
            .map((player) => player.id));
        for (const companion of [...this.companions.values()]) {
            if (!handlers.has(companion.ownerId))
                this.companions.delete(companion.id);
        }
        for (const player of this.listPlayers()) {
            if (!handlers.has(player.id))
                continue;
            const spot = { x: player.position.x + 40, y: player.position.y + 24 };
            const existing = this.companionOf(player.id);
            if (existing) {
                resetCompanion(existing, spot);
                continue;
            }
            const companion = createCompanion(player.id, spot);
            this.companions.set(companion.id, companion);
        }
    }
    /** O companheiro permanente deste jogador. A matilha nao entra aqui. */
    companionOf(playerId) {
        for (const companion of this.companions.values()) {
            if (companion.ownerId === playerId && companion.leavesInMs === null)
                return companion;
        }
        return undefined;
    }
    /** Alvos de golpe: combatentes mais as estruturas. */
    listTargets() {
        return [...this.listCombatants(), this.gate, ...this.structures];
    }
    getGate() {
        return this.gate;
    }
    getResult() {
        return this.result;
    }
    getDirector() {
        return this.director;
    }
    /**
     * Inicia o golpe de um jogador. Mesmo caminho que o handler de rede usa,
     * exposto para que testes e simulacao nao precisem falar WebSocket.
     */
    requestAttack(playerId, aim) {
        const player = this.players.get(playerId);
        if (!player || this.status !== 'playing')
            return false;
        // Quem esta curando tem as maos ocupadas.
        if (blocksAttack(player))
            return false;
        // Na balista, o golpe da classe da lugar ao virote.
        const weapon = this.structures.find((structure) => structure.id === player.operatingId);
        if (weapon) {
            const bolt = fireBolt(player, weapon, aim);
            if (bolt && canSpawnProjectile(this.projectiles.length))
                this.projectiles.push(bolt);
            return true;
        }
        return beginAttack(player, aim);
    }
    isFull() {
        return this.players.size >= ROOM.maxPlayers;
    }
    /**
     * Entrada na sala.
     *
     * Com `reconnectToken` valido o player reassume o proprio slot, inclusive
     * com a partida em andamento. Sem token, so entra em lobby e com vaga.
     */
    join(params) {
        if (params.existingToken !== undefined) {
            const existing = this.findByReconnectToken(params.existingToken, params.now);
            if (existing) {
                existing.connected = true;
                existing.disconnectedAt = null;
                existing.name = params.name;
                existing.inputQueue.length = 0;
                this.emptySince = null;
                if (this.hostPlayerId === null)
                    this.hostPlayerId = existing.id;
                return { ok: true, player: existing, reconnected: true };
            }
        }
        if (this.status !== 'lobby')
            return { ok: false, reason: 'room_not_joinable' };
        if (this.isFull())
            return { ok: false, reason: 'room_full' };
        const player = createPlayerState({
            id: params.playerId,
            name: params.name,
            slot: this.nextFreeSlot(),
            reconnectToken: params.reconnectToken,
        });
        this.players.set(player.id, player);
        this.emptySince = null;
        if (this.hostPlayerId === null)
            this.hostPlayerId = player.id;
        return { ok: true, player, reconnected: false };
    }
    /** Queda de conexao: o slot e mantido durante a janela de reconexao. */
    markDisconnected(playerId, now) {
        const player = this.players.get(playerId);
        if (!player)
            return;
        player.connected = false;
        player.disconnectedAt = now;
        player.ready = false;
        player.inputQueue.length = 0;
        this.refreshHost();
        if (this.connectedPlayerCount === 0)
            this.emptySince = now;
    }
    removePlayer(playerId) {
        const removed = this.players.delete(playerId);
        if (removed) {
            this.refreshHost();
        }
        return removed;
    }
    /** Escolha de classe. So vale no lobby. */
    selectClass(playerId, classId) {
        const player = this.players.get(playerId);
        if (!player || this.status !== 'lobby')
            return false;
        applyClass(player, classId);
        return true;
    }
    setReady(playerId, ready) {
        const player = this.players.get(playerId);
        if (!player || this.status !== 'lobby')
            return false;
        player.ready = ready;
        return true;
    }
    /** Partida comeca quando todos os conectados estao prontos. */
    shouldStartMatch() {
        if (this.status !== 'lobby')
            return false;
        if (this.connectedPlayerCount === 0)
            return false;
        return this.listPlayers().every((player) => !player.connected || player.ready);
    }
    startMatch(now) {
        if (this.status !== 'lobby')
            return;
        this.status = 'playing';
        this.startedAt = now;
        this.tick = 0;
        for (const player of this.players.values()) {
            player.position = spawnPointForSlot(player.slot);
            player.inputQueue.length = 0;
            player.lastProcessedInputSeq = 0;
            resetCombat(player);
        }
        this.syncCompanions();
        this.gate = createGate();
        this.projectiles = [];
        this.zones = [];
        this.structures = [];
        this.lastImpacts = [];
        this.abilityEvents = [];
        this.specialEvents = [];
        this.zoneEvents = [];
        this.director = createDirector();
        this.invadersDefeated = 0;
        this.defeatsByPlayer.clear();
        this.progression = createProgression();
        this.upgradeOffers = [];
        this.ground.length = 0;
        this.upgradesTaken = [];
        this.result = null;
        this.enemies.clear();
    }
    /**
     * Coloca em campo os invasores que o Director liberou.
     *
     * Os pontos de entrada sao fixos ao longo do portao; alternar entre eles
     * evita que a invasao vire uma fila por um unico ponto.
     */
    spawnInvaders(kinds, defenderCount) {
        if (kinds.length === 0)
            return;
        const points = gateSpawnPoints(SPAWN_POINT_COUNT, this.director.phase.assaultIndex, defenderCount);
        for (let index = 0; index < kinds.length; index += 1) {
            const point = points[(this.director.spawned + index) % points.length];
            const kind = kinds[index];
            if (!point || !kind)
                continue;
            const enemy = createEnemy(kind, point);
            this.enemies.set(enemy.id, enemy);
        }
    }
    /**
     * Um passo de simulacao: combate e movimento.
     *
     * Devolve os golpes que sairam neste tick, para quem chama transmitir.
     * Combate roda antes do movimento para que o arco use a posicao em que o
     * atacante estava quando o golpe foi anunciado, nao a de depois.
     */
    step() {
        if (this.status !== 'playing')
            return [];
        this.tick += 1;
        const players = this.listPlayers();
        const defenders = [...players, ...this.companions.values()];
        const combatants = this.listCombatants();
        const targets = this.listTargets();
        const attacks = [];
        // O Director decide a pressao antes de tudo: quem entra agora ja age
        // neste tick.
        const connected = players.filter((player) => player.connected).length;
        this.spawnInvaders(stepDirector(this.director, connected, this.listEnemies().filter((enemy) => enemy.combatState !== 'incapacitated').length, SIMULATION_TICK_MS, this.random, this.difficulty), connected);
        // Quem esta sob o Estandarte e decidido antes do combate: a reducao de
        // dano tem que valer para os golpes deste mesmo tick.
        stepBanners(players, this.structures);
        // Quem assume a arma decide antes do combate: o tiro sai neste tick.
        // Borda de subida da interacao, uma vez por tick e para todos os que a
        // consomem: balista e chao.
        for (const player of players) {
            player.interactPressed = player.interacting && !player.wasInteracting;
            player.wasInteracting = player.interacting;
        }
        stepSiegeUse(players, this.structures);
        stepSiegeWeapons(this.structures, players, SIMULATION_TICK_MS);
        // Decisao dos invasores antes do combate: mira e avanco entram no mesmo
        // tick em que o golpe pode sair.
        // O comando do Capitao vale para as decisoes deste tick.
        applyCommand(this.listEnemies());
        for (const enemy of this.listEnemies()) {
            if (enemy.markedMs > 0) {
                enemy.markedMs = Math.max(0, enemy.markedMs - SIMULATION_TICK_MS);
            }
            if (enemy.rootedMs > 0) {
                enemy.rootedMs = Math.max(0, enemy.rootedMs - SIMULATION_TICK_MS);
                continue;
            }
            // O cao entra na lista de alvos: quem se poe na frente e atendido.
            stepInvader(enemy, defenders, this.gate, SIMULATION_TICK_MS, zoneSpeedFactor(this.zones, enemy), this.structures);
        }
        for (const combatant of combatants) {
            const attack = stepCombat(combatant, targets, SIMULATION_TICK_MS);
            if (attack === null)
                continue;
            // Quem luta a distancia nao resolve arco: o golpe vira projetil.
            const shooter = this.enemies.get(combatant.id);
            if (shooter?.ranged) {
                if (canSpawnProjectile(this.projectiles.length)) {
                    this.projectiles.push(createArrowFor(shooter));
                }
                continue;
            }
            const defender = this.players.get(combatant.id);
            const profile = defender ? CLASSES[defender.classId] : null;
            // Maos vazias nao atiram: sem o arco na mao, o Arqueiro soca.
            if (defender &&
                profile?.attackKind === 'projectile' &&
                profile.projectile &&
                firesProjectile(defender.classId, defender.weaponId)) {
                if (canSpawnProjectile(this.projectiles.length)) {
                    this.projectiles.push(createProjectile({
                        ownerId: defender.id,
                        team: defender.team,
                        origin: {
                            x: defender.position.x + defender.attackAim.x * (defender.radius + 6),
                            y: defender.position.y + defender.attackAim.y * (defender.radius + 6),
                        },
                        direction: defender.attackAim,
                        speed: profile.projectile.speed,
                        maxRange: profile.projectile.maxRange,
                        radius: profile.projectile.radius,
                        damage: profile.attack.damage,
                        splashRadius: profile.projectile.splashRadius,
                    }));
                }
                continue;
            }
            attacks.push(attack);
            this.countDefeated(attack.hits, attack.attackerId);
        }
        this.lastImpacts = stepProjectiles(this.projectiles, targets, SIMULATION_TICK_MS);
        if (this.lastImpacts.length > 0) {
            const spent = new Set(this.lastImpacts.map((impact) => impact.projectile.id));
            this.projectiles = this.projectiles.filter((projectile) => !spent.has(projectile.id));
            for (const impact of this.lastImpacts) {
                this.countDefeated(impact.hits, impact.projectile.ownerId);
            }
        }
        for (const player of players) {
            if (!canMove(player) || player.rootedMs > 0 || isOperating(player)) {
                // Golpear, cair, ficar preso ou estar na manivela impede andar.
                player.inputQueue.length = 0;
                continue;
            }
            stepPlayer(player, INPUT.stepSeconds, INPUT.maxInputsPerTick, zoneSpeedFactor(this.zones, player) * specialSpeedFactor(player));
        }
        for (const player of players)
            stepAbilityCooldown(player, SIMULATION_TICK_MS);
        for (const player of players)
            stepSpecial(player, SIMULATION_TICK_MS);
        this.abilityEvents.push(...stepHeal(players, SIMULATION_TICK_MS));
        // Zonas agem antes do movimento: quem pisou na armadilha neste tick ja
        // fica preso neste tick.
        for (const trigger of stepZones(this.zones, targets, SIMULATION_TICK_MS)) {
            this.countDefeated(trigger.hits, trigger.zone.ownerId);
            this.zoneEvents.push(trigger);
        }
        this.zones = this.zones.filter((zone) => !isExpired(zone));
        for (const structure of this.structures)
            structure.remainingMs -= SIMULATION_TICK_MS;
        this.structures = this.structures.filter((structure) => !isGone(structure));
        for (const companion of this.companions.values()) {
            if (companion.leavesInMs !== null) {
                companion.leavesInMs = Math.max(0, companion.leavesInMs - SIMULATION_TICK_MS);
            }
            stepCompanion(companion, this.players.get(companion.ownerId), this.listEnemies(), players, SIMULATION_TICK_MS, zoneSpeedFactor(this.zones, companion));
        }
        // Cao chamado que cumpriu o tempo vai embora.
        for (const companion of [...this.companions.values()]) {
            if (hasLeft(companion))
                this.companions.delete(companion.id);
        }
        this.stepGround(players);
        stepRevives(players, SIMULATION_TICK_MS);
        stepRegen(players, SIMULATION_TICK_MS);
        resolveOverlaps(combatants);
        // Estruturas sao solidas: empurrao completo, nao deslize.
        resolveStructureCollisions(combatants, this.structures);
        this.sweepDefeatedEnemies();
        this.evaluateEnd();
        return attacks;
    }
    /**
     * O que o invasor derrubado deixa no chao.
     *
     * Quem cai melhor armado deixa melhor arma: o degrau sai do tipo do
     * invasor, nao de sorteio. Derrubar um Capitao tem que valer mais que
     * limpar Soldados, e isso precisa ser previsivel olhando a tela -- senao a
     * escolha de alvo vira loteria em vez de decisao.
     *
     * Nada cai para quem nao ganharia nada com aquilo. Sem esse filtro o patio
     * viraria um tapete de ferro inutil numa missao de seis minutos, e a arma
     * que interessa se perderia no meio.
     */
    rollLoot(enemyId) {
        const enemy = enemyId ? this.enemies.get(enemyId) : undefined;
        if (!enemy)
            return;
        const drop = LOOT[enemy.kind];
        const players = this.listPlayers();
        // Enquanto alguem estiver de maos vazias, todo invasor deixa arma.
        //
        // Sem isto o comeco e um beco: de maos vazias sao quinze golpes para
        // derrubar um Soldado, e se ainda houver sorteio depois disso o time
        // passa metade da missao socando. O primeiro ferro vem de quem veio
        // derrubar o portao, e vem sempre.
        const armando = players.some((player) => player.weaponId === null);
        if (!armando && this.random() > drop.chance)
            return;
        const wanted = players.filter((player) => {
            if (player.weaponId === null)
                return true;
            const held = weaponById(player.weaponId);
            // Segurando a arma de outro, ou uma pior que a que caiu.
            return held === null || held.classId !== player.classId || held.tier < drop.tier;
        });
        if (wanted.length === 0)
            return;
        const lucky = wanted[Math.floor(this.random() * wanted.length) % wanted.length];
        if (!lucky)
            return;
        this.ground.push(createGroundItem(weaponFor(lucky.classId, drop.tier).id, enemy.position));
    }
    /**
     * Interacao com o chao: pegar o que esta ali, ou largar o que esta na mao.
     *
     * Um verbo so, e contextual, porque CLAUDE.md pede poucos comandos. A
     * ordem e a de urgencia: socorrer e abrir caixa ja tem prioridade antes
     * disto; aqui, se ha arma ao alcance, pega; senao larga o que carrega.
     */
    stepGround(players) {
        for (const item of this.ground) {
            item.lockedMs = Math.max(0, item.lockedMs - SIMULATION_TICK_MS);
        }
        for (const player of players) {
            // Borda de subida: segurar o botao nao fica pegando e largando em loop.
            if (!player.interactPressed || player.combatState === 'incapacitated')
                continue;
            if (this.downedAllyNear(player))
                continue;
            const index = this.ground.findIndex((item) => item.lockedMs <= 0 &&
                Math.hypot(item.position.x - player.position.x, item.position.y - player.position.y) <= PICKUP_RANGE);
            if (index >= 0) {
                const item = this.ground[index];
                const held = player.weaponId;
                this.ground.splice(index, 1);
                applyWeapon(player, item.weaponId);
                // Troca: o que estava na mao fica no lugar do que foi pego.
                if (held !== null)
                    this.ground.push(createGroundItem(held, player.position));
                continue;
            }
            if (player.weaponId !== null) {
                this.ground.push(createGroundItem(player.weaponId, player.position));
                applyWeapon(player, null);
            }
        }
    }
    /** Aliado caido ao alcance de socorro: tem prioridade sobre o chao. */
    downedAllyNear(player) {
        return this.listPlayers().some((other) => other.id !== player.id &&
            other.combatState === 'incapacitated' &&
            Math.hypot(other.position.x - player.position.x, other.position.y - player.position.y) <= REVIVE.range);
    }
    /**
     * Fecha a partida quando alguma condicao e atingida.
     *
     * Avaliado depois de tudo do tick, para que o resultado reflita o estado
     * final e nao um instante intermediario.
     */
    evaluateEnd() {
        if (this.result !== null)
            return;
        const result = evaluateMatch(this.gate, this.listPlayers(), this.director);
        if (result === null)
            return;
        this.result = result;
        this.status = 'finished';
    }
    /** Mensagem de fim de partida. Null enquanto a missao nao terminou. */
    toMatchEnded(now) {
        if (this.result === null)
            return null;
        return {
            type: 'match_ended',
            outcome: this.result.outcome,
            reason: this.result.reason,
            durationMs: now - (this.startedAt ?? now),
            missionDurationMs: DIRECTOR.missionDurationMs,
            invadersDefeated: this.invadersDefeated,
            // Ordenado do maior para o menor: o placar ja chega pronto para desenhar.
            scoreboard: this.listPlayers()
                .map((player) => ({
                playerId: player.id,
                name: player.name,
                classId: player.classId,
                defeats: this.defeatsByPlayer.get(player.id) ?? 0,
            }))
                .sort((a, b) => b.defeats - a.defeats),
            gateHealth: this.gate.health,
            gateMaxHealth: this.gate.maxHealth,
        };
    }
    /**
     * Quem leva o credito de um abate.
     *
     * O cao nao entra no placar por si: o abate dele e do dono. Ter uma linha
     * "Cao de Augusto" ao lado da do proprio Augusto contaria a mesma coisa
     * duas vezes e faria a classe parecer dois jogadores.
     */
    creditFor(attackerId) {
        if (attackerId === null)
            return null;
        if (this.players.has(attackerId))
            return attackerId;
        return this.companions.get(attackerId)?.ownerId ?? null;
    }
    countDefeated(hits, attackerId = null) {
        let xp = 0;
        const credit = this.creditFor(attackerId);
        for (const hit of hits) {
            if (!hit.incapacitated || hit.targetTeam !== 'invaders')
                continue;
            this.invadersDefeated += 1;
            if (credit !== null) {
                this.defeatsByPlayer.set(credit, (this.defeatsByPlayer.get(credit) ?? 0) + 1);
            }
            this.rollLoot(hit.targetId);
            // XP do time, por tipo: o que ameaca mais vale mais.
            const kind = hit.targetId ? this.enemies.get(hit.targetId)?.kind : undefined;
            xp += kind ? xpFor(kind) : 0;
        }
        if (xp > 0) {
            this.upgradeOffers.push(...addXp(this.progression, xp, this.listPlayers(), this.progressionRandom));
        }
    }
    /** XP do time acumulado nesta missao. Usado por medicao e pelo HUD. */
    teamXp() {
        return this.progression.xp;
    }
    /** Ofertas de melhoria geradas no ultimo tick. */
    takeUpgradeOffers() {
        const offers = this.upgradeOffers;
        this.upgradeOffers = [];
        return offers;
    }
    /** Melhorias confirmadas no ultimo tick. */
    takeUpgradesTaken() {
        const taken = this.upgradesTaken;
        this.upgradesTaken = [];
        return taken;
    }
    /**
     * Escolha de melhoria. O servidor confere se ela estava mesmo na oferta.
     */
    chooseUpgrade(playerId, upgradeId) {
        const player = this.players.get(playerId);
        if (!player || this.status !== 'playing')
            return false;
        const chosen = takeUpgrade(player, upgradeId);
        if (chosen === null)
            return true;
        this.upgradesTaken.push({ playerId: player.id, upgradeId: chosen });
        return true;
    }
    /**
     * Tenta erguer a estrutura.
     *
     * Recusa quando o espaco esta ocupado. Quando o Engenheiro ja tem o maximo
     * em campo, a mais antiga cede lugar -- construir de novo e a forma de
     * reposicionar, sem precisar de um comando de demolir.
     */
    placeStructure(owner, structure) {
        if (this.structures.length >= STRUCTURE.maxPerRoom)
            return false;
        if (!hasRoomFor(structure.position, this.structures, structure.radius))
            return false;
        const mine = this.structures.filter((existing) => existing.ownerId === owner.id);
        if (mine.length >= BARRICADA.maxPerEngineer) {
            const oldest = mine[0];
            if (oldest)
                this.structures = this.structures.filter((existing) => existing !== oldest);
        }
        this.structures.push(structure);
        return true;
    }
    /**
     * Solta a matilha em volta do dono.
     *
     * Os caes chamados nascem espalhados e com ordem de atacar ja dada: eles sao
     * pressao imediata, nao companheiros para comandar um a um.
     */
    releasePack(owner, pack) {
        for (let index = 0; index < pack.count; index += 1) {
            const angle = (Math.PI * 2 * index) / pack.count;
            const spot = {
                x: owner.position.x + Math.cos(angle) * 46,
                y: owner.position.y + Math.sin(angle) * 46,
            };
            const dog = createCompanion(owner.id, spot, pack.durationMs);
            this.companions.set(dog.id, dog);
        }
    }
    /**
     * Marca o alvo prioritario na direcao apontada.
     *
     * Cone generoso pela mesma razao do comando ao cao: apontar no meio do
     * combate nao e preciso, e exigir mira fina transformaria coordenacao em
     * teste de pontaria.
     */
    markPrey(hunter, aim) {
        const halfCone = Math.PI / 6;
        let best = null;
        let bestDistance = aim.range;
        for (const enemy of this.listEnemies()) {
            if (enemy.combatState === 'incapacitated')
                continue;
            const dx = enemy.position.x - hunter.position.x;
            const dy = enemy.position.y - hunter.position.y;
            const distance = Math.hypot(dx, dy);
            if (distance === 0 || distance > bestDistance)
                continue;
            const cosine = (dx * aim.x + dy * aim.y) / distance;
            if (Math.acos(Math.min(1, Math.max(-1, cosine))) > halfCone)
                continue;
            bestDistance = distance;
            best = enemy;
        }
        if (best === null)
            return;
        // Uma marca por vez: o valor esta em o time todo bater no *mesmo* alvo.
        for (const enemy of this.enemies.values())
            enemy.markedMs = 0;
        best.markedMs = CACADA.durationMs;
    }
    /**
     * Poe fogo no oleo ao alcance.
     *
     * Nao cria fogo do nada: o Incendio *prepara-se*, e a preparacao e o oleo --
     * inclusive o de outro Alquimista, que e o que faz disso cooperacao e nao
     * combo solo.
     */
    igniteNearby(at, byPlayerId) {
        const lit = [];
        for (const zone of this.zones) {
            if (!isFlammable(zone))
                continue;
            const gap = Math.hypot(zone.position.x - at.x, zone.position.y - at.y);
            if (gap > at.range + zone.radius)
                continue;
            lit.push(zone);
        }
        if (lit.length === 0)
            return;
        const burned = new Set(lit.map((zone) => zone.id));
        this.zones = this.zones.filter((zone) => !burned.has(zone.id));
        for (const zone of lit)
            this.zones.push(ignite(zone, byPlayerId));
    }
    /** Zonas que causaram dano no ultimo tick. */
    takeZoneEvents() {
        const events = this.zoneEvents;
        this.zoneEvents = [];
        return events;
    }
    /** Eventos de especial do ultimo tick. */
    takeSpecialEvents() {
        const events = this.specialEvents;
        this.specialEvents = [];
        return events;
    }
    /**
     * Intencao de usar o especial. Mesmo caminho para rede e simulacao.
     */
    requestSpecial(playerId, aim) {
        const player = this.players.get(playerId);
        if (!player || this.status !== 'playing')
            return false;
        const outcome = requestSpecial(player, aim);
        if (outcome === null)
            return true;
        if (outcome.zone && this.zones.length < ZONE.maxPerRoom) {
            this.zones.push(outcome.zone);
        }
        if (outcome.ignite)
            this.igniteNearby(outcome.ignite, player.id);
        if (outcome.structure && !this.placeStructure(player, outcome.structure)) {
            // Lugar ocupado: devolve a recarga em vez de cobrar por nada.
            player.specialCooldownMs = 0;
            player.specialActiveMs = 0;
            return true;
        }
        if (outcome.mark)
            this.markPrey(player, outcome.mark);
        if (outcome.pack)
            this.releasePack(player, outcome.pack);
        this.specialEvents.push(outcome);
        return true;
    }
    /** Eventos de habilidade do ultimo tick. */
    takeAbilityEvents() {
        const events = this.abilityEvents;
        this.abilityEvents = [];
        return events;
    }
    /**
     * Intencao de usar habilidade. Mesmo caminho para rede e simulacao.
     */
    requestAbility(playerId, active, aim) {
        const player = this.players.get(playerId);
        if (!player || this.status !== 'playing')
            return false;
        const outcome = requestAbility(player, active, aim, this.listTargets());
        if (outcome === null)
            return true;
        if (outcome.projectile && canSpawnProjectile(this.projectiles.length)) {
            this.projectiles.push(outcome.projectile);
        }
        if (outcome.zone && this.zones.length < ZONE.maxPerRoom) {
            this.zones.push(outcome.zone);
        }
        if (outcome.command) {
            const companion = this.companionOf(player.id);
            if (!companion) {
                player.abilityCooldownMs = 0;
                return true;
            }
            const command = resolveCommand(player, outcome.command, this.listEnemies(), this.listPlayers());
            companion.order = command.order;
            companion.orderTargetId = command.targetId;
            companion.guardPosition = command.position;
            outcome.targetId = command.targetId;
        }
        if (outcome.structure && !this.placeStructure(player, outcome.structure)) {
            // Lugar ocupado: devolve a recarga em vez de cobrar por nada.
            player.abilityCooldownMs = 0;
            return true;
        }
        this.countDefeated(outcome.hits, outcome.playerId);
        this.abilityEvents.push(outcome);
        return true;
    }
    /** Impactos de projetil do ultimo tick, para quem transmite os eventos. */
    takeProjectileImpacts() {
        const impacts = this.lastImpacts;
        this.lastImpacts = [];
        return impacts;
    }
    /** Remove o corpo dos invasores abatidos depois do atraso de leitura. */
    sweepDefeatedEnemies() {
        for (const enemy of this.enemies.values()) {
            if (stepDespawn(enemy, SIMULATION_TICK_MS))
                this.enemies.delete(enemy.id);
        }
    }
    /** Remove players cuja janela de reconexao expirou. Devolve os ids removidos. */
    sweepExpiredPlayers(now) {
        const removed = [];
        for (const player of this.players.values()) {
            if (isReconnectWindowExpired(player, now)) {
                this.players.delete(player.id);
                removed.push(player.id);
            }
        }
        if (removed.length > 0)
            this.refreshHost();
        return removed;
    }
    isExpired(now) {
        if (this.connectedPlayerCount > 0)
            return false;
        if (this.emptySince === null)
            return false;
        return now - this.emptySince > ROOM.emptyRoomTtlMs;
    }
    toLobbyState() {
        return {
            type: 'lobby_state',
            roomCode: this.code,
            status: this.status,
            hostPlayerId: this.hostPlayerId,
            difficulty: this.difficulty,
            maxPlayers: ROOM.maxPlayers,
            players: this.listPlayers().map((player) => {
                return {
                    id: player.id,
                    name: player.name,
                    classId: player.classId,
                    slot: player.slot,
                    ready: player.ready,
                    connected: player.connected,
                    isHost: player.id === this.hostPlayerId,
                };
            }),
        };
    }
    toMatchStarted() {
        return {
            type: 'match_started',
            roomCode: this.code,
            startedAt: this.startedAt ?? this.createdAt,
            arena: { width: ARENA.width, height: ARENA.height },
            playerSpeed: PLAYER.speed,
            playerRadius: PLAYER.radius,
            maxHealth: COMBAT.maxHealth,
            gate: gateToSnapshot(this.gate),
            missionDurationMs: DIRECTOR.missionDurationMs,
            players: this.listPlayers().map((player) => ({
                id: player.id,
                name: player.name,
                classId: player.classId,
                slot: player.slot,
                x: positionForWire(player.position.x),
                y: positionForWire(player.position.y),
                health: player.health,
            })),
        };
    }
    /**
     * Snapshot personalizado: `lastProcessedInputSeq` e sempre o do destinatario,
     * porque e o que a reconciliacao dele precisa.
     */
    toSnapshotFor(playerId, serverTime) {
        return {
            type: 'world_snapshot',
            tick: this.tick,
            serverTime,
            lastProcessedInputSeq: this.players.get(playerId)?.lastProcessedInputSeq ?? 0,
            players: this.listPlayers().map((player) => ({
                id: player.id,
                x: positionForWire(player.position.x),
                y: positionForWire(player.position.y),
                aimX: roundForWire(player.aim.x),
                aimY: roundForWire(player.aim.y),
                connected: player.connected,
                maxHealth: player.maxHealth,
                health: Math.round(player.health),
                state: player.combatState,
                reviveProgress: roundForWire(player.reviveProgress),
                rooted: player.rootedMs > 0,
                abilityActive: player.abilityActive,
                specialActive: player.specialActiveMs > 0,
                sheltered: player.sheltered,
                operating: player.operatingId !== null,
                upgrades: [...player.upgrades],
                weaponId: player.weaponId ?? '',
                abilityCooldown: roundForWire(CLASSES[player.classId].ability.cooldownMs > 0
                    ? player.abilityCooldownMs / CLASSES[player.classId].ability.cooldownMs
                    : 0),
            })),
            enemies: this.listEnemies().map((enemy) => ({
                id: enemy.id,
                kind: enemy.kind,
                ranged: enemy.ranged,
                led: enemy.led,
                x: positionForWire(enemy.position.x),
                y: positionForWire(enemy.position.y),
                aimX: roundForWire(enemy.aim.x),
                aimY: roundForWire(enemy.aim.y),
                health: enemy.health,
                maxHealth: enemy.maxHealth,
                state: enemy.combatState,
                rooted: enemy.rootedMs > 0,
                marked: enemy.markedMs > 0,
            })),
            gate: gateToSnapshot(this.gate),
            projectiles: this.projectiles.map((projectile) => ({
                id: projectile.id,
                x: roundForWire(projectile.position.x),
                y: roundForWire(projectile.position.y),
                dirX: roundForWire(projectile.direction.x),
                dirY: roundForWire(projectile.direction.y),
                team: projectile.team,
            })),
            zones: this.zones.map((zone) => ({
                id: zone.id,
                kind: zone.kind,
                x: roundForWire(zone.position.x),
                y: roundForWire(zone.position.y),
                radius: zone.radius,
                team: zone.team,
                remaining: roundForWire(Math.max(0, zone.remainingMs / zone.durationMs)),
                triggered: zone.triggered,
            })),
            structures: this.structures.map(structureToSnapshot),
            ground: this.ground.map(groundToSnapshot),
            companions: this.listCompanions().map(companionToSnapshot),
            mission: {
                elapsedMs: Math.round(this.director.elapsedMs),
                durationMs: DIRECTOR.missionDurationMs,
                progress: roundForWire(missionProgress(this.director)),
                phase: this.director.phase.kind,
                assaultIndex: this.director.phase.assaultIndex,
                teamXp: this.progression.xp,
                nextUpgradeXp: Math.round(thresholdFor(this.progression.level, this.connectedPlayerCount)),
                invadersInField: this.listEnemies().filter((enemy) => enemy.combatState !== 'incapacitated')
                    .length,
            },
        };
    }
    findByReconnectToken(token, now) {
        for (const player of this.players.values()) {
            if (player.reconnectToken !== token)
                continue;
            if (player.connected)
                return undefined;
            if (isReconnectWindowExpired(player, now))
                return undefined;
            return player;
        }
        return undefined;
    }
    nextFreeSlot() {
        const taken = new Set([...this.players.values()].map((player) => player.slot));
        for (let slot = 0; slot < ROOM.maxPlayers; slot += 1) {
            if (!taken.has(slot))
                return slot;
        }
        return this.players.size;
    }
    /** Host e so o dono logico da sala; a autoridade e sempre do servidor. */
    refreshHost() {
        const current = this.hostPlayerId === null ? undefined : this.players.get(this.hostPlayerId);
        if (current?.connected === true)
            return;
        const candidate = this.listPlayers().find((player) => player.connected);
        this.hostPlayerId = candidate?.id ?? this.listPlayers()[0]?.id ?? null;
    }
}
//# sourceMappingURL=room.js.map