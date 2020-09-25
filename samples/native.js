const a = [1, 2, 3, 4];
const b = new Set();
const c = new Map();

const am = a.map((x) => {
  console.log(x);
  return x + 1;
});

const a_ = a.forEach((x) => x);
const b_ = b.forEach((x) => x);
const c_ = c.forEach((x) => x);
