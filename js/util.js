// ===========================
// util.js
// 공통 API 호출 함수
// ===========================

function buildUrl(path) {
  if (!path) return API_BASE_URL;

  // http/https면 그대로
  if (path.startsWith("http")) return path;

  // /api/... 형태로 통일
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}

async function _readErrorText(res) {
  // 서버가 json 에러를 줄 수도 있고(text일 수도 있음)
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    return j.error || j.message || text || `HTTP ${res.status}`;
  } catch {
    return text || `HTTP ${res.status}`;
  }
}

async function getData(path) {
  const res = await fetch(buildUrl(path));
  if (!res.ok) throw new Error(await _readErrorText(res));
  return res.json();
}

async function postData(path, data) {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await _readErrorText(res));
  return res.json();
}

async function putData(path, data) {
  const res = await fetch(buildUrl(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await _readErrorText(res));
  return res.json();
}

async function deleteData(path) {
  const res = await fetch(buildUrl(path), { method: "DELETE" });
  if (!res.ok) throw new Error(await _readErrorText(res));
  return res.json();
}