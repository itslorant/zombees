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
    <div class="big-num score">0</div>
    <div class="best-line"></div>`;
  const waveNum = right.querySelector(".wave");
  const scoreNum = right.querySelector(".score");
  const bestLine = right.querySelector(".best-line");

  // combo meter
  const combo = el("div");
  combo.id = "combo";
  combo.innerHTML = `<span class="combo-x">x0</span><span class="combo-mult"></span>`;
  const comboX = combo.querySelector(".combo-x");
  const comboMult = combo.querySelector(".combo-mult");

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

  // floating popup pool (damage / score numbers)
  const popLayer = el("div");
  popLayer.id = "pop-layer";
  const pool = [];
  for (let i = 0; i < 28; i++) {
    const p = el("div", "pop");
    p.hidden = true;
    popLayer.append(p);
    pool.push({ node: p, life: 0 });
  }
  let poolHead = 0;

  hud.append(left, right, combo, bossWrap, announce, hurt, popLayer);

  // ---- start overlay ----
  const start = el("div", "overlay");
  start.id = "start";
  start.innerHTML = `
    <div class="title">ZOMBEES</div>
    <div class="subtitle">The hive turned. Hold the road and put down every last one.</div>
    <div class="controls">
      Move&nbsp;&nbsp;<b>A / D</b> · <b>← →</b> · <b>drag</b><br />
      Your soldier auto-fires in a <b>forward arc</b> — standing still gets you flanked<br />
      Grab <b>crates</b> to upgrade · chain kills for a <b>score multiplier</b> · boss every 5 waves
    </div>
    <div class="best-badge" id="start-best"></div>
    <button class="cta" id="start-btn">Start</button>`;
  const startBest = start.querySelector("#start-best");

  // ---- game over overlay ----
  const over = el("div", "overlay hidden");
  over.id = "over";
  over.innerHTML = `
    <div class="title">STUNG TO DEATH</div>
    <div class="newbest" id="over-newbest">NEW BEST</div>
    <div class="stat-row">
      <div class="s"><span class="k">WAVE</span><span class="v" id="over-wave">0</span></div>
      <div class="s"><span class="k">SCORE</span><span class="v" id="over-score">0</span></div>
    </div>
    <div class="best-badge" id="over-best"></div>
    <button class="cta" id="restart-btn">Play Again</button>
    <div class="hint">or press R</div>`;

  root.append(hud, start, over);

  start.querySelector("#start-btn").addEventListener("click", onStart);
  over.querySelector("#restart-btn").addEventListener("click", onRestart);

  const bestText = (b) => (b && b.score > 0 ? `Best: ${b.score} · Wave ${b.wave}` : "");

  return {
    setBest(b) {
      startBest.textContent = bestText(b);
      over.querySelector("#over-best").textContent = bestText(b);
    },

    hideStart() {
      start.classList.add("hidden");
    },
    showStart() {
      start.classList.remove("hidden");
    },
    showGameOver(score, wave, result) {
      over.querySelector("#over-score").textContent = score;
      over.querySelector("#over-wave").textContent = wave;
      over.querySelector("#over-best").textContent = bestText(result && result.best);
      over.querySelector("#over-newbest").classList.toggle(
        "show",
        !!(result && (result.newScore || result.newWave)),
      );
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
      void announce.offsetWidth;
      announce.classList.add("play");
    },

    flashHurt() {
      hurt.classList.remove("flash");
      void hurt.offsetWidth;
      hurt.classList.add("flash");
    },

    // spawn a floating number at screen coords
    popup(x, y, text, kind = "score") {
      const slot = pool[poolHead];
      poolHead = (poolHead + 1) % pool.length;
      const n = slot.node;
      n.textContent = text;
      n.className = "pop " + kind;
      n.style.left = x + "px";
      n.style.top = y + "px";
      n.hidden = false;
      // restart animation
      n.style.animation = "none";
      void n.offsetWidth;
      n.style.animation = "";
      slot.life = 0.9;
    },

    _tickPopups(dt) {
      for (const s of pool) {
        if (s.life > 0) {
          s.life -= dt;
          if (s.life <= 0) s.node.hidden = true;
        }
      }
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
      bestLine.textContent = s.best && s.best.score > 0 ? `best ${s.best.score}` : "";

      // combo meter
      if (s.combo >= 3) {
        combo.classList.add("show");
        comboX.textContent = "x" + s.combo;
        comboMult.textContent = s.mult > 1 ? " " + s.mult + "×" : "";
        combo.style.setProperty("--combo-fill", Math.max(0, s.comboFrac));
        combo.classList.toggle("hot", s.mult >= 3);
      } else {
        combo.classList.remove("show");
      }

      if (s.boss) {
        bossWrap.classList.add("show");
        bossFill.style.transform = `scaleX(${Math.max(0, s.boss.hp / s.boss.maxHp)})`;
      } else {
        bossWrap.classList.remove("show");
      }

      this._tickPopups(s.dt || 0.016);
    },
  };
}
