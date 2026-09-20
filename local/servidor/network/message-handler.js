import { ERROR_CODE, LIMITS, PROTOCOL_VERSION, TIMING, isGameplayMessageType, isSupportedProtocolVersion, parseClientMessage, } from '../../protocol/index.js';
import { createPlayerId, createReconnectToken } from '../domain/ids.js';
import { enqueueInput } from '../domain/player.js';
import { CLOSE_CODE } from './connection.js';
/**
 * Tamanho da mensagem em bytes, sem `Buffer`.
 *
 * Era a ultima peca do Node no miolo do jogo. Com `TextEncoder`, o mesmo
 * codigo mede igual no servidor e dentro do navegador -- e e isso que permite
 * a partida sem internet rodar na propria aba, sem uma segunda implementacao
 * das regras.
 */
const encoder = new TextEncoder();
function byteLength(text) {
    return encoder.encode(text).length;
}
/**
 * Roteia mensagens do client para o estado autoritativo.
 *
 * Toda entrada ja chega validada por Zod. Nenhum handler confia em campo que
 * nao tenha passado pelo schema, e nenhum deles aceita posicao vinda do client.
 */
export class MessageHandler {
    deps;
    /** Precisa alcancar cada player de uma sala para transmitir estado. */
    connectionsByPlayerId = new Map();
    constructor(deps) {
        this.deps = deps;
    }
    getConnectionByPlayerId(playerId) {
        return this.connectionsByPlayerId.get(playerId);
    }
    handleRaw(connection, raw) {
        const now = this.deps.now();
        connection.lastMessageAt = now;
        if (byteLength(raw) > LIMITS.maxMessageBytes) {
            connection.sendError(ERROR_CODE.MESSAGE_TOO_LARGE, 'mensagem acima do limite');
            connection.close(CLOSE_CODE.MESSAGE_TOO_BIG, 'message too large');
            return;
        }
        const parsed = parseClientMessage(raw);
        if (!parsed.ok) {
            // Mensagem ilegivel ainda consome cota, senao flood invalido sai de graca.
            if (!connection.lobbyLimiter.tryConsume(now)) {
                this.rejectForRateLimit(connection);
                return;
            }
            this.deps.logger.warn('protocolo invalido', {
                connectionId: connection.id,
                reason: parsed.reason,
            });
            connection.sendError(ERROR_CODE.INVALID_MESSAGE, parsed.reason);
            return;
        }
        const message = parsed.message;
        const limiter = isGameplayMessageType(message.type)
            ? connection.gameplayLimiter
            : connection.lobbyLimiter;
        if (!limiter.tryConsume(now)) {
            this.rejectForRateLimit(connection);
            return;
        }
        if (message.type !== 'hello' && !connection.helloAccepted) {
            connection.sendError(ERROR_CODE.NOT_AUTHENTICATED, 'envie hello antes de qualquer mensagem');
            return;
        }
        this.dispatch(connection, message, now);
    }
    /** Queda ou saida: o slot e preservado ate a janela de reconexao expirar. */
    handleDisconnect(connection) {
        const now = this.deps.now();
        connection.markClosed();
        const { playerId, roomCode } = connection;
        if (playerId === null || roomCode === null)
            return;
        // Uma reconexao mais nova ja pode ter assumido o playerId.
        if (this.connectionsByPlayerId.get(playerId) === connection) {
            this.connectionsByPlayerId.delete(playerId);
        }
        const room = this.deps.rooms.getByCode(roomCode);
        if (!room)
            return;
        room.markDisconnected(playerId, now);
        this.deps.logger.info('player desconectado', { roomCode, playerId });
        this.broadcastLobbyState(room);
    }
    broadcastLobbyState(room) {
        this.broadcast(room, room.toLobbyState());
    }
    /** Mensagem para um jogador so. Usada quando o conteudo e dele. */
    sendTo(room, playerId, message) {
        const player = room.getPlayer(playerId);
        if (!player || !player.connected)
            return;
        this.connectionsByPlayerId.get(playerId)?.send(message);
    }
    broadcast(room, message) {
        for (const player of room.listPlayers()) {
            if (!player.connected)
                continue;
            this.connectionsByPlayerId.get(player.id)?.send(message);
        }
    }
    dispatch(connection, message, now) {
        switch (message.type) {
            case 'hello':
                this.handleHello(connection, message);
                return;
            case 'create_room':
                this.handleCreateRoom(connection, message, now);
                return;
            case 'join_room':
                this.handleJoinRoom(connection, message, now);
                return;
            case 'select_class':
                this.handleSelectClass(connection, message);
                return;
            case 'set_ready':
                this.handleSetReady(connection, message, now);
                return;
            case 'input':
                this.handleInput(connection, message);
                return;
            case 'basic_attack':
                this.handleBasicAttack(connection, message);
                return;
            case 'use_ability':
                this.handleUseAbility(connection, message);
                return;
            case 'use_special':
                this.handleUseSpecial(connection, message);
                return;
            case 'choose_upgrade':
                this.handleChooseUpgrade(connection, message);
                return;
            case 'interact':
                this.handleInteract(connection, message);
                return;
            case 'ping':
                this.handlePing(connection, message, now);
                return;
        }
    }
    handleHello(connection, message) {
        if (!isSupportedProtocolVersion(message.protocolVersion)) {
            this.deps.logger.warn('versao de protocolo incompativel', {
                connectionId: connection.id,
                received: message.protocolVersion,
                expected: PROTOCOL_VERSION,
            });
            connection.send({
                type: 'protocol_rejected',
                expectedProtocolVersion: PROTOCOL_VERSION,
                receivedProtocolVersion: message.protocolVersion,
                reason: 'atualize o client para continuar',
            });
            connection.close(CLOSE_CODE.POLICY_VIOLATION, 'protocol version mismatch');
            return;
        }
        connection.helloAccepted = true;
        connection.send({
            type: 'hello_accepted',
            protocolVersion: PROTOCOL_VERSION,
            serverTime: this.deps.now(),
            simulationTickHz: TIMING.simulationTickHz,
            snapshotHz: TIMING.snapshotHz,
            company: null,
        });
        // A conta e resolvida depois do aceite, nao antes: uma falha de banco nao
        // pode impedir alguem de entrar numa partida.
        void this.attachAccount(connection, message);
    }
    /**
     * Liga a conexao a uma conta e manda a progressao.
     *
     * Tudo aqui e melhor-esforco. Sem banco, sem token, ou com o banco fora do
     * ar, o jogo segue -- so nao guarda nada entre sessoes.
     */
    async attachAccount(connection, message) {
        const accounts = this.deps.accounts;
        if (!accounts || !message.accountToken)
            return;
        try {
            const account = await accounts.open(message.accountToken, '');
            connection.accountId = account.id;
            const company = await accounts.view(account.id);
            if (company)
                connection.send({ type: 'company_updated', company });
        }
        catch (error) {
            this.deps.logger.warn('nao foi possivel carregar a conta', {
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /**
     * Registra o resultado da missao na progressao permanente.
     *
     * Chamado pelo loop quando a partida acaba. Melhor-esforco pela mesma razao:
     * perder o registro e ruim, travar o fim de partida e pior.
     */
    async recordMission(room, victory, invadersDefeated) {
        const accounts = this.deps.accounts;
        if (!accounts)
            return;
        for (const player of room.listPlayers()) {
            const connection = this.connectionsByPlayerId.get(player.id);
            if (!connection?.accountId)
                continue;
            try {
                await accounts.recordMission({
                    accountId: connection.accountId,
                    classId: player.classId,
                    victory,
                    invadersDefeated,
                });
                const company = await accounts.view(connection.accountId);
                if (company)
                    connection.send({ type: 'company_updated', company });
            }
            catch (error) {
                this.deps.logger.warn('nao foi possivel registrar a missao', {
                    playerId: player.id,
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    handleCreateRoom(connection, message, now) {
        if (connection.roomCode !== null) {
            connection.sendError(ERROR_CODE.ALREADY_IN_ROOM, 'esta conexao ja esta em uma sala');
            return;
        }
        const room = this.deps.rooms.create(now);
        const result = room.join({
            playerId: createPlayerId(),
            name: message.playerName,
            reconnectToken: createReconnectToken(),
            now,
        });
        if (!result.ok) {
            // Sala recem-criada sempre tem vaga; se falhar, o estado esta corrompido.
            this.deps.rooms.destroy(room.code);
            this.deps.logger.error('falha ao entrar em sala recem-criada', {
                roomCode: room.code,
                reason: result.reason,
            });
            connection.sendError(ERROR_CODE.INTERNAL_ERROR, 'nao foi possivel criar a sala');
            return;
        }
        this.attach(connection, room, result.player.id);
        this.deps.logger.info('sala criada', {
            roomCode: room.code,
            playerId: result.player.id,
            playerName: result.player.name,
        });
        connection.send({
            type: 'room_created',
            roomCode: room.code,
            playerId: result.player.id,
            reconnectToken: result.player.reconnectToken,
            lobby: room.toLobbyState(),
        });
    }
    handleJoinRoom(connection, message, now) {
        if (connection.roomCode !== null) {
            connection.sendError(ERROR_CODE.ALREADY_IN_ROOM, 'esta conexao ja esta em uma sala');
            return;
        }
        const room = this.deps.rooms.getByCode(message.roomCode);
        if (!room) {
            connection.sendError(ERROR_CODE.ROOM_NOT_FOUND, 'sala nao encontrada');
            return;
        }
        const result = room.join({
            playerId: createPlayerId(),
            name: message.playerName,
            reconnectToken: createReconnectToken(),
            now,
            existingToken: message.reconnectToken,
        });
        if (!result.ok) {
            const code = result.reason === 'room_full' ? ERROR_CODE.ROOM_FULL : ERROR_CODE.ROOM_NOT_JOINABLE;
            connection.sendError(code, result.reason === 'room_full' ? 'sala cheia' : 'a partida ja comecou');
            return;
        }
        const player = result.player;
        // Reconexao com o socket antigo ainda aberto: o novo assume o slot.
        const previous = this.connectionsByPlayerId.get(player.id);
        if (previous && previous !== connection) {
            previous.playerId = null;
            previous.roomCode = null;
            previous.close(CLOSE_CODE.POLICY_VIOLATION, 'sessao reassumida em outra conexao');
        }
        this.attach(connection, room, player.id);
        this.deps.logger.info(result.reconnected ? 'player reconectado' : 'player entrou', {
            roomCode: room.code,
            playerId: player.id,
            playerName: player.name,
            players: room.playerCount,
        });
        connection.send({
            type: 'join_room_accepted',
            roomCode: room.code,
            playerId: player.id,
            reconnectToken: player.reconnectToken,
            reconnected: result.reconnected,
            lobby: room.toLobbyState(),
        });
        // Quem volta no meio da partida precisa do estado da arena antes do snapshot.
        if (room.status === 'playing') {
            connection.send(room.toMatchStarted());
        }
        this.broadcastLobbyState(room);
    }
    /** Escolha de classe. Recusada fora do lobby: mudaria HP e alcance em jogo. */
    handleSelectClass(connection, message) {
        const context = this.requireRoom(connection);
        if (!context)
            return;
        if (!context.room.selectClass(context.playerId, message.classId)) {
            connection.sendError(ERROR_CODE.ROOM_NOT_JOINABLE, 'a sala nao esta no lobby');
            return;
        }
        this.broadcastLobbyState(context.room);
    }
    handleSetReady(connection, message, now) {
        const context = this.requireRoom(connection);
        if (!context)
            return;
        if (!context.room.setReady(context.playerId, message.ready)) {
            connection.sendError(ERROR_CODE.ROOM_NOT_JOINABLE, 'a sala nao esta no lobby');
            return;
        }
        this.broadcastLobbyState(context.room);
        if (context.room.shouldStartMatch()) {
            context.room.startMatch(now);
            this.deps.logger.info('partida iniciada', {
                roomCode: context.room.code,
                players: context.room.connectedPlayerCount,
            });
            this.broadcast(context.room, context.room.toMatchStarted());
            this.broadcastLobbyState(context.room);
        }
    }
    handleInput(connection, message) {
        const context = this.requireRoom(connection);
        if (!context)
            return;
        if (context.room.status !== 'playing')
            return;
        const player = context.room.getPlayer(context.playerId);
        if (!player)
            return;
        enqueueInput(player, {
            seq: message.seq,
            moveX: message.moveX,
            moveY: message.moveY,
            aimX: message.aimX,
            aimY: message.aimY,
        });
    }
    /**
     * Intencao de ataque.
     *
     * O servidor decide se o golpe pode sair; cooldown, windup e acerto sao
     * resolvidos no tick. Recusa silenciosa e proposital: mandar ataque durante
     * o cooldown e comportamento normal de client, nao erro de protocolo.
     */
    handleBasicAttack(connection, message) {
        const context = this.requireRoom(connection);
        if (!context)
            return;
        if (context.room.status !== 'playing')
            return;
        context.room.requestAttack(context.playerId, { x: message.aimX, y: message.aimY });
    }
    /**
     * Uso de habilidade.
     *
     * Recusa silenciosa quando esta em recarga ou indisponivel: mandar cedo
     * demais e comportamento normal de client, nao erro de protocolo.
     */
    handleUseAbility(connection, message) {
        const context = this.requireRoom(connection);
        if (!context)
            return;
        if (context.room.status !== 'playing')
            return;
        context.room.requestAbility(context.playerId, message.active, {
            x: message.aimX,
            y: message.aimY,
        });
    }
    handleChooseUpgrade(connection, message) {
        const context = this.requireRoom(connection);
        if (!context)
            return;
        if (context.room.status !== 'playing')
            return;
        context.room.chooseUpgrade(context.playerId, message.upgradeId);
    }
    handleUseSpecial(connection, message) {
        const context = this.requireRoom(connection);
        if (!context)
            return;
        if (context.room.status !== 'playing')
            return;
        context.room.requestSpecial(context.playerId, { x: message.aimX, y: message.aimY });
    }
    /**
     * Interacao contextual mantida. O servidor decide o que ela faz a partir do
     * que esta por perto -- hoje, socorrer um aliado caido.
     */
    handleInteract(connection, message) {
        const context = this.requireRoom(connection);
        if (!context)
            return;
        if (context.room.status !== 'playing')
            return;
        const player = context.room.getPlayer(context.playerId);
        if (!player)
            return;
        player.interacting = message.active;
    }
    handlePing(connection, message, now) {
        connection.send({ type: 'pong', clientTime: message.clientTime, serverTime: now });
    }
    requireRoom(connection) {
        const { playerId, roomCode } = connection;
        if (playerId === null || roomCode === null) {
            connection.sendError(ERROR_CODE.NOT_IN_ROOM, 'esta conexao nao esta em uma sala');
            return null;
        }
        const room = this.deps.rooms.getByCode(roomCode);
        if (!room) {
            connection.roomCode = null;
            connection.playerId = null;
            connection.sendError(ERROR_CODE.ROOM_NOT_FOUND, 'a sala nao existe mais');
            return null;
        }
        return { room, playerId };
    }
    attach(connection, room, playerId) {
        connection.playerId = playerId;
        connection.roomCode = room.code;
        this.connectionsByPlayerId.set(playerId, connection);
    }
    rejectForRateLimit(connection) {
        this.deps.logger.warn('conexao excedeu o limite de mensagens', {
            connectionId: connection.id,
            playerId: connection.playerId,
        });
        connection.sendError(ERROR_CODE.RATE_LIMITED, 'mensagens demais');
        connection.close(CLOSE_CODE.POLICY_VIOLATION, 'rate limited');
    }
}
//# sourceMappingURL=message-handler.js.map