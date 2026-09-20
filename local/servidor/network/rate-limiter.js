/**
 * Contador de janela fixa.
 *
 * Objetivo e barrar flood obvio, nao construir anti-cheat. Uma janela fixa
 * e suficiente e nao guarda historico por mensagem.
 */
export class RateLimiter {
    limit;
    windowMs;
    windowStart = 0;
    count = 0;
    constructor(limit, windowMs) {
        this.limit = limit;
        this.windowMs = windowMs;
    }
    /** Devolve false quando a mensagem excede o limite da janela atual. */
    tryConsume(now) {
        if (now - this.windowStart >= this.windowMs) {
            this.windowStart = now;
            this.count = 0;
        }
        this.count += 1;
        return this.count <= this.limit;
    }
}
//# sourceMappingURL=rate-limiter.js.map