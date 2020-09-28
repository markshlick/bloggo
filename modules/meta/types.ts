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

export type FrameMeta = {
  calls: string[];
  blocks: string[];
  origins: Map<string, ASTNode>;
  hasReturned: boolean;
  returnValue: any;
  args: any[] | undefined;
};

export type ExecState = {
  // awaitCount: number;
  asyncRuntime: AsyncRuntime;
  autoStepping: boolean;
  running: boolean;
  speed: number;
  nextTimer?: number;
  next?: () => any;
  allStackNodes: StackFrame[];
  programEnvKeys: string[];
  flow: {
    allFrames: Map<string, StackFrame>;
    allBlocks: Map<string, BlockFrame>;
    frameMeta: Map<string, FrameMeta>;
  };
  stackFrames: {
    frame: StackFrame;
    blockStack: BlockFrame[];
  }[];
};

export type BlockFrame = {
  id: string;
  type: typeof blockScopeTypes;
  sourceId?: string;
  node: ASTNode;
};

export type StackFrame = {
  children: (BlockFrame | StackFrame)[];
  id: string;
  name: string;
  fnName: string;
  sourceId: string;
  node: ASTNode;
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
