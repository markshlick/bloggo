import { ExecState } from './types';

export const getEditorValues = (execState: ExecState) => {
  const frames = execState.stackFrames.flatMap((call) =>
    [call.frame, ...call.blockStack].map((frame) => ({
      callFrame: call,
      frame,
      frameMeta: execState.flow.frameMeta.get(frame.id),
    })),
  );

  const items = frames.flatMap(
    ({ callFrame, frame, frameMeta }) => {
      const base = {
        callFrame,
        frameMeta,
        frame,
      };

      return [
        ...Object.entries(frameMeta?.origins ?? []).map(
          ([sourceId, node]) => ({
            ...base,
            kind: 'declaration',
            sourceId,
            node,
          }),
        ),
        ...Object.entries(frameMeta?.assignments ?? []).map(
          ([sourceId, entries]) => ({
            ...base,
            kind: 'assignment',
            sourceId,
            entries,
          }),
        ),
        ...(frameMeta?.hasReturned
          ? [
              {
                ...base,
                kind: 'return',
                value: frameMeta.returnValue,
                node: frameMeta.node,
                line: frameMeta.node.loc?.start.line,
              },
            ]
          : []),
        ...(frameMeta?.args
          ? [
              {
                ...base,
                kind: 'arguments',
                value: frameMeta.args,
                node: frameMeta.node,
                line: frameMeta.node.e.loc?.start.line,
              },
            ]
          : []),
      ];
    },
  );

  return { frames, items };
};
