/**
 * GitHub OSINT module — enriches GitHub profile data
 * Uses public GitHub API (60 req/hr) or authenticated (5000 req/hr with token)
 */
import { getSetting } from "./settingsService";

const UA = "LYOSINT-OSINT-Bot/3.0";

interface GHHeaders extends Record<string, string> {
  "User-Agent": string;
  Accept: string;
  Authorization?: string;
}

async function ghFetch(path: string, token?: string): Promise<unknown> {
  const headers: GHHeaders = {
    "User-Agent": UA,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://api.github.com${path}`, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res.json();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export interface GitHubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  blog: string | null;
  twitterUsername: string | null;
  avatar: string;
  followers: number;
  following: number;
  publicRepos: number;
  publicGists: number;
  createdAt: string;
  updatedAt: string;
  hireable: boolean | null;
  profileUrl: string;
  topRepos: Array<{ name: string; description: string | null; language: string | null; stars: number; forks: number; url: string }>;
  languages: string[];
  organizations: string[];
  totalStars: number;
  rateLimit: { remaining: number; limit: number } | null;
}

export async function getGitHubProfile(username: string): Promise<GitHubProfile | null> {
  const token = await getSetting("github_token");

  const [user, repos, orgs] = await Promise.all([
    ghFetch(`/users/${encodeURIComponent(username)}`, token ?? undefined) as Promise<any>,
    ghFetch(`/users/${encodeURIComponent(username)}/repos?per_page=30&sort=stars`, token ?? undefined) as Promise<any[]>,
    ghFetch(`/users/${encodeURIComponent(username)}/orgs`, token ?? undefined) as Promise<any[]>,
  ]);

  if (!user?.login) return null;

  const repoList = Array.isArray(repos) ? repos : [];
  const orgList = Array.isArray(orgs) ? orgs : [];

  // Extract top repos
  const topRepos = repoList
    .filter((r: any) => !r.fork)
    .sort((a: any, b: any) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, 8)
    .map((r: any) => ({
      name: r.name,
      description: r.description ?? null,
      language: r.language ?? null,
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      url: r.html_url,
    }));

  // Extract unique languages
  const langCounts: Record<string, number> = {};
  for (const r of repoList) {
    if (r.language) langCounts[r.language] = (langCounts[r.language] ?? 0) + 1;
  }
  const languages = Object.entries(langCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([lang]) => lang);

  // Total stars
  const totalStars = repoList.reduce((s: number, r: any) => s + (r.stargazers_count ?? 0), 0);

  return {
    login: user.login,
    name: user.name ?? null,
    bio: user.bio ?? null,
    company: user.company ?? null,
    location: user.location ?? null,
    email: user.email ?? null,
    blog: user.blog ?? null,
    twitterUsername: user.twitter_username ?? null,
    avatar: user.avatar_url,
    followers: user.followers ?? 0,
    following: user.following ?? 0,
    publicRepos: user.public_repos ?? 0,
    publicGists: user.public_gists ?? 0,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    hireable: user.hireable ?? null,
    profileUrl: user.html_url,
    topRepos,
    languages,
    organizations: orgList.map((o: any) => o.login),
    totalStars,
    rateLimit: null,
  };
}

export async function searchGitHubByName(name: string): Promise<Array<{ login: string; avatar: string; url: string; type: string }>> {
  const token = await getSetting("github_token");
  const data = await ghFetch(
    `/search/users?q=${encodeURIComponent(name)}&per_page=5`,
    token ?? undefined,
  ) as any;
  if (!data?.items) return [];
  return data.items.map((u: any) => ({
    login: u.login, avatar: u.avatar_url, url: u.html_url, type: u.type,
  }));
}
