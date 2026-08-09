(() => {
    const video = document.getElementById('tutorial-video');

    if (!video) {
        return;
    }

    const elements = {
        shell: document.querySelector('.video-shell'),
        stage: document.querySelector('.video-stage'),
        empty: document.getElementById('video-empty'),
        emptyTitle: document.getElementById('video-empty-title'),
        emptyText: document.getElementById('video-empty-text'),
        overlay: document.getElementById('video-overlay'),
        controls: document.querySelector('.video-controls'),
        play: document.getElementById('player-play'),
        playIcon: document.getElementById('player-play-icon'),
        progress: document.getElementById('player-progress'),
        time: document.getElementById('video-time'),
        volume: document.getElementById('player-volume'),
        volumeIcon: document.getElementById('player-volume-icon'),
        volumeFlyout: document.getElementById('volume-popover'),
        volumeRange: document.getElementById('volume-range'),
        volumeValue: document.getElementById('volume-value'),
        fullscreen: document.getElementById('player-fullscreen'),
        nowPlayingIndex: document.getElementById('now-playing-index'),
        nowPlayingTitle: document.getElementById('now-playing-title'),
        nowPlayingDescription: document.getElementById('now-playing-description'),
        list: document.getElementById('lesson-list'),
        fullscreenList: document.getElementById('fullscreen-lesson-list')
    };

    let lessons = [];
    let activeLessonIndex = -1;
    let translations = window.wsguildTranslations || {};
    let lastAudibleVolume = 1;
    let fullscreenIdleTimer;
    let volumeFlyoutEntered = false;
    const volumeStorageKey = 'wsguild-tutorials-player-volume';
    const fullscreenUiDelay = 2000;

    const text = (key) => translations[key] || '';

    const restoreVolume = () => {
        try {
            const savedState = JSON.parse(localStorage.getItem(volumeStorageKey));

            if (!savedState || typeof savedState !== 'object') {
                return;
            }

            if (Number.isFinite(savedState.volume)) {
                video.volume = Math.min(1, Math.max(0, savedState.volume));
            }

            if (Number.isFinite(savedState.lastAudibleVolume) && savedState.lastAudibleVolume > 0) {
                lastAudibleVolume = Math.min(1, savedState.lastAudibleVolume);
            } else if (video.volume > 0) {
                lastAudibleVolume = video.volume;
            }

            video.muted = Boolean(savedState.muted);
        } catch (error) {
            console.warn('Unable to restore the saved player volume.', error);
        }
    };

    const saveVolume = () => {
        try {
            localStorage.setItem(volumeStorageKey, JSON.stringify({
                volume: video.volume,
                muted: video.muted,
                lastAudibleVolume
            }));
        } catch (error) {
            console.warn('Unable to save the player volume.', error);
        }
    };

    const formatTime = (seconds) => {
        if (!Number.isFinite(seconds) || seconds < 0) {
            return '00:00';
        }

        const wholeSeconds = Math.floor(seconds);
        const minutes = Math.floor(wholeSeconds / 60);
        const remainder = wholeSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
    };

    const videoUrl = (fileName) => `/videos/${fileName.split('/').map(encodeURIComponent).join('/')}`;

    const setControlsEnabled = (enabled) => {
        [elements.play, elements.progress, elements.volume, elements.volumeRange, elements.fullscreen]
            .forEach((control) => { control.disabled = !enabled; });
    };

    const updateTime = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        elements.time.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
        elements.progress.value = duration > 0 ? Math.round((current / duration) * 1000) : 0;
    };

    const updatePlaybackState = () => {
        const playing = !video.paused && !video.ended;
        elements.playIcon.textContent = playing ? 'Ⅱ' : '▶';
        elements.play.setAttribute('aria-label', text(playing ? 'tutorials_pause_label' : 'tutorials_play_label'));
        elements.overlay.hidden = playing || activeLessonIndex < 0;
    };

    const updateVolumeState = () => {
        const muted = video.muted || video.volume === 0;
        elements.volumeIcon.textContent = muted ? '◇' : '◆';
        elements.volume.setAttribute('aria-label', text(muted ? 'tutorials_unmute_label' : 'tutorials_mute_label'));
        elements.volumeRange.value = muted ? 0 : video.volume;
        elements.volumeValue.textContent = `${Math.round((muted ? 0 : video.volume) * 100)}%`;
    };

    const isPlayerFullscreen = () => document.fullscreenElement === elements.shell;

    const hideFullscreenUi = () => {
        elements.shell.classList.remove('fullscreen-controls-visible');
        elements.shell.classList.remove('fullscreen-playlist-visible');
        elements.shell.classList.add('fullscreen-ui-idle');
        closeVolumeFlyout();
    };

    const scheduleFullscreenIdle = () => {
        clearTimeout(fullscreenIdleTimer);

        if (isPlayerFullscreen()) {
            fullscreenIdleTimer = setTimeout(hideFullscreenUi, fullscreenUiDelay);
        }
    };

    const showFullscreenControls = () => {
        if (!isPlayerFullscreen()) {
            return;
        }

        elements.shell.classList.remove('fullscreen-ui-idle');
        elements.shell.classList.add('fullscreen-controls-visible');
        scheduleFullscreenIdle();
    };

    const showFullscreenPlaylist = () => {
        if (!isPlayerFullscreen()) {
            return;
        }

        elements.shell.classList.remove('fullscreen-ui-idle');
        elements.shell.classList.add('fullscreen-controls-visible');
        elements.shell.classList.add('fullscreen-playlist-visible');
        scheduleFullscreenIdle();
    };

    const resetFullscreenUi = () => {
        clearTimeout(fullscreenIdleTimer);
        elements.shell.classList.remove(
            'fullscreen-controls-visible',
            'fullscreen-playlist-visible',
            'fullscreen-ui-idle'
        );
    };

    const openVolumeFlyout = () => {
        volumeFlyoutEntered = false;
        elements.controls.classList.add('volume-flyout-open');
    };

    const closeVolumeFlyout = () => {
        elements.controls.classList.remove('volume-flyout-open');
    };

    const setEmptyState = (titleKey, textKey) => {
        elements.empty.hidden = false;
        elements.overlay.hidden = true;
        elements.emptyTitle.textContent = text(titleKey);
        elements.emptyText.textContent = text(textKey);
        setControlsEnabled(false);
    };

    const renderLessonList = (container) => {
        container.replaceChildren();

        if (lessons.length === 0) {
            const message = document.createElement('p');
            message.className = 'lesson-empty';
            message.textContent = text('tutorials_lessons_empty');
            container.append(message);
            return;
        }

        lessons.forEach((lesson, index) => {
            const button = document.createElement('button');
            const number = document.createElement('span');
            const title = document.createElement('span');
            const duration = document.createElement('span');

            button.type = 'button';
            button.className = `lesson-item${index === activeLessonIndex ? ' active' : ''}`;
            button.setAttribute('aria-label', `${text('tutorials_open_lesson_label')} ${text(lesson.titleKey)}`.trim());
            number.className = 'lesson-number';
            number.textContent = String(index + 1).padStart(2, '0');
            title.className = 'lesson-title';
            title.textContent = text(lesson.titleKey);
            duration.className = 'lesson-duration';
            duration.textContent = lesson.duration || text('tutorials_duration_pending');

            button.append(number, title, duration);
            button.addEventListener('click', () => selectLesson(index, true));
            container.append(button);
        });
    };

    const renderLessons = () => {
        [elements.list, elements.fullscreenList].forEach(renderLessonList);
    };

    const updateCurrentLessonText = () => {
        const lesson = lessons[activeLessonIndex];

        if (!lesson) {
            elements.nowPlayingIndex.textContent = text('tutorials_no_lesson_index');
            elements.nowPlayingTitle.textContent = text('tutorials_no_lesson_title');
            elements.nowPlayingDescription.textContent = text('tutorials_no_lesson_description');
            return;
        }

        elements.nowPlayingIndex.textContent = String(activeLessonIndex + 1).padStart(2, '0');
        elements.nowPlayingTitle.textContent = text(lesson.titleKey);
        elements.nowPlayingDescription.textContent = text(lesson.descriptionKey);
    };

    const selectLesson = (index, autoplay) => {
        const lesson = lessons[index];

        if (!lesson) {
            return;
        }

        activeLessonIndex = index;
        video.src = videoUrl(lesson.file);
        video.poster = lesson.poster ? videoUrl(lesson.poster) : '';
        video.load();
        elements.empty.hidden = true;
        elements.overlay.hidden = false;
        setControlsEnabled(true);
        updateCurrentLessonText();
        renderLessons();
        updateTime();
        updatePlaybackState();

        if (autoplay) {
            video.play().catch(() => updatePlaybackState());
        }
    };

    const togglePlayback = () => {
        if (activeLessonIndex < 0) {
            return;
        }

        if (video.paused || video.ended) {
            video.play().catch(() => updatePlaybackState());
        } else {
            video.pause();
        }
    };

    elements.play.addEventListener('click', togglePlayback);
    elements.overlay.addEventListener('click', togglePlayback);
    video.addEventListener('click', togglePlayback);
    video.addEventListener('play', updatePlaybackState);
    video.addEventListener('pause', updatePlaybackState);
    video.addEventListener('ended', updatePlaybackState);
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', () => {
        const lesson = lessons[activeLessonIndex];

        if (lesson) {
            lesson.duration = formatTime(video.duration);
            renderLessons();
        }

        updateTime();
    });
    video.addEventListener('error', () => {
        setEmptyState('tutorials_video_error_title', 'tutorials_video_error_text');
    });

    elements.progress.addEventListener('input', () => {
        if (Number.isFinite(video.duration) && video.duration > 0) {
            video.currentTime = (Number(elements.progress.value) / 1000) * video.duration;
        }
    });

    elements.volume.addEventListener('mouseenter', openVolumeFlyout);
    elements.volume.addEventListener('focus', openVolumeFlyout);
    elements.volumeRange.addEventListener('mouseenter', () => {
        volumeFlyoutEntered = true;
    });
    elements.volumeFlyout.addEventListener('mouseleave', () => {
        if (volumeFlyoutEntered) {
            closeVolumeFlyout();
        }
    });
    elements.volumeRange.addEventListener('blur', closeVolumeFlyout);

    elements.volume.addEventListener('click', () => {
        if (video.muted || video.volume === 0) {
            video.muted = false;

            if (video.volume === 0) {
                video.volume = lastAudibleVolume;
            }
        } else {
            lastAudibleVolume = video.volume;
            video.muted = true;
        }

        updateVolumeState();
        saveVolume();
    });

    elements.volumeRange.addEventListener('input', () => {
        video.muted = false;
        video.volume = Number(elements.volumeRange.value);

        if (video.volume > 0) {
            lastAudibleVolume = video.volume;
        }

        updateVolumeState();
        saveVolume();
    });

    elements.fullscreen.addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen?.();
        } else {
            elements.shell.requestFullscreen?.();
        }
    });

    elements.shell.addEventListener('mousemove', (event) => {
        if (!isPlayerFullscreen()) {
            return;
        }

        const bounds = elements.shell.getBoundingClientRect();
        const distanceFromRight = bounds.right - event.clientX;

        showFullscreenControls();

        if (distanceFromRight <= Math.max(120, bounds.width * 0.1)) {
            showFullscreenPlaylist();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (isPlayerFullscreen()) {
            showFullscreenControls();
        } else {
            resetFullscreenUi();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeVolumeFlyout();
        }
    });

    document.addEventListener('wsguild:languagechange', (event) => {
        translations = event.detail.translations;
        renderLessons();
        updateCurrentLessonText();
        updatePlaybackState();
        updateVolumeState();

        if (!elements.empty.hidden && activeLessonIndex < 0) {
            setEmptyState('tutorials_empty_title', 'tutorials_empty_text');
        }
    });

    const initialize = async () => {
        restoreVolume();

        try {
            const response = await fetch('/videos/catalog.json', { cache: 'no-store' });

            if (!response.ok) {
                throw new Error(`Catalog request failed: ${response.status}`);
            }

            const catalog = await response.json();
            lessons = Array.isArray(catalog)
                ? catalog.filter((lesson) => lesson.file && lesson.titleKey)
                : [];

            renderLessons();

            if (lessons.length > 0) {
                selectLesson(0, false);
            } else {
                setEmptyState('tutorials_empty_title', 'tutorials_empty_text');
            }
        } catch (error) {
            console.error('Unable to load the tutorials catalog.', error);
            setEmptyState('tutorials_catalog_error_title', 'tutorials_catalog_error_text');
        }

        updateVolumeState();
    };

    initialize();
})();
