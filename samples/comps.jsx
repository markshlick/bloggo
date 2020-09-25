// psst - you can edit me!
function Hello({ name }) {
  return (
    <div
      style={{
        backgroundColor: 'pink',
        color: 'purple',
        padding: 10,
        fontSize: 16,
        margin: 0,
      }}
    >
      <strong>Hello {name}!</strong>
    </div>
  );
}

const a = <div>hello</div>;

const b = <Hello name="world" />;

const c = (
  <div style={{ border: '2px blue solid' }}>{b}</div>
);
