console.log(1);

setTimeout(() => {
  console.log('yoo');
  console.log('ayoo');
  setTimeout(() => {
    console.log('wow');
  }, 1000);
}, 3000);

setTimeout(() => {
  console.log('ok');
}, 4000);

console.log(2);
