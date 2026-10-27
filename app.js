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
  const CUSTOM_ODDS = 2;
  const customText = () => $("custom-text").value.trim().slice(0, 60);
  const pickValid = () => side === "yes" || side === "no" || (side === "custom" && customText().length > 0);

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
    state.bets.filter((b) => b.status === "open" && (b.side === "yes" || b.side === "no")).forEach((b) => (p[b.side] += b.amount));
    return p;
  }
  function oddsFor(s, p = pools()) {
    if (s === "custom") return CUSTOM_ODDS;
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
    renderCustomSettle();
    updatePayout();
  }

  function renderSlip() {
    els.slip.innerHTML = "";
    [...state.bets].reverse().forEach((b) => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      const who = document.createElement("div");
      who.className = "who";
      who.textContent = (b.side === "yes" ? "📱 CY replies" : b.side === "no" ? "👻 CY ghosts" : "✍️ “" + (b.text || "my prediction") + "”") + " · " + fmt(b.amount) + " 🪙";
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
    if (pickValid() && amt > 0) {
      // odds after your bet lands in the pot
      const p = pools();
      p[side] += amt;
      els.potential.textContent = fmt(amt * oddsFor(side, p)) + " 🪙";
    } else {
      els.potential.textContent = "—";
    }
    els.place.disabled = isClosed() || !(pickValid() && amt > 0 && amt <= state.balance);
    if (isClosed()) say("Bets are closed ⏰ the truth is out!", true);
    else if (amt > state.balance) say("Not enough coins, big spender 💸", true);
    else if (els.msg.classList.contains("err")) say("");
  }

  function say(t, err, el = els.msg) {
    el.textContent = t;
    el.classList.toggle("err", !!err);
  }

  // pick side
  function selectSide(s) {
    side = s;
    document.querySelectorAll(".opt").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.side === s)));
    syncPick();
  }
  document.querySelectorAll(".opt").forEach((btn) =>
    btn.addEventListener("click", () => {
      selectSide(btn.dataset.side);
      if (btn.dataset.side === "custom") $("custom-text").focus();
    })
  );
  $("custom-text").addEventListener("input", () => { if (side !== "custom") selectSide("custom"); else syncPick(); });
  $("custom-text").addEventListener("focus", () => { if (side !== "custom") selectSide("custom"); });

  function pickLabel() {
    return side === "yes" ? "📱 CY is going to reply"
      : side === "no" ? "👻 CY is not replying"
      : side === "custom" ? "✍️ “" + customText() + "”" : "";
  }
  function syncPick() {
    const ok = pickValid();
    $("to-2").disabled = !ok;
    document.querySelector('.stepper [data-go="2"]').disabled = !ok;
    $("picked").textContent = ok ? "Your pick: " + pickLabel() : "";
    updatePayout();
  }

  // steps (pages)
  const stepEls = [...document.querySelectorAll(".step")];
  const pills = [...document.querySelectorAll(".stepper button")];
  function go(n, scroll = true) {
    if (n === 2 && !pickValid()) return;
    stepEls.forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
    pills.forEach((p) => {
      const k = Number(p.dataset.go);
      p.classList.toggle("on", k === n);
      p.classList.toggle("done", k < n);
      if (k === n) p.setAttribute("aria-current", "step"); else p.removeAttribute("aria-current");
    });
    if (scroll) $("stepper").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(Number(b.dataset.go))));
  $("to-2").addEventListener("click", () => go(2));

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
    if (isClosed() || !pickValid() || amt <= 0 || amt > state.balance) return;
    const p = pools();
    if (side !== "custom") p[side] += amt;
    const bet = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), side, amount: amt, odds: oddsFor(side, p), status: "open" };
    if (side === "custom") bet.text = customText();
    state.bets.push(bet);
    state.balance -= amt;
    save();
    els.amount.value = "";
    say(amt === state.balance + amt ? "ALL IN?! Absolute madlad 🔥" : "Bet locked. No take-backs 🔒");
    els.balance.classList.remove("bump"); void els.balance.offsetWidth; els.balance.classList.add("bump");
    render();
    go(3);
  });

  // settle
  function settle(outcome) {
    const sm = $("msg-settle");
    if (!isClosed()) { say("Result is TBC. Come back when the countdown hits zero 👀", true, sm); return; }
    const open = state.bets.filter((b) => b.status === "open" && b.side !== "custom");
    if (!open.length) { say("No open yes/no bets to settle!", true, sm); return; }
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
    if (won > 0) { say("You won " + fmt(won) + " 🪙 — drinks on you 🥂", false, sm); confetti(); }
    else say("Ouch. Better luck next time 💀", false, sm);
    if (state.balance <= 0) say("Broke. Hit reset for a fresh stash 🪙", false, sm);
  }
  $("settle-yes").addEventListener("click", () => settle("yes"));
  $("settle-no").addEventListener("click", () => settle("no"));

  // own-prediction bets are judged by the player
  function renderCustomSettle() {
    const ul = $("custom-settle");
    ul.innerHTML = "";
    const open = state.bets.filter((b) => b.side === "custom" && b.status === "open");
    ul.hidden = !open.length;
    open.forEach((b) => {
      const li = document.createElement("li");
      const t = document.createElement("div");
      t.className = "who";
      t.textContent = "✍️ “" + b.text + "” · " + fmt(b.amount) + " 🪙";
      const row = document.createElement("div");
      row.className = "row";
      const yes = document.createElement("button");
      yes.className = "yes"; yes.textContent = "HAPPENED 🎉";
      yes.addEventListener("click", () => settleCustom(b.id, true));
      const no = document.createElement("button");
      no.className = "no"; no.textContent = "NOPE 💀";
      no.addEventListener("click", () => settleCustom(b.id, false));
      row.append(yes, no);
      li.append(t, row);
      ul.append(li);
    });
  }
  function settleCustom(id, happened) {
    if (!isClosed()) return;
    const b = state.bets.find((x) => x.id === id && x.status === "open");
    if (!b) return;
    if (happened) { b.status = "won"; b.payout = Math.round(b.amount * b.odds); state.balance += b.payout; }
    else b.status = "lost";
    save();
    render();
    if (happened) { say("Called it! +" + fmt(b.payout) + " 🪙", false, $("msg-settle")); confetti(); }
    else say("Not this time 💀", false, $("msg-settle"));
  }

  $("reset").addEventListener("click", () => {
    if (!confirm("Reset your stash and clear all bets?")) return;
    state = fresh(); save(); side = null;
    document.querySelectorAll(".opt").forEach((b) => b.setAttribute("aria-pressed", "false"));
    $("custom-text").value = "";
    els.amount.value = ""; say("Fresh start ✨"); say("", false, $("msg-settle")); render(); syncPick(); go(1);
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
    $("locked").hidden = closed;
    $("settle-panel").hidden = !closed;
    els.place.disabled = closed || els.place.disabled;
    if (closed) { clearInterval(cdTimer); updatePayout(); }
  }
  const cdTimer = setInterval(tick, 1000);
  tick();

  // "remind me" -> downloads a calendar event for the reveal time
  $("remind").addEventListener("click", () => {
    const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//will-cy-reply//EN", "BEGIN:VEVENT",
      "UID:cy-reveal-" + DEADLINE + "@will-cy-reply",
      "DTSTAMP:" + stamp(Date.now()),
      "DTSTART:" + stamp(DEADLINE),
      "DTEND:" + stamp(DEADLINE + 30 * 60000),
      "SUMMARY:Will CY reply?! The truth drops",
      "DESCRIPTION:Come back and settle your bets. " + location.href,
      "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", "DESCRIPTION:CY reveal in 10 min", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "will-cy-reply.ics";
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  render();
  syncPick();
  go(1, false);
})();
