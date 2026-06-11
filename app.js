const API_URL = "https://aiserv.sky.4pple.net";

function showMain() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("mainContent").classList.remove("hidden");
}

function showLogin() {
  sessionStorage.removeItem("auth_token");
  document.getElementById("mainContent").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("passwordInput").value = "";
}

async function tryLogin() {
  const password = document.getElementById("passwordInput").value;
  document.getElementById("loginError").classList.add("hidden");
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const errEl = document.getElementById("loginError");
      errEl.textContent = res.status === 429 ? "Too many attempts. Please wait." : "Incorrect password.";
      errEl.classList.remove("hidden");
      return;
    }
    const { token } = await res.json();
    sessionStorage.setItem("auth_token", token);
    showMain();
  } catch {
    document.getElementById("loginError").classList.remove("hidden");
  }
}

if (sessionStorage.getItem("auth_token")) showMain();

document.getElementById("loginBtn").addEventListener("click", tryLogin);
document.getElementById("passwordInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryLogin();
});

const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const processBtn = document.getElementById("processBtn");
const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");
const versionEl = document.getElementById("version");
const resultsEl = document.getElementById("results");
const allDownloadBtn = document.getElementById("allDownloadBtn");
const jobInfoEl = document.getElementById("jobInfo");

let currentImages = [];

let selectedFile = null;
let timerInterval = null;
let startTime = null;

// 1️⃣ 이미지 선택 → 미리보기
fileInput.addEventListener("change", () => {
  preview.innerHTML = "";
  resultsEl.innerHTML = "";
  jobInfoEl.classList.add("hidden");
  jobInfoEl.innerHTML = "";

  selectedFile = fileInput.files[0];
  if (!selectedFile) return;

  const img = document.createElement("img");
  img.src = URL.createObjectURL(selectedFile);
  preview.appendChild(img);

  processBtn.disabled = false;
});

const VERSION_FILE = "VERSION";

fetch(VERSION_FILE)
  .then((response) => response.text())
  .then((text) => {
    const version = text.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim() ?? "unknown";
    versionEl.innerText = `Version: ${version}`;
  })
  .catch(() => {
    versionEl.innerText = "Version: unknown";
  });

// 2️⃣ Process 버튼
processBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  const formData = new FormData();
  formData.append("image", selectedFile);

  startTimer();
  statusEl.innerText = "서버 상태: 업로드 중...";

  try {
    const response = await fetch(`${API_URL}/inference`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("auth_token")}` },
      body: formData,
    });

    if (response.status === 401) {
      stopTimer();
      showLogin();
      return;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || "Inference request failed");
    }

    const data = await response.json();
    stopTimer();

    if (!data.images || data.images.length === 0) {
      statusEl.innerText = "서버 상태: 결과 없음";
      resultsEl.innerHTML = "<p>Inference 결과가 없습니다.</p>";
      allDownloadBtn.classList.add("hidden");
      return;
    }

    statusEl.innerText = "서버 상태: 완료";
    showJobInfo(data);
    currentImages = data.images;
    showResults(data.images);
    allDownloadBtn.classList.remove("hidden");
  } catch (e) {
    stopTimer();
    statusEl.innerText = "서버 상태: 오류";
    alert(`Server error: ${e.message}`);
  }
});

// 3️⃣ Job 정보 표시
function showJobInfo(data) {
  const t = data.time ?? {};
  const fmt = (ms) => (ms != null ? `${ms} ms` : "-");
  const fmtTime = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
  };
  const total = [t.preprocess, t.inference, t.postprocess].reduce((acc, v) => (v != null ? acc + v : acc), 0);

  const leftRows = [
    ["Job ID",    data.job_id ?? "-"],
    ["Version",   data.version ?? "-"],
    ["Received",  fmtTime(t.received)],
    ["Responded", fmtTime(t.responded)],
  ];
  const rightRows = [
    ["Preprocess",     fmt(t.preprocess)],
    ["Inference",      fmt(t.inference)],
    ["Postprocess",    fmt(t.postprocess)],
    ["Total (server)", fmt(total)],
  ];

  const makeRow = ([k, v]) => {
    const row = document.createElement("div");
    row.className = "job-info-row";
    const key = document.createElement("span");
    key.className = "job-info-key";
    key.textContent = k;
    const val = document.createElement("span");
    val.className = "job-info-val";
    val.textContent = v;
    row.appendChild(key);
    row.appendChild(val);
    return row;
  };

  const makeCol = (rows) => {
    const col = document.createElement("div");
    col.className = "job-info-col";
    rows.forEach((r) => col.appendChild(makeRow(r)));
    return col;
  };

  jobInfoEl.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "job-info";
  const cols = document.createElement("div");
  cols.className = "job-info-cols";
  cols.appendChild(makeCol(leftRows));
  cols.appendChild(makeCol(rightRows));
  wrapper.appendChild(cols);
  jobInfoEl.appendChild(wrapper);
  jobInfoEl.classList.remove("hidden");
}

// 5️⃣ 타이머
function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    timerEl.innerText = `Elapsed: ${elapsed.toFixed(1)}s`;
  }, 100);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function toDataUrl(image) {
  if (image.data) {
    return `data:${image.mime_type};base64,${image.data}`;
  }
  return image.url || "";
}

const RESULT_LABELS = ["sketch layer", "color layer", "highlight layer", "shadow layer", "merged layers"];
const RESULT_ORDER = [3, 0, 1, 2, 4]; // color, highlight, shadow, sketch, merge → sketch, color, highlight, shadow, result

// 6️⃣ 결과 이미지 표시 + 다운로드
function showResults(images) {
  resultsEl.innerHTML = "";
  const ordered = RESULT_ORDER.map((i) => images[i] ?? null).filter(Boolean);
  images = ordered.length === images.length ? ordered : images;

  images.forEach((imgData, idx) => {
    const div = document.createElement("div");
    div.className = "result-item";

    const img = document.createElement("img");
    img.src = toDataUrl(imgData);
    img.alt = imgData.name || `result_${idx}`;

    const filename = imgData.name ? imgData.name.split("/").pop() : `result_${idx}.png`;
    const label = RESULT_LABELS[idx] ?? filename.replace(/\.[^/.]+$/, "");

    const a = document.createElement("a");
    a.href = toDataUrl(imgData);
    a.download = filename;
    a.innerText = label;

    div.appendChild(img);
    div.appendChild(document.createElement("br"));
    div.appendChild(a);

    resultsEl.appendChild(div);
  });
}

allDownloadBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  const zip = new JSZip();
  currentImages.forEach((imgData, idx) => {
    const filename = imgData.name ? imgData.name.split("/").pop() : `result_${idx}.png`;
    zip.file(filename, imgData.data, { base64: true });
  });
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "results.zip";
  a.click();
  URL.revokeObjectURL(a.href);
});
