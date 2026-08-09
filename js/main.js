const supportedLanguages = ['en', 'ru'];
const defaultLanguage = 'en';
let currentLanguage = localStorage.getItem('wsguild_lang') || defaultLanguage;

if (window.location.pathname.endsWith('/index.html')) {
    const cleanPath = window.location.pathname.slice(0, -'index.html'.length);
    window.history.replaceState(null, '', cleanPath + window.location.search + window.location.hash);
}

if (!supportedLanguages.includes(currentLanguage)) {
    currentLanguage = defaultLanguage;
}

async function loadTranslations(language) {
    try {
        const response = await fetch(`/locales/${language}.json`);

        if (!response.ok) {
            throw new Error(`Translation request failed: ${response.status}`);
        }

        const translations = await response.json();

        document.querySelectorAll('[data-i18n]').forEach((element) => {
            const key = element.dataset.i18n;

            if (Object.prototype.hasOwnProperty.call(translations, key)) {
                element.textContent = translations[key];
            }
        });

        document.querySelectorAll('*').forEach((element) => {
            Array.from(element.attributes).forEach((attribute) => {
                const prefix = 'data-i18n-attr-';

                if (!attribute.name.startsWith(prefix)) {
                    return;
                }

                const targetAttribute = attribute.name.slice(prefix.length);
                const key = attribute.value;

                if (Object.prototype.hasOwnProperty.call(translations, key)) {
                    element.setAttribute(targetAttribute, translations[key]);
                }
            });
        });

        const titleKey = document.body.dataset.pageTitle;
        if (titleKey && translations[titleKey]) {
            document.title = translations[titleKey];
        }

        document.documentElement.lang = language;
        document.getElementById('btn-en')?.classList.toggle('active', language === 'en');
        document.getElementById('btn-ru')?.classList.toggle('active', language === 'ru');
        document.getElementById('btn-en')?.setAttribute('aria-pressed', String(language === 'en'));
        document.getElementById('btn-ru')?.setAttribute('aria-pressed', String(language === 'ru'));
    } catch (error) {
        console.error('Unable to load translations.', error);
    }
}

function changeLang(language) {
    if (!supportedLanguages.includes(language)) {
        return;
    }

    currentLanguage = language;
    localStorage.setItem('wsguild_lang', language);
    loadTranslations(language);
}

document.addEventListener('DOMContentLoaded', () => {
    loadTranslations(currentLanguage);
});
