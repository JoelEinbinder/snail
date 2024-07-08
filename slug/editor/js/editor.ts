import {Emitter} from './emitter';
import { isSelectionCollapsed, Loc, Model, TextRange } from './model';
import { Highlighter } from './highlighter';
import { Renderer, HighlightRanges } from './renderer';
import { CommandManager } from './commands';
import { Input } from './input';
import { SelectionManger } from './selections';
export class Editor extends Emitter<EditorEvents> {
  private _model: Model;
  readonly element: HTMLDivElement;
  private _highlighter: Highlighter;
  private _renderer: Renderer;
  private _commandManager: CommandManager;
  private _input: Input;
  private _selectionManager: SelectionManger;
  constructor(data: string, options: EditorOptions | undefined = {}) {
    super();
    this._model = new Model(data);
    this.element = document.createElement('div');
    this.element.className = 'editor';
    this.element.tabIndex = -1;

    this._highlighter = new Highlighter(this._model, options.language, options.underlay, options.colors);
    this._renderer = new Renderer(this._model, this.element, this._highlighter, options);
    this._commandManager = new CommandManager(this.element);
    this._input = new Input(this.element, this._model, this._commandManager, this._renderer, options.readOnly);
    this._selectionManager = new SelectionManger(this._renderer, this._model, this._commandManager);
    this._model.on('change', change => this.emit('change', change));
    this._renderer.on('might-resize', () => this.emit('might-resize', undefined));
    this._model.on('selection-changed', event => this.emit('selection-changed', event));
  }

  layout() {
    this._renderer.layout();
  }

  focus() {
    this.element.focus();
  }

  get value() {
    return this._model.text();
  }

  set value(value: string) {
    this._model.replaceRange(value, this._model.fullRange());
  }

  get selections() {
    return this._model.selections;
  }

  set selections(selections: TextRange[]) {
    this._model.setSelections(selections);
  }

  text(range?: TextRange) {
    return this._model.text(range);
  }

  replaceRange(text: string, range: TextRange): Loc {
    return this._model.replaceRange(text, range);
  }

  smartEnter() {
    const indentation = this._highlighter.indentation(this._model.selections[0].start.line);
    this._input.insertText('\n' + '\t'.repeat(indentation / this._renderer.TAB.length));
  }

  pointFromLocation(location: Loc) {
    return this._renderer.pointFromLocation(location);
  }

  lineHeight() {
    return this._renderer.lineHeight;
  }

  charWidth() {
    return this._renderer.charWidth;
  }

  gutterWidth() {
    return this._renderer.gutterWidth;
  }

  line(index: number) {
    return this._model.line(index);  
  }

  addSquiggly(range: TextRange, color: string) {
    this._model.addSquiggly(range, color);
  }

  get lastLine() {
    return this._model.fullRange().end.line;
  }

  somethingSelected() {
    const selections = this._model.selections;
    if (!selections.length)
      return false;
    for (const selection of selections) {
      if (!isSelectionCollapsed(selection))
        return true;
    }
    return false;
  }

  setModeOptions(options: any) {
    this._highlighter.setModeOptions(options);
  }

  setMode(language: string) {
    this._highlighter.setMode(language);
  }

  language() {
    return this._highlighter.language();
  }

  setHighlightRanges(highlightRanges: HighlightRanges) {
    this._renderer.setHighlightRanges(highlightRanges);
  }

  selectAll() {
    this._selectionManager.selectAll();
  }
}

type EditorEvents = {
  'change': { range: TextRange, text: string };
  'might-resize': void;
  'selection-changed': { selections: TextRange[], previousSelections: TextRange[]};
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
  wordWrap?: boolean;
  underlay?: (lineNumber: number, text: string) => Array<import('./highlighter').Token>;
  colors?: {
    foreground: string;
    selectionBackground: string;
    cursorColor: string;
    gutterBackground?: string;
    gutterForeground?: string;
    gutterBorder?: string;
    tokenColors?: [string, string][];
  }
}

export type { TextRange } from './model';
export type { HighlightRanges } from './renderer';