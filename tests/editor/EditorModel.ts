import type { JSHandle, Page } from '@playwright/test';
import type { Editor, TextRange } from '../../slug/editor/';
export class EditorModel {
  private constructor(
    public readonly page: Page,
    private _editor: JSHandle<Editor>,
    ) {
  }
  static async create(page: Page) {
    const handle = await page.evaluateHandle<Editor>(() => window['editor']);
    const editorModel = new EditorModel(page, handle);
    return editorModel;
  }
  async setEditorColumns(columns: number) {
    await this._editor.evaluate((editor, columns) => {
      const width = editor.gutterWidth() + editor.charWidth() * columns;
      editor.element.style.width = width + 'px';
      editor.layout();
    }, columns);
  }
  async serialize() {
    return this._editor.evaluate(editor => {
      const lines = editor.value.split('\n');
      const overlay = lines.map(line => (' '.repeat(line.length) + ' ').split(''));
      for (const selection of editor.selections) {
        if (selection.start.line === selection.end.line && selection.start.column === selection.end.column) {
          overlay[selection.start.line][selection.start.column] = '^';
        } else {
          overlay[selection.start.line][selection.start.column] = '[';
          const cursor = {...selection.start};
          while (true) {
            cursor.column++;
            if (cursor.column > lines[cursor.line].length) {
              cursor.column = 0;
              cursor.line++;
            }
            if (cursor.line >= lines.length) break;
            if (cursor.line === selection.end.line && cursor.column === selection.end.column) {
              overlay[cursor.line][cursor.column] = ']';
              break;
            } else {
              overlay[cursor.line][cursor.column] = '-';
            }
          }
        }
      }
      const built: string[ ]= [];
      for (let i = 0; i < lines.length; i++) {
        built.push(lines[i]);
        const overlayLine = overlay[i].join('');
        if (overlayLine.trim() === '') continue;
        built.push(overlayLine);
      }
      return built.join('\n');
    });
  }
  async setSelection(selection: TextRange) {
    await this._editor.evaluate((editor, selection) => {
      editor.selections = [selection];
    }, selection);
  }
  async setValue(value: string) {
    await this._editor.evaluate((editor, value) => {
      editor.value = value;
    }, value);
  }
  async pointFromLocation(location: { line: number, column: number }) {
    return this._editor.evaluate((editor, location) => {
      return editor.pointFromLocation(location);
    }, location);
  }
}