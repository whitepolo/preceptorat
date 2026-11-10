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

function headers(token?: string, write = false): HeadersInit {
  const value: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (write) value["Content-Type"] = "application/json";
  if (token) value.Authorization = `Bearer ${token}`;
  return value;
}

async function readError(response: Response): Promise<string> {
  if (response.status === 401) return "Le jeton est refusé. Il est peut-être expiré ou incomplet.";
  if (response.status === 403) return "Accès refusé. Le jeton doit pouvoir lire et écrire les Issues et le contenu de ce dépôt.";
  if (response.status === 404) return "Introuvable. Le dépôt public whitepolo/preceptorat est-il accessible ?";
  if (response.status === 409) return "Le fichier a changé entre-temps. Nouvelle tentative.";
  if (response.status === 422) return "GitHub a refusé la demande. Vérifie le titre, les étiquettes, ou le contenu.";
  return `GitHub a répondu ${response.status}.`;
}

async function request(path: string, token: string | undefined, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...headers(token, Boolean(init?.body)),
      ...(init?.headers ?? {}),
    },
  });
  return response;
}

export function encodeUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
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

export async function getRepoFile(path: string, token?: string): Promise<RemoteFile | null> {
  const response = await request(`/repos/${REPO}/contents/${path}?ref=main`, token);
  if (response.status === 404) return null;
  if (!response.ok) throw new GithubError(response.status, await readError(response));
  const data = (await response.json()) as { content?: string; sha?: string; encoding?: string };
  if (!data.content || !data.sha) throw new GithubError(response.status, "Réponse GitHub inattendue.");
  return { text: decodeUtf8Base64(data.content), sha: data.sha };
}

export async function putRepoFile(path: string, text: string, sha: string | null, message: string, token: string): Promise<string> {
  const body: Record<string, string> = {
    message,
    content: encodeUtf8Base64(text),
    branch: "main",
  };
  if (sha) body.sha = sha;
  const response = await request(`/repos/${REPO}/contents/${path}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new GithubError(response.status, await readError(response));
  const data = (await response.json()) as { content?: { sha?: string } };
  if (!data.content?.sha) throw new GithubError(response.status, "GitHub n'a pas renvoyé l'empreinte du fichier.");
  return data.content.sha;
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

export async function listIssues(token?: string): Promise<IssueSummary[]> {
  const issues: IssueSummary[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const response = await request(`/repos/${REPO}/issues?state=all&per_page=100&page=${page}`, token);
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

export async function listComments(issueNumber: number, token?: string): Promise<IssueComment[]> {
  const comments: IssueComment[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await request(`/repos/${REPO}/issues/${issueNumber}/comments?per_page=100&page=${page}`, token);
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

async function ensureLabel(name: string, color: string, description: string, token: string): Promise<void> {
  const response = await request(`/repos/${REPO}/labels`, token, {
    method: "POST",
    body: JSON.stringify({ name, color, description }),
  });
  if (response.ok || response.status === 422) return;
  throw new GithubError(response.status, await readError(response));
}

export async function ensureLessonIssue(lessonId: string, token: string): Promise<IssueSummary> {
  const found = (await listIssues(token)).filter((issue) => issue.title === lessonId && issue.labels.includes("leçon"));
  const existing = found.find((issue) => issue.state === "open") ?? found[0];
  if (existing) return existing;
  await ensureLabel("leçon", "3f4f3a", "Fil d'une leçon", token);
  const response = await request(`/repos/${REPO}/issues`, token, {
    method: "POST",
    body: JSON.stringify({
      title: lessonId,
      labels: ["leçon"],
      body: `Fil de la leçon ${lessonId}.\n\nLes réponses de Sébastien sont dans les commentaires, précédées de leur code.\n`,
    }),
  });
  if (!response.ok) throw new GithubError(response.status, await readError(response));
  const item = (await response.json()) as { number: number; title: string; body: string | null; html_url: string; updated_at: string };
  return {
    number: item.number,
    title: item.title,
    body: item.body ?? "",
    html_url: item.html_url,
    updated_at: item.updated_at,
    labels: ["leçon"],
    state: "open",
  };
}

export async function ensureDialogueIssue(token: string): Promise<IssueSummary> {
  const found = (await listIssues(token)).filter((issue) => issue.labels.includes("dialogue"));
  const existing = found.find((issue) => issue.state === "open") ?? found[0];
  if (existing) return existing;
  await ensureLabel("dialogue", "7a3b2e", "Conversation libre avec le précepteur", token);
  const response = await request(`/repos/${REPO}/issues`, token, {
    method: "POST",
    body: JSON.stringify({
      title: "Dialogue",
      labels: ["dialogue"],
      body: "Conversation libre entre Sébastien et Schopen.\n",
    }),
  });
  if (!response.ok) throw new GithubError(response.status, await readError(response));
  const item = (await response.json()) as { number: number; title: string; body: string | null; html_url: string; updated_at: string };
  return {
    number: item.number,
    title: item.title,
    body: item.body ?? "",
    html_url: item.html_url,
    updated_at: item.updated_at,
    labels: ["dialogue"],
    state: "open",
  };
}

export async function postComment(issueNumber: number, body: string, token: string): Promise<IssueComment> {
  const response = await request(`/repos/${REPO}/issues/${issueNumber}/comments`, token, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  if (!response.ok) throw new GithubError(response.status, await readError(response));
  const item = (await response.json()) as {
    id: number;
    body: string;
    created_at: string;
    html_url: string;
    user: { login: string } | null;
  };
  return {
    id: item.id,
    body: item.body,
    created_at: item.created_at,
    html_url: item.html_url,
    author: item.user?.login ?? "Sébastien",
  };
}

export async function testConnection(token: string): Promise<{ login: string; repo: string }> {
  const userResponse = await request("/user", token);
  if (!userResponse.ok) throw new GithubError(userResponse.status, await readError(userResponse));
  const user = (await userResponse.json()) as { login?: string };
  const repoResponse = await request(`/repos/${REPO}`, token);
  if (!repoResponse.ok) throw new GithubError(repoResponse.status, await readError(repoResponse));
  return { login: user.login ?? "compte", repo: REPO };
}
