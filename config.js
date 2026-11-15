// Подключение к общей базе моментов (Supabase).
//
// 1. Зайди в свой проект на https://supabase.com
// 2. Слева: Project Settings -> API Keys
// 3. Скопируй "Project URL" в SUPABASE_URL (можно и с /rest/v1 на конце)
// 4. Скопируй ПУБЛИЧНЫЙ ключ "anon public" (или "publishable") в SUPABASE_ANON_KEY
// 5. Сохрани файл и залей на GitHub.
//
// ВАЖНО: НЕ вставляй сюда secret / service_role ключ (sb_secret_...).
// Он даёт полный доступ к базе, виден всем посетителям сайта и будет
// заблокирован защитой GitHub. Публичный ключ обычно начинается с eyJ...
// или sb_publishable_.
//
// Публичный ключ предназначен для браузера и виден всем — это нормально.
// Доступ к данным ограничивают правила (RLS) в самой базе.

window.APP_CONFIG = {
    SUPABASE_URL: "https://mqpghdedqlzxouxeztew.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_NEREpm9iNunX5tGxYY4JZQ_G132iQ2k",

    // Музыка: ссылки на трек, альбом или публичный плейлист Яндекс Музыки.
    // Ссылку бери из приложения: «Поделиться» -> «Скопировать ссылку».
    //
    // Одна ссылка:
    // MUSIC: "https://music.yandex.ru/album/1339814/track/10994777",
    //
    // Несколько — появятся кнопки переключения:
    // MUSIC: [
    //     { title: "Наша песня", url: "https://music.yandex.ru/album/1339814/track/10994777" },
    //     { title: "Плейлист", url: "https://music.yandex.ru/users/music-blog/playlists/2489" },
    // ],
    //
    // Пока список пуст, блок «Наша музыка» на странице не показывается.
    MUSIC: [],
};
