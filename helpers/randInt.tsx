export default function randInt(a: number, b?: number) {
  const min = b ? a : 0;
  const max = b ? b : a;
  return min + Math.floor(Math.random() * (max - min));
}
