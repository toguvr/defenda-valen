import { ARENA } from '../../protocol/index.js';
import { isAlive } from '../domain/combatant.js';
import { clamp } from '../domain/vector.js';
/**
 * Colisao solida com estruturas.
 *
 * Diferente da separacao entre corpos, que e leve e deixa deslizar: aqui o
 * empurrao e completo. Uma barricada que se atravessa devagar nao fecha
 * passagem nenhuma, e fechar passagem e a unica coisa que ela faz.
 *
 * Resolvida depois do movimento, nao antes: assim ninguem precisa prever a
 * colisao para andar, e o custo e um empurrao pequeno quando encosta.
 */
export function resolveStructureCollisions(bodies, structures) {
    for (const structure of structures) {
        if (!structure.solid || !isAlive(structure))
            continue;
        for (const body of bodies) {
            const minimum = structure.radius + body.radius;
            let deltaX = body.position.x - structure.position.x;
            let deltaY = body.position.y - structure.position.y;
            let distance = Math.hypot(deltaX, deltaY);
            if (distance >= minimum)
                continue;
            if (distance === 0) {
                // Exatamente no centro: escolhe uma saida estavel em vez de aleatoria.
                deltaX = 1;
                deltaY = 0;
                distance = 1;
            }
            const unitX = deltaX / distance;
            const unitY = deltaY / distance;
            body.position = {
                x: clamp(structure.position.x + unitX * minimum, body.radius, ARENA.width - body.radius),
                y: clamp(structure.position.y + unitY * minimum, body.radius, ARENA.height - body.radius),
            };
        }
    }
}
/**
 * Estrutura solida no caminho entre dois pontos.
 *
 * Usada pela IA: o invasor que encontra uma barricada entre ele e o alvo para
 * e bate nela. Sem isto ele ficaria empurrando a estrutura para sempre, sem
 * avancar nem reagir.
 */
export function blockingStructure(from, to, bodyRadius, structures) {
    const segmentX = to.x - from.x;
    const segmentY = to.y - from.y;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    let best = null;
    let bestT = Number.POSITIVE_INFINITY;
    for (const structure of structures) {
        if (!structure.solid || !isAlive(structure))
            continue;
        const t = lengthSquared === 0
            ? 0
            : Math.max(0, Math.min(1, ((structure.position.x - from.x) * segmentX +
                (structure.position.y - from.y) * segmentY) /
                lengthSquared));
        const closestX = from.x + segmentX * t;
        const closestY = from.y + segmentY * t;
        const gap = Math.hypot(structure.position.x - closestX, structure.position.y - closestY);
        if (gap > structure.radius + bodyRadius)
            continue;
        if (t < bestT) {
            bestT = t;
            best = structure;
        }
    }
    return best;
}
//# sourceMappingURL=collision.js.map