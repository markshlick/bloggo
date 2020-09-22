import * as NodeTypes from 'metaes/nodeTypes';
import {
  evaluate,
  visitArray,
  evaluateArray,
} from 'metaes/evaluate';
import {
  NotImplementedException,
  toException,
} from 'metaes/exceptions';
import {
  Continuation,
  ErrorContinuation,
  Environment,
  EvaluationConfig,
} from 'metaes/types';
import { callcc } from 'metaes/callcc';

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

export function GetProperty(
  {
    object,
    property,
    super: super_,
  }: NodeTypes.GetProperty & { super: boolean },
  c: Continuation,
  cerr: ErrorContinuation,
) {
  let target = object;
  if (super_) {
    target = Object.getPrototypeOf(
      Object.getPrototypeOf(object),
    );
  }
  try {
    c(target[property]);
  } catch (e) {
    cerr(e);
  }
}

class SpreadElementValue {
  constructor(public value: any) {}
}

export function SpreadElement(
  e: NodeTypes.SpreadElement,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  evaluate(
    e.argument,
    (value) => c(new SpreadElementValue(value)),
    cerr,
    env,
    config,
  );
}

export function CallExpression(
  e: NodeTypes.CallExpression,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  evaluateArray(
    e.arguments,
    (args) => {
      args = args.reduce(
        (total: any[], next: any) =>
          next instanceof SpreadElementValue
            ? total.concat(next.value)
            : total.concat([next]),
        [],
      );
      switch (e.callee.type) {
        case 'Super':
          const superConstructor = Object.getPrototypeOf(
            Object.getPrototypeOf(env.values.this),
          ).constructor;

          try {
            evaluate(
              {
                type: 'Apply',
                fn: superConstructor,
                e,
                args,
                thisValue: env.values.this,
              },
              c,
              cerr,
              env,
              config,
            );
          } catch (error) {
            cerr(toException(error, e.callee));
          }
          break;
        case 'Identifier':
        case 'FunctionExpression':
        case 'CallExpression':
          evaluate(
            e.callee,
            (callee) => {
              console.log(callee);

              if (typeof callee === 'function') {
                try {
                  if (callee === callcc) {
                    try {
                      const [receiver, _arguments] = args;
                      receiver(
                        _arguments,
                        c,
                        cerr,
                        env,
                        config,
                      );
                    } catch (e) {
                      cerr({
                        value: e,
                        message:
                          'Error in continuation receiver.',
                      });
                    }
                  } else {
                    evaluate(
                      {
                        type: 'Apply',
                        e,
                        fn: callee,
                        args,
                      },
                      c,
                      cerr,
                      env,
                      config,
                    );
                  }
                } catch (error) {
                  cerr(toException(error, e.callee));
                }
              } else {
                cerr(
                  new TypeError(
                    callee + ' is not a function',
                  ),
                );
              }
            },
            cerr,
            env,
            config,
          );
          break;
        case 'MemberExpression':
          const e_callee = e.callee as NodeTypes.MemberExpression;
          evaluate(
            e_callee.object,
            (object) => {
              function evalApply(property: string) {
                evaluate(
                  {
                    type: 'Apply',
                    e,
                    fn: property,
                    thisValue: object,
                    args,
                  },
                  c,
                  cerr,
                  env,
                  config,
                );
              }
              if (
                !e_callee.computed &&
                e_callee.property.type === 'Identifier'
              ) {
                evaluate(
                  {
                    type: 'GetProperty',
                    object,
                    property: e_callee.property.name,
                    // @ts-ignore
                    super: e_callee.object.type === 'Super',
                  },
                  evalApply,
                  cerr,
                  env,
                  config,
                );
              } else {
                evaluate(
                  e_callee.property,
                  (propertyValue) =>
                    evaluate(
                      {
                        type: 'GetProperty',
                        object,
                        property: propertyValue,
                        super:
                          // @ts-ignore
                          e_callee.object.type === 'Super',
                      },
                      evalApply,
                      cerr,
                      env,
                      config,
                    ),
                  cerr,
                  env,
                  config,
                );
              }
            },
            cerr,
            env,
            config,
          );
          break;
        case 'ArrowFunctionExpression':
          evaluate(
            e.callee,
            (callee) => {
              try {
                const cnt = (thisValue: any) =>
                  evaluate(
                    {
                      type: 'Apply',
                      e,
                      fn: callee,
                      thisValue,
                      args,
                    },
                    c,
                    cerr,
                    env,
                    config,
                  );
                evaluate(
                  { type: 'GetValue', name: 'this' },
                  cnt,
                  () => cnt(undefined),
                  env,
                  config,
                );
              } catch (error) {
                cerr(toException(error, e.callee));
              }
            },
            cerr,
            env,
            config,
          );
          break;
        default:
          cerr({
            type: 'NotImplemented',
            message: `This kind of callee node ('${
              (e.callee as any).type
            }') is not supported yet.`,
            location: e.callee,
          });
      }
    },
    cerr,
    env,
    config,
  );
}

export function Super(
  _e: NodeTypes.ThisExpression,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  evaluate(
    { type: 'GetValue', name: 'this' },
    c,
    cerr,
    env,
    config,
  );
}
