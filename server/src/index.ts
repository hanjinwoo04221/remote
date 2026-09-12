import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import qrcode from 'qrcode-terminal';
import { GitHubService } from './services/githubService.js';
import { AgentService } from './services/agentService.js';
import { CommitRequest } from './types.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const CLIENT_PORT = 5173;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Helper: Get local IP for mobile access
function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  const localIp = getLocalIpAddress();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    localIp,
    mobileUrl: `http://${localIp}:${CLIENT_PORT}`,
  });
});

// GitHub: Verify token
app.post('/api/github/auth', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required.' });
    }
    const user = await GitHubService.verifyToken(token);
    res.json(user);
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Invalid GitHub token.' });
  }
});

// GitHub: List repositories
app.get('/api/github/repos', async (req: Request, res: Response) => {
  try {
    const token = (req.headers.authorization?.replace('Bearer ', '') || req.query.token) as string;
    const search = req.query.search as string | undefined;
    if (!token) {
      return res.status(401).json({ error: 'GitHub token is required.' });
    }
    const repos = await GitHubService.listRepositories(token, search);
    res.json(repos);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list repositories.' });
  }
});

// GitHub: List branches
app.get('/api/github/branches', async (req: Request, res: Response) => {
  try {
    const token = (req.headers.authorization?.replace('Bearer ', '') || req.query.token) as string;
    const { owner, repo } = req.query as { owner: string; repo: string };
    if (!token || !owner || !repo) {
      return res.status(400).json({ error: 'token, owner, and repo are required.' });
    }
    const branches = await GitHubService.listBranches(token, owner, repo);
    res.json(branches);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list branches.' });
  }
});

// GitHub: Get repository tree
app.get('/api/github/tree', async (req: Request, res: Response) => {
  try {
    const token = (req.headers.authorization?.replace('Bearer ', '') || req.query.token) as string;
    const { owner, repo, branch } = req.query as { owner: string; repo: string; branch: string };
    if (!token || !owner || !repo || !branch) {
      return res.status(400).json({ error: 'token, owner, repo, and branch are required.' });
    }
    const tree = await GitHubService.getRepoTree(token, owner, repo, branch);
    res.json(tree);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get file tree.' });
  }
});

// GitHub: Get single file content
app.get('/api/github/file', async (req: Request, res: Response) => {
  try {
    const token = (req.headers.authorization?.replace('Bearer ', '') || req.query.token) as string;
    const { owner, repo, branch, path } = req.query as {
      owner: string;
      repo: string;
      branch: string;
      path: string;
    };
    if (!token || !owner || !repo || !branch || !path) {
      return res.status(400).json({ error: 'token, owner, repo, branch, and path are required.' });
    }
    const file = await GitHubService.getFileContent(token, owner, repo, path, branch);
    res.json(file);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to read file.' });
  }
});

// GitHub: Commit & push changes
app.post('/api/github/commit', async (req: Request, res: Response) => {
  try {
    const token = (req.headers.authorization?.replace('Bearer ', '') || req.body.token) as string;
    const commitReq = req.body as CommitRequest;
    if (!token) {
      return res.status(401).json({ error: 'GitHub token is required.' });
    }
    const result = await GitHubService.commitAndPush(token, commitReq);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to commit and push.' });
  }
});

// Agent: Run AI Agent with SSE streaming
app.post('/api/agent/run', async (req: Request, res: Response) => {
  const {
    geminiApiKey: clientKey,
    githubToken: clientToken,
    owner,
    repo,
    branch,
    prompt,
    modelName,
  } = req.body;

  const geminiApiKey = clientKey || process.env.GEMINI_API_KEY;
  const githubToken = clientToken || process.env.GITHUB_TOKEN;

  if (!geminiApiKey) {
    return res.status(400).json({
      error: 'Gemini API Key is required. Provide it in Settings or .env',
    });
  }

  if (!githubToken || !owner || !repo || !branch || !prompt) {
    return res.status(400).json({
      error: 'Missing required parameters (githubToken, owner, repo, branch, prompt).',
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    await AgentService.run({
      geminiApiKey,
      githubToken,
      owner,
      repo,
      branch,
      prompt,
      modelName,
      onEvent: (event) => sendEvent(event),
    });
  } catch (err: any) {
    sendEvent({
      type: 'error',
      content: err.message || String(err),
    });
  } finally {
    res.write('event: close\ndata: {}\n\n');
    res.end();
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  const mobileUrl = `http://${localIp}:${CLIENT_PORT}`;
  const serverUrl = `http://${localIp}:${PORT}`;

  console.log('='.repeat(50));
  console.log(`🚀 GitMobile AI Backend Server running at:`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: ${serverUrl}`);
  console.log(`\n📱 Mobile Frontend available at:`);
  console.log(`   ${mobileUrl}`);
  console.log('\n📲 Scan this QR code on your smartphone to open:');
  console.log('='.repeat(50));

  try {
    qrcode.generate(mobileUrl, { small: true });
  } catch {
    console.log(`(QR code generation skipped)`);
  }
  console.log('='.repeat(50));
});
