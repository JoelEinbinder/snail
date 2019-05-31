/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { EventEmitter2 } from 'common/EventEmitter2';

describe('EventEmitter2', () => {
  it('should fire listeners multiple times', () => {
    const order: string[] = [];
    const emitter = new EventEmitter2<number>();
    emitter.event(data => order.push(data + 'a'));
    emitter.event(data => order.push(data + 'b'));
    emitter.fire(1);
    emitter.fire(2);
    assert.deepEqual(order, [ '1a', '1b', '2a', '2b' ]);
  });

  it('should not fire listeners once disposed', () => {
    const order: string[] = [];
    const emitter = new EventEmitter2<number>();
    emitter.event(data => order.push(data + 'a'));
    const disposeB = emitter.event(data => order.push(data + 'b'));
    emitter.event(data => order.push(data + 'c'));
    emitter.fire(1);
    disposeB.dispose();
    emitter.fire(2);
    assert.deepEqual(order, [ '1a', '1b', '1c', '2a', '2c' ]);
  });
});
