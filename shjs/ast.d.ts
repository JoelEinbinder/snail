export type Expression = SimpleExpression | PipeExpression | CompoundExpression;

export type SimpleExpression = {
    executable: string;
    args: string[];
};

export type PipeExpression = {
    main: Expression;
    pipe: Expression;
};

export type CompoundExpression = {
    type: 'and'|'or',
    left: Expression,
    right: Expression,
};

export type Command = (options: {
    args: string[],
    stdout: NodeJS.WritableStream,
    stderr: NodeJS.WritableStream
}) => {
    stdin: NodeJS.WritableStream,
    closePromise: Promise<number>,
};