import { z } from '../zod/index.js';
import { LIMITS, PLAYER, PROTOCOL_VERSION, ROOM } from './constants.js';
import { CLASS_IDS } from './classes.js';
/**
 * Schemas das mensagens client -> server.
 *
 * Tudo que chega da rede passa por aqui antes de tocar em qualquer estado.
 * O servidor nunca confia em payload do client.
 */
/** Rejeita caracteres de controle; aceita acentuacao. */
const displayText = (min, max) => z
    .string()
    .transform((value) => value.trim())
    .pipe(z
    .string()
    .min(min)
    .max(max)
    .regex(/^[^\p{C}]+$/u, 'caracteres de controle nao sao permitidos'));
export const playerNameSchema = displayText(PLAYER.nameMinLength, PLAYER.nameMaxLength);
export const roomCodeSchema = z
    .string()
    .max(ROOM.codeLength * 2)
    .transform((value) => value.trim().toUpperCase())
    .pipe(z
    .string()
    .length(ROOM.codeLength)
    .regex(new RegExp(`^[${ROOM.codeAlphabet}]+$`), 'codigo de sala invalido'));
export const reconnectTokenSchema = z
    .string()
    .length(LIMITS.reconnectTokenLength)
    .regex(/^[0-9a-f]+$/, 'token invalido');
/** Componente de vetor normalizado. Rejeita NaN e Infinity pelos limites. */
const axisSchema = z.number().min(-1).max(1);
export const helloSchema = z.object({
    type: z.literal('hello'),
    protocolVersion: z.number().int().min(0).max(1_000_000),
    clientVersion: z.string().min(1).max(LIMITS.maxClientVersionLength),
    /**
     * Identidade guardada no aparelho, para o jogo lembrar de quem voltou.
     *
     * Nao e autenticacao: quem tiver o token e a conta. Login de verdade entra
     * quando houver algo que valha proteger. Ausente = sessao sem progressao.
     */
    accountToken: z.string().min(16).max(128).optional(),
});
export const createRoomSchema = z.object({
    type: z.literal('create_room'),
    playerName: playerNameSchema,
});
export const joinRoomSchema = z.object({
    type: z.literal('join_room'),
    roomCode: roomCodeSchema,
    playerName: playerNameSchema,
    reconnectToken: reconnectTokenSchema.optional(),
});
/**
 * Escolha de classe, no lobby.
 *
 * Classes repetidas sao permitidas: CLAUDE.md nao restringe composicao.
 */
export const selectClassSchema = z.object({
    type: z.literal('select_class'),
    classId: z.enum(CLASS_IDS),
});
export const setReadySchema = z.object({
    type: z.literal('set_ready'),
    ready: z.boolean(),
});
export const inputSchema = z.object({
    type: z.literal('input'),
    seq: z.number().int().min(0).max(LIMITS.maxInputSeq),
    moveX: axisSchema,
    moveY: axisSchema,
    aimX: axisSchema,
    aimY: axisSchema,
});
/**
 * Intencao de atacar. O client manda para onde mirou; quem decide se acertou,
 * em quem e quanto doeu e o servidor.
 */
export const basicAttackSchema = z.object({
    type: z.literal('basic_attack'),
    aimX: axisSchema,
    aimY: axisSchema,
});
/**
 * Uso de habilidade.
 *
 * `active` liga e desliga as sustentadas (Escudo, Curativo). As instantaneas
 * disparam em `active: true` e ignoram o resto. A mira vai junto porque
 * algumas sao direcionais.
 */
export const useAbilitySchema = z.object({
    type: z.literal('use_ability'),
    active: z.boolean(),
    aimX: axisSchema,
    aimY: axisSchema,
});
/**
 * Uso do especial.
 *
 * Sempre instantaneo -- nao existe especial sustentado. A mira vai junto
 * porque varios sao direcionais, e o client nao sabe se aquele e um deles.
 */
export const useSpecialSchema = z.object({
    type: z.literal('use_special'),
    aimX: axisSchema,
    aimY: axisSchema,
});
/**
 * Escolha de melhoria, entre as que o servidor ofereceu.
 *
 * O servidor confere se a opcao estava mesmo na oferta: o client escolhe, nao
 * decide.
 */
export const chooseUpgradeSchema = z.object({
    type: z.literal('choose_upgrade'),
    upgradeId: z.string().min(1).max(40),
});
/**
 * Interacao contextual mantida. Hoje so reanima aliado caido; quando houver
 * balista e barricada, sera a mesma intencao.
 */
export const interactSchema = z.object({
    type: z.literal('interact'),
    active: z.boolean(),
});
export const pingSchema = z.object({
    type: z.literal('ping'),
    clientTime: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
export const clientMessageSchema = z.discriminatedUnion('type', [
    helloSchema,
    createRoomSchema,
    joinRoomSchema,
    selectClassSchema,
    setReadySchema,
    inputSchema,
    basicAttackSchema,
    useAbilitySchema,
    useSpecialSchema,
    chooseUpgradeSchema,
    interactSchema,
    pingSchema,
]);
/** Mensagens de gameplay usam um limite de taxa mais folgado que as de lobby. */
const GAMEPLAY_MESSAGE_TYPES = new Set([
    'input',
    'basic_attack',
    'use_ability',
    'use_special',
    'choose_upgrade',
    'interact',
    'ping',
]);
export function isGameplayMessageType(type) {
    return GAMEPLAY_MESSAGE_TYPES.has(type);
}
/**
 * Faz o parse de um frame cru vindo do socket.
 * Nunca lanca: qualquer entrada invalida vira `{ ok: false }`.
 */
export function parseClientMessage(raw) {
    let json;
    try {
        json = JSON.parse(raw);
    }
    catch {
        return { ok: false, reason: 'json invalido' };
    }
    const parsed = clientMessageSchema.safeParse(json);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const path = issue?.path.join('.') ?? '';
        return {
            ok: false,
            reason: path ? `${path}: ${issue?.message}` : (issue?.message ?? 'invalido'),
        };
    }
    return { ok: true, message: parsed.data };
}
export function isSupportedProtocolVersion(version) {
    return version === PROTOCOL_VERSION;
}
//# sourceMappingURL=client-messages.js.map