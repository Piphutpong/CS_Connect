(() => {
  "use strict";

  const USERS_KEY = "csconnect_users";
  const SESSION_KEY = "csconnect_currentUser";
  const REQUESTS_KEY = "csconnect_requests";
  const DISPATCHES_KEY = "csconnect_meterDispatches";
  const MIGRATED_KEY = "csconnect_migratedToBackend";

  const REQUEST_TYPES = {
    power: "ขอใช้ไฟฟ้า",
    deposit: "ขอเงินประกันคืน",
    extend: "ขอขยายเขตระบบจำหน่ายไฟฟ้า",
    general: "คำร้องทั่วไป",
    payment: "แจ้งเตือนการรับชำระเงิน",
    meter: "คุมคำร้องส่งแผนกมิเตอร์"
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
    "ผมต. ตีกลับ": "danger"
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
        dispatches: readLocal(DISPATCHES_KEY, memoryDispatches)
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

    async function call(payload) {
      // text/plain on purpose: an application/json body would trigger a CORS
      // preflight, which Apps Script web apps cannot answer.
      const response = await fetch(SHEETS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`เชื่อมต่อฐานข้อมูลไม่สำเร็จ (HTTP ${response.status})`);

      const body = await response.json();
      if (!body.ok) throw new Error(body.error || "ฐานข้อมูลตอบกลับผิดพลาด");
      return body.data;
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
        return { requests, dispatches: data.dispatches || [] };
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

  async function refreshAll() {
    const data = await backend.load();
    requestsCache = data.requests || [];
    dispatchesCache = data.dispatches || [];
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
    requests: document.getElementById("requestsView")
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
   * Writes the สมุดคุมคำร้องส่งแผนกมิเตอร์ document into an already-opened
   * window. Shared by a first print and by a reprint from the history, so
   * the two can never drift apart in layout -- the only differences are
   * whether the fields are editable and what the action button does.
   *
   * `rows` is the snapshot shape stored on a dispatch record, not live
   * request objects, so a reprint renders exactly what was signed for even
   * if the underlying requests have been edited since.
   */
  function writeDispatchDocument(printWindow, { rows, printedAt, sender, receiver, editable, actionLabel, actionNote }) {
    const editAttr = editable ? ' contenteditable="true"' : "";

    const bodyRows = rows.map((row, i) => `
      <tr>
        <td class="col-index">${i + 1}</td>
        <td>${escapeForPrint(row.requestNumber || row.trackingNumber || "-")}</td>
        <td>${escapeForPrint(row.customerName || "-")}</td>
        <td>${escapeForPrint(row.purpose || "-")}</td>
        <td${editAttr}>${escapeForPrint(row.note || "")}</td>
      </tr>
    `).join("");

    const signedDate = escapeForPrint(
      new Date(printedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
    );

    function signatureBlock(role, person) {
      return `
        <div class="sig-block">
          <p class="sig-line">ลงชื่อ ....................................... ${role}</p>
          <p>(<span${editAttr} class="sig-fill js-name">${escapeForPrint(person.name || "")}</span>)</p>
          <p${editAttr} class="sig-fill sig-position js-position">${escapeForPrint(person.position || (editable ? "ตำแหน่ง" : ""))}</p>
          <p>${signedDate}</p>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>สมุดคุมคำร้องส่งแผนกมิเตอร์</title>
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
            .actions { text-align: center; margin-top: 40px; }
            .actions button {
              font: inherit; font-size: 15px; font-weight: 600; padding: 12px 28px;
              border-radius: 10px; border: none; background: #57298c; color: #fff; cursor: pointer;
            }
            .actions p { color: #6b5c82; font-size: 13px; margin-top: 12px; }
            @media print {
              [contenteditable="true"] { outline: none; }
              .actions { display: none; }
              /* The on-screen padding would stack on top of the @page margins
                 and make the printed edges measure wider than specified. */
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>สมุดคุมคำร้องส่งแผนกมิเตอร์</h1>
          <p class="printed-at">วันที่และเวลาพิมพ์: ${escapeForPrint(formatThaiDateTime(printedAt))}</p>
          <table>
            <thead>
              <tr>
                <th class="col-index">ลำดับที่</th>
                <th class="col-number">เลขที่คำร้อง</th>
                <th>ชื่อลูกค้า</th>
                <th>ประเภทคำร้อง</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
          <div class="signatures">
            ${signatureBlock("ผู้ส่ง", sender)}
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
   * Opens a dispatch sheet for the checked records in a new tab -- editable in
   * place (contenteditable, not a separate form) so staff can fix a note or
   * fill in a name before it goes to a physical printer. Confirming prints
   * it, marks every record on it as dispatched, AND stores the book itself so
   * it can be found and reprinted later. There's no separate "save without
   * printing" path, since the point of this list is to hand it to the meter
   * department for signature, not to just record data.
   */
  function openMeterDispatchPrint(records) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const sorted = records.slice().sort((a, b) => {
      return String(a.receivedDate || "").localeCompare(String(b.receivedDate || "")) ||
        String(a.trackingNumber || "").localeCompare(String(b.trackingNumber || ""));
    });

    const printedAt = Date.now();
    const staff = actingStaff();
    const rows = sorted.map((r, i) => ({
      position: i + 1,
      requestId: r.id,
      requestNumber: r.requestNumber || "",
      trackingNumber: r.trackingNumber || "",
      customerName: r.customerName || r.requesterName || "",
      purpose: r.purpose || "",
      note: r.note || ""
    }));

    writeDispatchDocument(printWindow, {
      rows,
      printedAt,
      sender: { name: staff.byName, position: "" },
      receiver: { name: "", position: "" },
      editable: true,
      actionLabel: "พิมพ์และยืนยันส่งแผนกมิเตอร์",
      actionNote: 'แก้ไขข้อความในตารางหรือช่องเซ็นชื่อได้ก่อนกดปุ่มนี้ -- กดแล้วจะเปลี่ยนสถานะคำร้องทั้งหมดด้านบนเป็น "ส่งแผนกมิเตอร์แล้ว" บันทึกสมุดเล่มนี้ไว้ให้ย้อนดูภายหลัง และเปิดหน้าต่างพิมพ์ทันที'
    });

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

  // System-issued tracking number: last 2 digits of the Buddhist Era year
  // plus a 4-digit sequence starting at 0001, e.g. 690001. The sequence is
  // derived from existing records each time (not a stored counter), so it
  // resets naturally once no record carries the new year's prefix yet.
  function generateTrackingNumbers(count) {
    const beYear = new Date().getFullYear() + 543;
    const yearPrefix = String(beYear % 100).padStart(2, "0");

    const maxSeq = getRequests()
      .map(r => r.trackingNumber)
      .filter(tn => typeof tn === "string" && tn.startsWith(yearPrefix) && tn.length === 6)
      .map(tn => parseInt(tn.slice(2), 10))
      .filter(n => Number.isInteger(n))
      .reduce((max, n) => Math.max(max, n), 0);

    // The whole run is derived from one read of the cache. Calling the single
    // version in a loop would hand out the same number every time, since the
    // cache only learns about the new records after they are saved.
    return Array.from({ length: count }, (_, i) =>
      `${yearPrefix}${String(maxSeq + 1 + i).padStart(4, "0")}`
    );
  }

  function generateTrackingNumber() {
    return generateTrackingNumbers(1)[0];
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

  document.getElementById("goToLogin").addEventListener("click", (e) => {
    e.preventDefault();
    hideError(registerError);
    showView("login");
  });

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
    showView("home");
  }

  /**
   * ล้างค่าที่ไม่ควรค้างอยู่บนหน้าจอหลังออกจากระบบ -- รหัสผ่านชั่วคราวที่ผู้ดูแล
   * ระบบเพิ่งสุ่มให้คนอื่น เป็นค่าที่ระบบไม่ได้เก็บไว้ที่ไหนเลยและตั้งใจให้เห็น
   * ครั้งเดียว การปล่อยให้ค้างอยู่ในหน้าที่ซ่อนไว้เฉย ๆ ทำให้คนถัดไปที่ล็อกอิน
   * บนเครื่องเดียวกันกดกลับเข้ามาดูได้
   */
  function clearSensitiveScreens() {
    document.getElementById("tempPasswordValue").textContent = "";
    document.getElementById("tempPasswordEmail").textContent = "";
    document.getElementById("adminResetResult").hidden = true;
    document.getElementById("changePasswordForm").reset();
    document.getElementById("adminResetForm").reset();
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
    backRow: document.getElementById("accountBackRow")
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
    accountView.forceNotice.hidden = !mustChange;
    accountView.backRow.hidden = mustChange;

    showView("account");
  }

  document.getElementById("accountBtn").addEventListener("click", () => openAccountView(false));

  document.getElementById("accountBackLink").addEventListener("click", (e) => {
    e.preventDefault();
    showView("home");
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
        accountView.adminSection.hidden = !session.isAdmin;

        // ตอนล็อกอิน บัญชีนี้ถูกพามาที่นี่โดยไม่ได้โหลดข้อมูลเลย (loadRequests
        // จะถูกปฏิเสธอยู่แล้ว) ตอนนี้ผ่านด่านแล้วจึงต้องโหลด ไม่งั้นกดกลับหน้าแรก
        // ไปจะเจอรายการคำร้องว่างเปล่าทั้งที่ข้อมูลมีอยู่
        try {
          await refreshAll();
          updateTabBadges();
        } catch (loadErr) {
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

  // ---------- service cards ----------
  document.querySelectorAll(".service-card").forEach(card => {
    card.addEventListener("click", () => {
      const key = card.dataset.service;

      if (key === "requests") {
        openRequestsView();
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

  document.getElementById("backBtn").addEventListener("click", () => showView("home"));
  document.getElementById("backToHomeBtn").addEventListener("click", () => showView("home"));
  document.getElementById("requestsBackBtn").addEventListener("click", () => showView("home"));

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
  function isMeterDispatch(r) {
    return r.type === "power" && (r.jobStatus === "ชำระเงินแล้ว" || r.jobStatus === "ไม่มีค่าใช้จ่าย");
  }

  // Tabs that filter existing records instead of holding their own type --
  // they have no add form, so the "+ เพิ่มคำร้อง" button is hidden on them.
  const DERIVED_TAB_FILTERS = {
    payment: isPaymentNotice,
    meter: isMeterDispatch
  };

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

  // Only "power" has a built form. The แจ้งเตือนการรับชำระเงิน tab isn't a
  // separate type with its own data -- it's power records filtered down to
  // ones with a paymentSlip (see isPaymentNotice below), so those cards are
  // already power records and click-to-edit "just works" for them too.
  // deposit/extend/general still show a placeholder until their own field
  // sets are defined (see openRequestForm).
  const FORM_SUPPORTED_TYPES = new Set(["power"]);

  let currentRequestFilter = "power";
  let currentAddType = "power";
  let editingId = null;
  let currentSearchQuery = "";

  // Which half of the คุมคำร้องส่งแผนกมิเตอร์ tab is showing: "pending" (the
  // requests still waiting to go out) or "history" (books already printed).
  // Resets to pending on every tab switch -- the pending list is what the tab
  // is for day to day; the history is something you go looking for.
  let meterMode = "pending";

  // True while the request form is being used to enter a whole batch at once.
  // The form itself is unchanged -- it just doubles as the shared values for
  // every row, with #batchSection carrying what differs between them.
  let batchMode = false;

  const BATCH_DEFAULT_ROWS = 5;

  /**
   * Fields a single row may override, as ids in the shared form above. The
   * override inputs are *cloned from those very fields*, so the option lists
   * (อำเภอ/ตำบล, ความประสงค์, ขนาดมิเตอร์, สถานะงาน) can never drift from the
   * main form, and adding a field to the form makes it overridable here for
   * free. Keyed by the record field each one feeds.
   */
  const BATCH_OVERRIDE_FIELDS = [
    { id: "reqDate", key: "receivedDate" },
    { id: "reqPhoneSecondary", key: "phoneSecondary" },
    { id: "reqBP", key: "bp" },
    { id: "reqCA", key: "ca" },
    { id: "reqDistrict", key: "district" },
    { id: "reqSubdistrict", key: "subdistrict" },
    { id: "reqZipcode", key: "zipcode" },
    { id: "reqMoo", key: "moo" },
    { id: "reqVillage", key: "village" },
    { id: "reqDeed", key: "deed" },
    { id: "reqPurpose", key: "purposeChoice" },
    { id: "reqPurposeOther", key: "purposeOther" },
    { id: "reqMeterSize", key: "meterSize" },
    { id: "reqFee", key: "fee" },
    { id: "reqJobStatus", key: "jobStatus" },
    { id: "reqNote", key: "note" }
  ];

  // Which records are checked off on the คุมคำร้องส่งแผนกมิเตอร์ tab, ready to
  // go out together in one dispatch printout. Scoped to ids (not the whole
  // record) since renderRequestsList() re-derives fresh record objects from
  // the cache on every render -- keeping full objects here would go stale
  // the moment a card's data changes. Cleared on every tab switch and after
  // a successful dispatch.
  let meterSelection = new Set();

  function matchesSearch(r, query) {
    if (!query) return true;
    const haystack = [
      r.trackingNumber, r.requestNumber, r.customerName, r.requesterName,
      r.phonePrimary, r.phoneSecondary, r.phone, r.bp, r.ca,
      r.houseNo, r.deed, r.jobStatus
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function resetLocationFields() {
    reqSubdistrict.innerHTML = '<option value="">-- เลือกอำเภอก่อน --</option>';
    reqSubdistrict.disabled = true;
    reqZipcode.value = "";
  }

  function setDefaultRequestDate() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    reqDate.value = `${yyyy}-${mm}-${dd}`;
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

  reqPurpose.addEventListener("change", () => {
    reqPurposeOtherField.hidden = reqPurpose.value !== "other";
    if (reqPurpose.value !== "other") {
      reqPurposeOther.value = "";
    }
  });

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

      const purposeEl = card.querySelector(".request-badge-purpose");
      if (r.purpose) {
        purposeEl.textContent = r.purpose;
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
      card.querySelector(".request-meta-location").textContent = `สถานที่: ${buildLocationText(r)}`;

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

  /**
   * Does this book mention `query` anywhere a staff member would search by?
   * Both request numbers are matched, because staff have two of them (the
   * system's เลขที่คำร้อง (ระบบ) and the one they type by hand) and either is a
   * reasonable thing to paste in when a customer asks "when was mine sent?".
   */
  function dispatchMatchesSearch(dispatch, query) {
    if (!query) return true;
    const rows = Array.isArray(dispatch.rows) ? dispatch.rows : [];
    const haystack = [
      dispatch.printedByName, dispatch.senderName, dispatch.receiverName,
      formatThaiDateTime(dispatch.printedAt),
      ...rows.flatMap(row => [row.requestNumber, row.trackingNumber, row.customerName])
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

  requestsSearchInput.addEventListener("input", () => {
    currentSearchQuery = requestsSearchInput.value.trim();
    renderRequestsList();
  });

  meterPrintBtn.addEventListener("click", () => {
    const selected = getRequests().filter(r => meterSelection.has(r.id));
    if (!selected.length) return;
    openMeterDispatchPrint(selected);
  });

  function fillRequestForm(r) {
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
  }

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
  document.getElementById("requestCommentBtn").addEventListener("click", async () => {
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
      await saveRequests(requests);

      requestCommentInput.value = "";
      renderComments(requests[idx]);
    } catch (err) {
      console.error("CS Connect comment error:", err);
      showError(requestCommentError, "เกิดข้อผิดพลาด ไม่สามารถบันทึกคอมเมนต์ได้ กรุณาลองใหม่อีกครั้ง");
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
  function buildRowOverrides(tr, detailCell) {
    const grid = document.createElement("div");
    grid.className = "batch-override-grid";

    BATCH_OVERRIDE_FIELDS.forEach(({ id, key }) => {
      const source = document.getElementById(id);
      const wrapper = source.closest(".field").cloneNode(true);
      const control = wrapper.querySelector("input, select, textarea");
      const label = wrapper.querySelector("label");

      const clonedId = `${id}__row${tr.dataset.batchRowSeq}`;
      wrapper.removeAttribute("id");
      control.id = clonedId;
      if (label) label.setAttribute("for", clonedId);
      control.dataset.overrideKey = key;
      control.value = source.value;
      // ตำบล's options depend on the chosen อำเภอ; the clone inherits the
      // options already rendered above, so the current value survives.
      control.disabled = source.disabled;
      wrapper.hidden = false;

      grid.appendChild(wrapper);
    });

    detailCell.appendChild(grid);

    const districtEl = grid.querySelector('[data-override-key="district"]');
    const subdistrictEl = grid.querySelector('[data-override-key="subdistrict"]');
    const zipcodeEl = grid.querySelector('[data-override-key="zipcode"]');
    wireLocationCascade(districtEl, subdistrictEl, zipcodeEl);

    const purposeEl = grid.querySelector('[data-override-key="purposeChoice"]');
    const purposeOtherWrapper = grid.querySelector('[data-override-key="purposeOther"]').closest(".field");
    purposeOtherWrapper.hidden = purposeEl.value !== "other";
    purposeEl.addEventListener("change", () => {
      purposeOtherWrapper.hidden = purposeEl.value !== "other";
    });
  }

  function addBatchRow() {
    const seq = ++batchRowSeq;
    const tr = document.createElement("tr");
    tr.dataset.batchRowSeq = String(seq);
    tr.innerHTML = `
      <td class="batch-col-index"></td>
      <td><input type="text" class="batch-input" data-batch-field="requestNumber" autocomplete="off"></td>
      <td><input type="text" class="batch-input" data-batch-field="customerName" autocomplete="off"></td>
      <td><input type="text" class="batch-input" data-batch-field="houseNo" autocomplete="off"></td>
      <td><input type="tel" class="batch-input" data-batch-field="phonePrimary" autocomplete="off"></td>
      <td class="batch-col-remove">
        <button type="button" class="batch-expand-btn" title="แก้ไขข้อมูลอื่นเฉพาะแถวนี้">แก้ไขเพิ่มเติม</button>
        <button type="button" class="batch-remove-btn" aria-label="ลบแถวนี้">&times;</button>
      </td>
    `;

    const detailRow = document.createElement("tr");
    detailRow.className = "batch-detail-row";
    detailRow.hidden = true;
    const detailCell = document.createElement("td");
    detailCell.colSpan = 6;
    detailRow.appendChild(detailCell);

    const expandBtn = tr.querySelector(".batch-expand-btn");
    expandBtn.addEventListener("click", () => {
      if (!detailCell.firstChild) buildRowOverrides(tr, detailCell);
      detailRow.hidden = !detailRow.hidden;
      expandBtn.classList.toggle("active", !detailRow.hidden);
      expandBtn.textContent = detailRow.hidden ? "แก้ไขเพิ่มเติม" : "ซ่อน";
    });

    tr.querySelector(".batch-remove-btn").addEventListener("click", () => {
      detailRow.remove();
      tr.remove();
      renumberBatchRows();
    });

    batchRows.appendChild(tr);
    batchRows.appendChild(detailRow);
    renumberBatchRows();
  }

  /** The entry rows only -- each one is followed by its hidden detail row. */
  function batchEntryRows() {
    return Array.from(batchRows.children).filter(tr => !tr.classList.contains("batch-detail-row"));
  }

  function renumberBatchRows() {
    batchEntryRows().forEach((tr, i) => {
      tr.querySelector(".batch-col-index").textContent = String(i + 1);
    });
  }

  function resetBatchRows() {
    batchRows.innerHTML = "";
    batchRowSeq = 0;
    for (let i = 0; i < BATCH_DEFAULT_ROWS; i++) addBatchRow();
  }

  /**
   * Reads the rows table, dropping any row left entirely blank so staff never
   * has to tidy up spare rows before saving. Values omitted on a row fall back
   * to the shared form above -- that fallback is the whole point of the
   * design: everything defaults to one shared set, and only the exceptions
   * get typed.
   */
  function collectBatchRows(shared) {
    return batchEntryRows()
      .map(tr => {
        const row = {};
        tr.querySelectorAll("[data-batch-field]").forEach(input => {
          row[input.dataset.batchField] = input.value.trim();
        });

        // Anything the row overrode in its "แก้ไขเพิ่มเติม" panel. Absent when
        // the panel was never opened, which is the normal case.
        const detail = tr.nextElementSibling;
        const overrides = {};
        if (detail && detail.classList.contains("batch-detail-row")) {
          detail.querySelectorAll("[data-override-key]").forEach(control => {
            overrides[control.dataset.overrideKey] = control.value.trim();
          });
        }
        row.overrides = overrides;

        return row;
      })
      .filter(row => [row.requestNumber, row.customerName, row.houseNo, row.phonePrimary].some(Boolean))
      .map(row => ({
        requestNumber: row.requestNumber,
        customerName: row.customerName || shared.customerName,
        houseNo: row.houseNo || shared.houseNo,
        phonePrimary: row.phonePrimary || shared.phonePrimary,
        overrides: row.overrides
      }));
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

  function openRequestForm(type, record, options = {}) {
    currentAddType = type;
    editingId = record ? record.id : null;
    batchMode = Boolean(options.batch);
    hideError(requestFormError);
    requestForm.reset();
    resetLocationFields();
    resetPurposeFields();
    setDefaultRequestDate();

    const isSupported = FORM_SUPPORTED_TYPES.has(type);
    requestFormTitle.textContent = batchMode
      ? `เพิ่มหลายคำร้อง: ${REQUEST_TYPES[type]}`
      : `${record ? "แก้ไขคำร้อง" : "เพิ่มคำร้อง"}: ${REQUEST_TYPES[type]}`;
    requestFormSubtitle.textContent = !isSupported
      ? "แบบฟอร์มสำหรับประเภทนี้อยู่ระหว่างการพัฒนา"
      : batchMode
        ? "กรอกข้อมูลที่ใช้ร่วมกันด้านบน แล้วใส่เฉพาะส่วนที่ต่างกันในตารางด้านล่าง"
        : (record ? "แก้ไขรายละเอียดคำร้อง" : "กรอกรายละเอียดคำร้องใหม่");
    requestFormSubmitBtn.textContent = batchMode
      ? "บันทึกทั้งกลุ่ม"
      : (record ? "บันทึกการแก้ไข" : "บันทึกคำร้อง");
    requestForm.hidden = !isSupported;
    requestFormPlaceholder.hidden = isSupported;

    batchResult.hidden = true;
    batchSection.hidden = !(isSupported && batchMode);
    // Every paper form in a batch carries its own เลขที่คำร้อง, so a single
    // shared value would be wrong by definition -- it moves into the table.
    document.getElementById("reqNumberField").hidden = batchMode;
    if (isSupported && batchMode) resetBatchRows();

    if (isSupported) {
      // In batch mode each row gets its own number at save time, so the
      // single-record preview field would be misleading here.
      const trackingField = document.getElementById("reqTrackingNumber");
      trackingField.value = batchMode
        ? "ระบบจะออกเลขให้ทีละใบตอนบันทึก"
        : (record ? (record.trackingNumber || "-") : generateTrackingNumber());
    }

    if (isSupported && record) {
      fillRequestForm(record);
    }

    // Audit strip only makes sense for a record that already exists.
    requestFormMeta.hidden = !record;
    requestCommentInput.value = "";
    hideError(requestCommentError);
    if (record) {
      renderStatusHistory(record);
      renderComments(record);
      renderBatchInfo(record);
      renderDispatchInfo(record);

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

      if (!moo) {
        showError(requestFormError, "กรุณากรอกหมู่");
        return;
      }

      if (!meterSize) {
        showError(requestFormError, "กรุณาเลือกขนาดมิเตอร์");
        return;
      }

      // This form only mounts for FORM_SUPPORTED_TYPES ("power"), so a
      // purpose selection is always required here.
      let purpose = "";
      if (!purposeChoice) {
        showError(requestFormError, "กรุณาเลือกความประสงค์");
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
        note
      };

      // Stamped from the signed-in session so the form's audit strip can show
      // who touched the record. A brand-new record only gets the created* pair
      // -- it hasn't been edited yet, so ผู้แก้ไขล่าสุด stays blank until it is.
      const { byName: savedByName, byEmail: savedByEmail } = actingStaff();
      const now = Date.now();

      if (batchMode) {
        // requestNumber is deliberately not in the fallback set: two requests
        // sharing one paper reference would be a data error, not a shortcut.
        const rows = collectBatchRows({ customerName, phonePrimary, houseNo });

        if (!rows.length) {
          showError(requestFormError, "กรุณากรอกอย่างน้อย 1 แถวในรายการคำร้องกลุ่ม");
          return;
        }

        const missingAt = rows.findIndex(row => !row.requestNumber);
        if (missingAt !== -1) {
          showError(requestFormError, `แถวที่ ${missingAt + 1}: กรุณากรอกเลขที่คำร้อง`);
          return;
        }

        // One read of the cache produces the whole run, so the numbers come
        // out consecutive exactly as if the forms had been entered one by one.
        const trackingNumbers = generateTrackingNumbers(rows.length);
        const ids = newRequestIds(rows.length);
        const batchId = newRequestId();

        const created = rows.map((row, i) => {
          const o = row.overrides || {};
          // A row that never opened its panel has no overrides and simply
          // takes the shared values; one that did takes its own for whatever
          // it changed.
          const rowPurpose = o.purposeChoice
            ? (o.purposeChoice === "other" ? o.purposeOther : o.purposeChoice)
            : purpose;
          const rowJobStatus = o.jobStatus || jobStatus;

          return {
            ...recordData,
            id: ids[i],
            trackingNumber: trackingNumbers[i],
            requestNumber: row.requestNumber,
            customerName: row.customerName,
            houseNo: row.houseNo,
            phonePrimary: row.phonePrimary,
            receivedDate: o.receivedDate || receivedDate,
            phoneSecondary: o.phoneSecondary ?? phoneSecondary,
            bp: o.bp ?? bp,
            ca: o.ca ?? ca,
            district: o.district ? DISTRICTS[o.district].label : recordData.district,
            subdistrict: o.subdistrict || subdistrict,
            zipcode: o.zipcode || zipcode,
            moo: o.moo || moo,
            village: o.village ?? village,
            deed: o.deed ?? deed,
            purpose: rowPurpose,
            meterSize: o.meterSize || meterSize,
            fee: o.fee ?? fee,
            jobStatus: rowJobStatus,
            note: o.note ?? note,
            batchId,
            statusHistory: [{ status: rowJobStatus, byName: savedByName, byEmail: savedByEmail, at: now }],
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
          const statusHistory = Array.isArray(prev.statusHistory) ? prev.statusHistory.slice() : [];

          if (prev.jobStatus !== jobStatus) {
            // A record that predates statusHistory has no trail yet -- seed it
            // with the status it was already on, un-attributed, so the chain
            // still reads correctly instead of starting at the new status.
            if (!statusHistory.length && prev.jobStatus) {
              statusHistory.push({ status: prev.jobStatus, byName: "", byEmail: "", at: null });
            }
            statusHistory.push({ status: jobStatus, byName: savedByName, byEmail: savedByEmail, at: now });
          }

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
        requests.push({
          id: newRequestId(),
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
