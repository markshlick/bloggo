async function a(v) {
  return await Promise.resolve(v);
}

const x = a(0);
const y = a(1);
