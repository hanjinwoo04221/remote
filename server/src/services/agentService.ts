import { GoogleGenAI, Type } from '@google/genai';
import { GitHubService } from './githubService.js';
import { AgentStepEvent, FileChange, RepoTreeItem } from '../types.js';

interface RunAgentOptions {
  geminiApiKey: string;
  githubToken: string;
  owner: string;
  repo: string;
  branch: string;
  prompt: string;
  modelName?: string;
  onEvent: (event: AgentStepEvent) => void;
}

export class AgentService {
  static async run({
    geminiApiKey,
    githubToken,
    owner,
    repo,
    branch,
    prompt,
    modelName = 'gemini-2.0-flash',
    onEvent,
  }: RunAgentOptions): Promise<FileChange[]> {
    const resolvedModel = modelName.includes('2.5') ? 'gemini-2.0-flash' : modelName;
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const proposedChanges: Map<string, FileChange> = new Map();

    // Cache repo tree for quick lookups
    let cachedTree: RepoTreeItem[] | null = null;
    const getCachedTree = async (): Promise<RepoTreeItem[]> => {
      if (!cachedTree) {
        cachedTree = await GitHubService.getRepoTree(githubToken, owner, repo, branch);
      }
      return cachedTree;
    };

    const tools: any[] = [
      {
        functionDeclarations: [
          {
            name: 'get_repo_structure',
            description:
              'Retrieve directory and file paths of the repository to understand project structure.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                maxResults: {
                  type: Type.INTEGER,
                  description: 'Maximum number of items to return (default: 80)',
                },
              },
            },
          },
          {
            name: 'search_files',
            description: 'Search repository files by keyword or file path pattern.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                query: {
                  type: Type.STRING,
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
              type: Type.OBJECT,
              properties: {
                path: {
                  type: Type.STRING,
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
              type: Type.OBJECT,
              properties: {
                path: {
                  type: Type.STRING,
                  description: 'The relative file path to edit or create',
                },
                newContent: {
                  type: Type.STRING,
                  description:
                    'The full, complete code of the file after the modification. Never truncate with comments like "...rest of code".',
                },
                description: {
                  type: Type.STRING,
                  description: 'Short explanation of what was changed or added in this file',
                },
              },
              required: ['path', 'newContent', 'description'],
            },
          },
        ],
      },
    ];

    const systemInstruction = `You are GitMobile AI Agent, an autonomous software engineering assistant operating on a mobile device for GitHub repositories.
Your mission is to analyze the user's request, examine the codebase using your tools, implement high-quality, bug-free modifications, and propose the exact file edits.

Guidelines:
1. First, discover relevant files using get_repo_structure or search_files.
2. Read the files you need to modify using read_file. Never guess existing code.
3. Use propose_file_edit to provide the FULL, complete modified or created code. Do not use placeholders.
4. Keep edits clean, modular, and adhering to the existing codebase styling and conventions.
5. Provide clear, helpful explanations of what you changed in Korean (한국어) or English depending on user input language.
6. When all needed edits are proposed, summarize your changes and finish.`;

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

      onEvent({
        type: 'thought',
        content: `Thinking (Step ${step}/${MAX_STEPS})...`,
      });

      const response = await ai.models.generateContent({
        model: resolvedModel,
        contents,
        config: {
          systemInstruction,
          tools,
          temperature: 0.2,
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate) {
        throw new Error('No candidate response returned by Gemini API');
      }

      // Add model's message to conversation history
      const modelParts = candidate.content?.parts || [];
      contents.push({
        role: 'model',
        parts: modelParts,
      });

      // Check if text was output
      if (response.text) {
        onEvent({
          type: 'message',
          content: response.text,
        });
      }

      const functionCalls = response.functionCalls;
      if (!functionCalls || functionCalls.length === 0) {
        // Finished!
        onEvent({
          type: 'done',
          content: 'Analysis and proposed edits complete.',
          finishReason: candidate.finishReason || 'STOP',
        });
        break;
      }

      // Execute tool calls
      const toolResponses: any[] = [];

      for (const call of functionCalls) {
        const { name, args } = call;
        const callArgs = (args || {}) as Record<string, any>;

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

            result = {
              totalFiles: tree.length,
              sample: filtered,
            };
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
            const fileData = await GitHubService.getFileContent(
              githubToken,
              owner,
              repo,
              filePath,
              branch
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

            // Check if file previously existed
            let originalContent = '';
            let action: 'create' | 'modify' = 'create';

            try {
              const original = await GitHubService.getFileContent(
                githubToken,
                owner,
                repo,
                filePath,
                branch
              );
              originalContent = original.content;
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

            result = {
              success: true,
              message: `Proposed ${action} for ${filePath}`,
            };
          } else {
            result = { error: `Unknown tool: ${name}` };
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

      // Add tool responses back into the contents
      contents.push({
        role: 'user',
        parts: toolResponses,
      });
    }

    return Array.from(proposedChanges.values());
  }
}
