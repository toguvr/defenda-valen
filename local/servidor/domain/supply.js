import { ARENA, GATE, SUPPLY } from '../../protocol/index.js';
let nextSupplyNumber = 0;
export function createSupply(position, opening = false) {
    nextSupplyNumber += 1;
    return { id: `s${nextSupplyNumber}`, position, openedMs: 0, claimedBy: null, opening };
}
/**
 * Ponto de largada de uma caixa.
 *
 * Longe do portao e longe das muralhas. A distancia minima do objetivo e o
 * que faz buscar suprimento custar alguma coisa -- colada no portao, a caixa
 * seria so um botao a mais no lugar onde o time ja estava.
 */
export function pickSupplySpot(random, taken) {
    const margin = SUPPLY.margin;
    // Sorteia e descarta o que nao serve. O mapa e grande perto das restricoes,
    // entao poucas tentativas bastam; o retorno no fim e so para nao girar para
    // sempre num mapa configurado de forma apertada.
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const candidate = {
            x: margin + random() * (ARENA.width - margin * 2),
            y: margin + random() * (ARENA.height - margin * 2),
        };
        if (Math.hypot(candidate.x - GATE.x, candidate.y - GATE.y) < SUPPLY.minGateDistance)
            continue;
        if (taken.some((spot) => Math.hypot(spot.x - candidate.x, spot.y - candidate.y) < 260))
            continue;
        return candidate;
    }
    return { x: margin, y: ARENA.height - margin };
}
/**
 * Lugar de uma caixa do arsenal, no patio onde o time nasce.
 *
 * Em leque atras do portao, espacadas: perto o bastante para a correria do
 * comeco durar segundos, longe o bastante uma da outra para o time se
 * dividir em vez de abrir todas em fila.
 */
export function openingSpot(index, total) {
    const spread = Math.max(1, total);
    const angle = Math.PI * (0.15 + 0.7 * ((index + 0.5) / spread));
    return {
        x: GATE.x - Math.cos(angle) * SUPPLY.openingRadius,
        y: GATE.y + 150 + Math.sin(angle) * SUPPLY.openingRadius * 0.5,
    };
}
export function toSnapshot(supply) {
    return {
        id: supply.id,
        x: supply.position.x,
        y: supply.position.y,
        radius: SUPPLY.radius,
        progress: Math.min(1, supply.openedMs / SUPPLY.openMs),
    };
}
//# sourceMappingURL=supply.js.map