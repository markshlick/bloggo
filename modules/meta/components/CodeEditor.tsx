import React from 'react';
import {
  UnControlled as CodeMirror,
  IUnControlledCodeMirror,
} from 'react-codemirror2';
import { EditorConfiguration, Pass } from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material-palenight.css';
import 'codemirror/mode/jsx/jsx';
import 'codemirror/addon/comment/comment';
// import 'codemirror/addon/hint/show-hint';
// import 'codemirror/addon/hint/show-hint.css';
// import 'codemirror/addon/hint/javascript-hint';

const CodeEditor = ({
  editorDidMount,
  value,
  options,
}: {
  value?: string;
  editorDidMount: IUnControlledCodeMirror['editorDidMount'];
  options: EditorConfiguration;
}) => (
  <CodeMirror
    className="code-editor"
    value={value}
    editorDidMount={editorDidMount}
    options={{
      ...options,
      extraKeys: {
        // 'Ctrl-Space': 'autocomplete',
        'Cmd-/': 'toggleComment',
      },
      theme: 'material-palenight',
      mode: 'jsx',
    }}
  />
);

export default CodeEditor;
