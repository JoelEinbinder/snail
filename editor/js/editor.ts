import {Emitter} from './emitter.js';
import { Model } from './model.js';
import { Highlighter } from './highlighter.js';
import { Renderer } from './renderer.js';
import { CommandManager } from './commands.js';
import { Input } from './input.js';
import { SelectionManger } from './selections.js';
export class Editor {
  private _model: Model;
  readonly element: HTMLDivElement;
  private _highlighter: Highlighter;
  private _renderer: Renderer;
  private _commandManager: CommandManager;
  private _input: Input;
  private _selectionManager: SelectionManger;
  constructor(data: string, options: EditorOptions | undefined = {}) {
    this._model = new Model(data);
    this.element = document.createElement('div');
    this.element.className = 'editor';
    this.element.tabIndex = -1;

    this._highlighter = new Highlighter(this._model, options.language, options.underlay);
    this._renderer = new Renderer(this._model, this.element, this._highlighter, options);
    this._commandManager = new CommandManager(this.element);
    this._input = new Input(this.element, this._model, this._commandManager, this._renderer, options.readOnly);
    this._selectionManager = new SelectionManger(this._renderer, this._model, this._commandManager);
  }

  layout() {
    this._renderer.layout();
  }

  focus() {
    this.element.focus();
  }
}

export type EditorOptions = {
  padBottom?: boolean;
  lineNumbers?: boolean;
  language?: string;
  inline?: boolean;
  readOnly?: boolean;
  highlightWordOccurrences?: boolean;
  underlay?: (lineNumber: number, text: string) => Array<import('./highlighter').Token>;
}

