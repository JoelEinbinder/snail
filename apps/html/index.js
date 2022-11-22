const path = require('path');
process.stdout.write(`\x1b\x1aL${path.join(__dirname, 'html.ts')}\x00`);

/**
 * @param {any} data
 */
function send(data) {
    const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
        return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
    });
    process.stdout.write(`\x1b\x1aM${str}\x00`);
}
send({args: process.argv});
