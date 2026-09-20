import { ARENA, CLASSES, PLAYER } from '../../protocol/index.js';
import { speedFactor } from './ability.js';
import { clamp, clampToUnitCircle } from '../domain/vector.js';
/**
 * Passo de movimento autoritativo.
 *
 * Funcao pura sobre a posicao: o client roda a mesma matematica para prever
 * o proprio movimento, entao qualquer divergencia aqui vira jitter la.
 * Colisao nesta etapa e apenas o limite da arena.
 */
export function stepMovement(position, command, stepSeconds, speed = PLAYER.speed) {
    const direction = clampToUnitCircle(command.moveX, command.moveY);
    const distance = speed * stepSeconds;
    return {
        x: clamp(position.x + direction.x * distance, PLAYER.radius, ARENA.width - PLAYER.radius),
        y: clamp(position.y + direction.y * distance, PLAYER.radius, ARENA.height - PLAYER.radius),
    };
}
/** Mantem a mira normalizada; mira nula preserva a ultima direcao valida. */
export function resolveAim(current, command) {
    const magnitude = Math.hypot(command.aimX, command.aimY);
    if (magnitude === 0)
        return current;
    return { x: command.aimX / magnitude, y: command.aimY / magnitude };
}
/**
 * Consome ate `maxCommands` da fila do player e aplica cada um com passo fixo.
 *
 * Passo fixo por comando (em vez de dt do tick) e o que torna a prediction do
 * client exata: o mesmo comando produz o mesmo deslocamento nos dois lados.
 */
export function stepPlayer(player, stepSeconds, maxCommands, terrainFactor = 1) {
    const commands = player.inputQueue.splice(0, maxCommands);
    // Quem decide andar corta o proprio Curativo. Marcado aqui, onde se sabe que
    // a ordem veio do jogador, e nao no fim do tick, onde empurrao e passo se
    // parecem.
    player.movedByInput = commands.some((command) => command.moveX !== 0 || command.moveY !== 0);
    // Escudo cobra mobilidade; oleo cobra terreno. Os dois se somam.
    const speed = CLASSES[player.classId].speed * speedFactor(player) * terrainFactor;
    for (const command of commands) {
        player.position = stepMovement(player.position, command, stepSeconds, speed);
        player.aim = resolveAim(player.aim, command);
        player.lastProcessedInputSeq = command.seq;
    }
}
//# sourceMappingURL=movement.js.map