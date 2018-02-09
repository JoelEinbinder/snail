class Editor extends Emitter {
  /**
   * @param {string} data
   * @param {Editor.Options=} options
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
    this._input = new Input(this.element, this._model, this._commandManager, options.readOnly);
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
 * @typedef {Object} Editor.Options
 * @property {boolean=} padBottom
 * @property {boolean=} lineNumbers
 * @property {string=} language
 * @property {boolean=} inline
 * @property {boolean=} readOnly
 * @property {function(number,string):Array<Token>} [underlay]
 */
