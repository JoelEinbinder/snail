import type { Shell, ShellDelegate } from './Shell';
import './shell.css';
import './logView.css';
import { Block, BlockDelegate } from './GridPane';
import { startAyncWork } from './async';
import { makeLazyProxy } from './LazyProxy';
import { UIThrottle } from './UIThrottle';
import { Action, makeChordShortcut } from './actions';
import type { LogItem } from './LogItem';
import { Find, Findable, FindableList, type FindParams } from './Find';
import { attachMenuItemsToContextMenuEvent } from './contextMenu';
import { QuickPickProvider, showQuickPick } from './QuickPick';
import { diff_match_patch, DIFF_EQUAL, DIFF_INSERT, DIFF_DELETE } from './diff_match_patch';
import { iconPathForPath } from '../slug/icon_service/iconService';
import { Placeholder } from './Placeholder';
import { font } from './font';
import { FakeScrollBar } from './FakeScrollBar';
import { host, sendStreamingCommandToHost } from './host';

export class LogView implements Block, ShellDelegate, Findable {
  private _element = document.createElement('div');
  private _scroller = document.createElement('div');
  private _fullscreenElement = document.createElement('div');
  private _prompt?: LogItem;
  private _lockingScroll = false;
  private _undoFullscreen: () => void = null;
  private _log = new FindableList<LogItem>();
  private _activeItem: LogItem | null = null;
  private _activeItemListeners = new Set<() => void>();
  private _itemToElement = new WeakMap<LogItem, Element>();
  private _itemToParent = new WeakMap<LogItem, LogItem>();
  private _itemToRetainers = new WeakMap<LogItem, Set<LogItem|'forced'>>();
  private _suffixThrottle = new UIThrottle('', () => {
    this.blockDelegate?.titleUpdated();
  });
  private _titleThrottle = new UIThrottle('Loading...', () => {
    this.blockDelegate?.titleUpdated();
  });
  private _promptChangePromise: Promise<void>;
  private _promptChangeResolve: () => void;
  private _find = new Find(this, () => this.focus());
  private _llmAbortController: AbortController|null = null;
  private _isMockAI = false;
  blockDelegate?: BlockDelegate;
  constructor(private _shell: Shell, private _container: HTMLElement) {
    this._updatePromptChangePromise();
    this._fullscreenElement.classList.add('fullscreen-element');
    this._element.addEventListener('keydown', (event: KeyboardEvent) => {
      if (!this._prompt)
        return;
      if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey)
        return;
      const element = document.activeElement as HTMLElement;
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT' || element.isContentEditable)
        return;
      if (event.defaultPrevented)
        return;
      this._prompt.focus();
    }, false);
    this._container.appendChild(this._element);
    this._scroller.classList.add('log-view-scroller');
    this._element.classList.add('log-view');
    this._element.append(this._scroller);
    this._scroller.addEventListener('scroll', event => {
      for (const item of this._log)
        item.onScroll?.();
    }, { passive: true });
    if (navigator['userAgentData']?.platform === 'Linux') {
      const fakeScrollBar = new FakeScrollBar(this._scroller);
      this._element.append(fakeScrollBar.element);
    }
    this.hide();
  }

  cancelLLMRequest(): void {
    this._element.classList.toggle('ai-loading', false);
    this._llmAbortController?.abort();
  }

  _updatePromptChangePromise() {
    this._promptChangePromise = new Promise(resolve => this._promptChangeResolve = resolve);
  }
  hide(): void {
    for (const item of this._log)
      item.willHide?.();
    this._element.style.display = 'none';
  }
  show(): void {
    this._element.style.removeProperty('display');
    for (const item of this._log)
      item.wasShown?.();
  }
  title(): string {
    return this._titleThrottle.value + this._suffixThrottle.value;
  }
  close(): void {
    this._element.remove();
    this._shell.close();
  }

  setActiveItem(item: LogItem|null) {
    this._activeItem = item;
    item?.focus();
    this._activeItemListeners.forEach(listener => listener());
  }

  togglePrompt(showPrompt: boolean): void {
    if (showPrompt) {
      this._addPrompt();
    } else {
      this._prompt?.dispose();
      delete this._prompt;
    }
    this._promptChangeResolve();
    this._updatePromptChangePromise();
  }

  focus(): void {
    if (this._prompt)
      this._prompt?.focus();
    else if (this._activeItem)
      this._activeItem.focus();
  }
  hasFocus(): boolean {
    return this._element.contains(document.activeElement);
  }

  async _triggerLLM(): Promise<void> {
    if (!this._prompt)
      return;
    const done = startAyncWork('ai');
    this._llmAbortController?.abort();
    const controller = new AbortController();
    this._llmAbortController = controller;
    this._element.classList.toggle('ai-loading', true);
    await this._prompt.flushForLLM();
    while (!this._prompt)
      await this._promptChangePromise;
    const iterator = this._isMockAI ? mockCompletions() : await openAICompletions(this._shell, this._log, controller.signal); 
    if (iterator)
      await this._prompt.recieveLLMAction(iterator, controller.signal);  
    if (this._llmAbortController === controller) {
      this._element.classList.toggle('ai-loading', false);
      this._llmAbortController = null;
    }
    done();
  }

  addItem(item: LogItem, parent?: LogItem) {
    this._log.push(item);
    if (parent && !parent.acceptsChildren)
      throw new Error('Parent does not accept children');
    
    const element = !item.acceptsChildren ? item.render() : this._wrapItem(item);
    if (!element)
      return;
    this._itemToElement.set(item, element);
    item.willResizeEvent.on(async () => {
      if (!this._itemToElement.has(item))
          return;
      const rect = this._itemToElement.get(item).getBoundingClientRect();
      const scrollBottom = this._scroller.scrollHeight - this._scroller.scrollTop - this._scroller.offsetHeight;
      if (rect.bottom < this._scroller.getBoundingClientRect().top || scrollBottom < font.current.size)
        this._lockScroll();
    });
    this._lockScroll();
    if (parent) {
      const parentWrapper = this._itemToElement.get(parent);
      parentWrapper.appendChild(element);
      this._itemToParent.set(item, parent);
      this.addRetainer({item, parent});
    } else {
      const promptElement = this._prompt?.render();
      if (promptElement && promptElement.parentElement === this._scroller)
        this._scroller.insertBefore(element, this._prompt.render());
      else
        this._scroller.appendChild(element);
    }
    this._itemToRetainers.set(item, new Set([item]));
    if (item === this._activeItem)
      item.focus();
  }

  private _wrapItem(item: LogItem): Element {
    const itemElement = item.render();
    const toggleFold = (f) => {
      folded = f;
      element.classList.toggle('folded', folded);
    };
    item.toggleFold?.on(toggleFold);
    const element = document.createElement('div');
    element.classList.add('log-item-wrapper');
    let folded = false;
    element.addEventListener('contextmenu', event => {
      attachMenuItemsToContextMenuEvent([{
        title: folded ? 'Unfold' : 'Fold',
        callback: () => toggleFold(!folded),
      }, {
        title: 'Clear command and output',
        callback: () => this.removeItem(item, true),
      }], event);
    }, false);
    if (itemElement)
      element.append(itemElement);
    return element;
  }

  removeItem(item: LogItem, force = false) {
    if (!force) {
      const retainers = this._itemToRetainers.get(item);
      // The retainers might not exist if we don't own this item
      if (retainers) {
        retainers.delete(item);
        // something needs this item to still exist
        if (retainers.size > 0)
          return;
      }
    }
    if (!this._log.removeItem(item))
      return;
    if (item.acceptsChildren) {
      for (const child of this._log) {
        if (this._itemToParent.get(child) === item)
          this.removeItem(child, true);
      }
    }
    const parent = this._itemToParent.get(item);
    if (parent)
      this.removeRetainer({item, parent});
    item.dispose();
    this._lockScroll();
    this._itemToElement.get(item)?.remove();
    this._itemToElement.delete(item);
    this._itemToParent.delete(item);
    this._itemToRetainers.delete(item);
  }

  addRetainer({item, parent}: {item: LogItem|'forced', parent: LogItem}) {
    this._itemToRetainers.get(parent).add(item);
  }

  removeRetainer({item, parent}: {item: LogItem, parent: LogItem}) {
    const retainers = this._itemToRetainers.get(parent);
    if (retainers) {
      retainers.delete(item);
      if (retainers.size === 0)
        this.removeItem(parent, true);
    }
  }

  clearAllAbove(savedItem: LogItem): void {
    for (const item of [...this._log]) {
      if (item === savedItem)
          return;
      this.removeItem(item, false);
    }
  }

  clearAll(): void {
    for (const item of [...this._log])
      this.removeItem(item, true);
  }

  shellClosed() {
    this.blockDelegate?.close();
    this._element.remove();
  }

  async _doSplit(direction: 'horizontal' | 'vertical') {
    const finishWork = startAyncWork('split');
    const logViewProxy = makeLazyProxy<ShellDelegate>();
    const shell = new (await import('./Shell')).Shell(logViewProxy.proxy);
    await shell.setupInitialConnection();
    const view = new LogView(shell, this._container);
    this.blockDelegate.split(view, direction);
    logViewProxy.fulfill(view);
    finishWork();
  }

  updatePosition(rect: { x: number; y: number; width: number; height: number; }): void {
    this._lockScroll();
    this._element.style.left = rect.x + 'px';
    this._element.style.top = rect.y + 'px';
    this._element.style.width = rect.width + 'px';
    this._element.style.height = rect.height + 'px';
    this._shell.updateSize(rect.width, rect.height);
  }

  setFullscreenItem(fullScreenEntry: LogItem | null) {
    if (fullScreenEntry) {
      this._scroller.classList.add('inert');
      const placeholder = document.createElement('div');
      const element = fullScreenEntry.render();
      element.parentElement.replaceChild(placeholder, element);
      this._element.appendChild(this._fullscreenElement);
      this._fullscreenElement.appendChild(element);
      this._element.classList.add('fullscreen-entry');
      fullScreenEntry.focus();
      this._undoFullscreen = () => {
        placeholder.parentElement.replaceChild(element, placeholder);
      };
    } else {
      if (this._undoFullscreen) {
        this._undoFullscreen();
        this._undoFullscreen = null;
      }
      this._fullscreenElement.remove();
      this._fullscreenElement.textContent = '';
      this._scroller.classList.remove('inert');
      this._element.classList.remove('fullscreen-entry');
    }
  }

  async _lockScroll() {
    if (this._lockingScroll)
      return;
    const scrollBottom = this._scroller.scrollHeight - this._scroller.scrollTop - this._scroller.offsetHeight;
    this._lockingScroll = true;
    await Promise.resolve();
    this._lockingScroll = false;
    this._scroller.scrollTop = this._scroller.scrollHeight - this._scroller.offsetHeight - Math.floor(scrollBottom);
  }

  _addPrompt() {
    this._lockScroll();
    this._prompt = this._shell.addPrompt(this._scroller);
    this._prompt.willResizeEvent.on(() => this._lockScroll());
    this.setActiveItem(this._prompt);
    
    // automaticaly trigger the llm if there was an error
    // it probably will help fix a typo or something
    if (this._shell.lastCommandWasError())
      this._triggerLLM();
  }

  async serializeForTest() {
    if (this._activeItem?.isFullscreen?.())
      return this._activeItem.serializeForTest();
    return {
      log: (await Promise.all(this._log.map(item => {
        return item.serializeForTest ? item.serializeForTest() : '<unknown>';
      }))).filter(x => x),
      prompt: await this._prompt?.serializeForTest(),
    };
  }

  enableMockAI() {
    this._isMockAI = true;
  }

  async waitForLineForTest(regex: RegExp) {
    const abortController = new AbortController();
    const callback = () => {
      this._activeItem?.waitForLineForTest?.(regex, abortController.signal).then(resolve);
    };
    let resolve: () => void;
    const promise = new Promise<void>(x => resolve = x);
    this._activeItemListeners.add(callback);
    callback();
    await promise;
    this._activeItemListeners.delete(callback);
    abortController.abort();
  }

  setTitle(title: string): void {
    this._titleThrottle.update(title);
  }

  setSuffix(suffix: string): void {
    this._suffixThrottle.update(suffix);
  }

  get _isFullscreen() {
    return !!this._fullscreenElement.parentElement;
  }

  actions(): Action[] {
    const fullscreenActions: Action[] = [{
      title: 'Split vertically',
      shortcut: makeChordShortcut('%'),
      id: 'log.split.vertical',
      callback: () => this._doSplit('vertical'),
    }, {
      title: 'Split horizontally',
      shortcut: makeChordShortcut('"'),
      id: 'log.split.horizontal',
      callback: () => this._doSplit('horizontal'),
    }, {
      title: 'Toggle daemon mode',
      shortcut: makeChordShortcut('D'),
      id: 'log.toggle.daemon',
      callback: () => {
        const done = startAyncWork('demon mode toggle');
        this._shell.toggleDaemon().then(done);
      }
    }, {
      title: 'Refresh active iframe',
      shortcut: makeChordShortcut('R'),
      id: 'log.refresh.active.iframe',
      callback: () => this._shell.refreshActiveIframe(),
    }, {
      title: 'Find',
      shortcut: 'CmdOrCtrl+F',
      id: 'log.find',
      callback: () => {
        this._find.open(this._element);
      },
    }, {
      title: 'Select file',
      id: 'log.file',
      shortcut: 'CmdOrCtrl+P',
      callback: () => {
        showQuickPick('');
      }
    }, {
      title: 'Kill process',
      shortcut: makeChordShortcut('K'),
      id: 'log.kill',
      callback: async () => {
        const done = startAyncWork('kill process');
        // TODO do this in the shell and preserve the log
        for (const item of this._log)
          item.dispose();
        this._prompt?.dispose();
        this.blockDelegate.replaceWith(new Placeholder('killed'));
        delete this.blockDelegate;
        await this._shell.kill();
        done();
      },
    }]
    if (this._isFullscreen)
      return fullscreenActions;
    const actions = [...fullscreenActions, {
      title: 'Clear log',
      shortcut: 'Ctrl+L',
      id: 'log.clear',
      callback: () => this.clearAll(),
    }, {
      title: 'Fold all',
      id: 'log.fold.all',
      shortcut: makeChordShortcut('O'),
      callback: () => {
        this._lockScroll();
        for (const item of this._log)
          item?.toggleFold?.dispatch(true);
      }
    }, {
      title: 'Unfold all',
      id: 'log.unfold.all',
      shortcut: makeChordShortcut('O'),
      callback: () => {
        this._lockScroll();
        for (const item of this._log)
          item?.toggleFold?.dispatch(false);
      }
    }];
    if (this._prompt) {
      actions.push({
        title: 'Invoke AI Assistant',
        id: 'log.ai',
        shortcut: 'Meta+L',
        callback: () => this._triggerLLM(),
      });
    }
    return actions;
  }

  async quickPicks(): Promise<QuickPickProvider[]> {
    let filesPromise: Promise<void>|undefined;
    const listeners = new Set<(file: string) => void>();
    const cachedFiles: string[] = [];
    const maxFiles = 10000;
    return [{
      title: 'Select file',
      prefix: '',
      items: async (signal, callback, warn) => {
        if (!filesPromise) {
          filesPromise = this._shell.findAllFiles(maxFiles, file => {
            cachedFiles.push(file);
            for (const listener of listeners)
              listener(file);
          });
        }
        const reportFile = (file: string) => callback({
          callback: () => {
            const active = this._activeItem || this._prompt;
            active?.recieveFilePath?.(file);    
          },
          title: file,  
        });
        for (const file of cachedFiles)
          reportFile(file);
        listeners.add(reportFile);
        await filesPromise;
        if (cachedFiles.length >= maxFiles)
          warn(`File limit reached, only searching first ${maxFiles.toLocaleString()} files.`)
        listeners.delete(reportFile);
      },
      renderItem: (item, query) => {
        const { title } = item;
        const element = document.createElement('div');
        const icon = iconPathForPath(title, { isDirectory: false, dir: title, mode: 0o644, size: 0 });
        element.append(icon.element);
        const diff = new diff_match_patch().diff_main(query.toLowerCase(), title.toLowerCase());

        let index = 0;
        const titleElement = document.createElement('span');
        titleElement.classList.add('title');
        const subtitleElement = document.createElement('span');
        subtitleElement.classList.add('subtitle');
        element.append(titleElement, subtitleElement);
        const lastSlash = title.lastIndexOf('/');
        for (const {0: type, 1: text} of diff) {
          if (lastSlash !== -1) {
            const subtitleText = title.slice(index, Math.min(index + text.length, lastSlash));
            addText(subtitleText, type === DIFF_EQUAL, subtitleElement);
          }
          const titleText = title.slice(Math.max(lastSlash + 1, index), index + text.length);
          addText(titleText, type === DIFF_EQUAL, titleElement);
          
          index += text.length;
        }
        function addText(text: string, isMatch: boolean, target: Element) {
          if (!text)
            return;
          if (isMatch) {
            const span = document.createElement('span');
            span.textContent = text;
            span.classList.add('match');
            target.append(span);
          } else {
            target.append(text);
          }
        }

        element.classList.add('quick-pick-option');
        return element;
      }
    }];
  }

  async asyncActions(): Promise<Action[]> {
    const promises: Promise<Action[]>[] = [];
    for (const item of this._log) {
      if (!item.aysncActions)
        continue;
      promises.push(item.aysncActions());
    }
    const actions = await Promise.all(promises);
    return actions.flat();
  }

  setFind(params: FindParams|null): void {
    this._log.setFind(params);
  }

  async scrollToBottom() {
    await this._lockScroll();
    this._scroller.scrollTop = this._scroller.scrollHeight;
  }

}


async function openAICompletions(shell: Shell, log: Iterable<LogItem>, signal: AbortSignal) {
  const apiKey = await shell.cachedEvaluation('echo $SNAIL_OPENAI_KEY');
  if (!apiKey)
    return null;
  if (signal.aborted)
    return null;
  const model = await shell.cachedEvaluation('ai_model');
  if (signal.aborted)
    return null;
  const messages: import('openai').OpenAI.Chat.ChatCompletionMessageParam[] = [];
  let total = 0;
  for (const item of [...log].reverse()) {
    const message = await item.serializeForLLM?.();
    if (signal.aborted)
      return null;
    if (message) {
      if (message.content.length > 1000)
        message.content = message.content.slice(0, 500) + '<content truncated>' + message.content.slice(-500);
      total += message.content.length;
      messages.push(message);
    }
    if (total >= 10_000)
      break;
  }
  messages.push({
    role: 'system',
    content: `Your messages are being typed directly into a terminal shell.
The user will respond with the result from your command.
Always respond in the form of a bash command.
Respond directly with the command to run instead of asking the user to run a given command.
Try to gather information and explore the environment before giving up.
Make sure any comments in your response are prefixed with a '#'.
Keep comments to a minimum.
Refrain from explaining simple commands.
For example, if you don't know what to do, respond with ls.
Use uname -a to check whether the system is MacOS or Linux.`
  });
  messages.reverse();


  return sendStreamingCommandToHost('openai', {
    stream: true,
    messages,
    model,
    apiKey,
  });
};

async function * mockCompletions(): AsyncIterable<import('openai').OpenAI.Chat.ChatCompletionChunk> {
  // chunk.choices[0].delta.content
  yield {
    choices: [{ delta: { content: '# fake ai suggestion' },
      finish_reason: 'stop', index: 0}],
      created: Date.now(),
      id: '-1',
      model: 'mock',
      object: 'chat.completion.chunk'
    };
}