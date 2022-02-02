const {it} = require('mocha');
const expect = require('expect');
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