export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  default_branch: string;
  private: boolean;
  description: string | null;
  updated_at: string;
}

export interface Branch {
  name: string;
  commitSha: string;
  isDefault: boolean;
}

export interface RepoTreeItem {
  path: string;
  type: 'file' | 'dir';
  size?: number;
  sha: string;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
  sha: string;
  size: number;
}

export interface FileChange {
  path: string;
  action: 'create' | 'modify' | 'delete';
  originalContent?: string;
  newContent: string;
  description?: string;
}

export interface CommitRequest {
  owner: string;
  repo: string;
  branch: string;
  newBranch?: string;
  createPr?: boolean;
  prTitle?: string;
  prBody?: string;
  message: string;
  changes: FileChange[];
}

export interface AgentStepEvent {
  type: 'thought' | 'tool_call' | 'tool_result' | 'file_edit' | 'message' | 'done' | 'error';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  fileChange?: FileChange;
  finishReason?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
  events?: AgentStepEvent[];
  fileChanges?: FileChange[];
  isStreaming?: boolean;
}

export interface UserSettings {
  githubToken: string;
  geminiApiKey: string;
  modelName: string;
  connectionMode: 'direct' | 'proxy';
}
