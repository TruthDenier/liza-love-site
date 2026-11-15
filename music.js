// Плеер Яндекс Музыки.
//
// Ссылки задаются в config.js в поле MUSIC. Можно одну строку или массив:
//   MUSIC: "https://music.yandex.ru/album/1339814/track/10994777"
//   MUSIC: [
//       { title: "Наша песня", url: "https://music.yandex.ru/album/1339814/track/10994777" },
//       { title: "Плейлист", url: "https://music.yandex.ru/users/music-blog/playlists/2489" },
//   ]
//
// Поддерживаются ссылки на трек, альбом и публичный плейлист.
// Пока ссылки не заданы, блок «Наша музыка» на странице не показывается.

(() => {
    "use strict";

    const CFG = window.APP_CONFIG || {};
    const section = document.getElementById("music");
    const frameBox = document.getElementById("musicFrame");
    const tabsBox = document.getElementById("musicTabs");
    const openLink = document.getElementById("musicOpen");
    if (!section || !frameBox) return;

    const HEIGHTS = { track: 200, album: 460, playlist: 500 };
    const RAW = CFG.MUSIC;
    const entries = (Array.isArray(RAW) ? RAW : RAW ? [RAW] : [])
        .map(toEntry)
        .filter(Boolean);

    if (!entries.length) return;

    const buttons = [];

    function parseLink(raw) {
        let url;
        try {
            url = new URL(String(raw || "").trim());
        } catch {
            return null;
        }

        // Только домены Яндекс Музыки: чужую ссылку в плеер не подставляем.
        if (!/(^|\.)music\.yandex\.(ru|com|kz|by|uz)$/i.test(url.hostname)) {
            return null;
        }

        const p = url.pathname.split("/").filter(Boolean);
        const origin = url.origin;

        // album/<albumId>/track/<trackId>
        if (p[0] === "album" && p[1] && p[2] === "track" && p[3]) {
            return {
                kind: "track",
                src: `${origin}/iframe/track/${p[3]}/${p[1]}`,
                link: `${origin}/album/${p[1]}/track/${p[3]}`,
                title: "Трек",
            };
        }

        // album/<albumId>
        if (p[0] === "album" && p[1]) {
            return {
                kind: "album",
                src: `${origin}/iframe/album/${p[1]}`,
                link: `${origin}/album/${p[1]}`,
                title: "Альбом",
            };
        }

        // users/<user>/playlists/<kind>
        if (p[0] === "users" && p[1] && p[2] === "playlists" && p[3]) {
            return {
                kind: "playlist",
                src: `${origin}/iframe/playlist/${p[1]}/${p[3]}`,
                link: `${origin}/users/${p[1]}/playlists/${p[3]}`,
                title: "Плейлист",
            };
        }

        return null;
    }

    function toEntry(item) {
        const raw = typeof item === "string" ? item : item && item.url;
        const parsed = parseLink(raw);
        if (!parsed) return null;

        const custom =
            item && typeof item === "object"
                ? String(item.title || "").trim()
                : "";

        return { ...parsed, title: custom || parsed.title };
    }

    function show(entry) {
        section.classList.toggle("music--track", entry.kind === "track");
        section.classList.toggle("music--album", entry.kind === "album");
        section.classList.toggle("music--playlist", entry.kind === "playlist");

        const iframe = document.createElement("iframe");
        iframe.src = entry.src;
        iframe.title = "Плеер Яндекс Музыки: " + entry.title;
        iframe.loading = "lazy";
        iframe.height = String(HEIGHTS[entry.kind] || 200);
        iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
        iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        iframe.setAttribute("frameborder", "0");

        frameBox.replaceChildren(iframe);
        if (openLink) openLink.href = entry.link;
    }

    if (entries.length > 1) {
        entries.forEach((entry, i) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "music__tab";
            btn.textContent = entry.title;
            btn.setAttribute("aria-pressed", i === 0 ? "true" : "false");
            btn.addEventListener("click", () => {
                buttons.forEach((b) => b.setAttribute("aria-pressed", "false"));
                btn.setAttribute("aria-pressed", "true");
                show(entry);
            });
            buttons.push(btn);
            tabsBox.append(btn);
        });
    }

    section.hidden = false;
    show(entries[0]);
})();
