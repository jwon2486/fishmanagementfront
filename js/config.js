// js/config.js
// API 주소 중앙 관리

let API_BASE_URL = "https://fishmanage.onrender.com"; // ✅ 배포 기본(실 백엔드)

// Live Server(로컬)로 열었을 때는 로컬 Flask로 자동 전환
if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
  API_BASE_URL = "http://127.0.0.1:5000";
}

// 주소창으로 강제 override 가능(선택)
// 예: https://프론트주소/?api=https://fishmanage.onrender.com
const override = new URLSearchParams(location.search).get("api");
if (override) API_BASE_URL = override.replace(/\/$/, "");

console.log("API_BASE_URL =", API_BASE_URL);