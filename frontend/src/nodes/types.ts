export interface ToolInfo {
  name: string;
  type: 'http' | 'builtin';
  description: string;
}

export interface StepNodeData {
  label: string;
  type: string;
  ref: string;
  isTrigger?: boolean;
  tools?: ToolInfo[];
}
