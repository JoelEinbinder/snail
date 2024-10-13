import './theme.css';
import './actions';
import { registerGlobalAction } from './actions';
import { host } from './host';
declare var IS_REPL: boolean|undefined;
export function themeName(): 'light'|'dark' {
    const theme = new URL(window.location.href).searchParams.get('theme');
    if (theme !== 'dark' && theme !== 'light') {
        if (typeof IS_REPL !== 'undefined' && IS_REPL) {
            const hasTheme = localStorage.getItem('snail-repl-theme');
            if (hasTheme) {
                try {
                    return JSON.parse(hasTheme);
                } catch {}
            }
            const wantsDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            return wantsDark ? 'dark' : 'light';
        }
        return 'dark';
    }
    return theme;
}

function cssvar(name: string) {
    return window.getComputedStyle(document.body).getPropertyValue(name);
}

export function themeCursorColor() {
    return cssvar('--color-cursor');
}
export function themeBackgroundColor() {
    return cssvar('--color-background');
}
export function themeTextColor() {
    return cssvar('--color-text');
}
export function themeBoldColor() {
    return cssvar('--color-bold');
}
export function themeSelectionColor() {
    return cssvar('--color-selection');
}

export function themeEditorColors(): import('../slug/editor/').EditorOptions['colors'] {
    return {
        cursorColor: themeTextColor(),
        foreground: themeTextColor(),
        selectionBackground: themeSelectionColor(),
        tokenColors: [
            ['keyword', cssvar('--ansi-135')],
            ['number', cssvar('--color-3')],
            ['comment', cssvar('--color-8')],
            ['string', cssvar('--color-2')],
            ['string-2', cssvar('--color-2')],
            ['variable', themeName() === 'dark' ? cssvar('--ansi-153'): cssvar('--color-6')],
            ['property', themeName() === 'dark' ? cssvar('--ansi-153'): cssvar('--color-6')],
            ['def', themeName() === 'dark' ? cssvar('--ansi-153'): cssvar('--color-6')],
            ['sh', themeTextColor()],
            ['sh-replacement', themeName() === 'dark' ? cssvar('--color-11') : cssvar('--color-2')],
            ['sh-template', cssvar('--color-6')],
            ['sh-string', cssvar('--color-3')],
            ['sh-comment', cssvar('--color-8')],
          ]
    };
}

if (themeName() !== 'dark') {
    registerGlobalAction({
        title: 'Switch to dark theme (reload)',
        callback: async () => {
            await host.sendMessage({
                method: 'saveItem',
                params: {
                    key: 'theme',
                    value: 'dark',
                }
            });
            if (typeof IS_REPL !== 'undefined' && IS_REPL) {
                window.location.reload();
                return;
            }
            const url = new URL(window.location.href);
            url.searchParams.set('theme', 'dark');
            window.location.href = url.toString();
        },
        id: 'theme.dark',
    });
}
if (themeName() !== 'light') {
    registerGlobalAction({
        title: 'Switch to light theme (reload)',
        callback: async () => {
            await host.sendMessage({
                method: 'saveItem',
                params: {
                    key: 'theme',
                    value: 'light',
                }
            });
            if (typeof IS_REPL !== 'undefined' && IS_REPL) {
                window.location.reload();
                return;
            }
            const url = new URL(window.location.href);
            url.searchParams.set('theme', 'light');
            window.location.href = url.toString();
        },
        id: 'theme.light',
    });
}
document.body.classList.add(themeName());
