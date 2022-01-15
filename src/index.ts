import { ShellView } from './ShellView';
import { Shell } from './Shell';
import './dark.css';

Shell.create().then(shell => {
  const view = new ShellView(shell, document.body);
});
