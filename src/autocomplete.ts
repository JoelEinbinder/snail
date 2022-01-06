import { Editor } from "../editor/js/editor";

export class Autocomplete {
    constructor(private _editor: Editor) {
        this._editor.on('selectionChanged', event => {
            console.log(event.selections[0].start);
        });
    }
}
