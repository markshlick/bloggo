async function a(v) {
  return await Promise.resolve(v);
}

function b(v) {
  return v;
}

function c() {
  return d();
}

function d() {
  return 1;
}

const x1 = a(1);
const x2 = a(2);
const y = b(0);
const z = c();
