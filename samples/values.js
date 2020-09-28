async function a(v) { return await Promise.resolve(v); }
async function b(v) { return v; }

const y = b(2);
const x = a(0);
const x_ = a(2);
