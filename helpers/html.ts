const html = (x: string) => {
  const doc = new DOMParser().parseFromString(
    x,
    'text/html',
  );
  return doc.body.firstChild;
};

export const appendHtml = (el: Element, c: string) => {
  const x = html(c);
  x && el.appendChild(x);
  return x;
};
