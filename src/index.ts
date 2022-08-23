import './dark.css';
import { rootBlock } from './GridPane';

const isLogBook = document.location.search.includes('logbook');
if (!isLogBook) {
  const shellPromise = import('./Shell').then(({ Shell }) => Shell.create());
  import('./LogView').then(async ({LogView}) => {
    const shell = await shellPromise;
    const logView = new LogView(shell, rootBlock.element);
    rootBlock.setBlock(logView);
  });
} else {
  document.title = 'LogBook';
  import('./logbook/LogBook');
}