import './dark.css';
import './font';
import { rootBlock } from './GridPane';

const isLogBook = document.location.search.includes('logbook');
if (!isLogBook) {
  console.time('load shell module');
  const shellPromise = import('./Shell').then(({ Shell }) => {
    console.timeEnd('load shell module');
    return Shell.create();
  });
  import('./LogView').then(async ({LogView}) => {
    const shell = await shellPromise;
    const logView = new LogView(shell, rootBlock.element);
    rootBlock.setBlock(logView);
  });
} else {
  document.title = 'LogBook';
  import('./logbook/LogBook');
}