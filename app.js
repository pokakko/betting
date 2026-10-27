(() => {
  const START = 1000;
  const SEED = { yes: 600, no: 400 }; // fake starting pot so odds aren't boring
  const KEY = "cy-bets-v1";
  const DEADLINE = new Date("2026-10-29T12:00:00+08:00").getTime(); // Thu 29 Oct 2026, 12pm SGT
  const isClosed = () => Date.now() >= DEADLINE;

  const $ = (id) => document.getElementById(id);
  const els = {
    balance: $("balance"), amount: $("amount"), potential: $("potential"),
    place: $("place"), msg: $("msg"), slip: $("slip"),
    oddsYes: $("odds-yes"), oddsNo: $("odds-no"),
    poolYes: $("pool-yes"), poolNo: $("pool-no"),
    barYes: $("bar-yes"), barNo: $("bar-no"),
  };

  let state = load();
  let side = null;

  function fresh() { return { balance: START, bets: [] }; }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s.balance === "number" && Array.isArray(s.bets)) return s;
    } catch (e) {}
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function pools() {
    const p = { yes: SEED.yes, no: SEED.no };
    state.bets.filter((b) => b.status === "open").forEach((b) => (p[b.side] += b.amount));
    return p;
  }
  function oddsFor(s, p = pools()) {
    const total = p.yes + p.no;
    return Math.max(1.05, total / p[s]);
  }
  const fmt = (n) => Math.round(n).toLocaleString();

  function render() {
    const p = pools();
    const total = p.yes + p.no;
    els.balance.textContent = fmt(state.balance);
    els.oddsYes.textContent = oddsFor("yes", p).toFixed(2);
    els.oddsNo.textContent = oddsFor("no", p).toFixed(2);
    els.poolYes.textContent = fmt(p.yes);
    els.poolNo.textContent = fmt(p.no);
    els.barYes.style.width = (p.yes / total) * 100 + "%";
    els.barNo.style.width = (p.no / total) * 100 + "%";
    renderSlip();
    updatePayout();
  }

  function renderSlip() {
    els.slip.innerHTML = "";
    [...state.bets].reverse().forEach((b) => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      const who = document.createElement("div");
      who.className = "who";
      who.textContent = (b.side === "yes" ? "📱 CY replies" : "👻 CY ghosts") + " · " + fmt(b.amount) + " 🪙";
      const meta = document.createElement("div");
      meta.className = "meta";
      const outcome = b.status === "won" ? "won " + fmt(b.payout) + " 🪙"
        : b.status === "lost" ? "lost it all"
        : "pays " + fmt(b.amount * b.odds) + " 🪙 @ " + b.odds.toFixed(2) + "x";
      meta.textContent = outcome;
      left.append(who, meta);
      const tag = document.createElement("span");
      tag.className = "tag " + b.status;
      tag.textContent = b.status.toUpperCase();
      li.append(left, tag);
      els.slip.append(li);
    });
  }

  function currentAmount() {
    const n = Math.floor(Number(els.amount.value));
    return Number.isFinite(n) ? n : 0;
  }

  function updatePayout() {
    const amt = currentAmount();
    if (side && amt > 0) {
      // odds after your bet lands in the pot
      const p = pools();
      p[side] += amt;
      els.potential.textContent = fmt(amt * oddsFor(side, p)) + " 🪙";
    } else {
      els.potential.textContent = "—";
    }
    els.place.disabled = isClosed() || !(side && amt > 0 && amt <= state.balance);
    if (isClosed()) say("Bets are closed ⏰ the truth is out!", true);
    else if (amt > state.balance) say("Not enough coins, big spender 💸", true);
    else if (els.msg.classList.contains("err")) say("");
  }

  function say(t, err) {
    els.msg.textContent = t;
    els.msg.classList.toggle("err", !!err);
  }

  // pick side
  document.querySelectorAll(".opt").forEach((btn) =>
    btn.addEventListener("click", () => {
      side = btn.dataset.side;
      document.querySelectorAll(".opt").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      updatePayout();
    })
  );

  // chips
  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const v = b.dataset.amt;
    els.amount.value = v === "all" ? state.balance : Math.min(Number(v), state.balance);
    updatePayout();
  });
  els.amount.addEventListener("input", updatePayout);

  // place bet
  els.place.addEventListener("click", () => {
    const amt = currentAmount();
    if (isClosed() || !side || amt <= 0 || amt > state.balance) return;
    const p = pools();
    p[side] += amt;
    state.bets.push({ side, amount: amt, odds: oddsFor(side, p), status: "open" });
    state.balance -= amt;
    save();
    els.amount.value = "";
    say(amt === state.balance + amt ? "ALL IN?! Absolute madlad 🔥" : "Bet locked. No take-backs 🔒");
    els.balance.classList.remove("bump"); void els.balance.offsetWidth; els.balance.classList.add("bump");
    render();
  });

  // settle
  function settle(outcome) {
    if (!isClosed()) { say("Result is TBC. Wait for the countdown 👀", true); return; }
    const open = state.bets.filter((b) => b.status === "open");
    if (!open.length) { say("No open bets to settle!", true); return; }
    let won = 0;
    open.forEach((b) => {
      if (b.side === outcome) {
        b.status = "won";
        b.payout = Math.round(b.amount * b.odds);
        state.balance += b.payout;
        won += b.payout;
      } else {
        b.status = "lost";
      }
    });
    save();
    render();
    if (won > 0) { say("You won " + fmt(won) + " 🪙 — drinks on you 🥂"); confetti(); }
    else say("Ouch. Better luck next time 💀");
    if (state.balance <= 0) say("Broke. Hit reset for a fresh stash 🪙");
  }
  $("settle-yes").addEventListener("click", () => settle("yes"));
  $("settle-no").addEventListener("click", () => settle("no"));

  $("reset").addEventListener("click", () => {
    if (!confirm("Reset your stash and clear all bets?")) return;
    state = fresh(); save(); side = null;
    document.querySelectorAll(".opt").forEach((b) => b.setAttribute("aria-pressed", "false"));
    els.amount.value = ""; say("Fresh start ✨"); render();
  });

  // confetti
  function confetti() {
    const c = $("confetti"), ctx = c.getContext("2d");
    c.width = innerWidth; c.height = innerHeight;
    const colors = ["#ff3ea5", "#b8ff3d", "#3d7bff", "#ff8a1f", "#8a3dff", "#ffd400"];
    const bits = Array.from({ length: 160 }, () => ({
      x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5,
      w: 6 + Math.random() * 8, h: 8 + Math.random() * 10,
      vx: -2 + Math.random() * 4, vy: 3 + Math.random() * 5,
      r: Math.random() * 6, vr: -0.2 + Math.random() * 0.4,
      color: colors[(Math.random() * colors.length) | 0],
    }));
    let frames = 0;
    (function tick() {
      ctx.clearRect(0, 0, c.width, c.height);
      bits.forEach((b) => {
        b.x += b.vx; b.y += b.vy; b.r += b.vr;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
        ctx.fillStyle = b.color; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      });
      if (++frames < 200) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, c.width, c.height);
    })();
  }

  // CY quotes
  const QUOTES = [
    "only i can eat DTF",
    "you got money also cannot buy my watch",
    "why u isolate me",
    "im going to block you",
    "andrea hates SY",
    "manish is a gold digger",
    "arif is a bad influence",
    "i drive merc",
    "porscheeee",
    "i dont use ai.",
  ];
  const qEl = $("quote");
  let qi = Math.floor(Math.random() * QUOTES.length);
  let qTimer;
  function showQuote(next) {
    if (next) qi = (qi + 1) % QUOTES.length;
    qEl.textContent = "“" + QUOTES[qi] + "”";
    qEl.classList.remove("swap"); void qEl.offsetWidth; qEl.classList.add("swap");
  }
  function startQuotes() {
    clearInterval(qTimer);
    qTimer = setInterval(() => showQuote(true), 7000);
  }
  $("next-quote").addEventListener("click", () => { showQuote(true); startQuotes(); });
  showQuote(false);
  startQuotes();

  // countdown
  const pad = (n) => String(n).padStart(2, "0");
  function tick() {
    const diff = DEADLINE - Date.now();
    const closed = diff <= 0;
    const t = Math.max(0, Math.floor(diff / 1000));
    $("cd-d").textContent = pad(Math.floor(t / 86400));
    $("cd-h").textContent = pad(Math.floor((t % 86400) / 3600));
    $("cd-m").textContent = pad(Math.floor((t % 3600) / 60));
    $("cd-s").textContent = pad(t % 60);
    document.querySelector(".countdown").classList.toggle("done", closed);
    $("cd-tag").textContent = closed ? "🚨 TIME'S UP" : "⏳ RESULT: TBC";
    $("cd-note").textContent = closed
      ? "Bets are closed. Time to find out what CY did."
      : "Bets close & the result is revealed Thursday 29 Oct, 12:00 PM (SGT)";
    $("locked").hidden = closed;
    $("settle-panel").hidden = !closed;
    els.place.disabled = closed || els.place.disabled;
    if (closed) { clearInterval(cdTimer); updatePayout(); }
  }
  const cdTimer = setInterval(tick, 1000);
  tick();

  render();
})();
