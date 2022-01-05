import {Emitter} from './emitter.js';
import { Model } from './model.js';
import { Highlighter } from './highlighter.js';
import { Renderer } from './renderer.js';
import { CommandManager } from './commands.js';
import { Input } from './input.js';
import { SelectionManger } from './selections.js';
export class Editor extends Emitter {
  /**
   * @param {string} data
   * @param {EditorOptions=} options
   */
  constructor(data, options = {}) {
    super();
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

/**
 * @typedef {Object} EditorOptions
 * @property {boolean=} padBottom
 * @property {boolean=} lineNumbers
 * @property {string=} language
 * @property {boolean=} inline
 * @property {boolean=} readOnly
 * @property {function(number,string):Array<Token>} [underlay]
 */
