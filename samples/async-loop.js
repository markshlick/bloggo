async function a() {
  for (let index = 0; index < 3; index++) {
    if (index % 2) {
      const r = await b(index);
      console.log(r);
    }
  }
}

async function b(x) {
  return await Promise.resolve(x);
}

a();

console.log('hi');
