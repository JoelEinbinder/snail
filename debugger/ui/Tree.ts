
export interface TreeItem {
    element: HTMLElement;
    focus(): void;
    hasFocus(): boolean;
    setIsSelected(isSelected: boolean): void;
    readonly parent?: TreeItem;
    selectItem?(item: TreeItem): void;
    
    expand(): void;
    collapse(): void;

    readonly collapsed: boolean;
    readonly collapsible: boolean;
    readonly children: ReadonlyArray<TreeItem>;
}

export class Tree implements TreeItem {
    element = document.createElement('div');
    private _selectedItem: TreeItem = this;
    private _items: TreeItem[] = [];
    constructor() {
        this.element.classList.add('tree');
        this.element.tabIndex = -1;
        this.setIsSelected(true);
        this.element.addEventListener('keydown', event => {
            if (event.target !== this.element)
                return;
            handleKeyEventForTreeItem(event, this);
        });
    }

    get children() {
        return this._items;
    }
    get collapsed() {
        return false;
    }
    get collapsible() {
        return false;
    }
    expand() {
        throw new Error('Not collapsible');
    }
    collapse() {
        throw new Error('Not collapsible');
    }

    hasFocus(): boolean {
        return document.activeElement === this.element;
    }
    setIsSelected(isSelected: boolean): void {
        this.element.tabIndex = isSelected ? 0 : -1;
    }

    appendItem(item: TreeItem) {
        this.element.appendChild(item.element);
        this._items.push(item);
    }

    removeItem(item: TreeItem) {
        this._items.splice(this._items.indexOf(item), 1);
        item.element.remove();
        // TODO remove from selection.
    }

    selectItem(item: TreeItem) {
        if (item === this._selectedItem)
            return;
        const hadFocus = this._selectedItem.hasFocus();
        this._selectedItem.setIsSelected(false);
        this._selectedItem = item;
        this._selectedItem.setIsSelected(true);
        if (hadFocus)
            this._selectedItem.focus();
    }

    get selectedItem() {
        return this._selectedItem;
    }

    focus() {
        if (this._selectedItem !== this)
            this._selectedItem.focus();
        else
            this.element.focus();
    }
}

export function handleKeyEventForTreeItem(event: KeyboardEvent, item: TreeItem) {
    let select: TreeItem|null = null;
    switch(event.key) {
        case 'ArrowUp':
            select = previousTreeItem(item);
            break;

        case 'ArrowDown':
            select = nextTreeItem(item);
            break;

        case 'ArrowLeft':
            if (!item.collapsed && item.collapsible)
                item.collapse()
            else
                select = item.parent || null;
            break;

        case 'ArrowRight':
            if (item.collapsible && item.collapsed)
                item.expand();
            else
                select = item.children[0] || null;
            break;
        default:
            return false; // don't handle this event
    };
    if (select)
        selectTreeItem(select);
    event.preventDefault();
    event.stopPropagation();
    return true;
}

export function selectTreeItem(item: TreeItem) {
    let cursor: TreeItem|undefined = item;
    while(cursor && !cursor.selectItem)
        cursor = cursor.parent;
    if (cursor && cursor.selectItem) {
        cursor.selectItem(item);
        return;
    }
    throw new Error('Could not select unattached tree item');
}

function nextTreeItem(item: TreeItem) {
    if (!item.collapsed && item.children.length)
        return item.children[0];
    
    let cursor: TreeItem|undefined = item;
    while(cursor.parent) {
        const index = cursor.parent.children.indexOf(cursor);
        const next = cursor.parent.children[index + 1];
        if (next)
            return next;
        cursor = cursor.parent;
    }
    return null;
}

function previousTreeItem(item: TreeItem) {
    if (!item.parent)
        return null;
    const index = item.parent.children.indexOf(item);
    if (index > 0)
        return item.parent.children[index - 1];
    return item.parent;
}