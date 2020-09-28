const arrowFn = () => 0;

const rArrowFn = arrowFn;
const bArrowFn = arrowFn.bind(null);

function fnDecl() {
  return 0;
}

const fnExpr = function () {
  return 0;
};

const fnExprDecl = function fnDecl() {
  return 0;
};

class Class1 {
  constructor(p) {
    this.p1 = p;
  }

  method1() {
    return 1;
  }

  method2() {
    return 2;
  }
}

class Class2 extends Class1 {
  static staticMethod() {
    return 0;
  }

  constructor(p) {
    super(p);
    this.p2 = p;
  }

  method2() {
    return super.method2();
  }

  method3() {
    return this.method1();
  }
}

const c2 = new Class2(1);
const m0 = Class2.staticMethod();
const m1 = c2.method1();
const m2 = c2.method2();
const m3 = c2.method3();

const f1 = arrowFn();
const f2 = rArrowFn();
const f3 = bArrowFn();
const f4 = fnExpr();
const f5 = fnDecl();
const f6 = fnExprDecl();
