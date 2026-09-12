import { Repository, Branch, RepoTreeItem, FileContent, CommitRequest } from '../types.js';

const GITHUB_API = 'https://api.github.com';

export class DirectGitHubService {
  private static getHeaders(token: string): HeadersInit {
    return {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
    };
  }

  static async verifyToken(token: string) {
    const res = await fetch(`${GITHUB_API}/user`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'GitHub 토큰이 유효하지 않습니다.');
    }
    const data = await res.json();
    return {
      login: data.login,
      name: data.name || data.login,
      avatarUrl: data.avatar_url,
      htmlUrl: data.html_url,
    };
  }

  static async getRepositories(token: string, search?: string): Promise<Repository[]> {
    const res = await fetch(
      `${GITHUB_API}/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member`,
      { headers: this.getHeaders(token) }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || '저장소 목록을 불러오지 못했습니다.');
    }
    const data = await res.json();
    let repos: Repository[] = data.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      owner: r.owner.login,
      default_branch: r.default_branch,
      private: r.private,
      description: r.description,
      updated_at: r.updated_at || '',
    }));

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      repos = repos.filter(
        (r) => r.name.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q))
      );
    }
    return repos;
  }

  static async getBranches(token: string, owner: string, repo: string): Promise<Branch[]> {
    // Get repo default branch first
    const repoRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: this.getHeaders(token),
    });
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch || 'main';

    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/branches?per_page=100`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || '브랜치 목록을 불러오지 못했습니다.');
    }
    const data = await res.json();
    return data.map((b: any) => ({
      name: b.name,
      commitSha: b.commit.sha,
      isDefault: b.name === defaultBranch,
    }));
  }

  static async getTree(
    token: string,
    owner: string,
    repo: string,
    branch: string
  ): Promise<RepoTreeItem[]> {
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers: this.getHeaders(token) }
    );
    if (!res.ok) {
      // Fallback without recursive
      const fallback = await fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}`,
        { headers: this.getHeaders(token) }
      );
      if (!fallback.ok) {
        throw new Error('파일 트리를 불러오지 못했습니다.');
      }
      const data = await fallback.json();
      return (data.tree || [])
        .filter((i: any) => i.path && i.type)
        .map((i: any) => ({
          path: i.path,
          type: i.type === 'blob' ? 'file' : 'dir',
          size: i.size,
          sha: i.sha,
        }));
    }
    const data = await res.json();
    return (data.tree || [])
      .filter((i: any) => i.path && i.type)
      .map((i: any) => ({
        path: i.path,
        type: i.type === 'blob' ? 'file' : 'dir',
        size: i.size,
        sha: i.sha,
      }));
  }

  static async getFile(
    token: string,
    owner: string,
    repo: string,
    branch: string,
    path: string
  ): Promise<FileContent> {
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
      { headers: this.getHeaders(token) }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `파일 ${path}을(를) 읽을 수 없습니다.`);
    }
    const data = await res.json();
    if (Array.isArray(data) || !data.content) {
      throw new Error(`${path}은(는) 파일이 아닙니다.`);
    }

    // Decode base64 to utf8 in browser
    const cleanB64 = data.content.replace(/\s/g, '');
    const binary = atob(cleanB64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const content = new TextDecoder('utf-8').decode(bytes);

    return {
      path,
      content,
      encoding: 'utf-8',
      sha: data.sha,
      size: data.size,
    };
  }

  static async commitAndPush(token: string, req: CommitRequest) {
    const { owner, repo, branch, newBranch, message, changes, createPr, prTitle, prBody } = req;
    if (!changes || changes.length === 0) {
      throw new Error('커밋할 변경사항이 없습니다.');
    }

    const headers = this.getHeaders(token);

    // 1. Get branch commit reference
    const refRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
      headers,
    });
    if (!refRes.ok) {
      throw new Error(`브랜치 ref/heads/${branch} 정보를 가져오지 못했습니다.`);
    }
    const refData = await refRes.json();
    const baseCommitSha = refData.object.sha;

    // 2. Get base commit to get tree SHA
    const commitRes = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
      { headers }
    );
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Create blobs for modified/created files
    const treeEntries: Array<{
      path: string;
      mode: string;
      type: string;
      sha: string;
    }> = [];

    for (const change of changes) {
      if (change.action === 'delete') continue;

      const blobRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: change.newContent,
          encoding: 'utf-8',
        }),
      });
      if (!blobRes.ok) {
        throw new Error(`파일 ${change.path}의 Git Blob 생성에 실패했습니다.`);
      }
      const blobData = await blobRes.json();

      treeEntries.push({
        path: change.path,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha,
      });
    }

    // 4. Create new Git Tree
    const treeRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries,
      }),
    });
    if (!treeRes.ok) {
      throw new Error('새 Git Tree 생성에 실패했습니다.');
    }
    const newTree = await treeRes.json();

    // 5. Create new Commit
    const newCommitRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        tree: newTree.sha,
        parents: [baseCommitSha],
      }),
    });
    if (!newCommitRes.ok) {
      throw new Error('새 커밋 생성에 실패했습니다.');
    }
    const newCommit = await newCommitRes.json();

    const targetBranch = newBranch && newBranch.trim() ? newBranch.trim() : branch;

    // 6. Create new branch or update current branch
    if (newBranch && newBranch.trim() && newBranch.trim() !== branch) {
      const createRefRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${targetBranch}`,
          sha: newCommit.sha,
        }),
      });
      if (!createRefRes.ok) {
        throw new Error(`새 브랜치 ${targetBranch} 생성에 실패했습니다.`);
      }
    } else {
      const updateRefRes = await fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            sha: newCommit.sha,
          }),
        }
      );
      if (!updateRefRes.ok) {
        throw new Error(`브랜치 ${branch} 업데이트에 실패했습니다.`);
      }
    }

    // 7. Create Pull Request if requested
    let prUrl: string | undefined;
    let prNumber: number | undefined;

    if (createPr && targetBranch !== branch) {
      const prRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: prTitle || message,
          body: prBody || `Automated PR generated by GitMobile AI.\n\nChanges:\n${changes.map((c) => `- ${c.path}`).join('\n')}`,
          head: targetBranch,
          base: branch,
        }),
      });
      if (prRes.ok) {
        const prData = await prRes.json();
        prUrl = prData.html_url;
        prNumber = prData.number;
      }
    }

    return {
      commitSha: newCommit.sha,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
      targetBranch,
      prUrl,
      prNumber,
    };
  }
}
