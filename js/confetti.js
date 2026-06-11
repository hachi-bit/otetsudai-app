// confetti.js - 報酬受取時のコインエフェクト

const Confetti = {
  emojis: ['🪙', '⭐', '✨', '🎉', '💰', '🌟'],

  /**
   * コイン獲得エフェクトを発火
   */
  burst(container) {
    const count = 30;
    for (let i = 0; i < count; i++) {
      setTimeout(() => this._createParticle(container), i * 40);
    }
  },

  _createParticle(container) {
    const el = document.createElement('div');
    el.className = 'confetti-particle';
    el.textContent = this.emojis[Math.floor(Math.random() * this.emojis.length)];

    const startX = 40 + Math.random() * 20; // 中央付近から
    const startY = 50 + Math.random() * 10;
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * 200;
    const endX = startX + Math.cos(angle) * distance / window.innerWidth * 100;
    const endY = startY - Math.abs(Math.sin(angle)) * distance / window.innerHeight * 100;

    el.style.cssText = `
      position: fixed;
      left: ${startX}%;
      top: ${startY}%;
      font-size: ${16 + Math.random() * 20}px;
      pointer-events: none;
      z-index: 9999;
      opacity: 1;
      transition: all ${0.6 + Math.random() * 0.8}s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    `;

    container.appendChild(el);

    requestAnimationFrame(() => {
      el.style.left = endX + '%';
      el.style.top = endY + '%';
      el.style.opacity = '0';
      el.style.transform = `scale(${0.3 + Math.random() * 0.5}) rotate(${Math.random() * 360}deg)`;
    });

    setTimeout(() => el.remove(), 1500);
  },

  /**
   * レベルアップ演出
   */
  levelUp(container, newLevel) {
    const overlay = document.createElement('div');
    overlay.className = 'levelup-overlay';
    overlay.innerHTML = `
      <div class="levelup-content">
        <div class="levelup-star">⭐</div>
        <div class="levelup-text">レベルアップ！</div>
        <div class="levelup-level">Lv.${newLevel.level}</div>
        <div class="levelup-title">${newLevel.title}</div>
      </div>
    `;
    container.appendChild(overlay);

    setTimeout(() => this.burst(container), 300);
    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 500);
    }, 2500);
  }
};
