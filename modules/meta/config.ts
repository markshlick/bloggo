import { ECMAScriptInterpreters } from 'metaes/interpreters';
import { getMetaFunction } from 'metaes/metafunction';
import { ASTNode } from 'metaes/types';

import { NodeNames } from 'modules/meta/types';

import {
  ClassDeclaration,
  ClassBody,
  MethodDefinition,
  GetProperty,
  CallExpression,
  SpreadElement,
  Super,
} from 'modules/meta/classIntepreters';
import {
  ArrowFunctionExpression,
  FunctionExpression,
  FunctionDeclaration,
  AwaitExpression,
  TryStatement,
  Apply,
} from 'modules/meta/asyncInterpreters';
import jsxInterpreters from 'modules/meta/jsxInterpreters';

export const interestingTypes: NodeNames[] = [
  'VariableDeclarator',
  'CallExpression',
  'AssignmentExpression',
  'UpdateExpression',
  'ConditionalExpression',
  'ReturnStatement',
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'AwaitExpression',
  'Apply',
  'CatchClause',
];

export const getInterpreters = () => {
  return {
    ...ECMAScriptInterpreters.values,
    ...jsxInterpreters,
    // async
    Apply,
    ArrowFunctionExpression,
    FunctionExpression,
    FunctionDeclaration,
    AwaitExpression,
    TryStatement,
    // class
    ClassDeclaration,
    ClassBody,
    MethodDefinition,
    GetProperty,
    CallExpression,
    SpreadElement,
    Super,
  };
};
export const globalObjects = {
  Number,
  Boolean,
  Array,
  Object,
  Function,
  String,
  RegExp,
  Date,
  Math,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Error,
  parseInt,
  parseFloat,
  isNaN,
  JSON,
  console,
  Promise,
};

export const shouldWaitOnValuePhase = (node: ASTNode) =>
  node.type === 'Program' ||
  node.type === 'VariableDeclarator' ||
  node.type === 'AssignmentExpression' ||
  // FIXME - override node types
  // @ts-ignore
  node.type === 'AwaitExpression';

export const shouldSkipWaitOnEnterPhase = (
  node: ASTNode,
) => {
  const isApplyWithoutMetaFn =
    node.type === 'Apply' && !getMetaFunction(node.fn)?.e;

  // TODO: expose this as a callback?
  const skip =
    // HACK: Program statements (not interesting) are handled as BlockStatements by the interpreter
    node.type === 'Program' ||
    node.type === 'VariableDeclarator' ||
    node.type === 'ReturnStatement' ||
    node.type === 'AssignmentExpression' ||
    // node.type === 'ExpressionStatement' ||
    // @ts-ignore
    node.type === 'AwaitExpression' ||
    isApplyWithoutMetaFn;

  return skip;
};
