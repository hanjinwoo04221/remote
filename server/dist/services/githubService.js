import { Octokit } from '@octokit/rest';
export class GitHubService {
    static getClient(token) {
        return new Octokit({ auth: token });
    }
    static async verifyToken(token) {
        const octokit = this.getClient(token);
        const { data } = await octokit.rest.users.getAuthenticated();
        return {
            login: data.login,
            name: data.name || data.login,
            avatarUrl: data.avatar_url,
            htmlUrl: data.html_url,
        };
    }
    static async listRepositories(token, search) {
        const octokit = this.getClient(token);
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
            sort: 'updated',
            per_page: 100,
            affiliation: 'owner,collaborator,organization_member',
        });
        let repos = data.map((repo) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            owner: repo.owner.login,
            default_branch: repo.default_branch,
            private: repo.private,
            description: repo.description,
            updated_at: repo.updated_at || '',
        }));
        if (search && search.trim()) {
            const q = search.toLowerCase().trim();
            repos = repos.filter((r) => r.name.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q)));
        }
        return repos;
    }
    static async listBranches(token, owner, repo) {
        const octokit = this.getClient(token);
        const repoInfo = await octokit.rest.repos.get({ owner, repo });
        const defaultBranch = repoInfo.data.default_branch;
        const { data } = await octokit.rest.repos.listBranches({
            owner,
            repo,
            per_page: 100,
        });
        return data.map((b) => ({
            name: b.name,
            commitSha: b.commit.sha,
            isDefault: b.name === defaultBranch,
        }));
    }
    static async getRepoTree(token, owner, repo, branch) {
        const octokit = this.getClient(token);
        try {
            const { data } = await octokit.rest.git.getTree({
                owner,
                repo,
                tree_sha: branch,
                recursive: 'true',
            });
            return (data.tree || [])
                .filter((item) => item.path && item.type)
                .map((item) => ({
                path: item.path,
                type: item.type === 'blob' ? 'file' : 'dir',
                size: item.size,
                sha: item.sha || '',
            }));
        }
        catch (err) {
            // Fallback: If recursive failed (e.g. repo too big), get top level
            const { data } = await octokit.rest.git.getTree({
                owner,
                repo,
                tree_sha: branch,
            });
            return (data.tree || [])
                .filter((item) => item.path && item.type)
                .map((item) => ({
                path: item.path,
                type: item.type === 'blob' ? 'file' : 'dir',
                size: item.size,
                sha: item.sha || '',
            }));
        }
    }
    static async getFileContent(token, owner, repo, path, branch) {
        const octokit = this.getClient(token);
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
            ref: branch,
        });
        if (Array.isArray(data) || !('content' in data)) {
            throw new Error(`Path ${path} is a directory, not a file.`);
        }
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return {
            path,
            content,
            encoding: 'utf-8',
            sha: data.sha,
            size: data.size,
        };
    }
    static async commitAndPush(token, req) {
        const octokit = this.getClient(token);
        const { owner, repo, branch, newBranch, message, changes, createPr, prTitle, prBody } = req;
        if (!changes || changes.length === 0) {
            throw new Error('No changes to commit.');
        }
        // 1. Get branch commit reference
        const refData = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${branch}`,
        });
        const baseCommitSha = refData.data.object.sha;
        // 2. Get base commit to find its tree
        const commitData = await octokit.rest.git.getCommit({
            owner,
            repo,
            commit_sha: baseCommitSha,
        });
        const baseTreeSha = commitData.data.tree.sha;
        // 3. Create blobs or build tree entries
        const treeEntries = [];
        for (const change of changes) {
            if (change.action === 'delete') {
                // To delete a file in GitHub Git Data API, omit sha and content, or use special tree handling
                // Note: For delete, tree entry with sha null deletes it
                continue;
            }
            // Create blob for new/updated content
            const { data: blobData } = await octokit.rest.git.createBlob({
                owner,
                repo,
                content: change.newContent,
                encoding: 'utf-8',
            });
            treeEntries.push({
                path: change.path,
                mode: '100644',
                type: 'blob',
                sha: blobData.sha,
            });
        }
        // 4. Create new tree
        const { data: newTree } = await octokit.rest.git.createTree({
            owner,
            repo,
            base_tree: baseTreeSha,
            tree: treeEntries,
        });
        // 5. Create new commit
        const { data: newCommit } = await octokit.rest.git.createCommit({
            owner,
            repo,
            message,
            tree: newTree.sha,
            parents: [baseCommitSha],
        });
        const targetBranch = newBranch && newBranch.trim() ? newBranch.trim() : branch;
        // 6. Update or create branch ref
        if (newBranch && newBranch.trim() && newBranch.trim() !== branch) {
            await octokit.rest.git.createRef({
                owner,
                repo,
                ref: `refs/heads/${targetBranch}`,
                sha: newCommit.sha,
            });
        }
        else {
            await octokit.rest.git.updateRef({
                owner,
                repo,
                ref: `heads/${branch}`,
                sha: newCommit.sha,
            });
        }
        // 7. If PR requested
        let prUrl;
        let prNumber;
        if (createPr && targetBranch !== branch) {
            const { data: pr } = await octokit.rest.pulls.create({
                owner,
                repo,
                title: prTitle || message,
                body: prBody || `Automated PR generated by GitMobile AI.\n\nChanges:\n${changes.map((c) => `- ${c.path}`).join('\n')}`,
                head: targetBranch,
                base: branch,
            });
            prUrl = pr.html_url;
            prNumber = pr.number;
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
