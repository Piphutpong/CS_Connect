(() => {
  "use strict";

  // Short link instead of the real GitHub Pages URL -- the real URL's path
  // contains the personal GitHub account name, which a printed public-facing
  // label shouldn't carry. Kept in sync by hand, the same way SHEETS_ENDPOINT
  // is duplicated between app.js and track.js: if the real destination ever
  // moves, this constant AND the short link itself both need updating.
  // Scanning still eventually lands on the real URL once the redirect
  // resolves -- shortening only keeps it off the printed page itself.
  const TRACK_URL = "https://tinyurl.com/25mzpm96";

  // One number -> the single big card. Several -> a printable sheet of
  // labels, one per request, for a batch that was just entered together.
  const requestedNumbers = (new URLSearchParams(location.search).get("tn") || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (requestedNumbers.length > 1) {
    renderLabelSheet(requestedNumbers);
    return;
  }

  const qr = document.getElementById("qr");
  const urlText = document.getElementById("urlText");
  const trackingInput = document.getElementById("trackingNumberInput");
  const trackingFillValue = document.getElementById("trackingFillValue");
  const printBtn = document.getElementById("printBtn");
  const copyBtn = document.getElementById("copyBtn");
  const copyFeedback = document.getElementById("copyFeedback");

  urlText.textContent = TRACK_URL;

  new QRCode(qr, {
    text: TRACK_URL,
    width: 220,
    height: 220,
    colorDark: "#221530",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  // Opened from a request card's "พิมพ์ QR" button as qr.html?tn=690001 --
  // prefill instead of making staff retype a number already on their screen.
  const prefilledTn = new URLSearchParams(location.search).get("tn");
  if (prefilledTn) {
    trackingInput.value = prefilledTn;
    trackingFillValue.textContent = prefilledTn;
  }

  trackingInput.addEventListener("input", () => {
    trackingFillValue.textContent = trackingInput.value.trim();
  });

  // A real deployed page (unlike a sandboxed preview) has no reason to route
  // around window.print() -- the @media print rules in style.css handle
  // hiding everything but the QR card.
  printBtn.addEventListener("click", () => {
    window.print();
  });

  copyBtn.addEventListener("click", () => {
    function show(msg) {
      copyFeedback.textContent = msg;
      setTimeout(() => { copyFeedback.textContent = ""; }, 2200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(TRACK_URL)
        .then(() => show("คัดลอกลิงก์แล้ว"))
        .catch(() => show("คัดลอกไม่สำเร็จ ลองคัดลอกจากข้อความด้านบนแทน"));
    } else {
      show("เบราว์เซอร์นี้ไม่รองรับการคัดลอกอัตโนมัติ");
    }
  });

  /**
   * A sheet of one label per tracking number, sized to cut apart after
   * printing. Every label carries the same QR (the tracking page is one URL
   * for everyone) and differs only in the reference number printed on it --
   * which is the number the customer types in once they get there.
   */
  function renderLabelSheet(numbers) {
    const sheet = document.getElementById("qrSheet");
    const labels = document.getElementById("qrLabels");
    document.getElementById("qrSingle").hidden = true;
    sheet.hidden = false;
    document.getElementById("qrSheetCount").textContent =
      `${numbers.length} ใบ · ตัดแบ่งแล้วแนบไปกับใบเสร็จของลูกค้าแต่ละราย`;

    numbers.forEach(number => {
      const label = document.createElement("div");
      label.className = "qr-label";

      const code = document.createElement("div");
      code.className = "qr-label-code";
      label.appendChild(code);

      const caption = document.createElement("div");
      caption.className = "qr-label-caption";
      caption.innerHTML = `
        <p class="qr-label-title">ตรวจสอบสถานะคำร้อง</p>
        <p class="qr-label-number"></p>
        <p class="qr-label-hint">สแกนแล้วกรอกเลขนี้คู่กับเบอร์โทรที่แจ้งไว้</p>
      `;
      caption.querySelector(".qr-label-number").textContent = `เลขที่คำร้อง: ${number}`;
      label.appendChild(caption);

      labels.appendChild(label);

      new QRCode(code, {
        text: TRACK_URL,
        width: 120,
        height: 120,
        colorDark: "#221530",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    });

    document.getElementById("qrSheetPrintBtn").addEventListener("click", () => window.print());
  }
})();
