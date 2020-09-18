import {
  useRef,
  useState,
  ReactElement,
  isValidElement,
} from 'react';
import { render } from 'react-dom';

import { Evaluation, ASTNode } from 'metaes/types';
import { getMetaFunction } from 'metaes/metafunction';

import dynamic from 'next/dynamic';
import {
  TextMarker,
  Editor,
  Position,
  LineWidget,
} from 'codemirror';

import {
  meta,
  StackFrame,
  WatchValues,
  interestingTypes,
} from 'helpers/meta';

import {
  formatArgs,
  formatValue,
} from 'helpers/formatValue';

const CodeEditor = dynamic(
  import('components/CodeEditor'),
  {
    ssr: false,
  },
);

const Tree = dynamic(import('react-d3-tree'), {
  ssr: false,
});

const filler = `This is just example text for now, but you can add custom content (like React components) to locations.  The content is dynamic and receives the current evaluation context.  Bam!`;

const handleError = (err: any) => {
  alert(JSON.stringify(err));
  console.error(err);
};

function astToCmLoc(e: ASTNode) {
  if (!e.loc) return;

  const start = {
    ch: e.loc.start.column,
    line: e.loc.start.line - 1,
  };

  const end = {
    ch: e.loc.end.column,
    line: e.loc.end.line - 1,
  };
  return { start, end };
}

type Widget = {
  node: ASTNode;
  attach: () => void;
  remove: () => void;
};

function createWidget(
  node: ASTNode,
  frame: StackFrame,
  cm: Editor,
  p: Position,
  el: ReactElement,
): Widget {
  const display = () => {
    const element = document.createElement('div');

    const pos = cm.charCoords(p, 'local');
    const top = pos.top;
    const right = pos.right;

    element.style.position = 'absolute';
    element.setAttribute('cm-ignore-events', 'true');
    element.style.top = top + 'px';
    element.style.left = right + 'px';

    return {
      node,
      attach: () => {
        render(el, element);
        // @ts-ignore
        cm.display.input.setUneditable(element);
        // @ts-ignore
        cm.display.sizer.appendChild(element);
      },
      remove: () => element.remove(),
    };
  };

  return display();
}

let code: string;

code = `// psst: you can edit me!
const X = (props) => (
  <h1 style={{ color: 'red', margin: 0 }}>Hello {props.name}!</h1>
);

const x = <X name="world" />;
const z = <div style={{ backgroundColor: 'pink', padding: 10 }}>{x}</div>;

let a;
a = z;
`;

code = `// psst: you can edit me!
function fibonacci(num) {
  if (num < 0) return null;
  if (num <= 1) return num;

  const f1 = fibonacci(num - 1);
  const f2 = fibonacci(num - 2);
  const result = f1 + f2;

  return result;
}

const r = fibonacci(2);
`;

// code = `
// function x(z) {
//   let a;
//   const array = [1, 2, 3];
//   for (let index = 0; index < array.length; index++) {
//     const element = array[index];
//     for (let index2 = 0; index2 < array.length; index2++) {
//       const element2 = array[index2];
//       a = element + element2;
//       console.log(a);
//     }
//   }
// }

// x();
// `;

const EditorValue = ({ value }: { value: string }) => (
  <div
    style={{
      marginLeft: 8,
      fontStyle: 'italic',
      borderRadius: '4px',
      color: 'pink',
    }}
  >
    {value}
  </div>
);

const GraphNode = ({
  nodeData,
}: {
  nodeData?: StackFrame;
}) => {
  return (
    <div>
      {nodeData ? (
        <strong>
          {nodeData?.fnName}
          {nodeData?.args
            ? `(${formatArgs(nodeData?.args)})`
            : ''}

          {/* {' => '}
        {nodeData?.hasReturned
          ? nodeData?.returnValue
          : '...'} */}
        </strong>
      ) : null}
    </div>
  );
};

const defaultSpeed = 800;
const maxSpeed = 2000;
const minSpeed = 60;

function useEditorState() {
  const editorRef = useRef<Editor>();

  const editorItemsRef = useRef<{
    marker?: TextMarker;
    editorWidgetsByFrame: Map<string, Map<string, Widget>>;
    commentLineWidget?: LineWidget;
    reactLineWidget?: LineWidget;
  }>({
    marker: undefined,
    editorWidgetsByFrame: new Map(),
  });

  const configEditor = (editor: Editor) => {
    editor.on('change', () => {
      clearEditor();
    });
    editorRef.current = editor;
  };

  const markEditor = (evaluation: Evaluation) => {
    editorItemsRef.current.marker?.clear();

    const editor = editorRef.current;
    const loc = astToCmLoc(evaluation.e);
    if (!loc || !editor) return;

    const { top } = editor.charCoords(loc.start, 'local');

    editorItemsRef.current.marker = editor.markText(
      loc.start,
      loc.end,
      {
        css: 'background-color: rgba(230, 10, 100, 0.5);',
      },
    );

    const editorScrollInfo = editor.getScrollInfo();

    if (
      editorScrollInfo.top > top ||
      top >
        editorScrollInfo.top + editorScrollInfo.clientHeight
    ) {
      editor.scrollTo(null, Math.max(top - 10, 0));
    }
  };

  const getFrameWidgets = (frame: StackFrame) => {
    let frameWidgets = editorItemsRef.current.editorWidgetsByFrame.get(
      frame.id,
    );

    if (!frameWidgets) {
      frameWidgets = new Map();
      editorItemsRef.current.editorWidgetsByFrame.set(
        frame.id,
        frameWidgets,
      );
    }

    return frameWidgets;
  };

  const displayReactElementValue = (
    node: ASTNode,
    reactElement: ReactElement,
  ) => {
    const loc = astToCmLoc(node);
    const editor = editorRef.current;
    if (!loc || !editor) return;

    const { line } = loc.end;

    const l = document.createElement('div');

    editorItemsRef.current.reactLineWidget?.clear();

    const lineWidget = editorRef.current?.addLineWidget(
      line,
      l,
      {
        coverGutter: true,
        insertAt: 0,
        // handleMouseEvents: true,
        // above: true,
      },
    );

    render(
      <div
        style={{
          padding: '18px 36px 18px 36px',
          backgroundColor: `#111`,
          fontSize: '13px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            padding: '18px 36px',
            backgroundColor: '#eee',
            color: '#111',
            borderRadius: '3px',
          }}
        >
          {reactElement}
        </div>
      </div>,
      l,
    );

    editorItemsRef.current.reactLineWidget = lineWidget;

    //

    const { top } = editor.charCoords(loc.start, 'local');

    const editorScrollInfo = editor.getScrollInfo();

    if (
      editorScrollInfo.top > top + 100 ||
      top + 100 >
        editorScrollInfo.top + editorScrollInfo.clientHeight
    ) {
      editor.scrollTo(null, Math.max(top - 10, 0));
    }

    return l;
  };

  const displayComments = (node: ASTNode) => {
    const loc = astToCmLoc(node);
    const editor = editorRef.current;
    if (!loc || !editor) return;

    const { line } = loc.start;

    const l = document.createElement('div');
    l.innerHTML = `<h2>${node.type}</h2><p><em>${filler}</em></p>`;
    // l.style.height = '100px';
    l.style.padding = '18px 36px';
    l.style.maxHeight = '300px';
    l.style.fontFamily = 'sans-serif';
    l.style.fontSize = '13px';
    l.style.background = `linear-gradient(#111, #222)`;
    l.style.color = '#eee';
    l.style.overflow = 'scroll';

    editorItemsRef.current.commentLineWidget?.clear();
    editorItemsRef.current.reactLineWidget?.clear();

    const lineWidget = editorRef.current?.addLineWidget(
      line,
      l,
      {
        coverGutter: true,
        // handleMouseEvents: true,
        // above: true,
      },
    );

    editorItemsRef.current.commentLineWidget = lineWidget;

    //

    const { top } = editor.charCoords(loc.start, 'local');

    const editorScrollInfo = editor.getScrollInfo();

    if (
      editorScrollInfo.top > top + 100 ||
      top + 100 >
        editorScrollInfo.top + editorScrollInfo.clientHeight
    ) {
      editor.scrollTo(null, Math.max(top - 10, 0));
    }
  };

  const displayValueInEditor = (
    node: ASTNode,
    frame: StackFrame,
    value: any,
  ) => {
    if (!editorRef.current) return;

    const loc = astToCmLoc(node);
    if (!loc) return;

    const key = (node.range ?? []).join();

    const { line } = loc.start;
    const ch =
      editorRef.current?.lineInfo(line)?.text?.length ?? 0;

    // @ts-ignore
    const el = createWidget(
      node,
      frame,
      editorRef.current,
      { line: line, ch: ch },
      <EditorValue value={value} />,
    );

    el.attach();

    const frameWidgets = getFrameWidgets(frame);
    frameWidgets.get(key)?.remove();
    frameWidgets.set(key, el);
  };

  const displayEvaluation = (
    evaluation: Evaluation,
    frame: StackFrame,
  ) => {
    const isInteresting = interestingTypes.includes(
      evaluation.e.type,
    );

    if (
      evaluation.phase === 'exit' &&
      evaluation.e.type === 'Program'
    ) {
      editorItemsRef.current.commentLineWidget?.clear();
      editorItemsRef.current.reactLineWidget?.clear();
      editorItemsRef.current.marker?.clear();
    }

    if (
      // @ts-ignore
      evaluation.phase === 'value' &&
      evaluation.e.type === 'AssignmentExpression'
    ) {
      if (
        // @ts-ignore
        // window.featureFlags?.displayReact &&
        isValidElement(evaluation.value)
      ) {
        displayReactElementValue(
          evaluation.e,
          evaluation.value,
        );
      }

      displayValueInEditor(
        evaluation.e,
        frame,
        `= ${formatValue(evaluation.value)}`,
      );
    }

    if (
      // @ts-ignore
      evaluation.phase === 'value' &&
      evaluation.e.type === 'VariableDeclaration'
    ) {
      if (
        // @ts-ignore
        // window.featureFlags?.displayReact &&
        isValidElement(evaluation.value?.[0])
      ) {
        displayReactElementValue(
          evaluation.e,
          evaluation.value[0],
        );
      }
      displayValueInEditor(
        evaluation.e,
        frame,
        `= ${formatValue(evaluation.value?.[0])}`,
      );
    }

    if (
      evaluation.phase === 'exit' &&
      evaluation.e.type === 'ReturnStatement'
    ) {
      displayValueInEditor(
        evaluation.e,
        frame,
        `⇐ ${formatValue(evaluation.value.value)}`,
      );
    }

    if (
      evaluation.phase === 'enter' &&
      evaluation.e.type === 'Program'
    ) {
      editorItemsRef.current.editorWidgetsByFrame.set(
        frame.id,
        new Map(),
      );
    }

    if (isInteresting && evaluation.phase === 'enter') {
      displayComments(evaluation.e);
    }

    if (isInteresting) {
      markEditor(evaluation);
    }
  };

  const displayApplyEnter = (
    evaluation: Evaluation,
    frame: StackFrame,
    prevFrame: StackFrame,
  ) => {
    editorItemsRef.current.commentLineWidget?.clear();
    const nodes = getFrameWidgets(prevFrame);
    nodes?.forEach((node) => node.remove());

    const metaFn = getMetaFunction(evaluation.e.fn)?.e;
    if (!metaFn) return;

    displayComments(metaFn);

    displayValueInEditor(
      metaFn,
      frame,
      `( ${evaluation.e.args.join(', ')} )`,
    );

    markEditor({ ...evaluation, e: metaFn });
  };

  const displayApplyExit = (
    evaluation: Evaluation,
    frame: StackFrame,
    prevFrame: StackFrame,
  ) => {
    editorItemsRef.current.commentLineWidget?.clear();
    const nodes = getFrameWidgets(frame);
    nodes?.forEach((node) => node.remove());
    editorItemsRef.current.editorWidgetsByFrame.set(
      frame.id,
      new Map(),
    );

    const metaFn = getMetaFunction(evaluation.e.fn)?.e;
    if (!metaFn) return;

    frame.hasReturned = true;
    frame.returnValue = evaluation.value;

    const prevNodes = getFrameWidgets(prevFrame);
    prevNodes?.forEach((node) => node.attach());
  };

  const clearCurrentMarker = () => {
    editorItemsRef.current.commentLineWidget?.clear();
    editorItemsRef.current.reactLineWidget?.clear();
    editorItemsRef.current.marker?.clear();
  };

  const clearEditor = () => {
    clearCurrentMarker();
    editorItemsRef.current.commentLineWidget?.clear();

    editorItemsRef.current.editorWidgetsByFrame.forEach(
      (l) => l.forEach((n) => n.remove()),
    );

    editorItemsRef.current.editorWidgetsByFrame = new Map();
  };

  const getCode = () =>
    editorRef.current?.getDoc().getValue();

  return {
    getCode,
    clearEditor,
    clearCurrentMarker,
    displayApplyEnter,
    displayApplyExit,
    displayEvaluation,
    configEditor,
  };
}

export default function Meta() {
  const [, forceUpdate] = useState({});
  const [stackState, setStackState] = useState<{
    currentEvaluation?: Evaluation;
    callsRootImmutableRef: StackFrame[];
    stack: StackFrame[];
    allNodes: StackFrame[];
    watchValues: WatchValues;
  }>({
    stack: [],
    callsRootImmutableRef: [],
    allNodes: [],
    watchValues: {},
  });

  const {
    getCode,
    clearEditor,
    clearCurrentMarker,
    displayApplyEnter,
    displayApplyExit,
    displayEvaluation,
    configEditor,
  } = useEditorState();

  // editor ui

  const clearState = () => {
    clearEditor();
    setStackState({
      watchValues: {},
      stack: [],
      allNodes: [],
      callsRootImmutableRef: [],
    });
  };

  const update = () =>
    setStackState({
      callsRootImmutableRef:
        metaRef.current.execState.callsRootImmutableRef,
      allNodes: metaRef.current.execState.allStackNodes,
      stack: [...metaRef.current.execState.callStack],
      watchValues: metaRef.current.execState.watchValues,
    });

  // event handlers

  const nextStep = () => {
    const state = metaRef.current.execState;
    if (!state.running) {
      const code = getCode();
      if (code) {
        clearState();
        metaRef.current.startExec(code);
      }
    } else {
      metaRef.current.progressExec();
    }
  };

  const handleStep = () => {
    nextStep();
    update();
  };

  const handleAutoStep = () => {
    metaRef.current.execState.autoStepping = true;
    nextStep();
    update();
  };

  const handleAutoStepPause = () => {
    metaRef.current.execState.autoStepping = false;
    update();
  };

  const handleRestart = () => {
    const autoStepping =
      metaRef.current.execState.autoStepping;
    metaRef.current.endExec();
    clearCurrentMarker();
    metaRef.current.execState.autoStepping = autoStepping;

    const code = getCode();
    if (code) {
      clearState();
      metaRef.current.startExec(code);
      update();
    }
  };

  const handleExit = () => {
    metaRef.current.endExec();
    clearCurrentMarker();

    update();
  };

  const metaRef = useRef(
    meta({
      speed: defaultSpeed,
      handleError,
      displayApplyEnter,
      displayApplyExit,
      displayEvaluation,
      update,
    }),
  );

  // view helpers

  function valueTable() {
    const indexerName = 'Input';
    const valueName = 'Fibonacci';

    const tableValues: number[] = [];
    for (const x of stackState.allNodes) {
      tableValues[x.args[0]] =
        tableValues[x.args[0]] ?? x.returnValue;
    }

    const filledArr = Array(tableValues.length).fill(null);

    return (
      <div key="table" className="space">
        <h2>Values</h2>
        <div
          style={{
            overflow: 'scroll',
            border: '1px lightgray solid',
            borderRadius: 4,
            padding: 12,
          }}
        >
          <table>
            <tbody>
              <tr>
                <th
                  scope="row"
                  align="left"
                  style={{ padding: 4 }}
                >
                  {indexerName}
                </th>
                {filledArr.map((n, i) => (
                  <td key={i} style={{ padding: 4 }}>
                    {i}
                  </td>
                ))}
              </tr>
              <tr>
                <th
                  scope="row"
                  align="left"
                  style={{ padding: 4 }}
                >
                  {valueName}
                </th>
                {filledArr.map((n, i) => (
                  <td key={i} style={{ padding: 4 }}>
                    {tableValues[i]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const callStackEl = (
    <div key="stack">
      <h2>The Stack</h2>
      <div
        style={{
          height: '300px',
          overflow: 'scroll',
          border: '1px lightgray solid',
          borderRadius: 4,
          padding: 12,
        }}
      >
        {[...stackState.stack]
          .reverse()
          .map(
            (
              {
                id,
                fnName,
                args,
                values,
                returnValue,
                hasReturned,
              },
              i,
            ) => {
              const {
                this: _1,
                arguments: _2,
                ...restValues
              } = values;
              return (
                <div
                  key={id}
                  className="space-small"
                  style={{
                    border: '1px lightgray solid',
                    borderRadius: 4,
                    padding: 12,
                  }}
                >
                  <h4 className="no-space">
                    [{stackState.stack.length - i}]{' '}
                    <em>
                      {fnName}({formatArgs(args)})
                    </em>
                  </h4>
                  <div style={{ marginLeft: 12 }}>
                    {Object.entries(restValues).map(
                      ([name, value]) => (
                        <div key={name}>
                          <small>
                            <strong>{name} = </strong>
                            <em>{formatValue(value)}</em>
                          </small>
                        </div>
                      ),
                    )}
                    {hasReturned && (
                      <div key="return">
                        <small>
                          <strong>{'<='} </strong>
                          <em>
                            {formatValue(returnValue)}
                          </em>
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              );
            },
          )}
      </div>
    </div>
  );

  const callGraphEl = (
    <div key="graph">
      <h2>The Call Graph</h2>
      <div
        style={{
          height: '300px',
          border: '1px lightgray solid',
          borderRadius: 4,
        }}
      >
        {stackState.callsRootImmutableRef.length ? (
          <Tree
            translate={{ x: 100, y: 100 }}
            zoom={0.5}
            orientation="vertical"
            transitionDuration={0}
            collapsible={false}
            data={stackState.callsRootImmutableRef}
            allowForeignObjects
            nodeLabelComponent={{
              foreignObjectWrapper: {
                y: 24,
              },
              render: <GraphNode />,
            }}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <div style={{ margin: '20px auto', maxWidth: 840 }}>
      <div key="editor" className="space">
        <div
          style={{ height: '30vh', minHeight: 400 }}
          className="space-small"
        >
          <CodeEditor
            key="code"
            editorDidMount={configEditor}
            value={code}
            options={{
              readOnly: metaRef.current.execState.running,
              lineNumbers: true,
            }}
          />
        </div>
        <div className="space-small">
          <button
            className="small"
            disabled={
              metaRef.current.execState.autoStepping
            }
            onClick={handleStep}
          >
            Step
          </button>
          {' | '}
          <button
            className="small"
            disabled={
              metaRef.current.execState.autoStepping
            }
            onClick={handleAutoStep}
          >
            Auto-step
          </button>{' '}
          <button
            className="small"
            disabled={
              !metaRef.current.execState.autoStepping
            }
            onClick={handleAutoStepPause}
          >
            Pause
          </button>
          {' | '}
          <button
            className="small"
            disabled={!metaRef.current.execState.running}
            onClick={handleRestart}
          >
            Restart
          </button>{' '}
          <button
            className="small"
            disabled={!metaRef.current.execState.running}
            onClick={handleExit}
          >
            Exit
          </button>
        </div>
        <div>
          <label>Playback speed</label>{' '}
          <input
            defaultValue={
              maxSpeed - metaRef.current.execState.speed
            }
            type="range"
            min="0"
            max="2000"
            onChange={(e) => {
              metaRef.current.setSpeed(
                maxSpeed +
                  minSpeed -
                  parseInt(e.target.value),
              );
            }}
          />
        </div>
      </div>
      {/* <div>{valueTable()}</div> */}
      <div
        key="data"
        className="space"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridGap: '20px',
        }}
      >
        {callStackEl}
        {callGraphEl}
      </div>
    </div>
  );
}

// @ts-ignore
Meta.layout = null;
