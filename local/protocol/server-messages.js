export function encodeServerMessage(message) {
    return JSON.stringify(message);
}
export function errorMessage(code, message) {
    return { type: 'error', code, message };
}
//# sourceMappingURL=server-messages.js.map