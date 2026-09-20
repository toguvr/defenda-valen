import { isDestroyed } from '../domain/gate.js';
import { missionComplete } from './director.js';
/**
 * Condicoes de fim da primeira missao.
 *
 * Derrota vem antes de vitoria na checagem: se a invasao derruba o portao no
 * mesmo tick em que o relogio zera, a missao falhou -- o objetivo caiu.
 *
 * Vitoria e aguentar ate o fim do tempo com o portao de pe. Repelir todos os
 * invasores nao encerra nada: o Director sempre manda mais.
 */
export function evaluateMatch(gate, players, director) {
    if (isDestroyed(gate)) {
        return { outcome: 'defeat', reason: 'gate_destroyed' };
    }
    const present = players.filter((player) => player.connected);
    const standing = present.filter((player) => player.combatState !== 'incapacitated');
    // Time inteiro caido e derrota. Sala sem ninguem conectado nao e derrota:
    // e uma sala vazia, que o sweep de salas ja resolve.
    if (present.length > 0 && standing.length === 0) {
        return { outcome: 'defeat', reason: 'team_down' };
    }
    if (missionComplete(director)) {
        return { outcome: 'victory', reason: null };
    }
    return null;
}
//# sourceMappingURL=match-end.js.map