import { NotImplementedException } from 'metaes/exceptions';
import {
  Environment,
  Continuation,
  ErrorContinuation,
  EvaluationConfig,
} from 'metaes/types';
import * as NodeTypes from 'metaes/nodeTypes';
import { evaluate } from 'metaes/evaluate';
import { SetProperty } from 'metaes/interpreter/base';
import { getEnvironmentForValue } from 'metaes/environment';

type SetValueT<T> = {
  name: string;
  value: T;
  isDeclaration: boolean;
};

export function AssignmentExpression(
  e: NodeTypes.AssignmentExpression,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  evaluate(
    e.right,
    (right) => {
      const e_left = e.left;
      switch (e_left.type) {
        case 'Identifier':
          evaluate(
            {
              type: 'SetValue',
              name: e_left.name,
              value: right,
              operator: e.operator,
              isDeclaration: false,
            },
            c,
            cerr,
            env,
            config,
          );
          break;
        case 'MemberExpression':
          evaluate(
            e_left.object,
            (object) => {
              const property = e_left.property;
              if (e_left.computed) {
                evaluate(
                  e_left.property,
                  (property) =>
                    evaluate(
                      {
                        type: 'SetProperty',
                        object,
                        property,
                        value: right,
                        operator: e.operator,
                      },
                      c,
                      cerr,
                      env,
                      config,
                    ),
                  cerr,
                  env,
                  config,
                );
              } else if (property.type === 'Identifier') {
                evaluate(
                  {
                    type: 'SetProperty',
                    object,
                    property: property.name,
                    value: right,
                    operator: e.operator,
                  },
                  c,
                  cerr,
                  env,
                  config,
                );
              } else {
                cerr(
                  NotImplementedException(
                    'This kind of assignment is not implemented yet.',
                    property,
                  ),
                );
              }
            },
            cerr,
            env,
            config,
          );
          break;
        default:
          cerr(
            NotImplementedException(
              'This assignment is not supported yet.',
            ),
          );
      }
    },
    cerr,
    env,
    config,
  );
}

export function SetValue<T>(
  {
    name,
    value,
    operator,
    isDeclaration,
  }: SetValueT<T> & { operator: string },
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment<T>,
) {
  let writableEnv: Environment | undefined = env;
  while (writableEnv && writableEnv.internal) {
    writableEnv = writableEnv.prev;
  }
  if (!writableEnv) {
    return cerr(
      new Error(`Can't write to '${name}' value.`),
    );
  }
  if (isDeclaration) {
    c((writableEnv.values[name] = value));
  } else {
    const _env = getEnvironmentForValue(writableEnv, name);
    if (_env) {
      SetProperty(
        {
          type: 'SetProperty',
          object: _env.values,
          property: name,
          value,
          operator,
        },
        c,
        cerr,
      );
    } else {
      cerr({
        type: 'ReferenceError',
        value: new ReferenceError(
          `'${name}' is not defined.`,
        ),
      });
    }
  }
}
