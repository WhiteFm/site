// Язык по умолчанию
const defaultLang = 'en';

// Проверяем, есть ли сохраненный язык в памяти браузера
let currentLang = localStorage.getItem('wsguild_lang') || defaultLang;

// Функция загрузки перевода
async function loadTranslations(lang) {
    try {
        // Абсолютный путь к корню сайта (работает и из корня, и из папки htmls)
        const response = await fetch(`/locales/${lang}.json`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const translations = await response.json();

        // Находим все элементы с атрибутом data-i18n и меняем им текст
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[key]) {
                el.textContent = translations[key];
            }
        });

        // Подсвечиваем активную кнопку языка
        const btnEn = document.getElementById('btn-en');
        const btnRu = document.getElementById('btn-ru');

        if (btnEn) btnEn.classList.toggle('active', lang === 'en');
        if (btnRu) btnRu.classList.toggle('active', lang === 'ru');

        // Меняем атрибут lang у тега <html>
        document.documentElement.lang = lang;

    } catch (error) {
        console.error('Ошибка загрузки файла перевода. Убедитесь, что запущен локальный сервер.', error);
    }
}

// Функция смены языка (вызывается при клике на кнопки)
function changeLang(lang) {
    currentLang = lang;
    localStorage.setItem('wsguild_lang', lang); // Сохраняем выбор
    loadTranslations(lang); // Обновляем текст
}

// Запускаем перевод при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadTranslations(currentLang);
});