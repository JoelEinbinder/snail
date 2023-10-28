/// <reference path="../slug/iframe/types.d.ts" />
import '../slug/iframe/iframe.css';
import '../slug/iframe/iframe';

const iframeType = new URL(location.href).searchParams.get('iframe');
if (iframeType === 'ls') {
  await import('../slug/apps/ls/web');
} else if (iframeType === 'monster') {
  await import('./monster-iframe');
} else if (iframeType === 'reset') {
  await import('./reset-iframe');
} else if (iframeType === 'pathway') {
  await import('./pathway-iframe');
} else if (iframeType === 'battle') {
  await import('./battle/battle-iframe');
} else {
  document.body.textContent = 'iframe not found: ' + iframeType;
  d4.setHeight(document.body.offsetHeight);
}