// ── Глобальное состояние ──────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const cart = {};
let deliveryCost = 0;
let payMethod = 'cash';
let forOther = false;
