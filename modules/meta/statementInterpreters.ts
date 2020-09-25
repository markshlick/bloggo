import { evaluate, visitArray } from 'metaes/evaluate';
import { NotImplementedException } from 'metaes/exceptions';
import {
  Interpreter,
  Environment,
  ASTNode,
} from 'metaes/types';
import * as NodeTypes from 'metaes/nodeTypes';

export const at = <T>({ loc, range }: ASTNode, rest: T) =>
  <const>{ loc, range, ...rest };
export const declare = (name: string, value: any) =>
  <const>{
    type: 'SetValue',
    name,
    value,
    isDeclaration: true,
  };
export const get = (name: string) =>
  <const>{ type: 'GetValue', name };
export const set = (name: string, value: any) =>
  <const>{
    type: 'SetValue',
    name,
    value,
    isDeclaration: false,
  };

export const ForInStatement: Interpreter<NodeTypes.ForInStatement> = (
  e,
  c,
  cerr,
  env,
  config,
) =>
  evaluate(
    e.right,
    (right) => {
      const left = e.left;
      switch (left.type) {
        case 'Identifier':
          visitArray(
            Object.keys(right),
            (name, c, cerr) =>
              evaluate(
                at(left, set(left.name, name)),
                () =>
                  evaluate(e.body, c, cerr, env, config),
                cerr,
                env,
                config,
              ),
            c,
            cerr,
          );
          break;
        // @ts-ignore
        case 'VariableDeclaration': {
          // @ts-ignore
          const declaration0 = left.declarations[0];
          // @ts-ignore
          function loopAssigningToVariable(
            name: string,
            bodyEnv: Environment,
          ) {
            visitArray(
              Object.keys(right),
              (value, c, cerr) =>
                evaluate(
                  at(declaration0, declare(name, value)),
                  () =>
                    evaluate(
                      e.body,
                      c,
                      cerr,
                      bodyEnv,
                      config,
                    ),
                  cerr,
                  env,
                  config,
                ),
              c,
              cerr,
            );
          }
          const bodyEnv = { prev: env, values: {} };
          switch (declaration0.id.type) {
            case 'Identifier':
              loopAssigningToVariable(
                declaration0.id.name,
                bodyEnv,
              );
              break;
            default:
              cerr(
                NotImplementedException(
                  // @ts-ignore
                  `Left-hand side of type ${left.declarations[0].id.type} in ${e.type} not implemented yet.`,
                  e.left,
                ),
              );
              break;
          }
          break;
        }
        default:
          cerr(
            NotImplementedException(
              'Only identifier in left-hand side is supported now.',
            ),
          );
          break;
      }
    },
    cerr,
    env,
    config,
  );
