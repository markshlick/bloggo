import { isValidElement } from 'react';
import isFunction from 'lodash/isFunction';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import isDate from 'lodash/isDate';
import isArray from 'lodash/isArray';

export function formatValue(arg: any): string {
  if (isFunction(arg)) {
    return `fn()`;
  } else if (isValidElement(arg)) {
    return `<${
      isString(arg.type) && arg.type.length
        ? arg.type
        : 'ReactElement'
    } />`;
  } else if (isArray(arg)) {
    return isArray(arg[0])
      ? `[...]`
      : `[${(arg.length > 5
          ? arg.slice(0, 5).concat('...')
          : arg
        )
          .map(formatValue)
          .join(', ')}]`;
  } else if (isObject(arg)) {
    const keys = Object.keys(arg);
    return `${
      arg.constructor.name === 'Object'
        ? ''
        : arg.constructor.name
    }{${keys.join(', ')}}`;
  } else if (isDate(arg)) {
    return `Date{${arg.toISOString()}}`;
  } else if (isString(arg)) {
    return `"${arg}"`;
  } else {
    return arg;
  }
}
export function formatArgs(args: any[]) {
  return args.map((arg) => formatValue(arg)).join(', ');
}
