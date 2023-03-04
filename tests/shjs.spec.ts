import { test } from './fixtures';
import rimraf from 'rimraf';
import os from 'os';
import { getResult } from '../slug/shjs/runner';
import { sh } from '../slug/shjs/jsapi';
import { tokenize } from '../slug/shjs/tokenizer';
import { parse } from '../slug/shjs/parser';
import { transformCode, getAutocompletePrefix } from '../slug/shjs/transform';
import { execute, getResult as apiGetResult } from '../slug/shjs'
import fs from 'fs';
import path from 'path';
const { describe, expect } = test;
const it = test;
describe('runner', () => {
    it('should work', async () => {
        const result = await getResult({
            executable: 'echo',
            args: ['hello']
        });
        expect(result).toEqual({
            output: 'hello\n',
            stderr: '',
            code: 0
        })
    });
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
            stderr: os.platform() === 'darwin' ? 'ls: not_a_real_directory: No such file or directory\n' : "ls: cannot access 'not_a_real_directory': No such file or directory\n",
            code: os.platform() === 'darwin' ? 1 : 2,
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
            stderr: os.platform() === 'darwin' ? 'ls: not_a_real_directory: No such file or directory\n' : "ls: cannot access 'not_a_real_directory': No such file or directory\n",
            code: 0
        })
    });
});

describe('tokenizer', () => {
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
    it('should handle a full line comment', () => {
        expect(tokenize('# the comment').tokens).toEqual([
            {type: 'comment', value: ' the comment', raw: '# the comment'},
        ]);
    });
    it('should handle a partial line comment', () => {
        expect(tokenize('foo # the comment').tokens).toEqual([
            {type: 'word', value: 'foo', raw: 'foo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'comment', value: ' the comment', raw: '# the comment'},
        ]);
    });
    it('should comment out special tokens', () => {
        expect(tokenize('# test ;\'\"*+-&><|').tokens).toEqual([
            {type: 'comment', value: ' test ;\'\"*+-&><|', raw: '# test ;\'\"*+-&><|'},
        ]);
    });
    it('should parse after the comment', () => {
        // only gets one line becasue we stop after a \n.
        expect(tokenize('# comment\npwd').tokens).toEqual([
            {type: 'comment', value: ' comment', raw: '# comment'},
            // {type: 'word', value: 'pwd', raw: '\npwd'},
        ]);
    });
    it('should parse two comments', () => {
        // only gets one line becasue we stop after a \n.
        expect(tokenize('# comment\n# again').tokens).toEqual([
            {type: 'comment', value: ' comment', raw: '# comment'},
        ]);
    });
    it('should ignore escaped newlines', () => {
        expect(tokenize('foo \\\n bar').tokens).toEqual([
            {type: 'word', value: 'foo', raw: 'foo'},
            {type: 'space', value: '  ', raw: ' \\\n '},
            {type: 'word', value: 'bar', raw: 'bar'},
        ]);
        expect(tokenize('foo\\\nbar').tokens).toEqual([
            {type: 'word', value: 'foobar', raw: 'foo\\\nbar'},
        ]);
    });
    it('should tokenize ~ replacements', () => {
        expect(tokenize('echo ~').tokens).toEqual([
            {type: 'word', value: 'echo', raw: 'echo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'replacement', value: '~', raw: '~'},
        ]);
        expect(tokenize('echo ~+').tokens).toEqual([
            {type: 'word', value: 'echo', raw: 'echo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'replacement', value: '~+', raw: '~+'},
        ]);
        expect(tokenize('echo ~-').tokens).toEqual([
            {type: 'word', value: 'echo', raw: 'echo'},
            {type: 'space', value: ' ', raw: ' '},
            {type: 'replacement', value: '~-', raw: '~-'},
        ]);
    })
});

describe('parser', () => {
    it('should do a simple command', () => {
        const {tokens} = tokenize('foo bar baz');
        expect(parse(tokens)).toEqual({
            executable: 'foo',
            args: ['bar', 'baz']
        });
    });
    it('should ignore comments', () => {
        const {tokens} = tokenize('foo bar baz # comment');
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
    it('should get the text', async () => {
        const output = await sh`echo "foo bar baz"`;
        expect(output).toEqual(['foo bar baz']);
    });
    it('should async iterate the text', async () => {
        const lines: string[] = [];
        for await (const line of sh`ls tests/test-assets`) {
            lines.push(line);
        }
        expect(lines).toEqual(['bar.txt', 'baz.txt', 'foo.txt']);
    });
    it('should wait for sleep', async () => {
        const lines: string[] = [];
        for await (const line of sh`bash -c "echo 1; sleep .02; echo 2"`) {
            lines.push(line);
        }
        expect(lines).toEqual(['1', '2']);
    });
});

describe('transform', () => {
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
        shouldBeLeftAlone(`doesExist();`, 'sh', new Set(['doesExist']));
        shouldBeLeftAlone(`doesExist = 5`, 'sh', new Set(['doesExist']));
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
        expect(autocompleteToString('this.')).toEqual(`this`);
        expect(autocompleteToString('this.bar.baz.')).toEqual(`this.bar.baz`);
        expect(autocompleteToString('this.foo(); this.bar(); this.baz().')).toEqual(`this.baz()`);
        expect(autocompleteToString('')).toEqual('');
        expect(autocompleteToString('this.foo();')).toEqual('');
        expect(autocompleteToString('const x = "')).toEqual(null);
        expect(autocompleteToString('git st', true)).toEqual('git st');
        expect(autocompleteToString('if (true) echo', true)).toEqual('echo');
        function autocompleteToString(code, shouldBeSH = false) {
            const result = getAutocompletePrefix(code);
            if (!result)
                return result;
            const { start, end, isSh } = result;
            expect(isSh).toEqual(shouldBeSH);
            return code.slice(start, end);
        }
    });
    it('should transform template parameters', () => {
        const code = 'echo foo${123}';
        expect(transformCode(code)).toEqual('await sh(`echo foo${123}`)');
    });
    it('should transform shell comments', () => {
        const code = '# foo';
        expect(transformCode(code)).toEqual('// foo');
    });
    it('should transform with escaped newlines', () => {
        const code = 'echo foo \\\n bar';
        expect(transformCode(code)).toEqual('await sh("echo foo \\\\\\n bar")');
    });
    it('should transform http-server', () => {
        const code = `http-server start`;
        const globalVars = new Set(['http']);
        expect(transformCode(code, 'sh', globalVars)).toEqual(`await sh("http-server start")`);
    });
    it('should leave http - server alone', () => {
        const code = `http - server start`;
        const globalVars = new Set(['http']);
        shouldBeLeftAlone(code, 'sh', globalVars);
    });
    function shouldBeLeftAlone(code, ...args) {
        expect(transformCode(code, ...args)).toEqual(code);
    }
});

describe('glob', () => {
    it('should glob everything in the test-assets folder', async () => {
        const output = await sh`echo tests/test-assets/*`;
        expect(output).toEqual(['tests/test-assets/bar.txt tests/test-assets/baz.txt tests/test-assets/foo.txt']);
    });
    it('should not glob when there are quotes', async () => {
        const output = await sh`echo '*'`;
        expect(output).toEqual(['*']);
    });
    it('should fail when no globs are found', async () => {
        const output = await apiGetResult('echo *iamnotreal*');
        expect(output).toEqual({
            code: 1,
            output: '',
            stderr: 'shjs: No matches found: *iamnotreal*\n',
        });
    });
});

describe('redirect', () => {
    it('should do a redirect to /dev/null', async () => {
        const output = await sh`echo hello > /dev/null`;
        expect(output).toEqual([]);
    });
    it('should do a redirect to a text file', async ({workingDir}) => {
        const helloFile = path.join(workingDir, 'hello.txt');
        const output = await sh`echo hello > ${helloFile}`;
        expect(output).toEqual([]);
        expect(await fs.promises.readFile(helloFile, 'utf8')).toEqual('hello\n');
    });
    it('should do a redirect from a text file', async ({workingDir}) => {
        const helloFile = path.join(workingDir, 'hello.txt');
        fs.writeFileSync(helloFile, "hello world\n", "utf8");
        const output = await sh`cat < ${helloFile}`;
        expect(output).toEqual(['hello world']);
    });
});

describe('replacements', () => {
    it('should replace ~ with the home directory', async () => {
        const output = await sh`echo ~`;
        expect(output).toEqual([os.homedir()]);
    });
    it('should replace $HOME with the home directory', async () => {
        const output = await sh`echo $HOME`;
        expect(output).toEqual([os.homedir()]);
    });
    it('should replace ~- with the previous directory', async ({workingDir}) => {
        await sh`cd ${workingDir} && cd ..`;
        const output = await sh`echo ~-`;
        expect(output).toEqual([workingDir]);
    });
    it('should replace ~+ with the current directory', async ({workingDir}) => {
        await sh`cd ${workingDir}`;
        const output = await sh`echo ~+`;
        expect(output).toEqual([workingDir]);
    });
    it('should cd - to the previous directory', async ({workingDir}) => {
        await sh`cd ${workingDir} && cd ..`;
        const output = await sh`cd - && pwd`;
        expect(output).toEqual([workingDir, workingDir]);
    });
});

describe('kill', () => {
    it('should kill a process', async () => {
        const { closePromise, kill } = execute('sleep 100');
        expect(kill(9)).toBe(true);
        await closePromise;
    });
    it('should kill a process anded with another process', async () => {
        const { closePromise, kill } = execute('sleep 100 && sleep 100');
        expect(kill(9)).toBe(true);
        await closePromise;
    });
    it('should kill a process orred with another process', async () => {
        const { closePromise, kill } = execute('sleep 100 && sleep 100');
        expect(kill(9)).toBe(true);
        await closePromise;
    });
    it('should kill a process piped with another process', async () => {
        const { closePromise, kill } = execute('sleep 100 | sleep 100');
        expect(kill(9)).toBe(true);
        await closePromise;
    });
});

describe('api', () => {
    it('should fail on an unsafe command', async () => {
        const output = await apiGetResult('rm', true);
        expect(output).toEqual({
            code: 1,
            output: '',
            stderr: 'shjs: side effect\n',
        });
    });
    it('should work with a comment line', async () => {
        const output = await apiGetResult('# i am a comment', true);
        expect(output).toEqual({
            code: 0,
            output: '',
            stderr: '',
        });
    });
    it('should work with a comment line prefix', async () => {
        const output = await apiGetResult('# i am a comment\necho foo', true);
        expect(output).toEqual({
            code: 0,
            output: 'foo\n',
            stderr: '',
        });
    });
});
