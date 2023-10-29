import { animateDamage, animateExp, displayText, waitFor } from "../../gui";
import { playSound } from "../../sounds";
import { baseStat, moveByName } from "./logic";
import { moves } from "./moves";


/**
 * How much exp is given when killing this pokemon
 * @param {Pokemon} pokemon
 * @param {boolean} trainer whether its a trainer owned pokemon
 * @return {number}
 */
function expGainForPokemon(pokemon, trainer) {
    // todo 1.5 bonus if winning pokemon was traded
    return Math.round((trainer ? 1.5 : 1) * pokemon.baseExp * pokemon.level / 7);
}

/**
 * Gives exp + EV and does level up logic
 * @param {Pokemon} pokemon
 * @param {Pokemon} victim
 * @param {boolean} trainer
 */
export async function rewardKill(pokemon, victim, trainer) {
    if (pokemon.hp <= 0)
        return;
    for (var stat in pokemon.EV)
        pokemon.EV[stat] = Math.min(pokemon.EV[stat] + baseStat(victim, stat), 65535);
    await animateExp(pokemon, expGainForPokemon(victim, trainer));
    // recalcHP(pokemon);
}

/**
 * @param {Pokemon} pokemon
 * @return {Move}
 */
function pickRandomMove(pokemon) {
    if (pokemon.volatile.move)
        return pokemon.volatile.move;
    var availableMoves = [];
    for (var move of pokemon.moves) {
        if ((pokemon.PP[move.name] || 0) < move.pp &&
            !(pokemon.volatile.disabled && pokemon.volatile.disabled.get(move)))
            availableMoves.push(move);
    }
    if (availableMoves.length)
        return availableMoves[(availableMoves.length * Math.random()) | 0];
    return moveByName("Struggle");
}

/**
 * @param {Move} move
 * @param {Pokemon} myPokemon
 * @param {Pokemon} enemyPokemon
 */
export async function turn(move, myPokemon, enemyPokemon) {
    var move1 = move;
    var move2 = pickRandomMove(enemyPokemon);

    var priority = ((move1 && move1.priority) || 0) - ((move2 && move2.priority) || 0);
    if (priority !== 0 ? priority > 0 : computeStat(myPokemon, 'speed', false) > computeStat(enemyPokemon, 'speed', false)) {
        await doMove(move1, myPokemon, enemyPokemon);
        await doMove(move2, enemyPokemon, myPokemon);
        await doStatusEffects(myPokemon, enemyPokemon);
        await doStatusEffects(enemyPokemon, myPokemon);
    }
    else {
        await doMove(move2, enemyPokemon, myPokemon);
        await doMove(move1, myPokemon, enemyPokemon);
        await doStatusEffects(enemyPokemon, myPokemon);
        await doStatusEffects(myPokemon, enemyPokemon);
    }
}

/**
 * @param {Pokemon} myPokemon
 * @param {Pokemon} enemyPokemon
 * @param {number} attempt
 */
export async function attemptEscape(myPokemon, enemyPokemon, attempt) {
    const a = computeStat(myPokemon, 'speed', false);
    const b = computeStat(enemyPokemon, 'speed', false) / 4;
    const f = (a * 32) / b + 30 * attempt;
    return (Math.random() * 255 < f);
}

async function log(...args) {
    await displayText(args.join(' '));
}

/**
 * @param {Move} move
 * @param {Pokemon} attacker
 * @param {Pokemon} victim
 */
async function doMove(move, attacker, victim) {
    if (!move)
        return;
    if (attacker.hp <= 0)
        return;
    if (victim.hp <= 0)
        return;

    if (attacker.freeze) {
        if (Math.random() < 0.1) {
            await log(attacker.name + '\nthawed out!');
            attacker.freeze = 0;
        } else {
            await log(attacker.name + '\nis frozen solid!');
        }
        return;
    }

    if (attacker.paralyze) {
        await log(attacker.name +'\'s\nparalyzed! It may not attack!')
        if (Math.random() < 0.25) {
            await log(attacker.name + '\nis fully paralyzed!');
            return;
        }
    }

    if (attacker.sleep) {
        attacker.sleep -= 0.2;
        var turn = 5 - attacker.sleep * 5;
        let chance = 0;
        switch (turn) {
            case 3:
                chance = 1 / 3;
                break;
            case 4:
                chance = 1 / 2;
                break;
            case 5:
                chance = 1;
                break;
        }
        if (Math.random() > chance) {
            await log(attacker.name + ' is fast\nasleep.');
            return;
        }
        await log(attacker.name + '\nwoke up!');
        attacker.sleep = 0;
    }

    if (attacker.volatile.flinching) {
        if (Math.random() < attacker.volatile.flinching) {
            await log(attacker.name + '\nflinched!');
            return;
        }
    }

    if (attacker.volatile.confused) {
        await log(attacker.name + ' is\nconfused!');
        attacker.volatile.confused--;
        if (!attacker.volatile.confused) {
            await log(attacker.name + ' is\nconfused no more!');
        } else if (Math.random() < 0.5) {
            await log('It hurt itself in its\nconfusion!');
            await doDamage({
                name: "HurtItself",
                pp: 1,
                accuracy: null,
                power: 40,
                type: "StruggleType",
                category: "Physical"
            }, attacker, attacker, false);
            return;
        }
    }

    // move is used

    attacker.volatile.lastMove = move;
    attacker.PP[move.name] = (attacker.PP[move.name] || 0) + 1;

    if (move.line)
        await log(attacker.name + move.line);
    else
        await log(attacker.name + " used\n" + move.name.toUpperCase() + "!");

    if (move.randomMove) {
        while (move.randomMove)
            move = moves[Math.floor(Math.random() * moves.length)];
        await log(attacker.name + " used\n" + move.name.toUpperCase() + "!");
    }

    attacker.volatile.upHigh = false;
    attacker.volatile.underground = false;

    if (move.accuracy) {
        var missChance = move.accuracy * computeStat(attacker, 'accuracy', false) / computeStat(victim, 'evasion', false);
        if (Math.random() > missChance ||
            (victim.volatile.upHigh && !move.hitsUpHigh) ||
            (victim.volatile.underground && !move.hitsUnderground) ||
            (move.enemyStatus && !victim[move.enemyStatus])) {
            await log(attacker.name + '\'s\nattack missed!');
            if (move.crashes)
                await animateDamage(attacker, Math.floor(attacker.max / 8));
            return;
        }
    }

    var repeats = move.repeats || [1];
    var times = 0;
    var somethingHappened = false;

    if (move.next) {
        somethingHappened = true;
        attacker.volatile.move = move.next;
    } else {
        if (attacker.volatile.move && move.line)
            somethingHappened = true;
        delete attacker.volatile.move;
    }

    for (var chance of repeats) {
        if (victim.hp <= 0)
            break;
        if (Math.random() > chance)
            break;

        var critical = false;
        var critChance = 0.5;
        var critNumber = 0;
        if (attacker.volatile.critical)
            critNumber += attacker.volatile.critical;
        if (move.increasedCritical)
            critNumber += 1;
        switch (critNumber) {
            case 0:
                critChance = 1 / 16;
                break;
            case 1:
                critChance = 1 / 8;
                break;
            case 2:
                critChance = 1 / 4;
                break;
            case 3:
                critChance = 1 / 3;
                break;
        }
        if (Math.random() < critChance)
            critical = true;

        var damage = await doDamage(move, attacker, victim, critical);
        if (damage !== null) {
            somethingHappened = true;
            times++;
        } else {
            damage = 0;
        }

        // For Psywave
        if (move.randomDamage) {
            await animateDamage(victim, Math.min(1, Math.floor((Math.random() + .5) * attacker.level)));
            somethingHappened = true;
        }

        for (var { to, from } of [{ to: victim, from: move.enemy }, { to: attacker, from: move.self }]) {
            if (!from || to.hp <= 0)
                continue;
            somethingHappened = await applyStatModifier('attack', 'ATTACK', from, to) || somethingHappened;
            somethingHappened = await applyStatModifier('defense', 'DEFENSE', from, to) || somethingHappened;
            somethingHappened = await applyStatModifier('spAttack', 'SP. ATK', from, to) || somethingHappened;
            somethingHappened = await applyStatModifier('spDefense', 'SP. DEF', from, to) || somethingHappened;
            somethingHappened = await applyStatModifier('speed', 'SPEED', from, to) || somethingHappened;
            somethingHappened = await applyStatModifier('accuracy', 'ACCURACY', from, to) || somethingHappened;
            somethingHappened = await applyStatModifier('evasion', 'EVASION', from, to) || somethingHappened;
            somethingHappened = await applyStatModifier('evasion', 'EVASION', from, to) || somethingHappened;
            somethingHappened = await applyStatModifier('critical', 'CRITICAL', from, to) || somethingHappened;

            if (from.clearStatus)
                somethingHappened = await clearStatus(to) || somethingHappened;

            if (from.heal && (from.heal > 0 || move.type !== 'Ground' || to.type.indexOf('Flying') === -1)) {
                var beforeHp = to.hp;
                await animateDamage(to, -from.heal * to.max);
                if (beforeHp !== to.hp)
                    somethingHappened = true;
            }

            if (from.leech) {
                var beforeHp = to.hp;
                await animateDamage(to, -Math.round(from.leech * damage));
                if (beforeHp !== to.hp)
                    somethingHappened = true;
            }

            if (!to.volatile.confused && Math.random() < from.confuse) {
                to.volatile.confused = Math.floor(Math.random() * 4) + 2;
                await displayText(victim.name + '\nwas confused!');
                somethingHappened = true;
            }

            if (!to.volatile.seeded && to.type.indexOf("Grass") === -1 && Math.random() < from.seed) {
                to.volatile.seeded = true;
                await displayText(victim.name + '\nwas seeded!');
                somethingHappened = true;
            }

            if (from.levelDamage) {
                var beforeHp = to.hp;
                await animateDamage(to, Math.round(from.levelDamage * attacker.level));
                if (beforeHp !== to.hp)
                    somethingHappened = true;
            }

            if (from.upHigh) {
                to.volatile.upHigh = true;
                somethingHappened = true;
            }

            if (from.underground) {
                to.volatile.underground = true;
                somethingHappened = true;
            }

            if (from.disableLastMove && to.volatile.lastMove) {
                if (!to.volatile.disabled)
                    to.volatile.disabled = new Map();
                to.volatile.disabled.set(to.volatile.lastMove, Math.floor(Math.random() * 4) + 2);
                await log(to.name + '\'s', to.volatile.lastMove.name, '\nwas disabled!');
                somethingHappened = true;
            }

            if (from.resetStats) {
                to.volatile.attack = 0;
                to.volatile.defense = 0;
                to.volatile.spAttack = 0;
                to.volatile.spDefense = 0;
                to.volatile.critical = 0;
                to.volatile.speed = 0;
                to.volatile.evasion = 0;
                to.volatile.speed = 0;
                await log(to.name + ' had all\nstat changes eliminated!');
                somethingHappened = true;
            }

            somethingHappened = await applyStatus('burn', from, to) || somethingHappened;
            somethingHappened = await applyStatus('freeze', from, to) || somethingHappened;
            somethingHappened = await applyStatus('sleep', from, to) || somethingHappened;
            somethingHappened = await applyStatus('poison', from, to) || somethingHappened;
            somethingHappened = await applyStatus('paralyze', from, to) || somethingHappened;
        }
    }
    if (!somethingHappened)
        await log("Nothing happened...");
    if (times > 1)
        await log("Hit", times, "times!");


    /**
     * @param {Stat} stat
     * @param {string} name
     * @param {StatusEffects} from
     * @param {Pokemon} to
     */
    async function applyStatModifier(stat, name, from, to) {
        if (!from[stat])
            return false;
        to.volatile[stat] |= 0;
        var before = to.volatile[stat];
        to.volatile[stat] += from[stat];
        to.volatile[stat] = Math.max(Math.min(to.volatile[stat], 6), -6);
        if (victim.volatile[stat] === before) {
            if (from[stat] > 0)
                await log(to.name + '\'s ' + name + '\nwon\'t go higher!');
            else
                await log(to.name + '\'s ' + name + '\nwon\'t go any lower!');
            return true;
        }
        if (from[stat] === 1)
            await log(to.name + '\'s ' + name + '\nrose!');
        else if (from[stat] > 1)
            await log(to.name + '\'s ' + name + '\nsharply rose!');
        else if (from[stat] === -1)
            await log(to.name + '\'s ' + name + '\nfell!');
        else if (from[stat] < -1)
            await log(to.name + '\'s ' + name + '\nharshly fell!');
        return true;
    }

    /**
     * @param {"freeze"|"sleep"|"poison"|"burn"|"paralyze"} status
     * @param {StatusEffects} from
     * @param {Pokemon} to
     */
    async function applyStatus(status, from, to) {
        if (status === "burn" && to.type.some(type => type === "Fire"))
            return false;
        if (status === "poison" && to.type.some(type => type === "Poison" || type === "Steel"))
            return false;
        if (!from[status] || from[status] < Math.random() || statusForPokemon(to))
            return false;
        to[status] = 1;
        return true;
    }
}

/**
 * Does the damage
 * @param {Move} move
 * @param {Pokemon} attacker
 * @param {Pokemon} victim
 * @param {boolean} critical
 * @return {Promise<number>}
 */
async function doDamage(move, attacker, victim, critical) {
    var damage = 0;
    if (move.power === null)
        damage = 0;
    else if (move.category == "Physical")
        damage = (((2 * attacker.level / 5) + 2) * move.power * computeStat(attacker, 'attack', critical) / computeStat(victim, 'defense', critical)) / 50 + 2;
    else if (move.category === "Special")
        damage = (((2 * attacker.level / 5) + 2) * move.power * computeStat(attacker, 'spAttack', critical) / computeStat(victim, 'spDefense', critical)) / 50 + 2;
    else if (move.category === "Status")
        damage = 0;
    else
        console.error("Unknown move category:", move.category);

    if (!damage)
        return null;
    //stab
    for (var i = 0; i < attacker.type.length; i++)
        if (move.type == attacker.type[i])
            damage *= 1.5;

    //type effictiveness
    var typeMult = 1;
    for (var i = 0; i < victim.type.length; i++)
        typeMult *= typeEffect(move.type, victim.type[i]);
    damage *= typeMult;

    if (critical)
        damage *= 2;

    if (victim.volatile.upHigh && move.hitsUpHigh)
        damage *= 2;

    if (victim.volatile.underground && move.hitsUnderground)
        damage *= 2;

    if (attacker.burn && move.category === "Physical")
        damage *= 0.5;

    // randomize
    damage *= (Math.random() * 0.15) + 0.85;
    damage = Math.floor(damage);

    // animate the attack
    await waitFor(30);
    if (damage > 0) {
        if (typeMult >= 2.0)
            playSound('hit_super');
        else if (typeMult >= 1.0)
            playSound('hit_regular');
        else
            playSound('hit_weak');
    }

    await animateDamage(victim, damage);

    if (critical)
        await log("A critical hit!");

    if (typeMult >= 2.0)
        await log("It's super effective!");
    else
        if (typeMult <= 0.0)
            await log("It doesn't affect " + victim.name);
        else if (typeMult < 1.0)
            await log("It's not very effective..");

    if (damage)
        victim.volatile.flinching = move.flinch;

    if (damage && victim.hp >= 0 && victim.freeze && attacker.type.some(type => type === "Fire")) {
        victim.freeze = 0;
        await log(victim.name + '\n thawed out!');
    }
    return damage;
}

/**
 * @param {Pokemon} pokemon
 * @param {Pokemon} other
 */
async function doStatusEffects(pokemon, other) {
    pokemon.volatile.flinching = 0;
    if (pokemon.hp <= 0)
        return;
    if (pokemon.poison) {
        await log(pokemon.name + ' is hurt\nby poison!');
        playSound('poison');
        await animateDamage(pokemon, Math.round(pokemon.max / 8));
    }
    if (pokemon.hp <= 0)
        return;
    if (pokemon.burn) {
        await log(pokemon.name + ' is hurt\nby its burn!');
        await animateDamage(pokemon, Math.round(pokemon.max / 8));
    }
    if (pokemon.hp <= 0)
        return;
    if (pokemon.volatile.seeded && other.hp > 0) {
        var damage = Math.floor(pokemon.max / 8);
        await animateDamage(pokemon, damage);
        await animateDamage(other, -damage);
        await log(pokemon.name + '\'s health is\nsapped by LEECH SEED!');
    }
    if (pokemon.volatile.disabled) {
        for (var [move, value] of pokemon.volatile.disabled) {
            if (value - 1)
                pokemon.volatile.disabled.set(move, value - 1);
            else
                pokemon.volatile.disabled.delete(move);
        }
        if (!pokemon.volatile.disabled.size)
            delete pokemon.volatile.disabled;
    }
}

/**
 * @param {Pokemon} pokemon
 */
function clearStatus(pokemon) {
    var hadStatus = !statusForPokemon(pokemon);
    pokemon.burn = 0;
    pokemon.freeze = 0;
    pokemon.paralyze = 0;
    pokemon.poison = 0;
    pokemon.sleep = 0;
    return hadStatus;
}

/**
 * @param {Pokemon} pokemon
 * @return {number}
 */
export function statusForPokemon(pokemon) {
    // if (pokemon.hp <= 0)
    //     return 6;
    if (pokemon.poison)
        return 1;
    if (pokemon.burn)
        return 2;
    if (pokemon.paralyze)
        return 3;
    if (pokemon.sleep)
        return 4;
    if (pokemon.freeze)
        return 5;
    return 0;
}

/**
 * Computes a stat with battle modifiers
 * @param {Pokemon} pokemon
 * @param {Stat} stat
 * @param {boolean} critical
 */
function computeStat(pokemon, stat, critical) {
    var above = pokemon.volatile[stat] > 0 ? pokemon.volatile[stat] : 0;
    var below = pokemon.volatile[stat] < 0 ? -pokemon.volatile[stat] : 0;
    switch (stat) {
        case 'attack':
        case 'spAttack':
            if (critical)
                return computeRawStat(pokemon, stat) * (2 + above) / 2;
            return computeRawStat(pokemon, stat) * (2 + above) / (2 + below);

        case 'defense':
        case 'spDefense':
            if (critical)
                return computeRawStat(pokemon, stat) * 2 / (2 + below);
            return computeRawStat(pokemon, stat) * (2 + above) / (2 + below);

        case 'speed':
            return (pokemon.paralyze ? .25 : 1) * computeRawStat(pokemon, stat) * (2 + above) / (2 + below);

        case 'accuracy':
            return (3 + above) / (3 + below);

        case 'evasion':
            return (3 + below) / (3 + above);

        default:
            throw new Error('unknown stat:' + stat);
    }
}

/**
 * Compute a stat without battle modifiers
 * @param {Pokemon} pokemon
 * @param {string} stat
 * @return {number}
 */
function computeRawStat(pokemon, stat) {
    if (stat === 'hp')
        throw new Error('Dont use this for hp, use .max');
    var EV = 0;
    var IV = 0;
    return Math.floor(((baseStat(pokemon, stat) + IV) * 2 + Math.floor(Math.ceil(Math.sqrt(EV))/4)) * pokemon.level / 100) + 5;
}



function typeEffect(moveType, victType) {
    if (moveType === "StruggleType")
        return 1;
    var typeEffect = [
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.5, 0.0, 1.0, 1.0, 0.5],
    [1.0, 0.5, 0.5, 2.0, 1.0, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 0.5, 1.0, 0.5, 1.0, 2.0],
    [1.0, 2.0, 0.5, 0.5, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 1.0, 1.0, 2.0, 1.0, 0.5, 1.0, 1.0],
    [1.0, 0.5, 2.0, 0.5, 1.0, 1.0, 1.0, 0.5, 2.0, 0.5, 1.0, 0.5, 2.0, 1.0, 0.5, 1.0, 0.5],
    [1.0, 1.0, 2.0, 0.5, 0.5, 1.0, 1.0, 1.0, 0.0, 2.0, 1.0, 1.0, 1.0, 1.0, 0.5, 1.0, 1.0],
    [1.0, 0.5, 0.5, 2.0, 1.0, 0.5, 1.0, 1.0, 2.0, 2.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 0.5],
    [2.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 0.5, 1.0, 0.5, 0.5, 0.5, 0.5, 2.0, 0.0, 2.0, 2.0],
    [1.0, 1.0, 1.0, 2.0, 1.0, 1.0, 1.0, 0.5, 0.5, 1.0, 1.0, 1.0, 0.5, 0.5, 1.0, 1.0, 0.0],
    [1.0, 2.0, 1.0, 0.5, 2.0, 1.0, 1.0, 2.0, 1.0, 0.0, 1.0, 0.5, 2.0, 1.0, 1.0, 1.0, 2.0],
    [1.0, 1.0, 1.0, 2.0, 0.5, 1.0, 2.0, 1.0, 1.0, 1.0, 1.0, 2.0, 0.5, 1.0, 1.0, 1.0, 0.5],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 2.0, 1.0, 1.0, 0.5, 1.0, 1.0, 1.0, 1.0, 0.0, 0.5],
    [1.0, 0.5, 1.0, 2.0, 1.0, 1.0, 0.5, 0.5, 1.0, 0.5, 2.0, 1.0, 1.0, 0.5, 1.0, 2.0, 0.5],
    [1.0, 2.0, 1.0, 1.0, 1.0, 2.0, 0.5, 1.0, 0.5, 2.0, 1.0, 2.0, 1.0, 1.0, 1.0, 1.0, 0.5],
    [0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 1.0, 2.0, 1.0, 0.5, 0.5],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 0.5],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.5, 1.0, 1.0, 1.0, 2.0, 1.0, 1.0, 2.0, 1.0, 0.5, 0.5],
    [1.0, 0.5, 0.5, 1.0, 1.0, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 1.0, 1.0, 0.5]];

    var types = ["Normal", "Fire", "Water", "Grass", "Electr", "Ice", "Fight", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel"];
    return typeEffect[types.indexOf(moveType)][types.indexOf(victType)];
}
