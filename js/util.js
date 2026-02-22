// ===========================
// util.js
// 공통 API 호출 함수
// ===========================

function buildUrl(path){
  return path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path}`;
}

async function getData(path){
  const res = await fetch(buildUrl(path));
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function postData(path, data){
  const res = await fetch(buildUrl(path), {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(data)
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function putData(path, data){
  const res = await fetch(buildUrl(path), {
    method:"PUT",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(data)
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteData(path){
  const res = await fetch(buildUrl(path), { method:"DELETE" });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}