// ── Переход к оформлению (Экран 4) ───────────────────────────────────
async function goCheckout() {
  const address = document.getElementById('addressInput').value.trim();
  if (!address) {
    document.getElementById('addressInput').focus();
    document.getElementById('addressInput').style.borderColor = 'red';
    setTimeout(() => document.getElementById('addressInput').style.borderColor = '', 1500);
    return;
  }
  if (!deliveryCost || deliveryCost === 0) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ' Экибастуз')}&format=json&limit=1&accept-language=ru&countrycodes=kz`;
      const r = await fetch(url, { headers: { 'User-Agent': 'YaYaChicken/1.0' } });
      const data = await r.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        const zone = getDeliveryZone(lat, lng);
        if (zone) {
          deliveryCost = zone.cost;
          const status = document.getElementById('geoStatus');
          status.style.display = 'block';
          status.style.color = 'green';
          status.textContent = '✅ Доставка: ' + zone.price;
        }
      }
    } catch (e) { console.log('geocode error:', e); }
  }
  renderCheckout();
  showScreen('checkout');
}

// ── Оплата ────────────────────────────────────────────────────────────
const KASPI_QR_LINK = 'https://pay.kaspi.kz/pay/yayachicken';

function selectPay(method) {
  payMethod = method;
  ['pay-cash', 'pay-kaspi-qr', 'pay-kaspi-remote', 'pay-halyk-remote']
    .forEach(id => document.getElementById(id).classList.remove('selected'));
  document.getElementById('pay-' + method).classList.add('selected');

  const qrBlock     = document.getElementById('qrBlock');
  const remoteBlock = document.getElementById('remoteBlock');
  const remoteLabel = document.getElementById('remoteLabel');

  qrBlock.classList.remove('show');
  remoteBlock.classList.remove('show');

  if (method === 'kaspi-qr') {
    const { total } = getStats();
    const grand = total + (deliveryCost || 0);
    document.getElementById('qrAmount').textContent =
      grand > 0 ? 'К оплате: ' + grand.toLocaleString('ru') + ' тг' : '';
    document.getElementById('qrImg').src =
      'https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=' + encodeURIComponent(KASPI_QR_LINK);
    qrBlock.classList.add('show');
  } else if (method === 'kaspi-remote') {
    remoteLabel.textContent = 'Ваш номер Kaspi — на него придёт запрос на оплату:';
    remoteBlock.classList.add('show');
    setTimeout(() => document.getElementById('remotePhone').focus(), 100);
  } else if (method === 'halyk-remote') {
    remoteLabel.textContent = 'Ваш номер Halyk Bank — на него придёт запрос на оплату:';
    remoteBlock.classList.add('show');
    setTimeout(() => document.getElementById('remotePhone').focus(), 100);
  }
}

function getPayLabel() {
  const map = {
    'cash': '💵 Наличные',
    'kaspi-qr': '📱 Kaspi QR',
    'kaspi-remote': '💳 Kaspi удалённый',
    'halyk-remote': '🏦 Halyk удалённый',
  };
  return map[payMethod] || payMethod;
}

function getPayPhone() {
  if (payMethod === 'kaspi-remote' || payMethod === 'halyk-remote') {
    return document.getElementById('remotePhone').value.trim() || null;
  }
  return null;
}

function toggleOther() {
  forOther = !forOther;
  document.getElementById('otherToggle').classList.toggle('on', forOther);
  document.getElementById('otherPhone').style.display = forOther ? 'block' : 'none';
}

// ── Рендер экрана оформления (Экран 4) ───────────────────────────────
function renderCheckout() {
  const items = [];
  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const item = findItem(id);
    if (item) items.push({ ...item, qty });
  }
  const { total } = getStats();
  const delivery = deliveryCost || 0;
  const address = document.getElementById('addressInput').value.trim();

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
}

// ── Подтверждение заказа ──────────────────────────────────────────────
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
    if (!rp.value.trim()) {
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

  const orderData = {
    items, total, address, comment,
    delivery:        deliveryCost || 0,
    pay_method:      payMethod,
    pay_phone:       getPayPhone(),
    for_other:       forOther,
    recipient_phone: phone || null,
    chat_id:         chatId,
  };

  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  btn.textContent = 'Отправляем...';

  const WEBHOOK = 'https://bonded-ditch-divisible.ngrok-free.dev/order';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
    signal: controller.signal
  })
    .then(r => r.json())
    .then(r => { console.log('order sent:', r); })
    .catch(err => { console.log('webhook:', err.message); })
    .finally(() => {
      clearTimeout(timeout);
      showReceipt();
      showScreen('success');
    });
}

// ── Квитанция (Экран 5) ───────────────────────────────────────────────
function showReceipt() {
  const items = [];
  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const item = findItem(id);
    if (item) items.push({ ...item, qty });
  }
  const { total } = getStats();
  const delivery = deliveryCost || 0;
  const totalAll = total + delivery;
  const address = document.getElementById('addressInput').value.trim();
  const comment = document.getElementById('commentInput').value.trim();
  const payStr  = getPayLabel();
  const payPhone = getPayPhone();
  const now = new Date();
  const dateStr = now.toLocaleString('ru', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

  document.getElementById('receiptDate').textContent = '№' + Date.now().toString().slice(-6) + ' · ' + dateStr;

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
      </div>`
    ).join('');

  document.getElementById('receiptTotal').innerHTML =
    `<div style="margin-top:8px;">
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

  const recipientPhone = forOther ? document.getElementById('phoneInput').value.trim() : null;
  const pdfBtn = document.getElementById('pdfBtnWrap');
  const tgBtn  = document.getElementById('tgReceiptBtn');
  const isMobileTG = tg && tg.initDataUnsafe && tg.initDataUnsafe.user && window.innerWidth <= 600;
  if (pdfBtn) pdfBtn.style.display = isMobileTG ? 'none' : 'block';
  if (tgBtn)  tgBtn.style.display  = isMobileTG ? 'flex'  : 'none';

  document.getElementById('receiptInfo').innerHTML =
    `<div style="background:var(--gray);border-radius:10px;padding:10px;margin-top:8px;font-size:12px;font-weight:700;color:var(--text2);line-height:1.8;">
      📍 ${address}
      ${comment ? '<br>💬 ' + comment : ''}
      ${recipientPhone ? '<br>👤 Получатель: ' + recipientPhone : ''}
      ${payPhone ? '<br>📲 Счёт на номер: ' + payPhone : ''}
      <br>${payStr}
    </div>`;
}

function sendReceiptToBot() {
  const items = [];
  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const item = findItem(id);
    if (item) items.push({ ...item, qty });
  }
  const { total } = getStats();
  const delivery = deliveryCost || 0;
  const address = document.getElementById('addressInput').value.trim();
  const comment = document.getElementById('commentInput').value.trim();
  const recipientPhone = forOther ? document.getElementById('phoneInput').value.trim() : null;
  const now = new Date();
  const dateStr = now.toLocaleString('ru', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const num    = Date.now().toString().slice(-6);
  const chatId = tg?.initDataUnsafe?.user?.id || null;

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

  const WEBHOOK = 'https://bonded-ditch-divisible.ngrok-free.dev/order';
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 5000);
  fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(receiptData), signal: controller.signal })
    .then(() => { if (btn) btn.textContent = '✅ Квитанция отправлена!'; })
    .catch(() => { if (btn) { btn.disabled = false; btn.textContent = '📨 Получить квитанцию в Telegram'; } });
}

function downloadPDF() {
  const items = [];
  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const item = findItem(id);
    if (item) items.push({ ...item, qty });
  }
  const { total } = getStats();
  const delivery = deliveryCost || 0;
  const totalAll = total + delivery;
  const address  = document.getElementById('addressInput').value.trim();
  const payStr   = getPayLabel();
  const payPhone = getPayPhone();
  const comment  = document.getElementById('commentInput').value.trim();
  const recipientPhone = forOther ? document.getElementById('phoneInput').value.trim() : null;
  const now = new Date();
  const dateStr = now.toLocaleString('ru', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const num = Date.now().toString().slice(-6);

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
    <div class="total-row" style="color:#666;margin-top:4px;"><span>Доставка</span><span>${delivery > 0 ? delivery.toLocaleString('ru') + ' тг' : 'Бесплатно'}</span></div>
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
  } catch (e) {
    window.open('data:text/html;charset=utf-8,' + encodeURIComponent(html), '_blank');
  }
}
