import { asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { contributionDays, notes, projects, pullRequests } from "@/db/schema";
import type { ContributionDay } from "@/lib/github";

export const SCENES = [
    "sunset",
    "clouds",
    "hills",
    "night",
    "mountains",
    "meadow",
    "sea",
    "blossom",
    "dunes",
    "lighthouse",
    "city",
    "sunflowers",
    "aurora",
    "winter",
    "autumn",
    "balloons",
    "planet",
    "reef",
    "rainbow",
    "campsite",
] as const;

export type HomeCard =
    | {
          kind: "pr";
          url: string;
          repo: string;
          number: number;
          title: string;
          state: "open" | "merged";
          date: string;
          additions: number;
          deletions: number;
          art: { light: string; dark: string };
      }
    | { kind: "project"; url: string; name: string; description: string };

export interface Project {
    name: string;
    description: string;
    url: string;
}

export interface Postcard {
    id: number;
    content: string;
    scene: number;
    date: Temporal.PlainDate;
}

const utcDate = (date: Date) => Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO("UTC").toPlainDate();

export const shortDate = (date: Temporal.PlainDate) =>
    date.toLocaleString("en-US", { month: "short", day: "numeric" }).toLowerCase();

export function getProjects(db: D1Database): Promise<Project[]> {
    return drizzle(db)
        .select({ name: projects.name, description: projects.description, url: projects.url })
        .from(projects)
        .orderBy(asc(projects.position), asc(projects.id));
}

export async function getHomeColumns(db: D1Database): Promise<[HomeCard[], HomeCard[]]> {
    const [prs, projectRows] = await Promise.all([
        drizzle(db).select().from(pullRequests).orderBy(desc(pullRequests.date)),
        getProjects(db),
    ]);

    const prCards: HomeCard[] = prs.map((pr) => {
        const art = `/art/pr/${pr.repo}/${pr.number}`;
        const v = pr.headSha.slice(0, 12);
        return {
            kind: "pr",
            url: `https://github.com/${pr.repo}/pull/${pr.number}`,
            repo: pr.repo,
            number: pr.number,
            title: pr.title,
            state: pr.state,
            date: shortDate(utcDate(pr.date)),
            additions: pr.additions,
            deletions: pr.deletions,
            art: { light: `${art}/light.png?v=${v}`, dark: `${art}/dark.png?v=${v}` },
        };
    });

    const projectCards: HomeCard[] = projectRows.map((project) => ({ kind: "project", ...project }));

    const placed = [
        ...prCards.map((card, i) => ({ card, at: (i + 0.5) / prCards.length })),
        ...projectCards.map((card, i) => ({ card, at: (i + 0.25) / projectCards.length })),
    ].sort((a, b) => a.at - b.at);

    const columns: [HomeCard[], HomeCard[]] = [[], []];
    placed.forEach(({ card }, i) => columns[i % 2].push(card));
    return columns;
}

export async function getContributionYear(db: D1Database): Promise<ContributionDay[]> {
    const rows = await drizzle(db).select().from(contributionDays).orderBy(asc(contributionDays.date));
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const last = rows.length ? Temporal.PlainDate.from(rows[rows.length - 1].date) : Temporal.Now.plainDateISO("UTC");
    return Array.from({ length: 365 }, (_, i) => {
        const date = last.subtract({ days: 364 - i }).toString();
        return byDate.get(date) ?? { date, level: 0, count: 0 };
    });
}

export async function getPostcards(db: D1Database): Promise<Postcard[]> {
    const rows = await drizzle(db)
        .select({ id: notes.id, content: notes.content, scene: notes.scene, createdAt: notes.createdAt })
        .from(notes)
        .where(eq(notes.status, "approved"))
        .orderBy(desc(notes.createdAt), desc(notes.id));
    return rows.map(({ createdAt, ...row }) => ({ ...row, date: utcDate(createdAt) }));
}
