import { createLogger } from '../config/logger.js';
import { Connection } from '../network/connection.js';
import { MessageHandler } from '../network/message-handler.js';
import { RoomManager } from '../rooms/room-manager.js';
import { SimulationLoop } from '../simulation/loop.js';
export function startOfflineHost() {
    const logger = createLogger('warn');
    const now = () => Date.now();
    const rooms = new RoomManager();
    const handler = new MessageHandler({ rooms, logger, now });
    const loop = new SimulationLoop({ rooms, handler, logger, now });
    const seats = new Set();
    loop.start();
    let next = 0;
    return {
        seat() {
            const outbox = [];
            next += 1;
            const transport = {
                send(data) {
                    outbox.push(data);
                },
                close() {
                    // Sem socket para fechar. Quem chegou por WebRTC fecha o canal dele
                    // por fora; para o anfitriao, a aba que hospeda e a que joga.
                },
            };
            // O handler nao precisa registrar a conexao: ele a guarda sozinho quando
            // o `hello` chega, igual ao caminho do WebSocket.
            const connection = new Connection(`offline-${next}`, transport, now());
            const entry = { connection };
            seats.add(entry);
            return {
                send(raw) {
                    handler.handleRaw(connection, raw);
                },
                drain() {
                    return outbox.splice(0, outbox.length);
                },
                leave() {
                    if (!seats.delete(entry))
                        return;
                    handler.handleDisconnect(connection);
                },
            };
        },
        stop() {
            for (const entry of [...seats])
                handler.handleDisconnect(entry.connection);
            seats.clear();
            loop.stop();
        },
    };
}
//# sourceMappingURL=offline-host.js.map