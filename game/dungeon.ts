import { JoelEvent } from "../slug/cdp-ui/JoelEvent";
import { createPokemon, forceLevelUp } from "./battle/battle/js/logic";
import { moves } from './battle/battle/js/moves';
const fast = new URL(self.location.href).host.includes('fast');

const neighbors_house: DungeonDescriptor = {
  type: 'directory',
  children: {
    'trick.treat': {
      type: 'file',
      content: 'Open to trick or treat',
      open: async (stdout, stderr) => {
        stdout.write(`\x1b\x1aL${JSON.stringify({ entry: 'trick-or-treat'})}\x00`);
        dungeon.dispatch({ method: 'Game.playSound', params: { sound: 'doorbell', loop: false }})
        await new Promise(x => setTimeout(x, 2500));
        stdout.write('\u001b[35m');
        await writeTextSlowly(
          'Oh what wonderful costumes!\r\n'
          , stdout);
        stdout.write('\u001b[0m');
        stdout.write('You received a POTION!\r\n');
        dungeon.giveItem('POTION');
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
  const element = resets === 0 ? 'Fight' : elements[Math.floor(Math.random() * elements.length)];

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
    level: 7,
    element: 'Ice',
  } as const,{
    name: 'Rock Slime',
    level: 7,
    element: 'Rock',
  } as const,{
    name: 'Wind Slime',
    level: 7,
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
        'credits.txt': {
          type: 'file',
          content: 'Art by Katie Olsen\r\n' +
          'Find Snail terminal at https://github.com/JoelEinbinder/snail/\r\n',
        },
        boss_room: {
          type: 'directory',
          monster: createMonster({
            name: 'Great Pumpkin',
            level: 13,
            element: 'Fire',
          }),
          children: {
            'treasure.chest': {
              type: 'file',
              content: 'This chest can be opened with `open treasure.chest`',
              open: async (stdout, stderr, stdin) => {
                dungeon.giveItem('ALEX_KEY');
                stdout.write('You obtained the ALEX_KEY!\r\n');
                return 0;
              },
            },
            'hint.txt': {
              type: 'file',
              content: 'You can type `..` or `cd ..` or to go up a directory.\r\n',
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
    'healing.blessing': {
      type: 'file',
      content: 'Open to heal completely.',
      open: (stdout, stderr) => {
        dungeon.player.stats.hp = dungeon.player.stats.max;
        dungeon.player.stats.volatile = {};
        dungeon.player.stats.burn = 0;
        dungeon.player.stats.freeze = 0;
        dungeon.player.stats.paralyze = 0;
        dungeon.player.stats.poison = 0;
        dungeon.player.stats.sleep = 0;
        dungeon.player.stats.PP = {};
        stderr.write('You are fully restored\n');
        return 0;
      },
    }
  },
};

const adventurer: DungeonDescriptor = {
  type: 'directory',
  children: () => {
    const playerElement = dungeon.player.stats.type[0];
    const monsterElement = ({
      Water: ['Fire', 'Fire Ghost'],
      Fire: ['Ice', 'Frost Ghost'],
      Fight: ['Normal', 'Ordinary Ghost'],
    } as const)[playerElement];
    return {
      neighbors_house,
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

const alex: DungeonDescriptor = {
  type: 'directory',
  challenge: async (stdout, stderr, stdin) => {
    if (!dungeon.player.items.has('ALEX_KEY')) {
      stderr.write('You need the a key to open this door.\r\n');
      return 'cancel';
    }
    stdout.write('The ALEX_KEY perfectly fits the lock.\r\n');
    return 'succeed';
  },
  children: () => {
    const passcode = Math.floor(Math.random() * 9 ** 4).toString(9).padStart(4, '0');
    const directories = createDirectories(4);
    function createDirectories(depth: number, path = ''): DungeonDescriptor {
      if (path === passcode)
        return { type: 'directory', children: { 'passcode.txt': { type: 'file', content: 'You already know the passcode' } }};
      if (depth <= 0)
        return { type: 'directory', children: {}};
      const children = {};
      for (let i = 0; i < 9; i++)
        children[String(i)] = createDirectories(depth - 1, path + String(i));
      return {
        type: 'directory',
        children,
      }
    }
    return {
      numbers: directories,
      locked_box: {
        type: 'file',
        content: 'You can use `open` to try to open this, but it needs a passcode.',
        open: async (stdout, stderr, stdin) => {
          stdout.write('Enter the passcode: ');
          let buffer = '';
          while(true) {
            const data = await stdin.once();;
            buffer += data;
            if (data.includes('\r'))
              break;
            stdout.write('*');
          }
          stdout.write('\r\n');
          if (buffer.trim() !== passcode) {
            stderr.write('Incorrect passcode.\r\n');
            return 1;
          }
          stdout.write('You win! That\'s the end of the game so far but I\'ll probably add more later.\r\n');
          return 0;
        },
      }
    }
  },
};

const home: DungeonDescriptor = {
  type: 'directory',
  children: { adventurer, alex },
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
  open?: (stdout, stderr, stdin) => number|Promise<number>;
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
  async open(stderr, stdout, stdin) {
    if (this._descriptor.type !== 'file')
      return 1;
    if (!this._descriptor.open)
      return 1;
    if (this.opened) {
      stderr.write('It is empty.\r\n');
      return 1;
    }
    const retVal = await this._descriptor.open(stderr, stdout, stdin);
    if (retVal === 0)
      this.opened = true;
    return retVal;
  }
}

async function writeTextSlowly(text:string, stdout, stdin?: JoelEvent<string>) {
  if (fast) {
    stdout.write(text);
    return;
  }
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
  dispatch?: (params: any) => void; 
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
      'Find the key to escape.\r\n', stdout, stdin);
    stdout.write('\u001b[0m');
    this.player = {
      stats: createPlayer({ level: 5, name: 'adventurer' }),
      bytes: this.player.bytes,
      items: new Map(),
      abilities: new Set(),
    };
    stdout.write(`\x1b\x1aL${JSON.stringify({ entry: 'monster'})}\x00`);
    send({
      'Fight': 'werewolf',
      'Fire': 'dragon',
      'Water': 'fish',
    }[this.player.stats.type[0]])
    await new Promise(x => setTimeout(x, 200));
    if (resets === 0) {
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
        stdout.write('\u001b[31mWARNING: this game is not designed for mobile devices. It will almost certainly not work properly.\u001b[0m\r\n')
      stdout.write('type help to view available commands\r\n');
    }
    resets++;
    this.root = new LiveDungeon(this._descriptor);
    this.cwd.dispatch('/home/adventurer');
    if (this.player.bytes) {
      stdout.write(`\x1b\x1aL${JSON.stringify({ entry: 'reset'})}\x00`);
      send({ bytes: this.player.bytes });
      const data = await stdin.once();
      try {
        const parsed = JSON.parse(data);
        this.player.abilities = new Set(parsed);
        if (this.player.abilities.has('increased_level')) {
          for (let i = 0; i < 2; i++)
            forceLevelUp(this.player.stats, false);
          this.player.stats.hp = this.player.stats.max;
        }
        if (this.player.abilities.has('starting_item'))
          this.giveItem('POTION');
      } catch {
        return 1;
      }
    }
    return 0;
    function send(data) {
      const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
          return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
      });
      stdout.write(`\x1b\x1aM${str}\x00`);
    }
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
    if (item === 'POTION') {
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

  open(path: string, stdout, stderr, stdin) {
    const descriptor = this._pathToDescriptor(path);
    if (!descriptor) {
      stderr.write(`no such file or directory: ${path}\r\n`);
      return 1;
    }
    if (descriptor.type !== 'file' || !descriptor.open) {
      stderr.write(`cannot open ${path}\r\n`);
      return 1;
    }
    return descriptor.open(stdout, stderr, stdin);
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
        items: Object.fromEntries(this.player.items.entries()),
      });
      const data: {player: Pokemon, enemy: Pokemon, items: {[key: string]: number}} = JSON.parse(await stdin.once());
      this.player.items = new Map(Object.entries(data.items));
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


export const dungeon: Dungeon = new Dungeon(root);