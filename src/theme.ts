import './theme.css';
import './actions';
import { registerGlobalAction } from './actions';
import { host } from './host';
export function themeName(): 'light'|'dark' {
    const theme =  new URL(window.location.href).searchParams.get('theme');
    if (theme !== 'dark' && theme !== 'light')
        return 'dark';
    return theme;
}
export function themeCursorColor() {
    return window.getComputedStyle(document.body).getPropertyValue('--color-cursor');
}
export function themeBackgroundColor() {
    return window.getComputedStyle(document.body).getPropertyValue('--color-background');
}
export function themeTextColor() {
    return window.getComputedStyle(document.body).getPropertyValue('--color-text');
}
export function themeBoldColor() {
    return window.getComputedStyle(document.body).getPropertyValue('--color-bold');
}
export function themeSelectionColor() {
    return window.getComputedStyle(document.body).getPropertyValue('--color-selection');
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
            const url = new URL(window.location.href);
            url.searchParams.set('theme', 'light');
            window.location.href = url.toString();
        },
        id: 'theme.light',
    });
}
document.body.classList.add(themeName());
