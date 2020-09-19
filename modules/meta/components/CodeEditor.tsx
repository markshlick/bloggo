import React from 'react';
import {
  UnControlled as CodeMirror,
  IUnControlledCodeMirror,
} from 'react-codemirror2';
import { EditorConfiguration } from 'codemirror';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material-palenight.css';

export default ({
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
      theme: 'material-palenight',
      mode: 'javascript',
    }}
  />
);
