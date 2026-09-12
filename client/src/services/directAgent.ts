import { DirectGitHubService } from './directGitHub.js';
import { AgentStepEvent, FileChange, RepoTreeItem } from '../types.js';

interface DirectAgentOptions {
  geminiApiKey: string;
  githubToken: string;
  owner: string;
  repo: string;
  branch: string;
  prompt: string;
  modelName?: string;
  signal?: AbortSignal;
  onEvent: (event: AgentStepEvent) => void;
}

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class DirectAgentService {
  static async run({
    geminiApiKey,
    githubToken,
    owner,
    repo,
    branch,
    prompt,
    modelName = 'gemini-2.0-flash',
    signal,
    onEvent,
  }: DirectAgentOptions): Promise<FileChange[]> {
    // Sanitize deprecated model names
    const resolvedModel = modelName.includes('2.5') ? 'gemini-2.0-flash' : modelName;
    const proposedChanges: Map<string, FileChange> = new Map();

    // Cache repo tree for quick lookups
    let cachedTree: RepoTreeItem[] | null = null;
    const getCachedTree = async (): Promise<RepoTreeItem[]> => {
      if (!cachedTree) {
        cachedTree = await DirectGitHubService.getTree(githubToken, owner, repo, branch);
      }
      return cachedTree;
    };

    const tools = [
      {
        functionDeclarations: [
          {
            name: 'get_repo_structure',
            description:
              'Retrieve directory and file paths of the repository to understand project structure.',
            parameters: {
              type: 'OBJECT',
              properties: {
                maxResults: {
                  type: 'INTEGER',
                  description: 'Maximum number of items to return (default: 80)',
                },
              },
            },
          },
          {
            name: 'search_files',
            description: 'Search repository files by keyword or file path pattern.',
            parameters: {
              type: 'OBJECT',
              properties: {
                query: {
                  type: 'STRING',
                  description: 'Keyword, extension or path fragment to search for',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'read_file',
            description: 'Read the full source code or text content of a specific file.',
            parameters: {
              type: 'OBJECT',
              properties: {
                path: {
                  type: 'STRING',
                  description: 'The exact repository path to the file',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'propose_file_edit',
            description:
              'Propose an edit to an existing file or propose creating a new file. Provide the COMPLETE new file content.',
            parameters: {
              type: 'OBJECT',
              properties: {
                path: {
                  type: 'STRING',
                  description: 'The relative file path to edit or create',
                },
                newContent: {
                  type: 'STRING',
                  description:
                    'The full, complete code of the file after the modification. Never truncate with comments like "...rest of code".',
                },
                description: {
                  type: 'STRING',
                  description: 'Short explanation of what was changed or added in this file',
                },
              },
              required: ['path', 'newContent', 'description'],
            },
          },
        ],
      },
    ];

    const systemInstruction = {
      parts: [
        {
          text: `You are GitMobile AI Agent running directly on a mobile device for GitHub repositories.
Your mission is to analyze the user's request, examine the codebase using your tools, implement high-quality, bug-free modifications, and propose the exact file edits.

Guidelines:
1. Discover relevant files using get_repo_structure or search_files.
2. Read the files you need to modify using read_file. Never guess existing code.
3. Use propose_file_edit to provide the FULL, complete modified or created code. Do not use placeholders.
4. Keep edits clean, modular, and adhering to existing codebase styling and conventions.
5. Provide clear, helpful explanations in Korean (한국어) or English depending on user request language.
6. When all needed edits are proposed, summarize your changes and finish.`,
        },
      ],
    };

    const contents: any[] = [
      {
        role: 'user',
        parts: [
          {
            text: `Repository: ${owner}/${repo} (branch: ${branch})\nUser Request: ${prompt}\n\nPlease analyze the repository, read relevant files, and propose the necessary code modifications using your tools.`,
          },
        ],
      },
    ];

    const MAX_STEPS = 12;
    let step = 0;

    while (step < MAX_STEPS) {
      step++;
      if (signal?.aborted) throw new Error('작업이 사용자에 의해 중단되었습니다.');

      onEvent({
        type: 'thought',
        content: `Thinking (Step ${step}/${MAX_STEPS})...`,
      });

      const url = `${GEMINI_BASE_URL}/${resolvedModel}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction,
          contents,
          tools,
          generationConfig: {
            temperature: 0.2,
          },
        }),
        signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.error?.message || `Gemini API 요청 실패 (HTTP ${res.status})`
        );
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error('Gemini API로부터 응답을 받지 못했습니다.');
      }

      const modelParts = candidate.content?.parts || [];
      contents.push({
        role: 'model',
        parts: modelParts,
      });

      // Extract text content if present
      for (const part of modelParts) {
        if (part.text) {
          onEvent({
            type: 'message',
            content: part.text,
          });
        }
      }

      // Check for functionCalls
      const functionCalls: Array<{ name: string; args: any }> = [];
      for (const part of modelParts) {
        if (part.functionCall) {
          functionCalls.push(part.functionCall);
        }
      }

      if (functionCalls.length === 0) {
        // No more tool calls: Done!
        onEvent({
          type: 'done',
          content: '분석 및 파일 수정 제안이 완료되었습니다.',
          finishReason: candidate.finishReason || 'STOP',
        });
        break;
      }

      // Execute tool calls in browser
      const toolResponses: any[] = [];

      for (const call of functionCalls) {
        const { name, args } = call;
        const callArgs = args || {};

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

        toolResponses.push({
          functionResponse: {
            name,
            response: { output: result },
          },
        });
      }

      // Add tool responses into contents
      contents.push({
        role: 'user',
        parts: toolResponses,
      });
    }

    return Array.from(proposedChanges.values());
  }
}
