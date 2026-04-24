// ═══════════════════════════════════════════════════════════════
// checkout.js  —  YaYa Chicken · Полная система оплаты
// Методы: Наличные, Kaspi QR, Kaspi удалённый, Halyk удалённый,
//         Freedom Pay, Jusan Pay, Forte Pay, Сохранённая карта
// ═══════════════════════════════════════════════════════════════

// ── Конфиг ───────────────────────────────────────────────────────────
const WEBHOOK       = 'https://bonded-ditch-divisible.ngrok-free.dev/order';
const KASPI_QR_LINK = 'https://pay.kaspi.kz/pay/yayachicken';

// ── Состояние оплаты ─────────────────────────────────────────────────
let savedCard   = null;   // { last4, brand } или null
let payMethod   = 'cash';
let forOther    = false;

// ── Загрузка сохранённой карты ────────────────────────────────────────
async function loadSavedCard() {
  const chatId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (!chatId) return null;
  try {
    const r = await fetch(`${WEBHOOK.replace('/order', '/saved-card')}?chat_id=${chatId}`, { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    return d.card || null;
  } catch { return null; }
}

// ── Переход к оформлению (Экран 4) ───────────────────────────────────
async function goCheckout() {
  const address = document.getElementById('addressInput').value.trim();
  if (!address) {
    document.getElementById('addressInput').focus();
    document.getElementById('addressInput').style.borderColor = 'red';
    setTimeout(() => document.getElementById('addressInput').style.borderColor = '', 1500);
    return;
  }

  // Показываем экран СРАЗУ — не ждём сеть
  renderCheckout();
  showScreen('checkout');

  // Геокодируем адрес в фоне если зона не определена
  if (!deliveryCost || deliveryCost === 0) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 4000);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ' Экибастуз')}&format=json&limit=1&accept-language=ru&countrycodes=kz`;
      const r   = await fetch(url, { headers: { 'User-Agent': 'YaYaChicken/1.0' }, signal: ctrl.signal });
      const data = await r.json();
      if (data && data[0]) {
        const zone = getDeliveryZone(parseFloat(data[0].lat), parseFloat(data[0].lon));
        if (zone) {
          deliveryCost = zone.cost;
          // Обновляем итог на экране если он уже открыт
          renderCheckout();
        }
      }
    } catch(e) { /* тихо — не блокируем */ }
  }

  // Грузим сохранённую карту в фоне
  loadSavedCard().then(card => {
    if (card) {
      savedCard = card;
      renderPaymentMethods(); // обновляем только блок оплаты
    }
  });
}

// ── Выбор метода оплаты ───────────────────────────────────────────────
function selectPay(method) {
  payMethod = method;

  // Снимаем все выделения
  document.querySelectorAll('.pay-opt').forEach(el => el.classList.remove('selected'));

  // Выделяем выбранный
  const selected = document.getElementById('pay-' + method);
  if (selected) selected.classList.add('selected');

  // Скрываем все доп. блоки
  ['qrBlock', 'remoteBlock', 'freedomBlock', 'jusanBlock', 'forteBlock', 'savedCardBlock']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    });

  // Показываем нужный блок
  switch (method) {

    case 'kaspi-qr': {
      const { total } = getStats();
      const grand = total + (deliveryCost || 0);
      document.getElementById('qrAmount').textContent = grand > 0 ? 'К оплате: ' + grand.toLocaleString('ru') + ' тг' : '';
      document.getElementById('qrImg').src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(KASPI_QR_LINK);
      document.getElementById('qrBlock').classList.add('show');
      break;
    }

    case 'kaspi-remote':
      document.getElementById('remoteLabel').textContent = 'Ваш номер Kaspi — на него придёт запрос на оплату:';
      document.getElementById('remoteBlock').classList.add('show');
      setTimeout(() => document.getElementById('remotePhone').focus(), 100);
      break;

    case 'halyk-remote':
      document.getElementById('remoteLabel').textContent = 'Ваш номер Halyk Bank — на него придёт запрос на оплату:';
      document.getElementById('remoteBlock').classList.add('show');
      setTimeout(() => document.getElementById('remotePhone').focus(), 100);
      break;

    case 'freedom':
      document.getElementById('freedomBlock').classList.add('show');
      break;

    case 'jusan':
      document.getElementById('jusanBlock').classList.add('show');
      break;

    case 'forte':
      document.getElementById('forteBlock').classList.add('show');
      break;

    case 'saved-card':
      document.getElementById('savedCardBlock').classList.add('show');
      break;
  }
}

// ── Метки для квитанции ───────────────────────────────────────────────
function getPayLabel() {
  const map = {
    'cash':          '💵 Наличные',
    'kaspi-qr':      '📱 Kaspi QR',
    'kaspi-remote':  '💳 Kaspi удалённый',
    'halyk-remote':  '🏦 Halyk удалённый',
    'freedom':       '🟣 Freedom Pay',
    'jusan':         '🔵 Jusan Pay',
    'forte':         '🟠 Forte Pay',
    'saved-card':    savedCard ? `💳 ${savedCard.brand} •••• ${savedCard.last4}` : '💳 Карта',
  };
  return map[payMethod] || payMethod;
}

function getPayPhone() {
  if (payMethod === 'kaspi-remote' || payMethod === 'halyk-remote') {
    return document.getElementById('remotePhone')?.value.trim() || null;
  }
  return null;
}

// ── Переключатель "для другого" ───────────────────────────────────────
function toggleOther() {
  forOther = !forOther;
  document.getElementById('otherToggle').classList.toggle('on', forOther);
  document.getElementById('otherPhone').style.display = forOther ? 'block' : 'none';
}

// ── Рендер блока способов оплаты ─────────────────────────────────────
function renderPaymentMethods() {
  const container = document.getElementById('paymentMethodsContainer');
  if (!container) return;

  const savedCardHTML = savedCard ? `
    <div class="pay-opt pay-opt-saved" id="pay-saved-card" onclick="selectPay('saved-card')">
      <div class="pay-opt-inner">
        <span class="pay-emoji">💳</span>
        <div>
          <div class="pay-name">${savedCard.brand} •••• ${savedCard.last4}</div>
          <div class="pay-badge">Сохранённая карта</div>
        </div>
      </div>
    </div>` : '';

  container.innerHTML = `
    <!-- Сохранённая карта (если есть) -->
    ${savedCardHTML}

    <!-- Стандартные методы -->
    <div class="pay-section-label">Банковские переводы</div>
    <div class="pay-grid">
      <div class="pay-opt" id="pay-kaspi-remote" onclick="selectPay('kaspi-remote')">
        <div class="pay-opt-inner">
          <span class="pay-emoji">💳</span>
          <div>
            <div class="pay-name">Kaspi</div>
            <div class="pay-sub">удалённый счёт</div>
          </div>
        </div>
      </div>
      <div class="pay-opt" id="pay-halyk-remote" onclick="selectPay('halyk-remote')">
        <div class="pay-opt-inner">
          <span class="pay-emoji">🏦</span>
          <div>
            <div class="pay-name">Halyk</div>
            <div class="pay-sub">удалённый счёт</div>
          </div>
        </div>
      </div>
    </div>

    <div class="pay-section-label">Онлайн оплата картой</div>
    <div class="pay-grid pay-grid-3">
      <div class="pay-opt" id="pay-freedom" onclick="selectPay('freedom')">
        <div class="pay-opt-inner pay-opt-inner--col">
          <span class="pay-emoji">🟣</span>
          <div class="pay-name">Freedom Pay</div>
        </div>
      </div>
      <div class="pay-opt" id="pay-jusan" onclick="selectPay('jusan')">
        <div class="pay-opt-inner pay-opt-inner--col">
          <span class="pay-emoji">🔵</span>
          <div class="pay-name">Jusan Pay</div>
        </div>
      </div>
      <div class="pay-opt" id="pay-forte" onclick="selectPay('forte')">
        <div class="pay-opt-inner pay-opt-inner--col">
          <span class="pay-emoji">🟠</span>
          <div class="pay-name">Forte Pay</div>
        </div>
      </div>
    </div>

    <div class="pay-section-label">Другое</div>
    <div class="pay-grid">
      <div class="pay-opt selected" id="pay-cash" onclick="selectPay('cash')">
        <div class="pay-opt-inner">
          <span class="pay-emoji">💵</span>
          <div>
            <div class="pay-name">Наличные</div>
            <div class="pay-sub">курьеру при получении</div>
          </div>
        </div>
      </div>
      <div class="pay-opt" id="pay-kaspi-qr" onclick="selectPay('kaspi-qr')">
        <div class="pay-opt-inner">
          <span class="pay-emoji">📱</span>
          <div>
            <div class="pay-name">Kaspi QR</div>
            <div class="pay-sub">сканируйте код</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Доп. блоки для каждого метода -->

    <!-- Kaspi QR -->
    <div class="pay-detail-block" id="qrBlock">
      <img id="qrImg" src="" alt="Kaspi QR" style="width:180px;height:180px;border-radius:12px;display:block;margin:0 auto 10px;background:white;">
      <div style="font-size:13px;font-weight:700;color:var(--orange-dark);text-align:center;line-height:1.6;">
        Откройте Kaspi.kz → QR-сканер<br>и отсканируйте код для оплаты
      </div>
      <div style="font-size:17px;font-weight:900;color:var(--orange);text-align:center;margin-top:8px;" id="qrAmount"></div>
    </div>

    <!-- Удалённый (Kaspi / Halyk) -->
    <div class="pay-detail-block" id="remoteBlock">
      <div class="remote-label" id="remoteLabel">Номер телефона:</div>
      <input class="form-input" id="remotePhone" type="tel" placeholder="+7 777 000 00 00" style="height:48px;margin-top:8px;">
    </div>

    <!-- Freedom Pay -->
    <div class="pay-detail-block" id="freedomBlock">
      <div class="provider-info">
        <div class="provider-logo" style="background:#7B2FBE;">🟣</div>
        <div>
          <div style="font-size:14px;font-weight:800;">Freedom Pay</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px;">Оплата картой Visa / Mastercard / МИР</div>
        </div>
      </div>
      <div class="provider-note">
        После подтверждения заказа откроется страница оплаты Freedom Pay.
        Карта будет сохранена для быстрой оплаты в следующий раз.
      </div>
      <div class="provider-badge">🔒 Защищено Freedom Pay · PCI DSS</div>
    </div>

    <!-- Jusan Pay -->
    <div class="pay-detail-block" id="jusanBlock">
      <div class="provider-info">
        <div class="provider-logo" style="background:#005DAA;">🔵</div>
        <div>
          <div style="font-size:14px;font-weight:800;">Jusan Pay</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px;">Оплата через Jusan Bank · Visa / Mastercard</div>
        </div>
      </div>
      <div class="provider-note">
        После подтверждения заказа откроется страница оплаты Jusan Pay.
        Карта будет сохранена для быстрой оплаты в следующий раз.
      </div>
      <div class="provider-badge">🔒 Защищено Jusan Bank · PCI DSS</div>
    </div>

    <!-- Forte Pay -->
    <div class="pay-detail-block" id="forteBlock">
      <div class="provider-info">
        <div class="provider-logo" style="background:#E87722;">🟠</div>
        <div>
          <div style="font-size:14px;font-weight:800;">Forte Pay</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px;">Оплата через Forte Bank · Visa / Mastercard</div>
        </div>
      </div>
      <div class="provider-note">
        После подтверждения заказа откроется страница оплаты Forte Pay.
        Карта будет сохранена для быстрой оплаты в следующий раз.
      </div>
      <div class="provider-badge">🔒 Защищено Forte Bank · PCI DSS</div>
    </div>

    <!-- Сохранённая карта -->
    <div class="pay-detail-block" id="savedCardBlock">
      <div class="saved-card-preview">
        <div class="saved-card-chip"></div>
        <div class="saved-card-number">•••• •••• •••• ${savedCard?.last4 || '????'}</div>
        <div class="saved-card-brand">${savedCard?.brand || 'Card'}</div>
      </div>
      <div class="provider-note" style="margin-top:10px;">
        Оплата спишется мгновенно при подтверждении заказа.
      </div>
      <button class="delete-card-btn" onclick="confirmDeleteCard()">🗑 Удалить карту</button>
    </div>`;

  // Если нет сохранённой карты — выбираем наличные по умолчанию
  if (!savedCard) {
    payMethod = 'cash';
  } else {
    // Если карта есть — предлагаем её
    selectPay('saved-card');
  }
}

function confirmDeleteCard() {
  if (confirm('Удалить сохранённую карту?')) {
    const chatId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (chatId) {
      fetch(WEBHOOK.replace('/order', '/delete-card'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId })
      }).catch(() => {});
    }
    savedCard = null;
    renderPaymentMethods();
  }
}

// ── Рендер экрана оформления ──────────────────────────────────────────
function renderCheckout() {
  const items = [];
  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const item = findItem(id);
    if (item) items.push({ ...item, qty });
  }
  const { total } = getStats();
  const delivery  = deliveryCost || 0;
  const address   = document.getElementById('addressInput').value.trim();

  // Состав заказа
  document.getElementById('checkoutItems').innerHTML = `
    <div class="form-label" style="margin-bottom:10px;">🧾 Состав заказа</div>
    ${items.map(i => `
      <div style="padding:8px 0;border-bottom:1px solid var(--gray2);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:800;line-height:1.3;">${i.name}</div>
            ${i.desc ? `<div class="co-item-desc">${i.desc}</div>` : ''}
            <div style="font-size:12px;color:var(--text2);font-weight:600;margin-top:3px;">${i.price.toLocaleString('ru')} тг × ${i.qty}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-top:2px;">
            <button class="qty-btn" onclick="removeItem('${i.id}');renderCheckout()">−</button>
            <span class="qty-num">${i.qty}</span>
            <button class="qty-btn" onclick="addItem('${i.id}');renderCheckout()">+</button>
            <div style="font-size:14px;font-weight:900;color:var(--orange);min-width:70px;text-align:right;">${(i.price * i.qty).toLocaleString('ru')} тг</div>
          </div>
        </div>
      </div>`).join('')}`;

  // Итог
  document.getElementById('checkoutSummary').innerHTML = `
    <div class="form-label" style="margin-bottom:10px;">📋 Итог</div>
    <div class="summary-row">
      <span class="summary-label">📍 Адрес</span>
      <span style="font-size:12px;font-weight:700;text-align:right;max-width:190px;color:var(--text);">${address}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Сумма заказа</span>
      <span class="summary-val">${total.toLocaleString('ru')} тг</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Доставка</span>
      <span class="summary-val" style="color:var(--orange);">${delivery > 0 ? delivery.toLocaleString('ru') + ' тг' : 'Бесплатно'}</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-row">
      <span class="summary-total-label">К оплате</span>
      <span class="summary-total-val">${(total + delivery).toLocaleString('ru')} тг</span>
    </div>`;

  // Методы оплаты
  renderPaymentMethods();
}

// ── Подтверждение заказа ──────────────────────────────────────────────
let currentOrderNum = null;

function confirmOrder() {
  const address = document.getElementById('addressInput').value.trim();
  if (!address) {
    document.getElementById('addressInput').focus();
    document.getElementById('addressInput').style.borderColor = 'red';
    setTimeout(() => document.getElementById('addressInput').style.borderColor = '', 1500);
    return;
  }

  if (payMethod === 'kaspi-remote' || payMethod === 'halyk-remote') {
    const rp = document.getElementById('remotePhone');
    if (!rp?.value.trim()) {
      rp.focus(); rp.style.borderColor = 'red';
      setTimeout(() => rp.style.borderColor = '', 1500);
      return;
    }
  }

  const items = [];
  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const item = findItem(id);
    if (item) items.push({ name: item.name, price: item.price, qty, desc: item.desc || '' });
  }

  const { total } = getStats();
  const comment = document.getElementById('commentInput').value.trim();
  const phone   = forOther ? document.getElementById('phoneInput').value.trim() : null;
  const chatId  = tg?.initDataUnsafe?.user?.id || null;

  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  btn.textContent = 'Отправляем...';

  // Получаем номер заказа
  const numCtrl = new AbortController();
  setTimeout(() => numCtrl.abort(), 5000);

  fetch(WEBHOOK.replace('/order', '/next-order-num'), { signal: numCtrl.signal })
    .then(r => r.json())
    .then(d => { currentOrderNum = d.num; })
    .catch(() => { currentOrderNum = null; })
    .finally(() => {
      const orderData = {
        items, total, address, comment,
        delivery:        deliveryCost || 0,
        pay_method:      payMethod,
        pay_phone:       getPayPhone(),
        for_other:       forOther,
        recipient_phone: phone || null,
        chat_id:         chatId,
        order_num:       currentOrderNum,
        // Для карточных методов — пометка что нужна онлайн-оплата
        needs_online_payment: ['freedom', 'jusan', 'forte', 'saved-card'].includes(payMethod),
        saved_card_token: payMethod === 'saved-card' ? 'USE_SAVED' : null,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
        signal: controller.signal
      })
        .then(r => r.json())
        .then(r => {
          clearTimeout(timeout);
          if (r.num) currentOrderNum = r.num;
          // Для онлайн-оплаты — открываем страницу провайдера
          if (r.payment_url) {
            window.open(r.payment_url, '_blank');
          }
          showReceipt(currentOrderNum);
          showScreen('success');
        })
        .catch(err => {
          clearTimeout(timeout);
          console.log('webhook:', err.message);
          showReceipt(currentOrderNum);
          showScreen('success');
        });
    });
}

// ── Квитанция (Экран 5) ───────────────────────────────────────────────
function showReceipt(orderNum) {
  const num = orderNum || currentOrderNum || '—';
  const items = [];
  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const item = findItem(id);
    if (item) items.push({ ...item, qty });
  }
  const { total } = getStats();
  const delivery  = deliveryCost || 0;
  const totalAll  = total + delivery;
  const address   = document.getElementById('addressInput').value.trim();
  const comment   = document.getElementById('commentInput').value.trim();
  const payStr    = getPayLabel();
  const payPhone  = getPayPhone();
  const now       = new Date();
  const dateStr   = now.toLocaleString('ru', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

  document.getElementById('receiptDate').textContent = '№' + num + ' · ' + dateStr;

  document.getElementById('receiptItems').innerHTML =
    '<div style="font-size:12px;font-weight:800;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Состав заказа</div>' +
    items.map(i => `
      <div style="padding:6px 0;border-bottom:1px solid var(--gray2);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:800;">${i.name} ×${i.qty}</div>
            ${i.desc ? `<div class="receipt-item-desc">${i.desc}</div>` : ''}
          </div>
          <span style="font-size:13px;font-weight:900;white-space:nowrap;">${(i.price * i.qty).toLocaleString('ru')} тг</span>
        </div>
      </div>`).join('');

  document.getElementById('receiptTotal').innerHTML = `
    <div style="margin-top:8px;">
      <div style="display:flex;justify-content:space-between;padding:4px 0;">
        <span style="font-size:13px;color:var(--text2);font-weight:600;">Сумма заказа</span>
        <span style="font-size:13px;font-weight:800;">${total.toLocaleString('ru')} тг</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;">
        <span style="font-size:13px;color:var(--text2);font-weight:600;">Доставка</span>
        <span style="font-size:13px;font-weight:800;color:var(--orange);">${delivery > 0 ? delivery.toLocaleString('ru') + ' тг' : 'Бесплатно'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;margin-top:4px;border-top:2px solid var(--text);">
        <span style="font-size:16px;font-weight:900;">К ОПЛАТЕ</span>
        <span style="font-size:16px;font-weight:900;color:var(--orange);">${totalAll.toLocaleString('ru')} тг</span>
      </div>
    </div>`;

  const recipientPhone = forOther ? document.getElementById('phoneInput')?.value.trim() : null;

  const pdfBtn = document.getElementById('pdfBtnWrap');
  const tgBtn  = document.getElementById('tgReceiptBtn');
  const isMobileTG = tg && tg.initDataUnsafe?.user && window.innerWidth <= 600;
  if (pdfBtn) pdfBtn.style.display = isMobileTG ? 'none' : 'block';
  if (tgBtn)  tgBtn.style.display  = isMobileTG ? 'flex'  : 'none';

  document.getElementById('receiptInfo').innerHTML = `
    <div style="background:var(--gray);border-radius:10px;padding:10px;margin-top:8px;font-size:12px;font-weight:700;color:var(--text2);line-height:1.8;">
      📍 ${address}
      ${comment ? '<br>💬 ' + comment : ''}
      ${recipientPhone ? '<br>👤 Получатель: ' + recipientPhone : ''}
      ${payPhone ? '<br>📲 Счёт на номер: ' + payPhone : ''}
      <br>${payStr}
    </div>`;
}

// ── Отправка квитанции в Telegram ─────────────────────────────────────
function sendReceiptToBot() {
  const items = [];
  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const item = findItem(id);
    if (item) items.push({ ...item, qty });
  }
  const { total } = getStats();
  const delivery  = deliveryCost || 0;
  const address   = document.getElementById('addressInput').value.trim();
  const comment   = document.getElementById('commentInput').value.trim();
  const recipientPhone = forOther ? document.getElementById('phoneInput')?.value.trim() : null;
  const now     = new Date();
  const dateStr = now.toLocaleString('ru', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const num     = currentOrderNum || Date.now().toString().slice(-6);
  const chatId  = tg?.initDataUnsafe?.user?.id || null;

  const receiptData = {
    type: 'RECEIPT', num, date: dateStr, chat_id: chatId,
    items: items.map(i => ({ name: i.name, qty: i.qty, total: i.price * i.qty, desc: i.desc || '' })),
    subtotal: total, delivery, total: total + delivery,
    address, comment,
    recipient_phone: recipientPhone,
    pay_method:  payMethod,
    pay_phone:   getPayPhone(),
  };

  const btn = document.getElementById('tgReceiptBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Отправляем...'; }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 5000);
  fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(receiptData),
    signal: controller.signal
  })
    .then(() => { if (btn) btn.textContent = '✅ Квитанция отправлена!'; })
    .catch(() => { if (btn) { btn.disabled = false; btn.textContent = '📨 Получить квитанцию в Telegram'; } });
}

// ── Скачать PDF квитанцию ─────────────────────────────────────────────
function downloadPDF() {
  const items = [];
  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const item = findItem(id);
    if (item) items.push({ ...item, qty });
  }
  const { total } = getStats();
  const delivery  = deliveryCost || 0;
  const totalAll  = total + delivery;
  const address   = document.getElementById('addressInput').value.trim();
  const payStr    = getPayLabel();
  const payPhone  = getPayPhone();
  const comment   = document.getElementById('commentInput').value.trim();
  const recipientPhone = forOther ? document.getElementById('phoneInput')?.value.trim() : null;
  const now     = new Date();
  const dateStr = now.toLocaleString('ru', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const num     = currentOrderNum || Date.now().toString().slice(-6);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Квитанция YaYa Chicken</title>
  <style>body{font-family:Arial,sans-serif;max-width:400px;margin:20px auto;padding:20px;color:#1a1a1a;}
  .header{background:#F4821F;color:white;padding:16px;text-align:center;border-radius:12px 12px 0 0;}
  .header h2{margin:0;font-size:20px;}.header p{margin:4px 0 0;font-size:12px;opacity:0.85;}
  .body{border:2px solid #e8e8e8;border-top:none;border-radius:0 0 12px 12px;padding:16px;}
  .item-block{padding:6px 0;border-bottom:1px solid #f0f0f0;}
  .item-row{display:flex;justify-content:space-between;font-size:13px;}
  .item-desc{font-size:11px;color:#999;margin-top:2px;line-height:1.3;}
  .total-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;color:#666;}
  .total-final{display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #1a1a1a;font-size:16px;font-weight:bold;margin-top:8px;}
  .info{background:#f5f5f5;border-radius:8px;padding:10px;margin-top:12px;font-size:12px;line-height:1.8;}
  .footer{text-align:center;margin-top:16px;font-size:11px;color:#666;border-top:1px dashed #ccc;padding-top:12px;}
  .stitle{font-size:11px;font-weight:bold;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 6px;}</style>
  </head><body>
  <div class="header"><h2>YaYa Chicken</h2><p>ул. Абая, 49/5 · Экибастуз</p><p>№${num} · ${dateStr}</p></div>
  <div class="body">
    <div class="stitle">Состав заказа</div>
    ${items.map(i => `
      <div class="item-block">
        <div class="item-row"><span>${i.name} ×${i.qty}</span><span>${(i.price * i.qty).toLocaleString('ru')} тг</span></div>
        ${i.desc ? `<div class="item-desc">${i.desc}</div>` : ''}
      </div>`).join('')}
    <div class="total-row" style="margin-top:4px;"><span>Доставка</span><span>${delivery > 0 ? delivery.toLocaleString('ru') + ' тг' : 'Бесплатно'}</span></div>
    <div class="total-final"><span>К ОПЛАТЕ</span><span style="color:#F4821F;">${totalAll.toLocaleString('ru')} тг</span></div>
    <div class="info">📍 ${address}${comment ? '<br>💬 ' + comment : ''}${recipientPhone ? '<br>👤 Получатель: ' + recipientPhone : ''}${payPhone ? '<br>📲 Счёт на номер: ' + payPhone : ''}<br>${payStr}</div>
    <div class="footer">Сохраните квитанцию для подтверждения заказа<br>Время доставки: ~45-60 минут<br>Спасибо что выбрали YaYa Chicken! ❤️</div>
  </div></body></html>`;

  try {
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `YaYa_Kvitanciya_${num}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch(e) {
    window.open('data:text/html;charset=utf-8,' + encodeURIComponent(html), '_blank');
  }
}
