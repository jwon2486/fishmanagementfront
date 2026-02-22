// ===========================
// config.js
// API 주소 중앙 관리
// ===========================

// 기본값: same-origin (Render에서 Flask가 프론트 같이 서빙)
let API_BASE_URL = "";

// Live Server에서 열었으면 로컬 Flask 사용
if (
  location.hostname === "127.0.0.1" ||
  location.hostname === "localhost"
){
  if(location.port === "5500" || location.protocol === "file:"){
    API_BASE_URL = "http://127.0.0.1:5000";
  }
}

// 주소창 override 가능
// 예: http://localhost:5500/?api=https://backend.onrender.com
const p = new URLSearchParams(location.search).get("api");
if(p) API_BASE_URL = p.replace(/\/$/, "");

console.log("API_BASE_URL =", API_BASE_URL);