function f() {
  return 1;
}

class A {
  constructor(prop) {
    this.prop = prop;
    console.log('constructor');
  }

  m() {
    return 'm';
  }
}

class B extends A {
  n() {
    return 'n';
  }
}

f();

const a = new A(0);
const b = new B(1);
console.log(b.m());
console.log(b.n());
