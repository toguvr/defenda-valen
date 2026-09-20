import { RATE_LIMIT, encodeServerMessage, errorMessage, } from '../../protocol/index.js';
import { RateLimiter } from './rate-limiter.js';
/** Codigos WebSocket usados nos fechamentos iniciados pelo servidor. */
export const CLOSE_CODE = {
    POLICY_VIOLATION: 1008,
    MESSAGE_TOO_BIG: 1009,
};
export class Connection {
    id;
    transport;
    /** Aceita mensagens de lobby/gameplay somente apos um `hello` valido. */
    helloAccepted = false;
    playerId = null;
    roomCode = null;
    /** Conta desta conexao. `null` quando o servidor esta sem banco. */
    accountId = null;
    lastMessageAt;
    gameplayLimiter = new RateLimiter(RATE_LIMIT.maxGameplayMessagesPerWindow, RATE_LIMIT.windowMs);
    lobbyLimiter = new RateLimiter(RATE_LIMIT.maxLobbyMessagesPerWindow, RATE_LIMIT.windowMs);
    closed = false;
    constructor(id, transport, now) {
        this.id = id;
        this.transport = transport;
        this.lastMessageAt = now;
    }
    get isClosed() {
        return this.closed;
    }
    send(message) {
        if (this.closed)
            return;
        this.transport.send(encodeServerMessage(message));
    }
    sendError(code, message) {
        this.send(errorMessage(code, message));
    }
    close(code, reason) {
        if (this.closed)
            return;
        this.closed = true;
        this.transport.close(code, reason);
    }
    /** Marca o socket como fechado sem tentar fechar de novo (queda remota). */
    markClosed() {
        this.closed = true;
    }
}
//# sourceMappingURL=connection.js.map