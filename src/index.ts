import './theme';
import './font';
import { rootBlock } from './GridPane';
import './TestingHooks';
import { startAsyncWork } from './async'
import { makeLazyProxy } from './LazyProxy';
import type { ShellDelegate } from './Shell';
import { TabBlock } from './TabBlock';
import { host } from './host';
import './QuickPick';
import { registerGlobalAction } from './actions';
document.title = 'Loading...';
const isMac = navigator['userAgentData']?.platform === 'macOS' || navigator.platform === 'MacIntel';
declare var IS_REPL: boolean|undefined;
const isRepl = typeof IS_REPL !== 'undefined' && IS_REPL;
const useTabs = !isRepl && !isMac;
console.time('load shell module');
const done = startAsyncWork('load shell module');
const lazyLogView = makeLazyProxy<ShellDelegate>();
const shellPromise = import('./Shell').then(({ Shell }) => new Shell(lazyLogView.proxy));
const connetionPromise = shellPromise.then(shell => shell.setupInitialConnection());
import('./LogView').then(async ({LogView}) => {
const shell = await shellPromise;
const logView = new LogView(shell, rootBlock.element);
lazyLogView.fulfill(logView);
if (useTabs) {
    const tabs = new TabBlock(rootBlock.element, {
        onAdd: async () => {
            const logViewProxy = makeLazyProxy<ShellDelegate>();
            const shell = new (await import('./Shell')).Shell(logViewProxy.proxy);
            await shell.setupInitialConnection();
            const view = new LogView(shell, rootBlock.element);
            logViewProxy.fulfill(view);
            return view;
        },
        onClose: async () => {
            tabs.blockDelegate?.close();
        },
        setMaximized: async (maximized) => {
            await host.sendMessage({
                method: 'setMaximized',
                params: { maximized },
            });
        },
        onMinimize: async () => {
            await host.sendMessage({
                method: 'minimize'
            });
        },
    });
    host.onEvent('maximizeStateChanged', ({maximized}) => {
        tabs.setMaximized(maximized);
    })
    rootBlock.setBlock(tabs);
    tabs.addTab(logView);
} else {
    rootBlock.setBlock(logView);
    registerGlobalAction({
        id: 'close',
        title: 'Close',
        shortcut: 'CmdOrCtrl+W',
        callback: () => logView.blockDelegate?.close(),
    });
    for (let i = 0; i < 9; i++) {
        const digit = String(i + 1);
        registerGlobalAction({
            id: 'switch-to-tab-' + digit,
            title: 'Switch to tab ' + digit,
            shortcut: 'CmdOrCtrl+' + digit,
            callback: () => {
                host.notify({
                    method: 'switchToTab',
                    params: { tabNumber: i },
                });
            }
        });
    }
}
registerGlobalAction({
    callback: async () => {
        window.location.reload();
    },
    title: 'Reload Window',
    id: 'window.reload',
    shortcut: 'F5',
});
await connetionPromise;
done();
});
