import { isValidElement } from 'react';
import isFunction from 'lodash/isFunction';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import isDate from 'lodash/isDate';
import isArray from 'lodash/isArray';

export function formatValue(arg: unknown): string {
  if (isFunction(arg)) {
    return `<fn>`;
  } else if (isObject(arg) && isValidElement(arg)) {
    return `<${
      isString(arg.type) && arg.type.length
        ? arg.type
        : 'ReactElement'
    } />`;
  } else if (isArray(arg)) {
    return `[]`;
  } else if (isObject(arg)) {
    return arg.constructor.name === 'Object'
      ? '{}'
      : `#${arg.constructor.name}`;
  } else if (isDate(arg)) {
    return `Date(${arg.toISOString()})`;
  } else if (isString(arg)) {
    return `"${arg}"`;
  } else {
    return `${arg}`;
  }
}
export function formatArgs(args: unknown[]) {
  return args.map((arg) => formatValue(arg)).join(', ');
}
