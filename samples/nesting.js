function x() {
  let a = -1;
  a = -2;
  for (let index = 0; index < 3; index++) {
    let a;
    a = index;
  }
  a = -3;

  return a;
}

// function x(d) {
//   let a = d;
//   const array = [1, 2, 3];
//   for (let index = 0; index < array.length; index++) {
//     const element = array[index];
//     for (let index2 = 0; index2 < array.length; index2++) {
//       const element2 = array[index2];
//       const sum = element + element2;
//       if (sum % 2) {
//         a += sum;
//       }
//     }
//   }
// }

x();
