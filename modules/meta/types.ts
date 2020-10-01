import { ECMAScriptInterpreters } from 'metaes/interpreters';
import {
  Evaluation,
  ASTNode,
  Environment,
} from 'metaes/types';

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
  'TryStatement',
  'CatchClause',
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
  node: ASTNode;
  env: Environment | undefined;
  calls: string[];
  blocks: string[];
  origins: Record<string, { node: ASTNode; value: any }>;
  allOrigins: Record<string, { node: ASTNode; value: any }>;
  assignments: Record<
    string,
    { node: ASTNode; value: any }[]
  >;
  hasReturned: boolean;
  returnValue: any;
  args: any[] | undefined;
  parentCallId: string;
  parentBlockId: string | undefined;
};

export type ExecState = {
  // awaitCount: number;
  asyncRuntime: AsyncRuntime;
  autoStepping: boolean;
  running: boolean;
  speed: number;
  nextTimer?: number;
  next?: () => any;
  programEnvKeys: string[];
  flow: {
    allFrames: Map<string, StackFrame>;
    allBlocks: Map<string, StackFrame>;
    frameMeta: Map<string, FrameMeta>;
    envFrames: Map<Environment, string>;
  };
  stackFrames: {
    frame: StackFrame;
    blockStack: StackFrame[];
  }[];
};

export type StackFrame = {
  id: string;
  sourceId: string;
  node: ASTNode;
  parentCallId: string;
  parentBlockId: string | undefined;
};

export type WatchValues = Record<
  string,
  { frame: StackFrame; value: any }[]
>;

export type Origin = {
  node: ASTNode;
  frame: StackFrame;
  block: StackFrame | undefined;
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
    blockFrame: StackFrame,
    context: EvaluationContext,
  ) => void;
  onPending: () => void;
  update: () => void;
};
