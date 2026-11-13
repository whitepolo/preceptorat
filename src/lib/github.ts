export const REPO_OWNER = "whitepolo";
export const REPO_NAME = "preceptorat";
export const REPO = `${REPO_OWNER}/${REPO_NAME}`;
export const REVIEW_PATH = "content/etat/revisions.json";

const API = "https://api.github.com";

export class GithubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GithubError";
    this.status = status;
  }
}

function headers(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function readError(response: Response): Promise<string> {
  if (response.status === 403 || response.status === 429) return "GitHub limite les lectures publiques pour le moment. Réessaie dans une minute.";
  if (response.status === 404) return "Introuvable. Le dépôt public whitepolo/preceptorat est-il accessible ?";
  return `GitHub a répondu ${response.status}.`;
}

async function request(path: string): Promise<Response> {
  return fetch(`${API}${path}`, { headers: headers() });
}

export function decodeUtf8Base64(value: string): string {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export interface RemoteFile {
  text: string;
  sha: string;
}

export async function getRepoFile(path: string): Promise<RemoteFile | null> {
  const response = await request(`/repos/${REPO}/contents/${path}?ref=main`);
  if (response.status === 404) return null;
  if (!response.ok) throw new GithubError(response.status, await readError(response));
  const data = (await response.json()) as { content?: string; sha?: string; encoding?: string };
  if (!data.content || !data.sha) throw new GithubError(response.status, "Réponse GitHub inattendue.");
  return { text: decodeUtf8Base64(data.content), sha: data.sha };
}

export interface IssueSummary {
  number: number;
  title: string;
  body: string;
  labels: string[];
  html_url: string;
  updated_at: string;
  state: "open" | "closed";
}

export interface IssueComment {
  id: number;
  body: string;
  created_at: string;
  html_url: string;
  author: string;
}

export async function listIssues(): Promise<IssueSummary[]> {
  const issues: IssueSummary[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const response = await request(`/repos/${REPO}/issues?state=all&per_page=100&page=${page}`);
    if (!response.ok) throw new GithubError(response.status, await readError(response));
    const data = (await response.json()) as Array<{
      number: number;
      title: string;
      body: string | null;
      html_url: string;
      updated_at: string;
      pull_request?: unknown;
      labels: Array<{ name?: string } | string>;
      state: "open" | "closed";
    }>;
    for (const item of data) {
      if (item.pull_request) continue;
      issues.push({
        number: item.number,
        title: item.title,
        body: item.body ?? "",
        html_url: item.html_url,
        updated_at: item.updated_at,
        state: item.state,
        labels: item.labels.map((label) => (typeof label === "string" ? label : label.name ?? "")),
      });
    }
    if (data.length < 100) break;
  }
  return issues;
}

export interface RecentComment {
  id: number;
  body: string;
  created_at: string;
  html_url: string;
  issue_number: number;
}

export async function listRecentComments(): Promise<RecentComment[]> {
  const response = await request(`/repos/${REPO}/issues/comments?sort=created&direction=desc&per_page=30`);
  if (!response.ok) throw new GithubError(response.status, await readError(response));
  const data = (await response.json()) as Array<{
    id: number;
    body: string | null;
    created_at: string;
    html_url: string;
    issue_url?: string;
  }>;
  return data.map((item) => {
    const match = /\/issues\/(\d+)$/.exec(item.issue_url ?? "");
    return {
      id: item.id,
      body: item.body ?? "",
      created_at: item.created_at,
      html_url: item.html_url,
      issue_number: match ? Number(match[1]) : 0,
    };
  });
}

export async function listComments(issueNumber: number): Promise<IssueComment[]> {
  const comments: IssueComment[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await request(`/repos/${REPO}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    if (!response.ok) throw new GithubError(response.status, await readError(response));
    const data = (await response.json()) as Array<{
      id: number;
      body: string;
      created_at: string;
      html_url: string;
      user: { login: string } | null;
    }>;
    for (const item of data) {
      comments.push({
        id: item.id,
        body: item.body ?? "",
        created_at: item.created_at,
        html_url: item.html_url,
        author: item.user?.login ?? "quelqu'un",
      });
    }
    if (data.length < 100) break;
  }
  return comments;
}

