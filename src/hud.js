const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

export function createHUD(root, { onStart, onRestart }) {
  const hud = el("div");
  hud.id = "hud";

  // left panel: health + weapon
  const left = el("div", "hud-panel");
  left.id = "hud-left";
  left.innerHTML = `
    <div>Health</div>
    <div class="hp-track"><div class="hp-fill"></div></div>
    <div class="weapon-line"></div>
    <div class="mods-line"></div>`;
  const hpFill = left.querySelector(".hp-fill");
  const weaponLine = left.querySelector(".weapon-line");
  const modsLine = left.querySelector(".mods-line");

  // right panel: wave + score
  const right = el("div", "hud-panel");
  right.id = "hud-right";
  right.innerHTML = `
    <div class="label">Wave</div>
    <div class="big-num wave">0</div>
    <div class="label" style="margin-top:6px">Score</div>
    <div class="big-num score">0</div>`;
  const waveNum = right.querySelector(".wave");
  const scoreNum = right.querySelector(".score");

  // boss bar
  const bossWrap = el("div");
  bossWrap.id = "boss-wrap";
  bossWrap.innerHTML = `
    <div class="boss-name">◆ QUEEN ZOMBEE ◆</div>
    <div class="boss-track"><div class="boss-fill"></div></div>`;
  const bossFill = bossWrap.querySelector(".boss-fill");

  const announce = el("div");
  announce.id = "announce";

  const hurt = el("div");
  hurt.id = "hurt";

  hud.append(left, right, bossWrap, announce, hurt);

  // ---- start overlay ----
  const start = el("div", "overlay");
  start.id = "start";
  start.innerHTML = `
    <div class="title">ZOMBEES</div>
    <div class="subtitle">The hive turned. Hold the road and put down every last one.</div>
    <div class="controls">
      Move&nbsp;&nbsp;<b>A / D</b> or <b>← →</b> or <b>drag</b><br />
      Your soldier fires on his own — keep the swarm in front of you<br />
      Grab <b>glowing crates</b> to upgrade your gun · boss every 5 waves
    </div>
    <button class="cta" id="start-btn">Start</button>`;

  // ---- game over overlay ----
  const over = el("div", "overlay hidden");
  over.id = "over";
  over.innerHTML = `
    <div class="title">STUNG TO DEATH</div>
    <div class="stat-row">
      <div class="s"><span class="k">WAVE</span><span class="v" id="over-wave">0</span></div>
      <div class="s"><span class="k">SCORE</span><span class="v" id="over-score">0</span></div>
    </div>
    <button class="cta" id="restart-btn">Play Again</button>
    <div class="hint">or press R</div>`;

  root.append(hud, start, over);

  start.querySelector("#start-btn").addEventListener("click", onStart);
  over.querySelector("#restart-btn").addEventListener("click", onRestart);

  let announceTimer = null;

  return {
    hideStart() {
      start.classList.add("hidden");
    },
    showStart() {
      start.classList.remove("hidden");
    },
    showGameOver(score, wave) {
      over.querySelector("#over-score").textContent = score;
      over.querySelector("#over-wave").textContent = wave;
      over.classList.remove("hidden");
    },
    hideGameOver() {
      over.classList.add("hidden");
    },

    announce(text, color = "#8fe36b") {
      if (!text) return;
      announce.textContent = text;
      announce.style.color = color;
      announce.classList.remove("play");
      void announce.offsetWidth; // restart the animation
      announce.classList.add("play");
    },

    flashHurt() {
      hurt.classList.remove("flash");
      void hurt.offsetWidth;
      hurt.classList.add("flash");
    },

    update(s) {
      const hpPct = s.hp;
      hpFill.style.transform = `scaleX(${Math.max(0, hpPct)})`;
      hpFill.classList.toggle("low", hpPct < 0.35);

      weaponLine.textContent = s.weapon + (s.isMax ? " ★" : "");
      const m = s.mods;
      const bits = [];
      if (m.fireRate > 1.01) bits.push(`RoF x${m.fireRate.toFixed(2)}`);
      if (m.damage > 1.01) bits.push(`DMG x${m.damage.toFixed(2)}`);
      if (m.pierce > 0) bits.push(`Pierce +${m.pierce}`);
      modsLine.textContent = bits.join("   ");

      waveNum.textContent = s.wave;
      scoreNum.textContent = s.score;

      if (s.boss) {
        bossWrap.classList.add("show");
        bossFill.style.transform = `scaleX(${Math.max(0, s.boss.hp / s.boss.maxHp)})`;
      } else {
        bossWrap.classList.remove("show");
      }
    },
  };
}
