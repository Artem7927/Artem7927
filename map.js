// ── Зоны доставки ─────────────────────────────────────────────────────
const DELIVERY_ZONES_DATA = [
  {price:'600 тг',  cost:600,  color:'#2ecc71', pts:[[51.731028,75.309551],[51.733304,75.321793],[51.721900,75.327497],[51.719624,75.315255]]},
  {price:'700 тг',  cost:700,  color:'#f1c40f', pts:[[51.735592,75.300578],[51.740143,75.325062],[51.717336,75.336470],[51.712784,75.311986]]},
  {price:'800 тг',  cost:800,  color:'#9b59b6', pts:[[51.740156,75.291604],[51.746983,75.328332],[51.712771,75.345444],[51.705945,75.308716]]},
  {price:'900 тг',  cost:900,  color:'#3498db', pts:[[51.744720,75.282631],[51.753822,75.331601],[51.708207,75.354417],[51.699105,75.305447]]},
  {price:'1000 тг', cost:1000, color:'#F4821F', pts:[[51.749284,75.273658],[51.760662,75.334870],[51.703643,75.363390],[51.692265,75.302178]]},
  {price:'1100 тг', cost:1100, color:'#e91e8c', pts:[[51.753848,75.264685],[51.767502,75.338139],[51.699079,75.372363],[51.685425,75.298909]]},
  {price:'1500 тг', cost:1500, color:'#e74c3c', pts:[[51.758412,75.255712],[51.774341,75.341408],[51.694515,75.381336],[51.678585,75.295640]]},
];

function pipCheck(point, polygon) {
  let inside = false;
  const x = point[0], y = point[1];
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

function getDeliveryZone(lat, lng) {
  for (const z of DELIVERY_ZONES_DATA) {
    if (pipCheck([lat, lng], z.pts)) return z;
  }
  return null;
}

// ── Геолокация и карта ────────────────────────────────────────────────
let map = null, marker = null, mapVisible = false;

function showGeoStatus(msg, color) {
  const s = document.getElementById('geoStatus');
  s.style.display = 'block';
  s.style.color = color || 'var(--text2)';
  s.textContent = msg;
}

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru`,
      { headers: { 'User-Agent': 'YaYaChicken/1.0' } }
    );
    const data = await r.json();
    const a = data.address || {};
    const parts = [
      a.road || a.pedestrian || a.street || '',
      a.house_number || '',
      a.suburb || a.neighbourhood || a.quarter || '',
      a.city || a.town || a.village || '',
    ].filter(Boolean);
    return parts.join(', ') || data.display_name?.split(',').slice(0, 3).join(',').trim() || '';
  } catch (e) { return ''; }
}

function getGeo() {
  showGeoStatus('⏳ Определяем местоположение...', 'var(--orange)');
  if (!navigator.geolocation) {
    showGeoStatus('Геолокация недоступна. Укажите адрес на карте или введите вручную.', 'red');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      showGeoStatus('⏳ Получаем адрес...', 'var(--orange)');
      const addr = await reverseGeocode(lat, lng);
      const zone = getDeliveryZone(lat, lng);
      if (addr) {
        document.getElementById('addressInput').value = addr;
        showGeoStatus('✅ ' + addr + (zone ? ' — доставка ' + zone.price : ' — вне зоны'), zone ? 'green' : 'red');
      } else {
        showGeoStatus('✏️ Укажите адрес вручную' + (zone ? ' — доставка ' + zone.price : ''), 'var(--orange)');
      }
      if (zone) deliveryCost = zone.cost;
      if (!mapVisible) toggleMap();
      setTimeout(() => {
        if (map) {
          map.setView([lat, lng], 17);
          if (marker) marker.setLatLng([lat, lng]);
          else marker = L.marker([lat, lng]).addTo(map);
        }
      }, 300);
    },
    () => { showGeoStatus('Не удалось определить. Укажите адрес на карте или введите вручную.', 'red'); },
    { timeout: 8000, enableHighAccuracy: false }
  );
}

function toggleMap() {
  const container = document.getElementById('mapContainer');
  const btn = document.getElementById('mapToggleBtn');
  mapVisible = !mapVisible;
  container.style.display = mapVisible ? 'block' : 'none';
  btn.style.background  = mapVisible ? 'var(--orange-light)' : 'var(--gray)';
  btn.style.borderColor = mapVisible ? 'var(--orange)' : 'var(--gray2)';
  btn.style.color       = mapVisible ? 'var(--orange)' : 'var(--text)';

  if (mapVisible && !map) {
    setTimeout(() => {
      map = L.map('map', { attributionControl: false }).setView([51.7167, 75.3667], 13);
      DELIVERY_ZONES_DATA.slice().reverse().forEach(z => {
        L.polygon(z.pts, { color: z.color, weight: 2, fillColor: z.color, fillOpacity: 0.10, dashArray: '6,4', interactive: false }).addTo(map);
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '', maxZoom: 19 }).addTo(map);
      map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        if (marker) marker.setLatLng([lat, lng]);
        else marker = L.marker([lat, lng]).addTo(map);
        showGeoStatus('⏳ Получаем адрес...', 'var(--orange)');
        const addr = await reverseGeocode(lat, lng);
        const zone = getDeliveryZone(lat, lng);
        const zoneText = zone ? ' — доставка ' + zone.price : ' — вне зоны доставки';
        if (addr) {
          document.getElementById('addressInput').value = addr;
          showGeoStatus('✅ ' + addr + zoneText, zone ? 'green' : 'red');
        } else {
          showGeoStatus('✏️ Укажите адрес вручную' + zoneText, zone ? 'var(--orange)' : 'red');
        }
        if (zone) { deliveryCost = zone.cost; }
      });
    }, 100);
  } else if (mapVisible && map) {
    setTimeout(() => map.invalidateSize(), 100);
  }
}

// ── Автодополнение адреса ─────────────────────────────────────────────
let acTimer = null;

async function searchAddress(query) {
  if (query.length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' Экибастуз')}&format=json&limit=7&accept-language=ru&countrycodes=kz&addressdetails=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'YaYaChicken/1.0' } });
    return await r.json();
  } catch (e) { return []; }
}

function formatShortAddress(r) {
  const a = r.address || {};
  const road  = a.road || a.pedestrian || a.street || a.footway || '';
  const house = a.house_number || '';
  if (road) return house ? `${road}, ${house}` : road;
  return r.display_name.split(',').slice(0, 2).join(',').trim();
}

function onAddressInput(val) {
  clearTimeout(acTimer);
  const list = document.getElementById('autocompleteList');
  if (val.length < 3) { list.style.display = 'none'; return; }
  acTimer = setTimeout(async () => {
    const results = await searchAddress(val);
    if (!results.length) { list.style.display = 'none'; return; }
    const seen = new Set();
    const unique = results.filter(r => {
      const short = formatShortAddress(r);
      if (seen.has(short)) return false;
      seen.add(short);
      return true;
    });
    list.innerHTML = unique.map(r => {
      const short = formatShortAddress(r);
      return `<div class="autocomplete-item" onclick="selectAddress('${short.replace(/'/g, "\\'")}')">📍 ${short}</div>`;
    }).join('');
    list.style.display = 'block';
  }, 350);
}

function selectAddress(addr) {
  const input = document.getElementById('addressInput');
  input.value = addr + ', ';
  input.focus();
  input.selectionStart = input.selectionEnd = input.value.length;
  document.getElementById('autocompleteList').style.display = 'none';
  const status = document.getElementById('geoStatus');
  status.style.display = 'block';
  status.style.color = 'var(--orange)';
  status.textContent = '✏️ Добавьте номер дома и квартиру';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.address-wrap')) {
    const list = document.getElementById('autocompleteList');
    if (list) list.style.display = 'none';
  }
});
