function F() {}

class O {}

class S {
  constructor(v) {
    this.v = v;
  }

  x() {
    return 'a' + this.v;
  }
}

class C extends S {
  constructor(v) {
    super(v);
  }

  x() {
    return 'b' + this.v;
  }

  y() {
    return super.x();
  }
}

const s = new S(0);
const c = new C(1);
const sx = s.x();
const cx = c.x();
const cy = c.y();
