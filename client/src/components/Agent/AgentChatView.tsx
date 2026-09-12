import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  StopCircle,
  FileCode2,
  FileSearch,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Terminal,
} from 'lucide-react';
import { ChatMessage, FileChange, AgentStepEvent } from '../../types.js';

interface AgentChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string) => void;
  isStreaming: boolean;
  onCancelStream: () => void;
  onGoToDiff: () => void;
  repoName?: string;
  branchName?: string;
}

export const AgentChatView: React.FC<AgentChatViewProps> = ({
  messages,
  onSendMessage,
  isStreaming,
  onCancelStream,
  onGoToDiff,
  repoName,
  branchName,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const handleSend = () => {
    if (!inputText.trim() || isStreaming) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const quickPrompts = [
    '✨ README 파일에 사용법 및 뱃지 추가',
    '🐛 버그 검사 및 에러 핸들링 보강',
    '🧪 핵심 로직에 대한 단위 테스트 작성',
    '⚡ 코드 가독성 개선 및 리팩토링',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-md mx-auto">
      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="py-8 px-4 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">GitMobile AI 코딩 에이전트</h3>
              <p className="text-xs text-slate-400 mt-1">
                {repoName
                  ? `${repoName} (${branchName}) 저장소에 연결되었습니다.`
                  : '저장소를 선택하고 자연어로 개발 작업을 지시하세요.'}
              </p>
            </div>

            {/* Quick Action Chips */}
            <div className="pt-2 space-y-2">
              <p className="text-[11px] font-medium text-slate-400 text-left">추천 작업 예시:</p>
              <div className="grid grid-cols-1 gap-2">
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(p.replace(/^[^\s]+\s/, ''));
                    }}
                    className="text-left text-xs bg-slate-900/90 hover:bg-slate-800 border border-slate-800 p-2.5 rounded-xl text-slate-300 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'agent' && (
                <div className="w-7 h-7 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-indigo-400" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm space-y-2 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                {/* Agent Events / Tool Actions Badges */}
                {msg.events && msg.events.length > 0 && (
                  <div className="space-y-1.5 pt-0.5 pb-1 border-b border-slate-800/80">
                    {msg.events.map((ev, i) => {
                      if (ev.type === 'thought') {
                        return (
                          <div key={i} className="text-[11px] text-slate-400 italic flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>{ev.content}</span>
                          </div>
                        );
                      }
                      if (ev.type === 'tool_call') {
                        return (
                          <div
                            key={i}
                            className="bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 flex items-center gap-1.5 font-mono"
                          >
                            <Terminal className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="font-semibold text-indigo-300">{ev.toolName}</span>
                            <span className="text-slate-400 truncate">
                              {JSON.stringify(ev.toolArgs || {})}
                            </span>
                          </div>
                        );
                      }
                      if (ev.type === 'file_edit' && ev.fileChange) {
                        return (
                          <div
                            key={i}
                            className="bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-2 text-[11px] flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <FileCode2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="font-medium text-emerald-300 truncate">
                                {ev.fileChange.path}
                              </span>
                            </div>
                            <span className="text-[9px] bg-emerald-900/60 text-emerald-200 px-1.5 py-0.5 rounded font-mono uppercase">
                              {ev.fileChange.action}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}

                {/* Main Message Text */}
                {msg.text && (
                  <div className="whitespace-pre-wrap leading-relaxed break-words font-sans">
                    {msg.text}
                  </div>
                )}

                {/* Modified files summary card */}
                {msg.fileChanges && msg.fileChanges.length > 0 && (
                  <div className="pt-2">
                    <button
                      onClick={onGoToDiff}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/40 text-indigo-200 font-medium text-[11px] flex items-center justify-between transition-colors shadow"
                    >
                      <div className="flex items-center gap-1.5">
                        <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>수정된 파일 ({msg.fileChanges.length}개) 변경사항 검토</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                    </button>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          ))
        )}

        {/* Live Loading Indicator while streaming */}
        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 bg-slate-900/80 border border-indigo-500/20 rounded-xl p-3 animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>AI 에이전트가 코드를 탐색 및 편집하고 있습니다...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="AI 에이전트에게 코드 수정을 지시하세요..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none max-h-24"
          />

          {isStreaming ? (
            <button
              onClick={onCancelStream}
              className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shrink-0 transition-colors"
              title="에이전트 중단"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white shrink-0 transition-all shadow-lg shadow-indigo-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
