import './dark.css';

const isLogBook = document.location.search.includes('logbook');
if (!isLogBook) {
  const shellPromise = import('./Shell').then(({ Shell }) => Shell.create());
  import('./LogView').then(async ({LogView}) => {
    const shell = await shellPromise;
    const logView = new LogView(shell, document.body);
  });
} else {
  document.title = 'LogBook';
  import('./logbook/LogBook');
}