import { ARENA, ARQUEIRO, CAPITAO, INVADER_THREAT_RANGE } from '../../protocol/index.js';
import { isAlive } from '../domain/combatant.js';
import { isDestroyed } from '../domain/gate.js';
import { blockingStructure } from './collision.js';
import { clamp } from '../domain/vector.js';
import { beginAttack, canMove, canStartAttack } from './combat.js';
import { createProjectile } from './projectile.js';
/** Alvos validos: defensor de pe e presente. */
function isTargetable(body) {
    return (body.connected ?? true) && isAlive(body);
}
/**
 * Defensor mais proximo dentro de `maxDistance`.
 *
 * O limite entra aqui, e nao depois: quem escolhe precisa saber se achou
 * alguem *util*. Escolher o jogador mais proximo e so entao descobrir que ele
 * esta longe demais faria o invasor desistir de brigar com o cao que esta
 * mordendo ele.
 */
function nearestTarget(enemy, bodies, maxDistance) {
    let best = null;
    let bestDistance = maxDistance;
    for (const body of bodies) {
        if (!isTargetable(body))
            continue;
        const distance = Math.hypot(body.position.x - enemy.position.x, body.position.y - enemy.position.y);
        if (distance <= bestDistance) {
            bestDistance = distance;
            best = body;
        }
    }
    return best;
}
/**
 * Gente primeiro; o cao so e enfrentado quando ninguem mais esta a alcance.
 *
 * E o que torna a ordem uma decisao: manter o cao no calcanhar o protege,
 * manda-lo sozinho o expoe.
 */
function preferPeople(enemy, defenders, maxDistance) {
    return (nearestTarget(enemy, defenders.filter((body) => !body.secondaryTarget), maxDistance) ?? nearestTarget(enemy, defenders, maxDistance));
}
/**
 * Escolhe entre o portao e um defensor.
 *
 * Defensor dentro do raio de ameaca tem prioridade: quem se poe na frente e
 * atendido. Fora disso, o Soldado volta a bater no objetivo.
 */
function resolveTarget(enemy, defenders, gate, elapsedMs) {
    // O Ariete nao briga: ele so quer o portao. Por isso precisa ser parado no
    // caminho, e nao enfrentado quando ja chegou.
    if (enemy.objectiveOnly) {
        enemy.targetId = null;
        return isDestroyed(gate) ? null : gate;
    }
    enemy.retargetTimerMs -= elapsedMs;
    const current = defenders.find((body) => body.id === enemy.targetId);
    const currentStillThreatens = current !== undefined && isTargetable(current) && withinThreatRange(enemy, current);
    // Troca de alvo so no intervalo, ou quando o atual deixou de servir. Sem
    // isso o Soldado fica oscilando entre dois defensores equidistantes.
    if (currentStillThreatens && enemy.retargetTimerMs > 0)
        return current;
    enemy.retargetTimerMs = enemy.kind === 'ariete' ? 1000 : 600;
    const defender = preferPeople(enemy, defenders, INVADER_THREAT_RANGE);
    if (defender !== null) {
        enemy.targetId = defender.id;
        return defender;
    }
    enemy.targetId = null;
    return isDestroyed(gate) ? null : gate;
}
function withinThreatRange(enemy, body) {
    return (Math.hypot(body.position.x - enemy.position.x, body.position.y - enemy.position.y) <=
        INVADER_THREAT_RANGE);
}
/** Um passo de decisao e movimento de um invasor corpo a corpo. */
export function stepMeleeInvader(enemy, defenders, gate, elapsedMs) {
    const target = resolveTarget(enemy, defenders, gate, elapsedMs);
    if (target === null)
        return;
    // Anda para o ponto **mais proximo** da superficie do alvo, nao para o centro.
    //
    // Nao e refinamento: com o alvo em caixa, mirar o centro e medir ate a borda
    // sao duas direcoes diferentes, e na quina elas divergem. Andar `vao -
    // alcance` na direcao do centro encurta o vao por menos que isso, entao o
    // passo seguinte e menor, e o seguinte tambem -- o invasor converge para o
    // limiar sem nunca cruza-lo e fica parado sem bater. Medido na brecha
    // esquerda: parava em 648,256 com vao 54,03 contra alcance 54, e assim ficava
    // pelos 1200 ticks do teste. Andando para o ponto mais proximo, o vao cai um
    // para um e o limiar e alcancado.
    const aimPoint = closestSurfacePoint(enemy.position, target);
    const toTargetX = aimPoint.x - enemy.position.x;
    const toTargetY = aimPoint.y - enemy.position.y;
    const distance = Math.hypot(toTargetX, toTargetY);
    if (distance > 0) {
        // Encara o alvo mesmo durante a recuperacao: a postura comunica intencao.
        enemy.aim = { x: toTargetX / distance, y: toTargetY / distance };
    }
    // Medido da **superficie** do alvo, nao do centro mais um raio. Para o
    // portao, que e largo e baixo, o raio circunscrito parava o invasor a mais de
    // cem pixels de onde o portao esta desenhado -- ele batia de longe e ninguem
    // conseguia alcanca-lo para defender.
    const gap = surfaceGap(enemy.position, target);
    if (gap <= enemy.engageRange) {
        if (canStartAttack(enemy))
            beginAttack(enemy, enemy.aim);
        return;
    }
    moveTowardTarget(enemy, gap - enemy.engageRange, elapsedMs);
}
/**
 * Arqueiro: mantem distancia e atira.
 *
 * Recua quando o defensor encosta -- ele e fragil de perto, e essa e a
 * resposta do time: quem chega, resolve. Enquanto ninguem chega, e ele quem
 * torna insustentavel plantar a linha colada no portao.
 */
export function stepRangedInvader(enemy, defenders, gate, elapsedMs) {
    const target = resolveRangedTarget(enemy, defenders, gate, elapsedMs);
    if (target === null)
        return;
    const toTargetX = target.position.x - enemy.position.x;
    const toTargetY = target.position.y - enemy.position.y;
    const distance = Math.hypot(toTargetX, toTargetY);
    if (distance > 0) {
        enemy.aim = { x: toTargetX / distance, y: toTargetY / distance };
    }
    if (!canMove(enemy))
        return;
    if (distance < ARQUEIRO.minRange) {
        // Recua de costas para a ameaca, sem virar: continua encarando o alvo.
        moveTowardTarget(enemy, -(ARQUEIRO.minRange - distance), elapsedMs);
        return;
    }
    if (distance > ARQUEIRO.preferredRange) {
        moveTowardTarget(enemy, distance - ARQUEIRO.preferredRange, elapsedMs);
        return;
    }
    if (canStartAttack(enemy))
        beginAttack(enemy, enemy.aim);
}
/**
 * Alvo do Arqueiro.
 *
 * Prefere defensores em qualquer distancia dentro do alcance do tiro: e uma
 * unidade antipessoal. So vai ao portao quando nao ha ninguem para alvejar.
 */
function resolveRangedTarget(enemy, defenders, gate, elapsedMs) {
    enemy.retargetTimerMs -= elapsedMs;
    const current = defenders.find((body) => body.id === enemy.targetId);
    if (current !== undefined && isTargetable(current) && enemy.retargetTimerMs > 0)
        return current;
    enemy.retargetTimerMs = ARQUEIRO.retargetIntervalMs;
    // So persegue defensor que ja esta ao alcance util. Sem esse limite, o
    // Arqueiro atravessava o mapa atras de alguem e nunca ameacava o objetivo --
    // virava so uma fonte de dano em jogador, nunca pressao no portao.
    const defender = preferPeople(enemy, defenders, ARQUEIRO.shot.maxRange);
    if (defender !== null) {
        enemy.targetId = defender.id;
        return defender;
    }
    enemy.targetId = null;
    return isDestroyed(gate) ? null : gate;
}
/** Ponto logo a frente do invasor, usado para detectar obstaculo no caminho. */
function aheadOf(enemy) {
    const reach = enemy.engageRange + enemy.radius;
    return {
        x: enemy.position.x + enemy.aim.x * reach,
        y: enemy.position.y + enemy.aim.y * reach,
    };
}
/** Encara o obstaculo e golpeia quando puder. */
function faceAndStrike(enemy, target) {
    const dx = target.position.x - enemy.position.x;
    const dy = target.position.y - enemy.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0)
        enemy.aim = { x: dx / distance, y: dy / distance };
    if (canStartAttack(enemy))
        beginAttack(enemy, enemy.aim);
}
/** Anda `travel` unidades na direcao que o invasor encara. Negativo recua. */
/**
 * Distancia ate a superficie do alvo.
 *
 * Alvo com `halfExtents` e uma caixa: mede-se ate a borda dela. Sem isso,
 * continua sendo disco -- centro menos o raio, como sempre foi.
 */
/**
 * Ponto da superficie do alvo mais proximo de `from`.
 *
 * Para uma caixa e o ponto preso as bordas; para um disco, o centro deslocado
 * pelo raio -- que e a propria direcao do centro, entao nada muda para alvos
 * redondos. Dentro da caixa devolve o proprio ponto, e quem chama trata o
 * vetor nulo.
 */
function closestSurfacePoint(from, target) {
    const box = target.halfExtents;
    if (!box) {
        const dx = target.position.x - from.x;
        const dy = target.position.y - from.y;
        const distance = Math.hypot(dx, dy);
        if (distance === 0)
            return { ...target.position };
        return {
            x: target.position.x - (dx / distance) * target.radius,
            y: target.position.y - (dy / distance) * target.radius,
        };
    }
    return {
        x: clamp(from.x, target.position.x - box.x, target.position.x + box.x),
        y: clamp(from.y, target.position.y - box.y, target.position.y + box.y),
    };
}
function surfaceGap(from, target) {
    const box = target.halfExtents;
    if (!box) {
        return Math.hypot(target.position.x - from.x, target.position.y - from.y) - target.radius;
    }
    const overflowX = Math.max(0, Math.abs(from.x - target.position.x) - box.x);
    const overflowY = Math.max(0, Math.abs(from.y - target.position.y) - box.y);
    return Math.hypot(overflowX, overflowY);
}
function moveTowardTarget(enemy, travel, elapsedMs) {
    if (!canMove(enemy))
        return;
    const step = enemy.speed * (elapsedMs / 1000);
    const amount = travel >= 0 ? Math.min(step, travel) : Math.max(-step, travel);
    enemy.position = {
        x: clamp(enemy.position.x + enemy.aim.x * amount, enemy.radius, ARENA.width - enemy.radius),
        y: clamp(enemy.position.y + enemy.aim.y * amount, enemy.radius, ARENA.height - enemy.radius),
    };
}
/**
 * Comando do Capitao.
 *
 * Enquanto ele vive, quem esta por perto golpeia mais rapido. O efeito e de
 * ritmo, nao de atributo inflado -- e por isso que mata-lo primeiro vale a
 * pena, mesmo ele nao sendo o mais forte em campo.
 */
export function applyCommand(enemies) {
    const captains = enemies.filter((enemy) => enemy.commands && isAlive(enemy));
    for (const enemy of enemies) {
        const led = !enemy.commands &&
            isAlive(enemy) &&
            captains.some((captain) => Math.hypot(captain.position.x - enemy.position.x, captain.position.y - enemy.position.y) <= CAPITAO.auraRadius);
        if (led && !enemy.led) {
            // Encurta o proprio cooldown ao entrar sob comando; nao mexe no perfil,
            // para nao acumular efeito a cada tick.
            enemy.attackCooldownMs *= 1 - CAPITAO.auraCooldownReduction;
        }
        enemy.led = led;
    }
}
/** Um passo de decisao para qualquer invasor. */
export function stepInvader(enemy, defenders, gate, elapsedMs, terrainFactor = 1, structures = []) {
    if (!isAlive(enemy))
        return;
    // Barricada no caminho: para e bate. Cada segundo gasto quebrando madeira e
    // um segundo em que o objetivo nao esta sendo atacado -- e para isso que a
    // estrutura existe.
    const wall = blockingStructure(enemy.position, aheadOf(enemy), enemy.radius, structures);
    if (wall !== null) {
        faceAndStrike(enemy, wall);
        return;
    }
    // O terreno vale para os dois lados: oleo atrasa invasor tambem.
    const baseSpeed = enemy.speed;
    enemy.speed = baseSpeed * terrainFactor;
    try {
        if (enemy.ranged) {
            stepRangedInvader(enemy, defenders, gate, elapsedMs);
            return;
        }
        stepMeleeInvader(enemy, defenders, gate, elapsedMs);
    }
    finally {
        enemy.speed = baseSpeed;
    }
}
/**
 * O tiro do Arqueiro, disparado quando a antecipacao termina.
 *
 * Sai na direcao travada no inicio do golpe -- e pode acertar outro invasor
 * que tenha entrado na linha de tiro no meio da puxada.
 */
export function createArrowFor(enemy) {
    return createProjectile({
        ownerId: enemy.id,
        team: enemy.team,
        origin: {
            x: enemy.position.x + enemy.attackAim.x * (enemy.radius + 6),
            y: enemy.position.y + enemy.attackAim.y * (enemy.radius + 6),
        },
        direction: enemy.attackAim,
        speed: ARQUEIRO.shot.speed,
        maxRange: ARQUEIRO.shot.maxRange,
        radius: ARQUEIRO.shot.radius,
        damage: ARQUEIRO.shot.damage,
    });
}
/**
 * Conta o tempo do corpo em tela depois do abate.
 *
 * Devolve true quando o corpo deve ser removido. O atraso existe para o abate
 * ser legivel: sumir no mesmo frame do golpe esconde o resultado da acao.
 */
export function stepDespawn(enemy, elapsedMs) {
    if (isAlive(enemy))
        return false;
    enemy.despawnTimerMs -= elapsedMs;
    return enemy.despawnTimerMs <= 0;
}
//# sourceMappingURL=enemy-ai.js.map