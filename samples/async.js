async function a() {
  console.log('before a() await');
  const r = await b();
  console.log('x value', r);
  console.log('after a() await');
  return r;
}

async function b() {
  console.log('before b() await');
  const r = await Promise.resolve('P');
  console.log('after b() await');
  return r;
}

async function c() {
  return await Promise.resolve();
}

console.log('before a()');
console.log('a return', a());
console.log('after a()');

c();
