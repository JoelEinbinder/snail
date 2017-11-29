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
    }));
    afterEach(SX(async function(){
        await page.close();
        page = null;
    }));
    afterAll(SX(async function() {
        await browser.close();
    }));
    imageTest('should work', async function(){
        await page.goto('http://localhost:3000/');
        await page.evaluate(() => {
            return new Promise(done => requestAnimationFrame(done))
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
                    path: path.join(__dirname, 'out', name + '.png')
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
