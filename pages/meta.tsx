import { useRef, useState } from 'react';
import { Evaluation } from 'metaes/types';
import dynamic from 'next/dynamic';

import {
  meta,
  StackFrame,
  WatchValues,
} from 'helpers/meta';

import {
  formatArgs,
  formatValue,
} from 'helpers/formatValue';

import { useEditorState } from 'helpers/useEditorState';

import code from '!!raw-loader!samples/fibonacci';

const CodeEditor = dynamic(
  import('components/CodeEditor'),
  {
    ssr: false,
  },
);

const Tree = dynamic(import('react-d3-tree'), {
  ssr: false,
});

const handleError = (err: any) => {
  alert(JSON.stringify(err));
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

export default function Meta() {
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

  const buttons = (
    <div className="space-small">
      <button
        className="small"
        disabled={metaRef.current.execState.autoStepping}
        onClick={handleStep}
      >
        Step
      </button>
      {' | '}
      <button
        className="small"
        disabled={metaRef.current.execState.autoStepping}
        onClick={handleAutoStep}
      >
        Auto-step
      </button>{' '}
      <button
        className="small"
        disabled={!metaRef.current.execState.autoStepping}
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
  );

  const playback = (
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

  const editor = (
    <CodeEditor
      key="code"
      editorDidMount={configEditor}
      value={code}
      options={{
        readOnly: metaRef.current.execState.running,
        lineNumbers: true,
      }}
    />
  );

  return (
    <div style={{ margin: '20px auto', maxWidth: 840 }}>
      <div key="editor" className="space">
        <div
          style={{ height: '30vh', minHeight: 400 }}
          className="space-small"
        >
          {editor}
        </div>
        {buttons}
        {playback}
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
