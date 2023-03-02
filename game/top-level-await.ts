//@ts-nocheck
import * as acorn from 'acorn';
/*
 * Copyright (C) 2011 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
// Stolen from https://chromium.googlesource.com/chromium/src/+/e8111c396fef38da6654093433b4be93bed01dce/third_party/WebKit/Source/devtools/front_end/formatter_worker/FormatterWorker.js
export function preprocessTopLevelAwaitExpressions(content: string) {
  var wrapped = '(async () => {' + content + '})()';
  var root = acorn.parse(wrapped, {ecmaVersion: 8});
  var body = root.body[0].expression.callee.body;
  var changes = [];
  var containsAwait = false;
  var containsReturn = false;
  class Visitor {
    ClassDeclaration(node) {
      if (node.parent === body)
        changes.push({text: node.id.name + '=', start: node.start, end: node.start});
    }
    FunctionDeclaration(node) {
      changes.push({text: node.id.name + '=', start: node.start, end: node.start});
      return SkipSubtree;
    }
    FunctionExpression(node) {
      return SkipSubtree;
    }
    ArrowFunctionExpression(node) {
      return SkipSubtree;
    }
    MethodDefinition(node) {
      return SkipSubtree;
    }
    AwaitExpression(node) {
      containsAwait = true;
    }
    ReturnStatement(node) {
      containsReturn = true;
    }
    VariableDeclaration(node) {
      if (node.kind !== 'var' && node.parent !== body)
        return;
      var onlyOneDeclaration = node.declarations.length === 1;
      changes.push(
          {text: onlyOneDeclaration ? 'void' : 'void (', start: node.start, end: node.start + node.kind.length});
      for (var declaration of node.declarations) {
        if (!declaration.init) {
          changes.push({text: '(', start: declaration.start, end: declaration.start});
          changes.push({text: '=undefined)', start: declaration.end, end: declaration.end});
          continue;
        }
        changes.push({text: '(', start: declaration.start, end: declaration.start});
        changes.push({text: ')', start: declaration.end, end: declaration.end});
      }
      if (!onlyOneDeclaration) {
        var last = node.declarations.peekLast();
        changes.push({text: ')', start: last.end, end: last.end});
      }
    }
  }
  var walker = new ESTreeWalker(visit.bind(new Visitor()));
  walker.walk(body);
  /**
   * @param {!ESTree.Node} node
   * @this {Object}
   */
  function visit(node) {
    if (node.type in this)
      return this[node.type](node);
  }
  // Top-level return is not allowed.
  if (!containsAwait || containsReturn)
    return null;
  var last = body.body[body.body.length - 1];
  if (last.type === 'ExpressionStatement') {
    changes.push({text: 'return (', start: last.start, end: last.start});
    if (wrapped[last.end - 1] !== ';')
      changes.push({text: ')', start: last.end, end: last.end});
    else
      changes.push({text: ')', start: last.end - 1, end: last.end - 1});
  }
  while (changes.length) {
    var change = changes.pop();
    wrapped = wrapped.substr(0, change.start) + change.text + wrapped.substr(change.end);
  }
  return wrapped;
};
class ESTreeWalker {
  /**
   * @param {function(!ESTree.Node):(!Object|undefined)} beforeVisit
   * @param {function(!ESTree.Node)=} afterVisit
   */
  constructor(beforeVisit, afterVisit) {
    this._beforeVisit = beforeVisit;
    this._afterVisit = afterVisit || new Function();
    this._walkNulls = false;
  }
  /**
   * @param {boolean} value
   */
  setWalkNulls(value) {
    this._walkNulls = value;
  }
  /**
   * @param {!ESTree.Node} ast
   */
  walk(ast) {
    this._innerWalk(ast, null);
  }
  /**
   * @param {!ESTree.Node} node
   * @param {?ESTree.Node} parent
   */
  _innerWalk(node, parent) {
    if (!node && parent && this._walkNulls) {
      var result = /** @type {!Object} */ ({raw: 'null', value: null});
      result.type = 'Literal';
      node = /** @type {!ESTree.Node} */ (result);
    }
    if (!node)
      return;
    node.parent = parent;
    if (this._beforeVisit.call(null, node) === SkipSubtree) {
      this._afterVisit.call(null, node);
      return;
    }
    var walkOrder = _walkOrder[node.type];
    if (!walkOrder) {
      console.error('Walk order not defined for ' + node.type);
      return;
    }
    if (node.type === 'TemplateLiteral') {
      var templateLiteral = /** @type {!ESTree.TemplateLiteralNode} */ (node);
      var expressionsLength = templateLiteral.expressions.length;
      for (var i = 0; i < expressionsLength; ++i) {
        this._innerWalk(templateLiteral.quasis[i], templateLiteral);
        this._innerWalk(templateLiteral.expressions[i], templateLiteral);
      }
      this._innerWalk(templateLiteral.quasis[expressionsLength], templateLiteral);
    } else {
      for (var i = 0; i < walkOrder.length; ++i) {
        var entity = node[walkOrder[i]];
        if (Array.isArray(entity))
          this._walkArray(entity, node);
        else
          this._innerWalk(entity, node);
      }
    }
    this._afterVisit.call(null, node);
  }
  /**
   * @param {!Array.<!ESTree.Node>} nodeArray
   * @param {?ESTree.Node} parentNode
   */
  _walkArray(nodeArray, parentNode) {
    for (var i = 0; i < nodeArray.length; ++i)
      this._innerWalk(nodeArray[i], parentNode);
  }
};
/** @typedef {!Object} SkipSubtree */
const SkipSubtree = {};
/** @enum {!Array.<string>} */
const _walkOrder = {
  'AwaitExpression': ['arguments'],
  'ArrayExpression': ['elements'],
  'ArrowFunctionExpression': ['params', 'body'],
  'AssignmentExpression': ['left', 'right'],
  'BinaryExpression': ['left', 'right'],
  'BlockStatement': ['body'],
  'BreakStatement': ['label'],
  'CallExpression': ['callee', 'arguments'],
  'CatchClause': ['param', 'body'],
  'ClassBody': ['body'],
  'ClassDeclaration': ['id', 'superClass', 'body'],
  'ClassExpression': ['id', 'superClass', 'body'],
  'ConditionalExpression': ['test', 'consequent', 'alternate'],
  'ContinueStatement': ['label'],
  'DebuggerStatement': [],
  'DoWhileStatement': ['body', 'test'],
  'EmptyStatement': [],
  'ExpressionStatement': ['expression'],
  'ForInStatement': ['left', 'right', 'body'],
  'ForOfStatement': ['left', 'right', 'body'],
  'ForStatement': ['init', 'test', 'update', 'body'],
  'FunctionDeclaration': ['id', 'params', 'body'],
  'FunctionExpression': ['id', 'params', 'body'],
  'Identifier': [],
  'IfStatement': ['test', 'consequent', 'alternate'],
  'LabeledStatement': ['label', 'body'],
  'Literal': [],
  'LogicalExpression': ['left', 'right'],
  'MemberExpression': ['object', 'property'],
  'MethodDefinition': ['key', 'value'],
  'NewExpression': ['callee', 'arguments'],
  'ObjectExpression': ['properties'],
  'ObjectPattern': ['properties'],
  'ParenthesizedExpression': ['expression'],
  'Program': ['body'],
  'Property': ['key', 'value'],
  'ReturnStatement': ['argument'],
  'SequenceExpression': ['expressions'],
  'Super': [],
  'SwitchCase': ['test', 'consequent'],
  'SwitchStatement': ['discriminant', 'cases'],
  'TaggedTemplateExpression': ['tag', 'quasi'],
  'TemplateElement': [],
  'TemplateLiteral': ['quasis', 'expressions'],
  'ThisExpression': [],
  'ThrowStatement': ['argument'],
  'TryStatement': ['block', 'handler', 'finalizer'],
  'UnaryExpression': ['argument'],
  'UpdateExpression': ['argument'],
  'VariableDeclaration': ['declarations'],
  'VariableDeclarator': ['id', 'init'],
  'WhileStatement': ['test', 'body'],
  'WithStatement': ['object', 'body'],
  'YieldExpression': ['argument']
};
