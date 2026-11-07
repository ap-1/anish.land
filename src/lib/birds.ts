import type { ContributionDay } from "@/lib/github";
import { currentTheme, onThemeChange, type Theme } from "@/lib/theme";

type Rgb = [number, number, number];

interface Parrot {
    o: Rgb;
    w: Rgb;
    a: Rgb;
    b: Rgb;
}

interface Ground {
    soil: Rgb;
    edge: Rgb;
    seed: Rgb;
    mark: Rgb;
    blades: [Rgb, Rgb, Rgb, Rgb];
}

interface Seed {
    x: number;
    y: number;
    vx: number;
    vy: number;
    landed: boolean;
    claimed: boolean;
    eaten: boolean;
}

interface Bird {
    x: number;
    y: number;
    vx: number;
    vy: number;
    state: "fly" | "land" | "perched";
    timer: number;
    tx: number;
    ty: number;
    face: number;
    peck: number;
    flap: number;
    hop: number;
    ground: boolean;
    seed: Seed | null;
    card: Element | null;
    cardDx: number;
}

interface Spot {
    x: number;
    y: number;
}

interface Landing {
    x: number;
    y: number;
    ground: boolean;
    card?: Element;
    dx?: number;
}

export interface MailLayout {
    link: { x: number; y: number; w: number; h: number; clip: string };
    note: { x: number; y: number };
}

export interface PageBirdsOptions {
    year: ContributionDay[];
    mailbox?: boolean;
    alignTo?: Element | null;
    cards?: string;
    onHover?: (day: ContributionDay | null, x: number, y: number) => void;
    onMailLayout?: (layout: MailLayout) => void;
    skyToggle?: HTMLElement | null;
}

const BIRD_SCALE = 4;

function bhx(c: string): Rgb {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function bhash(i: number, s: number) {
    const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
    return x - Math.floor(x);
}

function bnoise(x: number, s: number) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return bhash(i, s) * (1 - u) + bhash(i + 1, s) * u;
}

const PARROTS: Parrot[] = [
    { o: bhx("#e5392e"), w: bhx("#2f63d1"), a: bhx("#ffd23f"), b: bhx("#3a3a40") },
    { o: bhx("#3170e0"), w: bhx("#1f4aa8"), a: bhx("#ffd23f"), b: bhx("#3a3a40") },
    { o: bhx("#4cbf3f"), w: bhx("#2c8a35"), a: bhx("#e5392e"), b: bhx("#f0a33a") },
    { o: bhx("#2fc4d6"), w: bhx("#1f8fa3"), a: bhx("#ffd23f"), b: bhx("#3a3a40") },
    { o: bhx("#b9bdc8"), w: bhx("#8b90a0"), a: bhx("#ffd23f"), b: bhx("#3a3a40") },
];
const PARROT_EYE = bhx("#1c1c22");
const PARROT_FEET = bhx("#6b6b72");

const BIRD_SPRITES = {
    up: ["...ww....", "....ww.oo", "wwoooooeb", "..ooaoo..", "........."],
    level: [".........", "......oo.", "wwoooooeb", "..owwao..", "........."],
    down: [".........", "......oo.", "wwoooooeb", "..ooaoo..", "....ww..."],
    sit: ["...oo...", "..oeob..", "..aoobb.", ".wwoo...", ".wwoo...", "wwwo....", "..f.f..."],
    peck: ["........", "........", "..oooeo.", ".wwoaoob", ".wwoo..b", "wwwo....", "..f.f..."],
};

const MAIL_W = 26;
const MAIL_BOX_H = 17;
const MAIL_POST_H = 20;
const MAIL_H = MAIL_BOX_H + MAIL_POST_H;
const MAIL_DOME_INSETS = [6, 3, 2, 1, 1];
const MAIL_COLORS = {
    hi: bhx("#8db3f2"),
    m: bhx("#5b8ee6"),
    d: bhx("#4a7bd4"),
    door: bhx("#5487e0"),
    seam: bhx("#3c69bf"),
    knob: bhx("#e9eef8"),
    p: bhx("#a37a59"),
    pd: bhx("#86613f"),
    pole: bhx("#9aa3b5"),
    env: bhx("#f6f7fa"),
    envd: bhx("#c9d0dc"),
    stamp: bhx("#e5484d"),
};
const FLAG = bhx("#e5484d");

const GROUND_DAY: Ground = {
    soil: bhx("#8fcc7c"),
    edge: bhx("#76b964"),
    seed: bhx("#c7a15a"),
    mark: bhx("#0e4429"),
    blades: [bhx("#9be9a8"), bhx("#40c463"), bhx("#30a14e"), bhx("#216e39")],
};
const GROUND_NIGHT: Ground = {
    soil: bhx("#0f1d14"),
    edge: bhx("#1b3a25"),
    seed: bhx("#e3cf8f"),
    mark: bhx("#ffffff"),
    blades: [bhx("#0e4429"), bhx("#006d32"), bhx("#26a641"), bhx("#39d353")],
};
const MOON = bhx("#f4ecc8");
const MOON_GLOW = bhx("#1f2836");
const SUN = bhx("#ffd84d");
const SUN_GLOW = bhx("#ffeaa0");
const SKY_R = 7;
const SKY_REACH = SKY_R + 3;
const FIREFLY = bhx("#f6e27a");
const FIREFLY_GLOW = bhx("#5c5526");
const ZZZ = bhx("#8f97a6");
const FLAT_LETTERS = "acemnorsuvwxz";

export class PageBirds {
    readonly start: () => void;
    readonly stop: () => void;
    readonly setMailHover: (on: boolean) => void;

    constructor(page: HTMLElement, canvas: HTMLCanvasElement, opts: PageBirdsOptions) {
        let mailHover = false;
        const ctx = canvas.getContext("2d")!;
        let W = 0;
        let H = 0;
        let img: ImageData | null = null;
        let buf = new Uint8ClampedArray(0);
        let bg = new Uint8ClampedArray(0);
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const year = opts.year;
        let t = 0;
        let raf = 0;
        let last = 0;
        let acc = 0;
        const mouse = { in: false, x: -99, y: -99, px: -99, py: -99, speed: 0 };
        let spots: Spot[] = [];
        let seeds: Seed[] = [];
        let night = currentTheme() === "dark";
        let stopThemeWatch = () => {};
        let G = night ? GROUND_NIGHT : GROUND_DAY;
        const flies: { x: number; ph: number; sp: number }[] = [];
        for (let fi = 0; fi < 12; fi++) flies.push({ x: bhash(fi, 31) * 400, ph: bhash(fi, 32) * 6.28, sp: 0.3 + bhash(fi, 33) * 0.5 });
        let hoverCol = -1;
        const birds: Bird[] = [];
        for (let i = 0; i < 12; i++) {
            birds.push({
                x: 160 + bhash(i, 1) * 180,
                y: 20 + bhash(i, 2) * 90,
                vx: -0.5 + bhash(i, 3),
                vy: (bhash(i, 4) - 0.5) * 0.4,
                state: "fly",
                timer: 200 + Math.floor(bhash(i, 5) * 900),
                tx: 0,
                ty: 0,
                face: 1,
                peck: 0,
                flap: 0,
                hop: 0,
                ground: false,
                seed: null,
                card: null,
                cardDx: 0,
            });
        }

        function horizon() {
            return H - 24;
        }
        function groundY(c: number) {
            return Math.round(horizon() + 5 - bnoise(c * 0.012, 1) * 6);
        }
        function dayAt(c: number) {
            return year[Math.max(0, Math.min(year.length - 1, Math.floor((c / W) * year.length)))];
        }
        let mailX = 24;
        function measureMailX() {
            if (!opts.alignTo) return;
            const pr = page.getBoundingClientRect();
            const r = opts.alignTo.getBoundingClientRect();
            if (pr.width) mailX = Math.round(((r.left - pr.left) / pr.width) * W);
        }
        function mailTop() {
            return groundY(mailX + 12) - MAIL_H + 1;
        }

        function resize() {
            const w = Math.max(80, Math.round(page.clientWidth / BIRD_SCALE));
            const h = Math.max(60, Math.round(page.clientHeight / BIRD_SCALE));
            if (w !== W || h !== H) {
                W = w;
                H = h;
                canvas.width = W;
                canvas.height = H;
                img = ctx.createImageData(W, H);
                buf = img.data;
            }
            measureMailX();
            buildBackground();
            findSpots();
            placeMailLink();
            placeSkyToggle();
        }

        function placeMailLink() {
            if (opts.mailbox === false || !opts.onMailLayout) return;
            const k = page.clientWidth / W;
            const w = Math.round(MAIL_W * k);
            const boxH = Math.round(MAIL_BOX_H * k);
            const postL = Math.round(11 * k);
            const postR = Math.round(15 * k);
            opts.onMailLayout({
                link: {
                    x: Math.round(mailX * k),
                    y: Math.round(mailTop() * k),
                    w,
                    h: Math.round(MAIL_H * k),
                    clip: `polygon(0 0, ${w}px 0, ${w}px ${boxH}px, ${postR}px ${boxH}px, ${postR}px 100%, ${postL}px 100%, ${postL}px ${boxH}px, 0 ${boxH}px)`,
                },
                note: { x: Math.round((mailX + MAIL_W + 24) * k), y: Math.round((mailTop() + 5) * k) },
            });
        }

        function skyCenter() {
            const phone = W < 180;
            return { mx: phone ? W - 18 : Math.round(W * 0.42), my: phone ? 27 : 34 };
        }

        function placeSkyToggle() {
            if (!opts.skyToggle) return;
            const k = page.clientWidth / W;
            const { mx, my } = skyCenter();
            const size = `${Math.round((2 * SKY_REACH + 1) * k)}px`;
            Object.assign(opts.skyToggle.style, {
                left: `${Math.round((mx - SKY_REACH) * k)}px`,
                top: `${Math.round((my - SKY_REACH) * k)}px`,
                width: size,
                height: size,
            });
        }

        const measure = document.createElement("canvas").getContext("2d")!;
        function findSpots() {
            const pr = page.getBoundingClientRect();
            if (!pr.width) return;
            const sx = W / pr.width;
            const sy = H / pr.height;
            spots =
                opts.mailbox === false
                    ? []
                    : [
                          { x: mailX + 11, y: mailTop() },
                          { x: mailX + 17, y: mailTop() + 1 },
                      ];
            page.querySelectorAll<HTMLElement>("[data-perch]").forEach((el) => {
                if (el.getAttribute("data-perch") === "box") {
                    const r = el.getBoundingClientRect();
                    if (r.width) spots.push({ x: Math.round(((r.left + r.right) / 2 - pr.left) * sx), y: Math.round((r.top - pr.top) * sy) });
                    return;
                }
                const cs = getComputedStyle(el);
                const zoom = el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1;
                measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
                const fa = measure.measureText("n").fontBoundingBoxAscent;
                const big = parseFloat(cs.fontSize) > 40;
                const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                const range = document.createRange();
                let firstTop: number | null = null;
                let node: Node | null;
                while ((node = walker.nextNode())) {
                    const text = node as Text;
                    for (let k = 0; k < text.data.length; k++) {
                        const ch = text.data[k];
                        if (ch === " ") continue;
                        range.setStart(text, k);
                        range.setEnd(text, k + 1);
                        const rr = range.getClientRects()[0];
                        if (!rr || !rr.width) continue;
                        if (firstTop === null) firstTop = rr.top;
                        if (Math.abs(rr.top - firstTop) > 2) return;
                        if (!big && FLAT_LETTERS.indexOf(ch.toLowerCase()) < 0) continue;
                        const m = measure.measureText(ch);
                        const baseline = rr.top + (fa !== undefined ? fa * zoom : rr.height * 0.8);
                        spots.push({
                            x: Math.round(((rr.left + rr.right) / 2 - pr.left) * sx),
                            y: Math.round((baseline - m.actualBoundingBoxAscent * zoom - pr.top) * sy),
                        });
                    }
                }
            });
            birds.forEach((b) => {
                if ((b.state === "perched" || b.state === "land") && !b.ground) takeOff(b, 0, 0);
            });
        }

        function buildBackground() {
            bg = new Uint8ClampedArray(W * H * 4);
            for (let c = 0; c < W; c++) {
                const gy = groundY(c);
                for (let y = Math.max(0, gy); y < H; y++) {
                    const color = y === gy ? G.edge : G.soil;
                    const i = (y * W + c) * 4;
                    bg[i] = color[0];
                    bg[i + 1] = color[1];
                    bg[i + 2] = color[2];
                    bg[i + 3] = 255;
                }
            }
        }
        function px(x: number, y: number, c: Rgb) {
            x = Math.round(x);
            y = Math.round(y);
            if (x < 0 || y < 0 || x >= W || y >= H) return;
            const i = (y * W + x) * 4;
            buf[i] = c[0];
            buf[i + 1] = c[1];
            buf[i + 2] = c[2];
            buf[i + 3] = 255;
        }

        function perchedCount() {
            return birds.filter((b) => b.state === "perched" || b.state === "land").length;
        }
        function takeOff(b: Bird, ax: number, ay: number) {
            if (b.seed) b.seed.claimed = false;
            b.state = "fly";
            b.ground = false;
            b.seed = null;
            b.card = null;
            b.flap = 40;
            b.timer = 400 + Math.floor(Math.random() * 900);
            b.vx = ax + (Math.random() - 0.5) * 0.6;
            b.vy = ay - 0.7 - Math.random() * 0.5;
        }
        function landAt(b: Bird, x: number, y: number, ground: boolean, seed?: Seed | null, card?: Element, cardDx?: number) {
            b.state = "land";
            b.tx = x;
            b.ty = y;
            b.ground = ground;
            b.seed = seed || null;
            b.card = card || null;
            b.cardDx = cardDx || 0;
        }
        function cardRim(el: Element, dx: number): Spot | null {
            const pr = page.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            if (!pr.width || !r.width) return null;
            return { x: Math.round(((r.left - pr.left) / pr.width) * W + dx), y: Math.round(((r.top - pr.top) / pr.height) * H) - 1 };
        }
        function pickCard() {
            if (!opts.cards) return null;
            const pr = page.getBoundingClientRect();
            const list: Element[] = [];
            page.querySelectorAll(opts.cards).forEach((el) => {
                const r = el.getBoundingClientRect();
                const top = (r.top - pr.top) / pr.height;
                const left = (r.left - pr.left) / pr.width;
                if (r.width > 60 && top > 0.3 && top < 0.75 && left > 0.15 && left < 0.6 && !birds.some((o) => o.card === el)) list.push(el);
            });
            if (!list.length) return null;
            const el = list[Math.floor(Math.random() * list.length)];
            const r = el.getBoundingClientRect();
            const wC = (r.width / pr.width) * W;
            const dx = 6 + Math.floor(Math.random() * Math.max(1, wC - 14));
            return { el, dx };
        }
        function pickLanding(b: Bird): Landing {
            if (Math.random() < 0.25) {
                const cd = pickCard();
                if (cd) {
                    const rim = cardRim(cd.el, cd.dx);
                    if (rim) return { x: rim.x, y: rim.y, ground: false, card: cd.el, dx: cd.dx };
                }
            }
            const options = spots.filter(
                (s) =>
                    !birds.some(
                        (o) => o !== b && (o.state === "perched" || o.state === "land") && Math.abs(o.tx - s.x) < 6 && Math.abs(o.ty - (s.y - 1)) < 3,
                    ),
            );
            if (Math.random() < 0.45 || !options.length) {
                const x = 4 + Math.floor(Math.random() * (W - 8));
                return { x, y: groundY(x) - 1, ground: true };
            }
            const s = options[Math.floor(Math.random() * options.length)];
            return { x: s.x, y: s.y - 1, ground: false };
        }
        function nearestSeed(x: number, maxD: number) {
            let best: Seed | null = null;
            let bd = maxD;
            for (const s of seeds) {
                if (s.eaten || s.claimed || !s.landed) continue;
                const d = Math.abs(s.x - x);
                if (d < bd) {
                    bd = d;
                    best = s;
                }
            }
            return best;
        }

        function update() {
            t++;
            const mdx = mouse.x - mouse.px;
            const mdy = mouse.y - mouse.py;
            mouse.speed = mouse.speed * 0.8 + Math.sqrt(mdx * mdx + mdy * mdy) * 0.2;
            mouse.px = mouse.x;
            mouse.py = mouse.y;
            seeds.forEach((s) => {
                if (s.landed) return;
                s.vy += 0.08;
                s.y += s.vy;
                s.x += s.vx;
                const gy = groundY(Math.round(s.x)) - 1;
                if (s.y >= gy) {
                    s.x = Math.round(s.x);
                    s.y = groundY(s.x) - 1;
                    s.landed = true;
                }
            });
            seeds = seeds.filter((s) => !s.eaten);
            const free = seeds.filter((s) => s.landed && !s.claimed);
            if (free.length && t % 6 === 0) {
                const cand = birds.filter((b) => !b.seed && (b.state === "fly" || (b.state === "perched" && b.ground)));
                const s0 = free[0];
                cand.sort((a, b) => Math.abs(a.x - s0.x) + Math.abs(a.y - s0.y) - Math.abs(b.x - s0.x) - Math.abs(b.y - s0.y));
                const b0 = cand[0];
                if (b0 && birds.filter((b) => b.seed).length < 6) {
                    const s = nearestSeed(b0.x, 999);
                    if (s) {
                        s.claimed = true;
                        if (b0.state === "perched" && Math.abs(b0.x - s.x) < 14) {
                            b0.face = s.x > b0.x ? 1 : -1;
                            b0.x = s.x;
                            b0.y = s.y;
                            b0.seed = s;
                            b0.peck = 0;
                            b0.hop = 6;
                        } else landAt(b0, s.x, s.y, true, s);
                    }
                }
            }
            let hover = -1;
            if (mouse.in && mouse.y > groundY(Math.round(mouse.x)) - 6 && mouse.y < H && mouse.x >= 0 && mouse.x < W) hover = Math.round(mouse.x);
            if (hover !== hoverCol) {
                hoverCol = hover;
                if (opts.onHover) {
                    const k = page.clientWidth / W;
                    opts.onHover(hover < 0 || mailHover ? null : dayAt(hover), hover * k, (groundY(Math.max(0, hover)) - 8) * k);
                }
            }

            birds.forEach((b, i) => {
                if (b.card) {
                    const rim = cardRim(b.card, b.cardDx);
                    if (!rim || rim.y < H * 0.24 || rim.x < 12 || rim.x > W - 12) {
                        takeOff(b, (Math.random() - 0.5) * 1.2, -0.3);
                        return;
                    }
                    b.tx = rim.x;
                    b.ty = rim.y;
                    if (b.state === "perched") {
                        b.x = rim.x;
                        b.y = rim.y;
                    }
                }
                const dmx = b.x - mouse.x;
                const dmy = b.y - mouse.y;
                const dm = Math.sqrt(dmx * dmx + dmy * dmy);
                if (b.state === "perched") {
                    const scareR = b.seed ? 9 : mouse.speed > 1 ? 26 : 13;
                    if (mouse.in && dm < scareR) {
                        takeOff(b, (dmx / (dm + 0.1)) * 1.4, 0);
                        return;
                    }
                    if (b.seed) {
                        if (b.peck > 0) {
                            b.peck--;
                            if (b.peck === 0) {
                                b.seed.eaten = true;
                                b.seed = null;
                                b.timer = Math.max(b.timer, 300);
                                const next = nearestSeed(b.x, 16);
                                if (next) {
                                    next.claimed = true;
                                    b.face = next.x > b.x ? 1 : -1;
                                    b.x = next.x;
                                    b.y = next.y;
                                    b.seed = next;
                                    b.hop = 6;
                                }
                            }
                        } else b.peck = 22;
                        return;
                    }
                    if (--b.timer <= 0) {
                        takeOff(b, (Math.random() - 0.5) * 1.2, 0);
                        return;
                    }
                    if (b.peck > 0) {
                        b.peck--;
                        return;
                    }
                    if (night) return;
                    const r = Math.random();
                    if (r < (b.ground ? 0.02 : 0.008)) b.peck = 14;
                    else if (b.ground && !b.card && r < 0.035) {
                        const step = (Math.random() < 0.7 ? b.face : -b.face) * (2 + Math.floor(Math.random() * 3));
                        const nx = Math.max(3, Math.min(W - 4, b.x + step));
                        b.face = nx > b.x ? 1 : -1;
                        b.x = nx;
                        b.y = groundY(nx) - 1;
                        b.hop = 6;
                    } else if (r < 0.04) b.face = -b.face;
                    return;
                }
                if (b.state === "land") {
                    const lx = b.tx - b.x;
                    const ly = b.ty - b.y;
                    const ld = Math.sqrt(lx * lx + ly * ly);
                    if (mouse.in && dm < (b.seed ? 10 : 20)) {
                        takeOff(b, dmx / (dm + 0.1), 0);
                        return;
                    }
                    if (ld < 1.2) {
                        b.x = b.tx;
                        b.y = b.ty;
                        b.vx = 0;
                        b.vy = 0;
                        b.state = "perched";
                        b.timer = ((b.ground ? 600 : 360) + Math.floor(Math.random() * 1100)) * (night ? 5 : 1);
                        return;
                    }
                    const sp = Math.min(b.seed ? 1.2 : 0.9, 0.25 + ld * 0.04);
                    b.vx += ((lx / ld) * sp - b.vx) * 0.12;
                    b.vy += ((ly / ld) * sp - b.vy) * 0.12;
                    b.x += b.vx;
                    b.y += b.vy;
                    b.face = b.vx >= 0 ? 1 : -1;
                    b.flap = 8;
                    return;
                }
                let ax = 0;
                let ay = 0;
                let cx = 0;
                let cy = 0;
                let avx = 0;
                let avy = 0;
                let n = 0;
                birds.forEach((o, j) => {
                    if (i === j || o.state !== "fly") return;
                    const dx = o.x - b.x;
                    const dy = o.y - b.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < 22) {
                        n++;
                        cx += o.x;
                        cy += o.y;
                        avx += o.vx;
                        avy += o.vy;
                        if (d < 6) {
                            ax -= (dx / (d + 0.1)) * 0.06;
                            ay -= (dy / (d + 0.1)) * 0.06;
                        }
                    }
                });
                if (n) {
                    ax += (cx / n - b.x) * 0.0012 + (avx / n - b.vx) * 0.035;
                    ay += (cy / n - b.y) * 0.0012 + (avy / n - b.vy) * 0.035;
                }
                if (b.y < 6) ay += 0.04;
                if (b.y > horizon() - 14) ay -= 0.05;
                if (mouse.in && dm < 30) {
                    const push = ((30 - dm) / 30) * (0.12 + Math.min(0.25, mouse.speed * 0.03));
                    ax += (dmx / (dm + 0.1)) * push;
                    ay += (dmy / (dm + 0.1)) * push;
                    b.flap = 30;
                }
                ax += (bnoise(t * 0.01 + i * 7, 21) - 0.5) * 0.03;
                ay += (bnoise(t * 0.01 + i * 5, 22) - 0.5) * 0.03;
                b.vx += ax;
                b.vy += ay;
                const v = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                const maxV = 1.1;
                const minV = 0.35;
                if (v > maxV) {
                    b.vx *= maxV / v;
                    b.vy *= maxV / v;
                } else if (v < minV) {
                    b.vx *= minV / (v + 0.001);
                    b.vy *= minV / (v + 0.001);
                }
                if (b.vy < -0.25 || v > 0.95) b.flap = Math.max(b.flap, 12);
                else if (b.flap <= 0 && Math.random() < 0.006) b.flap = 24;
                if (b.flap > 0) b.flap--;
                b.x += b.vx;
                b.y += b.vy;
                b.face = b.vx >= 0 ? 1 : -1;
                if (b.x < -8) b.x += W + 16;
                if (b.x > W + 8) b.x -= W + 16;
                if (--b.timer <= 0) {
                    b.timer = night ? 60 + Math.floor(Math.random() * 160) : 300 + Math.floor(Math.random() * 600);
                    if (perchedCount() < (night ? 12 : 6)) {
                        const L = pickLanding(b);
                        if (!(mouse.in && Math.abs(mouse.x - L.x) < 25 && Math.abs(mouse.y - L.y) < 25)) landAt(b, L.x, L.y, L.ground, null, L.card, L.dx);
                    }
                }
            });
        }

        function drawMeadow() {
            const hd = hoverCol >= 0 ? dayAt(hoverCol) : null;
            for (let c = 0; c < W; c++) {
                const day = dayAt(c);
                const lvl = day.level;
                const gy = groundY(c);
                const hl = day === hd;
                if (hl) px(c, gy, G.mark);
                if (!lvl) continue;
                let bend = 0;
                if (mouse.in && !hl && mouse.y > gy - 10 && mouse.y < gy + 4) {
                    const d = c - mouse.x;
                    if (Math.abs(d) < 7) bend = (d >= 0 ? 1 : -1) * Math.round(((7 - Math.abs(d)) / 7) * 2);
                }
                const col = hl ? G.mark : G.blades[lvl - 1];
                for (let k = 1; k <= lvl; k++) px(c + (k === lvl ? bend : k > 1 ? Math.round(bend / 2) : 0), gy - k, col);
            }
        }
        function drawMailbox() {
            const x0 = mailX;
            const y0 = mailTop();
            const C = MAIL_COLORS;
            for (let y = y0 + MAIL_BOX_H; y < y0 + MAIL_H; y++) for (let c0 = 11; c0 < 15; c0++) px(x0 + c0, y, c0 < 13 ? C.p : C.pd);
            const door = MAIL_W - 6;
            for (let r = 0; r < MAIL_BOX_H; r++) {
                const inset = r < MAIL_DOME_INSETS.length ? MAIL_DOME_INSETS[r] : 0;
                for (let c = inset; c < MAIL_W - inset; c++) {
                    let col = r < 3 ? C.hi : r >= MAIL_BOX_H - 3 ? C.d : c > door ? C.door : C.m;
                    if (c === door && r >= 3) col = C.seam;
                    px(x0 + c, y0 + r, col);
                }
            }
            px(x0 + MAIL_W - 3, y0 + 8, C.knob);
            px(x0 + MAIL_W - 3, y0 + 9, C.knob);
            if (mailHover) {
                for (let ex = 0; ex < 8; ex++) {
                    for (let ey = 0; ey < 6; ey++) px(x0 + MAIL_W - 1 + ex, y0 + 5 + ey, ey === 0 || ey === 5 || ex === 7 ? C.envd : C.env);
                }
                px(x0 + MAIL_W + 4, y0 + 6, C.stamp);
                px(x0 + MAIL_W + 5, y0 + 6, C.stamp);
                px(x0 + MAIL_W + 4, y0 + 7, C.stamp);
                px(x0 + MAIL_W + 5, y0 + 7, C.stamp);
                for (let fy = -7; fy < 9; fy++) px(x0 - 1, y0 + fy, C.pole);
                for (let fx = -7; fx < -1; fx++) for (let fy = -7; fy < -3; fy++) px(x0 + fx, y0 + fy, FLAG);
            } else {
                for (let fx = -6; fx < 0; fx++) for (let fy = 7; fy < 11; fy++) px(x0 + fx, y0 + fy, FLAG);
                px(x0 - 1, y0 + 8, C.pole);
            }
        }

        function drawMoon() {
            const { mx, my } = skyCenter();
            const R = SKY_R;
            for (let y = -SKY_REACH; y <= SKY_REACH; y++) {
                for (let x = -SKY_REACH; x <= SKY_REACH; x++) {
                    const d = x * x + y * y;
                    if (d <= R * R) {
                        if ((x - 3) * (x - 3) + (y + 1) * (y + 1) > (R - 1) * (R - 1)) px(mx + x, my + y, MOON);
                    } else if (d <= SKY_REACH * SKY_REACH && (x + y) % 2 === 0) px(mx + x, my + y, MOON_GLOW);
                }
            }
        }
        function drawSun() {
            const { mx, my } = skyCenter();
            const R = SKY_R;
            for (let y = -SKY_REACH; y <= SKY_REACH; y++) {
                for (let x = -SKY_REACH; x <= SKY_REACH; x++) {
                    const d = x * x + y * y;
                    if (d <= R * R) px(mx + x, my + y, SUN);
                    else if (d <= SKY_REACH * SKY_REACH && (x + y) % 2 === 0) px(mx + x, my + y, SUN_GLOW);
                }
            }
        }
        function drawFireflies() {
            flies.forEach((f) => {
                const x = (((f.x + t * 0.03 * f.sp + Math.sin(t * 0.01 * f.sp + f.ph) * 10) % W) + W) % W;
                const y = horizon() - 6 - 12 * (0.5 + 0.5 * Math.sin(t * 0.013 * f.sp + f.ph * 2));
                if (Math.sin(t * 0.04 + f.ph * 3) <= -0.2) return;
                px(x - 1, y, FIREFLY_GLOW);
                px(x + 1, y, FIREFLY_GLOW);
                px(x, y - 1, FIREFLY_GLOW);
                px(x, y + 1, FIREFLY_GLOW);
                px(x, y, FIREFLY);
            });
        }

        function draw() {
            if (!img) return;
            buf.set(bg);
            if (night) drawMoon();
            else drawSun();
            drawMeadow();
            if (opts.mailbox !== false) drawMailbox();
            seeds.forEach((s) => px(s.x, s.y, G.seed));
            birds.forEach((b, i) => {
                const x = Math.round(b.x);
                const y = Math.round(b.y);
                const perched = b.state === "perched";
                let rows: string[];
                if (perched) rows = b.peck > 0 && b.peck < 10 ? BIRD_SPRITES.peck : BIRD_SPRITES.sit;
                else if (b.flap > 0) {
                    const f = Math.floor((t + i * 3) / 4) % 4;
                    rows = f === 0 ? BIRD_SPRITES.up : f === 2 ? BIRD_SPRITES.down : BIRD_SPRITES.level;
                } else rows = BIRD_SPRITES.level;
                const h = rows.length;
                const w = rows[0].length;
                const flip = b.face < 0;
                let lift = 0;
                if (perched && b.hop > 0) {
                    b.hop--;
                    lift = 1;
                }
                const ox = perched ? x - 3 : x - (w >> 1);
                const oy = perched ? y - h + 1 - lift : y - 2;
                const P = PARROTS[i % PARROTS.length];
                const asleep = night && perched && !b.seed;
                for (let r = 0; r < h; r++) {
                    for (let c = 0; c < w; c++) {
                        const ch = rows[r][flip ? w - 1 - c : c];
                        if (ch === ".") continue;
                        px(ox + c, oy + r, ch === "e" ? (asleep ? P.o : PARROT_EYE) : ch === "f" ? PARROT_FEET : P[ch as keyof Parrot]);
                    }
                }
                if (asleep) {
                    const zt = (t + i * 53) % 160;
                    if (zt < 90) {
                        const zx = x + (flip ? -4 : 4) + Math.floor(zt / 45);
                        const zy = oy - 2 - Math.floor(zt / 18);
                        px(zx, zy, ZZZ);
                        px(zx + 1, zy, ZZZ);
                        px(zx + 2, zy, ZZZ);
                        px(zx + 1, zy + 1, ZZZ);
                        px(zx, zy + 2, ZZZ);
                        px(zx + 1, zy + 2, ZZZ);
                        px(zx + 2, zy + 2, ZZZ);
                    }
                }
            });
            if (night) drawFireflies();
            ctx.putImageData(img, 0, 0);
        }

        function loop(now: number) {
            raf = requestAnimationFrame(loop);
            if (!last) last = now;
            acc += Math.min(100, now - last);
            last = now;
            while (acc >= 1000 / 60) {
                update();
                acc -= 1000 / 60;
            }
            draw();
        }
        function toCanvas(e: PointerEvent) {
            const r = page.getBoundingClientRect();
            return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
        }
        function onMove(e: PointerEvent) {
            const p = toCanvas(e);
            if (!mouse.in) {
                mouse.px = p.x;
                mouse.py = p.y;
            }
            mouse.in = true;
            mouse.x = p.x;
            mouse.y = p.y;
        }
        function onLeave() {
            mouse.in = false;
            mouse.x = mouse.y = -99;
            mouse.speed = 0;
        }
        function onDown(e: PointerEvent) {
            if (e.target instanceof Element && e.target.closest("a, button, input, textarea")) return;
            const p = toCanvas(e);
            const y = Math.min(p.y, groundY(Math.round(p.x)) - 3);
            for (let k = 0; k < 6; k++) {
                seeds.push({
                    x: p.x + (Math.random() - 0.5) * 3,
                    y,
                    vx: (Math.random() - 0.5) * 0.9,
                    vy: -0.6 - Math.random() * 0.5,
                    landed: false,
                    claimed: false,
                    eaten: false,
                });
            }
            birds.forEach((b) => {
                const dx = b.x - p.x;
                const dy = b.y - p.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 18 && !b.seed) {
                    if (b.state !== "fly") takeOff(b, 0, 0);
                    b.vx += (dx / (d + 0.1)) * 1.2;
                    b.vy += (dy / (d + 0.1)) * 1.2;
                    b.flap = 30;
                }
            });
        }
        function onScheme(theme: Theme) {
            night = theme === "dark";
            G = night ? GROUND_NIGHT : GROUND_DAY;
            buildBackground();
            if (reduce) draw();
        }

        const observer = new ResizeObserver(() => {
            resize();
            if (reduce) draw();
        });

        this.start = () => {
            resize();
            observer.observe(page);
            page.addEventListener("pointermove", onMove);
            page.addEventListener("pointerleave", onLeave);
            page.addEventListener("pointerdown", onDown);
            document.fonts.ready.then(findSpots);
            stopThemeWatch = onThemeChange(onScheme);
            if (reduce) {
                birds.forEach((b, i) => {
                    if (i < 3 && spots.length) {
                        const s = spots[(i * 7 + 1) % spots.length];
                        b.state = "perched";
                        b.x = s.x;
                        b.y = s.y - 1;
                    }
                });
                draw();
            } else raf = requestAnimationFrame(loop);
        };
        this.stop = () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
            page.removeEventListener("pointermove", onMove);
            page.removeEventListener("pointerleave", onLeave);
            page.removeEventListener("pointerdown", onDown);
            stopThemeWatch();
        };
        this.setMailHover = (on) => {
            mailHover = on;
        };
    }
}
