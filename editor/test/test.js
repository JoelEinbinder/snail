const puppeteer = require('puppeteer');
const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const url = require('url');
const mime = require('mime');
const fs = require('fs');

let server = require('http').createServer(function (request, response) {
    request.addListener('end', function () {
        let pathName = url.parse(request.url).path;
        if (pathName.indexOf('?') !== -1)
            pathName = pathName.substring(0, pathName.indexOf('?'));
        if (pathName === '/')
            pathName = '/index.html';
        pathName = path.join(__dirname, '..', pathName.substring(1));

        fs.readFile(pathName, function(err, data) {
            if (err) {
                response.statusCode = 404;
                response.end(`File not found: ${pathName}`);
                return;
            }
            response.setHeader('Content-Type', mime.lookup(pathName));
            response.end(data);
        });

    }).resume();
}).listen(3000);


describe('Editor', function() {
    let browser;
    let page;
    beforeAll(SX(async function() {
        rimraf.sync(path.join(__dirname, 'out'));
        await new Promise(done => mkdirp(path.join(__dirname, 'out'), done));
        browser = await puppeteer.launch();
    }));
    beforeEach(SX(async function(){
        page = await browser.newPage();
        // page.on('console', console.log);
    }));
    afterEach(SX(async function(){
        await page.close();
        page = null;
    }));
    afterAll(SX(async function() {
        await browser.close();
    }));
    imageTest('should work', async function(){
        await page.goto('http://localhost:3000/?test');
        await page.evaluate(() => {
            var editor = new Editor(new Model(`// Hello World!`), {padBottom: true, lineNumbers: true});
            document.body.appendChild(editor.element);
            editor.layout();
        });
    });
    imageTest('should have no line numbers', async function() {
        await page.goto('http://localhost:3000/?test');
        await page.evaluate(() => {
            var editor = new Editor(new Model(`// Hello World!`), {padBottom: true});
            document.body.appendChild(editor.element);
            editor.layout();
        });
    });
    imageTest('should have selection', async function(){
        await page.goto('http://localhost:3000/?test');
        await page.evaluate(async () => {
            var editor = new Editor(new Model(`// Select this word.`), {padBottom: true, lineNumbers: true});
            document.body.appendChild(editor.element);
            editor.layout();
            editor.model.setSelections([{
                start: {
                    line: 0,
                    column: '// Select this '.length
                },
                end: {
                    line: 0,
                    column: '// Select this word'.length
                }
            }]);
            await new Promise(done => requestAnimationFrame(done));
        });
    });
    imageTest('should say hi', async function(){
        await page.goto('http://localhost:3000/?test');
        await page.evaluate(async () => {
            var editor = new Editor(new Model(`"hi"`), {padBottom: true, lineNumbers: true});
            document.body.appendChild(editor.element);
            editor.layout();
        });
    });


    /**
     * @param {name} name
     * @param {Function} fn
     */
    function imageTest(name, fn) {
        describe('image-test', function(){
            it(name, SX(async function() {
                await fn();
                await page.screenshot({
                    path: path.join(__dirname, 'out', name.replace(/ /g, '_') + '.png')
                });
            }));
        });
    }
})

// Since Jasmine doesn't like async functions, they should be wrapped
// in a SX function.
function SX(fun) {
    return done => Promise.resolve(fun()).then(done).catch(done.fail);
}
