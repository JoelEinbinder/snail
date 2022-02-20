export function preprocessForJS(command: string) {
  return wrapObjectLiterals(command);
}
const parse = (async() => void 0).constructor;

function wrapObjectLiterals(code: string) {
  // Copyright 2018 The Chromium Authors. All rights reserved.
  // Use of this source code is governed by a BSD-style license that can be
  // found in the LICENSE file.

  // Only parenthesize what appears to be an object literal.
  if (!(/^\s*\{/.test(code) && /\}\s*$/.test(code))) {
    return code;
  }

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

export function isUnexpectedEndOfInput(code: string) {
  try {
    parse(code);
    return false;
  } catch(e) {
    if (e.message.startsWith('SyntaxError: Unexpected end of input') || e.message.startsWith('SyntaxError: Unterminated template literal'))
      return true;
    try {
      // TODO: UH OH DONT DO THIS!
      eval(code);
      console.error('THIS WENT BAD WE EXECUTED SOME SHIT');
    } catch (e) {
      return e.toString().startsWith('SyntaxError: Unexpected end of input') || e.toString().startsWith('SyntaxError: Unterminated template literal');
    }
  }
}
