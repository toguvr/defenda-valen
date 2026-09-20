import { COMBAT } from '../../protocol/index.js';
import { isAlive } from '../domain/combatant.js';
import { roundForWire } from '../domain/vector.js';
import { shieldReduction } from './ability.js';
import { incomingDamageFactor, outgoingDamageFactor } from './special.js';
import { upgradeFriendlyFireFactor } from './progression.js';
/**
 * O alvo esta dentro do arco do atacante?
 *
 * Funcao pura e exportada de proposito: e a regra que o jogador precisa
 * conseguir prever olhando a tela, entao merece teste direto. O client espelha
 * esta conta em `combat_rules.gd` para desenhar o preview.
 */
export function isWithinArc(origin, aim, target, targetRadius, profile) {
    const toTargetX = target.x - origin.x;
    const toTargetY = target.y - origin.y;
    const distance = Math.hypot(toTargetX, toTargetY);
    // O raio do alvo conta: encostar a borda ja e acerto.
    if (distance > profile.range + targetRadius)
        return false;
    // Alvo em cima do atacante: sempre acerta, nao ha angulo definido.
    if (distance === 0)
        return true;
    const aimMagnitude = Math.hypot(aim.x, aim.y);
    if (aimMagnitude === 0)
        return false;
    const halfArc = ((profile.arcDegrees / 2) * Math.PI) / 180;
    const cosine = (toTargetX * aim.x + toTargetY * aim.y) / (distance * aimMagnitude);
    // Margem angular proporcional ao raio do alvo, senao a borda do corpo
    // ficaria dentro do arco visualmente mas fora na conta.
    const angularSlack = Math.atan2(targetRadius, Math.max(distance, 1));
    return Math.acos(Math.min(1, Math.max(-1, cosine))) <= halfArc + angularSlack;
}
/**
 * Dano aplicado ao alvo.
 *
 * Acertar do proprio time custa menos, mas custa. O multiplicador e o
 * parametro de balanceamento mais sensivel do jogo.
 */
export function damageFor(profile, friendly) {
    const raw = friendly ? profile.damage * COMBAT.friendlyFireMultiplier : profile.damage;
    return Math.max(1, Math.round(raw));
}
/**
 * Aplica o golpe do atacante contra os candidatos e devolve os acertos.
 *
 * Nao verifica cooldown nem estado do atacante: quem chama ja decidiu que o
 * golpe saiu.
 */
export function resolveAttack(attacker, candidates) {
    const hits = [];
    for (const target of candidates) {
        if (target.id === attacker.id)
            continue;
        // Nao bate em quem ja caiu: transformaria um erro em punicao dupla, e
        // permitiria "finalizar" um aliado caido em vez de socorre-lo.
        if (!isAlive(target))
            continue;
        if (!isWithinArc(attacker.position, attacker.attackAim, target.position, target.radius, attacker.attack)) {
            continue;
        }
        const friendly = target.team === attacker.team;
        // O portao e o exemplo: aliado nao derruba o proprio objetivo por erro
        // de mira. Quem decide isso e o alvo, nao o atacante.
        if (friendly && !target.damagedByAllies)
            continue;
        // O escudo so vale contra o que vem de frente: posicionar e a decisao.
        const reduction = shieldReduction(target, attacker.position.x, attacker.position.y);
        const damage = Math.max(1, Math.round(damageFor(attacker.attack, friendly) *
            (1 - reduction) *
            outgoingDamageFactor(attacker) *
            incomingDamageFactor(target) *
            // Maos Firmes so vale para o que acerta aliado.
            (friendly ? upgradeFriendlyFireFactor(attacker) : 1)));
        target.health = Math.max(0, target.health - damage);
        // Zera o relogio da recuperacao: quem esta apanhando nao se recupera.
        if ('msSinceDamage' in target)
            target.msSinceDamage = 0;
        const incapacitated = target.health === 0;
        if (incapacitated) {
            target.combatState = 'incapacitated';
            // Estruturas nao tem golpe em andamento para cancelar.
            if ('attackTimerMs' in target)
                target.attackTimerMs = 0;
        }
        hits.push({ targetId: target.id, targetTeam: target.team, damage, friendly, incapacitated });
    }
    return {
        attackerId: attacker.id,
        attackerTeam: attacker.team,
        originX: roundForWire(attacker.position.x),
        originY: roundForWire(attacker.position.y),
        aimX: roundForWire(attacker.attackAim.x),
        aimY: roundForWire(attacker.attackAim.y),
        range: attacker.attack.range,
        arcDegrees: attacker.attack.arcDegrees,
        hits,
    };
}
/**
 * Avanca a maquina de estados de combate de um combatente em um tick.
 *
 * Devolve o golpe quando a antecipacao termina neste tick, senao null. Manter
 * isso no tick (em vez de resolver na chegada da mensagem) e o que garante que
 * a antecipacao existe de verdade e que golpes simultaneos sao resolvidos na
 * mesma ordem para todo mundo.
 */
export function stepCombat(combatant, candidates, elapsedMs) {
    if (combatant.attackCooldownMs > 0) {
        combatant.attackCooldownMs = Math.max(0, combatant.attackCooldownMs - elapsedMs);
    }
    if (combatant.combatState === 'incapacitated')
        return null;
    if (combatant.combatState === 'winding_up') {
        combatant.attackTimerMs -= elapsedMs;
        if (combatant.attackTimerMs > 0)
            return null;
        const attack = resolveAttack(combatant, candidates);
        combatant.combatState = 'recovering';
        combatant.attackTimerMs = combatant.attack.recoveryMs;
        return attack;
    }
    if (combatant.combatState === 'recovering') {
        combatant.attackTimerMs -= elapsedMs;
        if (combatant.attackTimerMs <= 0) {
            combatant.combatState = 'ready';
            combatant.attackTimerMs = 0;
        }
    }
    return null;
}
/** O combatente pode iniciar um golpe agora? */
export function canStartAttack(combatant) {
    return combatant.combatState === 'ready' && combatant.attackCooldownMs <= 0;
}
/** Inicia a antecipacao do golpe com a mira informada. */
export function beginAttack(combatant, aim) {
    if (!canStartAttack(combatant))
        return false;
    const magnitude = Math.hypot(aim.x, aim.y);
    // Mira nula nao cancela o golpe: usa a ultima direcao valida do corpo.
    combatant.attackAim =
        magnitude === 0 ? { ...combatant.aim } : { x: aim.x / magnitude, y: aim.y / magnitude };
    combatant.combatState = 'winding_up';
    combatant.attackTimerMs = combatant.attack.windupMs;
    combatant.attackCooldownMs = combatant.attack.cooldownMs;
    return true;
}
/** Quem esta golpeando ou caido nao anda: o golpe e um compromisso. */
export function canMove(combatant) {
    return combatant.combatState === 'ready';
}
//# sourceMappingURL=combat.js.map