const CHAR_DOT = '.'.charCodeAt(0);
const CHAR_FORWARD_SLASH = '/'.charCodeAt(0);

const isPathSeparator = code => code === CHAR_FORWARD_SLASH;
export function pathResolve(...args: string[]) {
  let resolvedPath = '';
  let resolvedAbsolute = false;

  for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    const path = i >= 0 ? args[i] : '/';

    // Skip empty entries
    if (path.length === 0) {
      continue;
    }

    resolvedPath = `${path}/${resolvedPath}`;
    resolvedAbsolute = path[0] === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, '/', isPathSeparator);

  if (resolvedAbsolute) {
    return `/${resolvedPath}`;
  }
  return resolvedPath.length > 0 ? resolvedPath : '.';
}

// Resolves . and .. elements in a path with directory names
function normalizeString(path: string, allowAboveRoot, separator, isPathSeparator) {
  let res = '';
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let code = 0;
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (isPathSeparator(code))
      break;
    else
      code = '/'.charCodeAt(0);

    if (isPathSeparator(code)) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 ||
            res.charCodeAt(res.length - 1) !== CHAR_DOT ||
            res.charCodeAt(res.length - 2) !== CHAR_DOT) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf(separator);
            if (lastSlashIndex === -1) {
              res = '';
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength =
                res.length - 1 - res.lastIndexOf(separator);
            }
            lastSlash = i;
            dots = 0;
            continue;
          } else if (res.length !== 0) {
            res = '';
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? `${separator}..` : '..';
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += `${separator}${path.slice(lastSlash + 1, i)}`;
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === CHAR_DOT && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

function normalize(path: string): string {
  if (path.length === 0)
    return '.';

  const isAbsolute =
    String.prototype.charCodeAt.call(path, 0) === CHAR_FORWARD_SLASH;
  const trailingSeparator =
    String.prototype.charCodeAt.call(path, path.length - 1) === CHAR_FORWARD_SLASH;

  // Normalize the path
  path = normalizeString(path, !isAbsolute, '/', isPathSeparator);

  if (path.length === 0) {
    if (isAbsolute)
      return '/';
    return trailingSeparator ? './' : '.';
  }
  if (trailingSeparator)
    path += '/';

  return isAbsolute ? `/${path}` : path;
}

export function pathJoin(...args: string[]): string {
  if (args.length === 0)
    return '.';
  let joined;
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    if (arg.length > 0) {
      if (joined === undefined)
        joined = arg;
      else
        joined += `/${arg}`;
    }
  }
  if (joined === undefined)
    return '.';
  return normalize(joined);
}

export function pathRelative(from: string, to: string) {
  if (from === to)
    return '';

  // Trim leading forward slashes.
  from = pathResolve(from);
  to = pathResolve(to);

  if (from === to)
    return '';

  const fromStart = 1;
  const fromEnd = from.length;
  const fromLen = fromEnd - fromStart;
  const toStart = 1;
  const toLen = to.length - toStart;

  // Compare paths to find the longest common path from root
  const length = (fromLen < toLen ? fromLen : toLen);
  let lastCommonSep = -1;
  let i = 0;
  for (; i < length; i++) {
    const fromCode = String.prototype.charCodeAt.call(from, fromStart + i);
    if (fromCode !== String.prototype.charCodeAt.call(to, toStart + i))
      break;
    else if (fromCode === CHAR_FORWARD_SLASH)
      lastCommonSep = i;
  }
  if (i === length) {
    if (toLen > length) {
      if (String.prototype.charCodeAt.call(to, toStart + i) === CHAR_FORWARD_SLASH) {
        // We get here if `from` is the exact base path for `to`.
        // For example: from='/foo/bar'; to='/foo/bar/baz'
        return String.prototype.slice.call(to, toStart + i + 1);
      }
      if (i === 0) {
        // We get here if `from` is the root
        // For example: from='/'; to='/foo'
        return String.prototype.slice.call(to, toStart + i);
      }
    } else if (fromLen > length) {
      if (String.prototype.charCodeAt.call(from, fromStart + i) ===
          CHAR_FORWARD_SLASH) {
        // We get here if `to` is the exact base path for `from`.
        // For example: from='/foo/bar/baz'; to='/foo/bar'
        lastCommonSep = i;
      } else if (i === 0) {
        // We get here if `to` is the root.
        // For example: from='/foo/bar'; to='/'
        lastCommonSep = 0;
      }
    }
  }

  let out = '';
  // Generate the relative path based on the path difference between `to`
  // and `from`.
  for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
    if (i === fromEnd ||
        String.prototype.charCodeAt.call(from, i) === CHAR_FORWARD_SLASH) {
      out += out.length === 0 ? '..' : '/..';
    }
  }

  // Lastly, append the rest of the destination (`to`) path that comes after
  // the common path parts.
  return `${out}${String.prototype.slice.call(to, toStart + lastCommonSep)}`;
}

export function pathBasename(path: string): string {
  let start = 0;
  let end = -1;
  let matchedSlash = true;

  for (let i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
      // If we reached a path separator that was not part of a set of path
      // separators at the end of the string, stop now
      if (!matchedSlash) {
        start = i + 1;
        break;
      }
    } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1)
    return '';
  return path.slice(start, end);

}