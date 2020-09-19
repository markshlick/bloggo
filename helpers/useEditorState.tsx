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
import { StackFrame, interestingTypes } from 'helpers/meta';
import { formatValue } from 'helpers/formatValue';

export type Widget = {
  node: ASTNode;
  attach: () => void;
  remove: () => void;
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

export const EditorValue = ({
  value,
}: {
  value: string;
}) => (
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

  const resetFrameWidgets = (frame: StackFrame) => {
    const nodes = getFrameWidgets(frame);
    nodes?.forEach((node) => node.remove());

    editorItemsRef.current.editorWidgetsByFrame.set(
      frame.id,
      { widgets: new Map(), frame },
    );
  };

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
      resetFrameWidgets(frame);
    }

    if (isInteresting && evaluation.phase === 'enter') {
      displayComments(evaluation.e);
    }

    if (isInteresting) {
      markEditor(evaluation);
    }
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

  const displayApplyEnter = (
    evaluation: Evaluation,
    currFrame: StackFrame,
    prevFrame: StackFrame,
  ) => {
    editorItemsRef.current.commentLineWidget?.clear();
    // const nodes = getFrameWidgets(prevFrame);
    // nodes?.forEach((node) => node.remove());
    clearPreviousCallsForFrameFn(currFrame);

    const metaFn = getMetaFunction(evaluation.e.fn)?.e;
    if (!metaFn) return;

    displayComments(metaFn);

    displayValueInEditor(
      metaFn,
      currFrame,
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
    clearPreviousCallsForFrameFn(prevFrame);

    const metaFn = getMetaFunction(evaluation.e.fn)?.e;
    if (!metaFn) return;

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
    displayApplyEnter,
    displayApplyExit,
    displayEvaluation,
    configEditor,
  };
}
