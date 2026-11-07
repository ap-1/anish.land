import { drizzle } from "drizzle-orm/d1";

import { contributionDays, pullRequests } from "@/db/schema";
import { bestWindow, parseDiff } from "@/lib/diffart";
import { fetchContributions, fetchLatestPullRequests, fetchOwnDiff, type PullRequestSummary } from "@/lib/github";

const PR_COUNT = 12;
const D1_MAX_BOUND_PARAMS = 100;

type PullRequestRow = typeof pullRequests.$inferInsert;

function chunk<T>(items: T[], columns: number): T[][] {
    const size = Math.floor(D1_MAX_BOUND_PARAMS / columns);
    return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

async function toRow(token: string, pr: PullRequestSummary, previous: PullRequestRow | undefined): Promise<PullRequestRow | null> {
    const listing = {
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        date: new Date(pr.date.epochMilliseconds),
        headSha: pr.headSha,
    };
    if (previous?.headSha === pr.headSha) return { ...previous, ...listing };
    try {
        const { hunks, additions, deletions } = parseDiff(await fetchOwnDiff(token, pr));
        const window = bestWindow(hunks);
        return window ? { ...listing, additions, deletions, window } : null;
    } catch (error) {
        console.error(`skipping diff for ${pr.repo}#${pr.number}`, error);
        return previous ? { ...previous, ...listing, headSha: previous.headSha } : null;
    }
}

export async function syncGitHub(env: Env): Promise<void> {
    const token = env.GITHUB_TOKEN;
    const db = drizzle(env.DB);

    const [days, latest, existing] = await Promise.all([
        fetchContributions(token),
        fetchLatestPullRequests(token, PR_COUNT),
        db.select().from(pullRequests),
    ]);
    const known = new Map(existing.map((row) => [`${row.repo}#${row.number}`, row]));
    const rows = (await Promise.all(latest.map((pr) => toRow(token, pr, known.get(`${pr.repo}#${pr.number}`))))).filter(
        (row) => row !== null,
    );

    await db.batch([
        db.delete(contributionDays),
        ...chunk(days, 3).map((part) => db.insert(contributionDays).values(part)),
        db.delete(pullRequests),
        ...chunk(rows, 9).map((part) => db.insert(pullRequests).values(part)),
    ]);
}
