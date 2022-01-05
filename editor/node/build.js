var fs = require('fs');
var files = [
  'emitter.js',
  'model.js',
  'commands.js',
  'highlighter.js',
  'input.js',
  'renderer.js',
  'selections.js',
  'editor.js'
];
var contents = [];
files.forEach(file => {
    contents.push(fs.readFileSync('js/' + file, 'utf8'));
});

if (!fs.existsSync('out'))
  fs.mkdirSync('out');
var content = `var Kangaroo = (function(){
${contents.join('\n//---------------//\n')}
  return Editor;
})();`;
fs.writeFileSync('out/kangaroo.js', content);
console.log("Successfully wrote out/kangaroo.js");
