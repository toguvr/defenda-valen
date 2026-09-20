import { ROOM } from '../../protocol/index.js';
import { Room } from '../domain/room.js';
import { createRoomCode, createRoomId } from '../domain/ids.js';
/**
 * Registro de salas ativas do processo.
 *
 * Uma instancia do servidor hospeda varias salas em memoria; nao existe
 * processo ou container por partida.
 */
export class RoomManager {
    random;
    roomsByCode = new Map();
    constructor(random = Math.random) {
        this.random = random;
    }
    get size() {
        return this.roomsByCode.size;
    }
    list() {
        return [...this.roomsByCode.values()];
    }
    create(now) {
        const room = new Room({
            id: createRoomId(),
            code: this.allocateCode(),
            now,
            random: this.random,
        });
        this.roomsByCode.set(room.code, room);
        return room;
    }
    getByCode(code) {
        return this.roomsByCode.get(code.toUpperCase());
    }
    destroy(code) {
        return this.roomsByCode.delete(code.toUpperCase());
    }
    /** Expira reconexoes vencidas e destroi salas vazias. Chamado pelo loop. */
    sweep(now) {
        const result = { expiredPlayers: [], destroyedRoomCodes: [] };
        for (const room of this.roomsByCode.values()) {
            const playerIds = room.sweepExpiredPlayers(now);
            if (playerIds.length > 0) {
                result.expiredPlayers.push({ roomCode: room.code, playerIds });
            }
            if (room.isExpired(now)) {
                this.roomsByCode.delete(room.code);
                result.destroyedRoomCodes.push(room.code);
            }
        }
        return result;
    }
    /**
     * Sorteia um codigo livre.
     *
     * Com 32^4 combinacoes a colisao e rara; o limite de tentativas existe para
     * o servidor falhar de forma explicita em vez de travar num laco infinito.
     */
    allocateCode() {
        const maxAttempts = 100;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const code = createRoomCode(this.random);
            if (!this.roomsByCode.has(code))
                return code;
        }
        throw new Error(`nao foi possivel alocar codigo de sala apos ${maxAttempts} tentativas ` +
            `(${this.roomsByCode.size} salas ativas, ${ROOM.codeAlphabet.length ** ROOM.codeLength} combinacoes)`);
    }
}
//# sourceMappingURL=room-manager.js.map