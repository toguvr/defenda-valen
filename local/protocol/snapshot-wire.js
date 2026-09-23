/**
 * Formato compacto do snapshot.
 *
 * O snapshot sai 20 vezes por segundo para cada jogador e e, de longe, o maior
 * custo de banda do jogo -- medido: 5080 bytes com a sala cheia, 99 KB/s por
 * jogador, 595 KB/s numa sala de seis. O jogo e mobile-first, entao isso
 * importa em rede de celular.
 *
 * Tres coisas encolhem o formato, em ordem de ganho:
 *
 * 1. **Nomes de campo curtos.** Medido: 57% dos bytes eram nome de campo,
 *    repetido em cada entidade a cada snapshot.
 * 2. **Nada deduzivel vai no fio.** `ranged` e `maxHealth` de um invasor saem
 *    do tipo dele, que o client ja conhece. Mandar de novo e pagar por
 *    informacao que o outro lado ja tem.
 * 3. **Nada em falso vai no fio.** Booleano ausente e `false`, lista ausente e
 *    vazia. A maioria e falsa quase sempre.
 *
 * Continua JSON de proposito. Binario economizaria mais, mas ler um snapshot
 * no meio de uma investigacao e algo que ja salvou este projeto varias vezes.
 *
 * O mapa abaixo e o contrato. `snapshot-wire.test.ts` reprova se o codificador
 * sair dele.
 */
/** Nome curto -> nome longo. A tabela existe para poder ser verificada. */
export const WIRE_KEYS = {
    player: {
        i: 'id',
        x: 'x',
        y: 'y',
        ax: 'aimX',
        ay: 'aimY',
        h: 'health',
        s: 'state',
        r: 'reviveProgress',
        c: 'abilityCooldown',
        // Presentes so quando verdadeiros.
        d: 'connected (ausente = conectado)',
        t: 'rooted',
        b: 'abilityActive',
        p: 'specialActive',
        g: 'sheltered',
        o: 'operating',
        u: 'upgrades',
        wp: 'weaponId',
    },
    enemy: {
        i: 'id',
        k: 'kind',
        x: 'x',
        y: 'y',
        ax: 'aimX',
        ay: 'aimY',
        h: 'health',
        s: 'state',
        l: 'led',
        t: 'rooted',
        m: 'marked',
    },
    projectile: { i: 'id', x: 'x', y: 'y', dx: 'dirX', dy: 'dirY', v: 'team' },
    zone: {
        i: 'id',
        k: 'kind',
        x: 'x',
        y: 'y',
        d: 'radius',
        v: 'team',
        r: 'remaining',
        g: 'triggered',
    },
    structure: {
        i: 'id',
        k: 'kind',
        x: 'x',
        y: 'y',
        d: 'radius',
        v: 'team',
        h: 'health',
        n: 'maxHealth',
        c: 'condition',
        o: 'operated',
        ax: 'aimX',
        ay: 'aimY',
    },
    ground: {
        i: 'id',
        x: 'x',
        y: 'y',
        w: 'weaponId',
    },
    supply: {
        i: 'id',
        x: 'x',
        y: 'y',
        d: 'radius',
        p: 'progress',
    },
    companion: {
        i: 'id',
        w: 'ownerId',
        x: 'x',
        y: 'y',
        ax: 'aimX',
        ay: 'aimY',
        h: 'health',
        s: 'state',
        r: 'order',
        gx: 'guardX',
        gy: 'guardY',
        v: 'recovery',
    },
    gate: { h: 'health', n: 'maxHealth', c: 'condition', x: 'x', y: 'y', d: 'radius' },
    mission: {
        e: 'elapsedMs',
        d: 'durationMs',
        p: 'progress',
        f: 'phase',
        ai: 'assaultIndex',
        n: 'invadersInField',
        xp: 'teamXp',
        nx: 'nextUpgradeXp',
    },
};
/** Omite o que for falso, zero, vazio ou nulo. */
function put(target, key, value) {
    if (value === false || value === 0 || value === null || value === undefined)
        return;
    if (Array.isArray(value) && value.length === 0)
        return;
    target[key] = value;
}
export function encodeSnapshot(snapshot) {
    const wire = {
        type: 'world_snapshot',
        t: snapshot.tick,
        q: snapshot.lastProcessedInputSeq,
        P: snapshot.players.map((player) => {
            const out = {
                i: player.id,
                x: player.x,
                y: player.y,
                ax: player.aimX,
                ay: player.aimY,
                h: player.health,
                s: player.state,
            };
            // `connected` e verdadeiro quase sempre: vai ao contrario, so quando cai.
            put(out, 'd', !player.connected);
            put(out, 'r', player.reviveProgress);
            put(out, 'c', player.abilityCooldown);
            put(out, 't', player.rooted);
            put(out, 'b', player.abilityActive);
            put(out, 'p', player.specialActive);
            put(out, 'g', player.sheltered);
            put(out, 'o', player.operating);
            put(out, 'u', player.upgrades);
            put(out, 'wp', player.weaponId);
            return out;
        }),
        G: {
            h: snapshot.gate.health,
            n: snapshot.gate.maxHealth,
            c: snapshot.gate.condition,
            x: snapshot.gate.x,
            y: snapshot.gate.y,
            d: snapshot.gate.radius,
        },
        M: {
            e: snapshot.mission.elapsedMs,
            d: snapshot.mission.durationMs,
            p: snapshot.mission.progress,
            f: snapshot.mission.phase,
            ai: snapshot.mission.assaultIndex,
            n: snapshot.mission.invadersInField,
            xp: snapshot.mission.teamXp,
            nx: snapshot.mission.nextUpgradeXp,
        },
    };
    if (snapshot.enemies.length > 0) {
        wire.E = snapshot.enemies.map((enemy) => {
            // `ranged` e `maxHealth` saem do tipo: o client tem a mesma tabela.
            const out = {
                i: enemy.id,
                k: enemy.kind,
                x: enemy.x,
                y: enemy.y,
                ax: enemy.aimX,
                ay: enemy.aimY,
                h: enemy.health,
                s: enemy.state,
            };
            put(out, 'l', enemy.led);
            put(out, 't', enemy.rooted);
            put(out, 'm', enemy.marked);
            return out;
        });
    }
    if (snapshot.projectiles.length > 0) {
        wire.R = snapshot.projectiles.map((projectile) => ({
            i: projectile.id,
            x: projectile.x,
            y: projectile.y,
            dx: projectile.dirX,
            dy: projectile.dirY,
            v: projectile.team,
        }));
    }
    if (snapshot.zones.length > 0) {
        wire.Z = snapshot.zones.map((zone) => {
            const out = {
                i: zone.id,
                k: zone.kind,
                x: zone.x,
                y: zone.y,
                d: zone.radius,
                v: zone.team,
                r: zone.remaining,
            };
            put(out, 'g', zone.triggered);
            return out;
        });
    }
    if (snapshot.structures.length > 0) {
        wire.S = snapshot.structures.map((structure) => {
            const out = {
                i: structure.id,
                k: structure.kind,
                x: structure.x,
                y: structure.y,
                d: structure.radius,
                v: structure.team,
                h: structure.health,
                n: structure.maxHealth,
                c: structure.condition,
            };
            put(out, 'o', structure.operated);
            put(out, 'ax', structure.aimX);
            put(out, 'ay', structure.aimY);
            return out;
        });
    }
    if (snapshot.supplies.length > 0) {
        wire.U = snapshot.supplies.map((supply) => {
            const out = {
                i: supply.id,
                x: supply.x,
                y: supply.y,
                d: supply.radius,
            };
            put(out, 'p', supply.progress);
            return out;
        });
    }
    if (snapshot.ground.length > 0) {
        wire.I = snapshot.ground.map((item) => ({
            i: item.id,
            x: item.x,
            y: item.y,
            w: item.weaponId,
        }));
    }
    if (snapshot.companions.length > 0) {
        wire.C = snapshot.companions.map((companion) => {
            const out = {
                i: companion.id,
                w: companion.ownerId,
                x: companion.x,
                y: companion.y,
                ax: companion.aimX,
                ay: companion.aimY,
                h: companion.health,
                s: companion.state,
                r: companion.order,
            };
            put(out, 'gx', companion.guardX);
            put(out, 'gy', companion.guardY);
            put(out, 'v', companion.recovery);
            return out;
        });
    }
    return wire;
}
/**
 * Volta do formato do fio para a forma legivel.
 *
 * Existe para os testes lerem o que foi realmente enviado, e para qualquer
 * client em TypeScript. O teste de ida e volta usa os dois: se a tabela acima
 * e o codificador discordarem, ele reprova.
 *
 * O que foi omitido volta com o valor padrao, e o que era deduzivel do tipo e
 * reconstruido por `enemyProfile` -- os dois lados precisam concordar sobre o
 * que *nao* foi dito.
 */
export function decodeSnapshot(wire, enemyProfile, serverTime = 0) {
    const list = (value) => value ?? [];
    const num = (value, fallback = 0) => (typeof value === 'number' ? value : fallback);
    const str = (value, fallback = '') => (typeof value === 'string' ? value : fallback);
    const flag = (value) => value === true;
    return {
        type: 'world_snapshot',
        tick: wire.t,
        serverTime,
        lastProcessedInputSeq: wire.q,
        players: list(wire.P).map((player) => ({
            id: str(player.i),
            x: num(player.x),
            y: num(player.y),
            aimX: num(player.ax),
            aimY: num(player.ay),
            // `d` marca desconectado: ausente significa conectado.
            connected: !flag(player.d),
            maxHealth: 0,
            health: num(player.h),
            state: str(player.s, 'ready'),
            reviveProgress: num(player.r),
            rooted: flag(player.t),
            abilityActive: flag(player.b),
            specialActive: flag(player.p),
            sheltered: flag(player.g),
            operating: flag(player.o),
            upgrades: (Array.isArray(player.u) ? player.u : []),
            weaponId: str(player.wp),
            abilityCooldown: num(player.c),
        })),
        enemies: list(wire.E).map((enemy) => {
            const kind = str(enemy.k, 'soldado');
            const profile = enemyProfile(kind);
            return {
                id: str(enemy.i),
                kind: kind,
                ranged: profile.ranged,
                led: flag(enemy.l),
                x: num(enemy.x),
                y: num(enemy.y),
                aimX: num(enemy.ax),
                aimY: num(enemy.ay),
                health: num(enemy.h),
                maxHealth: profile.maxHealth,
                state: str(enemy.s, 'ready'),
                rooted: flag(enemy.t),
                marked: flag(enemy.m),
            };
        }),
        projectiles: list(wire.R).map((projectile) => ({
            id: str(projectile.i),
            x: num(projectile.x),
            y: num(projectile.y),
            dirX: num(projectile.dx),
            dirY: num(projectile.dy),
            team: str(projectile.v, 'invaders'),
        })),
        zones: list(wire.Z).map((zone) => ({
            id: str(zone.i),
            kind: str(zone.k, 'oleo'),
            x: num(zone.x),
            y: num(zone.y),
            radius: num(zone.d),
            team: str(zone.v, 'defenders'),
            remaining: num(zone.r),
            triggered: flag(zone.g),
        })),
        structures: list(wire.S).map((structure) => ({
            id: str(structure.i),
            kind: str(structure.k, 'barricada'),
            x: num(structure.x),
            y: num(structure.y),
            radius: num(structure.d),
            team: str(structure.v, 'defenders'),
            health: num(structure.h),
            maxHealth: num(structure.n),
            condition: str(structure.c, 'intact'),
            operated: flag(structure.o),
            aimX: num(structure.ax),
            aimY: num(structure.ay),
        })),
        supplies: list(wire.U).map((supply) => ({
            id: str(supply.i),
            x: num(supply.x),
            y: num(supply.y),
            radius: num(supply.d),
            progress: num(supply.p),
        })),
        ground: list(wire.I).map((item) => ({
            id: str(item.i),
            x: num(item.x),
            y: num(item.y),
            weaponId: str(item.w),
        })),
        companions: list(wire.C).map((companion) => ({
            id: str(companion.i),
            ownerId: str(companion.w),
            x: num(companion.x),
            y: num(companion.y),
            aimX: num(companion.ax),
            aimY: num(companion.ay),
            health: num(companion.h),
            maxHealth: 0,
            state: str(companion.s, 'ready'),
            order: str(companion.r, 'follow'),
            orderTargetId: null,
            guardX: typeof companion.gx === 'number' ? companion.gx : null,
            guardY: typeof companion.gy === 'number' ? companion.gy : null,
            recovery: num(companion.v),
        })),
        gate: {
            health: num(wire.G.h),
            maxHealth: num(wire.G.n),
            condition: str(wire.G.c, 'intact'),
            x: num(wire.G.x),
            y: num(wire.G.y),
            radius: num(wire.G.d),
        },
        mission: {
            elapsedMs: num(wire.M.e),
            durationMs: num(wire.M.d),
            progress: num(wire.M.p),
            phase: str(wire.M.f, 'assault'),
            assaultIndex: num(wire.M.ai),
            invadersInField: num(wire.M.n),
            teamXp: num(wire.M.xp),
            nextUpgradeXp: num(wire.M.nx),
        },
    };
}
//# sourceMappingURL=snapshot-wire.js.map