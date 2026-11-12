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
    const MEMBER_KEY = "liza.member.v1"; // кто вошёл в этом браузере
    const BUCKET = "moments"; // бакет Supabase Storage для фотографий

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
        fTitle: $("fTitle"),
        fNote: $("fNote"),
        sync: $("sync"),
        formErr: $("formErr"),
        submitBtn: document.querySelector('#form button[type="submit"]'),
        dlgTitle: $("dlgTitle"),
        dlgHint: $("dlgHint"),
        photoField: $("photoField"),
        fPhoto: $("fPhoto"),
        photoBox: $("photoBox"),
        photoImg: $("photoImg"),
        photoClear: $("photoClear"),
        who: $("who"),
        whoGuest: $("whoGuest"),
        whoMe: $("whoMe"),
        whoName: $("whoName"),
        whoAvatar: $("whoAvatar"),
        loginBtn: $("loginBtn"),
        logoutBtn: $("logoutBtn"),
        authDlg: $("authDlg"),
        authForm: $("authForm"),
        aName: $("aName"),
        aPin: $("aPin"),
        authErr: $("authErr"),
        authCancel: $("authCancel"),
        authRegister: $("authRegister"),
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
        createdBy: r.created_by || "",
        editedBy: r.edited_by || "",
        editedAt: r.edited_at || "",
        photoUrl: r.photo_url || "",
        photoPath: r.photo_path || "",
    });

    const FIELDS =
        "id,emoji,date,title,note,is_key,created_by,edited_by,edited_at,photo_url,photo_path";
    const FIELDS_BASIC = "id,emoji,date,title,note,is_key";

    // Новые поля появляются только после запуска supabase-setup.sql.
    // Пока их нет, сайт работает в базовом режиме и не ломается.
    let EXTENDED = ONLINE;

    const toRowBasic = (m) => ({
        id: m.id,
        emoji: m.emoji || "💌",
        date: m.date,
        title: m.title,
        note: m.note || "",
        is_key: Boolean(m.key),
    });

    const toRow = (m) =>
        EXTENDED
            ? {
                  ...toRowBasic(m),
                  created_by: m.createdBy || null,
                  edited_by: m.editedBy || null,
                  edited_at: m.editedAt || null,
                  photo_url: m.photoUrl || null,
                  photo_path: m.photoPath || null,
              }
            : toRowBasic(m);

    async function fetchList(fields) {
        const res = await fetch(
            `${API}/rest/v1/${TABLE}?select=${fields}&order=date.asc,created_at.asc`,
            { headers: apiHeaders() },
        );
        if (!res.ok) throw new Error(`GET ${res.status}: ${await res.text()}`);
        return (await res.json()).map(fromRow);
    }

    async function apiList() {
        if (!EXTENDED) return fetchList(FIELDS_BASIC);
        try {
            return await fetchList(FIELDS);
        } catch (e) {
            console.warn("Расширенные поля недоступны:", e);
            EXTENDED = false;
            renderWho();
            return fetchList(FIELDS_BASIC);
        }
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

    async function apiUpdate(id, patch) {
        const body = EXTENDED
            ? patch
            : {
                  emoji: patch.emoji,
                  date: patch.date,
                  title: patch.title,
                  note: patch.note,
              };

        const res = await fetch(
            `${API}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`,
            {
                method: "PATCH",
                headers: apiHeaders({ Prefer: "return=representation" }),
                body: JSON.stringify(body),
            },
        );
        if (!res.ok)
            throw new Error(`PATCH ${res.status}: ${await res.text()}`);
        const rows = await res.json();
        return rows[0] ? fromRow(rows[0]) : null;
    }

    async function apiDelete(id) {
        const res = await fetch(
            `${API}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`,
            { method: "DELETE", headers: apiHeaders() },
        );
        if (!res.ok)
            throw new Error(`DELETE ${res.status}: ${await res.text()}`);
    }

    // ---------- вход и регистрация ----------
    async function rpc(name, body) {
        const res = await fetch(`${API}/rest/v1/rpc/${name}`, {
            method: "POST",
            headers: apiHeaders(),
            body: JSON.stringify(body),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(text || `RPC ${res.status}`);
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    function hashPin(name, pin) {
        const input = name.trim().toLowerCase() + ":" + pin;
        // FNV-1a: запасной вариант, если crypto.subtle недоступен.
        let h1 = 0x811c9dc5;
        for (let i = 0; i < input.length; i++) {
            h1 ^= input.charCodeAt(i);
            h1 = Math.imul(h1, 0x01000193) >>> 0;
        }
        let h2 = 0x9e3779b9;
        for (let i = input.length - 1; i >= 0; i--) {
            h2 ^= input.charCodeAt(i);
            h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
        }
        return (
            "f" +
            h1.toString(16).padStart(8, "0") +
            h2.toString(16).padStart(8, "0")
        );
    }

    async function pinHash(name, pin) {
        const input = name.trim().toLowerCase() + ":" + pin;
        if (
            window.crypto &&
            crypto.subtle &&
            window.isSecureContext !== false
        ) {
            try {
                const buf = await crypto.subtle.digest(
                    "SHA-256",
                    new TextEncoder().encode(input),
                );
                return Array.from(new Uint8Array(buf))
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
            } catch {
                /* переходим к запасному варианту */
            }
        }
        return hashPin(name, pin);
    }

    const apiRegister = (name, hash) =>
        rpc("member_register", { p_name: name, p_hash: hash });
    const apiLogin = (name, hash) =>
        rpc("member_login", { p_name: name, p_hash: hash });

    function loadMember() {
        try {
            const m = JSON.parse(localStorage.getItem(MEMBER_KEY) || "null");
            return m && m.name ? m : null;
        } catch {
            return null;
        }
    }

    let me = loadMember();

    function saveMember(member) {
        me = member;
        try {
            if (member)
                localStorage.setItem(MEMBER_KEY, JSON.stringify(member));
            else localStorage.removeItem(MEMBER_KEY);
        } catch {
            /* приватный режим — просто не запомним */
        }
        renderWho();
    }

    // ---------- фотографии ----------
    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("bad image"));
            };
            img.src = url;
        });
    }

    async function shrinkPhoto(file, maxSide = 1600, quality = 0.82) {
        const img = await loadImage(file);
        const w0 = img.naturalWidth || img.width;
        const h0 = img.naturalHeight || img.height;
        const scale = Math.min(1, maxSide / Math.max(w0, h0));
        const w = Math.max(1, Math.round(w0 * scale));
        const h = Math.max(1, Math.round(h0 * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", quality),
        );
        if (!blob) throw new Error("Не удалось обработать фото");
        return blob;
    }

    async function uploadPhoto(blob) {
        const path = `m-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 8)}.jpg`;
        const res = await fetch(`${API}/storage/v1/object/${BUCKET}/${path}`, {
            method: "POST",
            headers: {
                apikey: ANON,
                Authorization: "Bearer " + ANON,
                "Content-Type": "image/jpeg",
                "x-upsert": "true",
                "cache-control": "31536000",
            },
            body: blob,
        });
        if (!res.ok)
            throw new Error(`UPLOAD ${res.status}: ${await res.text()}`);
        return {
            path,
            url: `${API}/storage/v1/object/public/${BUCKET}/${path}`,
        };
    }

    async function removePhoto(path) {
        if (!path) return;
        try {
            await fetch(`${API}/storage/v1/object/${BUCKET}/${path}`, {
                method: "DELETE",
                headers: apiHeaders(),
            });
        } catch {
            /* фото могло уже исчезнуть — не мешаем */
        }
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

    const MONTHS_SHORT = [
        "янв",
        "фев",
        "мар",
        "апр",
        "мая",
        "июн",
        "июл",
        "авг",
        "сен",
        "окт",
        "ноя",
        "дек",
    ];

    function shortDate(value) {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
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

            const acts = document.createElement("div");
            acts.className = "moment__acts";

            const edit = document.createElement("button");
            edit.className = "moment__act";
            edit.type = "button";
            edit.textContent = "✎";
            edit.title = "Изменить";
            edit.setAttribute("aria-label", "Изменить момент: " + m.title);
            edit.addEventListener("click", () => openForm(m));

            const del = document.createElement("button");
            del.className = "moment__act";
            del.type = "button";
            del.textContent = "×";
            del.title = "Удалить";
            del.setAttribute("aria-label", "Удалить момент: " + m.title);
            del.addEventListener("click", async () => {
                if (ONLINE && EXTENDED && !me) {
                    showAuth();
                    return;
                }
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
                    await removePhoto(m.photoPath);
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

            acts.append(...(EXTENDED ? [edit, del] : [del]));
            top.append(emoji, head, acts);
            card.append(top);

            if (m.note) {
                const note = document.createElement("p");
                note.className = "moment__note";
                note.textContent = m.note;
                card.append(note);
            }

            if (m.photoUrl) {
                const link = document.createElement("a");
                link.className = "moment__photo";
                link.href = m.photoUrl;
                link.target = "_blank";
                link.rel = "noopener";

                const img = document.createElement("img");
                img.src = m.photoUrl;
                img.alt = "Фото к моменту: " + m.title;
                img.loading = "lazy";
                img.decoding = "async";

                link.append(img);
                card.append(link);
            }

            if (m.createdBy) {
                const by = document.createElement("p");
                by.className = "moment__by";

                const author = document.createElement("span");
                author.textContent = "♥ " + m.createdBy;
                by.append(author);

                if (m.editedBy) {
                    const edited = document.createElement("span");
                    edited.className = "moment__edited";
                    edited.textContent =
                        "✎ " +
                        m.editedBy +
                        (m.editedAt ? " · " + shortDate(m.editedAt) : "");
                    by.append(edited);
                }

                card.append(by);
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

    // ---------- профиль и вход ----------
    function renderWho() {
        if (!el.who) return;
        el.who.hidden = !ONLINE || !EXTENDED;

        const logged = Boolean(me);
        el.whoGuest.hidden = logged;
        el.whoMe.hidden = !logged;

        if (logged) {
            el.whoName.textContent = me.name;
            el.whoAvatar.textContent =
                me.name.trim().charAt(0).toUpperCase() || "♥";
        }

        if (el.photoField) el.photoField.hidden = !ONLINE || !EXTENDED;
    }

    function showAuthError(text) {
        if (!el.authErr) return;
        el.authErr.hidden = !text;
        el.authErr.textContent = text || "";
    }

    function showAuth() {
        if (!ONLINE || !el.authDlg) return;
        showAuthError("");
        el.authForm.reset();
        el.authDlg.showModal();
        requestAnimationFrame(() => el.aName.focus());
    }

    async function doAuth(kind) {
        const name = el.aName.value.trim();
        const pin = el.aPin.value;

        if (name.length < 2) {
            showAuthError("Имя — хотя бы 2 символа.");
            return;
        }
        if (pin.length < 4) {
            showAuthError("PIN — хотя бы 4 символа.");
            return;
        }

        const buttons = [
            el.authRegister,
            el.authForm.querySelector('button[type="submit"]'),
        ].filter(Boolean);
        buttons.forEach((b) => (b.disabled = true));
        showAuthError("");

        try {
            const hash = await pinHash(name, pin);

            if (kind === "register") {
                const saved = await apiRegister(name, hash);
                saveMember({ name: saved || name, at: Date.now() });
                el.authDlg.close();
                setStatus("");
            } else {
                const found = await apiLogin(name, hash);
                if (!found) {
                    showAuthError(
                        "Не совпало имя или PIN. Если ты здесь впервые — нажми «Создать».",
                    );
                    return;
                }
                saveMember({ name: found, at: Date.now() });
                el.authDlg.close();
            }
        } catch (e) {
            console.warn(e);
            const text = String(e.message || "");
            if (text.includes("name_taken")) {
                showAuthError(
                    "Это имя уже занято. Попробуй войти или выбери другое.",
                );
            } else if (text.includes("bad_name")) {
                showAuthError("Имя должно быть от 2 до 24 символов.");
            } else {
                showAuthError(
                    "Сервер не ответил. Проверь интернет и попробуй ещё раз.",
                );
            }
        } finally {
            buttons.forEach((b) => (b.disabled = false));
        }
    }

    // ---------- форма момента ----------
    let editingId = null;
    let photo = { blob: null, url: "", path: "", dropPath: "" };

    function setPhotoPreview(url) {
        if (!url) {
            el.photoBox.hidden = true;
            el.photoImg.removeAttribute("src");
            return;
        }
        el.photoImg.src = url;
        el.photoBox.hidden = false;
    }

    function openForm(moment) {
        if (ONLINE && EXTENDED && !me) {
            showAuth();
            return;
        }

        el.form.reset();
        showFormError("");
        editingId = moment ? moment.id : null;
        photo = {
            blob: null,
            url: moment?.photoUrl || "",
            path: moment?.photoPath || "",
            dropPath: "",
        };
        setPhotoPreview(photo.url);

        el.dlgTitle.textContent = moment ? "Изменить момент" : "Новый момент";
        el.dlgHint.textContent = moment
            ? "Поправь, что нужно — останется отметка, кто изменил."
            : "Дата, событие — и пара слов, чтобы потом перечитать.";

        el.fEmoji.value = moment?.emoji || "💌";
        el.fDate.value = moment?.date || new Date().toISOString().slice(0, 10);
        el.fTitle.value = moment?.title || "";
        el.fNote.value = moment?.note || "";

        el.dlg.showModal();
        requestAnimationFrame(() => el.fEmoji.focus());
    }

    renderWho();

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

    el.addBtn.addEventListener("click", () => openForm(null));

    el.cancelBtn.addEventListener("click", () => el.dlg.close());

    el.emojiPicker.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (btn) el.fEmoji.value = btn.textContent.trim();
    });

    el.loginBtn.addEventListener("click", showAuth);
    el.logoutBtn.addEventListener("click", () => saveMember(null));
    el.authCancel.addEventListener("click", () => el.authDlg.close());
    el.authRegister.addEventListener("click", () => doAuth("register"));
    el.authForm.addEventListener("submit", (e) => {
        e.preventDefault();
        doAuth("login");
    });

    el.fPhoto.addEventListener("change", async () => {
        const file = el.fPhoto.files && el.fPhoto.files[0];
        if (!file) return;

        showFormError("");
        try {
            const blob = await shrinkPhoto(file);
            if (photo.path) photo.dropPath = photo.path;
            photo = {
                blob,
                url: URL.createObjectURL(blob),
                path: "",
                dropPath: photo.dropPath,
            };
            setPhotoPreview(photo.url);
        } catch (e) {
            console.warn(e);
            showFormError(
                "Не удалось прочитать это фото. Попробуй другой файл.",
            );
        }
    });

    el.photoClear.addEventListener("click", () => {
        if (photo.path) photo.dropPath = photo.path;
        photo = { blob: null, url: "", path: "", dropPath: photo.dropPath };
        el.fPhoto.value = "";
        setPhotoPreview("");
    });

    el.form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(el.form);

        const title = String(fd.get("title") || "").trim();
        const date = String(fd.get("date") || "").trim();
        if (!title || !date) return;

        if (ONLINE && EXTENDED && !me) {
            showAuth();
            return;
        }

        showFormError("");

        const base = {
            emoji: String(fd.get("emoji") || "💌").trim() || "💌",
            date,
            title,
            note: String(fd.get("note") || "").trim(),
        };

        // Без настроек общей базы — как раньше, только в этом браузере.
        if (!ONLINE) {
            if (editingId) {
                moments = moments.map((x) =>
                    x.id === editingId ? { ...x, ...base } : x,
                );
                saveLocal(moments);
            } else {
                moments.push({ id: newId(), ...base });
                saveLocal(moments);
            }
            render();
            el.dlg.close();
            return;
        }

        setBusy(true);
        try {
            let photoUrl = null;
            let photoPath = null;

            if (photo.blob) {
                const uploaded = await uploadPhoto(photo.blob);
                photoUrl = uploaded.url;
                photoPath = uploaded.path;
            } else if (photo.path) {
                photoUrl = photo.url;
                photoPath = photo.path;
            }

            if (editingId) {
                const editedAt = new Date().toISOString();
                const editor = me?.name || null;
                const saved = await apiUpdate(editingId, {
                    ...base,
                    edited_by: editor,
                    edited_at: editedAt,
                    photo_url: photoUrl,
                    photo_path: photoPath,
                });

                moments = moments.map((x) =>
                    x.id === editingId
                        ? saved || {
                              ...x,
                              ...base,
                              editedBy: editor || "",
                              editedAt,
                              photoUrl: photoUrl || "",
                              photoPath: photoPath || "",
                          }
                        : x,
                );
            } else {
                const saved = await apiCreate({
                    id: newId(),
                    ...base,
                    createdBy: me?.name || null,
                    photoUrl,
                    photoPath,
                });
                moments.push(saved);
            }

            if (photo.dropPath && photo.dropPath !== photoPath) {
                await removePhoto(photo.dropPath);
            }

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
