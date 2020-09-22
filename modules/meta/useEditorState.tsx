import {
  useRef,
  ReactElement,
  isValidElement,
} from 'react';
import { render } from 'react-dom';
import { Evaluation, ASTNode } from 'metaes/types';
import { getMetaFunction } from 'metaes/metafunction';
import {
  TextMarker,
  Editor,
  LineWidget,
  Position,
} from 'codemirror';
import {
  StackFrame,
  EvaluationContext,
  ErrorSymbol,
} from 'modules/meta/engine';
import { formatValue } from 'helpers/formatValue';

export type Widget = {
  node: ASTNode;
  attach: () => void;
  remove: () => void;
  change: () => void;
};

export const filler = `This is just example text for now, but you can add custom content (like React components) to locations.  The content is dynamic and receives the current evaluation context.  Bam!`;

export function astToCmLoc(e: ASTNode) {
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

export function createWidget(
  node: ASTNode,
  frame: StackFrame,
  cm: Editor,
  p: Position,
  el: ReactElement,
): Widget {
  const display = () => {
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.setAttribute('cm-ignore-events', 'true');

    const attach = () => {
      render(el, element);
      // @ts-ignore
      cm.display.input.setUneditable(element);
      // @ts-ignore
      cm.display.sizer.appendChild(element);

      change();
    };

    const remove = () => element.remove();

    const change = () => {
      const pos = cm.charCoords(p, 'local');
      const top = pos.top;
      const right = pos.right;

      element.style.top = top + 'px';
      element.style.left = right + 'px';
    };

    return {
      node,
      attach,
      remove,
      change,
    };
  };

  return display();
}

const Comment = ({ node }: { node: ASTNode }) => (
  <div
    style={{
      padding: '18px 36px',
      maxHeight: '300px',
      fontFamily: 'sans-serif',
      fontSize: '13px',
      background: `linear-gradient(#111, #222)`,
      color: '#eee',
      overflow: 'scroll',
    }}
  >
    <h2>{node.type}</h2>
    <p>
      <em>{filler}</em>
    </p>
    {/* <pre style={{ overflow: 'scroll' }}>
      {JSON.stringify(node, null, '\t')}
    </pre> */}
  </div>
);

export const EditorValue = ({
  value,
  glow,
}: {
  value: string;
  glow: boolean;
}) => (
  <div
    style={{
      // marginLeft: 4,
      fontStyle: 'italic',
      borderRadius: '4px',
      color: 'pink',
      padding: '0px 6px',
      animation: glow ? 'glow 1000ms ease-out' : '',
    }}
  >
    {value}
  </div>
);

export function useEditorState() {
  const editorRef = useRef<Editor>();

  const editorItemsRef = useRef<{
    marker?: TextMarker;
    editorWidgetsByFrame: Map<
      string,
      { widgets: Map<string, Widget>; frame: StackFrame }
    >;
    commentLineWidget?: LineWidget;
    reactLineWidget?: LineWidget;
  }>({
    marker: undefined,
    editorWidgetsByFrame: new Map(),
  });

  const configEditor = (editor: Editor) => {
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
    let frameVal = editorItemsRef.current.editorWidgetsByFrame.get(
      frame.id,
    );

    if (!frameVal) {
      frameVal = { widgets: new Map(), frame };
      editorItemsRef.current.editorWidgetsByFrame.set(
        frame.id,
        frameVal,
      );
    }

    return frameVal.widgets;
  };

  // const resetFrameWidgets = (frame: StackFrame) => {
  //   const nodes = getFrameWidgets(frame);
  //   nodes?.forEach((node) => node.remove());

  //   editorItemsRef.current.editorWidgetsByFrame.set(
  //     frame.id,
  //     { widgets: new Map(), frame },
  //   );
  // };

  const displayReactElementValue = (
    node: ASTNode,
    reactElement: ReactElement,
  ) => {
    const loc = astToCmLoc(node);
    const editor = editorRef.current;
    if (!loc || !editor) return;

    const { line } = loc.start;

    const l = document.createElement('div');

    editorItemsRef.current.reactLineWidget?.clear();

    const lineWidget = editorRef.current?.addLineWidget(
      line,
      l,
      {
        coverGutter: true,
        insertAt: 0,
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
    render(<Comment node={node} />, l);

    editorItemsRef.current.commentLineWidget?.clear();
    editorItemsRef.current.reactLineWidget?.clear();

    const lineWidget = editorRef.current?.addLineWidget(
      line,
      l,
      {
        coverGutter: true,
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

  const displayInlineValue = (
    node: ASTNode,
    frame: StackFrame,
    value: string,
  ) => {
    const loc = astToCmLoc(node);
    if (!loc || !editorRef.current) return;

    const frameWidgets = getFrameWidgets(frame);
    const key = (node.range ?? []).join();
    const { line } = loc.start;
    const ch =
      editorRef.current?.lineInfo(line)?.text?.length ?? 0;

    const el = createWidget(
      node,
      frame,
      editorRef.current,
      { line: line, ch: ch },
      <EditorValue
        glow={frameWidgets.has(key)}
        value={value}
      />,
    );

    frameWidgets.get(key)?.remove();

    el.attach();
    frameWidgets.set(key, el);
  };

  const displayEvaluation = (
    evaluation: Evaluation,
    frame: StackFrame,
    context: EvaluationContext,
  ) => {
    console.log(
      evaluation.e.type,
      evaluation,
      frame,
      context,
    );

    if (evaluation.e.loc) {
      markEditor(evaluation);
    }

    if (
      evaluation.phase !== 'exit' &&
      evaluation.e.type !== 'ExpressionStatement'
    ) {
      displayComments(evaluation.e);
    }

    if (
      evaluation.e.type === 'Program' &&
      evaluation.phase === 'exit'
    ) {
      editorItemsRef.current.commentLineWidget?.clear();
      editorItemsRef.current.reactLineWidget?.clear();
      editorItemsRef.current.marker?.clear();
    } else if (
      evaluation.e.type === 'AssignmentExpression' &&
      // @ts-ignore
      evaluation.phase === 'value'
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

      displayInlineValue(
        evaluation.e,
        frame,
        `= ${formatValue(evaluation.value)}`,
      );

      if (context.origin) {
        displayInlineValue(
          context.origin.node,
          context.origin.frame,
          `= ${formatValue(evaluation.value)}`,
        );
      }
    } else if (
      evaluation.e.type === 'VariableDeclarator' &&
      // @ts-ignore
      evaluation.phase === 'value'
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
      displayInlineValue(
        evaluation.e,
        frame,
        `= ${formatValue(evaluation.value)}`,
      );
    } else if (
      evaluation.e.type === 'ReturnStatement' &&
      // @ts-ignore
      evaluation.phase === 'value' &&
      !evaluation.value?.[ErrorSymbol]
    ) {
      displayInlineValue(
        evaluation.e,
        frame,
        `⇐ ${formatValue(evaluation.value?.value)}`,
      );
    } else if (
      evaluation.e.type === 'ExpressionStatement' &&
      evaluation.value?.type !== 'ThrowStatement' &&
      !evaluation.value?.[ErrorSymbol] &&
      evaluation.value?.value
    ) {
      displayInlineValue(
        evaluation.e,
        frame,
        `= ${formatValue(evaluation.value?.value)}`,
      );
    } else if (
      evaluation.e.type === 'Apply' &&
      evaluation.phase === 'exit'
    ) {
      editorItemsRef.current.commentLineWidget?.clear();

      const metaFn = getMetaFunction(evaluation.e.fn)?.e;
      if (metaFn) {
        const prevNodes = getFrameWidgets(frame);
        prevNodes?.forEach((node) => node.attach());
      }
    } else if (
      evaluation.e.type === 'Apply' &&
      // @ts-ignore
      evaluation.phase === 'exit-before'
    ) {
      if (
        context.previousFrame?.sourceId === frame.sourceId
      ) {
        clearPreviousCallsForFrameFn(frame);
      }
    } else if (
      evaluation.e.type === 'Apply' &&
      // @ts-ignore
      evaluation.phase === 'enter-after'
    ) {
      editorItemsRef.current.commentLineWidget?.clear();
      // const nodes = getFrameWidgets(prevFrame);
      // nodes?.forEach((node) => node.remove());
      clearPreviousCallsForFrameFn(frame);

      const metaFn = getMetaFunction(evaluation.e.fn)?.e;
      if (metaFn) {
        displayComments(metaFn);

        displayInlineValue(
          metaFn,
          frame,
          `(${evaluation.e.args.join(', ')})`,
        );

        if (metaFn.id) {
          markEditor({ ...evaluation, e: metaFn.id });
        }
      }
    }

    editorItemsRef.current.editorWidgetsByFrame.forEach(
      ({ widgets }) => widgets.forEach((w) => w.change()),
    );
  };

  const clearPreviousCallsForFrameFn = (
    currFrame: StackFrame,
  ) => {
    const prevDisplayedCalls = Array.from(
      editorItemsRef.current.editorWidgetsByFrame.values(),
    );

    prevDisplayedCalls
      .filter(
        ({ frame }) =>
          frame.sourceId === currFrame.sourceId,
      )
      .forEach(({ frame }) => {
        const nodes = getFrameWidgets(frame);
        nodes?.forEach((node) => node.remove());
      });
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
      (l) => l.widgets.forEach((n) => n.remove()),
    );

    editorItemsRef.current.editorWidgetsByFrame = new Map();
  };

  const getCode = () =>
    editorRef.current?.getDoc().getValue();

  return {
    getCode,
    clearEditor,
    clearCurrentMarker,
    displayEvaluation,
    configEditor,
  };
}
