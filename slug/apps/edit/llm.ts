/// <reference path="./monaco.d.ts" />
import * as snail from '../../sdk/web';

class Replacer {
  constructor(private _original, private _modified) {

  }
  * run(content: string) {
    let offset = 0;

    for (const section of content.split(this._original)) {
      offset += section.length;
      yield {
        from: offset,
        to: offset + this._original.length,
        text: this._modified,
      };
      offset += this._original.length
    }
  }
}

function extractCodeFromLLMResponse(response: string, language: string) {
  const needle = '```' + language;
  if (!response.includes(needle))
    return response;
  const start = response.indexOf(needle) + needle.length + 1;
  const end = response.indexOf('```', start);
  return response.slice(start, end);
}

export class LLMManager {
  private _disposables: monaco.IDisposable[] = [];
  private _isLoadingCompletions = false;
  private _codeActions: monaco.languages.CodeAction[] = [];
  private _llmSuggestion = '';
  private _replacers: Replacer[] = [];
  private _decorations = this._editor.createDecorationsCollection([]);


  constructor(private _editor: monaco.editor.IStandaloneCodeEditor) {
    this._disposables.push(

      monaco.editor.addEditorAction({
        id: 'apply-llm-suggestion',
        label: 'Apply LLM Suggestion',
        run: (editor, edit: monaco.editor.ISingleEditOperation) => {
          if (!edit)
            return;
          editor.getModel()?.pushEditOperations(null, [edit], () => null);
        },
      }),
      monaco.languages.registerCodeActionProvider({ scheme: 'inmemory' }, {
        provideCodeActions: (model, range, context, token) => {
          return {
            actions: this._codeActions.filter(x => x.ranges?.some(x => monaco.Range.intersectRanges(x, range))),
            dispose: () => {},
          };
        },
      }),
      this._editor.onDidChangeModelContent(() => this._updateReplacers()),
    );
    
    
  }
  
  dispose() {
    for (const disposable of this._disposables)
      disposable.dispose();
    this._decorations.clear();
  }
  async triggerLLM(relativePath: string, setProgress: (progress: number|null) => void) {
    if (this._isLoadingCompletions) {
      // TODO cancel the previous request
      return;
    }

    const model = this._editor.getModel();
    if (!model)
      return;
    const dummyMode = false;
    const editorContent = model.getValue();
    const language = model.getLanguageId();
    this._isLoadingCompletions = true;
    if (!editorContent) {
      if (dummyMode) {
        this._llmSuggestion = '<dummy text file content>';
      } else {
        let text = '';
        const messageContent = `Opened ${relativePath}. Please respond with the full code of the file.`;
        setProgress(text.length);
        for await (const chunk of snail.queryLLM({
          messages: [{
            role: 'user',
            content: messageContent,
          }],
          useTerminalContext: true,
          system: `You are a terminal assistant.
          You can run commands and the user will respond with their output.
          Sometimes the user will ask you to edit a text file.
          Please respond with the full code of the file.`,
        })) {
          text += chunk;
          setProgress(text.length);
        }
        setProgress(null);
        this._llmSuggestion = extractCodeFromLLMResponse(text, language);
      }
      this._isLoadingCompletions = false;
      if (!model.getValue()) {
        await this._editor.getAction('editor.action.inlineSuggest.trigger')?.run();
        return;
      }
      return;
    }
    this._replacers = [];
    if (dummyMode) {
      this._replacers.push(new Replacer('title', 'foo'));
      setProgress(null);
    } else {
      const messageContent = `Opened ${relativePath}. Here is it's current content:

\`\`\`${language}
${editorContent}
\`\`\`

Do you see any small additions or improvements to make in this file? Please respond with a plan to implement these changes.`;
      let text = '';
      setProgress(text.length);
      for await (const chunk of snail.queryLLM({
        messages: [{
          role: 'user',
          content: messageContent,
        }],
        useTerminalContext: true,
        tool: {
          tools: [{
            "name": "edit_file",
            "description": "Custom editing editing the current code file\n* The `old_str` parameter should match EXACTLY one or more consecutive lines from the original file. Be mindful of whitespaces!\n* If the `old_str` parameter is not unique in the file, the replacement will not be performed. Make sure to include enough context in `old_str` to make it unique\n* The `new_str` parameter should contain the edited lines that should replace the `old_str`",
            "strict": true,
            "parameters": {
              "type": "object",
              "required": [
                "new_str",
                "old_str",
              ],
              "properties": {
                "new_str": {
                  "type": "string",
                  "description": "Required parameter containing the new string (if empty, the old_str wil be deleted)."
                },
                "old_str": {
                  "type": "string",
                  "description": "Required parameter containing the string in the active code file to replace."
                },
              },
              "additionalProperties": false
            }
          }]
        },
        system: `You are a terminal assistant.
        You can run commands and the user will respond with their output.
        Sometimes the user will ask you to edit a text file.
        Use the edit_file tool to suggest changes to the file.`,
      })) {
        if (typeof chunk === 'string') {
          text += chunk;
        } else {
          if (chunk.name === 'edit_file') {
            const { old_str, new_str } = chunk.args;
            if (editorContent.split(old_str).length === 2)
              this._replacers.push(new Replacer(old_str, new_str));
            text += JSON.stringify(chunk);
          } else {
            console.error('Unexpected tool', chunk);
          }
        }
        console.log(chunk);
        setProgress(text.length);
      }
      setProgress(null);
    }
    // TOOD update llmSuggestion
  
    this._isLoadingCompletions = false;
    if (this._llmSuggestion === editorContent)
      return;
    this._updateReplacers();
  }

  _updateReplacers() {
    const model = this._editor.getModel()!;
    this._codeActions = [];
    this._decorations.clear();
    if (!model || !this._replacers.length)
      return;
    const editorContent = model.getValue();
    const position = new monaco.Position(1, 1);
    const markers: monaco.editor.IMarkerData[] = [];
    for (const replacer of this._replacers) {
      for (const replacement of replacer.run(editorContent)) {
        const start = model.modifyPosition(position, replacement.from);
        const end = model.modifyPosition(position, replacement.to);
        this._decorations.append([{
          range: monaco.Range.fromPositions(start, end),
          options: {
            isWholeLine: false,
            className: 'llm-suggestion',
            hoverMessage: {
              value: '```\n' + replacement.text + '\n```',
            },
            overviewRuler: {
              color: '#ad7fa8',
              darkColor: '#75507b',
              position: monaco.editor.OverviewRulerLane.Right,
            },
          }
        }]);
        const edit: monaco.editor.ISingleEditOperation = {
          range: monaco.Range.fromPositions(start, end),
          text: replacement.text
        };
        this._codeActions.push({
          isAI: true,
          kind: 'quickfix',
          ranges: [monaco.Range.fromPositions(start, end)],
          title: 'Apply LLM Suggestion',
          command: {
            id: 'apply-llm-suggestion',
            title: 'Apply LLM Suggestion',
            arguments: [edit],
          }
        });
        markers.push({
          startColumn: start.column,
          startLineNumber: start.lineNumber,
          endColumn: end.column,
          endLineNumber: end.lineNumber,
          message: 'LLM Suggestion',
          severity: monaco.MarkerSeverity.Hint,

        })
      }
    }
    monaco.editor.setModelMarkers(model, 'llm', markers);
  }
  

  getSuggestion() {
    return this._llmSuggestion;
  }
}
