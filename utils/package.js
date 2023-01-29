const path = require('path');
const package = require('electron-packager');
const directoriesToCopy = [
  'dist',
  'apps',
  'host',
  'iframe',
  'manpage_reader',
  'node_host',
  'protocol',
  'shell',
  'shjs',
  'thumbnail_generator',
  'datagrid',
  'icon_service',
  'include',
  'debugger',
];
const filesToCopy = [
  'package.json',
];
package({
  dir: path.join(__dirname, '..'),
  name: 'Snail',
  platform: 'darwin',
  arch: 'arm64',
  overwrite: true,
  ignore: [
    'TODO',
    'a.js',
    'Terminal',
    'Terminal Helper',
    'Terminal WK',
    'Terminal.xcodeproj',
    'TerminalTests',
    'TerminalUITests',
    'WebKitBundle',
    'a.js',
    'build',
    'cef',
    'dist',
    'editor',
    'handler.js',
    'iOSTerminal',
    'icon',
    'libcef_dll_wrapper',
    'node_host',
    'playwright-report',
    'playwright.config.ts',
    'public',
    'scripts',
    'src',
    'terminal_host',
    'test-results',
    'tests',
    'utils',
    'vscode',
    'web_host',
    'webpack.config.js',
    'xterm.js',
    '.clangd',
    '.gitignore',
    '.vscode',
  ].map(makeRegex),
  icon: path.join(__dirname, '..', 'icon', 'icon.icns'),
  appVersion: require('../package.json').version,
  osxSign: true, 
});


function makeRegex(str) {
  return new RegExp(`^/${str}$`);
}