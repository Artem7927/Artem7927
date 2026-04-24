// ── Корзина ───────────────────────────────────────────────────────────

function getStats() {
  let total = 0, count = 0;
  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const item = findItem(id);
    if (item) { total += item.price * qty; count += qty; }
  }
  return { total, count };
}

function addItem(id) {
  cart[id] = (cart[id] || 0) + 1;
  updateCard(id);
  updateCartBar();
}

function removeItem(id) {
  cart[id] = Math.max(0, (cart[id] || 0) - 1);
  updateCard(id);
  updateCartBar();
}

// ── Навигация ─────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  window.scrollTo(0, 0);
}

function goMenu() { showScreen('menu'); }

function goCart() { renderCart(); showScreen('cart'); }

function goAddress() { showScreen('address'); }

// ── Рендер корзины (Экран 2) ──────────────────────────────────────────
function renderCart() {
  const items = [];
  for (const [id, qty] of Object.entries(cart)) {
    if (qty <= 0) continue;
    const item = findItem(id);
    if (item) items.push({ ...item, qty });
  }
  const { total } = getStats();
  const deliveryAmt = deliveryCost || 0;

  document.getElementById('cartItems').innerHTML = items.map(item => `
    <div class="cart-item">
      <div class="ci-emoji">${item.emoji}</div>
      <div class="ci-info">
        <div class="ci-name">${item.name}</div>
        ${item.desc ? `<div class="ci-desc">${item.desc}</div>` : ''}
        <div class="ci-price">${item.price.toLocaleString('ru')} тг × ${item.qty}</div>
      </div>
      <div class="ci-right">
        <div class="qty-control">
          <button class="qty-btn" onclick="removeItem('${item.id}');renderCart()">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="addItem('${item.id}');renderCart()">+</button>
        </div>
        <div class="ci-total">${(item.price * item.qty).toLocaleString('ru')} тг</div>
      </div>
    </div>`).join('');

  document.getElementById('cartSummary').innerHTML = `
    <div class="summary-row">
      <span class="summary-label">Позиций</span>
      <span class="summary-val">${items.reduce((a, i) => a + i.qty, 0)} шт</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Сумма заказа</span>
      <span class="summary-val">${total.toLocaleString('ru')} тг</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Доставка</span>
      <span class="summary-val" style="color:var(--orange)">${deliveryAmt > 0 ? deliveryAmt.toLocaleString('ru') + ' тг' : 'Уточняется'}</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-row">
      <span class="summary-total-label">Итого</span>
      <span class="summary-total-val">${deliveryAmt > 0 ? (total + deliveryAmt).toLocaleString('ru') + ' тг' : total.toLocaleString('ru') + ' тг'}</span>
    </div>`;
}
