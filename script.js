(() => {
    "use strict";

    const START = new Date(2026, 8, 12, 13, 34, 0);
    const STORE_KEY = "liza.moments.v1";

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
    };

    const pad = (n) => String(n).padStart(2, "0");

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

    function load() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (!raw) return DEFAULTS.slice();
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : DEFAULTS.slice();
        } catch {
            return DEFAULTS.slice();
        }
    }

    function save(list) {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(list));
        } catch (e) {
            console.warn("Не удалось сохранить:", e);
        }
    }

    let moments = load();

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
            del.addEventListener("click", () => {
                if (!confirm("Удалить «" + m.title + "»?")) return;
                moments = moments.filter((x) => x.id !== m.id);
                save(moments);
                render();
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

    render();

    el.fDate.value = new Date().toISOString().slice(0, 10);

    el.addBtn.addEventListener("click", () => {
        el.form.reset();
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

    el.form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(el.form);

        const title = String(fd.get("title") || "").trim();
        const date = String(fd.get("date") || "").trim();
        if (!title || !date) return;

        moments.push({
            id:
                "m-" +
                Date.now().toString(36) +
                Math.random().toString(36).slice(2, 6),
            emoji: String(fd.get("emoji") || "💌").trim() || "💌",
            date,
            title,
            note: String(fd.get("note") || "").trim(),
        });

        save(moments);
        render();
        el.dlg.close();
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





