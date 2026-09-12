import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  Search,
  RefreshCw,
  X,
  Copy,
  Check,
  Bot,
  FileText,
} from 'lucide-react';
import { RepoTreeItem, FileContent } from '../../types.js';
import { ApiService } from '../../services/api.js';

interface FileExplorerViewProps {
  githubToken: string;
  owner: string;
  repo: string;
  branch: string;
  onAskAgentAboutFile: (path: string) => void;
}

export const FileExplorerView: React.FC<FileExplorerViewProps> = ({
  githubToken,
  owner,
  repo,
  branch,
  onAskAgentAboutFile,
}) => {
  const [tree, setTree] = useState<RepoTreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Selected file preview
  const [activeFile, setActiveFile] = useState<FileContent | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (githubToken && owner && repo && branch) {
      loadTree();
    }
  }, [githubToken, owner, repo, branch]);

  const loadTree = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiService.getTree(githubToken, owner, repo, branch);
      setTree(data);
    } catch (err: any) {
      setError(err.message || '파일 트리를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFile = async (item: RepoTreeItem) => {
    if (item.type === 'dir') return;
    setLoadingFile(true);
    try {
      const data = await ApiService.getFile(githubToken, owner, repo, branch, item.path);
      setActiveFile(data);
    } catch (err: any) {
      alert(`파일을 읽지 못했습니다: ${err.message}`);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleCopyCode = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredTree = tree.filter((item) =>
    item.path.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-md mx-auto">
      {/* Search Bar */}
      <div className="p-3 bg-slate-900/80 border-b border-slate-800/80 flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="파일 경로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button
          onClick={loadTree}
          disabled={loading}
          className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center justify-center transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">파일 목록 불러오는 중...</div>
        ) : error ? (
          <div className="p-4 text-center text-xs text-rose-400">{error}</div>
        ) : filteredTree.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            {tree.length === 0 ? '저장소가 비어있거나 접근할 수 없습니다.' : '일치하는 파일이 없습니다.'}
          </div>
        ) : (
          filteredTree.map((item) => {
            const isDir = item.type === 'dir';
            const depth = item.path.split('/').length - 1;
            const filename = item.path.split('/').pop();

            return (
              <div
                key={item.path}
                onClick={() => handleOpenFile(item)}
                style={{ paddingLeft: `${Math.min(depth * 14 + 10, 40)}px` }}
                className={`py-1.5 pr-3 rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors ${
                  isDir
                    ? 'text-slate-400 font-medium'
                    : 'text-slate-200 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {isDir ? (
                    <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  ) : (
                    <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="truncate">{filename}</span>
                </div>
                {item.size !== undefined && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {item.size > 1024 ? `${(item.size / 1024).toFixed(1)}k` : `${item.size}b`}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* File Viewer Modal */}
      {activeFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-950">
              <div className="truncate mr-2">
                <span className="text-xs font-mono font-medium text-white block truncate">
                  {activeFile.path}
                </span>
                <span className="text-[10px] text-slate-400">
                  {activeFile.size} bytes · UTF-8
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="코드 복사"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setActiveFile(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-auto bg-slate-950 p-3 font-mono text-xs select-text">
              <pre className="text-slate-300 whitespace-pre leading-5">
                {activeFile.content}
              </pre>
            </div>

            {/* Action Footer: Ask AI Agent */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
              <button
                onClick={() => {
                  const targetPath = activeFile.path;
                  setActiveFile(null);
                  onAskAgentAboutFile(targetPath);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                <Bot className="w-4 h-4" />
                <span>AI에게 이 파일 수정 요청하기</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
