// js/config.js
let API_BASE_URL = "https://fishmanage.onrender.com"; // 배포 기본(실 백엔드)

// 로컬에서 열어도 기본은 그대로 Render 사용
// (로컬 백엔드를 쓰고 싶으면 주소창 ?api= 로 바꿀 수 있게 유지)
const override = new URLSearchParams(location.search).get("api");
if (override) API_BASE_URL = override.replace(/\/$/, "");

console.log("API_BASE_URL =", API_BASE_URL);