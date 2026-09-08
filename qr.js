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

  // สำเนาที่สามของค่านี้ (app.js, track.js, และที่นี่) -- โปรเจกต์นี้ไม่มีขั้นตอน
  // build จึงแชร์เป็นโมดูลไม่ได้ ถ้า URL เปลี่ยนต้องแก้ทั้งสามที่
  const SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbw6Ri7ctu5guRHj3MJupkt0DJcgaht2-RHhhT9_YVNjnme4x1CbMl2SnC5hKO_OH_o/exec";

  // ?tn= รับได้ทั้งเลขเดียวและหลายเลขคั่นด้วยจุลภาค (คำร้องกลุ่ม) -- ใช้การ์ด
  // ใบเดียวกันทั้งสองแบบ ต่างกันแค่ตรงบรรทัดเลขที่คำร้อง
  const requestedNumbers = (new URLSearchParams(location.search).get("tn") || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

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
  if (requestedNumbers.length > 1) {
    showManyNumbers(requestedNumbers);
  } else if (requestedNumbers.length === 1) {
    trackingInput.value = requestedNumbers[0];
    trackingFillValue.textContent = requestedNumbers[0];
  }

  trackingInput.addEventListener("input", () => {
    trackingFillValue.textContent = trackingInput.value.trim();
  });

  /**
   * คำร้องกลุ่ม: การ์ดหน้าตาเดิมทุกอย่าง เปลี่ยนแค่บรรทัดเลขเดียวเป็นรายการเลข
   *
   * กลุ่มหนึ่งคือใบคำร้องที่ยื่นมาพร้อมกันโดยคนคนเดียว (หมู่บ้านหรือผู้จัดสรร)
   * คนที่ถือกระดาษกลับไปจึงเป็นคนเดียวที่มีหลายเลข ไม่ใช่หลายคนที่มีคนละเลข
   * -- ต่างจากของเดิมที่พิมพ์เป็นป้ายเล็กหลายใบให้ตัดแบ่ง ซึ่งไม่ตรงกับการใช้จริง
   */
  function showManyNumbers(numbers) {
    document.getElementById("trackingSingleLine").hidden = true;
    document.getElementById("trackingManyBlock").hidden = false;
    document.getElementById("scanHint").textContent =
      "สแกนแล้วกรอกเลขใดเลขหนึ่งคู่กับเบอร์โทรที่แจ้งไว้";

    const list = document.getElementById("trackingList");
    numbers.forEach(number => {
      const li = document.createElement("li");
      li.textContent = number;
      list.appendChild(li);
    });

    // ช่องกรอกเลขเดียวไม่มีความหมายเมื่อมาเป็นกลุ่ม
    document.getElementById("trackingInputField").hidden = true;
    const note = document.getElementById("qrBatchNote");
    note.textContent = `คำร้องกลุ่มนี้มี ${numbers.length} ใบ พิมพ์แผ่นเดียวแล้วมอบให้ผู้ยื่นคำร้องได้เลย`;
    note.hidden = false;
  }

  /**
   * ชื่อแผนกและเบอร์โทรที่พิมพ์ลงบนป้าย -- ดึงมาจาก Apps Script แทนที่จะฝังไว้ในนี้
   *
   * หน้านี้เคยไม่เรียกหลังบ้านเลย ซึ่งเป็นข้อดีด้านความปลอดภัยที่เสียไปกับการ
   * เปลี่ยนนี้ (ดู CLAUDE.md) แลกกับการที่เบอร์ไม่ต้องอยู่ในไฟล์ที่เผยแพร่
   *
   * ล้มเหลวแบบเงียบโดยตั้งใจ: ถ้าหลังบ้านช้าหรือล่ม ป้ายต้องพิมพ์ได้อยู่ดี แค่
   * ไม่มีบรรทัดเบอร์ -- ดีกว่าค้างรอ หรือพิมพ์บรรทัดว่างเปล่าออกมา
   * ใช้ GET เฉย ๆ ไม่ต้องมี body จึงไม่โดน CORS preflight ที่ Apps Script ตอบไม่ได้
   */
  fetch(SHEETS_ENDPOINT)
    .then(response => (response.ok ? response.json() : null))
    .then(body => {
      const contact = body && body.ok && body.data && body.data.contact;
      if (!contact || !contact.phone) return;

      const line = document.getElementById("qrContact");
      line.textContent = [contact.department, `โทร. ${contact.phone}`]
        .filter(Boolean)
        .join(" ");
      line.hidden = false;
    })
    .catch(err => console.warn("CS Connect: ดึงข้อมูลติดต่อไม่สำเร็จ", err));

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

})();
