async function a() {
  console.log('before a() await');
  const r = await b();
  console.log('x value', r);
  console.log('after a() await');
  return r;
}

async function b() {
  console.log('before b() await');
  const r = await Promise.resolve('hi!');
  console.log('after b() await');
  return r;
}

async function c(v) {
  return await Promise.resolve(v);
}

function d(v) {
  console.log('d', v);
  throw v;
}

function e(v) {
  console.log('e', v);

  return v + '!';
}

console.log('before a()');
const r = a();
console.log('a return', r);
console.log('after a()');

r.then(c).then(d).catch(e).then(e);

function x() {
  function y(v) {
    console.log(
      'stack should be x -> y (this is broken right now)',
    );
    console.log(v);
  }
  c(1).then(y);
}

x();
