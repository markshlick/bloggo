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

console.log('before a()');
const r = a();
console.log('a return', r);
console.log('after a()');

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

r.then(c).then(d).catch(e).then(e);

async function z(v) {
  return await Promise.resolve(v);
}
function x() {
  let a = 1;
  function y(v) {
    console.log({ v, a });
  }
  z(a).then(y);
  a = 2;
}

x();

async function z(v) {
  return await Promise.resolve(v);
}

const s = z();
s.then(() => console.log(1));
s.then(() => console.log(2));
