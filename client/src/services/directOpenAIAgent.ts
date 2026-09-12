import { DirectGitHubService } from './directGitHub.js';
import { AgentStepEvent, FileChange, RepoTreeItem } from '../types.js';

interface DirectOpenAIAgentOptions {
  baseUrl: string;
  apiKey?: string;
  modelName: string;
  githubToken: string;
  owner: string;
  repo: string;
  branch: string;
  prompt: string;
  signal?: AbortSignal;
  onEvent: (event: AgentStepEvent) => void;
}

export class DirectOpenAIAgentService {
  static async run({
    baseUrl,
    apiKey,
    modelName,
    githubToken,
    owner,
    repo,
    branch,
    prompt,
    signal,
    onEvent,
  }: DirectOpenAIAgentOptions): Promise<FileChange[]> {
    const proposedChanges: Map<string, FileChange> = new Map();

    // Cache repo tree
    let cachedTree: RepoTreeItem[] | null = null;
    const getCachedTree = async (): Promise<RepoTreeItem[]> => {
      if (!cachedTree) {
        cachedTree = await DirectGitHubService.getTree(githubToken, owner, repo, branch);
      }
      return cachedTree;
    };

    const tools = [
      {
        type: 'function',
        function: {
          name: 'get_repo_structure',
          description:
            'Retrieve directory and file paths of the repository to understand project structure.',
          parameters: {
            type: 'object',
            properties: {
              maxResults: {
                type: 'integer',
                description: 'Maximum number of items to return (default: 80)',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_files',
          description: 'Search repository files by keyword or file path pattern.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Keyword, extension or path fragment to search for',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read the full source code or text content of a specific file.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The exact repository path to the file',
              },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'propose_file_edit',
          description:
            'Propose an edit to an existing file or propose creating a new file. Provide the COMPLETE new file content.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The relative file path to edit or create',
              },
              newContent: {
                type: 'string',
                description:
                  'The full, complete code of the file after the modification. Never truncate with comments like "...rest of code".',
              },
              description: {
                type: 'string',
                description: 'Short explanation of what was changed or added in this file',
              },
            },
            required: ['path', 'newContent', 'description'],
          },
        },
      },
    ];

    const systemPrompt = `You are GitMobile AI Agent, an autonomous software engineering assistant operating on a mobile device for GitHub repositories.
Your mission is to analyze the user's request, examine the codebase using your tools, implement high-quality, bug-free modifications, and propose the exact file edits.

Guidelines:
1. Discover relevant files using get_repo_structure or search_files.
2. Read the files you need to modify using read_file. Never guess existing code.
3. Use propose_file_edit to provide the FULL, complete modified or created code. Do not use placeholders.
4. Keep edits clean, modular, and adhering to existing codebase conventions.
5. Provide clear, helpful explanations in Korean (한국어) or English depending on user request language.
6. When all needed edits are proposed, summarize your changes and finish.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Repository: ${owner}/${repo} (branch: ${branch})\nUser Request: ${prompt}\n\nPlease analyze the repository, read relevant files, and propose the necessary code modifications using your tools.`,
      },
    ];

    const cleanBaseUrl = (baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '');
    const endpoint = cleanBaseUrl.endsWith('/chat/completions')
      ? cleanBaseUrl
      : `${cleanBaseUrl}/chat/completions`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const MAX_STEPS = 12;
    let step = 0;

    while (step < MAX_STEPS) {
      step++;
      if (signal?.aborted) throw new Error('작업이 사용자에 의해 중단되었습니다.');

      onEvent({
        type: 'thought',
        content: `Thinking with Local AI (Step ${step}/${MAX_STEPS})...`,
      });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelName || 'qwen2.5-coder:7b',
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.2,
        }),
        signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.error?.message ||
            `로컬 AI 서버 요청 실패 (HTTP ${res.status}): ${res.statusText}. URL: ${endpoint}`
        );
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice || !choice.message) {
        throw new Error('로컬 AI 서버로부터 응답 메시지를 받지 못했습니다.');
      }

      const assistantMsg = choice.message;
      messages.push(assistantMsg);

      if (assistantMsg.content) {
        onEvent({
          type: 'message',
          content: assistantMsg.content,
        });
      }

      const toolCalls = assistantMsg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        onEvent({
          type: 'done',
          content: '분석 및 파일 수정 제안이 완료되었습니다.',
          finishReason: choice.finish_reason || 'stop',
        });
        break;
      }

      for (const call of toolCalls) {
        const name = call.function.name;
        let callArgs: Record<string, any> = {};
        try {
          callArgs =
            typeof call.function.arguments === 'string'
              ? JSON.parse(call.function.arguments)
              : call.function.arguments || {};
        } catch {
          callArgs = {};
        }

        onEvent({
          type: 'tool_call',
          toolName: name,
          toolArgs: callArgs,
        });

        let result: any;

        try {
          if (name === 'get_repo_structure') {
            const tree = await getCachedTree();
            const maxResults = callArgs.maxResults || 80;
            const filtered = tree
              .filter(
                (item) =>
                  !item.path.startsWith('.') &&
                  !item.path.includes('node_modules/') &&
                  !item.path.includes('dist/') &&
                  !item.path.includes('build/') &&
                  !item.path.includes('.git/')
              )
              .slice(0, maxResults)
              .map((item) => ({ path: item.path, type: item.type }));

            result = { totalFiles: tree.length, sample: filtered };
          } else if (name === 'search_files') {
            const query = (callArgs.query || '').toLowerCase();
            const tree = await getCachedTree();
            const matches = tree
              .filter((item) => item.path.toLowerCase().includes(query))
              .slice(0, 30)
              .map((item) => item.path);

            result = { query, matches, count: matches.length };
          } else if (name === 'read_file') {
            const filePath = callArgs.path;
            const fileData = await DirectGitHubService.getFile(
              githubToken,
              owner,
              repo,
              branch,
              filePath
            );
            result = {
              path: filePath,
              content: fileData.content,
              size: fileData.size,
            };
          } else if (name === 'propose_file_edit') {
            const filePath = callArgs.path;
            const newContent = callArgs.newContent;
            const description = callArgs.description;

            let originalContent = '';
            let action: 'create' | 'modify' = 'create';

            try {
              const orig = await DirectGitHubService.getFile(
                githubToken,
                owner,
                repo,
                branch,
                filePath
              );
              originalContent = orig.content;
              action = 'modify';
            } catch {
              action = 'create';
            }

            const change: FileChange = {
              path: filePath,
              action,
              originalContent,
              newContent,
              description,
            };

            proposedChanges.set(filePath, change);

            onEvent({
              type: 'file_edit',
              fileChange: change,
            });

            result = { success: true, message: `Proposed ${action} for ${filePath}` };
          } else {
            result = { error: `알 수 없는 도구입니다: ${name}` };
          }
        } catch (err: any) {
          result = { error: err.message || String(err) };
        }

        onEvent({
          type: 'tool_result',
          toolName: name,
          toolResult: result,
        });

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return Array.from(proposedChanges.values());
  }
}
