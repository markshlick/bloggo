// psst: you can edit me!

function fibonacci(num) {
  if (num < 0) return null;
  if (num <= 1) return num;

  const f1 = fibonacci(num - 1);
  const f2 = fibonacci(num - 2);
  const result = f1 + f2;

  return result;
}

const r = fibonacci(3);
