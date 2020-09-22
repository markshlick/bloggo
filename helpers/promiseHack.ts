// @ts-nocheck

export class PromiseHack extends Promise<any> {
  static resolve(v: unknown) {
    console.log('resolve');
    return new PromiseHack((n) => n(v));
  }

  static reject(v: unknown) {
    console.log('reject');
    return new PromiseHack((_, n) => n(v));
  }

  static all(v: unknown[]) {
    console.log('all');
    return new PromiseHack((r, j) =>
      Promise.all(v).then(r, j),
    );
  }

  static race(v: unknown[]) {
    console.log('race');
    return new PromiseHack((r, j) =>
      Promise.race(v).then(r, j),
    );
  }

  constructor(executor: Function) {
    console.log('new');
    this.state = 'pending';
    super(function (_resolve, _reject) {
      return executor(
        (v) => {
          this.state = 'resolved';
          this.resolvedValue = v;
          return _resolve(v);
        },
        (v) => {
          this.state = 'rejected';
          this.rejectedValue = v;
          return _reject(v);
        },
      );
    });
  }

  then(success, reject) {
    console.log('then');
    return super.then(success, reject);
  }

  catch(save) {
    console.log('catch');
    return super.then(save);
  }

  finally(save) {
    console.log('finally');
    return super.then(save);
  }
}

if (typeof window === 'object') {
  window.Promise = PromiseHack;
}
