import { LIMITS, ROOM } from '../../protocol/index.js';
/**
 * Identificadores, pela Web Crypto.
 *
 * Nao `node:crypto` de proposito: este arquivo e o unico do miolo do jogo que
 * dependia do Node, e por causa dele a simulacao inteira nao podia rodar num
 * navegador. `globalThis.crypto` existe no Node 18+ e em todo navegador, entao
 * o mesmo codigo serve aos dois -- que e o que permite o modo sem internet
 * rodar dentro da propria aba.
 */
export function createPlayerId() {
    return crypto.randomUUID();
}
export function createRoomId() {
    return crypto.randomUUID();
}
/** Token opaco do player. Formato hex casa com `reconnectTokenSchema`. */
export function createReconnectToken() {
    const bytes = new Uint8Array(LIMITS.reconnectTokenLength / 2);
    crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
/** Codigo curto de sala, legivel em voz alta e digitavel no celular. */
export function createRoomCode(random = Math.random) {
    const alphabet = ROOM.codeAlphabet;
    let code = '';
    for (let index = 0; index < ROOM.codeLength; index += 1) {
        code += alphabet[Math.floor(random() * alphabet.length)];
    }
    return code;
}
//# sourceMappingURL=ids.js.map