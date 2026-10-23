import { createPlayer } from './player.js';
import { demoScript } from './player-data.js';

/**
 * Format seconds into mm:ss display string.
 */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Vector avatars for each character.
 */
export const CHARACTER_AVATARS = {
  mara: `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="avatar-svg" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="url(#mara-bg)" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="24" cy="18" r="8" fill="#fef3c7"/>
      <path d="M11 38c0-7.18 5.82-13 13-13s13 5.82 13 13" fill="#fef3c7"/>
      <rect x="33" y="14" width="4" height="7" rx="2" fill="#f59e0b"/>
      <path d="M35 21v4l-4 3" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
      <defs>
        <linearGradient id="mara-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stop-color="#b45309"/>
          <stop offset="1" stop-color="#451a03"/>
        </linearGradient>
      </defs>
    </svg>`,
  leo: `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="avatar-svg" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="url(#leo-bg)" stroke="#10b981" stroke-width="2"/>
      <circle cx="24" cy="18" r="8" fill="#d1fae5"/>
      <path d="M11 38c0-7.18 5.82-13 13-13s13 5.82 13 13" fill="#d1fae5"/>
      <path d="M24 6l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#34d399"/>
      <defs>
        <linearGradient id="leo-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stop-color="#065f46"/>
          <stop offset="1" stop-color="#022c22"/>
        </linearGradient>
      </defs>
    </svg>`,
  bea: `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="avatar-svg" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="url(#bea-bg)" stroke="#818cf8" stroke-width="2"/>
      <circle cx="24" cy="18" r="8" fill="#e0e7ff"/>
      <path d="M11 38c0-7.18 5.82-13 13-13s13 5.82 13 13" fill="#e0e7ff"/>
      <rect x="29" y="13" width="8" height="11" rx="2" fill="#818cf8"/>
      <line x1="31" y1="17" x2="35" y2="17" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="31" y1="20" x2="35" y2="20" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
      <defs>
        <linearGradient id="bea-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stop-color="#3730a3"/>
          <stop offset="1" stop-color="#1e1b4b"/>
        </linearGradient>
      </defs>
    </svg>`,
};

/**
 * Fallback avatar SVG for unknown characters.
 */
function getAvatarSvg(speakerId) {
  return (
    CHARACTER_AVATARS[speakerId] ||
    `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="avatar-svg" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="#334155" stroke="#64748b" stroke-width="2"/>
      <circle cx="24" cy="18" r="8" fill="#94a3b8"/>
      <path d="M11 38c0-7.18 5.82-13 13-13s13 5.82 13 13" fill="#94a3b8"/>
    </svg>`
  );
}

/**
 * Initialize the Three Amigos player UI.
 */
export function initPlayerUI(container, options = {}) {
  const script = options.script || demoScript;
  const charactersById = new Map(script.characters.map((c) => [c.id, c]));
  const totalLines = script.lines.length;

  let currentState = 'idle';
  let currentIndex = -1;

  // Build the complete UI template
  container.innerHTML = `
    <div class="player-container">
      <!-- Live announcer for screen reader users -->
      <div id="sr-announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>

      <!-- Header -->
      <header class="app-header">
        <div class="brand-badge-row">
          <span class="brand-badge">
            <span class="brand-badge-dot" aria-hidden="true"></span>
            workfriend.ai
          </span>
          <span class="meeting-type-tag">Sprint Retrospective</span>
        </div>
        <h1 class="app-title">${script.title}</h1>
        <p class="app-subtitle">Three Amigos pre-recorded meeting playback demo</p>
      </header>

      <!-- Characters Section -->
      <section class="characters-section" aria-label="Meeting Participants">
        <span class="section-label">Participants</span>
        <div class="characters-grid" id="characters-grid">
          ${script.characters
            .map(
              (char) => `
            <div class="character-card" data-speaker-id="${char.id}" id="char-${char.id}">
              <div class="avatar-wrapper">
                ${getAvatarSvg(char.id)}
                <span class="speaking-indicator" aria-hidden="true"></span>
              </div>
              <div class="character-name">${char.name}</div>
              <div class="character-role-tag" title="${char.voice}">${char.voice.split(',')[0]}</div>
              <div class="character-status" id="char-status-${char.id}">Ready</div>
            </div>`
            )
            .join('')}
        </div>
      </section>

      <!-- Controls Panel (sticky on mobile) -->
      <section class="controls-panel" aria-label="Playback controls">
        <div class="controls-status-row">
          <div class="state-badge state-idle" id="playback-state-badge" aria-live="polite">
            <span class="state-badge-dot" aria-hidden="true"></span>
            <span id="playback-state-text">Ready</span>
          </div>
          <div class="line-counter" id="line-counter">Line -- of ${totalLines}</div>
        </div>

        <!-- Read-only Progress -->
        <div class="progress-container">
          <div
            class="progress-track"
            role="progressbar"
            id="progress-bar"
            aria-valuenow="0"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Audio playback progress"
          >
            <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
          </div>
          <div class="progress-labels">
            <span>Progress</span>
            <span id="time-display">0:00 / 0:00</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="buttons-row">
          <button
            type="button"
            class="btn btn-primary"
            id="btn-play"
            aria-label="Play meeting audio"
          >
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/>
            </svg>
            <span id="btn-play-label">Play</span>
          </button>

          <button
            type="button"
            class="btn btn-secondary"
            id="btn-pause"
            aria-label="Pause playback"
            disabled
          >
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>
              <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>
            </svg>
            <span>Pause</span>
          </button>

          <button
            type="button"
            class="btn btn-secondary"
            id="btn-restart"
            aria-label="Restart playback from beginning"
          >
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            <span id="btn-restart-label">Restart</span>
          </button>
        </div>

        <!-- Error Banner -->
        <div class="error-banner hidden" id="error-banner" role="alert" aria-live="assertive">
          <svg class="error-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <div class="error-content">
            <span class="error-title">Playback Error</span>
            <p class="error-message" id="error-message"></p>
            <span class="error-hint">Placeholder audio recordings are pending. Add audio files to /audio/ to enable speech.</span>
          </div>
          <button type="button" class="error-dismiss-btn" id="btn-dismiss-error" aria-label="Dismiss error notification">
            Dismiss
          </button>
        </div>
      </section>

      <!-- Transcript Section -->
      <section class="transcript-section" aria-label="Meeting Transcript">
        <div class="transcript-header-row">
          <span class="section-label">Transcript</span>
          <span class="line-counter">${totalLines} Lines</span>
        </div>
        <div class="transcript-list" id="transcript-list" tabindex="0" aria-label="Scrollable dialogue list">
          ${script.lines
            .map((line, idx) => {
              const char = charactersById.get(line.speakerId) || { name: line.speakerId, voice: '' };
              return `
              <article
                class="transcript-line"
                id="line-item-${idx}"
                data-line-id="${line.id}"
                data-speaker-id="${line.speakerId}"
                data-line-index="${idx}"
              >
                <div class="transcript-avatar">
                  ${getAvatarSvg(line.speakerId)}
                </div>
                <div class="transcript-content">
                  <div class="transcript-speaker-row">
                    <div class="transcript-speaker-info">
                      <span class="transcript-speaker-name">${char.name}</span>
                      <span class="transcript-role-pill">${char.voice.split(',')[0]}</span>
                    </div>
                    <span class="active-line-pill" aria-hidden="true">Speaking</span>
                    <span class="transcript-line-num">#${idx + 1}</span>
                  </div>
                  <p class="transcript-text">${line.text}</p>
                </div>
              </article>`;
            })
            .join('')}
        </div>
      </section>

      <!-- Footer -->
      <footer class="app-footer">
        <p>workfriend.ai &bull; Three Amigos Integration</p>
      </footer>
    </div>
  `;

  // Element references
  const playBtn = container.querySelector('#btn-play');
  const playBtnLabel = container.querySelector('#btn-play-label');
  const pauseBtn = container.querySelector('#btn-pause');
  const restartBtn = container.querySelector('#btn-restart');
  const progressBar = container.querySelector('#progress-bar');
  const progressFill = container.querySelector('#progress-fill');
  const timeDisplay = container.querySelector('#time-display');
  const stateBadge = container.querySelector('#playback-state-badge');
  const stateText = container.querySelector('#playback-state-text');
  const lineCounter = container.querySelector('#line-counter');
  const errorBanner = container.querySelector('#error-banner');
  const errorMessage = container.querySelector('#error-message');
  const dismissErrorBtn = container.querySelector('#btn-dismiss-error');
  const announcer = container.querySelector('#sr-announcer');
  const transcriptList = container.querySelector('#transcript-list');
  const characterCards = container.querySelectorAll('.character-card');
  const transcriptLines = container.querySelectorAll('.transcript-line');

  // Helper to announce for screen readers
  function announce(msg) {
    if (announcer) announcer.textContent = msg;
  }

  // Hide error banner
  function clearError() {
    if (errorBanner) errorBanner.classList.add('hidden');
  }

  // Show error banner
  function showError(error, line) {
    if (!errorBanner) return;
    const detail = error?.message || 'An unknown audio playback error occurred.';
    const lineInfo = line ? ` (line ${line.id})` : '';
    errorMessage.textContent = `${detail}${lineInfo}`;
    errorBanner.classList.remove('hidden');
    announce(`Playback error: ${detail}`);
  }

  // Update State UI
  function updateState(nextState) {
    currentState = nextState;

    if (stateBadge && stateText) {
      stateBadge.className = `state-badge state-${nextState}`;
      const labels = {
        idle: 'Ready',
        playing: 'Playing',
        paused: 'Paused',
        ended: 'Finished',
        error: 'Error',
      };
      stateText.textContent = labels[nextState] || nextState;
    }

    if (nextState === 'playing') {
      playBtn.disabled = true;
      pauseBtn.disabled = false;
      restartBtn.disabled = false;
      playBtnLabel.textContent = 'Play';
      playBtn.setAttribute('aria-label', 'Meeting audio is playing');
      clearError();
    } else if (nextState === 'paused') {
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      restartBtn.disabled = false;
      playBtnLabel.textContent = 'Resume';
      playBtn.setAttribute('aria-label', 'Resume playback');
    } else if (nextState === 'ended') {
      // Completed state: allow replay using Play or clearly use Restart
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      restartBtn.disabled = false;
      playBtnLabel.textContent = 'Replay';
      playBtn.setAttribute('aria-label', 'Replay meeting audio from beginning');
      restartBtn.setAttribute('aria-label', 'Restart meeting from beginning');

      if (lineCounter) {
        lineCounter.textContent = `Completed (${totalLines} lines)`;
      }
      if (progressFill) progressFill.style.width = '100%';
      if (progressBar) progressBar.setAttribute('aria-valuenow', '100');

      // Mark all transcript lines as played
      transcriptLines.forEach((item) => {
        item.classList.remove('is-active');
        item.classList.add('is-played');
      });

      announce('Playback completed. Click Replay or Restart to listen again.');
    } else if (nextState === 'error') {
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      restartBtn.disabled = false;
      playBtnLabel.textContent = 'Retry';
      playBtn.setAttribute('aria-label', 'Retry audio playback');
    } else {
      // idle
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      restartBtn.disabled = false;
      playBtnLabel.textContent = 'Play';
      playBtn.setAttribute('aria-label', 'Play meeting audio');
    }
  }

  // Update Active Line & Speaker
  function updateActiveLine(line, index) {
    currentIndex = index;

    // Update line counter
    if (lineCounter) {
      if (index >= 0 && index < totalLines) {
        lineCounter.textContent = `Line ${index + 1} of ${totalLines}`;
      } else if (currentState === 'ended') {
        lineCounter.textContent = `Completed (${totalLines} lines)`;
      } else {
        lineCounter.textContent = `Line -- of ${totalLines}`;
      }
    }

    // Reset character cards state
    characterCards.forEach((card) => {
      const speakerId = card.getAttribute('data-speaker-id');
      const statusEl = card.querySelector('.character-status');
      if (line && line.speakerId === speakerId) {
        card.classList.add('is-speaking');
        card.classList.remove('is-inactive');
        if (statusEl) statusEl.textContent = 'Speaking';
      } else {
        card.classList.remove('is-speaking');
        if (line) {
          card.classList.add('is-inactive');
          if (statusEl) statusEl.textContent = 'Listening';
        } else {
          card.classList.remove('is-inactive');
          if (statusEl) statusEl.textContent = 'Ready';
        }
      }
    });

    // Update transcript lines
    let activeLineEl = null;
    transcriptLines.forEach((item, i) => {
      if (index >= 0 && i === index) {
        item.classList.add('is-active');
        item.classList.remove('is-played');
        activeLineEl = item;
      } else if (index >= 0 && i < index) {
        item.classList.remove('is-active');
        item.classList.add('is-played');
      } else if (currentState === 'ended') {
        item.classList.remove('is-active');
        item.classList.add('is-played');
      } else {
        item.classList.remove('is-active');
        item.classList.remove('is-played');
      }
    });

    // Auto-scroll transcript to active line
    if (activeLineEl) {
      try {
        const prefersReducedMotion =
          typeof window !== 'undefined' &&
          window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        activeLineEl.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      } catch {
        // Fallback for environments lacking scrollIntoView options
        activeLineEl.scrollIntoView?.();
      }

      // Announce current speaker for accessibility
      const speakerChar = charactersById.get(line.speakerId);
      const speakerName = speakerChar ? speakerChar.name : line.speakerId;
      announce(`${speakerName} is speaking: "${line.text}"`);
    }
  }

  // Update Progress UI (Read-Only)
  function updateProgress({ currentTime, duration, fraction }) {
    if (currentState === 'ended') return;

    const clampedFraction = Math.min(1, Math.max(0, fraction || 0));
    const percent = Math.round(clampedFraction * 100);

    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }
    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', percent.toString());
    }
    if (timeDisplay) {
      timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }
  }

  // Create player using createPlayer from actual player.js module
  const callbacks = {
    onStateChange(state) {
      updateState(state);
    },
    onLineChange(line, index) {
      updateActiveLine(line, index);
    },
    onProgress(progress) {
      updateProgress(progress);
    },
    onError(error, line) {
      showError(error, line);
    },
  };

  const player =
    options.player ||
    createPlayer(script, callbacks, options.audioFactory);

  // Button Event Listeners
  playBtn.addEventListener('click', () => {
    clearError();
    player.play();
  });

  pauseBtn.addEventListener('click', () => {
    player.pause();
  });

  restartBtn.addEventListener('click', () => {
    clearError();
    player.restart();
  });

  if (dismissErrorBtn) {
    dismissErrorBtn.addEventListener('click', () => {
      clearError();
    });
  }

  return {
    player,
    elements: {
      playBtn,
      playBtnLabel,
      pauseBtn,
      restartBtn,
      progressBar,
      progressFill,
      timeDisplay,
      stateBadge,
      stateText,
      lineCounter,
      errorBanner,
      errorMessage,
      transcriptList,
    },
    getState: () => currentState,
    getCurrentIndex: () => currentIndex,
    dispose() {
      player.dispose();
      container.innerHTML = '';
    },
  };
}

// Auto-mount if running in browser with #app element
if (typeof document !== 'undefined') {
  const mountApp = () => {
    const appEl = document.getElementById('app');
    if (appEl && !appEl.dataset.initialized) {
      appEl.dataset.initialized = 'true';
      initPlayerUI(appEl);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountApp);
  } else {
    mountApp();
  }
}
