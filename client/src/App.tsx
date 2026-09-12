import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header.js';
import { BottomNav, ActiveTab } from './components/Navigation/BottomNav.js';
import { AgentChatView } from './components/Agent/AgentChatView.js';
import { FileExplorerView } from './components/Explorer/FileExplorerView.js';
import { DiffViewer } from './components/Diff/DiffViewer.js';
import { SettingsView } from './components/Settings/SettingsView.js';
import { RepoSelectorModal } from './components/RepoSelectorModal.js';
import { CommitDrawer } from './components/Commit/CommitDrawer.js';
import {
  Repository,
  Branch,
  FileChange,
  ChatMessage,
  UserSettings,
  CommitRequest,
  AgentStepEvent,
} from './types.js';
import { ApiService } from './services/api.js';

const SETTINGS_KEY = 'gitmobile_settings';
const REPO_KEY = 'gitmobile_repo';
const BRANCH_KEY = 'gitmobile_branch';

export const App: React.FC = () => {
  // Tab State
  const [activeTab, setActiveTab] = useState<ActiveTab>('agent');

  // User Configuration
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.modelName || parsed.modelName.includes('2.5')) {
          parsed.modelName = 'gemini-2.0-flash';
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch {}
    return {
      githubToken: '',
      geminiApiKey: '',
      modelName: 'gemini-2.0-flash',
      connectionMode: 'direct',
    };
  });

  // Selected Repository & Branch
  const [currentRepo, setCurrentRepo] = useState<Repository | null>(() => {
    try {
      const saved = localStorage.getItem(REPO_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [currentBranch, setCurrentBranch] = useState<Branch | null>(() => {
    try {
      const saved = localStorage.getItem(BRANCH_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Modals & Drawers
  const [isRepoSelectorOpen, setIsRepoSelectorOpen] = useState(false);
  const [isCommitDrawerOpen, setIsCommitDrawerOpen] = useState(false);

  // Chat & Changes
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stagedChanges, setStagedChanges] = useState<FileChange[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const cancelStreamRef = useRef<(() => void) | null>(null);

  // Sync to localStorage
  const handleSaveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  const handleSelectRepo = (repo: Repository, branch: Branch) => {
    setCurrentRepo(repo);
    setCurrentBranch(branch);
    localStorage.setItem(REPO_KEY, JSON.stringify(repo));
    localStorage.setItem(BRANCH_KEY, JSON.stringify(branch));
    // Clear chat and changes for new repo
    setMessages([]);
    setStagedChanges([]);
  };

  // Discard a specific change
  const handleDiscardChange = (path: string) => {
    setStagedChanges((prev) => prev.filter((c) => c.path !== path));
  };

  // Run Agent
  const handleSendMessage = async (prompt: string) => {
    if (!settings.githubToken || !settings.geminiApiKey) {
      alert('GitHub 토큰과 Gemini API Key가 필요합니다. 설정 탭으로 이동합니다.');
      setActiveTab('settings');
      return;
    }

    if (!currentRepo || !currentBranch) {
      setIsRepoSelectorOpen(true);
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString(),
    };

    const agentMsgId = `agent-${Date.now()}`;
    const initialAgentMsg: ChatMessage = {
      id: agentMsgId,
      role: 'agent',
      text: '',
      timestamp: new Date().toLocaleTimeString(),
      events: [],
      fileChanges: [],
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, initialAgentMsg]);
    setIsStreaming(true);

    const abortFn = await ApiService.runAgentStream({
      geminiApiKey: settings.geminiApiKey,
      githubToken: settings.githubToken,
      owner: currentRepo.owner,
      repo: currentRepo.name,
      branch: currentBranch.name,
      prompt,
      modelName: settings.modelName,
      onEvent: (event: AgentStepEvent) => {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== agentMsgId) return msg;

            const updatedEvents = [...(msg.events || []), event];
            let updatedText = msg.text;
            let updatedFiles = [...(msg.fileChanges || [])];

            if (event.type === 'message' && event.content) {
              updatedText = updatedText ? `${updatedText}\n\n${event.content}` : event.content;
            }

            if (event.type === 'file_edit' && event.fileChange) {
              const change = event.fileChange;
              // Add to message fileChanges
              const existingIdx = updatedFiles.findIndex((f) => f.path === change.path);
              if (existingIdx >= 0) {
                updatedFiles[existingIdx] = change;
              } else {
                updatedFiles.push(change);
              }

              // Also add to global staged changes
              setStagedChanges((prevStaged) => {
                const sIdx = prevStaged.findIndex((f) => f.path === change.path);
                if (sIdx >= 0) {
                  const copy = [...prevStaged];
                  copy[sIdx] = change;
                  return copy;
                }
                return [...prevStaged, change];
              });
            }

            return {
              ...msg,
              text: updatedText,
              events: updatedEvents,
              fileChanges: updatedFiles,
            };
          })
        );
      },
      onError: (err: string) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === agentMsgId
              ? {
                  ...msg,
                  text: msg.text
                    ? `${msg.text}\n\n⚠️ 오류: ${err}`
                    : `⚠️ 오류가 발생했습니다: ${err}`,
                  isStreaming: false,
                }
              : msg
          )
        );
        setIsStreaming(false);
      },
      onDone: () => {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === agentMsgId ? { ...msg, isStreaming: false } : msg))
        );
        setIsStreaming(false);
      },
    });

    cancelStreamRef.current = abortFn;
  };

  const handleCancelStream = () => {
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  };

  // Ask AI about file from Explorer
  const handleAskAgentAboutFile = (filePath: string) => {
    setActiveTab('agent');
    handleSendMessage(`${filePath} 파일의 코드를 분석하고 개선점을 찾아 적용해줘.`);
  };

  // Commit & Push execution
  const handleCommitSubmit = async (req: CommitRequest) => {
    if (!settings.githubToken) throw new Error('GitHub 토큰이 필요합니다.');
    return ApiService.commitAndPush(settings.githubToken, req);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Mobile Header */}
      <Header
        currentRepo={currentRepo}
        currentBranch={currentBranch}
        onOpenRepoSelector={() => setIsRepoSelectorOpen(true)}
        hasGithubToken={Boolean(settings.githubToken)}
        hasGeminiKey={Boolean(settings.geminiApiKey)}
        onOpenSettings={() => setActiveTab('settings')}
      />

      {/* Main Tab Content */}
      <main className="flex-1 pb-16">
        {activeTab === 'agent' && (
          <AgentChatView
            messages={messages}
            onSendMessage={handleSendMessage}
            isStreaming={isStreaming}
            onCancelStream={handleCancelStream}
            onGoToDiff={() => setActiveTab('diff')}
            repoName={currentRepo?.full_name}
            branchName={currentBranch?.name}
          />
        )}

        {activeTab === 'explorer' && (
          <FileExplorerView
            githubToken={settings.githubToken}
            owner={currentRepo?.owner || ''}
            repo={currentRepo?.name || ''}
            branch={currentBranch?.name || ''}
            onAskAgentAboutFile={handleAskAgentAboutFile}
          />
        )}

        {activeTab === 'diff' && (
          <DiffViewer
            changes={stagedChanges}
            onDiscardChange={handleDiscardChange}
            onOpenCommitDrawer={() => setIsCommitDrawerOpen(true)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView settings={settings} onSave={handleSaveSettings} />
        )}
      </main>

      {/* Bottom Thumb Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => setActiveTab(tab)}
        diffCount={stagedChanges.length}
      />

      {/* Repo Selector Sheet */}
      <RepoSelectorModal
        isOpen={isRepoSelectorOpen}
        onClose={() => setIsRepoSelectorOpen(false)}
        githubToken={settings.githubToken}
        currentRepo={currentRepo}
        currentBranch={currentBranch}
        onSelect={handleSelectRepo}
        onOpenSettings={() => setActiveTab('settings')}
      />

      {/* Commit & Push Drawer */}
      {currentRepo && currentBranch && (
        <CommitDrawer
          isOpen={isCommitDrawerOpen}
          onClose={() => setIsCommitDrawerOpen(false)}
          changes={stagedChanges}
          owner={currentRepo.owner}
          repo={currentRepo.name}
          currentBranch={currentBranch.name}
          onSubmit={handleCommitSubmit}
          onSuccess={() => setStagedChanges([])}
        />
      )}
    </div>
  );
};
