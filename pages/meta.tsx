import {
  PropsWithChildren,
  useEffect,
  useRef,
  useState,
} from 'react';
import dynamic from 'next/dynamic';
import { Editor } from 'codemirror';
import Mousetrap from 'mousetrap';

import { meta } from 'modules/meta/engine';
import { StackFrame } from 'modules/meta/types';
import { useEditorState } from 'modules/meta/useEditorState';

import code from '!!raw-loader!samples/async-loop';

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
  return (
    <div>
      {nodeData ? (
        <strong>{nodeData?.fnName}</strong>
      ) : null}
    </div>
  );
};

const AsyncTask = ({
  children,
  backgroundColor,
}: PropsWithChildren<{
  backgroundColor: string;
}>) => (
  <div
    style={{
      height: 56,
      boxSizing: 'border-box',
      padding: 8,
      // width: 56,
      border: '1px lightgray solid',
      marginRight: 12,
      fontSize: 10,
      backgroundColor,
    }}
  >
    <h4>{children}</h4>
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

export default function Meta() {
  const [_, forceUpdate] = useState({});
  const update = () => forceUpdate({});

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
      value={code}
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
      <h2>The Event Loop</h2>
      <div
        style={{
          height: '80px',
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
        {[...stackFrames]
          .reverse()
          .map(({ frame, blockStack }, i) => {
            const { id, fnName } = frame;

            return (
              <>
                {[...blockStack].reverse().map((block) => {
                  const {
                    id,
                    // @ts-ignore
                    fnName,
                  } = block;
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
                        <em>{fnName}</em>
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
                    <em>{fnName}()</em>
                  </h4>
                </div>
              </>
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
        {true ? (
          <Tree
            translate={{ x: 100, y: 100 }}
            zoom={0.5}
            orientation="vertical"
            transitionDuration={0}
            collapsible={false}
            data={[
              {
                name: '1',
                // @ts-ignore
                fnName: 'hi',
                get children() {
                  return [
                    {
                      name: '2',
                      fnName: 'hi',
                      children: [],
                    },
                  ];
                },
              },
            ]}
            allowForeignObjects
            nodeLabelComponent={{
              foreignObjectWrapper: {
                y: -14,
                x: 15,
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
      <title>
        HyperScript :: Learnable CS with JavaScript
      </title>
      <div key="editor" className="space">
        <div
          style={{ height: '30vh', minHeight: 400 }}
          className="space-small"
        >
          {editorEl}
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
        {/* {callGraphEl} */}
      </div>
    </div>
  );
}

// @ts-ignore
Meta.layout = null;
