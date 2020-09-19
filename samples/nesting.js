function x() {
  let a;
  const array = [1, 2, 3];
  for (let index = 0; index < array.length; index++) {
    const element = array[index];
    for (let index2 = 0; index2 < array.length; index2++) {
      const element2 = array[index2];
      a = element + element2;
    }
  }
}

x();
