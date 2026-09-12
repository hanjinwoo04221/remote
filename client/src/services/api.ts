import {
  Repository,
  Branch,
  RepoTreeItem,
  FileContent,
  CommitRequest,
  AgentStepEvent,
} from '../types.js';
import { DirectGitHubService } from './directGitHub.js';
import { DirectAgentService } from './directAgent.js';
import { DirectOpenAIAgentService } from './directOpenAIAgent.js';

const API_BASE = '/api';

export class ApiService {
  private static getMode(): 'direct' | 'proxy' {
    try {
      const saved = localStorage.getItem('gitmobile_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.connectionMode) return parsed.connectionMode;
      }
    } catch {}
    // Default to 'direct' mode so it works 100% on mobile without desktop PC!
    return 'direct';
  }

  static async getHealth(): Promise<{ status: string; localIp: string; mobileUrl: string }> {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new Error('Health check failed');
      return res.json();
    } catch {
      return { status: 'direct_mode', localIp: 'localhost', mobileUrl: window.location.origin };
    }
  }

  static async fetchGeminiModels(apiKey: string): Promise<string[]> {
    if (!apiKey || !apiKey.trim()) return [];
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.models) return [];
      const list: string[] = data.models
        .filter(
          (m: any) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent')
        )
        .map((m: any) => (m.name || '').replace(/^models\//, ''))
        .filter(Boolean);
      return Array.from(new Set(list));
    } catch {
      return [];
    }
  }

  static async fetchLocalModels(baseUrl: string, apiKey?: string): Promise<string[]> {
    const cleanUrl = (baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '');
    const endpoint = cleanUrl.endsWith('/models') ? cleanUrl : `${cleanUrl}/models`;
    const headers: HeadersInit = {};
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }
    try {
      const res = await fetch(endpoint, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      const list: string[] = (data.data || data.models || [])
        .map((m: any) => m.id || m.name)
        .filter(Boolean);
      return Array.from(new Set(list));
    } catch {
      return [];
    }
  }

  static async verifyGitHubToken(token: string) {
    if (this.getMode() === 'direct') {
      return DirectGitHubService.verifyToken(token);
    }
    const res = await fetch(`${API_BASE}/github/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'GitHub token verification failed');
    }
    return res.json();
  }

  static async getRepositories(token: string, search?: string): Promise<Repository[]> {
    if (this.getMode() === 'direct') {
      return DirectGitHubService.getRepositories(token, search);
    }
    const url = new URL(`${API_BASE}/github/repos`, window.location.origin);
    if (search) url.searchParams.set('search', search);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch repositories');
    }
    return res.json();
  }

  static async getBranches(token: string, owner: string, repo: string): Promise<Branch[]> {
    if (this.getMode() === 'direct') {
      return DirectGitHubService.getBranches(token, owner, repo);
    }
    const url = new URL(`${API_BASE}/github/branches`, window.location.origin);
    url.searchParams.set('owner', owner);
    url.searchParams.set('repo', repo);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch branches');
    }
    return res.json();
  }

  static async getTree(
    token: string,
    owner: string,
    repo: string,
    branch: string
  ): Promise<RepoTreeItem[]> {
    if (this.getMode() === 'direct') {
      return DirectGitHubService.getTree(token, owner, repo, branch);
    }
    const url = new URL(`${API_BASE}/github/tree`, window.location.origin);
    url.searchParams.set('owner', owner);
    url.searchParams.set('repo', repo);
    url.searchParams.set('branch', branch);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch tree');
    }
    return res.json();
  }

  static async getFile(
    token: string,
    owner: string,
    repo: string,
    branch: string,
    path: string
  ): Promise<FileContent> {
    if (this.getMode() === 'direct') {
      return DirectGitHubService.getFile(token, owner, repo, branch, path);
    }
    const url = new URL(`${API_BASE}/github/file`, window.location.origin);
    url.searchParams.set('owner', owner);
    url.searchParams.set('repo', repo);
    url.searchParams.set('branch', branch);
    url.searchParams.set('path', path);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch file');
    }
    return res.json();
  }

  static async commitAndPush(token: string, req: CommitRequest) {
    if (this.getMode() === 'direct') {
      return DirectGitHubService.commitAndPush(token, req);
    }
    const res = await fetch(`${API_BASE}/github/commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to commit changes');
    }
    return res.json();
  }

  static async runAgentStream({
    aiProvider = 'gemini',
    localBaseUrl = 'http://localhost:11434/v1',
    localApiKey,
    localModelName = 'qwen2.5-coder:7b',
    geminiApiKey,
    githubToken,
    owner,
    repo,
    branch,
    prompt,
    modelName,
    onEvent,
    onError,
    onDone,
  }: {
    aiProvider?: 'gemini' | 'openai_compatible';
    localBaseUrl?: string;
    localApiKey?: string;
    localModelName?: string;
    geminiApiKey: string;
    githubToken: string;
    owner: string;
    repo: string;
    branch: string;
    prompt: string;
    modelName?: string;
    onEvent: (event: AgentStepEvent) => void;
    onError: (err: string) => void;
    onDone: () => void;
  }): Promise<() => void> {
    const controller = new AbortController();

    // Local AI / Ollama Mode
    if (aiProvider === 'openai_compatible') {
      DirectOpenAIAgentService.run({
        baseUrl: localBaseUrl,
        apiKey: localApiKey,
        modelName: localModelName,
        githubToken,
        owner,
        repo,
        branch,
        prompt,
        signal: controller.signal,
        onEvent,
      })
        .then(() => onDone())
        .catch((err: any) => {
          if (err.name !== 'AbortError' && !controller.signal.aborted) {
            onError(err.message || 'Local AI agent execution failed');
          }
        });
      return () => controller.abort();
    }

    // Direct Browser Mode (Gemini)
    if (this.getMode() === 'direct') {
      DirectAgentService.run({
        geminiApiKey,
        githubToken,
        owner,
        repo,
        branch,
        prompt,
        modelName,
        signal: controller.signal,
        onEvent,
      })
        .then(() => onDone())
        .catch((err: any) => {
          if (err.name !== 'AbortError' && !controller.signal.aborted) {
            onError(err.message || 'Direct agent execution failed');
          }
        });
      return () => controller.abort();
    }

    // Proxy Server Mode (Via Node.js backend)
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/agent/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geminiApiKey,
            githubToken,
            owner,
            repo,
            branch,
            prompt,
            modelName,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Server responded with ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response stream available');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6);
              if (dataStr === '{}') continue;
              try {
                const parsed: AgentStepEvent = JSON.parse(dataStr);
                onEvent(parsed);
              } catch (e) {
                console.error('Error parsing SSE data line:', e, dataStr);
              }
            }
          }
        }
        onDone();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          onError(err.message || 'Stream connection error');
        }
      }
    })();

    return () => controller.abort();
  }
}
