import type { Suggestion } from "../autocomplete";
import type { Shell } from "../Shell";
import { registerCompleter } from "../shellCompleter";

registerCompleter('git', async (shell, line, abortSignal) => {
  const anchor = 4;
  const prefix = line.slice(anchor);
  if (prefix.includes(' ')) {
    const command = line.slice(4).split(' ')[0];
    const anchor = line.lastIndexOf(' ') + 1;
    if (command === 'checkout' || command === 'branch' || command === 'rebase' || command === 'merge') {
      return {
        anchor,
        preSorted: true,
        suggestions: await refNames(shell),
      };
    }
    if (command === 'reset') {
      return {
        anchor,
        preSorted: true,
        suggestions: await resetTargets(shell),
      };
    }
    if (command === 'fetch') {
      const origins = await originNames(shell);
      return {
        anchor,
        preSorted: true,
        suggestions: origins.map(text => ({text})),
      };
    }
    return null;
  }
  
  return {
    anchor,
    preSorted: true,
    suggestions: Object.entries(commands).map(([text, value]) => ({text: text + ' ', description: async () => value}))
  };
});

const commands = {

// main_porcelain_commands=(
  'add':'add file contents to index',
  'am':'apply patches from a mailbox',
  'archive':'create archive of files from named tree',
  'bisect':'find, by binary search, change that introduced a bug',
  'branch':'list, create, or delete branches',
  'bundle':'move objects and refs by archive',
  'checkout':'checkout branch or paths to working tree',
  'cherry-pick':'apply changes introduced by some existing commits',
  'citool':'graphical alternative to git commit',
  'clean':'remove untracked files from working tree',
  'clone':'clone repository into new directory',
  'commit':'record changes to repository',
  'describe':'show most recent tag that is reachable from a commit',
  'diff':'show changes between commits, commit and working tree, etc.',
  'fetch':'download objects and refs from another repository',
  'format-patch':'prepare patches for e-mail submission',
  'gc':'cleanup unnecessary files and optimize local repository',
  'grep':'print lines matching a pattern',
  'gui':'run portable graphical interface to git',
  'init':'create empty git repository or re-initialize an existing one',
  'log':'show commit logs',
  'merge':'join two or more development histories together',
  'mv':'move or rename file, directory, or symlink',
  'notes':'add or inspect object notes',
  'pull':'fetch from and merge with another repository or local branch',
  'push':'update remote refs along with associated objects',
  'range-diff':'compare two commit ranges',
  'rebase':'forward-port local commits to the updated upstream head',
  'reset':'reset current HEAD to specified state',
  'restore':'restore working tree files',
  'revert':'revert existing commits',
  'rm':'remove files from the working tree and from the index',
  'shortlog':'summarize git log output',
  'show':'show various types of objects',
  'stash':'stash away changes to dirty working directory',
  'status':'show working-tree status',
  'submodule':'initialize, update, or inspect submodules',
  'subtree':'split repository into subtrees and merge them',
  'switch':'switch branches',
  'tag':'create, list, delete or verify tag object signed with GPG',
  'worktree':'manage multiple working dirs attached to the same repository',

// ancillary_manipulator_commands=(
  'config':'get and set repository or global options',
  'fast-export':'data exporter',
  'fast-import':'import information into git directly',
  'filter-branch':'rewrite branches',
  'mergetool':'run merge conflict resolution tools to resolve merge conflicts',
  'pack-refs':'pack heads and tags for efficient repository access',
  'prune':'prune all unreachable objects from the object database',
  'reflog':'manage reflog information',
  'remote':'manage set of tracked repositories',
  'repack':'pack unpacked objects in a repository',
  'replace':'create, list, delete refs to replace objects',

// ancillary_interrogator_commands=(
  'blame':'show what revision and author last modified each line of a file',
  'count-objects':'count unpacked objects and display their disk consumption',
  'difftool':'show changes using common diff tools',
  'fsck':'verify connectivity and validity of objects in database',
  'help':'display help information about git',
  'instaweb':'instantly browse your working repository in gitweb',
  'interpret-trailers':'add or parse structured information in commit messages',
  'merge-tree':'show three-way merge without touching index',
  'rerere':'reuse recorded resolution of conflicted merges',
  'show-branch':'show branches and their commits',
  'verify-commit':'check GPG signature of commits',
  'verify-tag':'check GPG signature of tags',
  'whatchanged':'show commit-logs and differences they introduce',
  'version':'show git version',

// interaction_commands=(
  'archimport':'import an Arch repository into git',
  'cvsexportcommit':'export a single commit to a CVS checkout',
  'cvsimport':'import a CVS "repository" into a git repository',
  'cvsserver':'run a CVS server emulator for git',
  'imap-send':'send a collection of patches to an IMAP folder',
  'quiltimport':'apply a quilt patchset',
  'request-pull':'generate summary of pending changes',
  'send-email':'send collection of patches as emails',
  'svn':'bidirectional operation between a Subversion repository and git',

// plumbing_manipulator_commands=(
  'apply':'apply patch to files and/or to index',
  'checkout-index':'copy files from index to working directory',
  'commit-graph':'write and verify Git commit-graph files',
  'commit-tree':'create new commit object',
  'hash-object':'compute object ID and optionally create a blob from a file',
  'index-pack':'build pack index file for an existing packed archive',
  'merge-file':'run a three-way file merge',
  'merge-index':'run merge for files needing merging',
  'mktag':'create tag object',
  'mktree':'build tree-object from git ls-tree formatted text',
  'multi-pack-index':'write and verify multi-pack-indexes',
  'pack-objects':'create packed archive of objects',
  'prune-packed':'remove extra objects that are already in pack files',
  'read-tree':'read tree information into directory index',
  'symbolic-ref':'read and modify symbolic references',
  'unpack-objects':'unpack objects from packed archive',
  'update-index':'register file contents in the working directory to the index',
  'update-ref':'update object name stored in a reference safely',
  'write-tree':'create tree from the current index',

// plumbing_interrogator_commands=(
  'cat-file':'provide content or type information for repository objects',
  'cherry':'find commits not merged upstream',
  'diff-files':'compare files in working tree and index',
  'diff-index':'compare content and mode of blobs between index and repository',
  'diff-tree':'compare content and mode of blobs found via two tree objects',
  'for-each-ref':'output information on each ref',
  'get-tar-commit-id':'extract commit ID from an archive created using git archive',
  'ls-files':'information about files in index/working directory',
  'ls-remote':'show references in a remote repository',
  'ls-tree':'list contents of a tree object',
  'merge-base':'find as good a common ancestor as possible for a merge',
  'name-rev':'find symbolic names for given revisions',
  'pack-redundant':'find redundant pack files',
  'rev-list':'list commit object in reverse chronological order',
  'rev-parse':'pick out and massage parameters for other git commands',
  'show-index':'show packed archive index',
  'show-ref':'list references in a local repository',
  'unpack-file':'create temporary file with blob\'s contents',
  'var':'show git logical variable',
  'verify-pack':'validate packed git archive files',

// plumbing_sync_commands=(
  'daemon':'run a really simple server for git repositories',
  'fetch-pack':'receive missing objects from another repository',
  'http-backend':'run a server side implementation of Git over HTTP',
  'send-pack':'push objects over git protocol to another repository',
  'update-server-info':'update auxiliary information file to help dumb servers',

// plumbing_sync_helper_commands=(
  'http-fetch':'download from remote git repository via HTTP',
  'http-push':'push objects over HTTP/DAV to another repository',
  'parse-remote':'routines to help parsing remote repository access parameters',
  'receive-pack':'receive what is pushed into repository',
  'shell':'restricted login shell for GIT-only SSH access',
  'upload-archive':'send archive back to git-archive',
  'upload-pack':'send objects packed back to git fetch-pack',

// plumbing_internal_helper_commands=(
  'check-attr':'display gitattributes information',
  'check-ignore':'debug gitignore/exclude files',
  'check-mailmap':'show canonical names and email addresses of contacts',
  'check-ref-format':'ensure that a reference name is well formed',
  'column':'display data in columns',
  'fmt-merge-msg':'produce merge commit message',
  'mailinfo':'extract patch and authorship from a single email message',
  'mailsplit':'split mbox file into a list of files',
  'merge-one-file':'standard helper-program to use with git merge-index',
  'patch-id':'compute unique ID for a patch',
  'stripspace':'filter out empty lines',
};

async function refNames(shell: Shell): Promise<Suggestion[]> {
  const ref = (await shell.cachedEvaluation(`git for-each-ref --format='%(refname:short) %(contents:subject)' | cat`)).split('\n').map(x => x.trim());
  const refs = ref.map(str => {
    const index = str.indexOf(' ');
    const text = str.slice(0, index);
    const description = str.slice(index + 1);
    return {text, description: async () => description };
  });
  const indexes = new Map<Suggestion, number>();
  for (let i = 0; i < refs.length; i++)
      indexes.set(refs[i], i);
  return refs.sort((a, b) => {
    const aIsMain = a.text.endsWith('/master') || a.text.endsWith('/main') || a.text === 'main' || a.text === 'master';
    const bIsMain = b.text.endsWith('/master') || b.text.endsWith('/main') || b.text === 'main' || b.text === 'master';
    if (aIsMain != bIsMain)
      return aIsMain ? -1 : 1;
    return indexes.get(a) - indexes.get(b);
  })
}

async function originNames(shell: Shell) {
  return (await shell.cachedEvaluation(`git remote | cat`)).split('\n').map(x => x.trim());
}

async function resetTargets(shell: Shell) {
  const log = (await shell.cachedEvaluation('git log -n 10 --format=%s | cat')).split('\n').map(x => x.trim());
  const heads: Suggestion[] = [];
  for (let i = 0; i < log.length; i++) {
    const text = i === 0 ? 'HEAD' : `HEAD~${i}`;
    heads.push({text, description: async () => log[i]});
  }
  return [
    ...await refNames(shell),
    ...heads,
  ];
}