import './dark.css';
import './font';
import { rootBlock } from './GridPane';
import './TestingHooks';
import { startAyncWork } from './async'
import { makeLazyProxy } from './LazyProxy';
import type { ShellDelegate } from './Shell';

const isLogBook = document.location.search.includes('logbook');
if (!isLogBook) {
  console.time('load shell module');
  const done = startAyncWork('load shell module');
  const lazyLogView = makeLazyProxy<ShellDelegate>();
  const shellPromise = import('./Shell').then(({ Shell }) => new Shell(lazyLogView.proxy));
  const connetionPromise = shellPromise.then(shell => shell.setupInitialConnection());
  import('./LogView').then(async ({LogView}) => {
    const shell = await shellPromise;
    const logView = new LogView(shell, rootBlock.element);
    lazyLogView.fulfill(logView);
    rootBlock.setBlock(logView);
    await connetionPromise;
    done();
  });
} else {
  document.title = 'LogBook';
  import('./logbook/LogBook');
}