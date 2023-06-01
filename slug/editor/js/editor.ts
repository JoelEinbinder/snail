
import {keymap, highlightSpecialChars, drawSelection, scrollPastEnd,
  lineNumbers, EditorView, Decoration, DecorationSet} from "@codemirror/view"
import {Extension, EditorState, StateEffect, StateField} from "@codemirror/state"
import {syntaxHighlighting, indentOnInput, StreamLanguage, HighlightStyle} from "@codemirror/language"
import {defaultKeymap, history, historyKeymap, indentLess, indentMore, insertNewlineAndIndent} from "@codemirror/commands"
import { tags, Tag } from '@lezer/highlight';
import {Emitter} from './emitter';
import '../modes/javascript';
import { getMode } from './modeRegistry';

const shTags = {
  sh: Tag.define(),
  replacement: Tag.define(),
  template: Tag.define(),
  string: Tag.define(),
}

const addSquiggly = StateEffect.define<{from: number, to: number}>({
  map: ({from, to}, change) => ({from: change.mapPos(from), to: change.mapPos(to)})
});
const squigglyMark = Decoration.mark({class: "squiggly"});
const squigglyField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(squigglies, tr) {
    squigglies = squigglies.map(tr.changes)
    for (const e of tr.effects) if (e.is(addSquiggly)) {
      squigglies = squigglies.update({
        add: [squigglyMark.range(Math.min(e.value.from, e.value.to - 1), e.value.to)]
      });
    }
    return squigglies
  },
  provide: f => EditorView.decorations.from(f)
});

const setHighlights = StateEffect.define<{from: number, to: number, color: string}[]>();
const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(highlights, tr) {
    highlights = highlights.map(tr.changes)
    highlights = highlights.update({
      filter: () => false,
    });
    for (const e of tr.effects) if (e.is(setHighlights)) {
      for (const {from, to, color} of e.value) {
        const highlightMark = Decoration.mark({attributes: {
          style: `background-color: ${color}`
        }});
        highlights = highlights.update({
          add: [highlightMark.range(from, to)]
        });
      }
    }
    return highlights;
  },
  provide: f => EditorView.decorations.from(f)
});


const snailStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#af5fff' },
  { tag: tags.number, color: '#999900' },
  { tag: tags.comment, color: '#666666' },
  { tag: tags.string, color: '#00A600' },
  // { tag: tags.string2, color: '#00A600' },
  // { tag: tags.atom, color: '#F4F4F4' },
  // { tag: tags.def, color: '#F4F4F4' },
  // { tag: tags.operator, color: '#F4F4F4' },
  // { tag: tags.meta, color: '#F4F4F4' },
  { tag: tags.variableName, color: '#afd7ff' },
  { tag: tags.propertyName, color: '#afd7ff' },
  { tag: tags.definition(tags.propertyName), color: '#afd7ff' },
  { tag: tags.definition(tags.variableName), color: '#afd7ff' },
  // { tag: tags.string, color: '#999900' },
  { tag: shTags.sh, color: '#f4f4f4' },
  { tag: shTags.replacement, color: '#E5E500' },
  { tag: shTags.template, color: '#00A6B2' },
  { tag: shTags.string, color: '#999900' },
]);
const minimalSetup: Extension = (() => [
  highlightSpecialChars(),
  history(),
  drawSelection(),
  indentOnInput(),
  syntaxHighlighting(snailStyle, {fallback: true}),
  keymap.of([
    ...defaultKeymap,
    ...historyKeymap,
    {
      key: 'Tab',
      run: indentMore,
      shift: indentLess,
    },
  ])
])()
const darkTheme = EditorView.theme({
  "&": {
    // color: "white",
    // backgroundColor: "#034"
  },
  ".cm-content": {
    caretColor: "currentColor",
    padding: "0px",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "currentColor"
  },
  "&.cm-focused": {
    outline: 'none',
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "#074"
  },
  ".squiggly": {
    textDecoration: "underline 1px #E50000",
    textDecorationSkipInk: "none",
    textDecorationStyle: 'wavy',
  },
  ".cm-gutters": {
    color: '#666',
    background: '#000'
  }
}, {dark: true})

export class Editor extends Emitter<EditorEvents> {
  private _view: EditorView;
  private _language: Extension = [];
  constructor(data: string, private _options: EditorOptions = {}) {
    super();

    this._setLanguageConfig(this._options.modeOptions);
    this._view = new EditorView({
      doc: data,
      extensions: this._extensions(),
    });
    
    
    // this.element = document.createElement('div');
    // this.element.className = 'editor';
    // this.element.tabIndex = -1;
    // this._renderer.on('might-resize', () => this.emit('might-resize', undefined));
    // this._model.on('selection-changed', event => this.emit('selection-changed', event));
  }

  private _setLanguageConfig(config: any = {}) {
    const modeFactory = getMode(this._options.language || 'txt');
    const mode = modeFactory?.({
      indentUnit: 2,
      ...config,
    }, { });
    if (!mode) {
      this._language = [];
      return;
    }
    this._language = StreamLanguage.define({
      name: 'stream language',
      token(stream, state) {
        return mode.token(stream, state);
      },
      startState(indentUnit) {
        return mode.startState();
      },
      blankLine(state, indentUnit) {
          mode.blankLine?.(state);
      },
      indent(state, textAfter, context) {
        const ret = mode.indent?.(state, textAfter)
        return ret === undefined ? null : ret;
      },
      tokenTable: {
        'sh': shTags.sh,
        'sh-replacement': shTags.replacement,
        'sh-template': shTags.template,
        'sh-string': shTags.string,
      },
      languageData: {
        closeBrackets: {
            brackets: ["(", "[", "{", "'", '"', "`"]
        },
        commentTokens: {
            line: "//",
            block: {
                open: "/*",
                close: "*/"
            }
        },
        indentOnInput: /^\s*(?:case |default:|\{|\}|<\/)$/,
        wordChars: "$"
      }
    }).extension;  
  }

  private _extensions() {
    return [
      this._language,
      this._options.lineNumbers ? lineNumbers() : undefined,
      this._options.padBottom ? scrollPastEnd() : undefined,
      minimalSetup,
      darkTheme,
      squigglyField.extension,
      highlightField.extension,
      EditorView.lineWrapping,
      EditorView.editable.of(!this._options.readOnly),
      EditorView.updateListener.of(update => {
      if (update.selectionSet)
        this.emit('selection-changed', undefined);
      update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        this.emit('change', {
          range: {
            start: this._offsetToLoc(fromB),
            end: this._offsetToLoc(toB),
          },
          text: inserted.toString(),
        })
      });
    })].filter(x => x) as Extension[];
  }
  
  get element() {
    return this._view.dom;
  }

  layout() {
    // TODO
  }

  focus() {
    this._view.focus();
    
  }

  get value() {
    return this._view.state.doc.sliceString(0);
  }

  set value(value: string) {
    this._view.setState(EditorState.create({
      doc: value,
      extensions: this._extensions(),
      selection: this._view.state.selection,
    }));
  }

  get selections() {
    return this._view.state.selection.ranges.map(range => {
      return {
        start: this._offsetToLoc(range.from),
        end: this._offsetToLoc(range.to),
      };
    });
  }

  setSelection(selection: TextRange) {
    const { from, to } = this._rangeToCMRange(selection);
    this._view.dispatch({
      selection: {
        anchor: from,
        head: to,
      }
    });
  }

  text(range?: TextRange) {
    if (!range)
      return this.value;
    return this._view.state.doc.sliceString(this._locToOffset(range.start), this._locToOffset(range.end))
  }

  replaceRange(text: string, range: TextRange): Loc {
    const { from, to } = this._rangeToCMRange(range);
    this._view.dispatch({
      changes: {
        from, to,
        insert: text
      }
    });
    return this._offsetToLoc(from + text.length);
  }

  smartEnter() {
    return insertNewlineAndIndent(this._view);
  }

  pointFromLocation(location: Loc) {
    const coords = this._view.coordsAtPos(this._locToOffset(location));
    const rect = this._view.dom.getBoundingClientRect();
    return coords ? {
      x: coords?.left - rect.left,
      y: coords?.top - rect.top,
    } : null;
  }

  lineHeight() {
    return this._view.defaultLineHeight;
  }

  line(index: number) {
    return this._view.state.doc.line(index + 1);
  }

  addSquiggly(range: TextRange) {
    const { from, to } = this._rangeToCMRange(range);
    this._view.dispatch({effects: [addSquiggly.of({from, to})]});
  }

  get lastLine() {
    return this._view.state.doc.lines - 1;
  }

  somethingSelected() {
    return this._view.state.selection.ranges.some(r => !r.empty);
  }

  setModeOptions(options: any) {
    this._setLanguageConfig(options);
    this._view.setState(EditorState.create({
      doc: this._view.state.doc,
      extensions: this._extensions(),
    }));
  }

  setHighlightRanges(highlightRanges: HighlightRanges) {
    const convertedHighlights = highlightRanges.map(({range, color}) => {
      const { from, to } = this._rangeToCMRange(range);
      return {from ,to, color};
    });
    this._view.dispatch({effects: setHighlights.of(convertedHighlights)});
  }

  private _locToOffset(pos: Loc): number {
    const clippedLine = Math.min(pos.line, this._view.state.doc.lines - 1);
    const line = this._view.state.doc.line(clippedLine + 1);
    return line.from + Math.min(pos.column, line.length);
  }
  private _offsetToLoc(offset: number, state = this._view.state): Loc {
    let line = state.doc.lineAt(offset)
    return {line: line.number - 1, column: offset - line.from}
  }

  private _rangeToCMRange(range: TextRange): CMRange {
    return {
      from: this._locToOffset(range.start),
      to: this._locToOffset(range.end),
    };
  }
}
type CMRange = {
  from: number,
  to: number,
}

type EditorEvents = {
  'change': { range: TextRange, text: string };
  'might-resize': void;
  'selection-changed': void;
};

export type Loc = {
  column: number;
  line: number;
};

export type TextRange = {
  start: Loc;
  end: Loc;
};

export type EditorOptions = {
  padBottom?: boolean;
  lineNumbers?: boolean;
  language?: string;
  modeOptions?: any;
  inline?: boolean;
  readOnly?: boolean;
  highlightWordOccurrences?: boolean;
  backgroundColor?: string;
  padding?: number;
  colors?: {
    foreground: string;
    selectionBackground: string;
    cursorColor: string;
    gutterBackground?: string;
    gutterForeground?: string;
    gutterBorder?: string;
  }
};
export type HighlightRanges = {
  range: TextRange,
  color: string,
}[];