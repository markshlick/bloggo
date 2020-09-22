import * as NodeTypes from 'metaes/nodeTypes';
import {
  evaluate,
  visitArray,
  evaluateArray,
} from 'metaes/evaluate';
import { NotImplementedException } from 'metaes/exceptions';
import {
  Continuation,
  ErrorContinuation,
  Environment,
  EvaluationConfig,
} from 'metaes/types';

export function ClassDeclaration(
  e: NodeTypes.ClassDeclaration,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  const name = e.id?.name ?? '';
  console.log(name);

  function onSuperClass(superClass: any) {
    evaluate(
      e.body,
      (body) => {
        return visitArray(
          body,
          (
            {
              key,
              value,
              static: static_,
            }: {
              key: string;
              value: Function;
              static: boolean;
            },
            c,
            cerr,
          ) => {
            c({
              key,
              value,
              static: static_,
            });
          },
          (
            methods: {
              key: string;
              value: Function;
              static: boolean;
            }[],
          ) => {
            const [constructorDefinition] = methods.filter(
              (m) => m.key === 'constructor',
            );

            const restMethods = methods.filter(
              (m) => m.key !== 'constructor',
            );

            // debugger;

            let class_: Function =
              constructorDefinition?.value ??
              (superClass?.constructor
                ? function (this: any) {
                    superClass.apply(this, arguments);
                  }
                : function () {}) ??
              function () {};

            if (superClass) {
              class_.prototype = Object.create(
                superClass.prototype,
                {
                  constructor: {
                    value: class_,
                    writable: true,
                    configurable: true,
                  },
                },
              );
            }

            Object.defineProperty(class_, 'name', {
              value: name,
              writable: false,
            });

            restMethods.forEach(
              ({
                key,
                value,
                static: static_,
              }: {
                key: string;
                value: Function;
                static: boolean;
              }) => {
                if (static_) {
                  (class_ as any)[key] = value;
                } else {
                  class_.prototype[key] = value;
                }
              },
            );

            return e.id
              ? evaluate(
                  {
                    type: 'SetValue',
                    name: e.id.name,
                    value: class_,
                    isDeclaration: true,
                  },
                  c,
                  cerr,
                  env,
                  config,
                )
              : cerr(
                  NotImplementedException(
                    'Not implemented case',
                  ),
                );
          },
          cerr,
        );
      },
      cerr,
      env,
      config,
    );
  }
  if (e.superClass) {
    evaluate(e.superClass, onSuperClass, cerr, env, config);
  } else {
    onSuperClass(null);
  }
}

export function ClassBody(
  e: NodeTypes.ClassBody,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  evaluateArray(e.body, c, cerr, env, config);
}

export function MethodDefinition(
  e: NodeTypes.MethodDefinition,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  evaluate(
    e.value,
    (value: NodeTypes.FunctionExpression) => {
      const next = (key: string) => {
        c({
          // @ts-ignore
          static: e['static'],
          key,
          value,
        });
      };

      // @ts-ignore
      if (e.computed) {
        evaluate(e.key, next, cerr, env, config);
      } else {
        next(e.key.name);
      }
    },
    cerr,
    env,
    config,
  );
}
