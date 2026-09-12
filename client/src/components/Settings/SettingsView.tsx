import React, { useState, useEffect } from 'react';
import {
  Key,
  FolderGit2,
  Sparkles,
  Smartphone,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Save,
  QrCode,
  Eye,
  EyeOff,
} from 'lucide-react';
import { UserSettings } from '../../types.js';
import { ApiService } from '../../services/api.js';

const GitHubIcon = () => (
  <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

interface SettingsViewProps {
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave }) => {
  const [githubToken, setGithubToken] = useState(settings.githubToken);
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey);
  const [modelName, setModelName] = useState(settings.modelName || 'gemini-2.5-flash');
  const [connectionMode, setConnectionMode] = useState<'direct' | 'proxy'>(
    settings.connectionMode || 'direct'
  );

  const [showGithubToken, setShowGithubToken] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [githubUser, setGithubUser] = useState<{ login: string; avatarUrl: string } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [localIpInfo, setLocalIpInfo] = useState<{ localIp: string; mobileUrl: string } | null>(
    null
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    ApiService.getHealth()
      .then((data) => {
        setLocalIpInfo({ localIp: data.localIp, mobileUrl: data.mobileUrl });
      })
      .catch(() => {});

    if (settings.githubToken) {
      handleVerifyToken(settings.githubToken);
    }
  }, []);

  const handleVerifyToken = async (token: string) => {
    if (!token) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const user = await ApiService.verifyGitHubToken(token);
      setGithubUser(user);
    } catch (err: any) {
      setVerifyError(err.message || '토큰 검증 실패');
      setGithubUser(null);
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = () => {
    onSave({
      githubToken: githubToken.trim(),
      geminiApiKey: geminiApiKey.trim(),
      modelName,
      connectionMode,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-md mx-auto overflow-y-auto p-4 space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-white">애플리케이션 설정</h2>
        <p className="text-xs text-slate-400">
          GitHub 및 Gemini API 인증 정보를 설정하여 모바일 AI 에이전트를 활성화합니다.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>설정이 안전하게 저장되었습니다.</span>
        </div>
      )}

      {/* Connection Mode Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-white">동작 모드 설정</h3>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              connectionMode === 'direct'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {connectionMode === 'direct' ? '⚡ 데스크탑 불필요 (단독 모드)' : '🖥️ PC 프록시'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setConnectionMode('direct')}
            className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-colors text-center ${
              connectionMode === 'direct'
                ? 'bg-emerald-600 text-white shadow font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚡ 모바일 단독 모드
          </button>
          <button
            type="button"
            onClick={() => setConnectionMode('proxy')}
            className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-colors text-center ${
              connectionMode === 'proxy'
                ? 'bg-indigo-600 text-white shadow font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🖥️ PC 서버 모드
          </button>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          {connectionMode === 'direct' ? (
            <>
              ⭐️ <strong>데스크탑이 꺼져 있어도 스마트폰 혼자서 100% 작동합니다.</strong> 브라우저에서 GitHub API와 Gemini API를 직접 호출합니다.
            </>
          ) : (
            <>
              PC에서 구동 중인 로컬 Node.js 백엔드 서버를 통해 통신합니다. (PC 전원이 켜져 있어야 합니다)
            </>
          )}
        </p>
      </div>

      {/* GitHub Token Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitHubIcon />
            <h3 className="text-xs font-semibold text-white">GitHub Access Token</h3>
          </div>
          <a
            href="https://github.com/settings/tokens/new?scopes=repo,read:user"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            <span>토큰 발급하기</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="relative">
          <input
            type={showGithubToken ? 'text' : 'password'}
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-10 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={() => setShowGithubToken(!showGithubToken)}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
          >
            {showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {githubUser ? (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 p-2 rounded-xl">
            <img src={githubUser.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
            <span>
              인증 성공: <strong className="text-white">{githubUser.login}</strong>
            </span>
          </div>
        ) : verifyError ? (
          <div className="text-[11px] text-rose-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{verifyError}</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => handleVerifyToken(githubToken)}
          disabled={verifying || !githubToken}
          className="text-xs py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
        >
          {verifying ? '검증 중...' : '토큰 유효성 검사'}
        </button>
      </div>

      {/* Gemini API Key Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-semibold text-white">Google Gemini API Key</h3>
          </div>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            <span>무료 키 발급 (AI Studio)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="relative">
          <input
            type={showGeminiKey ? 'text' : 'password'}
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-10 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={() => setShowGeminiKey(!showGeminiKey)}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
          >
            {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Model Selection */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs text-slate-300 font-medium">기본 AI 모델</label>
          <select
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (권장: 빠른 속도 및 도구 실행)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro (복잡한 아키텍처 및 대형 코드)</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
          </select>
        </div>
      </div>

      {/* Mobile Access Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-white">모바일 기기 접속 방법</h3>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          스마트폰과 PC를 동일한 Wi-Fi(공유기)에 연결한 뒤, 모바일 브라우저로 아래 주소에 접속하세요:
        </p>

        {localIpInfo && (
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-300 select-all break-all">
            {localIpInfo.mobileUrl}
          </div>
        )}

        <div className="text-[11px] text-slate-400 space-y-1 pt-1">
          <p>💡 <strong>팁</strong>: PC 터미널에 출력된 QR 코드를 카메라로 스캔하면 즉시 열립니다.</p>
          <p>📲 <strong>PWA 설치</strong>: Safari 또는 Chrome에서 "홈 화면에 추가"를 누르면 네이티브 앱처럼 전체화면으로 실행할 수 있습니다.</p>
        </div>
      </div>

      {/* Save Button */}
      <button
        type="button"
        onClick={handleSave}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
      >
        <Save className="w-4 h-4" />
        <span>설정 저장하기</span>
      </button>
    </div>
  );
};
