import 'styles/utility-ui.css';

export default function Exploration() {
  return (
    <div className="reset">
      <div className="header-offset">
        <section className="section">
          <h1 className="h1">Utility UI Exploration</h1>
        </section>
      </div>
      <div className="y">
        <section className="section">
          <h2 className="h2">Hello 👋🏽</h2>
          <p className="content">
            Lorem ipsum dolor sit, amet consectetur
            adipisicing elit. Repudiandae beatae
            exercitationem iure dolore harum, dolorem
            temporibus consectetur vero modi nesciunt,
            voluptatum consequuntur suscipit molestias sit
            fuga dignissimos eos eaque at?
          </p>
        </section>
        <section className="section">
          <h2 className="h2">Block quote</h2>
          <blockquote className="blockquote">
            <strong className="foil gold">
              Gold foil text please
            </strong>
          </blockquote>
          <blockquote className="blockquote">
            <strong className="foil silver">
              Silver foil, too
            </strong>
          </blockquote>
          <blockquote className="blockquote">
            <strong className="foil alloy">
              Plus alloy foil
            </strong>
          </blockquote>
          <blockquote className="blockquote">
            <strong className="foil rose">
              Don't forget rose
            </strong>
          </blockquote>
        </section>
        <section className="section">
          <h2 className="h2">Badge</h2>
          <span className="badge">Alloy</span>
        </section>
        <section className="section">
          <h2 className="h2">Matte card</h2>
          <div className="card-matte">
            <div
              className="card-matte-background"
              style={{
                background:
                  'linear-gradient(135deg, aquamarine, forestgreen)',
              }}
            />
            <div className="card-matte-content">
              <h3 className="h3">
                Lorem ipsum dolor sit amet
              </h3>
              <p className="content">
                Lorem ipsum dolor sit amet consectetur
                adipisicing elit. Quibusdam at voluptas
                accusamus impedit odio qui in
              </p>
            </div>
          </div>
          <div className="card-matte">
            <div
              className="card-matte-background"
              style={{
                background:
                  'linear-gradient(135deg, purple, magenta)',
              }}
            />
            <div className="card-matte-content">
              <h3 className="h3">
                Lorem ipsum dolor sit amet
              </h3>
              <p className="content">
                Lorem ipsum dolor sit amet consectetur
                adipisicing elit. Quibusdam at voluptas
                accusamus impedit odio qui in
              </p>
            </div>
          </div>
        </section>
        <section className="section">
          <h2 className="h2">Polished card</h2>
          <div className="card-polished">
            <h3 className="h3">
              Lorem ipsum dolor sit amet
            </h3>
            <p className="content">
              Lorem ipsum dolor sit amet consectetur
              adipisicing elit. Quibusdam at voluptas
              accusamus impedit odio qui in
            </p>
          </div>
        </section>
        <section className="section">
          <h2 className="h2">Dark button</h2>
          <button className="button">Clicky</button>
        </section>
        <section className="section">
          <h2 className="h2">Light button</h2>
          <div className="shadow-box">
            <button className="button light">Clicky</button>
          </div>
        </section>
        <section className="section">
          <h2 className="h2">Input</h2>
          <input
            className="input"
            type="text"
            placeholder="Hello"
          />
        </section>
      </div>
      <div className="header-animation">
        <div className="header-animation-layer-1">
          <div className="header-animation-common header-animation-item-1" />
          <div className="header-animation-common header-animation-item-2" />
          <div className="header-animation-common header-animation-item-3" />
          <div className="header-animation-common header-animation-item-4" />
          <div className="header-animation-common header-animation-item-5" />
          <div className="header-animation-common header-animation-item-6" />
        </div>
      </div>
    </div>
  );
}

// @ts-ignore
Exploration.layout = null;
