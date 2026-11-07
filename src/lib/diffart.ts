export type DiffKind = "ctx" | "add" | "del";
export type DiffLine = [DiffKind, string];
export type ArtTheme = "light" | "dark";

export const ART_W = 80;
export const ART_H = 40;

const WINDOW = 6;
const PITCH = 5;
const TOP = 3;
const X_CODE = 14;
const MAX_W = ART_W - X_CODE - 2;
const FADE_START = 26;
const FADE_END = 35;
const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
];

type RGB = readonly [number, number, number];

const hex = (h: string): RGB => [
    Number.parseInt(h.slice(1, 3), 16),
    Number.parseInt(h.slice(3, 5), 16),
    Number.parseInt(h.slice(5, 7), 16),
];

const PALETTES = {
    light: {
        fill: hex("#fafafa"),
        grey: hex("#c4cbd3"),
        gutter: hex("#e3e8ee"),
        addBg: hex("#dafbe1"),
        addFg: hex("#3fb563"),
        delBg: hex("#ffebe9"),
        delFg: hex("#f47a7a"),
    },
    dark: {
        fill: hex("#181b21"),
        grey: hex("#3d444d"),
        gutter: hex("#2a3038"),
        addBg: hex("#12301c"),
        addFg: hex("#3fb950"),
        delBg: hex("#3a161a"),
        delFg: hex("#f85149"),
    },
} as const;

const PY_LINE_BREAK = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/;
const PY_WS = "\t\n\v\f\r\x1c\x1d\x1e\x1f \x85\xa0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000";

function rstrip(s: string): string {
    let end = s.length;
    while (end > 0 && PY_WS.includes(s[end - 1])) end--;
    return s.slice(0, end);
}

function isBlank(s: string): boolean {
    for (const ch of s) if (!PY_WS.includes(ch)) return false;
    return true;
}

const pyLen = (s: string): number => {
    let n = 0;
    for (const _ of s) n++;
    return n;
};

function pyRound(x: number): number {
    const f = Math.floor(x);
    const d = x - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
}

export interface ParsedDiff {
    hunks: DiffLine[][];
    additions: number;
    deletions: number;
}

export function parseDiff(diff: string): ParsedDiff {
    const hunks: DiffLine[][] = [];
    let cur: DiffLine[] | null = null;
    let additions = 0;
    let deletions = 0;
    const lines = diff.split(PY_LINE_BREAK);
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    for (const raw of lines) {
        if (raw.startsWith("diff --git")) {
            cur = null;
            continue;
        }
        if (raw.startsWith("@@")) {
            cur = [];
            hunks.push(cur);
            continue;
        }
        if (cur === null || raw.startsWith("+++") || raw.startsWith("---") || raw.startsWith("\\")) continue;
        if (raw.startsWith("+")) {
            cur.push(["add", raw.slice(1)]);
            additions++;
        } else if (raw.startsWith("-")) {
            cur.push(["del", raw.slice(1)]);
            deletions++;
        } else {
            cur.push(["ctx", raw.startsWith(" ") ? raw.slice(1) : raw]);
        }
    }
    return { hunks, additions, deletions };
}

function score(win: DiffLine[]): number | null {
    if (!win.some(([k]) => k !== "ctx")) return null;
    let transitions = 0;
    for (let i = 1; i < win.length; i++) if (win[i][0] !== win[i - 1][0]) transitions++;
    const distinct = new Set(win.map(([k]) => k)).size;
    const nonBlank = win.filter(([, t]) => !isBlank(t)).length;
    const lens = win.map(([, t]) => pyLen(rstrip(t)));
    let spread = 0;
    if (lens.length > 1) {
        const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
        const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
        spread = Math.min(1, Math.sqrt(variance) / 20);
    }
    return transitions * 2 + distinct * 1.5 + nonBlank * 0.5 + spread;
}

export function bestWindow(hunks: DiffLine[][]): DiffLine[] | null {
    let best: { score: number; win: DiffLine[] } | null = null;
    for (const h of hunks) {
        const candidates =
            h.length < WINDOW
                ? h.length
                    ? [h]
                    : []
                : Array.from({ length: h.length - WINDOW + 1 }, (_, i) => h.slice(i, i + WINDOW));
        for (const w of candidates) {
            const s = score(w);
            if (s !== null && (best === null || s > best.score)) best = { score: s, win: w };
        }
    }
    return best?.win ?? null;
}

export function drawDiffArt(win: DiffLine[], theme: ArtTheme): Uint8Array {
    const p = PALETTES[theme];
    const px = new Uint8Array(ART_W * ART_H * 3);
    const base: RGB = theme === "light" ? [255, 255, 255] : p.fill;
    const put = (x: number, y: number, c: RGB) => {
        const i = (y * ART_W + x) * 3;
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
    };
    for (let y = 0; y < ART_H; y++) for (let x = 0; x < ART_W; x++) put(x, y, base);

    const expanded = win.map(([k, t]) => [k, rstrip(t.replaceAll("\t", "    "))] as const);
    const longest = Math.max(1, ...expanded.map(([, t]) => pyLen(t))) || 1;
    const scale = Math.min(1, MAX_W / longest);

    expanded.forEach(([kind, text], row) => {
        const y0 = TOP + row * PITCH - 1;
        if (kind !== "ctx") {
            const bg = kind === "add" ? p.addBg : p.delBg;
            for (let y = Math.max(0, y0); y < Math.min(ART_H, y0 + PITCH); y++)
                for (let x = 0; x < ART_W; x++) put(x, y, bg);
        }
        const fg = kind === "add" ? p.addFg : kind === "del" ? p.delFg : p.grey;
        const rows = [y0 + 1, y0 + 2];
        for (const y of rows) for (let x = 2; x < 7; x++) put(x, y, p.gutter);
        if (kind !== "ctx") {
            put(9, rows[0], fg);
            put(10, rows[0], fg);
            if (kind === "add") put(9, rows[1], fg);
        }
        let indent = 0;
        while (indent < text.length && text[indent] === " ") indent++;
        let col = indent;
        for (const tok of text.split(" ")) {
            const len = pyLen(tok);
            if (len) {
                const x0 = X_CODE + pyRound(col * scale);
                const x1 = X_CODE + Math.max(pyRound((col + len) * scale), pyRound(col * scale) + 1);
                for (let x = x0; x < Math.min(x1, ART_W - 2); x++) for (const y of rows) put(x, y, fg);
            }
            col += len + 1;
        }
    });

    for (let y = FADE_START; y < ART_H; y++) {
        const t = Math.min(1, (y - FADE_START) / (FADE_END - FADE_START)) ** 0.85;
        for (let x = 0; x < ART_W; x++) {
            if (t >= 1 || t * 16 > BAYER4[y % 4][x % 4] + 0.5) put(x, y, p.fill);
            else if (theme === "light") {
                const i = (y * ART_W + x) * 3;
                if (px[i] === 255 && px[i + 1] === 255 && px[i + 2] === 255) put(x, y, p.fill);
            }
        }
    }
    return px;
}
