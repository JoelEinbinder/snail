const {it, describe, beforeEach, afterEach} = require('mocha');
const expect = require('expect');
const rimraf = require('rimraf');
describe('runner', () => {
    const {getResult} = require('./runner');
    it('should pipe', async () => {
        const result = await getResult({
            main: {
                args: ['foo\nbar\nbaz'],
                executable: 'echo',
            },
            pipe: {
                executable: 'grep',
                args: ['bar']
            }
        });
        expect(result).toEqual({
            output: 'bar\n',
            stderr: '',
            code: 0
        })
    });

    it('should pipe twice', async () => {
        const result = await getResult({
            main: {
                args: ['foo\nbar\nbaz'],
                executable: 'echo',
            },
            pipe: {
                main: {
                    executable: 'grep',
                    args: ['b'],
                },
                pipe: {
                    executable: 'grep',
                    args: ['z']
                }
            }
        });
        expect(result).toEqual({
            output: 'baz\n',
            stderr: '',
            code: 0
        })
    });

    it('should return the pipes exit code', async () => {
        const result = await getResult({
            main: {
                args: ['foo\nbar\nbaz'],
                executable: 'echo',
            },
            pipe: {
                executable: 'grep',
                args: ['q'],
            }
        });
        expect(result).toEqual({
            output: '',
            stderr: '',
            code: 1
        })
    });

    it('should return exit code 1', async () => {
        const result = await getResult({
            args: ['not_a_real_directory'],
            executable: 'ls'
        });
        expect(result).toEqual({
            output: '',
            stderr: 'ls: not_a_real_directory: No such file or directory\n',
            code: 1
        })
    });

    it('should grep and not wait', async () => {
        const result = await getResult({
            args: ['foo'],
            executable: 'grep'
        });
        expect(result).toEqual({
            output: '',
            stderr: '',
            code: 1
        })
    });

    it('should do and', async () => {
        const result = await getResult({
            type: 'and',
            left: {
                args: ['foo'],
                executable: 'echo'
            },
            right: {
                args: ['bar'],
                executable: 'echo'
            }
        });
        expect(result).toEqual({
            output: 'foo\nbar\n',
            stderr: '',
            code: 0
        })
    });

    it('should do or', async () => {
        const result = await getResult({
            type: 'or',
            left: {
                args: ['not_a_real_directory'],
                executable: 'ls'
            },
            right: {
                args: ['foo'],
                executable: 'echo'
            }
        });
        expect(result).toEqual({
            output: 'foo\n',
            stderr: 'ls: not_a_real_directory: No such file or directory\n',
            code: 0
        })
    });
});

describe('tokenizer', () => {
    const {tokenize} = require('./tokenizer');
    it('should split arguments', () => {
        expect(tokenize('foo bar  baz').tokens).toEqual([
            {type: 'word', value: 'foo', raw: 'foo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'word', value: 'bar', raw: 'bar'},
            {type: 'space', value: '  ', raw: '  '},
            {type: 'word', value: 'baz', raw: 'baz'},
        ]);
    });
    it('should detect a pipe', () => {
        expect(tokenize('foo | bar').tokens).toEqual([
            {type: 'word', value: 'foo', raw: 'foo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'operator', value: '|', raw: '|'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'word', value: 'bar', raw: 'bar'},
        ]);
    });
    it('should handle double qoutes', () => {
        expect(tokenize('foo "bar baz"').tokens).toEqual([
            {type: 'word', value: 'foo', raw: 'foo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'word', value: 'bar baz', raw: '"bar baz"', isQuoted: true},
        ]);
    });
    it('should handle single qoutes', () => {
        expect(tokenize('foo \'bar baz\'').tokens).toEqual([
            {type: 'word', value: 'foo', raw: 'foo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'word', value: 'bar baz', raw: '\'bar baz\'', isQuoted: true},
        ]);
    });
    it('should handle escaped qoutes', () => {
        expect(tokenize(`foo "bar \\'baz\\'"`).tokens).toEqual([
            {type: 'word', value: 'foo', raw: 'foo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'word', value: `bar 'baz'`, raw: `"bar \\'baz\\'"`, isQuoted: true},
        ]);
    });
    it('should handle escaped qoutes 2', () => {
        expect(tokenize(`foo 'bar \\"baz\\"'"`).tokens).toEqual([
            {type: 'word', value: 'foo', raw: 'foo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'word', value: `bar \\"baz\\"`, raw: `\'bar \\"baz\\"\'`, isQuoted: true },
            {type: 'word', value: ``, raw: `\"`, isQuoted: true },
        ]);
    });
    it('should handle empty qoutes', () => {
        expect(tokenize(`foo '' "" 'a'`).tokens).toEqual([
            {type: 'word', value: 'foo', raw: 'foo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'word', value: '', raw: '\'\'', isQuoted: true},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'word', value: '', raw: '""', isQuoted: true},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'word', value: 'a', raw: '\'a\'', isQuoted: true},
        ]);
    });
    it('return correct raw', () => {
        const {raw, tokens} = tokenize(`foo bar`);
        expect(raw).toEqual('foo bar');
        expect(tokens).toEqual([
            {type: 'word', value: 'foo', raw: 'foo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'word', value: 'bar', raw: 'bar'},
        ]);
    });
    it('should semi colons in quotes but not out of quotes', () => {
        const {raw, tokens} = tokenize(`foo "1;"; 2; 3;`);
        expect(raw).toEqual('foo "1;"');
        expect(tokens).toEqual([
            {type: 'word', value: 'foo', raw: 'foo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'word', value: '1;', raw: '"1;"', isQuoted: true},
        ]);
    });
    it('should handle operators', () => {
        const {raw, tokens} = tokenize(`foo bar baz && man "woo"`);
        expect(tokens).toEqual([
            { type: 'word', value: 'foo', raw: 'foo' },
            { type: 'space', value: ' ', raw: ' ' },
            { type: 'word', value: 'bar', raw: 'bar' },
            { type: 'space', value: ' ', raw: ' ' },
            { type: 'word', value: 'baz', raw: 'baz' },
            { type: 'space', value: ' ', raw: ' ' },
            { type: 'operator', value: '&&', raw: '&&' },
            { type: 'space', value: ' ', raw: ' ' },
            { type: 'word', value: 'man', raw: 'man' },
            { type: 'space', value: ' ', raw: ' ' },
            { type: 'word', value: 'woo', raw: '"woo"', isQuoted: true }
        ]);
    });
    it('should detect a redirect', () => {
        expect(tokenize('foo > bar').tokens).toEqual([
            {type: 'word', value: 'foo', raw: 'foo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'operator', value: '>', raw: '>'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'word', value: 'bar', raw: 'bar'},
        ]);
    });
});

describe('parser', () => {
    const {parse} = require('./parser');
    const {tokenize} = require('./tokenizer');
    it('should do a simple command', () => {
        const {tokens} = tokenize('foo bar baz');
        expect(parse(tokens)).toEqual({
            executable: 'foo',
            args: ['bar', 'baz']
        });
    });
    it('should do a pipe command', () => {
        const {tokens} = tokenize('foo bar baz | grep "woo"');
        expect(parse(tokens)).toEqual({
            main: {
                executable: 'foo',
                args: ['bar', 'baz']
            },
            pipe: {
                executable: 'grep',
                args: ['woo']
            }
        });
    });
    it('should do a pipe command with a pipe', () => {
        const {tokens} = tokenize('foo bar baz | grep "woo" | grep "zoo"');
        expect(parse(tokens)).toEqual({
            main: {
                executable: 'foo',
                args: ['bar', 'baz']
            },
            pipe: {
                main: {
                    executable: 'grep',
                    args: ['woo']
                },
                pipe: {
                    executable: 'grep',
                    args: ['zoo']
                }
            }
        });
    });
    it('should do an and', () => {
        const {tokens} = tokenize('foo bar baz && man "woo"');
        expect(parse(tokens)).toEqual({
            type: 'and',
            left: {
                executable: 'foo',
                args: ['bar', 'baz']
            },
            right: {
                executable: 'man',
                args: ['woo']
            }
        });
    });
    it('should do an or', () => {
        const {tokens} = tokenize('foo bar baz || man "woo"');
        expect(parse(tokens)).toEqual({
            type: 'or',
            left: {
                executable: 'foo',
                args: ['bar', 'baz']
            },
            right: {
                executable: 'man',
                args: ['woo']
            }
        });
    });
    it('should do a redirect', () => {
        const {tokens} = tokenize('foo bar baz > woo');
        expect(parse(tokens)).toEqual({
            executable: 'foo',
            args: ['bar', 'baz'],
            redirects: [{
                type: 'write',
                from: 1,
                to: 'woo'
            }]
        });
    });
});

describe('jsapi', () => {
    const {sh} = require('./jsapi');
    it('should get the text', async () => {
        const output = await sh`echo "foo bar baz"`;
        expect(output).toEqual(['foo bar baz']);
    });
    it('should async iterate the text', async () => {
        const lines = [];
        for await (const line of sh`ls test-assets`) {
            lines.push(line);
        }
        expect(lines).toEqual(['bar.txt', 'baz.txt', 'foo.txt']);
    });
    it('should wait for sleep', async () => {
        const lines = [];
        for await (const line of sh`bash -c "echo 1; sleep .02; echo 2"`) {
            lines.push(line);
        }
        expect(lines).toEqual(['1', '2']);
    });
});

describe('transform', () => {
    const {transformCode, getAutocompletePrefix} = require('./transform');
    it('should be left alone', () => {
        shouldBeLeftAlone(`const foo = 'bar';`);
        shouldBeLeftAlone(`let foo = 'bar';`);
        shouldBeLeftAlone(`var foo = 'bar';`);
        shouldBeLeftAlone(`function foo() {
            foo;
        }`);
        shouldBeLeftAlone(`this`);
        shouldBeLeftAlone(`''.split('').toString();`);
        shouldBeLeftAlone(`await new Promise(x => setTimeout(x, 100));`);
        // shouldBeLeftAlone(`doesNotExist();`);
        // shouldBeLeftAlone(`doesNotExist = 5`);
    });
    it('should transform simple commands', () => {
        const code = `echo 'foo' bar' 'baz'`;
        expect(transformCode(code)).toEqual(`await sh("echo 'foo' bar' 'baz'")`);
    });
    it('should transform multiple statements', () => {
        const code = `cd foo; cd bar;
            nano`;
        expect(transformCode(code)).toEqual(`await sh("cd foo"); await sh("cd bar");
            await sh("nano")`);
    });
    it('should transform multiple statements on two lines', () => {
        const code = `foo bar
bar foo`;
        expect(transformCode(code)).toEqual(`await sh("foo bar")
await sh("bar foo")`);
    });
    it('should transform export', () => {
        const code = `export FOO=123`;
        expect(transformCode(code)).toEqual(`await sh("export FOO=123")`);
    });
    it('should transform with semi', () => {
        const code = `foo "1;"`;
        expect(transformCode(code)).toEqual(`await sh("foo \\"1;\\"")`);
    });
    it('should transform one-line if', () => {
        const code = `if (true) echo 123`;
        expect(transformCode(code)).toEqual(`if (true) await sh("echo 123")`);
    });
    it('should transform one-line if with condition', () => {
        const code = `if (Math.random() < 0.5) echo 123`;
        expect(transformCode(code)).toEqual(`if (Math.random() < 0.5) await sh("echo 123")`);
    });
    it('should get autocomplete prefix', () => {
        expect(getAutocompletePrefix('this.')).toEqual(`this`);
        expect(getAutocompletePrefix('this.bar.baz.')).toEqual(`this.bar.baz`);
        expect(getAutocompletePrefix('this.foo(); this.bar(); this.baz().')).toEqual(`this.baz()`);
        expect(getAutocompletePrefix('')).toEqual('');
        expect(getAutocompletePrefix('this.foo();')).toEqual('');
        expect(getAutocompletePrefix('const x = "')).toEqual(null);
        expect(getAutocompletePrefix('git st')).toEqual({shPrefix: 'git st'});
        expect(getAutocompletePrefix('if (true) echo')).toEqual({shPrefix: 'echo'});
    });
    it('should transform template parameters', () => {
        const code = 'echo foo${123}';
        expect(transformCode(code)).toEqual('await sh(`echo foo${123}`)');
    });
    function shouldBeLeftAlone(code) {
        expect(transformCode(code)).toEqual(code);
    }
});

describe('glob', () => {
    const {sh} = require('./jsapi');
    const {getResult} = require('.');
    it('should glob everything in the test-assets folder', async () => {
        const output = await sh`echo test-assets/*`;
        expect(output).toEqual(['test-assets/bar.txt test-assets/baz.txt test-assets/foo.txt']);
    });
    it('should not glob when there are quotes', async () => {
        const output = await sh`echo '*'`;
        expect(output).toEqual(['*']);
    });
    it('should fail when no globs are found', async () => {
        const output = await getResult('echo *iamnotreal*');
        expect(output).toEqual({
            code: 1,
            output: '',
            stderr: 'shjs: No matches found: *iamnotreal*\n',
        });
    });
});

describe('redirect', () => {
    const {sh} = require('./jsapi');
    const fs = require('fs');
    const path = require('path');
    const tempDir = path.join(__dirname, 'test-temp-dir');
    beforeEach(async () => {
        try {
        rimraf.sync(tempDir);
        } catch {}
        await fs.promises.mkdir(tempDir, {recursive: true});
    });
    it('should do a redirect to /dev/null', async () => {
        const output = await sh`echo hello > /dev/null`;
        expect(output).toEqual([]);
    });
    it('should do a redirect to a text file', async () => {
        const helloFile = path.join(tempDir, 'hello.txt');
        const output = await sh`echo hello > ${helloFile}`;
        expect(output).toEqual([]);
        expect(await fs.promises.readFile(helloFile, 'utf8')).toEqual('hello\n');
    });
})