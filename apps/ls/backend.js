#!/usr/bin/env node
require('./lib').run(process.argv.slice(2), process.stdout, process.stderr);