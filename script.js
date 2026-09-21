/* ==========================================================================
   DealD — เปรียบเทียบราคา ง่าย ๆ
   Vanilla JavaScript · ไม่มี backend · ไม่มี dependency
   ========================================================================== */

(function () {
  'use strict';

  var MIN_ITEMS = 2;
  var MAX_ITEMS = 5;

  var MSG = {
    priceRequired: 'กรุณากรอกราคา',
    unitsRequired: 'กรุณากรอกจำนวนหน่วย',
    notANumber: 'กรุณากรอกตัวเลขให้ถูกต้อง',
    priceNegative: 'ราคาต้องไม่ติดลบ',
    unitsPositive: 'จำนวนหน่วยต้องมากกว่า 0',
    needTwo: 'กรุณากรอกข้อมูลให้ครบอย่างน้อย 2 แบบ เพื่อเปรียบเทียบราคา',
    fixErrors: 'กรุณาตรวจสอบข้อมูลที่กรอก แล้วลองอีกครั้ง'
  };

  var form, itemsEl, countEl, resultEl, headlineEl, rowsEl, formErrorEl, resetBtn;
  var hasCalculated = false;

  /* ---------- ตัวเลข ---------- */

  /**
   * แปลงข้อความเป็นตัวเลข รองรับ comma (1,000) และทศนิยม
   * คืนค่า { empty: true } | { invalid: true } | { value: Number }
   */
  function parseNumber(raw) {
    var text = (raw === null || raw === undefined) ? '' : String(raw);
    text = text.trim();
    if (text === '') return { empty: true };

    // ตัด comma และช่องว่างทุกชนิดออก (รองรับ 1,000 และ 1 000)
    var cleaned = text.replace(/[,\s  ]/g, '');
    if (cleaned === '') return { empty: true };

    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return { invalid: true };

    var n = Number(cleaned);
    if (!isFinite(n)) return { invalid: true };

    return { value: n };
  }

  /**
   * จัดรูปแบบตัวเลขให้อ่านง่าย
   * - จำนวนเต็ม  -> 50
   * - ทศนิยม     -> 1.25 / 0.0125 (สูงสุดตาม maxFrac)
   */
  function formatNumber(value, maxFrac, minFrac) {
    if (typeof maxFrac !== 'number') maxFrac = 4;
    if (typeof minFrac !== 'number') minFrac = 2;
    if (typeof value !== 'number' || !isFinite(value)) return '—';

    var rounded = Number(value.toFixed(maxFrac));
    if (Object.is(rounded, -0)) rounded = 0;

    try {
      if (rounded % 1 === 0) {
        return rounded.toLocaleString('th-TH', { maximumFractionDigits: 0 });
      }
      return rounded.toLocaleString('th-TH', {
        minimumFractionDigits: minFrac,
        maximumFractionDigits: maxFrac
      });
    } catch (e) {
      // เบราว์เซอร์เก่าที่ไม่รองรับ Intl options
      return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(minFrac);
    }
  }

  function formatPercent(value) {
    if (typeof value !== 'number' || !isFinite(value)) return '—';
    try {
      return value.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } catch (e) {
      return value.toFixed(2);
    }
  }

  /* ---------- สร้าง/ปรับจำนวนช่องกรอก ---------- */

  function createItemCard(index) {
    var n = index + 1;
    var card = document.createElement('section');
    card.className = 'card item-card';
    card.dataset.index = String(index);
    card.setAttribute('aria-labelledby', 'item-title-' + n);

    card.innerHTML =
      '<h2 class="item-title" id="item-title-' + n + '">แบบ ' + n + '</h2>' +

      '<div class="field">' +
        '<label class="field-label" for="price-' + n + '">ราคา</label>' +
        '<input class="input" id="price-' + n + '" name="price-' + n + '" type="text" ' +
               'inputmode="decimal" autocomplete="off" enterkeyhint="next" ' +
               'placeholder="เช่น 100" data-role="price" ' +
               'aria-describedby="price-error-' + n + '">' +
        '<p class="field-error" id="price-error-' + n + '" data-role="price-error" hidden></p>' +
      '</div>' +

      '<div class="field">' +
        '<label class="field-label" for="units-' + n + '">จำนวนหน่วย</label>' +
        '<input class="input" id="units-' + n + '" name="units-' + n + '" type="text" ' +
               'inputmode="decimal" autocomplete="off" enterkeyhint="done" ' +
               'placeholder="เช่น 80" data-role="units" ' +
               'aria-describedby="units-error-' + n + '">' +
        '<p class="field-error" id="units-error-' + n + '" data-role="units-error" hidden></p>' +
      '</div>' +

      '<div class="unit-row">' +
        '<span class="unit-label">ราคาต่อหน่วย</span>' +
        '<span class="unit-value is-empty" data-role="unit" ' +
              'aria-label="ราคาต่อหน่วยของแบบ ' + n + '">—</span>' +
      '</div>';

    return card;
  }

  function renderItems(count) {
    var current = itemsEl.children.length;

    for (var i = current; i < count; i++) {
      itemsEl.appendChild(createItemCard(i));
    }
    while (itemsEl.children.length > count) {
      itemsEl.removeChild(itemsEl.lastElementChild);
    }
  }

  function getCards() {
    return Array.prototype.slice.call(itemsEl.children);
  }

  function field(card, role) {
    return card.querySelector('[data-role="' + role + '"]');
  }

  /* ---------- อ่านและตรวจสอบข้อมูล ---------- */

  /**
   * อ่านข้อมูล 1 แบบ
   * status: 'empty' (ไม่ได้กรอกเลย) | 'error' | 'ok'
   */
  function readItem(card, index) {
    var priceRaw = field(card, 'price').value;
    var unitsRaw = field(card, 'units').value;

    var price = parseNumber(priceRaw);
    var units = parseNumber(unitsRaw);

    var item = {
      index: index,
      label: 'แบบ ' + (index + 1),
      errors: { price: '', units: '' },
      status: 'ok',
      price: null,
      units: null,
      unitPrice: null
    };

    if (price.empty && units.empty) {
      item.status = 'empty';
      return item;
    }

    if (price.empty) {
      item.errors.price = MSG.priceRequired;
    } else if (price.invalid) {
      item.errors.price = MSG.notANumber;
    } else if (price.value < 0) {
      item.errors.price = MSG.priceNegative;
    } else {
      item.price = price.value;
    }

    if (units.empty) {
      item.errors.units = MSG.unitsRequired;
    } else if (units.invalid) {
      item.errors.units = MSG.notANumber;
    } else if (units.value <= 0) {
      item.errors.units = MSG.unitsPositive;
    } else {
      item.units = units.value;
    }

    if (item.errors.price || item.errors.units) {
      item.status = 'error';
      return item;
    }

    // ป้องกันการหารด้วย 0 ซ้ำอีกชั้น
    if (!item.units || item.units <= 0) {
      item.errors.units = MSG.unitsPositive;
      item.status = 'error';
      return item;
    }

    item.unitPrice = item.price / item.units;
    if (!isFinite(item.unitPrice)) {
      item.errors.units = MSG.unitsPositive;
      item.status = 'error';
      item.unitPrice = null;
    }

    return item;
  }

  function readAll() {
    return getCards().map(function (card, i) {
      return readItem(card, i);
    });
  }

  /* ---------- แสดง/ซ่อน error ---------- */

  function paintFieldError(card, role, message) {
    var input = field(card, role);
    var errorEl = field(card, role + '-error');
    if (!input || !errorEl) return;

    if (message) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      errorEl.textContent = message;
      errorEl.hidden = false;
    } else {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  }

  function clearErrors() {
    getCards().forEach(function (card) {
      paintFieldError(card, 'price', '');
      paintFieldError(card, 'units', '');
    });
    formErrorEl.textContent = '';
    formErrorEl.hidden = true;
  }

  function showFormError(message) {
    formErrorEl.textContent = message;
    formErrorEl.hidden = false;
  }

  /* ---------- preview ราคาต่อหน่วย ---------- */

  function updatePreview() {
    var items = readAll();
    getCards().forEach(function (card, i) {
      var el = field(card, 'unit');
      var item = items[i];
      if (item.status === 'ok' && item.unitPrice !== null) {
        el.textContent = formatNumber(item.unitPrice) + ' บาท';
        el.classList.remove('is-empty');
      } else {
        el.textContent = '—';
        el.classList.add('is-empty');
      }
    });
    return items;
  }

  /* ---------- ผลลัพธ์ ---------- */

  function addRow(term, value, options) {
    options = options || {};
    var row = document.createElement('div');
    row.className = 'result-row' +
      (options.highlight ? ' is-highlight' : '') +
      (options.stacked ? ' is-stacked' : '');

    var dt = document.createElement('dt');
    dt.textContent = term;

    var dd = document.createElement('dd');
    dd.textContent = value;

    row.appendChild(dt);
    row.appendChild(dd);
    rowsEl.appendChild(row);
  }

  function hideResult() {
    resultEl.hidden = true;
    headlineEl.textContent = '';
    rowsEl.textContent = '';
  }

  function renderResult(valid, totalItems) {
    var best = valid[0];
    var worst = valid[0];

    valid.forEach(function (item) {
      if (item.unitPrice < best.unitPrice) best = item;
      if (item.unitPrice > worst.unitPrice) worst = item;
    });

    rowsEl.textContent = '';

    var allEqual = (worst.unitPrice - best.unitPrice) < 1e-12;

    if (allEqual) {
      headlineEl.textContent = 'ราคาต่อหน่วยเท่ากันทุกแบบ';
      addRow('ราคาต่อหน่วย', formatNumber(best.unitPrice) + ' บาท', { highlight: true });
      resultEl.hidden = false;
      return;
    }

    headlineEl.textContent = totalItems > 2
      ? best.label + ' คุ้มที่สุด'
      : best.label + ' ถูกกว่า';

    var diff = worst.unitPrice - best.unitPrice;
    var percent = worst.unitPrice > 0 ? (diff / worst.unitPrice) * 100 : 0;
    var saving = best.units * diff;

    addRow('ราคาต่อหน่วยของ' + best.label, formatNumber(best.unitPrice) + ' บาท', { highlight: true });

    if (totalItems > 2) {
      addRow('เทียบกับ' + worst.label + ' (ราคาต่อหน่วยสูงสุด)', formatNumber(worst.unitPrice) + ' บาท');
    }

    addRow('ถูกกว่าหน่วยละ', formatNumber(diff) + ' บาท');
    addRow('หรือถูกกว่า', formatPercent(percent) + ' %');
    addRow(
      'ถ้าซื้อ ' + formatNumber(best.units, 4, 0) + ' หน่วย จะประหยัด',
      formatNumber(saving) + ' บาท',
      { stacked: true, highlight: true }
    );

    resultEl.hidden = false;
  }

  /**
   * คำนวณ
   * @param {boolean} silent  true = อัปเดตผลเงียบ ๆ (ไม่แสดง error, ไม่ scroll)
   */
  function calculate(silent) {
    var items = updatePreview();
    var totalItems = items.length;

    if (!silent) clearErrors();

    var hasError = false;
    items.forEach(function (item, i) {
      var card = itemsEl.children[i];
      if (!card) return;
      if (silent) return;
      paintFieldError(card, 'price', item.errors.price);
      paintFieldError(card, 'units', item.errors.units);
      if (item.status === 'error') hasError = true;
    });

    if (silent) {
      hasError = items.some(function (item) { return item.status === 'error'; });
    }

    var valid = items.filter(function (item) { return item.status === 'ok'; });

    if (hasError) {
      hideResult();
      if (!silent) {
        showFormError(MSG.fixErrors);
        focusFirstInvalid();
      }
      return false;
    }

    if (valid.length < MIN_ITEMS) {
      hideResult();
      if (!silent) {
        showFormError(MSG.needTwo);
        focusFirstEmpty();
      }
      return false;
    }

    renderResult(valid, totalItems);
    return true;
  }

  function focusFirstInvalid() {
    var first = itemsEl.querySelector('.input.is-invalid');
    if (first) first.focus();
  }

  function focusFirstEmpty() {
    var inputs = itemsEl.querySelectorAll('.input');
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].value.trim() === '') {
        inputs[i].focus();
        return;
      }
    }
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function scrollToResult() {
    if (resultEl.hidden) return;
    try {
      resultEl.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start'
      });
    } catch (e) {
      resultEl.scrollIntoView();
    }
    resultEl.focus({ preventScroll: true });
  }

  /* ---------- ล้างข้อมูล ---------- */

  function resetAll() {
    countEl.value = String(MIN_ITEMS);
    renderItems(MIN_ITEMS);
    getCards().forEach(function (card) {
      field(card, 'price').value = '';
      field(card, 'units').value = '';
    });
    clearErrors();
    hideResult();
    updatePreview();
    hasCalculated = false;
    try {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }

  /* ---------- เริ่มทำงาน ---------- */

  function init() {
    form = document.getElementById('compare-form');
    itemsEl = document.getElementById('items');
    countEl = document.getElementById('count');
    resultEl = document.getElementById('result');
    headlineEl = document.getElementById('result-headline');
    rowsEl = document.getElementById('result-rows');
    formErrorEl = document.getElementById('form-error');
    resetBtn = document.getElementById('btn-reset');

    if (!form || !itemsEl || !countEl || !resultEl) return;

    var initial = parseInt(countEl.value, 10);
    if (isNaN(initial) || initial < MIN_ITEMS || initial > MAX_ITEMS) initial = MIN_ITEMS;
    renderItems(initial);

    countEl.addEventListener('change', function () {
      var next = parseInt(countEl.value, 10);
      if (isNaN(next) || next < MIN_ITEMS) next = MIN_ITEMS;
      if (next > MAX_ITEMS) next = MAX_ITEMS;
      renderItems(next);          // ค่าที่กรอกไว้เดิมยังอยู่ครบ
      clearErrors();
      if (hasCalculated) calculate(true);
      else updatePreview();
    });

    // preview ราคาต่อหน่วยแบบ realtime
    itemsEl.addEventListener('input', function (event) {
      if (!event.target.classList.contains('input')) return;
      paintFieldError(event.target.closest('.item-card'),
        event.target.dataset.role === 'price' ? 'price' : 'units', '');
      if (hasCalculated) {
        calculate(true);
      } else {
        updatePreview();
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var ok = calculate(false);
      hasCalculated = ok;
      if (ok) scrollToResult();
    });

    resetBtn.addEventListener('click', resetAll);

    updatePreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ---------- Service Worker (PWA) ---------- */

  window.addEventListener('load', function () {
    if (!('serviceWorker' in navigator)) return;
    // ไม่ลงทะเบียนเมื่อเปิดไฟล์ตรง ๆ ด้วย file:// (จะเกิด error)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' &&
        location.hostname !== '127.0.0.1') {
      return;
    }
    navigator.serviceWorker.register('./service-worker.js').catch(function (err) {
      // ไม่ให้ error ของ service worker ทำให้เว็บหลักพัง
      console.warn('DealD: ลงทะเบียน service worker ไม่สำเร็จ', err);
    });
  });

})();
