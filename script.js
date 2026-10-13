// ========================================================
// MOTIONX
// 100% Pure Vanilla JavaScript Real-Time Camera Hand-Controlled Game
// Zero Frameworks • Pure HTML5 + CSS3 + JS
// ========================================================

(function () {
  'use strict';

  // =========================================================================
  // 1. STORAGE & ATTEMPT SYSTEM (STRICTLY NO HEALTH / LIVES)
  // =========================================================================
  const STORAGE_KEY = 'motionx_vanilla_save_v1';

  const defaultSettings = {
    controlMode: 'camera', // 'camera' | 'touch'
    cameraPreview: true,
    mirrorCamera: true,
    attackZoneEnabled: true,
    fistAttackEnabled: true,
    deadZone: 'medium',    // 'low' (0.35-0.65), 'medium' (0.40-0.60), 'high' (0.30-0.70)
    smoothing: 'medium',   // 'low' (0.55), 'medium' (0.35), 'high' (0.20)
    playerSpeed: 'normal',   // 'slow' (5.75), 'normal' (6.60) [Default +50%], 'fast' (8.25)
    music: true,
    sfx: true
  };

  const STORAGE_KEY_LEADERBOARD = 'motionx_leaderboard_v1';

  const DEFAULT_LEADERBOARD = [
    { name: 'CYBER_NEXUS', score: 25000, levels: 20, coins: 200 },
    { name: 'NEO_RUNNER', score: 19800, levels: 18, coins: 160 },
    { name: 'SYNTH_BLADE', score: 14500, levels: 14, coins: 130 },
    { name: 'PHANTOM_99', score: 10200, levels: 10, coins: 90 },
    { name: 'GLITCH_FOX', score: 6800, levels: 7, coins: 65 },
    { name: 'BYTE_STRIKER', score: 3200, levels: 3, coins: 25 }
  ];

  let gameStateData = {
    playerName: '',
    unlockedLevel: 20,
    lastPlayedLevel: 1,
    completedLevels: [],
    totalCoins: 0,
    levelCoins: {},         // { [levelId]: coinsCollectedCount }
    bestAttempts: {},       // preserved for backward compat
    levelAttempts: {},      // preserved for backward compat
    settings: { ...defaultSettings }
  };

  function loadSavedData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('pulse_strider_vanilla_save_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        gameStateData = {
          playerName: parsed.playerName || 'SHADOW',
          unlockedLevel: 20, // All 20 levels unlocked
          lastPlayedLevel: parsed.lastPlayedLevel || parsed.unlockedLevel || 1,
          completedLevels: Array.isArray(parsed.completedLevels) ? parsed.completedLevels : [],
          totalCoins: parsed.totalCoins || 0,
          levelCoins: parsed.levelCoins || {},
          bestAttempts: parsed.bestAttempts || {},
          levelAttempts: parsed.levelAttempts || {},
          settings: { ...defaultSettings, ...(parsed.settings || {}) }
        };
      } else {
        gameStateData.unlockedLevel = 20;
      }
      persistData();
    } catch (e) {
      console.warn('Could not read save data:', e);
    }
  }

  function persistData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameStateData));
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  }

  // --- LEADERBOARD & PLAYER NAME ENGINE ---
  function getLeaderboardData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LEADERBOARD);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not load leaderboard:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_LEADERBOARD));
  }

  function saveLeaderboardData(list) {
    try {
      localStorage.setItem(STORAGE_KEY_LEADERBOARD, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save leaderboard:', e);
    }
  }

  function calculatePlayerScore() {
    const completedCount = (gameStateData.completedLevels || []).length;
    const coins = gameStateData.totalCoins || 0;
    const levelScore = completedCount * 1000;
    const coinBonus = coins * 100;
    return levelScore + coinBonus;
  }

  function syncCurrentPlayerToLeaderboard() {
    const name = (gameStateData.playerName || '').trim();
    if (!name) return;
    const score = calculatePlayerScore();
    const levels = (gameStateData.completedLevels || []).length;
    const coins = gameStateData.totalCoins || 0;

    const list = getLeaderboardData();
    const idx = list.findIndex(e => (e.name || '').trim().toLowerCase() === name.toLowerCase());
    const entry = {
      name: name,
      score: score,
      levels: levels,
      coins: coins
    };

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...entry };
    } else {
      list.push(entry);
    }

    list.sort((a, b) => (b.score - a.score) || (b.levels - a.levels) || ((b.coins || 0) - (a.coins || 0)));
    saveLeaderboardData(list);
  }

  function checkPlayerNameExisted(name) {
    if (!name || !name.trim()) return false;
    const clean = name.trim().toLowerCase();
    const list = getLeaderboardData();
    return list.some(entry => (entry.name || '').trim().toLowerCase() === clean);
  }

  let pendingPlayerNameCallback = null;

  function openPlayerNameModal(callback = null) {
    pendingPlayerNameCallback = callback;
    const modal = document.getElementById('modal-player-name');
    const input = document.getElementById('input-player-name');
    const errBox = document.getElementById('player-name-error');
    if (modal && input) {
      input.value = gameStateData.playerName || '';
      if (errBox) errBox.classList.add('hidden');
      input.classList.remove('has-error');
      modal.classList.remove('hidden');
      setTimeout(() => input.focus(), 60);
    }
  }

  function closePlayerNameModal() {
    const modal = document.getElementById('modal-player-name');
    if (modal) modal.classList.add('hidden');
    pendingPlayerNameCallback = null;
  }

  function handlePlayerNameSubmit() {
    const input = document.getElementById('input-player-name');
    const errBox = document.getElementById('player-name-error');
    if (!input) return;
    const val = input.value.trim();

    if (!val) {
      if (errBox) {
        errBox.textContent = 'Please enter a player name';
        errBox.classList.remove('hidden');
      }
      input.classList.add('has-error');
      input.focus();
      return;
    }

    // Name uniqueness validation: if name already entered, show "name is existed"
    if (checkPlayerNameExisted(val)) {
      if (errBox) {
        errBox.textContent = 'name is existed';
        errBox.classList.remove('hidden');
      }
      input.classList.add('has-error');
      input.focus();
      return;
    }

    // Valid unique name
    gameStateData.playerName = val;
    persistData();
    syncCurrentPlayerToLeaderboard();
    updatePlayerNameUI();
    closePlayerNameModal();

    if (typeof pendingPlayerNameCallback === 'function') {
      const cb = pendingPlayerNameCallback;
      pendingPlayerNameCallback = null;
      cb();
    }
  }

  function updatePlayerNameUI() {
    const name = gameStateData.playerName ? gameStateData.playerName.toUpperCase() : 'SHADOW';
    const pilotDisplay = document.getElementById('menu-current-pilot-name');
    if (pilotDisplay) pilotDisplay.textContent = name;
    const lbTag = document.getElementById('lb-current-player-tag');
    if (lbTag) lbTag.textContent = `CALLSIGN: ${name}`;
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderLeaderboard() {
    syncCurrentPlayerToLeaderboard();
    const list = getLeaderboardData();
    list.sort((a, b) => (b.score - a.score) || (b.levels - a.levels) || ((b.coins || 0) - (a.coins || 0)));

    const currentName = (gameStateData.playerName || '').trim().toLowerCase();
    let currentRank = '-';
    let currentScore = calculatePlayerScore();
    let currentLevels = (gameStateData.completedLevels || []).length;

    const container = document.getElementById('leaderboard-list-container');
    if (!container) return;

    container.innerHTML = '';

    list.forEach((entry, idx) => {
      const rankNum = idx + 1;
      const isYou = currentName && (entry.name || '').trim().toLowerCase() === currentName;
      if (isYou) {
        currentRank = `#${rankNum}`;
        currentScore = entry.score;
        currentLevels = entry.levels;
      }

      const row = document.createElement('div');
      row.className = `leaderboard-row${isYou ? ' current-player-row' : ''}`;

      let rankClass = '';
      let rankText = `#${String(rankNum).padStart(2, '0')}`;
      if (rankNum === 1) {
        rankClass = 'rank-1';
        rankText = '🥇 01';
      } else if (rankNum === 2) {
        rankClass = 'rank-2';
        rankText = '🥈 02';
      } else if (rankNum === 3) {
        rankClass = 'rank-3';
        rankText = '🥉 03';
      }

      row.innerHTML = `
        <span class="col-rank ${rankClass}">${rankText}</span>
        <div class="col-player">
          <span>${escapeHTML(entry.name)}</span>
          ${isYou ? '<span class="badge-you">YOU</span>' : ''}
        </div>
        <span class="col-levels">${entry.levels || 0} / 20</span>
        <span class="col-score">${(entry.score || 0).toLocaleString()} PTS</span>
      `;

      container.appendChild(row);
    });

    const rankEl = document.getElementById('lb-your-rank');
    const scoreEl = document.getElementById('lb-your-score');
    const clearedEl = document.getElementById('lb-your-cleared');
    const tagEl = document.getElementById('lb-current-player-tag');

    if (rankEl) rankEl.textContent = currentRank;
    if (scoreEl) scoreEl.textContent = currentScore.toLocaleString();
    if (clearedEl) clearedEl.textContent = `${currentLevels} / 20`;
    if (tagEl) tagEl.textContent = `CALLSIGN: ${gameStateData.playerName ? gameStateData.playerName.toUpperCase() : 'GUEST'}`;
  }

  function getLevelAttempt(levelId) {
    if (!gameStateData.levelAttempts[levelId] || gameStateData.levelAttempts[levelId] < 1) {
      gameStateData.levelAttempts[levelId] = 1;
      persistData();
    }
    return gameStateData.levelAttempts[levelId];
  }

  function incrementLevelAttempt(levelId) {
    const cur = getLevelAttempt(levelId);
    gameStateData.levelAttempts[levelId] = cur + 1;
    persistData();
    return gameStateData.levelAttempts[levelId];
  }

  function saveBestAttempt(levelId, attemptsUsed) {
    const prev = gameStateData.bestAttempts[levelId];
    let isNewBest = false;
    if (prev === undefined || attemptsUsed < prev) {
      gameStateData.bestAttempts[levelId] = attemptsUsed;
      isNewBest = true;
    }
    // Unlock next level (all 20 remain unlocked)
    gameStateData.unlockedLevel = 20;
    gameStateData.lastPlayedLevel = Math.min(20, levelId + 1);
    if (!gameStateData.completedLevels.includes(levelId)) {
      gameStateData.completedLevels.push(levelId);
    }
    // Reset attempt count for this level for future replays
    gameStateData.levelAttempts[levelId] = 1;
    persistData();
    syncCurrentPlayerToLeaderboard();
    return { isNewBest, best: gameStateData.bestAttempts[levelId] };
  }

  // =========================================================================
  // 2. PROCEDURAL WEB AUDIO SYNTHESIZER (Zero Audio Assets Needed)
  // =========================================================================
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.bgmTimer = null;
      this.isPlayingBGM = false;
      this.currentBeat = 0;
      this.bpm = 110;
      this.worldIndex = 0;
      this.themes = [
        { bass: [110, 110, 130.81, 146.83], lead: [440, 523.25, 659.25, 587.33] },
        { bass: [98, 98, 116.54, 130.81], lead: [392, 466.16, 523.25, 587.33] },
        { bass: [82.41, 82.41, 98, 110], lead: [329.63, 392, 440, 493.88] },
        { bass: [123.47, 123.47, 146.83, 164.81], lead: [493.88, 587.33, 739.99, 659.25] },
        { bass: [130.81, 146.83, 164.81, 174.61], lead: [523.25, 587.33, 659.25, 783.99] }
      ];
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    startBGM(bpm = 110, worldIdx = 0, onBeat = null) {
      this.ensureContext();
      this.bpm = bpm;
      this.worldIndex = Math.min(Math.max(0, worldIdx), this.themes.length - 1);
      this.isPlayingBGM = true;
      this.currentBeat = 0;
      if (this.bgmTimer) clearInterval(this.bgmTimer);

      const intervalMs = (60 / this.bpm) * 1000;
      this.tickBeat(onBeat);
      this.bgmTimer = setInterval(() => {
        if (this.isPlayingBGM) this.tickBeat(onBeat);
      }, intervalMs);
    }

    stopBGM() {
      this.isPlayingBGM = false;
      if (this.bgmTimer) {
        clearInterval(this.bgmTimer);
        this.bgmTimer = null;
      }
    }

    tickBeat(onBeat) {
      if (!this.ctx) return;
      const beatIdx = this.currentBeat % 4;
      const now = this.ctx.currentTime;
      if (onBeat) onBeat(beatIdx, this.currentBeat);

      if (gameStateData.settings.music) {
        if (beatIdx === 0 || beatIdx === 2) this.synthKick(now, beatIdx === 0 ? 0.7 : 0.5);
        if (beatIdx === 1 || beatIdx === 3) this.synthSnare(now, 0.5);
        this.synthHiHat(now, 0.25);

        const theme = this.themes[this.worldIndex] || this.themes[0];
        const bassFreq = theme.bass[beatIdx % theme.bass.length];
        const leadFreq = theme.lead[this.currentBeat % theme.lead.length];
        this.synthBass(now, bassFreq);
        this.synthLead(now, leadFreq);
      }
      this.currentBeat++;
    }

    synthKick(t, vol = 0.7) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(36, t + 0.12);
      gain.gain.setValueAtTime(vol * 0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    }

    synthSnare(t, vol = 0.5) {
      const bufferSize = this.ctx.sampleRate * 0.12;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.03));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(800, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(t);
      noise.stop(t + 0.13);
    }

    synthHiHat(t, vol = 0.25) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(6000, t);
      gain.gain.setValueAtTime(vol * 0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    }

    synthBass(t, freq) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    }

    synthLead(t, freq) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.16);
    }

    playJump() {
      if (!gameStateData.settings.sfx) return;
      this.ensureContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(680, t + 0.15);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    }

    playAttack(type = 'standard') {
      if (!gameStateData.settings.sfx) return;
      this.ensureContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      if (type === 'heavy') {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.28);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        gain.gain.setValueAtTime(0.55, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.30);
      } else if (type === 'cyclone') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(260, t + 0.25);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.26);
      } else {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(type === 'swift' ? 1200 : 900, t);
        osc.frequency.exponentialRampToValueAtTime(160, t + 0.16);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100, t);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      }
    }

    playEnemyDefeat() {
      if (!gameStateData.settings.sfx) return;
      this.ensureContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      noise.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(t);
      noise.stop(t + 0.21);
    }

    playPlayerDefeat() {
      if (!gameStateData.settings.sfx) return;
      this.ensureContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.linearRampToValueAtTime(45, t + 0.3);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    }

    playVictory() {
      if (!gameStateData.settings.sfx) return;
      this.ensureContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.09);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.setValueAtTime(0.3, t + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.09 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + idx * 0.09);
        osc.stop(t + idx * 0.09 + 0.32);
      });
    }

    playClick() {
      if (!gameStateData.settings.sfx) return;
      this.ensureContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.03);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.04);
    }

    playCoinPickup() {
      if (!gameStateData.settings.sfx) return;
      this.ensureContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      // High-pitched 2-tone melodic chime (B5 to E6)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(987.77, t); // B5
      osc1.frequency.setValueAtTime(1318.51, t + 0.08); // E6
      osc2.frequency.setValueAtTime(1975.53, t + 0.08); // B6 shimmer

      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);
      osc1.start(t);
      osc2.start(t + 0.08);
      osc1.stop(t + 0.29);
      osc2.stop(t + 0.29);
    }

    playCheckpoint() {
      if (!gameStateData.settings.sfx) return;
      this.ensureContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const freqs = [698.46, 880.00, 1046.50, 1318.51];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === freqs.length - 1 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.07);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.setValueAtTime(0.28, t + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.38);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + idx * 0.07);
        osc.stop(t + idx * 0.07 + 0.40);
      });
    }

    playPlayerHurt() {
      if (!gameStateData.settings.sfx) return;
      this.ensureContext();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(75, t + 0.18);
      gain.gain.setValueAtTime(0.38, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    }
  }

  const sound = new SoundEngine();

  // =========================================================================
  // 3. 20 HANDCRAFTED PLAYABLE LEVELS ACROSS 5 THEMES
  // =========================================================================
  const LEVELS = [
    // World 1: Digital Night City (Cyan / Magenta)
    {
      id: 1, name: "Neon Awakening", world: 1, bpm: 105, spawn: { x: 50, y: 390 }, width: 2100, height: 540,
      platforms: [
        // Section 1: Intro Runway
        { x: 0, y: 440, width: 380, height: 100 },
        // Section 2: Stepped Platforms
        { x: 450, y: 440, width: 220, height: 100 },
        { x: 530, y: 370, width: 150, height: 24 },
        { x: 740, y: 330, width: 160, height: 24 },
        // Section 3: Attack Alley (Breakable Target Blocks)
        { x: 970, y: 440, width: 360, height: 100 },
        // Section 4: Glitch Beetle Patrol Zone
        { x: 1390, y: 440, width: 340, height: 100 },
        // Section 5: Elevated Neon Walkway
        { x: 1790, y: 380, width: 140, height: 24 },
        // Section 6: Victory Runway & Goal
        { x: 1980, y: 440, width: 260, height: 100 }
      ],
      hazards: [],
      enemies: [
        { x: 1540, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 0.8, maxTravel: 70, health: 1 }
      ],
      targetBlocks: [
        { x: 1080, y: 418, width: 26, height: 26 },
        { x: 1220, y: 418, width: 26, height: 26 }
      ],
      goal: { x: 2060, y: 440, width: 20, height: 36 }
    },
    {
      id: 2, name: "Rooftop Leap", world: 1, bpm: 108, spawn: { x: 50, y: 390 }, width: 2350, height: 540,
      platforms: [
        // Section 1: Rooftop Launchpad
        { x: 0, y: 440, width: 340, height: 100 },
        // Section 2: Ascending Skylines
        { x: 400, y: 410, width: 180, height: 130 },
        { x: 640, y: 350, width: 180, height: 190 },
        { x: 880, y: 290, width: 200, height: 250 },
        // Section 3: High Target Block
        { x: 1140, y: 350, width: 160, height: 190 },
        // Section 4: Catwalk & Glitch Scout
        { x: 1360, y: 440, width: 380, height: 100 },
        // Section 5: Aerial Stepping Stones
        { x: 1800, y: 380, width: 130, height: 24 },
        { x: 1990, y: 340, width: 140, height: 24 },
        // Section 6: Landing Pad & Goal
        { x: 2180, y: 440, width: 260, height: 100 }
      ],
      hazards: [],
      enemies: [
        { x: 1520, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 0.9, maxTravel: 70, health: 1 }
      ],
      targetBlocks: [
        { x: 980, y: 268, width: 26, height: 26 },
        { x: 1460, y: 418, width: 26, height: 26 }
      ],
      goal: { x: 2280, y: 440, width: 20, height: 36 }
    },
    {
      id: 3, name: "Grid Abyss", world: 1, bpm: 110, spawn: { x: 50, y: 390 }, width: 2550, height: 540,
      platforms: [
        // Section 1: Grid Runway
        { x: 0, y: 440, width: 320, height: 100 },
        // Section 2: Dual Route Lower & Upper
        { x: 380, y: 440, width: 320, height: 100 },
        { x: 450, y: 340, width: 240, height: 24 },
        // Section 3: Chasm Leaps
        { x: 760, y: 420, width: 170, height: 120 },
        { x: 990, y: 370, width: 160, height: 170 },
        { x: 1210, y: 440, width: 380, height: 100 },
        // Section 4: Beetle Patrol
        { x: 1650, y: 380, width: 160, height: 24 },
        { x: 1870, y: 330, width: 180, height: 24 },
        { x: 2110, y: 390, width: 160, height: 24 },
        // Section 5: Grid Exit & Goal
        { x: 2330, y: 440, width: 270, height: 100 }
      ],
      hazards: [],
      enemies: [
        { x: 1330, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 0.9, maxTravel: 60, health: 1 },
        { x: 1460, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 0.9, maxTravel: 60, health: 1 }
      ],
      targetBlocks: [
        { x: 570, y: 318, width: 26, height: 26 },
        { x: 840, y: 398, width: 26, height: 26 }
      ],
      goal: { x: 2470, y: 440, width: 20, height: 36 }
    },
    {
      id: 4, name: "First Contact", world: 1, bpm: 110, spawn: { x: 50, y: 390 }, width: 2750, height: 540,
      platforms: [
        // Section 1: Outskirts Runway
        { x: 0, y: 440, width: 340, height: 100 },
        // Section 2: Patrol Alley
        { x: 400, y: 440, width: 360, height: 100 },
        // Section 3: Elevated Overpass & Drone Flight
        { x: 820, y: 390, width: 160, height: 24 },
        { x: 1040, y: 330, width: 220, height: 24 },
        { x: 1320, y: 380, width: 170, height: 24 },
        // Section 4: Lower Tunnels & Beetles
        { x: 1550, y: 440, width: 380, height: 100 },
        // Section 5: Floating Pillars
        { x: 1990, y: 380, width: 140, height: 24 },
        { x: 2190, y: 340, width: 140, height: 24 },
        { x: 2390, y: 390, width: 140, height: 24 },
        // Section 6: Outskirts Gate & Goal
        { x: 2580, y: 440, width: 250, height: 100 }
      ],
      hazards: [],
      enemies: [
        { x: 530, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 0.9, maxTravel: 60, health: 1 },
        { x: 1140, y: 260, width: 22, height: 22, type: 'patrol_drone', vx: 1.0, maxTravel: 70, health: 1 },
        { x: 1710, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 1.0, maxTravel: 60, health: 1 }
      ],
      targetBlocks: [
        { x: 620, y: 418, width: 26, height: 26 },
        { x: 1110, y: 308, width: 26, height: 26 }
      ],
      goal: { x: 2680, y: 440, width: 20, height: 36 }
    },

    // World 2: Dark Forest (Green / Bio-Luminescent)
    {
      id: 5, name: "Spore Caverns", world: 2, bpm: 112, spawn: { x: 50, y: 390 }, width: 2950, height: 540,
      platforms: [
        { x: 0, y: 440, width: 320, height: 100 },
        { x: 380, y: 410, width: 180, height: 130 },
        { x: 620, y: 360, width: 180, height: 180 },
        { x: 860, y: 440, width: 360, height: 100 },
        { x: 1280, y: 380, width: 150, height: 24 },
        { x: 1490, y: 330, width: 160, height: 24 },
        { x: 1710, y: 380, width: 150, height: 24 },
        { x: 1920, y: 440, width: 380, height: 100 },
        { x: 2360, y: 370, width: 160, height: 24 },
        { x: 2580, y: 330, width: 160, height: 24 },
        { x: 2790, y: 440, width: 250, height: 100 }
      ],
      hazards: [
        { x: 980, y: 432, width: 50, height: 8, type: 'spikes' },
        { x: 2060, y: 432, width: 50, height: 8, type: 'spikes' }
      ],
      enemies: [
        { x: 700, y: 280, width: 22, height: 22, type: 'patrol_drone', vx: 1.1, maxTravel: 60, health: 1 },
        { x: 1570, y: 250, width: 22, height: 22, type: 'patrol_drone', vx: 1.1, maxTravel: 60, health: 1 }
      ],
      targetBlocks: [
        { x: 500, y: 388, width: 26, height: 26 },
        { x: 1350, y: 358, width: 26, height: 26 }
      ],
      goal: { x: 2880, y: 440, width: 20, height: 36 }
    },
    {
      id: 6, name: "Overgrowth Run", world: 2, bpm: 114, spawn: { x: 50, y: 390 }, width: 3150, height: 540,
      platforms: [
        { x: 0, y: 440, width: 320, height: 100 },
        { x: 380, y: 440, width: 340, height: 100 },
        { x: 780, y: 380, width: 160, height: 24 },
        { x: 1000, y: 330, width: 180, height: 24 },
        { x: 1240, y: 350, width: 120, height: 20, isMoving: true, vx: 1.2, vy: 0, travelDistance: 130, travelProgress: 0 },
        { x: 1530, y: 380, width: 200, height: 24 },
        { x: 1790, y: 440, width: 380, height: 100 },
        { x: 2230, y: 380, width: 150, height: 24 },
        { x: 2440, y: 340, width: 150, height: 24 },
        { x: 2650, y: 390, width: 160, height: 24 },
        { x: 2870, y: 440, width: 320, height: 100 }
      ],
      hazards: [],
      enemies: [
        { x: 510, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 0.9, maxTravel: 60, health: 1 },
        { x: 1940, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 1.0, maxTravel: 70, health: 1 }
      ],
      targetBlocks: [
        { x: 860, y: 358, width: 26, height: 26 },
        { x: 1870, y: 418, width: 26, height: 26 }
      ],
      goal: { x: 3040, y: 440, width: 20, height: 36 }
    },
    {
      id: 7, name: "Swarm Canopy", world: 2, bpm: 115, spawn: { x: 50, y: 390 }, width: 3350, height: 540,
      platforms: [
        { x: 0, y: 440, width: 320, height: 100 },
        { x: 380, y: 400, width: 180, height: 140 },
        { x: 620, y: 340, width: 180, height: 200 },
        { x: 860, y: 390, width: 180, height: 150 },
        { x: 1100, y: 440, width: 360, height: 100 },
        { x: 1520, y: 380, width: 160, height: 24 },
        { x: 1740, y: 330, width: 160, height: 24 },
        { x: 1960, y: 280, width: 160, height: 24 },
        { x: 2180, y: 340, width: 160, height: 24 },
        { x: 2400, y: 440, width: 380, height: 100 },
        { x: 2840, y: 380, width: 160, height: 24 },
        { x: 3060, y: 440, width: 320, height: 100 }
      ],
      hazards: [
        { x: 1220, y: 432, width: 50, height: 8, type: 'spikes' }
      ],
      enemies: [
        { x: 710, y: 260, width: 22, height: 22, type: 'patrol_drone', vx: 1.1, maxTravel: 60, health: 1 },
        { x: 1820, y: 250, width: 22, height: 22, type: 'patrol_drone', vx: 1.2, maxTravel: 65, health: 1 },
        { x: 2560, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 0.9, maxTravel: 60, health: 1 }
      ],
      targetBlocks: [
        { x: 940, y: 368, width: 26, height: 26 },
        { x: 2030, y: 258, width: 26, height: 26 }
      ],
      goal: { x: 3240, y: 440, width: 20, height: 36 }
    },
    {
      id: 8, name: "Shifting Moss", world: 2, bpm: 116, spawn: { x: 50, y: 390 }, width: 3550, height: 540,
      platforms: [
        { x: 0, y: 440, width: 300, height: 100 },
        { x: 360, y: 430, width: 110, height: 20, isMoving: true, vx: 1.3, vy: 0, travelDistance: 130, travelProgress: 0 },
        { x: 640, y: 410, width: 180, height: 130 },
        { x: 880, y: 360, width: 180, height: 180 },
        { x: 1120, y: 360, width: 110, height: 20, isMoving: true, vx: 0, vy: -1.1, travelDistance: 70, travelProgress: 0 },
        { x: 1370, y: 280, width: 200, height: 260 },
        { x: 1630, y: 360, width: 120, height: 20, isMoving: true, vx: 1.4, vy: 0, travelDistance: 140, travelProgress: 0 },
        { x: 1930, y: 440, width: 380, height: 100 },
        { x: 2370, y: 380, width: 150, height: 24 },
        { x: 2580, y: 330, width: 150, height: 24 },
        { x: 2790, y: 380, width: 150, height: 24 },
        { x: 3000, y: 440, width: 200, height: 100 },
        { x: 3260, y: 440, width: 320, height: 100 }
      ],
      hazards: [
        { x: 2050, y: 432, width: 50, height: 8, type: 'spikes' }
      ],
      enemies: [
        { x: 1460, y: 268, width: 24, height: 18, type: 'glitch_beetle', vx: 0.9, maxTravel: 60, health: 1 },
        { x: 2110, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 1.0, maxTravel: 60, health: 1 }
      ],
      targetBlocks: [
        { x: 960, y: 338, width: 26, height: 26 },
        { x: 2440, y: 358, width: 26, height: 26 }
      ],
      goal: { x: 3430, y: 440, width: 20, height: 36 }
    },

    // World 3: Underground Factory (Amber / Industrial)
    {
      id: 9, name: "Piston Core", world: 3, bpm: 118, spawn: { x: 50, y: 390 }, width: 3750, height: 540,
      platforms: [
        { x: 0, y: 440, width: 320, height: 100 },
        { x: 380, y: 430, width: 100, height: 20, isMoving: true, vx: 0, vy: -1.0, travelDistance: 70, travelProgress: 0 },
        { x: 540, y: 350, width: 200, height: 190 },
        { x: 800, y: 390, width: 120, height: 20, isMoving: true, vx: 1.4, vy: 0, travelDistance: 130, travelProgress: 0 },
        { x: 1090, y: 440, width: 380, height: 100 },
        { x: 1530, y: 380, width: 160, height: 24 },
        { x: 1750, y: 320, width: 180, height: 24 },
        { x: 1990, y: 370, width: 160, height: 24 },
        { x: 2210, y: 440, width: 380, height: 100 },
        { x: 2650, y: 380, width: 150, height: 24 },
        { x: 2860, y: 330, width: 160, height: 24 },
        { x: 3080, y: 380, width: 150, height: 24 },
        { x: 3290, y: 440, width: 480, height: 100 }
      ],
      hazards: [
        { x: 600, y: 342, width: 45, height: 8, type: 'spikes' },
        { x: 1220, y: 432, width: 50, height: 8, type: 'spikes' }
      ],
      enemies: [
        { x: 670, y: 338, width: 24, height: 18, type: 'glitch_beetle', vx: 0.8, maxTravel: 50, health: 1 },
        { x: 1840, y: 240, width: 22, height: 22, type: 'patrol_drone', vx: 1.2, maxTravel: 60, health: 1 },
        { x: 2360, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 1.0, maxTravel: 60, health: 1 }
      ],
      targetBlocks: [
        { x: 1610, y: 358, width: 26, height: 26 },
        { x: 2930, y: 308, width: 26, height: 26 }
      ],
      goal: { x: 3620, y: 440, width: 20, height: 36 }
    },
    {
      id: 10, name: "Steam Maze", world: 3, bpm: 120, spawn: { x: 50, y: 390 }, width: 3950, height: 540,
      platforms: [
        { x: 0, y: 440, width: 300, height: 100 },
        { x: 360, y: 410, width: 170, height: 130 },
        { x: 590, y: 360, width: 170, height: 180 },
        { x: 820, y: 310, width: 180, height: 230 },
        { x: 1060, y: 360, width: 170, height: 180 },
        { x: 1290, y: 440, width: 380, height: 100 },
        { x: 1730, y: 380, width: 150, height: 24 },
        { x: 1940, y: 320, width: 160, height: 24 },
        { x: 2160, y: 270, width: 160, height: 24 },
        { x: 2380, y: 330, width: 160, height: 24 },
        { x: 2600, y: 440, width: 380, height: 100 },
        { x: 3040, y: 380, width: 160, height: 24 },
        { x: 3260, y: 330, width: 160, height: 24 },
        { x: 3480, y: 440, width: 490, height: 100 }
      ],
      hazards: [
        { x: 880, y: 302, width: 45, height: 8, type: 'spikes' },
        { x: 1420, y: 432, width: 50, height: 8, type: 'spikes' }
      ],
      enemies: [
        { x: 440, y: 398, width: 24, height: 18, type: 'glitch_beetle', vx: 0.9, maxTravel: 50, health: 1 },
        { x: 2020, y: 240, width: 22, height: 22, type: 'patrol_drone', vx: 1.2, maxTravel: 60, health: 1 },
        { x: 2750, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 1.0, maxTravel: 60, health: 1 }
      ],
      targetBlocks: [
        { x: 1140, y: 338, width: 26, height: 26 },
        { x: 2240, y: 248, width: 26, height: 26 }
      ],
      goal: { x: 3820, y: 440, width: 20, height: 36 }
    },
    {
      id: 11, name: "Overclock", world: 3, bpm: 124, spawn: { x: 50, y: 390 }, width: 4150, height: 540,
      platforms: [
        { x: 0, y: 440, width: 320, height: 100 },
        { x: 380, y: 410, width: 180, height: 130 },
        { x: 620, y: 410, width: 110, height: 20, isMoving: true, vx: 1.5, vy: 0, travelDistance: 130, travelProgress: 0 },
        { x: 900, y: 380, width: 200, height: 160 },
        { x: 1160, y: 440, width: 380, height: 100 },
        { x: 1600, y: 380, width: 160, height: 24 },
        { x: 1820, y: 320, width: 180, height: 24 },
        { x: 2060, y: 370, width: 160, height: 24 },
        { x: 2280, y: 440, width: 380, height: 100 },
        { x: 2720, y: 380, width: 150, height: 24 },
        { x: 2930, y: 330, width: 160, height: 24 },
        { x: 3150, y: 380, width: 150, height: 24 },
        { x: 3360, y: 440, width: 810, height: 100 }
      ],
      hazards: [
        { x: 980, y: 372, width: 40, height: 8, type: 'laser' },
        { x: 1300, y: 432, width: 40, height: 8, type: 'laser' },
        { x: 2420, y: 432, width: 40, height: 8, type: 'laser' }
      ],
      enemies: [
        { x: 1260, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 1.1, maxTravel: 60, health: 1 },
        { x: 1910, y: 240, width: 22, height: 22, type: 'patrol_drone', vx: 1.2, maxTravel: 60, health: 1 },
        { x: 2510, y: 428, width: 24, height: 18, type: 'glitch_beetle', vx: 1.1, maxTravel: 60, health: 1 }
      ],
      targetBlocks: [
        { x: 1680, y: 358, width: 26, height: 26 },
        { x: 3010, y: 308, width: 26, height: 26 }
      ],
      goal: { x: 4010, y: 440, width: 20, height: 36 }
    },
    {
      id: 12, name: "Conveyor Hazard", world: 3, bpm: 124, spawn: { x: 50, y: 390 }, width: 4350, height: 540,
      platforms: [
        { x: 0, y: 440, width: 320, height: 100 },
        { x: 380, y: 440, width: 360, height: 100 },
        { x: 800, y: 400, width: 220, height: 140 },
        { x: 1080, y: 440, width: 360, height: 100 },
        { x: 1500, y: 380, width: 170, height: 24 },
        { x: 1730, y: 330, width: 180, height: 24 },
        { x: 1970, y: 380, width: 170, height: 24 },
        { x: 2200, y: 440, width: 400, height: 100 },
        { x: 2660, y: 380, width: 160, height: 24 },
        { x: 2880, y: 330, width: 170, height: 24 },
        { x: 3110, y: 380, width: 160, height: 24 },
        { x: 3330, y: 440, width: 1040, height: 100 }
      ],
      hazards: [
        { x: 500, y: 432, width: 45, height: 8, type: 'spikes' },
        { x: 1200, y: 432, width: 45, height: 8, type: 'spikes' },
        { x: 2350, y: 432, width: 45, height: 8, type: 'spikes' }
      ],
      enemies: [
        { x: 890, y: 384, width: 30, height: 30, type: 'titan_guard', vx: 0.7, maxTravel: 45, health: 2 },
        { x: 1820, y: 250, width: 22, height: 22, type: 'patrol_drone', vx: 1.2, maxTravel: 60, health: 1 },
        { x: 2400, y: 424, width: 30, height: 30, type: 'titan_guard', vx: 0.7, maxTravel: 50, health: 2 }
      ],
      targetBlocks: [
        { x: 1580, y: 358, width: 26, height: 26 },
        { x: 2960, y: 308, width: 26, height: 26 }
      ],
      goal: { x: 4210, y: 440, width: 20, height: 36 }
    },

    // World 4: Neon Cyber World (Purple / Violet)
    {
      id: 13, name: "Data Stream", world: 4, bpm: 126, spawn: { x: 50, y: 390 }, width: 4550, height: 540,
      platforms: [
        { x: 0, y: 440, width: 320, height: 100 },
        { x: 380, y: 400, width: 190, height: 140 },
        { x: 630, y: 350, width: 190, height: 190 },
        { x: 880, y: 390, width: 200, height: 150 },
        { x: 1140, y: 440, width: 400, height: 100 },
        { x: 1600, y: 380, width: 160, height: 24 },
        { x: 1820, y: 320, width: 170, height: 24 },
        { x: 2050, y: 270, width: 170, height: 24 },
        { x: 2280, y: 330, width: 170, height: 24 },
        { x: 2510, y: 440, width: 420, height: 100 },
        { x: 2990, y: 380, width: 160, height: 24 },
        { x: 3210, y: 330, width: 160, height: 24 },
        { x: 3430, y: 390, width: 160, height: 24 },
        { x: 3650, y: 440, width: 920, height: 100 }
      ],
      hazards: [],
      enemies: [
        { x: 720, y: 334, width: 26, height: 18, type: 'cyber_prowler', vx: 1.3, maxTravel: 60, health: 1 },
        { x: 1280, y: 428, width: 26, height: 18, type: 'cyber_prowler', vx: 1.4, maxTravel: 70, health: 1 },
        { x: 2130, y: 190, width: 22, height: 22, type: 'patrol_drone', vx: 1.2, maxTravel: 60, health: 1 },
        { x: 2680, y: 428, width: 26, height: 18, type: 'cyber_prowler', vx: 1.4, maxTravel: 70, health: 1 }
      ],
      targetBlocks: [
        { x: 980, y: 368, width: 26, height: 26 },
        { x: 1890, y: 298, width: 26, height: 26 },
        { x: 3290, y: 308, width: 26, height: 26 }
      ],
      goal: { x: 4420, y: 440, width: 20, height: 36 }
    },
    {
      id: 14, name: "Glitch Vector", world: 4, bpm: 128, spawn: { x: 50, y: 390 }, width: 4750, height: 540,
      platforms: [
        { x: 0, y: 440, width: 300, height: 100 },
        { x: 360, y: 410, width: 170, height: 130 },
        { x: 590, y: 410, width: 110, height: 20, isMoving: true, vx: 1.5, vy: 0, travelDistance: 130, travelProgress: 0 },
        { x: 870, y: 380, width: 200, height: 160 },
        { x: 1130, y: 340, width: 190, height: 200 },
        { x: 1380, y: 440, width: 400, height: 100 },
        { x: 1840, y: 380, width: 160, height: 24 },
        { x: 2060, y: 320, width: 170, height: 24 },
        { x: 2290, y: 380, width: 160, height: 24 },
        { x: 2510, y: 440, width: 420, height: 100 },
        { x: 2990, y: 370, width: 170, height: 24 },
        { x: 3220, y: 320, width: 170, height: 24 },
        { x: 3450, y: 380, width: 170, height: 24 },
        { x: 3680, y: 440, width: 1090, height: 100 }
      ],
      hazards: [
        { x: 960, y: 372, width: 40, height: 8, type: 'spikes' },
        { x: 1520, y: 432, width: 45, height: 8, type: 'spikes' },
        { x: 2680, y: 432, width: 45, height: 8, type: 'spikes' }
      ],
      enemies: [
        { x: 1220, y: 324, width: 26, height: 18, type: 'cyber_prowler', vx: 1.4, maxTravel: 60, health: 1 },
        { x: 2140, y: 240, width: 22, height: 22, type: 'patrol_drone', vx: 1.3, maxTravel: 60, health: 1 },
        { x: 2700, y: 428, width: 26, height: 18, type: 'cyber_prowler', vx: 1.5, maxTravel: 65, health: 1 }
      ],
      targetBlocks: [
        { x: 1470, y: 418, width: 26, height: 26 },
        { x: 3070, y: 348, width: 26, height: 26 }
      ],
      goal: { x: 4610, y: 440, width: 20, height: 36 }
    },
    {
      id: 15, name: "Syntax Sprint", world: 4, bpm: 130, spawn: { x: 50, y: 390 }, width: 4950, height: 540,
      platforms: [
        { x: 0, y: 440, width: 300, height: 100 },
        { x: 360, y: 440, width: 240, height: 100 },
        { x: 660, y: 400, width: 180, height: 140 },
        { x: 900, y: 350, width: 180, height: 190 },
        { x: 1140, y: 380, width: 180, height: 160 },
        { x: 1380, y: 440, width: 420, height: 100 },
        { x: 1860, y: 380, width: 160, height: 24 },
        { x: 2080, y: 320, width: 170, height: 24 },
        { x: 2310, y: 270, width: 170, height: 24 },
        { x: 2540, y: 330, width: 170, height: 24 },
        { x: 2770, y: 440, width: 440, height: 100 },
        { x: 3270, y: 380, width: 160, height: 24 },
        { x: 3490, y: 330, width: 160, height: 24 },
        { x: 3710, y: 390, width: 160, height: 24 },
        { x: 3930, y: 440, width: 1040, height: 100 }
      ],
      hazards: [
        { x: 450, y: 432, width: 40, height: 8, type: 'laser' },
        { x: 1210, y: 372, width: 40, height: 8, type: 'laser' },
        { x: 1550, y: 432, width: 40, height: 8, type: 'laser' },
        { x: 2940, y: 432, width: 40, height: 8, type: 'laser' }
      ],
      enemies: [
        { x: 990, y: 334, width: 26, height: 18, type: 'cyber_prowler', vx: 1.4, maxTravel: 60, health: 1 },
        { x: 2160, y: 240, width: 22, height: 22, type: 'patrol_drone', vx: 1.3, maxTravel: 60, health: 1 },
        { x: 2950, y: 428, width: 26, height: 18, type: 'cyber_prowler', vx: 1.5, maxTravel: 65, health: 1 }
      ],
      targetBlocks: [
        { x: 740, y: 378, width: 26, height: 26 },
        { x: 2390, y: 248, width: 26, height: 26 },
        { x: 3570, y: 308, width: 26, height: 26 }
      ],
      goal: { x: 4810, y: 440, width: 20, height: 36 }
    },
    {
      id: 16, name: "Hyperspace Beat", world: 4, bpm: 132, spawn: { x: 50, y: 390 }, width: 5150, height: 540,
      platforms: [
        { x: 0, y: 440, width: 300, height: 100 },
        { x: 360, y: 410, width: 110, height: 20, isMoving: true, vx: 1.6, vy: 0, travelDistance: 130, travelProgress: 0 },
        { x: 640, y: 380, width: 190, height: 160 },
        { x: 890, y: 360, width: 110, height: 20, isMoving: true, vx: 0, vy: -1.2, travelDistance: 70, travelProgress: 0 },
        { x: 1140, y: 290, width: 200, height: 250 },
        { x: 1400, y: 440, width: 440, height: 100 },
        { x: 1900, y: 380, width: 170, height: 24 },
        { x: 2130, y: 330, width: 170, height: 24 },
        { x: 2360, y: 380, width: 170, height: 24 },
        { x: 2590, y: 440, width: 460, height: 100 },
        { x: 3110, y: 380, width: 170, height: 24 },
        { x: 3340, y: 330, width: 170, height: 24 },
        { x: 3570, y: 380, width: 170, height: 24 },
        { x: 3800, y: 440, width: 1370, height: 100 }
      ],
      hazards: [
        { x: 720, y: 372, width: 45, height: 8, type: 'spikes' },
        { x: 1570, y: 432, width: 50, height: 8, type: 'spikes' },
        { x: 2780, y: 432, width: 50, height: 8, type: 'spikes' }
      ],
      enemies: [
        { x: 1240, y: 274, width: 30, height: 30, type: 'titan_guard', vx: 0.8, maxTravel: 45, health: 2 },
        { x: 2210, y: 250, width: 22, height: 22, type: 'patrol_drone', vx: 1.3, maxTravel: 60, health: 1 },
        { x: 2800, y: 424, width: 30, height: 30, type: 'titan_guard', vx: 0.8, maxTravel: 50, health: 2 }
      ],
      targetBlocks: [
        { x: 1480, y: 418, width: 26, height: 26 },
        { x: 3220, y: 358, width: 26, height: 26 }
      ],
      goal: { x: 5020, y: 440, width: 20, height: 36 }
    },

    // World 5: Ancient Futuristic Ruins (Electric Blue / Chrono Gold)
    {
      id: 17, name: "Forgotten Nexus", world: 5, bpm: 134, spawn: { x: 50, y: 390 }, width: 5350, height: 540,
      platforms: [
        { x: 0, y: 440, width: 320, height: 100 },
        { x: 380, y: 400, width: 180, height: 140 },
        { x: 620, y: 350, width: 180, height: 190 },
        { x: 860, y: 370, width: 120, height: 20, isMoving: true, vx: 1.5, vy: 0, travelDistance: 130, travelProgress: 0 },
        { x: 1140, y: 320, width: 200, height: 220 },
        { x: 1400, y: 440, width: 440, height: 100 },
        { x: 1900, y: 380, width: 170, height: 24 },
        { x: 2130, y: 320, width: 180, height: 24 },
        { x: 2370, y: 270, width: 180, height: 24 },
        { x: 2610, y: 330, width: 180, height: 24 },
        { x: 2850, y: 440, width: 460, height: 100 },
        { x: 3370, y: 380, width: 170, height: 24 },
        { x: 3600, y: 330, width: 170, height: 24 },
        { x: 3830, y: 390, width: 170, height: 24 },
        { x: 4060, y: 440, width: 1310, height: 100 }
      ],
      hazards: [
        { x: 700, y: 342, width: 40, height: 8, type: 'spikes' },
        { x: 1220, y: 312, width: 40, height: 8, type: 'laser' },
        { x: 1580, y: 432, width: 45, height: 8, type: 'spikes' },
        { x: 3040, y: 432, width: 45, height: 8, type: 'laser' }
      ],
      enemies: [
        { x: 470, y: 384, width: 26, height: 18, type: 'cyber_prowler', vx: 1.4, maxTravel: 55, health: 1 },
        { x: 2210, y: 240, width: 22, height: 22, type: 'patrol_drone', vx: 1.3, maxTravel: 65, health: 1 },
        { x: 3000, y: 428, width: 26, height: 18, type: 'cyber_prowler', vx: 1.5, maxTravel: 60, health: 1 }
      ],
      targetBlocks: [
        { x: 1470, y: 418, width: 26, height: 26 },
        { x: 2450, y: 248, width: 26, height: 26 },
        { x: 3680, y: 308, width: 26, height: 26 }
      ],
      goal: { x: 5220, y: 440, width: 20, height: 36 }
    },
    {
      id: 18, name: "Titan's Gate", world: 5, bpm: 136, spawn: { x: 50, y: 390 }, width: 5550, height: 540,
      platforms: [
        { x: 0, y: 440, width: 320, height: 100 },
        { x: 380, y: 420, width: 240, height: 120 },
        { x: 680, y: 380, width: 200, height: 160 },
        { x: 940, y: 380, width: 120, height: 20, isMoving: true, vx: 1.6, vy: 0, travelDistance: 130, travelProgress: 0 },
        { x: 1230, y: 410, width: 260, height: 130 },
        { x: 1550, y: 440, width: 460, height: 100 },
        { x: 2070, y: 380, width: 180, height: 24 },
        { x: 2310, y: 330, width: 180, height: 24 },
        { x: 2550, y: 380, width: 180, height: 24 },
        { x: 2790, y: 440, width: 480, height: 100 },
        { x: 3330, y: 380, width: 170, height: 24 },
        { x: 3560, y: 330, width: 170, height: 24 },
        { x: 3790, y: 380, width: 170, height: 24 },
        { x: 4020, y: 440, width: 1550, height: 100 }
      ],
      hazards: [
        { x: 460, y: 412, width: 50, height: 8, type: 'spikes' },
        { x: 1740, y: 432, width: 50, height: 8, type: 'spikes' },
        { x: 2980, y: 432, width: 50, height: 8, type: 'spikes' }
      ],
      enemies: [
        { x: 780, y: 364, width: 30, height: 30, type: 'titan_guard', vx: 0.8, maxTravel: 45, health: 2 },
        { x: 1780, y: 424, width: 30, height: 30, type: 'titan_guard', vx: 0.8, maxTravel: 55, health: 2 },
        { x: 2390, y: 250, width: 22, height: 22, type: 'patrol_drone', vx: 1.3, maxTravel: 60, health: 1 },
        { x: 3020, y: 424, width: 30, height: 30, type: 'titan_guard', vx: 0.8, maxTravel: 55, health: 2 }
      ],
      targetBlocks: [
        { x: 1350, y: 388, width: 26, height: 26 },
        { x: 2150, y: 358, width: 26, height: 26 },
        { x: 3640, y: 308, width: 26, height: 26 }
      ],
      goal: { x: 5410, y: 440, width: 20, height: 36 }
    },
    {
      id: 19, name: "Chrono Collapse", world: 5, bpm: 138, spawn: { x: 50, y: 390 }, width: 5750, height: 540,
      platforms: [
        { x: 0, y: 440, width: 300, height: 100 },
        { x: 360, y: 410, width: 110, height: 20, isMoving: true, vx: 1.5, vy: 0, travelDistance: 130, travelProgress: 0 },
        { x: 640, y: 370, width: 180, height: 170 },
        { x: 880, y: 340, width: 110, height: 20, isMoving: true, vx: 0, vy: -1.3, travelDistance: 70, travelProgress: 0 },
        { x: 1130, y: 270, width: 200, height: 270 },
        { x: 1390, y: 360, width: 120, height: 20, isMoving: true, vx: 1.6, vy: 0, travelDistance: 140, travelProgress: 0 },
        { x: 1690, y: 440, width: 440, height: 100 },
        { x: 2190, y: 380, width: 170, height: 24 },
        { x: 2420, y: 330, width: 170, height: 24 },
        { x: 2650, y: 280, width: 170, height: 24 },
        { x: 2880, y: 340, width: 170, height: 24 },
        { x: 3110, y: 440, width: 480, height: 100 },
        { x: 3650, y: 380, width: 170, height: 24 },
        { x: 3880, y: 330, width: 170, height: 24 },
        { x: 4110, y: 390, width: 170, height: 24 },
        { x: 4340, y: 440, width: 1420, height: 100 }
      ],
      hazards: [
        { x: 720, y: 362, width: 40, height: 8, type: 'laser' },
        { x: 1210, y: 262, width: 40, height: 8, type: 'spikes' },
        { x: 1870, y: 432, width: 50, height: 8, type: 'laser' },
        { x: 3310, y: 432, width: 50, height: 8, type: 'spikes' }
      ],
      enemies: [
        { x: 1220, y: 220, width: 22, height: 22, type: 'patrol_drone', vx: 1.4, maxTravel: 60, health: 1 },
        { x: 1910, y: 428, width: 26, height: 18, type: 'cyber_prowler', vx: 1.5, maxTravel: 60, health: 1 },
        { x: 2510, y: 250, width: 22, height: 22, type: 'patrol_drone', vx: 1.3, maxTravel: 60, health: 1 },
        { x: 3330, y: 428, width: 26, height: 18, type: 'cyber_prowler', vx: 1.5, maxTravel: 60, health: 1 }
      ],
      targetBlocks: [
        { x: 1770, y: 418, width: 26, height: 26 },
        { x: 2730, y: 258, width: 26, height: 26 },
        { x: 3960, y: 308, width: 26, height: 26 }
      ],
      goal: { x: 5610, y: 440, width: 20, height: 36 }
    },
    {
      id: 20, name: "The Chrono Core", world: 5, bpm: 140, spawn: { x: 50, y: 390 }, width: 6000, height: 540,
      platforms: [
        // Sector 1: Nexus Entry Runway (0-450)
        { x: 0, y: 440, width: 450, height: 100 },
        // Sector 2: Ascending Chrono Pillars (450-1200)
        { x: 510, y: 410, width: 180, height: 130 },
        { x: 740, y: 360, width: 180, height: 180 },
        { x: 970, y: 310, width: 190, height: 230 },
        // Sector 3: Firewall Defense & Target Breakers (1200-1900)
        { x: 1220, y: 380, width: 130, height: 20, isMoving: true, vx: 1.5, vy: 0, travelDistance: 130, travelProgress: 0 },
        { x: 1520, y: 440, width: 440, height: 100 },
        // Sector 4: Moving Platform Void Transit (1900-2800)
        { x: 2020, y: 410, width: 120, height: 20, isMoving: true, vx: 1.6, vy: 0, travelDistance: 140, travelProgress: 0 },
        { x: 2320, y: 350, width: 180, height: 190 },
        { x: 2560, y: 330, width: 120, height: 20, isMoving: true, vx: 0, vy: -1.2, travelDistance: 70, travelProgress: 0 },
        { x: 2820, y: 440, width: 480, height: 100 },
        // Sector 5: Titan Guard Hall (2800-3800)
        { x: 3360, y: 380, width: 180, height: 24 },
        { x: 3600, y: 330, width: 190, height: 24 },
        { x: 3850, y: 380, width: 180, height: 24 },
        { x: 4090, y: 440, width: 500, height: 100 },
        // Sector 6: Laser Gauntlet (4090-4800)
        { x: 4650, y: 380, width: 180, height: 24 },
        { x: 4890, y: 330, width: 190, height: 24 },
        { x: 5140, y: 390, width: 190, height: 24 },
        // Sector 7 & 8: Grand Core Chamber & Portal (5140-6000)
        { x: 5390, y: 440, width: 620, height: 100 }
      ],
      hazards: [
        { x: 800, y: 352, width: 40, height: 8, type: 'laser' },
        { x: 1680, y: 432, width: 50, height: 8, type: 'spikes' },
        { x: 3000, y: 432, width: 50, height: 8, type: 'laser' },
        { x: 4280, y: 432, width: 50, height: 8, type: 'spikes' }
      ],
      enemies: [
        { x: 600, y: 394, width: 26, height: 18, type: 'cyber_prowler', vx: 1.4, maxTravel: 55, health: 1 },
        { x: 1740, y: 428, width: 26, height: 18, type: 'cyber_prowler', vx: 1.5, maxTravel: 60, health: 1 },
        { x: 3040, y: 424, width: 30, height: 30, type: 'titan_guard', vx: 0.8, maxTravel: 60, health: 2 },
        { x: 3700, y: 250, width: 22, height: 22, type: 'patrol_drone', vx: 1.3, maxTravel: 60, health: 1 },
        // Chrono Core Boss!
        { x: 5650, y: 390, width: 52, height: 52, type: 'chrono_core', vx: 1.2, maxTravel: 110, health: 3 }
      ],
      targetBlocks: [
        { x: 1050, y: 288, width: 26, height: 26 },
        { x: 1600, y: 418, width: 26, height: 26 },
        { x: 2410, y: 328, width: 26, height: 26 },
        { x: 4170, y: 418, width: 26, height: 26 },
        { x: 5000, y: 308, width: 26, height: 26 }
      ],
      goal: { x: 5900, y: 440, width: 20, height: 36 }
    }
  ];

  /**
   * Generates collectible cyber coins for the level layout along platforms, jump gaps, and target blocks
   */
  function generateLevelCoins(level) {
    const coins = [];
    const platforms = level.platforms || [];
    const hazards = level.hazards || [];
    const targetBlocks = level.targetBlocks || [];
    const spawnX = (level.spawn && level.spawn.x) || 50;
    const goalX = (level.goal && level.goal.x) || 2000;

    function isNearHazard(x, y) {
      for (const h of hazards) {
        if (Math.abs(x - (h.x + (h.width || 28) / 2)) < 35 && Math.abs(y - h.y) < 45) return true;
      }
      return false;
    }

    platforms.forEach((plat, pIdx) => {
      const startX = plat.x;
      const endX = plat.x + plat.width;
      const platY = plat.y;

      let count = 0;
      if (plat.width >= 320) count = 3;
      else if (plat.width >= 160) count = 2;
      else if (plat.width >= 80) count = 1;

      if (count === 1) {
        const cx = Math.round(startX + plat.width / 2);
        const cy = Math.round(platY - 32);
        if (cx > spawnX + 80 && cx < goalX - 30 && !isNearHazard(cx, cy)) {
          coins.push({ x: cx, y: cy, width: 22, height: 22, collected: false });
        }
      } else if (count === 2) {
        const c1 = Math.round(startX + plat.width * 0.32);
        const c2 = Math.round(startX + plat.width * 0.68);
        const cy = Math.round(platY - 32);
        if (c1 > spawnX + 80 && c1 < goalX - 30 && !isNearHazard(c1, cy)) {
          coins.push({ x: c1, y: cy, width: 22, height: 22, collected: false });
        }
        if (c2 > spawnX + 80 && c2 < goalX - 30 && !isNearHazard(c2, cy)) {
          coins.push({ x: c2, y: cy, width: 22, height: 22, collected: false });
        }
      } else if (count >= 3) {
        const step = plat.width / 4;
        for (let i = 1; i <= 3; i++) {
          const cx = Math.round(startX + step * i);
          const cy = Math.round(platY - 32);
          if (cx > spawnX + 80 && cx < goalX - 30 && !isNearHazard(cx, cy)) {
            coins.push({ x: cx, y: cy, width: 22, height: 22, collected: false });
          }
        }
      }

      if (pIdx < platforms.length - 1) {
        const nextPlat = platforms[pIdx + 1];
        const gap = nextPlat.x - endX;
        if (gap >= 40 && gap <= 240) {
          const midX = Math.round(endX + gap / 2);
          const midY = Math.round(Math.min(platY, nextPlat.y) - 54);
          if (midX > spawnX + 80 && midX < goalX - 30) {
            coins.push({ x: midX, y: midY, width: 22, height: 22, collected: false });
          }
        }
      }
    });

    targetBlocks.forEach(tb => {
      const cx = Math.round(tb.x);
      const cy = Math.round(tb.y - 38);
      if (!coins.some(c => Math.hypot(c.x - cx, c.y - cy) < 25)) {
        coins.push({ x: cx, y: cy, width: 22, height: 22, collected: false });
      }
    });

    coins.sort((a, b) => a.x - b.x);
    return coins;
  }

  /**
   * Generates strategic checkpoint beacons for the level layout along safe platforms
   */
  function generateLevelCheckpoints(level) {
    const checkpoints = [];
    const platforms = level.platforms || [];
    const hazards = level.hazards || [];
    const enemies = level.enemies || [];
    const spawnX = (level.spawn && level.spawn.x) || 50;
    const goalX = (level.goal && level.goal.x) || (level.width - 80);

    const totalDist = goalX - spawnX;
    const numCheckpoints = level.width > 3200 ? 2 : 1;
    const targetRatios = numCheckpoints === 1 ? [0.50] : [0.35, 0.70];

    function isSafeFromHazards(x, y) {
      for (const h of hazards) {
        const hx = h.x + (h.width || 28) / 2;
        const hy = h.y + (h.height || 28) / 2;
        if (Math.abs(x - hx) < 70 && Math.abs(y - hy) < 50) return false;
      }
      return true;
    }

    targetRatios.forEach((ratio, idx) => {
      const targetX = spawnX + totalDist * ratio;
      const candidates = platforms.filter(p => {
        if (p.isMoving) return false;
        if (p.width < 60) return false;
        const midX = p.x + p.width / 2;
        if (midX < spawnX + 250 || midX > goalX - 220) return false;
        return true;
      });

      if (candidates.length === 0) return;

      candidates.sort((a, b) => {
        const distA = Math.abs((a.x + a.width / 2) - targetX);
        const distB = Math.abs((b.x + b.width / 2) - targetX);
        return distA - distB;
      });

      for (const plat of candidates) {
        let candX = Math.round(plat.x + plat.width / 2);
        const candY = plat.y - 24;

        const nearEnemy = enemies.find(e => Math.abs(e.x - candX) < 65 && Math.abs(e.y - plat.y) < 40);
        if (nearEnemy) {
          if (nearEnemy.x > candX) {
            candX = Math.max(plat.x + 25, candX - 35);
          } else {
            candX = Math.min(plat.x + plat.width - 25, candX + 35);
          }
        }

        if (isSafeFromHazards(candX, plat.y)) {
          if (!checkpoints.some(cp => Math.abs(cp.x - candX) < 250)) {
            checkpoints.push({
              id: 'cp_' + (idx + 1),
              index: idx + 1,
              x: candX,
              y: candY,
              platformY: plat.y,
              width: 28,
              height: 48,
              active: false
            });
            break;
          }
        }
      }
    });

    return checkpoints;
  }

  function getLevelCopy(levelId) {
    const lvl = LEVELS.find(l => l.id === levelId) || LEVELS[0];
    const copy = JSON.parse(JSON.stringify(lvl));
    if (!copy.coins || copy.coins.length === 0) {
      copy.coins = generateLevelCoins(copy);
    }
    if (!copy.checkpoints || copy.checkpoints.length === 0) {
      copy.checkpoints = generateLevelCheckpoints(copy);
    }
    return copy;
  }

  // =========================================================================
  // =========================================================================
  // 4. REAL-TIME CAMERA HAND GESTURE CONTROL ENGINE
  // =========================================================================
  let PLAYER_SPEED = 6.60; // 50% Boosted High-Speed Velocity (4.40 * 1.50 = 6.60)
  const JUMP_FORCE = 15.5; // High-velocity turbo jump impulse (fast takeoff)
  const attackCooldown = 500; // 500ms cooldown (Section 8 & 12)
  let attackLocked = false;
  let fistAttackTriggered = false;

  // Active keyboard keys Set & touch state for simultaneous multi-key controls
  const activeKeys = new Set();
  let touchMoveDirection = null; // 'LEFT' | 'RIGHT' | null
  let lastHorizontalKey = null; // 'LEFT' | 'RIGHT' | null (supports instant direction reversal without stopping)

  function updatePlayerSpeedFromSettings() {
    const spd = (gameStateData.settings && gameStateData.settings.playerSpeed) || 'normal';
    if (spd === 'slow') {
      PLAYER_SPEED = 5.75;
    } else if (spd === 'fast') {
      PLAYER_SPEED = 8.25;
    } else {
      PLAYER_SPEED = 6.60; // 'normal' default (+50% increase)
    }
  }

  function setPlayerSpeed(speedOrPreset) {
    if (typeof speedOrPreset === 'number') {
      PLAYER_SPEED = Math.max(1.0, Math.min(12.0, speedOrPreset));
    } else if (speedOrPreset === 'slow') {
      PLAYER_SPEED = 5.75;
    } else if (speedOrPreset === 'normal') {
      PLAYER_SPEED = 6.60;
    } else if (speedOrPreset === 'fast') {
      PLAYER_SPEED = 8.25;
    }
  }

  let webcamStream = null;
  let isCameraActive = false;
  let isCameraTrackingLoopRunning = false;
  let mediaPipeHandsInstance = null;
  let isMediaPipeReady = false;

  // =========================================================================
  // DUAL-HAND GESTURE ENGINE (RIGHT HAND = MOVEMENT, LEFT HAND = ATTACK)
  // =========================================================================
  let detectedHandsCount = 0;

  // Right Hand: Movement (👈 LEFT, 👉 RIGHT, ☝️ UP, 👇 DOWN, ✋ NONE)
  let rightHandDetected = false;
  let rightDetectedGesture = 'NONE';
  let rightCandidateGesture = 'NONE';
  let rightCandidateStartTime = 0;
  let rightConfirmedGesture = 'NONE';
  let previousRightSmoothedLandmarks = null;
  let rightConfidence = 0;

  // Left Hand: Attack only (✊ ATTACK, ✋ READY / NONE)
  let leftHandDetected = false;
  let leftDetectedGesture = 'NONE';
  let leftCandidateGesture = 'NONE';
  let leftCandidateStartTime = 0;
  let leftConfirmedGesture = 'NONE';
  let previousLeftSmoothedLandmarks = null;
  let leftConfidence = 0;

  // =========================================================================
  // PERSISTENT HAND LOCK & IDENTITY CONTINUITY TRACKER
  // Rules Enforced:
  // 1. "ONCE CONNECT TO THE HAND DON'T CHANGE TO ANOTHER HAND"
  //    Maintains spatial identity continuity across frames using minimum Euclidean
  //    distance bipartite assignment and position locking. Hands NEVER swap identities
  //    or jump to another person's hand.
  // 2. "IF THERE IS MULTIPLE HANDS TAKE ONLY 2 HANDS"
  //    Strictly filters all detected hands down to at most 2 hands, prioritizing
  //    active locked hands and front-and-center hands.
  // =========================================================================
  const handLockTracker = {
    left: {
      isLocked: false,
      lastX: null,
      lastY: null,
      lostFrames: 0
    },
    right: {
      isLocked: false,
      lastX: null,
      lastY: null,
      lostFrames: 0
    },
    reset() {
      this.left.isLocked = false;
      this.left.lastX = null;
      this.left.lastY = null;
      this.left.lostFrames = 0;
      this.right.isLocked = false;
      this.right.lastX = null;
      this.right.lastY = null;
      this.right.lostFrames = 0;
    }
  };

  const MAX_LOST_FRAMES_TOLERANCE = 24;      // ~0.8s grace period before releasing hand lock
  const MAX_HAND_ASSOCIATION_DIST = 0.40;     // Maximum normalized Euclidean distance between consecutive frames

  let leftFistHeld = false;         // Fist hold guard on left hand: triggers 1 punch per fist
  let lastLeftAttackTime = 0;       // 500ms cooldown timer
  let rightFistHeld = false;        // Backward-compatibility alias
  let lastRightAttackTime = 0;      // Backward-compatibility alias
  const ATTACK_COOLDOWN_MS = 500;
  const GESTURE_DEBOUNCE_MS = 80;   // Rapid gesture response window (reduced for speed)

  // Single-hand backward compatibility aliases
  let handDetected = false;
  let currentDetectedGesture = 'NONE';
  let currentCandidateGesture = 'NONE';
  let candidateStartTime = 0;
  let confirmedActiveGesture = 'NONE';
  let previousSmoothedLandmarks = null;
  let lastGestureConfidence = 0;

  // Native CV Fallback canvas
  const cvCanvas = document.createElement('canvas');
  cvCanvas.width = 160;
  cvCanvas.height = 120;
  const cvCtx = cvCanvas.getContext('2d', { willReadFrequently: true });

  // DOM Elements
  const videoEl = document.getElementById('webcam-video');
  const overlayCanvas = document.getElementById('camera-overlay-canvas');
  const overlayCtx = overlayCanvas ? overlayCanvas.getContext('2d') : null;
  const handReticle = document.getElementById('cam-hand-reticle');
  const camHandReticleLeft = document.getElementById('cam-hand-reticle-left');
  const camHandReticleRight = document.getElementById('cam-hand-reticle-right');
  const camTrackingBadge = document.getElementById('cam-tracking-badge');
  const camFeedbackGesture = document.getElementById('cam-feedback-gesture');
  const camFeedbackLeft = document.getElementById('cam-feedback-left');
  const camFeedbackRight = document.getElementById('cam-feedback-right');
  const camFeedbackStatus = document.getElementById('cam-feedback-status');
  const camFeedbackConfidence = document.getElementById('cam-feedback-confidence');
  const camFeedbackVector = document.getElementById('cam-feedback-vector');
  const hudCamPill = document.getElementById('hud-cam-pill');
  const hudConfidencePill = document.getElementById('hud-confidence-pill');
  const hudGestureEmoji = document.getElementById('hud-gesture-emoji');
  const hudGestureName = document.getElementById('hud-gesture-name');
  const hudLeftEmoji = document.getElementById('hud-left-emoji');
  const hudLeftName = document.getElementById('hud-left-name');
  const hudRightEmoji = document.getElementById('hud-right-emoji');
  const hudRightName = document.getElementById('hud-right-name');
  const attackBannerFx = document.getElementById('attack-banner-fx');
  const attackCooldownFill = document.getElementById('attack-cooldown-fill');

  const gestureEmojiMap = {
    'LEFT': '👈',
    'RIGHT': '👉',
    'UP': '☝️',
    'DOWN': '👇',
    'UP_RIGHT': '↗️',
    'UP_LEFT': '↖️',
    'DOWN_RIGHT': '↘️',
    'DOWN_LEFT': '↙️',
    'ATTACK': '✊',
    'READY': '✋',
    'NONE': '✋'
  };

  /**
   * 1. initializeHandTracking()
   * Configures MediaPipe Hands for TWO HANDS simultaneously (maxNumHands: 2)
   */
  function initializeHandTracking() {
    if (window.Hands) {
      try {
        mediaPipeHandsInstance = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        mediaPipeHandsInstance.setOptions({
          maxNumHands: 2, // TWO HANDS SIMULTANEOUSLY!
          modelComplexity: 1, // Full precision model: rejects head/face false-positives
          minDetectionConfidence: 0.68, // High threshold: only genuine hands
          minTrackingConfidence: 0.65
        });
        mediaPipeHandsInstance.onResults(handleMediaPipeResults);
        isMediaPipeReady = true;
      } catch (err) {
        console.warn('MediaPipe initialization fallback to CV:', err);
        isMediaPipeReady = false;
      }
    }
  }

  /**
   * 2. startCamera()
   * Requests camera access using navigator.mediaDevices.getUserMedia()
   */
  async function startCamera() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser environment.');
      }

      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 320 },
          height: { ideal: 240 }
        },
        audio: false
      });

      if (videoEl) {
        videoEl.srcObject = webcamStream;
        await videoEl.play();
      }

      isCameraActive = true;
      if (hudCamPill) hudCamPill.textContent = 'CAMERA ACTIVE';
      if (camTrackingBadge) {
        camTrackingBadge.textContent = 'ACTIVE';
        camTrackingBadge.className = 'cam-badge badge-active';
      }

      if (overlayCanvas && videoEl) {
        overlayCanvas.width = videoEl.videoWidth || 320;
        overlayCanvas.height = videoEl.videoHeight || 240;
      }

      initializeHandTracking();
      startCameraProcessingLoop();
      return { success: true };
    } catch (err) {
      console.warn('Camera permission denied or failed:', err);
      isCameraActive = false;
      if (hudCamPill) hudCamPill.textContent = 'CAMERA DENIED';
      if (camTrackingBadge) {
        camTrackingBadge.textContent = 'DENIED';
        camTrackingBadge.className = 'cam-badge badge-lost';
      }
      return { success: false, error: err.message || 'Permission denied' };
    }
  }

  /**
   * 3. stopCamera()
   * Stops camera streams and tracking loops
   */
  function stopCamera() {
    isCameraActive = false;
    isCameraTrackingLoopRunning = false;
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      webcamStream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
    if (overlayCtx && overlayCanvas) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
    detectedHandsCount = 0;
    leftHandDetected = false;
    rightHandDetected = false;
    handDetected = false;
    leftDetectedGesture = 'NONE';
    leftCandidateGesture = 'NONE';
    leftConfirmedGesture = 'NONE';
    rightDetectedGesture = 'NONE';
    rightCandidateGesture = 'NONE';
    rightConfirmedGesture = 'NONE';
    previousLeftSmoothedLandmarks = null;
    previousRightSmoothedLandmarks = null;
    previousSmoothedLandmarks = null;
    handLockTracker.reset();
    stopPlayer();
    updateTwoHandUIFeedback();
    if (hudCamPill) hudCamPill.textContent = 'CAMERA OFF';
    if (camTrackingBadge) {
      camTrackingBadge.textContent = 'OFF';
      camTrackingBadge.className = 'cam-badge badge-lost';
    }
  }

  /**
   * Continuous camera processing loop using requestAnimationFrame
   */
  function startCameraProcessingLoop() {
    if (isCameraTrackingLoopRunning) return;
    isCameraTrackingLoopRunning = true;

    async function processFrame() {
      if (!isCameraActive) {
        isCameraTrackingLoopRunning = false;
        return;
      }

      if (videoEl && videoEl.readyState >= 2) {
        if (isMediaPipeReady && mediaPipeHandsInstance) {
          try {
            await mediaPipeHandsInstance.send({ image: videoEl });
          } catch (e) {
            processNativeCVFrame();
          }
        } else {
          processNativeCVFrame();
        }
      }

      requestAnimationFrame(processFrame);
    }

    requestAnimationFrame(processFrame);
  }

  /**
   * 6. isIndexFingerExtended(landmarks)
   * Validates that index finger is extended and other fingers are folded (Section 4)
   */
  function isIndexFingerExtended(landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    const wrist = landmarks[0];

    // Index finger tip (8), DIP (7), PIP (6), MCP (5)
    const dTipWrist = Math.hypot(landmarks[8].x - wrist.x, landmarks[8].y - wrist.y);
    const dPipWrist = Math.hypot(landmarks[6].x - wrist.x, landmarks[6].y - wrist.y);
    const dTipMcp = Math.hypot(landmarks[8].x - landmarks[5].x, landmarks[8].y - landmarks[5].y);

    // Index must be clearly extended away from wrist and MCP
    const indexExtended = (dTipWrist > dPipWrist * 1.12) && (dTipMcp > 0.065);

    // Other fingers (middle 12, ring 16, pinky 20) should preferably be folded towards palm
    const dMiddleTip = Math.hypot(landmarks[12].x - wrist.x, landmarks[12].y - wrist.y);
    const dMiddlePip = Math.hypot(landmarks[10].x - wrist.x, landmarks[10].y - wrist.y);
    const middleFolded = dMiddleTip < dMiddlePip * 1.25;

    const dRingTip = Math.hypot(landmarks[16].x - wrist.x, landmarks[16].y - wrist.y);
    const dRingPip = Math.hypot(landmarks[14].x - wrist.x, landmarks[14].y - wrist.y);
    const ringFolded = dRingTip < dRingPip * 1.25;

    const dPinkyTip = Math.hypot(landmarks[20].x - wrist.x, landmarks[20].y - wrist.y);
    const dPinkyPip = Math.hypot(landmarks[18].x - wrist.x, landmarks[18].y - wrist.y);
    const pinkyFolded = dPinkyTip < dPinkyPip * 1.25;

    const foldedCount = (middleFolded ? 1 : 0) + (ringFolded ? 1 : 0) + (pinkyFolded ? 1 : 0);

    return indexExtended && (foldedCount >= 2);
  }

  /**
   * 7. isFist(landmarks)
   * Validates that player hand is in a closed fist ✊ (Section 8)
   */
  function isFist(landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    const wrist = landmarks[0];

    // Index finger must NOT be extended! (Section 13 Priority)
    const dIndexTip = Math.hypot(landmarks[8].x - wrist.x, landmarks[8].y - wrist.y);
    const dIndexPip = Math.hypot(landmarks[6].x - wrist.x, landmarks[6].y - wrist.y);
    if (dIndexTip > dIndexPip * 1.1) {
      return false; // Index is pointing out! Cannot be a fist.
    }

    const tips = [8, 12, 16, 20];
    const mcps = [5, 9, 13, 17];
    let foldedCount = 0;

    for (let i = 0; i < 4; i++) {
      const tipDist = Math.hypot(landmarks[tips[i]].x - wrist.x, landmarks[tips[i]].y - wrist.y);
      const mcpDist = Math.hypot(landmarks[mcps[i]].x - wrist.x, landmarks[mcps[i]].y - wrist.y);
      if (tipDist < mcpDist * 1.15) {
        foldedCount++;
      }
    }

    // Thumb curled in check (thumb tip 4 close to index MCP 5 or wrist)
    const thumbDist = Math.hypot(landmarks[4].x - landmarks[5].x, landmarks[4].y - landmarks[5].y);
    const thumbIn = thumbDist < 0.16;

    return (foldedCount === 4) || (foldedCount >= 3 && thumbIn);
  }

  /**
   * 5. detectPointDirection(landmarks)
   * Calculates index finger pointing vector: INDEX TIP - INDEX MCP (Section 3)
   * 👈 LEFT, 👉 RIGHT, ☝️ UP, 👇 DOWN
   */
  function detectPointDirection(landmarks) {
    if (!landmarks || landmarks.length < 21) return null;
    if (!isIndexFingerExtended(landmarks)) return null;

    const isMirror = gameStateData.settings.mirrorCamera;
    const tipX = isMirror ? (1 - landmarks[8].x) : landmarks[8].x;
    const mcpX = isMirror ? (1 - landmarks[5].x) : landmarks[5].x;
    const tipY = landmarks[8].y;
    const mcpY = landmarks[5].y;

    const dx = tipX - mcpX;
    const dy = tipY - mcpY;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const threshold = 0.045; // Minimum vector displacement

    const magnitude = Math.hypot(dx, dy);
    if (magnitude < threshold) return null;

    // Horizontal vs Vertical dominance & Diagonal Simultaneous Directions
    if (absDx > absDy * 1.45 && absDx > threshold) {
      return dx < 0 ? 'LEFT' : 'RIGHT';
    } else if (absDy > absDx * 1.45 && absDy > threshold) {
      return dy < 0 ? 'UP' : 'DOWN';
    }

    // Diagonal multi-direction zones (combining horizontal run + vertical jump/crouch!)
    if (absDx >= threshold * 0.70 && absDy >= threshold * 0.70) {
      if (dy < 0) {
        return dx > 0 ? 'UP_RIGHT' : 'UP_LEFT';
      } else {
        return dx > 0 ? 'DOWN_RIGHT' : 'DOWN_LEFT';
      }
    }

    // Fallback to dominant component
    if (absDx >= absDy) {
      return dx < 0 ? 'LEFT' : 'RIGHT';
    } else {
      return dy < 0 ? 'UP' : 'DOWN';
    }
  }

  /**
   * 4. detectHandGesture(landmarks)
   * Enforces strict Gesture Priority (Section 13):
   * 1. ✊ FIST -> ATTACK
   * 2. 👈 LEFT
   * 3. 👉 RIGHT
   * 4. ☝️ UP
   * 5. 👇 DOWN
   * 6. Open / unclear hand -> NONE
   */
  /**
   * Anatomical Hand Validation Filter:
   * Rejects faces, heads, necks, shoulders, or ambient visual noise.
   * Ensures that MediaPipe has tracked an actual human hand with genuine palm & finger geometry.
   */
  function isGenuineHandLandmarks(lm, hInfo = null) {
    if (!lm || lm.length < 21) return false;

    // Reject low-confidence predictions from MediaPipe
    if (hInfo && typeof hInfo.score === 'number' && hInfo.score < 0.65) {
      return false;
    }

    const wrist = lm[0];
    const mcpIndex = lm[5];
    const mcpMiddle = lm[9];
    const mcpPinky = lm[17];
    const tipMiddle = lm[12];

    // Palm dimensions
    const palmLength = Math.hypot(mcpMiddle.x - wrist.x, mcpMiddle.y - wrist.y);
    const palmWidth = Math.hypot(mcpPinky.x - mcpIndex.x, mcpPinky.y - mcpIndex.y);

    // Palm length must be reasonable for a human hand (between 0.04 and 0.48 screen units)
    if (palmLength < 0.04 || palmLength > 0.48) return false;
    if (palmWidth < 0.03 || palmWidth > 0.45) return false;

    const palmRatio = palmLength / (palmWidth + 0.001);
    if (palmRatio < 0.45 || palmRatio > 3.0) return false;

    // Finger reach check (distance from wrist to middle fingertip)
    const middleReach = Math.hypot(tipMiddle.x - wrist.x, tipMiddle.y - wrist.y);
    if (middleReach < 0.038 || middleReach > 0.65) return false;

    // Head / Face Area Exclusion:
    // If center of detected landmark cluster is located in the upper-center face zone
    // and wrist is located near top with no downward forearm orientation, reject it as facial artifact
    const rawCx = (wrist.x + mcpMiddle.x) / 2;
    const rawCy = (wrist.y + mcpMiddle.y) / 2;
    if (rawCy < 0.38 && rawCx > 0.28 && rawCx < 0.72) {
      if (wrist.y < 0.24 && tipMiddle.y >= wrist.y) {
        return false;
      }
    }

    return true;
  }

  /**
   * Classifies detected hands into LEFT HAND (Attack) and RIGHT HAND (Movement).
   * Enforces 2-hand limit and persistent identity locking.
   */
  function classifyTwoHands(multiLandmarks, multiHandedness, isMirror) {
    let leftHand = null;
    let rightHand = null;

    if (!multiLandmarks || multiLandmarks.length === 0) {
      if (handLockTracker.left.isLocked) {
        handLockTracker.left.lostFrames++;
        if (handLockTracker.left.lostFrames > MAX_LOST_FRAMES_TOLERANCE) {
          handLockTracker.left.isLocked = false;
          handLockTracker.left.lastX = null;
          handLockTracker.left.lastY = null;
          handLockTracker.left.lostFrames = 0;
        }
      }
      if (handLockTracker.right.isLocked) {
        handLockTracker.right.lostFrames++;
        if (handLockTracker.right.lostFrames > MAX_LOST_FRAMES_TOLERANCE) {
          handLockTracker.right.isLocked = false;
          handLockTracker.right.lastX = null;
          handLockTracker.right.lastY = null;
          handLockTracker.right.lostFrames = 0;
        }
      }
      return { leftHand, rightHand };
    }

    // Step 1: Extract candidate hand data (ONLY GENUINE HANDS - STRICT HEAD/FACE EXCLUSION)
    const rawCandidates = [];
    for (let i = 0; i < multiLandmarks.length; i++) {
      const lm = multiLandmarks[i];
      if (!lm || lm.length < 21) continue;
      const hInfo = (multiHandedness && multiHandedness[i]) ? multiHandedness[i] : null;

      // STRICT FILTER: Reject heads, faces, or non-hand noise
      if (!isGenuineHandLandmarks(lm, hInfo)) {
        continue;
      }

      const wrist = lm[0];
      const mcp = lm[9];
      const rawCx = (wrist.x + mcp.x) / 2;
      const rawCy = (wrist.y + mcp.y) / 2;
      const screenX = isMirror ? (1 - rawCx) : rawCx;
      const screenY = rawCy;
      const palmSize = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);

      rawCandidates.push({
        index: i,
        landmarks: lm,
        handedness: hInfo,
        screenX,
        screenY,
        palmSize
      });
    }

    if (rawCandidates.length === 0) {
      return { leftHand, rightHand };
    }

    // Step 2: "IF THERE IS MULTIPLE HANDS TAKE ONLY 2 HANDS"
    // Prioritize candidates closest to our currently locked hands, then by size
    rawCandidates.forEach(cand => {
      let priorityScore = cand.palmSize * 2.0;
      if (handLockTracker.left.isLocked && handLockTracker.left.lastX !== null) {
        const dL = Math.hypot(cand.screenX - handLockTracker.left.lastX, cand.screenY - handLockTracker.left.lastY);
        if (dL < MAX_HAND_ASSOCIATION_DIST) {
          priorityScore += (MAX_HAND_ASSOCIATION_DIST - dL) * 15;
        }
      }
      if (handLockTracker.right.isLocked && handLockTracker.right.lastX !== null) {
        const dR = Math.hypot(cand.screenX - handLockTracker.right.lastX, cand.screenY - handLockTracker.right.lastY);
        if (dR < MAX_HAND_ASSOCIATION_DIST) {
          priorityScore += (MAX_HAND_ASSOCIATION_DIST - dR) * 15;
        }
      }
      cand.priority = priorityScore;
    });

    rawCandidates.sort((a, b) => b.priority - a.priority);
    // TAKE AT MOST 2 HANDS:
    const activeCandidates = rawCandidates.slice(0, 2);

    // Step 3: "ONCE CONNECT TO THE HAND DON'T CHANGE TO ANOTHER HAND"
    // Persistent Slot Matching & Identity Locking
    const leftLocked = handLockTracker.left.isLocked && handLockTracker.left.lastX !== null;
    const rightLocked = handLockTracker.right.isLocked && handLockTracker.right.lastX !== null;

    if (leftLocked && rightLocked) {
      // Both slots locked: find optimal assignment to existing locks without swapping
      if (activeCandidates.length === 2) {
        const c0 = activeCandidates[0];
        const c1 = activeCandidates[1];
        const dist0L = Math.hypot(c0.screenX - handLockTracker.left.lastX, c0.screenY - handLockTracker.left.lastY);
        const dist1R = Math.hypot(c1.screenX - handLockTracker.right.lastX, c1.screenY - handLockTracker.right.lastY);
        const dist1L = Math.hypot(c1.screenX - handLockTracker.left.lastX, c1.screenY - handLockTracker.left.lastY);
        const dist0R = Math.hypot(c0.screenX - handLockTracker.right.lastX, c0.screenY - handLockTracker.right.lastY);

        if ((dist0L + dist1R) <= (dist1L + dist0R)) {
          leftHand = { landmarks: c0.landmarks, handedness: c0.handedness };
          rightHand = { landmarks: c1.landmarks, handedness: c1.handedness };
          handLockTracker.left.lastX = c0.screenX;
          handLockTracker.left.lastY = c0.screenY;
          handLockTracker.left.lostFrames = 0;
          handLockTracker.right.lastX = c1.screenX;
          handLockTracker.right.lastY = c1.screenY;
          handLockTracker.right.lostFrames = 0;
        } else {
          leftHand = { landmarks: c1.landmarks, handedness: c1.handedness };
          rightHand = { landmarks: c0.landmarks, handedness: c0.handedness };
          handLockTracker.left.lastX = c1.screenX;
          handLockTracker.left.lastY = c1.screenY;
          handLockTracker.left.lostFrames = 0;
          handLockTracker.right.lastX = c0.screenX;
          handLockTracker.right.lastY = c0.screenY;
          handLockTracker.right.lostFrames = 0;
        }
      } else if (activeCandidates.length === 1) {
        // Only 1 hand currently visible: match to whichever locked slot is closer
        const c = activeCandidates[0];
        const distL = Math.hypot(c.screenX - handLockTracker.left.lastX, c.screenY - handLockTracker.left.lastY);
        const distR = Math.hypot(c.screenX - handLockTracker.right.lastX, c.screenY - handLockTracker.right.lastY);

        if (distL < distR && distL < MAX_HAND_ASSOCIATION_DIST * 1.5) {
          leftHand = { landmarks: c.landmarks, handedness: c.handedness };
          handLockTracker.left.lastX = c.screenX;
          handLockTracker.left.lastY = c.screenY;
          handLockTracker.left.lostFrames = 0;
          handLockTracker.right.lostFrames++;
        } else if (distR <= distL && distR < MAX_HAND_ASSOCIATION_DIST * 1.5) {
          rightHand = { landmarks: c.landmarks, handedness: c.handedness };
          handLockTracker.right.lastX = c.screenX;
          handLockTracker.right.lastY = c.screenY;
          handLockTracker.right.lostFrames = 0;
          handLockTracker.left.lostFrames++;
        } else {
          if (distR <= distL) {
            rightHand = { landmarks: c.landmarks, handedness: c.handedness };
            handLockTracker.right.lastX = c.screenX;
            handLockTracker.right.lastY = c.screenY;
            handLockTracker.right.lostFrames = 0;
            handLockTracker.left.lostFrames++;
          } else {
            leftHand = { landmarks: c.landmarks, handedness: c.handedness };
            handLockTracker.left.lastX = c.screenX;
            handLockTracker.left.lastY = c.screenY;
            handLockTracker.left.lostFrames = 0;
            handLockTracker.right.lostFrames++;
          }
        }
      }
    } else if (rightLocked && !leftLocked) {
      let bestRightIdx = -1;
      let minRightDist = MAX_HAND_ASSOCIATION_DIST * 1.5;
      activeCandidates.forEach((c, idx) => {
        const d = Math.hypot(c.screenX - handLockTracker.right.lastX, c.screenY - handLockTracker.right.lastY);
        if (d < minRightDist) {
          minRightDist = d;
          bestRightIdx = idx;
        }
      });

      if (bestRightIdx !== -1) {
        const cRight = activeCandidates[bestRightIdx];
        rightHand = { landmarks: cRight.landmarks, handedness: cRight.handedness };
        handLockTracker.right.lastX = cRight.screenX;
        handLockTracker.right.lastY = cRight.screenY;
        handLockTracker.right.lostFrames = 0;

        const otherCand = activeCandidates.find((_, idx) => idx !== bestRightIdx);
        if (otherCand) {
          leftHand = { landmarks: otherCand.landmarks, handedness: otherCand.handedness };
          handLockTracker.left.isLocked = true;
          handLockTracker.left.lastX = otherCand.screenX;
          handLockTracker.left.lastY = otherCand.screenY;
          handLockTracker.left.lostFrames = 0;
        }
      } else {
        handLockTracker.right.lostFrames++;
      }
    } else if (leftLocked && !rightLocked) {
      let bestLeftIdx = -1;
      let minLeftDist = MAX_HAND_ASSOCIATION_DIST * 1.5;
      activeCandidates.forEach((c, idx) => {
        const d = Math.hypot(c.screenX - handLockTracker.left.lastX, c.screenY - handLockTracker.left.lastY);
        if (d < minLeftDist) {
          minLeftDist = d;
          bestLeftIdx = idx;
        }
      });

      if (bestLeftIdx !== -1) {
        const cLeft = activeCandidates[bestLeftIdx];
        leftHand = { landmarks: cLeft.landmarks, handedness: cLeft.handedness };
        handLockTracker.left.lastX = cLeft.screenX;
        handLockTracker.left.lastY = cLeft.screenY;
        handLockTracker.left.lostFrames = 0;

        const otherCand = activeCandidates.find((_, idx) => idx !== bestLeftIdx);
        if (otherCand) {
          rightHand = { landmarks: otherCand.landmarks, handedness: otherCand.handedness };
          handLockTracker.right.isLocked = true;
          handLockTracker.right.lastX = otherCand.screenX;
          handLockTracker.right.lastY = otherCand.screenY;
          handLockTracker.right.lostFrames = 0;
        }
      } else {
        handLockTracker.left.lostFrames++;
      }
    } else {
      // Neither hand locked: INITIAL CONNECTION
      if (activeCandidates.length === 2) {
        const [cA, cB] = activeCandidates;
        const [cLeft, cRight] = (cA.screenX < cB.screenX) ? [cA, cB] : [cB, cA];

        leftHand = { landmarks: cLeft.landmarks, handedness: cLeft.handedness };
        rightHand = { landmarks: cRight.landmarks, handedness: cRight.handedness };

        handLockTracker.left.isLocked = true;
        handLockTracker.left.lastX = cLeft.screenX;
        handLockTracker.left.lastY = cLeft.screenY;
        handLockTracker.left.lostFrames = 0;

        handLockTracker.right.isLocked = true;
        handLockTracker.right.lastX = cRight.screenX;
        handLockTracker.right.lastY = cRight.screenY;
        handLockTracker.right.lostFrames = 0;
      } else if (activeCandidates.length === 1) {
        const c = activeCandidates[0];
        const label = c.handedness ? c.handedness.label : null;
        let isLeft = false;
        if (label) {
          isLeft = isMirror ? (label === 'Right') : (label === 'Left');
        } else {
          isLeft = c.screenX < 0.48;
        }

        if (isLeft) {
          leftHand = { landmarks: c.landmarks, handedness: c.handedness };
          handLockTracker.left.isLocked = true;
          handLockTracker.left.lastX = c.screenX;
          handLockTracker.left.lastY = c.screenY;
          handLockTracker.left.lostFrames = 0;
        } else {
          rightHand = { landmarks: c.landmarks, handedness: c.handedness };
          handLockTracker.right.isLocked = true;
          handLockTracker.right.lastX = c.screenX;
          handLockTracker.right.lastY = c.screenY;
          handLockTracker.right.lostFrames = 0;
        }
      }
    }

    // Check timeout for lost locked hands
    if (handLockTracker.left.lostFrames > MAX_LOST_FRAMES_TOLERANCE) {
      handLockTracker.left.isLocked = false;
      handLockTracker.left.lastX = null;
      handLockTracker.left.lastY = null;
      handLockTracker.left.lostFrames = 0;
    }
    if (handLockTracker.right.lostFrames > MAX_LOST_FRAMES_TOLERANCE) {
      handLockTracker.right.isLocked = false;
      handLockTracker.right.lastX = null;
      handLockTracker.right.lastY = null;
      handLockTracker.right.lostFrames = 0;
    }

    return { leftHand, rightHand };
  }

  /**
   * Landmark Smoothing using Exponential Moving Average (Section 5)
   */
  function smoothHandLandmarks(rawLandmarks, side) {
    if (!rawLandmarks || rawLandmarks.length < 21) return rawLandmarks;
    let alpha = 0.35;
    if (gameStateData.settings.smoothing === 'low') alpha = 0.55;
    else if (gameStateData.settings.smoothing === 'high') alpha = 0.20;

    const prev = side === 'LEFT' ? previousLeftSmoothedLandmarks : previousRightSmoothedLandmarks;
    if (!prev || prev.length !== 21) {
      const init = rawLandmarks.map(p => ({ x: p.x, y: p.y, z: p.z || 0 }));
      if (side === 'LEFT') previousLeftSmoothedLandmarks = init;
      else previousRightSmoothedLandmarks = init;
      return init;
    }

    const smoothed = [];
    for (let i = 0; i < 21; i++) {
      const p = prev[i];
      const c = rawLandmarks[i];
      const sx = p.x * (1 - alpha) + c.x * alpha;
      const sy = p.y * (1 - alpha) + c.y * alpha;
      const sz = (p.z || 0) * (1 - alpha) + (c.z || 0) * alpha;
      smoothed.push({ x: sx, y: sy, z: sz });
    }

    if (side === 'LEFT') previousLeftSmoothedLandmarks = smoothed;
    else previousRightSmoothedLandmarks = smoothed;
    return smoothed;
  }

  function smoothLandmarks(rawLandmarks) {
    return smoothHandLandmarks(rawLandmarks, 'LEFT');
  }

  /**
   * RIGHT HAND: MOVEMENT ONLY
   * Evaluates index finger pointing direction (👈 LEFT, 👉 RIGHT, ☝️ UP, 👇 DOWN)
   * Open or neutral hand ✋ -> NONE (stops movement)
   * RIGHT HAND NEVER ATTACKS!
   */
  function detectRightHandMovement(landmarks) {
    if (!landmarks || landmarks.length < 21) return 'NONE';
    const pointDir = detectPointDirection(landmarks);
    if (pointDir) {
      return pointDir;
    }
    return 'NONE';
  }

  // Alias for backward compatibility
  const detectLeftHandMovement = detectRightHandMovement;

  /**
   * LEFT HAND: ATTACK & DUAL-HAND ACTION
   * Evaluates closed fist ✊ -> ATTACK
   * Evaluates pointing ☝️ -> UP (Jump) or directional action
   * Open or relaxed hand ✋ -> READY / NONE
   */
  function detectLeftHandAttack(landmarks) {
    if (!landmarks || landmarks.length < 21) return 'NONE';
    if (isFist(landmarks)) {
      return 'ATTACK';
    }
    const pointDir = detectPointDirection(landmarks);
    if (pointDir === 'UP' || pointDir === 'UP_RIGHT' || pointDir === 'UP_LEFT') {
      return 'UP';
    } else if (pointDir) {
      return pointDir;
    }
    return 'READY';
  }

  // Alias for backward compatibility
  const detectRightHandAttack = detectLeftHandAttack;

  /**
   * 4. detectHandGesture(landmarks) - Single hand compatibility
   */
  function detectHandGesture(landmarks) {
    if (!landmarks || landmarks.length < 21) return 'NONE';
    if (isFist(landmarks)) return 'ATTACK';
    const pointDir = detectPointDirection(landmarks);
    if (pointDir) return pointDir;
    return 'NONE';
  }

  /**
   * 8. getGestureConfidence(gesture, landmarks)
   * Returns a normalized confidence score (0.0 to 1.0)
   */
  function getGestureConfidence(gesture, landmarks) {
    if (!landmarks || landmarks.length < 21 || gesture === 'NONE') return 0;

    if (gesture === 'ATTACK') {
      const wrist = landmarks[0];
      let score = 0;
      const tips = [8, 12, 16, 20];
      const mcps = [5, 9, 13, 17];
      for (let i = 0; i < 4; i++) {
        const tipDist = Math.hypot(landmarks[tips[i]].x - wrist.x, landmarks[tips[i]].y - wrist.y);
        const mcpDist = Math.hypot(landmarks[mcps[i]].x - wrist.x, landmarks[mcps[i]].y - wrist.y);
        if (tipDist < mcpDist) score += 0.25;
        else if (tipDist < mcpDist * 1.15) score += 0.18;
      }
      return Math.min(0.99, Math.max(0.65, score));
    }

    // For directional gestures: axis dominance ratio
    const isMirror = gameStateData.settings.mirrorCamera;
    const tipX = isMirror ? (1 - landmarks[8].x) : landmarks[8].x;
    const mcpX = isMirror ? (1 - landmarks[5].x) : landmarks[5].x;
    const dx = Math.abs(tipX - mcpX);
    const dy = Math.abs(landmarks[8].y - landmarks[5].y);

    let ratio = 1;
    if (gesture === 'LEFT' || gesture === 'RIGHT') {
      ratio = dx / (dy + 0.001);
    } else if (gesture === 'UP' || gesture === 'DOWN') {
      ratio = dy / (dx + 0.001);
    }
    const conf = Math.min(0.99, Math.max(0.60, 0.55 + (ratio * 0.15)));
    return Math.round(conf * 100) / 100;
  }

  /**
   * Simultaneously processes LEFT HAND attack and RIGHT HAND movement
   * Enforces 500ms attack cooldown on left-hand fist and continuous hold on right-hand move
   */
  function handleTwoHandGestures(rawLeft, rawRight) {
    const now = performance.now();

    // 1. LEFT HAND DEBOUNCE (Attack)
    if (rawLeft !== leftCandidateGesture) {
      leftCandidateGesture = rawLeft;
      leftCandidateStartTime = now;
    }
    if (now - leftCandidateStartTime >= 60) {
      leftConfirmedGesture = leftCandidateGesture;
    }

    // 2. RIGHT HAND DEBOUNCE (Movement)
    if (rawRight !== rightCandidateGesture) {
      rightCandidateGesture = rawRight;
      rightCandidateStartTime = now;
    }
    const moveDebounceLimit = rightCandidateGesture === 'UP' ? 30 : GESTURE_DEBOUNCE_MS;
    if (now - rightCandidateStartTime >= moveDebounceLimit) {
      rightConfirmedGesture = rightCandidateGesture;
    }

    // Compatibility alias
    confirmedActiveGesture = rightConfirmedGesture !== 'NONE' ? rightConfirmedGesture : leftConfirmedGesture;

    // 3. EXECUTE ACTIONS SIMULTANEOUSLY ON GAME ENGINE
    if (currentGameInstance && currentGameInstance.state === 'PLAYING') {
      // --- RIGHT HAND MOVEMENT & DIAGONAL ACTIONS EXECUTION ---
      if (rightConfirmedGesture === 'LEFT') {
        movePlayerLeft();
      } else if (rightConfirmedGesture === 'RIGHT') {
        movePlayerRight();
      } else if (rightConfirmedGesture === 'UP_RIGHT') {
        movePlayerRight();
        movePlayerUp();
      } else if (rightConfirmedGesture === 'UP_LEFT') {
        movePlayerLeft();
        movePlayerUp();
      } else if (rightConfirmedGesture === 'DOWN_RIGHT') {
        movePlayerRight();
        movePlayerDown();
      } else if (rightConfirmedGesture === 'DOWN_LEFT') {
        movePlayerLeft();
        movePlayerDown();
      } else if (rightConfirmedGesture === 'UP') {
        movePlayerUp();
      } else if (rightConfirmedGesture === 'DOWN') {
        movePlayerDown();
      } else {
        // 'NONE' or open hand neutral -> Stop player movement only if keyboard/touch is not active
        if (activeKeys.size === 0 && touchMoveDirection === null) {
          stopPlayer();
        }
      }

      // --- LEFT HAND ATTACK OR DUAL-HAND SECONDARY ACTION EXECUTION (SIMULTANEOUS!) ---
      if (leftConfirmedGesture === 'ATTACK') {
        // Enforce 500ms cooldown + 1 punch per fist
        if (!attackLocked && !leftFistHeld && (now - lastLeftAttackTime >= ATTACK_COOLDOWN_MS)) {
          leftFistHeld = true;
          rightFistHeld = true; // backward-compatibility alias
          lastLeftAttackTime = now;
          lastRightAttackTime = now; // backward-compatibility alias
          triggerAttack(); // Calls the SAME triggerAttack() as the button!
        }
      } else if (leftConfirmedGesture === 'UP') {
        // Dual-hand: Left hand pointing UP triggers Jump simultaneously with Right hand movement!
        movePlayerUp();
        leftFistHeld = false;
        rightFistHeld = false;
      } else {
        // Fist released / hand opened -> allow next punch
        leftFistHeld = false;
        rightFistHeld = false;
      }
    }
  }

  /**
   * 10. handleGesture(gesture) - Backward compatibility router
   */
  function handleGesture(gesture) {
    if (gesture === 'ATTACK') {
      handleTwoHandGestures('ATTACK', 'NONE');
    } else {
      handleTwoHandGestures('NONE', gesture);
    }
    updateTwoHandUIFeedback();
  }

  /**
   * 11. movePlayerLeft()
   * Moves player left smoothly at controlled PLAYER_SPEED = 4 (Section 16)
   */
  function movePlayerLeft() {
    if (!currentGameInstance || !currentGameInstance.player || !currentGameInstance.player.isAlive) return;
    const p = currentGameInstance.player;
    currentGameInstance.hasGameplayStarted = true;
    p.facing = -1;
    p.vx = -PLAYER_SPEED;
    if (p.isGrounded && p.state !== 'attack') {
      p.state = 'walk';
    }
  }

  /**
   * 12. movePlayerRight()
   * Moves player right smoothly at controlled PLAYER_SPEED = 4 (Section 16)
   */
  function movePlayerRight() {
    if (!currentGameInstance || !currentGameInstance.player || !currentGameInstance.player.isAlive) return;
    const p = currentGameInstance.player;
    currentGameInstance.hasGameplayStarted = true;
    p.facing = 1;
    p.vx = PLAYER_SPEED;
    if (p.isGrounded && p.state !== 'attack') {
      p.state = 'walk';
    }
  }

  /**
   * 13. movePlayerUp()
   * Character jumps / moves up depending on physics (Section 2 & 16)
   */
  function movePlayerUp() {
    if (!currentGameInstance || !currentGameInstance.player || !currentGameInstance.player.isAlive) return;
    const p = currentGameInstance.player;
    currentGameInstance.hasGameplayStarted = true;
    if (p.isGrounded) {
      p.vy = -JUMP_FORCE;
      p.isGrounded = false;
      p.jumpBuffer = 0;
      sound.playJump();
      currentGameInstance.addDustPuff(p.x, p.y + p.height / 2);
    } else {
      p.jumpBuffer = 0.20; // 200ms jump buffer for multi-key fluid jumps
    }
  }

  /**
   * 14. movePlayerDown()
   * Fast crouch / descent (Section 2 & 16)
   */
  function movePlayerDown() {
    if (!currentGameInstance || !currentGameInstance.player || !currentGameInstance.player.isAlive) return;
    const p = currentGameInstance.player;
    currentGameInstance.hasGameplayStarted = true;
    p.vx *= 0.6;
    if (!p.isGrounded) {
      p.vy += 1.8;
    }
  }

  /**
   * 15. stopPlayer()
   * Stops player movement smoothly upon neutral hand or release (Section 18)
   */
  function stopPlayer() {
    if (!currentGameInstance || !currentGameInstance.player || !currentGameInstance.player.isAlive) return;
    if (activeKeys.size > 0 || touchMoveDirection !== null) return;
    const p = currentGameInstance.player;
    p.vx = 0;
    if (p.isGrounded && p.state !== 'attack') {
      p.state = 'idle';
    }
  }

  /**
   * Helper router for keyboard and touch compatibility
   */
  function movePlayer(direction) {
    if (direction === 'LEFT') movePlayerLeft();
    else if (direction === 'RIGHT') movePlayerRight();
    else if (direction === 'UP') movePlayerUp();
    else if (direction === 'DOWN') movePlayerDown();
    else stopPlayer();
  }

  /**
   * 16. triggerAttack()
   * Unified attack function called by BOTH the Attack button AND camera ✊ fist (Sections 7, 8, 9, 10, 12)
   */
  function triggerAttack() {
    if (attackLocked) return;
    attackLocked = true;

    // Visual feedback on the persistent Attack Button (Section 10)
    updateAttackButton(true);

    // Execute in Game Engine
    if (currentGameInstance && currentGameInstance.player && currentGameInstance.player.isAlive) {
      const p = currentGameInstance.player;
      currentGameInstance.hasGameplayStarted = true;
      p.state = 'attack';
      p.attackType = 'fist_blade';
      p.attackTimer = 0.24;

      currentGameInstance.screenShake = 6;
      sound.playAttack('heavy');
      currentGameInstance.addSlashEffect(p.x, p.y, p.facing);

      if (attackBannerFx) {
        attackBannerFx.textContent = '⚔ ATTACK!';
        attackBannerFx.classList.add('show');
        setTimeout(() => {
          if (attackBannerFx) attackBannerFx.classList.remove('show');
        }, 320);
      }

      // Check enemies in attack range (Section 11)
      checkAttackRange();
    }

    // Release attack lock after 500ms cooldown (Section 12)
    setTimeout(() => {
      attackLocked = false;
    }, attackCooldown);
  }

  /**
   * 17. checkAttackRange()
   * Checks enemies near player when attack triggers (Section 11)
   */
  function checkAttackRange() {
    if (!currentGameInstance || !currentGameInstance.player || !currentGameInstance.currentLevel) return false;
    const p = currentGameInstance.player;
    const level = currentGameInstance.currentLevel;

    const ATTACK_RANGE_X = 54;
    const ATTACK_RANGE_Y = 38;
    const slashHitbox = {
      x: p.x + (p.facing * ATTACK_RANGE_X * 0.5),
      y: p.y,
      width: ATTACK_RANGE_X,
      height: ATTACK_RANGE_Y
    };

    let hitAnyEnemy = false;

    // Check enemies in level
    for (let i = level.enemies.length - 1; i >= 0; i--) {
      const enemy = level.enemies[i];
      if (!enemy.isAlive) continue;

      if (currentGameInstance.checkAABB(slashHitbox, enemy)) {
        hitAnyEnemy = true;
        enemy.health = (enemy.health || 1) - 1;
        currentGameInstance.addSlashEffect(enemy.x, enemy.y, p.facing);
        if (enemy.health <= 0) {
          enemy.isAlive = false;
          currentGameInstance.addExplosion(enemy.x, enemy.y, '#ff007f', 28);
          sound.playEnemyDefeat();
        } else {
          sound.playAttack('swift');
        }
      }
    }

    // Check breakable target blocks in level
    if (level.targetBlocks) {
      for (let i = level.targetBlocks.length - 1; i >= 0; i--) {
        const tb = level.targetBlocks[i];
        if (tb.isDestroyed) continue;
        if (currentGameInstance.checkAABB(slashHitbox, tb)) {
          tb.isDestroyed = true;
          currentGameInstance.addExplosion(tb.x, tb.y, '#00f0ff', 30);
          sound.playEnemyDefeat();
          currentGameInstance.screenShake = 6;
        }
      }
    }

    return hitAnyEnemy;
  }

  /**
   * 18. updateAttackButton(isAttacking)
   * Visual feedback on the persistent Attack Button (Section 10)
   */
  function updateAttackButton(isAttacking) {
    const btn = document.getElementById('btn-master-attack');
    const label = document.getElementById('attack-btn-label');
    if (!btn) return;

    if (isAttacking) {
      btn.classList.add('triggered');
      if (label) label.textContent = 'ATTACK!';
      if (attackCooldownFill && attackCooldownFill.style) {
        attackCooldownFill.style.transition = 'none';
        attackCooldownFill.style.width = '0%';
        setTimeout(() => {
          if (attackCooldownFill && attackCooldownFill.style) {
            attackCooldownFill.style.transition = `width ${attackCooldown}ms linear`;
            attackCooldownFill.style.width = '100%';
          }
        }, 15);
      }
      setTimeout(() => {
        updateAttackButton(false);
      }, 350);
    } else {
      btn.classList.remove('triggered');
      if (label) label.textContent = 'ATTACK';
    }
  }

  /**
   * 19. failLevel(reason)
   * Attempt + 1 and resets current level (Strictly NO HP / Hearts) (Section 19)
   */
  function failLevel(reason = 'obstacle') {
    if (currentGameInstance) {
      currentGameInstance.failLevel(reason);
    }
  }

  /**
   * 20. completeLevel()
   * Records best attempt and completes level (Section 19)
   */
  function completeLevel() {
    if (currentGameInstance) {
      currentGameInstance.completeLevel();
    }
  }

  /**
   * 21. restartLevel(confirmed)
   * Restarts current level attempt
   */
  function restartLevel(confirmed = false) {
    if (currentGameInstance) {
      currentGameInstance.restartLevel(confirmed);
    }
  }

  /**
   * 22. nextLevel()
   * Advances to the next level (1 to 20)
   */
  function nextLevel() {
    if (!currentGameInstance) return;
    const nextId = Math.min(20, currentGameInstance.currentLevelId + 1);
    currentGameInstance.startLevel(nextId);
  }

  /**
   * Updates HUD on-screen gesture indicator, gesture guide, and camera preview footer (Sections 6, 14, 15)
   */
  function updateGestureUIFeedback(activeGesture, confidence = null, vector = null) {
    const emoji = gestureEmojiMap[activeGesture] || '✋';
    const name = activeGesture || 'NONE';
    const confVal = confidence !== null ? confidence : (lastGestureConfidence || 0);

    // On-Screen Gesture Indicator HUD (Section 6)
    if (hudGestureEmoji) hudGestureEmoji.textContent = emoji;
    if (hudGestureName) hudGestureName.textContent = name;
    if (hudConfidencePill) hudConfidencePill.textContent = `CONF: ${Math.round(confVal * 100)}%`;

    // Update Two-Hand UI Feedback
    updateTwoHandUIFeedback(vector);
  }

  /**
   * Updates HUD on-screen gesture indicator, gesture guide, and camera preview footer for TWO HANDS
   */
  function updateTwoHandUIFeedback(rightVec = null) {
    // 1. TOP HUD (DUAL HAND STATUS)
    const isLeftAtk = leftConfirmedGesture === 'ATTACK';
    if (hudLeftEmoji) hudLeftEmoji.textContent = isLeftAtk ? '✊' : '✋';
    if (hudLeftName) hudLeftName.textContent = isLeftAtk ? 'ATTACK' : (leftHandDetected ? 'READY' : 'NONE');

    if (hudRightEmoji) hudRightEmoji.textContent = gestureEmojiMap[rightConfirmedGesture] || '✋';
    if (hudRightName) hudRightName.textContent = rightConfirmedGesture;

    if (hudConfidencePill) hudConfidencePill.textContent = `HANDS: ${detectedHandsCount}/2`;

    // Single-hand observer compatibility
    if (hudGestureEmoji) hudGestureEmoji.textContent = gestureEmojiMap[rightConfirmedGesture] || (isLeftAtk ? '✊' : '✋');
    if (hudGestureName) hudGestureName.textContent = rightConfirmedGesture !== 'NONE' ? rightConfirmedGesture : (isLeftAtk ? 'ATTACK' : 'NONE');

    // 2. GESTURE GUIDE PANEL (TWO-HAND CONTROL, STOP POINT REMOVED)
    const guideUp = document.getElementById('guide-cell-up');
    const guideLeft = document.getElementById('guide-cell-left');
    const guideRight = document.getElementById('guide-cell-right');
    const guideDown = document.getElementById('guide-cell-down');
    const guideAttack = document.getElementById('guide-cell-attack');
    const guideNone = document.getElementById('guide-cell-none');

    const isUp = rightConfirmedGesture === 'UP' || rightConfirmedGesture === 'UP_RIGHT' || rightConfirmedGesture === 'UP_LEFT' || leftConfirmedGesture === 'UP';
    const isLeft = rightConfirmedGesture === 'LEFT' || rightConfirmedGesture === 'UP_LEFT' || rightConfirmedGesture === 'DOWN_LEFT';
    const isRight = rightConfirmedGesture === 'RIGHT' || rightConfirmedGesture === 'UP_RIGHT' || rightConfirmedGesture === 'DOWN_RIGHT';
    const isDown = rightConfirmedGesture === 'DOWN' || rightConfirmedGesture === 'DOWN_LEFT' || rightConfirmedGesture === 'DOWN_RIGHT';

    if (guideUp) guideUp.classList.toggle('active', isUp);
    if (guideLeft) guideLeft.classList.toggle('active', isLeft);
    if (guideRight) guideRight.classList.toggle('active', isRight);
    if (guideDown) guideDown.classList.toggle('active', isDown);
    if (guideAttack) guideAttack.classList.toggle('active', isLeftAtk);
    if (guideNone) guideNone.classList.remove('active'); // Stop point removed / kept inactive

    // 3. CAMERA PREVIEW FOOTER & BADGES
    if (camFeedbackLeft) {
      const lEmoji = isLeftAtk ? '✊' : '✋';
      const lName = isLeftAtk ? 'ATTACK' : (leftHandDetected ? 'READY' : 'NONE');
      camFeedbackLeft.textContent = `L (ATK): ${lEmoji} ${lName}`;
    }
    if (camFeedbackRight) {
      const rEmoji = gestureEmojiMap[rightConfirmedGesture] || '✋';
      camFeedbackRight.textContent = `R (MOVE): ${rEmoji} ${rightConfirmedGesture}`;
    }

    if (camFeedbackStatus) {
      if (detectedHandsCount === 2) camFeedbackStatus.textContent = 'STATUS: 2 HANDS LOCKED & ACTIVE';
      else if (detectedHandsCount === 1) camFeedbackStatus.textContent = rightHandDetected ? 'STATUS: RIGHT HAND LOCKED (MOVE)' : 'STATUS: LEFT HAND LOCKED (ATK)';
      else camFeedbackStatus.textContent = isCameraActive ? 'STATUS: SEARCHING' : 'STATUS: CAMERA OFF';
    }

    if (camTrackingBadge) {
      if (detectedHandsCount > 0) {
        camTrackingBadge.textContent = detectedHandsCount === 2 ? '2 HANDS LOCKED' : (rightHandDetected ? 'R HAND LOCKED' : 'L HAND LOCKED');
        camTrackingBadge.className = 'cam-badge badge-active';
      } else {
        camTrackingBadge.textContent = isCameraActive ? 'SEARCHING' : 'OFF';
        camTrackingBadge.className = isCameraActive ? 'cam-badge badge-searching' : 'cam-badge badge-lost';
      }
    }

    // 4. RETICLES ON CAMERA PREVIEW
    const isMirror = gameStateData.settings.mirrorCamera !== false;
    if (camHandReticleLeft) {
      if (leftHandDetected && previousLeftSmoothedLandmarks) {
        camHandReticleLeft.classList.remove('hidden');
        const pX = previousLeftSmoothedLandmarks[9].x;
        const pY = previousLeftSmoothedLandmarks[9].y;
        camHandReticleLeft.style.left = `${(isMirror ? (1 - pX) : pX) * 100}%`;
        camHandReticleLeft.style.top = `${pY * 100}%`;
        camHandReticleLeft.textContent = isLeftAtk ? '✊' : '✋';
      } else {
        camHandReticleLeft.classList.add('hidden');
      }
    }

    if (camHandReticleRight) {
      if (rightHandDetected && previousRightSmoothedLandmarks) {
        camHandReticleRight.classList.remove('hidden');
        const pX = previousRightSmoothedLandmarks[9].x;
        const pY = previousRightSmoothedLandmarks[9].y;
        camHandReticleRight.style.left = `${(isMirror ? (1 - pX) : pX) * 100}%`;
        camHandReticleRight.style.top = `${pY * 100}%`;
        camHandReticleRight.textContent = gestureEmojiMap[rightConfirmedGesture] || '✋';
      } else {
        camHandReticleRight.classList.add('hidden');
      }
    }
  }

  /**
   * MediaPipe Hands Callback handler - Supports TWO HANDS simultaneously
   */
  function handleMediaPipeResults(results) {
    const isMirror = gameStateData.settings.mirrorCamera !== false;

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      classifyTwoHands([], [], isMirror);
      detectedHandsCount = 0;
      leftHandDetected = false;
      rightHandDetected = false;
      handDetected = false;
      leftDetectedGesture = 'NONE';
      rightDetectedGesture = 'NONE';
      previousLeftSmoothedLandmarks = null;
      previousRightSmoothedLandmarks = null;
      previousSmoothedLandmarks = null;

      if (overlayCtx && overlayCanvas) {
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
      handleTwoHandGestures('NONE', 'NONE');
      updateTwoHandUIFeedback();
      return;
    }

    const { leftHand, rightHand } = classifyTwoHands(
      results.multiHandLandmarks,
      results.multiHandedness,
      isMirror
    );

    detectedHandsCount = Math.min(2, (leftHand ? 1 : 0) + (rightHand ? 1 : 0));
    handDetected = detectedHandsCount > 0;

    if (detectedHandsCount === 0) {
      leftHandDetected = false;
      rightHandDetected = false;
      handDetected = false;
      leftDetectedGesture = 'NONE';
      rightDetectedGesture = 'NONE';
      previousLeftSmoothedLandmarks = null;
      previousRightSmoothedLandmarks = null;
      previousSmoothedLandmarks = null;

      if (overlayCtx && overlayCanvas) {
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
      handleTwoHandGestures('NONE', 'NONE');
      updateTwoHandUIFeedback();
      return;
    }

    // --- PROCESS LEFT HAND (ATTACK ONLY) ---
    let rawLeft = 'NONE';
    let smoothedLeft = null;
    if (leftHand) {
      leftHandDetected = true;
      smoothedLeft = smoothHandLandmarks(leftHand.landmarks, 'LEFT');
      rawLeft = detectLeftHandAttack(smoothedLeft);
      leftDetectedGesture = rawLeft;
      leftConfidence = isFist(smoothedLeft) ? 0.95 : 0.70;
    } else {
      leftHandDetected = false;
      leftDetectedGesture = 'NONE';
      previousLeftSmoothedLandmarks = null;
      leftConfidence = 0;
    }

    // --- PROCESS RIGHT HAND (MOVEMENT ONLY) ---
    let rawRight = 'NONE';
    let smoothedRight = null;
    let rightVec = null;
    if (rightHand) {
      rightHandDetected = true;
      smoothedRight = smoothHandLandmarks(rightHand.landmarks, 'RIGHT');
      rawRight = detectRightHandMovement(smoothedRight);
      rightDetectedGesture = rawRight;
      rightConfidence = getGestureConfidence(rawRight, smoothedRight);

      const tipX = isMirror ? (1 - smoothedRight[8].x) : smoothedRight[8].x;
      const mcpX = isMirror ? (1 - smoothedRight[5].x) : smoothedRight[5].x;
      rightVec = { dx: tipX - mcpX, dy: smoothedRight[8].y - smoothedRight[5].y };
    } else {
      rightHandDetected = false;
      rightDetectedGesture = 'NONE';
      previousRightSmoothedLandmarks = null;
      rightConfidence = 0;
    }

    // Single Hand Multi-Action Capability:
    // If only 1 hand is present in camera, let it do BOTH Attack (fist) and Movement/Jump (pointing)!
    if (detectedHandsCount === 1) {
      const activeHand = smoothedRight || smoothedLeft;
      if (activeHand && isFist(activeHand)) {
        rawLeft = 'ATTACK';
        rawRight = 'NONE';
      } else if (activeHand) {
        rawLeft = 'NONE';
        rawRight = detectRightHandMovement(activeHand);
      }
    }

    // Backward-compatibility aliases
    previousSmoothedLandmarks = smoothedRight || smoothedLeft;
    currentDetectedGesture = rawRight !== 'NONE' ? rawRight : rawLeft;

    // --- DRAW BOTH HANDS ON CAMERA OVERLAY ---
    drawTwoHandsOnOverlay(smoothedLeft, rawLeft, smoothedRight, rawRight, rightVec);

    // --- APPLY SIMULTANEOUS GESTURES TO PLAYER ---
    handleTwoHandGestures(rawLeft, rawRight);

    // --- UPDATE UI FEEDBACK ---
    updateTwoHandUIFeedback(rightVec);
  }

  /**
   * Draws 21-landmark glowing skeleton and text labels for BOTH hands on overlay canvas
   */
  function drawTwoHandsOnOverlay(smoothedLeft, leftGesture, smoothedRight, rightGesture, rightVec = null) {
    if (!overlayCtx || !overlayCanvas) return;
    const w = overlayCanvas.width;
    const h = overlayCanvas.height;
    overlayCtx.clearRect(0, 0, w, h);

    const isMirror = gameStateData.settings.mirrorCamera !== false;
    const toScreen = (lm) => ({
      x: (isMirror ? (1 - lm.x) : lm.x) * w,
      y: lm.y * h
    });

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],       // Index
      [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
      [0, 13], [13, 14], [14, 15], [15, 16],// Ring
      [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
      [5, 9], [9, 13], [13, 17]             // Palm base
    ];

    function renderHand(landmarks, colorPrimary, colorGlow, labelText, isMovementHand) {
      overlayCtx.save();

      // Cyber Bones
      overlayCtx.lineWidth = 2.5;
      for (const [i1, i2] of connections) {
        const p1 = toScreen(landmarks[i1]);
        const p2 = toScreen(landmarks[i2]);
        overlayCtx.strokeStyle = colorGlow;
        overlayCtx.beginPath();
        overlayCtx.moveTo(p1.x, p1.y);
        overlayCtx.lineTo(p2.x, p2.y);
        overlayCtx.stroke();
      }

      // Joint Nodes
      for (let i = 0; i < landmarks.length; i++) {
        const p = toScreen(landmarks[i]);
        const isTip = (i === 4 || i === 8 || i === 12 || i === 16 || i === 20);
        overlayCtx.fillStyle = isTip ? '#ffffff' : colorPrimary;
        overlayCtx.beginPath();
        overlayCtx.arc(p.x, p.y, isTip ? 3.5 : 2, 0, Math.PI * 2);
        overlayCtx.fill();
      }

      // Index Finger Vector Arrow for Right Hand (Movement)
      if (isMovementHand && landmarks[5] && landmarks[8]) {
        const pMcp = toScreen(landmarks[5]);
        const pTip = toScreen(landmarks[8]);
        overlayCtx.strokeStyle = '#00f0ff';
        overlayCtx.lineWidth = 3;
        overlayCtx.beginPath();
        overlayCtx.moveTo(pMcp.x, pMcp.y);
        overlayCtx.lineTo(pTip.x, pTip.y);
        overlayCtx.stroke();

        overlayCtx.strokeStyle = '#ffffff';
        overlayCtx.lineWidth = 1.5;
        overlayCtx.beginPath();
        overlayCtx.arc(pTip.x, pTip.y, 8, 0, Math.PI * 2);
        overlayCtx.stroke();
      }

      // Clear text label above wrist (Landmark 0)
      if (landmarks[0]) {
        const pWrist = toScreen(landmarks[0]);
        overlayCtx.font = 'bold 9px monospace';
        overlayCtx.fillStyle = '#ffffff';
        overlayCtx.shadowColor = colorPrimary;
        overlayCtx.shadowBlur = 6;
        overlayCtx.fillText(labelText, Math.max(6, pWrist.x - 40), Math.max(14, pWrist.y - 12));
      }

      overlayCtx.restore();
    }

    if (smoothedLeft) {
      const isAtk = leftGesture === 'ATTACK';
      const leftName = isAtk ? '✊ ATTACK' : '✋ READY';
      renderHand(
        smoothedLeft,
        isAtk ? '#ff007f' : '#ffaa00',
        isAtk ? 'rgba(255, 0, 127, 0.8)' : 'rgba(255, 170, 0, 0.7)',
        `LEFT (LOCKED): ${leftName}`,
        false
      );
    }

    if (smoothedRight) {
      const rightName = rightGesture === 'NONE' ? 'NEUTRAL' : rightGesture;
      renderHand(
        smoothedRight,
        '#00f0ff',
        'rgba(0, 240, 255, 0.75)',
        `RIGHT (LOCKED): ${rightName}`,
        true
      );
    }
  }

  function drawHandLandmarks(landmarks, isFistGesture, dx = 0, dy = 0) {
    drawTwoHandsOnOverlay(isFistGesture ? landmarks : null, isFistGesture ? 'ATTACK' : 'READY', !isFistGesture ? landmarks : null, !isFistGesture ? 'RIGHT' : 'NONE', null);
  }

  /**
   * Native Computer Vision fallback if CDN is offline
   * Separates left screen half (Attack) and right screen half (Movement)
   */
  function processNativeCVFrame() {
    if (!videoEl || videoEl.videoWidth === 0) return;

    const w = cvCanvas.width;
    const h = cvCanvas.height;
    cvCtx.drawImage(videoEl, 0, 0, w, h);
    const frame = cvCtx.getImageData(0, 0, w, h);
    const data = frame.data;

    let leftCount = 0, leftSumX = 0, leftSumY = 0;
    let rightCount = 0, rightSumX = 0, rightSumY = 0;
    const midX = w / 2;

    // STRICT HEAD & FACE EXCLUSION:
    // A seated user's head, face, eyes, neck, and shoulders occupy the upper-center area:
    // Top 62% vertically (py < h * 0.62) and center 60% horizontally (px > w * 0.20 && px < w * 0.80).
    // NEVER detect skin pixels in this zone to completely ignore head/face!
    for (let i = 0; i < data.length; i += 4) {
      const px = (i / 4) % w;
      const py = Math.floor((i / 4) / w);

      // Exclude head and face zone completely
      if (py < h * 0.62 && px > w * 0.20 && px < w * 0.80) {
        continue;
      }

      const r = data[i], g = data[i + 1], b = data[i + 2];
      const isSkin = (r > 95 && g > 40 && b > 20 &&
                      (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
                      Math.abs(r - g) > 15 && r > g && r > b);

      if (isSkin) {
        if (px < midX) {
          leftCount++; leftSumX += px; leftSumY += py;
        } else {
          rightCount++; rightSumX += px; rightSumY += py;
        }
      }
    }

    const isMirror = gameStateData.settings.mirrorCamera !== false;
    let rawLeft = 'NONE';
    let rawRight = 'NONE';

    // In mirrored mode: left half of camera canvas is Left Hand (Attack)
    if (leftCount > 300) {
      leftHandDetected = true;
      rawLeft = (leftCount > 600) ? 'ATTACK' : 'READY';
    } else {
      leftHandDetected = false;
    }

    // Right half of camera canvas is Right Hand (Movement)
    if (rightCount > 300) {
      rightHandDetected = true;
      const cx = ((rightSumX / rightCount) - midX) / midX;
      const cy = (rightSumY / rightCount) / h;
      const dx = cx - 0.5;
      const dy = cy - 0.5;
      if (Math.abs(dx) > Math.abs(dy) * 1.4 && Math.abs(dx) > 0.12) {
        rawRight = dx < 0 ? (isMirror ? 'RIGHT' : 'LEFT') : (isMirror ? 'LEFT' : 'RIGHT');
      } else if (Math.abs(dy) > Math.abs(dx) * 1.4 && Math.abs(dy) > 0.12) {
        rawRight = dy < 0 ? 'UP' : 'DOWN';
      } else if (Math.abs(dx) > 0.08 && Math.abs(dy) > 0.08) {
        const hDir = dx < 0 ? (isMirror ? 'RIGHT' : 'LEFT') : (isMirror ? 'LEFT' : 'RIGHT');
        rawRight = dy < 0 ? (hDir === 'RIGHT' ? 'UP_RIGHT' : 'UP_LEFT') : (hDir === 'RIGHT' ? 'DOWN_RIGHT' : 'DOWN_LEFT');
      }
    } else {
      rightHandDetected = false;
    }

    detectedHandsCount = (leftHandDetected ? 1 : 0) + (rightHandDetected ? 1 : 0);
    handDetected = detectedHandsCount > 0;

    handleTwoHandGestures(rawLeft, rawRight);
    updateTwoHandUIFeedback();
  }

  // =========================================================================
  // 5. COMPREHENSIVE LEVEL THEME REGISTRY (20 INDIVIDUAL REALMS & PALETTES)
  // =========================================================================
  const THEME_REGISTRY = {
    // --- 🏙️ WORLD 1: DIGITAL NIGHT CITY (Levels 1-4) ---
    1: { id: 1, type: 'smart_city', name: 'Neon Awakening', shortName: 'Neon City', icon: '🏙️', themeTitle: 'CYBER METROPOLIS', topColor: '#00f0ff', bodyColor: '#0b1324', bodyGrad: ['#131c30', '#0b1220', '#04070e'] },
    2: { id: 2, type: 'smart_city', name: 'Rooftop Leap', shortName: 'Rooftops', icon: '🌆', themeTitle: 'ROOFTOP SKYLINE', topColor: '#ff007f', bodyColor: '#1a0822', bodyGrad: ['#260c33', '#15051c', '#08020a'] },
    3: { id: 3, type: 'smart_city', name: 'Grid Abyss', shortName: 'Grid Abyss', icon: '⚡', themeTitle: 'SUB-CITY CHASM', topColor: '#00ffcc', bodyColor: '#061a1a', bodyGrad: ['#072426', '#031417', '#01080a'] },
    4: { id: 4, type: 'smart_city', name: 'First Contact', shortName: 'Orbital Port', icon: '🚀', themeTitle: 'ORBITAL SKYPORT', topColor: '#38bdf8', bodyColor: '#0c1228', bodyGrad: ['#141c3b', '#0b0f24', '#040612'] },

    // --- 🌲 WORLD 2: BIOLUMINESCENT NATURE (Levels 5-8) ---
    5: { id: 5, type: 'nature', name: 'Spore Caverns', shortName: 'Spore Caves', icon: '🍄', themeTitle: 'SPORE CAVERNS', topColor: '#00ff88', bodyColor: '#07180f', bodyGrad: ['#0a2416', '#06170e', '#020905'] },
    6: { id: 6, type: 'nature', name: 'Overgrowth Run', shortName: 'Overgrowth', icon: '🌿', themeTitle: 'ANCIENT CANOPY', topColor: '#a3e635', bodyColor: '#0d1c08', bodyGrad: ['#1c3010', '#101d08', '#050c02'] },
    7: { id: 7, type: 'nature', name: 'Swarm Canopy', shortName: 'Swarm Bayou', icon: '🎋', themeTitle: 'TWILIGHT SWAMP', topColor: '#2dd4bf', bodyColor: '#081a18', bodyGrad: ['#0e2926', '#071716', '#020a0a'] },
    8: { id: 8, type: 'nature', name: 'Shifting Moss', shortName: 'Crystal Falls', icon: '💎', themeTitle: 'ENCHANTED FALLS', topColor: '#34d399', bodyColor: '#09211c', bodyGrad: ['#0c2e27', '#051a15', '#010c0a'] },

    // --- 🌋 WORLD 3: UNDERGROUND FACTORY & FOUNDRY (Levels 9-12) ---
    9: { id: 9, type: 'foundry', name: 'Piston Core', shortName: 'Piston Core', icon: '🌋', themeTitle: 'VOLCANIC FOUNDRY', topColor: '#ff3b30', bodyColor: '#240606', bodyGrad: ['#2e0c0c', '#1a0505', '#0a0202'] },
    10: { id: 10, type: 'foundry', name: 'Steam Maze', shortName: 'Steam Maze', icon: '⚙️', themeTitle: 'STEAM FACTORY', topColor: '#f59e0b', bodyColor: '#211306', bodyGrad: ['#2e1b09', '#1a0e04', '#0a0501'] },
    11: { id: 11, type: 'foundry', name: 'Overclock', shortName: 'Overclock', icon: '☢️', themeTitle: 'PLASMA REACTOR', topColor: '#c084fc', bodyColor: '#1d062b', bodyGrad: ['#29093d', '#150421', '#07010d'] },
    12: { id: 12, type: 'foundry', name: 'Conveyor Hazard', shortName: 'Conveyors', icon: '🔥', themeTitle: 'HEAVY SMELTER', topColor: '#ff6b00', bodyColor: '#240d03', bodyGrad: ['#301205', '#1a0902', '#0a0300'] },

    // --- 🌌 WORLD 4: DEEP CYBERSPACE & RETROWAVE (Levels 13-16) ---
    13: { id: 13, type: 'space', name: 'Data Stream', shortName: 'Data Stream', icon: '💾', themeTitle: 'CYBERSPACE VOID', topColor: '#00ff66', bodyColor: '#031c0a', bodyGrad: ['#05260f', '#021607', '#010a03'] },
    14: { id: 14, type: 'space', name: 'Glitch Vector', shortName: 'Glitch Core', icon: '👾', themeTitle: 'GLITCH REALM', topColor: '#f43f5e', bodyColor: '#210414', bodyGrad: ['#2b071b', '#170310', '#0a0106'] },
    15: { id: 15, type: 'space', name: 'Syntax Sprint', shortName: 'Laser Run', icon: '⚡', themeTitle: 'DATA HIGHWAY', topColor: '#06b6d4', bodyColor: '#061724', bodyGrad: ['#082133', '#03131c', '#01080d'] },
    16: { id: 16, type: 'space', name: 'Hyperspace Beat', shortName: 'Synthwave', icon: '🎵', themeTitle: 'SYNTHWAVE NEON', topColor: '#fb7185', bodyColor: '#24061a', bodyGrad: ['#2e0921', '#170311', '#0a0106'] },

    // --- 🏛️ WORLD 5: ANCIENT CELESTIAL RUINS & CHRONO CORE (Levels 17-20) ---
    17: { id: 17, type: 'ruins', name: 'Forgotten Nexus', shortName: 'Starlight Ruins', icon: '🏛️', themeTitle: 'CELESTIAL TEMPLE', topColor: '#818cf8', bodyColor: '#120d29', bodyGrad: ['#191238', '#0e0a24', '#050312'] },
    18: { id: 18, type: 'ruins', name: 'Titan\'s Gate', shortName: 'Titan Gate', icon: '🗿', themeTitle: 'TITAN SANCTUARY', topColor: '#fbbf24', bodyColor: '#1f1404', bodyGrad: ['#291a06', '#170e03', '#0a0600'] },
    19: { id: 19, type: 'ruins', name: 'Chrono Collapse', shortName: 'Black Hole', icon: '⏳', themeTitle: 'TEMPORAL VORTEX', topColor: '#a855f7', bodyColor: '#160524', bodyGrad: ['#210836', '#10031c', '#06010d'] },
    20: { id: 20, type: 'nexus', name: 'The Chrono Core', shortName: 'Chrono Core', icon: '👑', themeTitle: 'QUANTUM SINGULARITY', topColor: '#00f0ff', bodyColor: '#0c162e', bodyGrad: ['#122042', '#071026', '#020512'] }
  };

  function getLevelTheme(levelOrId) {
    const id = (levelOrId && typeof levelOrId === 'object') ? levelOrId.id : (levelOrId || 1);
    return THEME_REGISTRY[id] || THEME_REGISTRY[1];
  }

  // =========================================================================
  // 6. MASTER GAME CONTROLLER & PHYSICS
  // =========================================================================
  class GameEngine {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.avatarCanvas = document.getElementById('avatar-preview-canvas');
      this.avatarCtx = this.avatarCanvas ? this.avatarCanvas.getContext('2d') : null;

      this.currentLevelId = 1;
      this.currentLevel = null;
      this.state = 'MAIN_MENU'; // 'MAIN_MENU' | 'PLAYING' | 'PAUSED' | 'FAILED' | 'COMPLETE'
      this.hasGameplayStarted = false;
      this.animTime = 0;
      this.lastTimestamp = performance.now();
      this.cameraX = 0;
      this.cameraY = 0;
      this.screenShake = 0;

      this.player = null;
      this.particles = [];
      this.shadowGhosts = [];
      this.ghostTimer = 0;
      this.floatingPopups = [];
      this.damageFlashTimer = 0;
      this.maxLives = 3;
      this.lives = 3;
      this.coinsCollected = 0;
      this.totalLevelCoins = 0;
      this.activeCheckpoint = null;

      this.setupResize();
    }

    setupResize() {
      const resize = () => {
        const container = document.getElementById('game-area-container');
        this.canvas.width = container.clientWidth || window.innerWidth;
        this.canvas.height = container.clientHeight || window.innerHeight;
      };
      window.addEventListener('resize', resize);
      resize();
    }

    startLevel(levelId) {
      this.currentLevelId = levelId;
      this.currentLevel = getLevelCopy(levelId);
      gameStateData.lastPlayedLevel = levelId;
      persistData();
      this.state = 'PLAYING';
      this.hasGameplayStarted = false;
      this.particles = [];
      this.shadowGhosts = [];
      this.ghostTimer = 0;
      this.floatingPopups = [];
      this.damageFlashTimer = 0;
      activeKeys.clear();
      touchMoveDirection = null;

      // 3 Lives, Coins & Checkpoint System
      this.lives = 3;
      this.coinsCollected = 0;
      this.totalLevelCoins = (this.currentLevel.coins && this.currentLevel.coins.length) || 0;
      this.activeCheckpoint = null;

      this.updateHUDStats();

      // Spawn Player (Enlarged player size for enhanced visibility)
      this.player = {
        x: this.currentLevel.spawn.x,
        y: this.currentLevel.spawn.y,
        vx: 0,
        vy: 0,
        width: 28,
        height: 38,
        scale: 1.5,
        facing: 1,
        isGrounded: false,
        isAlive: true,
        hasReachedGoal: false,
        state: 'idle',
        attackTimer: 0,
        attackDuration: 0.22,
        invulnerableTimer: 0,
        jumpBuffer: 0
      };

      // Initialize Camera with forward visibility offset and vertical centering/following
      const leadOffset = this.canvas.width * 0.40;
      const maxCamX = Math.max(0, this.currentLevel.width - this.canvas.width);
      this.cameraX = Math.max(0, Math.min(maxCamX, this.player.x - leadOffset));
      const worldH = this.currentLevel.height || 540;
      this.cameraY = worldH > this.canvas.height
        ? Math.max(0, Math.min(worldH - this.canvas.height, this.player.y - this.canvas.height * 0.55))
        : -(this.canvas.height - worldH) / 2;

      // Sound BGM
      const worldIdx = (this.currentLevel.world || 1) - 1;
      sound.startBGM(this.currentLevel.bpm, worldIdx, (beat) => {
        // beat pulse if needed
      });

      this.switchScreen(null); // Show gameplay
    }

    switchScreen(screenId) {
      const screens = [
        'screen-main-menu', 'screen-camera-permission', 'screen-level-select',
        'screen-level-complete', 'screen-level-failed', 'modal-confirm-restart',
        'modal-game-paused', 'screen-settings', 'screen-how-to-play',
        'screen-leaderboard'
      ];
      screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          if (id === screenId) {
            el.classList.remove('hidden');
            el.classList.add('active');
          } else {
            el.classList.add('hidden');
            el.classList.remove('active');
          }
        }
      });
      closePlayerNameModal();

      const hud = document.getElementById('game-hud');
      const camPanel = document.getElementById('camera-panel');
      const attackZone = document.getElementById('attack-zone-container');
      const touchDpad = document.getElementById('touch-controls-fallback');
      const guidePanel = document.getElementById('gesture-guide-panel');
      const kbHint = document.getElementById('keyboard-controls-hint');

      if (screenId === null) {
        // In Gameplay
        if (hud) hud.classList.remove('hidden');
        if (camPanel) camPanel.classList.toggle('hidden', !gameStateData.settings.cameraPreview);
        if (guidePanel) guidePanel.classList.remove('hidden');
        if (attackZone) attackZone.classList.toggle('hidden', !gameStateData.settings.attackZoneEnabled);
        if (touchDpad) touchDpad.classList.toggle('hidden', gameStateData.settings.controlMode !== 'touch');
        if (kbHint) kbHint.classList.remove('hidden');
      } else {
        if (hud) hud.classList.add('hidden');
        if (camPanel) camPanel.classList.add('hidden');
        if (guidePanel) guidePanel.classList.add('hidden');
        if (attackZone) attackZone.classList.add('hidden');
        if (touchDpad) touchDpad.classList.add('hidden');
        if (kbHint) kbHint.classList.add('hidden');
      }
    }

    executePlayerAttack(attackType = 'standard') {
      if (!this.player || !this.player.isAlive) return;
      this.hasGameplayStarted = true;
      this.player.state = 'attack';
      this.player.attackType = attackType;
      this.player.attackTimer = this.player.attackDuration;

      if (attackType === 'left') {
        this.player.facing = -1;
        this.player.vx = -7.5;
        this.screenShake = 5;
        sound.playAttack('swift');
        this.addSlashEffect(this.player.x, this.player.y, -1);
      } else if (attackType === 'right') {
        this.player.facing = 1;
        this.player.vx = 7.5;
        this.screenShake = 5;
        sound.playAttack('swift');
        this.addSlashEffect(this.player.x, this.player.y, 1);
      } else if (attackType === 'heavy') {
        this.screenShake = 9;
        if (this.player.isGrounded) this.player.vy = -3.2;
        sound.playAttack('heavy');
        this.addHeavyShockwave(this.player.x, this.player.y);
      } else if (attackType === 'cyclone') {
        this.screenShake = 7;
        sound.playAttack('cyclone');
        this.addCycloneParticles(this.player.x, this.player.y);
      } else {
        this.screenShake = 4;
        sound.playAttack('standard');
        this.addSlashEffect(this.player.x, this.player.y, this.player.facing);
      }
    }

    addHeavyShockwave(x, y) {
      for (let i = 0; i < 28; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * 5 + 2;
        this.particles.push({
          x, y: y + 8, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd * 0.5 - 1.5,
          color: Math.random() > 0.5 ? '#ffaa00' : '#ff3344', size: Math.random() * 4 + 2, life: 0.35, maxLife: 0.35
        });
      }
    }

    addCycloneParticles(x, y) {
      for (let i = 0; i < 32; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * 4 + 3;
        this.particles.push({
          x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
          color: Math.random() > 0.5 ? '#9d00ff' : '#00f0ff', size: Math.random() * 3 + 2, life: 0.32, maxLife: 0.32
        });
      }
    }

    updateHUDStats() {
      const lvlTheme = getLevelTheme(this.currentLevelId);
      const lvlEl = document.getElementById('hud-level-display');
      if (lvlEl) {
        lvlEl.textContent = `LVL ${String(this.currentLevelId).padStart(2, '0')} • ${lvlTheme.icon} ${lvlTheme.shortName.toUpperCase()}`;
      }

      const heartsEl = document.getElementById('hud-hearts-display');
      if (heartsEl) {
        let heartsStr = '';
        for (let i = 0; i < 3; i++) {
          heartsStr += i < this.lives ? '❤️' : '🖤';
        }
        heartsEl.textContent = heartsStr;
      }

      const coinsEl = document.getElementById('hud-coins-display-val') || document.getElementById('hud-coins-val');
      if (coinsEl) {
        coinsEl.textContent = `🪙 ${String(this.coinsCollected).padStart(2, '0')} / ${String(this.totalLevelCoins).padStart(2, '0')}`;
      }

      const cpEl = document.getElementById('hud-checkpoint-display-val');
      if (cpEl) {
        if (this.activeCheckpoint) {
          cpEl.textContent = '🚩 SAVED';
          cpEl.classList.add('active');
        } else {
          cpEl.textContent = '🚩 START';
          cpEl.classList.remove('active');
        }
      }
    }

    takeDamage(reason = 'hazard') {
      if (this.state !== 'PLAYING') return;
      if (!this.player || !this.player.isAlive) return;

      this.lives = Math.max(0, this.lives - 1);
      this.updateHUDStats();

      if (this.lives > 0) {
        sound.playPlayerHurt();
        this.screenShake = 14;
        this.damageFlashTimer = 0.35;
        this.addExplosion(this.player.x, this.player.y, '#ff3344', 30);
        this.addFloatingPopup(this.player.x, this.player.y - 25, '-1 LIFE', '#ff3344');

        // Respawn player at active checkpoint if reached, else level spawn! (Coins & remaining lives preserved)
        const respawnPos = this.activeCheckpoint ? this.activeCheckpoint : this.currentLevel.spawn;
        this.player.x = respawnPos.x;
        this.player.y = respawnPos.y;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.isGrounded = false;
        this.player.invulnerableTimer = 2.0;
        this.player.state = 'idle';

        // Camera recenter towards respawn position
        const leadOffset = this.canvas.width * 0.40;
        const maxCamX = Math.max(0, this.currentLevel.width - this.canvas.width);
        this.cameraX = Math.max(0, Math.min(maxCamX, this.player.x - leadOffset));
        const worldH = this.currentLevel.height || 540;
        this.cameraY = worldH > this.canvas.height
          ? Math.max(0, Math.min(worldH - this.canvas.height, this.player.y - this.canvas.height * 0.55))
          : -(this.canvas.height - worldH) / 2;

        if (this.activeCheckpoint) {
          this.addFloatingPopup(this.player.x, this.player.y - 45, 'RESPAWNED AT CHECKPOINT', '#00f0ff');
        }
      } else {
        this.failLevel(reason);
      }
    }

    failLevel(reason = 'obstacle') {
      if (this.state !== 'PLAYING') return;
      this.state = 'FAILED';
      sound.stopBGM();
      sound.playPlayerDefeat();
      this.addExplosion(this.player.x, this.player.y, '#ff3344', 45);

      const defeatAttemptTag = document.getElementById('defeat-attempt-display');
      if (defeatAttemptTag) defeatAttemptTag.textContent = 'OUT OF LIVES';
      const defeatLivesEl = document.getElementById('defeat-lives-display');
      if (defeatLivesEl) defeatLivesEl.textContent = '🖤🖤🖤 (0/3)';

      setTimeout(() => {
        this.switchScreen('screen-level-failed');
      }, 550);
    }

    completeLevel() {
      if (this.state !== 'PLAYING') return;
      this.state = 'COMPLETE';
      sound.stopBGM();
      sound.playVictory();
      this.addVictoryConfetti(this.player.x, this.player.y);

      // Save level completion and coins
      if (!gameStateData.completedLevels.includes(this.currentLevelId)) {
        gameStateData.completedLevels.push(this.currentLevelId);
      }
      if (!gameStateData.levelCoins) gameStateData.levelCoins = {};
      const prevBestCoins = gameStateData.levelCoins[this.currentLevelId] || 0;
      if (this.coinsCollected > prevBestCoins) {
        gameStateData.levelCoins[this.currentLevelId] = this.coinsCollected;
      }
      let sumCoins = 0;
      for (const id in gameStateData.levelCoins) {
        sumCoins += gameStateData.levelCoins[id];
      }
      gameStateData.totalCoins = sumCoins;
      persistData();

      // Update Victory Modal
      const lvlNameEl = document.getElementById('complete-level-name');
      if (lvlNameEl) lvlNameEl.textContent = `LEVEL ${String(this.currentLevelId).padStart(2, '0')}: ${this.currentLevel.name}`;

      const livesValEl = document.getElementById('complete-lives-val');
      if (livesValEl) {
        let heartsStr = '';
        for (let i = 0; i < 3; i++) heartsStr += i < this.lives ? '❤️' : '🖤';
        livesValEl.textContent = `${heartsStr} (${this.lives}/3)`;
      }

      const coinsValEl = document.getElementById('complete-coins-val');
      if (coinsValEl) {
        coinsValEl.textContent = `🪙 ${this.coinsCollected} / ${this.totalLevelCoins}`;
      }

      const allCoinsBadge = document.getElementById('complete-all-coins-badge');
      if (allCoinsBadge) {
        allCoinsBadge.classList.toggle('hidden', this.coinsCollected < this.totalLevelCoins || this.totalLevelCoins === 0);
      }

      syncCurrentPlayerToLeaderboard();
      setTimeout(() => {
        this.switchScreen('screen-level-complete');
        renderLevelSelectGrid();
      }, 600);
    }

    restartLevel(confirmed = false) {
      this.startLevel(this.currentLevelId);
    }

    addFloatingPopup(x, y, text, color = '#ffd700') {
      this.floatingPopups.push({
        x, y, text, color, life: 0.85, maxLife: 0.85, vy: -35
      });
    }

    updateFloatingPopups(dt) {
      for (let i = this.floatingPopups.length - 1; i >= 0; i--) {
        const fp = this.floatingPopups[i];
        fp.life -= dt;
        fp.y += fp.vy * dt;
        if (fp.life <= 0) this.floatingPopups.splice(i, 1);
      }
    }

    drawFloatingPopups() {
      const ctx = this.ctx;
      for (const fp of this.floatingPopups) {
        const alpha = Math.max(0, fp.life / fp.maxLife);
        ctx.save();
        ctx.font = '700 13px "Chakra Petch", sans-serif';
        ctx.fillStyle = fp.color;
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.shadowColor = fp.color;
        ctx.shadowBlur = 8;
        ctx.fillText(fp.text, Math.round(fp.x), Math.round(fp.y));
        ctx.restore();
      }
    }

    addCoinSparkles(x, y) {
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.3;
        const spd = 40 + Math.random() * 60;
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          color: i % 2 === 0 ? '#ffd700' : '#ffffff',
          size: 2 + Math.random() * 2.5,
          life: 0.45,
          maxLife: 0.45
        });
      }
    }

    drawCoin(coin) {
      const ctx = this.ctx;
      const cx = coin.x;
      const bobY = Math.sin(this.animTime * 4 + coin.x * 0.05) * 3;
      const cy = coin.y + bobY;
      const spin = Math.cos(this.animTime * 5 + coin.x * 0.08);
      const absSpin = Math.max(0.18, Math.abs(spin));
      const radius = 10;

      ctx.save();
      ctx.translate(Math.round(cx), Math.round(cy));

      // Golden outer aura glow
      const glowGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
      glowGrad.addColorStop(0, 'rgba(255, 230, 0, 0.45)');
      glowGrad.addColorStop(0.6, 'rgba(255, 170, 0, 0.18)');
      glowGrad.addColorStop(1, 'rgba(255, 170, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();

      // 3D Spinning coin rim
      ctx.save();
      ctx.scale(spin, 1);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = spin > 0 ? '#ffb703' : '#fb8500';
      ctx.fill();
      ctx.strokeStyle = '#fff066';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner coin face
      ctx.beginPath();
      ctx.arc(0, 0, radius - 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd166';
      ctx.fill();

      // Star emblem
      ctx.fillStyle = '#e07a00';
      ctx.fillRect(-1.5, -4, 3, 8);
      ctx.fillRect(-4, -1.5, 8, 3);

      // Sparkle glint
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(-radius * 0.35, -radius * 0.35, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      ctx.restore();
    }

    addCheckpointBurst(x, y) {
      for (let i = 0; i < 28; i++) {
        const angle = (Math.PI * 2 / 28) * i + (Math.random() - 0.5) * 0.35;
        const spd = 60 + Math.random() * 95;
        const colors = ['#00f0ff', '#00ff88', '#ffffff', '#7000ff'];
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 35,
          color: colors[i % colors.length],
          size: 2.5 + Math.random() * 3,
          life: 0.65,
          maxLife: 0.65
        });
      }
    }

    drawCheckpoint(cp) {
      const ctx = this.ctx;
      const x = Math.round(cp.x);
      const platY = cp.platformY !== undefined ? Math.round(cp.platformY) : Math.round(cp.y + cp.height / 2);
      const isActive = !!cp.active;

      ctx.save();

      // 1. Base Terminal Stand bolted on platform
      const baseW = 32;
      const baseH = 8;
      ctx.fillStyle = '#0b1526';
      ctx.fillRect(x - baseW / 2, platY - baseH, baseW, baseH);
      ctx.strokeStyle = isActive ? '#00f0ff' : '#ffaa00';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - baseW / 2, platY - baseH, baseW, baseH);

      // Base Neon Core Light
      ctx.fillStyle = isActive ? '#00ff88' : '#ff8800';
      ctx.fillRect(x - 7, platY - baseH + 2, 14, 4);

      // 2. Dual Side Emitter Rods
      ctx.strokeStyle = '#243b55';
      ctx.lineWidth = 2;
      // Left rod
      ctx.beginPath();
      ctx.moveTo(x - 10, platY - baseH);
      ctx.lineTo(x - 10, platY - 42);
      ctx.stroke();
      // Right rod
      ctx.beginPath();
      ctx.moveTo(x + 10, platY - baseH);
      ctx.lineTo(x + 10, platY - 42);
      ctx.stroke();

      // Emitter Pylon Tips
      const tipColor = isActive ? '#00f0ff' : '#ffaa00';
      ctx.fillStyle = tipColor;
      ctx.beginPath();
      ctx.arc(x - 10, platY - 42, 2.5, 0, Math.PI * 2);
      ctx.arc(x + 10, platY - 42, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 3. Central Energy Pillar / Hologram
      const pulse = Math.sin(this.animTime * 6);
      if (isActive) {
        // ACTIVE STATE: Radiant Cyan/Green Holo-Column & Floating Flag
        // Ground energy glow ring
        ctx.save();
        const groundGrad = ctx.createRadialGradient(x, platY - 2, 2, x, platY - 2, 22);
        groundGrad.addColorStop(0, 'rgba(0, 255, 136, 0.6)');
        groundGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.25)');
        groundGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = groundGrad;
        ctx.beginPath();
        ctx.ellipse(x, platY - 2, 22, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Vertical holographic plasma beam
        const beamGrad = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
        beamGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        beamGrad.addColorStop(0.3, 'rgba(0, 240, 255, 0.35)');
        beamGrad.addColorStop(0.5, 'rgba(0, 255, 136, 0.55)');
        beamGrad.addColorStop(0.7, 'rgba(0, 240, 255, 0.35)');
        beamGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(x - 8, platY - 46, 16, 38);

        // Rising cyber spark dashes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const sparkOffset = ((this.animTime * 45 + i * 14) % 36);
          const sparkY = platY - baseH - sparkOffset;
          const sparkX = x + Math.sin(this.animTime * 8 + i) * 5;
          ctx.beginPath();
          ctx.moveTo(sparkX, sparkY);
          ctx.lineTo(sparkX, sparkY - 4);
          ctx.stroke();
        }

        // Floating Holographic Checkpoint Crest / Banner
        const bannerBob = Math.sin(this.animTime * 4) * 3;
        const bannerY = platY - 50 + bannerBob;

        // Holographic Flag / Diamond
        ctx.save();
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;

        // Diamond emblem
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(x, bannerY - 10);
        ctx.lineTo(x + 9, bannerY);
        ctx.lineTo(x, bannerY + 10);
        ctx.lineTo(x - 9, bannerY);
        ctx.closePath();
        ctx.fill();

        // Checkmark inside diamond
        ctx.strokeStyle = '#05101f';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x - 4, bannerY);
        ctx.lineTo(x - 1, bannerY + 4);
        ctx.lineTo(x + 5, bannerY - 4);
        ctx.stroke();
        ctx.restore();

        // Holographic text "SAVED"
        ctx.font = '600 8px var(--font-pixel, monospace)';
        ctx.fillStyle = '#00ffcc';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 6;
        ctx.fillText('SAVED', x, bannerY - 14);

      } else {
        // INACTIVE STATE: Pulsing Amber Beacon
        // Faint scan wave
        const waveY = platY - baseH - ((this.animTime * 24) % 32);
        ctx.strokeStyle = 'rgba(255, 170, 0, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x - 8, waveY);
        ctx.lineTo(x + 8, waveY);
        ctx.stroke();

        // Soft holographic core beam
        ctx.fillStyle = `rgba(255, 170, 0, ${0.15 + pulse * 0.08})`;
        ctx.fillRect(x - 6, platY - 42, 12, 34);

        // Floating Inactive Diamond / Node
        const bannerBob = Math.sin(this.animTime * 3) * 2;
        const bannerY = platY - 48 + bannerBob;

        ctx.save();
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1.8;
        ctx.fillStyle = 'rgba(255, 170, 0, 0.4)';
        ctx.beginPath();
        ctx.moveTo(x, bannerY - 7);
        ctx.lineTo(x + 7, bannerY);
        ctx.lineTo(x, bannerY + 7);
        ctx.lineTo(x - 7, bannerY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Holographic text "CHECKPOINT"
        ctx.font = '7px var(--font-pixel, monospace)';
        ctx.fillStyle = 'rgba(255, 170, 0, 0.8)';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 4;
        ctx.fillText('CHECKPOINT', x, bannerY - 11);
      }

      ctx.restore();
    }

    // --- PHYSICS & COLLISIONS ---
    updateControlsInput(dt) {
      if (!this.player || !this.player.isAlive) return;
      const p = this.player;

      // Camera gesture active components (supports pure directions, diagonals & dual hands!)
      const camLeft = isCameraActive && (rightConfirmedGesture === 'LEFT' || rightConfirmedGesture === 'UP_LEFT' || rightConfirmedGesture === 'DOWN_LEFT' || leftConfirmedGesture === 'LEFT');
      const camRight = isCameraActive && (rightConfirmedGesture === 'RIGHT' || rightConfirmedGesture === 'UP_RIGHT' || rightConfirmedGesture === 'DOWN_RIGHT' || leftConfirmedGesture === 'RIGHT');
      const camDown = isCameraActive && (rightConfirmedGesture === 'DOWN' || rightConfirmedGesture === 'DOWN_LEFT' || rightConfirmedGesture === 'DOWN_RIGHT' || leftConfirmedGesture === 'DOWN');
      const camUp = isCameraActive && (rightConfirmedGesture === 'UP' || rightConfirmedGesture === 'UP_LEFT' || rightConfirmedGesture === 'UP_RIGHT' || leftConfirmedGesture === 'UP');

      const leftPressed = activeKeys.has('KeyA') || activeKeys.has('ArrowLeft') || activeKeys.has('Numpad4') || activeKeys.has('a') || activeKeys.has('A') || activeKeys.has('arrowleft') || activeKeys.has('Left') || touchMoveDirection === 'LEFT' || camLeft;
      const rightPressed = activeKeys.has('KeyD') || activeKeys.has('ArrowRight') || activeKeys.has('Numpad6') || activeKeys.has('d') || activeKeys.has('D') || activeKeys.has('arrowright') || activeKeys.has('Right') || touchMoveDirection === 'RIGHT' || camRight;
      const downPressed = activeKeys.has('KeyS') || activeKeys.has('ArrowDown') || activeKeys.has('Numpad2') || activeKeys.has('s') || activeKeys.has('S') || activeKeys.has('arrowdown') || activeKeys.has('Down') || camDown;
      const upPressed = activeKeys.has('KeyW') || activeKeys.has('ArrowUp') || activeKeys.has('Numpad8') || activeKeys.has('w') || activeKeys.has('W') || activeKeys.has('arrowup') || activeKeys.has('Up') || camUp;

      if (leftPressed || rightPressed || downPressed || upPressed) {
        this.hasGameplayStarted = true;
      }

      // Horizontal velocity calculation supporting simultaneous keys, camera gestures & direction rollover
      if (leftPressed && rightPressed) {
        if (lastHorizontalKey === 'LEFT') {
          p.facing = -1;
          p.vx = -PLAYER_SPEED;
          if (p.isGrounded && p.state !== 'attack') {
            p.state = 'walk';
          }
        } else if (lastHorizontalKey === 'RIGHT') {
          p.facing = 1;
          p.vx = PLAYER_SPEED;
          if (p.isGrounded && p.state !== 'attack') {
            p.state = 'walk';
          }
        } else {
          p.vx = 0;
          if (p.isGrounded && p.state !== 'attack') {
            p.state = 'idle';
          }
        }
      } else if (leftPressed) {
        p.facing = -1;
        p.vx = -PLAYER_SPEED;
        if (p.isGrounded && p.state !== 'attack') {
          p.state = 'walk';
        }
      } else if (rightPressed) {
        p.facing = 1;
        p.vx = PLAYER_SPEED;
        if (p.isGrounded && p.state !== 'attack') {
          p.state = 'walk';
        }
      } else {
        // Neither left nor right is actively held
        if (p.isGrounded) {
          p.vx = 0;
          if (p.state !== 'attack') {
            p.state = 'idle';
          }
        }
      }

      // Down / Crouch / Fast descent
      if (downPressed) {
        p.vx *= 0.65;
        if (!p.isGrounded) {
          p.vy += 1.2;
        }
      }
    }

    updatePhysics(dt) {
      if (!this.player || !this.player.isAlive || !this.currentLevel) return;

      const p = this.player;

      // Update multi-key continuous keyboard/touch input
      this.updateControlsInput(dt);

      p.vy += 1.28; // Turbo-speed ninja gravity (blazing fast jump takeoff & landing)
      if (p.vy > 18) p.vy = 18;

      if (p.jumpBuffer > 0) {
        p.jumpBuffer -= dt;
      }

      // Horizontal
      p.x += p.vx;
      this.checkHorizontalPlatformCollisions(p, this.currentLevel.platforms);

      // Vertical
      p.y += p.vy;
      p.isGrounded = false;
      this.checkVerticalPlatformCollisions(p, this.currentLevel.platforms);

      // Animation State
      if (p.attackTimer > 0) {
        p.attackTimer -= dt;
        p.state = 'attack';
      } else {
        if (!p.isGrounded) p.state = p.vy < 0 ? 'jump' : 'fall';
        else if (Math.abs(p.vx) > 0.1) p.state = 'walk';
        else p.state = 'idle';
      }

      // Shadow Fighter Ghost Trail & Dark Smoke Wisps
      this.ghostTimer = (this.ghostTimer || 0) + dt;
      if (this.ghostTimer >= 0.045) {
        this.ghostTimer = 0;
        const isDashing = Math.abs(p.vx) > 0.3 || !p.isGrounded || p.state === 'attack';
        if (isDashing) {
          this.shadowGhosts.push({
            x: p.x,
            y: p.y,
            facing: p.facing,
            scale: p.scale || 1.5,
            state: p.state,
            attackType: p.attackType,
            life: 0.28,
            maxLife: 0.28
          });
          if (this.shadowGhosts.length > 8) this.shadowGhosts.shift();

          // Spawn Shadow Smoke Wisp Particle
          this.particles.push({
            x: p.x + (Math.random() * 12 - 6),
            y: p.y + p.height * 0.25 + (Math.random() * 8 - 4),
            vx: -p.vx * 0.2 + (Math.random() * 0.6 - 0.3),
            vy: -Math.random() * 0.8 - 0.2,
            color: Math.random() > 0.4 ? '#05070f' : (Math.random() > 0.5 ? '#111728' : '#00f0ff'),
            size: Math.random() * 4 + 2,
            life: 0.35,
            maxLife: 0.35
          });
        }
      }

      // Decay Shadow Ghost Afterimages
      for (let i = this.shadowGhosts.length - 1; i >= 0; i--) {
        const g = this.shadowGhosts[i];
        g.life -= dt;
        if (g.life <= 0) this.shadowGhosts.splice(i, 1);
      }

      // Invulnerability countdown
      if (p.invulnerableTimer > 0) {
        p.invulnerableTimer -= dt;
      }

      // Check Bottomless Pit
      if (p.y > this.currentLevel.height + 60) {
        this.takeDamage('pit');
        return;
      }

      // Check Hazards (Spikes & Lasers)
      if (p.invulnerableTimer <= 0) {
        for (const haz of this.currentLevel.hazards) {
          if (this.checkAABB(p, haz)) {
            this.takeDamage('hazard');
            return;
          }
        }
      }

      // Check Checkpoint Beacons
      if (this.currentLevel.checkpoints) {
        for (const cp of this.currentLevel.checkpoints) {
          if (!cp.active && this.checkAABB(p, cp)) {
            cp.active = true;
            const respawnY = (cp.platformY !== undefined ? cp.platformY : (cp.y + cp.height / 2)) - (p.height / 2);
            if (!this.activeCheckpoint || cp.x >= this.activeCheckpoint.x) {
              this.activeCheckpoint = { x: cp.x, y: respawnY };
            }
            sound.playCheckpoint();
            this.addFloatingPopup(cp.x, cp.y - 48, '🚩 CHECKPOINT SAVED!', '#00f0ff');
            this.addCheckpointBurst(cp.x, cp.y);
            this.screenShake = 6;
            this.updateHUDStats();
          }
        }
      }

      // Check Collectible Coins (Kept on life loss!)
      if (this.currentLevel.coins) {
        for (const coin of this.currentLevel.coins) {
          if (!coin.collected && this.checkAABB(p, coin)) {
            coin.collected = true;
            this.coinsCollected++;
            sound.playCoinPickup();
            this.addFloatingPopup(coin.x, coin.y - 14, '+100', '#ffd700');
            this.addCoinSparkles(coin.x, coin.y);
            this.updateHUDStats();
          }
        }
      }

      // Check Enemies & Combat
      this.checkEnemyInteractions(p, this.currentLevel);

      // Check Goal Flag
      if (this.currentLevel.goal && this.checkAABB(p, this.currentLevel.goal)) {
        this.completeLevel();
      }
    }

    checkHorizontalPlatformCollisions(p, platforms) {
      const halfW = p.width / 2;
      for (const plat of platforms) {
        if (this.checkPlatformOverlap(p, plat)) {
          if (p.vx > 0) { p.x = plat.x - halfW; p.vx = 0; }
          else if (p.vx < 0) { p.x = plat.x + plat.width + halfW; p.vx = 0; }
        }
      }
    }

    checkVerticalPlatformCollisions(p, platforms) {
      const halfH = p.height / 2;
      for (const plat of platforms) {
        if (this.checkPlatformOverlap(p, plat)) {
          if (p.vy > 0) {
            p.y = plat.y - halfH;
            p.vy = 0;
            p.isGrounded = true;
            if (plat.isMoving) {
              p.x += plat.vx;
              p.y += plat.vy;
            }
            if (p.jumpBuffer > 0) {
              p.jumpBuffer = 0;
              p.vy = -JUMP_FORCE;
              p.isGrounded = false;
              sound.playJump();
              this.addDustPuff(p.x, p.y + p.height / 2);
            }
          } else if (p.vy < 0) {
            p.y = plat.y + plat.height + halfH;
            p.vy = 0;
          }
        }
      }
    }

    checkPlatformOverlap(p, plat) {
      const pLeft = p.x - p.width / 2 + 2;
      const pRight = p.x + p.width / 2 - 2;
      const pTop = p.y - p.height / 2;
      const pBottom = p.y + p.height / 2;
      return (pRight > plat.x && pLeft < plat.x + plat.width &&
              pBottom > plat.y && pTop < plat.y + plat.height);
    }

    checkAABB(a, b) {
      const aLeft = a.x - (a.width || 28) / 2;
      const aRight = a.x + (a.width || 28) / 2;
      const aTop = a.y - (a.height || 38) / 2;
      const aBottom = a.y + (a.height || 38) / 2;
      const bLeft = b.x - (b.width || 28) / 2;
      const bRight = b.x + (b.width || 28) / 2;
      const bTop = b.y - (b.height || 38) / 2;
      const bBottom = b.y + (b.height || 38) / 2;
      return (aRight > bLeft && aLeft < bRight && aBottom > bTop && aTop < bBottom);
    }

    checkEnemyInteractions(p, level) {
      const isAttacking = p.state === 'attack' && p.attackTimer > 0;
      const scale = p.scale || 1.5;
      let slashHitbox = {
        x: p.x + p.facing * (18 * scale),
        y: p.y,
        width: 38 * scale,
        height: 32 * scale
      };

      if (p.attackType === 'cyclone') {
        slashHitbox = { x: p.x, y: p.y, width: 72 * scale, height: 50 * scale };
      } else if (p.attackType === 'heavy') {
        slashHitbox = { x: p.x + p.facing * (20 * scale), y: p.y + 4, width: 54 * scale, height: 46 * scale };
      }

      for (let i = level.enemies.length - 1; i >= 0; i--) {
        const enemy = level.enemies[i];
        if (!enemy.isAlive) continue;

        // 1. Blade hit enemy
        if (isAttacking && this.checkAABB(slashHitbox, enemy)) {
          const dmg = p.attackType === 'heavy' ? 2 : 1;
          enemy.health = (enemy.health || 1) - dmg;
          this.addSlashEffect(enemy.x, enemy.y, p.facing);
          if (enemy.health <= 0) {
            enemy.isAlive = false;
            this.addExplosion(enemy.x, enemy.y, '#ff007f', 25);
            sound.playEnemyDefeat();
          }
          continue;
        }

        // 2. Enemy hit player
        if (p.invulnerableTimer <= 0 && this.checkAABB(p, enemy)) {
          this.takeDamage('enemy');
          return;
        }
      }

      // Check Breakable Attack Target Blocks in Level
      if (level.targetBlocks) {
        for (let i = level.targetBlocks.length - 1; i >= 0; i--) {
          const tb = level.targetBlocks[i];
          if (tb.isDestroyed) continue;
          if (isAttacking && this.checkAABB(slashHitbox, tb)) {
            tb.isDestroyed = true;
            this.addExplosion(tb.x, tb.y, '#00f0ff', 30);
            sound.playEnemyDefeat();
            this.screenShake = 6;
          }
        }
      }
    }

    updateEntities(dt) {
      if (!this.currentLevel) return;
      // Moving Platforms
      for (const plat of this.currentLevel.platforms) {
        if (plat.isMoving) {
          plat.x += plat.vx;
          plat.y += plat.vy;
          plat.travelProgress += Math.abs(plat.vx) + Math.abs(plat.vy);
          if (plat.travelProgress >= plat.travelDistance) {
            plat.vx = -plat.vx;
            plat.vy = -plat.vy;
            plat.travelProgress = 0;
          }
        }
      }
      // Enemies Patrol
      for (const enemy of this.currentLevel.enemies) {
        if (!enemy.isAlive) continue;
        enemy.x += enemy.vx;
        enemy.travelDist = (enemy.travelDist || 0) + Math.abs(enemy.vx);
        if (enemy.travelDist >= enemy.maxTravel) {
          enemy.vx = -enemy.vx;
          enemy.facing = enemy.vx > 0 ? 1 : -1;
          enemy.travelDist = 0;
        }
      }
    }

    // --- PARTICLES & EFFECTS ---
    addSlashEffect(x, y, facing) {
      for (let i = 0; i < 20; i++) {
        const angle = (Math.random() * 0.8 - 0.4) + (facing > 0 ? 0 : Math.PI);
        const spd = Math.random() * 4 + 2;
        this.particles.push({
          x: x + facing * 16,
          y: y + (Math.random() * 12 - 6),
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          color: Math.random() > 0.5 ? '#05070e' : (Math.random() > 0.3 ? '#00f0ff' : '#9d00ff'),
          size: Math.random() * 4 + 2,
          life: 0.32,
          maxLife: 0.32
        });
      }
    }

    addExplosion(x, y, color = '#ff007f', count = 25) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * 4 + 1;
        this.particles.push({
          x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
          color, size: Math.random() * 4 + 2, life: 0.4, maxLife: 0.4
        });
      }
    }

    addDustPuff(x, y) {
      for (let i = 0; i < 6; i++) {
        this.particles.push({
          x: x + (Math.random() * 12 - 6),
          y,
          vx: Math.random() * 1.6 - 0.8,
          vy: -Math.random() * 1.2 - 0.2,
          color: Math.random() > 0.4 ? '#090d1a' : (Math.random() > 0.5 ? '#151c2e' : '#00f0ff'),
          size: Math.random() * 3 + 2,
          life: 0.3,
          maxLife: 0.3
        });
      }
    }

    addVictoryConfetti(x, y) {
      const colors = ['#00f0ff', '#00ff88', '#ffaa00', '#ff007f', '#ffffff'];
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * 5 + 2;
        this.particles.push({
          x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2,
          color: colors[Math.floor(Math.random() * colors.length)], size: Math.random() * 4 + 2, life: 1.2, maxLife: 1.2
        });
      }
    }

    updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
    }

    renderParticles() {
      for (const p of this.particles) {
        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        this.ctx.restore();
      }
    }

    // --- RENDERING ---
    render() {
      const w = this.canvas.width;
      const h = this.canvas.height;
      this.ctx.clearRect(0, 0, w, h);

      if (this.state === 'MAIN_MENU') return;

      this.ctx.save();
      if (this.screenShake > 0) {
        this.ctx.translate((Math.random() * 2 - 1) * this.screenShake, (Math.random() * 2 - 1) * this.screenShake);
      }

      const worldIdx = this.currentLevel ? (this.currentLevel.world - 1) : 0;

      // Parallax Background (Distinct Atmosphere per Level: Nature, Space, Smart City, Graveyard, Celestial Ruins)
      this.drawParallaxBackground(w, h, this.currentLevel);

      // Camera Translation
      this.ctx.save();
      this.ctx.translate(-Math.round(this.cameraX), -Math.round(this.cameraY));

      if (this.currentLevel) {
        // Platforms (Theme-Reactive Styling)
        for (const plat of this.currentLevel.platforms) this.drawPlatform(plat, this.currentLevel);
        // Hazards
        for (const haz of this.currentLevel.hazards) this.drawHazard(haz);
        // Goal
        if (this.currentLevel.goal) this.drawGoal(this.currentLevel.goal);
        // Enemies
        for (const enemy of this.currentLevel.enemies) {
          if (enemy.isAlive) this.drawEnemy(enemy);
        }
        // Breakable Attack Blocks in level
        if (this.currentLevel.targetBlocks) {
          for (const tb of this.currentLevel.targetBlocks) {
            if (!tb.isDestroyed) this.drawTargetBlock(tb);
          }
        }
        // Checkpoint Beacons
        if (this.currentLevel.checkpoints) {
          for (const cp of this.currentLevel.checkpoints) {
            this.drawCheckpoint(cp);
          }
        }
        // Collectible Coins
        if (this.currentLevel.coins) {
          for (const coin of this.currentLevel.coins) {
            if (!coin.collected) this.drawCoin(coin);
          }
        }
        // Shadow Fighter Ghost Afterimages
        if (this.shadowGhosts) {
          for (const g of this.shadowGhosts) {
            const alpha = (g.life / g.maxLife) * 0.45;
            this.drawShadowGhost(g, alpha);
          }
        }
        // Player
        if (this.player && this.player.isAlive) this.drawPlayer(this.player);
        // Particles
        this.renderParticles();
        // Floating Popups (+100, -1 LIFE)
        this.drawFloatingPopups();
      }

      this.ctx.restore();
      this.ctx.restore();

      // Screen Damage Vignette Flash when taking damage
      if (this.damageFlashTimer > 0) {
        this.ctx.save();
        this.ctx.fillStyle = `rgba(255, 30, 60, ${Math.min(0.4, this.damageFlashTimer * 1.1)})`;
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.restore();
      }
    }

    drawTargetBlock(tb) {
      this.ctx.save();
      this.ctx.translate(Math.round(tb.x), Math.round(tb.y));
      this.ctx.fillStyle = '#111c33';
      this.ctx.fillRect(-tb.width / 2, -tb.height / 2, tb.width, tb.height);
      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(-tb.width / 2, -tb.height / 2, tb.width, tb.height);
      const pulse = Math.sin(this.animTime * 8) * 2;
      this.ctx.fillStyle = '#ff007f';
      this.ctx.fillRect(-5 - pulse / 2, -5 - pulse / 2, 10 + pulse, 10 + pulse);
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(-tb.width / 2 + 2, -tb.height / 2 + 2);
      this.ctx.lineTo(tb.width / 2 - 2, tb.height / 2 - 2);
      this.ctx.moveTo(tb.width / 2 - 2, -tb.height / 2 + 2);
      this.ctx.lineTo(-tb.width / 2 + 2, tb.height / 2 - 2);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // =========================================================================
    // PARALLAX BACKGROUND SYSTEM: 20 UNIQUE HANDCRAFTED BACKGROUNDS
    // =========================================================================
    drawParallaxBackground(w, h, levelOrWorld) {
      const levelId = (levelOrWorld && typeof levelOrWorld === 'object') ? (levelOrWorld.id || 1) : (levelOrWorld || 1);
      const theme = getLevelTheme(levelOrWorld);

      switch (levelId) {
        case 1: this.drawLevel1Background(w, h, theme); break;
        case 2: this.drawLevel2Background(w, h, theme); break;
        case 3: this.drawLevel3Background(w, h, theme); break;
        case 4: this.drawLevel4Background(w, h, theme); break;
        case 5: this.drawLevel5Background(w, h, theme); break;
        case 6: this.drawLevel6Background(w, h, theme); break;
        case 7: this.drawLevel7Background(w, h, theme); break;
        case 8: this.drawLevel8Background(w, h, theme); break;
        case 9: this.drawLevel9Background(w, h, theme); break;
        case 10: this.drawLevel10Background(w, h, theme); break;
        case 11: this.drawLevel11Background(w, h, theme); break;
        case 12: this.drawLevel12Background(w, h, theme); break;
        case 13: this.drawLevel13Background(w, h, theme); break;
        case 14: this.drawLevel14Background(w, h, theme); break;
        case 15: this.drawLevel15Background(w, h, theme); break;
        case 16: this.drawLevel16Background(w, h, theme); break;
        case 17: this.drawLevel17Background(w, h, theme); break;
        case 18: this.drawLevel18Background(w, h, theme); break;
        case 19: this.drawLevel19Background(w, h, theme); break;
        case 20: this.drawLevel20Background(w, h, theme); break;
        default: this.drawLevel1Background(w, h, theme); break;
      }
    }

    // -------------------------------------------------------------------------
    // LEVEL 1: NEON AWAKENING (Cyberpunk Midnight Metropolis)
    // -------------------------------------------------------------------------
    drawLevel1Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#020412');
      grad.addColorStop(0.55, '#071330');
      grad.addColorStop(1, '#0e244d');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Cyber Stars
      this.ctx.save();
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 137.5 + this.cameraX * 0.02) % (w + 40)) - 20;
        const sy = (i * 91.3) % (h * 0.55);
        const flicker = Math.sin(this.animTime * 3 + i) * 0.4 + 0.6;
        this.ctx.fillStyle = i % 3 === 0 ? '#00f0ff' : '#ffffff';
        this.ctx.globalAlpha = flicker * 0.5;
        this.ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      this.ctx.restore();

      // Holographic Ringed Cyber-Moon
      this.ctx.save();
      const moonX = w * 0.78 - (this.cameraX * 0.02) % (w * 0.5);
      const moonY = h * 0.20;
      const moonRad = 44;
      const moonGlow = this.ctx.createRadialGradient(moonX, moonY, moonRad * 0.3, moonX, moonY, moonRad * 1.8);
      moonGlow.addColorStop(0, 'rgba(0, 240, 255, 0.28)');
      moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = moonGlow;
      this.ctx.beginPath();
      this.ctx.arc(moonX, moonY, moonRad * 1.8, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#0a1d38';
      this.ctx.beginPath();
      this.ctx.arc(moonX, moonY, moonRad, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.4;
      this.ctx.beginPath();
      this.ctx.ellipse(moonX, moonY, moonRad * 1.65, moonRad * 0.36, -Math.PI / 5, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      // Sweeping Cyan Searchlight
      this.ctx.save();
      const beamAngle = Math.sin(this.animTime * 0.8) * 0.32;
      const beamGrad = this.ctx.createLinearGradient(w * 0.3, h, w * 0.3 + Math.sin(beamAngle) * 320, 0);
      beamGrad.addColorStop(0, 'rgba(0, 240, 255, 0.16)');
      beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = beamGrad;
      this.ctx.beginPath();
      this.ctx.moveTo(w * 0.3 - 12, h);
      this.ctx.lineTo(w * 0.3 + Math.sin(beamAngle) * 420 - 35, 0);
      this.ctx.lineTo(w * 0.3 + Math.sin(beamAngle) * 420 + 35, 0);
      this.ctx.lineTo(w * 0.3 + 12, h);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();

      // Distant Megascrapers (0.04x speed)
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(5, 10, 24, 0.88)';
      const p1 = (this.cameraX * 0.04) % 360;
      for (let bx = -p1 - 180; bx < w + 200; bx += 70) {
        const bh = 130 + Math.sin(bx * 0.04) * 55;
        this.ctx.fillRect(bx, h - bh - 80, 58, bh + 80);
        this.ctx.fillStyle = Math.sin(this.animTime * 4 + bx) > 0 ? '#ff2255' : 'rgba(255, 34, 85, 0.2)';
        this.ctx.fillRect(bx + 28, h - bh - 84, 2.5, 2.5);
        this.ctx.fillStyle = 'rgba(5, 10, 24, 0.88)';
      }
      this.ctx.restore();

      // Midground Smart Towers with Neon Windows (0.09x speed)
      this.ctx.save();
      const p2 = (this.cameraX * 0.09) % 280;
      for (let bx = -p2 - 140; bx < w + 160; bx += 55) {
        const bh = 85 + Math.cos(bx * 0.07) * 40;
        this.ctx.fillStyle = 'rgba(9, 18, 38, 0.95)';
        this.ctx.fillRect(bx, h - bh - 40, 48, bh + 40);
        const winCols = ['#00f0ff', '#ff007f', '#ffaa00'];
        for (let wy = h - bh - 25; wy < h - 45; wy += 13) {
          for (let wx = bx + 6; wx < bx + 42; wx += 10) {
            if ((wx * 19 + wy * 31) % 4 === 0) {
              this.ctx.fillStyle = winCols[(wx + wy) % winCols.length];
              this.ctx.globalAlpha = 0.45 + Math.sin(this.animTime * 2 + wx) * 0.15;
              this.ctx.fillRect(wx, wy, 4, 6);
            }
          }
        }
      }
      this.ctx.restore();

      // Flying Aero-Car Traffic
      this.ctx.save();
      const carX = ((this.animTime * 140 - this.cameraX * 0.12) % (w + 300)) - 100;
      const carY = h * 0.38 + Math.sin(this.animTime * 2) * 8;
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.fillRect(carX, carY, 15, 4);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(carX + 12, carY + 1, 3, 2);
      this.ctx.fillStyle = '#ff0055';
      this.ctx.fillRect(carX, carY + 1, 2, 2);
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#00f0ff');
      this.drawThematicWatermark(w, h, 'CYBER METROPOLIS', 'NEON AWAKENING 01', '#00f0ff', '#ff007f');
    }

    // -------------------------------------------------------------------------
    // LEVEL 2: ROOFTOP LEAP (Neon Sunset & Sky-Bridges)
    // -------------------------------------------------------------------------
    drawLevel2Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#090214');
      grad.addColorStop(0.38, '#24083b');
      grad.addColorStop(0.72, '#580e52');
      grad.addColorStop(1, '#851944');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Giant Setting Retrowave Sun with Horizontal Venetian Blinds
      this.ctx.save();
      const sunX = w * 0.72 - (this.cameraX * 0.02) % (w * 0.5);
      const sunY = h * 0.30;
      const sunRad = 52;

      const sunAura = this.ctx.createRadialGradient(sunX, sunY, sunRad * 0.3, sunX, sunY, sunRad * 2);
      sunAura.addColorStop(0, 'rgba(255, 0, 127, 0.35)');
      sunAura.addColorStop(0.7, 'rgba(255, 170, 0, 0.15)');
      sunAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = sunAura;
      this.ctx.beginPath();
      this.ctx.arc(sunX, sunY, sunRad * 2, 0, Math.PI * 2);
      this.ctx.fill();

      const sunGrad = this.ctx.createLinearGradient(sunX, sunY - sunRad, sunX, sunY + sunRad);
      sunGrad.addColorStop(0, '#ffee55');
      sunGrad.addColorStop(0.5, '#ff007f');
      sunGrad.addColorStop(1, '#880044');
      this.ctx.fillStyle = sunGrad;
      this.ctx.beginPath();
      this.ctx.arc(sunX, sunY, sunRad, 0, Math.PI * 2);
      this.ctx.fill();

      // Silhouette horizontal blind cuts across sun
      this.ctx.fillStyle = '#24083b';
      for (let s = 6; s < sunRad * 2; s += 9) {
        if (s > sunRad * 0.6) {
          const cutY = sunY - sunRad + s;
          this.ctx.fillRect(sunX - sunRad - 5, cutY, (sunRad + 5) * 2, 2.8);
        }
      }
      this.ctx.restore();

      // Distant Spire Towers & Suspension Cables (0.03x)
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(24, 7, 36, 0.9)';
      const p1 = (this.cameraX * 0.03) % 360;
      for (let bx = -p1 - 180; bx < w + 200; bx += 90) {
        const bh = 110 + Math.sin(bx * 0.05) * 45;
        this.ctx.fillRect(bx, h - bh - 80, 42, bh + 80);
        // Spire needle
        this.ctx.fillRect(bx + 19, h - bh - 120, 4, 40);
        this.ctx.fillStyle = Math.sin(this.animTime * 3 + bx) > 0 ? '#ffaa00' : 'rgba(255, 170, 0, 0.2)';
        this.ctx.fillRect(bx + 19, h - bh - 123, 4, 4);
        this.ctx.fillStyle = 'rgba(24, 7, 36, 0.9)';
      }
      this.ctx.restore();

      // Elevated Sky-Train Monorail (0.07x)
      this.ctx.save();
      const railY = h * 0.58;
      this.ctx.strokeStyle = 'rgba(255, 0, 127, 0.25)';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(0, railY);
      this.ctx.lineTo(w, railY);
      this.ctx.stroke();

      const trainX = ((this.animTime * 170 - this.cameraX * 0.08) % (w + 400)) - 200;
      this.ctx.fillStyle = '#ff007f';
      this.ctx.fillRect(trainX, railY - 10, 85, 9);
      this.ctx.fillStyle = '#ffffff';
      for (let tw = trainX + 8; tw < trainX + 75; tw += 12) {
        this.ctx.fillRect(tw, railY - 8, 7, 4);
      }
      this.ctx.restore();

      // Ambient Falling Neon Rain Streaks
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255, 0, 127, 0.28)';
      this.ctx.lineWidth = 1.2;
      for (let r = 0; r < 35; r++) {
        const rx = ((r * 87.3 + this.animTime * 90 - this.cameraX * 0.1) % (w + 60)) - 30;
        const ry = (r * 53.7 + this.animTime * 280) % h;
        this.ctx.beginPath();
        this.ctx.moveTo(rx, ry);
        this.ctx.lineTo(rx - 4, ry + 16);
        this.ctx.stroke();
      }
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#ff007f');
      this.drawThematicWatermark(w, h, 'ROOFTOP SKYLINE', 'ROOFTOP LEAP 02', '#ff007f', '#ffaa00');
    }

    // -------------------------------------------------------------------------
    // LEVEL 3: GRID ABYSS (Sub-City Digital Chasm)
    // -------------------------------------------------------------------------
    drawLevel3Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#010708');
      grad.addColorStop(0.48, '#02181c');
      grad.addColorStop(1, '#053338');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Central Hexagonal Sub-City Power Core
      this.ctx.save();
      const coreX = w * 0.65 - (this.cameraX * 0.02) % (w * 0.5);
      const coreY = h * 0.24;
      const coreRad = 46;

      const aura = this.ctx.createRadialGradient(coreX, coreY, coreRad * 0.2, coreX, coreY, coreRad * 2);
      aura.addColorStop(0, 'rgba(0, 255, 204, 0.32)');
      aura.addColorStop(0.7, 'rgba(0, 180, 255, 0.12)');
      aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = aura;
      this.ctx.beginPath();
      this.ctx.arc(coreX, coreY, coreRad * 2, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = '#00ffcc';
      this.ctx.lineWidth = 2.2;
      this.ctx.shadowColor = '#00ffcc';
      this.ctx.shadowBlur = 14;
      this.ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const ang = (Math.PI / 3) * a + this.animTime * 0.6;
        const hx = coreX + Math.cos(ang) * coreRad;
        const hy = coreY + Math.sin(ang) * coreRad;
        if (a === 0) this.ctx.moveTo(hx, hy);
        else this.ctx.lineTo(hx, hy);
      }
      this.ctx.closePath();
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
      this.ctx.restore();

      // Cascading Matrix Digital Code Rain in Chasm
      this.ctx.save();
      this.ctx.fillStyle = '#00ffcc';
      this.ctx.font = '10px monospace';
      for (let c = 0; c < 30; c++) {
        const colX = ((c * 68.3 - this.cameraX * 0.05) % (w + 40)) - 20;
        const streamHead = (this.animTime * 120 + c * 43) % (h + 120) - 60;
        for (let j = 0; j < 6; j++) {
          const charY = streamHead - j * 12;
          if (charY > 0 && charY < h) {
            this.ctx.globalAlpha = Math.max(0, 0.85 - j * 0.15);
            this.ctx.fillText((c + j) % 2 === 0 ? '0' : '1', colX, charY);
          }
        }
      }
      this.ctx.restore();

      // Giant Subterranean Server Monoliths (0.08x)
      this.ctx.save();
      const p2 = (this.cameraX * 0.08) % 320;
      for (let mx = -p2 - 160; mx < w + 200; mx += 75) {
        const mh = 140 + Math.sin(mx * 0.04) * 60;
        this.ctx.fillStyle = '#051618';
        this.ctx.fillRect(mx, h - mh - 40, 52, mh + 40);
        // Vertical status bus
        for (let sy = h - mh - 20; sy < h - 45; sy += 10) {
          const isLit = (mx + sy) % 3 !== 0;
          this.ctx.fillStyle = isLit ? '#00ffcc' : '#006655';
          this.ctx.globalAlpha = isLit ? (0.4 + Math.sin(this.animTime * 3 + sy) * 0.2) : 0.2;
          this.ctx.fillRect(mx + 8, sy, 5, 4);
          this.ctx.fillRect(mx + 18, sy, 5, 4);
        }
      }
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#00ffcc');
      this.drawThematicWatermark(w, h, 'SUB-CITY CHASM', 'GRID ABYSS 03', '#00ffcc', '#0099ff');
    }

    // -------------------------------------------------------------------------
    // LEVEL 4: FIRST CONTACT (Stratospheric Orbital Skyport & Space Elevator)
    // -------------------------------------------------------------------------
    drawLevel4Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#01020b');
      grad.addColorStop(0.42, '#080a26');
      grad.addColorStop(0.8, '#16134a');
      grad.addColorStop(1, '#2c1966');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Starfield
      this.ctx.save();
      for (let s = 0; s < 50; s++) {
        const sx = ((s * 149.3 + this.cameraX * 0.01) % (w + 40)) - 20;
        const sy = (s * 83.1) % (h * 0.65);
        this.ctx.fillStyle = s % 2 === 0 ? '#38bdf8' : '#ffffff';
        this.ctx.globalAlpha = 0.35 + Math.sin(this.animTime * 2.5 + s) * 0.35;
        this.ctx.fillRect(sx, sy, 1.8, 1.8);
      }
      this.ctx.restore();

      // Crescent Earth / Blue Planet Rim on Stratosphere Horizon
      this.ctx.save();
      const orbX = w * 0.76 - (this.cameraX * 0.015) % (w * 0.5);
      const orbY = h * 0.22;
      const orbRad = 48;

      const orbAura = this.ctx.createRadialGradient(orbX, orbY, orbRad * 0.4, orbX, orbY, orbRad * 1.8);
      orbAura.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      orbAura.addColorStop(0.7, 'rgba(168, 85, 247, 0.12)');
      orbAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = orbAura;
      this.ctx.beginPath();
      this.ctx.arc(orbX, orbY, orbRad * 1.8, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#1e3a8a';
      this.ctx.beginPath();
      this.ctx.arc(orbX, orbY, orbRad, 0, Math.PI * 2);
      this.ctx.fill();
      // Crescent mask
      this.ctx.fillStyle = '#080a26';
      this.ctx.beginPath();
      this.ctx.arc(orbX + 16, orbY - 8, orbRad * 0.95, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      // Colossal Space Elevator Tether (0.02x)
      this.ctx.save();
      const tetherX = w * 0.32 - (this.cameraX * 0.02) % (w * 0.6);
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 3.5;
      this.ctx.globalAlpha = 0.55;
      this.ctx.beginPath();
      this.ctx.moveTo(tetherX, 0);
      this.ctx.lineTo(tetherX, h);
      this.ctx.stroke();

      // Ascending Freight Pod
      const podY = ((this.animTime * 45) % (h + 80)) - 40;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(tetherX - 6, h - podY, 12, 16);
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.fillRect(tetherX - 4, h - podY + 3, 8, 4);
      this.ctx.restore();

      // Launch Gantry Towers & Rotating Radar Dish (0.06x)
      this.ctx.save();
      const p2 = (this.cameraX * 0.06) % 360;
      for (let gx = -p2 - 180; gx < w + 200; gx += 110) {
        const gh = 95 + Math.sin(gx * 0.04) * 35;
        this.ctx.fillStyle = '#0f1230';
        this.ctx.fillRect(gx, h - gh - 45, 36, gh + 45);
        // Radar dish ellipse
        const rot = this.animTime * 1.8 + gx;
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.ellipse(gx + 18, h - gh - 55, 16, 6, Math.sin(rot) * 0.4, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#38bdf8');
      this.drawThematicWatermark(w, h, 'ORBITAL SKYPORT', 'FIRST CONTACT 04', '#38bdf8', '#a855f7');
    }

    // -------------------------------------------------------------------------
    // LEVEL 5: SPORE CAVERNS (Bioluminescent Fungal Caverns)
    // -------------------------------------------------------------------------
    drawLevel5Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#010a05');
      grad.addColorStop(0.45, '#042114');
      grad.addColorStop(0.85, '#093a22');
      grad.addColorStop(1, '#0f5232');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // The Mother Spore Cluster Orb
      this.ctx.save();
      const sporeX = w * 0.72 - (this.cameraX * 0.02) % (w * 0.5);
      const sporeY = h * 0.20;
      const sRad = 44;
      const sPulse = Math.sin(this.animTime * 2.2) * 4;

      const sGlow = this.ctx.createRadialGradient(sporeX, sporeY, (sRad + sPulse) * 0.3, sporeX, sporeY, (sRad + sPulse) * 1.9);
      sGlow.addColorStop(0, 'rgba(0, 255, 136, 0.32)');
      sGlow.addColorStop(0.6, 'rgba(168, 85, 247, 0.12)');
      sGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = sGlow;
      this.ctx.beginPath();
      this.ctx.arc(sporeX, sporeY, (sRad + sPulse) * 1.9, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#062917';
      this.ctx.beginPath();
      this.ctx.arc(sporeX, sporeY, sRad + sPulse, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      // Hanging Stalactites from Cavern Roof (0.03x)
      this.ctx.save();
      this.ctx.fillStyle = '#04170e';
      const p1 = (this.cameraX * 0.03) % 240;
      for (let sx = -p1 - 100; sx < w + 150; sx += 60) {
        const sh = 40 + Math.sin(sx * 0.06) * 25;
        this.ctx.beginPath();
        this.ctx.moveTo(sx, 0);
        this.ctx.lineTo(sx + 15, sh);
        this.ctx.lineTo(sx + 30, 0);
        this.ctx.closePath();
        this.ctx.fill();
      }
      this.ctx.restore();

      // Giant Bioluminescent Mushrooms (0.08x)
      this.ctx.save();
      const p2 = (this.cameraX * 0.08) % 300;
      for (let mx = -p2 - 150; mx < w + 200; mx += 85) {
        const mh = 110 + Math.sin(mx * 0.05) * 45;
        const stemX = mx + 24;
        const capY = h - mh - 20;
        this.ctx.fillStyle = '#061d11';
        this.ctx.fillRect(stemX, capY, 14, mh + 20);

        const capCol = mx % 170 < 85 ? '#00ff88' : '#c084fc';
        this.ctx.shadowColor = capCol;
        this.ctx.shadowBlur = 14;
        this.ctx.fillStyle = capCol;
        this.ctx.beginPath();
        this.ctx.arc(stemX + 7, capY, 24, Math.PI, 0);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
      }
      this.ctx.restore();

      // Floating Glowing Spore Particles
      this.ctx.save();
      for (let s = 0; s < 35; s++) {
        const sx = ((s * 117.3 - this.cameraX * 0.12 + this.animTime * 12) % (w + 40)) - 20;
        const sy = (s * 71.9 + Math.sin(this.animTime * 2 + s) * 18) % (h * 0.85);
        this.ctx.fillStyle = s % 2 === 0 ? '#00ff88' : '#7affc8';
        this.ctx.globalAlpha = 0.4 + Math.sin(this.animTime * 3 + s) * 0.4;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, s % 3 === 0 ? 2.5 : 1.6, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();

      this.drawThematicWatermark(w, h, 'SPORE CAVERNS', 'SPORE CAVERNS 05', '#00ff88', '#2dd4bf');
    }

    // -------------------------------------------------------------------------
    // LEVEL 6: OVERGROWTH RUN (Sun-Dappled Ancient Primeval Canopy)
    // -------------------------------------------------------------------------
    drawLevel6Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#020f06');
      grad.addColorStop(0.38, '#0a2e14');
      grad.addColorStop(0.75, '#175726');
      grad.addColorStop(1, '#3a6b25');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Golden Morning Sunburst through Canopy
      this.ctx.save();
      const sunX = w * 0.68 - (this.cameraX * 0.02) % (w * 0.5);
      const sunY = h * 0.18;
      const sunRad = 46;

      const sAura = this.ctx.createRadialGradient(sunX, sunY, sunRad * 0.2, sunX, sunY, sunRad * 2.2);
      sAura.addColorStop(0, 'rgba(255, 230, 100, 0.45)');
      sAura.addColorStop(0.6, 'rgba(163, 230, 53, 0.2)');
      sAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = sAura;
      this.ctx.beginPath();
      this.ctx.arc(sunX, sunY, sunRad * 2.2, 0, Math.PI * 2);
      this.ctx.fill();

      // Volumetric God-Rays
      this.ctx.save();
      for (let r = -2; r <= 3; r++) {
        const rayAngle = 0.45 + r * 0.16;
        const rayGrad = this.ctx.createLinearGradient(sunX, sunY, sunX + Math.cos(rayAngle) * 500, sunY + Math.sin(rayAngle) * 500);
        rayGrad.addColorStop(0, 'rgba(255, 240, 150, 0.25)');
        rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = rayGrad;
        this.ctx.beginPath();
        this.ctx.moveTo(sunX - 10, sunY - 10);
        this.ctx.lineTo(sunX + Math.cos(rayAngle - 0.05) * 600, sunY + Math.sin(rayAngle - 0.05) * 600);
        this.ctx.lineTo(sunX + Math.cos(rayAngle + 0.05) * 600, sunY + Math.sin(rayAngle + 0.05) * 600);
        this.ctx.closePath();
        this.ctx.fill();
      }
      this.ctx.restore();
      this.ctx.restore();

      // Colossal Ancient Twisted Banyan Trunks (0.08x)
      this.ctx.save();
      const p2 = (this.cameraX * 0.08) % 340;
      for (let tx = -p2 - 160; tx < w + 200; tx += 95) {
        const th = 130 + Math.sin(tx * 0.05) * 50;
        this.ctx.fillStyle = '#061d0d';
        this.ctx.fillRect(tx + 25, h - th - 30, 24, th + 30);
        // Canopy umbrella
        this.ctx.beginPath();
        this.ctx.arc(tx + 37, h - th - 30, 52, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();

      // Drifting Golden Pollen Particles
      this.ctx.save();
      for (let p = 0; p < 30; p++) {
        const px = ((p * 129.7 - this.cameraX * 0.1 + this.animTime * 20) % (w + 40)) - 20;
        const py = (p * 67.3 + Math.sin(this.animTime + p) * 16) % h;
        this.ctx.fillStyle = '#fde047';
        this.ctx.globalAlpha = 0.45 + Math.sin(this.animTime * 3 + p) * 0.35;
        this.ctx.fillRect(px, py, 2, 2);
      }
      this.ctx.restore();

      this.drawThematicWatermark(w, h, 'ANCIENT CANOPY', 'OVERGROWTH RUN 06', '#a3e635', '#00ff88');
    }

    // -------------------------------------------------------------------------
    // LEVEL 7: SWARM CANOPY (Twilight Firefly Swamp & Twin Moons)
    // -------------------------------------------------------------------------
    drawLevel7Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#05020f');
      grad.addColorStop(0.42, '#120d2b');
      grad.addColorStop(0.78, '#17282c');
      grad.addColorStop(1, '#153a29');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Mystical Twin Jade Moons
      this.ctx.save();
      const m1X = w * 0.70 - (this.cameraX * 0.02) % (w * 0.5);
      const m1Y = h * 0.19;
      const m1Rad = 36;
      const m2X = m1X + 48;
      const m2Y = m1Y + 22;
      const m2Rad = 20;

      this.ctx.fillStyle = 'rgba(45, 212, 191, 0.22)';
      this.ctx.beginPath();
      this.ctx.arc(m1X, m1Y, m1Rad * 1.8, 0, Math.PI * 2);
      this.ctx.arc(m2X, m2Y, m2Rad * 1.8, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#99f6e4';
      this.ctx.beginPath();
      this.ctx.arc(m1X, m1Y, m1Rad, 0, Math.PI * 2);
      this.ctx.arc(m2X, m2Y, m2Rad, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      // Weeping Willow Silhouettes with Dangling Spanish Moss (0.07x)
      this.ctx.save();
      const p1 = (this.cameraX * 0.07) % 300;
      for (let wx = -p1 - 150; wx < w + 200; wx += 80) {
        const wh = 100 + Math.sin(wx * 0.06) * 35;
        this.ctx.fillStyle = '#081716';
        this.ctx.fillRect(wx + 22, h - wh - 30, 16, wh + 30);
        // Weeping boughs
        this.ctx.strokeStyle = '#081716';
        this.ctx.lineWidth = 3;
        for (let b = -2; b <= 2; b++) {
          this.ctx.beginPath();
          this.ctx.moveTo(wx + 30, h - wh - 25);
          this.ctx.quadraticCurveTo(wx + 30 + b * 20, h - wh + 10, wx + 30 + b * 26, h - wh + 45);
          this.ctx.stroke();
        }
      }
      this.ctx.restore();

      // Swarms of Dancing Fireflies in Organic Wave Formations
      this.ctx.save();
      for (let f = 0; f < 42; f++) {
        const fx = ((f * 97.3 - this.cameraX * 0.12 + Math.sin(this.animTime * 1.8 + f) * 35) % (w + 40)) - 20;
        const fy = (f * 51.7 + Math.sin(this.animTime * 2.8 + f * 1.3) * 24) % (h * 0.82);
        const glowPulse = Math.sin(this.animTime * 4 + f) * 0.4 + 0.6;
        this.ctx.shadowColor = '#2dd4bf';
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = f % 2 === 0 ? '#2dd4bf' : '#a7f3d0';
        this.ctx.globalAlpha = glowPulse * 0.8;
        this.ctx.beginPath();
        this.ctx.arc(fx, fy, (f % 3 === 0) ? 2.6 : 1.8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
      }
      this.ctx.restore();

      this.drawThematicWatermark(w, h, 'TWILIGHT SWAMP', 'SWARM CANOPY 07', '#2dd4bf', '#a855f7');
    }

    // -------------------------------------------------------------------------
    // LEVEL 8: SHIFTING MOSS (Sacred Crystal Cascades & Waterfalls)
    // -------------------------------------------------------------------------
    drawLevel8Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#010f14');
      grad.addColorStop(0.42, '#042c38');
      grad.addColorStop(0.82, '#0a5563');
      grad.addColorStop(1, '#117b7a');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Colossal Floating Mana Crystal
      this.ctx.save();
      const cryX = w * 0.74 - (this.cameraX * 0.02) % (w * 0.5);
      const cryY = h * 0.22;
      const cryW = 28;
      const cryH = 64;

      const cGlow = this.ctx.createRadialGradient(cryX, cryY, 10, cryX, cryY, 90);
      cGlow.addColorStop(0, 'rgba(52, 211, 153, 0.4)');
      cGlow.addColorStop(0.7, 'rgba(0, 240, 255, 0.15)');
      cGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = cGlow;
      this.ctx.beginPath();
      this.ctx.arc(cryX, cryY, 90, 0, Math.PI * 2);
      this.ctx.fill();

      // Crystalline Octahedron
      this.ctx.fillStyle = '#6ee7b7';
      this.ctx.beginPath();
      this.ctx.moveTo(cryX, cryY - cryH / 2);
      this.ctx.lineTo(cryX + cryW / 2, cryY);
      this.ctx.lineTo(cryX, cryY + cryH / 2);
      this.ctx.lineTo(cryX - cryW / 2, cryY);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.fillStyle = '#a7f3d0';
      this.ctx.beginPath();
      this.ctx.moveTo(cryX, cryY - cryH / 2);
      this.ctx.lineTo(cryX + cryW / 2, cryY);
      this.ctx.lineTo(cryX, cryY + cryH / 2);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();

      // Distant Cliffs with Cascading Glowing Waterfalls (0.04x)
      this.ctx.save();
      const p1 = (this.cameraX * 0.04) % 360;
      for (let cx = -p1 - 180; cx < w + 200; cx += 100) {
        const ch = 120 + Math.sin(cx * 0.04) * 50;
        this.ctx.fillStyle = '#062024';
        this.ctx.fillRect(cx, h - ch - 40, 65, ch + 40);
        // Cascading aqua waterfall
        const wfX = cx + 24;
        this.ctx.fillStyle = 'rgba(52, 211, 153, 0.65)';
        this.ctx.fillRect(wfX, h - ch - 35, 16, ch + 35);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(wfX + 4, h - ch - 35, 3, ch + 35);
      }
      this.ctx.restore();

      // Floating Moss Islets & Crystal Prisms (0.08x)
      this.ctx.save();
      for (let i = 0; i < 4; i++) {
        const ix = ((i * 260 - this.cameraX * 0.08) % (w + 200)) - 80;
        const iy = h * 0.44 + Math.sin(this.animTime * 1.5 + i) * 14;
        this.ctx.fillStyle = '#0a2e2b';
        this.ctx.beginPath();
        this.ctx.ellipse(ix, iy, 42, 14, 0, 0, Math.PI * 2);
        this.ctx.fill();
        // Dangling vines
        this.ctx.strokeStyle = '#34d399';
        this.ctx.lineWidth = 1.4;
        for (let v = -20; v <= 20; v += 10) {
          this.ctx.beginPath();
          this.ctx.moveTo(ix + v, iy + 8);
          this.ctx.lineTo(ix + v + Math.sin(this.animTime * 2 + v) * 3, iy + 24 + (v % 8));
          this.ctx.stroke();
        }
      }
      this.ctx.restore();

      this.drawThematicWatermark(w, h, 'ENCHANTED FALLS', 'SHIFTING MOSS 08', '#34d399', '#00f0ff');
    }

    // -------------------------------------------------------------------------
    // LEVEL 9: PISTON CORE (Volcanic Foundry & Hydraulic Machinery)
    // -------------------------------------------------------------------------
    drawLevel9Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a0101');
      grad.addColorStop(0.45, '#240404');
      grad.addColorStop(0.8, '#520b06');
      grad.addColorStop(1, '#851508');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Blazing Smelting Furnace Eye / Core Geode
      this.ctx.save();
      const fX = w * 0.74 - (this.cameraX * 0.02) % (w * 0.5);
      const fY = h * 0.22;
      const fRad = 48;

      const fGlow = this.ctx.createRadialGradient(fX, fY, fRad * 0.3, fX, fY, fRad * 2);
      fGlow.addColorStop(0, 'rgba(255, 59, 48, 0.45)');
      fGlow.addColorStop(0.7, 'rgba(255, 170, 0, 0.2)');
      fGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = fGlow;
      this.ctx.beginPath();
      this.ctx.arc(fX, fY, fRad * 2, 0, Math.PI * 2);
      this.ctx.fill();

      const fGrad = this.ctx.createRadialGradient(fX, fY, 4, fX, fY, fRad);
      fGrad.addColorStop(0, '#ffffff');
      fGrad.addColorStop(0.4, '#ffaa00');
      fGrad.addColorStop(1, '#b30000');
      this.ctx.fillStyle = fGrad;
      this.ctx.beginPath();
      this.ctx.arc(fX, fY, fRad, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      // Heavy Hydraulic Pistons (0.07x)
      this.ctx.save();
      const p1 = (this.cameraX * 0.07) % 280;
      for (let px = -p1 - 140; px < w + 200; px += 75) {
        const pump = (Math.sin(this.animTime * 4 + px * 0.05) + 1) * 0.5; // 0..1
        const shaftH = 60 + pump * 35;
        this.ctx.fillStyle = '#1c0808';
        this.ctx.fillRect(px + 14, 0, 24, h - 140);
        // Moving piston head
        this.ctx.fillStyle = '#ff3b30';
        this.ctx.fillRect(px + 8, h - 160 + pump * 30, 36, 16);
        // Steam blast puff
        if (pump > 0.85) {
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          this.ctx.beginPath();
          this.ctx.arc(px + 26, h - 160 + pump * 30 + 20, 14, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
      this.ctx.restore();

      // Flowing Molten Lava River on Horizon
      this.ctx.save();
      this.ctx.fillStyle = '#ff3b30';
      this.ctx.globalAlpha = 0.4;
      this.ctx.fillRect(0, h - 35, w, 35);
      this.ctx.fillStyle = '#ffee55';
      for (let lx = 0; lx < w; lx += 45) {
        this.ctx.fillRect(lx + Math.sin(this.animTime * 3 + lx) * 8, h - 30, 24, 6);
      }
      this.ctx.restore();

      // Floating Hot Embers & Sparks
      this.ctx.save();
      for (let e = 0; e < 35; e++) {
        const ex = ((e * 103.7 - this.cameraX * 0.12 + Math.sin(this.animTime + e) * 20) % (w + 40)) - 20;
        const ey = (e * 61.3 - this.animTime * 70) % h;
        const actY = ey < 0 ? ey + h : ey;
        this.ctx.fillStyle = e % 2 === 0 ? '#ffaa00' : '#ff3b30';
        this.ctx.globalAlpha = 0.5 + Math.sin(this.animTime * 4 + e) * 0.4;
        this.ctx.fillRect(ex, actY, 2.5, 2.5);
      }
      this.ctx.restore();

      this.drawThematicWatermark(w, h, 'VOLCANIC FOUNDRY', 'PISTON CORE 09', '#ff3b30', '#ffaa00');
    }

    // -------------------------------------------------------------------------
    // LEVEL 10: STEAM MAZE (Steampunk Pressure Labyrinth & Geothermal Brass)
    // -------------------------------------------------------------------------
    drawLevel10Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#090402');
      grad.addColorStop(0.42, '#211206');
      grad.addColorStop(0.8, '#42250d');
      grad.addColorStop(1, '#693c14');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Giant Geothermal Brass Boiler & Circular Pressure Dial
      this.ctx.save();
      const bX = w * 0.72 - (this.cameraX * 0.02) % (w * 0.5);
      const bY = h * 0.24;
      const bRad = 48;

      this.ctx.fillStyle = '#261508';
      this.ctx.beginPath();
      this.ctx.arc(bX, bY, bRad, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#f59e0b';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      // Pressure needle spinning
      const needleAng = Math.sin(this.animTime * 2.5) * 1.2 - Math.PI / 2;
      this.ctx.strokeStyle = '#ff3b30';
      this.ctx.lineWidth = 2.2;
      this.ctx.beginPath();
      this.ctx.moveTo(bX, bY);
      this.ctx.lineTo(bX + Math.cos(needleAng) * (bRad - 8), bY + Math.sin(needleAng) * (bRad - 8));
      this.ctx.stroke();
      this.ctx.restore();

      // Interconnected Brass & Copper Steam Conduits (0.04x)
      this.ctx.save();
      this.ctx.strokeStyle = '#784318';
      this.ctx.lineWidth = 7;
      for (let p = 0; p < 4; p++) {
        const py = h * 0.35 + p * 45;
        this.ctx.beginPath();
        this.ctx.moveTo(0, py);
        this.ctx.lineTo(w, py);
        this.ctx.stroke();
      }
      this.ctx.restore();

      // Giant Rotating Brass Ventilation Fans (0.08x)
      this.ctx.save();
      const p2 = (this.cameraX * 0.08) % 320;
      for (let fx = -p2 - 160; fx < w + 200; fx += 110) {
        const fy = h * 0.55;
        const fanRot = this.animTime * 3.5 + fx;
        this.ctx.fillStyle = '#1c0f05';
        this.ctx.fillRect(fx - 24, fy - 24, 48, 48);
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(fx - 24, fy - 24, 48, 48);

        this.ctx.fillStyle = '#d97706';
        for (let b = 0; b < 4; b++) {
          const ang = fanRot + (Math.PI / 2) * b;
          this.ctx.beginPath();
          this.ctx.arc(fx + Math.cos(ang) * 14, fy + Math.sin(ang) * 14, 7, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
      this.ctx.restore();

      // Pressurized Steam Geyser Bursts
      this.ctx.save();
      for (let s = 0; s < 4; s++) {
        const sx = ((s * 240 + 60 - this.cameraX * 0.1) % (w + 100)) - 50;
        const sy = h * 0.65;
        const burstPhase = (this.animTime * 2 + s) % 1;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        this.ctx.beginPath();
        this.ctx.arc(sx, sy - burstPhase * 70, 16 + burstPhase * 24, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();

      this.drawThematicWatermark(w, h, 'STEAM FACTORY', 'STEAM MAZE 10', '#f59e0b', '#ff4400');
    }

    // -------------------------------------------------------------------------
    // LEVEL 11: OVERCLOCK (Superheated Plasma Reactor & Electric Substation)
    // -------------------------------------------------------------------------
    drawLevel11Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#080112');
      grad.addColorStop(0.4, '#1d042b');
      grad.addColorStop(0.78, '#440854');
      grad.addColorStop(1, '#6b0d6f');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Tokamak Plasma Core Sphere with Magnetic Containment Rings
      this.ctx.save();
      const coreX = w * 0.72 - (this.cameraX * 0.02) % (w * 0.5);
      const coreY = h * 0.23;
      const coreRad = 50;

      const pGlow = this.ctx.createRadialGradient(coreX, coreY, coreRad * 0.3, coreX, coreY, coreRad * 2.2);
      pGlow.addColorStop(0, 'rgba(192, 132, 252, 0.45)');
      pGlow.addColorStop(0.6, 'rgba(0, 240, 255, 0.15)');
      pGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = pGlow;
      this.ctx.beginPath();
      this.ctx.arc(coreX, coreY, coreRad * 2.2, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(coreX, coreY, coreRad * 0.65, 0, Math.PI * 2);
      this.ctx.fill();

      // Rotating magnetic rings
      this.ctx.strokeStyle = '#c084fc';
      this.ctx.lineWidth = 2.4;
      this.ctx.beginPath();
      this.ctx.ellipse(coreX, coreY, coreRad * 1.6, coreRad * 0.45, this.animTime * 1.5, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.beginPath();
      this.ctx.ellipse(coreX, coreY, coreRad * 1.4, coreRad * 0.4, -this.animTime * 1.8, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      // Tesla Coil Towers & Branching Lightning Arcs (0.07x)
      this.ctx.save();
      const p1 = (this.cameraX * 0.07) % 320;
      for (let tx = -p1 - 160; tx < w + 200; tx += 120) {
        const th = 110 + Math.sin(tx * 0.05) * 35;
        this.ctx.fillStyle = '#160524';
        this.ctx.fillRect(tx + 18, h - th - 30, 14, th + 30);
        // Toroid top
        this.ctx.fillStyle = '#c084fc';
        this.ctx.beginPath();
        this.ctx.ellipse(tx + 25, h - th - 30, 18, 7, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Lightning arc between coils
        if (Math.sin(this.animTime * 8 + tx) > 0.4) {
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1.6;
          this.ctx.shadowColor = '#00f0ff';
          this.ctx.shadowBlur = 10;
          this.ctx.beginPath();
          this.ctx.moveTo(tx + 25, h - th - 30);
          this.ctx.lineTo(tx + 55, h - th - 45);
          this.ctx.lineTo(tx + 95, h - th - 25);
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;
        }
      }
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#c084fc');
      this.drawThematicWatermark(w, h, 'PLASMA REACTOR', 'OVERCLOCK 11', '#c084fc', '#00f0ff');
    }

    // -------------------------------------------------------------------------
    // LEVEL 12: CONVEYOR HAZARD (Automated Heavy Steel Megafactory)
    // -------------------------------------------------------------------------
    drawLevel12Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a0604');
      grad.addColorStop(0.4, '#261207');
      grad.addColorStop(0.78, '#592207');
      grad.addColorStop(1, '#943505');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Overhead Molten Steel Ladle Pouring Liquid Fire
      this.ctx.save();
      const ladleX = w * 0.70 - (this.cameraX * 0.02) % (w * 0.5);
      const ladleY = h * 0.20;
      this.ctx.fillStyle = '#2b1004';
      this.ctx.fillRect(ladleX - 28, ladleY - 20, 56, 32);

      // Cascading ribbon of glowing molten steel
      const steelGrad = this.ctx.createLinearGradient(ladleX, ladleY, ladleX, h);
      steelGrad.addColorStop(0, '#ffffff');
      steelGrad.addColorStop(0.4, '#ffaa00');
      steelGrad.addColorStop(1, '#ff3b30');
      this.ctx.fillStyle = steelGrad;
      this.ctx.fillRect(ladleX - 5, ladleY + 12, 10, h - ladleY);
      this.ctx.restore();

      // Factory Smokestacks belching dark smoke (0.04x)
      this.ctx.save();
      const p1 = (this.cameraX * 0.04) % 360;
      for (let sx = -p1 - 180; sx < w + 200; sx += 90) {
        const sh = 120 + Math.sin(sx * 0.05) * 45;
        this.ctx.fillStyle = '#1c0903';
        this.ctx.fillRect(sx, h - sh - 40, 32, sh + 40);
        // Smoke plume
        this.ctx.fillStyle = 'rgba(20, 10, 5, 0.45)';
        this.ctx.beginPath();
        this.ctx.arc(sx + 16, h - sh - 55, 18, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();

      // Automated Overhead Cranes & Cables (0.07x)
      this.ctx.save();
      const gantryY = h * 0.42;
      this.ctx.strokeStyle = '#3d1606';
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(0, gantryY);
      this.ctx.lineTo(w, gantryY);
      this.ctx.stroke();

      const craneX = ((this.animTime * 60 - this.cameraX * 0.07) % (w + 200)) - 100;
      this.ctx.fillStyle = '#ff6b00';
      this.ctx.fillRect(craneX, gantryY, 32, 16);
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(craneX + 16, gantryY + 16);
      this.ctx.lineTo(craneX + 16, gantryY + 65);
      this.ctx.stroke();
      this.ctx.fillStyle = '#ffee55';
      this.ctx.fillRect(craneX + 6, gantryY + 65, 20, 8); // glowing steel block
      this.ctx.restore();

      // Showers of Welding Sparks
      this.ctx.save();
      for (let sp = 0; sp < 25; sp++) {
        const spx = ((sp * 73.3 + this.animTime * 90 - this.cameraX * 0.1) % (w + 40)) - 20;
        const spy = (sp * 41.7 + this.animTime * 180) % (h * 0.85);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(spx, spy, 2.2, 3.5);
      }
      this.ctx.restore();

      this.drawThematicWatermark(w, h, 'HEAVY SMELTER', 'CONVEYOR HAZARD 12', '#ff6b00', '#ffee00');
    }

    // -------------------------------------------------------------------------
    // LEVEL 13: DATA STREAM (Pure Cyberspace Matrix Dimension)
    // -------------------------------------------------------------------------
    drawLevel13Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#000502');
      grad.addColorStop(0.45, '#00170a');
      grad.addColorStop(1, '#003a16');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Rotating Holographic Wireframe Cyber-Sphere
      this.ctx.save();
      const spX = w * 0.72 - (this.cameraX * 0.02) % (w * 0.5);
      const spY = h * 0.22;
      const spRad = 48;
      const rot = this.animTime * 0.8;

      this.ctx.strokeStyle = '#00ff66';
      this.ctx.lineWidth = 1.8;
      this.ctx.shadowColor = '#00ff66';
      this.ctx.shadowBlur = 12;
      this.ctx.beginPath();
      this.ctx.arc(spX, spY, spRad, 0, Math.PI * 2);
      this.ctx.stroke();
      // Longitude rings
      this.ctx.beginPath();
      this.ctx.ellipse(spX, spY, spRad * Math.abs(Math.cos(rot)), spRad, 0, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.ellipse(spX, spY, spRad, spRad * Math.abs(Math.sin(rot)), 0, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
      this.ctx.restore();

      // Infinite Vector Mountain Wireframe (0.03x)
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.45)';
      this.ctx.lineWidth = 1.4;
      const p1 = (this.cameraX * 0.03) % 400;
      this.ctx.beginPath();
      this.ctx.moveTo(-100, h * 0.65);
      for (let vx = -p1 - 200; vx < w + 200; vx += 60) {
        const vy = h * 0.45 + Math.sin(vx * 0.03) * 50;
        this.ctx.lineTo(vx, vy);
      }
      this.ctx.stroke();
      this.ctx.restore();

      // Streaming Alphanumeric Matrix Rain Columns
      this.ctx.save();
      this.ctx.fillStyle = '#00ff66';
      this.ctx.font = '11px monospace';
      const matrixChars = ['0', '1', 'F', 'X', 'A', '8', 'E', '4'];
      for (let c = 0; c < 35; c++) {
        const colX = ((c * 58.3 - this.cameraX * 0.06) % (w + 40)) - 20;
        const headY = (this.animTime * 140 + c * 37) % (h + 100) - 50;
        for (let j = 0; j < 7; j++) {
          const cy = headY - j * 13;
          if (cy > 0 && cy < h) {
            this.ctx.globalAlpha = Math.max(0, 0.9 - j * 0.13);
            this.ctx.fillText(matrixChars[(c + j) % matrixChars.length], colX, cy);
          }
        }
      }
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#00ff66');
      this.drawThematicWatermark(w, h, 'CYBERSPACE VOID', 'DATA STREAM 13', '#00ff66', '#00f0ff');
    }

    // -------------------------------------------------------------------------
    // LEVEL 14: GLITCH VECTOR (Corrupted Memory & Chromatic Void)
    // -------------------------------------------------------------------------
    drawLevel14Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#08000d');
      grad.addColorStop(0.45, '#23002f');
      grad.addColorStop(0.82, '#48004f');
      grad.addColorStop(1, '#690059');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Fractured Glitch Sun with Chromatic Aberration & Slice Displacements
      this.ctx.save();
      const gSunX = w * 0.72 - (this.cameraX * 0.02) % (w * 0.5);
      const gSunY = h * 0.24;
      const gRad = 48;

      // Chromatic Red slice
      this.ctx.fillStyle = '#f43f5e';
      this.ctx.beginPath();
      this.ctx.arc(gSunX - 4, gSunY, gRad, 0, Math.PI * 2);
      this.ctx.fill();
      // Chromatic Cyan slice
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.beginPath();
      this.ctx.arc(gSunX + 4, gSunY, gRad, 0, Math.PI * 2);
      this.ctx.fill();
      // Main core
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(gSunX, gSunY, gRad * 0.85, 0, Math.PI * 2);
      this.ctx.fill();

      // Random glitch slice displacement bars
      this.ctx.fillStyle = '#08000d';
      for (let sl = -3; sl <= 3; sl++) {
        if (Math.sin(this.animTime * 12 + sl) > 0.3) {
          const sy = gSunY + sl * 12;
          this.ctx.fillRect(gSunX - gRad - 15, sy, (gRad + 15) * 2, 4);
        }
      }
      this.ctx.restore();

      // Floating Corrupted Memory Blocks (0.06x)
      this.ctx.save();
      const p1 = (this.cameraX * 0.06) % 300;
      for (let bx = -p1 - 150; bx < w + 200; bx += 80) {
        const by = h * 0.48 + Math.sin(this.animTime * 2 + bx) * 20;
        this.ctx.fillStyle = '#1a0026';
        this.ctx.fillRect(bx, by, 34, 34);
        this.ctx.strokeStyle = '#f43f5e';
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(bx, by, 34, 34);
      }
      this.ctx.restore();

      // Horizontal Chromatic Glitch Scanline Tears
      this.ctx.save();
      for (let t = 0; t < 6; t++) {
        const tearY = (t * 79 + this.animTime * 180) % h;
        if (Math.sin(this.animTime * 8 + t) > 0.4) {
          this.ctx.fillStyle = t % 2 === 0 ? 'rgba(0, 240, 255, 0.4)' : 'rgba(244, 63, 94, 0.4)';
          this.ctx.fillRect(0, tearY, w, 2.5);
        }
      }
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#f43f5e');
      this.drawThematicWatermark(w, h, 'GLITCH REALM', 'GLITCH VECTOR 14', '#f43f5e', '#00f0ff');
    }

    // -------------------------------------------------------------------------
    // LEVEL 15: SYNTAX SPRINT (Hyper-Speed Fiber Highway & Light Tunnels)
    // -------------------------------------------------------------------------
    drawLevel15Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#010514');
      grad.addColorStop(0.42, '#03173b');
      grad.addColorStop(0.8, '#093675');
      grad.addColorStop(1, '#0e5fa8');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Infinite Horizon Light Tunnel Core
      this.ctx.save();
      const vanX = w * 0.5 - (this.cameraX * 0.01) % 100;
      const vanY = h * 0.48;

      const vGlow = this.ctx.createRadialGradient(vanX, vanY, 5, vanX, vanY, 160);
      vGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      vGlow.addColorStop(0.3, 'rgba(6, 182, 212, 0.6)');
      vGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = vGlow;
      this.ctx.beginPath();
      this.ctx.arc(vanX, vanY, 160, 0, Math.PI * 2);
      this.ctx.fill();

      // Hyper-Speed Laser Rays Converging into Vanishing Point
      this.ctx.strokeStyle = '#06b6d4';
      this.ctx.lineWidth = 1.5;
      for (let r = 0; r < 14; r++) {
        const ang = (Math.PI * 2 / 14) * r + this.animTime * 0.4;
        this.ctx.beginPath();
        this.ctx.moveTo(vanX, vanY);
        this.ctx.lineTo(vanX + Math.cos(ang) * w, vanY + Math.sin(ang) * w);
        this.ctx.stroke();
      }
      this.ctx.restore();

      // High-Velocity Forward Speed Streaks
      this.ctx.save();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2.2;
      for (let s = 0; s < 30; s++) {
        const progress = ((this.animTime * 1.8 + s * 0.1) % 1);
        const dist = progress * Math.max(w, h) * 0.7;
        const sAng = s * 2.39;
        const sx = w * 0.5 + Math.cos(sAng) * dist;
        const sy = h * 0.48 + Math.sin(sAng) * dist;
        this.ctx.globalAlpha = progress * 0.8;
        this.ctx.beginPath();
        this.ctx.moveTo(sx, sy);
        this.ctx.lineTo(sx - Math.cos(sAng) * 35 * progress, sy - Math.sin(sAng) * 35 * progress);
        this.ctx.stroke();
      }
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#06b6d4');
      this.drawThematicWatermark(w, h, 'DATA HIGHWAY', 'SYNTAX SPRINT 15', '#06b6d4', '#38bdf8');
    }

    // -------------------------------------------------------------------------
    // LEVEL 16: HYPERSPACE BEAT (Synthwave Outrun Sunset & Audio Equalizer)
    // -------------------------------------------------------------------------
    drawLevel16Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a0017');
      grad.addColorStop(0.28, '#2a0044');
      grad.addColorStop(0.55, '#6a0258');
      grad.addColorStop(0.82, '#b31540');
      grad.addColorStop(1, '#eb5828');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Iconic Retrowave Segmented Sun
      this.ctx.save();
      const sX = w * 0.72 - (this.cameraX * 0.02) % (w * 0.5);
      const sY = h * 0.38;
      const sRad = 58;

      const sGrad = this.ctx.createLinearGradient(sX, sY - sRad, sX, sY + sRad);
      sGrad.addColorStop(0, '#ffee44');
      sGrad.addColorStop(0.5, '#fb7185');
      sGrad.addColorStop(1, '#9f1239');
      this.ctx.fillStyle = sGrad;
      this.ctx.beginPath();
      this.ctx.arc(sX, sY, sRad, 0, Math.PI * 2);
      this.ctx.fill();

      // Blind cuts
      this.ctx.fillStyle = '#2a0044';
      for (let s = 10; s < sRad * 2; s += 9) {
        if (s > sRad * 0.5) {
          const cutY = sY - sRad + s;
          this.ctx.fillRect(sX - sRad - 5, cutY, (sRad + 5) * 2, 3);
        }
      }
      this.ctx.restore();

      // Neon Wireframe Mountain Silhouette (0.03x)
      this.ctx.save();
      this.ctx.fillStyle = '#150024';
      this.ctx.strokeStyle = '#fb7185';
      this.ctx.lineWidth = 1.8;
      const p1 = (this.cameraX * 0.03) % 400;
      this.ctx.beginPath();
      this.ctx.moveTo(-100, h);
      for (let mx = -p1 - 200; mx < w + 200; mx += 70) {
        const my = h * 0.48 + Math.sin(mx * 0.04) * 45;
        this.ctx.lineTo(mx, my);
      }
      this.ctx.lineTo(w + 100, h);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();

      // Giant Graphic Equalizer Bars Rising on Horizon
      this.ctx.save();
      const barW = 8;
      const gap = 4;
      const totalBars = Math.floor(w / (barW + gap));
      for (let b = 0; b < totalBars; b++) {
        const bx = b * (barW + gap);
        const eqHeight = Math.abs(Math.sin(this.animTime * 6 + b * 0.3)) * 45 + 10;
        const eqGrad = this.ctx.createLinearGradient(bx, h - 35 - eqHeight, bx, h - 35);
        eqGrad.addColorStop(0, '#ffee44');
        eqGrad.addColorStop(0.5, '#fb7185');
        eqGrad.addColorStop(1, '#7e22ce');
        this.ctx.fillStyle = eqGrad;
        this.ctx.globalAlpha = 0.55;
        this.ctx.fillRect(bx, h - 35 - eqHeight, barW, eqHeight);
      }
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#fb7185');
      this.drawThematicWatermark(w, h, 'SYNTHWAVE NEON', 'HYPERSPACE BEAT 16', '#fb7185', '#ffaa00');
    }

    // -------------------------------------------------------------------------
    // LEVEL 17: FORGOTTEN NEXUS (Astral Starlight Citadel & Floating Classical Ruins)
    // -------------------------------------------------------------------------
    drawLevel17Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#03020e');
      grad.addColorStop(0.42, '#110936');
      grad.addColorStop(0.8, '#26185c');
      grad.addColorStop(1, '#472d8a');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Sacred Starlight Constellation Eye
      this.ctx.save();
      const eyeX = w * 0.74 - (this.cameraX * 0.02) % (w * 0.5);
      const eyeY = h * 0.22;
      const eyeRad = 46;

      const aGlow = this.ctx.createRadialGradient(eyeX, eyeY, eyeRad * 0.3, eyeX, eyeY, eyeRad * 2);
      aGlow.addColorStop(0, 'rgba(129, 140, 248, 0.4)');
      aGlow.addColorStop(0.7, 'rgba(192, 132, 252, 0.15)');
      aGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = aGlow;
      this.ctx.beginPath();
      this.ctx.arc(eyeX, eyeY, eyeRad * 2, 0, Math.PI * 2);
      this.ctx.fill();

      // Constellation Star Points
      this.ctx.strokeStyle = '#818cf8';
      this.ctx.lineWidth = 1.8;
      this.ctx.beginPath();
      for (let p = 0; p < 8; p++) {
        const ang = (Math.PI * 2 / 8) * p + this.animTime * 0.3;
        const px = eyeX + Math.cos(ang) * eyeRad;
        const py = eyeY + Math.sin(ang) * eyeRad;
        if (p === 0) this.ctx.moveTo(px, py);
        else this.ctx.lineTo(px, py);
      }
      this.ctx.closePath();
      this.ctx.stroke();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(eyeX, eyeY, 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      // Floating Classical Temple Ruins & Broken Columns (0.07x)
      this.ctx.save();
      const p1 = (this.cameraX * 0.07) % 340;
      for (let rx = -p1 - 170; rx < w + 200; rx += 110) {
        const ry = h * 0.50 + Math.sin(this.animTime * 1.6 + rx) * 16;
        this.ctx.fillStyle = '#171138';
        this.ctx.fillRect(rx, ry, 65, 14); // floating architrave
        this.ctx.fillRect(rx + 8, ry + 14, 12, 50); // Column 1
        this.ctx.fillRect(rx + 45, ry + 14, 12, 35); // Broken Column 2
        // Glowing glyph
        this.ctx.fillStyle = '#818cf8';
        this.ctx.globalAlpha = 0.6 + Math.sin(this.animTime * 3 + rx) * 0.3;
        this.ctx.fillRect(rx + 11, ry + 25, 6, 6);
      }
      this.ctx.restore();

      // Gentle Upward Streams of Stardust
      this.ctx.save();
      for (let d = 0; d < 35; d++) {
        const dx = ((d * 113.3 - this.cameraX * 0.1) % (w + 40)) - 20;
        const dy = (d * 73.1 - this.animTime * 35) % h;
        const actY = dy < 0 ? dy + h : dy;
        this.ctx.fillStyle = d % 2 === 0 ? '#818cf8' : '#ffffff';
        this.ctx.globalAlpha = 0.4 + Math.sin(this.animTime * 3 + d) * 0.4;
        this.ctx.fillRect(dx, actY, 2, 2);
      }
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#818cf8');
      this.drawThematicWatermark(w, h, 'CELESTIAL TEMPLE', 'FORGOTTEN NEXUS 17', '#818cf8', '#c084fc');
    }

    // -------------------------------------------------------------------------
    // LEVEL 18: TITAN'S GATE (Cosmic Stargate & Ancient Titan Statues)
    // -------------------------------------------------------------------------
    drawLevel18Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#080401');
      grad.addColorStop(0.4, '#241305');
      grad.addColorStop(0.78, '#472608');
      grad.addColorStop(1, '#75410a');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Giant Cosmic Stargate Portal with Swirling Wormhole Vortex
      this.ctx.save();
      const gateX = w * 0.72 - (this.cameraX * 0.02) % (w * 0.5);
      const gateY = h * 0.25;
      const gRad = 54;

      const gAura = this.ctx.createRadialGradient(gateX, gateY, gRad * 0.3, gateX, gateY, gRad * 2);
      gAura.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
      gAura.addColorStop(0.7, 'rgba(245, 158, 11, 0.18)');
      gAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = gAura;
      this.ctx.beginPath();
      this.ctx.arc(gateX, gateY, gRad * 2, 0, Math.PI * 2);
      this.ctx.fill();

      // Stargate Outer Stone Ring
      this.ctx.strokeStyle = '#fbbf24';
      this.ctx.lineWidth = 6;
      this.ctx.beginPath();
      this.ctx.arc(gateX, gateY, gRad, 0, Math.PI * 2);
      this.ctx.stroke();

      // Swirling Wormhole Vortex
      this.ctx.save();
      this.ctx.translate(gateX, gateY);
      this.ctx.rotate(this.animTime * 2);
      for (let a = 0; a < 4; a++) {
        this.ctx.strokeStyle = a % 2 === 0 ? '#ffffff' : '#fbbf24';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, gRad * 0.7, a * (Math.PI / 2), a * (Math.PI / 2) + Math.PI / 3);
        this.ctx.stroke();
      }
      this.ctx.restore();
      this.ctx.restore();

      // Colossal Stone Titan Statues Standing Sentinel (0.05x)
      this.ctx.save();
      const p1 = (this.cameraX * 0.05) % 360;
      for (let tx = -p1 - 180; tx < w + 200; tx += 120) {
        const th = 130 + Math.sin(tx * 0.04) * 40;
        this.ctx.fillStyle = '#1c0f04';
        this.ctx.fillRect(tx, h - th - 40, 48, th + 40);
        // Head
        this.ctx.fillRect(tx + 8, h - th - 75, 32, 35);
        // Glowing golden eye slit
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.fillRect(tx + 14, h - th - 58, 20, 4);
      }
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#fbbf24');
      this.drawThematicWatermark(w, h, 'TITAN SANCTUARY', "TITAN'S GATE 18", '#fbbf24', '#ffaa00');
    }

    // -------------------------------------------------------------------------
    // LEVEL 19: CHRONO COLLAPSE (Supermassive Black Hole & Temporal Vortex)
    // -------------------------------------------------------------------------
    drawLevel19Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#020008');
      grad.addColorStop(0.42, '#0e001e');
      grad.addColorStop(0.78, '#24012e');
      grad.addColorStop(1, '#3d0233');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // Colossal Supermassive Black Hole with Gravitational Lensing Accretion Disk
      this.ctx.save();
      const holeX = w * 0.70 - (this.cameraX * 0.02) % (w * 0.5);
      const holeY = h * 0.26;
      const holeRad = 44;

      // Gravitational lensing outer accretion disk
      const lensGrad = this.ctx.createRadialGradient(holeX, holeY, holeRad * 0.8, holeX, holeY, holeRad * 2.3);
      lensGrad.addColorStop(0, '#ffffff');
      lensGrad.addColorStop(0.3, '#c084fc');
      lensGrad.addColorStop(0.7, '#a855f7');
      lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = lensGrad;
      this.ctx.beginPath();
      this.ctx.ellipse(holeX, holeY, holeRad * 2.3, holeRad * 0.7, -Math.PI / 8, 0, Math.PI * 2);
      this.ctx.fill();

      // The Absolute Singularity (Pure Void Core)
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(holeX, holeY, holeRad, 0, Math.PI * 2);
      this.ctx.fill();

      // Bright photon ring outline
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2.2;
      this.ctx.shadowColor = '#c084fc';
      this.ctx.shadowBlur = 16;
      this.ctx.beginPath();
      this.ctx.arc(holeX, holeY, holeRad, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
      this.ctx.restore();

      // Shattered Roman Numeral Clock Faces Drifting in Void (0.06x)
      this.ctx.save();
      const numerals = ['XII', 'III', 'VI', 'IX'];
      this.ctx.font = 'bold 20px serif';
      this.ctx.fillStyle = '#c084fc';
      for (let n = 0; n < 4; n++) {
        const nx = ((n * 240 - this.cameraX * 0.06) % (w + 200)) - 80;
        const ny = h * 0.44 + Math.sin(this.animTime * 1.5 + n) * 22;
        this.ctx.globalAlpha = 0.5 + Math.sin(this.animTime * 2 + n) * 0.3;
        this.ctx.fillText(numerals[n], nx, ny);
      }
      this.ctx.restore();

      // Relativistic Vertical Plasma Jet Beam
      this.ctx.save();
      const jetGrad = this.ctx.createLinearGradient(holeX, 0, holeX, h);
      jetGrad.addColorStop(0, 'rgba(192, 132, 252, 0.45)');
      jetGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
      jetGrad.addColorStop(1, 'rgba(192, 132, 252, 0.45)');
      this.ctx.fillStyle = jetGrad;
      this.ctx.fillRect(holeX - 2.5, 0, 5, h);
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#a855f7');
      this.drawThematicWatermark(w, h, 'TEMPORAL VORTEX', 'CHRONO COLLAPSE 19', '#a855f7', '#ff007f');
    }

    // -------------------------------------------------------------------------
    // LEVEL 20: THE CHRONO CORE (Master Quantum Singularity & Gyroscope Core)
    // -------------------------------------------------------------------------
    drawLevel20Background(w, h, theme) {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#04000d');
      grad.addColorStop(0.35, '#160529');
      grad.addColorStop(0.72, '#2e0b42');
      grad.addColorStop(1, '#112b45');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // The Master Chrono Core: 3 Concentric 3D Gyroscope Rings with Corona Flare
      this.ctx.save();
      const coreX = w * 0.72 - (this.cameraX * 0.02) % (w * 0.5);
      const coreY = h * 0.24;
      const coreRad = 52;
      const rot = this.animTime * 1.8;

      // Hyper-radiant corona flare
      const flare = this.ctx.createRadialGradient(coreX, coreY, coreRad * 0.2, coreX, coreY, coreRad * 2.4);
      flare.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      flare.addColorStop(0.3, 'rgba(0, 240, 255, 0.55)');
      flare.addColorStop(0.7, 'rgba(251, 191, 36, 0.25)');
      flare.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = flare;
      this.ctx.beginPath();
      this.ctx.arc(coreX, coreY, coreRad * 2.4, 0, Math.PI * 2);
      this.ctx.fill();

      // Singularity incandescent sphere
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(coreX, coreY, 18, 0, Math.PI * 2);
      this.ctx.fill();

      // Gyroscope Ring 1 (Gold)
      this.ctx.strokeStyle = '#fbbf24';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.ellipse(coreX, coreY, coreRad * 1.7, coreRad * 0.55, rot * 0.7, 0, Math.PI * 2);
      this.ctx.stroke();

      // Gyroscope Ring 2 (Cyan)
      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.lineWidth = 2.4;
      this.ctx.beginPath();
      this.ctx.ellipse(coreX, coreY, coreRad * 1.45, coreRad * 0.45, -rot * 0.9, 0, Math.PI * 2);
      this.ctx.stroke();

      // Gyroscope Ring 3 (Magenta)
      this.ctx.strokeStyle = '#ff007f';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.ellipse(coreX, coreY, coreRad * 1.2, coreRad * 0.38, rot * 1.3, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      // Colossal Cosmic Light Spires (0.03x)
      this.ctx.save();
      for (let s = 0; s < 3; s++) {
        const sx = ((s * 340 + 80 - this.cameraX * 0.03) % (w + 200)) - 100;
        const sGrad = this.ctx.createLinearGradient(sx, 0, sx + 20, h);
        sGrad.addColorStop(0, 'rgba(0, 240, 255, 0.35)');
        sGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.2)');
        sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = sGrad;
        this.ctx.fillRect(sx, 0, 24, h);
      }
      this.ctx.restore();

      // Floating Quantum Reality Crystals (0.07x)
      this.ctx.save();
      const p1 = (this.cameraX * 0.07) % 320;
      for (let cx = -p1 - 160; cx < w + 200; cx += 90) {
        const cy = h * 0.48 + Math.sin(this.animTime * 2 + cx) * 18;
        this.ctx.fillStyle = '#0e2444';
        this.ctx.fillRect(cx, cy, 26, 48);
        this.ctx.strokeStyle = '#00f0ff';
        this.ctx.lineWidth = 1.6;
        this.ctx.strokeRect(cx, cy, 26, 48);
      }
      this.ctx.restore();

      // Radial Cosmic Energy Ripple Waves
      this.ctx.save();
      const ripPhase = (this.animTime * 0.6) % 1;
      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = Math.max(0, 0.8 - ripPhase * 0.8);
      this.ctx.beginPath();
      this.ctx.arc(coreX, coreY, ripPhase * w * 0.5, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      this.drawHorizonGrid(w, h, '#00f0ff');
      this.drawThematicWatermark(w, h, 'MASTER SINGULARITY', 'THE CHRONO CORE 20', '#00f0ff', '#fbbf24');
    }

    // Shared Horizon Grid Helper
    drawHorizonGrid(w, h, color) {
      this.ctx.save();
      this.ctx.strokeStyle = color;
      this.ctx.globalAlpha = 0.12;
      this.ctx.lineWidth = 1;
      const gridY = h - 35;
      this.ctx.beginPath();
      this.ctx.moveTo(0, gridY);
      this.ctx.lineTo(w, gridY);
      this.ctx.stroke();
      const gridOffset = (this.cameraX * 0.25) % 40;
      for (let gx = -gridOffset; gx < w + 40; gx += 40) {
        this.ctx.beginPath();
        this.ctx.moveTo(gx, gridY);
        this.ctx.lineTo(gx + (gx - w / 2) * 0.4, h);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // Shared Thematic Watermark Helper
    drawThematicWatermark(w, h, realmTag, subTag, mainColor, accentColor) {
      this.ctx.save();
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const loopW = Math.max(w * 1.5, 800);
      const titleParallax = (this.cameraX * 0.14) % loopW;
      let titleX = (w * 0.5) - titleParallax;
      if (titleX < -350) titleX += loopW;

      this.ctx.font = '900 78px "Rajdhani", "Chakra Petch", sans-serif';
      this.ctx.shadowColor = mainColor;
      this.ctx.shadowBlur = 20;
      this.ctx.fillStyle = mainColor.replace(')', ', 0.1)').replace('rgb', 'rgba');
      this.ctx.fillText('Motion', titleX - 28, h * 0.34);

      this.ctx.shadowColor = accentColor;
      this.ctx.fillStyle = accentColor.replace(')', ', 0.18)').replace('rgb', 'rgba');
      this.ctx.fillText('X', titleX + 115, h * 0.34);

      this.ctx.shadowBlur = 0;
      this.ctx.font = '700 12px "Chakra Petch", monospace';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      this.ctx.fillText(`⚡ ${realmTag} • ${subTag} ⚡`, titleX + 30, h * 0.34 + 48);
      this.ctx.restore();
    }

    // =========================================================================
    // THEME-REACTIVE PLATFORM RENDERING
    // =========================================================================
    drawPlatform(plat, levelOrWorld) {
      const px = Math.round(plat.x);
      const py = Math.round(plat.y);
      const pw = plat.width;
      const ph = plat.height;

      const theme = getLevelTheme(levelOrWorld);
      const topCol = theme.topColor || '#00f0ff';

      this.ctx.save();

      // 1. Theme-Specific Body Gradient Fill
      const bodyGrad = this.ctx.createLinearGradient(px, py, px, py + ph);
      if (theme.bodyGrad && theme.bodyGrad.length >= 3) {
        bodyGrad.addColorStop(0, theme.bodyGrad[0]);
        bodyGrad.addColorStop(0.4, theme.bodyGrad[1]);
        bodyGrad.addColorStop(1, theme.bodyGrad[2]);
      } else if (theme.type === 'nature') {
        bodyGrad.addColorStop(0, '#0a2416');
        bodyGrad.addColorStop(0.4, '#06170e');
        bodyGrad.addColorStop(1, '#020905');
      } else if (theme.type === 'foundry' || theme.type === 'graveyard') {
        bodyGrad.addColorStop(0, '#240606');
        bodyGrad.addColorStop(0.4, '#140303');
        bodyGrad.addColorStop(1, '#080101');
      } else if (theme.type === 'space') {
        bodyGrad.addColorStop(0, '#0c172e');
        bodyGrad.addColorStop(0.4, '#070e1c');
        bodyGrad.addColorStop(1, '#03060d');
      } else if (theme.type === 'ruins' || theme.type === 'nexus') {
        bodyGrad.addColorStop(0, '#1f1308');
        bodyGrad.addColorStop(0.4, '#140c04');
        bodyGrad.addColorStop(1, '#080501');
      } else {
        bodyGrad.addColorStop(0, '#131c30');
        bodyGrad.addColorStop(0.4, '#0b1220');
        bodyGrad.addColorStop(1, '#04070e');
      }
      this.ctx.fillStyle = bodyGrad;
      this.ctx.fillRect(px, py, pw, ph);

      // 2. Beveled Border
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

      // 3. Hanging Nature Vines (for Nature Theme)
      if (theme.type === 'nature') {
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 1.2;
        this.ctx.globalAlpha = 0.5;
        for (let vx = px + 16; vx < px + pw - 10; vx += 22) {
          const vLen = 6 + Math.sin(vx * 0.1) * 4;
          this.ctx.beginPath();
          this.ctx.moveTo(vx, py + 4);
          this.ctx.lineTo(vx + Math.sin(this.animTime * 2 + vx) * 3, py + 4 + vLen);
          this.ctx.stroke();
        }
        this.ctx.globalAlpha = 1;
      }

      // 4. Moving Platform Directional Indicator
      if (plat.isMoving) {
        const pulse = (this.animTime * 4) % 1;
        this.ctx.fillStyle = topCol;
        this.ctx.globalAlpha = 0.6;
        const arrowX = px + pw / 2 + (plat.vx > 0 ? 1 : -1) * (pulse * 20 - 10);
        this.ctx.beginPath();
        this.ctx.arc(arrowX, py + 10, 2.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
      }

      // 5. Glowing Neon / Moss / Plasma Laser Surface Rim
      this.ctx.shadowColor = topCol;
      this.ctx.shadowBlur = 10;
      this.ctx.fillStyle = topCol;
      this.ctx.fillRect(px, py, pw, 3.5);

      // 6. Surface Top Highlight Line
      this.ctx.fillStyle = '#ffffff';
      this.ctx.globalAlpha = 0.8;
      this.ctx.fillRect(px + 2, py, pw - 4, 1.2);

      // 7. Corner Metallic Tech Brackets
      this.ctx.fillStyle = '#ffffff';
      this.ctx.globalAlpha = 0.9;
      this.ctx.fillRect(px, py, 3, 3);
      this.ctx.fillRect(px + pw - 3, py, 3, 3);

      this.ctx.restore();
    }

    drawHazard(haz) {
      this.ctx.save();
      if (haz.type === 'spikes') {
        const spikeW = 12;
        const count = Math.ceil(haz.width / spikeW);

        // Hazard Warning Baseplate with Diagonal Hazard Stripes
        this.ctx.fillStyle = '#10131d';
        this.ctx.fillRect(haz.x, haz.y + haz.height - 4, haz.width, 4);
        this.ctx.fillStyle = '#ffaa00';
        for (let bx = haz.x; bx < haz.x + haz.width; bx += 8) {
          this.ctx.fillRect(bx, haz.y + haz.height - 4, 3, 4);
        }

        // Razor Plasma Spikes with Glowing Radiant Gradient
        for (let i = 0; i < count; i++) {
          const sx = haz.x + i * spikeW;
          const tipX = sx + spikeW / 2;
          const tipY = haz.y;
          const baseY = haz.y + haz.height - 3;

          const spikeGrad = this.ctx.createLinearGradient(tipX, tipY, tipX, baseY);
          spikeGrad.addColorStop(0, '#ffee55');  // White-hot plasma tip
          spikeGrad.addColorStop(0.4, '#ff0055'); // Fiery plasma body
          spikeGrad.addColorStop(1, '#55001a');   // Obsidian base

          this.ctx.shadowColor = '#ff0055';
          this.ctx.shadowBlur = 12;
          this.ctx.fillStyle = spikeGrad;

          this.ctx.beginPath();
          this.ctx.moveTo(sx, baseY);
          this.ctx.lineTo(tipX, tipY);
          this.ctx.lineTo(sx + spikeW, baseY);
          this.ctx.closePath();
          this.ctx.fill();

          // Spike Center Hotline
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(tipX, tipY);
          this.ctx.lineTo(tipX, baseY - 2);
          this.ctx.stroke();
        }
      } else {
        // High-Energy Pulsing Laser Barrier
        const pulse = Math.sin(this.animTime * 12) * 0.2 + 0.8;
        this.ctx.shadowColor = '#ff007f';
        this.ctx.shadowBlur = 16;

        // Plasma Sheath
        this.ctx.fillStyle = `rgba(255, 0, 127, ${0.45 * pulse})`;
        this.ctx.fillRect(haz.x, haz.y, haz.width, haz.height);

        // Core White-Hot Laser Beam
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(haz.x, haz.y + haz.height / 2 - 1.5, haz.width, 3);

        // Laser Projector Brackets on Both Ends
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#222d48';
        this.ctx.fillRect(haz.x - 3, haz.y - 2, 4, haz.height + 4);
        this.ctx.fillRect(haz.x + haz.width - 1, haz.y - 2, 4, haz.height + 4);
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.fillRect(haz.x - 2, haz.y + haz.height / 2 - 2, 2, 4);
        this.ctx.fillRect(haz.x + haz.width, haz.y + haz.height / 2 - 2, 2, 4);
      }
      this.ctx.restore();
    }

    drawGoal(goal) {
      this.ctx.save();
      const gx = goal.x;
      const gy = goal.y;

      // 1. Twin Metallic Quantum Gateway Towers
      this.ctx.fillStyle = '#090e1c';
      this.ctx.fillRect(gx - 8, gy - 52, 6, 52);
      this.ctx.fillRect(gx + 22, gy - 52, 6, 52);

      // Gateway Conduit Lights
      this.ctx.shadowColor = '#00ff88';
      this.ctx.shadowBlur = 8;
      this.ctx.fillStyle = '#00ff88';
      this.ctx.fillRect(gx - 7, gy - 48, 4, 4);
      this.ctx.fillRect(gx - 7, gy - 26, 4, 4);
      this.ctx.fillRect(gx + 23, gy - 48, 4, 4);
      this.ctx.fillRect(gx + 23, gy - 26, 4, 4);

      // 2. Swirling Quantum Vortex Portal Core
      const portalX = gx + 10;
      const portalY = gy - 26;
      const spin = this.animTime * 3.5;

      // Outer Plasma Rings
      this.ctx.strokeStyle = '#00ff88';
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.ellipse(portalX, portalY, 14, 22, spin * 0.4, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.lineWidth = 1.8;
      this.ctx.beginPath();
      this.ctx.ellipse(portalX, portalY, 10, 18, -spin * 0.6, 0, Math.PI * 2);
      this.ctx.stroke();

      // Radiant Portal Vortex Core
      const coreGrad = this.ctx.createRadialGradient(portalX, portalY, 2, portalX, portalY, 14);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.4, 'rgba(0, 255, 136, 0.85)');
      coreGrad.addColorStop(0.8, 'rgba(0, 240, 255, 0.4)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = coreGrad;
      this.ctx.beginPath();
      this.ctx.arc(portalX, portalY, 14, 0, Math.PI * 2);
      this.ctx.fill();

      // 3. Floating Holographic "WARP // CLEAR" Indicator Ring
      this.ctx.shadowBlur = 6;
      this.ctx.strokeStyle = '#00ff88';
      this.ctx.lineWidth = 1.5;
      const holoY = gy - 62 + Math.sin(this.animTime * 4) * 3;
      this.ctx.beginPath();
      this.ctx.arc(portalX, holoY, 6, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(portalX - 2, holoY - 2, 4, 4);

      this.ctx.restore();
    }

    drawEnemy(e) {
      this.ctx.save();
      this.ctx.translate(Math.round(e.x), Math.round(e.y));
      if (e.facing === -1) this.ctx.scale(-1, 1);

      if (e.type === 'glitch_beetle') {
        // --- 1. GLITCH CYBER-BEETLE ---
        // Articulated Robotic Legs
        this.ctx.strokeStyle = '#1e2840';
        this.ctx.lineWidth = 2;
        const legWalk = Math.sin(this.animTime * 14) * 4;
        // 3 legs on each side
        for (let i = -1; i <= 1; i++) {
          const lx = i * 7;
          this.ctx.beginPath();
          this.ctx.moveTo(lx, 2);
          this.ctx.lineTo(lx - 2 + legWalk * i, 8);
          this.ctx.stroke();
        }

        // Armored Obsidian Chitin Shell
        this.ctx.fillStyle = '#080a14';
        this.ctx.fillRect(-12, -7, 24, 11);
        // Crimson Plating Segments
        this.ctx.fillStyle = '#6b1442';
        this.ctx.fillRect(-10, -6, 20, 4);
        this.ctx.fillRect(-10, 0, 18, 3);

        // Menacing Ruby Optical Sensor Visor
        this.ctx.shadowColor = '#ff0055';
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = '#ff0055';
        this.ctx.fillRect(6, -5, 6, 3);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(9, -5, 2, 2);

        // Glitch Arc Antennae
        this.ctx.strokeStyle = '#00f0ff';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(10, -7);
        this.ctx.lineTo(15, -11 + Math.sin(this.animTime * 12) * 2);
        this.ctx.stroke();

      } else if (e.type === 'patrol_drone') {
        // --- 2. PATROL RECON DRONE ---
        const hoverY = Math.sin(this.animTime * 5) * 4;

        // Rotating Gyro-Stabilizer Outer Ring
        this.ctx.strokeStyle = '#233050';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.ellipse(0, hoverY, 15, 6, this.animTime * 3, 0, Math.PI * 2);
        this.ctx.stroke();

        // Spherical Armored Core Body
        const droneGrad = this.ctx.createRadialGradient(0, hoverY - 2, 2, 0, hoverY, 11);
        droneGrad.addColorStop(0, '#243252');
        droneGrad.addColorStop(0.7, '#0f172a');
        droneGrad.addColorStop(1, '#050811');
        this.ctx.fillStyle = droneGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, hoverY, 10, 0, Math.PI * 2);
        this.ctx.fill();

        // Glowing Optical Camera Lens with Target Iris
        this.ctx.shadowColor = '#ff3344';
        this.ctx.shadowBlur = 12;
        this.ctx.fillStyle = '#ff3344';
        this.ctx.beginPath();
        this.ctx.arc(4, hoverY - 1, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(5, hoverY - 2, 2, 2);

        // Blue Ion Anti-Gravity Thruster Flame
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 8;
        this.ctx.fillStyle = '#00f0ff';
        const flameH = 4 + Math.random() * 4;
        this.ctx.beginPath();
        this.ctx.moveTo(-3, hoverY + 9);
        this.ctx.lineTo(0, hoverY + 9 + flameH);
        this.ctx.lineTo(3, hoverY + 9);
        this.ctx.closePath();
        this.ctx.fill();

      } else if (e.type === 'titan_guard') {
        // --- 3. HEAVY TITAN MECH ENFORCER ---
        // Armored Legs
        this.ctx.fillStyle = '#0c1222';
        this.ctx.fillRect(-10, 2, 7, 10);
        this.ctx.fillRect(3, 2, 7, 10);
        // Heavy Foot Pads
        this.ctx.fillStyle = '#1c2842';
        this.ctx.fillRect(-12, 10, 10, 4);
        this.ctx.fillRect(2, 10, 10, 4);

        // Armored Torso with Blast Plates
        this.ctx.fillStyle = '#1a243d';
        this.ctx.fillRect(-14, -14, 28, 18);
        this.ctx.fillStyle = '#0f1728';
        this.ctx.fillRect(-12, -12, 24, 7);

        // Glowing Golden Core Reactor
        this.ctx.shadowColor = '#ffaa00';
        this.ctx.shadowBlur = 12;
        this.ctx.fillStyle = '#ffaa00';
        this.ctx.fillRect(-3, -8, 6, 6);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(-1, -6, 2, 2);

        // Menacing Visor Slit
        this.ctx.fillStyle = '#ff3344';
        this.ctx.fillRect(4, -12, 8, 3);

        // Power Fist Gauntlet
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 8;
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.fillRect(12, -6, 5, 8);
      } else {
        // Fallback Cyber Sphere
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 12, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    drawShadowGhost(g, alpha) {
      this.ctx.save();
      this.ctx.translate(Math.round(g.x), Math.round(g.y));
      const s = g.scale || 1.5;
      if (g.facing === -1) this.ctx.scale(-s, s);
      else this.ctx.scale(s, s);

      this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      // Pure deep shadow silhouette
      this.ctx.fillStyle = '#050811';
      // Hood & Body
      this.ctx.fillRect(-6, -18, 12, 22);
      // Flowing scarf ghost
      this.ctx.fillRect(-16, -6, 11, 7);
      // Legs
      this.ctx.fillRect(-5, 4, 4, 8);
      this.ctx.fillRect(2, 4, 4, 8);

      // Sword in hand silhouette
      this.ctx.fillStyle = '#070c18';
      this.ctx.fillRect(5, -4, 16, 2.5);

      // Ethereal glowing eye remnant
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.fillRect(1, -16, 4, 2);

      this.ctx.restore();
    }

    drawPlayer(p, targetCtx = this.ctx) {
      const ctx = targetCtx;
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));
      const visualScale = p.scale || 1.5;
      if (p.facing === -1) ctx.scale(-visualScale, visualScale);
      else ctx.scale(visualScale, visualScale);

      let bobY = 0;
      if (p.state === 'walk') bobY = Math.sin(this.animTime * 14) * 2;
      else if (p.state === 'idle') bobY = Math.sin(this.animTime * 4) * 1;
      else if (p.state === 'jump') bobY = -2;
      else if (p.state === 'fall') bobY = 2;

      // Invulnerability flicker & cyan force-shield bubble after taking damage
      if (p.invulnerableTimer > 0) {
        if (Math.floor(this.animTime * 16) % 2 === 0) {
          ctx.globalAlpha = 0.45;
        }
        ctx.save();
        const shieldPulse = Math.sin(this.animTime * 12) * 2;
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, bobY - 4, 25 + shieldPulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 1. SHADOW AURA (Dark void mist pulsing subtly behind the silhouette)
      ctx.save();
      const auraPulse = Math.sin(this.animTime * 6) * 1.5;
      const auraGrad = ctx.createRadialGradient(0, bobY - 4, 4, 0, bobY - 4, 24 + auraPulse);
      auraGrad.addColorStop(0, 'rgba(5, 7, 15, 0.5)');
      auraGrad.addColorStop(0.65, 'rgba(0, 240, 255, 0.09)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, bobY - 4, 26 + auraPulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. EMPTY SCABBARD / SAYA ON BACK (Sword drawn into hand)
      ctx.save();
      ctx.strokeStyle = '#05070e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-9, bobY - 14);
      ctx.lineTo(6, bobY + 4);
      ctx.stroke();
      // Scabbard Gold Fittings
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(-10, bobY - 15, 3, 2);
      ctx.fillRect(4, bobY + 3, 3, 2);
      ctx.restore();

      // 3. FLOWING SHADOW NINJA SCARF / HEADBAND RIBBONS (Dual flowing torn streamers)
      ctx.save();
      const wave1 = Math.sin(this.animTime * 12) * 3;
      const wave2 = Math.cos(this.animTime * 10) * 4;

      // Upper Shadow Ribbon
      ctx.fillStyle = '#0a0d18';
      ctx.beginPath();
      ctx.moveTo(-4, bobY - 8);
      ctx.quadraticCurveTo(-14, bobY - 4 + wave1, -22, bobY - 1 + wave1);
      ctx.lineTo(-20, bobY + 3 + wave1);
      ctx.quadraticCurveTo(-12, bobY + wave1, -3, bobY - 5);
      ctx.closePath();
      ctx.fill();

      // Scarf Glowing Cyan Luminous Edge
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-4, bobY - 8);
      ctx.quadraticCurveTo(-14, bobY - 4 + wave1, -22, bobY - 1 + wave1);
      ctx.stroke();

      // Lower Shadow Ribbon
      ctx.fillStyle = '#05070f';
      ctx.beginPath();
      ctx.moveTo(-5, bobY - 5);
      ctx.quadraticCurveTo(-16, bobY + 3 + wave2, -26, bobY + 8 + wave2);
      ctx.lineTo(-24, bobY + 12 + wave2);
      ctx.quadraticCurveTo(-14, bobY + 6 + wave2, -4, bobY - 2);
      ctx.closePath();
      ctx.fill();

      // Lower Ribbon Crimson Accent Edge
      ctx.strokeStyle = 'rgba(255, 0, 127, 0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-5, bobY - 5);
      ctx.quadraticCurveTo(-16, bobY + 3 + wave2, -26, bobY + 8 + wave2);
      ctx.stroke();
      ctx.restore();

      // 4. SHADOW LEGS & NINJA TABI BOOTS
      ctx.fillStyle = '#080a12'; // Obsidian shinobi trousers
      if (p.state === 'walk') {
        const legSwing = Math.sin(this.animTime * 14) * 4;
        ctx.fillRect(-6 + legSwing, bobY + 4, 4, 8);
        ctx.fillRect(2 - legSwing, bobY + 4, 4, 8);
        ctx.fillStyle = '#161c2e';
        ctx.fillRect(-6 + legSwing, bobY + 9, 5, 3);
        ctx.fillRect(2 - legSwing, bobY + 9, 5, 3);
      } else {
        ctx.fillRect(-5, bobY + 4, 4, 8);
        ctx.fillRect(2, bobY + 4, 4, 8);
        ctx.fillStyle = '#161c2e';
        ctx.fillRect(-5, bobY + 9, 5, 3);
        ctx.fillRect(2, bobY + 9, 5, 3);
      }

      // 5. SHADOW GI TORSO & SHINOBI ARMOR
      ctx.fillStyle = '#0a0d17';
      ctx.fillRect(-6, bobY - 8, 12, 12);
      ctx.fillStyle = '#141a2b';
      ctx.fillRect(-5, bobY - 7, 10, 3);
      ctx.fillRect(-5, bobY - 2, 10, 2);
      // Shinobi Sash / Belt with Void Gem
      ctx.fillStyle = '#1f273d';
      ctx.fillRect(-6, bobY + 2, 12, 3);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(-1, bobY + 2, 3, 3);

      // 6. SHADOW NINJA HOOD / COWL & MASK
      ctx.fillStyle = '#05070e';
      ctx.beginPath();
      ctx.moveTo(-6, bobY - 8);
      ctx.lineTo(-6, bobY - 18);
      ctx.lineTo(-4, bobY - 20); // Horn/peak
      ctx.lineTo(2, bobY - 20);
      ctx.lineTo(5, bobY - 18);
      ctx.lineTo(5, bobY - 8);
      ctx.closePath();
      ctx.fill();

      // Shinobi Face Mask
      ctx.fillStyle = '#0e1220';
      ctx.fillRect(-4, bobY - 13, 9, 6);

      // 7. PIERCING SHADOW EYES (Signature glowing phantom cyan gaze)
      ctx.save();
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 9;
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(0, bobY - 16, 5, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, bobY - 16, 2, 2);
      // Eye energy streak
      if (Math.abs(p.vx) > 0.4 || p.state === 'attack') {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
        ctx.fillRect(-4, bobY - 16, 4, 1.5);
      }
      ctx.restore();

      // 8. BACK ARM & GAUNTLET (Balance stance)
      ctx.fillStyle = '#080b15';
      ctx.fillRect(-7, bobY - 7, 3, 7);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(-7, bobY - 4, 1.5, 3);

      // 9. ACTIVE SHADOW KATANA IN HAND (Combat-Ready Sword Wielding)
      ctx.save();
      const isAttacking = p.state === 'attack';
      let handX = 5;
      let handY = bobY - 1;
      let swordAngle = -0.45; // ~ -25 degrees forward combat stance

      if (isAttacking) {
        // High-speed slash swing rotation matching the blade arc
        const progress = Math.max(0, Math.min(1, 1 - (p.attackTimer / (p.attackDuration || 0.22))));
        if (p.attackType === 'cyclone') {
          swordAngle = progress * Math.PI * 4;
        } else if (p.attackType === 'heavy') {
          swordAngle = -Math.PI / 3 + progress * (Math.PI * 0.9);
        } else {
          swordAngle = -Math.PI / 4 + progress * (Math.PI * 0.75);
        }
        handX = 6 + Math.cos(swordAngle) * 3;
        handY = bobY - 1 + Math.sin(swordAngle) * 3;
      } else if (p.state === 'walk') {
        swordAngle = -0.45 + Math.sin(this.animTime * 14) * 0.14;
      } else if (p.state === 'jump' || p.state === 'fall') {
        swordAngle = p.vy < 0 ? -0.7 : -0.25;
      }

      ctx.translate(handX, handY);
      ctx.rotate(swordAngle);

      // A. Tsuka (Katana Hilt) & Gold Pommel (Kashira)
      ctx.fillStyle = '#ffaa00'; // Gold pommel
      ctx.fillRect(-8, -1.5, 2, 3);
      ctx.fillStyle = '#070a14'; // Obsidian hilt
      ctx.fillRect(-6, -1.5, 6, 3);
      // Cyan Ito Diamond Cord Wraps
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(-5, -1, 1.5, 2);
      ctx.fillRect(-2.5, -1, 1.5, 2);

      // B. Tsuba (Circular Gold Guard)
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(0, -3.5, 2, 7);

      // C. Razor Katana Blade (Dark-Matter Steel + Glowing Neon Cutting Edge)
      const bladeLen = 25;
      // Dark Spine (Mune)
      ctx.fillStyle = '#060812';
      ctx.beginPath();
      ctx.moveTo(2, -1.5);
      ctx.lineTo(bladeLen, -0.5);
      ctx.lineTo(bladeLen + 4, 0); // Kissaki Curved Tip
      ctx.lineTo(bladeLen, 1.5);
      ctx.lineTo(2, 1.5);
      ctx.closePath();
      ctx.fill();

      // Glowing Neon Cutting Edge with Real-Time Bloom
      ctx.save();
      const edgeCol = isAttacking
        ? (p.attackType === 'heavy' ? '#ffaa00' : (p.attackType === 'cyclone' ? '#9d00ff' : '#00f0ff'))
        : '#00f0ff';
      ctx.shadowColor = edgeCol;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = edgeCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(2, 1.5);
      ctx.lineTo(bladeLen, 1.5);
      ctx.lineTo(bladeLen + 4, 0);
      ctx.stroke();

      // Luminous Blade Polish Line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.lineTo(bladeLen + 2, 0);
      ctx.stroke();

      // Shimmering Energy Spark Sheen Moving Down the Blade
      const sheenPos = (this.animTime * 35) % (bladeLen + 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sheenPos, -0.5, 3, 1.2);
      ctx.restore();

      ctx.restore(); // End sword rotation

      // 10. FRONT ARM & GAUNTLET (Holding the sword hilt)
      ctx.fillStyle = '#090d1a';
      ctx.fillRect(3, bobY - 6, 4, 7);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(4.5, bobY - 4, 2, 3);
      // Hand Knuckles Wrapping the Katana Hilt
      ctx.fillStyle = '#161e32';
      ctx.fillRect(handX - 2, handY - 2, 4, 4);

      // 11. SHADOW BLADE ATTACK SLASH ARCS
      if (p.state === 'attack') {
        ctx.save();
        if (p.attackType === 'cyclone') {
          // 360-degree Shadow Void Vortex
          ctx.shadowColor = '#9d00ff';
          ctx.shadowBlur = 14;
          ctx.strokeStyle = '#050711';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(0, bobY - 4, 32, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#9d00ff';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, bobY - 4, 34, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.attackType === 'heavy') {
          // Heavy Shadow Cleave
          ctx.shadowColor = '#ffaa00';
          ctx.shadowBlur = 16;
          ctx.strokeStyle = '#070914';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(14, bobY - 4, 34, -Math.PI / 3, Math.PI / 2);
          ctx.stroke();

          ctx.strokeStyle = '#ff8800';
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.strokeStyle = '#ffea70';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        } else {
          // Swift Shadow Blade Crescent
          const edgeColor = p.attackType === 'right' ? '#ff007f' : '#00f0ff';
          ctx.shadowColor = edgeColor;
          ctx.shadowBlur = 12;

          ctx.strokeStyle = '#050710';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(12, bobY - 6, 28, -Math.PI / 4, Math.PI / 3);
          ctx.stroke();

          ctx.strokeStyle = edgeColor;
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();
    }

    renderAvatarPreview() {
      if (!this.avatarCtx || !this.avatarCanvas) return;
      this.avatarCtx.clearRect(0, 0, this.avatarCanvas.width, this.avatarCanvas.height);

      // Swirling Dark-Matter Radial Vignette
      const cx = this.avatarCanvas.width / 2;
      const cy = this.avatarCanvas.height / 2;
      const bgGrad = this.avatarCtx.createRadialGradient(cx, cy, 6, cx, cy, 56);
      bgGrad.addColorStop(0, 'rgba(0, 240, 255, 0.22)');
      bgGrad.addColorStop(0.45, 'rgba(10, 15, 30, 0.55)');
      bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.avatarCtx.fillStyle = bgGrad;
      this.avatarCtx.fillRect(0, 0, this.avatarCanvas.width, this.avatarCanvas.height);

      // Render Heroic Shadow Fighter Holding Sword Aloft
      const dummy = { x: 60, y: 64, width: 28, height: 38, scale: 2.1, facing: 1, state: 'idle' };
      this.drawPlayer(dummy, this.avatarCtx);
    }

    // --- MAIN GAME LOOP ---
    gameLoop(t) {
      const dt = Math.min((t - this.lastTimestamp) / 1000, 0.1);
      this.lastTimestamp = t;
      this.animTime += dt;

      if (this.state === 'PLAYING') {
        if (this.screenShake > 0) {
          this.screenShake -= dt * 10;
          if (this.screenShake < 0) this.screenShake = 0;
        }
        this.updateEntities(dt);
        this.updatePhysics(dt);
        this.updateParticles(dt);
        this.updateFloatingPopups(dt);
        if (this.damageFlashTimer > 0) {
          this.damageFlashTimer -= dt;
          if (this.damageFlashTimer < 0) this.damageFlashTimer = 0;
        }

        // Camera follow
        if (this.player) {
          const leadOffset = this.canvas.width * 0.40;
          const targetCamX = this.player.x - leadOffset;
          const maxCamX = Math.max(0, this.currentLevel.width - this.canvas.width);
          this.cameraX += (Math.max(0, Math.min(targetCamX, maxCamX)) - this.cameraX) * 0.16;

          const worldH = this.currentLevel.height || 540;
          let targetCamY = 0;
          if (worldH > this.canvas.height) {
            targetCamY = this.player.y - this.canvas.height * 0.55;
            const maxCamY = worldH - this.canvas.height;
            targetCamY = Math.max(0, Math.min(maxCamY, targetCamY));
          } else {
            targetCamY = -(this.canvas.height - worldH) / 2;
          }
          this.cameraY += (targetCamY - this.cameraY) * 0.16;
        }
      }

      this.render();

      if (this.state === 'MAIN_MENU') {
        this.renderAvatarPreview();
      }

      requestAnimationFrame((ts) => this.gameLoop(ts));
    }
  }

  let currentGameInstance = null;

  // =========================================================================
  // Top-Level Control Functions (Section 19 Requirements Specification)
  // =========================================================================
  function checkCollision(a, b) {
    if (currentGameInstance) return currentGameInstance.checkAABB(a, b);
    return false;
  }

  function failLevel(reason = 'obstacle') {
    if (currentGameInstance) currentGameInstance.failLevel(reason);
  }

  function completeLevel() {
    if (currentGameInstance) currentGameInstance.completeLevel();
  }

  function restartLevel(confirmed = false) {
    if (currentGameInstance) currentGameInstance.restartLevel(confirmed);
  }

  function nextLevel() {
    if (currentGameInstance) {
      const nextId = Math.min(20, currentGameInstance.currentLevelId + 1);
      currentGameInstance.startLevel(nextId);
    }
  }

  function unlockAllLevels() {
    gameStateData.unlockedLevel = 20;
    persistData();
    renderLevelSelectGrid();
  }

  // Expose all 22 required functions on window.PulseStrider and window (Section 22)
  window.PulseStrider = {
    initializeHandTracking,
    startCamera,
    stopCamera,
    detectHandGesture,
    detectPointDirection,
    isIndexFingerExtended,
    isFist,
    getGestureConfidence,
    smoothLandmarks,
    handleGesture,
    movePlayerLeft,
    movePlayerRight,
    movePlayerUp,
    movePlayerDown,
    stopPlayer,
    triggerAttack,
    checkAttackRange,
    updateAttackButton,
    failLevel,
    completeLevel,
    restartLevel,
    nextLevel,
    unlockAllLevels,
    movePlayer,
    saveBestAttempt,
    updatePlayerSpeedFromSettings,
    setPlayerSpeed,
    handleTwoHandGestures,
    detectLeftHandMovement,
    detectRightHandAttack,
    classifyTwoHands,
    getTwoHandState: () => ({
      left: leftConfirmedGesture,
      right: rightConfirmedGesture,
      leftDetected: leftHandDetected,
      rightDetected: rightHandDetected,
      handsCount: detectedHandsCount,
      leftLocked: handLockTracker.left.isLocked,
      rightLocked: handLockTracker.right.isLocked
    }),
    handLockTracker,
    getPlayer: () => (currentGameInstance ? currentGameInstance.player : null),
    getGameInstance: () => currentGameInstance
  };
  window.MotionX = window.PulseStrider;
  Object.assign(window, window.MotionX);

  // =========================================================================
  // 6. UI LEVEL SELECT GRID BUILDER
  // =========================================================================
  function renderLevelSelectGrid(filterWorld = null) {
    const scrollContainer = document.getElementById('level-cards-scroll');
    if (!scrollContainer) return;
    scrollContainer.innerHTML = '';

    LEVELS.forEach(lvl => {
      if (filterWorld && lvl.world !== filterWorld) return;

      const isUnlocked = true; // All 20 levels unlocked!
      const isCompleted = gameStateData.completedLevels.includes(lvl.id);
      const lvlCoins = gameStateData.levelCoins ? gameStateData.levelCoins[lvl.id] : undefined;

      const card = document.createElement('div');
      card.className = `level-item-card ${isCompleted ? 'completed' : ''}`;

      const theme = getLevelTheme(lvl.id);
      card.innerHTML = `
        <div class="card-top-row">
          <span class="item-num">LEVEL ${String(lvl.id).padStart(2, '0')}</span>
          <span class="theme-pill">${theme.icon} ${theme.themeTitle}</span>
        </div>
        <strong class="item-name">${lvl.name}</strong>
        <span class="item-status">${isCompleted ? '✓ COMPLETE' : 'READY'}</span>
        ${lvlCoins !== undefined ? `<span class="item-best">🪙 Coins: ${lvlCoins}</span>` : ''}
      `;

      card.addEventListener('click', () => {
        sound.playClick();
        gameStateData.lastPlayedLevel = lvl.id;
        persistData();
        currentGameInstance.startLevel(lvl.id);
      });

      scrollContainer.appendChild(card);
    });
  }

  // =========================================================================
  // 7. EVENT BINDINGS & USER INTERFACE HOOKS
  // =========================================================================
  function bindUIEvents(game) {
    // Menu Actions
    document.getElementById('btn-menu-enable-camera').addEventListener('click', async () => {
      sound.playClick();
      sound.ensureContext();
      if (!gameStateData.playerName) {
        openPlayerNameModal(() => {
          game.switchScreen('screen-camera-permission');
        });
        return;
      }
      game.switchScreen('screen-camera-permission');
    });

    document.getElementById('btn-menu-touch-play').addEventListener('click', () => {
      sound.playClick();
      sound.ensureContext();
      if (!gameStateData.playerName) {
        openPlayerNameModal(() => {
          gameStateData.settings.controlMode = 'touch';
          persistData();
          game.startLevel(gameStateData.lastPlayedLevel || 1);
        });
        return;
      }
      gameStateData.settings.controlMode = 'touch';
      persistData();
      game.startLevel(gameStateData.lastPlayedLevel || 1);
    });

    document.getElementById('btn-menu-level-select').addEventListener('click', () => {
      sound.playClick();
      renderLevelSelectGrid(1);
      game.switchScreen('screen-level-select');
    });

    document.getElementById('btn-menu-leaderboard').addEventListener('click', () => {
      sound.playClick();
      renderLeaderboard();
      game.switchScreen('screen-leaderboard');
    });

    document.getElementById('btn-menu-change-pilot').addEventListener('click', () => {
      sound.playClick();
      openPlayerNameModal();
    });

    document.getElementById('btn-menu-how-to-play').addEventListener('click', () => {
      sound.playClick();
      game.switchScreen('screen-how-to-play');
    });

    document.getElementById('btn-menu-settings').addEventListener('click', () => {
      sound.playClick();
      game.switchScreen('screen-settings');
    });

    // Leaderboard Screen Actions
    document.getElementById('btn-leaderboard-change-name').addEventListener('click', () => {
      sound.playClick();
      openPlayerNameModal(() => {
        renderLeaderboard();
      });
    });

    document.getElementById('btn-leaderboard-back').addEventListener('click', () => {
      sound.playClick();
      game.switchScreen('screen-main-menu');
    });

    document.getElementById('btn-leaderboard-play').addEventListener('click', () => {
      sound.playClick();
      renderLevelSelectGrid(1);
      game.switchScreen('screen-level-select');
    });

    // Player Name Prompt Form Listeners
    const formPlayerName = document.getElementById('form-player-name');
    if (formPlayerName) {
      formPlayerName.addEventListener('submit', (e) => {
        e.preventDefault();
        sound.playClick();
        handlePlayerNameSubmit();
      });
    }

    const btnSubmitPlayerName = document.getElementById('btn-submit-player-name');
    if (btnSubmitPlayerName) {
      btnSubmitPlayerName.addEventListener('click', (e) => {
        e.preventDefault();
        sound.playClick();
        handlePlayerNameSubmit();
      });
    }

    const btnCancelPlayerName = document.getElementById('btn-cancel-player-name');
    if (btnCancelPlayerName) {
      btnCancelPlayerName.addEventListener('click', () => {
        sound.playClick();
        closePlayerNameModal();
      });
    }

    const inputPlayerName = document.getElementById('input-player-name');
    const errPlayerName = document.getElementById('player-name-error');
    if (inputPlayerName) {
      inputPlayerName.addEventListener('input', () => {
        const val = inputPlayerName.value.trim();
        if (val && checkPlayerNameExisted(val)) {
          if (errPlayerName) {
            errPlayerName.textContent = 'name is existed';
            errPlayerName.classList.remove('hidden');
          }
          inputPlayerName.classList.add('has-error');
        } else {
          if (errPlayerName) {
            errPlayerName.classList.add('hidden');
          }
          inputPlayerName.classList.remove('has-error');
        }
      });
    }

    // Camera Permission Flow
    document.getElementById('btn-request-cam-permit').addEventListener('click', async () => {
      sound.playClick();
      const res = await startCamera();
      if (res.success) {
        gameStateData.settings.controlMode = 'camera';
        persistData();
        game.startLevel(gameStateData.lastPlayedLevel || 1);
      } else {
        const errBox = document.getElementById('cam-denied-error-box');
        if (errBox) {
          errBox.classList.remove('hidden');
          errBox.textContent = `Camera error: ${res.error}. Please check camera permissions in browser settings or use Touch Controls.`;
        }
      }
    });

    document.getElementById('btn-fallback-to-touch').addEventListener('click', () => {
      sound.playClick();
      gameStateData.settings.controlMode = 'touch';
      persistData();
      game.startLevel(gameStateData.lastPlayedLevel || 1);
    });

    document.getElementById('btn-perm-back-menu').addEventListener('click', () => {
      sound.playClick();
      game.switchScreen('screen-main-menu');
    });

    // Master Attack Button (Section 9 & 10) - Both Button Click & ✊ Fist call triggerAttack()
    const masterAttackBtn = document.getElementById('btn-master-attack');
    if (masterAttackBtn) {
      const handler = (e) => {
        e.preventDefault();
        triggerAttack();
      };
      masterAttackBtn.addEventListener('click', handler);
      masterAttackBtn.addEventListener('pointerdown', handler);
    }

    // Touch Controls Fallback D-Pad with Multi-Touch Support
    const touchLeft = document.getElementById('btn-touch-left');
    const touchRight = document.getElementById('btn-touch-right');
    const touchJump = document.getElementById('btn-touch-jump');
    const touchAttack = document.getElementById('btn-touch-attack');

    if (touchLeft) {
      touchLeft.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        touchMoveDirection = 'LEFT';
      });
      touchLeft.addEventListener('pointerup', () => {
        if (touchMoveDirection === 'LEFT') touchMoveDirection = null;
      });
      touchLeft.addEventListener('pointercancel', () => {
        if (touchMoveDirection === 'LEFT') touchMoveDirection = null;
      });
    }

    if (touchRight) {
      touchRight.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        touchMoveDirection = 'RIGHT';
      });
      touchRight.addEventListener('pointerup', () => {
        if (touchMoveDirection === 'RIGHT') touchMoveDirection = null;
      });
      touchRight.addEventListener('pointercancel', () => {
        if (touchMoveDirection === 'RIGHT') touchMoveDirection = null;
      });
    }

    if (touchJump) {
      touchJump.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        movePlayerUp();
      });
    }

    if (touchAttack) {
      touchAttack.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        triggerAttack();
      });
    }

    // HUD Actions
    document.getElementById('btn-toggle-camera').addEventListener('click', async () => {
      sound.playClick();
      if (!isCameraActive) {
        await startCamera();
      } else {
        stopCamera();
      }
      const camPanel = document.getElementById('camera-panel');
      if (camPanel) camPanel.classList.toggle('hidden', !isCameraActive);
    });

    document.getElementById('btn-restart-attempt').addEventListener('click', () => {
      sound.playClick();
      document.getElementById('modal-confirm-restart').classList.remove('hidden');
    });

    document.getElementById('btn-pause-game').addEventListener('click', () => {
      sound.playClick();
      game.state = 'PAUSED';
      sound.stopBGM();
      game.switchScreen('modal-game-paused');
    });

    // Restart Modal
    document.getElementById('btn-restart-yes').addEventListener('click', () => {
      sound.playClick();
      document.getElementById('modal-confirm-restart').classList.add('hidden');
      game.restartLevel(true);
    });

    document.getElementById('btn-restart-cancel').addEventListener('click', () => {
      sound.playClick();
      document.getElementById('modal-confirm-restart').classList.add('hidden');
    });

    // Pause Modal
    document.getElementById('btn-pause-resume').addEventListener('click', () => {
      sound.playClick();
      game.state = 'PLAYING';
      const worldIdx = (game.currentLevel.world || 1) - 1;
      sound.startBGM(game.currentLevel.bpm, worldIdx);
      game.switchScreen(null);
    });

    document.getElementById('btn-pause-restart').addEventListener('click', () => {
      document.getElementById('modal-game-paused').classList.add('hidden');
      document.getElementById('modal-confirm-restart').classList.remove('hidden');
    });

    document.getElementById('btn-pause-settings').addEventListener('click', () => {
      sound.playClick();
      game.switchScreen('screen-settings');
    });

    document.getElementById('btn-pause-level-select').addEventListener('click', () => {
      sound.playClick();
      renderLevelSelectGrid(1);
      game.switchScreen('screen-level-select');
    });

    document.getElementById('btn-pause-main-menu').addEventListener('click', () => {
      sound.playClick();
      game.state = 'MAIN_MENU';
      game.switchScreen('screen-main-menu');
    });

    // Level Complete Screen
    document.getElementById('btn-complete-next').addEventListener('click', () => {
      sound.playClick();
      nextLevel();
    });

    document.getElementById('btn-complete-replay').addEventListener('click', () => {
      sound.playClick();
      restartLevel(false);
    });

    document.getElementById('btn-complete-level-select').addEventListener('click', () => {
      sound.playClick();
      renderLevelSelectGrid(1);
      game.switchScreen('screen-level-select');
    });

    document.getElementById('btn-complete-leaderboard').addEventListener('click', () => {
      sound.playClick();
      renderLeaderboard();
      game.switchScreen('screen-leaderboard');
    });

    document.getElementById('btn-pause-leaderboard').addEventListener('click', () => {
      sound.playClick();
      renderLeaderboard();
      game.switchScreen('screen-leaderboard');
    });

    // Level Failed Screen
    document.getElementById('btn-failed-retry').addEventListener('click', () => {
      sound.playClick();
      restartLevel(false);
    });

    document.getElementById('btn-failed-level-select').addEventListener('click', () => {
      sound.playClick();
      renderLevelSelectGrid(1);
      game.switchScreen('screen-level-select');
    });

    // World Tabs
    document.querySelectorAll('.world-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.world-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const worldNum = parseInt(e.target.dataset.world, 10);
        renderLevelSelectGrid(worldNum);
      });
    });

    document.getElementById('btn-level-select-back').addEventListener('click', () => {
      sound.playClick();
      game.switchScreen('screen-main-menu');
    });

    const btnUnlockAll = document.getElementById('btn-unlock-all-levels');
    if (btnUnlockAll) {
      btnUnlockAll.addEventListener('click', () => {
        sound.playClick();
        unlockAllLevels();
        const activeWorld = document.querySelector('.world-btn.active');
        const worldNum = activeWorld ? parseInt(activeWorld.dataset.world, 10) : 1;
        renderLevelSelectGrid(worldNum);
      });
    }

    // Settings Screen Controls
    document.getElementById('set-control-mode').addEventListener('change', (e) => {
      gameStateData.settings.controlMode = e.target.value;
      persistData();
    });

    document.getElementById('toggle-cam-preview').addEventListener('click', (e) => {
      const active = e.target.classList.toggle('active');
      e.target.textContent = active ? 'ON' : 'OFF';
      gameStateData.settings.cameraPreview = active;
      persistData();
      const camPanel = document.getElementById('camera-panel');
      if (camPanel) camPanel.classList.toggle('hidden', !active);
    });

    document.getElementById('toggle-mirror-cam').addEventListener('click', (e) => {
      const active = e.target.classList.toggle('active');
      e.target.textContent = active ? 'ON' : 'OFF';
      gameStateData.settings.mirrorCamera = active;
      persistData();
    });

    document.getElementById('toggle-attack-zone').addEventListener('click', (e) => {
      const active = e.target.classList.toggle('active');
      e.target.textContent = active ? 'ON' : 'OFF';
      gameStateData.settings.attackZoneEnabled = active;
      persistData();
      const zone = document.getElementById('attack-zone-container');
      if (zone) zone.classList.toggle('hidden', !active);
    });

    document.getElementById('toggle-fist-attack').addEventListener('click', (e) => {
      const active = e.target.classList.toggle('active');
      e.target.textContent = active ? 'ON' : 'OFF';
      gameStateData.settings.fistAttackEnabled = active;
      persistData();
    });

    document.getElementById('set-deadzone').addEventListener('change', (e) => {
      gameStateData.settings.deadZone = e.target.value;
      persistData();
    });

    document.getElementById('set-smoothing').addEventListener('change', (e) => {
      gameStateData.settings.smoothing = e.target.value;
      persistData();
    });

    const setPlayerSpeedEl = document.getElementById('set-player-speed');
    if (setPlayerSpeedEl) {
      setPlayerSpeedEl.value = gameStateData.settings.playerSpeed || 'normal';
      setPlayerSpeedEl.addEventListener('change', (e) => {
        gameStateData.settings.playerSpeed = e.target.value;
        updatePlayerSpeedFromSettings();
        persistData();
      });
    }

    document.getElementById('toggle-music').addEventListener('click', (e) => {
      const active = e.target.classList.toggle('active');
      e.target.textContent = active ? 'MUSIC: ON' : 'MUSIC: OFF';
      gameStateData.settings.music = active;
      persistData();
    });

    document.getElementById('toggle-sfx').addEventListener('click', (e) => {
      const active = e.target.classList.toggle('active');
      e.target.textContent = active ? 'SFX: ON' : 'SFX: OFF';
      gameStateData.settings.sfx = active;
      persistData();
    });

    const btnSettingsUnlock = document.getElementById('btn-settings-unlock-all');
    if (btnSettingsUnlock) {
      btnSettingsUnlock.addEventListener('click', () => {
        sound.playClick();
        unlockAllLevels();
        alert('All 20 levels across all 5 worlds are unlocked!');
      });
    }

    document.getElementById('btn-reset-records').addEventListener('click', () => {
      if (confirm('Reset attempts history and best records? (All 20 levels will remain unlocked)')) {
        localStorage.removeItem(STORAGE_KEY);
        loadSavedData();
        updatePlayerSpeedFromSettings();
        updatePlayerNameUI();
        if (setPlayerSpeedEl) setPlayerSpeedEl.value = gameStateData.settings.playerSpeed || 'normal';
        renderLevelSelectGrid();
        alert('Records reset. All 20 levels remain unlocked.');
      }
    });

    document.getElementById('btn-settings-back').addEventListener('click', () => {
      sound.playClick();
      if (game.state === 'PAUSED') {
        game.switchScreen('modal-game-paused');
      } else {
        game.switchScreen('screen-main-menu');
      }
    });

    document.getElementById('btn-how-to-play-back').addEventListener('click', () => {
      sound.playClick();
      game.switchScreen('screen-main-menu');
    });

    // =========================================================================
    // Multi-Key Simultaneous Keyboard Controls Engine
    // Supports holding Run (A/D) + Jump (W/Up) + Attack (Space/J) simultaneously
    // =========================================================================
    function isKeyJump(k, code) {
      return code === 'KeyW' || code === 'ArrowUp' || code === 'Numpad8' || k === 'w' || k === 'W' || k === 'ArrowUp' || k === 'Up';
    }
    function isKeyAttackAction(k, code) {
      return code === 'Space' || code === 'KeyJ' || code === 'KeyK' || code === 'KeyZ' || code === 'KeyX' || code === 'KeyF' || code === 'KeyE' || code === 'Enter' || code === 'ShiftRight' || k === ' ' || k === 'j' || k === 'J' || k === 'z' || k === 'Z' || k === 'x' || k === 'X' || k === 'f' || k === 'F' || k === 'e' || k === 'E' || k === 'Enter';
    }
    function isKeyLeft(k, code) {
      return code === 'KeyA' || code === 'ArrowLeft' || code === 'Numpad4' || k === 'a' || k === 'A' || k === 'ArrowLeft' || k === 'Left';
    }
    function isKeyRight(k, code) {
      return code === 'KeyD' || code === 'ArrowRight' || code === 'Numpad6' || k === 'd' || k === 'D' || k === 'ArrowRight' || k === 'Right';
    }

    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing into an input field (e.g. player name modal)
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      // Pause shortcut
      if (e.key === 'Escape' || e.code === 'KeyP') {
        if (game.state === 'PLAYING') {
          game.state = 'PAUSED';
          sound.stopBGM();
          game.switchScreen('modal-game-paused');
          return;
        }
      }

      if (game.state !== 'PLAYING') return;

      const code = e.code || '';
      const key = e.key || '';

      // Register key in activeKeys Set for continuous multi-key physics update
      if (code) activeKeys.add(code);
      if (key) {
        activeKeys.add(key.toLowerCase());
        activeKeys.add(key);
      }

      // Track directional key priority for smooth rollover
      if (isKeyLeft(key, code)) {
        lastHorizontalKey = 'LEFT';
      } else if (isKeyRight(key, code)) {
        lastHorizontalKey = 'RIGHT';
      }

      // Jump Impulse (instant trigger on initial press, supports run + jump)
      if (isKeyJump(key, code) && !e.repeat) {
        movePlayerUp();
      }

      // Attack Trigger (instant trigger on initial press, supports run + attack)
      if (isKeyAttackAction(key, code) && !e.repeat) {
        e.preventDefault();
        triggerAttack();
      }

      // Quick Restart Level
      if ((code === 'KeyR' || key === 'r' || key === 'R') && !e.repeat) {
        const restartModal = document.getElementById('modal-confirm-restart');
        if (restartModal) restartModal.classList.remove('hidden');
      }

      // Prevent page scrolling on Space and Arrow keys
      if (code === 'Space' || key === ' ' || code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight') {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code || '';
      const key = e.key || '';
      if (code) activeKeys.delete(code);
      if (key) {
        activeKeys.delete(key.toLowerCase());
        activeKeys.delete(key.toUpperCase());
        activeKeys.delete(key);
      }

      // Directional rollover update when a horizontal key is released
      if (isKeyLeft(key, code)) {
        const rightStillHeld = activeKeys.has('KeyD') || activeKeys.has('ArrowRight') || activeKeys.has('Numpad6') || activeKeys.has('d') || activeKeys.has('D') || activeKeys.has('Right');
        lastHorizontalKey = rightStillHeld ? 'RIGHT' : null;
      } else if (isKeyRight(key, code)) {
        const leftStillHeld = activeKeys.has('KeyA') || activeKeys.has('ArrowLeft') || activeKeys.has('Numpad4') || activeKeys.has('a') || activeKeys.has('A') || activeKeys.has('Left');
        lastHorizontalKey = leftStillHeld ? 'LEFT' : null;
      }
    });

    window.addEventListener('blur', () => {
      activeKeys.clear();
      touchMoveDirection = null;
      lastHorizontalKey = null;
    });
  }

  // =========================================================================
  // 8. BOOTSTRAP INITIALIZATION
  // =========================================================================
  window.addEventListener('DOMContentLoaded', () => {
    loadSavedData();
    updatePlayerSpeedFromSettings();
    updatePlayerNameUI();
    const game = new GameEngine();
    currentGameInstance = game;
    bindUIEvents(game);
    renderLevelSelectGrid();

    // Expose API for headless test automation and external checks
    window.PulseStrider = {
      classifyTwoHands,
      detectRightHandMovement,
      detectLeftHandAttack,
      detectLeftHandMovement,
      detectRightHandAttack,
      handleTwoHandGestures,
      handleGesture,
      getGameInstance: () => currentGameInstance,
      getPlayer: () => (currentGameInstance ? currentGameInstance.player : null),
      restartLevel: () => {
        if (currentGameInstance) currentGameInstance.startLevel(currentGameInstance.currentLevelId);
      },
      getStateData: () => gameStateData,
      triggerAttack
    };

    // Start Main Render & Animation Loop
    requestAnimationFrame((t) => game.gameLoop(t));
  });

})();
