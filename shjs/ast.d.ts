export type Expression = SimpleExpression | PipeExpression | CompoundExpression;

export type SimpleExpression = {
    assignments?: Assignment[];
    executable: Word;
    args: Word[];
};

export type PipeExpression = {
    main: Expression;
    pipe: Expression;
};

export type Assignment = {
    name: string;
    value: Word;
}

export type Word = ((string|{replacement: string}|{glob: string})[]) | string;

export type CompoundExpression = {
    type: 'and'|'or',
    left: Expression,
    right: Expression,
};
