const {it, describe} = require('mocha');
const expect = require('expect');
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
        expect(tokenize('foo bar  baz')).toEqual([
            {type: 'word', value: 'foo'},
            {type: 'space', value: ' '},
            {type: 'word', value: 'bar'},
            {type: 'space', value: '  '},
            {type: 'word', value: 'baz'},
        ]);
    });
    it('should detect a pipe', () => {
        expect(tokenize('foo | bar')).toEqual([
            {type: 'word', value: 'foo'},
            {type: 'space', value: ' '},
            {type: 'operator', value: '|'},
            {type: 'space', value: ' '},
            {type: 'word', value: 'bar'},
        ]);
    });
    it('should handle double qoutes', () => {
        expect(tokenize('foo "bar baz"')).toEqual([
            {type: 'word', value: 'foo'},
            {type: 'space', value: ' '},
            {type: 'word', value: 'bar baz'},
        ]);
    });
    it('should handle single qoutes', () => {
        expect(tokenize('foo \'bar baz\'')).toEqual([
            {type: 'word', value: 'foo'},
            {type: 'space', value: ' '},
            {type: 'word', value: 'bar baz'},
        ]);
    });
    it('should handle escaped qoutes', () => {
        expect(tokenize(`foo "bar \\'baz\\'"`)).toEqual([
            {type: 'word', value: 'foo'},
            {type: 'space', value: ' '},
            {type: 'word', value: `bar 'baz'`},
        ]);
    });
    it('should handle escaped qoutes 2', () => {
        expect(tokenize(`foo 'bar \\"baz\\"'"`)).toEqual([
            {type: 'word', value: 'foo'},
            {type: 'space', value: ' '},
            {type: 'word', value: `bar \\"baz\\"`},
        ]);
    });
    it('should handle empty qoutes', () => {
        expect(tokenize(`foo '' "" 'a'`)).toEqual([
            {type: 'word', value: 'foo'},
            {type: 'space', value: ' '},
            {type: 'word', value: ''},
            {type: 'space', value: ' '},
            {type: 'word', value: ''},
            {type: 'space', value: ' '},
            {type: 'word', value: 'a'},
        ]);
    });
});

describe('parser', () => {
    const {parse} = require('./parser');
    const {tokenize} = require('./tokenizer');
    it('should do a simple command', () => {
        const tokens = tokenize('foo bar baz');
        expect(parse(tokens)).toEqual({
            executable: 'foo',
            args: ['bar', 'baz']
        });
    });
    it('should do a pipe command', () => {
        const tokens = tokenize('foo bar baz | grep "woo"');
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
        const tokens = tokenize('foo bar baz | grep "woo" | grep "zoo"');
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
        const tokens = tokenize('foo bar baz && man "woo"');
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
        const tokens = tokenize('foo bar baz || man "woo"');
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
    const {transformCode} = require('./transform');
    it('should be left alone', () => {
        shouldBeLeftAlone(`const foo = 'bar';`);
        shouldBeLeftAlone(`let foo = 'bar';`);
        shouldBeLeftAlone(`var foo = 'bar';`);
        shouldBeLeftAlone(`function foo() {
            foo;
        }`);
        shouldBeLeftAlone(`this`);
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
    it('should transform export', () => {
        const code = `export FOO=123`;
        expect(transformCode(code)).toEqual(`await sh("export FOO=123")`);
    });
    function shouldBeLeftAlone(code) {
        expect(transformCode(code)).toEqual(code);
    }
})