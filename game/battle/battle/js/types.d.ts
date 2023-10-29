interface Move {
  name: string;
  type: string;
  category: "Physical" | "Special" | "Status";
  pp: number;
  power: number;
  accuracy: number;
  repeats?: number[],
  self?: StatusEffects,
  enemy?: StatusEffects,
  line?: string;
  next?: Move;
  flinch?: number;
  randomDamage?: boolean;
  hitsUnderground?: boolean;
  hitsUpHigh?: boolean;
  priority?: number;
  randomMove?: boolean;
  increasedCritical?: boolean;
  crashes?: boolean;
  enemyStatus?: "sleep"|"burn"|"poison";
  incomplete?: boolean;
}

interface StatusEffects {
  burn?: number;
  paralyze?: number;
  sleep?: number;
  poison?: number;
  freeze?: number;
  confuse?: number;
  attack?: number;
  defense?: number;
  spAttack?: number;
  spDefense?: number;
  speed?: number;
  accuracy?: number;
  evasion?: number;
  /** increases critical chance */
  critical?: number;
  heal?: number;
  /** Steals health */
  leech?: number;
  /** Leech seed */
  seed?: number;
  /** Does damage equal to level */
  levelDamage?: number;
  upHigh?: boolean;
  underground?: boolean;
  clearStatus?: boolean;
  disableLastMove?: boolean;
  resetStats?: boolean;
}

interface Pokemon {
  id: number;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
  levelType: number;
  baseExp: number;
  type: Array<string>;
  critical: number;
  level: number;
  max: number;
  poison: number;
  burn: number;
  sleep: number;
  freeze: number;
  paralyze: number;
  exp: number;
  nextExp: number;
  moves: Array<Move>;
  levelUp: Array<Array<string | number>>;
  learnable: Array<string>;
  volatile: Volatile
  gender: "male" | "female" | "other";
  IV: Stats;
  EV: Stats;
  /** this counts up not down */
  PP: {[key: string]: number};
}

type Stat = "attack"|"defense"|"spAttack"|"spDefense"|"speed"|"evasion"|"accuracy"|"critical"

interface Volatile {
  attack?: number;
  defense?: number;
  spAttack?: number;
  spDefense?: number;
  speed?: number;
  evasion?: number;
  accuracy?: number;
  critical?: number;
  confused?: number;
  seeded?: boolean;
  move?: Move;
  flinching?: number;
  underground?: boolean;
  upHigh?: boolean;
  disabled?: Map<Move, number>;
  lastMove?: Move;
}

interface Stats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

interface PokemonDef {
  id: number;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
  levelType: number;
  baseExp: number;
  type: Array<string>;
  levelUp: Array<Array<string | number>>;
  learnable: Array<string>;
  genderRatio: number;
  evolve?: number;
  thunderStone?: number;
  waterStone?: number;
  leafStone?: number;
  fireStone?: number;
  moonStone?: number;
  trade?: number;
  catchRate?: number;
  zombie?: boolean;
}

interface Heals {
  poison?: boolean;
  sleep?: boolean;
  burn?: boolean;
  paralyze?: boolean;
  freeze?: boolean;
  confuse?: boolean;
  heal?: number;
}

interface Item {
  name: string;
  price?: number;
  pocket: "balls"|"key"|"items";
  evolves?: boolean;
  heals?: Heals;
}

interface Battler {
  pokemon?: Pokemon;
  trainerName?: string;
  trainer?: number;
  party: Pokemon[];
  items?: Map<Item, number>;
}