import { JoelEvent } from "../slug/cdp-ui/JoelEvent";

const storage_room: DungeonDescriptor = {
  type: 'directory',
  children: {},
}

const adventurer: DungeonDescriptor = {
  type: 'directory',
  children: { storage_room },
}

const home: DungeonDescriptor = {
  type: 'directory',
  children: {adventurer},
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
}

type Room = {
  type: 'directory';
  children: { [key: string]: DungeonDescriptor },
}


class Dungeon {
  constructor(private root: DungeonDescriptor) {
  }
  cwd = new JoelEvent('/home/adventurer');
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
  chdir(dir: string, stdout, stderr): number {
    const descriptor = this._pathToDescriptor(dir);
    if (descriptor?.type !== 'directory') {
      stderr.write(`no such directory: ${dir}\n`);
      return 1;
    }
    this.cwd.dispatch(dir);
    return 0;
  }
  attack(stdout, stderr) {
    stderr.write('cannot attack\n');
    return 1;
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
    return Object.keys(descriptor.children);
  }
}


export const dungeon = new Dungeon(root);