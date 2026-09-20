import { ARENA, PLAYER } from '../../protocol/index.js';
import { clamp } from '../domain/vector.js';
/**
 * Separacao suave entre corpos, aliados ou nao.
 *
 * CLAUDE.md define colisao leve: personagens nao ocupam exatamente o mesmo
 * ponto, mas deslizam uns pelos outros para evitar bloqueio frustrante. Sem
 * isso os corpos empilham e ninguem consegue ler em quem esta batendo, o que
 * derruba a legibilidade de que o friendly fire depende.
 *
 * Isto NAO e colisao rigida: e um empurrao parcial por tick, que converge em
 * alguns ticks e permite atravessar devagar se o jogador insistir.
 */
export function resolveOverlaps(combatants) {
    for (let i = 0; i < combatants.length; i += 1) {
        for (let j = i + 1; j < combatants.length; j += 1) {
            const a = combatants[i];
            const b = combatants[j];
            if (!a || !b)
                continue;
            const minimumDistance = a.radius + b.radius;
            let deltaX = b.position.x - a.position.x;
            let deltaY = b.position.y - a.position.y;
            let distance = Math.hypot(deltaX, deltaY);
            if (distance >= minimumDistance)
                continue;
            if (distance === 0) {
                // Exatamente no mesmo ponto: escolhe uma direcao estavel em vez de
                // aleatoria, senao os dois tremem em vez de se separar.
                deltaX = 1;
                deltaY = 0;
                distance = 1;
            }
            const unitX = deltaX / distance;
            const unitY = deltaY / distance;
            const overlap = minimumDistance - distance;
            // Corpo ancorado nao cede: o empurrao inteiro vai para o outro. E o que
            // faz a Ultima Linha fechar passagem em vez de so aguentar pancada.
            const shareA = a.anchored ? 0 : b.anchored ? 1 : 0.5;
            const shareB = b.anchored ? 0 : a.anchored ? 1 : 0.5;
            a.position = {
                x: clamp(a.position.x - unitX * overlap * shareA * PLAYER.separationStrength, a.radius, ARENA.width - a.radius),
                y: clamp(a.position.y - unitY * overlap * shareA * PLAYER.separationStrength, a.radius, ARENA.height - a.radius),
            };
            b.position = {
                x: clamp(b.position.x + unitX * overlap * shareB * PLAYER.separationStrength, b.radius, ARENA.width - b.radius),
                y: clamp(b.position.y + unitY * overlap * shareB * PLAYER.separationStrength, b.radius, ARENA.height - b.radius),
            };
        }
    }
}
//# sourceMappingURL=separation.js.map