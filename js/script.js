// ===========================
// Helpers: escape, formatting
// ===========================
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmtMoney(v) {
  return n(v).toLocaleString();
}

function $(id) {
  return document.getElementById(id);
}

// ===========================
// Toast + Popup
// ===========================
function showToast(type, title, message, timeoutMs = 3000) {
  const container = $("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <div>
      <div class="toast-title">${esc(title)}</div>
      <div class="toast-msg">${esc(message)}</div>
    </div>
    <button class="toast-close" aria-label="닫기">×</button>
  `;

  toast.querySelector(".toast-close")?.addEventListener("click", () => toast.remove());
  container.appendChild(toast);

  if (timeoutMs > 0) {
    setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, timeoutMs);
  }
}

function showPopup(title, message) {
  const overlay = $("popup-overlay");
  const titleEl = $("popup-title");
  const msgEl = $("popup-message");
  const okBtn = $("popup-ok");
  if (!overlay || !titleEl || !msgEl || !okBtn) return;

  titleEl.textContent = title;
  msgEl.textContent = message;
  overlay.hidden = false;
  okBtn.focus();
}

function closePopup() {
  const overlay = $("popup-overlay");
  if (overlay) overlay.hidden = true;
}

function notifyResult(ok, context, detail) {
  if (ok) {
    showToast("success", "성공", `${context} 완료`, 2500);
    showPopup("성공", `${context} 완료${detail ? "\n\n" + detail : ""}`);
  } else {
    const msg = detail || "원인을 확인해주세요.";
    showToast("error", "실패", `${context} 실패: ${msg}`, 4500);
    showPopup("실패", `${context} 실패\n\n${msg}`);
  }
}

// ===========================
// Page routing (sidebar tabs)
// ===========================
function setupPageRouting() {
  const navItems = document.querySelectorAll(".nav__item");
  const pages = document.querySelectorAll("[data-page-view]");
  if (!navItems.length || !pages.length) return;

  function showPage(pageName) {
    // active 메뉴 표시
    navItems.forEach((a) => {
      a.classList.toggle("nav__item--active", a.dataset.page === pageName);
    });

    // 페이지 표시/숨김
    pages.forEach((p) => {
      p.classList.toggle("is-hidden", p.dataset.pageView !== pageName);
    });

    // inventory 탭 진입 시 로드
    if (pageName === "inventory") {
      if (typeof loadInventory === "function") loadInventory();
    }
  }

  navItems.forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const page = a.dataset.page;
      if (page) showPage(page);
    });
  });

  const current = document.querySelector(".nav__item.nav__item--active")?.dataset.page || "dashboard";
  showPage(current);
}

// ===========================
// Dirty tracking
// ===========================
const dirtyRows = new Map(); // id -> true

function setDirty(id, isDirty) {
  const key = String(id);
  if (isDirty) dirtyRows.set(key, true);
  else dirtyRows.delete(key);
  renderDirtyCount();
}

function renderDirtyCount() {
  const el = $("dirty-count");
  if (!el) return;
  const nDirty = dirtyRows.size;
  el.textContent = nDirty ? `● 변경된 행: ${nDirty}개` : "";
}

// ===========================
// Autosave settings (default OFF)
// ===========================
const AUTOSAVE_KEY = "fishInventory.autosave.enabled"; // "true"/"false"
const AUTOSAVE_MIN_KEY = "fishInventory.autosave.minutes"; // "10"/"30"/"60"

let autosaveTimer = null;
let isSaving = false;

function stopAutosave() {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }
}

async function autosaveTick() {
  if (isSaving) return;
  if (dirtyRows.size === 0) return;

  isSaving = true;
  try {
    await saveAllDirty(true); // true = from autosave
  } finally {
    isSaving = false;
  }
}

function startAutosave() {
  stopAutosave();
  const sel = $("sel-autosave-min");
  if (!sel) return;

  const mins = parseInt(sel.value, 10);
  const ms = mins * 60 * 1000;
  autosaveTimer = setInterval(autosaveTick, ms);
}

function saveAutosaveSettings() {
  const chk = $("chk-autosave");
  const sel = $("sel-autosave-min");
  if (!chk || !sel) return;

  localStorage.setItem(AUTOSAVE_KEY, chk.checked ? "true" : "false");
  localStorage.setItem(AUTOSAVE_MIN_KEY, sel.value);
}

function loadAutosaveSettings() {
  const chk = $("chk-autosave");
  const sel = $("sel-autosave-min");
  if (!chk || !sel) return;

  const enabledRaw = localStorage.getItem(AUTOSAVE_KEY);
  const enabled = enabledRaw === "true"; // default OFF
  const mins = localStorage.getItem(AUTOSAVE_MIN_KEY) || "30";

  chk.checked = enabled;
  sel.value = mins;

  if (enabled) startAutosave();
  else stopAutosave();
}

// ===========================
// Table rendering + CRUD
// ===========================
function getRowPayload(tr) {
  const payload = { id: Number(tr.dataset.id) };
  tr.querySelectorAll("input[data-k]").forEach((inp) => {
    payload[inp.dataset.k] = inp.value;
  });
  payload.qty = n(payload.qty);
  payload.unit_price = n(payload.unit_price);
  return payload;
}

function attachRowHandlers(tr) {
  const id = tr.dataset.id;

  tr.addEventListener("input", (e) => {
    const t = e.target;
    if (t.tagName !== "INPUT") return;

    setDirty(id, true);

    // live amount preview
    const qty = n(tr.querySelector('input[data-k="qty"]').value);
    const up = n(tr.querySelector('input[data-k="unit_price"]').value);
    const cell = tr.querySelector(".amount-cell");
    if (cell) cell.textContent = fmtMoney(qty * up);
  });
}

async function loadInventory() {
  const status = $("status-text");
  if (status) status.textContent = "불러오는 중…";

  try {
    // util.js의 getData 사용
    const rows = await getData("/api/inventory");

    const tbody = $("inv-body");
    if (!tbody) {
      if (status) status.textContent = "재고 테이블 영역(inv-body)이 없습니다.";
      return;
    }

    tbody.innerHTML = "";

    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.dataset.id = r.id;

      const dirtyMark = dirtyRows.has(String(r.id))
        ? `<span class="dirty-dot" title="변경됨"></span>`
        : "";

      tr.innerHTML = `
        <td>${dirtyMark}</td>
        <td><input data-k="fish" type="text" value="${esc(r.fish)}"></td>
        <td><input data-k="size" type="text" value="${esc(r.size)}"></td>
        <td class="right"><input data-k="qty" type="number" step="0.01" value="${r.qty}"></td>
        <td class="right"><input data-k="unit_price" type="number" step="0.01" value="${r.unit_price}"></td>
        <td class="amount-cell">${fmtMoney(r.amount)}</td>
        <td>
          <button class="action-btn save-btn" data-act="save">저장</button>
          <button class="action-btn danger-btn" data-act="delete">삭제</button>
        </td>
      `;

      tbody.appendChild(tr);
      attachRowHandlers(tr);
    }

    if (status) status.textContent = `총 ${rows.length}건`;
  } catch (e) {
    if (status) status.textContent = "로드 실패";
    notifyResult(false, "목록 조회", e?.message || String(e));
  }
}

async function addRow() {
  const fishEl = $("in-fish");
  const sizeEl = $("in-size");
  const qtyEl = $("in-qty");
  const unitEl = $("in-unit");
  if (!fishEl || !sizeEl || !qtyEl || !unitEl) return;

  const fish = fishEl.value.trim();
  const size = sizeEl.value.trim();
  const qty = n(qtyEl.value);
  const unit_price = n(unitEl.value);

  try {
    await postData("/api/inventory", { fish, size, qty, unit_price });

    fishEl.value = "";
    sizeEl.value = "";
    qtyEl.value = "";
    unitEl.value = "";

    notifyResult(true, "행 추가", "");
    await loadInventory();
  } catch (e) {
    notifyResult(false, "행 추가", e?.message || String(e));
  }
}

async function saveRow(tr, fromAutosave = false) {
  const id = tr.dataset.id;
  const payload = getRowPayload(tr);

  try {
    await putData(`/api/inventory/${id}`, payload);
    setDirty(id, false);

    notifyResult(true, fromAutosave ? `자동저장(개별, ID:${id})` : `개별 저장(ID:${id})`, "");
    await loadInventory();
    return true;
  } catch (e) {
    notifyResult(
      false,
      fromAutosave ? `자동저장(개별, ID:${id})` : `개별 저장(ID:${id})`,
      e?.message || String(e)
    );
    return false;
  }
}

async function deleteRow(id) {
  try {
    await deleteData(`/api/inventory/${id}`);
    setDirty(id, false);

    notifyResult(true, `행 삭제(ID:${id})`, "");
    await loadInventory();
  } catch (e) {
    notifyResult(false, `행 삭제(ID:${id})`, e?.message || String(e));
  }
}

async function saveAllDirty(fromAutosave = false) {
  if (dirtyRows.size === 0) {
    notifyResult(true, fromAutosave ? "자동저장" : "일괄 저장", "변경된 항목이 없습니다.");
    return true;
  }

  const items = [];
  for (const id of dirtyRows.keys()) {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (tr) items.push(getRowPayload(tr));
  }

  if (items.length === 0) {
    notifyResult(true, fromAutosave ? "자동저장" : "일괄 저장", "변경된 항목이 없습니다.");
    return true;
  }

  try {
    await postData("/api/inventory/bulk", { items });

    dirtyRows.clear();
    renderDirtyCount();

    notifyResult(true, fromAutosave ? "자동저장" : "일괄 저장", `${items.length}개 항목 저장 완료`);
    await loadInventory();
    return true;
  } catch (e) {
    notifyResult(false, fromAutosave ? "자동저장" : "일괄 저장", e?.message || String(e));
    return false;
  }
}

// ===========================
// Event wiring (DOM ready)
// ===========================
function setupEvents() {
  // Popup events
  $("popup-close")?.addEventListener("click", closePopup);
  $("popup-ok")?.addEventListener("click", closePopup);
  $("popup-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "popup-overlay") closePopup();
  });
  window.addEventListener("keydown", (e) => {
    const overlay = $("popup-overlay");
    if (overlay && !overlay.hidden && e.key === "Escape") closePopup();
  });

  // CRUD 버튼
  $("btn-add")?.addEventListener("click", addRow);

  $("btn-save-all")?.addEventListener("click", async () => {
    if (isSaving) return;
    isSaving = true;
    try {
      await saveAllDirty(false);
    } finally {
      isSaving = false;
    }
  });

  $("btn-reload")?.addEventListener("click", loadInventory);

  // 테이블 액션(이벤트 위임)
  $("inv-body")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const tr = btn.closest("tr");
    const id = tr?.dataset?.id;
    if (!tr || !id) return;

    if (btn.dataset.act === "delete") {
      if (!confirm("정말 삭제할까요?")) return;
      await deleteRow(id);
    }

    if (btn.dataset.act === "save") {
      if (isSaving) return;
      isSaving = true;
      try {
        await saveRow(tr, false);
      } finally {
        isSaving = false;
      }
    }
  });

  // Autosave
  $("chk-autosave")?.addEventListener("change", (e) => {
    saveAutosaveSettings();
    if (e.target.checked) startAutosave();
    else stopAutosave();
  });

  $("sel-autosave-min")?.addEventListener("change", () => {
    saveAutosaveSettings();
    if ($("chk-autosave")?.checked) startAutosave();
  });

  // leaving warning
  window.addEventListener("beforeunload", (e) => {
    if (dirtyRows.size > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

// Init
document.addEventListener("DOMContentLoaded", async () => {
  setupPageRouting();
  setupEvents();
  loadAutosaveSettings();

  // 초기 탭이 inventory면 로드
  const current = document.querySelector(".nav__item.nav__item--active")?.dataset.page;
  if (current === "inventory") {
    await loadInventory();
  }
});