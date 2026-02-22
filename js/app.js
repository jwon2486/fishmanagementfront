// ===========================
// Helpers: escape, formatting
// ===========================
function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function n(v){
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmtMoney(v){
  return n(v).toLocaleString();
}

// ===========================
// Toast + Popup
// ===========================
function showToast(type, title, message, timeoutMs = 3000){
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <div>
      <div class="toast-title">${esc(title)}</div>
      <div class="toast-msg">${esc(message)}</div>
    </div>
    <button class="toast-close" aria-label="닫기">×</button>
  `;

  toast.querySelector(".toast-close").addEventListener("click", () => toast.remove());
  container.appendChild(toast);

  if(timeoutMs > 0){
    setTimeout(() => { if(toast.isConnected) toast.remove(); }, timeoutMs);
  }
}

function showPopup(title, message){
  const overlay = document.getElementById("popup-overlay");
  document.getElementById("popup-title").textContent = title;
  document.getElementById("popup-message").textContent = message;
  overlay.hidden = false;
  document.getElementById("popup-ok").focus();
}

function closePopup(){
  document.getElementById("popup-overlay").hidden = true;
}

function notifyResult(ok, context, detail){
  if(ok){
    showToast("success", "성공", `${context} 완료`, 2500);
    showPopup("성공", `${context} 완료${detail ? "\n\n" + detail : ""}`);
  }else{
    const msg = detail || "원인을 확인해주세요.";
    showToast("error", "실패", `${context} 실패: ${msg}`, 4500);
    showPopup("실패", `${context} 실패\n\n${msg}`);
  }
}

// Popup events
document.getElementById("popup-close").addEventListener("click", closePopup);
document.getElementById("popup-ok").addEventListener("click", closePopup);
document.getElementById("popup-overlay").addEventListener("click", (e) => {
  if(e.target.id === "popup-overlay") closePopup();
});
window.addEventListener("keydown", (e) => {
  const overlay = document.getElementById("popup-overlay");
  if(!overlay.hidden && e.key === "Escape") closePopup();
});

// ===========================
// Dirty tracking
// ===========================
const dirtyRows = new Map(); // id -> true

function setDirty(id, isDirty){
  const key = String(id);
  if(isDirty) dirtyRows.set(key, true);
  else dirtyRows.delete(key);
  renderDirtyCount();
}

function renderDirtyCount(){
  const el = document.getElementById("dirty-count");
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

function stopAutosave(){
  if(autosaveTimer){
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }
}

async function autosaveTick(){
  if(isSaving) return;
  if(dirtyRows.size === 0) return;

  isSaving = true;
  try{
    await saveAllDirty(true); // true = from autosave
  }finally{
    isSaving = false;
  }
}

function startAutosave(){
  stopAutosave();
  const mins = parseInt(document.getElementById("sel-autosave-min").value, 10);
  const ms = mins * 60 * 1000;
  autosaveTimer = setInterval(autosaveTick, ms);
}

function saveAutosaveSettings(){
  const enabled = document.getElementById("chk-autosave").checked;
  const mins = document.getElementById("sel-autosave-min").value;
  localStorage.setItem(AUTOSAVE_KEY, enabled ? "true" : "false");
  localStorage.setItem(AUTOSAVE_MIN_KEY, mins);
}

function loadAutosaveSettings(){
  const enabledRaw = localStorage.getItem(AUTOSAVE_KEY);
  const enabled = (enabledRaw === "true"); // default OFF
  const mins = localStorage.getItem(AUTOSAVE_MIN_KEY) || "30";

  document.getElementById("chk-autosave").checked = enabled;
  document.getElementById("sel-autosave-min").value = mins;

  if(enabled) startAutosave();
  else stopAutosave();
}

// ===========================
// Table rendering + CRUD
// ===========================
function getRowPayload(tr){
  const payload = { id: Number(tr.dataset.id) };
  tr.querySelectorAll("input[data-k]").forEach(inp => {
    payload[inp.dataset.k] = inp.value;
  });
  payload.qty = n(payload.qty);
  payload.unit_price = n(payload.unit_price);
  return payload;
}

function attachRowHandlers(tr){
  const id = tr.dataset.id;

  tr.addEventListener("input", (e) => {
    const t = e.target;
    if(t.tagName !== "INPUT") return;

    setDirty(id, true);

    // live amount preview
    const qty = n(tr.querySelector('input[data-k="qty"]').value);
    const up  = n(tr.querySelector('input[data-k="unit_price"]').value);
    tr.querySelector(".amount-cell").textContent = fmtMoney(qty * up);
  });
}

async function loadInventory(){
  const status = document.getElementById("status-text");
  status.textContent = "불러오는 중…";

  try{
    const res = await fetch("/api/inventory");
    if(!res.ok) throw new Error("목록 조회 실패");
    const rows = await res.json();

    const tbody = document.getElementById("inv-body");
    tbody.innerHTML = "";

    for(const r of rows){
      const tr = document.createElement("tr");
      tr.dataset.id = r.id;

      const dirtyMark = dirtyRows.has(String(r.id)) ? `<span class="dirty-dot" title="변경됨"></span>` : "";

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

    status.textContent = `총 ${rows.length}건`;
  }catch(e){
    status.textContent = "로드 실패";
    notifyResult(false, "목록 조회", String(e));
  }
}

async function addRow(){
  const fish = document.getElementById("in-fish").value.trim();
  const size = document.getElementById("in-size").value.trim();
  const qty = n(document.getElementById("in-qty").value);
  const unit_price = n(document.getElementById("in-unit").value);

  try{
    const res = await fetch("/api/inventory", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ fish, size, qty, unit_price })
    });

    if(!res.ok){
      const err = await res.json().catch(()=>({error:"추가 실패"}));
      notifyResult(false, "행 추가", err.error);
      return;
    }

    document.getElementById("in-fish").value = "";
    document.getElementById("in-size").value = "";
    document.getElementById("in-qty").value = "";
    document.getElementById("in-unit").value = "";

    notifyResult(true, "행 추가", "");
    await loadInventory();
  }catch(e){
    notifyResult(false, "행 추가", String(e));
  }
}

async function saveRow(tr, fromAutosave = false){
  const id = tr.dataset.id;
  const payload = getRowPayload(tr);

  try{
    const res = await fetch(`/api/inventory/${id}`, {
      method:"PUT",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });

    if(!res.ok){
      const err = await res.json().catch(()=>({error:"저장 실패"}));
      notifyResult(false, fromAutosave ? `자동저장(개별, ID:${id})` : `개별 저장(ID:${id})`, err.error);
      return false;
    }

    setDirty(id, false);
    notifyResult(true, fromAutosave ? `자동저장(개별, ID:${id})` : `개별 저장(ID:${id})`, "");
    await loadInventory();
    return true;
  }catch(e){
    notifyResult(false, fromAutosave ? `자동저장(개별, ID:${id})` : `개별 저장(ID:${id})`, String(e));
    return false;
  }
}

async function deleteRow(id){
  try{
    const res = await fetch(`/api/inventory/${id}`, { method:"DELETE" });
    if(!res.ok){
      const err = await res.json().catch(()=>({error:"삭제 실패"}));
      notifyResult(false, `행 삭제(ID:${id})`, err.error);
      return;
    }
    setDirty(id, false);
    notifyResult(true, `행 삭제(ID:${id})`, "");
    await loadInventory();
  }catch(e){
    notifyResult(false, `행 삭제(ID:${id})`, String(e));
  }
}

async function saveAllDirty(fromAutosave = false){
  if(dirtyRows.size === 0){
    notifyResult(true, fromAutosave ? "자동저장" : "일괄 저장", "변경된 항목이 없습니다.");
    return true;
  }

  const items = [];
  for(const id of dirtyRows.keys()){
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if(tr) items.push(getRowPayload(tr));
  }

  if(items.length === 0){
    notifyResult(true, fromAutosave ? "자동저장" : "일괄 저장", "변경된 항목이 없습니다.");
    return true;
  }

  try{
    const res = await fetch("/api/inventory/bulk", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ items })
    });

    if(!res.ok){
      const err = await res.json().catch(()=>({error:"일괄 저장 실패"}));
      notifyResult(false, fromAutosave ? "자동저장" : "일괄 저장", err.error);
      return false;
    }

    dirtyRows.clear();
    renderDirtyCount();

    notifyResult(true, fromAutosave ? "자동저장" : "일괄 저장", `${items.length}개 항목 저장 완료`);
    await loadInventory();
    return true;
  }catch(e){
    notifyResult(false, fromAutosave ? "자동저장" : "일괄 저장", String(e));
    return false;
  }
}

// ===========================
// Event wiring
// ===========================
document.getElementById("btn-add").addEventListener("click", addRow);
document.getElementById("btn-save-all").addEventListener("click", async () => {
  if(isSaving) return;
  isSaving = true;
  try{ await saveAllDirty(false); } finally { isSaving = false; }
});
document.getElementById("btn-reload").addEventListener("click", loadInventory);

document.getElementById("inv-body").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if(!btn) return;

  const tr = btn.closest("tr");
  const id = tr.dataset.id;

  if(btn.dataset.act === "delete"){
    if(!confirm("정말 삭제할까요?")) return;
    await deleteRow(id);
  }

  if(btn.dataset.act === "save"){
    if(isSaving) return;
    isSaving = true;
    try{ await saveRow(tr, false); } finally { isSaving = false; }
  }
});

// Autosave UI events
document.getElementById("chk-autosave").addEventListener("change", (e) => {
  saveAutosaveSettings();
  if(e.target.checked) startAutosave();
  else stopAutosave();
});

document.getElementById("sel-autosave-min").addEventListener("change", () => {
  saveAutosaveSettings();
  if(document.getElementById("chk-autosave").checked){
    startAutosave();
  }
});

// Warn if leaving with unsaved changes
window.addEventListener("beforeunload", (e) => {
  if(dirtyRows.size > 0){
    e.preventDefault();
    e.returnValue = "";
  }
});

// Init
document.addEventListener("DOMContentLoaded", async () => {
  loadAutosaveSettings(); // default OFF
  await loadInventory();
});
