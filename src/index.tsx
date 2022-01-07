import React from 'react';
import { render } from 'react-dom';
import { ShellView } from './ShellView';
import { Shell } from './Shell';
import './dark.css';

Shell.create().then(shell => {
  render(<ShellView shell={shell}/>, document.getElementById('root'));
});
