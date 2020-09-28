import { ASTNode } from 'metaes/types';
import { blockScopeTypes } from 'modules/meta/types';

export const prettyBlockScopeTypeNames: {
  [name in typeof blockScopeTypes[number]]: string;
} = {
  IfStatement: 'if { }',
  ForStatement: 'for { }',
  ForInStatement: 'for { in }',
  ForOfStatement: 'for { of }',
  WhileStatement: 'while { }',
};

const dot = '.';
const superName = `<super>`;
const thisName = `<this>`;
const fnName = `<fn>`;

export const formatFnName = (node: ASTNode) => {
  if (
    node.callee &&
    node.callee.type === 'MemberExpression'
  ) {
    const { object, property } = node.callee;
    let objectName;
    if (object.type === 'ThisExpression') {
      objectName = thisName;
    } else if (object.type === 'Super') {
      objectName = superName;
    } else {
      objectName = object.name;
    }
    return `${objectName}${dot}${property.name}`;
  } else if (node.type === 'NewExpression') {
    return `new<${node.callee.name}>`;
  } else if (node.callee && node.callee.type === 'Super') {
    return superName;
  } else if (node.callee && node.callee.name) {
    return node.callee.name;
  } else {
    return fnName;
  }
};

export function formatBlockScopeName(node: ASTNode) {
  return (prettyBlockScopeTypeNames as any)[node.type];
}

export default function formatNodeName(node: ASTNode) {
  if (node.type in prettyBlockScopeTypeNames) {
    return formatBlockScopeName(node);
  } else if (node.type === 'Apply') {
    return formatFnName(node.e);
  } else {
    return node.type;
  }
}
