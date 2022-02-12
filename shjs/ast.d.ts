export type Expression = SimpleExpression | PipeExpression | CompoundExpression;

export type SimpleExpression = {
    executable: Word;
    args: Word[];
};

export type PipeExpression = {
    main: Expression;
    pipe: Expression;
};

export type Word = ((string|{replacement: string})[]) | string;

export type CompoundExpression = {
    type: 'and'|'or',
    left: Expression,
    right: Expression,
};
