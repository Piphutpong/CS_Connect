(() => {
  "use strict";

  // Same Apps Script Web App the main app (app.js) uses. This is a second
  // standalone page with its own script rather than a shared module (no
  // build step in this project), so if this URL ever changes, update it in
  // BOTH app.js and here.
  const SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbw6Ri7ctu5guRHj3MJupkt0DJcgaht2-RHhhT9_YVNjnme4x1CbMl2SnC5hKO_OH_o/exec";

  // Kept in sync with JOB_STATUS_TONE in app.js -- update both if a status is
  // added or its tone changes.
  const JOB_STATUS_TONE = {
    "รอตรวจสอบ": "warning",
    "รอชำระเงิน": "warning",
    "ชำระเงินแล้ว": "success",
    "ไม่มีค่าใช้จ่าย": "success",
    "ส่งแผนกมิเตอร์แล้ว": "info",
    "รอเอกสารเพิ่มเติม": "warning",
    "รอแก้ไข": "warning",
    "รอขยายเขตฯ": "warning",
    "ยกเลิกคำร้อง": "danger",
    "จัดเก็บเอกสาร (ผบส.)": "success",
    "ผมต. ตีกลับ": "danger"
  };

  // Kept in sync with driveThumbnailUrl() in app.js -- Drive's old-style
  // `uc?export=view&id=...` link (what old slips may still have stored)
  // often refuses to serve as a bare <img src>, leaving this preview blank.
  // thumbnail?id= reliably returns actual image bytes for the same file.
  function driveThumbnailUrl(url) {
    if (!url) return url;
    const match = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/) || String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600` : url;
  }

  function formatThaiDate(dateStr) {
    if (!dateStr) return "-";
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  /**
   * ยอดเงินให้อ่านง่ายแบบเงินจริง -- ค่าที่เก็บมาเป็นข้อความจากช่องตัวเลข
   * ("1500", "1500.5") ถ้าแปลงเป็นตัวเลขไม่ได้ก็แสดงตามที่เก็บไว้ ดีกว่าโชว์ NaN
   */
  function formatFee(value) {
    const amount = Number(String(value).replace(/,/g, ""));
    if (!isFinite(amount)) return String(value);
    return `${amount.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} บาท`;
  }

  function showError(el, message) {
    el.textContent = message;
    el.hidden = false;
  }

  function hideError(el) {
    el.hidden = true;
    el.textContent = "";
  }

  /**
   * The backend call takes a moment (hashing/lookups on the Apps Script side),
   * so the button has to say something and stop accepting a second click
   * rather than looking unresponsive or letting an impatient double-submit
   * fire twice.
   */
  function setBusy(button, busy, busyLabel) {
    if (!button) return;

    if (busy) {
      button.dataset.idleLabel = button.textContent;
      button.textContent = busyLabel || button.textContent;
      button.disabled = true;
    } else {
      if (button.dataset.idleLabel) button.textContent = button.dataset.idleLabel;
      button.disabled = false;
    }
  }

  // text/plain on purpose: an application/json body would trigger a CORS
  // preflight, which Apps Script web apps cannot answer.
  async function call(payload) {
    const response = await fetch(SHEETS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`เชื่อมต่อระบบไม่สำเร็จ (HTTP ${response.status})`);

    const body = await response.json();
    if (!body.ok) throw new Error(body.error || "ระบบตอบกลับผิดพลาด");
    return body.data;
  }

  const trackForm = document.getElementById("trackForm");
  const trackError = document.getElementById("trackError");
  const trackResult = document.getElementById("trackResult");
  const trackPaymentSection = document.getElementById("trackPaymentSection");
  const trackSlipSection = document.getElementById("trackSlipSection");
  const trackSlipForm = document.getElementById("trackSlipForm");
  const trackSlipError = document.getElementById("trackSlipError");
  const slipSuccessModal = document.getElementById("slipSuccessModal");

  document.getElementById("slipSuccessOkBtn").addEventListener("click", () => {
    slipSuccessModal.hidden = true;
  });

  slipSuccessModal.addEventListener("click", (e) => {
    if (e.target === slipSuccessModal) {
      slipSuccessModal.hidden = true;
    }
  });

  // The credentials the visitor proved ownership with, replayed on the slip
  // upload so the backend can re-verify. The record's internal id is
  // deliberately never sent to this page.
  let trackedNumber = "";
  let trackedPhone = "";

  function renderTrackResult(match) {
    document.getElementById("trackResultName").textContent = match.customerName || "-";
    document.getElementById("trackResultNumber").textContent = match.trackingNumber;
    document.getElementById("trackResultDate").textContent = formatThaiDate(match.receivedDate);
    document.getElementById("trackResultPurpose").textContent = match.purpose || "-";

    // ค่าธรรมเนียมมาจากหลังบ้านเฉพาะตอนสถานะรอชำระเงิน (ดู publicRequest_)
    // จึงไม่ต้องตรวจสถานะซ้ำที่นี่ -- มีค่ามาเมื่อไหร่แปลว่าต้องแสดง
    const feeRow = document.getElementById("trackFeeRow");
    feeRow.hidden = !match.fee;
    if (match.fee) {
      document.getElementById("trackResultFee").textContent = formatFee(match.fee);
    }

    // บางสถานะหลังบ้านแนบข้อความติดต่อมาด้วย เช่นงานที่ส่งต่อไปแผนกอื่นแล้ว
    // -- โทรมาถามที่เดิมจะไม่ได้คำตอบ จึงต้องบอกไปเลยว่าต้องถามใคร
    const noteEl = document.getElementById("trackStatusNote");
    const statusContact = match.statusContact;

    // สร้างเป็นสองบรรทัดด้วย element แยก ไม่ใช่ต่อสตริงเดียวแล้วหวังให้ตัดบรรทัดเอง
    // -- การขึ้นบรรทัดจะได้ไม่ขึ้นกับความกว้างจอ และเบอร์โทรไม่มีทางถูกตัดคาบรรทัด
    noteEl.textContent = "";
    noteEl.hidden = !statusContact;

    if (statusContact) {
      const what = document.createElement("span");
      what.className = "track-status-note-line";
      what.textContent = statusContact.message || "";

      // เบอร์กับชื่อแผนกเป็นก้อนละชิ้นที่ห้ามตัดกลาง -- ถ้าปล่อยเป็นข้อความเดียว
      // จอแคบจะตัดตรงไหนก็ได้ แล้ววงเล็บปิดไปห้อยอยู่บรรทัดใหม่ตัวเดียว
      // แยกแบบนี้ทำให้ถ้าจำเป็นต้องขึ้นบรรทัด จะขึ้นระหว่างเบอร์กับแผนกเท่านั้น
      const who = document.createElement("span");
      who.className = "track-status-note-line track-status-note-contact";

      if (statusContact.phone) {
        const phone = document.createElement("span");
        phone.className = "track-status-note-part";
        phone.textContent = `โทร. ${statusContact.phone}`;
        who.appendChild(phone);
      }

      if (statusContact.department) {
        const dept = document.createElement("span");
        dept.className = "track-status-note-part";
        dept.textContent = `(${statusContact.department})`;
        if (who.childNodes.length) who.append(" ");
        who.appendChild(dept);
      }

      if (what.textContent) noteEl.appendChild(what);
      if (who.textContent) noteEl.appendChild(who);
    }

    const statusBadge = document.getElementById("trackStatusBadge");
    statusBadge.textContent = match.jobStatus || "-";
    statusBadge.className = "request-badge request-badge-status";
    if (match.jobStatus) {
      statusBadge.classList.add(`tone-${JOB_STATUS_TONE[match.jobStatus] || "info"}`);
    }

    // Bank transfer info is only useful before a slip has been submitted --
    // jobStatus stays รอชำระเงิน after upload (staff verify it themselves),
    // so it's the paymentSlip check, not the status, that hides this once
    // one is already on file.
    // The account details arrive with the lookup rather than sitting in the
    // page, so they only exist for someone who proved ownership of a request
    // that is actually awaiting payment. No account, no section.
    const account = match.paymentAccount;
    trackPaymentSection.hidden = !account;
    if (account) {
      document.getElementById("payAccountName").textContent = account.accountName || "-";
      document.getElementById("payBank").textContent = account.bank || "-";
      document.getElementById("payBranch").textContent = account.branch || "-";
      document.getElementById("payAccountNumber").textContent = account.accountNumber || "-";
    }

    // Slip attachment is only meaningful while a payment is actually being
    // waited on -- once staff move the record to any other status (paid,
    // cancelled, sent onward, ...), a customer should no longer be able to
    // attach or replace a slip on it.
    trackSlipSection.hidden = match.jobStatus !== "รอชำระเงิน";

    trackSlipForm.reset();
    hideError(trackSlipError);

    // While still รอชำระเงิน, the slip form stays available so a customer
    // can fix a wrong upload -- only the label/button wording and the
    // preview image change depending on whether one is already on file.
    const hasSlip = Boolean(match.paymentSlip);
    const slipImage = document.getElementById("trackSlipImage");
    slipImage.hidden = !hasSlip;
    if (hasSlip) {
      slipImage.src = driveThumbnailUrl(match.paymentSlip);
    } else {
      // Belt and braces alongside the [hidden] CSS fix -- clear the src so a
      // stale image from a previous lookup this session can never be what's
      // sitting in the DOM, hidden or not.
      slipImage.removeAttribute("src");
    }
    document.getElementById("trackSlipFileLabel").textContent = hasSlip
      ? "แก้ไขไฟล์แนบ (แนบสลิปใหม่แทนของเดิม)"
      : "แนบสลิปการโอนเงิน";
    document.getElementById("trackSlipSubmitBtn").textContent = hasSlip ? "แก้ไขไฟล์แนบ" : "ยืนยันการชำระเงิน";

    trackResult.hidden = false;
  }

  trackForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(trackError);
    trackResult.hidden = true;

    const submitBtn = trackForm.querySelector("button[type=submit]");

    try {
      const number = document.getElementById("trackNumber").value.trim();
      const phone = document.getElementById("trackPhone").value.trim();

      if (!number) {
        showError(trackError, "กรุณากรอกเลขที่คำร้อง");
        return;
      }

      if (!phone) {
        showError(trackError, "กรุณากรอกเบอร์โทรศัพท์ที่แจ้งไว้");
        return;
      }

      setBusy(submitBtn, true, "กำลังตรวจสอบ...");

      // The backend does the matching and returns only this one request's
      // display fields -- never the whole request table.
      const match = await call({ action: "track", trackingNumber: number, phone });

      trackedNumber = number;
      trackedPhone = phone;

      renderTrackResult(match);
    } catch (err) {
      console.error("CS Connect track error:", err);
      showError(trackError, err.message || "เกิดข้อผิดพลาด ไม่สามารถตรวจสอบสถานะได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(submitBtn, false);
    }
  });

  trackSlipForm.addEventListener("submit", (e) => {
    e.preventDefault();
    hideError(trackSlipError);

    try {
      const file = document.getElementById("trackSlipFile").files[0];

      if (!file) {
        showError(trackSlipError, "กรุณาแนบไฟล์สลิปการโอนเงิน");
        return;
      }

      const reader = new FileReader();

      reader.onerror = () => {
        showError(trackSlipError, "ไม่สามารถอ่านไฟล์สลิปได้ กรุณาลองใหม่อีกครั้ง");
      };

      const submitBtn = document.getElementById("trackSlipSubmitBtn");

      reader.onload = async () => {
        try {
          setBusy(submitBtn, true, "กำลังอัปโหลด...");

          // The backend re-verifies the tracking number against the phone on
          // file and will only touch paymentSlip on that one record -- a
          // customer cannot reach any other field or any other request.
          // jobStatus is deliberately left alone; it stays "รอชำระเงิน" until
          // staff verify the slip themselves (see isPaymentNotice in app.js).
          const updated = await call({
            action: "uploadSlip",
            trackingNumber: trackedNumber,
            phone: trackedPhone,
            slip: reader.result
          });

          trackSlipForm.reset();
          renderTrackResult(updated);
          slipSuccessModal.hidden = false;
        } catch (err) {
          console.error("CS Connect slip save error:", err);
          showError(trackSlipError, err.message || "เกิดข้อผิดพลาด ไม่สามารถบันทึกสลิปได้ กรุณาลองใหม่อีกครั้ง");
        } finally {
          setBusy(submitBtn, false);
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error("CS Connect slip upload error:", err);
      showError(trackSlipError, "เกิดข้อผิดพลาด ไม่สามารถแนบสลิปได้ กรุณาลองใหม่อีกครั้ง");
    }
  });
})();
