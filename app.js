const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const processBtn = document.getElementById("processBtn");
const timerEl = document.getElementById("timer");
const resultsEl = document.getElementById("results");

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

const API_URL = "https://aiserv.sky.4pple.co.kr:38000"; // 서버 URL을 실제 도메인 또는 IP로 변경하세요.

// 2️⃣ Process 버튼
processBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  const formData = new FormData();
  formData.append("image", selectedFile);

  startTimer();

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

    showResults(data.images);
  } catch (e) {
    stopTimer();
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

// 4️⃣ 결과 이미지 표시 + 다운로드
function showResults(images) {
  resultsEl.innerHTML = "";

  images.forEach((imgData, idx) => {
    const div = document.createElement("div");
    div.className = "result-item";

    const img = document.createElement("img");
    img.src = imgData.url;

    const a = document.createElement("a");
    a.href = imgData.url;
    a.download = `result_${idx}.png`;
    a.innerText = "Download";

    div.appendChild(img);
    div.appendChild(document.createElement("br"));
    div.appendChild(a);

    resultsEl.appendChild(div);
  });
}
