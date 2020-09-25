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
} from 'modules/meta/interpreters/classIntepreters';
import {
  ArrowFunctionExpression,
  FunctionExpression,
  FunctionDeclaration,
  AwaitExpression,
  TryStatement,
  Apply,
} from 'modules/meta/interpreters/asyncInterpreters';
import jsxInterpreters from 'modules/meta/interpreters/jsxInterpreters';
import {
  SetValue,
  AssignmentExpression,
} from 'modules/meta/interpreters/envInterpreters';
import { ForInStatement } from 'modules/meta/interpreters/statementInterpreters';

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

export const interpreters = {
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
  //
  SetValue,
  AssignmentExpression,
  ForInStatement,
};

export const getInterpreters = () => {
  return interpreters;
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
  Uint16Array,
  undefined,
  this: undefined as any,
};

globalObjects.this = globalObjects;

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
