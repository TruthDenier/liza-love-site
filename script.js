(() => {
    "use strict";

    const START = new Date(2026, 8, 12, 13, 34, 0);

    // --- Общая база моментов (Supabase). Значения задаются в config.js ---
    const CFG = window.APP_CONFIG || {};
    const API = String(CFG.SUPABASE_URL || "")
        .trim()
        .replace(/\/+$/, "")
        .replace(/\/rest\/v1$/i, "") // URL можно вставлять и с /rest/v1 на конце
        .replace(/\/+$/, "");

    const RAW_KEY = String(CFG.SUPABASE_ANON_KEY || "").trim();
    // Secret/service-ключ нельзя отдавать в браузер: он даёт полный доступ к базе.
    const KEY_IS_SECRET = /^sb_secret_/i.test(RAW_KEY);
    const ANON = KEY_IS_SECRET ? "" : RAW_KEY;
    const ONLINE = Boolean(API && ANON);
    const TABLE = "moments";

    const STORE_KEY = "liza.moments.v1"; // моменты этого браузера (до перехода на общую базу)
    const CACHE_KEY = "liza.moments.cache.v1"; // копия общей ленты на случай офлайна
    const MIGRATED_KEY = "liza.moments.migrated.v1";

    const $ = (id) => document.getElementById(id);

    const el = {
        daysBig: $("daysBig"),
        tDays: $("tDays"),
        tHours: $("tHours"),
        tMins: $("tMins"),
        tSecs: $("tSecs"),
        nextPill: $("nextPill"),
        nextText: $("nextText"),
        timeline: $("timeline"),
        empty: $("empty"),
        addBtn: $("addBtn"),
        dlg: $("dlg"),
        form: $("form"),
        cancelBtn: $("cancelBtn"),
        emojiPicker: $("emojiPicker"),
        fEmoji: $("fEmoji"),
        fDate: $("fDate"),
        sync: $("sync"),
        formErr: $("formErr"),
        submitBtn: document.querySelector('#form button[type="submit"]'),
    };

    const pad = (n) => String(n).padStart(2, "0");

    const newId = () =>
        "m-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    function nextMonthiversary(now) {
        let d = new Date(now.getFullYear(), now.getMonth(), 12, 13, 34, 0);
        if (d <= now)
            d = new Date(now.getFullYear(), now.getMonth() + 1, 12, 13, 34, 0);
        return d;
    }

    function plural(n, one, few, many) {
        const m10 = n % 10,
            m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return one;
        if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
        return many;
    }

    function tick() {
        const now = new Date();
        let diff = now - START;

        const future = diff < 0;
        if (future) diff = -diff;

        const totalSec = Math.floor(diff / 1000);
        const days = Math.floor(totalSec / 86400);
        const hours = Math.floor((totalSec % 86400) / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;

        el.daysBig.textContent = days.toLocaleString("ru-RU");
        el.tDays.textContent = days.toLocaleString("ru-RU");
        el.tHours.textContent = pad(hours);
        el.tMins.textContent = pad(mins);
        el.tSecs.textContent = pad(secs);

        if (!future) {
            const target = nextMonthiversary(now);
            const monthsSince =
                (target.getFullYear() - START.getFullYear()) * 12 +
                (target.getMonth() - START.getMonth());

            const msLeft = target - now;
            const dLeft = Math.floor(msLeft / 86400000);
            const hLeft = Math.floor((msLeft % 86400000) / 3600000);
            const mLeft = Math.floor((msLeft % 3600000) / 60000);

            el.nextPill.textContent =
                monthsSince +
                " " +
                plural(monthsSince, "месяц", "месяца", "месяцев");

            const dayWord = plural(dLeft, "день", "дня", "дней");
            el.nextText.innerHTML =
                dLeft > 0
                    ? `до следующей — <b>${dLeft} ${dayWord}</b> ${hLeft} ч ${mLeft} мин`
                    : `сегодня! 🎉 осталось <b>${hLeft} ч ${mLeft} мин</b>`;
        }
    }

    tick();
    setInterval(tick, 1000);

    const DEFAULTS = [
        {
            id: "seed-1",
            emoji: "💌",
            date: "2026-09-12",
            title: "Мы познакомились",
            note: "13:34. Точка отсчёта. С этого момента всё и началось.",
            key: true,
        },
    ];

    // ---------- локальное хранилище ----------
    function loadLocal() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (!raw) return DEFAULTS.slice();
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : DEFAULTS.slice();
        } catch {
            return DEFAULTS.slice();
        }
    }

    function saveLocal(list) {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(list));
        } catch (e) {
            console.warn("Не удалось сохранить локально:", e);
        }
    }

    function loadCache() {
        try {
            const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveCache(list) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(list));
        } catch {
            /* кеш не критичен */
        }
    }

    // ---------- запросы к общей базе ----------
    const apiHeaders = (extra) => ({
        apikey: ANON,
        Authorization: "Bearer " + ANON,
        "Content-Type": "application/json",
        ...extra,
    });

    const fromRow = (r) => ({
        id: r.id,
        emoji: r.emoji || "💌",
        date: r.date,
        title: r.title,
        note: r.note || "",
        key: Boolean(r.is_key),
    });

    const toRow = (m) => ({
        id: m.id,
        emoji: m.emoji || "💌",
        date: m.date,
        title: m.title,
        note: m.note || "",
        is_key: Boolean(m.key),
    });

    async function apiList() {
        const res = await fetch(
            `${API}/rest/v1/${TABLE}?select=id,emoji,date,title,note,is_key&order=date.asc,created_at.asc`,
            { headers: apiHeaders() },
        );
        if (!res.ok) throw new Error(`GET ${res.status}: ${await res.text()}`);
        return (await res.json()).map(fromRow);
    }

    async function apiCreate(moment) {
        const res = await fetch(`${API}/rest/v1/${TABLE}`, {
            method: "POST",
            headers: apiHeaders({ Prefer: "return=representation" }),
            body: JSON.stringify(toRow(moment)),
        });
        if (!res.ok) throw new Error(`POST ${res.status}: ${await res.text()}`);
        const rows = await res.json();
        return rows[0] ? fromRow(rows[0]) : moment;
    }

    async function apiDelete(id) {
        const res = await fetch(
            `${API}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`,
            { method: "DELETE", headers: apiHeaders() },
        );
        if (!res.ok)
            throw new Error(`DELETE ${res.status}: ${await res.text()}`);
    }

    let moments = ONLINE ? loadCache() : loadLocal();

    const MONTHS = [
        "января",
        "февраля",
        "марта",
        "апреля",
        "мая",
        "июня",
        "июля",
        "августа",
        "сентября",
        "октября",
        "ноября",
        "декабря",
    ];

    function formatDate(iso) {
        const [y, m, d] = iso.split("-").map(Number);
        return `${d} ${MONTHS[m - 1]} ${y}`;
    }

    function render() {
        const sorted = [...moments].sort((a, b) =>
            a.date.localeCompare(b.date),
        );

        el.timeline.replaceChildren();

        if (!sorted.length) {
            el.empty.hidden = false;
            return;
        }
        el.empty.hidden = true;

        const frag = document.createDocumentFragment();

        sorted.forEach((m, i) => {
            const li = document.createElement("li");
            li.className = "moment" + (m.key ? " moment--key" : "");
            li.style.animationDelay = Math.min(i * 60, 400) + "ms";

            const dot = document.createElement("span");
            dot.className = "moment__dot";
            dot.setAttribute("aria-hidden", "true");

            const card = document.createElement("div");
            card.className = "moment__card";

            const top = document.createElement("div");
            top.className = "moment__top";

            const emoji = document.createElement("span");
            emoji.className = "moment__emoji";
            emoji.textContent = m.emoji || "💫";
            emoji.setAttribute("aria-hidden", "true");

            const head = document.createElement("div");

            const title = document.createElement("h3");
            title.className = "moment__title";
            title.textContent = m.title;

            const time = document.createElement("time");
            time.className = "moment__date";
            time.dateTime = m.date;
            time.textContent = formatDate(m.date);

            head.append(title, time);

            const del = document.createElement("button");
            del.className = "moment__del";
            del.type = "button";
            del.textContent = "×";
            del.title = "Удалить";
            del.setAttribute("aria-label", "Удалить момент: " + m.title);
            del.addEventListener("click", async () => {
                if (!confirm("Удалить «" + m.title + "»?")) return;

                if (!ONLINE) {
                    moments = moments.filter((x) => x.id !== m.id);
                    saveLocal(moments);
                    render();
                    return;
                }

                const prev = moments;
                moments = moments.filter((x) => x.id !== m.id);
                render();

                try {
                    await apiDelete(m.id);
                    saveCache(moments);
                    setStatus("");
                } catch (e) {
                    console.warn(e);
                    moments = prev;
                    render();
                    setStatus(
                        "Не удалось удалить момент — попробуй ещё раз.",
                        "error",
                    );
                }
            });

            top.append(emoji, head, del);
            card.append(top);

            if (m.note) {
                const note = document.createElement("p");
                note.className = "moment__note";
                note.textContent = m.note;
                card.append(note);
            }

            li.append(dot, card);
            frag.append(li);
        });

        el.timeline.append(frag);
    }

    // ---------- состояние общей ленты ----------
    function setStatus(text, tone) {
        if (!el.sync) return;
        el.sync.hidden = !text;
        el.sync.textContent = text || "";
        el.sync.dataset.tone = tone || "info";
    }

    function showFormError(text) {
        if (!el.formErr) return;
        el.formErr.hidden = !text;
        el.formErr.textContent = text || "";
    }

    function setBusy(busy) {
        if (!el.submitBtn) return;
        el.submitBtn.disabled = busy;
        el.submitBtn.textContent = busy ? "Сохраняю…" : "Сохранить";
    }

    // Моменты, которые были сохранены в этом браузере до появления общей базы.
    function readLegacyLocal() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((m) => m && m.id && m.title && m.date);
        } catch {
            return [];
        }
    }

    async function migrateLocalOnce(remote) {
        if (localStorage.getItem(MIGRATED_KEY)) return remote;

        const legacy = readLegacyLocal();
        const knownIds = new Set(remote.map((m) => m.id));
        const knownKeys = new Set(remote.map((m) => m.date + "|" + m.title));
        const pending = legacy.filter(
            (m) =>
                !knownIds.has(m.id) && !knownKeys.has(m.date + "|" + m.title),
        );

        let failed = false;
        for (const m of pending) {
            try {
                await apiCreate(m);
            } catch (e) {
                console.warn("Не удалось перенести момент в общую базу:", e);
                failed = true;
            }
        }

        if (!failed) localStorage.setItem(MIGRATED_KEY, "1");
        return pending.length && !failed ? apiList() : remote;
    }

    let syncing = false;

    async function sync() {
        if (!ONLINE || syncing) return;
        syncing = true;

        if (!moments.length) setStatus("загружаю моменты…");

        try {
            const remote = await apiList();
            moments = await migrateLocalOnce(remote);
            saveCache(moments);
            render();
            setStatus("");
        } catch (e) {
            console.warn(e);
            setStatus(
                "Сервер недоступен — показана сохранённая копия. Новый момент может не сохраниться.",
                "error",
            );
        } finally {
            syncing = false;
        }
    }

    render();

    if (ONLINE) {
        sync();
    } else if (KEY_IS_SECRET) {
        setStatus(
            "В config.js вставлен secret key. Он даёт полный доступ к базе и не должен быть в браузере — замени его на anon public / publishable key. Пока моменты видны только в этом браузере.",
            "error",
        );
    } else {
        setStatus(
            "Общая лента не подключена: заполни SUPABASE_URL и SUPABASE_ANON_KEY в config.js. Пока моменты видны только в этом браузере.",
            "error",
        );
    }

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) sync();
    });

    el.fDate.value = new Date().toISOString().slice(0, 10);

    el.addBtn.addEventListener("click", () => {
        el.form.reset();
        showFormError("");
        el.fEmoji.value = "💌";
        el.fDate.value = new Date().toISOString().slice(0, 10);
        el.dlg.showModal();
        requestAnimationFrame(() => el.fEmoji.focus());
    });

    el.cancelBtn.addEventListener("click", () => el.dlg.close());

    el.emojiPicker.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (btn) el.fEmoji.value = btn.textContent.trim();
    });

    el.form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(el.form);

        const title = String(fd.get("title") || "").trim();
        const date = String(fd.get("date") || "").trim();
        if (!title || !date) return;

        const moment = {
            id: newId(),
            emoji: String(fd.get("emoji") || "💌").trim() || "💌",
            date,
            title,
            note: String(fd.get("note") || "").trim(),
        };

        showFormError("");

        // Без настроек общей базы — как раньше, только в этом браузере.
        if (!ONLINE) {
            moments.push(moment);
            saveLocal(moments);
            render();
            el.dlg.close();
            return;
        }

        setBusy(true);
        try {
            const saved = await apiCreate(moment);
            moments.push(saved);
            saveCache(moments);
            render();
            el.dlg.close();
        } catch (err) {
            console.warn(err);
            showFormError(
                "Не получилось сохранить: сервер не ответил. Проверь интернет и попробуй ещё раз.",
            );
        } finally {
            setBusy(false);
        }
    });

    const heartsBox = $("hearts");
    const GLYPHS = ["♥", "♡", "❤", "💗"];
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduceMotion) {
        const spawn = () => {
            const h = document.createElement("span");
            h.className = "heart";
            h.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            h.style.left = Math.random() * 100 + "vw";
            h.style.fontSize = 12 + Math.random() * 22 + "px";
            h.style.animationDuration = 9 + Math.random() * 8 + "s";
            heartsBox.append(h);
            setTimeout(() => h.remove(), 18000);
        };

        for (let i = 0; i < 6; i++) setTimeout(spawn, i * 700);
        setInterval(spawn, 1100);
    }
})();
