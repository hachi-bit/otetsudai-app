// confetti.js - 報酬受取・レベルアップ・トロフィー演出（強化版）

const Confetti = {
  emojis: ['🪙', '⭐', '✨', '🎉', '💰', '🌟'],

  /**
   * コイン獲得エフェクトを発火（金額に応じて量が変わる）
   */
  burst(container, amount = 100) {
    const count = Math.min(60, Math.max(15, Math.round(amount / 20)));
    this._flash(container);
    for (let i = 0; i < count; i++) {
      setTimeout(() => this._createParticle(container), i * 30);
    }
  },

  _flash(container) {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed; inset: 0; z-index: 9998;
      background: radial-gradient(circle at 50% 60%, rgba(251,191,36,0.35), transparent 70%);
      pointer-events: none; opacity: 0;
      transition: opacity 0.25s ease-out;
    `;
    container.appendChild(flash);
    requestAnimationFrame(() => { flash.style.opacity = '1'; });
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 400);
    }, 200);
  },

  _createParticle(container) {
    const el = document.createElement('div');
    el.className = 'confetti-particle';
    el.textContent = this.emojis[Math.floor(Math.random() * this.emojis.length)];

    const startX = 40 + Math.random() * 20;
    const startY = 50 + Math.random() * 10;
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * 220;
    const endX = startX + Math.cos(angle) * distance / window.innerWidth * 100;
    const endY = startY - Math.abs(Math.sin(angle)) * distance / window.innerHeight * 100;

    el.style.cssText = `
      position: fixed;
      left: ${startX}%;
      top: ${startY}%;
      font-size: ${16 + Math.random() * 22}px;
      pointer-events: none;
      z-index: 9999;
      opacity: 1;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
      transition: all ${0.6 + Math.random() * 0.9}s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    `;

    container.appendChild(el);

    requestAnimationFrame(() => {
      el.style.left = endX + '%';
      el.style.top = endY + '%';
      el.style.opacity = '0';
      el.style.transform = `scale(${0.3 + Math.random() * 0.6}) rotate(${(Math.random()-0.5) * 540}deg)`;
    });

    setTimeout(() => el.remove(), 1600);
  },

  /**
   * レベルアップ演出（2段階：集結→爆発）
   */
  levelUp(container, newLevel) {
    const icon = newLevel.icon || '⭐';
    const overlay = document.createElement('div');
    overlay.className = 'levelup-overlay';
    overlay.innerHTML = `
      <div class="levelup-content">
        <div class="trophy-glow"></div>
        <div class="levelup-star" id="levelupStar">${icon}</div>
        <div class="levelup-text">称号かくとく！</div>
        <div class="levelup-level" id="levelupLevelNum">Lv.${newLevel.level}</div>
        <div class="levelup-title">${newLevel.title}</div>
      </div>
    `;
    container.appendChild(overlay);

    const gatherStars = [];
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('div');
      s.textContent = '✨';
      const angle = (Math.PI * 2 / 8) * i;
      const dist = 150;
      s.style.cssText = `
        position: fixed; left: 50%; top: 45%;
        font-size: 1.5rem; z-index: 3001; pointer-events:none;
        transform: translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px) scale(0);
        transition: transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s;
        opacity: 0;
      `;
      container.appendChild(s);
      gatherStars.push(s);
    }
    requestAnimationFrame(() => {
      gatherStars.forEach(s => {
        s.style.opacity = '1';
        s.style.transform = 'translate(0,0) scale(1.2)';
      });
    });
    setTimeout(() => gatherStars.forEach(s => {
      s.style.opacity = '0';
      s.style.transform += ' scale(0.3)';
      setTimeout(() => s.remove(), 300);
    }), 500);

    const starEl = () => document.getElementById('levelupStar');
    setTimeout(() => {
      const star = starEl();
      if (star) {
        star.style.animation = 'levelupStarBounce 0.6s cubic-bezier(0.34,1.56,0.64,1)';
      }
      this._sparkleRing(container);
      this.burst(container, 300);
    }, 500);

    this._playChime(true);

    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 500);
    }, 2800);
  },

  _sparkleRing(container) {
    const sparkles = ['✨', '⭐', '💫'];
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('div');
      s.textContent = sparkles[i % sparkles.length];
      const angle = (Math.PI * 2 / 12) * i;
      const dist = 90 + Math.random() * 40;
      s.style.cssText = `
        position: fixed; left: 50%; top: 42%;
        font-size: ${1 + Math.random()}rem; z-index: 4001; pointer-events:none;
        transform: translate(0,0) scale(0); opacity: 0;
        transition: transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.5s;
      `;
      container.appendChild(s);
      requestAnimationFrame(() => {
        s.style.opacity = '1';
        s.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px) scale(1)`;
      });
      setTimeout(() => {
        s.style.opacity = '0';
        setTimeout(() => s.remove(), 500);
      }, 900);
    }
  },

  _playChime(fancy = false) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = fancy ? [523.25, 659.25, 783.99, 1046.50] : [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
    } catch (e) { /* 音声非対応環境は無視 */ }
  }
};
