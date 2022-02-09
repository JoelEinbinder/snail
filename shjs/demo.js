const {execute} = require('./index');
const {stdin, closePromise, kill} = execute(process.argv[2]);
