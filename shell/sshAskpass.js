#!/usr/bin/env node
const net = require('net');
const readline = require('readline');
const socket = net.connect({
  path: process.env.SNAIL_SSH_PASS_SOCKET,
});
const rl = readline.createInterface(socket);
socket.once('connect', () => {
  socket.write(JSON.stringify({ message: process.argv[2] }) + '\n');
});
rl.on('line', line => {
  process.stdout.write(JSON.parse(line));
  process.exit(0);
});

