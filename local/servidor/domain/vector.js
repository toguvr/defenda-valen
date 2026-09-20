export function length(x, y) {
    return Math.hypot(x, y);
}
/**
 * Limita o vetor ao circulo unitario.
 *
 * Joystick analogico envia magnitude menor que 1 (andar devagar), o que e
 * preservado. Um client hostil mandando (1, 1) nao ganha velocidade diagonal.
 */
export function clampToUnitCircle(x, y) {
    const magnitude = length(x, y);
    if (magnitude <= 1 || magnitude === 0)
        return { x, y };
    return { x: x / magnitude, y: y / magnitude };
}
export function clamp(value, min, max) {
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}
/** Arredonda para 2 casas: reduz o tamanho do snapshot sem perda visivel. */
export function roundForWire(value) {
    return Math.round(value * 100) / 100;
}
/**
 * Posicao no fio: inteiro.
 *
 * Sub-pixel nao existe em tela, e o client interpola entre snapshots de
 * qualquer jeito -- as casas decimais eram bytes pagos por precisao que
 * ninguem consegue ver. Mira continua com duas casas: ali a direcao importa.
 */
export function positionForWire(value) {
    return Math.round(value);
}
/**
 * Fluxo aleatorio proprio, semeado por texto.
 *
 * Existe para um sistema novo poder sortear **sem tocar** na sequencia de quem
 * ja existia. Consumir do mesmo fluxo -- ou ate uma amostra so, para derivar
 * outro -- deslocaria toda missao semeada e faria as medicoes mudarem de
 * resultado sem que nenhum comportamento tivesse mudado. Aconteceu, e por um
 * instante pareceu regressao de equilibrio.
 *
 * Determinista: a mesma semente da a mesma sequencia.
 */
export function seededStream(seed) {
    let state = 0x811c9dc5;
    for (let index = 0; index < seed.length; index += 1) {
        state ^= seed.charCodeAt(index);
        state = Math.imul(state, 0x01000193) >>> 0;
    }
    if (state === 0)
        state = 0x9e3779b9;
    return () => {
        // xorshift32: barato, determinista, e o bastante para sortear opcoes.
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        return state / 0x100000000;
    };
}
//# sourceMappingURL=vector.js.map