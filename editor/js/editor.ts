import {Emitter} from './emitter';
import { isSelectionCollapsed, Loc, Model, TextRange } from './model';
import { Highlighter } from './highlighter';
import { Renderer } from './renderer';
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
    this._model.on('change', range => this.emit('change', range));
    this._model.on('selectionChanged', event => this.emit('selectionChanged', event));
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

  pointFromLocation(location: Loc) {
    return this._renderer.pointFromLocation(location);
  }

  lineHeight() {
    return this._renderer.lineHeight;
  }

  line(index: number) {
    return this._model.line(index);  
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
}

type EditorEvents = {
  'change': TextRange;
  'selectionChanged': { selections: TextRange[], previousSelections: TextRange[]};
};

export type EditorOptions = {
  padBottom?: boolean;
  lineNumbers?: boolean;
  language?: string;
  inline?: boolean;
  readOnly?: boolean;
  highlightWordOccurrences?: boolean;
  backgroundColor?: string;
  padding?: number;
  underlay?: (lineNumber: number, text: string) => Array<import('./highlighter').Token>;
  colors?: {
    foreground: string;
    selectionBackground: string;
    cursorColor: string;
  }
}

export type { TextRange } from './model';