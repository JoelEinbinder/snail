import { JoelEvent } from "../slug/cdp-ui/JoelEvent";
import { createPokemon, forceLevelUp } from "./battle/battle/js/logic";
import { moves } from './battle/battle/js/moves';
const storage_room: DungeonDescriptor = {
  type: 'directory',
  children: {
    'treasure.chest': {
      type: 'file',
      content: 'A treasure chest.',
      open: (stdout, stderr) => {
        stdout.write('You open the chest and find a healing_potion!\r\n');
        dungeon.giveItem('healing_potion');
        return 0;
      }
    }
  },
}

function createMonster(params: { name: string, element: (typeof types)[number], level: number }): Monster {
  const bst = 450;
  const stats = [];
  let total = 0;
  for (let i = 0; i < 6; i++) {
    const number = Math.random() + 1;
    total += number;
    stats.push(number);
  }
  for (let i = 0; i < 6; i++)
    stats[i] = Math.floor(stats[i] / total * bst) + 1;
  const completeMoves = moves.filter(x => !x.incomplete);
  function pickRandomMove(predicate: (move: Move) => boolean) {
    const filtered = completeMoves.filter(predicate);
    const move = filtered[Math.floor(Math.random() * filtered.length)];
    const index = completeMoves.indexOf(move);
    completeMoves.splice(index, 1);
    return move.name;
  }
  return {
    bytes: params.level,
    element: params.element,
    stats: createPokemon({
      name: params.name,
      attack: stats[0],
      defense: stats[1],
      spAttack: stats[2],
      spDefense: stats[3],
      speed: stats[4],
      hp: stats[5],
      baseExp: 267,
      genderRatio: null,
      levelType: 1,
      learnable: [],
      type: [params.element],
      id: 1,
      levelUp: [
        [1, pickRandomMove(move => move.type === params.element)],
        [1, pickRandomMove(move => move.power !== null && (move.type === 'Normal' || move.type === params.element))],
        [1, pickRandomMove(move => move.power === null && (move.type === 'Normal' || move.type === params.element))],
      ],
    }, params.level),
  }
}

function createPlayer(params: { name: string, level: number }): Pokemon {
  const elements = ['Fire', 'Water', 'Fight'] as const;
  const element = elements[Math.floor(Math.random() * elements.length)];

  const bst = 500;
  const stats = [];
  let total = 0;
  for (let i = 0; i < 6; i++) {
    const number = Math.random() + 1;
    total += number;
    stats.push(number);
  }
  for (let i = 0; i < 6; i++)
    stats[i] = Math.floor(stats[i] / total * bst) + 1;
  const completeMoves = moves.filter(x => !x.incomplete);
  function pickRandomMove(predicate: (move: Move) => boolean) {
    const filtered = completeMoves.filter(predicate);
    const move = filtered[Math.floor(Math.random() * filtered.length)];
    const index = completeMoves.indexOf(move);
    completeMoves.splice(index, 1);
    return move.name;
  }
  return createPokemon({
    name: params.name,
    attack: stats[0],
    defense: stats[1],
    spAttack: stats[2],
    spDefense: stats[3],
    speed: stats[4],
    hp: stats[5],
    baseExp: 267,
    genderRatio: null,
    levelType: 1,
    learnable: [],
    type: [element],
    id: 1,
    levelUp: [
      [1, pickRandomMove(move => move.type === element && move.power !== null)],
      [1, pickRandomMove(move => move.type === element)],
      [1, pickRandomMove(move => move.power !== null)],
      [1, pickRandomMove(move => move.power === null)],
    ],
  }, params.level);
}

const monster_room: () => DungeonDescriptor = () => { return {
  type: 'directory',
  monster: createMonster(oneOf({
    name: 'Frost Slime',
    level: 8,
    element: 'Ice',
  } as const,{
    name: 'Rock Slime',
    level: 8,
    element: 'Rock',
  } as const,{
    name: 'Wind Slime',
    level: 8,
    element: 'Flying',
  } as const,)()),
  children: {
    precarious_pathway: {
      type: 'directory',
      challenge: async (stdout, stderr, stdin) => {
        stdout.write(`\x1b\x1aL${JSON.stringify({ entry: 'pathway'})}\x00`);
        // send({ });
        // function send(data) {
        //   const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
        //       return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
        //   });
        //   stdout.write(`\x1b\x1aM${str}\x00`);
        // }
        try {
          const data = JSON.parse(await stdin.once());
          if (data === 'succeed')
            return 'succeed';
          if (data === 'cancel')
            return 'cancel';
          if (data === 'die')
            return 'die';
          return 'cancel';
        } catch {
          return 'cancel';
        }
      },
      children: {
        'hint.txt': {
          type: 'file',
          content: 'Sorry, hints are not implemented yet.'
        },
        boss_room: {
          type: 'directory',
          monster: createMonster({
            name: 'Great Pumpkin',
            level: 12,
            element: 'Fire',
          }),
          children: {
            'end.txt': {
              type: 'file',
              content: 'End of demo!',
            }
          }
        }
      }
    }
  },
} };

const blessing_room: DungeonDescriptor = {
  type: 'directory',
  children: {
    blessing: {
      type: 'file',
      content: 'Open to pick a blessing.',
      open: (stdout, stderr) => {
        stderr.write('not implemented yet\n');
        return 1;
      },
    }
  },
};

const adventurer: DungeonDescriptor = {
  type: 'directory',
  children: () => {
    const playerElement = dungeon.player.stats.type[0];
    const monsterElement = {
      Water: ['Fire', 'Fire Ghost'],
      Fire: ['Ice', 'Frost Ghost'],
      Fight: ['Normal', 'Ordinary Ghost'],
    }[playerElement];
    return {
      storage_room,
      'help.txt': {
        type: 'file',
        content: 'You are in a dungeon.',
      },
      cramped_hallway: {
        type: 'directory',
        monster: createMonster({
          name: monsterElement[1],
          level: 5,
          element: monsterElement[0],
        }),
        children: oneOf({
          left_room: blessing_room,
          right_room: monster_room(),
        }, {
          left_room: monster_room(),
          right_room: blessing_room,
        }),
      }
    };
  },
}

function oneOf<T>(...items: T[]) {
  return () => items[Math.floor(Math.random() * items.length)];
}

const home: DungeonDescriptor = {
  type: 'directory',
  children: { adventurer },
};

const root: DungeonDescriptor = {
  type: 'directory',
  children: {
    home,
  },
};

type DungeonDescriptor = Room | Item;

type Item = {
  type: 'file';
  content: string;
  open?: (stdout, stderr) => number;
}

type Children = { [key: string]: DungeonDescriptor | (() => DungeonDescriptor) };

type Room = {
  type: 'directory';
  monster?: Monster;
  challenge?: (stdout, stderr, stdin: JoelEvent<string>) => Promise<'succeed'|'die'|'cancel'>;
  children: Children | (() => Children),
}

export type Monster = {
  stats: Pokemon;
  bytes: number;
  element: (typeof types)[number];
}

function unwrapCallable<T extends object>(callable: T | (() => T)) {
  return typeof callable === 'function' ? callable() : callable;
}

class LiveDungeon {
  children: { [key: string]: LiveDungeon } = {};
  monster?: Monster;
  challenge?: (stdout, stderr, stdin: JoelEvent<string>) => Promise<'succeed'|'die'|'cancel'>;
  private opened = false;
  constructor(private readonly _descriptor: DungeonDescriptor) {
    if (this._descriptor.type === 'directory') {
      const children = unwrapCallable(this._descriptor.children);
      for (const key in children) {
        const child = children[key];
        this.children[key] = new LiveDungeon(unwrapCallable(child));
      }
      if (this._descriptor.monster)
        this.monster = {...this._descriptor.monster};
      if (this._descriptor.challenge)
        this.challenge = this._descriptor.challenge;
    }
  }
  get type() {
    return this._descriptor.type;
  }
  get content() {
    if (this._descriptor.type !== 'file')
      return '<not a file>';
    return this._descriptor.content;
  }
  open(stderr, stdout) {
    if (this._descriptor.type !== 'file')
      return 1;
    if (!this._descriptor.open)
      return 1;
    if (this.opened) {
      stderr.write('It is empty.\r\n');
      return 1;
    }
    const retVal = this._descriptor.open(stderr, stdout);
    if (retVal === 0)
      this.opened = true;
    return retVal;
  }
}

async function writeTextSlowly(text:string, stdout, stdin?: JoelEvent<string>) {
  let skipping = false;
  stdin?.once().then(() => skipping = true);
  for (const char of text) {
    stdout.write(char);
    if (!skipping)
      await new Promise(x => setTimeout(x, 50));
  }
}


let resets = 0;
class Dungeon {
  player = {
    stats: {} as Pokemon,
    bytes: 0,
    items: new Map<string, number>(),
    abilities: new Set<string>(),
  }
  cwd = new JoelEvent('/');
  bytesEvent = new JoelEvent<void>(undefined);
  private root: LiveDungeon;
  constructor(private _descriptor: DungeonDescriptor) {
  }
  private _pathToDescriptor(path: string) {
    const parts = path.split('/');
    let current = this.root;
    while (current?.type === 'directory' && parts.length) {
      const part = parts.shift();
      if (!part)
        continue;
      current = current.children[part];
    }
    return current;
  }
  currentMonster() {
    const descriptor = this._pathToDescriptor(this.cwd.current);
    if (descriptor?.type !== 'directory')
      return null;
    return descriptor.monster || null;
  }
  async reset(stdout, stderr, stdin: JoelEvent<string>) {
    stdout.write('\u001b[32m');
    if (resets === 0) {
      await writeTextSlowly('Connecting to the Halloween Server.\r\n', stdout, stdin);
    } else {
      await writeTextSlowly('Reconnecting to the Halloween Server.\r\n', stdout, stdin);
    }
    await writeTextSlowly(
      'Beware of traps.\r\n' +
      'Beware of monsters.\r\n' +
      'Find the key.\r\n', stdout, stdin);
    stdout.write('\u001b[0m');
    if (resets === 0) {
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
        stdout.write('\u001b[31mWARNING: this game is not designed for mobile devices. It will almost certainly not work properly.\u001b[0m\r\n')
      stdout.write('type help to view available commands\r\n');
    }
    resets++;
    this.player = {
      stats: createPlayer({ level: 5, name: 'adventurer' }),
      bytes: this.player.bytes,
      items: new Map(),
      abilities: new Set(),
    };
    this.root = new LiveDungeon(this._descriptor);
    this.cwd.dispatch('/home/adventurer');
    if (this.player.bytes) {
      stdout.write(`\x1b\x1aL${JSON.stringify({ entry: 'reset'})}\x00`);
      send({ bytes: this.player.bytes });
      function send(data) {
        const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
            return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
        });
        stdout.write(`\x1b\x1aM${str}\x00`);
      }
      const data = await stdin.once();
      try {
        const parsed = JSON.parse(data);
        this.player.abilities = new Set(parsed);
        if (this.player.abilities.has('increased_level')) {
          for (let i = 0; i < 2; i++)
            forceLevelUp(this.player.stats, false);
        }
        if (this.player.abilities.has('starting_item'))
          this.giveItem('healing_potion');
      } catch {
        return 1;
      }
    }
    return 0;
  }

  giveItem(item: string) {
    this.player.items.set(item, (this.player.items.get(item) || 0) + 1);
  }

  useItem(item: string, stdout, stderr): number {
    const count = this.player.items.get(item) || 0;
    if (count <= 0) {
      stderr.write(`you don't have any ${item}\r\n`);
      return 1;
    }
    if (item === 'healing_potion') {
      if (this.player.stats.hp >= this.player.stats.max) {
        stderr.write('you are already at full health\r\n');
        return 1;
      }
      const before = this.player.stats.hp;
      this.player.stats.hp = Math.min(this.player.stats.hp + 50, this.player.stats.max);
      stdout.write(`healed for ${this.player.stats.hp - before} hp\r\n`);
    } else {
      stderr.write(`you can't use ${item}\r\n`);
      return 1;
    }
    this.player.items.set(item, count - 1);
    return 0;
  }

  open(path: string, stdout, stderr) {
    const descriptor = this._pathToDescriptor(path);
    if (!descriptor) {
      stderr.write(`no such file or directory: ${path}\r\n`);
      return 1;
    }
    if (descriptor.type !== 'file' || !descriptor.open) {
      stderr.write(`cannot open ${path}\r\n`);
      return 1;
    }
    return descriptor.open(stdout, stderr);
  }

  _isPathObstructed(from: string, to: string) {
    // remove any trailing slashes
    from = '/' + from.split('/').filter(x => x).join('/');
    to = '/' + to.split('/').filter(x => x).join('/');

    const fromParts = from.split('/');
    while (!to.startsWith(fromParts.join('/'))) {
      const descriptor = this._pathToDescriptor(fromParts.join('/'));
      if (descriptor?.type !== 'directory')
        return false;
      if (descriptor.monster)
        return true;
      if (descriptor.challenge)
        return true;
      fromParts.pop();
    }
    const sharedRoot = fromParts.join('/');
    const toParts = to.substring(sharedRoot.length).split('/');
    let current = sharedRoot;
    while (current !== to) {
      const descriptor = this._pathToDescriptor(current);
      if (descriptor?.type !== 'directory')
        return false;
      if (descriptor.monster)
        return true;
      if (descriptor.challenge)
        return true;
      if (!current.endsWith('/'))
        current += '/';
      current += toParts.shift();
    }
    return false;

  }
  
  async chdir(dir: string, stdout, stderr, stdin: JoelEvent<string>): Promise<number> {
    const current = this._pathToDescriptor(this.cwd.current);
    if (current.monster) {
      stderr.write(`${current.monster.stats.name} blocks your escape!\r\n`);
      return 1;
    }
    if (this._isPathObstructed(this.cwd.current, dir)) {
      stderr.write('something dangerous blocks your travel!\r\n');
      return 1;
    }
    const descriptor = this._pathToDescriptor(dir);
    if (descriptor?.type !== 'directory') {
      stderr.write(`no such directory: ${dir}\r\n`);
      return 1;
    }
    if (descriptor.challenge) {
      const result = await descriptor.challenge(stdout, stderr, stdin);
      if (result === 'cancel')
        return 1;
      if (result === 'die')
        return this.reset(stdout, stderr, stdin);
      console.assert(result === 'succeed');
      delete descriptor.challenge;
    }
    if (descriptor.monster) {
      // stderr.write(`${descriptor.monster.name} appears!\r\n`);
      stdout.write(`\x1b\x1aL${JSON.stringify({ entry: 'battle'})}\x00`);
      send({
        player: this.player.stats,
        enemy: descriptor.monster.stats,
      });
      const data: {player: Pokemon, enemy: Pokemon} = JSON.parse(await stdin.once());
      this.player.stats = data.player;
      descriptor.monster.stats = data.enemy;
      if (this.player.stats.hp <= 0) {
        stdout.write('\u001b[31m');
        await writeTextSlowly('You died!\r\n', stdout);
        stdout.write('\u001b[0m'); 
        await new Promise(x => setTimeout(x, 300)); 
        return await this.reset(stdout, stderr, stdin);
      }
      if (data.enemy.hp <= 0) {
        stdout.write(`${descriptor.monster.stats.name} dies!\r\n`);
        this.player.bytes += descriptor.monster.bytes;
        this.bytesEvent.dispatch();
        stdout.write(`${'adventurer'} obtained ${descriptor.monster.bytes} bytes\r\n`);
        delete descriptor.monster;
        if (this.player.abilities.has('heal_after_battle')) {
          const before = this.player.stats.hp;
          this.player.stats.hp = Math.min(this.player.stats.hp + 5, this.player.stats.max);
          stdout.write(`healed for ${this.player.stats.hp - before} hp\r\n`);
        }
      } else {
        return 1;
      }
      function send(data) {
        const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
            return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
        });
        stdout.write(`\x1b\x1aM${str}\x00`);
      }
    }
    this.cwd.dispatch(dir);
    return 0;
  }

  async readFile(path: string) {
    const descriptor = this._pathToDescriptor(path);
    if (!descriptor)
      throw { errno: -2 };
    if (descriptor.type !== 'file')
      throw { errno: -21 };
    return descriptor.content;
  }

  async lstat(path: string) {
    const descriptor = this._pathToDescriptor(path);
    if (!descriptor)
      throw { errno: -2 };
    return {
      isFile() { return descriptor.type === 'file' },
      isDirectory() { return descriptor.type === 'directory' },
      isBlockDevice() { return false },
      isCharacterDevice() { return false},
      isSymbolicLink() { return false },
      isFIFO() { return false },
      isSocket() { return false },
      dev: 0,
      ino: 0,
      mode: 0,
      nlink: 0,
      uid: 0,
      gid: 0,
      rdev: 0,
      size: 0,
      blksize: 0,
      blocks: 0,
      atimeMs: 0,
      mtimeMs: 0,
      ctimeMs: 0,
      birthtimeMs: 0,
      atime: new Date(0),
      mtime: new Date(0),
      ctime: new Date(0),
      birthtime: new Date(0),
    }
  }

  isDirectory(path: string) {
    return this._pathToDescriptor(path)?.type === 'directory';
  }

  async readdir(path: string) {
    const descriptor = this._pathToDescriptor(path);
    if (descriptor.type !== 'directory')
      throw new Error(`${path} is not a directory`);
    if (descriptor.monster || descriptor.challenge)
      return [];
    return Object.keys(descriptor.children);
  }
}

const types = ["Normal", "Fire", "Water", "Grass", "Electr", "Ice", "Fight", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel"] as const;
function pokemonTypeEffect(moveType: (typeof types)[number], victType: (typeof types)[number]) {
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

  return typeEffect[types.indexOf(moveType)][types.indexOf(victType)];
}


export const dungeon = new Dungeon(root);