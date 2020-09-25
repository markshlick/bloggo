async function a() {
  const r = await b();
  return r;
}

async function b() {
  const r = await Promise.resolve('hi!');
  return r;
}

const r = a();

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
    return v;
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
