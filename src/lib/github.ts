export const GITHUB_LOGIN = "ap-1";
const AUTHOR_EMAIL = "i@anish.land";

const API = "https://api.github.com";

export interface ContributionDay {
    date: string;
    level: number;
    count: number;
}

export interface PullRequestSummary {
    repo: string;
    number: number;
    title: string;
    state: "open" | "merged";
    date: Temporal.Instant;
    headSha: string;
}

const LEVELS: Record<string, number> = {
    NONE: 0,
    FIRST_QUARTILE: 1,
    SECOND_QUARTILE: 2,
    THIRD_QUARTILE: 3,
    FOURTH_QUARTILE: 4,
};

async function request(token: string, path: string, accept = "application/vnd.github+json", init?: RequestInit) {
    const res = await fetch(`${API}${path}`, {
        ...init,
        headers: {
            Accept: accept,
            Authorization: `Bearer ${token}`,
            "User-Agent": "anish.land",
            "X-GitHub-Api-Version": "2022-11-28",
            ...init?.headers,
        },
    });
    if (!res.ok) throw new Error(`GitHub ${init?.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
    return res;
}

async function graphql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await request(token, "/graphql", "application/json", {
        method: "POST",
        body: JSON.stringify({ query, variables }),
    });
    const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (body.errors?.length || !body.data) {
        throw new Error(`GitHub GraphQL: ${body.errors?.map((e) => e.message).join("; ") ?? "no data"}`);
    }
    return body.data;
}

export async function fetchContributions(token: string): Promise<ContributionDay[]> {
    const data = await graphql<{
        user: {
            contributionsCollection: {
                contributionCalendar: {
                    weeks: { contributionDays: { date: string; contributionCount: number; contributionLevel: string }[] }[];
                };
            };
        };
    }>(
        token,
        `query ($login: String!) {
            user(login: $login) {
                contributionsCollection {
                    contributionCalendar {
                        weeks { contributionDays { date contributionCount contributionLevel } }
                    }
                }
            }
        }`,
        { login: GITHUB_LOGIN },
    );
    return data.user.contributionsCollection.contributionCalendar.weeks
        .flatMap((w) => w.contributionDays)
        .map((d) => ({ date: d.date, level: LEVELS[d.contributionLevel] ?? 0, count: d.contributionCount }))
        .slice(-365);
}

export async function fetchLatestPullRequests(token: string, count: number): Promise<PullRequestSummary[]> {
    type Search = {
        nodes: {
            number: number;
            title: string;
            createdAt: string;
            mergedAt: string | null;
            headRefOid: string;
            repository: { nameWithOwner: string };
        }[];
    };
    const scope = `is:pr author:${GITHUB_LOGIN} -user:${GITHUB_LOGIN} draft:false sort:updated-desc`;
    const data = await graphql<{ merged: Search; open: Search }>(
        token,
        `query ($merged: String!, $open: String!) {
            merged: search(query: $merged, type: ISSUE, first: 50) { ...prs }
            open: search(query: $open, type: ISSUE, first: 50) { ...prs }
        }
        fragment prs on SearchResultItemConnection {
            nodes {
                ... on PullRequest {
                    number title createdAt mergedAt headRefOid
                    repository { nameWithOwner }
                }
            }
        }`,
        { merged: `${scope} is:merged`, open: `${scope} is:open` },
    );
    const summarize = (state: PullRequestSummary["state"]) => (pr: Search["nodes"][number]) => ({
        repo: pr.repository.nameWithOwner,
        number: pr.number,
        title: pr.title.replaceAll("`", "").trim(),
        state,
        date: Temporal.Instant.from(pr.mergedAt ?? pr.createdAt),
        headSha: pr.headRefOid,
    });
    return [...data.merged.nodes.map(summarize("merged")), ...data.open.nodes.map(summarize("open"))]
        .sort((a, b) => Temporal.Instant.compare(b.date, a.date))
        .slice(0, count);
}

export async function fetchOwnDiff(token: string, pr: PullRequestSummary): Promise<string> {
    const commits: { sha: string; parents: { sha: string }[]; commit: { author: { email: string } | null } }[] = [];
    for (let page = 1; page <= 3; page++) {
        const res = await request(token, `/repos/${pr.repo}/pulls/${pr.number}/commits?per_page=100&page=${page}`);
        const batch = (await res.json()) as typeof commits;
        commits.push(...batch);
        if (batch.length < 100) break;
    }
    const bySha = new Map(commits.map((c) => [c.sha, c]));

    let base: string | null = null;
    for (let c = bySha.get(pr.headSha); c?.commit.author?.email === AUTHOR_EMAIL; c = bySha.get(base)) {
        base = c.parents[0]?.sha ?? null;
        if (!base) break;
    }

    const diffAccept = "application/vnd.github.diff";
    const res = base
        ? await request(token, `/repos/${pr.repo}/compare/${base}...${pr.headSha}`, diffAccept)
        : await request(token, `/repos/${pr.repo}/pulls/${pr.number}`, diffAccept);
    return res.text();
}
