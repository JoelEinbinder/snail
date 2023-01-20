import type { Setting } from './Setting';
import './tabs.css';

export class Tabs {
    public element = document.createElement('div');
    private _selectedTab: Tab|null = null;
    private _tabsHeader = document.createElement("div");
    private _contentElement = document.createElement('div');
    private _tabToHeaderElement = new WeakMap<Tab, HTMLElement>();
    private _tabTitle = new WeakMap<Tab, string>();
    constructor(private _selectedSetting?: Setting<string|null>) {
        this.element.classList.add("tabs");
        this._tabsHeader.className = "tabs-header";
        this._tabsHeader.addEventListener('keydown', this._keydown.bind(this), false);
        this.element.appendChild(this._tabsHeader);
        this._contentElement.classList.add("tab-content");
        this.element.appendChild(this._contentElement)
    }

    _keydown(event: KeyboardEvent) {
        if (!this._selectedTab)
            return;
        const tabElement = this._tabToHeaderElement.get(this._selectedTab)!;
        let tabElementToSelect;
        switch (event.key) {
            case "Left":
            case "ArrowLeft":
                tabElementToSelect = tabElement.previousElementSibling || tabElement.parentElement!.lastElementChild;
                break;

            case "Right":
            case "ArrowRight":
                tabElementToSelect = tabElement.nextElementSibling || tabElement.parentElement!.firstElementChild;
                break;

            case " ":
            case "Enter":
            case "ArrowDown":
            case "Down":
                this._selectedTab.focus();
                break;
            default:
                return;
        }
        if (tabElementToSelect && tabElementToSelect["__tab"]) {
            this.selectTab(tabElementToSelect["__tab"]);
            tabElementToSelect.focus();
        }
        event.preventDefault();
        event.stopPropagation();

    }

    async appendTab(tab: Tab, title: string) {
        const headerElement = document.createElement("div");
        headerElement.textContent = title;
        headerElement.classList.add("tab");
        headerElement["__tab"] = tab;
        this._tabTitle.set(tab, title);
        this._tabsHeader.appendChild(headerElement);
        headerElement.addEventListener("mousedown", event => {
            this.selectTab(tab);
            this.focus();
            event.stopPropagation();
            event.preventDefault();
        }, false);
        this._tabToHeaderElement.set(tab, headerElement);
        if (!this._selectedTab) {
            const settingValue = await this._selectedSetting?.load();
            if (!this._selectedTab && !settingValue || settingValue === title)
                this.selectTab(tab);
        }
    }

    selectTab(tab: Tab|null) {
        if (this._selectedTab === tab)
            return;
        if (this._selectedTab) {
            const element = this._tabToHeaderElement.get(this._selectedTab)!;
            element.classList.remove("selected");
            element.removeAttribute("tabIndex");
            this._selectedTab.hide();
        }
        this._selectedSetting?.save(tab ? this._tabTitle.get(tab)! : null)
        this._selectedTab = tab;
        if (this._selectedTab) {
            const element = this._tabToHeaderElement.get(this._selectedTab)!;
            element.classList.add("selected");
            element.setAttribute("tabIndex", "0");
            this._selectedTab.show(this._contentElement);
        }
    }

    focus() {
        // first focus the tab header. That way if the tab itself is not focusable, the tab header will be focused.
        this._tabToHeaderElement.get(this._selectedTab!)?.focus();
        this._selectedTab?.focus();
    }
}

export interface Tab {
    focus(): void;
    hide(): void;
    show(parentElement: HTMLElement): void;
}