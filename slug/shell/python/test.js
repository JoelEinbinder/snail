const {PythonController} = require('./controller');
const pythonController = new PythonController();
(async () => {
  const result = await pythonController.send('Python.autocomplete', { line: 'import '} );
  console.log('result', result);
  pythonController.close();
})();
