import { ECMAScriptInterpreters } from 'metaes/interpreters';
import { Evaluation, ASTNode } from 'metaes/types';

export type NodeNames =
  | keyof typeof ECMAScriptInterpreters.values
  | 'AwaitExpression';

export type Timeout = (
  fn: () => void,
  ms: number,
) => number;

export const blockScopeTypes = [
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
] as const;

export const prettyBlockScopeTypeNames: {
  [name in typeof blockScopeTypes[number]]: string;
} = {
  IfStatement: 'if { }',
  ForStatement: 'for { }',
  ForInStatement: 'for { in }',
  ForOfStatement: 'for { of }',
  WhileStatement: 'while { }',
};

type AsyncRuntime = {
  enqueueCallback: (...args: any[]) => void;
  registerPromise: (...args: any[]) => void;
  handleAwait: (...args: any[]) => void;
  handleTick: () => boolean;
  reset: () => void;
  actions: {
    setTimeout: any;
    clearTimeout: any;
  };
};

export type ExecState = {
  // awaitCount: number;
  asyncRuntime: AsyncRuntime;
  callStack: StackFrame[];
  autoStepping: boolean;
  running: boolean;
  speed: number;
  nextTimer?: number;
  next?: () => any;
  allStackNodes: StackFrame[];
  callsRootImmutableRef: StackFrame[];
  programEnvKeys: string[];
};

export type BlockFrame = {
  id: string;
  type: typeof blockScopeTypes;
  sourceId?: string;
  allBlocks: BlockFrame[];
  calls: StackFrame[];
  children: (BlockFrame | StackFrame)[];
};

export type StackFrame = {
  children: (BlockFrame | StackFrame)[];
  id: string;
  name: string;
  fnName: string;
  args: any[];
  values: {
    [key: string]: any;
  };
  returnValue: any;
  calls: StackFrame[];
  origins: Record<string, ASTNode>;
  hasReturned: boolean;
  sourceId: string;
  blockStack: BlockFrame[];
  allBlocks: BlockFrame[];
};

export type WatchValues = Record<
  string,
  { frame: StackFrame; value: any }[]
>;

export type Origin = {
  node: ASTNode;
  frame: StackFrame;
};

export type EvaluationContext = {
  origin?: Origin;
  previousFrame?: StackFrame;
};

export type Engine = {
  speed: number;
  handleError: (err: any) => void;
  onEvaluation: (
    evaluation: Evaluation,
    frame: StackFrame,
    context: EvaluationContext,
  ) => void;
  onPending: () => void;
  update: () => void;
};
