import { debug } from 'console';
import { noop } from 'metaes';
import { evaluate, visitArray } from 'metaes/evaluate';
import { ECMAScriptInterpreters } from 'metaes/interpreters';
import {
  createMetaFunctionWrapper,
  getMetaFunction,
} from 'metaes/metafunction';
import {
  ASTNode,
  Continuation,
  Environment,
  ErrorContinuation,
  EvaluationConfig,
} from 'metaes/types';
import { createElement } from 'react';

type Visitor<T> = (
  element: T,
  c: Continuation,
  cerr: ErrorContinuation,
) => void;

export const visitAttributes = <T extends ASTNode>(
  items: T[],
  fn: Visitor<T>,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment<any>,
  config: EvaluationConfig,
) => {
  if (items.length === 0) {
    c([]);
  } else if (items.length === 1) {
    const v = items[0];
    const attrValue =
      v.value.type === 'JSXExpressionContainer'
        ? v.value.expression
        : v.value;

    fn(
      attrValue,
      (value) => c({ [v.name.name]: value }),
      cerr,
    );
  } else {
    // Array of loop function arguments to be applied next time
    // TODO: convert to nextOperation or similar, there is always only one? What about callcc?
    const tasks: any[] = [];
    // Indicates if tasks execution is done. Initially it is done.
    let done = true;

    // Simple `loop` function executor, just loop over arguments until nothing is left.
    const execute = function () {
      done = false;
      while (tasks.length) {
        // @ts-ignore
        loop(...tasks.shift());
      }
      done = true;
    };

    // const visited = new Set();

    const loop = function (
      index: number,
      accumulated: { [name: string]: any },
    ) {
      if (index < items.length) {
        const item = items[index];

        const attrValue =
          item.type === 'JSXSpreadAttribute'
            ? item.argument
            : item.value.type === 'JSXExpressionContainer'
            ? item.value.expression
            : item.value;

        const next = (value: any) => {
          // // If true, it means currently may be happening for example a reevaluation of items
          // // from certain index using call/cc. Copy accumulated previously results and ignore their tail
          // // after given index as this reevalution may happen in the middle of an array.
          // if (visited.has(index)) {
          //   accumulated = accumulated.slice(0, index);
          // }

          if (item.type === 'JSXSpreadAttribute') {
            Object.assign(accumulated, value);
          } else {
            const attrName = items[index].name.name;
            accumulated[attrName] = value;
          }
          //   visited.add(index);
          tasks.push([index + 1, accumulated]);
          if (done) {
            execute();
          }
        };

        evaluate(attrValue, next, cerr, env, config);
      } else {
        c(accumulated);
      }
    };

    // start
    loop(0, {});
  }
};

export const evaluateAttributes = (
  array: ASTNode[],
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) =>
  visitAttributes(
    array,
    (e, c, cerr) => evaluate(e, c, cerr, env, config),
    c,
    cerr,
    env,
    config,
  );

export const evaluateChildren = (
  array: ASTNode[],
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) =>
  visitArray(
    array,
    (e, c, cerr) => {
      let ne = e;
      if (e.type === 'JSXText') {
        ne = {
          type: 'Literal',
          value: e.value,
        };
      } else if (e.type === 'JSXExpressionContainer') {
        ne = e.expression;
      }
      return evaluate(ne, c, cerr, env, config);
    },
    c,
    cerr,
  );

const jsxInterpreters = {
  JSXElement: (
    e: {
      openingElement: {
        name: { name: string };
        attributes: any;
      };
      children: any[];
    },
    c: Continuation,
    cerr: ErrorContinuation,
    env: Environment,
    config: EvaluationConfig,
  ) => {
    evaluateAttributes(
      e.openingElement.attributes,
      (attributes) =>
        evaluateChildren(
          e.children ?? [],
          (children) => {
            const tagName = e.openingElement.name.name;
            const isCompat = /^[a-z]/.test(tagName);
            evaluate(
              isCompat
                ? { type: 'Literal', value: tagName }
                : { type: 'Identifier', name: tagName },
              (tag) => {
                const el = createElement(
                  tag,
                  attributes,
                  ...children,
                );

                c(el);
              },
              cerr,
              env,
              config,
            );
          },
          cerr,
          env,
          config,
        ),
      cerr,
      env,
      config,
    );
  },
  // JSXElement: (
  //   e: {
  //     openingElement: {
  //       name: { name: string };
  //       attributes: any;
  //     };
  //     children: any[];
  //   },
  //   c: Continuation,
  //   cerr: ErrorContinuation,
  //   env: Environment,
  //   config: EvaluationConfig,
  // ) => {
  //   const tagName = e.openingElement.name.name;
  //   const isCompat = /^[a-z]/.test(tagName);
  //   GetValueSync('CallExpression', config.interpreters)(
  //     {
  //       type: 'CallExpression',
  //       callee: {
  //         type: 'Identifier',
  //         name: 'createElement',
  //       },
  //       arguments: [
  //         isCompat
  //           ? {
  //               type: 'Literal',
  //               value: tagName,
  //             }
  //           : {
  //               type: 'Identifier',
  //               name: tagName,
  //             },
  //       ],
  //     },
  //     c,
  //     cerr,
  //     env,
  //     config,
  //   );
  // },
};

export default jsxInterpreters;
