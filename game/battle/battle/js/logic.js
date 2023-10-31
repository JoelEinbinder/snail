import { moves } from "./moves";

/**
 * @param {PokemonDef} base
 * @return {Pokemon}
 */
export function createPokemon(base, level=5) {
  var IV = {
      hp: 0,
      attack: 0,
      defense: 0,
      spAttack: 0,
      spDefense: 0,
      speed: 0
  }
  var EV = {
      hp: Math.floor(32*Math.random()),
      attack: Math.floor(32*Math.random()),
      defense: Math.floor(32*Math.random()),
      spAttack: Math.floor(32*Math.random()),
      spDefense: Math.floor(32*Math.random()),
      speed: Math.floor(32*Math.random())
  }
  /** @type {"male"|"female"|"other"} */
  var gender = base.genderRatio === null ? "other" : (Math.random() < base.genderRatio ? "male" : "female");
  /** @type {Pokemon} */
  var p = Object.assign({
      critical: 0,
      level: 0,
      poison: 0,
      burn: 0,
      sleep: 0,
      freeze: 0,
      paralyze: 0,
      max: base.hp,
      base_hp: base.hp,
      nextExp: 0,
      moves: [],
      gender,
      exp: 0,
      volatile: {},
      IV, EV,
      PP: {}
  }, base);
  for (var i = 0; i < level; i++)
      forceLevelUp(p, true);
  p.hp = p.max;
  return p;
}


/**
 * Increases level, hp, and maybe autolearns moves
 * @param {Pokemon} pokemon
 * @param {boolean} autolearn
 */
export function forceLevelUp(pokemon, autolearn) {
  pokemon.level++;
  pokemon.exp = 0;
  pokemon.nextExp = nextExpForPokemon(pokemon.level, pokemon.levelType);
  recalcHP(pokemon);

  if (!autolearn)
      return;
  var slot = 0;
  var alreadyLearned = new Set();
  for (var [level, name] of pokemon.levelUp) {
      if (alreadyLearned.has(name))
          continue;
      if (level === pokemon.level)
          pokemon.moves[slot] = moveByName(/** @type {string} */(name));
      alreadyLearned.add(name);
      slot++;
      slot %= 4;
  }
}

function nextExpForPokemon(level, levelType) {
  return totalExpForPokemon(level + 1, levelType) - totalExpForPokemon(level, levelType);
}

function totalExpForPokemon(level, levelType) {
  var n3 = Math.pow(level, 3);
  switch (levelType) {
      case 0: //slow
          return Math.round(5 * n3 / 4 );
      case 1: // medium slow
          return Math.round(6 * n3 /5) - 15 * Math.pow(level, 2) + 100 * level - 140;
      case 2: // medium fast
          return n3;
      case 3: // fast
          return Math.round(4 * n3 / 5 );
      default:
          throw new Error('Unknown level type: ' + levelType);
  }
}

/**
* Needs to be called after updating HP EV or level
* The real game doesnt update hp after EV change, but I do because why not
* @param {Pokemon} pokemon
*/
function recalcHP(pokemon) {
  var EV = pokemon.EV.hp;
  var IV = pokemon.IV.hp;
  var hp = Math.floor(((baseStat(pokemon, "hp") + IV) * 2 + Math.floor(Math.ceil(Math.sqrt(EV)))) * pokemon.level / 100) + pokemon.level + 10;
  pokemon.hp += Math.max(hp - pokemon.max, 0);
  pokemon.max = hp;
}

/**
 * The stat number as defined in the pokemon definition
 * @param {Pokemon} pkm
 * @param {string} stat
 */
 export function baseStat(pkm, stat) {
  if (stat === 'hp')
    return pkm['base_hp'];
  return pkm[stat];
}

/**
 * @param {string} name
 * @return {Move}
 */
 export function moveByName(name) {
    return moves.find(move => move.name === name);
}
