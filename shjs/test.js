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
            {type: 'word', value: 'bar'},
            {type: 'word', value: 'baz'},
        ]);
    });
    it('should detect a pipe', () => {
        expect(tokenize('foo | bar')).toEqual([
            {type: 'word', value: 'foo'},
            {type: 'operator', value: '|'},
            {type: 'word', value: 'bar'},
        ]);
    });
    it('should handle double qoutes', () => {
        expect(tokenize('foo "bar baz"')).toEqual([
            {type: 'word', value: 'foo'},
            {type: 'word', value: 'bar baz'},
        ]);
    });
    it('should handle single qoutes', () => {
        expect(tokenize('foo \'bar baz\'')).toEqual([
            {type: 'word', value: 'foo'},
            {type: 'word', value: 'bar baz'},
        ]);
    });
    it('should handle escaped qoutes', () => {
        expect(tokenize(`foo "bar \\'baz\\'"`)).toEqual([
            {type: 'word', value: 'foo'},
            {type: 'word', value: `bar 'baz'`},
        ]);
    });
    it('should handle escaped qoutes 2', () => {
        expect(tokenize(`foo 'bar \\"baz\\"'"`)).toEqual([
            {type: 'word', value: 'foo'},
            {type: 'word', value: `bar \\"baz\\"`},
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