import {
  PropsWithChildren,
  useEffect,
  useRef,
  useState,
  Fragment,
} from 'react';
import dynamic from 'next/dynamic';
import { Editor } from 'codemirror';
import Mousetrap from 'mousetrap';

import { meta } from 'modules/meta/engine';
import { ExecState, StackFrame } from 'modules/meta/types';
import { useEditorState } from 'modules/meta/useEditorState';
import formatNodeName from 'modules/meta/formatNodeName';

import code from '!!raw-loader!samples/fibonacci';

const Tree = dynamic(import('react-d3-tree'), {
  ssr: false,
});

const CodeEditor = dynamic(
  import('modules/meta/components/CodeEditor'),
  {
    ssr: false,
  },
);

const defaultSpeed = 300;
const maxSpeed = 2000;
const minSpeed = 60;

const handleError = (err: unknown) => {
  console.error(err);
};

const GraphNode = ({
  nodeData,
}: {
  nodeData?: StackFrame;
}) => {
  return <div />;
};

const AsyncTask = ({
  children,
  backgroundColor,
}: PropsWithChildren<{
  backgroundColor: string;
}>) => (
  <div
    style={{
      height: '100%',
      boxSizing: 'border-box',
      padding: 8,
      // width: 56,
      border: '1px lightgray solid',
      marginRight: 12,
      fontSize: 10,
      backgroundColor,
    }}
  >
    <h4 className="no-space">{children}</h4>
  </div>
);

const withKeyCapture = (fn: Function) => {
  return (e: Event) => {
    if (e.preventDefault) {
      e.preventDefault();
    } else {
      // internet explorer
      e.returnValue = false;
    }
    fn();
  };
};

type GraphNodeItem = {
  id: string;
  name: string;
  children: GraphNodeItem[];
};

function buildCallGraph(
  rootId: string,
  flow: ExecState['flow'],
) {
  const makeNode = (id: string): GraphNodeItem => {
    const r = flow.frameMeta.get(id)!;
    return {
      id,
      name: formatNodeName(r.node),
      children: r.calls.map((id) => makeNode(id)),
    };
  };

  return [makeNode(rootId)];
}

export default function Meta() {
  const [_, forceUpdate] = useState({});
  const update = () => {
    forceUpdate({});
  };

  useEffect(() => {
    Mousetrap.bind('mod+j', withKeyCapture(handleStep));
    Mousetrap.bind('mod+k', withKeyCapture(handleAutoStep));
    Mousetrap.bind(
      'mod+l',
      withKeyCapture(handleAutoStepPause),
    );
    Mousetrap.bind('mod+u', withKeyCapture(handleExit));
    Mousetrap.bind('mod+i', withKeyCapture(handleRestart));
    return () => {
      'jlkui'
        .split('')
        .forEach((c) => Mousetrap.unbind('mod+' + c));
    };
  }, []);

  // editor ui

  const clearState = () => {
    clearCurrentMarker();
    clearEditor();
  };

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
    if (isStepDisabled()) return;
    nextStep();
    update();
  };

  const handleAutoStep = () => {
    if (isStepDisabled()) return;
    metaRef.current.execState.autoStepping = true;
    nextStep();
    update();
  };

  const handleAutoStepPause = () => {
    if (isPauseDisabled()) return;
    metaRef.current.execState.autoStepping = false;
    update();
  };

  const handleRestart = () => {
    if (isExitDisabled()) return;
    const autoStepping =
      metaRef.current.execState.autoStepping;
    metaRef.current.endExec();
    metaRef.current.execState.autoStepping = autoStepping;
    clearState();

    const code = getCode();
    if (code) {
      metaRef.current.startExec(code);
      update();
    }
  };

  const handleExit = () => {
    if (isExitDisabled()) return;
    metaRef.current.endExec();
    clearCurrentMarker();
    clearState();

    update();
  };

  const handleEditorDidMount = (editor: Editor) => {
    configEditor(editor);
    editor.on('change', () => {
      handleExit();
    });
  };

  const {
    getCode,
    clearEditor,
    clearCurrentMarker,
    onEvaluation,
    onPending,
    configEditor,
  } = useEditorState();

  const metaRef = useRef(
    meta({
      speed: defaultSpeed,
      onEvaluation,
      handleError,
      onPending,
      update,
    }),
  );

  const {
    stackFrames,
    asyncRuntime,
  } = metaRef.current.execState;

  // view helpers

  const editorEl = (
    <CodeEditor
      key="code"
      editorDidMount={handleEditorDidMount}
      value={
        `// 👋🏽 psst! you can edit and run this code!\n\n` +
        code
      }
      options={{
        // readOnly: metaRef.current.execState.running,
        lineNumbers: true,
      }}
    />
  );

  const isStepDisabled = () => {
    return (
      metaRef.current.execState.autoStepping ||
      (metaRef.current.execState.running &&
        !metaRef.current.execState.next)
    );
  };

  const isPauseDisabled = () => {
    return !metaRef.current.execState.autoStepping;
  };

  const isExitDisabled = () => {
    return !metaRef.current.execState.running;
  };

  const buttonsEl = (
    <div className="space-small">
      <button
        className="smaller"
        disabled={isStepDisabled()}
        onClick={handleStep}
      >
        Step (&#8984;J)
      </button>
      {' | '}
      <button
        className="smaller"
        disabled={isStepDisabled()}
        onClick={handleAutoStep}
      >
        Auto-step (&#8984;K)
      </button>{' '}
      <button
        className="smaller"
        disabled={isPauseDisabled()}
        onClick={handleAutoStepPause}
      >
        Pause (&#8984;L)
      </button>
      {' | '}
      <button
        className="smaller"
        disabled={isExitDisabled()}
        onClick={handleExit}
      >
        Exit (&#8984;U)
      </button>{' '}
      <button
        className="smaller"
        disabled={isExitDisabled()}
        onClick={handleRestart}
      >
        Restart (&#8984;I)
      </button>
    </div>
  );

  const playbackEl = (
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
            maxSpeed + minSpeed - parseInt(e.target.value),
          );
        }}
      />
    </div>
  );

  const asyncItems = [
    // @ts-ignore
    ...asyncRuntime.state.microtaskQueue.map(
      // @ts-ignore
      ({ name, id }) => (
        <AsyncTask key={id} backgroundColor="lightgreen">
          {name}
        </AsyncTask>
      ),
    ),
    // @ts-ignore
    ...asyncRuntime.state.callbackQueue.map(
      // @ts-ignore
      ({ name, id }) => (
        <AsyncTask key={id} backgroundColor="lightgreen">
          {name}
        </AsyncTask>
      ),
    ),
    // @ts-ignore
    ...asyncRuntime.state.inFlightPromises.map(
      // @ts-ignore
      ({ name, id }) => (
        <AsyncTask key={id} backgroundColor="lightgray">
          {name}
        </AsyncTask>
      ),
    ),
    // @ts-ignore
    ...asyncRuntime.state.programTimers.map(
      // @ts-ignore
      ({ name, id }) => (
        <AsyncTask key={id} backgroundColor="lightgray">
          {name}
        </AsyncTask>
      ),
    ),
  ];

  const callbackQueueEl = (
    <div key="stack" className="space">
      <h3>The Event Loop</h3>
      <div
        style={{
          height: '60px',
          overflow: 'scroll',
          border: '1px lightgray solid',
          borderRadius: 4,
          padding: 12,
          display: 'flex',
        }}
      >
        {asyncItems}
      </div>
    </div>
  );

  const stackFramesEl = (
    <div key="stack">
      <h3>The Stack</h3>
      <div
        style={{
          height: '300px',
          overflow: 'scroll',
          border: '1px lightgray solid',
          borderRadius: 4,
          padding: 12,
        }}
      >
        {[...stackFrames]
          .reverse()
          .map(({ frame, blockStack }, i) => {
            const { id, node: callNode } = frame;

            return (
              <Fragment key={`group-${id}`}>
                {[...blockStack].reverse().map((block) => {
                  const { id, node: blockNode } = block;
                  return (
                    <div
                      key={id}
                      className="space-small"
                      style={{
                        border: '1px lightgray solid',
                        backgroundColor: 'lightcyan',
                        borderRadius: 4,
                        padding: '8px 12px',
                      }}
                    >
                      <h5 className="no-space">
                        [{stackFrames.length - i}]{' '}
                        <em>{formatNodeName(blockNode)}</em>
                      </h5>
                    </div>
                  );
                })}
                <div
                  key={id}
                  className="space-small"
                  style={{
                    border: '1px lightgray solid',
                    backgroundColor: 'lightsteelblue',
                    borderRadius: 4,
                    padding: 12,
                  }}
                >
                  <h4 className="no-space">
                    [{stackFrames.length - i}]{' '}
                    <em>{formatNodeName(callNode)}()</em>
                  </h4>
                </div>
              </Fragment>
            );
          })}
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
        {metaRef.current.execState.running ? (
          <Tree
            translate={{ x: 100, y: 100 }}
            zoom={0.5}
            orientation="vertical"
            transitionDuration={0}
            collapsible={false}
            data={buildCallGraph(
              '-1',
              metaRef.current.execState.flow,
            )}
            allowForeignObjects
            // nodeLabelComponent={{
            //   foreignObjectWrapper: {
            //     y: -14,
            //     x: 15,
            //   },
            //   render: <GraphNode />,
            // }}
          />
        ) : null}
      </div>
    </div>
  );

  const runningState = () => {
    const { execState } = metaRef.current;
    const {
      microtaskQueue,
      callbackQueue,
      inFlightPromises,
      programTimers,
      // @ts-ignore
    } = asyncRuntime.state;

    const hasPending =
      !!microtaskQueue.length ||
      !!callbackQueue.length ||
      !!inFlightPromises.length ||
      !!programTimers.length;

    if (!execState.running) {
      return 'Not running';
    } else if (execState.autoStepping) {
      return 'Auto-stepping';
    } else if (!execState.next && hasPending) {
      return 'Pending';
    } else {
      return 'Running';
    }
  };

  return (
    <div style={{ margin: '20px auto', maxWidth: 840 }}>
      <title>
        HyperScript :: Learnable CS with JavaScript
      </title>
      <div key="main" className="space">
        <div className="space">
          <div
            key="editor"
            style={{ height: '30vh', minHeight: 400 }}
          >
            {editorEl}
          </div>
          <div key="state">
            <small>
              <strong>Program state:</strong>{' '}
              <em>{runningState()}</em>
            </small>
          </div>
        </div>
        {buttonsEl}
        {playbackEl}
      </div>
      <div>{callbackQueueEl}</div>
      <div
        key="data"
        className="space"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridGap: '20px',
        }}
      >
        {stackFramesEl}
        {callGraphEl}
      </div>
    </div>
  );
}

// @ts-ignore
Meta.layout = null;
