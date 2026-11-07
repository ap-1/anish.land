export type Theme = "light" | "dark";

export function currentTheme(): Theme {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    document.documentElement.dataset.theme = next;
}

export function onThemeChange(listener: (theme: Theme) => void): () => void {
    const observer = new MutationObserver(() => listener(currentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
}
