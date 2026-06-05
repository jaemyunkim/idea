const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const processBtn = document.getElementById("processBtn");
const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");
const versionEl = document.getElementById("version");
const resultsEl = document.getElementById("results");
const allDownloadBtn = document.getElementById("allDownloadBtn");

let currentImages = [];

let selectedFile = null;
let timerInterval = null;
let startTime = null;

// 1️⃣ 이미지 선택 → 미리보기
fileInput.addEventListener("change", () => {
  preview.innerHTML = "";
  resultsEl.innerHTML = "";

  selectedFile = fileInput.files[0];
  if (!selectedFile) return;

  const img = document.createElement("img");
  img.src = URL.createObjectURL(selectedFile);
  preview.appendChild(img);

  processBtn.disabled = false;
});

const API_URL = "https://aiserv.sky.4pple.net"; // GitHub Pages에서 실제 원격 백엔드를 호출합니다.
const VERSION_FILE = "version.txt";

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
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || "Inference request failed");
    }

    const data = await response.json();
    stopTimer();

    if (!data.images || data.images.length === 0) {
      statusEl.innerText = "서버 상태: 결과 없음";
      resultsEl.innerHTML = "<p>Inference 결과가 없습니다.</p>";
      allDownloadBtn.style.display = "none";
      return;
    }

    statusEl.innerText = `서버 상태: 완료 (job_id=${data.job_id})`;
    currentImages = data.images;
    showResults(data.images);
    allDownloadBtn.style.display = "inline";
  } catch (e) {
    stopTimer();
    statusEl.innerText = "서버 상태: 오류";
    alert(`Server error: ${e.message}`);
  }
});

// 3️⃣ 타이머
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

// 4️⃣ 결과 이미지 표시 + 다운로드
function showResults(images) {
  resultsEl.innerHTML = "";

  images.forEach((imgData, idx) => {
    const div = document.createElement("div");
    div.className = "result-item";

    const img = document.createElement("img");
    img.src = toDataUrl(imgData);
    img.alt = imgData.name || `result_${idx}`;

    const filename = imgData.name ? imgData.name.split("/").pop() : `result_${idx}.png`;
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

    const a = document.createElement("a");
    a.href = toDataUrl(imgData);
    a.download = filename;
    a.innerText = nameWithoutExt;

    div.appendChild(img);
    div.appendChild(document.createElement("br"));
    div.appendChild(a);

    resultsEl.appendChild(div);
  });
}

allDownloadBtn.addEventListener("click", (e) => {
  e.preventDefault();
  currentImages.forEach((imgData, idx) => {
    const filename = imgData.name ? imgData.name.split("/").pop() : `result_${idx}.png`;
    const a = document.createElement("a");
    a.href = toDataUrl(imgData);
    a.download = filename;
    a.click();
  });
});
