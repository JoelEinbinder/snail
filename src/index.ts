import './dark.css';

const isLogBook = document.location.search.includes('logbook');
if (!isLogBook) {
  const shellPromise = import('./Shell').then(({ Shell }) => Shell.create());
  import('./ShellView').then(async ({ShellView}) => {
    const shell = await shellPromise;
    const shellView = new ShellView(shell, document.body);
  });
} else {
  document.title = 'LogBook';
  import('./logbook/LogBook');
}