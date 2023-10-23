import { JoelEvent } from "../slug/cdp-ui/JoelEvent";

const storage_room: DungeonDescriptor = {
  type: 'directory',
  children: {
    'treasure.chest': {
      type: 'file',
      content: 'A treasure chest.',
    }
  },
}

const adventurer: DungeonDescriptor = {
  type: 'directory',
  children: {
    storage_room,
    'help.txt': {
      type: 'file',
      content: 'You are in a dungeon.',
    },
    cramped_hallway: {
      type: 'directory',
      monster: {
        name: 'Mischevious Ghost',
        hp: 50,
        atk: 10,
        bytes: 10,
        element: 'none',
        image: 'ghost1',
      },
      children: {
        left_room: {
          type: 'directory',
          children: {
            blessing: {
              type: 'file',
              content: 'Open to pick a blessing.',
            }
          },
        },
        right_room: {
          type: 'directory',
          monster: {
            name: 'Frost Ghost',
            hp: 50,
            atk: 15,
            bytes: 20,
            element: 'ice',
            image: 'ghost3',
          },
          children: {
            vestibule: {
              type: 'directory',
              children: {
                'hint.txt': {
                  type: 'file',
                  content: 'Sorry, hints are not implemented yet.'
                },
                boss_room: {
                  type: 'directory',
                  monster: {
                    name: 'Fire Ghost',
                    hp: 50,
                    atk: 15,
                    bytes: 20,
                    element: 'fire',
                    image: 'ghost2',
                  },
                  children: {}
                }
              }
            }
          },
        },
      },
    }
  },
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
}

type Room = {
  type: 'directory';
  monster?: Monster;
  children: { [key: string]: DungeonDescriptor },
}

export type Monster = {
  name: string;
  hp: number;
  atk: number;
  bytes: number;
  element: 'none' | 'fire' | 'water' | 'ice';
  image: string;
}


class Dungeon {
  player = {
    hp: 0,
    atk: 0,
    bytes: 0,
    element: 'none',
  }
  cwd = new JoelEvent('/');
  private root: DungeonDescriptor;
  constructor(private _descriptor: DungeonDescriptor) {
    this.reset();
  }
  private _pathToDescriptor(path: string) {
    const parts = path.split('/');
    let current = this.root;
    while (current?.type === 'directory' && parts.length) {
      const part = parts.shift();
      if (!part)
        continue;
      current = current.children?.[part];
    }
    return current;
  }
  currentMonster() {
    const descriptor = this._pathToDescriptor(this.cwd.current);
    if (descriptor?.type !== 'directory')
      return null;
    return descriptor.monster || null;
  }
  reset() {
    this.root = JSON.parse(JSON.stringify(this._descriptor));
    this.cwd.dispatch('/home/adventurer');
    this.player = {
      hp: 100,
      atk: 10,
      bytes: this.player.bytes,
      element: 'none',
    };
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
      if (!current.endsWith('/'))
        current += '/';
      current += toParts.shift();
    }
    return false;

  }
  
  chdir(dir: string, stdout, stderr): number {
    const current = this._pathToDescriptor(this.cwd.current) as Room;
    if (current.monster) {
      stderr.write(`${current.monster.name} blocks your escape!\r\n`);
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
    this.cwd.dispatch(dir);
    if (descriptor.monster) {
      stderr.write(`${descriptor.monster.name} appears!\r\n`);
      stdout.write(`\x1b\x1aL${JSON.stringify({ entry: 'monster'})}\x00`);
      send(descriptor.monster);
      function send(data) {
        const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
            return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
        });
        stdout.write(`\x1b\x1aM${str}\x00`);
      }
    }
    return 0;
  }
  attack(stdout, stderr) {
    const current = this._pathToDescriptor(this.cwd.current) as Room;
    if (!current.monster) {
      stderr.write('you swat at the air in vain\n');
      return 1;
    }
    current.monster.hp -= this.player.atk;
    stderr.write(`you hit ${current.monster.name} for 10 damage\r\n`);
    if (current.monster.hp <= 0) {
      stderr.write(`${current.monster.name} dies!\r\n`);
      this.player.bytes += current.monster.bytes;
      delete current.monster;
    } else {
      this.player.hp -= current.monster.atk;
      stderr.write(`${current.monster.name} hits you for ${current.monster.atk} damage\r\n`);
      if (this.player.hp <= 0) {
        stderr.write('you die!\r\n');
        this.reset();
      }
    }
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
    if (descriptor.monster)
      return [];
    return Object.keys(descriptor.children);
  }
}


export const dungeon = new Dungeon(root);