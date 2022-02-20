export function preprocessForJS(command: string) {
  return wrapObjectLiterals(command);
}

function wrapObjectLiterals(code: string) {
  // Copyright 2018 The Chromium Authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.

  // Only parenthesize what appears to be an object literal.
  if (!(/^\s*\{/.test(code) && /\}\s*$/.test(code))) {
    return code;
  }

  const parse = (async(): Promise<number> => 0).constructor;
  try {
    // Check if the code can be interpreted as an expression.
    parse('return ' + code + ';');

    // No syntax error! Does it work parenthesized?
    const wrappedCode = '(' + code + ')';
    parse(wrappedCode);

    return wrappedCode;
  } catch (e) {
    return code;
  }
}