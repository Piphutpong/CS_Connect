(() => {
  "use strict";

  const USERS_KEY = "csconnect_users";
  const SESSION_KEY = "csconnect_currentUser";
  const REQUESTS_KEY = "csconnect_requests";
  const DISPATCHES_KEY = "csconnect_meterDispatches";
  const GENERAL_DISPATCHES_KEY = "csconnect_generalDispatches";
  const MIGRATED_KEY = "csconnect_migratedToBackend";

  const REQUEST_TYPES = {
    power: "ขอใช้ไฟฟ้า",
    deposit: "ขอเงินประกันคืน",
    extend: "ขอขยายเขตระบบจำหน่ายไฟฟ้า",
    // แท็บฐาน (เก็บ/แก้ไขคำร้องได้ทุกสถานะ) -- ป้ายชื่อไม่ใช่ "คำร้องทั่วไป" อีก
    // ต่อไปโดยตั้งใจ ต่างจากแท็บฐานอื่นทุกแท็บที่ป้ายตรงกับชื่อประเภท: แท็บนี้ถูก
    // แยกออกจากแท็บ "คุมคำร้องส่งแผนกสนับสนุน" (generalDispatch ด้านล่าง) แล้ว
    // "รายละเอียดคำร้อง" จึงสื่อกว่าว่าเป็นที่ดูคำร้องทุกใบทุกสถานะ ไม่ใช่คิวงาน
    // ป้ายเดียวกับที่ extendDetailTitle ใช้อยู่แล้วสำหรับความหมายเดียวกัน
    general: "รายละเอียดคำร้อง",
    payment: "แจ้งเตือนการรับชำระเงิน",
    meter: "คุมคำร้องส่งแผนกมิเตอร์",
    // Derived tab เหมือน payment/meter ข้างบน -- คำร้องทั่วไป (type: general)
    // ที่ยังไม่ได้ส่ง กรองจาก jobStatus ไม่ใช่ประเภทแยก ดู isGeneralDispatch
    generalDispatch: "คุมคำร้องส่งแผนกสนับสนุน"
  };

  // Maps each ขอใช้ไฟฟ้า job status to a highlight tone so the card badge
  // reads at a glance: warning = still waiting on someone, success = closed
  // out cleanly, danger = cancelled/rejected, info = handed off elsewhere.
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
    "ผมต. ตีกลับ": "danger",
    // ขอขยายเขตระบบจำหน่ายไฟฟ้า -- คนละชุดสถานะกับขอใช้ไฟฟ้าด้านบน แต่ใช้แผนที่
    // สี/ความหมายเดียวกัน: warning = ยังรอใครสักคนทำต่อ, info = ส่งต่อให้หน่วยงาน
    // อื่นแล้ว, success = จบงานด้วยดี, danger = ยกเลิก/หมดอายุ (รอเอกสารเพิ่มเติม
    // และยกเลิกคำร้อง ใช้คีย์ร่วมกับขอใช้ไฟฟ้าด้านบนอยู่แล้ว ไม่ต้องเพิ่มซ้ำ)
    "รอจ่ายงาน": "warning",
    "รอสำรวจ": "warning",
    "รอเขียนผัง": "warning",
    "รอประมาณการ": "warning",
    "ส่งตรวจแผนผังและประมาณการ": "info",
    "เสนออนุมัติ": "info",
    "อนุมัติและแจ้งค่าใช้จ่ายแล้ว": "success",
    "ส่ง ผบร.": "info",
    "ส่ง ผปบ.": "info",
    "ส่ง ผกส.": "info",
    "ส่งหนังสือแจ้ง ทต./อบต. แล้ว": "success",
    "อื่นๆ (หมายเหตุเพิ่มเติม)": "info",
    "หมดกำหนดยืนราคา": "danger",
    // คำร้องทั่วไป -- สองสถานะเท่านั้น: ยังไม่ส่ง (warning) กับส่งแล้ว (success)
    "รอส่ง ผสน.": "warning",
    "ส่ง ผสน. แล้ว": "success"
  };

  // Service area currently covers only these Chiang Mai districts;
  // subdistrict list + postal code both key off the chosen district.
  const DISTRICTS = {
    hangdong: {
      label: "อำเภอหางดง",
      subdistricts: [
        ["ตำบลหางดง", "50230"],
        ["ตำบลหนองแก๋ว", "50230"],
        ["ตำบลหารแก้ว", "50230"],
        ["ตำบลหนองตอง", "50230"],
        ["ตำบลขุนคง", "50230"],
        ["ตำบลสบแม่ข่า", "50230"],
        ["ตำบลบ้านแหวน", "50230"],
        ["ตำบลน้ำแพร่", "50230"],
        ["ตำบลหนองควาย", "50230"],
        ["ตำบลบ้านปง", "50230"],
        ["ตำบลสันผักหวาน", "50230"]
      ]
    },
    sanpatong: {
      label: "อำเภอสันป่าตอง",
      subdistricts: [
        ["ตำบลยุหว่า", "50120"],
        ["ตำบลทุ่งสะโตก", "50120"],
        ["ตำบลทุ่งต้อม", "50120"],
        ["ตำบลบ้านแม", "50120"],
        ["ตำบลมะขามหลวง", "50120"],
        ["ตำบลท่าวังพร้าว", "50120"],
        ["ตำบลแม่ก๊า", "50120"],
        ["ตำบลน้ำบ่อหลวง", "50120"],
        ["ตำบลสันกลาง", "50120"],
        ["ตำบลมะขุนหวาน", "50120"]
      ]
    },
    mueangchiangmai: {
      label: "อำเภอเมืองเชียงใหม่",
      subdistricts: [
        ["ตำบลศรีภูมิ", "50200"],
        ["ตำบลพระสิงห์", "50200"],
        ["ตำบลหายยา", "50100"],
        ["ตำบลช้างม่อย", "50300"],
        ["ตำบลช้างคลาน", "50100"],
        ["ตำบลวัดเกต", "50000"],
        ["ตำบลช้างเผือก", "50300"],
        ["ตำบลสุเทพ", "50200"],
        ["ตำบลแม่เหียะ", "50100"],
        ["ตำบลป่าแดด", "50100"],
        ["ตำบลหนองหอย", "50000"],
        ["ตำบลท่าศาลา", "50000"],
        ["ตำบลหนองป่าครั่ง", "50000"],
        ["ตำบลฟ้าฮ่าม", "50000"],
        ["ตำบลป่าตัน", "50300"],
        ["ตำบลสันผีเสื้อ", "50300"]
      ]
    }
  };

  const SERVICES = {
    extend: {
      title: "ขอขยายเขตระบบจำหน่ายไฟฟ้า",
      desc: "คำร้องขอขยายเขตระบบจำหน่ายไฟฟ้า",
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V10m0 10h16M4 20 12 4l8 16M9 20v-6h6v6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>'
    },
    solar: {
      title: "Solar",
      desc: "คำร้องเกี่ยวกับระบบผลิตไฟฟ้าพลังงานแสงอาทิตย์",
      icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v2.5M12 19.5V22M22 12h-2.5M4.5 12H2M19.07 4.93l-1.77 1.77M6.7 17.3l-1.77 1.77M19.07 19.07l-1.77-1.77M6.7 6.7 4.93 4.93" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
    }
  };

  // ---------- backend ----------
  // The only place that knows *where* data lives. Everything above this line
  // is UI; everything below talks to `backend` through the cache layer that
  // follows. Swapping localStorage for Google Sheets / Supabase / a Django API
  // means replacing this one object -- no other code has to change.
  //
  // Falls back to an in-memory store if localStorage is blocked (e.g. some
  // sandboxed previews or browser privacy settings), so the app still works
  // for the current tab instead of failing silently.
  let storageAvailable = true;
  try {
    const testKey = "__csconnect_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
  } catch {
    storageAvailable = false;
    console.warn("CS Connect: localStorage ใช้งานไม่ได้ กำลังใช้หน่วยความจำชั่วคราวแทน (ข้อมูลจะหายเมื่อปิดแท็บ)");
  }

  let memoryUsers = [];
  let memorySession = null;
  let memoryRequests = [];
  let memoryDispatches = [];
  let memoryGeneralDispatches = [];

  function readLocal(key, fallback) {
    if (!storageAvailable) return fallback;
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  }

  // Offline fallback for working on the UI with no network (SHEETS_ENDPOINT
  // set to ""). Its auth is plain-text and deliberately dev-only -- the real
  // deployment hashes passwords inside Apps Script.
  const localBackend = {
    async load() {
      return {
        requests: readLocal(REQUESTS_KEY, memoryRequests),
        dispatches: readLocal(DISPATCHES_KEY, memoryDispatches),
        generalDispatches: readLocal(GENERAL_DISPATCHES_KEY, memoryGeneralDispatches)
      };
    },

    async saveRequests(requests) {
      if (!storageAvailable) {
        memoryRequests = requests;
        return;
      }
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    },

    async saveMeterDispatch(dispatch) {
      const all = readLocal(DISPATCHES_KEY, memoryDispatches).concat([dispatch]);
      if (!storageAvailable) {
        memoryDispatches = all;
        return;
      }
      localStorage.setItem(DISPATCHES_KEY, JSON.stringify(all));
    },

    async saveGeneralDispatch(dispatch) {
      const all = readLocal(GENERAL_DISPATCHES_KEY, memoryGeneralDispatches).concat([dispatch]);
      if (!storageAvailable) {
        memoryGeneralDispatches = all;
        return;
      }
      localStorage.setItem(GENERAL_DISPATCHES_KEY, JSON.stringify(all));
    },

    async register(user) {
      const users = readLocal(USERS_KEY, memoryUsers);
      if (users.some(u => u.email === user.email)) {
        throw new Error("อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว");
      }
      users.push(user);
      if (storageAvailable) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      } else {
        memoryUsers = users;
      }
      return user;
    },

    async login(email, password) {
      const user = readLocal(USERS_KEY, memoryUsers).find(u => u.email === email);
      if (!user || user.password !== password) {
        throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      }
      return user;
    },

    async logout() {},

    // โหมดออฟไลน์ไม่มี session ฝั่งเซิร์ฟเวอร์ให้ยกเลิก -- มีไว้เพื่อให้หน้าเว็บ
    // เรียกได้เหมือนกันโดยไม่พัง (ปุ่มนี้ซ่อนอยู่แล้วถ้าไม่ใช่ผู้ดูแลระบบ)
    // โหมดออฟไลน์อ่านจาก localStorage ใหม่ทุกครั้งอยู่แล้ว ไม่มีสำเนาให้ทิ้ง
    forgetCached() {},

    async revokeAllSessions() {
      return { revoked: 0 };
    },

    // โหมดออฟไลน์เก็บรหัสผ่านแบบอ่านได้อยู่แล้ว (dev เท่านั้น) การทำให้คำสั่งนี้
    // "เหมือนจะใช้ได้" จึงอันตรายกว่าการบอกตรง ๆ ว่าใช้ไม่ได้
    async changePassword() {
      throw new Error("โหมดออฟไลน์ไม่รองรับการเปลี่ยนรหัสผ่าน");
    },

    async adminResetPassword() {
      throw new Error("โหมดออฟไลน์ไม่รองรับการตั้งรหัสผ่านชั่วคราว");
    },

    async exportAll() {
      throw new Error("โหมดออฟไลน์ไม่รองรับการสำรองข้อมูล");
    },

    async getInviteCode() {
      throw new Error("โหมดออฟไลน์ไม่รองรับรหัสเชิญ");
    },

    async createInviteCode() {
      throw new Error("โหมดออฟไลน์ไม่รองรับรหัสเชิญ");
    },

    async revokeInviteCode() {
      throw new Error("โหมดออฟไลน์ไม่รองรับรหัสเชิญ");
    },

    async listStaff() {
      throw new Error("โหมดออฟไลน์ไม่รองรับรายชื่อเจ้าหน้าที่");
    },

    async assignRequests() {
      throw new Error("โหมดออฟไลน์ไม่รองรับการจ่ายงาน");
    },

    async setUserRole() {
      throw new Error("โหมดออฟไลน์ไม่รองรับการตั้งสิทธิ์หัวหน้างาน");
    },

    async saveExtendFile() {
      throw new Error("โหมดออฟไลน์ไม่รองรับการแนบไฟล์");
    },

    async deleteExtendFile() {
      throw new Error("โหมดออฟไลน์ไม่รองรับการลบไฟล์แนบ");
    },

    async listEstimateItems() {
      throw new Error("โหมดออฟไลน์ไม่รองรับรายการประมาณการ");
    },

    async saveEstimateKit() {
      throw new Error("โหมดออฟไลน์ไม่รองรับชุดเซ็ตพัสดุ");
    },

    async deleteEstimateKit() {
      throw new Error("โหมดออฟไลน์ไม่รองรับชุดเซ็ตพัสดุ");
    }

    // track()/uploadSlip() live in track.js now -- the public tracking page
    // is its own standalone page (see track.html) so it can have its own
    // short link/QR code, independent of this app's login gate.
  };

  // Google Apps Script web app in front of a Google Sheet. Set to "" to fall
  // back to localBackend (useful for offline work on the UI).
  const SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbw6Ri7ctu5guRHj3MJupkt0DJcgaht2-RHhhT9_YVNjnme4x1CbMl2SnC5hKO_OH_o/exec";

  const sheetsBackend = (() => {
    // What the sheet is believed to already hold, so a save can send only the
    // records that actually changed instead of re-uploading every row.
    let savedRequests = new Map();

    function snapshot(records) {
      const map = new Map();
      records.forEach(r => map.set(String(r.id), JSON.stringify(r)));
      return map;
    }

    /**
     * คำสั่งที่ "ยิงซ้ำแล้วผลเท่าเดิม" จึงลองใหม่เองได้อย่างปลอดภัย
     *
     * ทุกคำสั่งที่ POST ไป /exec ถูก Apps Script ตอบเป็น 302 ไปยัง
     * script.googleusercontent.com เสมอ และปลายทางนั้นหลุดเป็น 404 เป็นครั้งคราว
     * ทั้งที่สคริปต์ฝั่งกูเกิลทำงานจนจบไปแล้ว -- ข้อมูลเข้าชีตเรียบร้อยแต่เบราว์เซอร์
     * เห็นว่าล้มเหลว ซึ่งเป็นที่มาของทั้งข้อความ HTTP 404 และคำร้องที่ซ้ำกันเมื่อ
     * เจ้าหน้าที่กดบันทึกใหม่
     *
     * เป็น allowlist ไม่ใช่ blocklist โดยตั้งใจ -- คำสั่งใหม่ที่ยังไม่ได้พิจารณา
     * จะไม่ถูกยิงซ้ำเอง ซึ่งเป็นด้านที่ปลอดภัยกว่าเมื่อเดาผิด
     *
     * ที่ไม่อยู่ในรายการนี้ และเหตุผล:
     *   assignRequests     ต่อคอมเมนต์ "จ่ายงานให้ ..." ทุกครั้งที่เรียก
     *   saveExtendFile     อัปโหลดไฟล์ขึ้น Drive ใหม่ทุกครั้ง
     *   saveMeterDispatch  เพิ่มสมุดคุมเล่มใหม่ทุกครั้ง
     *   login / register / changePassword / adminResetPassword
     *
     * saveRequests ยิงซ้ำได้เพราะฝั่งเซิร์ฟเวอร์ upsert ด้วย id -- เขียนทับแถวเดิม
     * ไม่ใช่ต่อแถวใหม่ ซึ่งจะจริงก็ต่อเมื่อ id ของคำร้องใหม่คงที่ข้ามการลองใหม่ด้วย
     * (ดู pendingNewId)
     */
    const RETRYABLE_ACTIONS = new Set([
      "loadRequests", "saveRequests", "searchArchivedRequests",
      "listStaff", "listEstimateItems", "listEstimateLists"
    ]);

    const RETRY_ATTEMPTS = 3;

    async function call(payload) {
      let lastError = null;

      for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        let transient = false;

        try {
          // text/plain on purpose: an application/json body would trigger a CORS
          // preflight, which Apps Script web apps cannot answer.
          const response = await fetch(SHEETS_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            // 404 คือปลายทาง redirect หลุด, 429/5xx คือฝั่งกูเกิลรับไม่ไหวชั่วคราว
            // -- ลองใหม่แล้วมีโอกาสผ่าน ต่างจาก 401/403 ที่ลองกี่ครั้งก็ได้คำตอบเดิม
            transient = response.status === 404 || response.status === 429 || response.status >= 500;
            throw new Error(`เชื่อมต่อฐานข้อมูลไม่สำเร็จ (HTTP ${response.status})`);
          }

          const body = await response.json();

          // ตอบกลับเป็น JSON ที่อ่านได้ = สคริปต์ทำงานแล้วและตัดสินใจแล้ว ไม่ใช่
          // ปัญหาการเชื่อมต่อ จึงไม่ลองใหม่ ต่อให้ ok เป็น false
          if (!body.ok) throw new Error(body.error || "ฐานข้อมูลตอบกลับผิดพลาด");
          return body.data;
        } catch (err) {
          // fetch โยน error เอง = เครือข่ายไม่ถึงปลายทาง (ออฟไลน์, DNS, ตัดกลางคัน)
          if (err instanceof TypeError) transient = true;

          lastError = err;

          const canRetry = transient
            && attempt < RETRY_ATTEMPTS
            && RETRYABLE_ACTIONS.has(payload.action);

          if (!canRetry) throw err;

          // ถอยห่างขึ้นเรื่อย ๆ แทนที่จะยิงรัว -- ถ้าปลายทางกำลังไม่ไหว
          // การยิงซ้ำทันทีคือการซ้ำเติม
          await new Promise(resolve => setTimeout(resolve, 400 * attempt));
          console.warn(`CS Connect: ${payload.action} ล้มเหลวชั่วคราว กำลังลองใหม่`, err);
        }
      }

      throw lastError;
    }

    /**
     * Data calls carry the login token; the backend rejects them without it.
     *
     * ทุกคำสั่งที่ต้องล็อกอินผ่านที่นี่ที่เดียว จึงเป็นจุดเดียวที่ต้องดัก
     * AUTH_REQUIRED -- แทนที่จะไปไล่ใส่ในทุก catch ของทุกฟอร์ม
     *
     * ยัง throw ต่อเสมอ ไม่กลืน error ทิ้ง: ผู้เรียกต้องรู้ว่างานไม่สำเร็จ เพื่อจะ
     * ได้ไม่ไปอัปเดต cache หรือปิดฟอร์มราวกับบันทึกผ่านแล้ว (ดู saveRequests ที่
     * ต้อง roll back cache กลับ) -- ข้อความที่ผู้เรียกเอาไปแสดงจะอยู่บนหน้าจอที่
     * ถูกซ่อนไปแล้ว ผู้ใช้จึงเห็นแต่ข้อความเซสชันหมดอายุที่หน้า login
     */
    async function callAsUser(payload) {
      try {
        return await call({ ...payload, token: getSession()?.token });
      } catch (err) {
        const message = String(err && err.message);

        if (message.includes("AUTH_REQUIRED")) {
          handleAuthExpired();
        } else if (message.includes("PASSWORD_CHANGE_REQUIRED")) {
          // ด่านฝั่งเซิร์ฟเวอร์ปฏิเสธมา -- แปลว่าหน้าจอกับความจริงไม่ตรงกัน
          // (เช่นแอดมินเพิ่งรีเซ็ตรหัสให้ระหว่างที่เปิดเว็บค้างไว้) พากลับไป
          // หน้าตั้งรหัสใหม่ ซึ่งเป็นสิ่งเดียวที่บัญชีนี้ทำได้ตอนนี้
          const session = getSession();
          if (session) {
            session.mustChangePassword = true;
            setSession(session, sessionIsRemembered());
          }
          requestsCache = [];
          dispatchesCache = [];
          generalDispatchesCache = [];
          document.getElementById("bootOverlay").hidden = true;
          openAccountView(true);
        }

        throw err;
      }
    }

    return {
      // Dispatch books ride along on the same call rather than getting their
      // own round trip: there is one row per printed book (not per request),
      // so the payload is small, and having them in memory is what makes the
      // history searchable instantly and lets a request link back to the book
      // it went out on without another fetch.
      async load() {
        const data = await callAsUser({ action: "loadRequests" });
        const requests = data.requests || [];
        savedRequests = snapshot(requests);
        return {
          requests,
          dispatches: data.dispatches || [],
          generalDispatches: data.generalDispatches || []
        };
      },

      async saveRequests(requests) {
        const changed = requests.filter(r => savedRequests.get(String(r.id)) !== JSON.stringify(r));
        if (!changed.length) return;

        await callAsUser({ action: "saveRequests", records: changed });
        changed.forEach(r => savedRequests.set(String(r.id), JSON.stringify(r)));
      },

      async saveMeterDispatch(dispatch) {
        await callAsUser({ action: "saveMeterDispatch", record: dispatch });
      },

      async saveGeneralDispatch(dispatch) {
        await callAsUser({ action: "saveGeneralDispatch", record: dispatch });
      },

      // Passwords never leave the browser except over the wire to the script,
      // which is the only place that hashes or compares them.
      async register(user) {
        return call({ action: "register", user });
      },

      async login(email, password) {
        return call({ action: "login", email, password });
      },

      async logout(token) {
        return call({ action: "logout", token });
      },

      /**
       * ทิ้งสำเนาที่ใช้เทียบว่าคำร้องใบไหนเปลี่ยนไปบ้าง
       *
       * อยู่ที่นี่เพราะ savedRequests เป็นของ backend ไม่ใช่ของหน้าจอ -- ที่อื่น
       * ในแอปไม่ควรรู้ด้วยซ้ำว่ามันมีอยู่ (ดูหลักการ "ความรู้เรื่องที่เก็บข้อมูล
       * อยู่ในอ็อบเจกต์ backend เท่านั้น")
       */
      forgetCached() {
        savedRequests = new Map();
      },

      // ผู้ดูแลระบบเท่านั้น -- ฝั่ง Apps Script ตรวจด้วย requireAdmin_ อีกชั้น
      async revokeAllSessions() {
        return callAsUser({ action: "revokeAllSessions" });
      },

      // รหัสผ่านทั้งเดิมและใหม่ถูกส่งไปให้ Apps Script ตรวจและแฮชที่นั่น -- ห้าม
      // แฮชฝั่งนี้เด็ดขาด ไม่งั้นค่าที่แฮชแล้วจะกลายเป็นรหัสผ่านตัวจริงไปเอง
      async changePassword(currentPassword, newPassword) {
        return callAsUser({ action: "changePassword", currentPassword, newPassword });
      },

      // ผู้ดูแลระบบเท่านั้น -- คืนรหัสผ่านชั่วคราวกลับมาแสดงครั้งเดียว ไม่มีที่ไหนเก็บ
      async adminResetPassword(email) {
        return callAsUser({ action: "adminResetPassword", email });
      },

      // ผู้ดูแลระบบเท่านั้น -- ทุกแถวของทุกแท็บในก้อนเดียว (รหัสผ่านถูกตัดออก
      // ฝั่งเซิร์ฟเวอร์เสมอ ดู EXPORT_EXCLUDED_USER_COLUMNS)
      async exportAll() {
        return callAsUser({ action: "exportAll" });
      },

      // รหัสเชิญ -- ผู้ดูแลระบบเท่านั้น ทั้งสามคำสั่งกันด้วย requireAdmin_
      async getInviteCode() {
        return callAsUser({ action: "getInviteCode" });
      },

      async createInviteCode() {
        return callAsUser({ action: "createInviteCode" });
      },

      async revokeInviteCode() {
        return callAsUser({ action: "revokeInviteCode" });
      },

      // รายชื่อเจ้าหน้าที่สำหรับหน้าจ่ายงาน -- ฝั่งเซิร์ฟเวอร์ส่งกลับแค่ชื่อ/อีเมล/
      // ตำแหน่ง/สิทธิ์ (ดู listStaff_) ไม่ใช่ทั้งแถวผู้ใช้ซึ่งมีแฮชรหัสผ่านอยู่ด้วย
      async listStaff() {
        return callAsUser({ action: "listStaff" });
      },

      // หัวหน้างานเท่านั้น -- ฝั่งเซิร์ฟเวอร์เป็นคนเขียนฟิลด์การจ่ายงานเอง แล้วส่ง
      // เรกคอร์ดที่อัปเดตแล้วกลับมาให้ทับใน cache (ไม่ต้องโหลดใหม่ทั้งชุด)
      async assignRequests(ids, assigneeEmail) {
        const data = await callAsUser({ action: "assignRequests", ids, assigneeEmail });
        const updated = data.requests || [];
        // สำเนาที่ใช้เทียบว่า "อะไรเปลี่ยน" ต้องรู้ค่าใหม่ด้วย ไม่งั้นการบันทึก
        // ครั้งถัดไปจะส่งเรกคอร์ดเหล่านี้ซ้ำโดยไม่จำเป็น
        updated.forEach(r => savedRequests.set(String(r.id), JSON.stringify(r)));
        return updated;
      },

      // แค็ตตาล็อกรายการประมาณการ -- ข้อมูลตั้งต้น ดึงครั้งเดียวต่อการเปิดเว็บ
      async listEstimateItems() {
        return callAsUser({ action: "listEstimateItems" });
      },

      async saveEstimateKit(kit) {
        return callAsUser({ action: "saveEstimateKit", kit });
      },

      async deleteEstimateKit(id) {
        return callAsUser({ action: "deleteEstimateKit", id });
      },

      // แนบไฟล์ของงานขอขยายเขตฯ (แผนผัง / ภาพสถานที่ / ภาพเส้นทาง) -- ฝั่ง
      // เซิร์ฟเวอร์อัปขึ้น Drive เอง และเดินสถานะให้เฉพาะกรณีแผนผัง
      // คืนคำร้องที่อัปเดตแล้วกลับมาเพื่อเอาไปทับใน cache
      async saveExtendFile(id, kind, file) {
        const data = await callAsUser({ action: "saveExtendFile", id, kind, file });
        const updated = data.request;
        if (updated) savedRequests.set(String(updated.id), JSON.stringify(updated));
        return updated;
      },

      // ลบไฟล์แนบทีละไฟล์ (แนบผิดไฟล์) -- คืนคำร้องที่อัปเดตแล้วกลับมา
      async deleteExtendFile(id, kind, url) {
        const data = await callAsUser({ action: "deleteExtendFile", id, kind, url });
        const updated = data.request;
        if (updated) savedRequests.set(String(updated.id), JSON.stringify(updated));
        return updated;
      },

      // ผู้ดูแลระบบเท่านั้น -- ตั้ง/ถอดสิทธิ์หัวหน้างาน
      async setUserRole(email, role) {
        return callAsUser({ action: "setUserRole", email, role });
      },

      // loadRequests() (above) only returns still-open requests plus recently
      // closed ones -- see loadRequestsForStaff_ in Code.gs. This is the
      // escape hatch for the rare "find that old closed request" lookup: it
      // searches the full sheet server-side instead of ever pulling the
      // whole history into every staff member's browser.
      async searchArchived(query) {
        const data = await callAsUser({ action: "searchArchivedRequests", query });
        return data.requests || [];
      }

      // track()/uploadSlip() live in track.js now -- see the note on
      // localBackend above.
    };
  })();

  const backend = SHEETS_ENDPOINT ? sheetsBackend : localBackend;

  // ---------- data cache ----------
  // Reads are served synchronously from memory so rendering, filtering and
  // search stay instant even though the backend is a network call away. Only
  // refreshAll() reads from the backend; saveRequests writes through.
  //
  // There is deliberately no users cache: the browser never receives the user
  // table (it holds password hashes), so register/login go straight to the
  // backend instead of being answered from local data.
  let requestsCache = [];
  let dispatchesCache = [];
  let generalDispatchesCache = [];

  // Returns a shallow copy: callers routinely build up an edited array
  // (`requests[idx] = {...}`, `requests.push(...)`) and only commit it via
  // saveRequests, so handing out the live cache would apply those edits
  // before -- and even if -- the write succeeds.
  function getRequests() {
    return requestsCache.slice();
  }

  /** Printed meter-dispatch books, newest first. Same shallow-copy rule. */
  function getDispatches() {
    return dispatchesCache.slice();
  }

  /** เหมือน getDispatches ด้านบน แต่ของสมุดคุมคำร้องทั่วไป (ส่ง ผสน.) */
  function getGeneralDispatches() {
    return generalDispatchesCache.slice();
  }

  async function refreshAll() {
    const data = await backend.load();
    requestsCache = data.requests || [];
    dispatchesCache = data.dispatches || [];
    generalDispatchesCache = data.generalDispatches || [];
  }

  /**
   * First run against a real backend: anything sitting in this browser's
   * localStorage from before would otherwise just vanish from view. Push it up
   * once, but only into an empty backend, so it can never overwrite real
   * shared data or run twice. Users are not migrated -- their passwords would
   * have to be re-hashed, which only a real login can do.
   */
  async function migrateLocalDataOnce() {
    if (backend === localBackend || !storageAvailable) return;
    if (localStorage.getItem(MIGRATED_KEY)) return;

    const local = await localBackend.load();

    if (local.requests.length && !requestsCache.length) {
      await saveRequests(local.requests);
      console.info("CS Connect: ย้ายข้อมูลคำร้องเดิมในเครื่องขึ้นฐานข้อมูลแล้ว");
    }

    localStorage.setItem(MIGRATED_KEY, String(Date.now()));
  }

  async function saveRequests(requests) {
    const previous = requestsCache;
    requestsCache = requests;
    try {
      await backend.saveRequests(requests);
    } catch (err) {
      requestsCache = previous;
      throw err;
    }
  }

  function setSession(user, remember) {
    // The token is what actually authorises data calls -- the rest is display.
    const session = {
      email: user.email,
      name: user.name,
      token: user.token,
      isAdmin: Boolean(user.isAdmin),
      // ใช้ตัดสินแค่ว่าจะโชว์แผงจ่ายงานไหม -- ด่านจริงอยู่ฝั่งเซิร์ฟเวอร์ และ
      // ตรวจสิทธิ์ใหม่ทุกครั้งที่สั่งจ่ายงาน แก้ค่านี้ในเบราว์เซอร์ก็ไม่ผ่าน
      isSupervisor: Boolean(user.isSupervisor),
      mustChangePassword: Boolean(user.mustChangePassword)
    };
    if (!storageAvailable) {
      memorySession = session;
      return;
    }
    // "จำรหัสผ่าน" checked -> keep signed in across browser restarts (localStorage).
    // Unchecked -> forget when the browser/tab closes (sessionStorage).
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
  }

  /**
   * session นี้ถูกจำไว้ข้ามการปิดเบราว์เซอร์หรือไม่ (ติ๊ก "จำรหัสผ่าน" ไว้)
   *
   * ต้องหุ้ม try/catch เพราะ localStorage โยน error ทันทีถ้าเบราว์เซอร์ปิดการ
   * เก็บข้อมูลของเว็บไว้ -- ซึ่งเป็นเหตุผลเดียวกับที่มี storageAvailable อยู่แล้ว
   * ตอบ false เมื่ออ่านไม่ได้ ซึ่งเป็นฝั่งที่ปลอดภัยกว่า (ไม่จำต่อ)
   */
  function sessionIsRemembered() {
    if (!storageAvailable) return false;
    try {
      return localStorage.getItem(SESSION_KEY) !== null;
    } catch {
      return false;
    }
  }

  function getSession() {
    if (!storageAvailable) return memorySession;
    try {
      const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    if (!storageAvailable) {
      memorySession = null;
      return;
    }
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  /**
   * Who to attribute a write to. Every audit stamp in this app records both:
   * the display name (what the UI actually shows) and the email (the stable
   * identity). Nothing reads `byEmail` today -- it exists because a display
   * name is neither unique nor permanent, so it can't be resolved back to a
   * person later, and a future move to a real database (Django's User table,
   * say) needs a key it can join on. That backfill is impossible after the
   * fact, which is the whole reason it's written now rather than when it's
   * first needed. See django/models.py.
   */
  function actingStaff() {
    const session = getSession();
    return { byName: session?.name || "", byEmail: session?.email || "" };
  }

  // ---------- view switching ----------
  const views = {
    login: document.getElementById("loginView"),
    register: document.getElementById("registerView"),
    account: document.getElementById("accountView"),
    home: document.getElementById("homeView"),
    service: document.getElementById("serviceView"),
    requests: document.getElementById("requestsView"),
    extendWork: document.getElementById("extendWorkView"),
    estimate: document.getElementById("estimateView")
  };

  function showView(name) {
    Object.values(views).forEach(v => v.hidden = true);
    views[name].hidden = false;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function formatThaiDate(dateStr) {
    if (!dateStr) return "-";
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatThaiDateTime(timestamp) {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  // Opens the slip image in its own tab and triggers the browser print
  // dialog once it's loaded, rather than trying to print just part of the
  // current page.
  // Values here come from staff-entered fields (requestNumber, customerName)
  // and get dropped straight into a document.write() string below, so they
  // need escaping the same way any other HTML-injection point would.
  function escapeForPrint(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  // Google Drive's old-style `uc?export=view&id=...` link (what saveSlip_
  // used to return, and what's still stored on any slip uploaded before that
  // changed) frequently refuses to serve as a bare <img src> -- Drive shows
  // an interstitial/warning page instead of the image bytes, so the print
  // page and the tracking page's preview both come out blank. `thumbnail?id=`
  // is what Drive's own UI hotlinks with and reliably returns actual image
  // bytes. Re-deriving it here at render time (instead of only fixing new
  // uploads in Code.gs) also fixes every slip already on file, since it's
  // the same underlying file id either way.
  function driveThumbnailUrl(url) {
    if (!url) return url;
    const match = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/) || String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600` : url;
  }

  function printSlipImage(r) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const requestNumber = escapeForPrint(r.requestNumber || "-");
    const receivedDate = escapeForPrint(formatThaiDate(r.receivedDate) || "-");
    const customerName = escapeForPrint(r.customerName || r.requesterName || "-");
    // Older slips predate the paymentSlipAt column and have no value for it.
    const slipAttachedAt = escapeForPrint(r.paymentSlipAt ? formatThaiDateTime(r.paymentSlipAt) : "-");
    // ผ่าน escapeForPrint เหมือนทุกค่าอื่นในฟังก์ชันนี้ — ค่านี้เคยเป็นข้อยกเว้นเดียว
    // ทั้งที่มันถูกวางใน attribute ของ HTML ที่สร้างด้วย document.write() เหมือนกัน
    // ตัวค่ามาจากลูกค้าผ่าน uploadSlip -- ฝั่ง Code.gs กรองด้วย SLIP_URL_PATTERN
    // แล้ว แต่คำร้องที่บันทึกไว้ก่อนการกรองนั้นยังค้างอยู่ในชีตได้ จึงต้องกันซ้ำที่นี่อีกชั้น
    const slipSrc = escapeForPrint(driveThumbnailUrl(r.paymentSlip));

    printWindow.document.write(`
      <html>
        <head>
          <title>สลิปการชำระเงิน</title>
          <style>
            /* Constrains everything to one A4 page: the header text takes a
               known amount of space, so the image gets whatever's left
               (70vh is a safe margin under that) instead of spilling onto a
               second sheet for a tall/high-res slip photo. */
            @page { size: A4; margin: 12mm; }
            html, body { height: 100%; }
            body {
              margin: 0; padding: 24px; font-family: Sarabun, sans-serif;
              display: flex; flex-direction: column; align-items: center; gap: 14px;
              box-sizing: border-box;
            }
            .slip-header { width: 100%; max-width: 480px; font-size: 16px; line-height: 1.6; flex-shrink: 0; }
            .slip-header-row { display: flex; justify-content: space-between; gap: 16px; }
            img { max-width: 100%; max-height: 70vh; object-fit: contain; page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <div class="slip-header">
            <div class="slip-header-row">
              <span><b>เลขที่คำร้อง:</b> ${requestNumber}</span>
              <span><b>วันที่รับคำร้อง:</b> ${receivedDate}</span>
            </div>
            <div class="slip-header-row">
              <span><b>ชื่อลูกค้า:</b> ${customerName}</span>
              <span><b>วันที่แนบสลิป:</b> ${slipAttachedAt}</span>
            </div>
          </div>
          <img id="slipImage" src="${slipSrc}" alt="สลิปการชำระเงิน">
        </body>
      </html>
    `);
    printWindow.document.close();

    // เดิมเป็น onload="window.print()" ใน markup ของหน้าที่พิมพ์ -- หน้าต่างที่
    // เปิดด้วย window.open("", "_blank") สืบทอด CSP ของหน้าที่เปิดมัน สคริปต์
    // แบบ inline จึงถูกบล็อกไปด้วย ผูก listener จากฝั่งนี้แทนได้ผลเหมือนกัน
    // เพราะเรายังถือ Window object ของหน้าต่างนั้นอยู่
    //
    // ดัก error ด้วย ไม่ใช่แค่ load: เดิมถ้ารูปสลิปโหลดไม่ขึ้น (ลิงก์เสีย/เน็ตหลุด)
    // กล่องพิมพ์จะไม่เด้งขึ้นมาเลย เจ้าหน้าที่ค้างอยู่กับหน้าเปล่าโดยไม่มีอะไรบอก
    // ว่าเกิดอะไรขึ้น -- ให้พิมพ์ไปเลยดีกว่า อย่างน้อยหัวกระดาษก็ยังใช้ได้
    const slipImg = printWindow.document.getElementById("slipImage");
    if (!slipImg || slipImg.complete) {
      printWindow.print();
    } else {
      slipImg.addEventListener("load", () => printWindow.print());
      slipImg.addEventListener("error", () => printWindow.print());
    }
  }

  /**
   * Flips jobStatus to ส่งแผนกมิเตอร์แล้ว for every given record and saves
   * through the normal saveRequests() path -- the same mechanism any other
   * edit in this app uses, so nothing new needs to exist server-side for
   * this feature. Records leave the คุมคำร้องส่งแผนกมิเตอร์ tab on the very
   * next render purely because isMeterDispatch() no longer matches their new
   * status, the same way every other derived-tab transition already works.
   */
  async function markRecordsDispatchedToMeter(ids, book) {
    const { byName, byEmail } = actingStaff();
    const now = book.printedAt;
    const idSet = new Set(ids);

    const updated = getRequests().map(r => {
      if (!idSet.has(r.id) || r.jobStatus === "ส่งแผนกมิเตอร์แล้ว") return r;
      const statusHistory = (r.statusHistory || []).concat([
        { status: "ส่งแผนกมิเตอร์แล้ว", byName, byEmail, at: now }
      ]);
      return {
        ...r,
        jobStatus: "ส่งแผนกมิเตอร์แล้ว",
        statusHistory,
        updatedByName: byName,
        updatedByEmail: byEmail,
        updatedAt: now
      };
    });

    // The status change goes first: if storing the book fails, the requests
    // are still correctly marked as sent (which is what the paper in the
    // meter department's hands says) and the worst case is a missing history
    // entry, rather than requests that look unsent because a log write failed.
    await saveRequests(updated);

    const dispatch = {
      id: newRequestId(),
      printedAt: now,
      printedByName: byName,
      printedByEmail: byEmail,
      senderName: book.sender.name,
      senderPosition: book.sender.position,
      receiverName: book.receiver.name,
      receiverPosition: book.receiver.position,
      rows: book.rows
    };
    await backend.saveMeterDispatch(dispatch);
    dispatchesCache = [dispatch].concat(dispatchesCache);

    meterSelection.clear();
    renderRequestsList();
  }

  /**
   * เหมือน markRecordsDispatchedToMeter ด้านบนทุกกลไก แต่ปลายทางเป็น
   * "ส่ง ผสน. แล้ว" และต้องเติม sentDate ให้ด้วยตามที่สั่ง -- เก็บเป็นวันที่ล้วน
   * (YYYY-MM-DD) ให้ตรงชนิดกับที่ฟอร์มคำร้องทั่วไปใช้เอง ไม่ใช่ printedAt ซึ่งเป็น
   * ms timestamp มีเวลาปนอยู่ด้วย
   */
  async function markRecordsSentGeneral(ids, book) {
    const { byName, byEmail } = actingStaff();
    const now = book.printedAt;
    const idSet = new Set(ids);
    const sentDate = todayDateString(new Date(now));

    const updated = getRequests().map(r => {
      if (!idSet.has(r.id) || r.jobStatus === "ส่ง ผสน. แล้ว") return r;
      const statusHistory = (r.statusHistory || []).concat([
        { status: "ส่ง ผสน. แล้ว", byName, byEmail, at: now }
      ]);
      return {
        ...r,
        jobStatus: "ส่ง ผสน. แล้ว",
        sentDate,
        statusHistory,
        updatedByName: byName,
        updatedByEmail: byEmail,
        updatedAt: now
      };
    });

    await saveRequests(updated);

    const dispatch = {
      id: newRequestId(),
      printedAt: now,
      printedByName: byName,
      printedByEmail: byEmail,
      senderName: book.sender.name,
      senderPosition: book.sender.position,
      receiverName: book.receiver.name,
      receiverPosition: book.receiver.position,
      rows: book.rows
    };
    await backend.saveGeneralDispatch(dispatch);
    generalDispatchesCache = [dispatch].concat(generalDispatchesCache);

    generalSelection.clear();
    renderRequestsList();
  }

  /**
   * รูปแบบคอลัมน์กลางของสมุดคุม -- ใช้ร่วมกันระหว่างมิเตอร์กับคำร้องทั่วไป
   *
   * ลำดับที่/หมายเหตุ เป็นคอลัมน์ตายตัวสองข้าง (เพิ่มเองใน writeDispatchDocument)
   * ส่วนกลางเป็นค่าที่ต่างกันจริงตามชนิดของสมุด: มิเตอร์อ้างอิงคำร้องด้วยเลขที่
   * คำร้อง+ประเภทคำร้อง ส่วนคำร้องทั่วไปไม่มีทั้งสองอย่างนั้น ใช้เรื่องแทน
   */
  const METER_DISPATCH_PRINT_COLUMNS = [
    { label: "เลขที่คำร้อง", className: "col-number", cell: row => row.requestNumber || row.trackingNumber || "-" },
    { label: "ชื่อลูกค้า", cell: row => row.customerName || "-" },
    { label: "ประเภทคำร้อง", cell: row => row.purpose || "-" }
  ];

  // ไม่มีคอลัมน์แผนกที่รับผิดชอบโดยตั้งใจ -- ตามที่สั่งไว้ว่าสมุดเล่มนี้ไม่ต้อง
  // ดึงข้อมูลนั้นมาแสดง (ยังกรอกไว้ในคำร้องเองได้ตามปกติ แค่ไม่ขึ้นบนกระดาษที่พิมพ์)
  const GENERAL_DISPATCH_PRINT_COLUMNS = [
    { label: "เรื่อง", cell: row => row.subject || "-" },
    { label: "ชื่อลูกค้า", cell: row => row.customerName || "-" }
  ];

  /**
   * Writes a สมุดคุม document into an already-opened window. Shared by every
   * kind of dispatch book (มิเตอร์, คำร้องทั่วไป) and by both a first print
   * and a reprint from history, so none of them can drift apart in layout --
   * the differences are `title`/`columns` (what this book is a log of) and
   * whether the fields are editable / what the action button does.
   *
   * `rows` is the snapshot shape stored on a dispatch record, not live
   * request objects, so a reprint renders exactly what was signed for even
   * if the underlying requests have been edited since.
   */
  function writeDispatchDocument(printWindow, { title, columns, rows, printedAt, sender, senderOptions, receiver, editable, actionLabel, actionNote }) {
    const editAttr = editable ? ' contenteditable="true"' : "";

    const bodyRows = rows.map((row, i) => `
      <tr>
        <td class="col-index">${i + 1}</td>
        ${columns.map(col => `<td${col.className ? ` class="${col.className}"` : ""}>${escapeForPrint(col.cell(row))}</td>`).join("")}
        <td${editAttr}>${escapeForPrint(row.note || "")}</td>
      </tr>
    `).join("");

    const signedDate = escapeForPrint(
      new Date(printedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
    );

    /**
     * `pickerOptions` มีเฉพาะฝั่งผู้ส่ง (ไม่ใช่ผู้รับ) -- ผู้ส่งเป็นเจ้าหน้าที่
     * ในระบบนี้เสมอ จึงมีชื่อ+ตำแหน่งในรายชื่อเจ้าหน้าที่ให้เลือกได้ ส่วนผู้รับ
     * มักเป็นคนนอกระบบ (พนักงานแผนกมิเตอร์/ผสน.) ไม่มีบัญชีให้เลือกจาก
     *
     * ดรอปดาวน์เป็นแค่ตัวช่วยกรอก ไม่ใช่แหล่งข้อมูลจริง -- เลือกแล้วเขียนชื่อ/
     * ตำแหน่งลงช่อง .js-name/.js-position ที่ readDispatchDocument() อ่านอยู่
     * แล้วเหมือนเดิมทุกประการ (ดู listener ที่ผูกจากฝั่ง opener หลัง document.write
     * เพราะ CSP ของหน้าต่างนี้บล็อก inline script) ช่องยังแก้มือทับได้ต่อ เผื่อ
     * ตำแหน่งในระบบไม่ตรงกับที่ต้องเซ็นจริง ๆ
     */
    function signatureBlock(role, person, pickerOptions) {
      const picker = (editable && pickerOptions && pickerOptions.length)
        ? `
          <select class="sig-picker">
            <option value="">-- เลือก${role} --</option>
            ${pickerOptions.map(p => `<option value="${escapeForPrint(p.email)}"${p.email === person.email ? " selected" : ""}>${escapeForPrint(p.name)}${p.position ? ` (${escapeForPrint(p.position)})` : ""}</option>`).join("")}
          </select>
        `
        : "";

      return `
        <div class="sig-block">
          <p class="sig-line">ลงชื่อ ....................................... ${role}</p>
          ${picker}
          <p>(<span${editAttr} class="sig-fill js-name">${escapeForPrint(person.name || "")}</span>)</p>
          <p${editAttr} class="sig-fill sig-position js-position">${escapeForPrint(person.position || (editable ? "ตำแหน่ง" : ""))}</p>
          <p>${signedDate}</p>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeForPrint(title)}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            /* บน ขวา ล่าง ซ้าย -- ซ้าย 3 ซม. เผื่อขอบเย็บเล่มตามรูปแบบเอกสารราชการ */
            @page { size: A4; margin: 1.5cm 2cm 1.5cm 3cm; }
            body { font-family: Sarabun, sans-serif; color: #221530; margin: 0; padding: 24px; }
            h1 { font-size: 20px; text-align: center; margin: 0 0 4px; }
            .printed-at { text-align: center; color: #6b5c82; font-size: 13px; margin: 0 0 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
            th, td { border: 1px solid #cdb9ea; padding: 8px 10px; font-size: 14px; text-align: left; vertical-align: top; }
            th { background: #ece0f8; }
            .col-index { width: 60px; text-align: center; }
            .col-number { width: 120px; }
            [contenteditable="true"] { outline: 1px dashed #a877d6; outline-offset: 2px; min-height: 1.4em; }
            .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 48px; }
            .sig-block { flex: 1; text-align: center; font-size: 14px; line-height: 1.9; }
            .sig-line { white-space: nowrap; }
            .sig-fill { display: inline-block; min-width: 3em; }
            /* ดรอปดาวน์เลือกผู้ส่ง -- เครื่องมือกรอกฝั่งจอเท่านั้น ไม่ใช่ส่วนของ
               เอกสารที่พิมพ์ออกมา (ชื่อ/ตำแหน่งที่มันกรอกให้ต่างหากคือของจริง) */
            .sig-picker {
              display: block;
              width: 100%;
              max-width: 260px;
              margin: 2px auto 6px;
              font: inherit;
              font-size: 13px;
              padding: 5px 8px;
              border-radius: 6px;
              border: 1px solid #cdb9ea;
              background: #fff;
            }
            .actions { text-align: center; margin-top: 40px; }
            .actions button {
              font: inherit; font-size: 15px; font-weight: 600; padding: 12px 28px;
              border-radius: 10px; border: none; background: #57298c; color: #fff; cursor: pointer;
            }
            .actions p { color: #6b5c82; font-size: 13px; margin-top: 12px; }
            @media print {
              [contenteditable="true"] { outline: none; }
              .sig-picker { display: none; }
              .actions { display: none; }
              /* The on-screen padding would stack on top of the @page margins
                 and make the printed edges measure wider than specified. */
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>${escapeForPrint(title)}</h1>
          <p class="printed-at">วันที่และเวลาพิมพ์: ${escapeForPrint(formatThaiDateTime(printedAt))}</p>
          <table>
            <thead>
              <tr>
                <th class="col-index">ลำดับที่</th>
                ${columns.map(col => `<th${col.className ? ` class="${col.className}"` : ""}>${escapeForPrint(col.label)}</th>`).join("")}
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
          <div class="signatures">
            ${signatureBlock("ผู้ส่ง", sender, senderOptions)}
            ${signatureBlock("ผู้รับ", receiver)}
          </div>
          <div class="actions">
            <button type="button" id="confirmBtn">${escapeForPrint(actionLabel)}</button>
            <p>${escapeForPrint(actionNote)}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  /** Reads back whatever staff actually typed into the document before printing. */
  function readDispatchDocument(printWindow) {
    const doc = printWindow.document;
    const text = (el) => (el ? el.textContent.trim() : "");
    const [senderBlock, receiverBlock] = doc.querySelectorAll(".sig-block");
    const person = (block) => ({
      name: text(block && block.querySelector(".js-name")),
      // The placeholder is literal text in a contenteditable, not a real
      // placeholder attribute, so an untouched field still reads "ตำแหน่ง".
      position: text(block && block.querySelector(".js-position")) === "ตำแหน่ง"
        ? ""
        : text(block && block.querySelector(".js-position"))
    });

    const notes = Array.from(doc.querySelectorAll("tbody tr")).map(tr => {
      const cells = tr.querySelectorAll("td");
      return text(cells[cells.length - 1]);
    });

    return { sender: person(senderBlock), receiver: person(receiverBlock), notes };
  }

  /**
   * ผู้ส่งเริ่มต้น + รายชื่อทั้งหมดสำหรับดรอปดาวน์ผู้ส่งในเอกสารสมุดคุม -- ใช้
   * ร่วมกันทั้งสมุดมิเตอร์และสมุดคำร้องทั่วไป โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จก็ยัง
   * เปิดพิมพ์ได้ตามปกติ แค่ไม่มีดรอปดาวน์/ตำแหน่งอัตโนมัติให้ (สอดคล้องกับที่อื่น
   * ในแอปนี้ที่ยอมให้ข้อมูลเสริมหายไปเงียบ ๆ ดีกว่าบล็อกงานหลัก)
   */
  async function resolveSenderInfo() {
    const staff = actingStaff();
    let options = [];
    try {
      await refreshStaffRoster();
      options = staffRoster;
    } catch (err) {
      console.warn("CS Connect: โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ, ดรอปดาวน์ผู้ส่งจะไม่ขึ้น", err);
    }

    const match = options.find(p => p.email === staff.byEmail);
    return {
      sender: {
        name: match ? match.name : staff.byName,
        position: match ? (match.position || "") : "",
        email: staff.byEmail
      },
      senderOptions: options
    };
  }

  /**
   * ผูก listener ให้ดรอปดาวน์ผู้ส่ง (ถ้ามี) -- ต้องผูกจากฝั่งนี้ ไม่ใช่ inline
   * handler ในเอกสารที่พิมพ์ เพราะ CSP ของหน้าต่างที่เปิดด้วย window.open สืบทอด
   * นโยบายของหน้าที่เปิดมัน ซึ่งบล็อกสคริปต์ inline ทุกตัว เลือกแล้วเขียนชื่อ/
   * ตำแหน่งลงช่อง .js-name/.js-position ตรง ๆ -- readDispatchDocument() อ่านจาก
   * ช่องนั้นอยู่แล้วไม่ต้องแก้อะไรเพิ่ม และยังพิมพ์ทับเองได้ถ้าตำแหน่งในระบบไม่ตรง
   */
  function wireSenderPicker(printWindow, senderOptions) {
    const picker = printWindow.document.querySelector(".sig-picker");
    if (!picker) return;
    picker.addEventListener("change", () => {
      const block = picker.closest(".sig-block");
      const person = senderOptions.find(p => p.email === picker.value);
      block.querySelector(".js-name").textContent = person ? person.name : "";
      block.querySelector(".js-position").textContent = person ? (person.position || "") : "";
    });
  }

  /**
   * Opens a dispatch sheet for the checked records in a new tab -- editable in
   * place (contenteditable, not a separate form) so staff can fix a note or
   * fill in a name before it goes to a physical printer. Confirming prints
   * it, marks every record on it as dispatched, AND stores the book itself so
   * it can be found and reprinted later. There's no separate "save without
   * printing" path, since the point of this list is to hand it to the meter
   * department for signature, not to just record data.
   */
  async function openMeterDispatchPrint(records) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const sorted = records.slice().sort((a, b) => {
      return String(a.receivedDate || "").localeCompare(String(b.receivedDate || "")) ||
        String(a.trackingNumber || "").localeCompare(String(b.trackingNumber || ""));
    });

    const printedAt = Date.now();
    const rows = sorted.map((r, i) => ({
      position: i + 1,
      requestId: r.id,
      requestNumber: r.requestNumber || "",
      trackingNumber: r.trackingNumber || "",
      customerName: r.customerName || r.requesterName || "",
      purpose: r.purpose || "",
      note: r.note || ""
    }));

    const { sender, senderOptions } = await resolveSenderInfo();

    writeDispatchDocument(printWindow, {
      title: "สมุดคุมคำร้องส่งแผนกมิเตอร์",
      columns: METER_DISPATCH_PRINT_COLUMNS,
      rows,
      printedAt,
      sender,
      senderOptions,
      receiver: { name: "", position: "" },
      editable: true,
      actionLabel: "พิมพ์และยืนยันส่งแผนกมิเตอร์",
      actionNote: 'แก้ไขข้อความในตารางหรือช่องเซ็นชื่อได้ก่อนกดปุ่มนี้ -- กดแล้วจะเปลี่ยนสถานะคำร้องทั้งหมดด้านบนเป็น "ส่งแผนกมิเตอร์แล้ว" บันทึกสมุดเล่มนี้ไว้ให้ย้อนดูภายหลัง และเปิดหน้าต่างพิมพ์ทันที'
    });

    wireSenderPicker(printWindow, senderOptions);

    const confirmBtn = printWindow.document.getElementById("confirmBtn");
    const confirmNote = printWindow.document.querySelector(".actions p");
    confirmBtn.addEventListener("click", async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "กำลังบันทึก...";
      try {
        // Read the edits back out FIRST: what gets stored has to be what was
        // actually on the paper, notes and signatures included, or a reprint
        // won't match the copy the meter department signed.
        const edited = readDispatchDocument(printWindow);
        const finalRows = rows.map((row, i) => ({ ...row, note: edited.notes[i] ?? row.note }));

        // Clicking this button is the point of confirmation -- there is no
        // reliable way for a script to know whether the browser's own print
        // dialog was actually completed or cancelled afterward, so intent to
        // print (not confirmation the paper came out) is what the app can
        // act on, same as most "Send" buttons don't wait for delivery
        // confirmation before marking a message sent.
        await markRecordsDispatchedToMeter(sorted.map(r => r.id), {
          printedAt,
          rows: finalRows,
          sender: edited.sender,
          receiver: edited.receiver
        });

        confirmBtn.textContent = "บันทึกแล้ว กำลังเปิดหน้าต่างพิมพ์...";
        printWindow.print();
        confirmBtn.textContent = "บันทึกและพิมพ์เรียบร้อย";
        confirmNote.textContent = 'เปลี่ยนสถานะเป็น "ส่งแผนกมิเตอร์แล้ว" และเก็บสมุดเล่มนี้ไว้ในประวัติแล้ว ปิดหน้าต่างนี้ได้เลย';
      } catch (err) {
        console.error("CS Connect: บันทึกการส่งแผนกมิเตอร์ไม่สำเร็จ", err);
        confirmBtn.disabled = false;
        confirmBtn.textContent = "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
      }
    });
  }

  /**
   * Reopens a stored book for reprinting. Rendered from the snapshot rather
   * than from current request data, and locked (no contenteditable), because
   * this document has already been signed for -- a reprint that quietly
   * reflected later edits would not match the paper copy it is meant to
   * stand in for.
   */
  function openDispatchReprint(dispatch) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    writeDispatchDocument(printWindow, {
      title: "สมุดคุมคำร้องส่งแผนกมิเตอร์",
      columns: METER_DISPATCH_PRINT_COLUMNS,
      rows: Array.isArray(dispatch.rows) ? dispatch.rows : [],
      printedAt: dispatch.printedAt,
      sender: { name: dispatch.senderName, position: dispatch.senderPosition },
      receiver: { name: dispatch.receiverName, position: dispatch.receiverPosition },
      editable: false,
      actionLabel: "พิมพ์ซ้ำ",
      actionNote: "นี่คือสำเนาของสมุดที่พิมพ์ไปแล้ว จึงแก้ไขไม่ได้ เพื่อให้ตรงกับฉบับที่เซ็นรับไว้"
    });

    const reprintBtn = printWindow.document.getElementById("confirmBtn");
    reprintBtn.addEventListener("click", () => printWindow.print());
  }

  /**
   * เหมือน openMeterDispatchPrint/markRecordsDispatchedToMeter/openDispatchReprint
   * ด้านบนทุกกลไก (เลือกคำร้อง -> เปิดเอกสารแก้ไขได้ -> กดยืนยัน -> เปลี่ยนสถานะ +
   * เก็บสมุด + พิมพ์) เพียงแต่เป็นของคำร้องทั่วไปที่ต้องส่ง ผสน. ใช้เอกสารร่วม
   * (writeDispatchDocument/readDispatchDocument) ตัวเดียวกับมิเตอร์ เพราะส่วนที่
   * ต่างกันจริง ๆ มีแค่ title/columns/สถานะปลายทาง/ช่องพิเศษที่ต้องเติม (sentDate)
   */
  async function openGeneralDispatchPrint(records) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const sorted = records.slice().sort((a, b) => {
      return String(a.receivedDate || "").localeCompare(String(b.receivedDate || "")) ||
        String(a.subject || "").localeCompare(String(b.subject || ""));
    });

    const printedAt = Date.now();
    // ไม่เก็บ department ในสแนปช็อตแถว -- ไม่ได้ใช้ที่ไหนแล้วตั้งแต่ตัดคอลัมน์
    // แผนกที่รับผิดชอบออกจากตารางที่พิมพ์ (GENERAL_DISPATCH_PRINT_COLUMNS)
    const rows = sorted.map((r, i) => ({
      position: i + 1,
      requestId: r.id,
      subject: r.subject || "",
      customerName: r.customerName || "",
      note: r.note || ""
    }));

    const { sender, senderOptions } = await resolveSenderInfo();

    writeDispatchDocument(printWindow, {
      title: "สมุดคุมคำร้องทั่วไป",
      columns: GENERAL_DISPATCH_PRINT_COLUMNS,
      rows,
      printedAt,
      sender,
      senderOptions,
      receiver: { name: "", position: "" },
      editable: true,
      actionLabel: "พิมพ์และยืนยันส่ง ผสน.",
      actionNote: 'แก้ไขข้อความในตารางหรือช่องเซ็นชื่อได้ก่อนกดปุ่มนี้ -- กดแล้วจะเปลี่ยนสถานะคำร้องทั้งหมดด้านบนเป็น "ส่ง ผสน. แล้ว" พร้อมบันทึกวันที่ส่ง เก็บสมุดเล่มนี้ไว้ให้ย้อนดูภายหลัง และเปิดหน้าต่างพิมพ์ทันที'
    });

    wireSenderPicker(printWindow, senderOptions);

    const confirmBtn = printWindow.document.getElementById("confirmBtn");
    const confirmNote = printWindow.document.querySelector(".actions p");
    confirmBtn.addEventListener("click", async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "กำลังบันทึก...";
      try {
        const edited = readDispatchDocument(printWindow);
        const finalRows = rows.map((row, i) => ({ ...row, note: edited.notes[i] ?? row.note }));

        await markRecordsSentGeneral(sorted.map(r => r.id), {
          printedAt,
          rows: finalRows,
          sender: edited.sender,
          receiver: edited.receiver
        });

        confirmBtn.textContent = "บันทึกแล้ว กำลังเปิดหน้าต่างพิมพ์...";
        printWindow.print();
        confirmBtn.textContent = "บันทึกและพิมพ์เรียบร้อย";
        confirmNote.textContent = 'เปลี่ยนสถานะเป็น "ส่ง ผสน. แล้ว" และเก็บสมุดเล่มนี้ไว้ในประวัติแล้ว ปิดหน้าต่างนี้ได้เลย';
      } catch (err) {
        console.error("CS Connect: บันทึกการส่ง ผสน. ไม่สำเร็จ", err);
        confirmBtn.disabled = false;
        confirmBtn.textContent = "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
      }
    });
  }

  /** เหมือน openDispatchReprint ด้านบน แต่ของสมุดคุมคำร้องทั่วไป */
  function openGeneralDispatchReprint(dispatch) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    writeDispatchDocument(printWindow, {
      title: "สมุดคุมคำร้องทั่วไป",
      columns: GENERAL_DISPATCH_PRINT_COLUMNS,
      rows: Array.isArray(dispatch.rows) ? dispatch.rows : [],
      printedAt: dispatch.printedAt,
      sender: { name: dispatch.senderName, position: dispatch.senderPosition },
      receiver: { name: dispatch.receiverName, position: dispatch.receiverPosition },
      editable: false,
      actionLabel: "พิมพ์ซ้ำ",
      actionNote: "นี่คือสำเนาของสมุดที่พิมพ์ไปแล้ว จึงแก้ไขไม่ได้ เพื่อให้ตรงกับฉบับที่เซ็นรับไว้"
    });

    const reprintBtn = printWindow.document.getElementById("confirmBtn");
    reprintBtn.addEventListener("click", () => printWindow.print());
  }

  function buildLocationText(r) {
    if (r.district || r.subdistrict) {
      const parts = [
        r.houseNo ? `บ้านเลขที่ ${r.houseNo}` : "",
        r.moo ? `หมู่ ${r.moo}` : "",
        r.village ? `หมู่บ้าน${r.village}` : "",
        r.subdistrict || "",
        r.district || "",
        r.province || "",
        r.zipcode || ""
      ].filter(Boolean);
      return parts.join(" ");
    }
    return r.location || r.address || "";
  }

  /**
   * ต่อ statusHistory ก้อนใหม่เมื่อ jobStatus เปลี่ยนจริงเท่านั้น -- ใช้ร่วมกัน
   * ระหว่างการบันทึกแก้ไขรายเดี่ยวของทั้งฟอร์มขอใช้ไฟฟ้าและขอขยายเขตฯ (ไม่ใช้ใน
   * โหมดกลุ่ม ซึ่งเป็นการสร้างใหม่เสมอ ไม่มี prev ให้เทียบ)
   */
  function appendStatusHistoryIfChanged(prevHistory, prevStatus, jobStatus, byName, byEmail, at) {
    const statusHistory = Array.isArray(prevHistory) ? prevHistory.slice() : [];
    if (prevStatus !== jobStatus) {
      // A record that predates statusHistory has no trail yet -- seed it with
      // the status it was already on, un-attributed, so the chain still reads
      // correctly instead of starting at the new status.
      if (!statusHistory.length && prevStatus) {
        statusHistory.push({ status: prevStatus, byName: "", byEmail: "", at: null });
      }
      statusHistory.push({ status: jobStatus, byName, byEmail, at });
    }
    return statusHistory;
  }

  /**
   * เลขบอกประเภทคำร้อง 1 หลัก ที่คั่นระหว่างปีกับลำดับ
   *
   * ตั้งใจใช้ "ตัวเลข" ไม่ใช่ตัวอักษร (P/E) เพราะเลขนี้คือสิ่งที่ลูกค้าต้องพิมพ์
   * เองในหน้าติดตามสถานะ -- ตัวเลขล้วนพิมพ์บนแป้นตัวเลขได้รวดเดียว ไม่ต้องสลับ
   * แป้นไทย/อังกฤษกลางคัน ส่วนเจ้าหน้าที่จำกติกาเดียวนี้ได้ไม่ยาก และหน้าฟอร์ม
   * ก็เขียนกำกับไว้ให้แล้ว
   *
   * ประเภทใหม่ในอนาคตต่อเลขถัดไป และห้ามเปลี่ยนเลขเดิม -- เลขที่ออกไปแล้วอยู่บน
   * กระดาษที่ลูกค้าถืออยู่
   */
  const TRACKING_TYPE_CODES = {
    power: "1",
    extend: "2"
  };

  // System-issued tracking number: last 2 digits of the Buddhist Era year, one
  // type digit, then a 4-digit sequence starting at 0001 -- e.g. 6910001 for a
  // ขอใช้ไฟฟ้า request and 6920001 for a ขอขยายเขตฯ one. The sequence is derived
  // from existing records each time (not a stored counter), so it resets
  // naturally once no record carries that year+type prefix yet, and each type
  // gets its own run.
  //
  // Records issued before the type digit existed are 6 digits (`69xxxx`, all
  // ขอใช้ไฟฟ้า). They stay valid exactly as they are -- the number is printed on
  // paper the customer already holds, and every lookup is a plain string match.
  // The two shapes can never collide, since they differ in length.
  function generateTrackingNumbers(count, type) {
    const beYear = new Date().getFullYear() + 543;
    const yearPrefix = String(beYear % 100).padStart(2, "0");
    const prefix = `${yearPrefix}${TRACKING_TYPE_CODES[type] || TRACKING_TYPE_CODES.power}`;

    const maxSeq = getRequests()
      .map(r => r.trackingNumber)
      .filter(tn => typeof tn === "string" && tn.startsWith(prefix) && tn.length === 7)
      .map(tn => parseInt(tn.slice(3), 10))
      .filter(n => Number.isInteger(n))
      .reduce((max, n) => Math.max(max, n), 0);

    // The whole run is derived from one read of the cache. Calling the single
    // version in a loop would hand out the same number every time, since the
    // cache only learns about the new records after they are saved.
    return Array.from({ length: count }, (_, i) =>
      `${prefix}${String(maxSeq + 1 + i).padStart(4, "0")}`
    );
  }

  /**
   * เลข WBS ถัดไปของปี พ.ศ. ปัจจุบัน
   *
   * รูปแบบ C-<ปี พ.ศ. 2 หลัก>-A-HADSR.<ลำดับ 4 หลัก> และ **รันแยกตามปี**:
   * ขึ้นปีใหม่ ลำดับกลับไปเริ่มใหม่ เพราะไม่มีคำร้องไหนถือเลขขึ้นต้นปีใหม่มาก่อน
   *
   * ไล่หาเลขสูงสุดจากคำร้องที่โหลดมาแล้ว (แบบเดียวกับเลขที่คำร้องระบบ) ไม่ได้เก็บ
   * ตัวนับไว้ที่ไหน จึงเป็นแค่ "ค่าที่เดาให้" ไม่ใช่การจอง -- เจ้าหน้าที่แก้ทับได้
   * และถ้าสองคนกรอกพร้อมกันอาจได้เลขซ้ำ ซึ่งจะเห็นได้จากในชีต (ข้อจำกัดเดียวกับ
   * เลขที่คำร้องระบบ ยอมรับได้ที่ขนาดสำนักงานนี้)
   *
   * ยังไม่เคยมี WBS ของปีนี้เลย -> .0000 ตามที่ตกลงไว้
   */
  function wbsPrefix() {
    const beYear = new Date().getFullYear() + 543;
    return `C-${String(beYear % 100).padStart(2, "0")}-A-HADSR.`;
  }

  function nextWbs() {
    const prefix = wbsPrefix();

    const numbers = getRequests()
      .map(r => r.wbs)
      .filter(w => typeof w === "string" && w.startsWith(prefix))
      .map(w => parseInt(w.slice(prefix.length), 10))
      .filter(n => Number.isInteger(n));

    if (!numbers.length) return `${prefix}0000`;

    const max = numbers.reduce((a, b) => Math.max(a, b), 0);
    return `${prefix}${String(max + 1).padStart(4, "0")}`;
  }

  function generateTrackingNumber(type) {
    return generateTrackingNumbers(1, type)[0];
  }

  /**
   * Primary key for a new record. This used to be a bare `Date.now()`, which
   * collides whenever two staff save within the same millisecond -- and since
   * upsertAll_ matches rows by id, a collision meant one record silently
   * overwrote the other instead of both being kept. Checking the local cache
   * wouldn't help (neither browser knows about the other's brand-new record
   * yet), so the millisecond is widened with a random suffix instead: no
   * coordination needed, and a same-millisecond pair now has a 1-in-1000
   * chance of colliding rather than a certainty. Stays a plain integer
   * (NUMBER_COLUMNS in Code.gs requires it) and well inside
   * Number.MAX_SAFE_INTEGER.
   */
  function newRequestId() {
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
  }

  /**
   * `count` ids guaranteed distinct from each other. Ten independent calls to
   * newRequestId() inside one loop all land in the same millisecond, leaving
   * only the 1-in-1000 random suffix to separate them -- which by the birthday
   * bound collides about 4% of the time for a batch of ten. Since upsertAll_
   * matches rows by id, such a collision would silently drop a request from
   * the batch, so within a batch uniqueness is enforced rather than gambled
   * on. (Across batches the odds are unchanged, and unchanged from before.)
   */
  function newRequestIds(count) {
    const ids = [];
    const used = new Set();
    while (ids.length < count) {
      let id = newRequestId();
      while (used.has(id)) id += 1;
      used.add(id);
      ids.push(id);
    }
    return ids;
  }

  function showError(el, message) {
    el.textContent = message;
    el.hidden = false;
  }

  /**
   * เรียกเมื่อหลังบ้านตอบว่า AUTH_REQUIRED -- session หมดอายุหรือถูกยกเลิกไปแล้ว
   *
   * เดิมมีที่จัดการอยู่ที่เดียวคือ init() ตอนเปิดแอป ถ้า session หมดอายุ "ระหว่าง"
   * ใช้งาน (เปิดแท็บค้างข้ามคืนแล้วกดบันทึก) ฟอร์มจะขึ้นว่า "ไม่สามารถบันทึกคำร้อง
   * ได้ กรุณาลองใหม่อีกครั้ง" ซึ่งทำให้เข้าใจผิด -- กดใหม่กี่ครั้งก็ไม่มีทางสำเร็จ
   * และเจ้าหน้าที่ไม่รู้เลยว่าต้องล็อกอินใหม่ เสี่ยงกรอกฟอร์มทิ้งทั้งใบ
   *
   * เรื่องนี้สำคัญขึ้นมากตอนที่ SESSION_DAYS ลดจาก 7 เหลือ 3 เพราะโอกาสเจอถี่ขึ้น
   *
   * กันเรียกซ้ำด้วย authExpiredHandled เพราะการบันทึกครั้งเดียวอาจยิงหลายคำสั่ง
   * (เช่นบันทึกคำร้องแล้วตามด้วยบันทึกสมุดคุม) ซึ่งจะพากลับหน้า login ซ้อนกัน
   */
  let authExpiredHandled = false;

  function handleAuthExpired() {
    if (authExpiredHandled) return;
    authExpiredHandled = true;

    clearSession();
    requestsCache = [];
    dispatchesCache = [];
    generalDispatchesCache = [];
    clearSensitiveScreens();

    document.getElementById("bootOverlay").hidden = true;
    showView("login");
    showError(
      document.getElementById("loginError"),
      "เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่อีกครั้ง"
    );
  }

  /**
   * ข้อความที่เอาไปแสดงให้ผู้ใช้เห็นได้จริง
   *
   * ข้อความจากหลังบ้านเป็นภาษาไทยที่อ่านรู้เรื่องอยู่แล้วเกือบทั้งหมด ยกเว้นสอง
   * รหัสภายในที่ตั้งใจให้โค้ดตรวจจับ ไม่ได้ตั้งใจให้คนอ่าน -- ถ้าปล่อยผ่านไป
   * ผู้ใช้จะเห็นคำว่า AUTH_REQUIRED โด่ ๆ อยู่บนหน้าจอโดยไม่รู้ว่าต้องทำอะไร
   */
  const ERROR_MESSAGES = {
    AUTH_REQUIRED: "เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
    PASSWORD_CHANGE_REQUIRED: "กรุณาตั้งรหัสผ่านใหม่ของคุณเองก่อน จึงจะใช้งานระบบได้"
  };

  function friendlyError(err, fallback) {
    const message = String((err && err.message) || "");

    for (const code of Object.keys(ERROR_MESSAGES)) {
      if (message.includes(code)) return ERROR_MESSAGES[code];
    }

    return message || fallback;
  }

  function hideError(el) {
    el.hidden = true;
    el.textContent = "";
    // กล่องเดียวกันนี้ถูกยืมไปใช้แสดงข้อความยืนยัน (is-notice) ด้วยในบางที่ --
    // ถ้าไม่ล้างคลาสทิ้ง ความผิดพลาดครั้งถัดไปจะยังทาสีเป็นข้อความยืนยันอยู่
    el.classList.remove("is-notice");
  }

  /**
   * Auth calls hit the network and deliberately spend time hashing, so the
   * button has to say something and stop accepting a second click -- otherwise
   * an impatient double-submit fires two registrations.
   */
  function setBusy(button, busy, busyLabel) {
    if (!button) return;

    if (busy) {
      // จำข้อความเดิมเฉพาะตอนที่ยังไม่ได้อยู่ในสถานะทำงาน -- การเข้าสู่ระบบเรียก
      // ฟังก์ชันนี้สองครั้งซ้อน ("กำลังเข้าสู่ระบบ..." แล้วเปลี่ยนเป็น "กำลังโหลด
      // ข้อมูล...") ถ้าไม่กันไว้ ครั้งที่สองจะจำข้อความชั่วคราวว่าเป็นข้อความเดิม
      // แล้วปุ่มจะค้างที่ "กำลังเข้าสู่ระบบ..." ตลอดไปหลังคืนค่า
      if (!button.classList.contains("is-busy")) {
        button.dataset.idleLabel = button.textContent;
      }
      button.textContent = busyLabel || button.textContent;
      button.disabled = true;
      // เปลี่ยนโทนสีด้วย ไม่ใช่แค่จางลง -- ปุ่มที่จางอย่างเดียวดูเหมือน "กดไม่ได้"
      // มากกว่า "กำลังทำงานอยู่" ซึ่งคนละความหมายกันสำหรับคนที่กำลังรอ
      button.classList.add("is-busy");
    } else {
      if (button.dataset.idleLabel) button.textContent = button.dataset.idleLabel;
      button.disabled = false;
      button.classList.remove("is-busy");
    }
  }

  // ---------- login ----------
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(loginError);

    const submitBtn = loginForm.querySelector("button[type=submit]");

    try {
      const email = document.getElementById("loginEmail").value.trim().toLowerCase();
      const password = document.getElementById("loginPassword").value;
      const remember = document.getElementById("loginRemember").checked;

      if (!isValidEmail(email)) {
        showError(loginError, "กรุณากรอกอีเมลให้ถูกต้อง");
        return;
      }

      // Hashing runs server-side and takes a moment, so make the wait visible
      // and block a second submit rather than letting it look unresponsive.
      setBusy(submitBtn, true, "กำลังเข้าสู่ระบบ...");

      // The backend decides -- it never tells us whether it was the email or
      // the password that was wrong, and we pass that through unchanged.
      const user = await backend.login(email, password);

      setSession(user, remember);
      loginForm.reset();

      // บัญชีที่ใช้รหัสผ่านชั่วคราวยังโหลดข้อมูลไม่ได้ (loadRequests จะถูก
      // requirePasswordChanged_ ปฏิเสธ) จึงพาไปตั้งรหัสใหม่เลย ไม่ต้องเสียเวลา
      // ยิงคำสั่งที่รู้อยู่แล้วว่าจะล้ม
      if (user.mustChangePassword) {
        openAccountView(true);
        return;
      }

      // The token only exists now, so this is the first point at which the
      // request table can be fetched at all.
      setBusy(submitBtn, true, "กำลังโหลดข้อมูล...");
      await refreshAll();
      await migrateLocalDataOnce();
      updateTabBadges();

      enterApp();
    } catch (err) {
      console.error("CS Connect login error:", err);
      showError(loginError, friendlyError(err, "เกิดข้อผิดพลาด ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(submitBtn, false);
    }
  });

  document.getElementById("goToRegister").addEventListener("click", (e) => {
    e.preventDefault();
    hideError(loginError);
    showView("register");
  });

  // ---------- register ----------
  const registerForm = document.getElementById("registerForm");
  const registerError = document.getElementById("registerError");
  const registerSuccess = document.getElementById("registerSuccess");
  const registerSubmitBtn = registerForm.querySelector("button[type=submit]");

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(registerError);
    registerSuccess.hidden = true;

    try {
      const name = document.getElementById("regName").value.trim();
      const email = document.getElementById("regEmail").value.trim().toLowerCase();
      const position = document.getElementById("regPosition").value.trim();
      const password = document.getElementById("regPassword").value;
      const confirm = document.getElementById("regPasswordConfirm").value;
      const registrationCode = document.getElementById("regCode").value.trim();

      if (!name) {
        showError(registerError, "กรุณากรอกชื่อ - นามสกุล");
        return;
      }

      if (!isValidEmail(email)) {
        showError(registerError, "กรุณากรอกอีเมลให้ถูกต้อง");
        return;
      }

      if (!position) {
        showError(registerError, "กรุณากรอกตำแหน่ง");
        return;
      }

      // ต้องตรงกับ MIN_PASSWORD_LENGTH ใน Code.gs -- ที่นี่มีไว้บอกผู้ใช้ก่อนยิง
      // ไปเสียเที่ยว การบังคับจริงอยู่ฝั่งเซิร์ฟเวอร์ เพราะการเช็คตรงนี้ข้ามได้
      if (password.length < 10) {
        showError(registerError, "รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร");
        return;
      }

      if (password !== confirm) {
        showError(registerError, "รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
        return;
      }

      if (!registrationCode) {
        showError(registerError, "กรุณากรอกรหัสเชิญ (ขอจากผู้ดูแลระบบ)");
        return;
      }

      // The backend owns the duplicate-email check too -- checking here as
      // well would just be a second opinion that can race with another signup.
      // Checked server-side, not here: a check in this file would be trivially
      // bypassed, since anyone can call the endpoint directly. This only
      // carries the value.
      setBusy(registerSubmitBtn, true, "กำลังสมัครสมาชิก...");
      await backend.register({ name, email, position, password, registrationCode });

      registerForm.reset();
      // Not "กรุณาเข้าสู่ระบบ" -- the account can't log in yet. registerUser_
      // creates it as "pending" and emails the admin an approve/reject link;
      // login is blocked server-side until one of those is clicked.
      registerSuccess.textContent = "สมัครสมาชิกสำเร็จ ระบบได้ส่งคำขอไปให้ผู้ดูแลระบบอนุมัติแล้ว กรุณารอผลการอนุมัติทางอีเมล";
      registerSuccess.hidden = false;

      setTimeout(() => {
        registerSuccess.hidden = true;
        showView("login");
      }, 3500);
    } catch (err) {
      console.error("CS Connect register error:", err);
      showError(registerError, err.message || "เกิดข้อผิดพลาด ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(registerSubmitBtn, false);
    }
  });

  function backToLogin() {
    hideError(registerError);
    showView("login");
  }

  document.getElementById("goToLogin").addEventListener("click", (e) => {
    e.preventDefault();
    backToLogin();
  });

  document.getElementById("registerBackBtn").addEventListener("click", backToLogin);

  // ---------- home / logout ----------
  function enterApp() {
    const session = getSession();

    // ล็อกอินใหม่แล้ว = เริ่มนับใหม่ ไม่งั้นถ้าเซสชันหมดอายุอีกครั้งในรอบถัดไป
    // handleAuthExpired จะไม่ทำงาน เพราะธงยังค้างเป็น true จากรอบก่อน
    authExpiredHandled = false;

    // ปุ่มนี้เตะทุกคนออกรวมถึงตัวเอง จึงไม่ควรอยู่ในสายตาคนที่กดไม่ได้อยู่แล้ว
    document.getElementById("revokeAllBtn").hidden = !session?.isAdmin;

    const greeting = session?.name ? `สวัสดี, ${session.name}` : "";
    document.getElementById("userGreeting").textContent = greeting;
    document.getElementById("userGreeting2").textContent = greeting;
    document.getElementById("userGreeting3").textContent = greeting;
    document.getElementById("userGreeting4").textContent = greeting;
    showView("home");
  }

  /**
   * ล้างทุกอย่างบนหน้าจอที่เป็นของผู้ใช้คนก่อน -- เรียกตอนออกจากระบบ ตอนเซสชัน
   * หมดอายุ และตอนเตะทุกอุปกรณ์ออก
   *
   * สองกลุ่ม และสำคัญคนละแบบ:
   *
   * 1. รหัสผ่านชั่วคราวที่ผู้ดูแลระบบเพิ่งสุ่มให้คนอื่น -- ระบบไม่ได้เก็บไว้ที่ไหน
   *    เลยและตั้งใจให้เห็นครั้งเดียว ถ้าค้างอยู่ในหน้าที่แค่ซ่อนไว้ คนถัดไปที่
   *    ล็อกอินบนเครื่องเดียวกันกดกลับเข้ามาดูได้
   *
   * 2. ชื่อผู้ใช้บนแถบบนและปุ่มของผู้ดูแลระบบ -- เดิมไม่เคยถูกล้าง ทำให้หลังจาก
   *    ผู้ดูแลระบบออกจากระบบแล้วมีคนอื่นล็อกอินต่อบนเครื่องเดียวกัน หน้าแรกยัง
   *    ขึ้นชื่อผู้ดูแลระบบและยังโชว์ปุ่ม "ออกจากระบบทุกอุปกรณ์" อยู่ ซึ่งทำให้
   *    เข้าใจผิดว่ากำลังใช้งานด้วยบัญชีผู้ดูแลระบบ (สิทธิ์จริงไม่ได้หลุดตามไปด้วย
   *    เพราะฝั่งเซิร์ฟเวอร์ตัดสินจาก token เสมอ แต่หน้าจอที่โกหกก็อันตรายพอกัน)
   */
  function clearSensitiveScreens() {
    document.getElementById("tempPasswordValue").textContent = "";
    document.getElementById("tempPasswordEmail").textContent = "";
    document.getElementById("adminResetResult").hidden = true;
    document.getElementById("changePasswordForm").reset();
    document.getElementById("adminResetForm").reset();

    resetInvitePanel();
    resetRolesPanel();

    document.getElementById("revokeAllBtn").hidden = true;
    document.getElementById("userGreeting").textContent = "";
    document.getElementById("userGreeting2").textContent = "";
    document.getElementById("userGreeting3").textContent = "";
    document.getElementById("userGreeting4").textContent = "";

    clearWorkspaceScreens();
  }

  /**
   * ล้างข้อมูลลูกค้าที่ยัง "ค้างอยู่บนหน้าจอ" ออกให้หมดตอนออกจากระบบ
   *
   * การล้าง requestsCache อย่างเดียวไม่พอ -- มันแค่ทำให้ "การวาดครั้งต่อไป" ว่าง
   * แต่การ์ดที่วาดไปแล้วยังอยู่ใน DOM ครบทุกใบ พร้อมชื่อลูกค้า ที่อยู่ เบอร์โทร
   * และเลขที่โฉนด บนเครื่องที่ตอนนี้ขึ้นว่าออกจากระบบไปแล้ว ใครที่มานั่งต่อแล้ว
   * เปิดเครื่องมือพัฒนาของเบราว์เซอร์ก็อ่านได้ทั้งหมด
   *
   * ฟอร์มคำร้องก็เหมือนกัน -- ถ้ากรอกค้างไว้ครึ่งใบแล้วออกจากระบบ ข้อมูลลูกค้า
   * ที่พิมพ์ไว้ยังอยู่ในช่องกรอกทุกช่อง
   *
   * สถานะระดับโมดูล (editingId, batchMode, ...) ถูกตั้งใหม่อยู่แล้วตอนเปิด
   * workspace/ฟอร์มรอบหน้า แต่ล้างที่นี่ด้วยเพื่อไม่ให้ต้องไปพึ่งว่า "เดี๋ยวมีคน
   * ตั้งให้ทีหลัง" ซึ่งเป็นข้อสมมติที่พังง่ายเวลามีคนเพิ่มทางเข้าใหม่
   */
  function clearWorkspaceScreens() {
    document.getElementById("requestsList").innerHTML = "";
    document.getElementById("requestsSearchInput").value = "";

    document.getElementById("requestForm").reset();
    document.getElementById("requestFormError").hidden = true;
    document.getElementById("requestFormMeta").hidden = true;
    document.getElementById("requestFormStatusHistory").innerHTML = "";
    document.getElementById("requestFormComments").innerHTML = "";
    document.getElementById("requestFormSummary").hidden = true;
    document.getElementById("requestSummaryType").textContent = "";
    document.getElementById("requestSummaryList").innerHTML = "";
    document.getElementById("requestCommentInput").value = "";
    // #extendForm/#generalForm เก็บข้อมูลลูกค้าได้เหมือน #requestForm ข้างบน
    // ทุกประการ แต่ไม่เคยถูกล้างตรงนี้มาก่อน -- ค่าที่พิมพ์ค้างไว้จะยังอยู่ใน DOM
    // ทั้งที่จอกลับไปเป็นหน้า login แล้ว อ่านได้ทันทีผ่านเครื่องมือพัฒนาของ
    // เบราว์เซอร์โดยไม่ต้องล็อกอินเลยด้วยซ้ำ (ดูหมายเหตุที่ resetExtendFormState)
    resetExtendFormState();
    resetGeneralFormState();

    document.getElementById("batchRows").innerHTML = "";
    document.getElementById("batchResult").hidden = true;

    // แค็ตตาล็อกและชุดเซ็ตเป็นข้อมูลที่ดึงมาด้วย token ของคนที่เพิ่งออกจากระบบ
    // และชุดเซ็ตยังติดชื่อคนสร้างมาด้วย -- ทิ้งไปให้คนถัดไปดึงใหม่ด้วย token ของตัวเอง
    estimateCatalog = null;
    estimateKits = [];

    document.getElementById("extendWorkList").innerHTML = "";
    document.getElementById("extendWorkChips").innerHTML = "";
    document.getElementById("extendWorkSearch").value = "";
    document.getElementById("extendAssignBar").hidden = true;
    document.getElementById("extendAssignSuccess").hidden = true;

    editingId = null;
    pendingNewId = null;
    summaryRecord = null;
    batchMode = false;
    formReturnTo = "requests";
    currentSearchQuery = "";
    meterSelection.clear();
    generalSelection.clear();
    extendSelection.clear();
    extendSearchQuery = "";
    extendFilter = EXTEND_FILTER_ALL;
    // รายชื่อเจ้าหน้าที่เป็นข้อมูลส่วนบุคคลของคนอื่น ไม่ควรค้างอยู่ในหน้าที่
    // ตอนนี้อ่านว่าออกจากระบบไปแล้ว
    staffRoster = [];

    // เคลียร์สำเนาที่ backend เก็บไว้เทียบว่าอะไรเปลี่ยนบ้าง -- เป็น JSON ของ
    // คำร้องทุกใบ ไม่ควรค้างอยู่หลังผู้ใช้ออกจากระบบไปแล้ว
    backend.forgetCached?.();
  }

  function logout() {
    // Revoke server-side too, so a copied token can't outlive the sign-out.
    // Fire and forget: the local session goes regardless of whether the call
    // lands, and a stranded token expires on its own.
    const token = getSession()?.token;
    if (token) backend.logout(token).catch(err => console.warn("CS Connect logout:", err));

    clearSession();
    requestsCache = [];
    dispatchesCache = [];
    generalDispatchesCache = [];
    clearSensitiveScreens();
    showView("login");
  }


  // ---------- บัญชีของฉัน ----------
  const accountView = {
    changeForm: document.getElementById("changePasswordForm"),
    changeError: document.getElementById("changePasswordError"),
    changeSuccess: document.getElementById("changePasswordSuccess"),
    adminSection: document.getElementById("adminResetSection"),
    adminForm: document.getElementById("adminResetForm"),
    adminError: document.getElementById("adminResetError"),
    adminResult: document.getElementById("adminResetResult"),
    forceNotice: document.getElementById("forcePasswordNotice"),
    backRow: document.getElementById("accountBackRow"),
    backupSection: document.getElementById("adminBackupSection"),
    backupError: document.getElementById("adminBackupError"),
    backupResult: document.getElementById("adminBackupResult"),
    inviteSection: document.getElementById("adminInviteSection"),
    inviteStatus: document.getElementById("inviteStatusLine"),
    inviteBox: document.getElementById("inviteCodeBox"),
    inviteValue: document.getElementById("inviteCodeValue"),
    inviteCountdown: document.getElementById("inviteCountdown"),
    inviteRevokeBtn: document.getElementById("inviteRevokeBtn"),
    inviteError: document.getElementById("inviteError"),
    rolesSection: document.getElementById("adminRolesSection"),
    rolesCurrent: document.getElementById("adminRolesCurrent"),
    roleUser: document.getElementById("adminRoleUser"),
    rolesError: document.getElementById("adminRolesError"),
    rolesResult: document.getElementById("adminRolesResult")
  };

  /**
   * เปิดหน้าบัญชีแบบสะอาดทุกครั้ง -- โดยเฉพาะ adminResult ที่ถือรหัสผ่านชั่วคราว
   * อยู่ ถ้าไม่ล้าง รหัสของคนก่อนหน้าจะค้างอยู่บนจอให้คนถัดไปที่เดินผ่านเห็นได้
   */
  function openAccountView(forced) {
    const session = getSession();

    accountView.changeForm.reset();
    hideError(accountView.changeError);
    accountView.changeSuccess.hidden = true;

    accountView.adminForm.reset();
    hideError(accountView.adminError);
    accountView.adminResult.hidden = true;
    document.getElementById("tempPasswordValue").textContent = "";
    document.getElementById("tempPasswordEmail").textContent = "";

    // บัญชีที่ยังติดรหัสชั่วคราวยังทำอะไรกับข้อมูลไม่ได้ จึงไม่มีเหตุให้เห็น
    // เครื่องมือของผู้ดูแลระบบ และไม่ควรมีทางออกจากหน้านี้นอกจากตั้งรหัสใหม่
    const mustChange = Boolean(forced || session?.mustChangePassword);

    accountView.adminSection.hidden = !session?.isAdmin || mustChange;
    accountView.backupSection.hidden = !session?.isAdmin || mustChange;
    hideError(accountView.backupError);
    accountView.backupResult.hidden = true;

    accountView.inviteSection.hidden = !session?.isAdmin || mustChange;
    resetInvitePanel();
    if (session?.isAdmin && !mustChange) refreshInviteStatus();

    accountView.rolesSection.hidden = !session?.isAdmin || mustChange;
    resetRolesPanel();
    if (session?.isAdmin && !mustChange) refreshRolesPanel();
    accountView.forceNotice.hidden = !mustChange;
    accountView.backRow.hidden = mustChange;
    // ปุ่มมุมซ้ายบนต้องหายไปพร้อมกัน ไม่งั้นด่านบังคับตั้งรหัสใหม่มีทางออก
    document.getElementById("accountBackBtn").hidden = mustChange;

    showView("account");
  }

  document.getElementById("accountBtn").addEventListener("click", () => openAccountView(false));

  // ต้องผ่าน enterApp() เหมือนลิงก์ด้านล่าง ไม่ใช่ showView("home") ตรง ๆ
  document.getElementById("accountBackBtn").addEventListener("click", enterApp);

  document.getElementById("accountBackLink").addEventListener("click", (e) => {
    e.preventDefault();
    // ต้องผ่าน enterApp() ไม่ใช่ showView("home") ตรง ๆ -- enterApp() เป็นที่เดียว
    // ที่เขียนชื่อผู้ใช้บนแถบบนและตัดสินว่าปุ่มของผู้ดูแลระบบควรโผล่ไหม ถ้าข้ามไป
    // หน้าแรกจะยังโชว์ชื่อของคนที่ใช้เครื่องนี้ก่อนหน้า
    enterApp();
  });

  accountView.changeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(accountView.changeError);
    accountView.changeSuccess.hidden = true;

    const submitBtn = accountView.changeForm.querySelector("button[type=submit]");

    try {
      const currentPassword = document.getElementById("currentPassword").value;
      const newPassword = document.getElementById("newPassword").value;
      const confirmPassword = document.getElementById("newPasswordConfirm").value;

      if (!currentPassword) {
        showError(accountView.changeError, "กรุณากรอกรหัสผ่านปัจจุบัน");
        return;
      }

      // ต้องตรงกับ MIN_PASSWORD_LENGTH ใน Code.gs -- ที่นี่มีไว้บอกผู้ใช้ก่อนยิง
      // ไปเสียเที่ยว การบังคับจริงอยู่ฝั่งเซิร์ฟเวอร์
      if (newPassword.length < 10) {
        showError(accountView.changeError, "รหัสผ่านใหม่ต้องมีอย่างน้อย 10 ตัวอักษร");
        return;
      }

      if (newPassword !== confirmPassword) {
        showError(accountView.changeError, "รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
        return;
      }

      if (newPassword === currentPassword) {
        showError(accountView.changeError, "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม");
        return;
      }

      // แฮชสองรอบฝั่งเซิร์ฟเวอร์ (ตรวจของเดิม + สร้างของใหม่) จึงนานกว่าล็อกอิน
      setBusy(submitBtn, true, "กำลังเปลี่ยนรหัสผ่าน...");
      const result = await backend.changePassword(currentPassword, newPassword);

      accountView.changeForm.reset();

      const revoked = Number(result?.otherSessionsRevoked) || 0;
      accountView.changeSuccess.textContent = revoked
        ? `เปลี่ยนรหัสผ่านเรียบร้อยแล้ว และออกจากระบบให้อีก ${revoked} อุปกรณ์`
        : "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว";
      accountView.changeSuccess.hidden = false;

      // ปลดล็อกบัญชีที่เพิ่งใช้รหัสชั่วคราว -- ฝั่งเซิร์ฟเวอร์ล้าง flag ทั้งในแถว
      // ผู้ใช้และใน session ที่ยังใช้อยู่ไปแล้ว ตรงนี้แค่ทำให้หน้าจอตรงกัน
      const session = getSession();
      if (session?.mustChangePassword) {
        session.mustChangePassword = false;
        setSession(session, sessionIsRemembered());
        accountView.forceNotice.hidden = true;
        accountView.backRow.hidden = false;
        document.getElementById("accountBackBtn").hidden = false;
        accountView.adminSection.hidden = !session.isAdmin;
        accountView.backupSection.hidden = !session.isAdmin;
        accountView.inviteSection.hidden = !session.isAdmin;
        accountView.rolesSection.hidden = !session.isAdmin;
        if (session.isAdmin) {
          refreshInviteStatus();
          refreshRolesPanel();
        }

        // ตอนล็อกอิน บัญชีนี้ถูกพามาที่นี่โดยไม่ได้โหลดข้อมูลเลย (loadRequests
        // จะถูกปฏิเสธอยู่แล้ว) ตอนนี้ผ่านด่านแล้วจึงต้องโหลด ไม่งั้นกดกลับหน้าแรก
        // ไปจะเจอรายการคำร้องว่างเปล่าทั้งที่ข้อมูลมีอยู่
        try {
          await refreshAll();
          updateTabBadges();

          // ตั้งรหัสใหม่เสร็จ = ผ่านด่านแล้ว พาเข้าหน้าใช้งานเลย การค้างอยู่หน้า
          // เดิมทำให้ไม่รู้ว่าสำเร็จหรือยัง และเป็นสิ่งที่ผู้ใช้ต้องเดาเอง
          enterApp();
        } catch (loadErr) {
          // โหลดข้อมูลไม่ผ่าน = ยังไม่พาเข้าหน้าใช้งาน เพราะจะเจอรายการว่างเปล่า
          // โดยไม่รู้สาเหตุ -- อยู่หน้านี้ต่อพร้อมข้อความบอกดีกว่า
          console.error("CS Connect: โหลดข้อมูลหลังเปลี่ยนรหัสผ่านไม่สำเร็จ", loadErr);
          accountView.changeSuccess.textContent +=
            " (โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าเว็บอีกครั้ง)";
        }
      }
    } catch (err) {
      console.error("CS Connect change password error:", err);
      showError(accountView.changeError, err.message || "เกิดข้อผิดพลาด ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(submitBtn, false);
    }
  });

  /**
   * รหัสเชิญ: ใช้ได้ครั้งเดียว หมดอายุใน 5 นาที
   *
   * นับถอยหลังบนหน้าจอเพราะอายุสั้นมาก -- ผู้ดูแลระบบต้องรู้ว่าเหลือเวลาให้เจ้าตัว
   * พิมพ์อีกเท่าไร ไม่ใช่มารู้ตอนที่เขากดสมัครแล้วไม่ผ่าน
   */
  let inviteTicker = null;

  function stopInviteTicker() {
    if (inviteTicker) {
      clearInterval(inviteTicker);
      inviteTicker = null;
    }
  }

  /** ล้างทุกอย่างที่แสดงรหัสอยู่ -- ตัวรหัสเป็นความลับเหมือนรหัสผ่านชั่วคราว */
  function resetInvitePanel() {
    stopInviteTicker();
    accountView.inviteValue.textContent = "";
    accountView.inviteCountdown.textContent = "";
    accountView.inviteBox.hidden = true;
    accountView.inviteRevokeBtn.hidden = true;
    accountView.inviteStatus.textContent = "";
    hideError(accountView.inviteError);
  }

  function renderInviteStatus(status) {
    stopInviteTicker();
    hideError(accountView.inviteError);

    accountView.inviteBox.hidden = status.state !== "active";
    accountView.inviteRevokeBtn.hidden = status.state !== "active";

    if (status.state === "active") {
      accountView.inviteValue.textContent = status.code;
      accountView.inviteStatus.textContent = "รหัสนี้ใช้สมัครได้ 1 บัญชี";

      const tick = () => {
        const left = Math.max(0, status.expiresAt - Date.now());
        if (left <= 0) {
          // หมดอายุระหว่างเปิดหน้าค้างไว้ -- ถามสถานะจริงจากเซิร์ฟเวอร์อีกครั้ง
          // แทนที่จะเดาเอง เผื่อมีคนเพิ่งใช้รหัสนี้ไปพอดี
          refreshInviteStatus();
          return;
        }
        const mm = Math.floor(left / 60000);
        const ss = Math.floor((left % 60000) / 1000);
        accountView.inviteCountdown.textContent = `หมดอายุใน ${mm}:${String(ss).padStart(2, "0")} นาที`;
      };

      tick();
      inviteTicker = setInterval(tick, 1000);
      return;
    }

    if (status.state === "used") {
      accountView.inviteStatus.textContent = status.usedByEmail
        ? `รหัสล่าสุดถูกใช้ไปแล้ว (${status.usedByEmail}) — ขณะนี้ปิดรับสมัคร`
        : "รหัสล่าสุดถูกใช้ไปแล้ว — ขณะนี้ปิดรับสมัคร";
      return;
    }

    if (status.state === "expired") {
      accountView.inviteStatus.textContent = "รหัสล่าสุดหมดอายุแล้ว — ขณะนี้ปิดรับสมัคร";
      return;
    }

    // ยังไม่เคยสร้างรหัสจากหน้านี้เลย
    accountView.inviteStatus.textContent = status.usingFallback
      ? "ยังใช้รหัสเชิญตั้งต้นที่ตั้งไว้ในระบบอยู่ — กดสร้างเพื่อเปลี่ยนมาใช้รหัสครั้งเดียวแทน"
      : "ขณะนี้ปิดรับสมัครสมาชิก";
  }

  async function refreshInviteStatus() {
    try {
      renderInviteStatus(await backend.getInviteCode());
    } catch (err) {
      console.error("CS Connect invite status error:", err);
      stopInviteTicker();
      showError(accountView.inviteError, friendlyError(err, "อ่านสถานะรหัสเชิญไม่สำเร็จ"));
    }
  }

  document.getElementById("inviteCreateBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    hideError(accountView.inviteError);
    setBusy(btn, true, "กำลังสร้าง...");
    try {
      renderInviteStatus(await backend.createInviteCode());
    } catch (err) {
      console.error("CS Connect invite create error:", err);
      showError(accountView.inviteError, friendlyError(err, "สร้างรหัสเชิญไม่สำเร็จ"));
    } finally {
      setBusy(btn, false);
    }
  });

  accountView.inviteRevokeBtn.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    hideError(accountView.inviteError);
    setBusy(btn, true, "กำลังยกเลิก...");
    try {
      renderInviteStatus(await backend.revokeInviteCode());
    } catch (err) {
      console.error("CS Connect invite revoke error:", err);
      showError(accountView.inviteError, friendlyError(err, "ยกเลิกรหัสเชิญไม่สำเร็จ"));
    } finally {
      setBusy(btn, false);
    }
  });

  /**
   * สิทธิ์หัวหน้างาน -- คนที่จ่ายงานขอขยายเขตฯ ให้พนักงานในแผนกได้
   *
   * แผงนี้เป็นแค่หน้าจอ การตัดสินสิทธิ์จริงอยู่ฝั่งเซิร์ฟเวอร์ทั้งหมด และตรวจใหม่
   * ทุกครั้งที่มีการสั่งจ่ายงาน
   */
  function resetRolesPanel() {
    accountView.rolesCurrent.textContent = "";
    accountView.roleUser.innerHTML = '<option value="">-- เลือกบัญชี --</option>';
    accountView.rolesResult.hidden = true;
    hideError(accountView.rolesError);
  }

  function renderRolesPanel() {
    const supervisors = staffRoster.filter(p => p.isSupervisor);
    accountView.rolesCurrent.textContent = supervisors.length
      ? `หัวหน้างานปัจจุบัน: ${supervisors.map(p => p.name || p.email).join(", ")}`
      : "ยังไม่มีหัวหน้างาน";

    const previous = accountView.roleUser.value;
    accountView.roleUser.innerHTML = '<option value="">-- เลือกบัญชี --</option>';

    staffRoster.forEach(person => {
      const option = document.createElement("option");
      option.value = person.email;
      // ต่อท้ายว่าเป็นอะไรอยู่ตอนนี้ ไม่งั้นต้องเดาว่ากดปุ่มไหนถึงจะถูก
      const tag = person.isAdmin ? " — ผู้ดูแลระบบ" : (person.isSupervisor ? " — หัวหน้างาน" : "");
      option.textContent = `${person.name || person.email}${tag}`;
      accountView.roleUser.appendChild(option);
    });

    if (previous && staffRoster.some(p => p.email === previous)) {
      accountView.roleUser.value = previous;
    }
  }

  async function refreshRolesPanel() {
    try {
      await refreshStaffRoster();
      renderRolesPanel();
    } catch (err) {
      console.error("CS Connect roles panel error:", err);
      showError(accountView.rolesError, friendlyError(err, "โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ"));
    }
  }

  async function changeUserRole(button, role) {
    hideError(accountView.rolesError);
    accountView.rolesResult.hidden = true;

    const email = accountView.roleUser.value;
    if (!email) {
      showError(accountView.rolesError, "กรุณาเลือกบัญชีก่อน");
      return;
    }

    setBusy(button, true, "กำลังบันทึก...");

    try {
      await backend.setUserRole(email, role);
      await refreshStaffRoster();
      renderRolesPanel();

      const person = staffRoster.find(p => p.email === email);
      const who = person ? (person.name || person.email) : email;
      accountView.rolesResult.textContent = role === "supervisor"
        ? `ตั้ง ${who} เป็นหัวหน้างานแล้ว`
        : `ยกเลิกสิทธิ์หัวหน้างานของ ${who} แล้ว`;
      accountView.rolesResult.hidden = false;
    } catch (err) {
      console.error("CS Connect set role error:", err);
      showError(accountView.rolesError, friendlyError(err, "เปลี่ยนสิทธิ์ไม่สำเร็จ"));
    } finally {
      setBusy(button, false);
    }
  }

  document.getElementById("adminRoleGrantBtn")
    .addEventListener("click", (e) => changeUserRole(e.currentTarget, "supervisor"));

  document.getElementById("adminRoleRevokeBtn")
    .addEventListener("click", (e) => changeUserRole(e.currentTarget, ""));

  /**
   * ดึงข้อมูลทั้งระบบออกมาเป็นไฟล์ให้ผู้ดูแลระบบเก็บไว้เอง
   *
   * มีไว้เพราะเดิมการสำรองข้อมูลทำได้ทางเดียวคือเปิด Apps Script แล้วสั่ง
   * backupNow -- ซึ่งใช้ไม่ได้เลยในวันที่ Google Drive เองเปิดไม่ขึ้น ทั้งที่
   * ข้อมูลยังอ่านผ่าน Web App ได้ตามปกติ ปุ่มนี้จึงเป็นทางออกสำรองที่ไม่ต้อง
   * พึ่งหน้าจอของ Google เลย
   *
   * ไฟล์ถูกสร้างในเบราว์เซอร์แล้วให้ดาวน์โหลด ไม่ได้ไปเก็บบน Drive -- จุดสำคัญ
   * คือได้สำเนาที่อยู่ "นอก" ระบบที่กำลังมีปัญหา
   */
  document.getElementById("adminBackupBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    hideError(accountView.backupError);
    accountView.backupResult.hidden = true;

    setBusy(btn, true, "กำลังดึงข้อมูล...");

    try {
      const data = await backend.exportAll();

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `csconnect-backup-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // ปล่อยหน่วยความจำคืน หลังเบราว์เซอร์เริ่มดาวน์โหลดแล้ว
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      const counts = [
        `คำร้อง ${(data.requests || []).length}`,
        `สมุดคุม ${(data.meterDispatches || []).length}`,
        `ผู้ใช้ ${(data.users || []).length}`
      ].join(" · ");
      accountView.backupResult.textContent = `ดาวน์โหลดแล้ว (${counts})`;
      accountView.backupResult.hidden = false;
    } catch (err) {
      console.error("CS Connect backup error:", err);
      showError(accountView.backupError, friendlyError(err, "ดึงข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(btn, false);
    }
  });

  accountView.adminForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(accountView.adminError);
    accountView.adminResult.hidden = true;

    const submitBtn = accountView.adminForm.querySelector("button[type=submit]");

    try {
      const email = document.getElementById("resetEmail").value.trim().toLowerCase();

      if (!isValidEmail(email)) {
        showError(accountView.adminError, "กรุณากรอกอีเมลให้ถูกต้อง");
        return;
      }

      const ok = window.confirm(
        `ยืนยันตั้งรหัสผ่านชั่วคราวให้ ${email}?\n\n` +
        "รหัสผ่านเดิมของผู้ใช้รายนี้จะใช้ไม่ได้อีก และเขาจะหลุดจากทุกอุปกรณ์ทันที"
      );
      if (!ok) return;

      setBusy(submitBtn, true, "กำลังสุ่มรหัสผ่าน...");
      const result = await backend.adminResetPassword(email);

      accountView.adminForm.reset();
      document.getElementById("tempPasswordEmail").textContent = result.email;
      document.getElementById("tempPasswordValue").textContent = result.tempPassword;
      accountView.adminResult.hidden = false;
    } catch (err) {
      console.error("CS Connect admin reset error:", err);
      showError(accountView.adminError, err.message || "เกิดข้อผิดพลาด ไม่สามารถตั้งรหัสผ่านชั่วคราวได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(submitBtn, false);
    }
  });

  /**
   * เตะทุก session ออกทั้งระบบ -- ใช้ตอนสงสัยว่า token หลุด หรือเครื่องที่ล็อกอิน
   * ค้างไว้หาย เดิมทำได้ทางเดียวคือเปิด Apps Script editor แล้วกด Run ซึ่งเป็น
   * สิ่งที่ทำได้ยากที่สุดในนาทีที่จำเป็นต้องใช้จริง
   *
   * ใช้ confirm() ของเบราว์เซอร์ ทั้งที่ที่อื่นในโปรเจกต์ไม่ได้ใช้เลย -- เพราะ
   * คำสั่งนี้ทำให้ทุกคนหยุดงานทันที การถามด้วยกล่องที่กดพลาดไม่ได้จึงเหมาะกว่า
   * การสร้าง modal สวย ๆ ที่กดผ่านโดยไม่ทันอ่าน
   */
  async function revokeAllSessions() {
    const ok = window.confirm(
      "ยืนยันออกจากระบบทุกอุปกรณ์?\n\n" +
      "เจ้าหน้าที่ทุกคนที่กำลังใช้งานอยู่จะหลุดจากระบบทันที และต้องเข้าสู่ระบบใหม่ทั้งหมด " +
      "รวมถึงตัวคุณเองด้วย"
    );
    if (!ok) return;

    const btn = document.getElementById("revokeAllBtn");
    setBusy(btn, true, "กำลังดำเนินการ...");

    try {
      await backend.revokeAllSessions();
      // token ของตัวเองก็ตายไปแล้วเช่นกัน จึงต้องกลับหน้า login เหมือนคนอื่น
      // ไม่ใช่แค่แสดงข้อความค้างอยู่บนหน้าที่เรียกข้อมูลอะไรไม่ได้แล้ว
      clearSession();
      requestsCache = [];
      dispatchesCache = [];
      generalDispatchesCache = [];
      clearSensitiveScreens();
      showView("login");
      showError(
        document.getElementById("loginError"),
        "ออกจากระบบทุกอุปกรณ์เรียบร้อยแล้ว กรุณาเข้าสู่ระบบใหม่"
      );
    } catch (err) {
      console.error("CS Connect revokeAllSessions error:", err);
      window.alert("ไม่สำเร็จ: " + (err.message || "ไม่สามารถออกจากระบบทุกอุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(btn, false);
    }
  }

  document.getElementById("revokeAllBtn").addEventListener("click", revokeAllSessions);
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("logoutBtn2").addEventListener("click", logout);
  document.getElementById("logoutBtn3").addEventListener("click", logout);
  document.getElementById("logoutBtn4").addEventListener("click", logout);

  // ---------- service cards ----------
  document.querySelectorAll(".service-card").forEach(card => {
    card.addEventListener("click", () => {
      const key = card.dataset.service;

      if (key === "requests") {
        openRequestsView();
        return;
      }

      // การ์ดนี้เคยเป็นหน้าว่างรอพัฒนา ตอนนี้เป็นคิวงานจริงของแผนก
      if (key === "extend") {
        openExtendWorkView();
        return;
      }

      const service = SERVICES[key];
      if (!service) return;

      document.getElementById("serviceTopbarTitle").textContent = service.title;
      document.getElementById("serviceTitle").textContent = service.title;
      document.getElementById("serviceDesc").textContent = service.desc;
      document.getElementById("servicePlaceholderIcon").innerHTML = service.icon;

      showView("service");
    });
  });

  // ทุกปุ่ม "กลับหน้าแรก" ผ่าน enterApp() เหมือนกันหมด เพื่อให้มีทางเข้าหน้าแรก
  // ทางเดียว และชื่อผู้ใช้บนแถบบนตรงกับ session ปัจจุบันเสมอ
  document.getElementById("backBtn").addEventListener("click", enterApp);
  document.getElementById("backToHomeBtn").addEventListener("click", enterApp);
  // ปุ่มย้อนกลับบนแถบบนของ workspace ถอยทีละขั้น: จากฟอร์มกลับไปที่รายการก่อน
  // แล้วค่อยจากรายการออกไปหน้าแรก -- เดิมกระโดดออกไปหน้าแรกทีเดียวจากในฟอร์ม
  // ซึ่งทิ้งสิ่งที่กำลังกรอกโดยไม่ได้พาไปที่ที่ผู้ใช้คาดว่าจะกลับไป
  document.getElementById("requestsBackBtn").addEventListener("click", () => {
    if (!requestsFormMode.hidden) {
      leaveRequestForm();
      return;
    }
    enterApp();
  });

  document.getElementById("requestFormBackBtn").addEventListener("click", leaveRequestForm);

  /**
   * ออกจากฟอร์มคำร้องกลับไปที่ "ที่ที่เปิดฟอร์มมา"
   *
   * ฟอร์มขอขยายเขตฯ ถูกเปิดได้จากสองที่ -- รายการในหน้ารับคำร้อง และคิวงานใน
   * หน้างานขอขยายเขตฯ การพากลับไปที่รายการเสมอทำให้คนที่มาจากคิวงานหลุดไปอยู่
   * อีกโมดูลหนึ่งโดยไม่ได้ตั้งใจ และต้องเดินกลับมาเองทุกครั้งที่แก้เสร็จหนึ่งใบ
   */
  function leaveRequestForm() {
    // ฟอร์มขอขยายเขตฯ ถูกย้ายไปอยู่ในโมดูลของมัน -- ต้องปิดหน้ารายละเอียดก่อน
    extendDetailMode.hidden = true;
    extendWorkListMode.hidden = false;

    if (formReturnTo === "extendWork") {
      // keepView: กลับมาที่ชิปและคำค้นเดิม ไม่ใช่รีเซ็ตเป็น "ทั้งหมด" ทุกครั้ง
      openExtendWorkView({ keepView: true });
      return;
    }

    // มาจากหน้างานรับคำร้อง -- ต้องพากลับไปที่หน้านั้นด้วย ไม่ใช่แค่วาดรายการใหม่
    // (ฟอร์มขอขยายเขตฯ ถูกย้ายไปแสดงในอีกโมดูลหนึ่ง หน้าจอจึงไม่ได้อยู่ที่เดิมแล้ว)
    showView("requests");
    renderRequestsList();
  }

  // ---------- requests workspace ----------
  const requestsListMode = document.getElementById("requestsListMode");
  const requestsFormMode = document.getElementById("requestsFormMode");
  const requestsList = document.getElementById("requestsList");
  const requestsListTitle = document.getElementById("requestsListTitle");
  const requestsListCount = document.getElementById("requestsListCount");
  const requestsAddBtn = document.getElementById("requestsAddBtn");
  const requestsAddBatchBtn = document.getElementById("requestsAddBatchBtn");
  const meterPrintBtn = document.getElementById("meterPrintBtn");
  const meterModes = document.getElementById("meterModes");
  const meterModeBtns = meterModes.querySelectorAll(".requests-mode-btn");

  const generalPrintBtn = document.getElementById("generalPrintBtn");
  const generalModes = document.getElementById("generalModes");
  const generalModeBtns = generalModes.querySelectorAll(".requests-mode-btn");
  const requestsSearchInput = document.getElementById("requestsSearchInput");
  const navBadges = document.querySelectorAll(".nav-badge");

  // แจ้งเตือนการรับชำระเงิน isn't its own data -- it's ขอใช้ไฟฟ้า records still
  // marked รอชำระเงิน that already have a slip on file, i.e. payments
  // awaiting staff to check and confirm themselves. Once staff change
  // jobStatus away from รอชำระเงิน (e.g. to ชำระเงินแล้ว), the record drops
  // out of this list on its own -- there's no separate "resolved" flag.
  function isPaymentNotice(r) {
    return r.type === "power" && r.jobStatus === "รอชำระเงิน" && Boolean(r.paymentSlip);
  }

  // คุมคำร้องส่งแผนกมิเตอร์ is likewise a view, not a type: ขอใช้ไฟฟ้า records
  // whose payment side is settled (paid, or nothing to pay) and so are ready
  // to hand over to the meter department.
  /**
   * สถานะที่ถือว่า "พร้อมส่งแผนกมิเตอร์"
   *
   * สองตัวแรกคือคำร้องที่เรื่องเงินจบแล้ว ส่วน "ผมต. ตีกลับ" คือคำร้องที่ส่งไป
   * แล้วแต่ถูกตีกลับมา จึงต้องกลับเข้าคิวส่งใหม่ ไม่ต่างจากคำร้องที่เพิ่งพร้อมส่ง
   *
   * ทั้งสามตัวต้องไม่อยู่ใน CLOSED_STATUSES ของ Code.gs เด็ดขาด -- สถานะที่อยู่
   * ในนั้นจะไม่ถูกโหลดมาถ้าเก่าเกิน 1 ปี แท็บนี้ก็จะกลืนคำร้องที่ยังต้องทำต่อไป
   * เงียบ ๆ (ตรวจแล้ว: CLOSED_STATUSES มีแค่ ส่งแผนกมิเตอร์แล้ว / ยกเลิกคำร้อง /
   * จัดเก็บเอกสาร (ผบส.))
   */
  const METER_DISPATCH_STATUSES = ["ชำระเงินแล้ว", "ไม่มีค่าใช้จ่าย", "ผมต. ตีกลับ"];

  function isMeterDispatch(r) {
    return r.type === "power" && METER_DISPATCH_STATUSES.includes(r.jobStatus);
  }

  /**
   * เหมือน isMeterDispatch ด้านบน แต่ของคำร้องทั่วไป -- ต่างกันตรงที่ metrics
   * มีสามสถานะรวมกันเป็นคิว ส่วนนี่มีสถานะเดียวคือ "รอส่ง ผสน." (ยังไม่มีสถานะ
   * เทียบเท่า "ผมต. ตีกลับ" สำหรับคำร้องทั่วไป จึงไม่มีสถานะที่สองต้องรวม)
   * "ส่ง ผสน. แล้ว" หลุดจากคิวนี้ไปเองทันทีที่ markRecordsSentGeneral() เปลี่ยน
   * jobStatus ให้ -- ไม่มีขั้น "ย้าย" แยกต่างหาก เหมือนกลไกเดิมของ meter ทุกประการ
   */
  function isGeneralDispatch(r) {
    return r.type === "general" && r.jobStatus === "รอส่ง ผสน.";
  }

  // Tabs that filter existing records instead of holding their own type --
  // they have no add form, so the "+ เพิ่มคำร้อง" button is hidden on them.
  const DERIVED_TAB_FILTERS = {
    payment: isPaymentNotice,
    meter: isMeterDispatch,
    generalDispatch: isGeneralDispatch
  };

  /**
   * ชื่อประเภทที่ใช้บอกว่า "คำร้องใบนี้คือประเภทอะไร" (หัวฟอร์ม, การ์ดสรุป,
   * ข้อความคัดลอก) -- ต่างจาก REQUEST_TYPES[type] ตรง type "general" เท่านั้น
   * เพราะป้ายในแท็บของมันถูกเปลี่ยนเป็น "รายละเอียดคำร้อง" แล้ว (เหมาะกับหัวข้อ
   * แท็บที่แยกจากแท็บ "คุมคำร้องส่งแผนกสนับสนุน" แต่ไม่เหมาะจะบอกประเภทคำร้อง)
   * ที่เหลือทุก type อ่านจาก REQUEST_TYPES ตรง ๆ เหมือนเดิม
   */
  function recordTypeLabel(type) {
    return type === "general" ? "คำร้องทั่วไป" : REQUEST_TYPES[type];
  }

  // Each derived tab's sidebar button carries a `.nav-badge` tagged with
  // data-badge-for="<tab key>"; the count is just how many records its own
  // filter currently matches, so it shrinks as staff move records along.
  function updateTabBadges() {
    const requests = getRequests();
    navBadges.forEach(badge => {
      const filter = DERIVED_TAB_FILTERS[badge.dataset.badgeFor];
      if (!filter) return;
      const count = requests.filter(filter).length;
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  }
  const requestFormTitle = document.getElementById("requestFormTitle");
  const requestFormSubtitle = document.getElementById("requestFormSubtitle");
  const requestForm = document.getElementById("requestForm");
  const requestFormPlaceholder = document.getElementById("requestFormPlaceholder");
  const requestFormError = document.getElementById("requestFormError");
  const requestFormSubmitBtn = document.getElementById("requestFormSubmitBtn");
  const requestFormMeta = document.getElementById("requestFormMeta");
  const batchSection = document.getElementById("batchSection");
  const batchRows = document.getElementById("batchRows");
  const batchAddRowBtn = document.getElementById("batchAddRowBtn");
  const batchResult = document.getElementById("batchResult");
  const requestFormStatusHistory = document.getElementById("requestFormStatusHistory");
  const requestFormSummary = document.getElementById("requestFormSummary");
  const requestSummaryType = document.getElementById("requestSummaryType");
  const requestSummaryList = document.getElementById("requestSummaryList");
  const requestSummaryCopyBtn = document.getElementById("requestSummaryCopyBtn");
  const requestFormComments = document.getElementById("requestFormComments");
  const requestCommentInput = document.getElementById("requestCommentInput");
  const requestCommentError = document.getElementById("requestCommentError");
  const requestsNavItems = document.querySelectorAll(".requests-nav-item");
  const reqDistrict = document.getElementById("reqDistrict");
  const reqSubdistrict = document.getElementById("reqSubdistrict");
  const reqZipcode = document.getElementById("reqZipcode");
  const reqPurpose = document.getElementById("reqPurpose");
  const reqPurposeOtherField = document.getElementById("reqPurposeOtherField");
  const reqPurposeOther = document.getElementById("reqPurposeOther");
  const reqDate = document.getElementById("reqDate");
  const reqCoord = document.getElementById("reqCoord");
  const reqMapBtn = document.getElementById("reqMapBtn");
  const reqNavBtn = document.getElementById("reqNavBtn");

  // ---------- ขอขยายเขตระบบจำหน่ายไฟฟ้า (แยกฟอร์มจาก #requestForm ด้านบน) ----------
  const extendForm = document.getElementById("extendForm");
  const extendFormError = document.getElementById("extendFormError");
  const extendFormSubmitBtn = document.getElementById("extendFormSubmitBtn");
  const extDate = document.getElementById("extDate");
  const extJobStatus = document.getElementById("extJobStatus");
  const extTrackingNumber = document.getElementById("extTrackingNumber");
  const extAssigneeField = document.getElementById("extAssigneeField");
  const extWbs = document.getElementById("extWbs");
  const extWbsField = document.getElementById("extWbsField");
  const extPlanSection = document.getElementById("extPlanSection");
  const extPlanCurrent = document.getElementById("extPlanCurrent");
  const extPlanFile = document.getElementById("extPlanFile");
  const extPlanError = document.getElementById("extPlanError");
  const extPlanSuccess = document.getElementById("extPlanSuccess");
  const extPlanList = document.getElementById("extPlanList");
  const extPhotoSection = document.getElementById("extPhotoSection");
  const extPhotoError = document.getElementById("extPhotoError");
  const extPhotoSuccess = document.getElementById("extPhotoSuccess");
  const extApprovalField = document.getElementById("extApprovalField");
  const extApprovalNo = document.getElementById("extApprovalNo");
  const extApprovalDate = document.getElementById("extApprovalDate");
  const extEstimateSection = document.getElementById("extEstimateSection");
  const extEstimateSummary = document.getElementById("extEstimateSummary");
  const extDistrict = document.getElementById("extDistrict");
  const extSubdistrict = document.getElementById("extSubdistrict");
  const extZipcode = document.getElementById("extZipcode");
  const extCoord = document.getElementById("extCoord");
  const extDeed = document.getElementById("extDeed");
  const extMapBtn = document.getElementById("extMapBtn");
  const extNavBtn = document.getElementById("extNavBtn");

  // ---------- คำร้องทั่วไป (แยกฟอร์มจาก #requestForm/#extendForm ด้านบน) ----------
  // เอกสารที่ต้องส่งต่อให้แผนกอื่น ไม่ใช่งานภาคสนามที่ลูกค้าติดตามสถานะเอง จึง
  // ไม่มีเลขที่คำร้อง (ระบบ)/QR/ที่อยู่แบบโครงสร้างเหมือนสองฟอร์มข้างต้นเลย
  const generalForm = document.getElementById("generalForm");
  const generalFormError = document.getElementById("generalFormError");
  const generalFormSubmitBtn = document.getElementById("generalFormSubmitBtn");
  const genDate = document.getElementById("genDate");
  const genJobStatus = document.getElementById("genJobStatus");

  // "power", "extend" and "general" have built forms (#requestForm,
  // #extendForm and #generalForm -- three separate <form> elements, since
  // their field sets don't overlap enough to share one template the way
  // batch rows share #requestForm's). The แจ้งเตือนการรับชำระเงิน tab isn't a
  // separate type with its own data -- it's power records filtered down to
  // ones with a paymentSlip (see isPaymentNotice below), so those cards are
  // already power records and click-to-edit "just works" for them too.
  // deposit still shows a placeholder until its own field set is defined
  // (see openRequestForm).
  const FORM_SUPPORTED_TYPES = new Set(["power", "extend", "general"]);

  let currentRequestFilter = "power";
  let currentAddType = "power";
  let editingId = null;

  /**
   * id ของคำร้องใหม่ที่ยังบันทึกไม่สำเร็จ -- จองครั้งเดียวต่อการกรอกหนึ่งใบ
   *
   * เดิมสร้าง id ใหม่ทุกครั้งที่กดบันทึก พอการบันทึกครั้งแรกล้มเหลวแบบที่ข้อมูล
   * เข้าชีตไปแล้ว (ดู RETRYABLE_ACTIONS) แล้วเจ้าหน้าที่กดบันทึกซ้ำ ครั้งที่สอง
   * จะได้ id คนละตัว ฝั่งเซิร์ฟเวอร์จึงมองว่าเป็นคนละคำร้องและต่อแถวใหม่ --
   * กลายเป็นคำร้องซ้ำสองใบทั้งที่เพิ่มเข้ามาครั้งเดียว
   *
   * ใช้ id เดิมซ้ำ การกดบันทึกใหม่จึงเขียนทับแถวเดิมแทนที่จะสร้างเพิ่ม ไม่ว่าจะ
   * ลองใหม่เองอัตโนมัติหรือเจ้าหน้าที่กดเอง
   */
  let pendingNewId = null;
  // "requests" (หน้ารับคำร้อง) หรือ "extendWork" (คิวงานขอขยายเขตฯ) -- ดู
  // leaveRequestForm ว่าใช้ทำอะไร
  let formReturnTo = "requests";
  // true ระหว่างที่ fillRequestForm/fillExtendForm กำลังยัดค่าลงฟอร์ม -- ตัวช่วย
  // ที่ฟัง change อยู่ (เช่นค่าธรรมเนียมอัตโนมัติ) ต้องไม่ทำงานในช่วงนั้น
  let fillingForm = false;
  let currentSearchQuery = "";

  // Which half of the คุมคำร้องส่งแผนกมิเตอร์ tab is showing: "pending" (the
  // requests still waiting to go out) or "history" (books already printed).
  // Resets to pending on every tab switch -- the pending list is what the tab
  // is for day to day; the history is something you go looking for.
  let meterMode = "pending";

  // เหมือน meterMode ด้านบนทุกประการ แต่ของแท็บ "คุมคำร้องส่งแผนกสนับสนุน"
  let generalMode = "pending";

  // True while the request form is being used to enter a whole batch at once.
  // The form itself is unchanged -- it just doubles as the shared values for
  // every row, with #batchSection carrying what differs between them.
  let batchMode = false;

  const BATCH_DEFAULT_ROWS = 2;

  /**
   * Fields a single row may override, as ids in the shared form above. The
   * override inputs are *cloned from those very fields*, so the option lists
   * (อำเภอ/ตำบล, ความประสงค์, ขนาดมิเตอร์, สถานะงาน) can never drift from the
   * main form, and adding a field to the form makes it overridable here for
   * free. Keyed by the record field each one feeds.
   */
  /**
   * ทุกช่องที่คำร้องหนึ่งใบมี -- แต่ละแถวในกลุ่มถูกสร้างโดย "โคลน" .field เหล่านี้
   * ออกมาจากฟอร์มข้อมูลตั้งต้นด้านบน
   *
   * โคลนแทนที่จะเขียน markup ใหม่ เพราะรายการตัวเลือกของ อำเภอ/ตำบล ความประสงค์
   * ขนาดมิเตอร์ และสถานะงาน จะไม่มีวันไม่ตรงกับฟอร์มหลัก และช่องที่เพิ่มเข้าฟอร์ม
   * ในอนาคตจะโผล่ในแถวกลุ่มเองโดยไม่ต้องแก้อะไรตรงนี้ (แค่เพิ่มบรรทัดในรายการนี้)
   *
   * ไม่มี trackingNumber (ระบบออกให้) และไม่มี province (ล็อกไว้ที่เชียงใหม่)
   */
  const BATCH_ROW_FIELDS = [
    { id: "reqNumber", key: "requestNumber" },
    { id: "reqDate", key: "receivedDate" },
    { id: "reqCustomerName", key: "customerName" },
    { id: "reqPhonePrimary", key: "phonePrimary" },
    { id: "reqPhoneSecondary", key: "phoneSecondary" },
    { id: "reqBP", key: "bp" },
    { id: "reqCA", key: "ca" },
    { id: "reqHouseNo", key: "houseNo" },
    { id: "reqMoo", key: "moo" },
    { id: "reqVillage", key: "village" },
    { id: "reqDeed", key: "deed" },
    { id: "reqDistrict", key: "district" },
    { id: "reqSubdistrict", key: "subdistrict" },
    { id: "reqZipcode", key: "zipcode" },
    { id: "reqPurpose", key: "purposeChoice" },
    { id: "reqPurposeOther", key: "purposeOther" },
    { id: "reqMeterSize", key: "meterSize" },
    { id: "reqFee", key: "fee" },
    { id: "reqJobStatus", key: "jobStatus" },
    { id: "reqNote", key: "note" }
  ];

  /**
   * เลขที่คำร้องไม่ถูกคัดลอกลงแถวจากข้อมูลตั้งต้น -- คำร้องสองใบใช้เลขเดียวกัน
   * เป็นข้อมูลผิด ไม่ใช่ทางลัด (เหตุผลเดียวกับที่ซ่อนช่องนี้ในฟอร์มตั้งต้น)
   */
  const BATCH_NEVER_PREFILL = new Set(["requestNumber"]);

  /**
   * สถานะ "รอชำระเงิน" ต้องมียอดมากกว่า 0 เสมอ
   *
   * ผูกกันเพราะหน้าติดตามสถานะส่งยอดไปให้ลูกค้าเฉพาะสถานะนี้ -- ไม่มียอดก็เท่ากับ
   * บอกให้จ่ายเงินโดยไม่บอกว่าเท่าไร ส่วนยอด 0 ขัดกันเองกับสถานะ (มีสถานะ
   * "ไม่มีค่าใช้จ่าย" ไว้ให้แล้ว)
   */
  const FEE_REQUIRED_MESSAGE =
    'สถานะ "รอชำระเงิน" ต้องระบุค่าธรรมเนียมมากกว่า 0 (ถ้าไม่มีค่าใช้จ่าย ให้เลือกสถานะ "ไม่มีค่าใช้จ่าย")';

  /**
   * ค่าธรรมเนียมมาตรฐานตาม ความประสงค์ + ขนาดมิเตอร์
   *
   * เป็น "ค่าตั้งต้น" ไม่ใช่ราคาบังคับ -- เจ้าหน้าที่พิมพ์ทับได้เสมอ และฝั่ง
   * เซิร์ฟเวอร์ไม่ได้บังคับให้ตรงตารางนี้โดยตั้งใจ (มีกรณีที่คิดไม่เท่ามาตรฐานจริง)
   * สิ่งที่เซิร์ฟเวอร์ยังบังคับอยู่มีอย่างเดียวคือ สถานะ "รอชำระเงิน" ต้องมียอด
   * มากกว่า 0 -- ดู assertFeeForPayment_
   *
   * ความประสงค์/ขนาดมิเตอร์ที่ไม่อยู่ในตารางนี้ = ไม่มีราคามาตรฐาน ระบบจะไม่เดา
   * ให้ ปล่อยให้กรอกเอง คีย์ต้องตรงกับค่าใน <option> ของฟอร์มเป๊ะ ๆ
   */
  const STANDARD_FEES = {
    "ขอติดตั้งมิเตอร์ใหม่": {
      "5A 1P": "107",
      "15A 1P": "749",
      "30A 1P": "749",
      "15A 3P": "749",
      "30A 3P": "1605"
    },
    "ขอใช้ไฟฟ้าชั่วคราว": {
      "5A 1P": "600",
      "15A 1P": "4000",
      "30A 1P": "8000",
      "15A 3P": "12000",
      "30A 3P": "24000"
    },
    "ขอเปลี่ยนประเภทมิเตอร์ (TOU)": {
      "5(45)A 1P TOU": "3531",
      "5(100)A 1P TOU": "3531",
      "5(45)A 3P TOU": "4012.50",
      "5(100)A 3P TOU": "4012.50"
    }
  };

  function standardFee(purpose, meterSize) {
    const byMeter = STANDARD_FEES[purpose];
    return byMeter ? byMeter[meterSize] : undefined;
  }

  /**
   * เติมค่าธรรมเนียมให้อัตโนมัติเมื่อเลือกความประสงค์คู่กับขนาดมิเตอร์
   *
   * กฎเดียวที่ต้องจำ: **ระบบแตะเฉพาะค่าที่ระบบเป็นคนใส่เอง** ถ้าเจ้าหน้าที่พิมพ์
   * ทับแล้ว (ฟัง input บนช่องค่าธรรมเนียม) ธงจะถูกลบ และจากนั้นระบบจะไม่เขียนทับ
   * อีกเลย -- ยอดที่คนตั้งใจพิมพ์เองต้องไม่หายไปเพราะไปแก้ช่องอื่นทีหลัง
   *
   * ในทางกลับกัน ถ้าค่าที่อยู่ในช่องเป็นค่าที่ระบบใส่ไว้ แล้วเปลี่ยนไปเป็นคู่ที่
   * ไม่มีราคามาตรฐาน ต้องล้างทิ้ง ไม่ใช่ปล่อยยอดของคู่เดิมค้างไว้ให้เข้าใจผิด
   *
   * รับ element เป็นพารามิเตอร์แบบเดียวกับ wireLocationCascade เพื่อให้แถวใน
   * กลุ่มคำร้อง (ที่โคลนช่องเหล่านี้ไป) ใช้ตัวเดียวกันได้
   */
  function wireFeeAutofill(purposeEl, meterEl, feeEl) {
    function update() {
      // ตอนเปิดคำร้องเก่าขึ้นมาแก้ ค่าที่บันทึกไว้คือค่าที่ถูกต้อง ไม่ใช่ราคา
      // มาตรฐานวันนี้ -- fillRequestForm ยิง change เพื่อขับ cascade อยู่แล้ว
      // ถ้าไม่กันไว้ ยอดเดิมของคำร้องจะโดนทับเงียบ ๆ
      if (fillingForm) return;

      const fee = standardFee(purposeEl.value, meterEl.value);

      if (fee !== undefined) {
        if (!feeEl.value || feeEl.dataset.autoFee === "1") {
          feeEl.value = fee;
          feeEl.dataset.autoFee = "1";
        }
        return;
      }

      if (feeEl.dataset.autoFee === "1") {
        feeEl.value = "";
        delete feeEl.dataset.autoFee;
      }
    }

    purposeEl.addEventListener("change", update);
    meterEl.addEventListener("change", update);
    feeEl.addEventListener("input", () => { delete feeEl.dataset.autoFee; });
  }

  function isFeeValidForStatus(jobStatus, fee) {
    if (jobStatus !== "รอชำระเงิน") return true;
    const amount = Number(String(fee || "").replace(/,/g, ""));
    return isFinite(amount) && amount > 0;
  }

  /** ช่องที่ต้องกรอกทุกใบ -- ตรงกับ required ของฟอร์มหลัก ใช้บอกว่าใบไหนขาดอะไร */
  const BATCH_REQUIRED_FIELDS = [
    { key: "requestNumber", label: "เลขที่คำร้อง" },
    { key: "receivedDate", label: "วันที่รับคำร้อง" },
    { key: "customerName", label: "ชื่อลูกค้า" },
    { key: "phonePrimary", label: "เบอร์โทรศัพท์หลัก" },
    { key: "district", label: "อำเภอ" },
    { key: "subdistrict", label: "ตำบล" },
    { key: "purposeChoice", label: "ความประสงค์" },
    { key: "meterSize", label: "ขนาดมิเตอร์" },
    { key: "jobStatus", label: "สถานะงาน" }
  ];

  // Which records are checked off on the คุมคำร้องส่งแผนกมิเตอร์ tab, ready to
  // go out together in one dispatch printout. Scoped to ids (not the whole
  // record) since renderRequestsList() re-derives fresh record objects from
  // the cache on every render -- keeping full objects here would go stale
  // the moment a card's data changes. Cleared on every tab switch and after
  // a successful dispatch.
  let meterSelection = new Set();

  /** เหมือน meterSelection ด้านบน แต่ของคำร้องทั่วไปที่เลือกไว้เพื่อพิมพ์ส่ง ผสน. */
  let generalSelection = new Set();

  function matchesSearch(r, query) {
    if (!query) return true;
    const haystack = [
      r.trackingNumber, r.requestNumber, r.customerName, r.requesterName,
      r.phonePrimary, r.phoneSecondary, r.phone, r.bp, r.ca,
      r.houseNo, r.deed, r.jobStatus, r.location, r.assignee,
      r.subject, r.department
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function resetLocationFields() {
    reqSubdistrict.innerHTML = '<option value="">-- เลือกอำเภอก่อน --</option>';
    reqSubdistrict.disabled = true;
    reqZipcode.value = "";
  }

  /** เหมือน resetLocationFields แต่ของฟอร์มขอขยายเขตฯ -- form.reset() คืนค่า
   *  ในช่องได้ แต่คืน <option> ของตำบลที่ถูกสร้างไว้ตามอำเภอไม่ได้ */
  function resetExtendLocationFields() {
    extSubdistrict.innerHTML = '<option value="">-- เลือกอำเภอก่อน --</option>';
    extSubdistrict.disabled = true;
    extZipcode.value = "";
  }

  /**
   * วันที่วันนี้เป็น "YYYY-MM-DD" ล้วน -- ใช้ทั้งเติมช่องวันที่ตั้งต้นของฟอร์ม
   * และตอนประทับ sentDate ให้คำร้องทั่วไปที่เพิ่งกดส่ง ผสน. (ดู markRecordsSentGeneral)
   * รับ Date เข้ามาได้ตรง ๆ แทนที่จะเรียก new Date() เองเสมอ เพราะที่หลังต้อง
   * แปลงจาก printedAt (เวลาที่พิมพ์จริง) ไม่ใช่เวลาที่ฟังก์ชันถูกเรียก
   */
  function todayDateString(date) {
    const d = date || new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function setDefaultRequestDate() {
    reqDate.value = todayDateString();
  }

  function setDefaultExtendDate() {
    extDate.value = todayDateString();
  }

  function setDefaultGeneralDate() {
    genDate.value = todayDateString();
  }

  function resetPurposeFields() {
    reqPurpose.value = "";
    reqPurposeOtherField.hidden = true;
    reqPurposeOther.value = "";
  }

  /**
   * อำเภอ -> ตำบล -> รหัสไปรษณีย์ for one set of three controls. Taken as
   * arguments rather than closing over the form's own elements so a batch
   * row's cloned copy of these fields behaves identically to the original.
   */
  function wireLocationCascade(districtEl, subdistrictEl, zipcodeEl) {
    districtEl.addEventListener("change", () => {
      const district = DISTRICTS[districtEl.value];
      zipcodeEl.value = "";

      if (!district) {
        subdistrictEl.innerHTML = '<option value="">-- เลือกอำเภอก่อน --</option>';
        subdistrictEl.disabled = true;
        return;
      }

      subdistrictEl.innerHTML = '<option value="">-- เลือกตำบล --</option>' +
        district.subdistricts.map(([name]) => `<option value="${name}">${name}</option>`).join("");
      subdistrictEl.disabled = false;
    });

    subdistrictEl.addEventListener("change", () => {
      const district = DISTRICTS[districtEl.value];
      const match = district && district.subdistricts.find(([name]) => name === subdistrictEl.value);
      zipcodeEl.value = match ? match[1] : "";
    });
  }

  wireLocationCascade(reqDistrict, reqSubdistrict, reqZipcode);
  wireLocationCascade(extDistrict, extSubdistrict, extZipcode);
  wireFeeAutofill(reqPurpose, document.getElementById("reqMeterSize"), document.getElementById("reqFee"));

  reqPurpose.addEventListener("change", () => {
    reqPurposeOtherField.hidden = reqPurpose.value !== "other";
    if (reqPurpose.value !== "other") {
      reqPurposeOther.value = "";
    }
  });

  /**
   * พิกัด GPS ไม่บังคับกรอกทั้งขอใช้ไฟฟ้าและขอขยายเขตฯ -- ไม่มีแผนที่ให้คลิก
   * เลือกตำแหน่งฝังอยู่ในหน้านี้โดยตรง เพราะนั่นต้องมี Google Maps JavaScript
   * API key ที่ผูกบัตร และต้องเปิด CSP ให้ maps.googleapis.com ซึ่งเป็นการขยาย
   * พื้นผิวที่ต้องตัดสินใจแยกต่างหาก ปุ่ม "เปิด Google Maps" จึงพาไปหาตำแหน่งบน
   * เว็บ Google Maps จริงแทน (ไม่ต้องใช้ API key เลย) แล้วเจ้าหน้าที่คัดลอกพิกัด
   * (คลิกขวาที่จุด -> คัดลอกพิกัด) กลับมาวางในสองช่องนี้เอง
   */
  /**
   * อ่านพิกัดจากช่องเดียว -- คืน { lat, lng } เป็นข้อความ หรือ null ถ้าอ่านไม่ออก
   *
   * เป็นช่องเดียวเพราะสิ่งที่เจ้าหน้าที่มีอยู่ในมือคือข้อความชุดเดียวที่คัดลอกมา
   * จาก Google Maps ("18.710625, 98.909944") การบังคับให้แยกวางสองช่องคือการให้
   * คนทำงานแทนเครื่อง
   *
   * ที่รวมคือช่องกรอก ไม่ใช่ข้อมูล -- ยังเก็บลงชีตเป็นสองคอลัมน์ lat/lng เหมือนเดิม
   * ค่าที่อ่านได้จึงยังเป็นตัวเลขสองตัวที่ map ลงสองฟิลด์ตอนย้าย Django ได้ตรง ๆ
   */
  function parseCoordText(text) {
    const parts = String(text || "").trim().split(/[,\s]+/).filter(Boolean);
    if (parts.length !== 2) return null;

    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

    // คืนเป็นข้อความตามที่พิมพ์มา ไม่ใช่ที่ Number แปลงกลับ -- ทศนิยมท้าย ๆ ของ
    // พิกัดมีความหมาย และคอลัมน์นี้เก็บเป็นข้อความอยู่แล้ว
    return { lat: parts[0], lng: parts[1] };
  }

  /** ประกอบ lat/lng ที่เก็บไว้กลับเป็นบรรทัดเดียวสำหรับช่องกรอก */
  function formatCoordText(lat, lng) {
    return (lat && lng) ? `${lat}, ${lng}` : "";
  }

  function wireCoordControls(coordEl, mapBtn, navBtn) {
    function update() {
      const coord = parseCoordText(coordEl.value);
      const lat = coord && coord.lat;
      const lng = coord && coord.lng;
      const hasCoord = Boolean(coord);

      if (hasCoord) {
        mapBtn.href = `https://www.google.com/maps?q=${lat},${lng}`;
        mapBtn.textContent = "เปิดแผนที่ตำแหน่งนี้";
        navBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        navBtn.hidden = false;
      } else {
        mapBtn.href = "https://www.google.com/maps";
        mapBtn.textContent = "เปิด Google Maps เพื่อหาตำแหน่ง";
        navBtn.hidden = true;
      }
    }
    coordEl.addEventListener("input", update);
    update();
    return update;
  }

  const updateReqCoords = wireCoordControls(reqCoord, reqMapBtn, reqNavBtn);
  const updateExtCoords = wireCoordControls(extCoord, extMapBtn, extNavBtn);

  /**
   * พิกัดไม่บังคับกรอก แต่ถ้ากรอกต้องกรอกให้ครบคู่และเป็นพิกัดจริง -- ใช้ร่วมกัน
   * ทั้งฟอร์มขอใช้ไฟฟ้าและขอขยายเขตฯ คืนข้อความ error หรือ null ถ้าผ่าน
   */
  function readCoordField(coordEl) {
    const text = coordEl.value.trim();
    if (!text) return { lat: "", lng: "" };

    const coord = parseCoordText(text);
    if (!coord) {
      return { error: "พิกัดไม่ถูกต้อง กรอกเป็น ละติจูด, ลองจิจูด เช่น 18.788300, 98.985300" };
    }
    return coord;
  }

  /**
   * ไอคอนหูโทรศัพท์ -- สร้างเป็นโหนด SVG ใหม่ทุกครั้งที่เรียก
   *
   * ประกอบด้วย createElementNS ไม่ใช่ innerHTML: ข้อความที่ประกอบเป็น markup
   * แล้วยัดเข้า DOM คือรูปแบบที่เคยเปิดช่องให้ XSS ในหน้านี้มาแล้ว จึงไม่เปิด
   * ประตูนั้นทิ้งไว้แม้ในที่ที่ค่าคงที่ล้วน
   */
  function callIconSvg() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", "M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z");
    svg.appendChild(path);

    return svg;
  }

  /** ปุ่มโทรออกข้างช่องเบอร์โทร -- tel: link ธรรมดา กดได้จริงเฉพาะเปิดผ่านมือถือ */
  function wireCallButton(phoneEl, callBtn) {
    function update() {
      const digits = phoneEl.value.replace(/[^0-9+]/g, "");
      callBtn.hidden = !digits;
      if (digits) callBtn.href = `tel:${digits}`;
    }
    phoneEl.addEventListener("input", update);
    update();
    return update;
  }

  const updateGenPhoneCall = wireCallButton(
    document.getElementById("genPhone"), document.getElementById("genPhoneCallBtn"));

  const updateReqPhonePrimaryCall = wireCallButton(
    document.getElementById("reqPhonePrimary"), document.getElementById("reqPhonePrimaryCallBtn"));
  const updateReqPhoneSecondaryCall = wireCallButton(
    document.getElementById("reqPhoneSecondary"), document.getElementById("reqPhoneSecondaryCallBtn"));
  const updateExtPhonePrimaryCall = wireCallButton(
    document.getElementById("extPhonePrimary"), document.getElementById("extPhonePrimaryCallBtn"));
  const updateExtPhoneSecondaryCall = wireCallButton(
    document.getElementById("extPhoneSecondary"), document.getElementById("extPhoneSecondaryCallBtn"));

  /**
   * ช่องที่โผล่มาตามขั้นของงาน -- ผู้รับผิดชอบ, เลข WBS, และการแนบแผนผัง
   *
   * ผู้รับผิดชอบและ WBS ตัดสินจาก "สถานะที่เลือกอยู่ในดรอปดาวน์" เพราะเป็นช่องที่
   * กรอกไปพร้อมกับการเปลี่ยนสถานะในครั้งเดียวกัน
   *
   * ส่วนการแนบแผนผังตัดสินจาก **สถานะที่บันทึกไว้จริง** ของคำร้อง ไม่ใช่ค่าใน
   * ดรอปดาวน์: การอัปโหลดยิงคำสั่งของตัวเองไปที่คำร้องใบนั้นทันที (ไม่ได้รอกด
   * บันทึก) และฝั่งเซิร์ฟเวอร์เดินสถานะจากค่าที่เก็บไว้ ถ้าโชว์ตามดรอปดาวน์
   * เจ้าหน้าที่จะแนบไฟล์ตั้งแต่ยังไม่ได้บันทึกสถานะ แล้วงานจะค้างครึ่งทาง
   * (มีไฟล์แต่สถานะไม่เดิน) -- คำร้องใหม่ที่ยังไม่มี id ก็แนบไม่ได้ด้วยเหตุผลเดียวกัน
   */
  function syncExtendStageFields(record) {
    const status = extJobStatus.value;

    extAssigneeField.hidden = status === "รอจ่ายงาน" || !status;

    const hasWbs = Boolean(record && record.wbs);
    extWbsField.hidden = !(status === "รอสำรวจ" || hasWbs);

    const storedStatus = record ? record.jobStatus : "";
    const showPlan = Boolean(record) && (storedStatus === "รอเขียนผัง" || Boolean(record.planFile));
    extendStage.plan = showPlan;

    if (showPlan) renderPlanCurrent(record);

    // ประมาณการเปิดที่ขั้น "รอประมาณการ" และเปิดค้างไว้ตลอดถ้าเริ่มทำไปแล้ว --
    // ใบที่กรอกไว้ต้องเปิดกลับมาดู/แก้ได้เสมอ ไม่ใช่หายไปเมื่อสถานะเดินต่อ
    const showEstimate = Boolean(record)
      && (storedStatus === "รอประมาณการ" || Boolean(record.estimate));
    extendStage.estimate = showEstimate;
    if (showEstimate) extEstimateSummary.textContent = estimateSummaryText(record);

    // ภาพหน้างานผูกกับ "มีเลข WBS แล้ว" ไม่ใช่สถานะใดสถานะหนึ่ง -- การแนบแผนผัง
    // เดินสถานะต่อทันที ถ้าผูกไว้กับ "รอเขียนผัง" ช่องนี้จะหายไปในวินาทีที่แนบ
    // ผังเสร็จ ทั้งที่ยังไม่ได้ถ่ายรูปหน้างานเลย
    const showPhotos = Boolean(record)
      && (Boolean(record.wbs) || Boolean(record.sitePhoto) || Boolean(record.routePhoto));
    extendStage.photo = showPhotos;
    if (showPhotos) renderExtendPhotos(record);

    extApprovalField.hidden = !(status === "อนุมัติและแจ้งค่าใช้จ่ายแล้ว"
      || Boolean(record && (record.approvalNo || record.approvalDate)));
  }

  function renderExtendPhotos(record) {
    [
      ["sitePhoto", "extSitePhotoPreview", "extSitePhotoEmpty"],
      ["routePhoto", "extRoutePhotoPreview", "extRoutePhotoEmpty"]
    ].forEach(([field, previewId, emptyId]) => {
      const preview = document.getElementById(previewId);
      const empty = document.getElementById(emptyId);
      const url = record[field];

      preview.hidden = !url;
      empty.hidden = Boolean(url);

      if (url) {
        preview.src = driveThumbnailUrl(url);
      } else {
        // ล้าง src ทิ้งด้วย ไม่ใช่แค่ซ่อน -- ไม่งั้นภาพของคำร้องใบก่อนยังค้าง
        // อยู่ใน DOM (เคยเป็นบั๊กจริงมาแล้วกับสลิปในหน้าติดตามสถานะ)
        preview.removeAttribute("src");
      }
    });
  }

  /** สรุปย่อบนฟอร์มคำร้อง -- รายละเอียดทั้งหมดอยู่ในหน้าประมาณการ */
  function estimateSummaryText(record) {
    const departments = (record.estimate && record.estimate.departments) || [];
    if (!departments.length) return "ยังไม่ได้เริ่มทำประมาณการ";

    const jobs = departments.reduce((sum, d) => sum + ((d.jobs || []).length), 0);
    const items = departments.reduce((sum, d) =>
      sum + (d.jobs || []).reduce((n, j) => n + ((j.items || []).length), 0), 0);

    return `${departments.length} แผนก · ${jobs} งานย่อย · ${items} รายการ`;
  }

  /**
   * แผนผังที่แนบไว้ทั้งหมดของคำร้องใบหนึ่ง
   *
   * คำร้องเก่าเก็บไฟล์เดียวไว้ในคอลัมน์ planFile ส่วนของใหม่เก็บเป็นรายการใน
   * planFiles -- อ่านผ่านตัวนี้ที่เดียว หน้าจอจึงไม่ต้องรู้ว่าแถวไหนเป็นแบบไหน
   * (ฝั่งเซิร์ฟเวอร์ย้ายของเก่าเข้ารายการให้เองตอนอัปโหลดครั้งถัดไป)
   */
  function planFilesOf(record) {
    if (Array.isArray(record.planFiles) && record.planFiles.length) return record.planFiles;
    if (record.planFile) return [{ url: record.planFile, at: record.planFileAt }];
    return [];
  }

  function renderPlanCurrent(record) {
    const files = planFilesOf(record);

    extPlanCurrent.textContent = files.length
      ? `แผนผังที่แนบไว้ ${files.length} ไฟล์`
      : "ยังไม่ได้แนบแผนผัง";

    extPlanList.innerHTML = "";

    files.forEach((file, index) => {
      const item = document.createElement("div");
      item.className = "plan-item";

      // ลิงก์แบบ thumbnail เรนเดอร์ได้ทั้งไฟล์ภาพและ PDF (PDF ได้ภาพหน้าแรก)
      // จึงไม่ต้องแยกเส้นทางตามชนิดไฟล์ ส่วนไฟล์ที่ Drive ทำภาพตัวอย่างไม่ได้
      // ตัวรูปจะซ่อนตัวเอง เหลือลิงก์เปิดไฟล์
      const preview = document.createElement("img");
      preview.className = "plan-preview";
      preview.alt = `ตัวอย่างแผนผังไฟล์ที่ ${index + 1}`;
      preview.src = driveThumbnailUrl(file.url);
      preview.addEventListener("error", () => { preview.hidden = true; });

      const foot = document.createElement("div");
      foot.className = "plan-item-foot";

      const link = document.createElement("a");
      link.href = file.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = `เปิดไฟล์ที่ ${index + 1}`;

      const when = document.createElement("span");
      when.className = "plan-item-when";
      when.textContent = file.at ? formatThaiDateTime(file.at) : "";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "estimate-remove";
      remove.setAttribute("aria-label", `ลบแผนผังไฟล์ที่ ${index + 1}`);
      remove.textContent = "\u00d7";
      remove.addEventListener("click", () => deletePlanFile(remove, file.url, index + 1));

      foot.append(link, when, remove);
      item.append(preview, foot);
      extPlanList.appendChild(item);
    });
  }

  /** ลบแผนผังทีละไฟล์ -- ใช้ตอนแนบผิดไฟล์ */
  async function deletePlanFile(button, url, position) {
    if (!extendFormRecord) return;
    if (!confirm(`ลบแผนผังไฟล์ที่ ${position} ออกจากคำร้องนี้?`)) return;

    hideError(extPlanError);
    extPlanSuccess.hidden = true;
    setBusy(button, true, "...");

    try {
      const updated = await backend.deleteExtendFile(extendFormRecord.id, "plan", url);

      requestsCache = requestsCache.map(r => (String(r.id) === String(updated.id) ? updated : r));
      extendFormRecord = updated;
      renderPlanCurrent(updated);

      extPlanSuccess.textContent = "ลบไฟล์แล้ว";
      extPlanSuccess.hidden = false;
    } catch (err) {
      console.error("CS Connect plan delete error:", err);
      showError(extPlanError, friendlyError(err, "ลบไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(button, false);
    }
  }

  // คำร้องที่กำลังเปิดอยู่ในฟอร์มขอขยายเขตฯ -- การแนบแผนผังต้องรู้ id และสถานะ
  // ที่บันทึกไว้จริง ซึ่ง editingId อย่างเดียวบอกไม่ได้
  let extendFormRecord = null;

  extJobStatus.addEventListener("change", () => syncExtendStageFields(extendFormRecord));

  function setActiveNavItem(filter) {
    requestsNavItems.forEach(item => {
      item.classList.toggle("active", item.dataset.filter === filter);
    });
  }

  function renderRequestsList() {
    requestsFormMode.hidden = true;
    requestsListMode.hidden = false;
    // Returning from the (often long) form scrolled partway down should
    // land back at the top of the list, not wherever the form happened to
    // be scrolled to.
    window.scrollTo(0, 0);
    updateTabBadges();

    const derivedFilter = DERIVED_TAB_FILTERS[currentRequestFilter];
    const filtered = getRequests()
      .filter(derivedFilter || (r => r.type === currentRequestFilter))
      .filter(r => matchesSearch(r, currentSearchQuery))
      .sort((a, b) => b.createdAt - a.createdAt);

    requestsListTitle.textContent = REQUEST_TYPES[currentRequestFilter];
    requestsListCount.textContent = `ทั้งหมด ${filtered.length} รายการ`;
    requestsAddBtn.hidden = Boolean(derivedFilter);
    // เพิ่มหลายคำร้องมีเฉพาะขอใช้ไฟฟ้า -- ขอขยายเขตฯ (และแท็บอื่นที่ยังไม่มี
    // ฟอร์มของตัวเอง) ไม่มีปุ่มนี้
    requestsAddBatchBtn.hidden = Boolean(derivedFilter) || currentRequestFilter !== "power";

    const isMeterTab = currentRequestFilter === "meter";
    meterModes.hidden = !isMeterTab;

    if (isMeterTab && meterMode === "history") {
      renderDispatchHistory();
      return;
    }

    meterPrintBtn.hidden = !isMeterTab;
    if (isMeterTab) {
      // A record can only leave this tab by having its jobStatus changed
      // elsewhere (another tab, another staff member) -- drop any selected
      // id that's no longer actually on this list rather than letting a
      // stale selection silently include something no longer eligible.
      const visibleIds = new Set(filtered.map(r => r.id));
      meterSelection.forEach(id => { if (!visibleIds.has(id)) meterSelection.delete(id); });
      meterPrintBtn.disabled = meterSelection.size === 0;
    }

    // เหมือน isMeterTab ข้างบนทุกประการตอนนี้ -- "คุมคำร้องส่งแผนกสนับสนุน" เป็น
    // derived tab แยกจาก "รายละเอียดคำร้อง" แล้ว (isGeneralDispatch ใน
    // DERIVED_TAB_FILTERS) filtered ด้านบนจึงถูกกรองเหลือเฉพาะคำร้องที่ยังเป็น
    // "รอส่ง ผสน." อยู่แล้วโดยอัตโนมัติ ไม่ต้องกรองซ้ำที่นี่
    const isGeneralTab = currentRequestFilter === "generalDispatch";
    generalModes.hidden = !isGeneralTab;

    if (isGeneralTab && generalMode === "history") {
      renderGeneralDispatchHistory();
      return;
    }

    generalPrintBtn.hidden = !isGeneralTab;
    if (isGeneralTab) {
      // A record can only leave this tab by having its jobStatus changed
      // elsewhere (another tab, another staff member) -- drop any selected
      // id that's no longer actually on this list rather than letting a
      // stale selection silently include something no longer eligible.
      const visibleIds = new Set(filtered.map(r => r.id));
      generalSelection.forEach(id => { if (!visibleIds.has(id)) generalSelection.delete(id); });
      generalPrintBtn.disabled = generalSelection.size === 0;
    }

    requestsList.innerHTML = "";

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = "ยังไม่มีข้อมูลคำร้อง";
      requestsList.appendChild(empty);

      // loadRequests() only brings back open/recent requests (see
      // loadRequestsForStaff_ in Code.gs) -- an empty result while searching
      // doesn't rule out an older, already-closed record, so offer to check
      // the full history on the server instead of silently saying "not found".
      if (currentSearchQuery && backend === sheetsBackend) {
        const archiveBtn = document.createElement("button");
        archiveBtn.type = "button";
        archiveBtn.className = "btn btn-ghost request-archive-search-btn";
        archiveBtn.textContent = `ค้นหา "${currentSearchQuery}" ในคำร้องเก่าที่จัดเก็บแล้ว`;
        archiveBtn.addEventListener("click", () => searchArchivedAndMerge(currentSearchQuery, archiveBtn));
        requestsList.appendChild(archiveBtn);
      }
      return;
    }

    filtered.forEach(r => {
      const card = document.createElement("div");
      card.className = "request-card";
      card.dataset.type = r.type;

      card.innerHTML = `
        <div class="request-card-top">
          <div class="request-badges">
            <span class="request-badge request-badge-id"></span>
            <span class="request-badge request-badge-purpose"></span>
            <span class="request-badge request-badge-status"></span>
          </div>
          <span class="request-date"></span>
        </div>
        <div class="request-name"></div>
        <div class="request-meta request-meta-phone"></div>
        <div class="request-meta request-meta-location"></div>
        <div class="request-meta request-meta-note"></div>
      `;

      card.querySelector(".request-date").textContent = formatThaiDate(r.receivedDate);

      const idEl = card.querySelector(".request-badge-id");
      if (r.requestNumber) {
        idEl.textContent = r.requestNumber;
      } else {
        idEl.remove();
      }

      // คำร้องทั่วไปไม่มี "ความประสงค์" แบบดรอปดาวน์ -- ใช้ "เรื่อง" ที่ยื่นมาแทน
      // ในตำแหน่งเดียวกัน (ทั้งสองเป็นหัวข้อสั้น ๆ ที่บอกว่าคำร้องนี้คืออะไร)
      const purposeEl = card.querySelector(".request-badge-purpose");
      const purposeText = r.purpose || r.subject;
      if (purposeText) {
        purposeEl.textContent = purposeText;
      } else {
        purposeEl.remove();
      }

      const statusEl = card.querySelector(".request-badge-status");
      if (r.jobStatus) {
        statusEl.textContent = r.jobStatus;
        statusEl.classList.add(`tone-${JOB_STATUS_TONE[r.jobStatus] || "info"}`);
      } else {
        statusEl.remove();
      }

      card.querySelector(".request-name").textContent = r.customerName || r.requesterName || "";

      // tel: link ธรรมดา ไม่ใช้ innerHTML กับข้อความที่มาจากฟอร์ม -- สร้างผ่าน
      // createElement เหมือนทุกจุดอื่นในไฟล์นี้ที่วาดข้อมูลจากคำร้อง
      const phoneEl = card.querySelector(".request-meta-phone");
      const phoneNumber = r.phonePrimary || r.phone;
      if (phoneNumber) {
        const digits = phoneNumber.replace(/[^0-9+]/g, "");
        phoneEl.textContent = "โทร: ";
        const phoneLink = document.createElement("a");
        phoneLink.href = `tel:${digits}`;
        phoneLink.textContent = phoneNumber;
        phoneLink.addEventListener("click", (e) => e.stopPropagation());
        phoneEl.appendChild(phoneLink);
      } else {
        phoneEl.remove();
      }

      // คำร้องทั่วไปไม่มีที่อยู่/สถานที่เลย -- buildLocationText คืนค่าว่างให้
      // ต่างจากขอใช้ไฟฟ้า/ขอขยายเขตฯ ที่บังคับกรอกอำเภอ+ตำบลเสมอ จึงไม่เคยว่าง
      const locationEl = card.querySelector(".request-meta-location");
      const locationText = buildLocationText(r);
      if (locationText) {
        locationEl.textContent = `สถานที่: ${locationText}`;
      } else {
        locationEl.remove();
      }

      const noteEl = card.querySelector(".request-meta-note");
      if (r.note) {
        noteEl.textContent = `หมายเหตุ: ${r.note}`;
      } else {
        noteEl.remove();
      }

      if (FORM_SUPPORTED_TYPES.has(r.type)) {
        card.classList.add("request-card-clickable");
        card.addEventListener("click", () => openRequestForm(r.type, r));
      }

      if (isMeterTab) {
        card.classList.add("has-card-select");
        const selectWrap = document.createElement("label");
        selectWrap.className = "request-card-select";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = meterSelection.has(r.id);
        checkbox.setAttribute("aria-label", `เลือกคำร้อง ${r.requestNumber || r.trackingNumber || ""} เพื่อส่งแผนกมิเตอร์`);
        checkbox.addEventListener("click", (e) => {
          // The card itself is clickable (opens the edit form) -- checking
          // the box should never also open it.
          e.stopPropagation();
        });
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) meterSelection.add(r.id);
          else meterSelection.delete(r.id);
          meterPrintBtn.disabled = meterSelection.size === 0;
        });
        selectWrap.appendChild(checkbox);
        card.appendChild(selectWrap);
      }

      // เหมือน checkbox ของแท็บ meter ด้านบนทุกกลไก -- ไม่ต้องเช็ก jobStatus ซ้ำ
      // อีกแล้ว เพราะ filtered เหลือเฉพาะคำร้อง "รอส่ง ผสน." อยู่แล้วจาก
      // isGeneralDispatch (derived tab)
      if (isGeneralTab) {
        card.classList.add("has-card-select");
        const selectWrap = document.createElement("label");
        selectWrap.className = "request-card-select";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = generalSelection.has(r.id);
        checkbox.setAttribute("aria-label", `เลือกคำร้อง ${r.subject || r.customerName || ""} เพื่อส่ง ผสน.`);
        checkbox.addEventListener("click", (e) => {
          e.stopPropagation();
        });
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) generalSelection.add(r.id);
          else generalSelection.delete(r.id);
          generalPrintBtn.disabled = generalSelection.size === 0;
        });
        selectWrap.appendChild(checkbox);
        card.appendChild(selectWrap);
      }

      // Bottom-right corner buttons -- QR whenever there's a tracking number
      // to hand the customer (i.e. every power-type record), print whenever
      // a slip has already been attached. Collected into one wrapper so two
      // buttons don't have to fight over the same absolute position.
      const cardActions = [];

      if (r.trackingNumber) {
        const qrBtn = document.createElement("button");
        qrBtn.type = "button";
        qrBtn.className = "btn btn-ghost request-card-action-btn";
        qrBtn.textContent = "พิมพ์ QR";
        qrBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          // qr.html reads ?tn= to prefill the reference number so staff never
          // have to retype what's already right here on the card.
          window.open(`qr.html?tn=${encodeURIComponent(r.trackingNumber)}`, "_blank");
        });
        cardActions.push(qrBtn);
      }

      if (r.paymentSlip) {
        const printBtn = document.createElement("button");
        printBtn.type = "button";
        printBtn.className = "btn btn-ghost request-card-action-btn";
        printBtn.textContent = "พิมพ์ Slip";
        printBtn.addEventListener("click", (e) => {
          // The card itself may be clickable (opens the edit form) --
          // stop this button's click from also triggering that.
          e.stopPropagation();
          printSlipImage(r);
        });
        cardActions.push(printBtn);
      }

      if (cardActions.length) {
        card.classList.add("has-card-actions");
        const actionsWrap = document.createElement("div");
        actionsWrap.className = "request-card-actions";
        cardActions.forEach(btn => actionsWrap.appendChild(btn));
        card.appendChild(actionsWrap);
      }

      requestsList.appendChild(card);
    });
  }

  /**
   * Answers "when did this one go to the meter department?" from the request's
   * own audit panel, so staff don't have to go hunting through the dispatch
   * history for a request already open in front of them. The book it went out
   * on is one click away, since the usual follow-up is wanting the paper.
   */
  /**
   * For a request that came in as part of a batch, offers the group's QR
   * labels again. Without this the labels could only be printed together in
   * the moments right after saving, which is exactly the kind of one-shot
   * action people need a second time.
   */
  function renderBatchInfo(record) {
    const line = document.getElementById("requestFormBatchInfo");
    line.innerHTML = "";
    line.hidden = !record.batchId;
    if (!record.batchId) return;

    const siblings = getRequests().filter(r => r.batchId === record.batchId);
    line.append(`รับเข้าพร้อมกัน ${siblings.length} คำร้อง · `);

    const link = document.createElement("button");
    link.type = "button";
    link.className = "link-btn";
    link.textContent = "พิมพ์ QR ทั้งกลุ่ม";
    link.addEventListener("click", () => openQrLabels(siblings.map(r => r.trackingNumber)));
    line.appendChild(link);
  }

  function renderDispatchInfo(record) {
    const line = document.getElementById("requestFormDispatchInfo");
    const dispatch = getDispatches().find(d =>
      Array.isArray(d.rows) && d.rows.some(row => row.requestId === record.id)
    );

    line.innerHTML = "";
    line.hidden = !dispatch;
    if (!dispatch) return;

    line.append(`ส่งแผนกมิเตอร์: ${formatThaiDateTime(dispatch.printedAt)} · `);
    const link = document.createElement("button");
    link.type = "button";
    link.className = "link-btn";
    link.textContent = "ดูสมุดคุม";
    link.addEventListener("click", () => openDispatchReprint(dispatch));
    line.appendChild(link);
  }

  /** เหมือน renderDispatchInfo ด้านบน แต่ของสมุดคุมคำร้องทั่วไป (ส่ง ผสน.) */
  function renderGeneralDispatchInfo(record) {
    const line = document.getElementById("requestFormGeneralDispatchInfo");
    const dispatch = getGeneralDispatches().find(d =>
      Array.isArray(d.rows) && d.rows.some(row => row.requestId === record.id)
    );

    line.innerHTML = "";
    line.hidden = !dispatch;
    if (!dispatch) return;

    line.append(`ส่ง ผสน.: ${formatThaiDateTime(dispatch.printedAt)} · `);
    const link = document.createElement("button");
    link.type = "button";
    link.className = "link-btn";
    link.textContent = "ดูสมุดคุม";
    link.addEventListener("click", () => openGeneralDispatchReprint(dispatch));
    line.appendChild(link);
  }

  /**
   * Does this book mention `query` anywhere a staff member would search by?
   * Both request numbers are matched, because staff have two of them (the
   * system's เลขที่คำร้อง (ระบบ) and the one they type by hand) and either is a
   * reasonable thing to paste in when a customer asks "when was mine sent?".
   * `row.subject` is the คำร้องทั่วไป equivalent -- harmless to include for
   * meter rows too, since they simply never carry that key.
   */
  function dispatchMatchesSearch(dispatch, query) {
    if (!query) return true;
    const rows = Array.isArray(dispatch.rows) ? dispatch.rows : [];
    const haystack = [
      dispatch.printedByName, dispatch.senderName, dispatch.receiverName,
      formatThaiDateTime(dispatch.printedAt),
      ...rows.flatMap(row => [row.requestNumber, row.trackingNumber, row.customerName, row.subject])
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  /** The "ประวัติการส่ง" half of the meter tab: books already printed. */
  function renderDispatchHistory() {
    requestsAddBtn.hidden = true;
    meterPrintBtn.hidden = true;

    const matches = getDispatches()
      .filter(d => dispatchMatchesSearch(d, currentSearchQuery))
      .sort((a, b) => (b.printedAt || 0) - (a.printedAt || 0));

    requestsListTitle.textContent = REQUEST_TYPES.meter;
    requestsListCount.textContent = `พิมพ์ไปแล้ว ${matches.length} เล่ม`;
    requestsList.innerHTML = "";

    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = currentSearchQuery
        ? "ไม่พบสมุดคุมที่ตรงกับคำค้น"
        : "ยังไม่มีสมุดคุมที่พิมพ์ไว้ (ประวัติจะเริ่มบันทึกตั้งแต่ครั้งถัดไปที่กดพิมพ์)";
      requestsList.appendChild(empty);
      return;
    }

    matches.forEach(dispatch => {
      const rows = Array.isArray(dispatch.rows) ? dispatch.rows : [];
      const card = document.createElement("div");
      card.className = "request-card request-card-clickable";

      card.innerHTML = `
        <div class="request-card-top">
          <div class="request-badges">
            <span class="request-badge request-badge-id"></span>
            <span class="request-badge request-badge-purpose"></span>
          </div>
          <span class="request-date"></span>
        </div>
        <div class="request-name"></div>
        <div class="request-meta dispatch-meta-people"></div>
      `;

      card.querySelector(".request-badge-id").textContent = `${rows.length} รายการ`;

      const printedByEl = card.querySelector(".request-badge-purpose");
      if (dispatch.printedByName) {
        printedByEl.textContent = `พิมพ์โดย ${dispatch.printedByName}`;
      } else {
        printedByEl.remove();
      }

      card.querySelector(".request-date").textContent = formatThaiDateTime(dispatch.printedAt);
      // The customer names are what makes a book recognisable at a glance --
      // "which one had คุณสมชาย on it?" is the actual question being asked.
      card.querySelector(".request-name").textContent =
        rows.map(row => row.customerName).filter(Boolean).join(", ") || "-";
      card.querySelector(".dispatch-meta-people").textContent =
        `ผู้ส่ง: ${dispatch.senderName || "-"} · ผู้รับ: ${dispatch.receiverName || "-"}`;

      card.classList.add("has-card-actions");
      const actions = document.createElement("div");
      actions.className = "request-card-actions";
      const reprintBtn = document.createElement("button");
      reprintBtn.type = "button";
      reprintBtn.className = "btn btn-ghost request-card-action-btn";
      reprintBtn.textContent = "พิมพ์ซ้ำ";
      reprintBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDispatchReprint(dispatch);
      });
      actions.appendChild(reprintBtn);
      card.appendChild(actions);

      card.addEventListener("click", () => openDispatchReprint(dispatch));
      requestsList.appendChild(card);
    });
  }

  /** เหมือน renderDispatchHistory ด้านบน แต่ของแท็บคำร้องทั่วไป (สมุดที่พิมพ์ส่ง ผสน. ไปแล้ว) */
  function renderGeneralDispatchHistory() {
    requestsAddBtn.hidden = true;
    generalPrintBtn.hidden = true;

    const matches = getGeneralDispatches()
      .filter(d => dispatchMatchesSearch(d, currentSearchQuery))
      .sort((a, b) => (b.printedAt || 0) - (a.printedAt || 0));

    requestsListTitle.textContent = REQUEST_TYPES.generalDispatch;
    requestsListCount.textContent = `พิมพ์ไปแล้ว ${matches.length} เล่ม`;
    requestsList.innerHTML = "";

    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = currentSearchQuery
        ? "ไม่พบสมุดคุมที่ตรงกับคำค้น"
        : "ยังไม่มีสมุดคุมที่พิมพ์ไว้ (ประวัติจะเริ่มบันทึกตั้งแต่ครั้งถัดไปที่กดพิมพ์)";
      requestsList.appendChild(empty);
      return;
    }

    matches.forEach(dispatch => {
      const rows = Array.isArray(dispatch.rows) ? dispatch.rows : [];
      const card = document.createElement("div");
      card.className = "request-card request-card-clickable";

      card.innerHTML = `
        <div class="request-card-top">
          <div class="request-badges">
            <span class="request-badge request-badge-id"></span>
            <span class="request-badge request-badge-purpose"></span>
          </div>
          <span class="request-date"></span>
        </div>
        <div class="request-name"></div>
        <div class="request-meta dispatch-meta-people"></div>
      `;

      card.querySelector(".request-badge-id").textContent = `${rows.length} รายการ`;

      const printedByEl = card.querySelector(".request-badge-purpose");
      if (dispatch.printedByName) {
        printedByEl.textContent = `พิมพ์โดย ${dispatch.printedByName}`;
      } else {
        printedByEl.remove();
      }

      card.querySelector(".request-date").textContent = formatThaiDateTime(dispatch.printedAt);
      card.querySelector(".request-name").textContent =
        rows.map(row => row.customerName).filter(Boolean).join(", ") || "-";
      card.querySelector(".dispatch-meta-people").textContent =
        `ผู้ส่ง: ${dispatch.senderName || "-"} · ผู้รับ: ${dispatch.receiverName || "-"}`;

      card.classList.add("has-card-actions");
      const actions = document.createElement("div");
      actions.className = "request-card-actions";
      const reprintBtn = document.createElement("button");
      reprintBtn.type = "button";
      reprintBtn.className = "btn btn-ghost request-card-action-btn";
      reprintBtn.textContent = "พิมพ์ซ้ำ";
      reprintBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openGeneralDispatchReprint(dispatch);
      });
      actions.appendChild(reprintBtn);
      card.appendChild(actions);

      card.addEventListener("click", () => openGeneralDispatchReprint(dispatch));
      requestsList.appendChild(card);
    });
  }

  /**
   * Pulls matches for `query` from the full sheet (bypassing the recency
   * window loadRequests applies) and folds any not already cached into
   * requestsCache, then re-renders. Merging into the cache -- rather than
   * showing results in some separate read-only panel -- means an archived
   * record opens for edit through the exact same openRequestForm()/
   * saveRequests() path as anything else, so there's no special "this record
   * came from a search" case to keep correct in the edit/save logic.
   */
  async function searchArchivedAndMerge(query, triggerBtn) {
    setBusy(triggerBtn, true, "กำลังค้นหา...");
    try {
      const found = await sheetsBackend.searchArchived(query);
      if (!found.length) {
        triggerBtn.textContent = "ไม่พบคำร้องที่ตรงกันในคำร้องเก่า";
        triggerBtn.disabled = true;
        return;
      }
      const knownIds = new Set(requestsCache.map(r => String(r.id)));
      const fresh = found.filter(r => !knownIds.has(String(r.id)));
      requestsCache = requestsCache.concat(fresh);
      renderRequestsList();
    } catch (err) {
      console.error("CS Connect: ค้นหาคำร้องเก่าไม่สำเร็จ", err);
      triggerBtn.textContent = "ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง";
      setBusy(triggerBtn, false);
    }
  }

  function openRequestsView() {
    currentRequestFilter = "power";
    setActiveNavItem("power");
    currentSearchQuery = "";
    requestsSearchInput.value = "";
    meterSelection.clear();
    setMeterMode("pending");
    generalSelection.clear();
    setGeneralMode("pending");
    renderRequestsList();
    showView("requests");
  }

  requestsNavItems.forEach(item => {
    item.addEventListener("click", () => {
      currentRequestFilter = item.dataset.filter;
      setActiveNavItem(currentRequestFilter);
      currentSearchQuery = "";
      requestsSearchInput.value = "";
      meterSelection.clear();
      setMeterMode("pending");
      generalSelection.clear();
      setGeneralMode("pending");
      renderRequestsList();
    });
  });

  function setMeterMode(mode) {
    meterMode = mode;
    meterModeBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.meterMode === mode));
    requestsSearchInput.placeholder = mode === "history"
      ? "ค้นหาสมุดคุมด้วยเลขที่คำร้อง, ชื่อลูกค้า, ชื่อผู้ส่ง/ผู้รับ..."
      : "ค้นหาด้วยเลขที่คำร้อง, ชื่อลูกค้า, เบอร์โทร, บ้านเลขที่, เลขที่โฉนด...";
  }

  meterModeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (meterMode === btn.dataset.meterMode) return;
      setMeterMode(btn.dataset.meterMode);
      // A query typed against one list means nothing against the other.
      currentSearchQuery = "";
      requestsSearchInput.value = "";
      meterSelection.clear();
      renderRequestsList();
    });
  });

  /** เหมือน setMeterMode ด้านบน แต่ของแท็บคำร้องทั่วไป */
  function setGeneralMode(mode) {
    generalMode = mode;
    generalModeBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.generalMode === mode));
    requestsSearchInput.placeholder = mode === "history"
      ? "ค้นหาสมุดคุมด้วยเรื่อง, ชื่อลูกค้า, ชื่อผู้ส่ง/ผู้รับ..."
      : "ค้นหาด้วยเลขที่คำร้อง, ชื่อลูกค้า, เบอร์โทร, บ้านเลขที่, เลขที่โฉนด...";
  }

  generalModeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (generalMode === btn.dataset.generalMode) return;
      setGeneralMode(btn.dataset.generalMode);
      currentSearchQuery = "";
      requestsSearchInput.value = "";
      generalSelection.clear();
      renderRequestsList();
    });
  });

  requestsSearchInput.addEventListener("input", () => {
    currentSearchQuery = requestsSearchInput.value.trim();
    renderRequestsList();
  });

  meterPrintBtn.addEventListener("click", async () => {
    const selected = getRequests().filter(r => meterSelection.has(r.id));
    if (!selected.length) return;
    await openMeterDispatchPrint(selected);
  });

  generalPrintBtn.addEventListener("click", async () => {
    const selected = getRequests().filter(r => generalSelection.has(r.id));
    if (!selected.length) return;
    await openGeneralDispatchPrint(selected);
  });

  function fillRequestForm(r) {
    fillingForm = true;
    document.getElementById("reqNumber").value = r.requestNumber || "";
    document.getElementById("reqDate").value = r.receivedDate || "";
    document.getElementById("reqBP").value = r.bp || "";
    document.getElementById("reqCA").value = r.ca || "";
    document.getElementById("reqCustomerName").value = r.customerName || "";
    document.getElementById("reqPhonePrimary").value = r.phonePrimary || "";
    document.getElementById("reqPhoneSecondary").value = r.phoneSecondary || "";

    const districtKey = Object.keys(DISTRICTS).find(key => DISTRICTS[key].label === r.district);
    if (districtKey) {
      reqDistrict.value = districtKey;
      reqDistrict.dispatchEvent(new Event("change"));
      reqSubdistrict.value = r.subdistrict || "";
      reqSubdistrict.dispatchEvent(new Event("change"));
    }

    document.getElementById("reqMoo").value = r.moo || "";
    document.getElementById("reqHouseNo").value = r.houseNo || "";
    document.getElementById("reqVillage").value = r.village || "";
    document.getElementById("reqDeed").value = r.deed || "";

    // A saved purpose is either one of the fixed option values, or free
    // text typed into "อื่นๆ" -- in the latter case the option itself must
    // be set to "other" before the text can be restored into its field.
    // A record with no purpose at all (only possible pre-dating this field)
    // is left at the reset default instead of being forced into "other".
    if (r.purpose) {
      const purposeOptionValues = Array.from(reqPurpose.options).map(o => o.value);
      reqPurpose.value = purposeOptionValues.includes(r.purpose) ? r.purpose : "other";
      reqPurpose.dispatchEvent(new Event("change"));
      if (reqPurpose.value === "other") {
        reqPurposeOther.value = r.purpose;
      }
    }

    document.getElementById("reqMeterSize").value = r.meterSize || "";
    document.getElementById("reqFee").value = r.fee || "";
    document.getElementById("reqJobStatus").value = r.jobStatus || "รอตรวจสอบ";
    document.getElementById("reqNote").value = r.note || "";

    reqCoord.value = formatCoordText(r.lat, r.lng);
    updateReqCoords();
    updateReqPhonePrimaryCall();
    updateReqPhoneSecondaryCall();
    fillingForm = false;
  }

  /** เหมือน fillRequestForm ด้านบนแต่สำหรับ #extendForm -- ชุดฟิลด์ไม่เหมือนกัน */
  function fillExtendForm(r) {
    fillingForm = true;
    document.getElementById("extNumber").value = r.requestNumber || "";
    extDate.value = r.receivedDate || "";
    document.getElementById("extCustomerName").value = r.customerName || "";
    document.getElementById("extPhonePrimary").value = r.phonePrimary || "";
    document.getElementById("extPhoneSecondary").value = r.phoneSecondary || "";
    const extDistrictKey = Object.keys(DISTRICTS).find(key => DISTRICTS[key].label === r.district);
    if (extDistrictKey) {
      extDistrict.value = extDistrictKey;
      extDistrict.dispatchEvent(new Event("change"));
      extSubdistrict.value = r.subdistrict || "";
      extSubdistrict.dispatchEvent(new Event("change"));
    }

    document.getElementById("extHouseNo").value = r.houseNo || "";
    document.getElementById("extMoo").value = r.moo || "";
    document.getElementById("extVillage").value = r.village || "";
    document.getElementById("extLocation").value = r.location || "";
    document.getElementById("extPurpose").value = r.purpose || "";
    extJobStatus.value = r.jobStatus || "รอจ่ายงาน";
    // ต้องยิง change เอง -- ตัวจัดการที่ซ่อน/แสดง #extAssigneeField ฟังอีเวนต์นี้
    extJobStatus.dispatchEvent(new Event("change"));
    // อ่านอย่างเดียว -- ตั้งค่าได้จากหน้าจ่ายงานเท่านั้น (ดู assignRequests_)
    document.getElementById("extAssignee").value = r.assignee || "";
    // มีเลขแล้วใช้เลขเดิม ยังไม่มีก็เดาเลขถัดไปของปีนี้ให้ (แก้ทับได้)
    extWbs.value = r.wbs || nextWbs();
    extApprovalNo.value = r.approvalNo || "";
    extApprovalDate.value = r.approvalDate || "";
    document.getElementById("extNote").value = r.note || "";

    extCoord.value = formatCoordText(r.lat, r.lng);
    extDeed.value = r.deed || "";
    updateExtCoords();
    updateExtPhonePrimaryCall();
    updateExtPhoneSecondaryCall();
    fillingForm = false;
  }

  /** เหมือน fillRequestForm/fillExtendForm ด้านบน แต่ของ #generalForm -- ชุดฟิลด์เล็กกว่ามาก */
  function fillGeneralForm(r) {
    document.getElementById("genSubject").value = r.subject || "";
    genDate.value = r.receivedDate || "";
    document.getElementById("genCustomerName").value = r.customerName || "";
    document.getElementById("genPhone").value = r.phonePrimary || "";
    genJobStatus.value = r.jobStatus || "รอส่ง ผสน.";
    document.getElementById("genSentDate").value = r.sentDate || "";
    document.getElementById("genDepartment").value = r.department || "";
    document.getElementById("genNote").value = r.note || "";
    updateGenPhoneCall();
  }

  // คำร้องที่การ์ดสรุปกำลังอธิบายอยู่ -- เก็บไว้เพื่อให้ปุ่มคัดลอกอ่านจากข้อมูลชุดเดียวกับที่วาดบนจอ
  let summaryRecord = null;

  /**
   * บรรทัดของการ์ดสรุป คืนเป็น {label, value} เพื่อให้ทั้งการวาดบนจอและ
   * ข้อความที่ปุ่มคัดลอกส่งออกไป อ่านจากชุดเดียวกัน จะได้ไม่หลุดกันเมื่อเพิ่มบรรทัดใหม่
   *
   * ตั้งใจเลือกเฉพาะที่จำเป็นต่อการตามงาน -- ยังไม่ใส่ BP/CA และเลขโฉนด เพราะภาพที่แคปไป
   * จะหลุดออกนอกระบบไปอยู่ในแชท และจะถูกส่งต่อได้เรื่อย ๆ โดยที่เราตามต่อไม่ได้
   * ส่วนเบอร์โทรกับพิกัดเป็นการตัดสินใจของเจ้าของระบบเอง หลังชั่งข้อแลกเปลี่ยนนี้แล้ว
   * (ผู้รับผิดชอบต้องโทรและต้องนำทางจากหน้างานได้) บรรทัดที่จะเพิ่มทีหลังควรผ่านเกณฑ์เดียวกัน
   */
  function summaryLines(record) {
    // คำร้องทั่วไปไม่มีเลขที่คำร้อง/เลขระบบ/ความประสงค์/ที่อยู่/พิกัด/ผู้รับผิดชอบ
    // เลยสักอย่าง -- แทนที่จะพยายามยัดชุดเดียวกันแล้วขึ้น "-" เต็มไปหมด แยกชุด
    // บรรทัดของตัวเองไปเลย อ่านตรงกับสิ่งที่ฟอร์มนี้เก็บจริง
    if (record.type === "general") {
      return [
        { label: "เรื่อง", value: record.subject || "-" },
        { label: "วันที่ยื่นเรื่อง", value: formatThaiDate(record.receivedDate), mono: true },
        { label: "ชื่อลูกค้า", value: record.customerName || "-" },
        {
          label: "เบอร์โทรศัพท์",
          value: record.phonePrimary || "-",
          href: record.phonePrimary ? `tel:${record.phonePrimary}` : ""
        },
        { label: "สถานะ", value: record.jobStatus || "-", status: true },
        {
          label: "วันที่ส่ง ผสน.",
          value: record.sentDate ? formatThaiDate(record.sentDate) : "-",
          mono: true
        },
        { label: "แผนกที่รับผิดชอบ", value: record.department || "-" }
      ];
    }

    const lines = [
      { label: "เลขที่คำร้อง", value: record.requestNumber || "-", mono: true },
      { label: "เลขที่คำร้อง (ระบบ)", value: record.trackingNumber || "-", mono: true },
      { label: "วันที่รับคำร้อง", value: formatThaiDate(record.receivedDate), mono: true },
      { label: "ชื่อลูกค้า", value: record.customerName || "-" },
      // ผู้รับผิดชอบมักอ่านการ์ดนี้ตอนอยู่หน้างานบนมือถือ ทำเป็นลิงก์ tel: ให้กดโทรได้เลย
      // ส่วนในภาพที่แคปไปมันก็อ่านเป็นตัวเลขธรรมดาเหมือนบรรทัดอื่น
      {
        label: "เบอร์โทรศัพท์",
        value: record.phonePrimary || "-",
        href: record.phonePrimary ? `tel:${record.phonePrimary}` : ""
      },
      { label: "ความประสงค์", value: record.purpose || "-" },
      {
        label: record.type === "extend" ? "สถานที่ขอขยายเขตฯ" : "สถานที่ขอใช้ไฟฟ้า",
        value: buildLocationText(record) || "-"
      },
      { label: "สถานะงาน", value: record.jobStatus || "-", status: true }
    ];

    // มีเฉพาะคำร้องที่กรอกพิกัดไว้ -- ไม่ขึ้นขีดว่างให้รกในใบที่ไม่มี
    // ลิงก์ไปหน้านำทางของ Google Maps ชุดเดียวกับปุ่ม "นำทาง" ในฟอร์ม (ไม่ต้องใช้ API key)
    const coordText = formatCoordText(record.lat, record.lng);
    if (coordText) {
      lines.splice(lines.length - 1, 0, {
        label: "พิกัด",
        value: coordText,
        mono: true,
        href: "https://www.google.com/maps/dir/?api=1&destination="
          + encodeURIComponent(`${record.lat},${record.lng}`)
      });
    }

    // ขอใช้ไฟฟ้าไม่มีการจ่ายงาน ช่องนี้จึงว่างเสมอ -- แสดงเฉพาะคำร้องขยายเขตฯ
    // (ที่ยังไม่จ่ายก็ต้องตอบได้ว่ายังไม่จ่าย) หรือคำร้องที่มีชื่อคนรับผิดชอบติดอยู่จริง
    if (record.type === "extend" || record.assignee) {
      lines.push({ label: "ผู้รับผิดชอบ", value: record.assignee || "ยังไม่ได้จ่ายงาน" });
    }

    return lines;
  }

  function renderRequestSummary(record) {
    summaryRecord = record;
    requestSummaryType.textContent = recordTypeLabel(record.type) || "คำร้อง";
    requestSummaryList.innerHTML = "";

    summaryLines(record).forEach(line => {
      const dt = document.createElement("dt");
      dt.textContent = line.label;

      const dd = document.createElement("dd");
      if (line.status) {
        const badge = document.createElement("span");
        badge.className = `request-badge request-badge-status tone-${JOB_STATUS_TONE[record.jobStatus] || "info"}`;
        badge.textContent = line.value;
        dd.appendChild(badge);
      } else if (line.href) {
        const link = document.createElement("a");
        link.className = "req-summary-link";
        if (line.mono) link.classList.add("req-summary-mono");
        link.href = line.href;
        if (!line.href.startsWith("tel:")) {
          link.target = "_blank";
          link.rel = "noopener";
        }
        link.textContent = line.value;
        dd.appendChild(link);
      } else {
        if (line.mono) dd.classList.add("req-summary-mono");
        dd.textContent = line.value;
      }

      requestSummaryList.append(dt, dd);
    });
  }

  // บางครั้งข้อความสะดวกกว่าภาพ (ค้นซ้ำได้ ส่งต่อได้) จึงให้ทางเลือกไว้ทั้งสองทาง
  requestSummaryCopyBtn.addEventListener("click", async () => {
    if (!summaryRecord) return;

    const text = [recordTypeLabel(summaryRecord.type) || "คำร้อง"]
      .concat(summaryLines(summaryRecord).map(line => `${line.label}: ${line.value}`))
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      requestSummaryCopyBtn.textContent = "คัดลอกแล้ว";
    } catch (err) {
      requestSummaryCopyBtn.textContent = "คัดลอกไม่สำเร็จ";
    }

    setTimeout(() => {
      requestSummaryCopyBtn.textContent = "คัดลอกข้อความ";
    }, 1600);
  });

  // One stamp per status the record has been through, oldest first so the
  // newest change reads at the bottom. Records saved before statusHistory
  // existed fall back to a single un-attributed pill for their current status.
  function renderStatusHistory(record) {
    const history = Array.isArray(record.statusHistory) && record.statusHistory.length
      ? record.statusHistory
      : (record.jobStatus ? [{ status: record.jobStatus }] : []);

    requestFormStatusHistory.innerHTML = "";

    history.forEach(entry => {
      const stamp = document.createElement("div");
      stamp.className = "status-stamp";

      const badge = document.createElement("span");
      badge.className = `request-badge request-badge-status tone-${JOB_STATUS_TONE[entry.status] || "info"}`;
      badge.textContent = entry.status || "-";

      // Name and timestamp read as one muted phrase, same as a comment's
      // byline, rather than being pushed to opposite ends of the row.
      const by = document.createElement("span");
      by.className = "status-stamp-by";
      by.textContent = `${entry.byName || "-"} · ${formatThaiDateTime(entry.at)}`;

      stamp.append(badge, by);
      requestFormStatusHistory.appendChild(stamp);
    });
  }

  // Work-log comments, oldest first. Kept as their own stream on the record
  // rather than folded into statusHistory, since a comment doesn't have to
  // accompany a status change.
  function renderComments(record) {
    requestFormComments.innerHTML = "";

    (record.comments || []).forEach(entry => {
      const item = document.createElement("div");
      item.className = "comment-item";

      const text = document.createElement("div");
      text.className = "comment-text";
      text.textContent = entry.text;

      const by = document.createElement("div");
      by.className = "comment-by";
      by.textContent = `${entry.byName || "-"} · ${formatThaiDateTime(entry.at)}`;

      item.append(text, by);
      requestFormComments.appendChild(item);
    });
  }

  // Comments save on their own, straight to the record -- they're an
  // independent stream, so adding one shouldn't require the main form to
  // pass validation first.
  document.getElementById("requestCommentBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    hideError(requestCommentError);

    try {
      const text = requestCommentInput.value.trim();

      if (!text) {
        showError(requestCommentError, "กรุณากรอกคอมเมนต์");
        return;
      }

      const requests = getRequests();
      const idx = requests.findIndex(r => r.id === editingId);

      if (idx === -1) {
        showError(requestCommentError, "ไม่พบคำร้องนี้ กรุณาเปิดคำร้องใหม่อีกครั้ง");
        return;
      }

      const comments = Array.isArray(requests[idx].comments) ? requests[idx].comments.slice() : [];
      comments.push({ text, ...actingStaff(), at: Date.now() });
      requests[idx] = { ...requests[idx], comments };

      // คอมเมนต์วิ่งผ่านเครือข่ายเหมือนการบันทึกคำร้อง ปุ่มจึงต้องบอกว่ากำลัง
      // ทำงานและกดซ้ำไม่ได้แบบเดียวกัน -- ปุ่มที่กดแล้วนิ่งไปเฉย ๆ ทำให้คนกดไม่
      // แน่ใจว่ากดติดหรือยัง แล้วกดซ้ำ ซึ่งจะได้คอมเมนต์ซ้ำสองบรรทัด
      setBusy(btn, true, "กำลังบันทึก...");
      await saveRequests(requests);

      requestCommentInput.value = "";
      renderComments(requests[idx]);
    } catch (err) {
      console.error("CS Connect comment error:", err);
      showError(requestCommentError, "เกิดข้อผิดพลาด ไม่สามารถบันทึกคอมเมนต์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(btn, false);
    }
  });

  let batchRowSeq = 0;

  /**
   * Builds the "แก้ไขเพิ่มเติม" panel for one row by cloning the shared form's
   * own fields, seeded with whatever is currently entered above. Cloning
   * rather than re-declaring the markup is what keeps the dropdowns identical
   * to the main form forever; ids are suffixed so the clones stay unique and
   * their labels keep working. Built only when a row is actually expanded, so
   * a batch where nothing differs costs nothing.
   */
  /**
   * โคลน .field ทุกช่องจากฟอร์มตั้งต้นเข้ามาในแถว พร้อมค่าเริ่มต้นจากฟอร์มนั้น
   *
   * ที่ต้องโคลนไม่ใช่เขียน markup ใหม่: รายการตัวเลือกของ อำเภอ/ตำบล/ความประสงค์/
   * ขนาดมิเตอร์/สถานะงาน จะไม่มีวันไม่ตรงกับฟอร์มหลัก และช่องใหม่ที่เพิ่มเข้าฟอร์ม
   * ในอนาคตจะมาเองแค่เพิ่มบรรทัดใน BATCH_ROW_FIELDS
   */
  function buildBatchRowFields(seq, grid) {
    BATCH_ROW_FIELDS.forEach(({ id, key }) => {
      const source = document.getElementById(id);
      const wrapper = source.closest(".field").cloneNode(true);
      const control = wrapper.querySelector("input, select, textarea");
      const label = wrapper.querySelector("label");

      const clonedId = `${id}__row${seq}`;
      wrapper.removeAttribute("id");
      control.id = clonedId;
      if (label) label.setAttribute("for", clonedId);
      control.dataset.batchKey = key;

      // เลขที่คำร้องเริ่มว่างเสมอ ที่เหลือรับค่ามาจากฟอร์มตั้งต้น
      // ตำบลอาศัยตัวเลือกที่ถูกสร้างไว้แล้วตามอำเภอที่เลือก การโคลนจึงพาค่ามาด้วย
      control.value = BATCH_NEVER_PREFILL.has(key) ? "" : source.value;
      control.disabled = source.disabled;
      wrapper.hidden = false;

      grid.appendChild(wrapper);
    });

    const districtEl = grid.querySelector('[data-batch-key="district"]');
    const subdistrictEl = grid.querySelector('[data-batch-key="subdistrict"]');
    const zipcodeEl = grid.querySelector('[data-batch-key="zipcode"]');
    wireLocationCascade(districtEl, subdistrictEl, zipcodeEl);

    const purposeEl = grid.querySelector('[data-batch-key="purposeChoice"]');
    purposeEl.addEventListener("change", () => syncBatchRowConditionalFields(grid));

    // ทุกใบในกลุ่มมีความประสงค์/ขนาดมิเตอร์/ค่าธรรมเนียมของตัวเอง จึงต้องได้
    // ค่าธรรมเนียมอัตโนมัติเหมือนฟอร์มเดี่ยว
    wireFeeAutofill(
      purposeEl,
      grid.querySelector('[data-batch-key="meterSize"]'),
      grid.querySelector('[data-batch-key="fee"]')
    );

    syncBatchRowConditionalFields(grid);
  }

  /** ช่อง "โปรดระบุ" ของความประสงค์โผล่เฉพาะตอนเลือก "อื่นๆ" เหมือนฟอร์มหลัก */
  function syncBatchRowConditionalFields(scope) {
    const purposeEl = scope.querySelector('[data-batch-key="purposeChoice"]');
    const otherEl = scope.querySelector('[data-batch-key="purposeOther"]');
    if (!purposeEl || !otherEl) return;
    otherEl.closest(".field").hidden = purposeEl.value !== "other";
  }

  /**
   * หนึ่งแถว = คำร้องหนึ่งใบเต็ม ๆ ทุกช่องแสดงให้เห็นและกรอกมาจากข้อมูลตั้งต้นแล้ว
   *
   * เดิมแถวมีแค่ 4 ช่อง ที่เหลือซ่อนอยู่หลังปุ่ม "แก้ไขเพิ่มเติม" และช่องที่เว้น
   * ว่างจะไปหยิบค่าจากฟอร์มด้านบนตอนบันทึก -- ซึ่งแปลว่าสิ่งที่เห็นบนจอไม่ตรงกับ
   * สิ่งที่จะถูกบันทึกจริง คนกรอกจึงเดาไม่ออกว่าคำร้องแต่ละใบจะออกมาหน้าตาแบบไหน
   * ตอนนี้ช่องทุกช่องมีค่าจริงอยู่ในนั้น สิ่งที่เห็นคือสิ่งที่จะถูกบันทึก
   */
  function addBatchRow() {
    const seq = ++batchRowSeq;

    const row = document.createElement("div");
    row.className = "batch-row";
    row.dataset.batchRowSeq = String(seq);

    const head = document.createElement("div");
    head.className = "batch-row-head";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "batch-toggle-btn";

    const title = document.createElement("span");
    title.className = "batch-row-title";

    // เห็นเฉพาะตอนย่อ -- ถ้าย่อแล้วเหลือแต่ "คำร้องที่ 3" ก็ไม่รู้ว่าใบไหนเป็นใบไหน
    const summary = document.createElement("span");
    summary.className = "batch-row-summary";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "batch-remove-btn";
    removeBtn.textContent = "ลบคำร้องนี้";
    removeBtn.addEventListener("click", () => {
      row.remove();
      renumberBatchRows();
    });

    head.append(toggleBtn, title, summary, removeBtn);

    const grid = document.createElement("div");
    grid.className = "batch-row-grid";
    buildBatchRowFields(seq, grid);

    row.append(head, grid);

    toggleBtn.addEventListener("click", () => setBatchRowCollapsed(row, !row.classList.contains("is-collapsed")));
    title.addEventListener("click", () => setBatchRowCollapsed(row, !row.classList.contains("is-collapsed")));
    setBatchRowCollapsed(row, false);
    batchRows.appendChild(row);
    renumberBatchRows();
  }

  function batchEntryRows() {
    return Array.from(batchRows.children);
  }

  /**
   * ย่อ/ขยายคำร้องหนึ่งใบ
   *
   * ใช้ hidden กับ .batch-row-grid ไม่ใช่การถอดออกจาก DOM -- ช่องกรอกต้องยังอยู่
   * ครบ ไม่งั้นค่าที่พิมพ์ไว้จะหายและ collectBatchRows() จะอ่านไม่เจอ
   *
   * .batch-row-grid ตั้ง display: grid ไว้ จึงต้องมี .batch-row-grid[hidden]
   * ใน style.css คู่กันเสมอ ไม่งั้น hidden จะไม่มีผลอะไรเลย (ดูหัวข้อ Gotcha)
   */
  function setBatchRowCollapsed(row, collapsed) {
    row.classList.toggle("is-collapsed", collapsed);
    row.querySelector(".batch-row-grid").hidden = collapsed;

    const toggleBtn = row.querySelector(".batch-toggle-btn");
    toggleBtn.textContent = collapsed ? "ขยาย" : "ย่อ";
    toggleBtn.setAttribute("aria-expanded", String(!collapsed));

    const summary = row.querySelector(".batch-row-summary");
    if (!collapsed) {
      summary.textContent = "";
      return;
    }

    const read = key => (row.querySelector(`[data-batch-key="${key}"]`)?.value || "").trim();
    const parts = [read("requestNumber"), read("customerName"), read("houseNo")].filter(Boolean);
    summary.textContent = parts.length ? parts.join(" · ") : "(ยังไม่ได้กรอก)";
  }

  /** เปิดใบที่มีปัญหาให้เห็น -- ข้อความบอกว่าใบไหนผิด แต่ถ้ามันถูกย่ออยู่ก็หาไม่เจอ */
  function expandBatchRow(row) {
    setBatchRowCollapsed(row, false);
    row.scrollIntoView({ block: "center" });
  }

  function setAllBatchRowsCollapsed(collapsed) {
    batchEntryRows().forEach(row => setBatchRowCollapsed(row, collapsed));
  }

  function renumberBatchRows() {
    batchEntryRows().forEach((row, i) => {
      row.querySelector(".batch-row-title").textContent = `คำร้องที่ ${i + 1}`;
    });
  }

  /** คัดลอกข้อมูลตั้งต้นด้านบนลงทุกแถว ทับค่าที่พิมพ์ไว้ (ยกเว้นเลขที่คำร้อง) */
  function applySharedToBatchRows() {
    batchEntryRows().forEach(row => {
      BATCH_ROW_FIELDS.forEach(({ id, key }) => {
        if (BATCH_NEVER_PREFILL.has(key)) return;
        const target = row.querySelector(`[data-batch-key="${key}"]`);
        const source = document.getElementById(id);
        if (!target || !source) return;

        target.value = source.value;

        // อำเภอ/ตำบลต้องยิง change ต่อ เพื่อให้ตัวเลือกตำบลถูกสร้างใหม่ตามอำเภอ
        // ที่เพิ่งตั้ง และรหัสไปรษณีย์ถูกเติมตาม -- ถ้าไม่ยิง การตั้งค่าตำบลจะ
        // เงียบ ๆ ไม่ติด เพราะ option ของตำบลนั้นยังไม่มีอยู่ในแถว (ลำดับใน
        // BATCH_ROW_FIELDS จึงต้องเป็น อำเภอ -> ตำบล -> รหัสไปรษณีย์ เสมอ)
        if (key === "district" || key === "subdistrict") {
          target.dispatchEvent(new Event("change"));
          target.value = source.value;
        }

        target.disabled = source.disabled;
      });
      syncBatchRowConditionalFields(row);
    });
  }

  document.getElementById("batchApplySharedBtn").addEventListener("click", () => {
    applySharedToBatchRows();
    // ค่าที่โชว์ตอนย่อเพิ่งเปลี่ยนไปด้วย ต้องวาดใหม่ให้ตรง
    batchEntryRows().forEach(row => {
      if (row.classList.contains("is-collapsed")) setBatchRowCollapsed(row, true);
    });
    hideError(requestFormError);
  });

  document.getElementById("batchCollapseAllBtn").addEventListener("click", () => {
    // ดูจากใบแรกว่าตอนนี้อยู่สถานะไหน แล้วสลับทั้งกลุ่มไปทางตรงข้าม
    const anyExpanded = batchEntryRows().some(row => !row.classList.contains("is-collapsed"));
    setAllBatchRowsCollapsed(anyExpanded);
    document.getElementById("batchCollapseAllBtn").textContent =
      anyExpanded ? "ขยายทุกคำร้อง" : "ย่อทุกคำร้อง";
  });

  function resetBatchRows() {
    batchRows.innerHTML = "";
    batchRowSeq = 0;
    for (let i = 0; i < BATCH_DEFAULT_ROWS; i++) addBatchRow();
    document.getElementById("batchCollapseAllBtn").textContent = "ย่อทุกคำร้อง";
  }

  /**
   * Reads the rows table, dropping any row left entirely blank so staff never
   * has to tidy up spare rows before saving. Values omitted on a row fall back
   * to the shared form above -- that fallback is the whole point of the
   * design: everything defaults to one shared set, and only the exceptions
   * get typed.
   */
  /**
   * ค่าที่กรอกไว้ในแต่ละแถว -- ไม่มีการไปหยิบค่าจากฟอร์มตั้งต้นมาเติมตอนนี้อีกแล้ว
   * เพราะทุกช่องถูกกรอกให้ตั้งแต่ตอนสร้างแถว สิ่งที่อ่านได้จึงตรงกับที่เห็นบนจอ
   *
   * ข้ามแถวที่ "ว่างทั้งใบ" โดยดูจากช่องที่ระบุตัวคำร้องเท่านั้น -- ช่องอื่นมีค่า
   * ติดมาจากข้อมูลตั้งต้นอยู่แล้วทุกแถว จะเอามาใช้ตัดสินว่าว่างหรือไม่ไม่ได้
   */
  function collectBatchRows() {
    return batchEntryRows()
      .map((el, i) => {
        const values = {};
        el.querySelectorAll("[data-batch-key]").forEach(control => {
          values[control.dataset.batchKey] = control.value.trim();
        });
        // position คือเลขที่แสดงบนการ์ด ไม่ใช่ลำดับหลังกรองใบว่างออก -- ข้อความ
        // แจ้งเตือนต้องชี้ใบที่ผู้ใช้เห็นจริง ไม่ใช่ลำดับภายในของอาร์เรย์
        return { el, position: i + 1, values };
      })
      .filter(({ values: v }) => [v.requestNumber, v.customerName, v.houseNo, v.phonePrimary].some(Boolean));
  }

  /** Opens qr.html for one or many requests -- it switches to a printable grid past one. */
  function openQrLabels(trackingNumbers) {
    const list = trackingNumbers.filter(Boolean).join(",");
    if (!list) return;
    window.open(`qr.html?tn=${encodeURIComponent(list)}`, "_blank");
  }

  /**
   * Replaces the form with a summary of what was just created. The QR button
   * is here because printing the whole batch's labels in one go is the one
   * thing that is much easier now than it will be later -- everything else
   * about these records is reachable from the normal list.
   */
  function showBatchResult(created) {
    const numbers = created.map(r => r.trackingNumber);
    requestForm.hidden = true;
    batchResult.hidden = false;

    document.getElementById("batchResultTitle").textContent = `บันทึก ${created.length} คำร้องเรียบร้อย`;
    document.getElementById("batchResultDetail").textContent =
      `เลขที่คำร้อง (ระบบ): ${numbers[0]} - ${numbers[numbers.length - 1]} · เปิดคำร้องรายใบเพื่อแก้ไขส่วนที่ต่างจากกลุ่มได้ตามปกติ`;

    const qrBtn = document.getElementById("batchResultQrBtn");
    qrBtn.textContent = `พิมพ์ QR ทั้งกลุ่ม (${created.length} ใบ)`;
    qrBtn.onclick = () => openQrLabels(numbers);
    document.getElementById("batchResultDoneBtn").onclick = () => renderRequestsList();
  }

  /**
   * ล้าง #extendForm ให้กลับไปเป็นฟอร์มเปล่าทุกสถานะ ไม่ใช่แค่ .reset() ธรรมดา --
   * ฟอร์มนี้มีสถานะที่ซ่อนอยู่นอกตัว <form> เองด้วย (รายการแผนผังที่แนบไว้,
   * รูปหน้างานสองรูป, สรุปใบประมาณการ, ป้ายผู้รับผิดชอบ) ซึ่งถ้าไม่ล้างพร้อมกัน
   * คำร้องใบก่อนจะยังค้างอยู่ในองค์ประกอบเหล่านั้นแม้ตัว <form> เองจะว่างแล้ว
   *
   * แยกออกมาเป็นฟังก์ชันเดียว เรียกได้ทั้งตอนเปิดฟอร์มใหม่ (openRequestForm)
   * และตอนออกจากระบบ (clearWorkspaceScreens) -- ทำให้สองจุดนี้ล้างเหมือนกัน
   * เป๊ะเสมอโดยไม่ต้องคอยจำแก้คู่กัน ก่อนหน้านี้ clearWorkspaceScreens ไม่เคย
   * เรียกส่วนนี้เลย ทำให้ข้อมูลลูกค้าที่พิมพ์ค้างไว้ในฟอร์มขยายเขตฯ ยังอยู่ใน DOM
   * ต่อ แม้จอจะกลับไปเป็นหน้า login แล้วก็ตาม -- อ่านได้ทันทีผ่านเครื่องมือ
   * พัฒนาของเบราว์เซอร์ โดยไม่ต้องล็อกอินเลยด้วยซ้ำ
   */
  function resetExtendFormState() {
    hideError(extendFormError);
    extendForm.reset();
    resetExtendLocationFields();
    setDefaultExtendDate();
    // .reset() ล้างค่าในช่อง แต่ไม่ยิง input event -- ปุ่มเปิดแผนที่/นำทาง/โทรออก
    // ต้องสั่งคำนวณใหม่เองไม่งั้นจะค้างสถานะของคำร้องก่อนหน้า
    updateExtCoords();
    updateExtPhonePrimaryCall();
    updateExtPhoneSecondaryCall();
    // คำร้องใหม่เริ่มที่ "รอจ่ายงาน" -- ยังไม่มีทั้งผู้รับผิดชอบ WBS และแผนผัง
    extendFormRecord = null;
    extAssigneeField.hidden = true;
    extWbsField.hidden = true;
    extPlanSection.hidden = true;
    extPhotoSection.hidden = true;
    extApprovalField.hidden = true;
    hideError(extPhotoError);
    extPhotoSuccess.hidden = true;
    document.getElementById("extSitePhotoFile").value = "";
    document.getElementById("extRoutePhotoFile").value = "";
    extEstimateSection.hidden = true;
    extPlanCurrent.textContent = "";
    extPlanList.innerHTML = "";
    extPlanFile.value = "";
    hideError(extPlanError);
    extPlanSuccess.hidden = true;
    // ใช้เส้นทางเดียวกับตอนแสดงรูปของคำร้องจริง -- record ว่าง = ทุกฟิลด์เป็น
    // undefined เท่ากับ "ไม่มีรูป" ในทุกกิ่งของฟังก์ชัน จึงซ่อน preview, โชว์
    // สถานะว่าง และล้าง src ทิ้งให้ครบเหมือนกันทั้งสองจุดโดยไม่ต้องเขียนซ้ำ
    renderExtendPhotos({});
  }

  /** เหมือน resetExtendFormState ด้านบน แต่ของ #generalForm -- สถานะซ่อนน้อยกว่ามาก */
  function resetGeneralFormState() {
    hideError(generalFormError);
    generalForm.reset();
    setDefaultGeneralDate();
    updateGenPhoneCall();
  }

  function openRequestForm(type, record, options = {}) {
    currentAddType = type;
    editingId = record ? record.id : null;
    pendingNewId = null;
    formReturnTo = options.returnTo || "requests";
    // เพิ่มหลายคำร้องมีเฉพาะขอใช้ไฟฟ้า -- ปุ่มที่ส่ง { batch: true } มา ก็ถูก
    // ซ่อนไว้แล้วสำหรับแท็บอื่น (ดู renderRequestsList) การ์ดนี้กันไว้อีกชั้น
    batchMode = Boolean(options.batch) && type === "power";
    hideError(requestFormError);
    requestForm.reset();
    resetLocationFields();
    resetPurposeFields();
    setDefaultRequestDate();
    updateReqCoords();
    updateReqPhonePrimaryCall();
    updateReqPhoneSecondaryCall();
    resetExtendFormState();
    resetGeneralFormState();

    const isSupported = FORM_SUPPORTED_TYPES.has(type);
    const isPower = type === "power";
    const isExtend = type === "extend";
    const isGeneral = type === "general";

    requestFormTitle.textContent = batchMode
      ? `เพิ่มหลายคำร้อง: ${recordTypeLabel(type)}`
      : `${record ? "แก้ไขคำร้อง" : "เพิ่มคำร้อง"}: ${recordTypeLabel(type)}`;
    requestFormSubtitle.textContent = !isSupported
      ? "แบบฟอร์มสำหรับประเภทนี้อยู่ระหว่างการพัฒนา"
      : batchMode
        ? "กรอกข้อมูลที่ใช้ร่วมกันด้านบน แล้วใส่เฉพาะส่วนที่ต่างกันในตารางด้านล่าง"
        : (record ? "แก้ไขรายละเอียดคำร้อง" : "กรอกรายละเอียดคำร้องใหม่");
    requestFormSubmitBtn.textContent = batchMode
      ? "บันทึกทั้งกลุ่ม"
      : (record ? "บันทึกการแก้ไข" : "บันทึกคำร้อง");
    // ขอขยายเขตฯ และคำร้องทั่วไปไม่มีโหมดกลุ่ม ปุ่มของมันจึงมีแค่สองข้อความ
    extendFormSubmitBtn.textContent = record ? "บันทึกการแก้ไข" : "บันทึกคำร้อง";
    generalFormSubmitBtn.textContent = record ? "บันทึกการแก้ไข" : "บันทึกคำร้อง";

    requestForm.hidden = !(isSupported && isPower);
    extendForm.hidden = !(isSupported && isExtend);
    generalForm.hidden = !(isSupported && isGeneral);
    requestFormPlaceholder.hidden = isSupported;

    batchResult.hidden = true;
    batchSection.hidden = !(isSupported && isPower && batchMode);
    // Every paper form in a batch carries its own เลขที่คำร้อง, so a single
    // shared value would be wrong by definition -- it moves into the table.
    document.getElementById("reqNumberField").hidden = batchMode;
    if (isSupported && isPower && batchMode) resetBatchRows();

    if (isSupported && isPower) {
      // In batch mode each row gets its own number at save time, so the
      // single-record preview field would be misleading here.
      const trackingField = document.getElementById("reqTrackingNumber");
      trackingField.value = batchMode
        ? "ระบบจะออกเลขให้ทีละใบตอนบันทึก"
        : (record ? (record.trackingNumber || "-") : generateTrackingNumber("power"));
    }

    if (isSupported && isExtend) {
      // คำร้องเก่าที่บันทึกไว้ก่อนมี QR ยังไม่มีเลขระบบ -- ออกให้ตรงนี้เลย
      // (จะถูกบันทึกจริงเมื่อกดบันทึกคำร้อง) ลูกค้ารายนั้นจึงติดตามสถานะได้ด้วย
      extTrackingNumber.value = record
        ? (record.trackingNumber || generateTrackingNumber("extend"))
        : generateTrackingNumber("extend");
    }

    if (isSupported && isPower && record) {
      fillRequestForm(record);
    }
    if (isSupported && isExtend && record) {
      extendFormRecord = record;
      fillExtendForm(record);
      syncExtendStageFields(record);
    }
    if (isSupported && isGeneral && record) {
      fillGeneralForm(record);
    }

    // คำร้องขอขยายเขตฯ ทำงานจบในโมดูลของตัวเอง ไม่ใช่ในหน้างานรับคำร้อง --
    // ย้ายฟอร์มไปไว้ในหน้ารายละเอียดของโมดูลนั้น แล้วสลับหน้าไปที่นั่น
    if (isSupported && isExtend) {
      mountExtendDetail();
      extendDetailTitle.textContent = record ? "รายละเอียดคำร้อง" : "เพิ่มคำร้องขอขยายเขตฯ";
      extendDetailSubtitle.textContent = record
        ? [record.requestNumber, record.customerName, record.wbs].filter(Boolean).join(" · ")
        : "กรอกรายละเอียดคำร้องใหม่";
      extendWorkListMode.hidden = true;
      extendDetailMode.hidden = false;
      showView("extendWork");
      showExtendPane("form");
    } else {
      unmountExtendDetail();
    }

    // Audit strip only makes sense for a record that already exists -- and
    // it's entirely generic (reads only `record`, not the type), so every
    // FORM_SUPPORTED_TYPES form shares it as-is with no extra wiring.
    requestFormMeta.hidden = !record;
    // การ์ดสรุปเป็นคอลัมน์ของตัวเองแล้ว จึงต้องซ่อน/แสดงเอง ไม่ได้ติดไปกับแผงประวัติ
    // คำร้องใหม่ยังไม่มีอะไรให้สรุป และ summaryRecord ต้องล้างด้วย ไม่งั้นปุ่มคัดลอก
    // จะยังคัดลอกคำร้องใบก่อนหน้าที่เพิ่งปิดไป
    summaryRecord = null;
    requestFormSummary.hidden = !record;
    requestCommentInput.value = "";
    hideError(requestCommentError);
    if (record) {
      renderRequestSummary(record);
      renderStatusHistory(record);
      renderComments(record);
      renderBatchInfo(record);
      renderDispatchInfo(record);
      renderGeneralDispatchInfo(record);

      document.getElementById("requestFormEditedBy").textContent = record.updatedByName
        ? `ผู้แก้ไขล่าสุด: ${record.updatedByName} · ${formatThaiDateTime(record.updatedAt)}`
        : "ผู้แก้ไขล่าสุด: -";
    }

    requestsListMode.hidden = true;
    requestsFormMode.hidden = false;
  }

  requestsAddBtn.addEventListener("click", () => openRequestForm(currentRequestFilter));
  requestsAddBatchBtn.addEventListener("click", () => openRequestForm(currentRequestFilter, null, { batch: true }));
  batchAddRowBtn.addEventListener("click", addBatchRow);

  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(requestFormError);

    try {
      const trackingNumber = document.getElementById("reqTrackingNumber").value;
      const requestNumber = document.getElementById("reqNumber").value.trim();
      const receivedDate = document.getElementById("reqDate").value;
      const bp = document.getElementById("reqBP").value.trim();
      const ca = document.getElementById("reqCA").value.trim();
      const customerName = document.getElementById("reqCustomerName").value.trim();
      const phonePrimary = document.getElementById("reqPhonePrimary").value.trim();
      const phoneSecondary = document.getElementById("reqPhoneSecondary").value.trim();
      const province = document.getElementById("reqProvince").value;
      const districtKey = document.getElementById("reqDistrict").value;
      const subdistrict = document.getElementById("reqSubdistrict").value;
      const zipcode = document.getElementById("reqZipcode").value;
      const moo = document.getElementById("reqMoo").value.trim();
      const houseNo = document.getElementById("reqHouseNo").value.trim();
      const village = document.getElementById("reqVillage").value.trim();
      const deed = document.getElementById("reqDeed").value.trim();
      const type = currentAddType;
      const purposeChoice = document.getElementById("reqPurpose").value;
      const purposeOther = document.getElementById("reqPurposeOther").value.trim();
      const meterSize = document.getElementById("reqMeterSize").value;
      const fee = document.getElementById("reqFee").value.trim();
      const jobStatus = document.getElementById("reqJobStatus").value;
      const note = document.getElementById("reqNote").value.trim();
      const coord = readCoordField(reqCoord);

      // In batch mode this field is hidden and each row carries its own,
      // checked per row further down.
      if (!batchMode && !requestNumber) {
        showError(requestFormError, "กรุณากรอกเลขที่คำร้อง");
        return;
      }

      if (!receivedDate) {
        showError(requestFormError, "กรุณาเลือกวันที่รับคำร้อง");
        return;
      }

      if (!customerName) {
        showError(requestFormError, "กรุณากรอกชื่อลูกค้า");
        return;
      }

      if (!phonePrimary) {
        showError(requestFormError, "กรุณากรอกเบอร์โทรศัพท์ (หลัก)");
        return;
      }

      if (!districtKey) {
        showError(requestFormError, "กรุณาเลือกอำเภอ");
        return;
      }

      if (!subdistrict) {
        showError(requestFormError, "กรุณาเลือกตำบล");
        return;
      }

      if (!meterSize) {
        showError(requestFormError, "กรุณาเลือกขนาดมิเตอร์");
        return;
      }

      if (!batchMode) {
        if (coord.error) {
          showError(requestFormError, coord.error);
          return;
        }
      }

      // This form only mounts for type "power", so a purpose selection is
      // always required here.
      let purpose = "";
      if (!purposeChoice) {
        showError(requestFormError, "กรุณาเลือกความประสงค์");
        return;
      }

      // สถานะนี้ทำให้หน้าติดตามสถานะบอกลูกค้าว่าต้องโอนเท่าไร ถ้าไม่มียอด
      // ลูกค้าจะเห็นคำว่า "รอชำระเงิน" โดยไม่มีตัวเลขให้โอน (ฝั่งเซิร์ฟเวอร์
      // ปฏิเสธซ้ำอีกชั้นที่ assertFeeForPayment_ -- ที่นี่แค่บอกก่อนเสียเที่ยว)
      if (!batchMode && !isFeeValidForStatus(jobStatus, fee)) {
        showError(requestFormError, FEE_REQUIRED_MESSAGE);
        return;
      }
      if (purposeChoice === "other") {
        if (!purposeOther) {
          showError(requestFormError, "กรุณาระบุความประสงค์");
          return;
        }
        purpose = purposeOther;
      } else {
        purpose = purposeChoice;
      }

      const recordData = {
        type,
        trackingNumber,
        requestNumber,
        receivedDate,
        bp,
        ca,
        customerName,
        phonePrimary,
        phoneSecondary,
        province,
        district: DISTRICTS[districtKey].label,
        subdistrict,
        zipcode,
        moo,
        houseNo,
        village,
        deed,
        purpose,
        meterSize,
        fee,
        jobStatus,
        note,
        lat: coord.lat,
        lng: coord.lng
      };

      // Stamped from the signed-in session so the form's audit strip can show
      // who touched the record. A brand-new record only gets the created* pair
      // -- it hasn't been edited yet, so ผู้แก้ไขล่าสุด stays blank until it is.
      const { byName: savedByName, byEmail: savedByEmail } = actingStaff();
      const now = Date.now();

      if (batchMode) {
        const rows = collectBatchRows();

        if (!rows.length) {
          showError(requestFormError, "กรุณากรอกอย่างน้อย 1 คำร้องในกลุ่ม");
          return;
        }

        // ตรวจรายใบ และบอกให้ชัดว่าใบไหนขาดช่องไหน -- ฟอร์มตั้งต้นผ่านการตรวจ
        // มาแล้วก็จริง แต่แต่ละใบแก้ทับได้ทุกช่อง จึงเว้นว่างจนไม่ครบได้
        for (const row of rows) {
          const missing = BATCH_REQUIRED_FIELDS.find(f => !row.values[f.key]);
          if (missing) {
            expandBatchRow(row.el);
            showError(requestFormError, `คำร้องที่ ${row.position}: กรุณากรอก${missing.label}`);
            return;
          }
          if (row.values.purposeChoice === "other" && !row.values.purposeOther) {
            expandBatchRow(row.el);
            showError(requestFormError, `คำร้องที่ ${row.position}: กรุณาระบุความประสงค์`);
            return;
          }
          if (!isFeeValidForStatus(row.values.jobStatus, row.values.fee)) {
            expandBatchRow(row.el);
            showError(requestFormError, `คำร้องที่ ${row.position}: ${FEE_REQUIRED_MESSAGE}`);
            return;
          }
        }

        // เลขที่คำร้องซ้ำกันเองภายในกลุ่ม -- ตรวจตรงนี้เพราะตอนนี้ทุกใบมีช่องของ
        // ตัวเอง การคัดลอกแถวแล้วลืมแก้เลขจึงเกิดได้ง่ายกว่าเดิมมาก
        const numbers = rows.map(row => row.values.requestNumber);
        const dupAt = numbers.findIndex((n, i) => numbers.indexOf(n) !== i);
        if (dupAt !== -1) {
          expandBatchRow(rows[dupAt].el);
          showError(requestFormError, `คำร้องที่ ${rows[dupAt].position}: เลขที่คำร้อง "${numbers[dupAt]}" ซ้ำกับใบอื่นในกลุ่ม`);
          return;
        }

        // One read of the cache produces the whole run, so the numbers come
        // out consecutive exactly as if the forms had been entered one by one.
        const trackingNumbers = generateTrackingNumbers(rows.length, "power");
        const ids = newRequestIds(rows.length);
        const batchId = newRequestId();

        const created = rows.map(({ values: row }, i) => {
          const rowPurpose = row.purposeChoice === "other" ? row.purposeOther : row.purposeChoice;

          // ยังกาง recordData เป็นฐานไว้ เพื่อให้ช่องที่มีในฟอร์มแต่ยังไม่ได้ใส่ใน
          // BATCH_ROW_FIELDS (เช่น จังหวัด ที่ล็อกไว้ และ type) ตกมาจากข้อมูล
          // ตั้งต้นแทนที่จะหายไปเงียบ ๆ ที่เหลือทับด้วยค่าของใบนั้นทั้งหมด
          return {
            ...recordData,
            id: ids[i],
            trackingNumber: trackingNumbers[i],
            requestNumber: row.requestNumber,
            receivedDate: row.receivedDate,
            customerName: row.customerName,
            phonePrimary: row.phonePrimary,
            phoneSecondary: row.phoneSecondary,
            bp: row.bp,
            ca: row.ca,
            houseNo: row.houseNo,
            moo: row.moo,
            village: row.village,
            deed: row.deed,
            district: DISTRICTS[row.district] ? DISTRICTS[row.district].label : "",
            subdistrict: row.subdistrict,
            zipcode: row.zipcode,
            purpose: rowPurpose,
            meterSize: row.meterSize,
            fee: row.fee,
            jobStatus: row.jobStatus,
            note: row.note,
            batchId,
            statusHistory: [{ status: row.jobStatus, byName: savedByName, byEmail: savedByEmail, at: now }],
            createdByName: savedByName,
            createdByEmail: savedByEmail,
            createdAt: now
          };
        });

        // One write for the whole batch: a half-saved batch would leave gaps
        // in the numbering that nobody could tell apart from real records.
        // นี่คือการบันทึกที่ช้าที่สุดในแอป (หลายสิบรายการในครั้งเดียว) จึงยิ่ง
        // ต้องบอกว่ากำลังทำงาน -- finally ท้าย handler เป็นตัวคืนปุ่มให้เอง
        setBusy(requestFormSubmitBtn, true, "กำลังบันทึกคำร้อง...");

        await saveRequests(getRequests().concat(created));

        // Clear everything that was typed, so the next batch starts from a
        // blank form rather than the previous group's values.
        requestForm.reset();
        resetLocationFields();
        resetPurposeFields();
        setDefaultRequestDate();
        resetBatchRows();

        showBatchResult(created);
        return;
      }

      const requests = getRequests();
      if (editingId) {
        const idx = requests.findIndex(req => req.id === editingId);
        if (idx !== -1) {
          const prev = requests[idx];
          const statusHistory = appendStatusHistoryIfChanged(
            prev.statusHistory, prev.jobStatus, jobStatus, savedByName, savedByEmail, now);

          requests[idx] = {
            ...prev,
            ...recordData,
            statusHistory,
            updatedByName: savedByName,
            updatedByEmail: savedByEmail,
            updatedAt: now
          };
        }
      } else {
        if (!pendingNewId) pendingNewId = newRequestId();
        requests.push({
          id: pendingNewId,
          ...recordData,
          statusHistory: [{ status: jobStatus, byName: savedByName, byEmail: savedByEmail, at: now }],
          createdByName: savedByName,
          createdByEmail: savedByEmail,
          createdAt: now
        });
      }
      // การบันทึกวิ่งผ่านเครือข่ายและใช้เวลาเห็นได้ ปุ่มจึงต้องบอกว่ากำลังทำงาน
      // และกดซ้ำไม่ได้ ไม่งั้นเจ้าหน้าที่ที่ใจร้อนจะกดสองครั้งจนได้คำร้องซ้ำ
      setBusy(requestFormSubmitBtn, true, "กำลังบันทึกคำร้อง...");

      await saveRequests(requests);

      editingId = null;
      pendingNewId = null;
      requestForm.reset();
      resetLocationFields();
      resetPurposeFields();
      renderRequestsList();
    } catch (err) {
      console.error("CS Connect request form error:", err);
      // ส่งข้อความจริงจากหลังบ้านออกมา เหมือนทุกฟอร์มอื่นในไฟล์นี้ -- เดิมตรงนี้
      // เขียนข้อความตายตัวทับทิ้ง ทำให้เวลาบันทึกไม่ผ่านไม่มีใครรู้เลยว่าเพราะอะไร
      // (สิทธิ์หมดอายุ ข้อมูลยาวเกิน เน็ตหลุด ฯลฯ ขึ้นข้อความเดียวกันหมด)
      showError(
        requestFormError,
        friendlyError(err, "เกิดข้อผิดพลาด ไม่สามารถบันทึกคำร้องได้ กรุณาลองใหม่อีกครั้ง")
      );
    } finally {
      // ต้องอยู่ใน finally -- ถ้าอยู่ในเส้นทางสำเร็จอย่างเดียว ปุ่มจะค้างเป็น
      // "กำลังบันทึก..." และกดไม่ได้ตลอดไปเมื่อบันทึกล้มเหลว
      setBusy(requestFormSubmitBtn, false);
    }
  });

  /**
   * ขอขยายเขตระบบจำหน่ายไฟฟ้า -- ไม่มีโหมดกลุ่ม ไม่มีมิเตอร์/ค่าธรรมเนียม/
   * ที่อยู่แบบโครงสร้าง จึงเป็น handler แยกที่สั้นกว่ามาก แต่รูปแบบการบันทึก
   * (editingId / statusHistory / actingStaff / saveRequests) เหมือนกันทุก
   * ประการกับสาขาบันทึกรายเดี่ยวของ #requestForm ด้านบน
   */
  extendForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(extendFormError);

    try {
      const requestNumber = document.getElementById("extNumber").value.trim();
      const receivedDate = extDate.value;
      const customerName = document.getElementById("extCustomerName").value.trim();
      const phonePrimary = document.getElementById("extPhonePrimary").value.trim();
      const phoneSecondary = document.getElementById("extPhoneSecondary").value.trim();
      const location = document.getElementById("extLocation").value.trim();
      const province = document.getElementById("extProvince").value;
      const districtKey = extDistrict.value;
      const subdistrict = extSubdistrict.value;
      const zipcode = extZipcode.value;
      const houseNo = document.getElementById("extHouseNo").value.trim();
      const moo = document.getElementById("extMoo").value.trim();
      const village = document.getElementById("extVillage").value.trim();
      const purpose = document.getElementById("extPurpose").value;
      const jobStatus = extJobStatus.value;
      const note = document.getElementById("extNote").value.trim();
      const trackingNumber = extTrackingNumber.value;
      const wbs = extWbs.value.trim();
      const approvalNo = extApprovalNo.value.trim();
      const approvalDate = extApprovalDate.value;
      const deed = extDeed.value.trim();
      const coord = readCoordField(extCoord);

      if (!requestNumber) {
        showError(extendFormError, "กรุณากรอกเลขที่คำร้อง");
        return;
      }
      if (!receivedDate) {
        showError(extendFormError, "กรุณาเลือกวันที่รับคำร้อง");
        return;
      }
      if (!customerName) {
        showError(extendFormError, "กรุณากรอกชื่อลูกค้า");
        return;
      }
      if (!phonePrimary) {
        showError(extendFormError, "กรุณากรอกเบอร์โทรศัพท์ (หลัก)");
        return;
      }
      if (!districtKey) {
        showError(extendFormError, "กรุณาเลือกอำเภอ");
        return;
      }
      if (!subdistrict) {
        showError(extendFormError, "กรุณาเลือกตำบล");
        return;
      }
      if (!purpose) {
        showError(extendFormError, "กรุณาเลือกความประสงค์");
        return;
      }
      if (!jobStatus) {
        showError(extendFormError, "กรุณาเลือกสถานะงาน");
        return;
      }
      if (coord.error) {
        showError(extendFormError, coord.error);
        return;
      }

      // กรอกเลข WBS แล้ว = งานสำรวจเดินต่อไปขั้นเขียนผัง สถานะจึงเลื่อนให้เอง
      // (เลื่อนก่อนสร้าง statusHistory ด้านล่าง ประวัติจะได้บันทึกการเปลี่ยนนี้ด้วย)
      const nextStatus = (jobStatus === "รอสำรวจ" && wbs) ? "รอเขียนผัง" : jobStatus;

      // ไม่มีฟิลด์การจ่ายงาน (assignee/assigneeEmail/assigned*) อยู่ในนี้โดย
      // ตั้งใจ -- จ่ายงานได้ทางเดียวคือผ่าน assignRequests ของหัวหน้างาน และ
      // ฝั่งเซิร์ฟเวอร์เขียนค่าเดิมทับให้อยู่แล้วถ้ามีใครส่งมา
      const recordData = {
        type: "extend",
        trackingNumber,
        requestNumber,
        receivedDate,
        customerName,
        phonePrimary,
        phoneSecondary,
        province,
        district: DISTRICTS[districtKey].label,
        subdistrict,
        zipcode,
        houseNo,
        moo,
        village,
        deed,
        location,
        purpose,
        jobStatus: nextStatus,
        wbs,
        approvalNo,
        approvalDate,
        note,
        lat: coord.lat,
        lng: coord.lng
      };


      const { byName: savedByName, byEmail: savedByEmail } = actingStaff();
      const now = Date.now();

      const requests = getRequests();
      if (editingId) {
        const idx = requests.findIndex(req => req.id === editingId);
        if (idx !== -1) {
          const prev = requests[idx];
          const statusHistory = appendStatusHistoryIfChanged(
            prev.statusHistory, prev.jobStatus, nextStatus, savedByName, savedByEmail, now);

          requests[idx] = {
            ...prev,
            ...recordData,
            statusHistory,
            updatedByName: savedByName,
            updatedByEmail: savedByEmail,
            updatedAt: now
          };
        }
      } else {
        if (!pendingNewId) pendingNewId = newRequestId();
        requests.push({
          id: pendingNewId,
          ...recordData,
          statusHistory: [{ status: nextStatus, byName: savedByName, byEmail: savedByEmail, at: now }],
          createdByName: savedByName,
          createdByEmail: savedByEmail,
          createdAt: now
        });
      }

      setBusy(extendFormSubmitBtn, true, "กำลังบันทึกคำร้อง...");
      await saveRequests(requests);

      editingId = null;
      pendingNewId = null;
      extendForm.reset();
      resetExtendLocationFields();
      setDefaultExtendDate();
      updateExtCoords();
      updateExtPhonePrimaryCall();
      updateExtPhoneSecondaryCall();
      extAssigneeField.hidden = true;
      leaveRequestForm();
    } catch (err) {
      console.error("CS Connect extend form error:", err);
      showError(
        extendFormError,
        friendlyError(err, "เกิดข้อผิดพลาด ไม่สามารถบันทึกคำร้องได้ กรุณาลองใหม่อีกครั้ง")
      );
    } finally {
      setBusy(extendFormSubmitBtn, false);
    }
  });

  /**
   * คำร้องทั่วไป -- เหมือนโครงของ #extendForm ด้านบน (editingId เดิม/ใหม่,
   * appendStatusHistoryIfChanged, actingStaff, saveRequests) แต่ตัดทุกอย่างที่
   * เป็นของขอขยายเขตฯ ล้วน ๆ ออก (ที่อยู่, พิกัด, WBS, การจ่ายงาน) เพราะฟอร์มนี้
   * ไม่มีสิ่งเหล่านั้นเลยสักอย่าง
   */
  generalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(generalFormError);

    try {
      const subject = document.getElementById("genSubject").value.trim();
      const receivedDate = genDate.value;
      const customerName = document.getElementById("genCustomerName").value.trim();
      const phonePrimary = document.getElementById("genPhone").value.trim();
      const jobStatus = genJobStatus.value;
      const sentDate = document.getElementById("genSentDate").value;
      const department = document.getElementById("genDepartment").value.trim();
      const note = document.getElementById("genNote").value.trim();

      if (!subject) {
        showError(generalFormError, "กรุณากรอกเรื่อง");
        return;
      }
      if (!receivedDate) {
        showError(generalFormError, "กรุณาเลือกวันที่ยื่นเรื่อง");
        return;
      }
      if (!customerName) {
        showError(generalFormError, "กรุณากรอกชื่อลูกค้า");
        return;
      }
      if (!phonePrimary) {
        showError(generalFormError, "กรุณากรอกเบอร์โทรศัพท์");
        return;
      }
      if (!jobStatus) {
        showError(generalFormError, "กรุณาเลือกสถานะ");
        return;
      }

      const recordData = {
        type: "general",
        subject,
        receivedDate,
        customerName,
        phonePrimary,
        jobStatus,
        sentDate,
        department,
        note
      };

      const { byName: savedByName, byEmail: savedByEmail } = actingStaff();
      const now = Date.now();

      const requests = getRequests();
      if (editingId) {
        const idx = requests.findIndex(req => req.id === editingId);
        if (idx !== -1) {
          const prev = requests[idx];
          const statusHistory = appendStatusHistoryIfChanged(
            prev.statusHistory, prev.jobStatus, jobStatus, savedByName, savedByEmail, now);

          requests[idx] = {
            ...prev,
            ...recordData,
            statusHistory,
            updatedByName: savedByName,
            updatedByEmail: savedByEmail,
            updatedAt: now
          };
        }
      } else {
        if (!pendingNewId) pendingNewId = newRequestId();
        requests.push({
          id: pendingNewId,
          ...recordData,
          statusHistory: [{ status: jobStatus, byName: savedByName, byEmail: savedByEmail, at: now }],
          createdByName: savedByName,
          createdByEmail: savedByEmail,
          createdAt: now
        });
      }

      setBusy(generalFormSubmitBtn, true, "กำลังบันทึกคำร้อง...");
      await saveRequests(requests);

      editingId = null;
      pendingNewId = null;
      generalForm.reset();
      setDefaultGeneralDate();
      updateGenPhoneCall();
      leaveRequestForm();
    } catch (err) {
      console.error("CS Connect general form error:", err);
      showError(
        generalFormError,
        friendlyError(err, "เกิดข้อผิดพลาด ไม่สามารถบันทึกคำร้องได้ กรุณาลองใหม่อีกครั้ง")
      );
    } finally {
      setBusy(generalFormSubmitBtn, false);
    }
  });

  /**
   * อัปโหลดไฟล์แผนผังของคำร้องที่เปิดอยู่
   *
   * แยกจากปุ่มบันทึกคำร้องโดยตั้งใจ: ไฟล์ไม่ได้ไปอยู่ในชีต แต่ขึ้น Drive ผ่าน
   * คำสั่งของตัวเอง และฝั่งเซิร์ฟเวอร์เป็นคนเดินสถานะให้หลังไฟล์ขึ้นสำเร็จแล้ว
   * เท่านั้น -- ถ้าผูกไว้กับ submit เดียวกัน การบันทึกที่ล้มกลางทางจะทำให้สถานะ
   * กับไฟล์ไม่ตรงกัน
   */
  document.getElementById("extPlanUploadBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    hideError(extPlanError);
    extPlanSuccess.hidden = true;

    const files = Array.from(extPlanFile.files || []);
    if (!files.length) {
      showError(extPlanError, "กรุณาเลือกไฟล์แผนผังก่อน");
      return;
    }

    if (!extendFormRecord) {
      showError(extPlanError, "ต้องบันทึกคำร้องก่อนจึงจะแนบแผนผังได้");
      return;
    }

    // กันตั้งแต่ต้นทาง ผู้ใช้จะได้ไม่รอโหลดไฟล์ใหญ่จนจบแล้วค่อยโดนปฏิเสธ
    // (ฝั่งเซิร์ฟเวอร์ยังตรวจซ้ำอยู่ดี -- ที่นั่นคือด่านจริง)
    const tooBig = files.find(f => f.size > 10 * 1024 * 1024);
    if (tooBig) {
      showError(extPlanError, `ไฟล์ "${tooBig.name}" ใหญ่เกินไป (จำกัดไม่เกิน 10 MB ต่อไฟล์)`);
      return;
    }

    setBusy(btn, true, "กำลังอัปโหลด...");

    try {
      let updated = null;

      // ส่งทีละไฟล์ ไม่รวบส่งทีเดียว -- แต่ละไฟล์เป็นการเขียนชีตหนึ่งครั้งที่จบ
      // ในตัวเอง ถ้าไฟล์ที่สามพัง สองไฟล์แรกที่ขึ้นไปแล้วยังอยู่ครบ
      for (let i = 0; i < files.length; i++) {
        if (files.length > 1) setBusy(btn, true, `กำลังอัปโหลด ${i + 1}/${files.length}...`);

        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
          reader.readAsDataURL(files[i]);
        });

        updated = await backend.saveExtendFile(extendFormRecord.id, "plan", dataUrl);
        requestsCache = requestsCache.map(r => (String(r.id) === String(updated.id) ? updated : r));
        extendFormRecord = updated;
      }

      // สถานะอาจถูกเดินต่อโดยเซิร์ฟเวอร์ -- หน้าจอต้องสะท้อนของจริง
      extJobStatus.value = updated.jobStatus;
      renderStatusHistory(updated);
      syncExtendStageFields(updated);

      extPlanFile.value = "";
      extPlanSuccess.textContent =
        `แนบแผนผัง ${files.length} ไฟล์เรียบร้อย สถานะปัจจุบัน: ${updated.jobStatus}`;
      extPlanSuccess.hidden = false;
    } catch (err) {
      console.error("CS Connect plan upload error:", err);
      showError(extPlanError, friendlyError(err, "แนบแผนผังไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(btn, false);
    }
  });

  /**
   * แนบภาพหน้างาน -- ใช้ทางเดียวกับแผนผัง ต่างแค่ kind
   *
   * ไม่เดินสถานะ ต่างจากแผนผังโดยตั้งใจ: ภาพหน้างานเป็นเอกสารประกอบที่แนบเมื่อไร
   * ก็ได้ ไม่ใช่หมุดหมายของขั้นตอนงาน
   */
  async function uploadExtendPhoto(button, kind, input) {
    hideError(extPhotoError);
    extPhotoSuccess.hidden = true;

    const file = input.files && input.files[0];
    if (!file) {
      showError(extPhotoError, "กรุณาเลือกไฟล์ภาพก่อน");
      return;
    }
    if (!extendFormRecord) {
      showError(extPhotoError, "ต้องบันทึกคำร้องก่อนจึงจะแนบภาพได้");
      return;
    }
    // กันแต่เนิ่น ๆ จะได้ไม่รออ่านไฟล์ใหญ่จนจบแล้วค่อยโดนปฏิเสธ (ด่านจริงอยู่
    // ฝั่งเซิร์ฟเวอร์เหมือนเดิม)
    if (file.size > 5 * 1024 * 1024) {
      showError(extPhotoError, "ไฟล์ภาพใหญ่เกินไป (จำกัดไม่เกิน 5 MB)");
      return;
    }

    setBusy(button, true, "กำลังอัปโหลด...");

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
        reader.readAsDataURL(file);
      });

      const updated = await backend.saveExtendFile(extendFormRecord.id, kind, dataUrl);

      requestsCache = requestsCache.map(r => (String(r.id) === String(updated.id) ? updated : r));
      extendFormRecord = updated;
      renderExtendPhotos(updated);

      input.value = "";
      extPhotoSuccess.textContent = "แนบภาพเรียบร้อย";
      extPhotoSuccess.hidden = false;
    } catch (err) {
      console.error("CS Connect photo upload error:", err);
      showError(extPhotoError, friendlyError(err, "แนบภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(button, false);
    }
  }

  document.getElementById("extSitePhotoBtn").addEventListener("click", (e) =>
    uploadExtendPhoto(e.currentTarget, "sitePhoto", document.getElementById("extSitePhotoFile")));

  document.getElementById("extRoutePhotoBtn").addEventListener("click", (e) =>
    uploadExtendPhoto(e.currentTarget, "routePhoto", document.getElementById("extRoutePhotoFile")));

  /**
   * ใบภาพหน้างาน A4 หน้าเดียว -- WBS, ภาพสถานที่, ภาพเส้นทาง, พิกัด, วันที่พิมพ์
   *
   * ใช้วิธีเดียวกับใบพิมพ์อื่นในแอปนี้: เปิดแท็บใหม่แล้วเขียนเอกสารที่มี @page
   * ของตัวเอง แล้วสั่งพิมพ์ -- การ "บันทึกเป็น PDF" คือปลายทางหนึ่งของกล่องพิมพ์
   * ที่เบราว์เซอร์มีให้อยู่แล้ว จึงไม่ต้องแบกไลบรารีสร้าง PDF เข้ามา (ซึ่ง CSP
   * ของหน้านี้บล็อกสคริปต์นอกไฟล์เราอยู่แล้วด้วย)
   *
   * ความสูงถูกล็อกเป็น A4 หนึ่งหน้าพอดี แล้วให้กรอบภาพสองกรอบแบ่งพื้นที่ที่เหลือ
   * กันเอง (flex: 1) ภาพจึงใหญ่ที่สุดเท่าที่จะใหญ่ได้โดยไม่ล้นไปหน้าที่สอง
   * ไม่ว่าภาพจะเป็นแนวตั้งหรือแนวนอน (object-fit: contain ไม่บิดสัดส่วน)
   *
   * เอกสารที่เปิดด้วย window.open("") สืบทอด CSP ของหน้าแม่ -- ห้ามมี <script>
   * หรือ on* attribute เด็ดขาด ปุ่มพิมพ์จึงถูกผูก event จากหน้าแม่แทน
   */
  function printSitePhotoSheet(record) {
    const win = window.open("", "_blank");
    if (!win) return;

    const wbs = escapeForPrint(record.wbs || "-");
    const site = record.sitePhoto ? driveThumbnailUrl(record.sitePhoto) : "";
    const route = record.routePhoto ? driveThumbnailUrl(record.routePhoto) : "";

    const lat = parseFloat(record.lat);
    const lng = parseFloat(record.lng);
    const coords = (isFinite(lat) && isFinite(lng))
      ? `${lat}, ${lng}`
      : "ยังไม่ได้ระบุพิกัด";

    const printedAt = new Date().toLocaleString("th-TH", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });

    const photoBlock = (label, url) => url
      ? `<figure class="shot"><figcaption>${escapeForPrint(label)}</figcaption>
           <div class="frame"><img src="${escapeForPrint(url)}" alt="${escapeForPrint(label)}"></div>
         </figure>`
      : `<figure class="shot"><figcaption>${escapeForPrint(label)}</figcaption>
           <div class="frame empty">ยังไม่ได้แนบภาพ</div>
         </figure>`;

    win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>ใบภาพหน้างาน ${wbs}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Sarabun", "Segoe UI", sans-serif; color: #221530; }

  /* ความสูงทุกก้อนกำหนดเป็นมิลลิเมตรตายตัว ไม่ใช้ flex ยืดเต็มความสูงหน้า:
     ตอนพิมพ์ เบราว์เซอร์คิดความสูงของกล่องหน้ากระดาษไม่ตรงกัน (ขอบของ @page
     กับขอบที่ผู้ใช้ตั้งในกล่องพิมพ์ทับกันได้) พอคิดพลาดไปไม่กี่มิลลิเมตร
     บรรทัดพิกัดก็หลุดไปหน้าที่สองทันที -- แบบนี้รวมกันแล้วราว 256 มม.
     เหลือที่ว่างเผื่อขอบกระดาษไว้มากพอที่จะไม่มีวันล้นหน้า
     22 (WBS) + 2 x (7 หัวข้อ + 96 กรอบรูป) + 12 ช่องไฟ + 10 ท้ายกระดาษ = ~250 มม.
     ซึ่งยังพอดีแม้ผู้ใช้จะเลือกขอบกระดาษกว้าง 20 มม. ในกล่องพิมพ์ */
  .wbs {
    border: 2px solid #57298c; border-radius: 6px; padding: 5mm 8mm; text-align: center;
  }
  .wbs span { display: block; font-size: 11pt; color: #6b5c82; letter-spacing: .5px; }
  .wbs strong {
    display: block; margin-top: 1mm; font-size: 26pt; font-weight: 700;
    letter-spacing: 1px; color: #38185c;
  }
  .shot { margin: 4mm 0 0; page-break-inside: avoid; break-inside: avoid; }
  figcaption { font-size: 12pt; font-weight: 600; margin-bottom: 2mm; color: #38185c; }
  .frame {
    height: 96mm; border: 1px solid #cdb9ea; border-radius: 4px;
    display: flex; align-items: center; justify-content: center; overflow: hidden;
  }
  /* ภาพใหญ่เต็มกรอบ โดยไม่บิดสัดส่วน และไม่ดันความสูงของกรอบให้บานออก */
  .frame img { max-width: 100%; max-height: 96mm; object-fit: contain; }
  .frame.empty { color: #6b5c82; font-size: 11pt; }
  .foot {
    margin-top: 4mm; border-top: 1px solid #cdb9ea; padding-top: 3mm;
    display: flex; justify-content: space-between; font-size: 11pt; gap: 8mm;
    page-break-inside: avoid; break-inside: avoid;
  }
  .foot b { font-weight: 600; }
  .actions { text-align: center; margin-top: 6mm; }
  .actions button { font: inherit; padding: 8px 18px; cursor: pointer; }
  @media print { .actions { display: none; } }
</style></head><body>
  <div class="wbs"><span>หมายเลข WBS</span><strong>${wbs}</strong></div>
  ${photoBlock("ภาพสถานที่ขอขยายเขตฯ", site)}
  ${photoBlock("ภาพเส้นทางขยายเขตฯ", route)}
  <div class="foot">
    <div><b>พิกัดหน้างาน:</b> ${escapeForPrint(coords)}</div>
    <div><b>วันที่พิมพ์:</b> ${escapeForPrint(printedAt)}</div>
  </div>
  <div class="actions"><button type="button" id="printBtn">พิมพ์ / บันทึกเป็น PDF</button></div>
</body></html>`);
    win.document.close();

    win.document.getElementById("printBtn").addEventListener("click", () => win.print());

    // รอให้ภาพโหลดเสร็จก่อนสั่งพิมพ์ ไม่งั้นกล่องพิมพ์เปิดมาพร้อมกรอบว่าง
    // นับทั้งภาพที่โหลดไม่ขึ้นด้วย (error) ไม่งั้นภาพเสียหนึ่งใบจะทำให้ไม่มีวันพิมพ์
    const images = Array.from(win.document.images);
    let pending = images.filter(img => !img.complete).length;
    if (!pending) {
      win.print();
      return;
    }
    images.forEach(img => {
      if (img.complete) return;
      const done = () => { if (--pending === 0) win.print(); };
      img.addEventListener("load", done);
      img.addEventListener("error", done);
    });
  }

  document.getElementById("extPhotoPrintBtn").addEventListener("click", () => {
    if (extendFormRecord) printSitePhotoSheet(extendFormRecord);
  });

  // ---------- หน้าประมาณการ ----------
  //
  // โครงตามของจริง: หนึ่ง WBS มีใบประมาณการหลายชุด แยกตาม "แผนก" และแต่ละแผนกมี
  // "งานย่อย" อีกหลายงาน โดยงานย่อยหนึ่งงาน = ใบประมาณการหนึ่งใบ (Group +
  // รหัสการลงทุน + รายการพัสดุ) หน้านี้จึงไล่ลงสามชั้น และแยกออกมาเป็นหน้าของ
  // ตัวเองเพราะตารางกว้างเกินกว่าจะอยู่ในคอลัมน์ของฟอร์มคำร้องได้
  //
  // ทั้งหน้าทำงานกับ estimateModel ในหน่วยความจำแบบผูกสด (พิมพ์ปุ๊บเข้าโมเดลปั๊บ)
  // แล้วค่อยเขียนลงคำร้องตอนกดบันทึก -- ไม่มีขั้นตอน "เก็บค่าจากหน้าจอ" ตอน
  // เปลี่ยนชั้น ซึ่งเป็นจุดที่ข้อมูลหายง่ายที่สุดเวลาลืมเรียก
  const estimateView = {
    deptPane: document.getElementById("estDeptPane"),
    jobPane: document.getElementById("estJobPane"),
    formPane: document.getElementById("estFormPane"),
    deptList: document.getElementById("estDeptList"),
    jobList: document.getElementById("estJobList"),
    jobPaneTitle: document.getElementById("estJobPaneTitle"),
    formPaneTitle: document.getElementById("estFormPaneTitle"),
    crumbs: document.getElementById("estCrumbs"),
    rows: document.getElementById("estRows"),
    rowsEmpty: document.getElementById("estRowsEmpty"),
    pickGroup: document.getElementById("estPickGroup"),
    pickItem: document.getElementById("estPickItem"),
    pickItemList: document.getElementById("estPickItemList"),
    pickKeyCode: document.getElementById("estPickKeyCode"),
    pickKeyList: document.getElementById("estPickKeyList"),
    pickIn: document.getElementById("estPickIn"),
    pickRm: document.getElementById("estPickRm"),
    pickRp: document.getElementById("estPickRp"),
    pickError: document.getElementById("estPickError"),
    kitSelect: document.getElementById("estKitSelect"),
    kitAddBtn: document.getElementById("estKitAddBtn"),
    kitSaveBtn: document.getElementById("estKitSaveBtn"),
    kitDeleteBtn: document.getElementById("estKitDeleteBtn"),
    kitHint: document.getElementById("estKitHint"),
    kitError: document.getElementById("estKitError"),
    kitSaveForm: document.getElementById("estKitSaveForm"),
    kitName: document.getElementById("estKitName"),
    kitNote: document.getElementById("estKitNote"),
    kitSaveConfirmBtn: document.getElementById("estKitSaveConfirmBtn"),
    kitSaveCancelBtn: document.getElementById("estKitSaveCancelBtn"),
    jobName: document.getElementById("estJobName"),
    investment: document.getElementById("estInvestment"),
    catalogNote: document.getElementById("estCatalogNote"),
    error: document.getElementById("estimateError"),
    success: document.getElementById("estimateSuccess"),
    dirty: document.getElementById("estimateDirty"),
    contextWbs: document.getElementById("estimateContextWbs"),
    contextCustomer: document.getElementById("estimateContextCustomer")
  };

  let estimateRecord = null;    // คำร้องที่กำลังทำประมาณการอยู่
  let estimateModel = null;     // { departments: [{ section, jobs: [...] }] }
  let estimateDeptIndex = -1;
  let estimateJobIndex = -1;
  let estimateDirty = false;
  let estimateCatalog = null;   // [{ keyCode, description }]
  let estimateKits = [];        // [{ id, name, note, items: [...] }]
  let estimateLists = null;     // { section: [], group: [], investment: [] }

  function markEstimateDirty() {
    estimateDirty = true;
    estimateView.dirty.hidden = false;
    estimateView.success.hidden = true;
  }

  /**
   * แค็ตตาล็อกรายการและลิสต์ตัวเลือก -- อยู่ในชีต ไม่ได้ฝังในไฟล์เว็บ เพราะยาว
   * สองพันกว่ารายการ เปลี่ยนตามประกาศของ กฟภ. และไฟล์เว็บทุกไฟล์เป็นสาธารณะ
   * โหลดครั้งเดียวต่อการเปิดเว็บ แล้วกรองในเบราว์เซอร์
   */
  async function ensureEstimateCatalog() {
    if (estimateCatalog) return;

    const data = await backend.listEstimateItems();
    estimateCatalog = data.items || [];
    estimateLists = data.lists || { section: [], group: [], investment: [] };
    estimateKits = Array.isArray(data.kits) ? data.kits : [];

    estimateView.catalogNote.textContent = estimateCatalog.length
      ? `รายการตั้งต้นในระบบ ${estimateCatalog.length} รายการ · พิมพ์ค้นได้ทั้งช่องรหัสพัสดุและช่องชื่อรายการ พิมพ์ช่องไหนอีกช่องเติมให้เอง · เลือกกลุ่มไว้จะค้นเฉพาะในกลุ่มนั้น`
      : "ยังไม่มีรายการตั้งต้นในระบบ — แท็บ EstimateItems ในชีตต้องมีหัวตารางแถวแรกเป็น group · keyCode · description (หรือ กลุ่ม · รหัสพัสดุ · รายการ) แล้วใส่ข้อมูลตั้งแต่แถวที่ 2";
  }

  /**
   * คำนำหน้าชื่องานย่อยของแต่ละแผนก -- ตรงกับที่แผนกใช้เรียกกันจริง (HT.OHGW,
   * LT.สาย, TR.Cover ...) เติมให้ตั้งแต่ตอนเปิดช่อง เจ้าหน้าที่พิมพ์ต่อได้เลย
   * และยังลบทิ้งพิมพ์เองทั้งหมดได้ ไม่ได้บังคับ
   */
  const DEPARTMENT_PREFIX = {
    "แผนกแรงสูง 22 kV": "HT.",
    "แผนกหม้อแปลง 22 kV": "TR.",
    "แผนกแรงต่ำ": "LT.",
    "แผนกไฟสาธารณะ": "SL.",
    "แผนกมิเตอร์": "MT."
  };

  function currentDept() {
    return estimateModel && estimateModel.departments[estimateDeptIndex];
  }

  function currentJob() {
    const dept = currentDept();
    return dept && dept.jobs[estimateJobIndex];
  }

  /**
   * แค็ตตาล็อกเป็นชุดเดียวใช้ร่วมกันทุกแผนก -- ไม่ได้กรองตามแผนกอีกแล้ว
   *
   * เดิมกรองด้วยคอลัมน์ section ซึ่งทำให้พัสดุตัวเดียวกันที่ใช้หลายแผนกต้องมี
   * หลายแถวในชีต แต่โค้ดที่รวมจำนวนพัสดุซ้ำ (ดู #estAddItemBtn) เทียบด้วย
   * KeyCode ล้วน ๆ ไม่เคยดู section เลย -- ชีตกับโค้ดจึงเข้าใจ "ตัวตนของพัสดุ"
   * ไม่ตรงกัน และเวลา กฟภ. แก้คำอธิบายพัสดุตัวหนึ่ง ต้องไล่แก้ทุกแถวที่ซ้ำ
   * ลืมแถวเดียวก็เพี้ยน ตอนนี้ถือว่า **หนึ่ง KeyCode = หนึ่งแถว** ตรงกับโค้ด
   *
   * คอลัมน์ section ถูกถอดออกจากแค็ตตาล็อกแล้ว และหลังบ้านอ่านแท็บนี้ด้วย
   * "ชื่อหัวตาราง" ไม่ใช่ตำแหน่ง (ดู readEstimateCatalog_ ใน Code.gs) ชีตเก่าที่ยัง
   * มีคอลัมน์ section ค้างอยู่ก็อ่านได้ปกติ คอลัมน์นั้นแค่ถูกข้ามไป
   *
   * หมายเหตุ: "แผนก" ในตัวใบประมาณการ (แผนก -> งานย่อย -> ใบ) ไม่เกี่ยวกันเลย
   * และยังอยู่ครบเหมือนเดิม -- #estNewDept เป็นรายการตายตัวใน index.html
   */
  function catalogRows() {
    return estimateCatalog || [];
  }

  function catalogGroups() {
    return Array.from(new Set(catalogRows().map(i => i.group).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "th"));
  }

  function itemsForGroup(group) {
    return catalogRows().filter(i => (i.group || "") === (group || ""));
  }

  /**
   * เติมตัวเลือกลง <select> พร้อมกันค่าที่บันทึกไว้แล้วหายไป
   *
   * ค่าที่เคยบันทึกไว้แต่ไม่มีในแค็ตตาล็อกวันนี้ (กรอกไว้ก่อนมีข้อมูล หรือรายการ
   * ถูกถอดออกภายหลัง) จะถูกใส่กลับเป็นตัวเลือกให้เสมอ -- ใบที่เคยทำไว้ต้องไม่
   * เปลี่ยนค่าตัวเองเงียบ ๆ เพราะแค็ตตาล็อกเปลี่ยน
   */
  function fillSelect(select, values, current, placeholder) {
    select.innerHTML = "";

    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = placeholder;
    select.appendChild(blank);

    const all = values.slice();
    if (current && !all.includes(current)) all.push(current);

    all.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

    select.value = current || "";
  }

  function countItems(job) {
    return (job.items || []).filter(i => i.description).length;
  }

  function jobLabel(job, index) {
    return job.name || job.group || `งานย่อยที่ ${index + 1}`;
  }

  function renderEstimateCrumbs() {
    estimateView.crumbs.innerHTML = "";

    const steps = [{ label: "แผนกทั้งหมด", level: 0 }];
    if (estimateDeptIndex >= 0 && currentDept()) {
      steps.push({ label: currentDept().section || "แผนกไม่มีชื่อ", level: 1 });
    }
    if (estimateJobIndex >= 0 && currentJob()) {
      steps.push({ label: jobLabel(currentJob(), estimateJobIndex), level: 2 });
    }

    steps.forEach((step, index) => {
      if (index) {
        const sep = document.createElement("span");
        sep.className = "estimate-crumb-sep";
        sep.textContent = "/";
        estimateView.crumbs.appendChild(sep);
      }

      const isLast = index === steps.length - 1;
      const node = document.createElement(isLast ? "span" : "button");
      node.className = "estimate-crumb";
      node.textContent = step.label;
      if (!isLast) {
        node.type = "button";
        node.addEventListener("click", () => showEstimateLevel(step.level));
      }
      estimateView.crumbs.appendChild(node);
    });
  }

  function showEstimateLevel(level) {
    if (level < 2) estimateJobIndex = -1;
    if (level < 1) estimateDeptIndex = -1;

    estimateView.deptPane.hidden = level !== 0;
    estimateView.jobPane.hidden = level !== 1;
    estimateView.formPane.hidden = level !== 2;

    if (level === 0) renderEstimateDepts();
    if (level === 1) renderEstimateJobs();
    if (level === 2) renderEstimateForm();

    renderEstimateCrumbs();

    document.getElementById("estimatePrintBtn").textContent =
      level === 0 ? "พิมพ์ทั้งหมด" : (level === 1 ? "พิมพ์แผนกนี้" : "พิมพ์ใบนี้");

    window.scrollTo(0, 0);
  }

  /** การ์ดหนึ่งใบ ใช้ทั้งชั้นแผนกและชั้นงานย่อย -- โครงเดียวกัน ต่างแค่ข้อความ */
  function estimateCard(title, meta, onOpen, onRemove) {
    const card = document.createElement("div");
    card.className = "estimate-card";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "estimate-card-open";

    const name = document.createElement("span");
    name.className = "estimate-card-title";
    name.textContent = title;

    const sub = document.createElement("span");
    sub.className = "estimate-card-meta";
    sub.textContent = meta;

    open.append(name, sub);
    open.addEventListener("click", onOpen);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "estimate-remove";
    remove.setAttribute("aria-label", "ลบ");
    remove.textContent = "×";
    remove.addEventListener("click", onRemove);

    card.append(open, remove);
    return card;
  }

  function renderEstimateDepts() {
    estimateView.deptList.innerHTML = "";
    const departments = estimateModel.departments;

    if (!departments.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = "ยังไม่มีแผนก — เพิ่มแผนกแรกด้านล่างเพื่อเริ่มทำประมาณการ";
      estimateView.deptList.appendChild(empty);
      return;
    }

    departments.forEach((dept, index) => {
      const items = (dept.jobs || []).reduce((n, j) => n + countItems(j), 0);
      estimateView.deptList.appendChild(estimateCard(
        dept.section || "แผนกไม่มีชื่อ",
        `${(dept.jobs || []).length} งานย่อย · ${items} รายการ`,
        () => { estimateDeptIndex = index; showEstimateLevel(1); },
        () => {
          // ลบทั้งแผนก = ลบใบประมาณการของทุกงานย่อยในนั้น ต้องถามก่อนเสมอ
          if (!confirm(`ลบแผนก "${dept.section}" พร้อมงานย่อยทั้งหมดในแผนกนี้?`)) return;
          departments.splice(index, 1);
          markEstimateDirty();
          renderEstimateDepts();
        }
      ));
    });
  }

  function renderEstimateJobs() {
    const dept = currentDept();
    if (!dept) return showEstimateLevel(0);

    estimateView.jobPaneTitle.textContent = `งานย่อยใน ${dept.section || "แผนกไม่มีชื่อ"}`;
    document.getElementById("estNewJob").value = DEPARTMENT_PREFIX[dept.section] || "";
    estimateView.jobList.innerHTML = "";

    if (!dept.jobs.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = "ยังไม่มีงานย่อยในแผนกนี้ — เพิ่มงานย่อยด้านล่าง";
      estimateView.jobList.appendChild(empty);
      return;
    }

    dept.jobs.forEach((job, index) => {
      // job.group มีเฉพาะในใบที่สร้างไว้ก่อนจะรวมชื่องานย่อยกับ Group เข้าด้วยกัน
      const bits = [job.group, job.investment].filter(Boolean).join(" · ");
      estimateView.jobList.appendChild(estimateCard(
        jobLabel(job, index),
        `${bits ? bits + " · " : ""}${countItems(job)} รายการ`,
        () => { estimateJobIndex = index; showEstimateLevel(2); },
        () => {
          if (!confirm(`ลบงานย่อย "${jobLabel(job, index)}" พร้อมรายการทั้งหมด?`)) return;
          dept.jobs.splice(index, 1);
          markEstimateDirty();
          renderEstimateJobs();
        }
      ));
    });
  }

  function renderEstimateForm() {
    const job = currentJob();
    if (!job) return showEstimateLevel(1);

    estimateView.formPaneTitle.textContent = jobLabel(job, estimateJobIndex);
    estimateView.jobName.value = job.name || job.group || "";
    estimateView.investment.value = job.investment || "";

    renderEstimateRows();
    resetItemPicker();
    estimateView.kitSaveForm.hidden = true;
    hideError(estimateView.kitError);
    refreshKitControls();
  }

  /**
   * วาดเฉพาะตารางพัสดุใหม่ โดยไม่แตะแผงเลือกด้านบน
   *
   * แยกจาก renderEstimateForm เพราะการรวมจำนวนเข้ารายการเดิมต้องวาดตารางใหม่
   * แต่ต้องไม่ล้างกลุ่มที่ผู้ใช้เลือกค้างไว้ -- คนที่กำลังไล่เพิ่มพัสดุในกลุ่ม
   * เดียวกันติด ๆ กันจะต้องมาเลือกกลุ่มใหม่ทุกครั้งที่บังเอิญเพิ่มของซ้ำ
   */
  function renderEstimateRows() {
    const job = currentJob();
    if (!job) return;

    estimateView.rows.innerHTML = "";
    // เฉพาะพัสดุที่เพิ่มไว้จริง ไม่มีแถวเปล่าเติมให้แล้ว -- แถวเปล่าคือแถวที่ต้อง
    // กรองทิ้งตอนบันทึกและตอนพิมพ์ ซึ่งเป็นกฎที่ต้องจำไว้ในสองที่โดยไม่จำเป็น
    (job.items || []).filter(item => item.description).forEach(item => renderEstimateRow(item));
    syncEstimateEmpty();
  }

  /**
   * เพดานจำนวนตัวเลือกที่ยัดลง <datalist> ได้
   *
   * แค็ตตาล็อกมีสองพันกว่ารายการ การใส่ทั้งหมดคือโหนดหลายพันตัวที่เบราว์เซอร์ต้อง
   * วาดใหม่ทุกครั้งที่พิมพ์หนึ่งตัวอักษร และเป็นรายการที่ยาวเกินกว่าจะกวาดตาหาได้อยู่ดี
   */
  const SEARCH_LIMIT = 50;

  /** แถวแค็ตตาล็อกในขอบเขตปัจจุบัน -- เลือกกลุ่มไว้ก็เฉพาะกลุ่มนั้น ไม่เลือกก็ทั้งแค็ตตาล็อก */
  function scopedRows() {
    const group = estimateView.pickGroup.value;
    return group ? itemsForGroup(group) : catalogRows();
  }

  /**
   * ต้องพิมพ์กี่ตัวถึงเริ่มเสนอตัวเลือก
   *
   * เลือกกลุ่มไว้แล้วเสนอได้ทันทีตั้งแต่ยังไม่พิมพ์ (กลุ่มเดียวมีอย่างมากหลักร้อย
   * และการ "คลิกดูว่ากลุ่มนี้มีอะไรบ้าง" คือสิ่งที่ดรอปดาวน์เดิมเคยทำได้ ต้องไม่หาย)
   * ไม่เลือกกลุ่มต้องพิมพ์อย่างน้อยสองตัว ไม่งั้นคือการเสนอทั้งแค็ตตาล็อก
   */
  function suggestMinChars() {
    return estimateView.pickGroup.value ? 0 : 2;
  }

  /**
   * เติม <datalist> -- ใส่ label ควบคู่กับ value เสมอ
   *
   * ช่อง KeyCode เสนอเป็นรหัสล้วนจะอ่านไม่ออกว่ารหัสไหนคืออะไร เบราว์เซอร์แสดง
   * label ต่อท้าย value ให้ และเวลาเลือกจะกรอกเฉพาะ value ลงช่อง ซึ่งเป็นสิ่งที่ต้องการ
   */
  function fillDatalist(list, pairs) {
    list.innerHTML = "";
    pairs.forEach(pair => {
      const option = document.createElement("option");
      option.value = pair.value;
      if (pair.label) option.label = pair.label;
      list.appendChild(option);
    });
  }

  /** เสนอชื่อรายการที่ "มีคำที่พิมพ์อยู่ในนั้น" (ค้นแบบ substring) */
  function suggestDescriptions() {
    const q = estimateView.pickItem.value.trim().toLowerCase();
    if (q.length < suggestMinChars()) {
      fillDatalist(estimateView.pickItemList, []);
      return;
    }

    const out = [];
    for (const item of scopedRows()) {
      if (!item.description) continue;
      if (!q || item.description.toLowerCase().includes(q)) {
        out.push({ value: item.description, label: item.keyCode || "" });
        if (out.length >= SEARCH_LIMIT) break;
      }
    }
    fillDatalist(estimateView.pickItemList, out);
  }

  /**
   * เสนอ KeyCode ตามลำดับตัวอักษรที่พิมพ์ -- รหัสที่ "ขึ้นต้นด้วย" คำที่พิมพ์มาก่อนเสมอ
   *
   * รหัสพัสดุคนอ่านจากซ้ายไปขวา พิมพ์ไปทีละตัวเพื่อไล่ให้แคบลง การเอารหัสที่บังเอิญ
   * มีเลขชุดนั้นอยู่กลางรหัสขึ้นมาปนก่อน จะทำให้ตัวที่กำลังไล่หาถูกดันตกไป -- แต่ก็ยัง
   * เก็บพวกที่ตรงกลางไว้ท้ายรายการ เผื่อคนจำได้แค่ท่อนกลางของรหัส
   */
  function suggestKeyCodes() {
    const q = estimateView.pickKeyCode.value.trim().toLowerCase();
    if (q.length < suggestMinChars()) {
      fillDatalist(estimateView.pickKeyList, []);
      return;
    }

    const starts = [];
    const inside = [];
    for (const item of scopedRows()) {
      const code = String(item.keyCode || "");
      if (!code) continue;

      const lower = code.toLowerCase();
      const entry = { value: code, label: item.description || "" };

      if (!q || lower.startsWith(q)) starts.push(entry);
      else if (lower.includes(q)) inside.push(entry);

      if (starts.length >= SEARCH_LIMIT) break;
    }

    fillDatalist(estimateView.pickKeyList, starts.concat(inside).slice(0, SEARCH_LIMIT));
  }

  /**
   * หนึ่งแถวในตารางพัสดุที่เพิ่มไว้แล้ว
   *
   * ต่างจากเดิมตรงที่แถวไม่ใช่ที่สำหรับ "เลือก" อีกต่อไป -- การเลือกกลุ่มและ
   * รายการเกิดที่แผงด้านบน แถวจึงเหลือเพียงสิ่งที่เลือกมาแล้ว (แสดงเป็นข้อความ)
   * กับจำนวนที่ยังแก้ตรงนี้ได้ เพราะการพิมพ์เลขผิดหนึ่งตัวไม่ควรต้องลบทั้งแถว
   * แล้วเลือกใหม่
   */
  function renderEstimateRow(item) {
    const job = currentJob();
    if (!job) return;

    const row = document.createElement("div");
    row.className = "estimate-row";

    const no = document.createElement("span");
    no.className = "estimate-no";

    const keyCode = document.createElement("span");
    keyCode.className = "estimate-cell-key";
    keyCode.textContent = item.keyCode || "-";

    const description = document.createElement("span");
    description.className = "estimate-cell-desc";
    description.textContent = item.description || "";
    description.title = item.description || "";

    const group = document.createElement("span");
    group.className = "estimate-cell-group";
    group.textContent = item.group || "-";
    group.title = item.group || "";

    const quantities = ["in", "rm", "rp"].map(key => {
      const input = document.createElement("input");
      input.type = "number";
      input.step = "1";
      input.className = "estimate-qty";
      input.value = item[key] || "";
      input.addEventListener("input", () => {
        item[key] = input.value;
        markEstimateDirty();
      });
      return input;
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "estimate-remove";
    remove.setAttribute("aria-label", `ลบ ${item.description || "รายการนี้"}`);
    remove.title = remove.getAttribute("aria-label");
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      const index = job.items.indexOf(item);
      if (index !== -1) job.items.splice(index, 1);
      row.remove();
      renumberEstimateRows();
      syncEstimateEmpty();
      markEstimateDirty();
    });

    row.append(no, keyCode, description, group, ...quantities, remove);
    estimateView.rows.appendChild(row);
    renumberEstimateRows();
    syncEstimateEmpty();
  }

  /** ข้อความ "ยังไม่มีพัสดุ" โผล่เฉพาะตอนตารางว่างจริง ๆ */
  function syncEstimateEmpty() {
    estimateView.rowsEmpty.hidden = estimateView.rows.children.length > 0;
  }

  function renumberEstimateRows() {
    Array.from(estimateView.rows.children).forEach((row, index) => {
      row.querySelector(".estimate-no").textContent = String(index + 1);
    });
  }

  function openEstimateView(record) {
    estimateRecord = record;
    // ทำงานบนสำเนา ไม่ใช่ตัวจริงใน cache -- ออกจากหน้าโดยไม่บันทึกต้องไม่ทิ้งร่องรอย
    const stored = record.estimate && Array.isArray(record.estimate.departments)
      ? record.estimate
      : { departments: [] };
    estimateModel = JSON.parse(JSON.stringify(stored));

    estimateDeptIndex = -1;
    estimateJobIndex = -1;
    estimateDirty = false;
    estimateView.dirty.hidden = true;
    estimateView.success.hidden = true;
    hideError(estimateView.error);

    estimateView.contextWbs.textContent = record.wbs ? `WBS: ${record.wbs}` : "ยังไม่มีเลข WBS";
    estimateView.contextCustomer.textContent =
      [record.requestNumber, record.customerName].filter(Boolean).join(" · ");

    showView("estimate");
    showEstimateLevel(0);

    ensureEstimateCatalog()
      .then(() => {
        // แค็ตตาล็อกมาช้ากว่าการวาดหน้าจอได้ -- ถ้าตอนวาดยังไม่มีข้อมูล ดรอปดาวน์
        // จะว่าง จึงวาดใบที่เปิดอยู่ใหม่เมื่อข้อมูลมาถึง
        if (!estimateView.formPane.hidden) renderEstimateForm();
      })
      .catch(err => {
        console.error("CS Connect estimate catalog error:", err);
        estimateView.catalogNote.textContent =
          "โหลดรายการตั้งต้นไม่สำเร็จ — ลองเปิดหน้านี้ใหม่อีกครั้ง";
      });
  }

  document.getElementById("extEstimateOpenBtn").addEventListener("click", () => {
    if (extendFormRecord) openEstimateView(extendFormRecord);
  });

  document.getElementById("estAddDeptBtn").addEventListener("click", () => {
    const input = document.getElementById("estNewDept");
    const section = input.value.trim();
    if (!section) {
      showError(estimateView.error, "กรุณาเลือกแผนกก่อน");
      return;
    }

    // แผนกเดียวกันสองใบ = งานย่อยกระจายอยู่สองที่โดยไม่มีใครตั้งใจ ให้เปิดใบเดิม
    // แทนที่จะสร้างซ้ำ
    const existing = estimateModel.departments.findIndex(d => d.section === section);
    if (existing !== -1) {
      hideError(estimateView.error);
      input.value = "";
      estimateDeptIndex = existing;
      showEstimateLevel(1);
      return;
    }

    hideError(estimateView.error);
    estimateModel.departments.push({ section, jobs: [] });
    input.value = "";
    markEstimateDirty();
    renderEstimateDepts();
  });

  document.getElementById("estAddJobBtn").addEventListener("click", () => {
    const dept = currentDept();
    if (!dept) return;

    const name = document.getElementById("estNewJob");
    const investment = document.getElementById("estNewJobInvestment");

    const jobName = name.value.trim();
    const prefix = DEPARTMENT_PREFIX[dept.section] || "";

    // ชื่องานย่อยไม่บังคับกรอก -- ใบที่ยังไม่รู้ชื่อก็เปิดไว้ทำงานก่อนได้ แล้วค่อย
    // ตั้งชื่อทีหลังจากในใบเอง (jobLabel เติม "งานย่อยที่ N" ให้ระหว่างที่ยังว่าง)
    hideError(estimateView.error);

    dept.jobs.push({
      name: jobName,
      investment: investment.value.trim(),
      items: []
    });

    // กลับไปเป็นคำนำหน้าของแผนก ไม่ใช่ช่องว่าง -- ส่วนใหญ่เพิ่มติด ๆ กันหลายงาน
    name.value = prefix;
    investment.value = "";
    markEstimateDirty();
    renderEstimateJobs();
  });

  /**
   * แผงเลือกพัสดุ -- เลือกกลุ่ม แล้วเลือกรายการ แล้วป้อนจำนวน แล้วจึงกดเพิ่ม
   *
   * ที่ไม่ให้เลือกในตารางโดยตรงเหมือนเดิม เพราะตารางที่มีแถวเปล่ารออยู่ทำให้
   * "รายการที่อยู่ในใบ" กับ "ช่องที่ยังไม่ได้กรอก" ปนกันอยู่ในที่เดียวกัน --
   * ตารางในแบบนี้จึงมีแต่ของจริง และการเลือกเกิดที่เดียวคือแผงนี้
   */

  /** รายการพัสดุที่กำลังเลือกค้างอยู่ในแผง (null = ยังไม่ได้เลือก) */
  let pickedItem = null;

  /**
   * ตั้งรายการที่เลือก แล้วให้ "ช่องที่ผู้ใช้ไม่ได้พิมพ์อยู่" สะท้อนแถวนั้น
   *
   * กติกาที่ยึดไว้: สองช่อง (KeyCode / ชื่อรายการ) ต้องมาจากแถวเดียวกันในแค็ตตาล็อกเสมอ
   * ไม่งั้นช่องที่ไม่ได้พิมพ์ต้องว่าง -- ระหว่างพิมพ์ค้างครึ่งทางยังไม่นับว่าเลือก จึงล้าง
   * อีกช่องทิ้ง ป้องกันไม่ให้เหลือ KeyCode ของรายการก่อนหน้าค้างคู่กับชื่อที่กำลังพิมพ์ใหม่
   * ซึ่งถ้าเผลอกดเพิ่มตอนนั้นจะได้พัสดุผิดตัวไปเงียบ ๆ
   *
   * typedField บอกว่าช่องไหนคือช่องที่ผู้ใช้กำลังพิมพ์ จะได้ไม่เขียนทับสิ่งที่เขาพิมพ์ค้างไว้
   */
  function setPickedItem(item, typedField) {
    pickedItem = item || null;

    if (typedField !== "desc") {
      estimateView.pickItem.value = pickedItem ? pickedItem.description : "";
    }
    if (typedField !== "key") {
      estimateView.pickKeyCode.value = pickedItem ? (pickedItem.keyCode || "") : "";
    }
  }

  /** ล้างช่องพัสดุทั้งหมด (ไม่แตะกลุ่ม) -- ใช้หลังเพิ่มพัสดุสำเร็จและตอนเปิดใบใหม่ */
  function clearItemPick() {
    estimateView.pickIn.value = "";
    estimateView.pickRm.value = "";
    estimateView.pickRp.value = "";
    setPickedItem(null);
  }

  function resetItemPicker() {
    fillSelect(estimateView.pickGroup, catalogGroups(), "", "-- ทุกกลุ่ม (พิมพ์ค้นหา) --");
    clearItemPick();
    hideError(estimateView.pickError);
    syncItemPickerScope();
  }

  /**
   * เปลี่ยนกลุ่ม = เปลี่ยนขอบเขตการค้นของทั้งสองช่อง
   *
   * ไม่มีโหมดสองแบบอีกแล้ว: ทั้งช่อง KeyCode และช่องชื่อรายการเป็นช่องพิมพ์ที่เสนอ
   * ตัวเลือกระหว่างพิมพ์เหมือนกันทั้งคู่ ต่างกันแค่ค้นคนละคอลัมน์ การเลือกกลุ่มเป็นเพียง
   * ตัวย่อขอบเขต ไม่ได้เปลี่ยนวิธีใช้งาน -- คนใช้จึงเรียนรู้ท่าเดียวแล้วใช้ได้ทุกกรณี
   */
  function syncItemPickerScope() {
    setPickedItem(null);
    suggestDescriptions();
    suggestKeyCodes();
  }

  estimateView.pickGroup.addEventListener("change", () => {
    hideError(estimateView.pickError);
    syncItemPickerScope();
  });

  // input ครอบคลุมทั้งการพิมพ์เองและการเลือกจากรายการที่ datalist เสนอ
  estimateView.pickItem.addEventListener("input", () => {
    hideError(estimateView.pickError);
    suggestDescriptions();

    // ตรงกับชื่อในแค็ตตาล็อกพอดีเท่านั้นจึงนับว่าเลือกแล้ว -- พิมพ์ค้างครึ่งทางยังไม่ใช่
    const typed = estimateView.pickItem.value;
    const exact = typed ? scopedRows().find(i => i.description === typed) : null;
    setPickedItem(exact, "desc");
  });

  estimateView.pickKeyCode.addEventListener("input", () => {
    hideError(estimateView.pickError);
    suggestKeyCodes();

    const typed = estimateView.pickKeyCode.value.trim();
    const exact = typed ? scopedRows().find(i => (i.keyCode || "") === typed) : null;
    setPickedItem(exact, "key");
  });

  // คลิกช่องว่าง ๆ ตอนเลือกกลุ่มไว้ ต้องเห็นรายการทั้งกลุ่มเลย (suggestMinChars = 0)
  // แทนที่ดรอปดาวน์เดิมที่เคยไล่ดูได้ -- ไม่งั้นความสามารถ "ดูว่ากลุ่มนี้มีอะไรบ้าง" จะหายไป
  estimateView.pickItem.addEventListener("focus", suggestDescriptions);
  estimateView.pickKeyCode.addEventListener("focus", suggestKeyCodes);

  /* ---------- ชุดเซ็ตพัสดุ ---------- */

  /** ชุดเซ็ตที่เลือกค้างอยู่ในดรอปดาวน์ (null = ยังไม่ได้เลือก) */
  function currentKit() {
    const id = estimateView.kitSelect.value;
    if (!id) return null;
    return estimateKits.find(kit => String(kit.id) === id) || null;
  }

  /**
   * เทียบว่าพัสดุสองรายการคือ "ตัวเดียวกัน" หรือไม่
   *
   * เทียบด้วย KeyCode ก่อนเสมอ เพราะเป็นรหัสจริงของพัสดุ ส่วนชื่อรายการเป็นแค่
   * คำอธิบายที่ กฟภ. แก้เมื่อไหร่ก็ได้ -- กติกาเดียวกับตอนเพิ่มพัสดุทีละตัว
   * ถ้าไม่มีรหัส (แค็ตตาล็อกบางแถวไม่มี) จึงค่อยถอยไปเทียบชื่อ
   */
  function sameMaterial(a, b) {
    if (a.keyCode && b.keyCode) return a.keyCode === b.keyCode;
    if (a.keyCode || b.keyCode) return false;
    return a.description === b.description;
  }

  function refreshKitControls() {
    const previous = estimateView.kitSelect.value;

    fillSelect(
      estimateView.kitSelect,
      estimateKits.map(kit => String(kit.id)),
      estimateKits.some(kit => String(kit.id) === previous) ? previous : "",
      estimateKits.length ? "-- เลือกชุดเซ็ต --" : "-- ยังไม่มีชุดเซ็ตในระบบ --"
    );

    // fillSelect ใส่ value เป็น id ซึ่งคนอ่านไม่รู้เรื่อง -- เขียนทับข้อความที่แสดงด้วยชื่อจริง
    Array.from(estimateView.kitSelect.options).forEach(option => {
      const kit = estimateKits.find(k => String(k.id) === option.value);
      if (kit) option.textContent = `${kit.name} (${(kit.items || []).length} รายการ)`;
    });

    // ปุ่มสร้าง/ลบซ่อนไว้กับคนที่ไม่ใช่ผู้ดูแลระบบ -- เป็นแค่การจัดหน้าจอ ของจริง
    // กันที่ requireAdmin_ ฝั่งเซิร์ฟเวอร์ ซึ่งใครแก้ flag ในเบราว์เซอร์ก็ผ่านไม่ได้
    const admin = Boolean((getSession() || {}).isAdmin);
    estimateView.kitSaveBtn.hidden = !admin;
    estimateView.kitDeleteBtn.hidden = !admin;

    updateKitHint();
  }

  function updateKitHint() {
    const kit = currentKit();
    if (!kit) {
      estimateView.kitHint.textContent = estimateKits.length
        ? "เลือกชุดเซ็ตแล้วกด “เพิ่มทั้งชุด” พัสดุทุกรายการในชุดจะลงตารางให้พร้อมจำนวนตั้งต้น"
        : "ยังไม่มีชุดเซ็ต — ผู้ดูแลระบบสร้างได้จากงานย่อยที่ทำเสร็จแล้ว ด้วยปุ่มบันทึกเป็นชุดเซ็ต";
      return;
    }

    const parts = [`${(kit.items || []).length} รายการ`];
    if (kit.note) parts.push(kit.note);
    if (kit.createdByName) parts.push(`สร้างโดย ${kit.createdByName}`);
    estimateView.kitHint.textContent = parts.join(" · ");
  }

  /**
   * ไฮไลต์แถวที่เพิ่งเปลี่ยนจากการเพิ่มชุดเซ็ต แล้วจางหายเอง
   *
   * เพิ่มทีเดียวสิบสี่รายการ แล้วบางตัวถูกบวกรวมเข้ากับแถวเดิมที่อยู่กลางตาราง คือ
   * กรณีที่หน้าจอ "ดูเหมือนไม่มีอะไรเกิดขึ้น" ได้ง่ายมาก แล้วคนจะกดซ้ำ จำนวนก็เบิ้ล
   * โดยไม่รู้ตัว ข้อความสรุปอย่างเดียวไม่พอ เพราะมันไม่ได้บอกว่าไปโดนแถวไหน
   */
  function flashKitRows(marks) {
    const rows = Array.from(estimateView.rows.children);

    marks.forEach((kind, index) => {
      const row = rows[index];
      if (!row || !kind) return;
      row.classList.add(kind === "merged" ? "is-kit-merged" : "is-kit-new");
    });

    const first = marks.findIndex(Boolean);
    if (first !== -1 && rows[first]) {
      rows[first].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    setTimeout(() => {
      rows.forEach(row => row.classList.remove("is-kit-new", "is-kit-merged"));
    }, 2600);
  }

  estimateView.kitSelect.addEventListener("change", () => {
    hideError(estimateView.kitError);
    updateKitHint();
  });

  estimateView.kitAddBtn.addEventListener("click", () => {
    const job = currentJob();
    if (!job) return;
    if (!Array.isArray(job.items)) job.items = [];

    hideError(estimateView.kitError);

    const kit = currentKit();
    if (!kit) {
      showError(estimateView.kitError, "กรุณาเลือกชุดเซ็ตก่อน");
      return;
    }

    const kitItems = kit.items || [];
    if (!kitItems.length) {
      showError(estimateView.kitError, "ชุดเซ็ตนี้ไม่มีพัสดุอยู่เลย");
      return;
    }

    // เกินครึ่งของชุดมีอยู่ในใบแล้ว = สัญญาณว่าน่าจะกดชุดเดิมซ้ำ ถามก่อนดีกว่าบวกเงียบ ๆ
    const already = kitItems.filter(kitItem =>
      job.items.some(item => sameMaterial(item, kitItem))).length;

    if (already > kitItems.length / 2) {
      const ok = window.confirm(
        `พัสดุในชุดนี้ ${already} จาก ${kitItems.length} รายการมีอยู่ในงานย่อยนี้แล้ว\n`
        + "กดตกลงเพื่อบวกจำนวนเพิ่มเข้าไปในรายการเดิม"
      );
      if (!ok) return;
    }

    let added = 0;
    let missing = 0;
    // เก็บ "ตัวออบเจกต์" ของแถวที่ถูกบวกรวม ไม่ใช่เลขลำดับ -- ลำดับของแถวเดิมไม่ขยับ
    // ก็จริง แต่การอ้างด้วยตัวออบเจกต์ตรง ๆ ไม่ต้องไปพึ่งข้อสมมตินั้นเลย
    const mergedItems = new Set();

    kitItems.forEach(kitItem => {
      // แค็ตตาล็อกวันนี้ไม่มีรายการนี้แล้ว -- ยังเพิ่มให้ตามปกติ แต่ต้องบอกให้รู้
      // ชุดเซ็ตเก็บชื่อและกลุ่มไว้ในตัวเอง จึงประกอบกลับได้แม้ กฟภ. ถอดพัสดุออกไปแล้ว
      if (!catalogRows().some(row => sameMaterial(row, kitItem))) missing += 1;

      const existing = job.items.find(item => sameMaterial(item, kitItem));

      if (existing) {
        ["in", "rm", "rp"].forEach(key => {
          const total = (Number(existing[key]) || 0) + (Number(kitItem[key]) || 0);
          existing[key] = total ? String(total) : "";
        });
        mergedItems.add(existing);
        return;
      }

      job.items.push({
        group: kitItem.group || "",
        description: kitItem.description,
        keyCode: kitItem.keyCode || "",
        in: kitItem.in || "",
        rm: kitItem.rm || "",
        rp: kitItem.rp || ""
      });
      added += 1;
    });

    // แถวที่เพิ่มใหม่ถูกต่อท้ายเสมอ ทุกแถวตั้งแต่ตำแหน่งนี้ไปคือของใหม่
    const firstNew = job.items.length - added;
    const marks = job.items.map((item, index) => {
      if (index >= firstNew) return "new";
      return mergedItems.has(item) ? "merged" : "";
    });

    renderEstimateRows();
    markEstimateDirty();
    flashKitRows(marks);

    const summary = [`เพิ่มชุด “${kit.name}” · ${kitItems.length} รายการ`];
    if (added) summary.push(`ใหม่ ${added}`);
    if (mergedItems.size) summary.push(`รวมกับรายการเดิม ${mergedItems.size}`);
    if (missing) summary.push(`ไม่พบในแค็ตตาล็อกปัจจุบัน ${missing} (เพิ่มให้แล้ว)`);

    showError(estimateView.kitError, summary.join(" · "));
    estimateView.kitError.classList.add("is-notice");
  });

  /* ---------- สร้าง / ลบ ชุดเซ็ต (ผู้ดูแลระบบ) ---------- */

  estimateView.kitSaveBtn.addEventListener("click", () => {
    hideError(estimateView.kitError);

    const job = currentJob();
    if (!job || !(job.items || []).length) {
      showError(estimateView.kitError, "งานย่อยนี้ยังไม่มีพัสดุให้บันทึกเป็นชุดเซ็ต");
      return;
    }

    // เลือกชุดไว้ = ตั้งใจเขียนทับชุดนั้น ไม่ได้เลือก = สร้างชุดใหม่
    const kit = currentKit();
    estimateView.kitName.value = kit ? kit.name : (job.name || "");
    estimateView.kitNote.value = kit ? kit.note : "";
    estimateView.kitSaveForm.hidden = false;
    estimateView.kitName.focus();
  });

  estimateView.kitSaveCancelBtn.addEventListener("click", () => {
    estimateView.kitSaveForm.hidden = true;
    hideError(estimateView.kitError);
  });

  estimateView.kitSaveConfirmBtn.addEventListener("click", async () => {
    const job = currentJob();
    if (!job) return;

    hideError(estimateView.kitError);

    const name = estimateView.kitName.value.trim();
    if (!name) {
      showError(estimateView.kitError, "กรุณาตั้งชื่อชุดเซ็ต");
      return;
    }

    const items = (job.items || [])
      .filter(item => item.description)
      .map(item => ({
        keyCode: item.keyCode || "",
        description: item.description,
        group: item.group || "",
        in: item.in || "",
        rm: item.rm || "",
        rp: item.rp || ""
      }));

    if (!items.length) {
      showError(estimateView.kitError, "งานย่อยนี้ยังไม่มีพัสดุให้บันทึกเป็นชุดเซ็ต");
      return;
    }

    const existing = currentKit();
    if (existing) {
      const ok = window.confirm(`เขียนทับชุดเซ็ต “${existing.name}” ด้วยพัสดุ ${items.length} รายการนี้?`);
      if (!ok) return;
    }

    try {
      setBusy(estimateView.kitSaveConfirmBtn, true, "กำลังบันทึก...");

      const result = await backend.saveEstimateKit({
        id: existing ? existing.id : "",
        name,
        note: estimateView.kitNote.value.trim(),
        items
      });

      estimateKits = result.kits || [];
      estimateView.kitSaveForm.hidden = true;
      refreshKitControls();

      showError(estimateView.kitError, `บันทึกชุดเซ็ต “${name}” แล้ว (${items.length} รายการ)`);
      estimateView.kitError.classList.add("is-notice");
    } catch (err) {
      console.error("CS Connect save kit error:", err);
      showError(estimateView.kitError, friendlyError(err, "บันทึกชุดเซ็ตไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(estimateView.kitSaveConfirmBtn, false);
    }
  });

  estimateView.kitDeleteBtn.addEventListener("click", async () => {
    hideError(estimateView.kitError);

    const kit = currentKit();
    if (!kit) {
      showError(estimateView.kitError, "กรุณาเลือกชุดเซ็ตที่ต้องการลบ");
      return;
    }

    const ok = window.confirm(
      `ลบชุดเซ็ต “${kit.name}”?\n`
      + "ใบประมาณการที่เคยใช้ชุดนี้ไปแล้วไม่ได้รับผลกระทบ"
    );
    if (!ok) return;

    try {
      setBusy(estimateView.kitDeleteBtn, true, "กำลังลบ...");

      const result = await backend.deleteEstimateKit(kit.id);
      estimateKits = result.kits || [];
      estimateView.kitSelect.value = "";
      refreshKitControls();

      showError(estimateView.kitError, `ลบชุดเซ็ต “${kit.name}” แล้ว`);
      estimateView.kitError.classList.add("is-notice");
    } catch (err) {
      console.error("CS Connect delete kit error:", err);
      showError(estimateView.kitError, friendlyError(err, "ลบชุดเซ็ตไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(estimateView.kitDeleteBtn, false);
    }
  });

  /** อ่านจำนวนจากช่อง -- ว่าง = 0, อ่านไม่ออก = null (ให้ผู้เรียกทักท้วง) */
  function readQty(input) {
    const text = input.value.trim();
    if (!text) return 0;
    const value = Number(text);
    return isFinite(value) ? value : null;
  }

  document.getElementById("estAddItemBtn").addEventListener("click", () => {
    const job = currentJob();
    if (!job) return;
    if (!Array.isArray(job.items)) job.items = [];

    hideError(estimateView.pickError);

    if (!pickedItem) {
      showError(estimateView.pickError, "กรุณาเลือกรายการพัสดุก่อน");
      return;
    }

    const quantities = {
      in: readQty(estimateView.pickIn),
      rm: readQty(estimateView.pickRm),
      rp: readQty(estimateView.pickRp)
    };

    if (quantities.in === null || quantities.rm === null || quantities.rp === null) {
      showError(estimateView.pickError, "จำนวนต้องเป็นตัวเลข");
      return;
    }

    if (!quantities.in && !quantities.rm && !quantities.rp) {
      showError(estimateView.pickError, "กรุณากรอกจำนวนอย่างน้อยหนึ่งช่อง (ติดตั้ง / รื้อถอน / นำกลับมาใช้)");
      return;
    }

    // รายการต้องไม่ซ้ำกันในใบเดียว -- เพิ่มพัสดุตัวเดิมซ้ำคือการปรับจำนวนของแถว
    // ที่มีอยู่ ไม่ใช่การสร้างแถวใหม่ (ใส่จำนวนติดลบเพื่อหักออกได้) เทียบด้วย
    // KeyCode ถ้ามี เพราะเป็นรหัสจริงของพัสดุ ชื่อรายการเป็นแค่คำอธิบาย
    const existing = job.items.find(item => (
      pickedItem.keyCode
        ? item.keyCode === pickedItem.keyCode
        : item.description === pickedItem.description
    ));

    if (existing) {
      ["in", "rm", "rp"].forEach(key => {
        const total = (Number(existing[key]) || 0) + quantities[key];
        existing[key] = total ? String(total) : "";
      });

      renderEstimateRows();
      markEstimateDirty();

      // ต้องบอกให้รู้ว่าเกิดอะไรขึ้น -- ไม่มีแถวใหม่โผล่มา ถ้าเงียบไว้จะดูเหมือน
      // กดเพิ่มแล้วไม่มีอะไรเกิดขึ้น แล้วผู้ใช้จะกดซ้ำอีก
      showError(estimateView.pickError, `รวมจำนวนเข้ากับรายการเดิมแล้ว: ${pickedItem.description}`);
      estimateView.pickError.classList.add("is-notice");

      clearItemPick();
      return;
    }

    const item = {
      group: pickedItem.group || estimateView.pickGroup.value || "",
      description: pickedItem.description,
      keyCode: pickedItem.keyCode || "",
      in: quantities.in ? String(quantities.in) : "",
      rm: quantities.rm ? String(quantities.rm) : "",
      rp: quantities.rp ? String(quantities.rp) : ""
    };

    job.items.push(item);
    renderEstimateRow(item);
    markEstimateDirty();

    // ล้างเฉพาะจำนวนกับรายการ ไม่ล้างกลุ่ม -- พัสดุที่เพิ่มติด ๆ กันมักอยู่กลุ่มเดียวกัน
    clearItemPick();
  });

  // หัวใบผูกสดกับโมเดลเหมือนช่องในตาราง
  estimateView.jobName.addEventListener("input", () => {
    const job = currentJob();
    if (!job) return;
    job.name = estimateView.jobName.value;
    estimateView.formPaneTitle.textContent = jobLabel(job, estimateJobIndex);
    markEstimateDirty();
  });

  estimateView.investment.addEventListener("change", () => {
    const job = currentJob();
    if (job) { job.investment = estimateView.investment.value; markEstimateDirty(); }
  });

  document.getElementById("estimateBackBtn").addEventListener("click", () => {
    // ถอยทีละชั้นก่อน แล้วค่อยออกจากหน้า -- และเตือนถ้ายังไม่ได้บันทึก
    if (!estimateView.formPane.hidden) return showEstimateLevel(1);
    if (!estimateView.jobPane.hidden) return showEstimateLevel(0);

    if (estimateDirty && !confirm("ยังไม่ได้บันทึกประมาณการ ออกจากหน้านี้เลยหรือไม่?")) return;

    openRequestForm("extend", estimateRecord, { returnTo: "extendWork" });
  });

  /**
   * ใบประมาณการที่จะพิมพ์ ตามชั้นที่เปิดอยู่ -- ทั้งหมด / ทั้งแผนก / เฉพาะใบนี้
   *
   * พิมพ์จาก estimateModel ที่อยู่บนหน้าจอ ไม่ใช่จากคำร้องที่บันทึกไว้ -- สิ่งที่
   * เห็นคือสิ่งที่ได้ (ป้าย "ยังไม่ได้บันทึก" บนแถบบนเตือนอยู่แล้วว่ายังไม่ถูกเก็บ)
   */
  function estimateSheetsToPrint() {
    const sheets = [];

    (estimateModel.departments || []).forEach((dept, deptIndex) => {
      if (estimateDeptIndex >= 0 && deptIndex !== estimateDeptIndex) return;

      (dept.jobs || []).forEach((job, jobIndex) => {
        if (estimateJobIndex >= 0 && jobIndex !== estimateJobIndex) return;
        sheets.push({ section: dept.section, job, jobIndex });
      });
    });

    return sheets;
  }

  /**
   * ใบประมาณการบนกระดาษ A4 -- หนึ่งงานย่อยต่อหนึ่งแผ่น ตามฟอร์มที่แผนกใช้อยู่
   *
   * ใช้วิธีเดียวกับใบพิมพ์อื่นในแอปนี้ (เปิดแท็บใหม่ เขียนเอกสารที่มี @page ของ
   * ตัวเอง แล้วสั่งพิมพ์) -- "บันทึกเป็น PDF" คือปลายทางหนึ่งของกล่องพิมพ์อยู่แล้ว
   * จึงไม่ต้องแบกไลบรารีสร้าง PDF ซึ่ง CSP ของหน้านี้บล็อกอยู่ดี
   *
   * เอกสารที่เปิดด้วย window.open("") สืบทอด CSP ของหน้าแม่ -- ห้ามมี <script>
   * หรือ on* attribute ปุ่มพิมพ์จึงผูก event จากหน้าแม่
   */
  function printEstimateSheets() {
    const sheets = estimateSheetsToPrint();

    if (!sheets.length) {
      showError(estimateView.error, "ยังไม่มีงานย่อยให้พิมพ์");
      return;
    }

    const win = window.open("", "_blank");
    if (!win) return;

    const wbs = escapeForPrint((estimateRecord && estimateRecord.wbs) || "-");
    const printedAt = new Date().toLocaleString("th-TH", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    // เว้นบรรทัดว่างไว้ให้เขียนเพิ่มด้วยมือ เหมือนฟอร์มกระดาษที่ใช้กันอยู่
    // 22 บรรทัดกินพื้นที่ราว 193 มม. บนกระดาษ A4 (สูง 277 มม. เมื่อหักขอบแล้ว)
    // -- เต็มหน้าพอที่จะเขียนเพิ่มได้จริง โดยยังไม่ดันอะไรไปหน้าที่สอง
    const MIN_ROWS = 22;

    const sheetHtml = sheets.map(({ section, job, jobIndex }) => {
      const items = (job.items || []).filter(i => i.description);
      const rows = [];

      items.forEach((item, i) => {
        rows.push(`<tr>
          <td class="c">${i + 1}</td>
          <td>${escapeForPrint(item.description)}</td>
          <td class="mono c">${escapeForPrint(item.keyCode || "")}</td>
          <td class="c">${escapeForPrint(item.in || "")}</td>
          <td class="c">${escapeForPrint(item.rm || "")}</td>
          <td class="c">${escapeForPrint(item.rp || "")}</td>
        </tr>`);
      });

      for (let i = items.length; i < MIN_ROWS; i++) {
        rows.push(`<tr><td class="c">${i + 1}</td><td></td><td></td><td></td><td></td><td></td></tr>`);
      }

      const group = escapeForPrint(job.name || job.group || `งานย่อยที่ ${jobIndex + 1}`);

      return `<section class="sheet">
        <div class="head">
          <div class="wbs"><span>WBS</span><strong>${wbs}</strong></div>
          <table class="meta">
            <tr>
              <th>Section :</th><td>${escapeForPrint(section || "-")}</td>
              <th>การลงทุน/ทรัพย์สิน :</th><td class="c">${escapeForPrint(job.investment || "-")}</td>
            </tr>
            <tr><th>Group :</th><td colspan="3">${group}</td></tr>
          </table>
        </div>

        <table class="items">
          <thead>
            <tr>
              <th class="w-no">ลำดับ</th>
              <th>Description</th>
              <th class="w-key">รหัสพัสดุ</th>
              <th class="w-qty">IN.</th>
              <th class="w-qty">RM.</th>
              <th class="w-qty">RP.</th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>

        <div class="foot">
          <span>รวม ${items.length} รายการ</span>
          <span>วันที่พิมพ์: ${escapeForPrint(printedAt)}</span>
        </div>
      </section>`;
    }).join("");

    win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>ใบประมาณการ ${wbs}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Sarabun", "Segoe UI", sans-serif; color: #221530; font-size: 10.5pt; }

  /* หนึ่งงานย่อย = หนึ่งแผ่น ใบถัดไปขึ้นหน้าใหม่เสมอ */
  .sheet { page-break-after: always; break-after: page; }
  .sheet:last-child { page-break-after: auto; break-after: auto; }

  .head { display: flex; align-items: stretch; gap: 5mm; margin-bottom: 4mm; }
  .wbs {
    flex: none; min-width: 62mm; border: 2px solid #57298c; border-radius: 5px;
    padding: 3mm 5mm; text-align: center;
  }
  .wbs span { display: block; font-size: 9pt; color: #6b5c82; }
  .wbs strong {
    display: block; margin-top: 1mm; font-size: 17pt; font-weight: 700;
    letter-spacing: .5px; color: #38185c;
  }
  .meta { flex: 1; border-collapse: collapse; }
  .meta th, .meta td { border: 1px solid #cdb9ea; padding: 2mm 3mm; font-size: 10pt; }
  .meta th { background: #f6f1fb; text-align: left; font-weight: 600; color: #38185c; white-space: nowrap; }

  .items { width: 100%; border-collapse: collapse; }
  .items th, .items td { border: 1px solid #cdb9ea; padding: 1.8mm 2.5mm; }
  .items th { background: #f6f1fb; font-size: 9.5pt; color: #38185c; }
  /* หัวตารางซ้ำทุกหน้า เผื่อรายการยาวเกินหนึ่งแผ่น */
  .items thead { display: table-header-group; }
  .items tr { page-break-inside: avoid; break-inside: avoid; }
  .items td { height: 7mm; }
  .w-no { width: 12mm; }
  .w-key { width: 26mm; }
  .w-qty { width: 14mm; }
  .c { text-align: center; }
  .mono { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 9pt; }

  .foot {
    display: flex; justify-content: space-between; gap: 8mm;
    margin-top: 3mm; font-size: 9.5pt; color: #6b5c82;
  }

  .actions { text-align: center; margin: 6mm 0; }
  .actions button { font: inherit; padding: 8px 18px; cursor: pointer; }
  @media print { .actions { display: none; } }
</style></head><body>
${sheetHtml}
<div class="actions"><button type="button" id="printBtn">พิมพ์ / บันทึกเป็น PDF</button></div>
</body></html>`);
    win.document.close();

    win.document.getElementById("printBtn").addEventListener("click", () => win.print());
    win.print();
  }

  document.getElementById("estimatePrintBtn").addEventListener("click", () => {
    hideError(estimateView.error);
    printEstimateSheets();
  });

  /**
   * ล็อกทุกช่องกรอกและปุ่มนำทางของหน้าประมาณการระหว่างที่กำลังยิงคำขอบันทึก
   *
   * ก่อนหน้านี้ล็อกแค่ปุ่ม "บันทึกประมาณการ" ปุ่มเดียว -- ระหว่างรอเครือข่าย
   * (พิมพ์เร็ว ๆ นี้ก็ยังพอสังเกตได้ราวครึ่งถึงหนึ่งวินาที) เจ้าหน้าที่ยังกด
   * "+ เพิ่มรายการ" หรือ "กลับ" ได้ตามปกติ ถ้ากด "กลับ" ออกไปก่อนคำขอตอบกลับ
   * estimateModel จะยังไม่ถูกแทนที่ด้วยฉบับที่เพิ่งบันทึก แล้วพอคำขอตอบกลับทีหลัง
   * การอัปเดตตัวแปรก็เกิดขึ้นบนหน้าที่ผู้ใช้ออกไปแล้ว -- ดูเหมือนกดบันทึกแล้ว
   * ข้อมูลหายไปเฉย ๆ ทั้งที่จริงบันทึกขึ้นเซิร์ฟเวอร์ไปแล้ว เพียงแต่จอไม่ตรงกัน
   */
  function setEstimatePageBusy(busy) {
    document.getElementById("estimateBackBtn").disabled = busy;
    document.getElementById("estimatePrintBtn").disabled = busy;
    document.getElementById("estAddItemBtn").disabled = busy;
    estimateView.pickGroup.disabled = busy;
    estimateView.pickItem.disabled = busy;
    estimateView.pickKeyCode.disabled = busy;
    estimateView.pickIn.disabled = busy;
    estimateView.pickRm.disabled = busy;
    estimateView.pickRp.disabled = busy;
    estimateView.rows.querySelectorAll("input, select, button").forEach(el => { el.disabled = busy; });
    estimateView.jobName.disabled = busy;
    estimateView.investment.disabled = busy;
    estimateView.crumbs.querySelectorAll("button").forEach(el => { el.disabled = busy; });
    // ปุ่มเพิ่มแผนก/เพิ่มงานย่อยอยู่คนละชั้นกับฟอร์ม แต่ปุ่มบันทึกอยู่บนแถบบนที่
    // เห็นได้ทุกชั้น -- กันไว้เผื่อกดบันทึกตอนอยู่ชั้นแผนก/งานย่อยแล้วยังกดเพิ่ม
    // รายการใหม่ได้ในช่วงที่รอเครือข่ายอยู่ ซึ่งจะถูกทับหายไปตอนบันทึกเสร็จ
    document.getElementById("estAddDeptBtn").disabled = busy;
    document.getElementById("estNewDept").disabled = busy;
    document.getElementById("estAddJobBtn").disabled = busy;
    document.getElementById("estNewJob").disabled = busy;
    document.getElementById("estNewJobInvestment").disabled = busy;
    estimateView.deptList.querySelectorAll("button").forEach(el => { el.disabled = busy; });
    estimateView.jobList.querySelectorAll("button").forEach(el => { el.disabled = busy; });
  }

  document.getElementById("estimateSaveBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    hideError(estimateView.error);
    estimateView.success.hidden = true;

    if (!estimateRecord) return;

    setBusy(btn, true, "กำลังบันทึก...");
    setEstimatePageBusy(true);

    try {
      // ตัดแถวว่างทิ้งตอนบันทึก -- แถวเปล่าที่เติมไว้ให้พิมพ์ ไม่ใช่ข้อมูล
      const clean = {
        departments: estimateModel.departments.map(dept => ({
          section: dept.section,
          jobs: (dept.jobs || []).map(job => ({
            name: job.name || "",
            // เก็บต่อไว้เฉย ๆ สำหรับใบเก่าที่เคยแยกช่อง Group ไว้ ของใหม่ไม่ได้ใช้
            group: job.group || "",
            investment: job.investment || "",
            items: (job.items || []).filter(item => item.description).map(item => ({
              group: item.group || "",
              description: item.description,
              keyCode: item.keyCode || "",
              in: item.in || "",
              rm: item.rm || "",
              rp: item.rp || ""
            }))
          }))
        }))
      };

      const { byName: savedByName, byEmail: savedByEmail } = actingStaff();
      const now = Date.now();

      const requests = getRequests();
      const index = requests.findIndex(r => r.id === estimateRecord.id);
      if (index === -1) throw new Error("ไม่พบคำร้องนี้แล้ว (อาจถูกแก้ไขไปแล้ว)");

      requests[index] = {
        ...requests[index],
        estimate: clean,
        updatedByName: savedByName,
        updatedByEmail: savedByEmail,
        updatedAt: now
      };

      await saveRequests(requests);

      estimateRecord = requests[index];
      estimateModel = JSON.parse(JSON.stringify(clean));
      estimateDirty = false;
      estimateView.dirty.hidden = true;
      estimateView.success.textContent = "บันทึกประมาณการเรียบร้อย";
      estimateView.success.hidden = false;

      // วาดใบที่กำลังเปิดอยู่ใหม่จาก estimateModel ฉบับที่เพิ่งบันทึกเสมอ --
      // ต่อให้ก่อนหน้านี้จอกับโมเดลจะไม่มีวันเพี้ยนกันอยู่แล้ว การวาดซ้ำที่นี่
      // คือการยืนยันด้วยโค้ด ไม่ใช่แค่ด้วยความเชื่อ ว่าสิ่งที่เห็นตรงกับที่บันทึกจริง
      if (!estimateView.formPane.hidden) renderEstimateForm();
      else if (!estimateView.jobPane.hidden) renderEstimateJobs();
      else if (!estimateView.deptPane.hidden) renderEstimateDepts();
    } catch (err) {
      console.error("CS Connect estimate save error:", err);
      showError(estimateView.error, friendlyError(err, "บันทึกประมาณการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(btn, false);
      setEstimatePageBusy(false);
    }
  });

  // ---------- งานขอขยายเขตระบบจำหน่ายไฟฟ้า (โมดูลปฏิบัติงาน) ----------
  //
  // หน้านี้ไม่ได้ถือข้อมูลของตัวเองเลย -- อ่านจาก requestsCache ชุดเดียวกับหน้า
  // "งานรับคำร้อง" แล้วกรองเอาเฉพาะ type === "extend" คำร้องที่บันทึกจากหน้าโน้น
  // จึงมาโผล่ที่นี่ทันทีโดยไม่ต้องมีขั้นตอน "ส่งต่อ" ใด ๆ ให้พลาดได้
  const extendWorkList = document.getElementById("extendWorkList");
  const extendWorkListMode = document.getElementById("extendWorkListMode");
  const extendDetailMode = document.getElementById("extendDetailMode");
  const extendPaneForm = document.getElementById("extendPaneForm");
  const extendPaneMeta = document.getElementById("extendPaneMeta");
  const extendDetailTitle = document.getElementById("extendDetailTitle");
  const extendDetailSubtitle = document.getElementById("extendDetailSubtitle");
  const extendPaneItems = document.querySelectorAll("[data-extend-pane]");
  const extendPaneNotice = document.getElementById("extendPaneNotice");
  const extendWorkChips = document.getElementById("extendWorkChips");
  const extendWorkTitle = document.getElementById("extendWorkTitle");
  const extendWorkCount = document.getElementById("extendWorkCount");
  const extendWorkSearch = document.getElementById("extendWorkSearch");
  const extendAssignBar = document.getElementById("extendAssignBar");
  const extendAssignCount = document.getElementById("extendAssignCount");
  const extendAssignSelect = document.getElementById("extendAssignSelect");
  const extendAssignBtn = document.getElementById("extendAssignBtn");
  const extendAssignError = document.getElementById("extendAssignError");
  const extendAssignSuccess = document.getElementById("extendAssignSuccess");

  const EXTEND_FILTER_ALL = "all";
  const EXTEND_FILTER_MINE = "mine";
  // มุมมองพิเศษ: ไม่ได้กรองเฉย ๆ แต่จัดเรียงใหม่เป็นคิวของแต่ละคน
  const EXTEND_FILTER_QUEUE = "queue";
  // มุมมองของหัวหน้า: งานในมือของแต่ละคน กดชื่อเดียวเห็นทั้งกอง
  const EXTEND_FILTER_PEOPLE = "people";
  const EXTEND_SURVEY_STATUS = "รอสำรวจ";

  let extendFilter = EXTEND_FILTER_ALL;
  let extendSearchQuery = "";
  let extendSelection = new Set();
  // สถานะที่ถูกย่อไว้ในมุมมองแบบจัดกลุ่ม -- จำระหว่างเปิดเว็บ ไม่ได้เก็บถาวร
  let extendCollapsed = new Set();
  // หน้ารายคนของหัวหน้า: กำลังดูงานของใครอยู่ (ว่าง = ยังอยู่หน้ารายชื่อ)
  let extendPersonEmail = "";

  // รายชื่อเจ้าหน้าที่ -- เดิมดึงมาเฉพาะตอนหัวหน้างานเปิดหน้าจ่ายงาน (หรือ
  // ผู้ดูแลระบบเปิดหน้าตั้งสิทธิ์) พนักงานทั่วไปไม่เคยได้รับเลย แต่ตอนนี้ดรอปดาวน์
  // เลือกผู้ส่งบนสมุดคุม (ทั้งมิเตอร์และคำร้องทั่วไป -- ดู resolveSenderInfo)
  // ก็ดึงรายชื่อนี้ด้วยเหมือนกัน ซึ่งพนักงานทั่วไปเข้าถึงหน้าพิมพ์สมุดคุมได้อยู่
  // แล้ว จึงไม่ใช่การเปิดสิทธิ์ใหม่ -- action listStaff เองก็เป็น requireAuth_
  // ธรรมดา ไม่ได้ล็อกไว้เฉพาะหัวหน้างานตั้งแต่แรก แค่ front end ไม่เคยเรียกก็เท่านั้น
  let staffRoster = [];

  /**
   * ตัวเลือกสถานะทั้งหมด อ่านจาก <select> ของฟอร์มโดยตรง ไม่ประกาศซ้ำ
   *
   * เหตุผลเดียวกับที่แถวในกลุ่มคำร้องถูก "โคลน" มาจากฟอร์มหลัก: ถ้าเพิ่มสถานะใหม่
   * ในฟอร์มแล้วต้องมาเพิ่มในลิสต์ที่นี่อีกที วันหนึ่งมันจะไม่ตรงกัน แล้วจะมีงาน
   * ที่ไม่โผล่ในชิปไหนเลย
   */
  function extendStatuses() {
    return Array.from(extJobStatus.options).map(o => o.value).filter(Boolean);
  }

  /**
   * ย้ายฟอร์มคำร้องขอขยายเขตฯ กับแผงประวัติเข้า/ออกจากหน้ารายละเอียดของโมดูลนี้
   *
   * ย้ายโหนดจริงด้วย appendChild ไม่ได้ก๊อบมาร์กอัปมาไว้สองที่ -- ฟอร์มยาวร่วม
   * สองร้อยบรรทัดและมี event ผูกไว้เต็มไปหมด สองชุดคือสองชุดที่ต้องแก้ให้ตรงกัน
   * ตลอดไป ส่วนการย้ายโหนดพา event กับค่าที่กรอกไว้ไปด้วยทั้งหมด
   *
   * บ้านเดิมของทั้งสองอันอยู่ในหน้างานรับคำร้อง (ฟอร์มขอใช้ไฟฟ้าใช้แผงประวัติ
   * ตัวเดียวกัน) จึงต้องย้ายกลับทุกครั้งที่เปิดฟอร์มประเภทอื่น
   */
  const extendFormHome = extendForm.parentElement;
  const requestFormMetaHome = requestFormMeta.parentElement;
  const extendFormLayout = extendPaneMeta.parentElement;

  /**
   * การ์ดสรุปมีสองที่อยู่ และเลือกที่อยู่ตามความกว้างจอ
   *
   * กว้างพอ -> เป็นคอลัมน์กลางระหว่างฟอร์มกับแผงประวัติ ซึ่งเป็นที่ว่างที่มีอยู่แล้ว
   * ไม่พอ   -> ย้ายเข้าไปอยู่บนสุดของแผงขวา เหนือประวัติสถานะ
   *
   * เกณฑ์ 1640px ไม่ใช่ตัวเลขลอย ๆ แต่คือความกว้างที่สามคอลัมน์ต้องใช้จริง:
   * 240 แถบซ้าย + 72 ขอบ + 480 ฟอร์ม + 32 ช่องไฟ + 340 การ์ด + 32 ช่องไฟ + 442 แผงขวา
   * = 1638 ต่ำกว่านี้การ์ดจะไปเบียดฟอร์มให้แคบลง ซึ่งห้ามเกิดขึ้น -- ฟอร์มคือสิ่งที่
   * คนกำลังทำงานด้วย การ์ดเป็นแค่ของแถม ของแถมต้องหลบ ไม่ใช่ให้ของหลักหลบ
   *
   * ทำด้วย JS ไม่ใช่ CSS เพราะสองที่นี้อยู่คนละกิ่งของ DOM -- media query ย้าย
   * โหนดไม่ได้ ทำได้แค่ขยับตำแหน่งในกิ่งเดียวกัน (ความพยายามครั้งก่อนที่ใช้
   * flex-wrap + order ล้มเพราะ max-width ไปหักล้าง width: 100% การ์ดจึงไม่ตก
   * บรรทัดจริง กลายเป็นก้อนแทรกซ้ายและบีบฟอร์มแทน)
   */
  const summaryWideLayout = window.matchMedia("(min-width: 1640px)");

  function placeSummaryCard() {
    // แผงขวาเป็นโหนดที่ถูกย้ายไปมาระหว่างสองหน้าอยู่แล้ว ดูจากพ่อแม่ของมันว่า
    // ตอนนี้อยู่หน้าไหน จะได้ไม่ต้องส่งสถานะ "อยู่หน้าไหน" มาอีกทาง
    const inExtend = requestFormMeta.parentElement === extendPaneMeta;

    const parent = summaryWideLayout.matches
      ? (inExtend ? extendFormLayout : requestFormMetaHome)
      : requestFormMeta;
    const before = summaryWideLayout.matches
      ? (inExtend ? extendPaneMeta : requestFormMeta)
      : requestFormStatusHistory;

    if (requestFormSummary.parentElement === parent
      && requestFormSummary.nextSibling === before) return;

    parent.insertBefore(requestFormSummary, before);
  }

  // ลากขอบหน้าต่างข้ามเกณฑ์แล้วต้องย้ายตาม ไม่ใช่ค้างผิดที่จนกว่าจะเปิดฟอร์มใหม่
  summaryWideLayout.addEventListener("change", placeSummaryCard);

  function mountExtendDetail() {
    if (extendForm.parentElement !== extendPaneForm) extendPaneForm.appendChild(extendForm);
    if (requestFormMeta.parentElement !== extendPaneMeta) extendPaneMeta.appendChild(requestFormMeta);
    placeSummaryCard();
  }

  function unmountExtendDetail() {
    if (extendForm.parentElement !== extendFormHome) extendFormHome.appendChild(extendForm);
    if (requestFormMeta.parentElement !== requestFormMetaHome) {
      requestFormMetaHome.appendChild(requestFormMeta);
    }
    // ต้องย้ายแผงขวากลับก่อน -- placeSummaryCard อ่านพ่อแม่ของแผงเพื่อรู้ว่าอยู่หน้าไหน
    placeSummaryCard();
  }

  /** แถบซ้ายของหน้ารายละเอียด -- แต่ละปุ่มคือขั้นตอนหนึ่งของงาน */
  function showExtendPane(name) {
    extendPaneItems.forEach(item => {
      item.classList.toggle("active", item.dataset.extendPane === name);
    });

    extendPaneForm.hidden = name !== "form";
    extendPaneMeta.hidden = name !== "form";
    // การ์ดสรุปอยู่คู่กับแผงประวัติ -- แสดงเฉพาะหน้ารายละเอียดคำร้อง และเฉพาะคำร้องที่บันทึกแล้ว
    requestFormSummary.hidden = name !== "form" || !summaryRecord;
    extPlanSection.hidden = name !== "plan" || !extendStage.plan;
    extPhotoSection.hidden = name !== "photo" || !extendStage.photo;
    extEstimateSection.hidden = name !== "estimate" || !extendStage.estimate;

    // ขั้นที่ยังไม่ถึง ให้บอกตรง ๆ ว่าทำไมยังว่าง แทนที่จะโชว์หน้าเปล่า
    extendPaneNotice.hidden = name === "form" || extendStage[name];
    if (!extendPaneNotice.hidden) {
      extendPaneNotice.textContent = EXTEND_PANE_NOTICE[name] || "";
    }

    window.scrollTo(0, 0);
  }

  /** ขั้นไหนพร้อมใช้แล้วบ้าง -- คำนวณจากคำร้องที่บันทึกไว้จริง ที่เดียว */
  const extendStage = { plan: false, photo: false, estimate: false };

  const EXTEND_PANE_NOTICE = {
    plan: "แนบแผนผังได้เมื่อสถานะเป็น “รอเขียนผัง” (กรอกเลข WBS แล้วบันทึก สถานะจะเปลี่ยนให้เอง)",
    photo: "แนบภาพหน้างานได้เมื่อคำร้องมีเลข WBS แล้ว",
    estimate: "ทำประมาณการได้เมื่อสถานะเป็น “รอประมาณการ” (แนบแผนผังแล้ว สถานะจะเปลี่ยนให้เอง)"
  };

  function extendJobs() {
    return getRequests().filter(r => r.type === "extend");
  }

  /** หัวหน้างานหรือผู้ดูแลระบบ -- แค่เรื่องการแสดงผล ด่านจริงอยู่ฝั่งเซิร์ฟเวอร์ */
  function canAssignWork() {
    const session = getSession();
    return Boolean(session && (session.isSupervisor || session.isAdmin));
  }

  function extendFilterMatches(record) {
    if (extendFilter === EXTEND_FILTER_ALL) return true;
    if (extendFilter === EXTEND_FILTER_QUEUE) return record.jobStatus === EXTEND_SURVEY_STATUS;
    if (extendFilter === EXTEND_FILTER_PEOPLE) {
      // ยังไม่ได้เลือกคน = ยังอยู่หน้ารายชื่อ ให้ผ่านทั้งหมดไปนับยอดรายคน
      if (!extendPersonEmail) return true;
      return String(record.assigneeEmail || "").toLowerCase() === extendPersonEmail;
    }
    if (extendFilter === EXTEND_FILTER_MINE) {
      const email = String(getSession()?.email || "").toLowerCase();
      return Boolean(email) && String(record.assigneeEmail || "").toLowerCase() === email;
    }
    return record.jobStatus === extendFilter;
  }

  function extendFilterLabel() {
    if (extendFilter === EXTEND_FILTER_ALL) return "งานทั้งหมด";
    if (extendFilter === EXTEND_FILTER_MINE) return "งานของฉัน";
    if (extendFilter === EXTEND_FILTER_QUEUE) return "คิวรอสำรวจ";
    if (extendFilter === EXTEND_FILTER_PEOPLE) {
      if (!extendPersonEmail) return "งานในมือของแต่ละคน";
      const owner = extendJobs().find(r =>
        String(r.assigneeEmail || "").toLowerCase() === extendPersonEmail);
      return `งานของ ${owner && owner.assignee ? owner.assignee : extendPersonEmail}`;
    }
    return extendFilter;
  }

  /**
   * คิวรอสำรวจ แยกเป็นของแต่ละคน
   *
   * "คิวที่เท่าไร" ต้องมีความหมายเดียวเท่านั้น จึงเรียงตามวันที่รับคำร้องจากเก่า
   * ไปใหม่ (มาก่อนได้ก่อน) ไม่ใช่เรียงตามวันที่บันทึกล่าสุดเหมือนรายการอื่นในแอป
   * -- คิวที่สลับลำดับได้ทุกครั้งที่มีคนแก้คำร้อง ไม่ใช่คิว
   *
   * คิวของตัวเองถูกดันขึ้นบนสุดเสมอ เพราะคนเปิดหน้านี้ส่วนใหญ่เปิดมาดูของตัวเอง
   * งานที่ยังไม่มีผู้รับผิดชอบถูกรวมไว้กลุ่มท้ายสุด ปกติไม่ควรมี (การจ่ายงานเป็น
   * ตัวพาสถานะมาที่ "รอสำรวจ") แต่ถ้ามีคนตั้งสถานะเองก็จะเห็น ไม่หายไปเงียบ ๆ
   */
  function renderSurveyQueue(jobs) {
    const myEmail = String(getSession()?.email || "").toLowerCase();

    const groups = new Map();
    jobs.forEach(record => {
      const key = String(record.assigneeEmail || "").toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, { key, name: record.assignee || "", jobs: [] });
      }
      groups.get(key).jobs.push(record);
    });

    const ordered = Array.from(groups.values()).sort((a, b) => {
      if (a.key === myEmail) return -1;
      if (b.key === myEmail) return 1;
      if (!a.key) return 1;
      if (!b.key) return -1;
      return String(a.name).localeCompare(String(b.name), "th");
    });

    extendWorkList.innerHTML = "";

    if (!ordered.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = "ยังไม่มีงานที่รอสำรวจ";
      extendWorkList.appendChild(empty);
      return;
    }

    ordered.forEach(group => {
      const section = document.createElement("section");
      section.className = "queue-group";
      if (group.key && group.key === myEmail) section.classList.add("is-mine");

      const head = document.createElement("div");
      head.className = "queue-group-head";

      const who = document.createElement("span");
      who.className = "queue-group-name";
      who.textContent = group.key
        ? (group.name || group.key) + (group.key === myEmail ? " (ของฉัน)" : "")
        : "ยังไม่ได้จ่ายงาน";

      const count = document.createElement("span");
      count.className = "queue-group-count";
      count.textContent = `${group.jobs.length} งาน`;

      head.append(who, count);
      section.appendChild(head);

      group.jobs
        .slice()
        .sort((a, b) => String(a.receivedDate || "").localeCompare(String(b.receivedDate || ""))
          || (a.createdAt || 0) - (b.createdAt || 0))
        .forEach((record, index) => {
          const position = index + 1;

          const item = document.createElement("button");
          item.type = "button";
          item.className = "queue-item";

          const pos = document.createElement("span");
          pos.className = "queue-pos";
          pos.textContent = String(position);

          const body = document.createElement("span");
          body.className = "queue-body";

          const title = document.createElement("span");
          title.className = "queue-title";
          title.textContent = [record.requestNumber, record.customerName].filter(Boolean).join(" · ") || "-";

          const meta = document.createElement("span");
          meta.className = "queue-meta";
          meta.textContent = position === 1
            ? `ถึงคิวแล้ว · รับคำร้อง ${formatThaiDate(record.receivedDate)}`
            : `เหลืออีก ${position - 1} คิวจะถึงคิวนี้ · รับคำร้อง ${formatThaiDate(record.receivedDate)}`;

          body.append(title, meta);
          item.append(pos, body);

          item.addEventListener("click", () =>
            openRequestForm("extend", record, { returnTo: "extendWork" }));

          section.appendChild(item);
        });

      extendWorkList.appendChild(section);
    });
  }

  /**
   * ชิปกรองสถานะ -- คลิกเดียวเปลี่ยนมุมมอง ตามที่หัวหน้างานขอมา
   *
   * วาดใหม่ทุกครั้งที่ข้อมูลเปลี่ยน เพราะตัวเลขบนชิปคือจำนวนจริง ณ ตอนนั้น
   * ชิปที่ไม่มีงานเลยยังอยู่ที่เดิมแต่จางลง ไม่ได้ถูกซ่อน -- ชิปที่หายไปเวลาเป็น
   * ศูนย์จะทำให้ชิปตัวอื่นขยับตำแหน่ง แล้วคนที่จำตำแหน่งไว้จะกดผิดใบ
   */
  function renderExtendChips(jobs) {
    const email = String(getSession()?.email || "").toLowerCase();
    const mine = email
      ? jobs.filter(r => String(r.assigneeEmail || "").toLowerCase() === email).length
      : 0;

    const chips = [
      { key: EXTEND_FILTER_ALL, label: "ทั้งหมด", count: jobs.length },
      { key: EXTEND_FILTER_MINE, label: "งานของฉัน", count: mine },
      {
        key: EXTEND_FILTER_QUEUE,
        label: "คิวรอสำรวจ",
        count: jobs.filter(r => r.jobStatus === EXTEND_SURVEY_STATUS).length
      }
    ].concat(canAssignWork()
      ? [{ key: EXTEND_FILTER_PEOPLE, label: "งานในมือแต่ละคน", count: jobs.length }]
      : []
    ).concat(extendStatuses().map(status => ({
      key: status,
      label: status,
      count: jobs.filter(r => r.jobStatus === status).length
    })));

    extendWorkChips.innerHTML = "";

    chips.forEach(chip => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "status-chip";
      if (chip.key === extendFilter) btn.classList.add("active");
      if (!chip.count) btn.classList.add("is-empty");

      const label = document.createElement("span");
      label.textContent = chip.label;

      const count = document.createElement("span");
      count.className = "status-chip-count";
      count.textContent = String(chip.count);

      btn.append(label, count);
      btn.addEventListener("click", () => {
        extendFilter = chip.key;
        // กดชิปใหม่ = ออกจากหน้างานของคนใดคนหนึ่ง กลับไปตั้งต้นของมุมมองนั้น
        extendPersonEmail = "";
        // เลือกไว้ในมุมมองก่อนหน้าแล้วเปลี่ยนมุมมอง = ไม่รู้แล้วว่ากำลังจะจ่าย
        // งานใบไหนบ้าง ล้างทิ้งดีกว่าปล่อยให้เลือกค้างข้ามหน้าจอ
        extendSelection.clear();
        renderExtendWork();
      });

      extendWorkChips.appendChild(btn);
    });
  }

  /**
   * จัดกลุ่มงานตามสถานะ ย่อ/ขยายได้ พร้อมจำนวนในแต่ละกลุ่ม
   *
   * เรียงกลุ่มตามลำดับขั้นตอนงาน (ลำดับเดียวกับดรอปดาวน์สถานะ) ไม่ใช่ตามจำนวน --
   * คนอ่านกำลังไล่ว่างานอยู่ขั้นไหนแล้ว ลำดับที่สลับไปมาตามจำนวนทำให้หาไม่เจอ
   * กลุ่มที่ไม่มีงานเลยไม่ต้องวาด (ต่างจากชิปด้านบนที่ต้องอยู่ครบเพื่อให้กดได้)
   */
  function renderJobsByStatus(jobs) {
    extendWorkList.innerHTML = "";

    if (!jobs.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = extendSearchQuery ? "ไม่พบงานที่ค้นหา" : "ยังไม่มีงานในมุมมองนี้";
      extendWorkList.appendChild(empty);
      return;
    }

    const order = extendStatuses();
    // สถานะแปลก ๆ ที่ไม่ได้อยู่ในดรอปดาวน์ (ข้อมูลเก่า/พิมพ์มาเอง) ต่อท้ายไว้
    // ดีกว่าปล่อยให้หายไปจากหน้าจอเงียบ ๆ
    const extras = jobs.map(j => j.jobStatus).filter(st => st && order.indexOf(st) === -1);
    const statuses = order.concat(Array.from(new Set(extras)));

    statuses.forEach(status => {
      const group = jobs.filter(j => j.jobStatus === status);
      if (!group.length) return;

      const section = document.createElement("section");
      section.className = "status-group";

      const head = document.createElement("button");
      head.type = "button";
      head.className = "status-group-head";

      const caret = document.createElement("span");
      caret.className = "status-group-caret";

      const badge = document.createElement("span");
      badge.className = `request-badge request-badge-status tone-${JOB_STATUS_TONE[status] || "info"}`;
      badge.textContent = status;

      const count = document.createElement("span");
      count.className = "status-group-count";
      count.textContent = `${group.length} งาน`;

      head.append(caret, badge, count);

      const body = document.createElement("div");
      body.className = "status-group-body";
      group
        .sort((a, b) => b.createdAt - a.createdAt)
        .forEach(record => body.appendChild(renderExtendCard(record)));

      const collapsed = extendCollapsed.has(status);
      section.classList.toggle("is-collapsed", collapsed);
      body.hidden = collapsed;

      head.addEventListener("click", () => {
        const nowCollapsed = !extendCollapsed.has(status);
        if (nowCollapsed) extendCollapsed.add(status);
        else extendCollapsed.delete(status);
        section.classList.toggle("is-collapsed", nowCollapsed);
        body.hidden = nowCollapsed;
      });

      section.append(head, body);
      extendWorkList.appendChild(section);
    });
  }

  /**
   * หน้ารายชื่อของหัวหน้า -- กดชื่อเดียวเห็นงานทั้งกองของคนนั้น
   *
   * นับจากงานที่มีอยู่จริง ไม่ได้ไล่จากรายชื่อเจ้าหน้าที่ทั้งหมด: หน้านี้ตอบคำถาม
   * "ตอนนี้งานอยู่ในมือใครบ้าง" คนที่ไม่มีงานค้างจึงไม่ต้องมีอยู่ในรายการ
   */
  function renderPeopleList(jobs) {
    extendWorkList.innerHTML = "";

    const byPerson = new Map();
    jobs.forEach(record => {
      const key = String(record.assigneeEmail || "").toLowerCase();
      if (!byPerson.has(key)) {
        byPerson.set(key, { key, name: record.assignee || "", jobs: [] });
      }
      byPerson.get(key).jobs.push(record);
    });

    const myEmail = String(getSession()?.email || "").toLowerCase();
    const people = Array.from(byPerson.values()).sort((a, b) => {
      if (!a.key) return 1;
      if (!b.key) return -1;
      return b.jobs.length - a.jobs.length;
    });

    if (!people.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = "ยังไม่มีงานในระบบ";
      extendWorkList.appendChild(empty);
      return;
    }

    people.forEach(person => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "person-card";
      if (person.key && person.key === myEmail) card.classList.add("is-mine");

      const top = document.createElement("span");
      top.className = "person-card-top";

      const name = document.createElement("span");
      name.className = "person-card-name";
      name.textContent = person.key
        ? (person.name || person.key) + (person.key === myEmail ? " (ฉัน)" : "")
        : "ยังไม่ได้จ่ายงาน";

      const total = document.createElement("span");
      total.className = "person-card-total";
      total.textContent = `${person.jobs.length} งาน`;

      top.append(name, total);

      // แถบสถานะย่อ ๆ ให้เห็นว่ากองงานของคนนี้ค้างอยู่ขั้นไหนบ้าง โดยไม่ต้องกดเข้าไป
      const chips = document.createElement("span");
      chips.className = "person-card-chips";
      const counts = new Map();
      person.jobs.forEach(j => counts.set(j.jobStatus, (counts.get(j.jobStatus) || 0) + 1));
      extendStatuses().forEach(status => {
        if (!counts.has(status)) return;
        const chip = document.createElement("span");
        chip.className = `request-badge request-badge-status tone-${JOB_STATUS_TONE[status] || "info"}`;
        chip.textContent = `${status} ${counts.get(status)}`;
        chips.appendChild(chip);
      });

      card.append(top, chips);
      card.addEventListener("click", () => {
        extendPersonEmail = person.key;
        extendSelection.clear();
        renderExtendWork();
      });

      extendWorkList.appendChild(card);
    });
  }

  function renderExtendCard(record) {
    const card = document.createElement("div");
    card.className = "request-card request-card-clickable";
    card.dataset.type = "extend";

    card.innerHTML = `
      <div class="request-card-top">
        <div class="request-badges">
          <span class="request-badge request-badge-id"></span>
          <span class="request-badge request-badge-purpose"></span>
          <span class="request-badge request-badge-status"></span>
        </div>
        <span class="request-date"></span>
      </div>
      <div class="request-name"></div>
      <div class="request-meta request-meta-phone"></div>
      <div class="request-meta request-meta-location"></div>
      <div class="work-assignee"></div>
    `;

    card.querySelector(".request-date").textContent = formatThaiDate(record.receivedDate);

    const idEl = card.querySelector(".request-badge-id");
    if (record.requestNumber) idEl.textContent = record.requestNumber;
    else idEl.remove();

    const purposeEl = card.querySelector(".request-badge-purpose");
    if (record.purpose) purposeEl.textContent = record.purpose;
    else purposeEl.remove();

    const statusEl = card.querySelector(".request-badge-status");
    statusEl.textContent = record.jobStatus || "-";
    statusEl.classList.add(`tone-${JOB_STATUS_TONE[record.jobStatus] || "info"}`);

    card.querySelector(".request-name").textContent = record.customerName || "";

    const phoneEl = card.querySelector(".request-meta-phone");
    if (record.phonePrimary) {
      phoneEl.textContent = "โทร: ";
      const link = document.createElement("a");
      link.href = `tel:${record.phonePrimary.replace(/[^0-9+]/g, "")}`;
      link.textContent = record.phonePrimary;
      link.addEventListener("click", (e) => e.stopPropagation());
      phoneEl.appendChild(link);
    } else {
      phoneEl.remove();
    }

    card.querySelector(".request-meta-location").textContent = `สถานที่: ${buildLocationText(record)}`;

    const assigneeEl = card.querySelector(".work-assignee");
    if (record.assignee) {
      assigneeEl.textContent = `ผู้รับผิดชอบ: ${record.assignee}`;
    } else {
      assigneeEl.textContent = "ยังไม่ได้จ่ายงาน";
      assigneeEl.classList.add("is-unassigned");
    }

    // เปิดคำร้องใบนั้นในฟอร์มเดิม (ฟอร์มเดียวกับหน้ารับคำร้อง) เพื่ออัปเดตสถานะ
    // และคอมเมนต์ -- จำไว้ด้วยว่ามาจากหน้านี้ ปุ่มย้อนกลับจะได้พากลับมาถูกที่
    card.addEventListener("click", () => openRequestForm("extend", record, { returnTo: "extendWork" }));

    const actions = [];

    // โทรหาลูกค้าได้จากการ์ดโดยไม่ต้องเปิดคำร้องเข้าไปก่อน -- งานสำรวจนัดหมาย
    // กันทางโทรศัพท์เป็นหลัก และหน้านี้คือหน้าที่เจ้าหน้าที่เปิดค้างไว้ทั้งวัน
    // (เบอร์บนบรรทัด "โทร:" ด้านบนก็กดได้ ปุ่มนี้คือเป้าที่นิ้วกดโดนบนมือถือ)
    if (record.phonePrimary) {
      const callLink = document.createElement("a");
      callLink.className = "btn btn-ghost request-card-action-btn";
      callLink.href = `tel:${record.phonePrimary.replace(/[^0-9+]/g, "")}`;
      callLink.title = `โทรหา ${record.customerName || "ลูกค้า"} (${record.phonePrimary})`;
      callLink.setAttribute("aria-label", callLink.title);
      callLink.appendChild(callIconSvg());
      callLink.addEventListener("click", (e) => e.stopPropagation());
      actions.push(callLink);
    }

    const lat = parseFloat(record.lat);
    const lng = parseFloat(record.lng);
    if (isFinite(lat) && isFinite(lng)) {
      const navLink = document.createElement("a");
      navLink.className = "btn btn-ghost request-card-action-btn";
      navLink.textContent = "นำทาง";
      navLink.target = "_blank";
      navLink.rel = "noopener";
      navLink.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      navLink.addEventListener("click", (e) => e.stopPropagation());
      actions.push(navLink);
    }

    if (record.trackingNumber) {
      const qrBtn = document.createElement("button");
      qrBtn.type = "button";
      qrBtn.className = "btn btn-ghost request-card-action-btn";
      qrBtn.textContent = "พิมพ์ QR";
      qrBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.open(`qr.html?tn=${encodeURIComponent(record.trackingNumber)}`, "_blank");
      });
      actions.push(qrBtn);
    }

    if (actions.length) {
      card.classList.add("has-card-actions");
      const wrap = document.createElement("div");
      wrap.className = "request-card-actions";
      actions.forEach(el => wrap.appendChild(el));
      card.appendChild(wrap);
    }

    if (canAssignWork()) {
      card.classList.add("has-card-select");
      const selectWrap = document.createElement("label");
      selectWrap.className = "request-card-select";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = extendSelection.has(record.id);
      checkbox.setAttribute("aria-label", `เลือกคำร้อง ${record.requestNumber || record.trackingNumber || ""} เพื่อจ่ายงาน`);
      checkbox.addEventListener("click", (e) => e.stopPropagation());
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) extendSelection.add(record.id);
        else extendSelection.delete(record.id);
        renderAssignBar();
      });
      selectWrap.appendChild(checkbox);
      card.appendChild(selectWrap);
    }

    return card;
  }

  function renderAssignBar() {
    const count = extendSelection.size;
    extendAssignBar.hidden = !canAssignWork() || count === 0;
    extendAssignCount.textContent = `เลือกไว้ ${count} รายการ`;
  }

  function renderExtendWork() {
    const jobs = extendJobs();
    renderExtendChips(jobs);

    const filtered = jobs
      .filter(extendFilterMatches)
      .filter(r => matchesSearch(r, extendSearchQuery))
      .sort((a, b) => b.createdAt - a.createdAt);

    // งานที่เลือกไว้แล้วหลุดออกจากมุมมองปัจจุบัน (เช่นมีคนอื่นเปลี่ยนสถานะไป)
    // ต้องหลุดจากการเลือกด้วย ไม่งั้นจะจ่ายงานใบที่มองไม่เห็นบนจอไปโดยไม่รู้ตัว
    const visible = new Set(filtered.map(r => r.id));
    extendSelection.forEach(id => { if (!visible.has(id)) extendSelection.delete(id); });

    extendWorkTitle.textContent = extendFilterLabel();
    extendWorkCount.textContent = `ทั้งหมด ${filtered.length} รายการ`;

    if (extendFilter === EXTEND_FILTER_QUEUE) {
      renderSurveyQueue(filtered);
      renderAssignBar();
      return;
    }

    if (extendFilter === EXTEND_FILTER_PEOPLE && !extendPersonEmail) {
      renderPeopleList(filtered);
      renderAssignBar();
      return;
    }

    // งานของฉัน และงานรายคนของหัวหน้า -- จัดกลุ่มตามสถานะ ย่อ/ขยายได้
    if (extendFilter === EXTEND_FILTER_MINE || extendFilter === EXTEND_FILTER_PEOPLE) {
      renderJobsByStatus(filtered);
      renderAssignBar();
      return;
    }

    extendWorkList.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = extendSearchQuery
        ? "ไม่พบงานที่ค้นหา"
        : "ยังไม่มีงานในมุมมองนี้";
      extendWorkList.appendChild(empty);
    } else {
      filtered.forEach(record => extendWorkList.appendChild(renderExtendCard(record)));
    }

    renderAssignBar();
  }

  /** เติมรายชื่อเจ้าหน้าที่ลงช่องเลือก โดยพยายามคงคนที่เลือกค้างไว้ */
  function fillAssigneeSelect() {
    const previous = extendAssignSelect.value;
    extendAssignSelect.innerHTML = '<option value="">-- เลือกผู้รับผิดชอบ --</option>';

    staffRoster.forEach(person => {
      const option = document.createElement("option");
      option.value = person.email;
      option.textContent = person.position ? `${person.name} (${person.position})` : person.name;
      extendAssignSelect.appendChild(option);
    });

    if (previous && staffRoster.some(p => p.email === previous)) {
      extendAssignSelect.value = previous;
    }
  }

  async function refreshStaffRoster() {
    const data = await backend.listStaff();
    staffRoster = data.staff || [];
    return staffRoster;
  }

  function openExtendWorkView(options = {}) {
    if (!options.keepView) {
      extendFilter = EXTEND_FILTER_ALL;
      extendSearchQuery = "";
      extendWorkSearch.value = "";
    }
    extendSelection.clear();
    extendPersonEmail = "";
    hideError(extendAssignError);
    extendAssignSuccess.hidden = true;

    extendDetailMode.hidden = true;
    extendWorkListMode.hidden = false;
    showView("extendWork");
    renderExtendWork();

    // เฉพาะหัวหน้างาน -- คนอื่นไม่มีอะไรในหน้าจอที่ต้องใช้รายชื่อนี้
    if (canAssignWork()) {
      refreshStaffRoster()
        .then(fillAssigneeSelect)
        .catch(err => {
          console.error("CS Connect staff list error:", err);
          showError(extendAssignError, friendlyError(err, "โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ"));
        });
    }
  }

  extendWorkSearch.addEventListener("input", (e) => {
    extendSearchQuery = e.target.value.trim();
    renderExtendWork();
  });

  document.getElementById("extendWorkBackBtn").addEventListener("click", () => {
    // ถอยทีละขั้น: จากหน้ารายละเอียดกลับไปที่รายการงานก่อน แล้วค่อยออกหน้าแรก
    if (!extendDetailMode.hidden) {
      leaveRequestForm();
      return;
    }
    enterApp();
  });

  document.getElementById("extendDetailBackBtn").addEventListener("click", leaveRequestForm);

  extendPaneItems.forEach(item => {
    item.addEventListener("click", () => showExtendPane(item.dataset.extendPane));
  });

  document.getElementById("extendAssignClearBtn").addEventListener("click", () => {
    extendSelection.clear();
    renderExtendWork();
  });

  extendAssignBtn.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    hideError(extendAssignError);
    extendAssignSuccess.hidden = true;

    const assigneeEmail = extendAssignSelect.value;
    if (!assigneeEmail) {
      showError(extendAssignError, "กรุณาเลือกผู้รับผิดชอบก่อน");
      return;
    }

    const ids = Array.from(extendSelection);
    if (!ids.length) {
      showError(extendAssignError, "กรุณาเลือกงานที่จะจ่ายก่อน");
      return;
    }

    setBusy(btn, true, "กำลังจ่ายงาน...");

    try {
      // ฝั่งเซิร์ฟเวอร์เป็นคนเขียนฟิลด์การจ่ายงาน ประวัติสถานะ และคอมเมนต์เอง
      // ทั้งหมด แล้วส่งเรกคอร์ดที่อัปเดตแล้วกลับมา -- ที่นี่แค่เอาไปทับใน cache
      const updated = await backend.assignRequests(ids, assigneeEmail);
      const byId = new Map(updated.map(r => [String(r.id), r]));
      requestsCache = requestsCache.map(r => byId.get(String(r.id)) || r);

      const person = staffRoster.find(p => p.email === assigneeEmail);
      extendAssignSuccess.textContent =
        `จ่ายงาน ${updated.length} รายการให้ ${person ? person.name : assigneeEmail} เรียบร้อย`;
      extendAssignSuccess.hidden = false;

      extendSelection.clear();
      renderExtendWork();
    } catch (err) {
      console.error("CS Connect assign error:", err);
      showError(extendAssignError, friendlyError(err, "จ่ายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(btn, false);
    }
  });

  // ---------- init ----------
  // Everything downstream reads from the cache synchronously, so the one and
  // only load has to finish before the first screen is painted. Against a
  // network backend that is a visible wait, hence the boot overlay.
  const bootOverlay = document.getElementById("bootOverlay");
  const bootError = document.getElementById("bootError");

  // ผูกที่นี่แทน onclick ใน HTML เพราะ CSP บล็อกสคริปต์ inline ทั้งหมด
  // ปุ่มนี้จะมองเห็นได้ก็ต่อเมื่อ init() ล้มเหลวไปแล้ว ซึ่งแปลว่าไฟล์นี้ทำงานอยู่
  // การผูกตรงนี้จึงไม่ทำให้ปุ่มตายในกรณีที่มันถูกใช้จริง
  document.getElementById("bootRetryBtn")
    .addEventListener("click", () => location.reload());

  async function init() {
    const session = getSession();

    // A visitor who isn't signed in (e.g. someone here only to track a
    // request) never loads the request table at all -- they have no token,
    // and the backend would refuse anyway.
    if (!session) {
      bootOverlay.hidden = true;
      showView("login");
      return;
    }

    // เปิดเว็บใหม่ด้วย session เดิมที่ยังติดรหัสชั่วคราวอยู่ -- เช็คก่อนยิงโหลด
    if (session.mustChangePassword) {
      bootOverlay.hidden = true;
      openAccountView(true);
      return;
    }

    try {
      await refreshAll();
      await migrateLocalDataOnce();
    } catch (err) {
      console.error("CS Connect: โหลดข้อมูลไม่สำเร็จ", err);

      // An expired or revoked token is not a connection problem -- drop the
      // dead session and let them sign in again rather than showing a retry
      // button that can never succeed. callAsUser() has usually handled this
      // already by the time we get here; handleAuthExpired() is idempotent, so
      // this stays as the guard for the localBackend path, which never goes
      // through callAsUser at all.
      if (String(err.message).includes("AUTH_REQUIRED")) {
        handleAuthExpired();
        return;
      }

      // Otherwise stop at the overlay rather than dropping the user into an
      // app that looks like it has no data -- that would invite them to
      // re-enter work that already exists.
      bootError.hidden = false;
      return;
    }

    bootOverlay.hidden = true;
    updateTabBadges();
    enterApp();
  }

  init();
})();
