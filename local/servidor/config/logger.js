const LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
/**
 * Logger minimo e estruturado.
 *
 * Regra: nao logar por input nem por snapshot. Eventos de ciclo de vida apenas.
 */
export function createLogger(level = 'info') {
    const threshold = LEVEL_ORDER[level];
    const write = (entry, message, context) => {
        if (LEVEL_ORDER[entry] < threshold)
            return;
        const line = { time: new Date().toISOString(), level: entry, message, ...context };
        const target = entry === 'error' || entry === 'warn' ? console.error : console.log;
        target(JSON.stringify(line));
    };
    return {
        debug: (message, context) => write('debug', message, context),
        info: (message, context) => write('info', message, context),
        warn: (message, context) => write('warn', message, context),
        error: (message, context) => write('error', message, context),
    };
}
export const silentLogger = {
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { },
};
//# sourceMappingURL=logger.js.map