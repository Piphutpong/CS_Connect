(() => {
  "use strict";

  const USERS_KEY = "csconnect_users";
  const SESSION_KEY = "csconnect_currentUser";
  const REQUESTS_KEY = "csconnect_requests";
  const DISPATCHES_KEY = "csconnect_meterDispatches";
  const GENERAL_DISPATCHES_KEY = "csconnect_generalDispatches";
  const REVENUE_DISPATCHES_KEY = "csconnect_revenueDispatches";
  const MIGRATED_KEY = "csconnect_migratedToBackend";

  const REQUEST_TYPES = {
    power: "ขอใช้ไฟฟ้า",
    deposit: "ขอเงินประกันคืน",
    general: "คำร้องทั่วไป",
    extend: "ขอขยายเขตระบบจำหน่ายไฟฟ้า",
    // สี่ตัวนี้เป็น derived tab -- ไม่ใช่ประเภทคำร้องของตัวเอง แต่เป็นมุมมองที่
    // กรองคำร้องที่มีอยู่แล้วด้วย jobStatus (ดู DERIVED_TAB_FILTERS) ทั้งหมดอยู่
    // เป็นแท็บในแถบซ้ายของหน้างานรับคำร้อง
    payment: "แจ้งเตือนการรับชำระเงิน",
    meter: "คุมคำร้องมิเตอร์",
    generalDispatch: "คุมคำร้องทั่วไป",
    revenueDispatch: "คุมคำร้องขอรับเงินประกันคืน"
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
    "ส่ง ผสน. แล้ว": "success",
    // ขอเงินประกันคืน -- "ส่ง ผบร." ไม่ต้องเพิ่ม เพราะเป็นสตริงเดียวกันเป๊ะกับ
    // สถานะของขอขยายเขตฯ ที่มีอยู่แล้วด้านบน (info) แผนที่นี้ไม่มีมิติประเภทคำร้อง
    // จึงแยกสองความหมายไม่ได้ ปล่อยเป็น info ดีกว่าไปเปลี่ยนสีของอีกประเภทหนึ่ง
    // โดยที่ไม่มีใครขอ -- และ info ก็ยังอ่านได้ว่า "ไม่ได้อยู่กับเราแล้ว" ซึ่งจริงทั้งคู่
    "รอยกเลิกมิเตอร์": "warning",
    "รอเปลี่ยนประเภทการใช้ไฟฟ้า": "warning",
    "รอส่ง ผบร.": "warning"
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
    },
    // การ์ดสองใบนี้ไม่มีข้อมูลของตัวเองในระบบนี้เลย -- แค่ลิงก์ออกไปหา Google
    // Sheet ที่แผนกทำไว้อยู่แล้ว "url" ที่มีค่าเป็นสิ่งที่ #serviceView ใช้ตัดสิน
    // ว่าจะโชว์ปุ่มเปิดลิงก์แทนข้อความ "อยู่ระหว่างการพัฒนา" (ดู event listener
    // ของ .service-card ด้านล่าง) -- ตั้งใจไม่ฝังตารางราคา/รายละเอียดจากโบรชัวร์
    // ไว้ตรงนี้ เพราะ Sheet ต้นทางแก้ได้เอง ไม่ต้องรอแก้โค้ดทุกครั้งที่ราคาขยับ
    kpi: {
      title: "KPI แผนกบริการและลูกค้าสัมพันธ์",
      desc: "ตัวชี้วัดผลการดำเนินงานของแผนกบริการและลูกค้าสัมพันธ์",
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V10m6 10V4m6 16v-7m6 7V13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      links: [
        { label: "Google Sheet: ควบคุมการสร้างคำร้อง Y1, Y2, Y3 เพื่อประสานงาน และควบคุมการเปิด/ปิดใบสั่ง", url: "https://docs.google.com/spreadsheets/d/1oM1UKwlCWXu_gGXJcXtO4DuSTilz2H42ex5Nb1dYM_A/edit?usp=sharing" }
      ]
    },
    sideBusiness: {
      title: "งานธุรกิจเสริม",
      desc: "PEA Engineering Service — บริการตรวจสอบและบำรุงรักษาระบบไฟฟ้าแบบครบวงจร (บำรุงรักษาหม้อแปลง, ตรวจจุดร้อนด้วยกล้องอินฟราเรด)",
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      links: [
        { label: "Google Sheet: Check list จ้างเหมา Turnkey", url: "https://docs.google.com/spreadsheets/d/1Ys-uVEzhEOJIS5MbxdoXYWrfR2UwXX70r-mzQE9yAJg/edit?usp=sharing" }
      ]
      // รูปโบรชัวร์ 3 ใบที่เคยแปะไว้ตรงนี้ย้ายไปอยู่ในหน้าโบรชัวร์แล้ว (ปุ่ม
      // "โบรชัวร์" บนการ์ดนี้ -- ที่นั่นเพิ่ม/แก้ไข/ดาวน์โหลด/คัดลอกส่งไลน์ได้
    }
  };

  /**
   * แถวลิงก์เดียวมาตรฐาน (ไอคอนเอกสาร + ชื่อ) -- ใช้ร่วมกันทั้งรายการลิงก์ของ
   * #serviceView (อาจมีหลายแถว) และลิงก์เดี่ยวในหน้ารายการงานขอใช้ไฟฟ้า
   * (#extendListSheetLink) จะได้ไม่ต้องคง markup เดียวกันไว้สองที่
   */
  function buildServiceLinkItem(label, url) {
    const a = document.createElement("a");
    a.className = "service-link-item";
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18H5z" stroke="currentColor" stroke-width="1.6"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    const span = document.createElement("span");
    span.textContent = label;
    a.appendChild(span);
    return a;
  }

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
  let memoryRevenueDispatches = [];

  function readLocal(key, fallback) {
    if (!storageAvailable) return fallback;
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  }

  // Offline fallback for working on the UI with no network (SUPABASE_URL
  // set to ""). Its auth is plain-text and deliberately dev-only -- the real
  // deployment authenticates with Supabase Auth.
  const localBackend = {
    async load() {
      return {
        requests: readLocal(REQUESTS_KEY, memoryRequests),
        dispatches: readLocal(DISPATCHES_KEY, memoryDispatches),
        generalDispatches: readLocal(GENERAL_DISPATCHES_KEY, memoryGeneralDispatches),
        revenueDispatches: readLocal(REVENUE_DISPATCHES_KEY, memoryRevenueDispatches)
      };
    },

    async saveRequests(requests) {
      if (!storageAvailable) {
        memoryRequests = requests;
        return requests;
      }
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
      return requests;
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

    async saveRevenueDispatch(dispatch) {
      const all = readLocal(REVENUE_DISPATCHES_KEY, memoryRevenueDispatches).concat([dispatch]);
      if (!storageAvailable) {
        memoryRevenueDispatches = all;
        return;
      }
      localStorage.setItem(REVENUE_DISPATCHES_KEY, JSON.stringify(all));
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

    async hasSession() {
      return true;
    },

    // โหมดออฟไลน์ไม่มี Storage -- ค่าที่เก็บไว้ถูกใช้เป็น URL ตรง ๆ
    async fileUrls(kind, paths) {
      return new Map(paths.filter(Boolean).map(p => [p, p]));
    },

    async listApplicants() {
      throw new Error("โหมดออฟไลน์ไม่รองรับการอนุมัติผู้สมัคร");
    },

    async decideApplicant() {
      throw new Error("โหมดออฟไลน์ไม่รองรับการอนุมัติผู้สมัคร");
    },

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
    },

    async loadWorkItems() {
      return [];
    },

    async saveWorkItem() {
      throw new Error("โหมดออฟไลน์ไม่รองรับโมดูลงานใหม่");
    },

    async deleteWorkItem() {
      throw new Error("โหมดออฟไลน์ไม่รองรับโมดูลงานใหม่");
    },

    async uploadBrochureImage() {
      throw new Error("โหมดออฟไลน์ไม่รองรับการอัปโหลดรูป");
    }

    // track()/uploadSlip() live in track.js now -- the public tracking page
    // is its own standalone page (see track.html) so it can have its own
    // short link/QR code, independent of this app's login gate.
  };

  // Supabase (Postgres + Auth + Storage) -- ตั้งค่าว่างทั้งคู่เพื่อถอยไปใช้
  // localBackend (ทำงานกับหน้าจอแบบออฟไลน์)
  //
  // anon key เปิดเผยได้โดยการออกแบบ: ความปลอดภัยทั้งหมดอยู่ที่ RLS และ RPC ฝั่ง
  // ฐานข้อมูล (ดู supabase/migrations) ไม่ใช่ที่การซ่อน key นี้ -- ต้องตรงกับ
  // SUPABASE_URL ใน track.js และ qr.js ด้วย (ไม่มี build step ให้แชร์ค่ากัน)
  const SUPABASE_URL = "https://zsctqxfdxxkssmqfkqdh.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzY3RxeGZkeHhrc3NtcWZrcWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjg0NzAsImV4cCI6MjEwNDkwNDQ3MH0.89mcdAJiFiFgke_Q8SU85laE1gf_C7w5A-j2zO0Hrn0";

  const supabaseBackend = (() => {
    // ยังไม่ได้โหลด vendor/supabase.js หรือยังไม่ได้ตั้งค่า -- คืน null ให้ตัวเลือก
    // backend ด้านล่างถอยไปใช้ localBackend แทนการพังทั้งหน้า
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase?.createClient) return null;

    /**
     * ที่เก็บ session ของ Supabase Auth -- ทำตามช่อง "จำรหัสผ่าน" แบบเดียวกับ
     * setSession(): ติ๊กไว้ = localStorage (อยู่ข้ามการปิดเบราว์เซอร์), ไม่ติ๊ก =
     * sessionStorage (หายเมื่อปิด) ค่าที่ต้องการถูกตั้งไว้ใน authRemember ก่อน
     * ล็อกอิน และตอนเปิดเว็บครั้งถัดไปอ่านจากว่า session ของแอปอยู่ฝั่งไหน
     */
    let authRemember = null;
    const memoryAuth = {};
    const authStorage = {
      getItem(key) {
        try {
          return localStorage.getItem(key) ?? sessionStorage.getItem(key);
        } catch {
          return memoryAuth[key] ?? null;
        }
      },
      setItem(key, value) {
        try {
          const remember = authRemember ?? sessionIsRemembered();
          (remember ? localStorage : sessionStorage).setItem(key, value);
          (remember ? sessionStorage : localStorage).removeItem(key);
        } catch {
          memoryAuth[key] = value;
        }
      },
      removeItem(key) {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch {
          // storage ใช้ไม่ได้ -- ลบจากหน่วยความจำอย่างเดียว
        }
        delete memoryAuth[key];
      }
    };

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: authStorage,
        storageKey: "csconnect_auth",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });

    // What the database is believed to already hold, so a save can send only
    // the records that actually changed instead of re-uploading every row.
    let savedRequests = new Map();

    function snapshot(records) {
      const map = new Map();
      records.forEach(r => map.set(String(r.id), JSON.stringify(r)));
      return map;
    }

    /**
     * RPC ที่ "ยิงซ้ำแล้วผลเท่าเดิม" จึงลองใหม่เองได้เมื่อเครือข่ายสะดุด
     *
     * เป็น allowlist ไม่ใช่ blocklist โดยตั้งใจ -- คำสั่งใหม่ที่ยังไม่ได้พิจารณา
     * จะไม่ถูกยิงซ้ำเอง ที่ไม่อยู่ในรายการและเหตุผล:
     *   assign_requests      ต่อคอมเมนต์ "จ่ายงานให้ ..." ทุกครั้งที่เรียก
     *   save_dispatch        (upsert ด้วย id ก็จริง แต่ไม่มีเหตุให้เสี่ยง)
     *   save_estimate_kit    ชุดใหม่ที่ไม่มี id จะได้ชุดซ้ำ
     *   ทุกคำสั่งเรื่องบัญชี/รหัสผ่าน
     *
     * save_requests ยิงซ้ำได้เพราะ upsert ด้วย id และเลขที่คำร้องที่มีแล้วไม่ถูก
     * ออกใหม่ -- จริงก็ต่อเมื่อ id ของใบใหม่คงที่ข้ามการลองใหม่ด้วย (ดู pendingNewId)
     */
    const RETRYABLE_RPCS = new Set([
      "load_workspace", "save_requests", "search_archived", "list_staff", "estimate_catalog"
    ]);

    const RETRY_ATTEMPTS = 3;

    /**
     * ล้มเพราะเครือข่าย/เซิร์ฟเวอร์ล่มชั่วคราว (ลองใหม่ได้) หรือเพราะฐานข้อมูล
     * "ตัดสินแล้วว่าไม่รับ" (ลองใหม่กี่ทีก็ไม่ผ่าน)
     *
     * สถานะ HTTP ไม่ได้อยู่บน error ของ supabase-js แต่อยู่บนคำตอบ ({ status })
     * เดิมอ่าน error.status ซึ่งไม่มีอยู่จริง ได้ 0 ทุกครั้ง -- ทุกข้อผิดพลาดทางธุรกิจ
     * (เลข WBS ซ้ำ, เบอร์โทรผิดรูปแบบ, เลขที่คำร้องซ้ำ) จึงถูกนับเป็น "เชื่อมต่อฐาน
     * ข้อมูลไม่สำเร็จ" แถมถูกยิงซ้ำ 3 รอบก่อนแจ้ง ตอนนี้ดูสองอย่าง: มี code จาก
     * ฐานข้อมูล (เช่น P0001 ของ app.fail) = เซิร์ฟเวอร์ตอบมาแล้ว ไม่ใช่เน็ตหลุด
     */
    function isTransient(error, status) {
      const httpStatus = Number(status ?? error?.status) || 0;
      const message = String(error?.message || "");
      if (httpStatus === 408 || httpStatus === 429 || httpStatus >= 500) return true;
      if (error?.code) return false;
      return httpStatus === 0
        || /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(message);
    }

    /**
     * ข้อความ error ของ PostgREST ที่แปลว่า "ไม่ได้ล็อกอินอยู่แล้ว" -- ตอน session
     * ถูกเตะออก (revoke_all_sessions / ผู้ดูแลรีเซ็ตรหัส) supabase-js ต่ออายุ token
     * ไม่ได้ แล้วยิงต่อด้วยสิทธิ์ anon ซึ่งไม่มีสิทธิ์เรียกฟังก์ชันเลย -- ต้องนับเป็น
     * AUTH_REQUIRED เหมือนกัน ไม่งั้นผู้ใช้เห็น "permission denied" ที่อ่านไม่รู้เรื่อง
     */
    function normalizeError(error) {
      const message = String(error?.message || "");
      if (error?.code === "42501" || /permission denied for function|JWT expired|invalid JWT|JWSError/i.test(message)) {
        return new Error("AUTH_REQUIRED");
      }
      // เลข WBS ซ้ำ -- ขึ้นต้นด้วยประโยคที่บอกให้แก้ไข แล้วค่อยตามด้วยรายละเอียด
      // จากฐานข้อมูล (ซ้ำกับคำร้องใบไหน) ที่เจ้าหน้าที่ใช้หาใบที่ชนกัน
      if (/WBS/.test(message) && /ซ้ำ|ถูกใช้/.test(message)) {
        return new Error(`หมายเลข WBS ซ้ำ กรุณาแก้ไขให้ถูกต้อง (${message})`);
      }
      return new Error(message || "ฐานข้อมูลตอบกลับผิดพลาด");
    }

    async function rpc(name, args) {
      let lastError = null;
      let lastStatus = 0;

      for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        let data;
        let error;
        let status;
        try {
          ({ data, error, status } = await client.rpc(name, args || {}));
        } catch (err) {
          error = err;
          status = 0;
        }

        if (!error) return data;

        lastError = error;
        lastStatus = status;
        const canRetry = isTransient(error, status) && attempt < RETRY_ATTEMPTS && RETRYABLE_RPCS.has(name);
        if (!canRetry) break;

        // ถอยห่างขึ้นเรื่อย ๆ แทนที่จะยิงรัว
        console.warn(`CS Connect: ${name} ล้มเหลวชั่วคราว กำลังลองใหม่`, error);
        await new Promise(resolve => setTimeout(resolve, 400 * attempt));
      }

      if (isTransient(lastError, lastStatus)) {
        throw new Error("เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง");
      }
      throw normalizeError(lastError);
    }

    /**
     * ทุกคำสั่งที่ต้องล็อกอินผ่านที่นี่ที่เดียว จึงเป็นจุดเดียวที่ต้องดัก
     * AUTH_REQUIRED / PASSWORD_CHANGE_REQUIRED -- แทนที่จะไปไล่ใส่ในทุก catch
     *
     * ยัง throw ต่อเสมอ ไม่กลืน error ทิ้ง: ผู้เรียกต้องรู้ว่างานไม่สำเร็จ เพื่อจะ
     * ได้ roll back cache และไม่ปิดฟอร์มราวกับบันทึกผ่านแล้ว
     */
    async function callAsUser(run) {
      try {
        return await run();
      } catch (err) {
        const message = String(err && err.message);

        if (message.includes("AUTH_REQUIRED")) {
          client.auth.signOut({ scope: "local" }).catch(() => {});
          handleAuthExpired();
        } else if (message.includes("PASSWORD_CHANGE_REQUIRED")) {
          // ด่านฝั่งฐานข้อมูลปฏิเสธมา -- หน้าจอกับความจริงไม่ตรงกัน (เช่นแอดมิน
          // เพิ่งรีเซ็ตรหัสให้ระหว่างที่เปิดเว็บค้างไว้) พากลับไปหน้าตั้งรหัสใหม่
          const session = getSession();
          if (session) {
            session.mustChangePassword = true;
            setSession(session, sessionIsRemembered());
          }
          requestsCache = [];
          dispatchesCache = [];
          generalDispatchesCache = [];
          revenueDispatchesCache = [];
          document.getElementById("bootOverlay").hidden = true;
          openAccountView(true);
        }

        throw err;
      }
    }

    /** Edge Function staff-admin -- รูปคำตอบ { ok, data, error } แบบเดียวกับระบบเดิม */
    async function invoke(body) {
      const { data, error } = await client.functions.invoke("staff-admin", { body });
      if (error) {
        // ฟังก์ชันตอบ 200 เสมอเมื่อทำงานจบ -- มาถึงตรงนี้คือเครือข่าย/ตัวฟังก์ชันล่ม
        let detail = "";
        try {
          detail = (await error.context?.json?.())?.error || "";
        } catch {
          detail = "";
        }
        throw new Error(detail || "เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
      if (!data || !data.ok) throw new Error(data?.error || "เกิดข้อผิดพลาด");
      return data.data;
    }

    // ---------- ไฟล์แนบ ----------
    const IMAGE_MAX_EDGE = 1600;
    const IMAGE_QUALITY = 0.85;

    function dataUrlToBlob(dataUrl) {
      const match = /^data:([^;,]+);base64,(.*)$/s.exec(String(dataUrl || ""));
      if (!match) throw new Error("ไฟล์ไม่ถูกต้อง กรุณาแนบไฟล์ใหม่อีกครั้ง");
      const binary = atob(match[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: match[1].toLowerCase() });
    }

    /**
     * ย่อรูปถ่ายก่อนอัปโหลด -- Storage ของ free plan มี 1 GB รวมทั้งระบบ รูปจาก
     * มือถือไฟล์ละ 3-5 MB หมดโควตาได้ในไม่กี่ร้อยรูป ขณะที่ 1600px ยังอ่านรายละเอียด
     * หน้างานและพิมพ์ลง A4 ได้ชัด HEIC/PDF ส่งตามเดิม (เบราว์เซอร์ส่วนใหญ่วาด HEIC ไม่ได้)
     */
    async function shrinkImage(blob) {
      if (!/^image\/(jpeg|jpg|png|webp)$/.test(blob.type)) return blob;
      try {
        const bitmap = await createImageBitmap(blob);
        const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
        if (scale === 1 && blob.size < 1024 * 1024) return blob;

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();

        const out = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY));
        return out && out.size < blob.size ? out : blob;
      } catch {
        return blob;
      }
    }

    function extensionFor(type) {
      return { "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf" }[type] || "jpg";
    }

    function randomSuffix() {
      return Math.random().toString(36).slice(2, 10);
    }

    function isStoredPath(value) {
      return Boolean(value) && !/^https?:\/\//i.test(String(value));
    }

    // signed URL อายุ 1 ชั่วโมง เก็บไว้ในหน่วยความจำ 50 นาทีเพื่อไม่ต้องขอใหม่ทุกครั้งที่วาด
    const SIGNED_URL_SECONDS = 60 * 60;
    const signedUrlCache = new Map();

    async function signedUrls(bucket, paths) {
      const now = Date.now();
      const result = new Map();
      const missing = [];

      paths.filter(Boolean).forEach(path => {
        if (!isStoredPath(path)) {
          result.set(path, path);
          return;
        }
        const cached = signedUrlCache.get(`${bucket}/${path}`);
        if (cached && cached.expiresAt > now) result.set(path, cached.url);
        else if (!missing.includes(path)) missing.push(path);
      });

      if (missing.length) {
        const { data, error } = await client.storage.from(bucket).createSignedUrls(missing, SIGNED_URL_SECONDS);
        if (error) throw normalizeError(error);
        (data || []).forEach(item => {
          if (!item.signedUrl) return;
          signedUrlCache.set(`${bucket}/${item.path}`, { url: item.signedUrl, expiresAt: now + 50 * 60 * 1000 });
          result.set(item.path, item.signedUrl);
        });
      }

      return result;
    }

    return {
      client,

      async load() {
        const data = await callAsUser(() => rpc("load_workspace"));
        const requests = data.requests || [];
        savedRequests = snapshot(requests);
        return {
          requests,
          dispatches: data.dispatches || [],
          generalDispatches: data.generalDispatches || [],
          revenueDispatches: data.revenueDispatches || []
        };
      },

      async saveRequests(requests) {
        const changed = requests.filter(r => savedRequests.get(String(r.id)) !== JSON.stringify(r));
        if (!changed.length) return [];

        const res = await callAsUser(() => rpc("save_requests", { p_records: changed }));

        // เลขที่คำร้อง (ระบบ) ออกจากฝั่งฐานข้อมูลใต้ล็อก ฉบับที่ถูกต้องจึงเป็นฉบับที่
        // คืนมา ไม่ใช่ฉบับที่ส่งไป -- ต้องเก็บฉบับนั้นลง snapshot ด้วย
        const saved = Array.isArray(res?.records) ? res.records : changed;
        saved.forEach(r => savedRequests.set(String(r.id), JSON.stringify(r)));
        return saved;
      },

      async saveMeterDispatch(dispatch) {
        await callAsUser(() => rpc("save_dispatch", { p_kind: "meter", p_record: dispatch }));
      },

      async saveRevenueDispatch(dispatch) {
        await callAsUser(() => rpc("save_dispatch", { p_kind: "revenue", p_record: dispatch }));
      },

      async saveGeneralDispatch(dispatch) {
        await callAsUser(() => rpc("save_dispatch", { p_kind: "general", p_record: dispatch }));
      },

      // สมัครผ่าน Edge Function เท่านั้น (ตรวจรหัสเชิญก่อน) -- signUp ของ Auth ปิดไว้
      async register(user) {
        return invoke({ action: "register", user });
      },

      /**
       * ล็อกอินกับ Supabase Auth แล้วถามสถานะบัญชีจากตาราง staff
       *
       * บัญชีที่รออนุมัติ/ถูกปฏิเสธล็อกอินกับ Auth ผ่าน (รหัสผ่านถูก) แต่ใช้ข้อมูล
       * อะไรไม่ได้เลย เพราะทุก RPC ตรวจ approval_status เอง -- ที่นี่แค่บอกเหตุผล
       * ที่ถูกต้องให้ผู้ใช้ แล้วทิ้ง session นั้นไป
       */
      async login(email, password, remember) {
        authRemember = Boolean(remember);
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          if (Number(error.status) === 429) throw new Error("พยายามหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง");
          if (isTransient(error)) throw new Error("เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง");
          // ข้อความเดียวกันไม่ว่าอีเมลหรือรหัสผ่านผิด
          throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        }

        let profile;
        try {
          profile = await rpc("my_profile", { p_login: true });
        } catch (err) {
          await client.auth.signOut({ scope: "local" }).catch(() => {});
          throw err;
        }

        if (profile.status !== "approved") {
          await client.auth.signOut({ scope: "local" }).catch(() => {});
          throw new Error(profile.status === "rejected"
            ? "บัญชีนี้ไม่ได้รับการอนุมัติให้ใช้งาน กรุณาติดต่อผู้ดูแลระบบ"
            : "บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ กรุณาติดต่อผู้ดูแลระบบ");
        }

        return profile;
      },

      /** มี session ของ Auth ค้างอยู่จริงไหม -- ใช้ตอนเปิดเว็บ ก่อนเชื่อ session ของแอป */
      async hasSession() {
        const { data } = await client.auth.getSession();
        return Boolean(data?.session);
      },

      // ออกจาก session ของเครื่องนี้เท่านั้น (scope local) -- เหมือนระบบเดิมที่ลบแค่ token เดียว
      async logout() {
        await client.auth.signOut({ scope: "local" });
      },

      forgetCached() {
        savedRequests = new Map();
        signedUrlCache.clear();
      },

      async revokeAllSessions() {
        const result = await callAsUser(() => rpc("revoke_all_sessions"));
        await client.auth.signOut({ scope: "local" }).catch(() => {});
        return result;
      },

      /**
       * ตั้งรหัสใหม่แล้ว Auth ลบ session ทุกอันของบัญชีนี้ รวมถึงอันที่ใช้อยู่ -- Edge
       * Function จึงออก session ใหม่ให้ ต้องรับมาใช้แทนทันที ไม่งั้นคำสั่งถัดไปหลุดไปหน้า login
       */
      async changePassword(currentPassword, newPassword) {
        const result = await callAsUser(() => invoke({ action: "changePassword", currentPassword, newPassword }));
        if (result?.session) {
          const { error } = await client.auth.setSession(result.session);
          if (error) console.warn("CS Connect: รับ session ใหม่หลังเปลี่ยนรหัสไม่สำเร็จ", error);
        }
        return { changed: result?.changed, otherSessionsRevoked: result?.otherSessionsRevoked };
      },

      async adminResetPassword(email) {
        return callAsUser(() => invoke({ action: "adminResetPassword", email }));
      },

      async exportAll() {
        return callAsUser(() => rpc("export_all"));
      },

      async getInviteCode() {
        return callAsUser(() => rpc("get_invite_code"));
      },

      async createInviteCode() {
        return callAsUser(() => rpc("create_invite_code"));
      },

      async revokeInviteCode() {
        return callAsUser(() => rpc("revoke_invite_code"));
      },

      // ผู้สมัครที่รออนุมัติ -- แทนลิงก์อนุมัติทางอีเมลของระบบเดิม
      async listApplicants() {
        return callAsUser(() => rpc("list_applicants"));
      },

      async decideApplicant(email, decision) {
        return callAsUser(() => rpc("decide_applicant", { p_email: email, p_decision: decision }));
      },

      async listStaff() {
        return callAsUser(() => rpc("list_staff"));
      },

      async assignRequests(ids, assigneeEmail) {
        const data = await callAsUser(() => rpc("assign_requests", { p_ids: ids, p_assignee_email: assigneeEmail }));
        const updated = data.requests || [];
        updated.forEach(r => savedRequests.set(String(r.id), JSON.stringify(r)));
        return updated;
      },

      async listEstimateItems() {
        return callAsUser(() => rpc("estimate_catalog"));
      },

      async saveEstimateKit(kit) {
        return callAsUser(() => rpc("save_estimate_kit", { p_kit: kit }));
      },

      async deleteEstimateKit(id) {
        return callAsUser(() => rpc("delete_estimate_kit", { p_id: id }));
      },

      /**
       * โมดูลงานใหม่สามตัว (โบรชัวร์ / ใบเสนอราคา / PEA-VOC) -- ตารางเดียว
       * แยกด้วย kind ดู supabase/migrations/20260919000001_work_items.sql
       *
       * ไม่มีชั้นแคชแบบ requestsCache เพราะทั้งสามเปิดจากหน้าของตัวเองเท่านั้น
       * ไม่มีหน้าไหนอื่นต้องอ่านค่าแบบ synchronous ระหว่างวาดรายการคำร้อง
       */
      async loadWorkItems(kind) {
        const data = await callAsUser(() => rpc("load_work_items", { p_kind: kind }));
        return data.items || [];
      },

      async saveWorkItem(kind, item) {
        const data = await callAsUser(() => rpc("save_work_item", { p_kind: kind, p_item: item }));
        return data.item;
      },

      async deleteWorkItem(id) {
        return callAsUser(() => rpc("delete_work_item", { p_id: id }));
      },

      /**
       * อัปรูปโบรชัวร์ขึ้น Storage แล้วคืน path ที่เก็บลง work_items.data.images
       *
       * ไม่มี RPC ผูกไฟล์เข้ารายการแบบ attach_request_file -- ไฟล์โบรชัวร์ไม่ได้
       * เป็นเอกสารแนบของงานที่ต้องตรวจว่ามีอยู่จริงก่อนเดินสถานะ ถ้า path เสีย
       * ก็แค่รูปไม่ขึ้น ไม่มีสถานะไหนเดินผิดตามไปด้วย
       *
       * shrinkImage() ย่อเป็น JPEG 1600px เหมือนทุกรูปในระบบ -- โบรชัวร์ที่ส่ง
       * ให้ลูกค้าทางไลน์ไม่ต้องใหญ่กว่านี้ และพื้นที่ฟรี 1 GB เป็นของทั้งโปรเจกต์
       */
      async uploadBrochureImage(file) {
        return callAsUser(async () => {
          const blob = await shrinkImage(dataUrlToBlob(file));
          const path = `brochures/${Date.now()}-${randomSuffix()}.${extensionFor(blob.type)}`;
          const upload = await client.storage.from("request-files").upload(path, blob, {
            contentType: blob.type, upsert: false
          });
          if (upload.error) {
            const message = String(upload.error.message || "");
            if (/size|large/i.test(message)) throw new Error("ไฟล์ใหญ่เกินไป");
            if (/mime|type/i.test(message)) throw new Error("รองรับเฉพาะรูปภาพ (JPG, PNG, WEBP, HEIC) เท่านั้น");
            throw normalizeError(upload.error);
          }
          return path;
        });
      },

      /**
       * แนบไฟล์ของงานขอขยายเขตฯ -- อัปขึ้น Storage ก่อน แล้วค่อยให้ RPC ผูกเข้าคำร้อง
       * (RPC ตรวจว่าไฟล์อยู่บน Storage จริง และเดินสถานะให้เฉพาะกรณีแผนผัง)
       *
       * รับ data URL เหมือนเดิม หน้าจอที่เรียกจึงไม่ต้องเปลี่ยน
       *
       * รับ record ทั้งใบแทนที่จะรับแค่ id เพราะต้องอ่าน record.wbs มาตั้งชื่อ
       * โฟลเดอร์/ไฟล์แทนเลข id ดิบ -- จะได้ไล่หารูปของงานไหนใน Storage dashboard
       * ได้ง่ายด้วยตา (id เป็นแค่ตัวเลขวิ่งที่จำไม่ได้ ส่วน WBS เป็นเลขที่เจ้าหน้าที่
       * ใช้อ้างอิงงานอยู่แล้วในกระดาษ) fallback กลับไปใช้ id เมื่อยังไม่มี WBS
       * (ไม่ควรเกิดในการใช้งานจริง เพราะแนบแผนผัง/ภาพหน้างานได้ก็ต่อเมื่อมี WBS
       * แล้วเท่านั้น -- ดู syncExtendStageFields -- แต่กันไว้เผื่อข้อมูลผิดปกติ)
       * แก้ WBS ภายหลังจะไม่ย้ายไฟล์ที่แนบไว้ก่อนหน้ามาโฟลเดอร์ใหม่ให้อัตโนมัติ
       */
      async saveExtendFile(record, kind, file) {
        return callAsUser(async () => {
          const id = record.id;
          const blob = await shrinkImage(dataUrlToBlob(file));
          const wbs = String(record.wbs || "").trim();
          // เหลือแค่ตัวอักษร/ตัวเลข/-/. ตามรูปแบบ WBS จริง กันเจ้าหน้าที่พิมพ์
          // อักขระแปลก ๆ ทับเลขที่ระบบเดาไว้ให้ ซึ่งจะกลายเป็นชื่อ path ที่ผิดกฎ
          const safeWbs = wbs.replace(/[^A-Za-z0-9.-]/g, "_");
          const folderName = safeWbs || String(id);
          const folder = kind === "plan" ? "plans" : "photos";
          const path = `${folder}/${folderName}/${folderName}-${kind}-${Date.now()}-${randomSuffix()}.${extensionFor(blob.type)}`;

          const upload = await client.storage.from("request-files").upload(path, blob, {
            contentType: blob.type, upsert: false
          });
          if (upload.error) {
            const message = String(upload.error.message || "");
            if (/size|large/i.test(message)) throw new Error("ไฟล์ใหญ่เกินไป");
            if (/mime|type/i.test(message)) throw new Error("รองรับเฉพาะไฟล์ PDF หรือรูปภาพ (JPG, PNG, WEBP, HEIC) เท่านั้น");
            throw normalizeError(upload.error);
          }

          let data;
          try {
            data = await rpc("attach_request_file", { p_id: id, p_kind: kind, p_path: path });
          } catch (err) {
            // ผูกไม่สำเร็จ = ไฟล์กำพร้า ลบทิ้งทันที (policy อนุญาตเพราะยังไม่มีใครอ้างถึง)
            await client.storage.from("request-files").remove([path]).catch(() => {});
            throw err;
          }

          // ภาพที่ถูกแทนที่ไม่มีคำร้องไหนอ้างถึงแล้ว -- ลบไม่สำเร็จไม่ทำให้การแนบล้ม
          if (isStoredPath(data.removedPath)) {
            client.storage.from("request-files").remove([data.removedPath])
              .then(({ error }) => { if (error) console.warn("CS Connect: ลบไฟล์เดิมไม่สำเร็จ", error); });
          }

          const updated = data.request;
          if (updated) savedRequests.set(String(updated.id), JSON.stringify(updated));
          return updated;
        });
      },

      async deleteExtendFile(id, kind, url) {
        return callAsUser(async () => {
          const data = await rpc("detach_request_file", { p_id: id, p_kind: kind, p_path: url });
          if (isStoredPath(data.removedPath)) {
            const { error } = await client.storage.from("request-files").remove([data.removedPath]);
            if (error) console.warn("CS Connect: ลบไฟล์บน Storage ไม่สำเร็จ", error);
          }
          const updated = data.request;
          if (updated) savedRequests.set(String(updated.id), JSON.stringify(updated));
          return updated;
        });
      },

      async setUserRole(email, role) {
        return callAsUser(() => rpc("set_user_role", { p_email: email, p_role: role }));
      },

      async searchArchived(query) {
        const data = await callAsUser(() => rpc("search_archived", { p_query: query }));
        return data.requests || [];
      },

      /**
       * แปลงค่าที่เก็บในคำร้อง (path ใน Storage) เป็น URL ที่ <img>/<a> เปิดได้
       * kind: "slip" = สลิป (bucket slips), อื่น ๆ = แผนผัง/ภาพหน้างาน
       * คืน Map ของ path -> URL; ตัวที่ขอ URL ไม่ได้จะไม่อยู่ใน Map
       */
      async fileUrls(kind, paths) {
        return signedUrls(kind === "slip" ? "slips" : "request-files", paths);
      }
    };
  })();

  const backend = supabaseBackend || localBackend;

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
  let revenueDispatchesCache = [];

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

  function getRevenueDispatches() {
    return revenueDispatchesCache.slice();
  }

  async function refreshAll() {
    const data = await backend.load();
    requestsCache = data.requests || [];
    dispatchesCache = data.dispatches || [];
    generalDispatchesCache = data.generalDispatches || [];
    revenueDispatchesCache = data.revenueDispatches || [];
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
      const saved = await backend.saveRequests(requests);

      // ใบใหม่ได้เลขที่คำร้อง (ระบบ) จากเซิร์ฟเวอร์ ไม่ใช่จากเลขที่ฟอร์มโชว์ไว้
      // ตอนกรอก -- รวมฉบับที่บันทึกจริงกลับเข้าแคช ไม่งั้นการ์ดในลิสต์กับใบพิมพ์
      // QR จะอ้างเลขที่ไม่ตรงกับในชีตจนกว่าจะโหลดใหม่
      if (saved && saved.length) {
        const byId = new Map(saved.map(r => [String(r.id), r]));
        requestsCache = requestsCache.map(r => byId.get(String(r.id)) || r);
      }
      return requestsCache;
    } catch (err) {
      requestsCache = previous;
      throw err;
    }
  }

  function setSession(user, remember) {
    // ข้อมูลสำหรับแสดงผลเท่านั้น -- สิทธิ์จริงมาจาก session ของ Supabase Auth
    // (supabaseBackend เก็บเอง) และทุก RPC ตรวจสิทธิ์ใหม่จากตาราง staff ทุกครั้ง
    const session = {
      email: user.email,
      name: user.name,
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
    estimate: document.getElementById("estimateView"),
    // โมดูลงานใหม่ -- โบรชัวร์/ใบเสนอราคาเปิดจากการ์ดงานธุรกิจเสริม
    // ส่วน PEA-VOC เป็นการ์ดของตัวเองบนหน้าแรก
    brochure: document.getElementById("brochureView"),
    quotation: document.getElementById("quotationView"),
    voc: document.getElementById("vocView")
  };

  function showView(name) {
    Object.values(views).forEach(v => v.hidden = true);
    views[name].hidden = false;
  }

  /**
   * ตำแหน่งหน้าจอปัจจุบันระดับบนสุด (การ์ดไหนบนหน้าแรก + แท็บไหนถ้าเป็นหน้า
   * งานรับคำร้อง) เก็บใน sessionStorage เพื่อให้ "รีเฟรชแล้วอยู่หน้าเดิม" แทนที่
   * จะกลับไปหน้าแรกเสมอ (init() ไม่มี routing จาก URL อยู่แล้วตามที่ตั้งใจไว้แต่แรก
   * -- ดู CLAUDE.md -- ค่านี้จึงเป็นแค่ "จำตำแหน่งไว้ในเบราว์เซอร์เดียวกัน" ไม่ใช่
   * URL ที่แชร์ต่อได้)
   *
   * **ตั้งใจไม่ครอบคลุมถึงหน้าที่ลึกกว่านี้** เช่นฟอร์มคำร้องใบใดใบหนึ่งที่กำลัง
   * เปิดแก้ไขอยู่ (requestsFormMode), รายละเอียดงานใบใดใบหนึ่งในโมดูลงาน
   * (extendDetailMode) หรือหน้าประมาณการ (estimateView) -- ข้อมูลของใบนั้นอาจ
   * เปลี่ยนไปแล้วตอนโหลดหน้าใหม่ หรือฟอร์มมีค่าที่พิมพ์ค้างไว้ยังไม่ได้บันทึก
   * การเดาคืนสภาพเดิมแบบนั้นเสี่ยงโชว์ข้อมูลผิด/ไม่ครบมากกว่าจะช่วยอะไร รีเฟรช
   * จากหน้าลึกระดับนั้นจึงตกกลับไปที่ "รายการ" ของโมดูลเดียวกัน ไม่ใช่หน้าแรก --
   * ยังถือว่า "อยู่หน้าเดิม" ในความหมายที่ผู้ใช้พูดถึง เพียงแค่ไม่ลึกเท่าที่ค้างไว้
   */
  function saveNavState(state) {
    try {
      sessionStorage.setItem("csconnect_lastView", JSON.stringify(state));
    } catch (err) {
      // sessionStorage อาจถูกบล็อก (โหมดส่วนตัว/ตั้งค่าเบราว์เซอร์) -- แค่จำ
      // ตำแหน่งไม่ได้ ไม่ใช่ความผิดพลาดที่ควรบล็อกการทำงานอื่น
    }
  }

  function readNavState() {
    try {
      return JSON.parse(sessionStorage.getItem("csconnect_lastView") || "null");
    } catch (err) {
      return null;
    }
  }

  function clearNavState() {
    try {
      sessionStorage.removeItem("csconnect_lastView");
    } catch (err) {
      // เหมือนกับ saveNavState -- ไม่มีอะไรให้ล้างก็ไม่เป็นไร
    }
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

  /**
   * ไฟล์แนบ (สลิป/แผนผัง/ภาพหน้างาน) เก็บเป็น path ใน Supabase Storage แบบ private
   * ไม่ใช่ลิงก์สาธารณะแบบ Drive เดิม -- ต้องขอ signed URL อายุสั้นจาก backend ก่อน
   * ใส่ลง <img>/<a> ทุกครั้ง (backend จำไว้ในหน่วยความจำ ไม่ได้ขอใหม่ทุกครั้งที่วาด)
   *
   * kind: "slip" หรือ "file" -- คืน null ถ้าขอ URL ไม่ได้ ผู้เรียกต้องรับมือเอง
   */
  async function fileUrl(kind, path) {
    if (!path) return null;
    try {
      const urls = await backend.fileUrls(kind, [path]);
      return urls.get(path) || null;
    } catch (err) {
      console.warn("CS Connect: ขอลิงก์ไฟล์แนบไม่สำเร็จ", err);
      return null;
    }
  }

  function printSlipImage(r) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const requestNumber = escapeForPrint(r.requestNumber || "-");
    const receivedDate = escapeForPrint(formatThaiDate(r.receivedDate) || "-");
    const customerName = escapeForPrint(r.customerName || r.requesterName || "-");
    // Older slips predate the paymentSlipAt column and have no value for it.
    const slipAttachedAt = escapeForPrint(r.paymentSlipAt ? formatThaiDateTime(r.paymentSlipAt) : "-");

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
          <img id="slipImage" alt="สลิปการชำระเงิน">
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
    //
    // หน้าต่างถูกเปิดไปก่อนแล้วตอนคลิก ค่อยขอ signed URL ของสลิปทีหลัง -- ถ้าขอ URL
    // ก่อนแล้วค่อย window.open ตัวบล็อก popup จะมองว่าไม่ได้เกิดจากการคลิกแล้วบล็อกทิ้ง
    const slipImg = printWindow.document.getElementById("slipImage");
    fileUrl("slip", r.paymentSlip).then(url => {
      if (!slipImg || !url) {
        printWindow.print();
        return;
      }
      slipImg.addEventListener("load", () => printWindow.print());
      slipImg.addEventListener("error", () => printWindow.print());
      slipImg.src = url;
    });
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
        // วันเดียวกับที่พิมพ์ลงสมุดคุม -- วันที่บนคำร้องกับบนสมุดตรงกันเสมอ
        meterSentDate: todayDateString(new Date(now)),
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

  /** เหมือน markRecordsSentGeneral ด้านบน แต่ของการส่งแผนกบริหารรายได้ค่าไฟฟ้า */
  async function markRecordsSentRevenue(ids, book) {
    const { byName, byEmail } = actingStaff();
    const now = book.printedAt;
    const idSet = new Set(ids);

    const updated = getRequests().map(r => {
      if (!idSet.has(r.id) || r.jobStatus === "ส่ง ผบร.") return r;
      const statusHistory = (r.statusHistory || []).concat([
        { status: "ส่ง ผบร.", byName, byEmail, at: now }
      ]);
      return {
        ...r,
        jobStatus: "ส่ง ผบร.",
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
    await backend.saveRevenueDispatch(dispatch);
    revenueDispatchesCache = [dispatch].concat(revenueDispatchesCache);

    revenueSelection.clear();
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
  // ขอเงินประกันคืน -- CA เป็นเลขที่แผนกบริหารรายได้ค่าไฟฟ้าใช้หาบัญชีลูกค้า
  // จึงมีค่ากว่าคอลัมน์ประเภทคำร้องแบบสมุดมิเตอร์ (ทั้งเล่มเป็นประเภทเดียวกันหมด)
  const REVENUE_DISPATCH_PRINT_COLUMNS = [
    { label: "เลขที่คำร้อง", className: "col-number", cell: row => row.requestNumber || row.trackingNumber || "-" },
    { label: "ชื่อลูกค้า", cell: row => row.customerName || "-" },
    { label: "CA", cell: row => row.ca || "-" }
  ];

  const GENERAL_DISPATCH_PRINT_COLUMNS = [
    { label: "ชื่อลูกค้า", cell: row => row.customerName || "-" },
    { label: "เรื่อง", cell: row => row.subject || "-" }
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
  // จำนวนแถวสูงสุดต่อแผ่น A4 หนึ่งแผ่น -- ประมาณแบบเผื่อเหลือเผื่อขาด (ฟอนต์ 12pt
  // + หัวตาราง + บล็อกลงชื่อ 2 ช่อง + เลขแผ่น ต้องพอดีใน ~26.7cm ที่เหลือจาก
  // margin บน-ล่างของ @page) ตั้งใจให้น้อยกว่าที่คำนวณได้จริงไว้ก่อน เพราะข้อความ
  // บางช่อง (ชื่อลูกค้า/เรื่อง) อาจตัดขึ้นบรรทัดใหม่ได้ ถ้าพิมพ์จริงแล้วยังเหลือที่
  // ว่างเยอะปรับตัวเลขนี้ขึ้นได้
  const DISPATCH_ROWS_PER_PAGE = 16;

  /**
   * ความกว้างคอลัมน์ตั้งต้นเป็น % -- ลำดับที่แคบตายตัว หมายเหตุกว้างสุด (เป็นช่อง
   * ที่คนเขียนมือลงไปจริงบนกระดาษ) ที่เหลือหารเท่ากันตามจำนวนคอลัมน์ของสมุดเล่มนั้น
   */
  function defaultColumnWidths(columnCount) {
    const indexW = 8;
    const noteW = 30;
    const rest = 100 - indexW - noteW;
    const each = columnCount > 0 ? Math.round((rest / columnCount) * 10) / 10 : rest;
    return [indexW].concat(Array.from({ length: columnCount }, () => each)).concat([noteW]);
  }

  function writeDispatchDocument(printWindow, { title, columns, rows, printedAt, sender, senderOptions, receiver, editable, actionLabel, actionNote }) {
    const editAttr = editable ? ' contenteditable="true"' : "";

    const signedDate = escapeForPrint(
      new Date(printedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
    );

    function buildTable(chunk, startIndex) {
      const bodyRows = chunk.map((row, i) => `
        <tr>
          <td class="col-index">${startIndex + i + 1}</td>
          ${columns.map(col => `<td${col.className ? ` class="${col.className}"` : ""}>${escapeForPrint(col.cell(row))}</td>`).join("")}
          <td${editAttr}>${escapeForPrint(row.note || "")}</td>
        </tr>
      `).join("");

      return `
        <table>
          <colgroup>${setup.widths.map(w => `<col style="width:${w}%">`).join("")}</colgroup>
          <thead>
            <tr>
              <th class="col-index">ลำดับที่</th>
              ${columns.map(col => `<th${col.className ? ` class="${col.className}"` : ""}>${escapeForPrint(col.label)}</th>`).join("")}
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      `;
    }

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
     *
     * `roleKey`/`isMaster`: เอกสารหลายแผ่นต้องมีลายเซ็นครบทุกแผ่น (เซ็นสดด้วย
     * ปากกาบนกระดาษแต่ละแผ่นจริง ๆ) จึงวาดบล็อกนี้ซ้ำทุกหน้า แต่ให้แก้ไขได้
     * (contenteditable + ดรอปดาวน์) เฉพาะแผ่นแรก (isMaster) เท่านั้น -- แผ่นอื่น
     * เป็น "สำเนา" อ่านอย่างเดียวที่ wireSignatureMirroring() คอยคัดลอกค่าจาก
     * แผ่นแรกมาเติมให้ตรงกันเสมอ ไม่งั้นแก้ชื่อในแผ่นแรกแล้วแผ่นหลังจะยังค้างค่าเดิม
     * data-role ใช้แยกช่อง (ชื่อ/ตำแหน่ง ของผู้ส่ง/ผู้รับ) สำหรับสคริปต์นั้น
     */
    function signatureBlock(role, roleKey, person, pickerOptions, isMaster) {
      const fieldEditAttr = (editable && isMaster) ? ' contenteditable="true"' : "";
      const picker = (isMaster && editable && pickerOptions && pickerOptions.length)
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
          <p class="sig-name">(<span${fieldEditAttr} class="sig-fill js-name" data-role="${roleKey}-name">${escapeForPrint(person.name || "")}</span>)</p>
          <p class="sig-position"><span${fieldEditAttr} class="sig-fill js-position" data-role="${roleKey}-position">${escapeForPrint(person.position || "")}</span></p>
          <p class="sig-date">${signedDate}</p>
        </div>
      `;
    }

    /**
     * ตั้งค่าหน้ากระดาษที่ปรับได้ก่อนพิมพ์ -- อยู่ในหน่วยความจำของหน้าต่างที่พิมพ์
     * เท่านั้น ไม่ได้บันทึกลงสมุดที่เก็บไว้ เพราะเป็นเรื่องของ "กระดาษแผ่นนี้"
     * (เครื่องพิมพ์/สายตาคนเซ็น) ไม่ใช่เนื้อหาของเอกสาร -- สมุดที่เก็บไว้ต้อง
     * เป็นสแนปช็อตของ "ข้อความที่อยู่บนกระดาษ" ไม่ใช่ของการจัดหน้า
     *
     * fontSize  ดีฟอลต์ 14px = ขนาดเดียวกับบล็อกลงชื่อ (.sig-block) ตามที่ขอ
     *           ให้ตัวหนังสือในตารางเท่ากับของผู้ส่ง
     * rowsPerPage / breaks  แบ่งแผ่นเอง ไม่ปล่อยให้เบราว์เซอร์ตัด -- breaks
     *           (ลำดับที่ที่ให้ขึ้นแผ่นใหม่ คั่นด้วยจุลภาค) ทับ rowsPerPage เมื่อ
     *           กรอกไว้ เพราะการระบุจุดตัดเองเป็นคำสั่งที่เจาะจงกว่าเสมอ
     * widths    ความกว้างคอลัมน์เป็น % (ลำดับที่ / คอลัมน์ของสมุดเล่มนั้น / หมายเหตุ)
     */
    const setup = {
      fontSize: 14,
      rowsPerPage: DISPATCH_ROWS_PER_PAGE,
      breaks: "",
      widths: defaultColumnWidths(columns.length)
    };

    /** จุดเริ่มของแต่ละแผ่น (index ฐาน 0 ของแถวแรกในแผ่นนั้น) */
    function pageStarts() {
      const manual = String(setup.breaks || "")
        .split(/[,\s]+/)
        .map(v => parseInt(v, 10))
        .filter(n => Number.isFinite(n) && n > 1 && n <= rows.length)
        .map(n => n - 1);

      if (manual.length) {
        return Array.from(new Set([0].concat(manual))).sort((x, y) => x - y);
      }

      const per = Math.max(1, Number(setup.rowsPerPage) || DISPATCH_ROWS_PER_PAGE);
      const starts = [];
      for (let i = 0; i < Math.max(1, rows.length); i += per) starts.push(i);
      return starts.length ? starts : [0];
    }

    function buildPages() {
      const starts = pageStarts();
      return starts.map((start, p) => {
        const end = p + 1 < starts.length ? starts[p + 1] : rows.length;
        const chunk = rows.slice(start, end);
        const isFirst = p === 0;
        return `
        <section class="print-page">
          ${isFirst ? `
            <h1>${escapeForPrint(title)}</h1>
            <p class="printed-at">วันที่และเวลาพิมพ์: ${escapeForPrint(formatThaiDateTime(printedAt))}</p>
          ` : ""}
          ${buildTable(chunk, start)}
          <div class="print-page-footer">
            <div class="signatures">
              ${signatureBlock("ผู้ส่ง", "sender", sender, senderOptions, isFirst)}
              ${signatureBlock("ผู้รับ", "receiver", receiver, null, isFirst)}
            </div>
            ${starts.length > 1 ? `<p class="page-number">แผ่นที่ ${p + 1}/${starts.length}</p>` : ""}
          </div>
        </section>
      `;
      }).join("");
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
            /* ตัวหนังสือในตารางใช้ TH Sarabun New (ฟอนต์เอกสารราชการไทย) ขนาด
               10pt โดยเฉพาะ เล็กกว่าฟอนต์ที่เหลือของเอกสาร (Sarabun ทั่วไป) ตาม
               ที่ขอ -- ถ้าเครื่องที่พิมพ์ไม่มีฟอนต์นี้ติดตั้งไว้ จะ fallback ไปที่
               Sarabun ที่โหลดจาก Google Fonts อยู่แล้วโดยอัตโนมัติ */
            th, td { border: 1px solid #cdb9ea; padding: 8px 10px; font-family: "TH Sarabun New", Sarabun, sans-serif; font-size: var(--table-font, 14px); text-align: left; vertical-align: top; word-break: break-word; }
            /* ตาราง fixed เพื่อให้ความกว้างที่ตั้งใน <colgroup> มีผลจริง -- ถ้า
               เป็น auto เบราว์เซอร์จะคำนวณใหม่ตามเนื้อหาแล้วค่าที่ตั้งไว้ถูกเมิน */
            table { table-layout: fixed; }
            th { background: #ece0f8; }
            .col-index { text-align: center; }
            /* เอกสารยาวเกินหนึ่งแผ่นถูกแบ่งเป็นชิ้นตายตัวตอนสร้าง HTML เอง (ดู
               DISPATCH_ROWS_PER_PAGE) ไม่ได้ปล่อยให้เบราว์เซอร์ตัดหน้าเอง -- แต่ละ
               .print-page คือหนึ่งแผ่นจริง จึงบังคับขึ้นแผ่นใหม่ทุกก้อนยกเว้นก้อน
               สุดท้าย ป้องกันไม่ให้ตารางแผ่นถัดไปมาต่อท้ายบนแผ่นเดียวกัน */
            .print-page { page-break-after: always; break-after: page; }
            .print-page:last-of-type { page-break-after: auto; break-after: auto; }
            /* บล็อกลงชื่อ+วันที่+เลขแผ่นต้องอยู่แผ่นเดียวกันเสมอ ห้ามถูกตัดแยก
               ระหว่างชื่อ/ตำแหน่ง/วันที่คนละแผ่น */
            .print-page-footer { page-break-inside: avoid; break-inside: avoid; }
            [contenteditable="true"] { outline: 1px dashed #a877d6; outline-offset: 2px; min-height: 1.4em; }
            .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 48px; }
            /* ระยะบรรทัดแบบ Word single (~1.15) และตัด margin ปริยายของ <p> ทิ้ง:
               (ชื่อ สกุล) / ตำแหน่ง / วันที่ เป็นบรรทัดต่อเนื่องของบล็อกลงชื่อเดียวกัน
               ไม่ใช่คนละย่อหน้า ค่าเดิม line-height 1.9 บวก margin 1em บน-ล่างที่
               เบราว์เซอร์ให้ <p> มาเอง ทำให้สามบรรทัดนี้ห่างกันเกินจริงไปมาก */
            .sig-block { flex: 1; text-align: center; font-size: 14px; line-height: 1.15; }
            /* อ้างอิงย่อหน้าของ Word: บรรทัดเดี่ยว (single) แล้วตั้งระยะห่าง
               "ก่อนย่อหน้า" 6 pt ให้ทีละบรรทัด -- margin ปริยายของ <p> ที่
               เบราว์เซอร์ให้มา (1em บน-ล่าง) ไม่ใช่ระยะของ Word จึงล้างทิ้งก่อน
               ใช้ margin-top ราย class ไม่ใช่ p + p เพราะดรอปดาวน์เลือกผู้ส่งคั่น
               อยู่ระหว่างเส้นลงชื่อกับบรรทัดชื่อ ตัวเลือกพี่น้องติดกันจึงไม่ match
               (ซ่อนด้วย display:none ตอนพิมพ์ก็ไม่ช่วย เพราะ selector อ่านจาก DOM
               ไม่ใช่จากสิ่งที่แสดงผล)

               ใส่เฉพาะบรรทัดวงเล็บชื่อกับบรรทัดวันที่ -- ตำแหน่งไม่ใส่ เพราะชื่อกับ
               ตำแหน่งเป็นข้อมูลของคนเดียวกัน ต้องอ่านเป็นก้อนเดียวชิดกัน ส่วนวันที่
               เป็นคนละส่วนจึงเว้นห่างออกมา */
            .sig-block p { margin: 0; }
            .sig-name, .sig-date { margin-top: 6pt; }
            .sig-line { white-space: nowrap; }
            .sig-fill { display: inline-block; min-width: 3em; }
            /* ผู้รับไม่มีชื่อ/ตำแหน่งมาให้ล่วงหน้า (เป็นคนของแผนกปลายทาง ไม่มี
               บัญชีในระบบนี้) ปล่อยว่างไว้เฉย ๆ จะกลายเป็นวงเล็บเปล่าที่เขียนทับ
               ไม่ได้บนกระดาษ -- ใส่จุดไข่ปลาเป็นเส้นให้เซ็น/เขียนด้วยมือแทน
               ใช้ ::before ไม่ใช่ข้อความจริง เพราะสองเหตุผล: พิมพ์ทับได้เลยโดย
               ไม่ต้องลบจุดทิ้งก่อน และ textContent ไม่นับเนื้อหาของ pseudo-element
               ช่องที่ไม่ได้แตะจึงอ่านกลับมาเป็นค่าว่างจริง ๆ (ดู readDispatchDocument) */
            .sig-fill:empty::before { content: "................................"; color: #8d7aa8; }
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
            /* ขึ้นเฉพาะตอนเอกสารมีมากกว่า 1 แผ่น (เว้นว่างไว้เมื่อพอดีแผ่นเดียว
               ดู writeDispatchDocument) บอกทั้งแผ่นปัจจุบันและจำนวนแผ่นทั้งหมด
               เช่น "แผ่นที่ 2/3" จะได้รู้ว่าเอกสารชุดนี้มีกี่แผ่น */
            .page-number { text-align: right; color: #6b5c82; font-size: 12px; margin: 10px 0 0; }
            .actions { text-align: center; margin-top: 40px; }
            .actions button {
              font: inherit; font-size: 15px; font-weight: 600; padding: 12px 28px;
              border-radius: 10px; border: none; background: #57298c; color: #fff; cursor: pointer;
            }
            .actions p { color: #6b5c82; font-size: 13px; margin-top: 12px; }
            /* แถบตั้งค่า -- เครื่องมือบนจอ ไม่ใช่ส่วนของกระดาษ */
            .print-setup {
              display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px;
              margin: 0 0 24px; padding: 12px 16px; border: 1px solid #cdb9ea;
              border-radius: 10px; background: #f7f2fd; font-size: 13px;
            }
            .print-setup label { display: inline-flex; align-items: center; gap: 6px; }
            .print-setup input {
              font: inherit; padding: 4px 6px; border: 1px solid #cdb9ea;
              border-radius: 6px; background: #fff; width: 76px;
            }
            .print-setup input[type="text"] { width: 110px; }
            .print-setup-widths { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
            .print-setup .setup-width { width: 58px; }
            .print-setup button {
              font: inherit; padding: 5px 12px; border-radius: 6px; cursor: pointer;
              border: 1px solid #cdb9ea; background: #fff; color: #57298c;
            }
            /* บนจอแสดงแต่ละ .print-page เป็นกระดาษ A4 จริง (กว้าง 210mm สูง 297mm
               ขอบในเท่ากับ @page) ตลอดเวลา ไม่ใช่เฉพาะตอน Preview -- ปรับค่าในแถบ
               ตั้งค่าแล้วเห็นผลบนแผ่นทันที ไม่ต้องสลับไปดูตัวอย่างไปมา
               ใน @media print ด้านล่างล้างทั้งหมดนี้ทิ้ง เพราะเครื่องพิมพ์ใช้ขอบจาก
               @page อยู่แล้ว ถ้าไม่ล้างขอบจะซ้อนกันสองชั้น */
            body { background: #ece8f2; }
            .print-page {
              box-sizing: border-box; width: 210mm; min-height: 297mm;
              padding: 1.5cm 2cm 1.5cm 3cm; margin: 0 auto 24px;
              background: #fff; box-shadow: 0 2px 10px rgba(34, 21, 48, 0.18);
            }
            .print-setup, .actions { max-width: 210mm; margin-left: auto; margin-right: auto; box-sizing: border-box; }
            .print-setup { position: sticky; top: 0; z-index: 2; }
            /* แผ่นที่เนื้อหาล้นเกิน A4 -- ตอนพิมพ์จริงจะไหลไปขึ้นแผ่นใหม่เอง ทำให้
               ลายเซ็นหลุดไปอยู่แผ่นถัดไป เตือนตั้งแต่บนจอ (ดู markOverflowPages) */
            .print-page.is-overflow { outline: 3px solid #c0392b; outline-offset: 2px; }
            .overflow-warning { color: #c0392b; font-weight: 600; }
            .overflow-warning[hidden] { display: none; }
            /* โหมดตัวอย่าง: ซ่อนทุกอย่างที่ไม่ได้อยู่บนกระดาษจริง (กรอบช่องแก้ไข,
               ดรอปดาวน์ผู้ส่ง) แต่ "ไม่" ซ่อนแถบตั้งค่า -- ปรับขนาดตัวอักษร/จัดหน้า
               ระหว่างดูตัวอย่างได้เลย */
            body.is-preview [contenteditable] { outline: none; }
            body.is-preview .sig-picker { display: none; }
            .actions .btn-secondary { background: #fff; color: #57298c; border: 1px solid #57298c; margin-right: 8px; }
            @media print {
              [contenteditable="true"] { outline: none; }
              .sig-picker { display: none; }
              .actions { display: none; }
              .print-setup { display: none; }
              .overflow-warning { display: none; }
              body { background: #fff; }
              .print-page {
                width: auto; min-height: 0; padding: 0; margin: 0;
                box-shadow: none; outline: none !important;
              }
              /* The on-screen padding would stack on top of the @page margins
                 and make the printed edges measure wider than specified. */
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <!-- แถบตั้งค่าก่อนพิมพ์ -- เห็นบนจอเท่านั้น (@media print ซ่อนทิ้ง)
               ปรับแล้ววาดหน้าใหม่ทันที โดยเก็บข้อความที่พิมพ์ไว้แล้วกลับมาให้ครบ -->
          <div class="print-setup">
            <strong>ตั้งค่าก่อนพิมพ์</strong>
            <label>ขนาดตัวอักษรในตาราง <input type="number" id="setupFont" min="8" max="24" step="0.5" value="${setup.fontSize}"> px</label>
            <label>รายการต่อแผ่น <input type="number" id="setupRows" min="1" max="60" step="1" value="${setup.rowsPerPage}"></label>
            <label title="ใส่ลำดับที่ของรายการที่ต้องการให้เริ่มแผ่นใหม่ คั่นด้วยจุลภาค เช่น 5,12 -- ใส่ไว้แล้วจะทับค่ารายการต่อแผ่น">ขึ้นแผ่นใหม่ที่ลำดับที่ <input type="text" id="setupBreaks" placeholder="เช่น 5,12" value=""></label>
            <span class="print-setup-widths">ความกว้างคอลัมน์ (%):
              ${setup.widths.map((w, i) => `<input type="number" class="setup-width" data-col="${i}" min="3" max="80" step="1" value="${w}" title="${escapeForPrint(i === 0 ? "ลำดับที่" : (i <= columns.length ? columns[i - 1].label : "หมายเหตุ"))}">`).join("")}
            </span>
            <button type="button" id="setupResetBtn">คืนค่าเริ่มต้น</button>
            <span id="overflowWarning" class="overflow-warning" hidden></span>
          </div>
          <div id="printPages">${buildPages()}</div>
          <!-- ขั้นตอน: แก้ไข -> ดูตัวอย่าง (Preview) -> พิมพ์ -> ยืนยันว่าพิมพ์แล้ว
               ปุ่มพิมพ์ซ่อนไว้จนกว่าจะเข้าโหมดตัวอย่าง ให้ได้เห็นหน้าตาจริงก่อนทุกครั้ง -->
          <div class="actions">
            <button type="button" id="previewBtn" class="btn-secondary">ดูตัวอย่างก่อนพิมพ์ (Preview)</button>
            <button type="button" id="confirmBtn" hidden>${escapeForPrint(actionLabel)}</button>
            <p>${escapeForPrint(actionNote)}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();

    const doc = printWindow.document;
    const pagesEl = doc.getElementById("printPages");

    /**
     * วาดหน้ากระดาษใหม่ตามค่าที่ตั้งไว้
     *
     * ต้องเก็บสิ่งที่คนพิมพ์ไปแล้วกลับมาให้ครบก่อน -- ช่องหมายเหตุกับช่องลงชื่อ
     * เป็น contenteditable ถ้าวาดทับดื้อ ๆ ข้อความที่พิมพ์ไว้จะหายไปทั้งหมดเพียง
     * เพราะขยับการจัดหน้า ซึ่งเป็นการเสียงานจริง ไม่ใช่แค่เรื่องหน้าตา
     */
    function rerenderPages() {
      const edited = readDispatchDocument(printWindow);
      edited.notes.forEach((note, i) => { if (rows[i]) rows[i].note = note; });
      if (edited.sender.name || edited.sender.position) {
        sender = { ...sender, name: edited.sender.name, position: edited.sender.position };
      }
      if (edited.receiver.name || edited.receiver.position) {
        receiver = { ...receiver, name: edited.receiver.name, position: edited.receiver.position };
      }

      pagesEl.innerHTML = buildPages();
      doc.documentElement.style.setProperty("--table-font", `${setup.fontSize}px`);
      wireSenderPicker(printWindow, senderOptions || []);
      wireSignatureMirroring(printWindow);
      // วาดใหม่ได้ช่อง contenteditable="true" ชุดใหม่ -- ถ้ากำลังอยู่ในโหมดตัวอย่าง
      // ต้องล็อกกลับเหมือนเดิม ไม่งั้นปรับค่าระหว่างดูตัวอย่างแล้วกรอบแก้ไขโผล่คืน
      applyPreviewState();
      markOverflowPages();
    }

    /**
     * ทำเครื่องหมายแผ่นที่เนื้อหายาวเกิน A4 -- วัดจากความสูงจริงที่วาดออกมาเทียบกับ
     * กล่องทดสอบสูง 297mm (ให้เบราว์เซอร์แปลง mm เป็น px เอง ไม่เดาค่า DPI)
     * ตอนพิมพ์จริงแผ่นแบบนี้จะไหลล้นไปอีกแผ่น ลายเซ็นหลุดจากตาราง จึงต้องเห็นก่อนพิมพ์
     */
    function markOverflowPages() {
      const probe = doc.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;height:297mm;width:1px;";
      doc.body.appendChild(probe);
      const limit = probe.getBoundingClientRect().height + 1;
      probe.remove();

      const over = [];
      doc.querySelectorAll(".print-page").forEach((page, i) => {
        const overflow = page.getBoundingClientRect().height > limit;
        page.classList.toggle("is-overflow", overflow);
        if (overflow) over.push(i + 1);
      });

      const warning = doc.getElementById("overflowWarning");
      warning.hidden = !over.length;
      warning.textContent = over.length
        ? `แผ่นที่ ${over.join(", ")} ยาวเกิน 1 หน้า A4 -- ลดขนาดตัวอักษรหรือจำนวนรายการต่อแผ่น`
        : "";
    }

    const previewBtn = doc.getElementById("previewBtn");
    const confirmBtnEl = doc.getElementById("confirmBtn");
    let previewing = false;

    /**
     * โหมดตัวอย่าง: ล็อกช่องแก้ไข ซ่อนกรอบ/ดรอปดาวน์ แล้วเผยปุ่มพิมพ์
     * แถบตั้งค่ายังอยู่ -- ปรับแล้วเห็นผลบนแผ่นทันที ไม่ต้องสลับไปมา
     *
     * เลือกด้วย [contenteditable] (ไม่ระบุค่า) จึงจับได้ทั้งตอนเป็น true และ false
     * ส่วนช่องสำเนาบนแผ่นที่ 2 เป็นต้นไปไม่มีแอตทริบิวต์นี้เลยตั้งแต่แรก จึงไม่ถูก
     * เปิดให้แก้ไขตอนออกจากโหมดตัวอย่าง
     */
    function applyPreviewState() {
      doc.body.classList.toggle("is-preview", previewing);
      doc.querySelectorAll("[contenteditable]").forEach(el => {
        el.setAttribute("contenteditable", previewing ? "false" : "true");
      });
      confirmBtnEl.hidden = !previewing;
      previewBtn.textContent = previewing ? "กลับไปแก้ไข" : "ดูตัวอย่างก่อนพิมพ์ (Preview)";
    }

    previewBtn.addEventListener("click", () => {
      previewing = !previewing;
      applyPreviewState();
      markOverflowPages();
    });

    doc.documentElement.style.setProperty("--table-font", `${setup.fontSize}px`);

    const fontEl = doc.getElementById("setupFont");
    const rowsEl = doc.getElementById("setupRows");
    const breaksEl = doc.getElementById("setupBreaks");

    fontEl.addEventListener("input", () => {
      const value = Number(fontEl.value);
      if (!Number.isFinite(value) || value <= 0) return;
      setup.fontSize = value;
      // ขนาดตัวอักษรไม่เปลี่ยนการแบ่งแผ่น (แบ่งตามจำนวนรายการ ไม่ใช่ความสูงจริง)
      // จึงแค่ขยับตัวแปร CSS พอ ไม่ต้องวาดใหม่ -- ไม่ต้องเสี่ยงกับข้อความที่พิมพ์ค้างไว้
      doc.documentElement.style.setProperty("--table-font", `${value}px`);
      markOverflowPages();
    });

    rowsEl.addEventListener("change", () => {
      setup.rowsPerPage = Math.max(1, Number(rowsEl.value) || DISPATCH_ROWS_PER_PAGE);
      rerenderPages();
    });

    breaksEl.addEventListener("change", () => {
      setup.breaks = breaksEl.value;
      rerenderPages();
    });

    // ความกว้างคอลัมน์เขียนลง <colgroup> ของทุกแผ่นตรง ๆ ไม่ต้องวาดหน้าใหม่ --
    // เปลี่ยนความกว้างไม่ทำให้จำนวนแผ่นเปลี่ยน และรักษาข้อความที่พิมพ์ไว้ได้ฟรี
    doc.querySelectorAll(".setup-width").forEach(input => {
      input.addEventListener("input", () => {
        const col = Number(input.dataset.col);
        const value = Number(input.value);
        if (!Number.isFinite(value) || value <= 0) return;
        setup.widths[col] = value;
        doc.querySelectorAll("colgroup").forEach(group => {
          const target = group.children[col];
          if (target) target.style.width = `${value}%`;
        });
        // คอลัมน์แคบลง = ข้อความตัดบรรทัดมากขึ้น แผ่นอาจสูงเกินได้
        markOverflowPages();
      });
    });

    doc.getElementById("setupResetBtn").addEventListener("click", () => {
      setup.fontSize = 14;
      setup.rowsPerPage = DISPATCH_ROWS_PER_PAGE;
      setup.breaks = "";
      setup.widths = defaultColumnWidths(columns.length);
      fontEl.value = String(setup.fontSize);
      rowsEl.value = String(setup.rowsPerPage);
      breaksEl.value = "";
      doc.querySelectorAll(".setup-width").forEach((input, i) => { input.value = String(setup.widths[i]); });
      rerenderPages();
    });

    wireSenderPicker(printWindow, senderOptions || []);
    wireSignatureMirroring(printWindow);
    applyPreviewState();
    // รอให้ฟอนต์จาก Google Fonts โหลดก่อนค่อยวัด -- วัดก่อนจะได้ความสูงของฟอนต์
    // สำรองซึ่งต่างจากที่พิมพ์จริง
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(markOverflowPages);
    else markOverflowPages();
  }

  /**
   * พิมพ์ก่อน แล้วค่อยเปลี่ยนสถานะ -- ตามลำดับที่เจ้าของงานสั่ง
   *
   * สคริปต์รู้ไม่ได้ว่าหน้าต่างพิมพ์ของเบราว์เซอร์ถูกกดพิมพ์หรือกดยกเลิก จึงถาม
   * คนตรง ๆ หลังหน้าต่างพิมพ์ปิด ตอบ "ยกเลิก" = ไม่มีอะไรเปลี่ยนเลย กดพิมพ์ใหม่ได้
   *
   * อ่านข้อความที่แก้ไว้ (readDispatchDocument) ก่อนเปิดหน้าต่างพิมพ์ -- สิ่งที่
   * เก็บลงสมุดต้องเป็นสิ่งที่อยู่บนกระดาษแผ่นที่เพิ่งพิมพ์ออกไป
   *
   * ถ้าพิมพ์แล้วแต่บันทึกไม่สำเร็จ ปุ่มจะเปลี่ยนเป็น "บันทึกสถานะอีกครั้ง" ซึ่งบันทึก
   * อย่างเดียวไม่พิมพ์ซ้ำ -- กระดาษออกไปแล้ว ไม่ควรต้องพิมพ์อีกแผ่นเพื่อแก้ปัญหาเน็ต
   */
  function wirePrintThenConfirm(printWindow, { statusLabel, save }) {
    const doc = printWindow.document;
    const confirmBtn = doc.getElementById("confirmBtn");
    const previewBtn = doc.getElementById("previewBtn");
    const note = doc.querySelector(".actions p");
    const idleLabel = confirmBtn.textContent;
    let printedEdited = null;

    function waitForPrintDialog() {
      return new Promise(resolve => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          printWindow.removeEventListener("afterprint", done);
          resolve();
        };
        printWindow.addEventListener("afterprint", done);
        const started = Date.now();
        printWindow.print();
        // เบราว์เซอร์ส่วนใหญ่ (Chrome/Edge/Firefox) หยุดรอที่ print() จนหน้าต่าง
        // ปิด -- ถ้ากลับมาช้ากว่าเสี้ยววินาทีแปลว่าหน้าต่างปิดไปแล้ว ไม่ต้องรอ
        // afterprint อีก ส่วนเบราว์เซอร์ที่ไม่หยุดรอจะได้คำตอบจาก afterprint แทน
        if (Date.now() - started > 300) done();
      });
    }

    async function saveStatus() {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "กำลังบันทึก...";
      try {
        await save(printedEdited);
        confirmBtn.textContent = "พิมพ์และบันทึกเรียบร้อย";
        previewBtn.hidden = true;
        note.textContent = `เปลี่ยนสถานะเป็น "${statusLabel}" และเก็บสมุดเล่มนี้ไว้ในประวัติแล้ว ปิดหน้าต่างนี้ได้เลย`;
      } catch (err) {
        console.error(`CS Connect: บันทึกสถานะ "${statusLabel}" ไม่สำเร็จ`, err);
        confirmBtn.disabled = false;
        confirmBtn.textContent = "บันทึกสถานะอีกครั้ง";
        note.textContent = "พิมพ์แล้วแต่บันทึกสถานะไม่สำเร็จ -- กดปุ่มด้านบนเพื่อบันทึกอีกครั้ง (ไม่พิมพ์ซ้ำ)";
      }
    }

    confirmBtn.addEventListener("click", async () => {
      if (printedEdited) {
        await saveStatus();
        return;
      }

      confirmBtn.disabled = true;
      const edited = readDispatchDocument(printWindow);
      await waitForPrintDialog();

      const ok = printWindow.confirm(
        `พิมพ์สมุดเรียบร้อยแล้วใช่หรือไม่?\n\n`
        + `กด "ตกลง" เพื่อเปลี่ยนสถานะคำร้องทั้งหมดในสมุดเป็น "${statusLabel}" และเก็บสมุดไว้ในประวัติ\n`
        + `กด "ยกเลิก" ถ้ายังไม่ได้พิมพ์ -- สถานะจะยังไม่เปลี่ยน`
      );

      if (!ok) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = idleLabel;
        note.textContent = "ยังไม่ได้เปลี่ยนสถานะ -- แก้ไข/ดูตัวอย่างแล้วกดพิมพ์ใหม่ได้เมื่อพร้อม";
        return;
      }

      printedEdited = edited;
      await saveStatus();
    });
  }

  /** Reads back whatever staff actually typed into the document before printing. */
  function readDispatchDocument(printWindow) {
    const doc = printWindow.document;
    const text = (el) => (el ? el.textContent.trim() : "");
    // เอกสารหลายแผ่นมี .sig-block ซ้ำทุกแผ่น (ดู writeDispatchDocument) แต่ตัว
    // แรกในลำดับเอกสารเสมอคือของแผ่นแรก (แผ่นเดียวที่แก้ไขได้จริง) การ destructure
    // สองตัวแรกจึงยังได้ค่าที่ถูกต้องเหมือนตอนมีแผ่นเดียว ไม่ต้องเปลี่ยนอะไร
    const [senderBlock, receiverBlock] = doc.querySelectorAll(".sig-block");
    // ช่องที่ยังไม่ได้กรอกเป็น element ว่างจริง ๆ -- จุดไข่ปลาที่เห็นบนจอมาจาก
    // .sig-fill:empty::before ซึ่ง textContent ไม่นับ จึงไม่ต้องมากรองข้อความ
    // ตัวอย่างทิ้งทีหลังเหมือนที่เคยต้องทำกับ placeholder ที่เป็นข้อความจริง
    const person = (block) => ({
      name: text(block && block.querySelector(".js-name")),
      position: text(block && block.querySelector(".js-position"))
    });

    // เอกสารหลายแผ่นมีหลาย <tbody> (หนึ่งอันต่อแผ่น) แต่ querySelectorAll คืนค่า
    // ตามลำดับเอกสารเสมอ -- แถวของแผ่นแรกมาก่อนแผ่นสองเสมอ ผลลัพธ์จึงเรียงตรงกับ
    // ลำดับเดิมใน rows ทุกประการ ไม่ต้องรวม/เรียงเองเพิ่ม
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
   * เอกสารหลายแผ่นมีบล็อกลงชื่อซ้ำทุกแผ่น (ต้องเซ็นสดทุกแผ่นจริง) แต่แก้ไขได้
   * เฉพาะแผ่นแรก -- ฟังก์ชันนี้คอยคัดลอกค่าจากช่องแก้ไขได้ของแผ่นแรกไปเติมช่อง
   * "สำเนา" อ่านอย่างเดียวของแผ่นถัดไปให้ตรงกันเสมอ ทั้งตอนพิมพ์ (input บน
   * contenteditable) และตอนเลือกจากดรอปดาวน์ผู้ส่ง (change ที่ wireSenderPicker
   * เขียนทับ .js-name/.js-position ตรง ๆ โดยไม่ยิง input) ต้องเรียกหลัง
   * wireSenderPicker เสมอ เพราะฟังทั้งสอง listener บน .sig-picker ตัวเดียวกัน
   * ตามลำดับที่ผูกไว้ -- อันนี้ต้องอ่านค่าที่ wireSenderPicker เขียนไปแล้ว
   */
  function wireSignatureMirroring(printWindow) {
    const doc = printWindow.document;
    ["sender-name", "sender-position", "receiver-name", "receiver-position"].forEach(role => {
      const fields = Array.from(doc.querySelectorAll(`[data-role="${role}"]`));
      const master = fields[0];
      const mirrors = fields.slice(1);
      if (!master || !mirrors.length) return;
      const sync = () => mirrors.forEach(el => { el.textContent = master.textContent; });
      master.addEventListener("input", sync);
      if (role === "sender-name" || role === "sender-position") {
        const picker = doc.querySelector(".sig-picker");
        if (picker) picker.addEventListener("change", sync);
      }
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
      // หมายเหตุในสมุดคุมเป็นช่องให้พิมพ์เพิ่มตอนส่งจริง ไม่ใช่หมายเหตุที่บันทึก
      // ไว้ในคำร้อง จึงเริ่มว่างเสมอ ไม่ดึงค่า r.note มาเติมล่วงหน้า
      note: ""
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
      actionLabel: "พิมพ์สมุดคุม",
      actionNote: 'แก้ไขข้อความในตาราง/ช่องเซ็นชื่อ แล้วกด "ดูตัวอย่างก่อนพิมพ์" -- ปรับขนาดตัวอักษร/จัดหน้าในแถบด้านบนได้ตลอด เห็นผลบนแผ่นทันที กดพิมพ์แล้วระบบจะถามยืนยันก่อนเปลี่ยนสถานะเป็น "ส่งแผนกมิเตอร์แล้ว"'
    });

    wirePrintThenConfirm(printWindow, {
      statusLabel: "ส่งแผนกมิเตอร์แล้ว",
      save: (edited) => markRecordsDispatchedToMeter(sorted.map(r => r.id), {
        printedAt,
        rows: rows.map((row, i) => ({ ...row, note: edited.notes[i] ?? row.note })),
        sender: edited.sender,
        receiver: edited.receiver
      })
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
      // หมายเหตุในสมุดคุมเป็นช่องให้พิมพ์เพิ่มตอนส่งจริง ไม่ใช่หมายเหตุที่บันทึก
      // ไว้ในคำร้อง จึงเริ่มว่างเสมอ ไม่ดึงค่า r.note มาเติมล่วงหน้า
      note: ""
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
      actionLabel: "พิมพ์สมุดคุม",
      actionNote: 'แก้ไขข้อความในตาราง/ช่องเซ็นชื่อ แล้วกด "ดูตัวอย่างก่อนพิมพ์" -- ปรับขนาดตัวอักษร/จัดหน้าในแถบด้านบนได้ตลอด เห็นผลบนแผ่นทันที กดพิมพ์แล้วระบบจะถามยืนยันก่อนเปลี่ยนสถานะเป็น "ส่ง ผสน. แล้ว"'
    });

    wirePrintThenConfirm(printWindow, {
      statusLabel: "ส่ง ผสน. แล้ว",
      save: (edited) => markRecordsSentGeneral(sorted.map(r => r.id), {
        printedAt,
        rows: rows.map((row, i) => ({ ...row, note: edited.notes[i] ?? row.note })),
        sender: edited.sender,
        receiver: edited.receiver
      })
    });
  }

  /** เหมือน openGeneralDispatchPrint ด้านล่าง แต่ของแผนกบริหารรายได้ค่าไฟฟ้า */
  async function openRevenueDispatchPrint(records) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const sorted = records.slice().sort((a, b) => {
      return String(a.receivedDate || "").localeCompare(String(b.receivedDate || "")) ||
        String(a.requestNumber || "").localeCompare(String(b.requestNumber || ""));
    });

    const printedAt = Date.now();
    const rows = sorted.map((r, i) => ({
      position: i + 1,
      requestId: r.id,
      requestNumber: r.requestNumber || "",
      trackingNumber: r.trackingNumber || "",
      customerName: r.customerName || "",
      ca: r.ca || "",
      // หมายเหตุในสมุดคุมเป็นช่องให้พิมพ์เพิ่มตอนส่งจริง ไม่ใช่หมายเหตุที่บันทึก
      // ไว้ในคำร้อง จึงเริ่มว่างเสมอ ไม่ดึงค่า r.note มาเติมล่วงหน้า
      note: ""
    }));

    const { sender, senderOptions } = await resolveSenderInfo();

    writeDispatchDocument(printWindow, {
      title: "สมุดคุมคำร้องส่งแผนกบริหารรายได้ค่าไฟฟ้า",
      columns: REVENUE_DISPATCH_PRINT_COLUMNS,
      rows,
      printedAt,
      sender,
      senderOptions,
      receiver: { name: "", position: "" },
      editable: true,
      actionLabel: "พิมพ์สมุดคุม",
      actionNote: 'แก้ไขข้อความในตาราง/ช่องเซ็นชื่อ แล้วกด "ดูตัวอย่างก่อนพิมพ์" -- ปรับขนาดตัวอักษร/จัดหน้าในแถบด้านบนได้ตลอด เห็นผลบนแผ่นทันที กดพิมพ์แล้วระบบจะถามยืนยันก่อนเปลี่ยนสถานะเป็น "ส่ง ผบร."'
    });

    wirePrintThenConfirm(printWindow, {
      statusLabel: "ส่ง ผบร.",
      save: (edited) => markRecordsSentRevenue(sorted.map(r => r.id), {
        printedAt,
        rows: rows.map((row, i) => ({ ...row, note: edited.notes[i] ?? row.note })),
        sender: edited.sender,
        receiver: edited.receiver
      })
    });
  }

  /** เหมือน openGeneralDispatchReprint ด้านล่าง แต่ของสมุดคุมส่ง ผบร. */
  function openRevenueDispatchReprint(dispatch) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    writeDispatchDocument(printWindow, {
      title: "สมุดคุมคำร้องส่งแผนกบริหารรายได้ค่าไฟฟ้า",
      columns: REVENUE_DISPATCH_PRINT_COLUMNS,
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
    extend: "2",
    // คำร้องทั่วไปใช้เลขนี้ภายในแผนกเท่านั้น (ดู findRequestFor_ ใน Code.gs ที่
    // กันประเภทนี้ออกจากหน้าติดตามสาธารณะ) แต่ยังต้องมีเลขประเภทของตัวเอง --
    // ถ้าไม่ใส่ generateTrackingNumbers() จะ fallback ไปใช้ "1" ของขอใช้ไฟฟ้า
    // แล้วเลขจะชนกันข้ามประเภท ซึ่งพังการค้นหาด้วยเลขที่คำร้องทั้งระบบ
    general: "3",
    deposit: "4"
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
   * ค่าเริ่มต้นของช่อง WBS ตอนเปิดฟอร์ม -- รูปแบบ C-<ปี พ.ศ. 2 หลัก>-A-HADSR.0000
   * เสมอ **ไม่ใช่เลขถัดไปที่เดาไว้ล่วงหน้าอีกต่อไป** (เดิมไล่หาเลขสูงสุดจากคำร้อง
   * ที่โหลดมาแล้วบวกหนึ่งให้ เหมือน generateTrackingNumber แต่ตั้งใจเปลี่ยนตามที่
   * เจ้าของระบบขอ: เลขเดาแบบนั้นหน้าตาเหมือนเลขจริงเกินไป มีเจ้าหน้าที่บันทึก
   * สถานะงานโดยไม่ได้แก้ไข WBS ที่ระบบเดาให้ กลายเป็นว่าเลขที่ควรว่างสำหรับคน
   * บันทึก WBS ตัวจริงถูกใบอื่นไปครองอยู่ก่อนโดยไม่มีใครตั้งใจ ทำให้ระบุ WBS ที่
   * ถูกต้องไม่ได้อีก ลงท้ายด้วย .0000 เสมอจึงมองออกง่ายว่ายังไม่ได้กรอกจริง
   * (เลข .0000 ที่กรอกจริงแทบไม่เกิดขึ้น เพราะ WBS จริงเริ่มนับที่ .0001)
   *
   * WBS ยังห้ามซ้ำกันทั้งสำนักงานเหมือนเดิม (save_requests ฝั่ง SQL) รวมถึงชน
   * กับค่าเริ่มต้นนี้เองด้วย -- ถ้าคนแรกบันทึกทับโดยไม่แก้ไข คนที่สองที่ทำแบบ
   * เดียวกันกับคำร้องใบอื่นจะถูกปฏิเสธและรู้ตัวทันทีว่าต้องกรอกเลขจริง แทนที่จะ
   * ปล่อยผ่านไปเงียบ ๆ เหมือนตอนที่ค่าเริ่มต้นเป็นเลขเดาที่ไม่ซ้ำกันเอง
   */
  function wbsPrefix() {
    const beYear = new Date().getFullYear() + 543;
    return `C-${String(beYear % 100).padStart(2, "0")}-A-HADSR.`;
  }

  function defaultWbs() {
    return `${wbsPrefix()}0000`;
  }

  /**
   * ค่าเริ่มต้นในช่อง WBS (ลำดับลงท้าย .0000) ไม่ใช่เลขจริง เป็นแบบให้พิมพ์ทับ
   * -- บันทึกเป็นค่าว่างแทน ไม่งั้นใบใหม่ทุกใบจะถือเลขเดียวกันหมดแล้วชนกฎห้ามซ้ำ
   * (ฝั่งฐานข้อมูลก็ข้ามค่าแบบนี้เหมือนกัน ดู migration 20260921000001)
   */
  function wbsValueToSave(raw) {
    const wbs = String(raw || "").trim();
    return /\.0+$/.test(wbs) ? "" : wbs;
  }

  function generateTrackingNumber(type) {
    return generateTrackingNumbers(1, type)[0];
  }

  /**
   * จุดเริ่มนับของ id -- ไม่มีความหมายอื่นนอกจากทำให้ตัวเลขสั้นลง ดู newRequestId
   */
  const ID_EPOCH = Date.UTC(2020, 0, 1);

  /**
   * Primary key for a new record. This used to be a bare `Date.now()`, which
   * collides whenever two staff save within the same millisecond -- and since
   * upsertAll_ matches rows by id, a collision meant one record silently
   * overwrote the other instead of both being kept. Checking the local cache
   * wouldn't help (neither browser knows about the other's brand-new record
   * yet), so the millisecond is widened with a random suffix instead: no
   * coordination needed, and a same-millisecond pair now has a 1-in-1000
   * chance of colliding rather than a certainty.
   *
   * **ต้องไม่เกิน 15 หลัก และนี่คือเหตุผลที่ต้องลบ ID_EPOCH ออกก่อนคูณ**
   *
   * Google Sheets เก็บตัวเลขได้แม่นยำ 15 หลักนัยสำคัญ ไม่ใช่ 16 -- ของเดิม
   * Date.now() * 1000 ให้เลข 16 หลัก (ราว 1.79e15) ชีตจึงปัดหลักสุดท้ายทิ้ง
   * เงียบ ๆ ตอนเขียน id ที่เบราว์เซอร์ถืออยู่กับ id ที่ชีตเก็บจริงจึงไม่ตรงกัน
   * เช่นส่งไป ...637 แต่ชีตเก็บ ...630 พอกดบันทึกใบเดิมอีกครั้งโดยยังไม่ได้
   * รีเฟรช upsertAll_ ที่จับคู่แถวด้วย id หาไม่เจอ แล้วต่อแถวใหม่ให้ -- คือ
   * อาการคำร้อง "เบิ้ล" ที่เจอ ไม่ใช่การกดบันทึกซ้ำของคน
   *
   * ตรวจแล้วว่าเป็นจริง: id สามใบในชีตอ่านได้เป็น 1789270610457630,
   * 1789270671985170 และ 1789270710790230 -- ลงท้ายด้วย 0 ทั้งหมด ทั้งที่หลัก
   * สุดท้ายมาจากตัวสุ่ม
   *
   * ลบ ID_EPOCH ก่อนคูณทำให้เหลือ 15 หลักพอดี โดยยังคงความละเอียดระดับ
   * มิลลิวินาทีและตัวสุ่ม 3 หลักไว้ครบเหมือนเดิม (จะยาวเป็น 16 หลักอีกครั้ง
   * ราวปี ค.ศ. 2051 -- ถึงตอนนั้นต้องขยับ ID_EPOCH หรือเลิกเก็บ id เป็นตัวเลข)
   * ยังเป็นจำนวนเต็มล้วนตามที่ NUMBER_COLUMNS ใน Code.gs บังคับ และเล็กกว่า
   * Number.MAX_SAFE_INTEGER มาก
   *
   * id ที่ออกหลังจากนี้จะ "น้อยกว่า" ของเดิมทั้งหมด จึงเทียบกันเป็นลำดับเวลา
   * ไม่ได้ -- ซึ่งไม่กระทบอะไร เพราะทุกที่ในแอปเรียงด้วย createdAt อยู่แล้ว
   */
  function newRequestId() {
    return (Date.now() - ID_EPOCH) * 1000 + Math.floor(Math.random() * 1000);
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
    revenueDispatchesCache = [];
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

      // Make the wait visible and block a second submit rather than letting
      // it look unresponsive.
      setBusy(submitBtn, true, "กำลังเข้าสู่ระบบ...");

      // The backend decides -- it never tells us whether it was the email or
      // the password that was wrong, and we pass that through unchanged.
      // remember ส่งไปด้วยเพราะ session ของ Supabase Auth ต้องเก็บฝั่งเดียวกับ
      // session ของแอป (localStorage หรือ sessionStorage)
      const user = await backend.login(email, password, remember);

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
      registerSuccess.textContent = "สมัครสมาชิกสำเร็จ ระบบได้ส่งคำขอไปให้ผู้ดูแลระบบอนุมัติแล้ว กรุณารอผู้ดูแลระบบอนุมัติก่อนเข้าสู่ระบบ";
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
    // ทุกหน้ามีแถบบนของตัวเอง -- เขียนทีเดียวด้วยคลาสร่วม ไม่ไล่ id ทีละตัว
    // (เคยเป็น userGreeting1..4 แล้วพอเพิ่มหน้าใหม่ก็ลืมเติม ชื่อผู้ใช้คนก่อน
    // จึงค้างอยู่บนหน้าใหม่ -- ความผิดพลาดแบบที่หน้าจอโกหกว่าล็อกอินเป็นใคร)
    document.querySelectorAll(".user-greeting").forEach(el => { el.textContent = greeting; });
    showView("home");
  }

  /**
   * เรียกจาก init() เท่านั้น หลัง enterApp() (ไม่ใช่จากปุ่ม "กลับหน้าแรก" -- ปุ่ม
   * นั้นต้องพากลับหน้าแรกจริง ๆ เสมอ ไม่ใช่เดาสภาพเดิม) คืนตำแหน่งที่จำไว้จาก
   * saveNavState() ด้วยการจำลองคลิกการ์ด/แท็บเดิมซ้ำ แทนที่จะเขียนโค้ดเปิดหน้า
   * เองอีกชุด -- ถ้าจำไว้ไม่มี (เพิ่งล็อกอินใหม่ในแท็บนี้ครั้งแรก) หรือการ์ด/แท็บ
   * ที่จำไว้หาไม่เจอแล้ว ก็ปล่อยให้อยู่หน้าแรกตามที่ enterApp() ตั้งไว้แต่แรก
   */
  function restoreNavState() {
    const nav = readNavState();
    if (!nav || !nav.card) return;

    // "account" ไม่ใช่การ์ดบนหน้าแรก (เปิดจากปุ่มบนแถบบนแทน) จึงเรียกตรง ๆ
    // ไม่ใช้วิธีจำลองคลิกการ์ดแบบที่เหลือ
    if (nav.card === "account") {
      openAccountView(false);
      return;
    }

    const card = document.querySelector(`.service-card[data-service="${nav.card}"]`);
    if (!card) return;
    card.click();

    // การ์ดงานธุรกิจเสริมมีสองโมดูลย่อย -- จำว่าอยู่หน้าไหนตอนรีเฟรช
    if (nav.module === "brochure") { openBrochureView(); return; }
    if (nav.module === "quotation") { openQuotationView(); return; }

    if (nav.card === "requests" && nav.filter) {
      const tab = Array.from(requestsNavItems).find(item => item.dataset.filter === nav.filter);
      if (tab) tab.click();
    }
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
    resetApplicantsPanel();

    document.getElementById("revokeAllBtn").hidden = true;
    document.querySelectorAll(".user-greeting").forEach(el => { el.textContent = ""; });

    // ตำแหน่งหน้าจอที่จำไว้เป็นของบัญชีที่เพิ่งออกจากระบบไป -- ถ้าไม่ล้าง คนถัดไป
    // ที่ล็อกอินบนเครื่องเดียวกัน (หรือบัญชีเดิมล็อกอินใหม่หลัง session หมดอายุ)
    // จะถูกพาตรงไปหน้าที่คนก่อนหน้าเปิดค้างไว้แทนที่จะเริ่มที่หน้าแรกตามปกติ
    clearNavState();

    clearWorkspaceScreens();
    clearModuleScreens();
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
    document.getElementById("requestFormLinkedInfo").hidden = true;
    document.getElementById("requestFormLinkedInfo").innerHTML = "";
    document.getElementById("reqCreateExtendBtn").hidden = true;
    linkedReturn = null;
    // #extendForm/#generalForm เก็บข้อมูลลูกค้าได้เหมือน #requestForm ข้างบน
    // ทุกประการ แต่ไม่เคยถูกล้างตรงนี้มาก่อน -- ค่าที่พิมพ์ค้างไว้จะยังอยู่ใน DOM
    // ทั้งที่จอกลับไปเป็นหน้า login แล้ว อ่านได้ทันทีผ่านเครื่องมือพัฒนาของ
    // เบราว์เซอร์โดยไม่ต้องล็อกอินเลยด้วยซ้ำ (ดูหมายเหตุที่ resetExtendFormState)
    resetExtendFormState();
    resetGeneralFormState();
    resetDepositFormState();

    document.getElementById("batchRows").innerHTML = "";
    document.getElementById("batchResult").hidden = true;

    // แค็ตตาล็อกและชุดเซ็ตเป็นข้อมูลที่ดึงมาด้วย token ของคนที่เพิ่งออกจากระบบ
    // และชุดเซ็ตยังติดชื่อคนสร้างมาด้วย -- ทิ้งไปให้คนถัดไปดึงใหม่ด้วย token ของตัวเอง
    estimateCatalog = null;
    estimateCatalogFailed = false;
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
    requestsDateFromValue = "";
    requestsDateToValue = "";
    requestsDateFrom.value = "";
    requestsDateTo.value = "";
    meterSelection.clear();
    generalSelection.clear();
    revenueSelection.clear();
    extendSelection.clear();
    extendSearchQuery = "";
    extendFilter = EXTEND_FILTER_ALL;
    workKind = "extend";
    document.getElementById("reqAssigneeField").hidden = true;
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
    // lands, and a stranded session is rejected after SESSION_DAYS anyway.
    backend.logout().catch(err => console.warn("CS Connect logout:", err));

    clearSession();
    requestsCache = [];
    dispatchesCache = [];
    generalDispatchesCache = [];
    revenueDispatchesCache = [];
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
    rolesResult: document.getElementById("adminRolesResult"),
    applicantsSection: document.getElementById("adminApplicantsSection"),
    applicantsList: document.getElementById("adminApplicantsList"),
    applicantsEmpty: document.getElementById("adminApplicantsEmpty"),
    applicantsError: document.getElementById("adminApplicantsError"),
    applicantsResult: document.getElementById("adminApplicantsResult")
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

    accountView.applicantsSection.hidden = !session?.isAdmin || mustChange;
    resetApplicantsPanel();
    if (session?.isAdmin && !mustChange) refreshApplicantsPanel();
    accountView.forceNotice.hidden = !mustChange;
    accountView.backRow.hidden = mustChange;
    // ปุ่มมุมซ้ายบนต้องหายไปพร้อมกัน ไม่งั้นด่านบังคับตั้งรหัสใหม่มีทางออก
    document.getElementById("accountBackBtn").hidden = mustChange;

    // ด่านบังคับตั้งรหัสใหม่ไม่ใช่หน้าที่ผู้ใช้ "เลือกมา" เอง -- ไม่จำไว้ ไม่งั้น
    // รีเฟรชหลังตั้งรหัสผ่านเสร็จ (ด่านหลุดไปแล้ว) จะพากลับมาที่หน้าบัญชีอีกที
    // ทั้งที่ไม่มีเหตุผลอะไรให้ต้องอยู่ที่นั่นต่อ
    if (!mustChange) saveNavState({ card: "account" });

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
        accountView.applicantsSection.hidden = !session.isAdmin;
        if (session.isAdmin) {
          refreshInviteStatus();
          refreshRolesPanel();
          refreshApplicantsPanel();
        }

        // ตอนล็อกอิน บัญชีนี้ถูกพามาที่นี่โดยไม่ได้โหลดข้อมูลเลย (loadRequests
        // จะถูกปฏิเสธอยู่แล้ว) ตอนนี้ผ่านด่านแล้วจึงต้องโหลด ไม่งั้นกดกลับหน้าแรก
        // ไปจะเจอรายการคำร้องว่างเปล่าทั้งที่ข้อมูลมีอยู่
        try {
          await refreshAll();

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

  /**
   * ผู้สมัครที่รออนุมัติ -- แทนลิงก์อนุมัติ/ปฏิเสธที่ระบบเดิมส่งทางอีเมล
   * การตัดสินจริงอยู่ที่ decide_applicant ในฐานข้อมูล (require_admin)
   */
  function resetApplicantsPanel() {
    accountView.applicantsList.innerHTML = "";
    accountView.applicantsEmpty.textContent = "";
    accountView.applicantsResult.hidden = true;
    hideError(accountView.applicantsError);
  }

  function renderApplicants(applicants) {
    accountView.applicantsList.innerHTML = "";
    accountView.applicantsEmpty.textContent = applicants.length
      ? `รออนุมัติ ${applicants.length} บัญชี`
      : "ไม่มีผู้สมัครที่รออนุมัติ";

    applicants.forEach(person => {
      const row = document.createElement("div");
      row.className = "applicant-row";

      const info = document.createElement("div");
      info.className = "applicant-info";
      const name = document.createElement("strong");
      name.textContent = person.name || "-";
      const meta = document.createElement("span");
      meta.textContent = [person.position, person.email, person.createdAt ? formatThaiDateTime(person.createdAt) : ""]
        .filter(Boolean).join(" · ");
      info.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "batch-toolbar";
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "btn btn-primary";
      approve.textContent = "อนุมัติ";
      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "btn btn-ghost btn-danger-ghost";
      reject.textContent = "ปฏิเสธ";
      approve.addEventListener("click", () => decideApplicant(approve, person, "approve"));
      reject.addEventListener("click", () => decideApplicant(reject, person, "reject"));
      actions.append(approve, reject);

      row.append(info, actions);
      accountView.applicantsList.appendChild(row);
    });
  }

  async function refreshApplicantsPanel() {
    try {
      const data = await backend.listApplicants();
      renderApplicants(data.applicants || []);
    } catch (err) {
      console.error("CS Connect applicants error:", err);
      showError(accountView.applicantsError, friendlyError(err, "โหลดรายชื่อผู้สมัครไม่สำเร็จ"));
    }
  }

  async function decideApplicant(button, person, decision) {
    hideError(accountView.applicantsError);
    accountView.applicantsResult.hidden = true;

    const who = person.name || person.email;
    const ok = window.confirm(decision === "approve"
      ? `ยืนยันอนุมัติ ${who} (${person.email}) ให้เข้าใช้งานระบบ?`
      : `ยืนยันปฏิเสธ ${who} (${person.email})?`);
    if (!ok) return;

    setBusy(button, true, "กำลังบันทึก...");
    try {
      const data = await backend.decideApplicant(person.email, decision);
      renderApplicants(data.applicants || []);
      accountView.applicantsResult.textContent = decision === "approve"
        ? `อนุมัติ ${who} แล้ว เข้าสู่ระบบได้ทันที`
        : `ปฏิเสธ ${who} แล้ว`;
      accountView.applicantsResult.hidden = false;
      if (decision === "approve") refreshRolesPanel();
    } catch (err) {
      console.error("CS Connect decide applicant error:", err);
      showError(accountView.applicantsError, friendlyError(err, "บันทึกผลการพิจารณาไม่สำเร็จ"));
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
      revenueDispatchesCache = [];
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
  // ปุ่มออกจากระบบมีอยู่บนแถบบนของทุกหน้า -- ผูกด้วย selector เดียวกัน เหตุผล
  // เดียวกับ .user-greeting ข้างบน (หน้าใหม่ที่ลืมผูกคือปุ่มที่กดแล้วไม่เกิดอะไร)
  document.querySelectorAll('[id^="logoutBtn"]').forEach(btn => {
    btn.addEventListener("click", logout);
  });

  // ---------- service cards ----------
  document.querySelectorAll(".service-card").forEach(card => {
    card.addEventListener("click", () => {
      const key = card.dataset.service;
      // จำไว้เผื่อรีเฟรช -- restoreNavState() คืนกลับมาที่นี่ด้วยการจำลองคลิก
      // การ์ดใบเดิมนี้เอง ไม่ได้เขียนโค้ดเปิดหน้าซ้ำอีกชุด
      saveNavState({ card: key });

      if (key === "requests") {
        openRequestsView();
        return;
      }

      // ระบบรับฟังเสียงของลูกค้า -- หน้าของตัวเองเต็มหน้า ไม่ใช่การ์ดว่างของ SERVICES
      if (key === "voc") {
        openVocView();
        return;
      }

      // งานขอใช้ไฟฟ้า/งานขยายเขตฯ ใช้ "หน้ารายการเดียวกัน" กับแท็บขอใช้ไฟฟ้า/
      // ขอขยายเขตฯ ในงานรับคำร้อง ไม่ใช่หน้ารายการของตัวเองอีกชุด -- สองหน้าที่
      // แสดงข้อมูลชุดเดียวกันคนละหน้าตาคือสองหน้าที่ต้องแก้ให้ตรงกันตลอดไป และ
      // เจ้าหน้าที่ก็ต้องจำว่าอันไหนอยู่ตรงไหน ปุ่ม "งานของฉัน" กับบรรทัดคิว
      // รอสำรวจบนการ์ดคือสิ่งที่หน้าคิวเดิมมีแล้วหน้านี้ไม่มี จึงยกมาไว้ที่นี่แทน
      // (หน้ารายละเอียดของโมดูลงาน -- แท็บแผนผัง/ภาพหน้างาน/ประมาณการ -- ยังอยู่
      // เหมือนเดิม เปิดได้จากการกดการ์ดคำร้องขยายเขตฯ ใบใดก็ได้)
      if (WORK_KIND_TITLES[key]) {
        saveNavState({ card: key });
        openWorkList(key);
        return;
      }

      // งานธุรกิจเสริมมีเมนูซ้ายของตัวเอง (โบรชัวร์ / งานเสนอราคา / Google Sheet)
      // เปิดมาที่โบรชัวร์เป็นค่าเริ่มต้น ไม่ต้องผ่านการ์ดกลางอีก
      if (key === "sideBusiness") {
        saveNavState({ card: "sideBusiness", module: "brochure" });
        openBrochureView();
        return;
      }

      const service = SERVICES[key];
      if (!service) return;

      document.getElementById("serviceTopbarTitle").textContent = service.title;
      document.getElementById("serviceTitle").textContent = service.title;
      document.getElementById("serviceDesc").textContent = service.desc;
      document.getElementById("servicePlaceholderIcon").innerHTML = service.icon;

      // การ์ดที่มีลิงก์ (เช่น KPI/งานธุรกิจเสริม -- ออกไปหา Google Sheet ของแผนก)
      // โชว์รายการลิงก์แทนข้อความ "อยู่ระหว่างการพัฒนา" ซึ่งไม่จริงสำหรับการ์ด
      // พวกนี้ -- เช็คด้วยว่ามี service.links จริงไหม ไม่ใช่แค่ตรวจว่ามี key
      // เพราะการ์ดอย่าง Solar ยังไม่มีอะไรจริงให้เปิดเลย เป็น array ไว้ตั้งแต่แรก
      // เพราะบางการ์ดจะมีมากกว่าหนึ่งลิงก์ในอนาคต
      const linksEl = document.getElementById("serviceLinks");
      const noteEl = document.getElementById("serviceNote");
      linksEl.innerHTML = "";
      if (service.links && service.links.length) {
        service.links.forEach(link => {
          linksEl.appendChild(buildServiceLinkItem(link.label, link.url));
        });
        linksEl.hidden = false;
        noteEl.hidden = true;
      } else {
        linksEl.hidden = true;
        noteEl.hidden = false;
      }

      // โบรชัวร์ (ถ้ามี) -- ล้างของเดิมทิ้งก่อนเสมอ ไม่งั้นเปิดการ์ดที่ไม่มีรูป
      // ต่อจากการ์ดที่มีรูป จะยังเห็นรูปของการ์ดก่อนหน้าค้างอยู่
      const gallery = document.getElementById("serviceGallery");
      gallery.innerHTML = "";
      if (service.images && service.images.length) {
        service.images.forEach(item => {
          // ไม่มีข้อความใต้รูปโดยตั้งใจ -- ตัวโบรชัวร์เองมีหัวข้อ/เนื้อหาอยู่แล้ว
          // ชื่อไฟล์ซ้ำซ้อนกับสิ่งที่เห็นในภาพ item.alt ยังใช้ประโยชน์ (screen reader)
          const img = document.createElement("img");
          img.src = item.src;
          img.alt = item.alt || "";
          img.loading = "lazy";
          gallery.appendChild(img);
        });
        gallery.hidden = false;
      } else {
        gallery.hidden = true;
      }

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

    // เพิ่งกรอกคำร้องขยายเขตฯ ที่สร้างจากคำร้องขอใช้ไฟฟ้าเสร็จ -- พากลับไปที่ใบนั้น
    // พร้อมคืนค่าที่ค้างอยู่ในฟอร์ม เพื่อกดบันทึกการแก้ไขต่อได้ทันที
    // ใช้เส้นทางนี้ทั้งตอนกดบันทึกและตอนกดย้อนกลับโดยไม่บันทึก -- ปลายทางเดียวกัน
    if (formReturnTo === "linkedPower" && linkedReturn) {
      const back = linkedReturn;
      linkedReturn = null;

      const power = getRequests().find(r => r.id === back.powerId);
      if (power) {
        // ไม่ต้อง showView เอง -- คำร้องขอใช้ไฟฟ้าที่บันทึกแล้วเปิดในหน้างานขอใช้ไฟฟ้า
        // (openRequestForm สลับหน้าให้) และคืนปลายทางย้อนกลับเดิมของใบนั้นด้วย
        openRequestForm("power", power, { returnTo: back.returnTo });
        restoreRequestForm(back.draft);
        syncExtendLinkButton();

        requestFormError.textContent =
          "กลับมาที่คำร้องขอใช้ไฟฟ้าใบเดิมแล้ว -- กด \"บันทึกการแก้ไข\" ด้านล่างเพื่อบันทึกคำร้องใบนี้ด้วย";
        requestFormError.classList.add("is-notice");
        requestFormError.hidden = false;
        return;
      }
    }

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

  const revenuePrintBtn = document.getElementById("revenuePrintBtn");
  const revenueModes = document.getElementById("revenueModes");
  const revenueModeBtns = revenueModes.querySelectorAll(".requests-mode-btn");
  const generalPrintBtn = document.getElementById("generalPrintBtn");
  const generalModes = document.getElementById("generalModes");
  const generalModeBtns = generalModes.querySelectorAll(".requests-mode-btn");
  const requestsSearchInput = document.getElementById("requestsSearchInput");
  const requestsDateFrom = document.getElementById("requestsDateFrom");
  const requestsDateTo = document.getElementById("requestsDateTo");
  const requestsDateClearBtn = document.getElementById("requestsDateClearBtn");
  const requestsSummary = document.getElementById("requestsSummary");
  const requestsMineBtn = document.getElementById("requestsMineBtn");
  // กรองเหลือเฉพาะงานที่จ่ายให้คนที่ล็อกอินอยู่ -- ค้างไว้ระหว่างสลับแท็บไม่ได้
  // เพราะแต่ละแท็บมีชุดงานคนละชุด กดดูของตัวเองในแท็บหนึ่งแล้วไปโผล่อีกแท็บ
  // จะเห็นหน้าว่างที่ดูเหมือนไม่มีงาน (เหตุผลเดียวกับที่ setWorkKind ล้างชิป)
  let requestsMineOnly = false;

  // โหมดหน้างาน (ดูบล็อก "หน้างาน" ท้ายไฟล์) -- null = งานรับคำร้องปกติ,
  // "power" | "extend" = หน้างานขอใช้ไฟฟ้า / งานขยายเขตฯ
  let requestsWorkKind = null;
  // "list" = รายการคำร้อง, "people" = คำร้องในมือแต่ละคน (หัวหน้า)
  let requestsWorkView = "list";
  // หน้าคำร้องในมือ: null = ยังอยู่หน้ารายชื่อคน, "" = งานที่ยังไม่ได้จ่าย,
  // อีเมล = งานของคนนั้น (ตัวพิมพ์เล็ก)
  let requestsPersonKey = null;
  // id ของการ์ดที่เห็นอยู่ล่าสุด -- ให้ปุ่ม "เลือกทั้งหมด" เลือกตามที่ตาเห็น
  let lastRenderedIds = [];
  const requestsTopbarTitle = document.getElementById("requestsTopbarTitle");
  const requestsSelectAllBtn = document.getElementById("requestsSelectAllBtn");
  const requestsSelectClearBtn = document.getElementById("requestsSelectClearBtn");
  const workNavItems = document.querySelectorAll(".requests-nav-item[data-work-view]");
  const requestsSortBtn = document.getElementById("requestsSortBtn");
  const requestsSortLabel = document.getElementById("requestsSortLabel");
  const extendWorkSortBtn = document.getElementById("extendWorkSortBtn");
  const extendWorkSortLabel = document.getElementById("extendWorkSortLabel");

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

  /**
   * เหมือน isGeneralDispatch แต่ของคำร้องขอเงินประกันคืนที่รอส่ง ผบร.
   *
   * ต้องเช็ก type ด้วย ไม่ใช่ดูแต่ jobStatus -- "ส่ง ผบร." เป็นสถานะที่คำร้อง
   * ขอขยายเขตฯ มีอยู่แล้วเหมือนกัน (คนละความหมาย: ที่นั่นแปลว่าส่งต่อให้ ผบร.
   * ระหว่างทาง ไม่ใช่จบงาน) คิวนี้จึงต้องจำกัดที่ประเภท deposit เท่านั้น
   */
  function isRevenueDispatch(r) {
    return r.type === "deposit" && r.jobStatus === "รอส่ง ผบร.";
  }

  // Tabs that filter existing records instead of holding their own type --
  // they have no add form, so the "+ เพิ่มคำร้อง" button is hidden on them.
  const DERIVED_TAB_FILTERS = {
    payment: isPaymentNotice,
    meter: isMeterDispatch,
    generalDispatch: isGeneralDispatch,
    revenueDispatch: isRevenueDispatch
  };

  const navBadges = document.querySelectorAll(".nav-badge");

  // แท็บ dispatch ที่ยังอยู่ในแถบซ้ายของหน้างานรับคำร้องพร้อมป้ายนับจำนวน
  // (`.nav-badge` ที่ติด data-badge-for="<tab key>") ตัวเลขคือจำนวนคำร้องที่
  // ตัวกรองของแท็บนั้นจับได้ตอนนี้ จึงลดลงเองเมื่อเจ้าหน้าที่เดินสถานะงานต่อ
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
  /**
   * แท็บของหน้ารายการคำร้องเท่านั้น -- ต้องกรองด้วย [data-filter] ไม่ใช่ .requests-nav-item เปล่า ๆ
   *
   * แถบซ้ายของหน้ารายละเอียดขอขยายเขตฯ (#extendDetailMode) ใช้ทั้ง .requests-sidebar
   * และ .requests-nav-item คลาสเดียวกันเป๊ะ ตัวเลือกที่ไม่กรองจึงกวาดปุ่มแนบแผนผัง/
   * ภาพหน้างาน/ประมาณการ ติดมาด้วย แล้วผูก handler สลับแท็บให้มันทั้งที่ไม่มี
   * data-filter -- กดทีหนึ่ง currentRequestFilter กลายเป็น undefined ลิสต์คำร้องว่าง
   * ไฮไลต์แท็บหลุด และ setActiveNavItem ยังไปลบคลาส active ของปุ่ม pane ที่
   * showExtendPane เป็นคนคุมอยู่ด้วย
   *
   * กรองด้วย [data-filter] ตรงกับสิ่งที่ผู้ใช้ทั้งสองจุดต้องการพอดี (อ่าน
   * item.dataset.filter ทั้งคู่) จำกัดด้วย parent ไม่ได้เพราะคลาสซ้ำกันทั้งคู่
   */
  const requestsNavItems = document.querySelectorAll(".requests-nav-item[data-filter]");
  const reqDistrict = document.getElementById("reqDistrict");
  const reqSubdistrict = document.getElementById("reqSubdistrict");
  const reqZipcode = document.getElementById("reqZipcode");
  const reqPurpose = document.getElementById("reqPurpose");
  const reqPurposeOtherField = document.getElementById("reqPurposeOtherField");
  const reqPurposeOther = document.getElementById("reqPurposeOther");
  const reqDate = document.getElementById("reqDate");
  const reqJobStatus = document.getElementById("reqJobStatus");
  const reqPaidDateField = document.getElementById("reqPaidDateField");
  const reqPaidDate = document.getElementById("reqPaidDate");
  const reqMeterSentDateField = document.getElementById("reqMeterSentDateField");
  const reqMeterSentDate = document.getElementById("reqMeterSentDate");
  const reqCreateExtendBtn = document.getElementById("reqCreateExtendBtn");
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
  // ---------- ขอเงินประกันคืน ----------
  const depositForm = document.getElementById("depositForm");
  const depositFormError = document.getElementById("depositFormError");
  const depositFormSubmitBtn = document.getElementById("depositFormSubmitBtn");
  const depTrackingNumber = document.getElementById("depTrackingNumber");
  const depDate = document.getElementById("depDate");
  const depJobStatus = document.getElementById("depJobStatus");

  const genTrackingNumber = document.getElementById("genTrackingNumber");
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
  const FORM_SUPPORTED_TYPES = new Set(["power", "extend", "general", "deposit"]);

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

  /**
   * ที่หมายของการวกกลับหลังกรอกคำร้องขยายเขตฯ ที่เพิ่งสร้างจากคำร้องขอใช้ไฟฟ้าเสร็จ
   * -- { powerId, draft } โดย draft คือค่าที่ค้างอยู่ในฟอร์มขอใช้ไฟฟ้าตอนกดปุ่ม
   * (ดู snapshotRequestForm) ต้องเก็บไว้ เพราะการออกจากฟอร์มไปโมดูลอื่นแล้วเปิด
   * กลับมาใหม่จะเติมฟอร์มจากค่าที่บันทึกไว้ในชีต ของที่พิมพ์ค้างไว้จะหายหมด --
   * รวมถึง "รอขยายเขตฯ" ที่เพิ่งเลือกแต่ยังไม่ได้กดบันทึก ซึ่งเป็นตัวที่ทำให้ปุ่ม
   * โผล่มาตั้งแต่แรก ถ้าไม่คืนค่าให้ คนจะวกกลับมาเจอสถานะเดิมแล้วต้องเลือกใหม่
   */
  let linkedReturn = null;
  // true ระหว่างที่ fillRequestForm/fillExtendForm กำลังยัดค่าลงฟอร์ม -- ตัวช่วย
  // ที่ฟัง change อยู่ (เช่นค่าธรรมเนียมอัตโนมัติ) ต้องไม่ทำงานในช่วงนั้น
  let fillingForm = false;
  let currentSearchQuery = "";
  // ทิศทางเรียงของ #requestsList -- false (ดีฟอลต์) = ใหม่-เก่า, true = เก่า-ใหม่
  // เป็นค่ากลางของทั้งแอป ไม่รีเซ็ตตอนสลับแท็บ (ต่างจาก currentSearchQuery)
  // เพราะเป็นความชอบเรื่องการแสดงผล ไม่ใช่ข้อมูลเฉพาะแท็บใดแท็บหนึ่ง
  let requestsSortAscending = false;
  // ยังไม่เคยกดปุ่มเรียงเลย -- ค่าเริ่มต้นก่อนกดคือเรียงตามลำดับที่เพิ่งบันทึก
  // เข้าระบบจริง (createdAt) ใหม่สุดอยู่บนสุดเสมอ เพราะเลขที่คำร้องที่เจ้าหน้าที่
  // พิมพ์เองไม่จำเป็นต้องเรียงตามลำดับที่บันทึกจริง (ดู sortRequestsForDisplay)
  // กดปุ่มครั้งแรกแล้วจึงเปลี่ยนไปเรียงตามวันที่รับคำร้อง+เลขที่คำร้องตามที่ปุ่มบอก
  let requestsSortTouched = false;
  // ตัวกรองช่วงวันที่รับคำร้องของหน้างานรับคำร้อง -- ชุดเดียวกับของหน้างานขอใช้
  // ไฟฟ้า/งานขยายเขตฯ (extendDateFrom/extendDateTo) แต่แยกตัวแปรกันคนละหน้า
  // เก็บเป็น YYYY-MM-DD ตรงรูปแบบที่ receivedDate เก็บอยู่ เทียบแบบ string ได้
  // ตรงลำดับเวลาพอดี ว่าง = ไม่กรองด้านนั้น
  let requestsDateFromValue = "";
  let requestsDateToValue = "";
  // สถานะที่ถูกย่อไว้ในมุมมองจัดกลุ่มของหน้างานรับคำร้อง -- คีย์เป็น
  // "<แท็บ>|<สถานะ>" เพราะแต่ละแท็บมีสถานะชื่อซ้ำกันได้ จำระหว่างเปิดเว็บเท่านั้น
  const requestsCollapsed = new Set();

  // Which half of the คุมคำร้องส่งแผนกมิเตอร์ tab is showing: "pending" (the
  // requests still waiting to go out) or "history" (books already printed).
  // Resets to pending on every tab switch -- the pending list is what the tab
  // is for day to day; the history is something you go looking for.
  let meterMode = "pending";

  // เหมือน meterMode ด้านบนทุกประการ แต่ของแท็บ "คุมคำร้องส่งแผนกสนับสนุน"
  let generalMode = "pending";

  // เหมือนกันทุกประการ แต่ของแท็บ "คุมคำร้องส่งแผนกบริหารรายได้ค่าไฟฟ้า"
  let revenueMode = "pending";

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
   * บังคับให้ขึ้นทศนิยม 2 ตำแหน่งเสมอ -- STANDARD_FEES เก็บค่าไม่เท่ากัน
   * ("749" ไม่มีทศนิยม, "4012.50" มี) และคำร้องเก่าที่บันทึกไว้ก่อนกฎนี้ก็เช่นกัน
   * จัดรูปตรงนี้ที่เดียวตอนแสดงผล แทนที่จะไปไล่แก้ค่าตั้งต้นให้ครบทุกคู่
   *
   * ค่าที่แปลงเป็นตัวเลขไม่ได้ (ว่าง หรือพิมพ์ผิด) คืนค่าเดิมกลับไปเฉย ๆ ไม่เดา
   */
  function formatFeeValue(value) {
    const text = String(value == null ? "" : value).trim();
    if (!text) return "";
    const amount = Number(text.replace(/,/g, ""));
    return isFinite(amount) ? amount.toFixed(2) : text;
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
          feeEl.value = formatFeeValue(fee);
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
  let revenueSelection = new Set();

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

  function setDefaultDepositDate() {
    depDate.value = todayDateString();
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

  /**
   * ขึ้นเมื่อสถานะงานเป็น "ชำระเงินแล้ว" -- ดีฟอลต์เป็นวันนี้ให้ตอนสลับมาที่สถานะนี้
   * เท่านั้น (ไม่ทับค่าที่มีอยู่แล้ว ไม่ว่าจะเป็นค่าที่ระบบเคยใส่ให้หรือที่พิมพ์เอง
   * -- ต่างจากค่าธรรมเนียมอัตโนมัติ ช่องนี้ไม่มี data-auto ธงให้ต้องตาม เพราะ
   * เขียนทับแค่ตอนช่องยังว่างอยู่พอดี ก็ปลอดภัยพอแล้ว)
   *
   * ยังโชว์ต่อไปถ้ามีค่าอยู่แล้วแม้สถานะจะเปลี่ยนไปเป็นอย่างอื่นในภายหลัง (เช่น
   * แก้สถานะกลับไปเป็นอย่างอื่นหลังบันทึกวันที่ชำระไว้แล้ว) กันไม่ให้ค่าที่กรอก
   * ไว้หายไปจากสายตาทั้งที่ยังอยู่ในฟอร์ม -- เหมือนเงื่อนไขของ extApprovalField
   */
  function syncPaidDateField() {
    const isPaid = reqJobStatus.value === "ชำระเงินแล้ว";
    // ส่งแผนกมิเตอร์แล้ว = ขั้นถัดจากชำระเงิน -- โชว์วันที่ส่งแทน ส่วนวันที่ชำระ
    // ซ่อนไป (ค่ายังเก็บอยู่ในคำร้อง ไม่ได้ล้าง แค่ไม่ต้องเห็นแล้วในขั้นนี้)
    const isSent = reqJobStatus.value === "ส่งแผนกมิเตอร์แล้ว";
    reqPaidDateField.hidden = isSent || (!isPaid && !reqPaidDate.value);
    if (isPaid && !reqPaidDate.value) {
      reqPaidDate.value = todayDateString();
    }
    reqMeterSentDateField.hidden = !isSent;
    if (isSent && !reqMeterSentDate.value) {
      reqMeterSentDate.value = todayDateString();
    }
  }
  reqJobStatus.addEventListener("change", syncPaidDateField);

  /**
   * วันที่ส่งแผนกมิเตอร์ของคำร้อง -- ใบที่ส่งก่อนมีช่องนี้ไม่มีค่าเก็บไว้ จึงถอยไป
   * อ่านเวลาในประวัติสถานะ ("ส่งแผนกมิเตอร์แล้ว" ครั้งล่าสุด) ซึ่งเป็นเวลาที่กด
   * ยืนยันส่งจริง ดีกว่าปล่อยว่างแล้วให้ระบบเติมเป็นวันนี้ซึ่งผิดแน่ ๆ
   */
  function meterSentDateOf(r) {
    if (!r) return "";
    if (r.meterSentDate) return r.meterSentDate;
    if (r.jobStatus !== "ส่งแผนกมิเตอร์แล้ว") return "";
    const entry = (Array.isArray(r.statusHistory) ? r.statusHistory : [])
      .filter(h => h && h.status === "ส่งแผนกมิเตอร์แล้ว" && h.at)
      .pop();
    return entry ? todayDateString(new Date(Number(entry.at))) : "";
  }

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
  /**
   * อ่านเบอร์โทรศัพท์จากช่องกรอก ตรวจความถูกต้อง แล้วคืนค่าที่ตัดเหลือเฉพาะตัวเลข
   *
   * เบอร์ที่ผิดไม่ใช่แค่ข้อมูลไม่สวย -- มันคือกุญแจดอกที่สองของหน้าติดตามสถานะ
   * (track.html ค้นด้วยเลขที่คำร้อง + เบอร์โทร) ลูกค้าที่เบอร์ในระบบพิมพ์ผิดจึง
   * เปิดดูงานตัวเองไม่ได้เลย และเจ้าหน้าที่ก็โทรกลับไม่ได้ด้วย
   *
   * เก็บเฉพาะตัวเลขล้วน เพราะเบอร์เดียวกันที่พิมพ์คนละแบบ ("081-234-5678",
   * "081 234 5678") จะกลายเป็นคนละค่าเวลาค้นหรือเทียบ ฝั่งเซิร์ฟเวอร์ตัด
   * อักขระที่ไม่ใช่ตัวเลขทิ้งอยู่แล้วตอนจับคู่ (normalizePhone_) การเก็บให้ตรง
   * รูปแบบเดียวกันตั้งแต่ต้นจึงทำให้ทั้งสองฝั่งเห็นค่าเดียวกัน
   *
   * รับ 9 หลัก (เบอร์บ้าน เช่น 053123456) และ 10 หลัก (มือถือ) ที่ขึ้นต้นด้วย 0
   */
  function readPhoneField(raw, label, required) {
    const text = String(raw == null ? "" : raw).trim();

    if (!text) {
      return required ? { error: `กรุณากรอก${label}` } : { value: "" };
    }

    const digits = text.replace(/[^0-9]/g, "");

    // แยกตามหัวเบอร์ ไม่ใช่แค่นับหลัก -- ถ้ารับ "9 หรือ 10 หลัก" รวม ๆ เบอร์
    // มือถือที่พิมพ์ตกไปหนึ่งหลัก (0812345678 -> 081234567) จะกลายเป็น 9 หลัก
    // แล้วผ่านไปเงียบ ๆ ในฐานะเบอร์บ้าน ทั้งที่เป็นเบอร์ที่โทรไม่ติด
    //
    // 06/08/09 = มือถือ ต้อง 10 หลักเสมอ
    // 02-07    = เบอร์บ้าน/สำนักงาน ต้อง 9 หลักเสมอ (02 กรุงเทพฯ, 053 เชียงใหม่)
    const mobile = /^0[689][0-9]{8}$/.test(digits);
    const landline = /^0[2-7][0-9]{7}$/.test(digits);

    if (!mobile && !landline) {
      const head = digits.slice(0, 2);
      let reason;

      if (/^0[689]$/.test(head)) {
        reason = `เบอร์มือถือต้องมี 10 หลัก แต่ที่กรอกมามี ${digits.length} หลัก`;
      } else if (/^0[2-7]$/.test(head)) {
        reason = `เบอร์บ้านต้องมี 9 หลัก แต่ที่กรอกมามี ${digits.length} หลัก`;
      } else {
        reason = "ต้องขึ้นต้นด้วย 06/08/09 (มือถือ) หรือ 02-07 (เบอร์บ้าน)";
      }

      return { error: `${label}ไม่ถูกต้อง -- ${reason} (เช่น 0812345678 หรือ 053123456)` };
    }

    return { value: digits };
  }

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

  const updateDepPhoneCall = wireCallButton(
    document.getElementById("depPhone"), document.getElementById("depPhoneCallBtn"));
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

      // จำไว้ว่ากำลังรอ URL ของไฟล์ไหน -- ถ้าเปิดคำร้องใบอื่นก่อน URL มาถึง
      // ห้ามเอารูปของใบเก่าไปใส่ทับใบใหม่
      preview.dataset.path = url || "";

      if (url) {
        preview.removeAttribute("src");
        fileUrl("file", url).then(src => {
          if (preview.dataset.path !== url) return;
          if (src) preview.src = src;
          else preview.hidden = true;
        });
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

      // ภาพตัวอย่างแสดงได้เฉพาะไฟล์รูป -- Storage ไม่ทำภาพหน้าแรกของ PDF ให้
      // เหมือน Drive (และการแปลงรูปเป็นฟีเจอร์ของ Pro plan) PDF จึงเหลือแค่ลิงก์เปิดไฟล์
      const preview = document.createElement("img");
      preview.className = "plan-preview";
      preview.alt = `ตัวอย่างแผนผังไฟล์ที่ ${index + 1}`;
      preview.hidden = true;
      preview.addEventListener("error", () => { preview.hidden = true; });

      const foot = document.createElement("div");
      foot.className = "plan-item-foot";

      const link = document.createElement("a");
      link.href = "#";
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = `เปิดไฟล์ที่ ${index + 1}`;

      fileUrl("file", file.url).then(src => {
        if (!src) return;
        link.href = src;
        if (!/\.pdf($|\?)/i.test(file.url)) {
          preview.src = src;
          preview.hidden = false;
        }
      });

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

  /**
   * เรียงตามวันที่รับคำร้อง (ตัวหลัก) แล้วตัดสินด้วยเลขที่คำร้อง (ตัวรอง) เมื่อ
   * วันที่ตรงกัน -- สองฟิลด์นี้เป็นสิ่งที่เจ้าหน้าที่มองเวลาไล่หาคำร้อง ไม่ใช่
   * createdAt (เวลาบันทึกจริง ซึ่งอาจต่างจากวันที่รับคำร้องได้ถ้าพิมพ์ย้อนหลัง)
   *
   * receivedDate เป็นข้อความรูปแบบ YYYY-MM-DD อยู่แล้ว เทียบแบบ string ได้ตรง
   * ลำดับเวลาพอดี ไม่ต้อง parse เป็น Date ส่วนเลขที่คำร้องเป็นข้อความอิสระที่
   * เจ้าหน้าที่พิมพ์เอง (คนละรูปแบบกันไปตามประเภทคำร้อง) เทียบแบบ string เช่นกัน
   *
   * ค่าที่ไม่มี (ว่าง) ถือว่า "เก่าที่สุด" เสมอไม่ว่าจะเรียงทิศไหน กันไม่ให้คำร้อง
   * เก่าที่ยังไม่มีข้อมูลกระโดดไปโผล่เป็นรายการบนสุดตอนเรียงใหม่-เก่า
   */
  function compareRequestsByReceivedThenNumber(a, b) {
    const dateA = a.receivedDate || "";
    const dateB = b.receivedDate || "";
    if (dateA !== dateB) return dateA < dateB ? -1 : 1;

    const numA = String(a.requestNumber || "");
    const numB = String(b.requestNumber || "");
    if (numA !== numB) return numA < numB ? -1 : 1;

    // เสมอกันทั้งคู่ -- ใช้เวลาบันทึกตัดสินสุดท้าย กันไม่ให้ลำดับสลับไปมาระหว่าง
    // การ render แต่ละครั้งโดยไม่มีเหตุผล (การเรียงที่ไม่นิ่งทำให้ดูเหมือนบั๊ก)
    return (a.createdAt || 0) - (b.createdAt || 0);
  }

  function sortRequestsForDisplay(records) {
    // ยังไม่เคยกดปุ่มเรียง -- เรียงตามลำดับบันทึกเข้าระบบจริง ใหม่สุดขึ้นบนสุดเสมอ
    // ไม่ใช้วันที่รับคำร้อง/เลขที่คำร้อง เพราะสองค่านั้นพิมพ์เองและอาจไม่ตรงกับ
    // ลำดับที่บันทึกจริง (เช่นเลขที่คำร้องที่เพิ่งพิมพ์อาจเรียงตัวอักษรมาก่อนใบเก่า)
    if (!requestsSortTouched) {
      return records.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    const sorted = records.slice().sort(compareRequestsByReceivedThenNumber);
    if (!requestsSortAscending) sorted.reverse();
    return sorted;
  }

  /**
   * ต่อท้ายจำนวนที่เลือกไว้ลงในปุ่มพิมพ์สมุดคุม (เช่น "พิมพ์สมุดคุมส่งแผนกมิเตอร์
   * (3)") ใช้ร่วมกันทั้ง meter/general/revenue -- จำข้อความดั้งเดิมของปุ่มไว้ใน
   * data-base-label ครั้งแรกที่เรียก เพราะ .textContent จะถูกเขียนทับด้วยเลขนี้
   * เอง ให้เห็นว่าเลือกสะสมไว้กี่ใบแล้วแม้จะค้นหาคำอื่นจนใบที่เลือกไว้ไม่อยู่ใน
   * รายการที่เห็นบนจอตอนนี้ก็ตาม (เหมือนตะกร้าสินค้าเว็บขายของ -- ค้นหาต่อได้
   * เรื่อย ๆ โดยของที่เลือกไว้ก่อนหน้าไม่หาย)
   */
  function updateSelectionButtonLabel(btn, count) {
    if (btn.dataset.baseLabel === undefined) btn.dataset.baseLabel = btn.textContent;
    btn.textContent = count > 0 ? `${btn.dataset.baseLabel} (${count})` : btn.dataset.baseLabel;
  }

  /** อยู่ในช่วงวันที่รับคำร้องที่กรองไว้ไหม (หน้างานรับคำร้อง) */
  function requestsDateFilterMatches(r) {
    const d = r.receivedDate || "";
    if (requestsDateFromValue && d < requestsDateFromValue) return false;
    if (requestsDateToValue && d > requestsDateToValue) return false;
    return true;
  }

  /**
   * ตัวเลือกสถานะของคำร้องแต่ละประเภท อ่านจาก <select> ของฟอร์มโดยตรง ไม่ประกาศ
   * ซ้ำ -- เหตุผลเดียวกับ extendStatuses(): เพิ่มสถานะในฟอร์มแล้วไม่ต้องมาเพิ่ม
   * ในลิสต์ที่นี่อีกที ไม่งั้นวันหนึ่งมันจะไม่ตรงกันแล้วมีกลุ่มที่ไม่มีวันโผล่
   */
  const REQUEST_STATUS_SELECT_ID = {
    power: "reqJobStatus",
    extend: "extJobStatus",
    general: "genJobStatus",
    deposit: "depJobStatus"
  };

  function requestStatusesFor(type) {
    const select = document.getElementById(REQUEST_STATUS_SELECT_ID[type] || "");
    if (!select) return [];
    return Array.from(select.options).map(o => o.value).filter(Boolean);
  }

  /**
   * สถานะแต่ละตัวนับเป็น "กำลังดำเนินการ" หรือ "ดำเนินการแล้ว" -- ตามที่เจ้าของงาน
   * กำหนดไว้ตรงตัว ใช้ทั้งแท็บในงานรับคำร้องและหน้างานของประเภทเดียวกัน
   *
   * Input      = คำร้องที่รับเข้ามา (นับตามวันที่รับคำร้องในช่วงที่เลือก)
   * Inprogress = ใน Input ที่สถานะยังอยู่ในชุด inprogress
   * Output     = ใน Input ที่สถานะอยู่ในชุด output
   * สองชุดครอบคลุมทุกสถานะในดรอปดาวน์พอดี Input จึงเท่ากับ Inprogress + Output
   * เว้นแต่มีใบเก่าที่สถานะไม่อยู่ในดรอปดาวน์ -- กรณีนั้นบอกไว้ในกล่องด้วย
   */
  const STATUS_BUCKETS = {
    power: {
      inprogress: ["รอตรวจสอบ", "รอเอกสารเพิ่มเติม", "รอแก้ไข", "รอขยายเขตฯ", "ผมต. ตีกลับ"],
      output: ["รอชำระเงิน", "ชำระเงินแล้ว", "ไม่มีค่าใช้จ่าย", "ส่งแผนกมิเตอร์แล้ว", "ยกเลิกคำร้อง", "จัดเก็บเอกสาร (ผบส.)"]
    },
    extend: {
      inprogress: ["รอจ่ายงาน", "รอสำรวจ", "รอเขียนผัง", "รอประมาณการ", "ส่งตรวจแผนผังและประมาณการ",
        "เสนออนุมัติ", "รอเอกสารเพิ่มเติม", "อื่นๆ (หมายเหตุเพิ่มเติม)"],
      output: ["อนุมัติและแจ้งค่าใช้จ่ายแล้ว", "ส่ง ผบร.", "ส่ง ผปบ.", "ส่ง ผกส.",
        "ส่งหนังสือแจ้ง ทต./อบต. แล้ว", "หมดกำหนดยืนราคา", "ยกเลิกคำร้อง"]
    }
  };

  /**
   * กล่องสรุปเหนือรายการ: จำนวนคำร้องแยกตามสถานะ (กดแล้วกระโดดไปกลุ่มนั้น) และ
   * สำหรับขอใช้ไฟฟ้า/ขอขยายเขตฯ มีแถว Input / Inprogress / Output ของช่วงที่
   * เลือกด้วย -- ไม่เลือกช่วง = นับทั้งหมดที่แสดงอยู่
   */
  function renderRequestsSummary(statusCountSource) {
    const statuses = requestStatusesFor(currentRequestFilter);
    const hasRange = Boolean(requestsDateFromValue || requestsDateToValue);
    requestsSummary.innerHTML = "";
    requestsSummary.hidden = !statuses.length;
    if (!statuses.length) return;

    const extras = statusCountSource.map(r => r.jobStatus).filter(st => st && statuses.indexOf(st) === -1);
    const shown = statuses.concat(Array.from(new Set(extras)));

    const counts = document.createElement("div");
    counts.className = "requests-summary-counts";
    shown.forEach(status => {
      const count = statusCountSource.filter(r => r.jobStatus === status).length;
      // เป็นปุ่มจริง ไม่ใช่ป้ายเฉย ๆ -- กดแล้วกระโดดไปกลุ่มสถานะนั้นในรายการ
      // ข้างล่าง (คลี่กลุ่มให้ด้วยถ้าย่อไว้) เพราะกล่องสรุปคือที่ที่คนมองหา
      // "สถานะนี้มีกี่ใบ" ก่อน แล้วอยากเห็นทั้งกองทันที ไม่ใช่ต้องไถหาเอง
      const item = document.createElement("button");
      item.type = "button";
      item.className = `requests-summary-item tone-${JOB_STATUS_TONE[status] || "info"}`;
      if (!count) item.classList.add("is-empty");
      const label = document.createElement("span");
      label.textContent = status;
      const value = document.createElement("strong");
      value.textContent = String(count);
      item.append(label, value);
      item.addEventListener("click", () => jumpToStatusGroup(status));
      counts.appendChild(item);
    });
    requestsSummary.appendChild(counts);

    const buckets = STATUS_BUCKETS[currentRequestFilter];
    if (!buckets) return;

    const input = statusCountSource.length;
    const inprogress = statusCountSource.filter(r => buckets.inprogress.indexOf(r.jobStatus) !== -1).length;
    const output = statusCountSource.filter(r => buckets.output.indexOf(r.jobStatus) !== -1).length;
    const unclassified = input - inprogress - output;

    const io = document.createElement("div");
    io.className = "requests-summary-io";

    [
      { label: "Input (รับเข้า)", value: input, tone: "" },
      { label: "Inprogress (กำลังดำเนินการ)", value: inprogress, tone: "tone-warning" },
      { label: "Output (ดำเนินการแล้ว)", value: output, tone: "tone-success" }
    ].forEach(entry => {
      const el = document.createElement("span");
      el.className = `requests-summary-io-item ${entry.tone}`.trim();
      const label = document.createElement("span");
      label.textContent = entry.label;
      const value = document.createElement("strong");
      value.textContent = String(entry.value);
      el.append(label, value);
      io.appendChild(el);
    });

    const rangeEl = document.createElement("span");
    rangeEl.className = "requests-summary-range";
    rangeEl.textContent = hasRange
      ? `รับคำร้องช่วง ${requestsDateFromValue ? formatThaiDate(requestsDateFromValue) : "เริ่มแรก"}`
        + ` – ${requestsDateToValue ? formatThaiDate(requestsDateToValue) : "ปัจจุบัน"}`
      : "ทุกช่วงเวลา (เลือกช่วงวันที่รับคำร้องด้านบนเพื่อดูรายช่วง)";
    if (unclassified > 0) rangeEl.textContent += ` · สถานะอื่น ${unclassified} ใบ`;
    io.appendChild(rangeEl);

    requestsSummary.appendChild(io);
  }

  /**
   * กระโดดไปกลุ่มสถานะหนึ่งในรายการคำร้อง -- เรียกจากปุ่มในกล่องสรุป
   *
   * กลุ่มที่ย่อไว้ต้องคลี่ก่อน ไม่งั้นกดแล้วเลื่อนไปเจอหัวข้อเปล่า ๆ ซึ่งดูเหมือน
   * ปุ่มเสีย และกลุ่มที่ไม่มีคำร้องเลยจะไม่ถูกวาด (ดู renderRequestCardsInto)
   * จึงต้องเผื่อกรณีหาไม่เจอไว้ด้วย -- กะพริบกล่องสรุปเฉย ๆ ดีกว่าเงียบ
   */
  function jumpToStatusGroup(status) {
    const section = requestsList.querySelector(`[data-status-group="${cssEscape(status)}"]`);
    if (!section) return;

    const collapseKey = `${currentRequestFilter}|${status}`;
    if (requestsCollapsed.has(collapseKey)) {
      requestsCollapsed.delete(collapseKey);
      section.classList.remove("is-collapsed");
      const body = section.querySelector(".status-group-body");
      if (body) body.hidden = false;
    }

    section.scrollIntoView({ behavior: "smooth", block: "start" });
    section.classList.add("is-jumped");
    setTimeout(() => section.classList.remove("is-jumped"), 1600);
  }

  /**
   * หนีอักขระให้ใช้ใน querySelector ได้ -- ชื่อสถานะเป็นภาษาไทยล้วนก็จริง แต่มี
   * วงเล็บ/จุด ("จัดเก็บเอกสาร (ผบส.)", "ผมต. ตีกลับ") ซึ่งเป็นอักขระพิเศษของ
   * ตัวเลือก CSS ถ้าไม่หนีจะโยน SyntaxError ทั้งฟังก์ชัน
   */
  function cssEscape(value) {
    if (window.CSS && typeof CSS.escape === "function") return CSS.escape(value);
    return String(value).replace(/["\\\]\[().#:>+~*^$|]/g, "\\$&");
  }

  /** ผ่านทุกใบเมื่อไม่ได้เปิด "งานของฉัน" ไว้ -- ตัวกรองนี้เป็นตัวเลือก ไม่ใช่มุมมอง */
  function assignedToMeMatches(record) {
    if (!requestsMineOnly) return true;
    const email = String(getSession()?.email || "").toLowerCase();
    return Boolean(email) && String(record.assigneeEmail || "").toLowerCase() === email;
  }

  requestsMineBtn.addEventListener("click", () => {
    requestsMineOnly = !requestsMineOnly;
    renderRequestsList();
  });

  /**
   * คิวรอสำรวจของใบนี้ -- "ลำดับที่เท่าไรในกองของผู้รับผิดชอบคนนั้น"
   *
   * นับเฉพาะงานที่ยังอยู่สถานะ "รอสำรวจ" ของคนเดียวกัน เรียงจากวันที่รับคำร้อง
   * เก่าไปใหม่ (มาก่อนได้ก่อน) -- นิยามเดียวกับหน้าคิวรอสำรวจในโมดูลงาน ไม่ใช่
   * คนละเกณฑ์ ไม่งั้นการ์ดกับหน้าคิวจะบอกลำดับไม่ตรงกันซึ่งแย่กว่าไม่บอกเลย
   * คืน null เมื่อใบนี้ไม่ได้อยู่ในคิว (สถานะอื่น) เพื่อให้ผู้เรียกข้ามไปได้
   */
  function surveyQueuePosition(record) {
    if (!record || record.jobStatus !== "รอสำรวจ") return null;
    const owner = String(record.assigneeEmail || "").toLowerCase();
    const queue = getRequests()
      .filter(r => r.type === record.type
        && r.jobStatus === "รอสำรวจ"
        && String(r.assigneeEmail || "").toLowerCase() === owner)
      .sort((a, b) => String(a.receivedDate || "").localeCompare(String(b.receivedDate || "")));
    const index = queue.findIndex(r => r.id === record.id);
    if (index === -1) return null;
    return { position: index + 1, total: queue.length, assigned: Boolean(owner) };
  }

  /** ข้อความคิวสั้น ๆ ที่ใช้ได้ทั้งบนการ์ดและในการ์ดสรุป */
  function surveyQueueText(record) {
    const queue = surveyQueuePosition(record);
    if (!queue) return "";
    // คิวแรกคือ "ถึงคิวแล้ว" ส่วนคิวถัดไปบอกว่ายังต้องรออีกกี่คิว -- เป็นคำตอบ
    // ตรง ๆ ของคำถามที่ลูกค้าโทรมาถาม ลำดับเต็มอยู่ในวงเล็บให้เจ้าหน้าที่อ้างอิง
    const owner = queue.assigned ? `ของ ${record.assignee || "ผู้รับผิดชอบ"}` : "(ยังไม่ได้จ่ายงาน)";
    const detail = `(ลำดับที่ ${queue.position} จาก ${queue.total} งาน ${owner})`;
    const headline = queue.position === 1 ? "คิวปัจจุบัน" : `รออีก ${queue.position - 1} คิว`;
    return `คิวรอสำรวจ: ${headline} ${detail}`;
  }

  function renderRequestsList() {
    requestsFormMode.hidden = true;
    requestsListMode.hidden = false;
    // Returning from the (often long) form scrolled partway down should
    // land back at the top of the list, not wherever the form happened to
    // be scrolled to.
    window.scrollTo(0, 0);
    updateTabBadges();
    applyRequestsMode();

    // ปุ่มเลือกทั้งหมด/ล้างค่า ซ่อนก่อนเสมอ -- โหมดประวัติการส่งออกจากฟังก์ชันนี้
    // กลางทาง และไม่มีอะไรให้เลือกในโหมดนั้น (ด้านล่างเปิดคืนเมื่อมีตะกร้าจริง)
    requestsSelectAllBtn.hidden = true;
    requestsSelectClearBtn.hidden = true;

    // derived tab ทั้งสี่ (แจ้งเตือนการรับชำระเงิน/คุมคำร้องมิเตอร์/คุมคำร้องทั่วไป/
    // คุมคำร้องขอรับเงินประกันคืน) คือการกรองคำร้องที่มีอยู่แล้วด้วยสถานะ
    const derivedFilter = DERIVED_TAB_FILTERS[currentRequestFilter];
    // ทั้งแท็บ ไม่กรองด้วยคำค้น -- ใช้ตัดสินว่า id ที่เลือกไว้ (ตะกร้าเช็คบ็อก)
    // ยังอยู่ในแท็บนี้ไหม แยกจาก filtered ด้านล่างซึ่งกรองด้วยคำค้นด้วย เพื่อไม่ให้
    // ค้นหาคำอื่นแล้วเลือกที่หน้าจอไม่เห็นชั่วคราวถูกตัดออกจากตะกร้าไปเงียบ ๆ
    //
    // หน้าคำร้องในมือของหัวหน้า: เลือกคนแล้ว = เหลือเฉพาะงานของคนนั้น
    const personFilter = (requestsWorkKind && requestsWorkView === "people" && requestsPersonKey !== null)
      ? (r => String(r.assigneeEmail || "").toLowerCase() === requestsPersonKey)
      : (() => true);
    const eligibleForTab = getRequests()
      .filter(derivedFilter || (r => r.type === currentRequestFilter))
      .filter(personFilter);

    // หน้ารายชื่อคนของหัวหน้า (ยังไม่ได้เลือกคน) -- ไม่ใช่รายการคำร้อง วาดการ์ด
    // รายคนแทน แล้วออกเลย ไม่มีกล่องสรุป/ค้นหาให้กรองรายชื่อ
    if (requestsWorkKind && requestsWorkView === "people" && requestsPersonKey === null) {
      renderRequestsPeople(eligibleForTab.filter(requestsDateFilterMatches));
      return;
    }

    // ปุ่ม "งานของฉัน" มีเฉพาะหน้างาน (ขอใช้ไฟฟ้า/ขยายเขตฯ) ที่จ่ายงานได้จริง --
    // หน้ารับคำร้องไม่มีใครถูกจ่ายงานให้ ปุ่มจะกรองเหลือศูนย์ตลอด
    const mineAvailable = Boolean(requestsWorkKind && WORK_KIND_ASSIGNABLE[currentRequestFilter])
      && requestsWorkView === "list";
    if (!mineAvailable && requestsMineOnly) requestsMineOnly = false;
    requestsMineBtn.hidden = !mineAvailable;
    requestsMineBtn.classList.toggle("active", requestsMineOnly);
    requestsMineBtn.setAttribute("aria-pressed", String(requestsMineOnly));

    const filtered = sortRequestsForDisplay(
      eligibleForTab
        .filter(requestsDateFilterMatches)
        .filter(assignedToMeMatches)
        .filter(r => matchesSearch(r, currentSearchQuery))
    );

    requestsListTitle.textContent = requestsListHeading();
    requestsListCount.textContent = `ทั้งหมด ${filtered.length} รายการ`;
    // "เลือกทั้งหมด" เลือกเฉพาะที่เห็นอยู่บนจอตอนนี้ -- จำไว้ให้ปุ่มใช้
    lastRenderedIds = filtered.map(r => r.id);
    requestsAddBtn.hidden = Boolean(derivedFilter);
    // เพิ่มหลายคำร้องมีเฉพาะขอใช้ไฟฟ้า
    requestsAddBatchBtn.hidden = Boolean(derivedFilter) || currentRequestFilter !== "power";

    const isMeterTab = currentRequestFilter === "meter";
    meterModes.hidden = !isMeterTab;

    if (isMeterTab && meterMode === "history") {
      renderDispatchHistory();
      return;
    }

    meterPrintBtn.hidden = !isMeterTab;
    if (isMeterTab) {
      // คำร้องหลุดจากแท็บนี้ได้ทางเดียวคือมีคนเปลี่ยนสถานะที่อื่น -- ตัดเฉพาะ id
      // ที่ไม่เข้าเงื่อนไขแท็บแล้วจริง ๆ (ไม่เกี่ยวกับช่องค้นหา) เหมือนตะกร้าสินค้า
      // ที่ของไม่หายเวลาพิมพ์ค้นหาคำอื่น
      const eligibleIds = new Set(eligibleForTab.map(r => r.id));
      meterSelection.forEach(id => { if (!eligibleIds.has(id)) meterSelection.delete(id); });
      meterPrintBtn.disabled = meterSelection.size === 0;
      updateSelectionButtonLabel(meterPrintBtn, meterSelection.size);
    }

    const isGeneralTab = currentRequestFilter === "generalDispatch";
    generalModes.hidden = !isGeneralTab;

    if (isGeneralTab && generalMode === "history") {
      renderGeneralDispatchHistory();
      return;
    }

    generalPrintBtn.hidden = !isGeneralTab;
    if (isGeneralTab) {
      // คำร้องหลุดจากแท็บนี้ได้ทางเดียวคือมีคนเปลี่ยนสถานะที่อื่น -- ตัดเฉพาะ id
      // ที่ไม่เข้าเงื่อนไขแท็บแล้วจริง ๆ (ไม่เกี่ยวกับช่องค้นหา) เหมือนตะกร้าสินค้า
      // ที่ของไม่หายเวลาพิมพ์ค้นหาคำอื่น
      const eligibleIds = new Set(eligibleForTab.map(r => r.id));
      generalSelection.forEach(id => { if (!eligibleIds.has(id)) generalSelection.delete(id); });
      generalPrintBtn.disabled = generalSelection.size === 0;
      updateSelectionButtonLabel(generalPrintBtn, generalSelection.size);
    }

    // เหมือน isGeneralTab ข้างบนทุกประการ แต่ของแท็บคุมคำร้องส่ง ผบร.
    const isRevenueTab = currentRequestFilter === "revenueDispatch";
    revenueModes.hidden = !isRevenueTab;

    if (isRevenueTab && revenueMode === "history") {
      renderRevenueDispatchHistory();
      return;
    }

    revenuePrintBtn.hidden = !isRevenueTab;
    if (isRevenueTab) {
      const eligibleIds = new Set(eligibleForTab.map(r => r.id));
      revenueSelection.forEach(id => { if (!eligibleIds.has(id)) revenueSelection.delete(id); });
      revenuePrintBtn.disabled = revenueSelection.size === 0;
      updateSelectionButtonLabel(revenuePrintBtn, revenueSelection.size);
    }

    // จัดกลุ่มตามสถานะ + กล่องสรุปจำนวน เฉพาะแท็บประเภทคำร้องจริง -- แท็บคุมส่ง
    // แผนกเป็นคิวสถานะเดียวอยู่แล้ว หัวกลุ่มก้อนเดียวไม่ช่วยอะไร และมี checkbox
    // เลือกหลายใบซึ่งอ่านง่ายกว่าเมื่อเป็นรายการเรียบ
    const groupByStatus = !derivedFilter;
    if (groupByStatus) {
      renderRequestsSummary(filtered);
    } else {
      requestsSummary.hidden = true;
      requestsSummary.innerHTML = "";
    }

    // หัวหน้าในหน้างาน: ติ๊กการ์ดเพื่อจ่ายงาน (ตะกร้าเดียวกับหน้าคิวงานเดิม
    // extendSelection) -- ตัดเฉพาะ id ที่ไม่อยู่ในหน้านี้แล้วจริง ๆ ไม่ใช่ที่แค่
    // ถูกซ่อนด้วยคำค้น เหมือนตะกร้าของสมุดคุม
    const isAssignTab = Boolean(requestsWorkKind) && canAssignWork();
    if (isAssignTab) {
      const eligibleIds = new Set(eligibleForTab.map(r => r.id));
      extendSelection.forEach(id => { if (!eligibleIds.has(id)) extendSelection.delete(id); });
    } else if (requestsWorkKind) {
      extendSelection.clear();
    }
    if (requestsWorkKind) renderAssignBar();

    const selection = activeRequestsSelection();
    requestsSelectAllBtn.hidden = !selection;
    requestsSelectClearBtn.hidden = !selection;
    if (selection) requestsSelectClearBtn.disabled = selection.size === 0;

    renderRequestCardsInto(requestsList, filtered, {
      isMeterTab, isGeneralTab, isRevenueTab, isAssignTab, groupByStatus,
      searchQuery: currentSearchQuery,
      onArchiveMerged: renderRequestsList
    });
  }

  /**
   * วาดการ์ดคำร้องหนึ่งชุดลงในคอนเทนเนอร์ที่ระบุ -- แท็บประเภทคำร้องจัดกลุ่มตาม
   * สถานะ (groupByStatus) ส่วนแท็บคุมคำร้องทั้งสามเป็นรายการเรียบที่มี checkbox
   * เลือกหลายใบเพื่อพิมพ์สมุดคุม
   */
  function renderRequestCardsInto(listEl, filtered, {
    isMeterTab = false, isGeneralTab = false, isRevenueTab = false, isAssignTab = false,
    searchQuery = "", onArchiveMerged = renderRequestsList, groupByStatus = false
  } = {}) {
    listEl.innerHTML = "";

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = "ยังไม่มีข้อมูลคำร้อง";
      listEl.appendChild(empty);

      // loadRequests() only brings back open/recent requests (see
      // loadRequestsForStaff_ in Code.gs) -- an empty result while searching
      // doesn't rule out an older, already-closed record, so offer to check
      // the full history on the server instead of silently saying "not found".
      if (searchQuery && backend === supabaseBackend) {
        const archiveBtn = document.createElement("button");
        archiveBtn.type = "button";
        archiveBtn.className = "btn btn-ghost request-archive-search-btn";
        archiveBtn.textContent = `ค้นหา "${searchQuery}" ในคำร้องเก่าที่จัดเก็บแล้ว`;
        archiveBtn.addEventListener("click", () => searchArchivedAndMerge(searchQuery, archiveBtn, onArchiveMerged));
        listEl.appendChild(archiveBtn);
      }
      return;
    }

    // จัดกลุ่มตามสถานะ ย่อ/ขยายได้ -- เรียงกลุ่มตามลำดับขั้นตอนงาน (ลำดับเดียว
    // กับดรอปดาวน์สถานะ) ไม่ใช่ตามจำนวน เพราะคนอ่านกำลังไล่ว่างานอยู่ขั้นไหนแล้ว
    // กลุ่มที่ไม่มีคำร้องเลยไม่ต้องวาด สถานะแปลก ๆ ที่ไม่อยู่ในดรอปดาวน์ (ข้อมูล
    // เก่า) ต่อท้ายไว้ ดีกว่าปล่อยให้หายไปจากหน้าจอเงียบ ๆ
    const groupBodies = new Map();
    if (groupByStatus) {
      const order = requestStatusesFor(currentRequestFilter);
      const extras = filtered.map(r => r.jobStatus).filter(st => st && order.indexOf(st) === -1);
      const hasBlank = filtered.some(r => !r.jobStatus);
      const statuses = order.concat(Array.from(new Set(extras))).concat(hasBlank ? [""] : []);

      statuses.forEach(status => {
        const count = filtered.filter(r => (r.jobStatus || "") === status).length;
        if (!count) return;

        const section = document.createElement("section");
        section.className = "status-group";
        section.dataset.statusGroup = status;

        const head = document.createElement("button");
        head.type = "button";
        head.className = "status-group-head";

        const caret = document.createElement("span");
        caret.className = "status-group-caret";

        const badge = document.createElement("span");
        badge.className = `request-badge request-badge-status tone-${JOB_STATUS_TONE[status] || "info"}`;
        badge.textContent = status || "ไม่ระบุสถานะ";

        const countEl = document.createElement("span");
        countEl.className = "status-group-count";
        countEl.textContent = `${count} คำร้อง`;

        head.append(caret, badge, countEl);

        const body = document.createElement("div");
        body.className = "status-group-body";

        // จำการย่อแยกตามแท็บ -- คนละแท็บมีสถานะชื่อซ้ำกันได้ ย่อกลุ่มในแท็บหนึ่ง
        // ไม่ควรไปย่อในอีกแท็บด้วย
        const collapseKey = `${currentRequestFilter}|${status}`;
        const collapsed = requestsCollapsed.has(collapseKey);
        section.classList.toggle("is-collapsed", collapsed);
        body.hidden = collapsed;

        head.addEventListener("click", () => {
          const nowCollapsed = !requestsCollapsed.has(collapseKey);
          if (nowCollapsed) requestsCollapsed.add(collapseKey);
          else requestsCollapsed.delete(collapseKey);
          section.classList.toggle("is-collapsed", nowCollapsed);
          body.hidden = nowCollapsed;
        });

        section.append(head, body);
        listEl.appendChild(section);
        groupBodies.set(status, body);
      });
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

      // ป้ายบอกว่าใบนี้มีคำร้องอีกใบผูกอยู่ -- ต้องเห็นตั้งแต่ในลิสต์ ไม่ใช่ต้อง
      // เปิดเข้าไปดูก่อนถึงจะรู้ว่างานนี้ยังมีอีกครึ่งหนึ่งรออยู่อีกประเภทหนึ่ง
      if (r.linkedRequestId) {
        const linkEl = document.createElement("span");
        linkEl.className = "request-badge tone-info";
        linkEl.textContent = r.type === "extend" ? "มีงานขอใช้ไฟฟ้า" : "มีงานขยายเขตฯ";
        card.querySelector(".request-badges").appendChild(linkEl);
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

      // คิวรอสำรวจบนการ์ด -- คนที่ถือใบนี้อยู่ต้องตอบลูกค้าได้ว่า "อีกกี่คิว"
      // โดยไม่ต้องเปิดหน้าคิวแยก ขึ้นเฉพาะใบที่อยู่สถานะรอสำรวจจริง
      const queueText = surveyQueueText(r);
      if (queueText) {
        const queueEl = document.createElement("div");
        queueEl.className = "request-meta request-meta-queue";
        queueEl.textContent = queueText;
        card.querySelector(".request-meta-note").before(queueEl);
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
          updateSelectionButtonLabel(meterPrintBtn, meterSelection.size);
          requestsSelectClearBtn.disabled = meterSelection.size === 0;
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
          updateSelectionButtonLabel(generalPrintBtn, generalSelection.size);
          requestsSelectClearBtn.disabled = generalSelection.size === 0;
        });
        selectWrap.appendChild(checkbox);
        card.appendChild(selectWrap);
      }

      // หัวหน้าเลือกงานเพื่อจ่ายงาน (หน้างานขอใช้ไฟฟ้า/ขยายเขตฯ) -- กลไกเดียวกับ
      // ตะกร้าของสมุดคุม แต่ใช้แถบจ่ายงาน (#extendAssignBar) แทนปุ่มพิมพ์
      if (isAssignTab) {
        card.classList.add("has-card-select");
        const selectWrap = document.createElement("label");
        selectWrap.className = "request-card-select";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = extendSelection.has(r.id);
        checkbox.setAttribute("aria-label", `เลือกคำร้อง ${r.requestNumber || r.customerName || ""} เพื่อจ่ายงาน`);
        checkbox.addEventListener("click", (e) => e.stopPropagation());
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) extendSelection.add(r.id);
          else extendSelection.delete(r.id);
          renderAssignBar();
          requestsSelectClearBtn.disabled = extendSelection.size === 0;
        });
        selectWrap.appendChild(checkbox);
        card.appendChild(selectWrap);
      }

      // เหมือน checkbox ของแท็บ generalDispatch ด้านบนทุกกลไก
      if (isRevenueTab) {
        card.classList.add("has-card-select");
        const selectWrap = document.createElement("label");
        selectWrap.className = "request-card-select";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = revenueSelection.has(r.id);
        checkbox.setAttribute("aria-label", `เลือกคำร้อง ${r.requestNumber || r.customerName || ""} เพื่อส่ง ผบร.`);
        checkbox.addEventListener("click", (e) => {
          e.stopPropagation();
        });
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) revenueSelection.add(r.id);
          else revenueSelection.delete(r.id);
          revenuePrintBtn.disabled = revenueSelection.size === 0;
          updateSelectionButtonLabel(revenuePrintBtn, revenueSelection.size);
          requestsSelectClearBtn.disabled = revenueSelection.size === 0;
        });
        selectWrap.appendChild(checkbox);
        card.appendChild(selectWrap);
      }

      // Bottom-right corner buttons -- QR whenever there's a tracking number
      // to hand the customer (i.e. every power-type record), print whenever
      // a slip has already been attached. Collected into one wrapper so two
      // buttons don't have to fight over the same absolute position.
      const cardActions = [];

      if (r.trackingNumber && r.type !== "general") {
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

      const groupBody = groupBodies.get(r.jobStatus || "");
      (groupBody || listEl).appendChild(card);
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

  /** เหมือน renderDispatchInfo ด้านบน แต่ของสมุดคุมส่ง ผบร. */
  function renderRevenueDispatchInfo(record) {
    const line = document.getElementById("requestFormRevenueDispatchInfo");
    const dispatch = getRevenueDispatches().find(d =>
      Array.isArray(d.rows) && d.rows.some(row => row.requestId === record.id)
    );

    line.innerHTML = "";
    line.hidden = !dispatch;
    if (!dispatch) return;

    line.append(`ส่ง ผบร.: ${formatThaiDateTime(dispatch.printedAt)} · `);
    const link = document.createElement("button");
    link.type = "button";
    link.className = "link-btn";
    link.textContent = "ดูสมุดคุม";
    link.addEventListener("click", () => openRevenueDispatchReprint(dispatch));
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

  /** สถานะตั้งต้นของคำร้องขยายเขตฯ -- ตรงกับตัวเลือกแรกของ #extJobStatus */
  const EXTEND_DEFAULT_STATUS = "รอจ่ายงาน";

  /** คำร้องอีกใบที่ผูกกันอยู่ หรือ null ถ้าไม่มี/ไม่ได้ถูกโหลดมา */
  function linkedRequestOf(record) {
    if (!record || !record.linkedRequestId) return null;
    return getRequests().find(r => r.id === record.linkedRequestId) || null;
  }

  /** ป้ายเรียกคำร้องหนึ่งใบแบบสั้น ๆ ให้คนอ่านรู้ว่าหมายถึงใบไหน */
  function requestLabel(record) {
    return [REQUEST_TYPES[record.type], record.requestNumber || record.trackingNumber]
      .filter(Boolean).join(" เลขที่ ");
  }

  /**
   * บรรทัด "คำร้องที่เกี่ยวข้อง" ในแผงประวัติ -- ขึ้นทั้งสองฝั่งด้วยโค้ดชุดเดียว
   *
   * ตอนไปสำรวจจุดติดตั้งมิเตอร์แล้วพบว่าต้องขยายเขตระบบจำหน่ายก่อน งานจะแตกเป็น
   * สองคำร้องคนละประเภทที่เดินคนละสาย (คนละฟอร์ม คนละชุดสถานะ คนละโมดูล) แต่เป็น
   * เรื่องเดียวกันของลูกค้ารายเดียวกัน -- เปิดใบไหนขึ้นมาก็ต้องเห็นอีกใบทันที
   * ไม่ใช่ต้องจำเอาเองหรือไปค้นด้วยชื่อลูกค้า
   */
  function renderLinkedRequestInfo(record) {
    const line = document.getElementById("requestFormLinkedInfo");
    line.innerHTML = "";
    line.hidden = !(record && record.linkedRequestId);
    if (line.hidden) return;

    const other = linkedRequestOf(record);

    // คำร้องที่เชื่อมอยู่อาจไม่ได้ถูกโหลดมา เพราะ loadRequests ตัดใบเก่าที่ปิดงาน
    // แล้วออก -- บอกตามตรงว่ามีอยู่แต่ยังไม่ได้โหลด ดีกว่าเงียบไปเฉย ๆ
    if (!other) {
      line.textContent = "คำร้องที่เกี่ยวข้อง: มีอยู่ แต่ยังไม่ได้โหลดมาในรอบนี้ (ค้นด้วยชื่อลูกค้าได้)";
      return;
    }

    line.append(`คำร้องที่เกี่ยวข้อง: ${requestLabel(other)} · `);
    const link = document.createElement("button");
    link.type = "button";
    link.className = "link-btn";
    link.textContent = "เปิดคำร้องนี้";
    link.addEventListener("click", () => openLinkedRequest(other));
    line.appendChild(link);
  }

  /**
   * ข้ามไปเปิดคำร้องอีกใบที่ผูกกันอยู่ -- ข้าม "โมดูล" ไม่ใช่แค่ข้ามคำร้อง
   *
   * ขอขยายเขตฯ ทำงานอยู่ในหน้า extendWork ส่วนขอใช้ไฟฟ้าอยู่ในหน้า requests
   * openRequestForm เปิดฟอร์มให้ก็จริง แต่มันสั่ง showView ให้เฉพาะฝั่งขยายเขตฯ
   * เท่านั้น -- เรียกตรง ๆ จากในหน้าขยายเขตฯ ฟอร์มขอใช้ไฟฟ้าจึงถูกเปิดอยู่ใน
   * section ที่ยังซ่อนอยู่ กดแล้วเหมือนไม่มีอะไรเกิดขึ้น
   *
   * กับดักเดียวกับที่ leaveRequestForm ต้องเรียก showView("requests") เอง --
   * อะไรก็ตามที่พาผู้ใช้ออกจากโมดูลขยายเขตฯ ต้องปิดหน้ารายละเอียดของโมดูลนั้น
   * และสลับ view ด้วยตัวเอง
   */
  function openLinkedRequest(record) {
    // ทั้งสองประเภทเปิดในหน้าคิวงานแล้ว openRequestForm สลับหน้าให้เอง
    // ส่งปลายทางย้อนกลับเดิมต่อไปด้วย ไม่งั้นกดย้อนกลับจะเด้งไปหน้ารับคำร้อง
    openRequestForm(record.type, record, { returnTo: formReturnTo });
  }

  /** ค่าทุกช่องในฟอร์มขอใช้ไฟฟ้าตอนนี้ -- ใช้คู่กับ restoreRequestForm */
  function snapshotRequestForm() {
    const values = {};
    requestForm.querySelectorAll("input[id], select[id], textarea[id]")
      .forEach(el => { values[el.id] = el.value; });
    return values;
  }

  /**
   * คืนค่าที่เก็บไว้กลับเข้าฟอร์มขอใช้ไฟฟ้า
   *
   * ลำดับสำคัญ ไม่ใช่แค่ไล่เซ็ตตามลำดับใน DOM: ในหน้าจอ "ตำบล" อยู่ก่อน "อำเภอ"
   * แต่ตัวเลือกของตำบลถูกสร้างจาก change ของอำเภอ -- เซ็ตตำบลก่อนจึงล้มเงียบ ๆ
   * เพราะ option นั้นยังไม่มีอยู่ (กับดักเดียวกับที่ BATCH_ROW_FIELDS ต้องเรียง
   * อำเภอ -> ตำบล -> รหัสไปรษณีย์) ความประสงค์ก็ต้องยิง change เองเหมือนกัน เพื่อ
   * เปิด/ปิดช่อง "อื่นๆ" ให้ตรงกับค่าที่คืนกลับมา
   *
   * ตั้ง fillingForm ระหว่างทำงานด้วยเหตุผลเดียวกับ fillRequestForm -- กันไม่ให้
   * ตัวเติมค่าธรรมเนียมอัตโนมัติเขียนทับตัวเลขที่เจ้าหน้าที่พิมพ์เองไว้
   */
  function restoreRequestForm(values) {
    if (!values) return;

    const cascaded = ["reqDistrict", "reqSubdistrict", "reqPurpose"];

    fillingForm = true;
    try {
      cascaded.forEach(id => {
        if (!(id in values)) return;
        const el = document.getElementById(id);
        if (!el) return;
        el.value = values[id];
        el.dispatchEvent(new Event("change"));
      });

      Object.keys(values).forEach(id => {
        if (cascaded.indexOf(id) !== -1) return;
        const el = document.getElementById(id);
        if (el) el.value = values[id];
      });
    } finally {
      fillingForm = false;
    }

    updateReqCoords();
    updateReqPhonePrimaryCall();
    updateReqPhoneSecondaryCall();
  }

  /**
   * ปุ่ม "+ สร้างคำร้องขยายเขตฯ" ข้างช่องสถานะงานของฟอร์มขอใช้ไฟฟ้า
   *
   * โผล่เมื่อครบสามข้อ: เป็นคำร้องที่บันทึกแล้ว (ใบใหม่ยังไม่มี id ให้ผูก),
   * สถานะที่เลือกอยู่คือ "รอขยายเขตฯ" และยังไม่เคยผูกกับใบไหน
   *
   * อ่านจากดรอปดาวน์ ไม่ใช่จากค่าที่บันทึกไว้ เพราะจังหวะที่เจ้าหน้าที่ต้องการ
   * ปุ่มนี้คือวินาทีที่เพิ่งเลือกสถานะเสร็จ -- ปุ่มที่ต้องกดบันทึกก่อนถึงจะโผล่
   * จะกลายเป็นปุ่มที่หาไม่เจอ ส่วนตัวการกดปุ่มเองไม่แตะค่าที่พิมพ์ค้างในฟอร์มเลย
   * (ดู reqCreateExtendBtn) จึงไม่มีปัญหาว่าฟอร์มยังไม่ได้บันทึก
   */
  function syncExtendLinkButton() {
    const record = editingId ? getRequests().find(r => r.id === editingId) : null;
    reqCreateExtendBtn.hidden = !(
      record &&
      record.type === "power" &&
      document.getElementById("reqJobStatus").value === "รอขยายเขตฯ" &&
      !record.linkedRequestId
    );
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

  /**
   * รายการสมุดคุมที่พิมพ์ไปแล้ว ("ประวัติการส่ง") ใช้ร่วมกันทั้ง 3 ชุด (มิเตอร์/
   * คำร้องทั่วไป/ผบร.) ต่างกันแค่แหล่งข้อมูล ปุ่มพิมพ์ที่ต้องซ่อนระหว่างดูประวัติ
   * และปลายทางตอนคลิก/พิมพ์ซ้ำ เดิมมี 3 ชุดโค้ดที่เกือบเหมือนกันทุกตัวอักษร รวม
   * เป็นฟังก์ชันเดียว -- รับปลายทาง (คอนเทนเนอร์/หัวข้อ/ช่องค้นหา) เป็นพารามิเตอร์
   * ไว้ เผื่อวันหนึ่งมีสมุดคุมเล่มไหนย้ายไปอยู่หน้าอื่น
   */
  function renderDispatchHistoryList({
    title, dispatches, printBtn, onOpen,
    listEl, titleEl, countEl, addBtn, searchQuery
  }) {
    addBtn.hidden = true;
    printBtn.hidden = true;

    const matches = dispatches
      .filter(d => dispatchMatchesSearch(d, searchQuery))
      .sort((a, b) => (b.printedAt || 0) - (a.printedAt || 0));

    titleEl.textContent = title;
    countEl.textContent = `พิมพ์ไปแล้ว ${matches.length} เล่ม`;
    listEl.innerHTML = "";

    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = searchQuery
        ? "ไม่พบสมุดคุมที่ตรงกับคำค้น"
        : "ยังไม่มีสมุดคุมที่พิมพ์ไว้ (ประวัติจะเริ่มบันทึกตั้งแต่ครั้งถัดไปที่กดพิมพ์)";
      listEl.appendChild(empty);
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
        onOpen(dispatch);
      });
      actions.appendChild(reprintBtn);
      card.appendChild(actions);

      card.addEventListener("click", () => onOpen(dispatch));
      listEl.appendChild(card);
    });
  }

  /** ประวัติสมุดคุมทั้งสามเล่มอยู่ในหน้างานรับคำร้อง จึงวาดลง requestsList เหมือนกันหมด */
  function renderDispatchHistory() {
    renderDispatchHistoryList({
      title: REQUEST_TYPES.meter,
      dispatches: getDispatches(),
      printBtn: meterPrintBtn,
      onOpen: openDispatchReprint,
      listEl: requestsList,
      titleEl: requestsListTitle,
      countEl: requestsListCount,
      addBtn: requestsAddBtn,
      searchQuery: currentSearchQuery
    });
  }

  /** เหมือน renderDispatchHistory ด้านบน แต่ของสมุดคุมส่ง ผบร. */
  function renderRevenueDispatchHistory() {
    renderDispatchHistoryList({
      title: REQUEST_TYPES.revenueDispatch,
      dispatches: getRevenueDispatches(),
      printBtn: revenuePrintBtn,
      onOpen: openRevenueDispatchReprint,
      listEl: requestsList,
      titleEl: requestsListTitle,
      countEl: requestsListCount,
      addBtn: requestsAddBtn,
      searchQuery: currentSearchQuery
    });
  }

  /** เหมือน renderDispatchHistory ด้านบน แต่ของสมุดคุมส่ง ผสน. ในหน้างานรับคำร้อง */
  function renderGeneralDispatchHistory() {
    renderDispatchHistoryList({
      title: REQUEST_TYPES.generalDispatch,
      dispatches: getGeneralDispatches(),
      printBtn: generalPrintBtn,
      onOpen: openGeneralDispatchReprint,
      listEl: requestsList,
      titleEl: requestsListTitle,
      countEl: requestsListCount,
      addBtn: requestsAddBtn,
      searchQuery: currentSearchQuery
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
  async function searchArchivedAndMerge(query, triggerBtn, onDone = renderRequestsList) {
    setBusy(triggerBtn, true, "กำลังค้นหา...");
    try {
      const found = await backend.searchArchived(query);
      if (!found.length) {
        triggerBtn.textContent = "ไม่พบคำร้องที่ตรงกันในคำร้องเก่า";
        triggerBtn.disabled = true;
        return;
      }
      const knownIds = new Set(requestsCache.map(r => String(r.id)));
      const fresh = found.filter(r => !knownIds.has(String(r.id)));
      requestsCache = requestsCache.concat(fresh);
      // เรียกฟังก์ชันวาดของหน้าที่กำลังแสดงอยู่จริง -- เดิมมีแค่หน้างานรับคำร้อง
      // เดียว ตอนนี้แท็บ dispatch ทั้ง 3 ย้ายไปอยู่ในโมดูลงาน ต้องเรียก
      // renderExtendWork() แทนถ้าค้นจากที่นั่น ไม่งั้นข้อมูลใหม่จะไม่ขึ้นจนกว่า
      // จะสลับหน้าไปมา
      onDone();
    } catch (err) {
      console.error("CS Connect: ค้นหาคำร้องเก่าไม่สำเร็จ", err);
      triggerBtn.textContent = "ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง";
      setBusy(triggerBtn, false);
    }
  }

  // เนื้อในเดียวกับที่ openRequestsView() กับตัวจัดการคลิกแท็บด้านล่างเคยแยกเขียน
  // ซ้ำกันสองที่ -- ดึงมารวมไว้ที่เดียวเพราะ restoreNavState() ต้องเรียกสลับแท็บ
  // ตอนโหลดหน้าด้วย (ไม่ใช่แค่ตอนคลิกจริง) ใช้ฟังก์ชันเดียวกันจะได้ไม่มีจุดที่ลืมแก้
  function switchRequestsTab(filter) {
    currentRequestFilter = filter;
    setActiveNavItem(currentRequestFilter);
    currentSearchQuery = "";
    requestsSearchInput.value = "";
    // ช่วงวันที่ที่กรองไว้เป็นของแท็บก่อนหน้า -- ล้างพร้อมคำค้นเหมือนกัน ไม่งั้น
    // สลับแท็บแล้วเจอรายการว่างที่ดูเหมือนไม่มีคำร้องเลย
    requestsDateFromValue = "";
    requestsDateToValue = "";
    requestsDateFrom.value = "";
    requestsDateTo.value = "";
    meterSelection.clear();
    setMeterMode("pending");
    generalSelection.clear();
    setGeneralMode("pending");
    revenueSelection.clear();
    setRevenueMode("pending");
    renderRequestsList();
  }

  requestsDateFrom.addEventListener("change", () => {
    requestsDateFromValue = requestsDateFrom.value;
    renderRequestsList();
  });

  requestsDateTo.addEventListener("change", () => {
    requestsDateToValue = requestsDateTo.value;
    renderRequestsList();
  });

  requestsDateClearBtn.addEventListener("click", () => {
    requestsDateFromValue = "";
    requestsDateToValue = "";
    requestsDateFrom.value = "";
    requestsDateTo.value = "";
    renderRequestsList();
  });

  function openRequestsView(filter) {
    leaveWorkMode();
    switchRequestsTab(filter || "power");
    showView("requests");
  }

  requestsNavItems.forEach(item => {
    item.addEventListener("click", () => {
      const filter = item.dataset.filter;

      // หน้างานรับคำร้องรับได้ทุกประเภท -- กดแท็บไหนก็แสดงรายการ+ปุ่มเพิ่มคำร้อง
      // ของแท็บนั้นในหน้านี้เอง ส่วนงานของช่าง (ตรวจสอบระบบไฟฟ้าภายใน/สำรวจ
      // ขยายเขตฯ) อยู่ที่หน้างานแยกซึ่งเข้าจากการ์ดหน้าแรก
      switchRequestsTab(filter);
      // แท็บอยู่ใต้การ์ด "งานรับคำร้อง" เดียวกันเสมอ -- อัปเดตแค่ค่า filter ทับ
      // ของเดิม ไม่ต้องเปลี่ยน card เพราะยังเป็นการ์ดเดิม
      saveNavState({ card: "requests", filter: currentRequestFilter });
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

  /** เหมือน setMeterMode ด้านบน แต่ของแท็บคุมคำร้องส่ง ผบร. */
  function setRevenueMode(mode) {
    revenueMode = mode;
    revenueModeBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.revenueMode === mode));
    requestsSearchInput.placeholder = mode === "history"
      ? "ค้นหาสมุดคุมด้วยเลขที่คำร้อง, ชื่อลูกค้า, ชื่อผู้ส่ง/ผู้รับ..."
      : "ค้นหาด้วยเลขที่คำร้อง, ชื่อลูกค้า, เบอร์โทร, บ้านเลขที่, เลขที่โฉนด...";
  }

  revenueModeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (revenueMode === btn.dataset.revenueMode) return;
      setRevenueMode(btn.dataset.revenueMode);
      currentSearchQuery = "";
      requestsSearchInput.value = "";
      revenueSelection.clear();
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

  /**
   * ปุ่มเดียวกันมีสองชุด (งานรับคำร้อง กับ งานขอใช้ไฟฟ้า/งานขยายเขตฯ) เพราะอยู่
   * คนละหน้า แต่ผูกกับตัวแปรทิศทางเดียวกัน (requestsSortAscending) -- สลับที่
   * หน้าไหนก็ให้อีกหน้าจำทิศทางเดิมไว้ด้วย จึงต้องอัปเดตทั้งคู่พร้อมกันทุกครั้ง
   * ที่ค่าเปลี่ยน ไม่ว่าจะเปลี่ยนจากปุ่มไหน
   */
  function updateSortButtons() {
    [[requestsSortBtn, requestsSortLabel], [extendWorkSortBtn, extendWorkSortLabel]].forEach(([btn, label]) => {
      btn.setAttribute("aria-pressed", String(requestsSortAscending));
      label.textContent = requestsSortAscending ? "เก่า → ใหม่" : "ใหม่ → เก่า";
    });
  }
  updateSortButtons();

  requestsSortBtn.addEventListener("click", () => {
    requestsSortAscending = !requestsSortAscending;
    requestsSortTouched = true;
    updateSortButtons();
    renderRequestsList();
  });

  extendWorkSortBtn.addEventListener("click", () => {
    requestsSortAscending = !requestsSortAscending;
    requestsSortTouched = true;
    updateSortButtons();
    renderExtendWork();
  });

  meterPrintBtn.addEventListener("click", async () => {
    const selected = getRequests().filter(r => meterSelection.has(r.id));
    if (!selected.length) return;
    await openMeterDispatchPrint(selected);
  });

  revenuePrintBtn.addEventListener("click", async () => {
    const selected = getRequests().filter(r => revenueSelection.has(r.id));
    if (!selected.length) return;
    await openRevenueDispatchPrint(selected);
  });

  generalPrintBtn.addEventListener("click", async () => {
    const selected = getRequests().filter(r => generalSelection.has(r.id));
    if (!selected.length) return;
    await openGeneralDispatchPrint(selected);
  });

  function fillRequestForm(r) {
    fillingForm = true;
    document.getElementById("reqAssignee").value = r.assignee || "";
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
    document.getElementById("reqFee").value = formatFeeValue(r.fee);
    document.getElementById("reqEvCircuit2").checked = Boolean(r.evCircuit2);
    document.getElementById("reqLargeCustomer").checked = Boolean(r.largeCustomer);
    // ต้องตั้งค่าวันที่ชำระไว้ "ก่อน" เปลี่ยนสถานะแล้วยิง change -- syncPaidDateField
    // เติมวันนี้ให้เฉพาะตอนช่องยังว่าง ถ้าตั้งค่าทีหลัง วันที่เดิมของคำร้องจะโดนข้าม
    // ไปแล้วช่องจะยังว่างตอนที่ change ทำงาน กลายเป็นเขียนวันนี้ทับของเดิม
    reqPaidDate.value = r.paidDate || "";
    reqMeterSentDate.value = meterSentDateOf(r);
    document.getElementById("reqJobStatus").value = r.jobStatus || "รอตรวจสอบ";
    reqJobStatus.dispatchEvent(new Event("change"));
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
    // มีเลขแล้วใช้เลขเดิม ยังไม่มีก็ใส่ค่าเริ่มต้น .0000 ให้ (แก้ทับได้ ดู defaultWbs)
    extWbs.value = r.wbs || defaultWbs();
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
  function fillDepositForm(r) {
    document.getElementById("depRequestNumber").value = r.requestNumber || "";
    depDate.value = r.receivedDate || "";
    document.getElementById("depBP").value = r.bp || "";
    document.getElementById("depCA").value = r.ca || "";
    document.getElementById("depCustomerName").value = r.customerName || "";
    document.getElementById("depPhone").value = r.phonePrimary || "";
    depJobStatus.value = r.jobStatus || "รอยกเลิกมิเตอร์";
    updateDepPhoneCall();
    document.getElementById("depNote").value = r.note || "";
  }

  function fillGeneralForm(r) {
    document.getElementById("genSubject").value = r.subject || "";
    document.getElementById("genRequestNumber").value = r.requestNumber || "";
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
    if (record.type === "deposit") {
      return [
        { label: "เลขที่คำร้อง", value: record.requestNumber || "-", mono: true },
        { label: "เลขที่คำร้อง (ระบบ)", value: record.trackingNumber || "-", mono: true },
        { label: "วันที่รับคำร้อง", value: formatThaiDate(record.receivedDate), mono: true },
        { label: "ชื่อลูกค้า", value: record.customerName || "-" },
        {
          label: "เบอร์โทรศัพท์",
          value: record.phonePrimary || "-",
          href: record.phonePrimary ? `tel:${record.phonePrimary}` : ""
        },
        { label: "BP", value: record.bp || "-", mono: true },
        { label: "CA", value: record.ca || "-", mono: true },
        { label: "สถานะ", value: record.jobStatus || "-", status: true },
        { label: "หมายเหตุ", value: record.note || "-" }
      ];
    }

    if (record.type === "general") {
      return [
        { label: "เลขที่รับ", value: record.requestNumber || "-", mono: true },
        { label: "เลขที่คำร้อง (ระบบ)", value: record.trackingNumber || "-", mono: true },
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
        { label: "แผนกที่รับผิดชอบ", value: record.department || "-" },
        { label: "หมายเหตุ", value: record.note || "-" }
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

    // ใต้สถานะงานพอดี -- คนที่แคปการ์ดนี้ส่งต่อมักถูกถามต่อทันทีว่า "อีกกี่คิว"
    // ขึ้นเฉพาะใบที่อยู่คิวรอสำรวจจริง ใบสถานะอื่นไม่มีบรรทัดนี้ให้รก
    const queueText = surveyQueueText(record);
    if (queueText) {
      lines.push({ label: "คิวรอสำรวจ", value: queueText.replace(/^คิวรอสำรวจ: /, "") });
    }

    // ใต้สถานะงานเช่นกัน -- คำถามถัดไปของคนที่ถามว่า "ส่งมิเตอร์หรือยัง" คือ "ส่งวันไหน"
    const meterSent = record.type === "power" ? meterSentDateOf(record) : "";
    if (meterSent) {
      lines.push({ label: "วันที่ส่งแผนกมิเตอร์", value: formatThaiDate(meterSent), mono: true });
    }

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

    // ต่อท้ายสุดเสมอ เหมือนตำแหน่งของหมายเหตุบนการ์ดในหน้ารายการ (แสดงเป็น "-"
    // เมื่อไม่มี แทนที่จะซ่อนบรรทัดทิ้ง เพื่อให้บรรทัดของการ์ดนิ่ง ไม่ขยับตามเนื้อหา)
    lines.push({ label: "หมายเหตุ", value: record.note || "-" });

    return lines;
  }

  function renderRequestSummary(record) {
    summaryRecord = record;
    requestSummaryType.textContent = REQUEST_TYPES[record.type] || "คำร้อง";
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

    const text = [REQUEST_TYPES[summaryRecord.type] || "คำร้อง"]
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

  /** เหมือน resetGeneralFormState ด้านล่าง แต่ของ #depositForm */
  function resetDepositFormState() {
    hideError(depositFormError);
    depositForm.reset();
    setDefaultDepositDate();
    // .reset() ไม่ยิง input event ปุ่มโทรออกจึงต้องสั่งคำนวณใหม่เอง
    updateDepPhoneCall();
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
    // ต้องเรียกหลัง reset() เสมอ -- native reset ล้างช่องวันที่ชำระและคืนสถานะ
    // งานกลับไปตัวเลือกแรก (รอตรวจสอบ) แต่ "ไม่" ไปแตะ [hidden] ของ div ที่ห่อ
    // ช่องนั้น ซึ่งเป็นแค่สถานะที่ syncPaidDateField ตั้งไว้เอง reset() มองไม่เห็น
    syncPaidDateField();
    updateReqCoords();
    updateReqPhonePrimaryCall();
    updateReqPhoneSecondaryCall();
    resetExtendFormState();
    resetGeneralFormState();
    resetDepositFormState();

    const isSupported = FORM_SUPPORTED_TYPES.has(type);
    const isPower = type === "power";
    const isExtend = type === "extend";
    const isGeneral = type === "general";
    const isDeposit = type === "deposit";

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
    // ขอขยายเขตฯ และคำร้องทั่วไปไม่มีโหมดกลุ่ม ปุ่มของมันจึงมีแค่สองข้อความ
    extendFormSubmitBtn.textContent = record ? "บันทึกการแก้ไข" : "บันทึกคำร้อง";
    generalFormSubmitBtn.textContent = record ? "บันทึกการแก้ไข" : "บันทึกคำร้อง";
    depositFormSubmitBtn.textContent = record ? "บันทึกการแก้ไข" : "บันทึกคำร้อง";

    requestForm.hidden = !(isSupported && isPower);
    extendForm.hidden = !(isSupported && isExtend);
    generalForm.hidden = !(isSupported && isGeneral);
    depositForm.hidden = !(isSupported && isDeposit);
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

    if (isSupported && isGeneral) {
      // ใบเก่าที่บันทึกไว้ก่อนมีเลขระบบ จะได้เลขตอนเปิดฟอร์มครั้งถัดไปแล้วบันทึกติดไป
      genTrackingNumber.value = record
        ? (record.trackingNumber || generateTrackingNumber("general"))
        : generateTrackingNumber("general");
    }

    if (isSupported && isDeposit) {
      depTrackingNumber.value = record
        ? (record.trackingNumber || generateTrackingNumber("deposit"))
        : generateTrackingNumber("deposit");
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
    if (isSupported && isDeposit && record) {
      fillDepositForm(record);
    }

    // คำร้องขอขยายเขตฯ ทำงานจบในโมดูลของตัวเอง ไม่ใช่ในหน้างานรับคำร้อง --
    // ย้ายฟอร์มไปไว้ในหน้ารายละเอียดของโมดูลนั้น แล้วสลับหน้าไปที่นั่น (เสมอ
    // ไม่ว่าใบใหม่หรือใบเก่า) ขอใช้ไฟฟ้ามีโมดูลงานของตัวเองเหมือนกัน แต่กติกา
    // ต่างกันเล็กน้อย: ใบที่ "บันทึกแล้ว" เปิดในโมดูลงานเลย ส่วนใบใหม่ที่เปิดจาก
    // หน้างานรับคำร้อง (options.openInWork ไม่ได้ส่งมา) และโหมดเพิ่มหลายคำร้อง
    // ยังอยู่ในหน้ารับคำร้อง -- การรับเรื่องเข้าระบบเป็นงานของหน้านั้น และโหมด
    // หลายคำร้องต้องใช้พื้นที่ของหน้ารับคำร้องทั้งหมด ส่วนใบใหม่ที่เปิดจากปุ่ม
    // "+ เพิ่มคำร้อง" ในโมดูลงานเอง (extendWorkAddBtn) ส่ง openInWork มาเพื่อให้
    // ยังอยู่ในโมดูลนั้นต่อ ไม่กระโดดไปหน้ารับคำร้องทั้งที่กดเพิ่มจากอีกหน้าหนึ่ง
    // คำร้องทั่วไป/ขอเงินประกันคืนไม่มีโมดูลงานแยก ทำงานจบในหน้ารับคำร้องทั้งหมด
    const openInWork = isSupported && (isExtend || (isPower && !batchMode && (record || options.openInWork)));
    document.getElementById("reqAssigneeField").hidden =
      !(isPower && record && (WORK_KIND_ASSIGNABLE.power || record.assignee));

    if (openInWork) {
      setWorkKind(type);
      mountExtendDetail(type);
      extendDetailTitle.textContent = record ? "รายละเอียดคำร้อง" : `เพิ่มคำร้อง: ${REQUEST_TYPES[type]}`;
      extendDetailSubtitle.textContent = record
        ? (isExtend
          ? [record.requestNumber, record.customerName, record.wbs]
          : [record.requestNumber, record.customerName, record.trackingNumber]
        ).filter(Boolean).join(" · ")
        : "กรอกรายละเอียดคำร้องใหม่";
      if (!isExtend) {
        // มีแค่ขอขยายเขตฯ ที่มีขั้นแผนผัง/ภาพหน้างาน/ประมาณการ ประเภทอื่นไม่มี
        extendStage.plan = false;
        extendStage.photo = false;
        extendStage.estimate = false;
      }
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
      renderRevenueDispatchInfo(record);
      renderLinkedRequestInfo(record);

      document.getElementById("requestFormEditedBy").textContent = record.updatedByName
        ? `ผู้แก้ไขล่าสุด: ${record.updatedByName} · ${formatThaiDateTime(record.updatedAt)}`
        : "ผู้แก้ไขล่าสุด: -";
    }

    syncExtendLinkButton();

    requestsListMode.hidden = true;
    requestsFormMode.hidden = false;
  }

  // สถานะงานเปลี่ยนเมื่อไร ปุ่มสร้างคำร้องขยายเขตฯ ต้องตามทันที
  document.getElementById("reqJobStatus").addEventListener("change", syncExtendLinkButton);

  /**
   * สร้างคำร้องขอขยายเขตฯ ที่ผูกกับคำร้องขอใช้ไฟฟ้าใบที่เปิดอยู่
   *
   * ทำงานจากข้อมูลที่ "บันทึกไว้แล้ว" ล้วน ๆ ไม่อ่านค่าจากช่องกรอกในฟอร์มเลย
   * จึงไม่ไปบันทึกสิ่งที่เจ้าหน้าที่พิมพ์ค้างไว้แต่ยังไม่ได้กดบันทึก และไม่ต้อง
   * ปิดฟอร์มทิ้ง -- กดแล้วอยู่หน้าเดิม มีบรรทัดคำร้องที่เกี่ยวข้องโผล่ในแผงขวา
   * ให้กดเข้าไปต่อเมื่อพร้อม
   *
   * เขียนสองใบในการบันทึกครั้งเดียว (upsert ทีละชุด) ความเชื่อมโยงสองฝั่งจึงไม่มี
   * ทางเหลือแค่ข้างเดียวจากการเขียนสำเร็จครึ่งทาง
   */
  reqCreateExtendBtn.addEventListener("click", async () => {
    const source = editingId ? getRequests().find(r => r.id === editingId) : null;
    if (!source || source.linkedRequestId) return;

    const ok = window.confirm([
      "สร้างคำร้องขอขยายเขตฯ ใบใหม่ที่เชื่อมกับคำร้องนี้",
      "",
      "ลูกค้า: " + (source.customerName || "-"),
      "",
      "ระบบจะคัดลอกชื่อ ที่อยู่ เบอร์โทร และพิกัดไปตั้งต้นให้",
      "แล้วพาเข้าไปที่คำร้องขยายเขตฯ ใบนั้นเพื่อกรอกต่อทันที",
      "บันทึกเสร็จแล้วจะพากลับมาที่หน้านี้ พร้อมค่าที่กรอกค้างไว้ครบเหมือนเดิม"
    ].join("\n"));
    if (!ok) return;

    hideError(requestFormError);
    setBusy(reqCreateExtendBtn, true, "กำลังสร้าง...");

    try {
      const { byName: savedByName, byEmail: savedByEmail } = actingStaff();
      const now = Date.now();
      const extendId = newRequestId();

      const extendRecord = {
        id: extendId,
        type: "extend",
        trackingNumber: generateTrackingNumber("extend"),
        // ไม่ดึงเลขที่คำร้องของใบต้นทางมา -- ขอใช้ไฟฟ้ากับขอขยายเขตฯ รับเลขมาคนละ
        // ทะเบียนกัน ใบนี้ต้องมีเลขของตัวเอง เจ้าหน้าที่กรอกตอนเปิดเข้าไปกรอกต่อ
        // (ฟอร์มบังคับกรอกช่องนี้อยู่แล้ว จึงไม่มีทางหลุดเป็นค่าว่างไปลงชีต)
        requestNumber: "",
        receivedDate: todayDateString(new Date(now)),
        customerName: source.customerName || "",
        phonePrimary: source.phonePrimary || "",
        phoneSecondary: source.phoneSecondary || "",
        province: source.province || "",
        district: source.district || "",
        subdistrict: source.subdistrict || "",
        zipcode: source.zipcode || "",
        houseNo: source.houseNo || "",
        moo: source.moo || "",
        village: source.village || "",
        deed: source.deed || "",
        lat: source.lat || "",
        lng: source.lng || "",
        jobStatus: EXTEND_DEFAULT_STATUS,
        linkedRequestId: source.id,
        statusHistory: [
          { status: EXTEND_DEFAULT_STATUS, byName: savedByName, byEmail: savedByEmail, at: now }
        ],
        comments: [
          {
            text: `สร้างจาก${requestLabel(source)}`,
            byName: savedByName, byEmail: savedByEmail, at: now
          }
        ],
        createdByName: savedByName,
        createdByEmail: savedByEmail,
        createdAt: now
      };

      const requests = getRequests();
      const idx = requests.findIndex(r => r.id === source.id);
      if (idx !== -1) {
        requests[idx] = {
          ...requests[idx],
          linkedRequestId: extendId,
          comments: (requests[idx].comments || []).concat([
            {
              text: "สร้างคำร้องขอขยายเขตระบบจำหน่ายไฟฟ้าจากคำร้องนี้",
              byName: savedByName, byEmail: savedByEmail, at: now
            }
          ]),
          updatedByName: savedByName,
          updatedByEmail: savedByEmail,
          updatedAt: now
        };
      }
      requests.push(extendRecord);

      await saveRequests(requests);

      // เก็บค่าที่ค้างอยู่ในฟอร์มไว้ก่อนเดินออกไปอีกโมดูล แล้วค่อยคืนตอนวกกลับมา
      // (ดู leaveRequestForm) -- เก็บหลังบันทึกสำเร็จเท่านั้น ถ้าบันทึกล้มจะได้ไม่
      // มีที่หมายการวกกลับค้างอยู่ทั้งที่ยังไม่ได้ไปไหน
      linkedReturn = {
        powerId: source.id,
        draft: snapshotRequestForm(),
        // จำว่าใบขอใช้ไฟฟ้าเปิดมาจากไหน (รายการรับคำร้อง หรือหน้างานขอใช้ไฟฟ้า)
        // วกกลับมาแล้วกดย้อนกลับจะได้ไปถูกที่
        returnTo: formReturnTo
      };

      const savedExtend = getRequests().find(r => r.id === extendId);
      openRequestForm("extend", savedExtend, { returnTo: "linkedPower" });
    } catch (err) {
      console.error("CS Connect create linked extend error:", err);
      showError(requestFormError, friendlyError(err, "สร้างคำร้องขยายเขตฯ ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(reqCreateExtendBtn, false);
    }
  });

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
      const phonePrimaryField = readPhoneField(
        document.getElementById("reqPhonePrimary").value, "เบอร์โทรศัพท์ (หลัก)", true);
      const phoneSecondaryField = readPhoneField(
        document.getElementById("reqPhoneSecondary").value, "เบอร์โทรศัพท์ (รอง)", false);
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
      const evCircuit2 = document.getElementById("reqEvCircuit2").checked;
      const largeCustomer = document.getElementById("reqLargeCustomer").checked;
      const jobStatus = document.getElementById("reqJobStatus").value;
      // ว่างได้เสมอแม้สถานะเป็น "ชำระเงินแล้ว" -- ช่องนี้เป็นความสะดวก ไม่ใช่กฎบังคับ
      // แบบเดียวกับ approvalDate ของขอขยายเขตฯ (ไม่มีการตรวจฝั่งเซิร์ฟเวอร์ผูกไว้)
      const paidDate = document.getElementById("reqPaidDate").value;
      const meterSentDate = reqMeterSentDate.value;
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

      if (phonePrimaryField.error) {
        showError(requestFormError, phonePrimaryField.error);
        return;
      }
      if (phoneSecondaryField.error) {
        showError(requestFormError, phoneSecondaryField.error);
        return;
      }
      const phonePrimary = phonePrimaryField.value;
      const phoneSecondary = phoneSecondaryField.value;

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
        evCircuit2,
        largeCustomer,
        jobStatus,
        paidDate,
        meterSentDate,
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
          // เขียนค่าที่ตัดเหลือตัวเลขกลับเข้า row.values เลย เพราะค่าชุดนี้คือ
          // ค่าที่ถูกนำไปบันทึกจริงในขั้นถัดไป
          for (const field of [
            { key: "phonePrimary", label: "เบอร์โทรศัพท์หลัก", required: true },
            { key: "phoneSecondary", label: "เบอร์โทรศัพท์รอง", required: false }
          ]) {
            const checked = readPhoneField(row.values[field.key], field.label, field.required);
            if (checked.error) {
              expandBatchRow(row.el);
              showError(requestFormError, `คำร้องที่ ${row.position}: ${checked.error}`);
              return;
            }
            row.values[field.key] = checked.value;
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

        const savedAll = await saveRequests(getRequests().concat(created));
        // อ่านเลขที่คำร้อง (ระบบ) ฉบับที่บันทึกจริงกลับมา -- ใบ QR ที่ยื่นให้ลูกค้า
        // ต้องตรงกับในชีต ไม่ใช่เลขที่เบราว์เซอร์เดาไว้ก่อนส่ง
        const createdIds = new Set(created.map(r => String(r.id)));
        const createdSaved = (savedAll || []).filter(r => createdIds.has(String(r.id)));

        // Clear everything that was typed, so the next batch starts from a
        // blank form rather than the previous group's values.
        requestForm.reset();
        resetLocationFields();
        resetPurposeFields();
        setDefaultRequestDate();
        resetBatchRows();

        showBatchResult(createdSaved.length === created.length ? createdSaved : created);
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
      // เดิมเรียก renderRequestsList() ตรง ๆ ซึ่งถูกเฉพาะตอนฟอร์มอยู่ในหน้ารับคำร้อง
      // ตอนนี้ใบที่บันทึกแล้วเปิดในหน้างานขอใช้ไฟฟ้า การวาดรายการรับคำร้องใหม่จะไม่
      // พาออกจากฟอร์ม กดบันทึกแล้วค้างอยู่หน้าเดิม -- leaveRequestForm พาไปตาม
      // formReturnTo เหมือนทุกฟอร์มอื่น
      leaveRequestForm();
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
      const phonePrimaryField = readPhoneField(
        document.getElementById("extPhonePrimary").value, "เบอร์โทรศัพท์ (หลัก)", true);
      const phoneSecondaryField = readPhoneField(
        document.getElementById("extPhoneSecondary").value, "เบอร์โทรศัพท์ (รอง)", false);
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
      const wbs = wbsValueToSave(extWbs.value);
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
      if (phonePrimaryField.error) {
        showError(extendFormError, phonePrimaryField.error);
        return;
      }
      if (phoneSecondaryField.error) {
        showError(extendFormError, phoneSecondaryField.error);
        return;
      }
      const phonePrimary = phonePrimaryField.value;
      const phoneSecondary = phoneSecondaryField.value;
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
   * ขอเงินประกันคืน -- โครงเดียวกับ #generalForm ด้านล่าง (editingId เดิม/ใหม่,
   * appendStatusHistoryIfChanged, actingStaff, saveRequests)
   *
   * ไม่มีเบอร์โทรและไม่มีที่อยู่โดยตั้งใจ ตามชุดข้อมูลที่สั่งไว้ -- ประเภทนี้อ้างอิง
   * ลูกค้าด้วย BP/CA ซึ่งเป็นเลขที่แผนกบริหารรายได้ค่าไฟฟ้าใช้หาบัญชีอยู่แล้ว
   * (matchesSearch ก็ค้นสองช่องนี้ให้อยู่แล้วมาแต่เดิม)
   */
  depositForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(depositFormError);

    try {
      const trackingNumber = depTrackingNumber.value;
      const requestNumber = document.getElementById("depRequestNumber").value.trim();
      const receivedDate = depDate.value;
      const bp = document.getElementById("depBP").value.trim();
      const ca = document.getElementById("depCA").value.trim();
      const customerName = document.getElementById("depCustomerName").value.trim();
      const phoneField = readPhoneField(
        document.getElementById("depPhone").value, "เบอร์โทรศัพท์", true);
      const jobStatus = depJobStatus.value;
      const note = document.getElementById("depNote").value.trim();

      if (!requestNumber) {
        showError(depositFormError, "กรุณากรอกเลขที่คำร้อง");
        return;
      }
      if (!receivedDate) {
        showError(depositFormError, "กรุณาเลือกวันที่รับคำร้อง");
        return;
      }
      if (!customerName) {
        showError(depositFormError, "กรุณากรอกชื่อลูกค้า");
        return;
      }
      if (phoneField.error) {
        showError(depositFormError, phoneField.error);
        return;
      }
      const phonePrimary = phoneField.value;
      if (!jobStatus) {
        showError(depositFormError, "กรุณาเลือกสถานะ");
        return;
      }

      const recordData = {
        type: "deposit",
        trackingNumber,
        requestNumber,
        receivedDate,
        bp,
        ca,
        customerName,
        phonePrimary,
        jobStatus,
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

      setBusy(depositFormSubmitBtn, true, "กำลังบันทึกคำร้อง...");
      await saveRequests(requests);

      editingId = null;
      pendingNewId = null;
      resetDepositFormState();
      leaveRequestForm();
    } catch (err) {
      console.error("CS Connect deposit form error:", err);
      showError(
        depositFormError,
        friendlyError(err, "เกิดข้อผิดพลาด ไม่สามารถบันทึกคำร้องได้ กรุณาลองใหม่อีกครั้ง")
      );
    } finally {
      setBusy(depositFormSubmitBtn, false);
    }
  });

  /**
   * หาคำร้องทั่วไปใบที่ข้อมูลระบุตัวคำร้องตรงกันทุกช่องกับใบที่กำลังจะบันทึกใหม่
   *
   * ทำไมมีเฉพาะประเภทนี้: คำร้องทั่วไปเป็นประเภทเดียวในสามประเภทที่ไม่มีเลข
   * อ้างอิงของตัวเองเลย -- ขอใช้ไฟฟ้า/ขอขยายเขตฯ มีทั้งเลขที่คำร้องที่เจ้าหน้าที่
   * กรอกเอง และเลขที่คำร้อง (ระบบ) ที่ออกให้อัตโนมัติ ใบซ้ำจึงสะดุดตาทันทีจาก
   * เลขที่ซ้ำกัน ส่วนใบนี้มีแค่ เรื่อง/ชื่อ/เบอร์/วันที่ สองใบที่ซ้ำกันจึงเหมือนกัน
   * เป๊ะทุกช่องและแยกด้วยตาเปล่าไม่ออก
   *
   * ที่ต้องกันตรงนี้เพราะ pendingNewId กันได้แค่การกดบันทึกซ้ำในฟอร์มเดิม --
   * เส้นทางที่หลุดคือ เขียนลงชีตสำเร็จแล้วแต่ขากลับ (302 ไป
   * script.googleusercontent.com) คืน 404 เป็นครั้งคราว ฝั่งเบราว์เซอร์เห็นเป็น
   * ล้มเหลว saveRequests จึงย้อนแคชกลับ การ์ดที่เพิ่งบันทึกหายไปจากจอ เจ้าหน้าที่
   * เข้าใจว่ายังไม่ได้บันทึกเลยกดเพิ่มคำร้องแล้วพิมพ์ใหม่ -- ตอนนั้น
   * openRequestForm ล้าง pendingNewId ไปแล้ว ใบใหม่จึงได้ id ใหม่ และ upsertAll_
   * ที่จับคู่แถวด้วย id ก็ต่อแถวใหม่ให้ตามที่ถูกสั่ง กลายเป็นคำร้องซ้ำจริงในชีต
   *
   * เทียบแบบตัดช่องว่างหัวท้ายและไม่สนตัวพิมพ์เล็กใหญ่ และข้ามใบที่กำลังแก้ไขอยู่เอง
   */
  function findDuplicateGeneralRequest({ subject, customerName, phonePrimary, receivedDate }) {
    const norm = v => String(v == null ? "" : v).trim().toLowerCase();
    return getRequests().find(r =>
      r.type === "general" &&
      r.id !== editingId &&
      norm(r.subject) === norm(subject) &&
      norm(r.customerName) === norm(customerName) &&
      norm(r.phonePrimary) === norm(phonePrimary) &&
      norm(r.receivedDate) === norm(receivedDate)
    ) || null;
  }

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
      const trackingNumber = genTrackingNumber.value;
      const requestNumber = document.getElementById("genRequestNumber").value.trim();
      const receivedDate = genDate.value;
      const customerName = document.getElementById("genCustomerName").value.trim();
      const phoneField = readPhoneField(
        document.getElementById("genPhone").value, "เบอร์โทรศัพท์", true);
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
      if (phoneField.error) {
        showError(generalFormError, phoneField.error);
        return;
      }
      const phonePrimary = phoneField.value;
      if (!jobStatus) {
        showError(generalFormError, "กรุณาเลือกสถานะ");
        return;
      }

      const recordData = {
        type: "general",
        subject,
        trackingNumber,
        requestNumber,
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
        // ถามก่อนสร้างใบที่ซ้ำกับของเดิมทุกช่อง -- ดู findDuplicateGeneralRequest
        // ว่าทำไมเฉพาะประเภทนี้ต้องกัน ยังเลือก "บันทึกเป็นใบใหม่" ได้อยู่ เพราะ
        // ลูกค้าคนเดิมยื่นเรื่องเดิมซ้ำในวันเดียวกันจริง ๆ ก็เป็นไปได้ แค่ต้องตั้งใจ
        const duplicate = findDuplicateGeneralRequest(recordData);
        if (duplicate) {
          const ok = window.confirm([
            "มีคำร้องทั่วไปที่ข้อมูลตรงกันทุกช่องอยู่แล้ว",
            "",
            "เรื่อง: " + (duplicate.subject || "-"),
            "ชื่อลูกค้า: " + (duplicate.customerName || "-"),
            "สถานะ: " + (duplicate.jobStatus || "-"),
            "",
            "ถ้าใบเดิมเกิดจากการบันทึกซ้ำ ให้กดยกเลิกแล้วเปิดใบเดิมขึ้นมาแก้แทน",
            "ยืนยันบันทึกเป็นคำร้องใบใหม่อีกใบหรือไม่?"
          ].join("\n"));
          if (!ok) return;
        }
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

        updated = await backend.saveExtendFile(extendFormRecord, "plan", dataUrl);
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

      const updated = await backend.saveExtendFile(extendFormRecord, kind, dataUrl);

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
    // src ใส่ทีหลังเมื่อได้ signed URL (ดูท้ายฟังก์ชัน) -- ตรงนี้แค่บอกว่ามีภาพไหม
    const site = record.sitePhoto || "";
    const route = record.routePhoto || "";

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
           <div class="frame"><img data-path="${escapeForPrint(url)}" alt="${escapeForPrint(label)}"></div>
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
    // ขอ signed URL หลังเปิดหน้าต่างแล้ว (เปิดก่อนตอนคลิก ไม่งั้นโดนบล็อก popup)
    const images = Array.from(win.document.images);
    if (!images.length) {
      win.print();
      return;
    }
    let pending = images.length;
    const done = () => { if (--pending === 0) win.print(); };
    images.forEach(img => {
      img.addEventListener("load", done);
      img.addEventListener("error", done);
      fileUrl("file", img.dataset.path).then(src => {
        if (src) img.src = src;
        else done();
      });
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
    pickFull: document.getElementById("estPickFull"),
    pickItemSuggest: document.getElementById("estPickItemSuggest"),
    pickKeyCode: document.getElementById("estPickKeyCode"),
    pickKeySuggest: document.getElementById("estPickKeySuggest"),
    pickIn: document.getElementById("estPickIn"),
    pickRm: document.getElementById("estPickRm"),
    pickRp: document.getElementById("estPickRp"),
    pickError: document.getElementById("estPickError"),
    kitsBlock: document.getElementById("estKitsBlock"),
    kitSelect: document.getElementById("estKitSelect"),
    kitAddBtn: document.getElementById("estKitAddBtn"),
    kitEditBtn: document.getElementById("estKitEditBtn"),
    kitSaveBtn: document.getElementById("estKitSaveBtn"),
    kitDeleteBtn: document.getElementById("estKitDeleteBtn"),
    kitHint: document.getElementById("estKitHint"),
    kitError: document.getElementById("estKitError"),
    kitSaveForm: document.getElementById("estKitSaveForm"),
    kitName: document.getElementById("estKitName"),
    kitNote: document.getElementById("estKitNote"),
    kitSaveConfirmBtn: document.getElementById("estKitSaveConfirmBtn"),
    kitSaveCancelBtn: document.getElementById("estKitSaveCancelBtn"),
    jobHead: document.getElementById("estJobHead"),
    kitEditHead: document.getElementById("estKitEditHead"),
    kitEditName: document.getElementById("estKitEditName"),
    kitEditNote: document.getElementById("estKitEditNote"),
    kitEditSaveBtn: document.getElementById("estKitEditSaveBtn"),
    kitEditCancelBtn: document.getElementById("estKitEditCancelBtn"),
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
  let estimateCatalog = null;   // [{ keyCode, description }] -- null = ยังไม่ได้โหลด
  // โหลดแค็ตตาล็อกล่าสุดล้มเหลว -- แยกจาก "ยังไม่ได้โหลด" เพื่อให้แผงเลือกบอกได้ว่า
  // ต้องลองใหม่ ไม่ใช่ขึ้นว่ากำลังโหลดค้างไว้ตลอดไป
  let estimateCatalogFailed = false;
  let estimateKits = [];        // [{ id, name, note, items: [...] }]
  let estimateLists = null;     // { section: [], group: [], investment: [] }
  // ชุดเซ็ตพัสดุที่กำลังแก้ไขตรง ๆ อยู่ (openKitEditor) -- null เมื่อไม่ได้อยู่ใน
  // โหมดนี้ รูปร่างเดียวกับ "งานย่อย" ({ items: [...] }) โดยตั้งใจ เพื่อให้
  // currentJob() คืนค่านี้แทนได้ และใช้ renderEstimateRows()/แผงเลือกพัสดุ/
  // markEstimateDirty() ชุดเดียวกับตอนแก้ไขงานย่อยจริงได้ทั้งหมดโดยไม่ต้อง
  // เขียนโค้ดซ้ำ (ดูเหตุผลเต็มที่ openKitEditor)
  let editingKit = null;

  function markEstimateDirty() {
    // กำลังแก้ไขชุดเซ็ตพัสดุอยู่ ไม่ใช่ใบประมาณการของคำร้องนี้ -- ป้าย "ยังไม่ได้
    // บันทึก" บนแถบบนเป็นเรื่องของใบประมาณการเท่านั้น ไม่เกี่ยวกับชุดเซ็ต
    if (editingKit) return;
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
      : "ยังไม่มีรายการตั้งต้นในระบบ — แท็บ EstimateItems ในชีตต้องมีหัวตารางแถวแรกเป็น keyCode · description · group (หรือ รหัสพัสดุ · รายการ · กลุ่ม) แล้วใส่ข้อมูลตั้งแต่แถวที่ 2";
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
    // กำลังแก้ไขชุดเซ็ตพัสดุโดยตรงอยู่ -- คืน editingKit แทน "งานย่อย" จริง
    // (ดูเหตุผลเต็มที่ประกาศ editingKit และที่ openKitEditor)
    if (editingKit) return editingKit;
    const dept = currentDept();
    return dept && dept.jobs[estimateJobIndex];
  }

  /**
   * เปิดหน้าแก้ไข "ชุดเซ็ตพัสดุ" ที่เลือกไว้ตรง ๆ -- แทนที่วิธีเดิมที่ต้องอ้อมไป
   * พักไว้ในงานย่อยของคำร้องจริงใบใดใบหนึ่งก่อน (เพิ่มทั้งชุด -> แก้จำนวน ->
   * บันทึกงานย่อยนี้เป็นชุดเซ็ตทับของเดิม) ซึ่งระหว่างนั้นแก้ไขเนื้อหาใบประมาณการ
   * ของคำร้องจริงไปชั่วคราวด้วย เสี่ยงลืมกดยกเลิก/บันทึกคำร้องผิดใบ
   *
   * ใช้ currentJob()/renderEstimateRows()/แผงเลือกพัสดุชุดเดียวกับตอนแก้ไขงานย่อย
   * จริงทุกอย่างโดยไม่ต้องเขียนโค้ดซ้ำ เพราะ editingKit มีรูปร่าง { items: [...] }
   * เหมือนงานย่อย และ currentJob() คืน editingKit แทนเมื่ออยู่ในโหมดนี้ (ดู
   * markEstimateDirty ด้วย ที่กันไม่ให้การแก้ชุดเซ็ตไปติดป้าย "ยังไม่ได้บันทึก"
   * ของใบประมาณการจริงบนแถบบน)
   */
  function openKitEditor(kit) {
    editingKit = {
      id: kit.id,
      name: kit.name,
      note: kit.note || "",
      // clone แต่ละแถว ไม่ใช่แค่อ้างอิง array เดิม -- แก้ไขแล้วกด "ยกเลิก" ต้อง
      // ไม่กระทบชุดเซ็ตที่ estimateKits ถืออยู่จนกว่าจะกดบันทึกจริง
      items: (kit.items || []).map(item => ({ ...item }))
    };

    estimateView.kitEditName.value = editingKit.name;
    estimateView.kitEditNote.value = editingKit.note;

    estimateView.jobHead.hidden = true;
    estimateView.kitsBlock.hidden = true;
    estimateView.kitEditHead.hidden = false;

    // ปุ่มพิมพ์/บันทึกประมาณการ กับป้าย "ยังไม่ได้บันทึก" เป็นของใบประมาณการ
    // ของคำร้อง ไม่เกี่ยวกับการแก้ชุดเซ็ต ซ่อนไว้กันสับสนว่ากดแล้วจะบันทึกอะไร
    document.getElementById("estimatePrintBtn").hidden = true;
    document.getElementById("estimateSaveBtn").hidden = true;
    estimateView.dirty.hidden = true;

    estimateView.formPaneTitle.textContent = `แก้ไขชุดเซ็ตพัสดุ: ${editingKit.name}`;
    renderEstimateCrumbs();

    renderEstimateRows();
    resetItemPicker();
    hideError(estimateView.kitError);
  }

  /** ปิดโหมดแก้ไขชุดเซ็ต แล้วย้อนกลับไปวาดงานย่อยจริงที่เปิดค้างไว้ก่อนหน้า */
  function closeKitEditor() {
    editingKit = null;

    estimateView.jobHead.hidden = false;
    estimateView.kitsBlock.hidden = false;
    estimateView.kitEditHead.hidden = true;

    document.getElementById("estimatePrintBtn").hidden = false;
    document.getElementById("estimateSaveBtn").hidden = false;
    // ป้าย "ยังไม่ได้บันทึก" ของใบประมาณการจริงอาจค้างอยู่ตั้งแต่ก่อนเข้าโหมดนี้
    // (ยังไม่ได้กันไว้ว่าห้ามเข้าโหมดนี้ตอนใบประมาณการมีของที่ยังไม่ได้บันทึก ดู
    // estKitEditBtn) จึงคืนตามค่า estimateDirty จริง ไม่ใช่ซ่อนทิ้งเฉย ๆ
    estimateView.dirty.hidden = !estimateDirty;

    renderEstimateForm();
    renderEstimateCrumbs();
  }

  /** ถามก่อนทิ้งการแก้ไขที่ยังไม่ได้บันทึก -- คืน true ถ้าปิดโหมดจริง */
  function cancelKitEdit() {
    if (!window.confirm("ยกเลิกการแก้ไขชุดเซ็ตนี้โดยไม่บันทึก?")) return false;
    closeKitEditor();
    return true;
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
    // กำลังแก้ไขชุดเซ็ตพัสดุอยู่ -- ทางออกจากโหมดนี้คือ "ยกเลิก"/"บันทึก" เท่านั้น
    // ไม่ใช่การเปลี่ยนชั้นตามปกติ (ซึ่งจะทิ้ง editingKit ค้างไว้แบบผิด ๆ เพราะ
    // currentJob() ยังจะคืนมันต่อไปทั้งที่หน้าจอเปลี่ยนไปแล้ว) กดครั้งแรกจึงแค่
    // ปิดโหมดแก้ไข (ถ้ายืนยัน) แล้วค้างอยู่ที่งานย่อยจริงเดิม กดอีกครั้งจึงจะ
    // เปลี่ยนชั้นจริง ๆ -- เหมือนปิด overlay ก่อนแล้วค่อยเดินต่อ
    if (editingKit) {
      cancelKitEdit();
      return;
    }

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
   * เพดานจำนวนตัวเลือกที่แสดงในกล่องแนะนำ
   *
   * แค็ตตาล็อกมีสองพันกว่ารายการ การวาดทั้งหมดคือโหนดหลายพันตัวที่ต้องสร้างใหม่
   * ทุกครั้งที่พิมพ์หนึ่งตัวอักษร และเป็นรายการที่ยาวเกินกว่าจะกวาดตาหาได้อยู่ดี
   * เกินเพดานเมื่อไร กล่องจะบอกให้พิมพ์เพิ่ม ไม่ตัดทิ้งเงียบ ๆ
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
   * แถวที่ใช้ตอน "เปิดดูเพื่อเลือกใหม่" -- คือตอนคลิกช่องที่มีพัสดุเลือกค้างอยู่แล้ว
   *
   * ถ้าค้นด้วยข้อความในช่องตามปกติ ช่องที่มีชื่อเต็มของตัวที่เลือกไว้จะค้นเจอแต่
   * ตัวเดิมตัวเดียว คนที่เลือกผิดจึงเปลี่ยนตัวไม่ได้เลยนอกจากลบข้อความทิ้งทั้งหมด
   * (อาการ "ล็อกไม่ให้เลือกใหม่" ที่เจ้าของงานแจ้งมา) ที่นี่จึงไม่สนข้อความในช่อง:
   * เลือกกลุ่มไว้ก็แสดงทั้งกลุ่ม ไม่ได้เลือกก็แสดงพัสดุกลุ่มเดียวกับตัวที่เลือกค้างไว้
   * ซึ่งตรงกับกรณีที่เจอบ่อยที่สุด -- เลือกผิดขนาดสาย/ขนาดหม้อแปลง ตัวที่ถูกมักอยู่
   * กลุ่มเดียวกัน คืน null เมื่อไม่มีขอบเขตให้เปิดดู (ให้กลับไปค้นตามข้อความตามปกติ)
   */
  function browseRows() {
    if (estimateView.pickGroup.value) return scopedRows();
    if (pickedItem && pickedItem.group) return itemsForGroup(pickedItem.group);
    return null;
  }

  /**
   * ชื่อรายการที่ "มีคำที่พิมพ์อยู่ในนั้น" (ค้นแบบ substring)
   *
   * คืน null เมื่อยังพิมพ์ไม่ถึงจำนวนตัวอักษรขั้นต่ำ (กล่องต้องปิด ไม่ใช่ขึ้นว่า
   * "ไม่พบ") และคืนแถวแค็ตตาล็อกตัวจริง ไม่ใช่แค่ข้อความ -- ชื่อซ้ำกันได้ในแค็ตตาล็อก
   * การเลือกด้วยตัวแถวจึงได้รหัสที่ถูกตัวเสมอ ต่างจาก datalist เดิมที่ได้กลับมาแค่
   * ข้อความ แล้วต้องเดาเอาแถวแรกที่ชื่อตรงกัน
   */
  function searchDescriptions(browse) {
    const browsing = browse ? browseRows() : null;
    const rows = browsing || scopedRows();
    const q = browsing ? "" : estimateView.pickItem.value.trim().toLowerCase();
    if (!browsing && q.length < suggestMinChars()) return null;

    const items = [];
    let more = false;
    for (const item of rows) {
      if (!item.description) continue;
      if (!q || item.description.toLowerCase().includes(q)) {
        if (items.length >= SEARCH_LIMIT) { more = true; break; }
        items.push(item);
      }
    }
    return { items, more };
  }

  /**
   * เสนอ KeyCode ตามลำดับตัวอักษรที่พิมพ์ -- รหัสที่ "ขึ้นต้นด้วย" คำที่พิมพ์มาก่อนเสมอ
   *
   * รหัสพัสดุคนอ่านจากซ้ายไปขวา พิมพ์ไปทีละตัวเพื่อไล่ให้แคบลง การเอารหัสที่บังเอิญ
   * มีเลขชุดนั้นอยู่กลางรหัสขึ้นมาปนก่อน จะทำให้ตัวที่กำลังไล่หาถูกดันตกไป -- แต่ก็ยัง
   * เก็บพวกที่ตรงกลางไว้ท้ายรายการ เผื่อคนจำได้แค่ท่อนกลางของรหัส
   */
  function searchKeyCodes(browse) {
    const browsing = browse ? browseRows() : null;
    const rows = browsing || scopedRows();
    const q = browsing ? "" : estimateView.pickKeyCode.value.trim().toLowerCase();
    if (!browsing && q.length < suggestMinChars()) return null;

    const starts = [];
    const inside = [];
    let more = false;
    for (const item of rows) {
      const code = String(item.keyCode || "");
      if (!code) continue;

      const lower = code.toLowerCase();
      if (!q || lower.startsWith(q)) starts.push(item);
      else if (lower.includes(q)) inside.push(item);

      if (starts.length > SEARCH_LIMIT) { more = true; break; }
    }

    const all = starts.concat(inside);
    if (all.length > SEARCH_LIMIT) more = true;
    return { items: all.slice(0, SEARCH_LIMIT), more };
  }

  /**
   * กล่องรายการแนะนำใต้ช่องพิมพ์ -- ใช้ร่วมกันทั้งช่องรหัสพัสดุและช่องรายการพัสดุ
   *
   * มีไว้แทน <datalist> ของเบราว์เซอร์ ซึ่งตัดชื่อพัสดุยาวทิ้งและจัดหน้าตาไม่ได้
   * ชื่อในแค็ตตาล็อกมักต่างกันแค่ท้ายชื่อ (ขนาดสาย ขนาดหม้อแปลง) เห็นไม่ครบก็เลือก
   * ผิดตัวได้ง่าย กล่องนี้แสดงรหัส ชื่อเต็ม (ขึ้นบรรทัดใหม่ได้) และกลุ่มของทุกตัวเลือก
   * การเลือกส่งแถวแค็ตตาล็อกตัวจริงให้ onPick ไม่ใช่ข้อความ
   *
   * isPicked บอกว่าช่องนี้กำลังถือพัสดุที่เลือกไว้แล้วหรือไม่ -- ถ้าใช่ การคลิก
   * ช่องจะเปิดกล่องแบบ "ดูเพื่อเลือกใหม่" (ดู browseRows) และเลือกข้อความทั้งหมด
   * ไว้ให้ พิมพ์ทับได้ทันที ตัวที่เลือกค้างไว้ถูกไฮไลต์และเลื่อนมาให้เห็นในกล่อง
   *
   * รายละเอียดที่แตกง่าย:
   * - เลือกด้วย mousedown + preventDefault ไม่ใช่ click -- ถ้าใช้ click ช่องพิมพ์จะ
   *   เสียโฟกัสก่อน blur ปิดกล่องทิ้ง แล้ว click จะไปตกที่ตัวเลือกที่ถูกลบไปแล้ว
   * - ข้อความทุกชิ้นใส่ด้วย textContent ไม่ใช้ innerHTML -- แค็ตตาล็อกเป็นข้อมูลที่
   *   วางมือลงชีต ต้องถือว่าเป็นข้อความดิบเสมอ
   * - คลิกซ้ำในช่องที่โฟกัสอยู่แล้วไม่ยิง focus อีก จึงต้องฟัง mousedown ของช่องด้วย
   *   ไม่งั้นปิดกล่องด้วย Esc แล้วคลิกช่องเดิมจะเปิดกล่องกลับมาไม่ได้
   * - ใช้คีย์บอร์ดได้ครบ (ลูกศรขึ้นลง / Enter / Esc) และตั้ง aria-activedescendant
   *   ให้โปรแกรมอ่านหน้าจอรู้ว่ากำลังชี้ตัวเลือกไหนอยู่
   */
  function wireSuggestBox({ input, box, search, isPicked, onPick }) {
    let items = [];
    let active = -1;

    function close() {
      box.hidden = true;
      box.innerHTML = "";
      items = [];
      active = -1;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }

    function setActive(index) {
      const options = box.querySelectorAll(".est-suggest-option");
      options.forEach((el, i) => {
        const on = i === index;
        el.classList.toggle("is-active", on);
        el.setAttribute("aria-selected", on ? "true" : "false");
      });
      active = index;
      if (index >= 0 && options[index]) {
        input.setAttribute("aria-activedescendant", options[index].id);
        options[index].scrollIntoView({ block: "nearest" });
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }

    function pick(index) {
      const item = items[index];
      if (!item) return;
      close();
      onPick(item);
    }

    function render(browse) {
      const result = search(Boolean(browse));
      if (!result) {
        close();
        return;
      }

      items = result.items;
      active = -1;
      box.innerHTML = "";
      input.removeAttribute("aria-activedescendant");

      if (!items.length) {
        const empty = document.createElement("li");
        empty.className = "est-suggest-empty";
        empty.textContent = "ไม่พบรายการที่ตรงกับคำค้น";
        box.appendChild(empty);
      }

      items.forEach((item, index) => {
        const option = document.createElement("li");
        option.className = "est-suggest-option";
        if (item === pickedItem) option.classList.add("is-picked");
        option.id = `${box.id}-opt-${index}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");

        const key = document.createElement("span");
        key.className = "est-suggest-key";
        key.textContent = item.keyCode || "—";

        const desc = document.createElement("span");
        desc.className = "est-suggest-desc";
        desc.textContent = item.description || "";

        option.append(key, desc);

        if (item.group) {
          const group = document.createElement("span");
          group.className = "est-suggest-group";
          group.textContent = `กลุ่ม ${item.group}`;
          option.appendChild(group);
        }

        option.addEventListener("mousedown", (e) => {
          e.preventDefault();
          pick(index);
        });
        option.addEventListener("mousemove", () => {
          if (active !== index) setActive(index);
        });

        box.appendChild(option);
      });

      if (result.more) {
        const more = document.createElement("li");
        more.className = "est-suggest-more";
        more.textContent = `แสดง ${SEARCH_LIMIT} รายการแรก -- พิมพ์เพิ่มเพื่อค้นให้แคบลง`;
        box.appendChild(more);
      }

      box.hidden = false;
      input.setAttribute("aria-expanded", "true");

      // เปิดดูเพื่อเลือกใหม่ -- ชี้ไว้ที่ตัวที่เลือกค้างอยู่ ให้เห็นทันทีว่าตอนนี้คือตัวไหน
      const current = items.indexOf(pickedItem);
      if (current !== -1) setActive(current);
    }

    /** เปิดกล่องจากการคลิก/โฟกัส -- ช่องที่ถือพัสดุที่เลือกไว้แล้วเปิดแบบดูเพื่อเลือกใหม่ */
    function openFromPointer() {
      if (isPicked()) {
        // setTimeout เพราะ mouseup หลังคลิกจะวางเคอร์เซอร์ทับการเลือกข้อความทันที
        setTimeout(() => input.select(), 0);
        render(true);
      } else {
        render(false);
      }
    }

    input.addEventListener("focus", openFromPointer);
    input.addEventListener("mousedown", () => {
      if (document.activeElement === input && box.hidden) openFromPointer();
    });

    input.addEventListener("keydown", (e) => {
      if (box.hidden) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          render(isPicked());
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (items.length) setActive(Math.min(active + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (items.length) setActive(Math.max(active - 1, 0));
      } else if (e.key === "Enter") {
        if (active >= 0) {
          e.preventDefault();
          pick(active);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab") {
        close();
      }
    });

    input.addEventListener("blur", close);

    return { render, close };
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

    // กันไว้เผื่อเข้าหน้านี้มาระหว่างที่ editingKit ยังค้างอยู่จากรอบก่อน (เช่น
    // เซสชันหมดอายุกลางคันตอนกำลังแก้ไขชุดเซ็ต ซึ่งข้ามปุ่มย้อนกลับที่คอยเคลียร์
    // สถานะนี้ไปโดยตรง) ไม่รีเซ็ตตรงนี้ currentJob() จะยังคืนชุดเซ็ตเก่าแทนงานย่อย
    // จริงของคำร้องใบใหม่ที่เพิ่งเปิด
    editingKit = null;
    estimateView.jobHead.hidden = false;
    estimateView.kitsBlock.hidden = false;
    estimateView.kitEditHead.hidden = true;
    document.getElementById("estimatePrintBtn").hidden = false;
    document.getElementById("estimateSaveBtn").hidden = false;

    estimateView.contextWbs.textContent = record.wbs ? `WBS: ${record.wbs}` : "ยังไม่มีเลข WBS";
    estimateView.contextCustomer.textContent =
      [record.requestNumber, record.customerName].filter(Boolean).join(" · ");

    showView("estimate");
    showEstimateLevel(0);

    if (estimateCatalog === null) {
      estimateCatalogFailed = false;
      estimateView.catalogNote.textContent = "กำลังโหลดรายการพัสดุจากชีต…";
    }

    ensureEstimateCatalog()
      .then(() => {
        // แค็ตตาล็อกมาช้ากว่าการวาดหน้าจอได้ -- ถ้าตอนวาดยังไม่มีข้อมูล ดรอปดาวน์
        // จะว่าง จึงวาดใบที่เปิดอยู่ใหม่เมื่อข้อมูลมาถึง
        if (!estimateView.formPane.hidden) renderEstimateForm();
      })
      .catch(err => {
        console.error("CS Connect estimate catalog error:", err);
        estimateCatalogFailed = true;
        estimateView.catalogNote.textContent =
          "โหลดรายการตั้งต้นไม่สำเร็จ — ลองเปิดหน้านี้ใหม่อีกครั้ง";
        // วาดแผงเลือกใหม่ให้ดรอปดาวน์เปลี่ยนจาก "กำลังโหลด" เป็น "โหลดไม่สำเร็จ"
        if (!estimateView.formPane.hidden) renderEstimateForm();
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

    // ช่องพิมพ์บรรทัดเดียวกับรายการแนะนำของเบราว์เซอร์ตัดชื่อยาวทิ้ง -- แสดงชื่อเต็ม
    // ของตัวที่เลือกไว้ใต้แผง ให้ตรวจได้ก่อนกดเพิ่มว่าเลือกถูกตัว
    const full = estimateView.pickFull;
    if (pickedItem) {
      full.textContent = "รายการที่เลือก: " +
        [pickedItem.keyCode, pickedItem.description].filter(Boolean).join("  ") +
        (pickedItem.group ? `  (กลุ่ม ${pickedItem.group})` : "");
      full.hidden = false;
    } else {
      full.textContent = "";
      full.hidden = true;
    }
    estimateView.pickItem.title = pickedItem ? pickedItem.description : "";
  }

  /** ล้างช่องพัสดุทั้งหมด (ไม่แตะกลุ่ม) -- ใช้หลังเพิ่มพัสดุสำเร็จและตอนเปิดใบใหม่ */
  function clearItemPick() {
    estimateView.pickIn.value = "";
    estimateView.pickRm.value = "";
    estimateView.pickRp.value = "";
    setPickedItem(null);
  }

  function resetItemPicker() {
    const placeholder = estimateCatalog !== null
      ? "-- ทุกกลุ่ม (พิมพ์ค้นหา) --"
      : estimateCatalogFailed
        ? "-- โหลดรายการพัสดุไม่สำเร็จ --"
        : "กำลังโหลดรายการพัสดุ…";
    fillSelect(estimateView.pickGroup, catalogGroups(), "", placeholder);
    clearItemPick();
    hideError(estimateView.pickError);
    syncItemPickerScope();
    syncPickerAvailability();
  }

  /**
   * ล็อกแผงเลือกพัสดุไว้จนกว่าแค็ตตาล็อกจะโหลดเสร็จ
   *
   * แค็ตตาล็อกโหลดตอนเปิดหน้าประมาณการครั้งแรก และมาช้ากว่าการวาดหน้าจอได้ ก่อนมี
   * ตัวนี้ ดรอปดาวน์กลุ่มจะว่างเปล่าอยู่ช่วงหนึ่งโดยไม่มีอะไรบอก คนจึงเข้าใจว่า
   * "กลุ่มไม่ขึ้นให้เลือก" (เจ้าของงานเจอจริง) ช่องค้นพัสดุก็ค้นอะไรไม่เจอเหมือน
   * แค็ตตาล็อกว่าง ระหว่างรอจึงล็อกทุกช่อง และให้ดรอปดาวน์กลุ่มบอกสถานะแทน
   *
   * setEstimatePageBusy(false) เรียกตัวนี้ต่อท้ายด้วย -- ไม่งั้นกดบันทึกเสร็จระหว่าง
   * ที่แค็ตตาล็อกยังโหลดไม่เสร็จ ช่องจะถูกปลดล็อกทั้งที่ยังไม่มีข้อมูล
   */
  function syncPickerAvailability() {
    const locked = estimateCatalog === null;
    [
      estimateView.pickGroup,
      estimateView.pickItem,
      estimateView.pickKeyCode,
      estimateView.pickIn,
      estimateView.pickRm,
      estimateView.pickRp,
      estimateView.kitSelect,
      estimateView.kitAddBtn,
      document.getElementById("estAddItemBtn")
    ].forEach(el => { if (el) el.disabled = locked; });
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
    // ไม่เปิดกล่องให้เองตอนเปลี่ยนกลุ่ม -- กล่องที่เด้งขึ้นมาทั้งที่ไม่ได้คลิกช่องไหน
    // จะบังแผงด้านล่าง กล่องเปิดเองเมื่อคลิกหรือพิมพ์ในช่อง
    itemSuggest.close();
    keySuggest.close();
  }

  estimateView.pickGroup.addEventListener("change", () => {
    hideError(estimateView.pickError);
    syncItemPickerScope();
  });

  // เลือกจากกล่องแนะนำ = ได้แถวแค็ตตาล็อกตัวจริง เติมทั้งสองช่องให้พร้อมกัน
  // (ไม่ส่ง typedField เพราะไม่มีช่องไหนที่กำลังพิมพ์ค้างอยู่แล้ว)
  const itemSuggest = wireSuggestBox({
    input: estimateView.pickItem,
    box: estimateView.pickItemSuggest,
    search: searchDescriptions,
    isPicked: () => Boolean(pickedItem) && estimateView.pickItem.value === pickedItem.description,
    onPick: (item) => {
      hideError(estimateView.pickError);
      setPickedItem(item);
    }
  });

  const keySuggest = wireSuggestBox({
    input: estimateView.pickKeyCode,
    box: estimateView.pickKeySuggest,
    search: searchKeyCodes,
    isPicked: () => Boolean(pickedItem) && estimateView.pickKeyCode.value === (pickedItem.keyCode || ""),
    onPick: (item) => {
      hideError(estimateView.pickError);
      setPickedItem(item);
    }
  });

  // input คือการพิมพ์เอง -- การเลือกจากกล่องแนะนำไปทาง onPick ข้างบน
  estimateView.pickItem.addEventListener("input", () => {
    hideError(estimateView.pickError);
    itemSuggest.render(false);

    // ตรงกับชื่อในแค็ตตาล็อกพอดีเท่านั้นจึงนับว่าเลือกแล้ว -- พิมพ์ค้างครึ่งทางยังไม่ใช่
    const typed = estimateView.pickItem.value;
    const exact = typed ? scopedRows().find(i => i.description === typed) : null;
    setPickedItem(exact, "desc");
  });

  estimateView.pickKeyCode.addEventListener("input", () => {
    hideError(estimateView.pickError);
    keySuggest.render(false);

    const typed = estimateView.pickKeyCode.value.trim();
    const exact = typed ? scopedRows().find(i => (i.keyCode || "") === typed) : null;
    setPickedItem(exact, "key");
  });

  // การเปิดกล่องตอนคลิก/โฟกัสอยู่ใน wireSuggestBox แล้ว -- คลิกช่องว่าง ๆ ตอนเลือก
  // กลุ่มไว้ยังเห็นรายการทั้งกลุ่มเหมือนเดิม (suggestMinChars = 0)

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

    // ปุ่มสร้าง/ลบ/แก้ไขตรง ๆ ซ่อนไว้กับคนที่ไม่ใช่ผู้ดูแลระบบ -- เป็นแค่การจัดหน้าจอ
    // ของจริงกันที่ requireAdmin_ ฝั่งเซิร์ฟเวอร์ ซึ่งใครแก้ flag ในเบราว์เซอร์ก็ผ่านไม่ได้
    const admin = Boolean((getSession() || {}).isAdmin);
    estimateView.kitSaveBtn.hidden = !admin;
    estimateView.kitDeleteBtn.hidden = !admin;
    estimateView.kitEditBtn.hidden = !admin;

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

  /* ---------- แก้ไขชุดเซ็ตโดยตรง (ผู้ดูแลระบบ) ---------- */

  estimateView.kitEditBtn.addEventListener("click", () => {
    hideError(estimateView.kitError);

    const kit = currentKit();
    if (!kit) {
      showError(estimateView.kitError, "กรุณาเลือกชุดเซ็ตที่ต้องการแก้ไขก่อน");
      return;
    }

    // ใบประมาณการของคำร้องนี้มีของที่ยังไม่ได้บันทึกอยู่ -- การแก้ชุดเซ็ตไม่ได้
    // แตะใบนี้เลย แต่ถ้าออกจากหน้าระหว่างแก้ชุดเซ็ต (ปุ่มย้อนกลับ) จะเสียของที่
    // พิมพ์ค้างไว้ไปด้วย เตือนไว้ก่อนดีกว่าให้แปลกใจทีหลัง
    if (estimateDirty && !window.confirm(
      "ใบประมาณการนี้ยังไม่ได้บันทึก การแก้ไขชุดเซ็ตไม่กระทบใบนี้ "
      + "แต่ถ้าออกจากหน้าระหว่างแก้ไขชุดเซ็ต จะเสียของที่พิมพ์ค้างไว้ในใบนี้ไปด้วย ดำเนินการต่อหรือไม่?"
    )) return;

    openKitEditor(kit);
  });

  estimateView.kitEditCancelBtn.addEventListener("click", () => {
    cancelKitEdit();
  });

  estimateView.kitEditSaveBtn.addEventListener("click", async () => {
    if (!editingKit) return;
    hideError(estimateView.kitError);

    const name = estimateView.kitEditName.value.trim();
    if (!name) {
      showError(estimateView.kitError, "กรุณาตั้งชื่อชุดเซ็ต");
      return;
    }

    const items = (editingKit.items || [])
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
      showError(estimateView.kitError, "ชุดเซ็ตต้องมีพัสดุอย่างน้อยหนึ่งรายการ");
      return;
    }

    const kitId = editingKit.id;

    try {
      setBusy(estimateView.kitEditSaveBtn, true, "กำลังบันทึก...");

      const result = await backend.saveEstimateKit({
        id: kitId,
        name,
        note: estimateView.kitEditNote.value.trim(),
        items
      });

      estimateKits = result.kits || [];
      closeKitEditor();
      // เลือกชุดเดิมค้างไว้ใน dropdown ต่อ จะได้เห็นผลที่เพิ่งบันทึกในตัวเลือกทันที
      estimateView.kitSelect.value = String(kitId);
      refreshKitControls();

      showError(estimateView.kitError, `บันทึกการแก้ไขชุดเซ็ต “${name}” แล้ว (${items.length} รายการ)`);
      estimateView.kitError.classList.add("is-notice");
    } catch (err) {
      console.error("CS Connect edit kit error:", err);
      showError(estimateView.kitError, friendlyError(err, "บันทึกการแก้ไขชุดเซ็ตไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(estimateView.kitEditSaveBtn, false);
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
    if (!busy) syncPickerAvailability();
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
  // เนื้อหาคงที่ ไม่ได้ผูกกับคำร้องใบไหน จึงแทนที่ธาตุว่างในหน้าด้วยเนื้อหาจริง
  // ครั้งเดียวตรงนี้ (ใช้ buildServiceLinkItem ตัวเดียวกับหน้าการ์ด) แล้ว
  // setWorkKind() แค่สลับ hidden เอาตามประเภทงานที่กำลังดูอยู่
  const extendListSheetLink = buildServiceLinkItem(
    "Google Sheet: สถานะงานขอติดตั้งมิเตอร์หม้อแปลงผู้ใช้ไฟเฉพาะราย",
    "https://docs.google.com/spreadsheets/d/1C9F_aCpQBImgn4_Eb0t5pPQrJUZjC06U0IyEK1LxX_w/edit?usp=sharing"
  );
  extendListSheetLink.id = "extendListSheetLink";
  extendListSheetLink.className = "service-link-item work-sheet-link";
  document.getElementById("extendListSheetLink").replaceWith(extendListSheetLink);
  const extendPaneNotice = document.getElementById("extendPaneNotice");
  const extendWorkChips = document.getElementById("extendWorkChips");
  const extendWorkTitle = document.getElementById("extendWorkTitle");
  const extendWorkCount = document.getElementById("extendWorkCount");
  const extendWorkAddBtn = document.getElementById("extendWorkAddBtn");
  const extendWorkSearch = document.getElementById("extendWorkSearch");
  const extendWorkDateFrom = document.getElementById("extendWorkDateFrom");
  const extendWorkDateTo = document.getElementById("extendWorkDateTo");
  const extendWorkDateClearBtn = document.getElementById("extendWorkDateClearBtn");
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

  /**
   * หน้าคิวงานกำลังแสดงงานประเภทไหน -- "extend" หรือ "power"
   *
   * หน้างานขยายเขตฯ กับหน้างานขอใช้ไฟฟ้าเป็นหน้าเดียวกันทั้งหน้า (รายการ ชิป
   * การจ่ายงาน หน้ารายละเอียด) ต่างกันแค่ข้อมูลที่กรอง ชุดสถานะ ชื่อหัวหน้า และแท็บ
   * ในหน้ารายละเอียด ทำเป็นสองชุดคือโค้ดราว 800 บรรทัดที่ต้องแก้ให้ตรงกันตลอดไป
   * -- ตัวแปรนี้ตัวเดียวคือจุดที่ตัดสินว่าต่างกันตรงไหน (ดู setWorkKind)
   */
  let workKind = "extend";

  const WORK_KIND_TITLES = {
    extend: "งานขยายเขตระบบจำหน่ายไฟฟ้า",
    power: "งานขอใช้ไฟฟ้า"
  };

  let extendFilter = EXTEND_FILTER_ALL;
  let extendSearchQuery = "";
  // ตัวกรองช่วงวันที่รับคำร้อง (YYYY-MM-DD ตรงรูปแบบที่ receivedDate เก็บอยู่
  // แล้ว เทียบแบบ string ได้ตรงลำดับเวลาพอดีเหมือน compareRequestsByReceivedThenNumber
  // ไม่ต้อง parse เป็น Date) ว่าง = ไม่กรองด้านนั้น ใช้ดูว่าช่วงเวลาหนึ่งมีคำร้อง
  // เข้ามากี่ใบ (เลข "ทั้งหมด N รายการ" ข้างชื่อมุมมองจะสะท้อนตามช่วงที่กรองไว้)
  let extendDateFrom = "";
  let extendDateTo = "";
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
    const select = workKind === "power" ? document.getElementById("reqJobStatus") : extJobStatus;
    return Array.from(select.options).map(o => o.value).filter(Boolean);
  }

  /**
   * สลับหน้าคิวงานไปเป็นงานอีกประเภท
   *
   * เปลี่ยนประเภทแล้วต้องล้างมุมมองเดิมทิ้ง -- ชิปที่เลือกค้างไว้ (เช่น "คิวรอสำรวจ"
   * หรือสถานะของงานขยายเขตฯ) ไม่มีความหมายกับอีกประเภท ปล่อยค้างไว้จะได้หน้าว่าง
   * ที่ดูเหมือนไม่มีงาน ส่วนการกลับมาประเภทเดิม (keepView) ไม่ผ่านทางนี้ มุมมองจึงคงอยู่
   */
  function setWorkKind(kind) {
    if (!WORK_KIND_TITLES[kind]) return;

    if (kind !== workKind) {
      workKind = kind;
      extendFilter = EXTEND_FILTER_ALL;
      extendSearchQuery = "";
      extendWorkSearch.value = "";
      extendDateFrom = "";
      extendDateTo = "";
      extendWorkDateFrom.value = "";
      extendWorkDateTo.value = "";
      extendPersonEmail = "";
      extendSelection.clear();
    }

    document.getElementById("extendWorkTopTitle").textContent = WORK_KIND_TITLES[workKind];
    // ขอใช้ไฟฟ้ามีแท็บเดียว -- รายละเอียดคำร้อง
    extendPaneItems.forEach(item => {
      item.hidden = workKind !== "extend" && item.dataset.extendPane !== "form";
    });
    // คอลัมน์ซ้าย (#extendWorkSide) อยู่เสมอทั้งสองประเภทงาน -- ลิงก์ Google Sheet
    // เป็นของขอใช้ไฟฟ้าเท่านั้น จึงซ่อนแค่ตัวลิงก์ ส่วนงานขยายเขตฯ ปล่อยคอลัมน์ว่างไว้
    extendListSheetLink.hidden = workKind !== "power";
  }

  /**
   * ย้ายฟอร์มคำร้อง (ขอใช้ไฟฟ้า/ขอขยายเขตฯ/คำร้องทั่วไป/ขอเงินประกันคืน) กับ
   * แผงประวัติเข้า/ออกจากหน้ารายละเอียดของโมดูลนี้ -- เดิมรองรับแค่ 2 ประเภท
   * (ขอใช้ไฟฟ้า/ขอขยายเขตฯ) ขยายเป็น 4 ประเภทตอนเพิ่มงานคำร้องทั่วไป/ขอรับเงิน
   * ประกันเข้าโมดูลงานเดียวกันนี้ด้วย (ดู workKind)
   *
   * ย้ายโหนดจริงด้วย appendChild ไม่ได้ก๊อบมาร์กอัปมาไว้สองที่ -- แต่ละฟอร์มยาว
   * หลายร้อยบรรทัดและมี event ผูกไว้เต็มไปหมด สองชุดคือสองชุดที่ต้องแก้ให้ตรงกัน
   * ตลอดไป ส่วนการย้ายโหนดพา event กับค่าที่กรอกไว้ไปด้วยทั้งหมด
   *
   * บ้านเดิมของทั้งสี่อันอยู่ในหน้างานรับคำร้อง (ทุกฟอร์มใช้แผงประวัติตัวเดียวกัน)
   * จึงต้องย้ายกลับทุกครั้งที่เปิดฟอร์มประเภทอื่น
   */
  const FORM_ELEMENTS = { power: requestForm, extend: extendForm };

  // จุดยึดตำแหน่งเดิมของฟอร์มขอใช้ไฟฟ้าในหน้ารับคำร้อง -- ต้องกลับไปที่ "เดิม" จริง
  // ไม่ใช่ต่อท้าย .form-main เพราะ #batchResult กับฟอร์มอื่นอยู่ในกล่องเดียวกัน
  // และลำดับของมันมีผลตอนโหมดเพิ่มหลายคำร้อง -- อีกสามฟอร์มไม่มีโหมดกลุ่มและไม่มี
  // sibling ที่แคร์ลำดับ จึงจำแค่ parentElement เดิมพอ (เหมือนที่ extendForm เคยทำ)
  const requestFormAnchor = document.createComment("requestForm home");
  requestForm.parentElement.insertBefore(requestFormAnchor, requestForm);
  const FORM_HOMES = { extend: extendForm.parentElement };
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

  /** ส่งฟอร์มประเภทหนึ่งกลับบ้านเดิมของมันในหน้างานรับคำร้อง ถ้ายังไม่ได้อยู่ที่นั่น */
  function sendFormHome(type) {
    const form = FORM_ELEMENTS[type];
    if (type === "power") {
      if (form.previousSibling !== requestFormAnchor) {
        requestFormAnchor.parentNode.insertBefore(form, requestFormAnchor.nextSibling);
      }
      return;
    }
    const home = FORM_HOMES[type];
    if (form.parentElement !== home) home.appendChild(form);
  }

  /** type = ประเภทฟอร์มที่จะวางในหน้ารายละเอียด อีกสามประเภทกลับบ้านหมด */
  function mountExtendDetail(type) {
    const target = FORM_ELEMENTS[type] || extendForm;

    Object.keys(FORM_ELEMENTS).forEach(key => {
      if (FORM_ELEMENTS[key] !== target) sendFormHome(key);
    });

    if (target.parentElement !== extendPaneForm) extendPaneForm.appendChild(target);
    if (requestFormMeta.parentElement !== extendPaneMeta) extendPaneMeta.appendChild(requestFormMeta);
    placeSummaryCard();
  }

  function unmountExtendDetail() {
    Object.keys(FORM_ELEMENTS).forEach(sendFormHome);
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
    return getRequests().filter(r => r.type === workKind);
  }

  /**
   * ประเภทงานไหนเปิดใช้การจ่ายงานอยู่ -- สวิตช์เดียวของทั้งหน้า
   *
   * ต้องตรงกับ ASSIGNABLE_TYPES ใน Code.gs เสมอ -- ด่านจริงอยู่ฝั่งนั้น ถ้าเปิดฝั่งนี้
   * อย่างเดียว หัวหน้าจะเห็นปุ่มที่เซิร์ฟเวอร์ปฏิเสธ ถ้าปิดฝั่งนี้อย่างเดียว ปุ่มหาย
   * แต่เซิร์ฟเวอร์ยังรับ (งานขอใช้ไฟฟ้าเคยปิดไว้ช่วงหนึ่ง แล้วเจ้าของงานสั่งเปิด)
   *
   * ประเภทที่ปิดไว้จะซ่อนทุกอย่างที่มีความหมายเฉพาะเมื่อมีการจ่ายงาน: ช่องติ๊ก แถบจ่ายงาน
   * ชิป "งานของฉัน"/"งานในมือแต่ละคน" (ไม่มีใครถูกจ่ายงาน ชิปจะเป็นศูนย์ตลอด)
   * บรรทัด "ยังไม่ได้จ่ายงาน" บนการ์ด และช่องผู้รับผิดชอบในฟอร์ม
   */
  const WORK_KIND_ASSIGNABLE = { extend: true, power: true };

  function workAssignable() {
    return Boolean(WORK_KIND_ASSIGNABLE[workKind]);
  }

  /** หัวหน้างานหรือผู้ดูแลระบบ -- แค่เรื่องการแสดงผล ด่านจริงอยู่ฝั่งเซิร์ฟเวอร์ */
  function canAssignWork() {
    if (!workAssignable()) return false;
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
      { key: EXTEND_FILTER_ALL, label: "ทั้งหมด", count: jobs.length }
    ].concat(workAssignable()
      ? [{ key: EXTEND_FILTER_MINE, label: "งานของฉัน", count: mine }]
      : []
    ).concat(workKind === "extend"
      // คิวรอสำรวจเป็นขั้นตอนของงานขยายเขตฯ เท่านั้น ขอใช้ไฟฟ้าไม่มีสถานะนี้
      ? [{
        key: EXTEND_FILTER_QUEUE,
        label: "คิวรอสำรวจ",
        count: jobs.filter(r => r.jobStatus === EXTEND_SURVEY_STATUS).length
      }]
      : []
    ).concat(canAssignWork()
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
    // คำร้องที่ไม่มีสถานะเลยต้องมีกลุ่มของตัวเองด้วย -- ตอนมุมมองนี้ใช้แค่งานของฉัน
    // ยังพอไม่เจอ แต่พอ "งานทั้งหมด" จัดกลุ่มด้วย ใบที่สถานะว่างจะหายไปจากหน้าจอเงียบ ๆ
    const hasBlank = jobs.some(j => !j.jobStatus);
    const statuses = order.concat(Array.from(new Set(extras))).concat(hasBlank ? [""] : []);

    statuses.forEach(status => {
      const group = jobs.filter(j => (j.jobStatus || "") === status);
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
      badge.textContent = status || "ไม่ระบุสถานะ";

      const count = document.createElement("span");
      count.className = "status-group-count";
      count.textContent = `${group.length} งาน`;

      head.append(caret, badge, count);

      const body = document.createElement("div");
      body.className = "status-group-body";
      sortRequestsForDisplay(group)
        .forEach(record => body.appendChild(renderExtendCard(record)));

      // จำการย่อแยกตามประเภทงาน -- สองประเภทมีสถานะชื่อซ้ำกัน (รอเอกสารเพิ่มเติม
      // ยกเลิกคำร้อง) ย่อกลุ่มในหน้าหนึ่งไม่ควรไปย่อในอีกหน้าด้วย
      const collapseKey = `${workKind}|${status}`;
      const collapsed = extendCollapsed.has(collapseKey);
      section.classList.toggle("is-collapsed", collapsed);
      body.hidden = collapsed;

      head.addEventListener("click", () => {
        const nowCollapsed = !extendCollapsed.has(collapseKey);
        if (nowCollapsed) extendCollapsed.add(collapseKey);
        else extendCollapsed.delete(collapseKey);
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
  function renderPeopleList(jobs, listEl = extendWorkList, onPick = null) {
    listEl.innerHTML = "";

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
      listEl.appendChild(empty);
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
        if (onPick) {
          onPick(person.key);
          return;
        }
        extendPersonEmail = person.key;
        extendSelection.clear();
        renderExtendWork();
      });

      listEl.appendChild(card);
    });
  }

  function renderExtendCard(record) {
    const card = document.createElement("div");
    card.className = "request-card request-card-clickable";
    card.dataset.type = record.type;

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
    if (!workAssignable() && !record.assignee) {
      assigneeEl.remove();
    } else if (record.assignee) {
      assigneeEl.textContent = `ผู้รับผิดชอบ: ${record.assignee}`;
    } else {
      assigneeEl.textContent = "ยังไม่ได้จ่ายงาน";
      assigneeEl.classList.add("is-unassigned");
    }

    // เปิดคำร้องใบนั้นในฟอร์มเดิม (ฟอร์มเดียวกับหน้ารับคำร้อง) เพื่ออัปเดตสถานะ
    // และคอมเมนต์ -- จำไว้ด้วยว่ามาจากหน้านี้ ปุ่มย้อนกลับจะได้พากลับมาถูกที่
    card.addEventListener("click", () => openRequestForm(record.type, record, { returnTo: "extendWork" }));

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

  /** อยู่ในช่วงวันที่รับคำร้องที่กรองไว้ไหม -- ไม่ได้กรองด้านไหนเลยก็ผ่านหมด */
  function extendDateFilterMatches(r) {
    const d = r.receivedDate || "";
    if (extendDateFrom && d < extendDateFrom) return false;
    if (extendDateTo && d > extendDateTo) return false;
    return true;
  }

  function renderExtendWork() {
    const jobs = extendJobs();
    renderExtendChips(jobs);

    extendWorkAddBtn.hidden = false;

    const filtered = sortRequestsForDisplay(jobs
      .filter(extendFilterMatches)
      .filter(extendDateFilterMatches)
      .filter(r => matchesSearch(r, extendSearchQuery)));

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

    // งานทั้งหมด งานของฉัน และงานรายคนของหัวหน้า -- จัดกลุ่มตามสถานะ ย่อ/ขยายได้
    // (งานทั้งหมดจัดกลุ่มด้วยตามที่เจ้าของงานขอ ชิปสถานะเดี่ยว ๆ ยังเป็นรายการเรียบ
    // เพราะทั้งหน้าเป็นสถานะเดียวอยู่แล้ว หัวกลุ่มก้อนเดียวไม่ช่วยอะไร)
    if (extendFilter === EXTEND_FILTER_ALL
      || extendFilter === EXTEND_FILTER_MINE
      || extendFilter === EXTEND_FILTER_PEOPLE) {
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
    if (options.kind) setWorkKind(options.kind);
    else setWorkKind(workKind);

    if (!options.keepView) {
      extendFilter = EXTEND_FILTER_ALL;
      extendSearchQuery = "";
      extendWorkSearch.value = "";
      extendDateFrom = "";
      extendDateTo = "";
      extendWorkDateFrom.value = "";
      extendWorkDateTo.value = "";
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

  // กรองด้วยช่วงวันที่รับคำร้อง -- ดูจำนวนคำร้องที่เข้ามาต่อช่วงเวลา (เลข
  // "ทั้งหมด N รายการ" ข้างชื่อมุมมองจะสะท้อนตามช่วงที่กรองไว้ทันที)
  extendWorkDateFrom.addEventListener("change", () => {
    extendDateFrom = extendWorkDateFrom.value;
    renderExtendWork();
  });

  extendWorkDateTo.addEventListener("change", () => {
    extendDateTo = extendWorkDateTo.value;
    renderExtendWork();
  });

  extendWorkDateClearBtn.addEventListener("click", () => {
    extendDateFrom = "";
    extendDateTo = "";
    extendWorkDateFrom.value = "";
    extendWorkDateTo.value = "";
    renderExtendWork();
  });

  // เพิ่มคำร้องได้ตรงจากหน้านี้เลย -- workKind ตัดสินว่ากำลังเพิ่มขอใช้ไฟฟ้า
  // หรือขยายเขตฯ (โมดูลเดียวกันสลับด้วยตัวแปรนี้อยู่แล้ว) openInWork: true ให้
  // openRequestForm() รู้ว่านี่คือใบใหม่ที่ต้องอยู่ในโมดูลนี้ต่อ ไม่ใช่กระโดดไป
  // หน้างานรับคำร้อง (ดูเหตุผลเต็มที่ openRequestForm) returnTo: "extendWork"
  // ให้บันทึก/ย้อนกลับแล้วเด้งกลับมาที่รายการงานนี้ ไม่ใช่หน้ารับคำร้อง
  extendWorkAddBtn.addEventListener("click", () => {
    openRequestForm(workKind, null, { returnTo: "extendWork", openInWork: true });
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
    rerenderAssignScreen();
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
      rerenderAssignScreen();
    } catch (err) {
      console.error("CS Connect assign error:", err);
      showError(extendAssignError, friendlyError(err, "จ่ายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    } finally {
      setBusy(btn, false);
    }
  });


  // ================================================================ หน้างาน
  // งานขอใช้ไฟฟ้า / งานขยายเขตระบบจำหน่ายไฟฟ้า ใช้หน้ารายการเดียวกับแท็บ
  // ขอใช้ไฟฟ้า/ขอขยายเขตฯ ในงานรับคำร้อง (ตัววาดรายการ/กล่องสรุป/ตัวกรองชุดเดียว)
  // ต่างกันแค่ชื่อบนแถบบน เมนูซ้าย (ของงานนั้นเอง ไม่เอาเมนูงานรับคำร้องมา)
  // และสิ่งที่หัวหน้าใช้: ติ๊กจ่ายงาน + คำร้องในมือแต่ละคน
  //
  // requestsWorkKind = null -> หน้างานรับคำร้องปกติ
  //                    "power" | "extend" -> หน้างานของประเภทนั้น
  // (สถานะ requestsWorkKind/requestsWorkView/requestsPersonKey และ element
  // ของหน้านี้ประกาศไว้ต้นไฟล์ข้าง requestsMineOnly -- renderRequestsList อ่าน
  // มันทุกครั้ง ประกาศไว้ท้ายไฟล์เสี่ยงโดน temporal dead zone)

  // แถบจ่ายงานอยู่ในหน้าคิวงานเดิม (#extendWorkView) -- ย้ายโหนดจริงมาใช้ใน
  // หน้ารายการตอนเป็นหน้างาน แล้วคืนกลับเมื่อออก (appendChild พา listener ไปด้วย
  // เหมือนที่ทำกับฟอร์ม) จุดยึดเป็น comment node เพื่อกลับไปที่ "เดิม" จริง
  const assignNodes = [extendAssignBar, extendAssignError, extendAssignSuccess];
  const assignHomeAnchor = document.createComment("assign bar home");
  extendAssignBar.parentElement.insertBefore(assignHomeAnchor, extendAssignBar);

  function mountAssignBar(inWork) {
    if (inWork) {
      assignNodes.forEach(node => requestsList.parentElement.insertBefore(node, requestsList));
    } else {
      assignHomeAnchor.after(...assignNodes);
    }
  }

  /** ชื่อแถบบน + เมนูซ้าย ตามโหมด -- เรียกทุกครั้งที่วาดรายการ */
  function applyRequestsMode() {
    const inWork = Boolean(requestsWorkKind);
    requestsTopbarTitle.textContent = inWork ? WORK_KIND_TITLES[requestsWorkKind] : "งานรับคำร้อง";
    requestsNavItems.forEach(item => { item.hidden = inWork; });
    workNavItems.forEach(item => {
      const view = item.dataset.workView;
      item.hidden = !inWork || (view === "people" && !canAssignWork());
      item.classList.toggle("active", inWork && view === requestsWorkView);
    });
  }

  function requestsListHeading() {
    if (requestsWorkKind && requestsWorkView === "people") {
      if (requestsPersonKey === null) return "คำร้องในมือแต่ละคน";
      if (!requestsPersonKey) return "คำร้องที่ยังไม่ได้จ่ายงาน";
      const owner = getRequests().find(r => String(r.assigneeEmail || "").toLowerCase() === requestsPersonKey);
      return `คำร้องของ ${owner && owner.assignee ? owner.assignee : requestsPersonKey}`;
    }
    return REQUEST_TYPES[currentRequestFilter];
  }

  function openWorkList(kind) {
    requestsWorkKind = kind;
    requestsWorkView = "list";
    requestsPersonKey = null;
    requestsMineOnly = false;
    setWorkKind(kind);
    extendSelection.clear();
    hideError(extendAssignError);
    extendAssignSuccess.hidden = true;
    mountAssignBar(true);
    switchRequestsTab(kind);
    showView("requests");

    if (canAssignWork()) {
      refreshStaffRoster()
        .then(fillAssigneeSelect)
        .catch(err => {
          console.error("CS Connect staff list error:", err);
          showError(extendAssignError, friendlyError(err, "โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ"));
        });
    }
  }

  function leaveWorkMode() {
    if (!requestsWorkKind) return;
    requestsWorkKind = null;
    requestsWorkView = "list";
    requestsPersonKey = null;
    requestsMineOnly = false;
    extendSelection.clear();
    mountAssignBar(false);
    extendAssignBar.hidden = true;
  }

  workNavItems.forEach(item => {
    item.addEventListener("click", () => {
      requestsWorkView = item.dataset.workView;
      requestsPersonKey = null;
      extendSelection.clear();
      requestsMineOnly = false;
      currentSearchQuery = "";
      requestsSearchInput.value = "";
      renderRequestsList();
    });
  });

  /** หน้ารายชื่อคนของหัวหน้า -- การ์ดหนึ่งใบต่อคน กดแล้วเห็นคำร้องของคนนั้น */
  function renderRequestsPeople(jobs) {
    requestsListTitle.textContent = requestsListHeading();
    requestsListCount.textContent = `ทั้งหมด ${jobs.length} รายการ`;
    requestsSummary.hidden = true;
    requestsSummary.innerHTML = "";
    requestsAddBtn.hidden = true;
    requestsAddBatchBtn.hidden = true;
    requestsMineBtn.hidden = true;
    extendAssignBar.hidden = true;
    renderPeopleList(jobs, requestsList, key => {
      requestsPersonKey = key;
      extendSelection.clear();
      renderRequestsList();
    });
  }

  /** จ่ายงาน/ล้างการเลือกเสร็จ -- วาดหน้าที่ผู้ใช้กำลังดูอยู่จริงใหม่ */
  function rerenderAssignScreen() {
    if (!views.requests.hidden) renderRequestsList();
    else renderExtendWork();
  }

  /**
   * ตะกร้าที่ปุ่มเลือกทั้งหมด/ล้างค่าจะกระทำ -- คืน null เมื่อหน้านี้ไม่มีอะไรให้เลือก
   * (แท็บปกติ หรือโหมดประวัติการส่ง)
   */
  function activeRequestsSelection() {
    if (currentRequestFilter === "meter" && meterMode === "pending") return meterSelection;
    if (currentRequestFilter === "generalDispatch" && generalMode === "pending") return generalSelection;
    if (currentRequestFilter === "revenueDispatch" && revenueMode === "pending") return revenueSelection;
    if (requestsWorkKind && canAssignWork() && !(requestsWorkView === "people" && requestsPersonKey === null)) {
      return extendSelection;
    }
    return null;
  }

  requestsSelectAllBtn.addEventListener("click", () => {
    const selection = activeRequestsSelection();
    if (!selection) return;
    lastRenderedIds.forEach(id => selection.add(id));
    renderRequestsList();
  });

  requestsSelectClearBtn.addEventListener("click", () => {
    const selection = activeRequestsSelection();
    if (!selection) return;
    selection.clear();
    renderRequestsList();
  });

  // ================================================================ เมนูซ้ายย่อ/ขยาย
  // ทุก .requests-sidebar ในแอป (งานรับคำร้อง/หน้างาน และแถบขั้นตอนในหน้า
  // รายละเอียดคำร้อง) -- ย่อแล้วเหลือแต่ไอคอน ชื่อเมนูยังอยู่ใน title ให้ชี้ดูได้
  // จำสถานะไว้ในเบราว์เซอร์เครื่องนี้ (ความสะดวกส่วนตัว ไม่ใช่ข้อมูลที่ต้องแชร์)
  const SIDEBAR_COLLAPSED_KEY = "csconnect_sidebarCollapsed";

  function readSidebarCollapsed() {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"; } catch { return false; }
  }

  function writeSidebarCollapsed(collapsed) {
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* ไม่เป็นไร */ }
  }

  function applySidebarCollapsed(collapsed) {
    document.querySelectorAll(".requests-sidebar").forEach(nav => {
      nav.classList.toggle("is-collapsed", collapsed);
      const toggle = nav.querySelector(".sidebar-toggle");
      if (!toggle) return;
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.title = collapsed ? "ขยายเมนู" : "ย่อเมนู";
      toggle.querySelector(".sidebar-toggle-label").textContent = collapsed ? "ขยายเมนู" : "ย่อเมนู";
    });
  }

  document.querySelectorAll(".requests-sidebar").forEach(nav => {
    // ห่อข้อความชื่อเมนูด้วย span -- ย่อเมนูต้องซ่อนข้อความได้ แต่ข้อความเปล่า
    // (text node) ถูกเลือกด้วย CSS ไม่ได้ ทำครั้งเดียวตอนโหลด ไม่แตะ markup
    nav.querySelectorAll(".requests-nav-item").forEach(item => {
      Array.from(item.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          const label = document.createElement("span");
          label.className = "nav-label";
          label.textContent = node.textContent.trim();
          node.replaceWith(label);
        }
      });
      const label = item.querySelector(".nav-label");
      if (label && !item.title) item.title = label.textContent;
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "sidebar-toggle";
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sidebar-toggle-label"></span>';
    toggle.addEventListener("click", () => {
      const collapsed = !nav.classList.contains("is-collapsed");
      writeSidebarCollapsed(collapsed);
      applySidebarCollapsed(collapsed);
    });
    nav.prepend(toggle);
  });

  applySidebarCollapsed(readSidebarCollapsed());

  // ---------- init ----------
  // Everything downstream reads from the cache synchronously, so the one and
  // only load has to finish before the first screen is painted. Against a
  // network backend that is a visible wait, hence the boot overlay.
  const bootOverlay = document.getElementById("bootOverlay");
  const bootError = document.getElementById("bootError");
  const bootErrorMessage = document.getElementById("bootErrorMessage");

  /**
   * แสดงข้อความจริงของข้อผิดพลาดตอนโหลดข้อมูลแรกไม่สำเร็จ -- ไม่ใช้ข้อความ
   * "เชื่อมต่อฐานข้อมูลไม่สำเร็จ" ตายตัวอีกต่อไป เพราะเคยขึ้นผิดตอนสาเหตุจริง
   * ไม่ใช่เน็ตหลุด (เช่นเซสชันหมดอายุที่หลุดมาไม่ตรงเงื่อนไข AUTH_REQUIRED พอดี)
   * ทำให้ผู้ใช้เข้าใจผิดว่าต้องเช็คอินเทอร์เน็ตทั้งที่ไม่เกี่ยว -- friendlyError()
   * แปลรหัสภายในเป็นภาษาไทยที่อ่านรู้เรื่องอยู่แล้ว จึงใช้ข้อความเดียวกับที่
   * ฟอร์มอื่นในแอปนี้ใช้แจ้งผู้ใช้
   */
  function showBootError(err) {
    console.error("CS Connect: โหลดข้อมูลไม่สำเร็จ", err);
    bootErrorMessage.textContent = friendlyError(err, "เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    bootError.hidden = false;
  }

  // ผูกที่นี่แทน onclick ใน HTML เพราะ CSP บล็อกสคริปต์ inline ทั้งหมด
  // ปุ่มนี้จะมองเห็นได้ก็ต่อเมื่อ init() ล้มเหลวไปแล้ว ซึ่งแปลว่าไฟล์นี้ทำงานอยู่
  // การผูกตรงนี้จึงไม่ทำให้ปุ่มตายในกรณีที่มันถูกใช้จริง
  document.getElementById("bootRetryBtn")
    .addEventListener("click", () => location.reload());

  async function init() {
    let session = getSession();

    // session ของแอปเป็นแค่ข้อมูลแสดงผล -- ถ้า session ของ Auth หายไปแล้ว (ถูกเตะ
    // ออก / ล้างข้อมูลเว็บ) ให้ทิ้งของแอปด้วย ไม่ต้องยิงโหลดที่รู้ว่าจะล้ม
    //
    // ครอบ try/catch ไว้ด้วย -- เดิมไม่มี ถ้า getSession() ของ supabase-js ยิง
    // เครือข่ายไปต่ออายุ token แล้วล้มเหลว (เช่นเน็ตหลุดพอดีจังหวะนี้) exception
    // จะหลุดออกจาก init() ทั้งฟังก์ชันแบบไม่มีใครจับ หน้าจอค้างที่ "กำลังโหลด
    // ข้อมูล..." ตลอดไปโดยไม่มีข้อความหรือปุ่มลองใหม่ให้เลย
    if (session) {
      try {
        if (!(await backend.hasSession())) {
          clearSession();
          session = null;
        }
      } catch (err) {
        showBootError(err);
        return;
      }
    }

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
      // An expired or revoked token is not a connection problem -- drop the
      // dead session and let them sign in again rather than showing a retry
      // button that can never succeed. callAsUser() has usually handled this
      // already by the time we get here; handleAuthExpired() is idempotent, so
      // this stays as the guard for the localBackend path, which never goes
      // through callAsUser at all.
      if (String(err.message).includes("AUTH_REQUIRED")) {
        console.error("CS Connect: โหลดข้อมูลไม่สำเร็จ", err);
        handleAuthExpired();
        return;
      }

      // Otherwise stop at the overlay rather than dropping the user into an
      // app that looks like it has no data -- that would invite them to
      // re-enter work that already exists.
      showBootError(err);
      return;
    }

    bootOverlay.hidden = true;
    enterApp();
    restoreNavState();
  }


  /** ข้อความผิดพลาดที่อ่านรู้เรื่อง -- โมดูลใหม่ทั้งสามใช้ร่วมกัน */
  function moduleErrorText(err) {
    const message = String(err && err.message ? err.message : err || "");
    if (!message || message === "[object Object]") return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
    return message;
  }

  /** อ่านไฟล์เป็น data URL -- รูปแบบเดียวกับที่ backend.uploadBrochureImage รับ */
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
      reader.readAsDataURL(file);
    });
  }

  // ================================================================ โมดูลงานใหม่
  // โบรชัวร์ธุรกิจเสริม / งานเสนอราคา / ระบบรับฟังเสียงของลูกค้า (PEA-VOC)
  //
  // ทั้งสามเก็บในตาราง work_items ตัวเดียวกัน แยกด้วย kind (ดู migration
  // 20260919000001_work_items.sql ว่าทำไมจึงเป็นตารางเดียว) และทั้งสามอ่านผ่าน
  // backend.loadWorkItems() ตรง ๆ ไม่ผ่านชั้นแคชแบบ requestsCache -- เปิดจากหน้า
  // ของตัวเองเท่านั้น ไม่มีหน้าไหนต้องอ่านค่าแบบ synchronous ระหว่างวาดรายการคำร้อง
  //
  // รูปร่างข้อมูลของแต่ละ kind อยู่ใน item.data (jsonb) ส่วน title/status/sortOrder
  // เป็นคอลัมน์จริงเพราะทุกหน้าจอเรียง/ค้น/กรองด้วยสามฟิลด์นี้

  function newWorkItemId() {
    return newRequestId();
  }

  // ---------------------------------------------------------------- โบรชัวร์
  const brochureView = document.getElementById("brochureView");
  const brochureList = document.getElementById("brochureList");
  const brochureCount = document.getElementById("brochureCount");
  const brochureError = document.getElementById("brochureError");
  const brochureAddBtn = document.getElementById("brochureAddBtn");
  const brochureEditModal = document.getElementById("brochureEditModal");
  const brochureEditTitle = document.getElementById("brochureEditTitle");
  const brochureTitleInput = document.getElementById("brochureTitleInput");
  const brochureDescInput = document.getElementById("brochureDescInput");
  const brochureImageInput = document.getElementById("brochureImageInput");
  const brochureEditImages = document.getElementById("brochureEditImages");
  const brochureEditError = document.getElementById("brochureEditError");
  const brochureSaveBtn = document.getElementById("brochureSaveBtn");
  const brochureDeleteBtn = document.getElementById("brochureDeleteBtn");
  const brochureViewerModal = document.getElementById("brochureViewerModal");
  const brochureViewerTitle = document.getElementById("brochureViewerTitle");
  const brochureViewerImage = document.getElementById("brochureViewerImage");
  const brochureViewerNote = document.getElementById("brochureViewerNote");
  const brochureDownloadBtn = document.getElementById("brochureDownloadBtn");
  const brochureCopyBtn = document.getElementById("brochureCopyBtn");

  let brochures = [];

  // โบรชัวร์ที่กำลังแก้อยู่ (null = กำลังสร้างใหม่) และรายการ path รูปของมัน --
  // แยกจาก brochures เพื่อให้กดยกเลิกแล้วของเดิมไม่ถูกแตะ
  let brochureEditing = null;
  let brochureEditPaths = [];

  async function openBrochureView() {
    showView("brochure");
    hideError(brochureError);
    brochureList.innerHTML = '<div class="request-empty">กำลังโหลด...</div>';
    try {
      brochures = await backend.loadWorkItems("brochure");
    } catch (err) {
      brochures = [];
      showError(brochureError, moduleErrorText(err));
    }
    renderBrochures();
  }

  function renderBrochures() {
    brochureList.innerHTML = "";
    const shown = brochures;
    brochureCount.textContent = "ทั้งหมด " + shown.length + " รายการ";

    if (!shown.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = 'ยังไม่มีโบรชัวร์ -- กด "+ เพิ่มโบรชัวร์" เพื่อเริ่ม';
      brochureList.appendChild(empty);
      return;
    }

    shown.forEach(item => {
      const data = item.data || {};
      const images = Array.isArray(data.images) ? data.images : [];

      const card = document.createElement("article");
      card.className = "brochure-card";

      const thumb = document.createElement("div");
      thumb.className = "brochure-thumb";
      if (images.length) {
        const img = document.createElement("img");
        img.alt = item.title || "โบรชัวร์";
        img.loading = "lazy";
        // path -> signed URL ตอนวาดเท่านั้น เหมือนทุกไฟล์แนบในระบบนี้ (ไม่มี
        // public URL อยู่ในโค้ดเลย) -- แปะ data-path ไว้กันกรณี URL มาช้าแล้ว
        // ผู้ใช้เปลี่ยนหน้าไปแล้ว จะได้ไม่เอา URL ไปใส่รูปของรายการอื่น
        img.dataset.path = images[0];
        fileUrl("brochure", images[0]).then(url => {
          if (url && img.dataset.path === images[0]) img.src = url;
        });
        img.addEventListener("click", () => openBrochureViewer(item, 0));
        thumb.appendChild(img);
      } else {
        thumb.textContent = "ยังไม่มีรูป";
        thumb.classList.add("is-empty");
      }

      const body = document.createElement("div");
      body.className = "brochure-body";

      const title = document.createElement("h3");
      title.textContent = item.title || "(ไม่มีชื่อ)";

      const desc = document.createElement("p");
      desc.className = "brochure-desc";
      desc.textContent = data.description || "";

      const actions = document.createElement("div");
      actions.className = "brochure-actions";

      if (images.length) {
        const viewBtn = document.createElement("button");
        viewBtn.type = "button";
        viewBtn.className = "btn btn-primary";
        viewBtn.textContent = images.length > 1 ? `ดูรูป (${images.length})` : "ดูรูป";
        viewBtn.addEventListener("click", () => openBrochureViewer(item, 0));
        actions.appendChild(viewBtn);
      }

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-ghost";
      editBtn.textContent = "แก้ไข";
      editBtn.addEventListener("click", () => openBrochureEditor(item));
      actions.appendChild(editBtn);

      body.append(title, desc, actions);
      card.append(thumb, body);
      brochureList.appendChild(card);
    });
  }

  function openBrochureEditor(item) {
    brochureEditing = item || null;
    brochureEditPaths = item && Array.isArray(item.data?.images) ? item.data.images.slice() : [];
    brochureEditTitle.textContent = item ? "แก้ไขโบรชัวร์" : "เพิ่มโบรชัวร์";
    brochureTitleInput.value = item ? (item.title || "") : "";
    brochureDescInput.value = item ? (item.data?.description || "") : "";
    brochureImageInput.value = "";
    brochureDeleteBtn.hidden = !item;
    hideError(brochureEditError);
    renderBrochureEditImages();
    brochureEditModal.hidden = false;
  }

  function closeBrochureEditor() {
    brochureEditModal.hidden = true;
    brochureEditing = null;
    brochureEditPaths = [];
  }

  function renderBrochureEditImages() {
    brochureEditImages.innerHTML = "";
    brochureEditPaths.forEach(path => {
      const wrap = document.createElement("div");
      wrap.className = "brochure-edit-image";

      const img = document.createElement("img");
      img.alt = "";
      img.dataset.path = path;
      fileUrl("brochure", path).then(url => {
        if (url && img.dataset.path === path) img.src = url;
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-ghost";
      removeBtn.textContent = "ลบรูป";
      // ตัดออกจากรายการเท่านั้น ยังไม่ลบไฟล์บน Storage -- กดยกเลิกแล้วต้องได้ของเดิม
      // คืนครบ ไฟล์ที่ไม่ถูกอ้างถึงหลังบันทึกจึงกลายเป็นไฟล์กำพร้าเล็ก ๆ ซึ่งรับได้
      // สำหรับสื่อการตลาด (ต่างจากไฟล์แนบของคำร้องที่มี detach RPC ดูแลให้)
      removeBtn.addEventListener("click", () => {
        brochureEditPaths = brochureEditPaths.filter(p => p !== path);
        renderBrochureEditImages();
      });

      wrap.append(img, removeBtn);
      brochureEditImages.appendChild(wrap);
    });
  }

  brochureImageInput.addEventListener("change", async () => {
    const files = Array.from(brochureImageInput.files || []);
    if (!files.length) return;
    hideError(brochureEditError);
    setBusy(brochureSaveBtn, true, "กำลังอัปโหลด...");
    try {
      // ทีละไฟล์ ไม่ยิงรวมก้อนเดียว -- ไฟล์ที่สามพังไม่ควรทำให้สองไฟล์แรกที่
      // อัปสำเร็จแล้วหายไปด้วย (เหตุผลเดียวกับการแนบแผนผังหลายไฟล์)
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        const path = await backend.uploadBrochureImage(dataUrl);
        brochureEditPaths.push(path);
      }
      renderBrochureEditImages();
    } catch (err) {
      showError(brochureEditError, moduleErrorText(err));
    } finally {
      setBusy(brochureSaveBtn, false);
      brochureImageInput.value = "";
    }
  });

  brochureAddBtn.addEventListener("click", () => openBrochureEditor(null));
  document.getElementById("brochureCancelBtn").addEventListener("click", closeBrochureEditor);
  brochureEditModal.addEventListener("click", (e) => {
    if (e.target === brochureEditModal) closeBrochureEditor();
  });

  brochureSaveBtn.addEventListener("click", async () => {
    const title = brochureTitleInput.value.trim();
    if (!title) {
      showError(brochureEditError, "กรุณากรอกชื่อโบรชัวร์");
      return;
    }
    hideError(brochureEditError);
    setBusy(brochureSaveBtn, true, "กำลังบันทึก...");
    try {
      await backend.saveWorkItem("brochure", {
        id: brochureEditing ? brochureEditing.id : newWorkItemId(),
        title,
        status: "",
        data: {
          description: brochureDescInput.value.trim(),
          images: brochureEditPaths.slice()
        }
      });
      closeBrochureEditor();
      await openBrochureView();
    } catch (err) {
      showError(brochureEditError, moduleErrorText(err));
    } finally {
      setBusy(brochureSaveBtn, false);
    }
  });

  brochureDeleteBtn.addEventListener("click", async () => {
    if (!brochureEditing) return;
    if (!confirm(`ลบโบรชัวร์ "${brochureEditing.title}" ใช่หรือไม่?`)) return;
    setBusy(brochureDeleteBtn, true, "กำลังลบ...");
    try {
      await backend.deleteWorkItem(brochureEditing.id);
      closeBrochureEditor();
      await openBrochureView();
    } catch (err) {
      showError(brochureEditError, moduleErrorText(err));
    } finally {
      setBusy(brochureDeleteBtn, false);
    }
  });

  /**
   * หน้าต่างดูรูปเต็ม -- ดาวน์โหลด หรือคัดลอกรูปไปวางในไลน์
   *
   * "คัดลอกรูป" ใช้ Clipboard API แบบ image/png ซึ่งเบราว์เซอร์รองรับเฉพาะ PNG
   * (รูปที่เก็บไว้เป็น JPEG หลังย่อ) จึงต้องวาดลง <canvas> แล้ว export เป็น PNG
   * ก่อน -- ไม่ใช่ก๊อบ blob เดิมตรง ๆ
   *
   * บนเบราว์เซอร์/บริบทที่คัดลอกไม่ได้ (Safari เก่า, หน้าไม่ใช่ HTTPS, ผู้ใช้
   * ไม่อนุญาต) จะบอกให้ใช้ปุ่มดาวน์โหลดแทน แทนที่จะเงียบไปเฉย ๆ -- ปุ่มที่กดแล้ว
   * ไม่มีอะไรเกิดขึ้นทำให้คนกดซ้ำแล้วคิดว่าระบบพัง
   */
  let brochureViewerState = { item: null, index: 0 };

  async function openBrochureViewer(item, index) {
    const images = Array.isArray(item.data?.images) ? item.data.images : [];
    if (!images.length) return;
    brochureViewerState = { item, index };
    brochureViewerTitle.textContent = images.length > 1
      ? `${item.title || "โบรชัวร์"} (รูปที่ ${index + 1}/${images.length})`
      : (item.title || "โบรชัวร์");
    brochureViewerNote.hidden = true;
    brochureViewerImage.removeAttribute("src");
    brochureViewerModal.hidden = false;

    const url = await fileUrl("brochure", images[index]);
    if (!url) return;
    brochureViewerImage.src = url;
    brochureViewerImage.alt = item.title || "โบรชัวร์";
    // แอตทริบิวต์ download ถูกเมินเมื่อ href ข้ามโดเมน (Storage อยู่คนละโฮสต์กับ
    // หน้าเว็บ) เบราว์เซอร์จะเปิดรูปแทนที่จะเซฟ -- ดึงเป็น blob แล้วทำ object URL
    // ให้แทน ทำไม่สำเร็จก็ถอยไปใช้ URL ตรง ๆ (อย่างน้อยยังเปิดรูปแล้วกดเซฟเองได้)
    brochureDownloadBtn.href = url;
    brochureDownloadBtn.download = brochureDownloadBtn.download = `${(item.title || "brochure").replace(/[\\/:*?"<>|]/g, "_")}.jpg`;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      if (brochureDownloadObjectUrl) URL.revokeObjectURL(brochureDownloadObjectUrl);
      brochureDownloadObjectUrl = URL.createObjectURL(blob);
      brochureDownloadBtn.href = brochureDownloadObjectUrl;
    } catch (err) {
      console.warn("CS Connect: เตรียมไฟล์ดาวน์โหลดไม่สำเร็จ ใช้ลิงก์ตรงแทน", err);
    }
  }

  // object URL ของไฟล์ที่เตรียมไว้ให้ดาวน์โหลด -- คืนหน่วยความจำก่อนสร้างอันใหม่
  let brochureDownloadObjectUrl = "";

  function closeBrochureViewer() {
    brochureViewerModal.hidden = true;
    brochureViewerImage.removeAttribute("src");
  }

  document.getElementById("brochureViewerCloseBtn").addEventListener("click", closeBrochureViewer);
  brochureViewerModal.addEventListener("click", (e) => {
    if (e.target === brochureViewerModal) closeBrochureViewer();
  });

  brochureCopyBtn.addEventListener("click", async () => {
    brochureViewerNote.hidden = true;
    setBusy(brochureCopyBtn, true, "กำลังคัดลอก...");
    try {
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
        throw new Error("เบราว์เซอร์นี้คัดลอกรูปไม่ได้ กรุณาใช้ปุ่มดาวน์โหลดแทน");
      }
      if (!brochureViewerImage.naturalWidth) {
        throw new Error("รูปยังโหลดไม่เสร็จ กรุณารอสักครู่แล้วลองใหม่");
      }
      const canvas = document.createElement("canvas");
      canvas.width = brochureViewerImage.naturalWidth;
      canvas.height = brochureViewerImage.naturalHeight;
      canvas.getContext("2d").drawImage(brochureViewerImage, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("แปลงรูปไม่สำเร็จ กรุณาใช้ปุ่มดาวน์โหลดแทน");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      brochureViewerNote.textContent = "คัดลอกรูปแล้ว -- ไปที่ไลน์แล้วกดวาง (Ctrl+V) เพื่อส่งให้ลูกค้า";
      brochureViewerNote.hidden = false;
    } catch (err) {
      brochureViewerNote.textContent = moduleErrorText(err);
      brochureViewerNote.hidden = false;
    } finally {
      setBusy(brochureCopyBtn, false);
    }
  });

  // ---------------------------------------------------------- งานเสนอราคา
  /**
   * ใบเสนอราคาคือ "หนังสือภายนอก" ตามแบบที่ 1 ของระเบียบงานสารบรรณ กฟภ. -- หน้าจอ
   * แก้ไขคือกระดาษ A4 หน้าตาเดียวกับที่พิมพ์ออกมา คลิกตรงข้อความไหนก็แก้ตรงนั้น
   * เหมือนพิมพ์ใน Word (ไม่ใช่ฟอร์มกรอกช่องแล้วค่อยไปดูตัวอย่างอีกหน้า)
   *
   * ช่องที่แก้ได้คือ .qf[data-field] ใน #quoPaper -- ชื่อ data-field คือคีย์ใน
   * item.data ตรง ๆ ตัวอ่าน/ตัวเขียนวนทุกช่องเอง เพิ่มช่องใหม่ในหนังสือ = เพิ่ม
   * element ใน index.html อย่างเดียว
   *
   * แก้ไขด้วย contenteditable ไม่ใช่ <textarea> เพราะต้องการให้บนจอตัดบรรทัด/ย่อหน้า
   * ตรงกับกระดาษจริงทุกตัวอักษร (textarea วาดตัวอักษรคนละแบบกับข้อความปกติ) และหน้า
   * พิมพ์ก็คือสำเนาของ element เดียวกันนี้ (ดู printQuotation) ที่แลกมาคือต้องคุม
   * contenteditable เอง: วางข้อความเป็นตัวอักษรล้วนเสมอ (ไม่รับตัวหนา/สี/ตาราง
   * จากที่อื่น) และเก็บเป็นข้อความธรรมดา ไม่เก็บ HTML -- ไม่มีทางที่ข้อความที่เคย
   * บันทึกจะกลายเป็นสคริปต์ตอนวาดกลับ
   *
   * แม่แบบเป็นใบเสนอราคาที่ data.isTemplate = true (status = "แม่แบบ") --
   * "ใช้แม่แบบนี้" คัดลอกเนื้อหาไปเป็นใบใหม่ ใบเดิมไม่ถูกแตะ
   *
   * ค่าตั้งต้นในโค้ดตั้งใจไม่มีชื่อ/เบอร์มือถือของเจ้าหน้าที่ -- ไฟล์นี้เผยแพร่
   * สาธารณะบน GitHub Pages ข้อมูลบุคคลอยู่ในแม่แบบซึ่งเก็บในฐานข้อมูลเท่านั้น
   */
  const quotationListMode = document.getElementById("quotationListMode");
  const quotationFormMode = document.getElementById("quotationFormMode");
  const quotationList = document.getElementById("quotationList");
  const quotationListTitle = document.getElementById("quotationListTitle");
  const quotationCount = document.getElementById("quotationCount");
  const quotationError = document.getElementById("quotationError");
  const quotationNotice = document.getElementById("quotationNotice");
  const quotationSearch = document.getElementById("quotationSearch");
  const quotationAddBtn = document.getElementById("quotationAddBtn");
  const priceItemAddBtn = document.getElementById("priceItemAddBtn");
  const quoTabBtns = document.querySelectorAll("[data-quo-tab]");
  const quotationFormError = document.getElementById("quotationFormError");
  const quotationFormTitle = document.getElementById("quotationFormTitle");
  const quotationFormSubtitle = document.getElementById("quotationFormSubtitle");
  const quotationDeleteBtn = document.getElementById("quotationDeleteBtn");
  const quotationDuplicateBtn = document.getElementById("quotationDuplicateBtn");
  const quotationSaveTemplateBtn = document.getElementById("quotationSaveTemplateBtn");
  const quotationSaveBtn = document.getElementById("quotationSaveBtn");
  const quoPaper = document.getElementById("quoPaper");
  const quoLines = document.getElementById("quoLines");
  const quoStatus = document.getElementById("quoStatus");
  const quoStatusField = document.getElementById("quoStatusField");
  const quoThaiDigits = document.getElementById("quoThaiDigits");
  const quoDirty = document.getElementById("quoDirty");
  const quoVatEnabled = document.getElementById("quoVatEnabled");
  const quoVatRow = document.getElementById("quoVatRow");
  const quoGrandLabel = document.getElementById("quoGrandLabel");
  const quoPriceModal = document.getElementById("quoPriceModal");
  const quoPriceSearch = document.getElementById("quoPriceSearch");
  const quoPriceList = document.getElementById("quoPriceList");
  const quoPriceNote = document.getElementById("quoPriceNote");
  const quoFieldEls = Array.from(quoPaper.querySelectorAll(".qf[data-field]"));

  const QUO_DEFAULT_SENDER = "การไฟฟ้าส่วนภูมิภาคสาขาหางดง\n197 หมู่ 8 ตำบลหนองแก๋ว\nอำเภอหางดง จังหวัดเชียงใหม่ 50230";
  const QUO_DEFAULT_CONCLUSION = [
    "หากท่านมีความประสงค์ให้การไฟฟ้าส่วนภูมิภาคสาขาหางดงดำเนินการตามรายละเอียดข้างต้น หรือมีความประสงค์จะดำเนินการเพียงบางรายการ กรุณาแจ้งมาที่แผนกบริการและลูกค้าสัมพันธ์ การไฟฟ้าส่วนภูมิภาคสาขาหางดง",
    "หวังเป็นอย่างยิ่งว่าจะได้รับความไว้วางใจจากท่านให้เข้าดำเนินการต่อไป และขอขอบคุณมา ณ โอกาสนี้",
    "จึงเรียนมาเพื่อโปรดพิจารณา"
  ].join("\n");
  const QUO_DEFAULT_OWNER = "แผนกบริการและลูกค้าสัมพันธ์ การไฟฟ้าส่วนภูมิภาคสาขาหางดง\nโทร. 0 5310 6510\nโทรสาร 0 5344 1176";

  let quotations = [];          // kind = quotation ทั้งใบจริงและแม่แบบ
  let priceItems = [];          // kind = price_item
  let priceItemsLoaded = false;
  let quotationTab = "docs";    // docs | templates | prices
  let quotationQuery = "";
  let quotationEditing = null;  // รายการที่กำลังแก้ (null = ใบใหม่ยังไม่เคยบันทึก)
  let quoEditingIsTemplate = false;
  // id ของใบใหม่ -- จองไว้ตั้งแต่เปิดฟอร์ม กดบันทึกซ้ำ/ยิงซ้ำตอนเน็ตสะดุดจึง
  // เขียนทับแถวเดิม ไม่ใช่เพิ่มใบซ้ำ (หลักเดียวกับ pendingNewId ของคำร้อง)
  let quoPendingId = null;
  // รายการในตาราง -- ผูกสดกับช่องบนกระดาษ ทุกการพิมพ์เขียนลงที่นี่ทันที
  let quoLineModel = [];
  // สำเนาผลคำนวณราคา EV ของใบที่เปิดอยู่ (จากเครื่องคำนวณ) -- เก็บไว้กับใบเพื่อ
  // ให้เปิดกลับมาแก้ต่อได้ และเพื่อให้ราคาที่เสนอไปแล้วไม่เปลี่ยนตามงวดราคา
  let quoEvCalc = null;
  // สำเนาผลคำนวณราคาอุปกรณ์ป้องกันของใบที่เปิดอยู่ -- เหตุผลเดียวกับ quoEvCalc
  let quoProtectCalc = null;
  let quoDirtyFlag = false;

  const QUOTATION_STATUS_TONE = {
    "ร่าง": "info",
    "เสนอราคาแล้ว": "warning",
    "ลูกค้าตอบรับ": "success",
    "ทำสัญญา/เริ่มงาน": "success",
    "ส่งมอบงานแล้ว": "success",
    "ยกเลิก": "danger",
    "แม่แบบ": "info"
  };

  // Enter ในช่องหลายบรรทัดขึ้นย่อหน้าใหม่เป็น <div> ทุกเบราว์เซอร์ -- CSS ย่อหน้า
  // (.qd-para > div) อาศัยรูปนี้ ถ้าเป็น <br> ย่อหน้าที่สองจะไม่เข้า 2.5 ซม.
  try { document.execCommand("defaultParagraphSeparator", false, "div"); } catch { /* ไม่รองรับก็ไม่เป็นไร */ }

  function quoThaiDate(date) {
    return date.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  }

  function quoRound2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  /**
   * ปัดเศษขึ้นเป็นจำนวนเต็มบาท -- ใช้กับทุกก้อนที่ระบบคิดให้เองในเครื่องคำนวณราคา
   * ทั้งสองตัว (EV Charger และอุปกรณ์ป้องกัน) ตามที่เจ้าของระบบกำหนด และตรงกับ
   * กระดาษคำนวณของแผนก ส่วนราคาที่กรอก/มาจากงวดราคาคงทศนิยมไว้ตามที่บันทึก
   *
   * ลบ 1e-9 ก่อนปัดเพื่อกันเลขทศนิยมของคอมพิวเตอร์ -- เลขที่ควรลงตัวพอดีอย่าง
   * 43.8 บางครั้งเก็บเป็น 43.80000000000001 ซึ่งถ้าปัดขึ้นตรง ๆ จะได้ 44 จาก
   * ความคลาดเคลื่อนของ float แทนที่จะได้จากตัวเลขจริง
   */
  function ceilBaht(value) {
    return Math.ceil((Number(value) || 0) - 1e-9);
  }

  function formatMoney(value) {
    return (Number(value) || 0).toLocaleString("th-TH", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  function quoParseNumber(text) {
    const cleaned = String(text || "").replace(/[,\s]/g, "");
    if (!cleaned) return 0;
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : NaN;
  }

  /**
   * รวมเป็นเงิน / VAT 7% / รวมทั้งสิ้น -- ที่เดียวที่รู้วิธีคิด ปัดทีละบรรทัดก่อน
   * แล้วค่อยรวม แบบเดียวกับตารางในใบเสนอราคากระดาษ (1,478.13 x 3 = 4,434.39)
   * ไม่งั้นยอดรวมจะต่างจากผลบวกของคอลัมน์ "ค่าใช้จ่ายรวม" ไปหนึ่งสตางค์ได้
   */
  function quotationTotals(lines, vatEnabled) {
    const subtotal = quoRound2((Array.isArray(lines) ? lines : []).reduce((sum, line) => {
      const price = Number(line.unitPrice ?? line.price) || 0;
      return sum + quoRound2(price * (Number(line.qty) || 0));
    }, 0));
    const vat = vatEnabled === false ? 0 : quoRound2(subtotal * 0.07);
    return { subtotal, vat, grand: quoRound2(subtotal + vat) };
  }

  // ---------------------------------------------------------------- ช่องแก้ไข
  function quoIsSingle(el) {
    return el.hasAttribute("data-single");
  }

  /** ข้อความของโหนด โดยไม่นับรอยต่อหน้า (.qd-gap) ที่อาจถูกแทรกอยู่ข้างใน */
  function quoTextOf(node) {
    if (node.nodeType === 3) return node.data;
    if (node.nodeType !== 1 || node.classList.contains("qd-gap")) return "";
    if (!node.querySelector(".qd-gap")) return node.textContent;
    let text = "";
    node.childNodes.forEach(child => { text += quoTextOf(child); });
    return text;
  }

  /**
   * อ่านค่าช่อง -- ช่องหลายบรรทัดอ่านจากโครง <div> ต่อย่อหน้า (ไม่ใช่ innerText)
   * เพราะต้องข้ามรอยต่อหน้า และต้องเก็บบรรทัดว่างที่ผู้ใช้กด Enter ไว้ดันข้อความ
   * ลงหน้าถัดไป -- innerText ก็อ่านไม่ได้ตอนกระดาษถูกซ่อนอยู่ด้วย
   */
  function quoReadField(el) {
    if (quoIsSingle(el)) {
      return quoTextOf(el).replace(/\u00a0/g, " ").replace(/\s*\n\s*/g, " ").trim();
    }
    const lines = [];
    let current = null;
    el.childNodes.forEach(node => {
      if (node.nodeType === 1 && node.classList.contains("qd-gap")) return;
      if (node.nodeType === 1 && (node.tagName === "DIV" || node.tagName === "P")) {
        if (current !== null) { lines.push(current); current = null; }
        lines.push(quoTextOf(node));
      } else if (node.nodeType === 1 && node.tagName === "BR") {
        lines.push(current || "");
        current = null;
      } else {
        current = (current || "") + quoTextOf(node);
      }
    });
    if (current !== null) lines.push(current);
    const joined = lines.join("\n").replace(/\u00a0/g, " ");
    return lines.length > 1 || /\S/.test(joined) ? joined : "";
  }

  function quoWriteField(el, value) {
    const text = String(value == null ? "" : value);
    el.innerHTML = "";
    if (!text) return;
    if (quoIsSingle(el)) {
      el.textContent = text;
      return;
    }
    text.split("\n").forEach(line => {
      const div = document.createElement("div");
      if (line) div.textContent = line;
      else div.appendChild(document.createElement("br"));
      el.appendChild(div);
    });
  }

  /**
   * ทำให้ element หนึ่งแก้ไขได้แบบข้อความล้วน
   * - บรรทัดเดียว: plaintext-only (Firefox รุ่นเก่าไม่รองรับ ถอยเป็น true) กด Enter ไม่ขึ้นบรรทัด
   * - หลายบรรทัด: true เพื่อให้ Enter สร้างย่อหน้าใหม่เป็น <div>
   * - วางข้อความ: รับเฉพาะตัวอักษร ตัดรูปแบบจาก Word/เว็บทิ้งหมด
   * - Ctrl+B/I/U ถูกปิด เพราะรูปแบบตัวอักษรไม่ถูกบันทึก ปล่อยให้กดได้คือหลอกผู้ใช้
   */
  function wireQuoEditable(el, onInput) {
    const single = quoIsSingle(el);
    el.setAttribute("contenteditable", single ? "plaintext-only" : "true");
    if (single && el.contentEditable !== "plaintext-only") el.setAttribute("contenteditable", "true");
    el.spellcheck = false;

    el.addEventListener("keydown", (e) => {
      if (single && e.key === "Enter") e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && ["b", "i", "u"].includes(String(e.key).toLowerCase())) e.preventDefault();
    });

    el.addEventListener("paste", (e) => {
      e.preventDefault();
      let text = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
      text = text.replace(/\r\n?/g, "\n");
      if (single) text = text.replace(/\s*\n\s*/g, " ");
      document.execCommand("insertText", false, text);
    });

    el.addEventListener("drop", (e) => e.preventDefault());

    el.addEventListener("input", () => {
      setQuoDirty(true);
      if (onInput) onInput();
    });

    // ลบข้อความจนหมดแล้ว contenteditable มักเหลือ <br>/<div> ค้าง ทำให้ :empty
    // ไม่ติดและข้อความแนะนำไม่กลับมา -- เคลียร์ตอนออกจากช่อง ไม่ใช่ตอนพิมพ์
    // (ถ้าล้างตอนพิมพ์ เคอร์เซอร์จะกระโดด)
    el.addEventListener("blur", () => {
      if (quoReadField(el) === "" && !el.querySelector(".qd-gap")) el.innerHTML = "";
    });
  }

  quoFieldEls.forEach(el => wireQuoEditable(el));

  function setQuoDirty(dirty) {
    quoDirtyFlag = dirty;
    quoDirty.textContent = "ยังไม่ได้บันทึก";
    quoDirty.hidden = !dirty;
  }

  function flashQuoSaved(text) {
    quoDirty.textContent = text || "บันทึกแล้ว";
    quoDirty.hidden = false;
    setTimeout(() => { if (!quoDirtyFlag) quoDirty.hidden = true; }, 2500);
  }

  function quoConfirmLeave() {
    if (quotationFormMode.hidden || !quoDirtyFlag) return true;
    return confirm("มีการแก้ไขที่ยังไม่ได้บันทึก ออกจากหน้านี้โดยไม่บันทึกใช่หรือไม่?");
  }

  window.addEventListener("beforeunload", (e) => {
    if (!views.quotation.hidden && !quotationFormMode.hidden && quoDirtyFlag) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  quoThaiDigits.addEventListener("change", () => {
    quoPaper.classList.toggle("is-thai-digits", quoThaiDigits.checked);
    setQuoDirty(true);
    scheduleQuoLayout(0);
  });

  quoStatus.addEventListener("change", () => setQuoDirty(true));

  // ---------------------------------------------------------------- ตาราง
  function renderQuoLines() {
    quoLines.innerHTML = "";

    if (!quoLineModel.length) {
      const tr = document.createElement("tr");
      tr.className = "qd-table-empty qd-screen-only";
      const td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "ยังไม่มีรายการ -- กด \"+ เลือกจากรายการราคา\" หรือ \"+ เพิ่มแถวในตาราง\" บนแถบเครื่องมือเหนือกระดาษ";
      tr.appendChild(td);
      quoLines.appendChild(tr);
    }

    quoLineModel.forEach((line, index) => {
      const tr = document.createElement("tr");
      tr.className = "qd-row";

      const tdNo = document.createElement("td");
      tdNo.className = "qd-no";
      tdNo.style.position = "relative";
      tdNo.textContent = String(index + 1);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "qd-row-del qd-screen-only";
      del.textContent = "×";
      del.title = "ลบแถวนี้";
      del.setAttribute("aria-label", `ลบรายการที่ ${index + 1}`);
      del.addEventListener("click", () => {
        quoLineModel.splice(index, 1);
        setQuoDirty(true);
        renderQuoLines();
      });
      tdNo.appendChild(del);

      const tdDesc = document.createElement("td");
      const desc = document.createElement("div");
      desc.className = "qf";
      desc.setAttribute("data-single", "");
      desc.dataset.placeholder = "รายการ";
      desc.textContent = line.description || "";
      wireQuoEditable(desc, () => { line.description = quoReadField(desc); });
      tdDesc.appendChild(desc);

      const tdPrice = document.createElement("td");
      tdPrice.className = "qd-num";
      const price = document.createElement("div");
      price.className = "qf";
      price.setAttribute("data-single", "");
      price.dataset.placeholder = "0.00";
      price.setAttribute("inputmode", "decimal");
      price.textContent = line.unitPrice ? formatMoney(line.unitPrice) : "";
      wireQuoEditable(price, () => {
        const value = quoParseNumber(price.textContent);
        line.unitPrice = Number.isNaN(value) ? 0 : value;
        updateQuoLineAmount(tr, line);
      });
      price.addEventListener("blur", () => {
        const value = quoParseNumber(price.textContent);
        if (!Number.isNaN(value) && price.textContent.trim()) price.textContent = formatMoney(value);
      });
      tdPrice.appendChild(price);

      const tdQty = document.createElement("td");
      tdQty.className = "qd-center";
      const qty = document.createElement("div");
      qty.className = "qf";
      qty.setAttribute("data-single", "");
      qty.dataset.placeholder = "0";
      qty.setAttribute("inputmode", "decimal");
      qty.textContent = line.qty ? String(line.qty) : "";
      wireQuoEditable(qty, () => {
        const value = quoParseNumber(qty.textContent);
        line.qty = Number.isNaN(value) ? 0 : value;
        updateQuoLineAmount(tr, line);
      });
      tdQty.appendChild(qty);

      const tdAmount = document.createElement("td");
      tdAmount.className = "qd-num qd-amount";

      tr.append(tdNo, tdDesc, tdPrice, tdQty, tdAmount);
      quoLines.appendChild(tr);
      updateQuoLineAmount(tr, line, true);
    });

    updateQuoTotals();
    scheduleQuoLayout();
  }

  function updateQuoLineAmount(tr, line, skipTotals) {
    const amount = quoRound2((Number(line.unitPrice) || 0) * (Number(line.qty) || 0));
    tr.querySelector(".qd-amount").textContent = amount ? formatMoney(amount) : "";
    if (!skipTotals) updateQuoTotals();
  }

  function updateQuoTotals() {
    const vatEnabled = quoVatEnabled.checked;
    const totals = quotationTotals(quoLineModel, vatEnabled);
    document.getElementById("quoSubtotal").textContent = formatMoney(totals.subtotal);
    document.getElementById("quoVat").textContent = formatMoney(totals.vat);
    document.getElementById("quoGrand").textContent = formatMoney(totals.grand);
    quoVatRow.hidden = !vatEnabled;
    quoGrandLabel.textContent = vatEnabled
      ? "รวมเป็นเงินทั้งสิ้น (รวมภาษีมูลค่าเพิ่ม)"
      : "รวมเป็นเงินทั้งสิ้น";
  }

  quoVatEnabled.addEventListener("change", () => {
    setQuoDirty(true);
    updateQuoTotals();
  });

  document.getElementById("quoAddLineBtn").addEventListener("click", () => {
    quoLineModel.push({ description: "", unitPrice: 0, qty: 1 });
    setQuoDirty(true);
    renderQuoLines();
    const rows = quoLines.querySelectorAll(".qd-row");
    const lastDesc = rows.length ? rows[rows.length - 1].querySelector(".qf") : null;
    if (lastDesc) lastDesc.focus();
  });

  // ---------------------------------------------------------------- เปิด/บันทึก
  function quoDefaultData() {
    return {
      urgency: "",
      refNo: "มท",
      sender: QUO_DEFAULT_SENDER,
      dateText: quoThaiDate(new Date()),
      subject: "ขอเสนอราคา",
      recipient: "",
      reference: "",
      enclosure: "",
      paraCause: "",
      paraIntent: "",
      paraConclusion: QUO_DEFAULT_CONCLUSION,
      closing: "ขอแสดงความนับถือ",
      signerName: "",
      signerPosition: "",
      ownerBlock: QUO_DEFAULT_OWNER,
      lines: [],
      vatEnabled: true,
      thaiDigits: false
    };
  }

  /**
   * เปิดกระดาษแก้ไข
   *   openQuotationForm(item)                -- แก้ใบ/แม่แบบที่บันทึกไว้แล้ว
   *   openQuotationForm(null)                -- ใบใหม่จากค่าตั้งต้น
   *   openQuotationForm(null, sourceData)    -- ใบใหม่จากแม่แบบ/สำเนา (วันที่เป็นวันนี้)
   */
  function openQuotationForm(item, sourceData) {
    quotationEditing = item || null;
    quoPendingId = item ? null : newWorkItemId();
    quoEditingIsTemplate = Boolean(item && item.data && item.data.isTemplate);

    const base = item
      ? { ...(item.data || {}) }
      : { ...quoDefaultData(), ...(sourceData || {}), dateText: quoThaiDate(new Date()) };
    delete base.isTemplate;
    // ใบที่สร้างก่อนหน้ากระดาษแบบนี้ (มีแค่ customer/number/note) -- ยกค่าเท่าที่
    // ตรงความหมายมาไว้ช่องใหม่ ไม่ปล่อยให้เปิดมาแล้วว่างเปล่าทั้งที่มีข้อมูล
    if (!base.recipient && base.customer) base.recipient = base.customer;
    if (!base.refNo && base.number) base.refNo = base.number;

    removeQuoGaps();
    quoContOverrides = { ...(base.contTexts || {}) };
    quoFieldEls.forEach(el => quoWriteField(el, base[el.dataset.field]));

    quoLineModel = (Array.isArray(base.lines) ? base.lines : []).map(l => ({
      description: String(l.description || ""),
      unitPrice: Number(l.unitPrice ?? l.price) || 0,
      qty: Number(l.qty) || 0,
      fromEv: Boolean(l.fromEv),
      fromProtect: Boolean(l.fromProtect)
    }));
    quoEvCalc = base.evCalc || null;
    quoProtectCalc = base.protectCalc || null;
    quoVatEnabled.checked = base.vatEnabled !== false;
    quoThaiDigits.checked = Boolean(base.thaiDigits);
    quoPaper.classList.toggle("is-thai-digits", quoThaiDigits.checked);
    quoStatus.value = item && !quoEditingIsTemplate ? (item.status || "ร่าง") : "ร่าง";
    quoStatusField.hidden = quoEditingIsTemplate;
    renderQuoLines();

    if (quoEditingIsTemplate) {
      quotationFormTitle.textContent = `แก้ไขแม่แบบ: ${item.data.templateName || item.title || ""}`;
    } else {
      quotationFormTitle.textContent = item ? "แก้ไขใบเสนอราคา" : "ใบเสนอราคาใหม่";
    }
    renderQuoSubtitle();

    quotationDeleteBtn.hidden = !item;
    quotationDuplicateBtn.hidden = !item || quoEditingIsTemplate;
    quotationSaveTemplateBtn.hidden = quoEditingIsTemplate;
    quotationSaveBtn.textContent = quoEditingIsTemplate ? "บันทึกแม่แบบ" : "บันทึก";

    hideError(quotationFormError);
    setQuoDirty(false);
    quotationListMode.hidden = true;
    quotationFormMode.hidden = false;
    window.scrollTo(0, 0);
    syncQuoOptionalLines();
    scheduleQuoLayout(0);
  }

  function renderQuoSubtitle() {
    const item = quotationEditing;
    if (!item) {
      quotationFormSubtitle.textContent = "ยังไม่ได้บันทึก";
      return;
    }
    const by = item.updatedByName || item.createdByName || "-";
    const at = item.updatedAt || item.createdAt;
    quotationFormSubtitle.textContent = `แก้ไขล่าสุด: ${by}${at ? ` · ${formatThaiDateTime(at)}` : ""}`;
  }

  function collectQuoData() {
    const data = {};
    quoFieldEls.forEach(el => { data[el.dataset.field] = quoReadField(el); });
    data.lines = quoLineModel
      .filter(l => String(l.description || "").trim() || Number(l.unitPrice) || Number(l.qty))
      .map(l => {
        const line = {
          description: String(l.description || "").trim(),
          unitPrice: quoRound2(l.unitPrice),
          qty: Number(l.qty) || 0
        };
        if (l.fromEv) line.fromEv = true;
        if (l.fromProtect) line.fromProtect = true;
        return line;
      });
    data.vatEnabled = quoVatEnabled.checked;
    // สำเนาผลคำนวณ EV -- ราคาในใบนี้จะไม่เปลี่ยนตามเมื่อแก้ราคาในงวดภายหลัง
    if (quoEvCalc) data.evCalc = quoEvCalc;
    if (quoProtectCalc) data.protectCalc = quoProtectCalc;
    data.thaiDigits = quoThaiDigits.checked;
    // คำต่อท้ายหน้าที่แก้เอง (key = เลขหน้า) -- ไม่มี = ใช้ค่าอัตโนมัติ
    data.contTexts = { ...quoContOverrides };
    return data;
  }

  function upsertLocalQuotation(saved) {
    const index = quotations.findIndex(q => String(q.id) === String(saved.id));
    if (index === -1) quotations.unshift(saved);
    else quotations[index] = saved;
  }

  quotationSaveBtn.addEventListener("click", async () => {
    hideError(quotationFormError);
    const data = collectQuoData();

    if (quoEditingIsTemplate) {
      data.isTemplate = true;
      data.templateName = quotationEditing.data.templateName || quotationEditing.title || "";
    } else if (!data.subject) {
      showError(quotationFormError, "กรุณากรอก \"เรื่อง\" ของหนังสือ");
      return;
    }

    setBusy(quotationSaveBtn, true, "กำลังบันทึก...");
    try {
      const saved = await backend.saveWorkItem("quotation", {
        id: quotationEditing ? quotationEditing.id : quoPendingId,
        title: quoEditingIsTemplate ? data.templateName : (data.subject || data.recipient || "ใบเสนอราคา"),
        status: quoEditingIsTemplate ? "แม่แบบ" : quoStatus.value,
        data
      });
      quotationEditing = saved;
      quoPendingId = null;
      upsertLocalQuotation(saved);
      quotationDeleteBtn.hidden = false;
      quotationDuplicateBtn.hidden = quoEditingIsTemplate;
      if (!quoEditingIsTemplate) quotationFormTitle.textContent = "แก้ไขใบเสนอราคา";
      renderQuoSubtitle();
      setQuoDirty(false);
      flashQuoSaved("บันทึกแล้ว");
    } catch (err) {
      showError(quotationFormError, moduleErrorText(err));
    } finally {
      setBusy(quotationSaveBtn, false);
    }
  });

  quotationSaveTemplateBtn.addEventListener("click", async () => {
    hideError(quotationFormError);
    const current = collectQuoData();
    const name = prompt(
      "ตั้งชื่อแม่แบบ (เช่น \"เสนอราคาบำรุงรักษาหม้อแปลง\")\nเนื้อหาทั้งหมดบนกระดาษจะถูกเก็บเป็นแม่แบบใหม่ ใบนี้ไม่เปลี่ยน",
      current.subject || ""
    );
    if (name === null) return;
    const templateName = name.trim();
    if (!templateName) {
      showError(quotationFormError, "กรุณาตั้งชื่อแม่แบบ");
      return;
    }

    setBusy(quotationSaveTemplateBtn, true, "กำลังบันทึก...");
    try {
      const saved = await backend.saveWorkItem("quotation", {
        id: newWorkItemId(),
        title: templateName,
        status: "แม่แบบ",
        data: { ...current, isTemplate: true, templateName }
      });
      upsertLocalQuotation(saved);
      flashQuoSaved(`บันทึกแม่แบบ "${templateName}" แล้ว`);
    } catch (err) {
      showError(quotationFormError, moduleErrorText(err));
    } finally {
      setBusy(quotationSaveTemplateBtn, false);
    }
  });

  quotationDuplicateBtn.addEventListener("click", () => {
    if (quoDirtyFlag && !confirm("มีการแก้ไขที่ยังไม่ได้บันทึก -- ทำสำเนาจากข้อความบนจอตอนนี้ (ใบเดิมจะไม่ถูกบันทึก) ใช่หรือไม่?")) return;
    const copy = collectQuoData();
    openQuotationForm(null, copy);
    setQuoDirty(true);
    quotationFormSubtitle.textContent = "สำเนา -- ยังไม่ได้บันทึก";
  });

  quotationDeleteBtn.addEventListener("click", async () => {
    if (!quotationEditing) return;
    const what = quoEditingIsTemplate ? "แม่แบบนี้" : "ใบเสนอราคานี้";
    if (!confirm(`ลบ${what}ใช่หรือไม่?`)) return;
    setBusy(quotationDeleteBtn, true, "กำลังลบ...");
    try {
      await backend.deleteWorkItem(quotationEditing.id);
      quotations = quotations.filter(q => String(q.id) !== String(quotationEditing.id));
      setQuoDirty(false);
      showQuotationList();
    } catch (err) {
      showError(quotationFormError, moduleErrorText(err));
    } finally {
      setBusy(quotationDeleteBtn, false);
    }
  });

  document.getElementById("quotationBackToListBtn").addEventListener("click", () => {
    if (!quoConfirmLeave()) return;
    setQuoDirty(false);
    showQuotationList();
  });

  // ---------------------------------------------------------------- แบ่งหน้าบนกระดาษแก้ไข
  /**
   * กระดาษแก้ไขคือหน้าพิมพ์จริง -- แบ่งหน้าให้เห็นตรงที่พิมพ์ ไม่มีหน้าตัวอย่างแยก
   *
   * กระดาษบนจอยังเป็นกล่องต่อเนื่องกล่องเดียว (ให้พิมพ์/เลื่อนเคอร์เซอร์ข้ามหน้าได้
   * เหมือน Word) แต่หลังการแก้ไขทุกครั้ง จะวัดว่าบรรทัดไหนเลยท้ายหน้า แล้วแทรก
   * "รอยต่อหน้า" (.qd-gap) ตรงหน้าบรรทัดนั้นพอดี -- รอยต่อมีความสูงเท่ากับที่ว่างท้าย
   * หน้า + บรรทัดคำต่อ "/..." + ขอบล่าง + ช่องเทาระหว่างแผ่น + ขอบบนหน้าถัดไป +
   * "- ๒ -" + เว้น 6 pt บรรทัดต่อจากรอยต่อจึงไปอยู่ต้นหน้าถัดไปพอดี
   * กด Enter / เคาะเพิ่ม = บรรทัดเลื่อนข้ามรอยต่อไปหน้าถัดไปจริง ๆ
   *
   * ตำแหน่งรอยต่อ:
   *   - บรรทัดกลางย่อหน้า: แทรกเป็น inline-block กว้างเต็มบรรทัด ตรงอักษรตัวแรกของ
   *     บรรทัดที่ล้น (เบราว์เซอร์ตัดบรรทัดตรงรอยคำให้อยู่แล้ว)
   *   - ย่อหน้าที่บรรทัดแรกก็ล้น / บรรทัดหัวหนังสือ / ลงนาม: แทรกก่อนทั้งก้อน
   *   - ตาราง: แทรกเป็นแถวระหว่างแถว แล้วตามด้วยหัวตารางซ้ำ
   *
   * รอยต่อ contenteditable=false และไม่ถูกนับเป็นข้อความของช่อง (quoReadField ข้าม)
   * การถอด/แทรกรอยต่อใช้ splitText/remove ล้วน ไม่ใช้ innerHTML หรือ normalize() --
   * DOM ปรับตำแหน่ง Selection ที่อยู่ในข้อความให้เองตามสเปก เคอร์เซอร์จึงไม่หลุด
   * ขณะพิมพ์แม้รอยต่อจะถูกสร้างใหม่ในย่อหน้าที่กำลังพิมพ์อยู่
   *
   * พิมพ์ = ตัดสำเนาของกระดาษนี้ตรงรอยต่อเดิมเป๊ะ (quoSheetsFromPaper) ไม่ได้จัดหน้าใหม่
   * สิ่งที่เห็นบนจอจึงเป็นสิ่งที่ได้บนกระดาษทุกบรรทัด รวมทั้งคำต่อที่แก้ไว้
   */
  const QP_CONT_WORDS = 3;
  // เรขาคณิตหน้า (มม.) -- ต้องตรงกับ .qp-sheet / .qd-gap-* ใน style.css
  const QP_PAGE_H = 297;
  const QP_BAND = 10;                         // ช่องเทาระหว่างแผ่นบนจอ
  const QP_CONTENT_BOTTOM = 297 - 20 - 9;     // ท้ายพื้นที่เนื้อหา = 297 - ขอบล่าง - บรรทัดคำต่อ
  const THAI_MARK = /[ัิ-ฺ็-๎]/;

  // คำต่อที่ผู้ใช้แก้เอง -- key = เลขหน้าที่คำต่อนั้นอยู่ (1 = ท้ายหน้า 1) ว่าง = อัตโนมัติ
  let quoContOverrides = {};
  let quoLayoutTimer = null;
  let quoComposing = false;
  const quoPageCount = document.getElementById("quoPageCount");

  function scheduleQuoLayout(delay) {
    clearTimeout(quoLayoutTimer);
    quoLayoutTimer = setTimeout(runQuoLayout, delay == null ? 200 : delay);
  }

  async function runQuoLayout() {
    if (quotationFormMode.hidden) return;
    // ระหว่างพิมพ์ด้วย IME (คอมโพสิชัน) ห้ามแตะ DOM -- ตัวอักษรที่กำลังประกอบจะหลุด
    if (quoComposing) { scheduleQuoLayout(); return; }
    // กำลังแก้คำต่ออยู่ -- จัดหน้าใหม่จะสร้างช่องคำต่อใหม่ทับใต้เคอร์เซอร์ รอให้ออกจากช่องก่อน
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest(".qd-cont")) {
      scheduleQuoLayout(600);
      return;
    }
    await waitQuoFonts(document, quoThaiDigits.checked);
    if (quotationFormMode.hidden) return;
    paginateQuoPaper();
  }

  quoPaper.addEventListener("compositionstart", () => { quoComposing = true; });
  quoPaper.addEventListener("compositionend", () => { quoComposing = false; scheduleQuoLayout(); });

  /** รอฟอนต์ของหนังสือโหลดครบก่อนวัด -- วัดด้วยฟอนต์สำรองได้ความสูงผิด */
  async function waitQuoFonts(doc, thai) {
    const family = thai ? "QuoSarabunIT9" : "QuoSarabun";
    await Promise.all([
      doc.fonts.load(`16pt "${family}"`),
      doc.fonts.load(`bold 16pt "${family}"`),
      doc.fonts.load(`14pt "${family}"`)
    ]).catch(() => {});
    await doc.fonts.ready;
  }

  function removeQuoGaps() {
    quoPaper.querySelectorAll("tr.qd-gap-row, tr.qd-gap-head").forEach(row => row.remove());
    quoPaper.querySelectorAll(".qd-gap").forEach(gap => gap.remove());
  }

  function makeQuoGap(pageIndex, inline) {
    const gap = document.createElement("span");
    gap.className = "qd-gap" + (inline ? " qd-gap-inline" : "");
    gap.contentEditable = "false";
    const part = (cls) => {
      const el = document.createElement("span");
      el.className = cls;
      gap.appendChild(el);
      return el;
    };
    part("qd-gap-fill");
    const contLine = part("qd-gap-cont");
    const cont = document.createElement("span");
    cont.className = "qd-cont";
    cont.dataset.page = String(pageIndex + 1);
    cont.contentEditable = "true";
    cont.spellcheck = false;
    cont.title = "คำต่อท้ายหน้า -- แก้ได้ ลบให้ว่างเพื่อกลับไปใช้ค่าอัตโนมัติ";
    contLine.appendChild(cont);
    part("qd-gap-bottom");
    part("qd-gap-band");
    part("qd-gap-top");
    part("qd-gap-pageno").textContent = `- ${pageIndex + 2} -`;
    part("qd-gap-after");
    return gap;
  }

  function quoFlowChildren() {
    return Array.from(quoPaper.children).filter(el =>
      !el.classList.contains("qd-urgency")
      && !el.classList.contains("qd-gap")
      && getComputedStyle(el).display !== "none");
  }

  /** เรียงอักษรทุกตัวในก้อน (ข้ามรอยต่อ) ให้ค้นหาแบบ binary search ข้าม text node ได้ */
  function quoCharIndex(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement && n.parentElement.closest(".qd-gap"))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    let total = 0;
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.data.length) continue;
      nodes.push({ node: n, start: total });
      total += n.data.length;
    }
    return {
      total,
      at(k) {
        let lo = 0;
        let hi = nodes.length - 1;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (nodes[mid].start <= k) lo = mid; else hi = mid - 1;
        }
        const entry = nodes[lo];
        return { node: entry.node, offset: k - entry.start };
      }
    };
  }

  function quoCharRect(pos) {
    const range = document.createRange();
    range.setStart(pos.node, pos.offset);
    range.setEnd(pos.node, Math.min(pos.offset + 1, pos.node.data.length));
    const rects = range.getClientRects();
    return rects.length ? rects[0] : range.getBoundingClientRect();
  }

  /**
   * ตำแหน่งต้นบรรทัดแรกในก้อน root ที่ล้นเส้น limit (หน่วย มม. จากขอบบนกระดาษ)
   * คืน "first" ถ้าบรรทัดแรกของก้อนก็ล้นแล้ว (ต้องยกทั้งก้อน)
   */
  function quoLineStartBelow(root, limit, toMm) {
    const index = quoCharIndex(root);
    if (!index.total) return "first";

    // อักษรตัวแรกที่ล่างเลยเส้น
    let lo = 0;
    let hi = index.total - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (toMm(quoCharRect(index.at(mid)).bottom) > limit) hi = mid; else lo = mid + 1;
    }
    const lineTop = toMm(quoCharRect(index.at(lo)).top);

    // ถอยไปอักษรตัวแรกของบรรทัดเดียวกัน (บรรทัดก่อนหน้าอยู่สูงกว่าเกินครึ่งบรรทัด)
    let a = 0;
    let b = lo;
    while (a < b) {
      const mid = Math.floor((a + b) / 2);
      if (toMm(quoCharRect(index.at(mid)).top) >= lineTop - 2) b = mid; else a = mid + 1;
    }
    let k = a;
    // ไม่แทรกกลางสระ/วรรณยุกต์ที่ต้องอยู่ติดพยัญชนะ
    while (k > 0 && THAI_MARK.test(index.at(k).node.data[index.at(k).offset])) k -= 1;
    return k === 0 ? "first" : index.at(k);
  }

  /** จุดแรกบนกระดาษที่เลยเส้น limit -- คืนคำสั่งแทรกรอยต่อ หรือ null (ไม่ล้นแล้ว/ตัดไม่ได้) */
  function quoFindCrossing(limit, toMm) {
    const flow = quoFlowChildren();
    for (let i = 0; i < flow.length; i++) {
      const child = flow[i];
      if (toMm(child.getBoundingClientRect().bottom) <= limit + 0.3) continue;
      const prev = child.previousElementSibling;
      const atPageTop = i === 0 || (prev && prev.classList.contains("qd-gap"));

      if (child.classList.contains("qd-para")) {
        const subs = Array.from(child.childNodes).filter(n =>
          !(n.nodeType === 1 && n.classList.contains("qd-gap"))
          && (n.nodeType === 1 || n.data.length));
        for (let j = 0; j < subs.length; j++) {
          const sub = subs[j];
          let rect;
          if (sub.nodeType === 1) rect = sub.getBoundingClientRect();
          else { const r = document.createRange(); r.selectNodeContents(sub); rect = r.getBoundingClientRect(); }
          if (toMm(rect.bottom) <= limit + 0.3) continue;
          const start = quoLineStartBelow(sub.nodeType === 1 ? sub : child, limit, toMm);
          if (start !== "first") return { kind: "inline", pos: start };
          if (j === 0) return atPageTop ? null : { kind: "before", el: child };
          const before = subs[j - 1];
          if (before.nodeType === 1 && before.classList && before.classList.contains("qd-gap")) return null;
          return { kind: "before", el: sub };
        }
        return atPageTop ? null : { kind: "before", el: child };
      }

      if (child.classList.contains("qd-table")) {
        const rows = Array.from(child.querySelectorAll("tbody > tr, tfoot > tr"))
          .filter(r => !r.classList.contains("qd-gap-row") && !r.classList.contains("qd-gap-head"));
        for (let j = 0; j < rows.length; j++) {
          const row = rows[j];
          if (toMm(row.getBoundingClientRect().bottom) <= limit + 0.3) continue;
          const prevRow = row.previousElementSibling
            || (row.parentElement.previousElementSibling && row.parentElement.previousElementSibling.lastElementChild);
          if (prevRow && prevRow.classList.contains("qd-gap-head")) return null;   // แถวเดียวสูงกว่าหน้า
          if (j === 0) return atPageTop ? null : { kind: "before", el: child };      // ยกทั้งตาราง
          return { kind: "row", el: row };
        }
        return atPageTop ? null : { kind: "before", el: child };
      }

      return atPageTop ? null : { kind: "before", el: child };
    }
    return null;
  }

  function insertQuoGap(hit, pageIndex) {
    if (hit.kind === "row") {
      const tr = document.createElement("tr");
      tr.className = "qd-gap-row";
      tr.contentEditable = "false";
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "qd-gap-cell";
      const gap = makeQuoGap(pageIndex, false);
      td.appendChild(gap);
      tr.appendChild(td);
      hit.el.before(tr);
      // หัวตารางซ้ำต้นหน้าใหม่
      const headSrc = quoPaper.querySelector(".qd-table thead tr");
      if (headSrc) {
        const head = document.createElement("tr");
        head.className = "qd-gap-head";
        head.contentEditable = "false";
        Array.from(headSrc.cells).forEach(cell => head.appendChild(cell.cloneNode(true)));
        tr.after(head);
      }
      return gap;
    }
    if (hit.kind === "inline") {
      const gap = makeQuoGap(pageIndex, true);
      const { node, offset } = hit.pos;
      const after = offset > 0 ? node.splitText(offset) : node;
      after.before(gap);
      return gap;
    }
    const gap = makeQuoGap(pageIndex, false);
    hit.el.before(gap);
    return gap;
  }

  function paginateQuoPaper() {
    removeQuoGaps();
    const paperTop = () => quoPaper.getBoundingClientRect().top;
    const pxPerMm = quoPaper.getBoundingClientRect().width / 210;
    const toMm = (px) => (px - paperTop()) / pxPerMm;

    let pages = 1;
    for (let n = 0; n < 40; n++) {
      const limit = n * (QP_PAGE_H + QP_BAND) + QP_CONTENT_BOTTOM;
      const hit = quoFindCrossing(limit, toMm);
      if (!hit) break;
      const gap = insertQuoGap(hit, n);
      // ที่ว่างท้ายหน้า = จากต้นรอยต่อถึงท้ายพื้นที่เนื้อหา ส่วนที่เหลือของรอยต่อสูงคงที่
      const fill = Math.max(0, limit - toMm(gap.getBoundingClientRect().top));
      gap.querySelector(".qd-gap-fill").style.height = `${fill}mm`;
      pages = n + 2;
    }

    quoPaper.style.minHeight = `${pages * QP_PAGE_H + (pages - 1) * QP_BAND}mm`;
    quoPaper.dataset.pages = String(pages);
    fillQuoContTexts();
    if (quoPageCount) quoPageCount.textContent = `${pages} หน้า`;
  }

  /** คำต่อของทุกรอยต่อ: ค่าที่ผู้ใช้แก้ไว้ หรือ "/" + 3 คำแรกหลังรอยต่อ + "..." */
  function fillQuoContTexts() {
    quoPaper.querySelectorAll(".qd-cont").forEach(cont => {
      const override = quoContOverrides[cont.dataset.page];
      cont.textContent = override || `/${quoTextAfter(cont.closest(".qd-gap"))}...`;
    });
  }

  function quoTextAfter(gap) {
    const host = gap.closest("tr.qd-gap-row") || gap;
    const walker = document.createTreeWalker(quoPaper, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        const p = n.parentElement;
        if (!p || p.closest(".qd-gap, tr.qd-gap-head, .qd-no, .qd-screen-only, .qd-urgency")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    walker.currentNode = host;
    let text = "";
    while (text.replace(/\s/g, "").length < 40 && walker.nextNode()) text += " " + walker.currentNode.data;
    return quoFirstWords(text);
  }

  function quoFirstWords(raw) {
    const text = String(raw || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    const Segmenter = typeof Intl !== "undefined" && Intl.Segmenter;
    if (!Segmenter) return text.slice(0, 12);
    let count = 0;
    let end = 0;
    for (const seg of new Segmenter("th", { granularity: "word" }).segment(text)) {
      end = seg.index + seg.segment.length;
      if (seg.isWordLike) count += 1;
      if (count >= QP_CONT_WORDS) break;
    }
    return text.slice(0, end).trim();
  }

  // ทุกการแก้ไขบนกระดาษ bubble มาที่นี่ -- ยกเว้นการแก้คำต่อ (แก้คำต่อไม่ทำให้
  // หน้าเปลี่ยน และถ้าจัดหน้าใหม่ ช่องคำต่อที่กำลังพิมพ์อยู่จะถูกสร้างใหม่ใต้เคอร์เซอร์)
  quoPaper.addEventListener("input", (e) => {
    const cont = e.target.closest && e.target.closest(".qd-cont");
    if (cont) {
      const text = cont.textContent.trim();
      if (text) quoContOverrides[cont.dataset.page] = text;
      else delete quoContOverrides[cont.dataset.page];
      setQuoDirty(true);
      return;
    }
    scheduleQuoLayout();
  });

  // คำต่อ: Enter ไม่ขึ้นบรรทัด / วางเป็นตัวอักษรล้วน / ลบจนว่าง = กลับไปใช้ค่าอัตโนมัติ
  quoPaper.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest(".qd-cont") && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      e.target.blur();
    }
  }, true);
  quoPaper.addEventListener("focusout", (e) => {
    const cont = e.target.closest && e.target.closest(".qd-cont");
    if (cont && !cont.textContent.trim()) fillQuoContTexts();
  });

  // ---------------------------------------------------------------- พิมพ์
  /**
   * ตัดสำเนากระดาษตรงรอยต่อเป็นแผ่น -- ย่อหน้าที่มีรอยต่อกลางบรรทัดถูกตัดด้วย Range
   * (ส่วนหน้าเกลี่ยบรรทัดสุดท้ายเต็มบรรทัด ส่วนต่อไม่ย่อหน้าซ้ำ) ตารางถูกตัดที่แถว
   * รอยต่อ ส่วนหลังขึ้นต้นด้วยหัวตารางซ้ำที่แทรกไว้แล้ว
   */
  function quoSheetsFromPaper() {
    paginateQuoPaper();
    const clone = quoPaper.cloneNode(true);
    clone.removeAttribute("id");
    clone.removeAttribute("style");

    clone.querySelectorAll(".qd-screen-only, .qd-row-del, [data-optional].qd-off").forEach(n => n.remove());
    clone.querySelectorAll("[data-optional]").forEach(line => {
      const field = line.querySelector("[data-field]");
      if (field && !field.textContent.trim()) line.remove();
    });
    const hasText = (el) => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll(".qd-gap").forEach(g => g.remove());
      return /\S/.test(copy.textContent) || copy.querySelector("div, br");
    };
    clone.querySelectorAll(".qd-urgency, .qd-owner, .qd-para").forEach(n => {
      if (!hasText(n)) n.remove();
    });
    const seal = clone.querySelector(".qd-seal");
    const liveSeal = quoPaper.querySelector(".qd-seal");
    if (seal && liveSeal) seal.setAttribute("src", liveSeal.src);

    // คำต่อ -- อ่านก่อนถอดรอยต่อ
    const urgency = clone.querySelector(".qd-urgency");
    if (urgency) urgency.remove();

    const sheets = [{ nodes: [], cont: "" }];
    let current = sheets[0];
    const queue = Array.from(clone.children);

    while (queue.length) {
      let el = queue.shift();
      for (;;) {
        if (el.classList.contains("qd-gap")) {
          current.cont = (el.querySelector(".qd-cont") || {}).textContent || "";
          current = { nodes: [], cont: "" };
          sheets.push(current);
          break;
        }
        const gap = el.querySelector(".qd-gap");
        if (!gap) { current.nodes.push(el); break; }

        const host = gap.closest("tr.qd-gap-row") || gap;
        const inline = gap.classList.contains("qd-gap-inline");
        const range = document.createRange();
        range.setStart(el, 0);
        range.setEndBefore(host);
        const head = el.cloneNode(false);
        head.appendChild(range.extractContents());
        current.cont = (gap.querySelector(".qd-cont") || {}).textContent || "";
        host.remove();

        if (el.classList.contains("qd-table")) {
          const colgroup = head.querySelector("colgroup");
          if (colgroup && !el.querySelector("colgroup")) el.prepend(colgroup.cloneNode(true));
        }
        if (inline) {
          const headLast = head.lastElementChild && head.lastElementChild.tagName === "DIV" ? head.lastElementChild : head;
          headLast.classList.add("qp-split-head");
          const tailFirst = el.firstElementChild && el.firstElementChild.tagName === "DIV"
            && !(el.firstChild && el.firstChild.nodeType === 3 && el.firstChild.data.trim())
            ? el.firstElementChild : el;
          tailFirst.classList.add("qp-split-tail");
        }
        current.nodes.push(head);
        current = { nodes: [], cont: "" };
        sheets.push(current);
        // el เหลือส่วนหลังรอยต่อ -- วนต่อเผื่อมีรอยต่ออีกในก้อนเดียวกัน
      }
    }

    // ถอดเครื่องมือแก้ไขออกหลังตัดเสร็จ (ตัดก่อนเพราะรอยต่อเองก็เป็น contenteditable=false)
    const strip = (root) => {
      root.querySelectorAll("[contenteditable]").forEach(n => n.removeAttribute("contenteditable"));
      root.querySelectorAll(".qf").forEach(n => { n.classList.remove("qf"); n.removeAttribute("data-placeholder"); });
      if (root.removeAttribute) root.removeAttribute("contenteditable");
      if (root.classList) root.classList.remove("qf");
    };
    sheets.forEach(sheet => sheet.nodes.forEach(strip));
    if (urgency) strip(urgency);

    return { sheets: sheets.filter((s, i) => i === 0 || s.nodes.length), urgency };
  }

  function printQuotation() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const { sheets, urgency } = quoSheetsFromPaper();
    const thai = quoThaiDigits.checked;
    const cssLink = document.querySelector('link[rel="stylesheet"][href*="style.css"]');
    const cssHref = cssLink ? cssLink.href : new URL("style.css", location.href).href;
    const title = quoReadField(quoFieldEls.find(el => el.dataset.field === "subject")) || "ใบเสนอราคา";

    const sheetHtml = sheets.map((sheet, i) => `
      <section class="qp-sheet quo-paper${thai ? " is-thai-digits" : ""}">
        ${i === 0 && urgency ? urgency.outerHTML : ""}
        ${i > 0 ? `<div class="qp-pageno">- ${i + 1} -</div>` : ""}
        <div class="qp-body">${sheet.nodes.map(n => n.outerHTML).join("")}</div>
        ${i < sheets.length - 1 && sheet.cont ? `<div class="qp-cont">${escapeForPrint(sheet.cont)}</div>` : ""}
      </section>`).join("");

    printWindow.document.write(`<!doctype html>
      <html lang="th">
        <head>
          <meta charset="utf-8">
          <title>${escapeForPrint(title)}</title>
          <link rel="stylesheet" href="${escapeForPrint(cssHref)}">
        </head>
        <body class="quo-print-body">
          <div class="quo-print-toolbar">
            <span id="qpStatus" class="qp-status">กำลังโหลดฟอนต์...</span>
            <button type="button" id="printBtn" class="btn btn-primary" disabled>พิมพ์</button>
          </div>
          ${sheetHtml}
        </body>
      </html>`);
    printWindow.document.close();

    const doc = printWindow.document;
    const printBtn = doc.getElementById("printBtn");
    printBtn.addEventListener("click", () => printWindow.print());

    (async () => {
      const link = doc.querySelector('link[rel="stylesheet"]');
      if (link && !link.sheet) {
        await new Promise(resolve => {
          link.addEventListener("load", resolve, { once: true });
          link.addEventListener("error", resolve, { once: true });
        });
      }
      await waitQuoFonts(doc, thai);
    })().finally(() => {
      doc.getElementById("qpStatus").textContent = `${sheets.length} หน้า`;
      printBtn.disabled = false;
    });
  }

  // ---------------------------------------------------------------- บรรทัดที่เลือกใส่ได้
  /**
   * อ้างถึง / สิ่งที่ส่งมาด้วย -- ว่างอยู่ = ซ่อน (ไม่กินบรรทัดบนกระดาษ ให้หน้าบนจอตรง
   * กับที่พิมพ์) เพิ่มจากปุ่มบนแถบเครื่องมือ ลบข้อความจนว่างแล้วออกจากช่อง = ซ่อนคืน
   */
  function syncQuoOptionalLines() {
    quoPaper.querySelectorAll("[data-optional]").forEach(line => {
      const field = line.querySelector("[data-field]");
      const empty = !field || !field.textContent.trim();
      line.classList.toggle("qd-off", empty && document.activeElement !== field);
    });
  }

  document.querySelectorAll("[data-quo-optional]").forEach(btn => {
    btn.addEventListener("click", () => {
      const line = quoPaper.querySelector(`[data-optional="${btn.dataset.quoOptional}"]`);
      if (!line) return;
      line.classList.remove("qd-off");
      const field = line.querySelector("[data-field]");
      if (field) field.focus();
      scheduleQuoLayout(0);
    });
  });

  quoPaper.addEventListener("focusout", (e) => {
    if (e.target.closest && e.target.closest("[data-optional]")) {
      setTimeout(() => { syncQuoOptionalLines(); scheduleQuoLayout(0); }, 0);
    }
  });

  document.getElementById("quotationPrintBtn").addEventListener("click", printQuotation);

  // ---------------------------------------------------------------- รายการ
  async function openQuotationView() {
    showView("quotation");
    setQuoDirty(false);
    hideError(quotationError);
    quotationNotice.hidden = true;
    quotationList.innerHTML = '<div class="request-empty">กำลังโหลด...</div>';
    quotationListMode.hidden = false;
    quotationFormMode.hidden = true;
    try {
      quotations = await backend.loadWorkItems("quotation");
    } catch (err) {
      quotations = [];
      showError(quotationError, moduleErrorText(err));
    }
    renderQuotationTab();
  }

  function showQuotationList() {
    quotationFormMode.hidden = true;
    evCalcMode.hidden = true;
    priceBookMode.hidden = true;
    protectCalcMode.hidden = true;
    protectCatalogMode.hidden = true;
    quotationListMode.hidden = false;
    renderQuotationTab();
    window.scrollTo(0, 0);
  }

  function setQuotationTab(tab) {
    quotationTab = tab;
    quotationQuery = "";
    quotationSearch.value = "";
    quoTabBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.quoTab === tab));
    renderQuotationTab();
  }

  quoTabBtns.forEach(btn => btn.addEventListener("click", () => setQuotationTab(btn.dataset.quoTab)));

  async function renderQuotationTab() {
    // แท็บ "คำนวณราคา EV Charger" ไม่ใช่รายการ -- เป็นหน้าเครื่องคำนวณของตัวเอง
    if (quotationTab === "ev") {
      quotationListMode.hidden = true;
      await openEvCalc();
      return;
    }
    if (quotationTab === "protect") {
      quotationListMode.hidden = true;
      await openProtectCalc();
      return;
    }
    evCalcMode.hidden = true;
    priceBookMode.hidden = true;
    protectCalcMode.hidden = true;
    protectCatalogMode.hidden = true;
    quotationListMode.hidden = false;

    quotationAddBtn.hidden = quotationTab !== "docs";
    priceItemAddBtn.hidden = quotationTab !== "prices";
    quotationSearch.placeholder = quotationTab === "prices"
      ? "ค้นหารายการราคาด้วยชื่อหรือหมวด..."
      : "ค้นหาด้วยเรื่อง, ผู้รับ, เลขที่หนังสือ...";

    if (quotationTab === "prices") {
      quotationListTitle.textContent = "ราคาและค่าแรง";
      await ensurePriceBooks();
      await ensurePriceItems();
      renderPriceItems();
      return;
    }

    quotationListTitle.textContent = quotationTab === "templates" ? "แม่แบบใบเสนอราคา" : "ใบเสนอราคา";
    renderQuotations();
  }

  function quotationMatches(item, query) {
    if (!query) return true;
    const d = item.data || {};
    return [item.title, item.status, d.subject, d.recipient, d.refNo, d.dateText,
      d.paraCause, d.templateName, d.customer]
      .some(v => String(v || "").toLowerCase().includes(query));
  }

  function renderQuotations() {
    const query = quotationQuery.trim().toLowerCase();
    const templatesTab = quotationTab === "templates";
    const filtered = quotations
      .filter(item => Boolean(item.data && item.data.isTemplate) === templatesTab)
      .filter(item => quotationMatches(item, query));

    quotationCount.textContent = `ทั้งหมด ${filtered.length} รายการ`;
    quotationList.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = query
        ? "ไม่พบรายการที่ค้นหา"
        : (templatesTab
          ? "ยังไม่มีแม่แบบ -- เปิดใบเสนอราคาที่เขียนไว้ดีแล้ว กด \"บันทึกเป็นแม่แบบ\" เพื่อใช้ซ้ำครั้งหน้า"
          : "ยังไม่มีใบเสนอราคา -- กด \"+ สร้างใบเสนอราคา\" หรือเลือกจากแท็บแม่แบบ");
      quotationList.appendChild(empty);
      return;
    }

    filtered.forEach(item => {
      const d = item.data || {};
      const card = document.createElement("div");
      card.className = "request-card request-card-clickable";

      const top = document.createElement("div");
      top.className = "request-card-top";
      const badges = document.createElement("div");
      badges.className = "request-badges";

      if (!templatesTab && d.refNo && d.refNo.trim() !== "มท") {
        const refEl = document.createElement("span");
        refEl.className = "request-badge request-badge-id";
        refEl.textContent = `ที่ ${d.refNo}`;
        badges.appendChild(refEl);
      }
      const statusEl = document.createElement("span");
      statusEl.className = `request-badge request-badge-status tone-${QUOTATION_STATUS_TONE[item.status] || "info"}`;
      statusEl.textContent = templatesTab ? "แม่แบบ" : (item.status || "ร่าง");
      badges.appendChild(statusEl);

      const dateEl = document.createElement("span");
      dateEl.className = "request-date";
      dateEl.textContent = templatesTab ? "" : (d.dateText || "");
      top.append(badges, dateEl);

      const name = document.createElement("div");
      name.className = "request-name";
      name.textContent = templatesTab ? (d.templateName || item.title) : (d.subject || item.title || "(ไม่มีเรื่อง)");
      card.append(top, name);

      if (d.recipient) {
        const to = document.createElement("div");
        to.className = "request-meta";
        to.textContent = `เรียน ${d.recipient}`;
        card.appendChild(to);
      }
      if (Array.isArray(d.lines) && d.lines.length) {
        const total = document.createElement("div");
        total.className = "request-meta request-meta-queue";
        total.textContent = `${d.lines.length} รายการ · รวมทั้งสิ้น ${formatMoney(quotationTotals(d.lines, d.vatEnabled).grand)} บาท`;
        card.appendChild(total);
      }

      if (templatesTab) {
        const actions = document.createElement("div");
        actions.className = "quo-template-actions";
        const useBtn = document.createElement("button");
        useBtn.type = "button";
        useBtn.className = "btn btn-primary";
        useBtn.textContent = "ใช้แม่แบบนี้สร้างใบเสนอราคา";
        useBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const source = { ...d };
          delete source.templateName;
          delete source.isTemplate;
          openQuotationForm(null, source);
        });
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn btn-ghost";
        editBtn.textContent = "แก้ไขแม่แบบ";
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openQuotationForm(item);
        });
        actions.append(useBtn, editBtn);
        card.appendChild(actions);
        // คลิกที่ตัวการ์ด = ใช้แม่แบบ (งานที่ทำบ่อยกว่าแก้แม่แบบ)
        card.addEventListener("click", () => useBtn.click());
      } else {
        card.addEventListener("click", () => openQuotationForm(item));
      }

      quotationList.appendChild(card);
    });
  }

  quotationAddBtn.addEventListener("click", () => openQuotationForm(null));

  quotationSearch.addEventListener("input", () => {
    quotationQuery = quotationSearch.value;
    if (quotationTab === "prices") renderPriceItems();
    else renderQuotations();
  });

  // ---------------------------------------------------------------- รายการราคา
  /**
   * รายการราคา (kind = price_item) -- ตารางราคามาตรฐานที่หยิบใส่ใบเสนอราคาได้
   * data = { category, unitPrice, note } ชื่อรายการอยู่ใน title
   * แก้ในตารางได้ทันที แถวที่แก้แล้วยังไม่บันทึกเป็นสีเหลือง กดบันทึกทีละแถว --
   * บันทึกทีละแถวแทนทั้งตาราง เพราะสองคนแก้คนละแถวพร้อมกันต้องไม่ทับกัน
   */
  async function ensurePriceItems(force) {
    if (priceItemsLoaded && !force) return;
    try {
      priceItems = await backend.loadWorkItems("price_item");
      priceItemsLoaded = true;
    } catch (err) {
      priceItems = [];
      showError(quotationError, moduleErrorText(err));
    }
  }

  function sortedPriceItems(list) {
    return list.slice().sort((a, b) =>
      String(a.data?.category || "").localeCompare(String(b.data?.category || ""), "th")
      || (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
  }

  function priceMatches(item, query) {
    if (!query) return true;
    return [item.title, item.data?.category, item.data?.note]
      .some(v => String(v || "").toLowerCase().includes(query));
  }

  /**
   * ขยายความสูง <textarea> ให้พอดีกับข้อความ -- แก้ปัญหาชื่อรายการยาวถูกตัดใน
   * ตารางรายการราคา (<input> แสดงได้บรรทัดเดียวเท่านั้น ยาวแค่ไหนก็เห็นแค่ส่วน
   * ต้นบรรทัด) ต้องเรียกหลัง element ต่อเข้า DOM จริงแล้วเท่านั้น เพราะ
   * scrollHeight ของ element ที่ยังลอยอยู่นอก DOM จะได้ค่า 0 เสมอ
   */
  function autosizeTextarea(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function renderPriceItems() {
    const query = quotationQuery.trim().toLowerCase();
    const rows = sortedPriceItems(priceItems).filter(item => item.isNew || priceMatches(item, query));
    quotationCount.textContent = `ทั้งหมด ${priceItems.filter(p => !p.isNew).length} รายการ`;
    quotationList.innerHTML = "";
    quotationList.appendChild(renderPriceBooksSection());

    const priceHead = document.createElement("h3");
    priceHead.className = "book-section-head";
    priceHead.textContent = "รายการราคาเดี่ยว (หยิบใส่ใบเสนอราคาได้ทีละรายการ)";
    quotationList.appendChild(priceHead);

    const hint = document.createElement("p");
    hint.className = "field-hint";
    hint.textContent = "แก้ในตารางได้เลย แถวสีเหลือง = ยังไม่ได้บันทึก -- ราคาที่เลือกใส่ใบเสนอราคาไปแล้วจะไม่เปลี่ยนตามเมื่อแก้ราคาที่นี่ภายหลัง";
    quotationList.appendChild(hint);

    const table = document.createElement("table");
    table.className = "price-table";
    table.innerHTML = `
      <thead><tr>
        <th class="price-col-cat">หมวด</th><th>รายการ</th>
        <th class="price-col-price">ราคาต่อหน่วย (บาท)</th><th>หมายเหตุ</th>
        <th class="price-col-actions"></th>
      </tr></thead>`;
    const tbody = document.createElement("tbody");

    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "request-empty";
      td.textContent = query ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีรายการราคา -- กด \"+ เพิ่มรายการราคา\"";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    rows.forEach(item => tbody.appendChild(buildPriceRow(item)));
    table.appendChild(tbody);
    quotationList.appendChild(table);
    // ต่อเข้า DOM แล้วเท่านั้นถึงจะขยายความสูงได้ถูกต้อง (ดู autosizeTextarea)
    table.querySelectorAll("textarea.price-name-input").forEach(autosizeTextarea);

    // หมวดที่เคยใช้ -- ให้พิมพ์หมวดซ้ำได้ตรงตัว ไม่งั้นหมวดเดียวกันสะกดสองแบบ
    // จะกลายเป็นสองกลุ่มในหน้าต่างเลือก
    const datalist = document.createElement("datalist");
    datalist.id = "priceCategoryOptions";
    Array.from(new Set(priceItems.map(p => p.data?.category).filter(Boolean))).forEach(cat => {
      const option = document.createElement("option");
      option.value = cat;
      datalist.appendChild(option);
    });
    quotationList.appendChild(datalist);
  }

  function buildPriceRow(item) {
    const tr = document.createElement("tr");
    const d = item.data || {};

    const makeInput = (value, attrs) => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = value;
      Object.entries(attrs || {}).forEach(([k, v]) => input.setAttribute(k, v));
      input.addEventListener("input", () => {
        tr.classList.add("price-row-dirty");
        saveBtn.disabled = false;
      });
      return input;
    };

    const cat = makeInput(d.category || "", { list: "priceCategoryOptions", placeholder: "หมวด" });
    const name = document.createElement("textarea");
    name.className = "price-name-input";
    name.rows = 1;
    name.placeholder = "ชื่อรายการ";
    name.value = item.title || "";
    name.addEventListener("input", () => {
      tr.classList.add("price-row-dirty");
      saveBtn.disabled = false;
      autosizeTextarea(name);
    });
    const price = makeInput(item.isNew ? "" : formatMoney(d.unitPrice), { inputmode: "decimal", placeholder: "0.00" });
    price.addEventListener("blur", () => {
      const value = quoParseNumber(price.value);
      if (!Number.isNaN(value) && price.value.trim()) price.value = formatMoney(value);
    });
    const note = makeInput(d.note || "", { placeholder: "หมายเหตุ" });

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-primary";
    saveBtn.textContent = "บันทึก";
    saveBtn.disabled = !item.isNew;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-ghost";
    delBtn.textContent = item.isNew ? "ยกเลิก" : "ลบ";

    saveBtn.addEventListener("click", async () => {
      hideError(quotationError);
      const title = name.value.trim();
      const unitPrice = quoParseNumber(price.value);
      if (!title) { showError(quotationError, "กรุณากรอกชื่อรายการ"); name.focus(); return; }
      if (Number.isNaN(unitPrice)) { showError(quotationError, "ราคาต่อหน่วยต้องเป็นตัวเลข"); price.focus(); return; }
      setBusy(saveBtn, true, "กำลังบันทึก...");
      try {
        const saved = await backend.saveWorkItem("price_item", {
          id: item.id,
          title,
          status: "",
          data: { category: cat.value.trim(), unitPrice: quoRound2(unitPrice), note: note.value.trim() }
        });
        const index = priceItems.indexOf(item);
        if (index === -1) priceItems.push(saved);
        else priceItems[index] = saved;
        renderPriceItems();
      } catch (err) {
        showError(quotationError, moduleErrorText(err));
        setBusy(saveBtn, false);
      }
    });

    delBtn.addEventListener("click", async () => {
      if (item.isNew) {
        priceItems = priceItems.filter(p => p !== item);
        renderPriceItems();
        return;
      }
      if (!confirm(`ลบรายการ "${item.title}" ใช่หรือไม่?\n(ใบเสนอราคาที่ใช้รายการนี้ไปแล้วไม่ได้รับผลกระทบ)`)) return;
      setBusy(delBtn, true, "กำลังลบ...");
      try {
        await backend.deleteWorkItem(item.id);
        priceItems = priceItems.filter(p => p !== item);
        renderPriceItems();
      } catch (err) {
        showError(quotationError, moduleErrorText(err));
        setBusy(delBtn, false);
      }
    });

    if (item.isNew) tr.classList.add("price-row-dirty");

    const cells = [
      ["price-col-cat", cat], ["", name], ["price-col-price", price], ["", note], ["price-col-actions", null]
    ];
    cells.forEach(([cls, input]) => {
      const td = document.createElement("td");
      if (cls) td.className = cls;
      if (input) td.appendChild(input);
      else td.append(saveBtn, " ", delBtn);
      tr.appendChild(td);
    });
    return tr;
  }

  priceItemAddBtn.addEventListener("click", () => {
    // แถวใหม่ขึ้นบนสุดเสมอแม้กำลังค้นหาอยู่ (priceMatches ข้าม isNew) -- id จองไว้ก่อน
    // กดบันทึกซ้ำจึงไม่สร้างสองแถว
    priceItems.unshift({ id: newWorkItemId(), title: "", data: { category: "", unitPrice: 0, note: "" }, isNew: true, sortOrder: -1 });
    renderPriceItems();
    const first = quotationList.querySelector(".price-table tbody input");
    if (first) first.focus();
  });

  // ---------------------------------------------------------------- เลือกราคาใส่ตาราง
  async function openQuoPricePicker() {
    quoPriceNote.hidden = true;
    quoPriceSearch.value = "";
    quoPriceModal.hidden = false;
    quoPriceList.innerHTML = '<div class="request-empty">กำลังโหลด...</div>';
    await ensurePriceItems();
    renderQuoPricePicker();
    quoPriceSearch.focus();
  }

  function renderQuoPricePicker() {
    const query = quoPriceSearch.value.trim().toLowerCase();
    const items = sortedPriceItems(priceItems.filter(p => !p.isNew)).filter(p => priceMatches(p, query));
    quoPriceList.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = priceItems.length
        ? "ไม่พบรายการที่ค้นหา"
        : "ยังไม่มีรายการราคา -- เพิ่มได้ที่แท็บ \"รายการราคา\" ในหน้ารายการใบเสนอราคา";
      quoPriceList.appendChild(empty);
      return;
    }

    let lastCategory = null;
    items.forEach(item => {
      const category = item.data?.category || "ไม่ระบุหมวด";
      if (category !== lastCategory) {
        const head = document.createElement("div");
        head.className = "quo-price-group";
        head.textContent = category;
        quoPriceList.appendChild(head);
        lastCategory = category;
      }
      const row = document.createElement("div");
      row.className = "quo-price-item";
      const name = document.createElement("span");
      name.className = "quo-price-item-name";
      name.textContent = item.title;
      if (item.data?.note) {
        const note = document.createElement("span");
        note.className = "quo-price-item-cat";
        note.textContent = item.data.note;
        name.appendChild(note);
      }
      const price = document.createElement("span");
      price.className = "quo-price-item-price";
      price.textContent = `${formatMoney(item.data?.unitPrice)} บาท`;
      const add = document.createElement("button");
      add.type = "button";
      add.className = "btn btn-ghost";
      add.textContent = "+ เพิ่ม";
      add.addEventListener("click", () => {
        quoLineModel.push({ description: item.title, unitPrice: Number(item.data?.unitPrice) || 0, qty: 1 });
        setQuoDirty(true);
        renderQuoLines();
        quoPriceNote.textContent = `เพิ่ม "${item.title}" แล้ว (จำนวน 1 -- แก้จำนวนในตารางได้)`;
        quoPriceNote.hidden = false;
      });
      row.append(name, price, add);
      quoPriceList.appendChild(row);
    });
  }

  document.getElementById("quoPickPriceBtn").addEventListener("click", openQuoPricePicker);
  quoPriceSearch.addEventListener("input", renderQuoPricePicker);
  document.getElementById("quoPriceCloseBtn").addEventListener("click", () => { quoPriceModal.hidden = true; });
  quoPriceModal.addEventListener("click", (e) => { if (e.target === quoPriceModal) quoPriceModal.hidden = true; });

  /** ล้างหน้าจอใบเสนอราคาตอนออกจากระบบ (เรียกจาก clearModuleScreens) */
  function clearQuotationScreens() {
    quotations = [];
    priceItems = [];
    priceItemsLoaded = false;
    quoLineModel = [];
    quotationEditing = null;
    quoPendingId = null;
    quotationQuery = "";
    quotationSearch.value = "";
    quotationList.innerHTML = "";
    quoLines.innerHTML = "";
    quoPriceList.innerHTML = "";
    quoPriceModal.hidden = true;
    removeQuoGaps();
    quoFieldEls.forEach(el => { el.innerHTML = ""; });
    quoContOverrides = {};
    quoEvCalc = null;
    quoProtectCalc = null;
    setQuoDirty(false);
    clearPricingScreens();
    clearProtectScreens();
  }

  // ============================================ งวดราคา + คำนวณราคา EV Charger
  /**
   * งานธุรกิจเสริม: คิดราคางานติดตั้ง EV Charger วงจรที่ 2 ของบ้านอยู่อาศัย
   *
   *   ราคาอุปกรณ์ + ค่าแรงคนงาน + ค่าควบคุมงาน      = ต้นทุนสืบราคา
   *   + ค่าดำเนินการ (ร้อยละของต้นทุนสืบราคา)        = ต้นทุนรวม
   *   + กำไร (ร้อยละของต้นทุนรวม ตามช่วงต้นทุน)      = ราคาเสนอ
   *   ปัดขึ้นเต็มบาท  ->  + VAT 7%                   = ราคารวมภาษี
   *
   * ทุกราคาและทุกอัตราอ่านจาก "งวดราคา" (kind = price_book) ที่เลือก ไม่ฝังในโค้ด
   * -- ราคาของและค่าแรงขึ้นทุกปี ถ้าฝังไว้จะแก้ได้เฉพาะคนที่แก้โค้ดเป็น
   *
   * หนึ่งงวด = หนึ่งแถว (ราคาทุกรายการ + ค่าแรงทุกจำนวนวัน + อัตราทั้งหมด) แก้ทั้ง
   * งวดแล้วกดบันทึกครั้งเดียว อัปเดตราคาประจำงวดจึงไม่มีสภาพ "แก้ไปได้ครึ่งเดียว"
   * และการสร้างงวดใหม่คือคัดลอกงวดเดิมมาแก้ -- ราคาเก่าทั้งชุดยังอยู่ครบเสมอ
   *
   * ใบเสนอราคาที่คิดจากงวดไหนแล้ว เก็บ "สำเนาผลคำนวณ" ไว้ในใบนั้น (data.evCalc)
   * แก้ราคาในงวดภายหลังจึงไม่ย้อนไปเปลี่ยนใบที่เสนอลูกค้าไปแล้ว
   */
  const EV_VAT_PCT = 7;
  const EV_DEFAULT_JOB_NAME =
    "ติดตั้งเครื่องอัดประจุยานยนต์ไฟฟ้า (EV Charger) วงจรที่ 2 สำหรับบ้านอยู่อาศัย";

  let priceBooks = [];
  let priceBooksLoaded = false;
  let bookEditing = null;     // งวดที่กำลังแก้ (null = งวดใหม่ ยังไม่เคยบันทึก)
  let bookDraft = null;       // สำเนาที่กำลังแก้ -- บันทึกสำเร็จแล้วค่อยทับของจริง
  let bookDirtyFlag = false;
  let bookItemQuery = "";

  let evQty = new Map();      // key ของรายการ -> จำนวนที่เลือก
  let evCollapsedGroups = new Set();   // ชื่อหมวดที่ถูกย่อไว้ -- ตั้งต้นใหม่ทุกครั้งที่เปลี่ยนงวด
  let evBookId = null;
  let evDays = null;
  let evSearchQuery = "";
  let evReturnToQuotation = false;   // เปิดจากใบเสนอราคา -> ใส่ราคากลับใบเดิม

  const evCalcMode = document.getElementById("evCalcMode");
  const priceBookMode = document.getElementById("priceBookMode");
  const evBookSelect = document.getElementById("evBook");
  const evDaysSelect = document.getElementById("evDays");
  const evJobName = document.getElementById("evJobName");
  const evItemsEl = document.getElementById("evItems");
  const evSummaryEl = document.getElementById("evSummary");
  const evSummaryNote = document.getElementById("evSummaryNote");
  const evError = document.getElementById("evError");
  const evSearch = document.getElementById("evSearch");
  const evOnlyPicked = document.getElementById("evOnlyPicked");
  const evPickedCount = document.getElementById("evPickedCount");
  const evSubtitle = document.getElementById("evSubtitle");
  const bookError = document.getElementById("bookError");
  const bookDirty = document.getElementById("bookDirty");
  const bookItemsEl = document.getElementById("bookItems");
  const bookLabourEl = document.getElementById("bookLabour");
  const bookTiersEl = document.getElementById("bookTiers");
  const pricePasteModal = document.getElementById("pricePasteModal");
  const pricePasteInput = document.getElementById("pricePasteInput");
  const pricePasteError = document.getElementById("pricePasteError");

  async function ensurePriceBooks(force) {
    if (priceBooksLoaded && !force) return;
    try {
      priceBooks = await backend.loadWorkItems("price_book");
      priceBooksLoaded = true;
    } catch (err) {
      priceBooks = [];
      showError(quotationError, moduleErrorText(err));
    }
  }

  /** งวดที่ใช้อยู่ตอนนี้ = งวดที่ยังไม่ยกเลิก ซึ่งเริ่มใช้แล้วและใหม่ที่สุด */
  function currentPriceBook() {
    const today = todayDateString();
    const usable = priceBooks
      .filter(b => b.status !== "ยกเลิก")
      .sort((a, b) => String((b.data && b.data.effectiveFrom) || "")
        .localeCompare(String((a.data && a.data.effectiveFrom) || "")));
    return usable.find(b => String((b.data && b.data.effectiveFrom) || "") <= today) || usable[0] || null;
  }

  function priceBookById(id) {
    return priceBooks.find(b => String(b.id) === String(id)) || null;
  }

  function bookLabourRows(book) {
    const rows = book && book.data && Array.isArray(book.data.labour) ? book.data.labour : [];
    return rows.slice().sort((a, b) => (Number(a.days) || 0) - (Number(b.days) || 0));
  }

  /** อัตรากำไรตามต้นทุนรวม -- ช่วงที่เว้น "ไม่เกิน" ว่างคือช่วงบนสุด */
  function profitPctFor(book, cost) {
    const tiers = book && book.data && Array.isArray(book.data.profitTiers) ? book.data.profitTiers : [];
    const bounded = tiers.filter(t => Number(t.max) > 0).sort((a, b) => Number(a.max) - Number(b.max));
    const hit = bounded.find(t => cost <= Number(t.max));
    if (hit) return Number(hit.pct) || 0;
    const open = tiers.find(t => !(Number(t.max) > 0));
    return open ? Number(open.pct) || 0 : 0;
  }

  /**
   * คิดราคาทั้งชุด ปัดทศนิยม 2 ตำแหน่งทีละขั้นเหมือนกระดาษคำนวณของแผนก
   * แล้วปัดขึ้นเต็มบาทที่ "ราคาเสนอ" ก่อนคิดภาษี
   */
  function computeEvPrice(book, days, qtyMap) {
    const items = book && book.data && Array.isArray(book.data.items) ? book.data.items : [];
    const lines = items
      .map(item => ({ item, qty: Number(qtyMap.get(item.key)) || 0 }))
      .filter(row => row.qty > 0)
      .map(row => ({
        key: row.item.key,
        group: row.item.group || "",
        name: row.item.name || "",
        unit: row.item.unit || "",
        brand: row.item.brand || "",
        price: Number(row.item.price) || 0,
        qty: row.qty,
        amount: quoRound2((Number(row.item.price) || 0) * row.qty)
      }));

    const labour = bookLabourRows(book).find(l => Number(l.days) === Number(days)) || null;
    const materialTotal = quoRound2(lines.reduce((sum, row) => sum + row.amount, 0));
    const wage = quoRound2(labour ? labour.wage : 0);
    const supervision = quoRound2(labour ? labour.supervision : 0);
    const baseCost = quoRound2(materialTotal + wage + supervision);
    const overheadPct = Number(book && book.data && book.data.overheadPct) || 0;
    const overhead = quoRound2(baseCost * overheadPct / 100);
    const costTotal = quoRound2(baseCost + overhead);
    const profitPct = profitPctFor(book, costTotal);
    const profit = quoRound2(costTotal * profitPct / 100);
    const total = quoRound2(costTotal + profit);
    // ปัดขึ้นเต็มบาทก่อนคิด VAT (เดิมปัดขึ้นหลักสิบ -- เจ้าของระบบให้เปลี่ยนให้
    // เหมือนเครื่องคำนวณอุปกรณ์ป้องกัน ซึ่งปัดเต็มบาททุกก้อน)
    const say = ceilBaht(total);
    const vat = quoRound2(say * EV_VAT_PCT / 100);
    const grand = quoRound2(say + vat);

    return {
      bookId: book ? book.id : null,
      bookTitle: book ? book.title : "",
      days: Number(days) || 0,
      lines: lines,
      materialTotal: materialTotal,
      wage: wage,
      supervision: supervision,
      baseCost: baseCost,
      overheadPct: overheadPct,
      overhead: overhead,
      costTotal: costTotal,
      profitPct: profitPct,
      profit: profit,
      total: total,
      say: say,
      vatPct: EV_VAT_PCT,
      vat: vat,
      grand: grand
    };
  }

  // ------------------------------------------------------------ เครื่องคำนวณ
  async function openEvCalc(options) {
    const opts = options || {};
    hideError(evError);
    evReturnToQuotation = Boolean(opts.fromQuotation);
    quotationListMode.hidden = true;
    quotationFormMode.hidden = true;
    priceBookMode.hidden = true;
    evCalcMode.hidden = false;
    window.scrollTo(0, 0);

    evItemsEl.innerHTML = '<div class="request-empty">กำลังโหลดราคา...</div>';
    await ensurePriceBooks();

    // เปิดจากใบที่เคยคิดราคาไว้แล้ว -- ตั้งค่าตามครั้งก่อนให้แก้ต่อได้เลย
    const prev = opts.fromQuotation ? quoEvCalc : null;
    const book = (prev && priceBookById(prev.bookId)) || currentPriceBook();
    evBookId = book ? book.id : null;
    evQty = new Map();
    resetEvGroupCollapse(book);
    if (prev && Array.isArray(prev.lines)) prev.lines.forEach(l => evQty.set(l.key, Number(l.qty) || 0));
    evDays = prev ? Number(prev.days) : null;
    evJobName.value = (prev && prev.jobName) || EV_DEFAULT_JOB_NAME;
    evSearch.value = "";
    evSearchQuery = "";
    evOnlyPicked.checked = false;

    renderEvBookOptions();
    renderEvDaysOptions();
    renderEvItems();
    evSubtitle.textContent = evReturnToQuotation
      ? "คิดราคาแล้วกด “ใส่ราคาในใบเสนอราคา” เพื่อกลับไปที่ใบเดิม"
      : "คิดราคาแล้วกด “ใส่ราคาในใบเสนอราคา” เพื่อสร้างใบใหม่จากราคานี้";
  }

  /** ตั้งค่าย่อ/ขยายเริ่มต้นของงวดที่เลือก -- ขยายไว้เฉพาะหมวดแรกที่พบในงวด
   *  (ลำดับตามที่บันทึกไว้ในงวด ไม่ใช่ลำดับตัวอักษร) ส่วนที่เหลือย่อไว้ก่อน
   *  ให้เห็นภาพรวมโดยไม่ต้องเลื่อนอ่านอุปกรณ์หลายสิบรายการทันทีที่เปิดหน้า */
  function resetEvGroupCollapse(book) {
    evCollapsedGroups = new Set();
    const items = book && book.data && Array.isArray(book.data.items) ? book.data.items : [];
    const seen = new Set();
    let first = null;
    items.forEach(item => {
      const group = item.group || "ไม่ระบุหมวด";
      if (seen.has(group)) return;
      seen.add(group);
      if (first === null) first = group;
      else evCollapsedGroups.add(group);
    });
  }

  function renderEvBookOptions() {
    evBookSelect.innerHTML = "";
    const usable = priceBooks.filter(b => b.status !== "ยกเลิก" || String(b.id) === String(evBookId));
    if (!usable.length) {
      const option = document.createElement("option");
      option.textContent = "ยังไม่มีงวดราคา -- สร้างที่แท็บ “ราคาและค่าแรง”";
      evBookSelect.appendChild(option);
      evBookSelect.disabled = true;
      evBookId = null;
      return;
    }
    evBookSelect.disabled = false;
    const current = currentPriceBook();
    usable
      .slice()
      .sort((a, b) => String((b.data && b.data.effectiveFrom) || "")
        .localeCompare(String((a.data && a.data.effectiveFrom) || "")))
      .forEach(book => {
        const option = document.createElement("option");
        option.value = String(book.id);
        const from = book.data && book.data.effectiveFrom
          ? " (เริ่มใช้ " + formatThaiDate(book.data.effectiveFrom) + ")" : "";
        const tag = current && String(current.id) === String(book.id) ? " — งวดปัจจุบัน" : "";
        option.textContent = book.title + from + tag;
        evBookSelect.appendChild(option);
      });
    if (evBookId && priceBookById(evBookId)) evBookSelect.value = String(evBookId);
    else evBookId = evBookSelect.value;
  }

  function renderEvDaysOptions() {
    const rows = bookLabourRows(priceBookById(evBookId));
    evDaysSelect.innerHTML = "";
    if (!rows.length) {
      const option = document.createElement("option");
      option.textContent = "งวดนี้ยังไม่มีค่าแรง";
      evDaysSelect.appendChild(option);
      evDaysSelect.disabled = true;
      evDays = null;
      return;
    }
    evDaysSelect.disabled = false;
    rows.forEach(row => {
      const option = document.createElement("option");
      option.value = String(row.days);
      option.textContent = row.days + " วัน — ค่าแรง " + formatMoney(row.wage)
        + " / ควบคุมงาน " + formatMoney(row.supervision);
      evDaysSelect.appendChild(option);
    });
    if (!rows.some(r => Number(r.days) === Number(evDays))) evDays = rows[0].days;
    evDaysSelect.value = String(evDays);
  }

  function renderEvItems() {
    const book = priceBookById(evBookId);
    const items = book && book.data && Array.isArray(book.data.items) ? book.data.items : [];
    const query = evSearchQuery.trim().toLowerCase();
    evItemsEl.innerHTML = "";

    const shown = items.filter(item => {
      if (evOnlyPicked.checked && !(Number(evQty.get(item.key)) > 0)) return false;
      if (!query) return true;
      return [item.name, item.group, item.brand, item.unit]
        .some(v => String(v || "").toLowerCase().includes(query));
    });

    if (!shown.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = items.length ? "ไม่พบรายการที่ค้นหา" : "งวดนี้ยังไม่มีรายการอุปกรณ์";
      evItemsEl.appendChild(empty);
      renderEvSummary();
      return;
    }

    // จัดกลุ่มด้วย Map คงลำดับที่พบครั้งแรก (ไม่ใช่เรียงตัวอักษร) ให้ตรงกับลำดับ
    // ที่บันทึกไว้ในงวดเสมอ -- เหมือนพฤติกรรมเดิมตอนเทียบ lastGroup ตรง ๆ
    const groups = new Map();
    shown.forEach(item => {
      const group = item.group || "ไม่ระบุหมวด";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(item);
    });

    groups.forEach((groupItems, group) => {
      const collapsed = evCollapsedGroups.has(group);
      const pickedCount = groupItems.filter(i => Number(evQty.get(i.key)) > 0).length;

      const head = document.createElement("button");
      head.type = "button";
      head.className = "ev-group";
      head.classList.toggle("is-collapsed", collapsed);
      head.setAttribute("aria-expanded", String(!collapsed));

      const arrow = document.createElement("span");
      arrow.className = "ev-group-arrow";
      arrow.textContent = "\u25be";
      arrow.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "ev-group-label";
      label.textContent = group;

      const count = document.createElement("span");
      count.className = "ev-group-count";
      count.textContent = pickedCount > 0
        ? groupItems.length + " รายการ · เลือกแล้ว " + pickedCount
        : groupItems.length + " รายการ";

      head.append(arrow, label, count);
      head.addEventListener("click", () => {
        if (evCollapsedGroups.has(group)) evCollapsedGroups.delete(group);
        else evCollapsedGroups.add(group);
        renderEvItems();
      });
      evItemsEl.appendChild(head);

      if (collapsed) return;

      groupItems.forEach(item => {
        const row = document.createElement("div");
        row.className = "ev-item";

        const name = document.createElement("div");
        name.className = "ev-item-name";
        name.textContent = item.name;
        if (item.brand) {
          const brand = document.createElement("span");
          brand.className = "ev-item-brand";
          brand.textContent = item.brand;
          name.appendChild(brand);
        }

        const price = document.createElement("div");
        price.className = "ev-item-price";
        price.textContent = formatMoney(item.price) + " / " + (item.unit || "หน่วย");

        const qtyWrap = document.createElement("div");
        qtyWrap.className = "ev-item-qty";
        const minus = document.createElement("button");
        minus.type = "button";
        minus.className = "ev-step";
        minus.textContent = "−";
        minus.setAttribute("aria-label", "ลดจำนวน " + item.name);
        const qty = document.createElement("input");
        qty.type = "text";
        qty.inputMode = "decimal";
        qty.className = "ev-qty-input";
        qty.value = Number(evQty.get(item.key)) > 0 ? String(evQty.get(item.key)) : "";
        qty.placeholder = "0";
        qty.setAttribute("aria-label", "จำนวน " + item.name);
        const plus = document.createElement("button");
        plus.type = "button";
        plus.className = "ev-step";
        plus.textContent = "+";
        plus.setAttribute("aria-label", "เพิ่มจำนวน " + item.name);

        const amount = document.createElement("div");
        amount.className = "ev-item-amount";

        const paint = () => {
          const value = Number(evQty.get(item.key)) || 0;
          amount.textContent = value > 0 ? formatMoney(quoRound2(value * (Number(item.price) || 0))) : "";
          row.classList.toggle("is-picked", value > 0);
        };
        const setQty = (value) => {
          const next = Math.max(0, quoRound2(value));
          if (next > 0) evQty.set(item.key, next);
          else evQty.delete(item.key);
          paint();
          renderEvSummary();
        };

        qty.addEventListener("input", () => {
          const value = quoParseNumber(qty.value);
          setQty(Number.isNaN(value) ? 0 : value);
        });
        minus.addEventListener("click", () => {
          const value = Math.max(0, (Number(evQty.get(item.key)) || 0) - 1);
          qty.value = value > 0 ? String(value) : "";
          setQty(value);
        });
        plus.addEventListener("click", () => {
          const value = (Number(evQty.get(item.key)) || 0) + 1;
          qty.value = String(value);
          setQty(value);
        });

        qtyWrap.append(minus, qty, plus);
        row.append(name, price, qtyWrap, amount);
        evItemsEl.appendChild(row);
        paint();
      });
    });

    renderEvSummary();
  }

  function renderEvSummary() {
    const book = priceBookById(evBookId);
    const calc = computeEvPrice(book, evDays, evQty);
    evPickedCount.textContent = calc.lines.length
      ? "เลือกแล้ว " + calc.lines.length + " รายการ"
      : "ยังไม่ได้เลือกอุปกรณ์";

    const rows = [
      ["ราคาอุปกรณ์", calc.materialTotal, "", ""],
      ["ค่าแรงคนงาน", calc.wage, calc.days + " วัน", ""],
      ["ค่าควบคุมงาน", calc.supervision, calc.days + " วัน", ""],
      ["รวมต้นทุนสืบราคา", calc.baseCost, "", "is-sub"],
      ["ค่าดำเนินการ " + calc.overheadPct + "%", calc.overhead, "", ""],
      ["ต้นทุนรวม", calc.costTotal, "", "is-sub"],
      ["กำไร " + calc.profitPct + "%", calc.profit, "", ""],
      ["รวมก่อนปัดเศษ", calc.total, "", ""],
      ["ราคาเสนอ (ปัดขึ้นเต็มบาท)", calc.say, "", "is-say"],
      ["ภาษีมูลค่าเพิ่ม " + calc.vatPct + "%", calc.vat, "", ""],
      ["รวมทั้งสิ้น", calc.grand, "", "is-grand"]
    ];

    evSummaryEl.innerHTML = "";
    rows.forEach(entry => {
      const dt = document.createElement("dt");
      dt.textContent = entry[0];
      if (entry[2]) {
        const small = document.createElement("span");
        small.className = "ev-summary-hint";
        small.textContent = entry[2];
        dt.appendChild(small);
      }
      const dd = document.createElement("dd");
      dd.textContent = formatMoney(entry[1]);
      if (entry[3]) { dt.classList.add(entry[3]); dd.classList.add(entry[3]); }
      evSummaryEl.append(dt, dd);
    });

    evSummaryNote.textContent = book
      ? "อัตราทั้งหมดมาจากงวด “" + book.title
        + "” -- ใบเสนอราคาที่ออกไปแล้วจะไม่เปลี่ยนตามเมื่อแก้ราคาในงวดภายหลัง"
      : "ยังไม่ได้เลือกงวดราคา";
    return calc;
  }

  evBookSelect.addEventListener("change", () => {
    evBookId = evBookSelect.value;
    // รายการของคนละงวดเป็นคนละ key -- ล้างจำนวนที่เลือกไว้ ไม่ให้ค้างของที่ไม่มีอยู่
    evQty = new Map();
    resetEvGroupCollapse(priceBookById(evBookId));
    renderEvDaysOptions();
    renderEvItems();
  });
  evDaysSelect.addEventListener("change", () => {
    evDays = Number(evDaysSelect.value);
    renderEvSummary();
  });
  evSearch.addEventListener("input", () => { evSearchQuery = evSearch.value; renderEvItems(); });
  evOnlyPicked.addEventListener("change", renderEvItems);

  document.getElementById("evResetBtn").addEventListener("click", () => {
    if (!evQty.size) return;
    if (!confirm("ล้างจำนวนอุปกรณ์ที่เลือกไว้ทั้งหมดใช่หรือไม่?")) return;
    evQty = new Map();
    renderEvItems();
  });

  document.getElementById("evBackBtn").addEventListener("click", () => {
    evCalcMode.hidden = true;
    if (evReturnToQuotation) {
      evReturnToQuotation = false;
      quotationFormMode.hidden = false;
    } else {
      setQuotationTab("docs");
    }
  });

  /**
   * ส่งราคาเข้าใบเสนอราคาเป็น "รายการเดียว" ราคาเสนอก่อน VAT -- ไม่แจกแจงอุปกรณ์
   * ให้ลูกค้าเห็น เพราะราคาต่อหน่วยในงวดเป็น "ต้นทุน" ยังไม่รวมค่าดำเนินการและ
   * กำไร เอาไปโชว์แล้วยอดในใบจะไม่ตรงกับราคาที่เสนอจริง
   * รายละเอียดการคิดทั้งหมดเก็บไว้ในใบ (data.evCalc) เปิดกลับมาดู/แก้ต่อได้
   */
  document.getElementById("evApplyBtn").addEventListener("click", () => {
    hideError(evError);
    const book = priceBookById(evBookId);
    if (!book) { showError(evError, "ยังไม่ได้เลือกงวดราคา"); return; }
    const calc = computeEvPrice(book, evDays, evQty);
    if (!calc.lines.length) {
      showError(evError, "ยังไม่ได้เลือกอุปกรณ์ -- ใส่จำนวนอย่างน้อยหนึ่งรายการก่อน");
      return;
    }
    calc.jobName = evJobName.value.trim() || EV_DEFAULT_JOB_NAME;
    calc.calculatedAt = Date.now();

    evCalcMode.hidden = true;
    if (evReturnToQuotation) {
      evReturnToQuotation = false;
      quotationFormMode.hidden = false;
    } else {
      // กลับไปแท็บเอกสารก่อน ไม่งั้นบันทึกเสร็จแล้วหน้าจะเด้งเข้าเครื่องคำนวณอีก
      quotationTab = "docs";
      quoTabBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.quoTab === "docs"));
      openQuotationForm(null);
    }

    // รายการที่มาจากเครื่องคำนวณถูกแทนที่ ไม่ใช่เพิ่มซ้ำเมื่อคิดราคาใหม่
    quoLineModel = quoLineModel.filter(line => !line.fromEv);
    quoLineModel.push({ description: calc.jobName, unitPrice: calc.say, qty: 1, fromEv: true });
    quoEvCalc = calc;
    quoVatEnabled.checked = true;
    renderQuoLines();
    setQuoDirty(true);
    scheduleQuoLayout(0);
    flashQuoSaved("ใส่ราคา " + formatMoney(calc.say) + " บาท (ก่อน VAT) ในใบเสนอราคาแล้ว");
  });

  document.getElementById("quotationEvBtn").addEventListener("click", () => {
    openEvCalc({ fromQuotation: true });
  });

  // ---------------------------------------------------------------- งวดราคา
  function setBookDirty(dirty) {
    bookDirtyFlag = dirty;
    bookDirty.textContent = "ยังไม่ได้บันทึก";
    bookDirty.hidden = !dirty;
  }

  function flashBookSaved(text) {
    bookDirty.textContent = text;
    bookDirty.hidden = false;
    setTimeout(() => { if (!bookDirtyFlag) bookDirty.hidden = true; }, 3000);
  }

  function newPriceBookDraft(source) {
    if (source && source.data) return JSON.parse(JSON.stringify(source.data));
    return {
      effectiveFrom: todayDateString(),
      note: "",
      overheadPct: 7.5,
      labour: [
        { days: 1, wage: 0, supervision: 0 },
        { days: 2, wage: 0, supervision: 0 },
        { days: 3, wage: 0, supervision: 0 }
      ],
      profitTiers: [
        { max: 200000, pct: 25 },
        { max: 500000, pct: 20 },
        { max: 1000000, pct: 15 },
        { max: 2000000, pct: 10 },
        { max: null, pct: 8 }
      ],
      items: []
    };
  }

  function openPriceBook(book, options) {
    const opts = options || {};
    bookEditing = opts.copy ? null : (book || null);
    bookDraft = newPriceBookDraft(book);
    if (!Array.isArray(bookDraft.labour)) bookDraft.labour = [];
    if (!Array.isArray(bookDraft.profitTiers)) bookDraft.profitTiers = [];
    if (!Array.isArray(bookDraft.items)) bookDraft.items = [];
    if (opts.copy) {
      bookDraft.effectiveFrom = todayDateString();
      bookDraft.note = "";
    }
    bookItemQuery = "";
    document.getElementById("bookItemSearch").value = "";
    hideError(bookError);

    document.getElementById("bookName").value = opts.copy
      ? book.title + " (คัดลอก)"
      : (book ? book.title : "");
    document.getElementById("bookFrom").value = bookDraft.effectiveFrom || todayDateString();
    document.getElementById("bookStatus").value = (bookEditing && bookEditing.status) || "ใช้งาน";
    document.getElementById("bookNote").value = bookDraft.note || "";
    document.getElementById("bookOverhead").value =
      bookDraft.overheadPct === null || bookDraft.overheadPct === undefined
        ? "" : String(bookDraft.overheadPct);
    document.getElementById("bookTitleText").textContent = bookEditing ? "แก้ไขงวดราคา" : "งวดราคาใหม่";
    document.getElementById("bookSubtitle").textContent = bookEditing
      ? "แก้ไขล่าสุด: " + (bookEditing.updatedByName || bookEditing.createdByName || "-")
      : (opts.copy ? "คัดลอกราคาทั้งหมดจาก “" + book.title + "” มาแก้ต่อ" : "ยังไม่ได้บันทึก");
    document.getElementById("bookDeleteBtn").hidden = !bookEditing;

    // แสดงหน้าก่อนวาดตาราง -- renderBookItems() ต้องขยายความสูง <textarea> ตาม
    // เนื้อหา (autosizeTextarea) ซึ่งอ่าน scrollHeight ไม่ได้ถ้า element ยังซ่อน
    // อยู่ด้วย [hidden] (มีค่าเป็น 0 เสมอ)
    quotationListMode.hidden = true;
    quotationFormMode.hidden = true;
    evCalcMode.hidden = true;
    priceBookMode.hidden = false;

    renderBookLabour();
    renderBookTiers();
    renderBookItems();
    setBookDirty(false);
    window.scrollTo(0, 0);
  }

  /** ช่องกรอกตัวเลข: แก้แล้วขึ้น "ยังไม่ได้บันทึก" และจัดรูปแบบตอนออกจากช่อง */
  function bookNumberInput(value, onChange, options) {
    const opts = options || {};
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    const blank = value === null || value === undefined || value === "";
    input.value = blank ? "" : (opts.plain ? String(value) : formatMoney(value));
    if (opts.placeholder) input.placeholder = opts.placeholder;
    input.addEventListener("input", () => {
      const parsed = quoParseNumber(input.value);
      onChange(Number.isNaN(parsed) ? 0 : parsed);
      setBookDirty(true);
    });
    input.addEventListener("blur", () => {
      if (!input.value.trim()) return;
      const parsed = quoParseNumber(input.value);
      if (Number.isNaN(parsed)) return;
      input.value = opts.plain ? String(parsed) : formatMoney(parsed);
    });
    return input;
  }

  function bookDeleteCell(onDelete) {
    const td = document.createElement("td");
    td.className = "price-col-actions";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn-ghost";
    del.textContent = "ลบ";
    del.addEventListener("click", onDelete);
    td.appendChild(del);
    return td;
  }

  function renderBookLabour() {
    bookLabourEl.innerHTML = "";
    bookDraft.labour.forEach((row, index) => {
      const tr = document.createElement("tr");
      const tdDays = document.createElement("td");
      tdDays.appendChild(bookNumberInput(row.days, v => { row.days = v; },
        { plain: true, placeholder: "วัน" }));
      const tdWage = document.createElement("td");
      tdWage.className = "price-col-price";
      tdWage.appendChild(bookNumberInput(row.wage, v => { row.wage = v; }));
      const tdSup = document.createElement("td");
      tdSup.className = "price-col-price";
      tdSup.appendChild(bookNumberInput(row.supervision, v => { row.supervision = v; }));
      tr.append(tdDays, tdWage, tdSup, bookDeleteCell(() => {
        bookDraft.labour.splice(index, 1);
        setBookDirty(true);
        renderBookLabour();
      }));
      bookLabourEl.appendChild(tr);
    });
  }

  function renderBookTiers() {
    bookTiersEl.innerHTML = "";
    bookDraft.profitTiers.forEach((tier, index) => {
      const tr = document.createElement("tr");
      const tdMax = document.createElement("td");
      tdMax.className = "price-col-price";
      tdMax.appendChild(bookNumberInput(tier.max, v => { tier.max = v || null; },
        { placeholder: "เว้นว่าง = ไม่จำกัด" }));
      const tdPct = document.createElement("td");
      tdPct.appendChild(bookNumberInput(tier.pct, v => { tier.pct = v; },
        { plain: true, placeholder: "%" }));
      tr.append(tdMax, tdPct, bookDeleteCell(() => {
        bookDraft.profitTiers.splice(index, 1);
        setBookDirty(true);
        renderBookTiers();
      }));
      bookTiersEl.appendChild(tr);
    });
  }

  function renderBookItems() {
    const query = bookItemQuery.trim().toLowerCase();
    bookItemsEl.innerHTML = "";
    document.getElementById("bookItemCount").textContent = String(bookDraft.items.length);

    const rows = bookDraft.items.filter(item => !query
      || [item.name, item.group, item.brand].some(v => String(v || "").toLowerCase().includes(query)));

    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.className = "request-empty";
      td.textContent = bookDraft.items.length
        ? "ไม่พบรายการที่ค้นหา"
        : "ยังไม่มีรายการ -- กด “+ เพิ่มรายการ” หรือวางจาก Excel";
      tr.appendChild(td);
      bookItemsEl.appendChild(tr);
      return;
    }

    rows.forEach(item => {
      const tr = document.createElement("tr");
      if (item.isNew) tr.classList.add("price-row-dirty");
      const textCell = (key, cls, placeholder) => {
        const td = document.createElement("td");
        if (cls) td.className = cls;
        const input = document.createElement("input");
        input.type = "text";
        input.value = item[key] || "";
        if (placeholder) input.placeholder = placeholder;
        input.addEventListener("input", () => { item[key] = input.value; setBookDirty(true); });
        td.appendChild(input);
        return td;
      };
      // "ชื่อรายการ" เป็น <textarea> ขยายสูงอัตโนมัติแทน <input> บรรทัดเดียว --
      // ชื่ออุปกรณ์ในงวดมักยาว (ระบุขนาด/มาตรฐาน) เห็นแค่ต้นบรรทัดจะเลือกผิดง่าย
      const nameCell = document.createElement("td");
      const nameInput = document.createElement("textarea");
      nameInput.className = "price-name-input";
      nameInput.rows = 1;
      nameInput.placeholder = "ชื่อรายการ";
      nameInput.value = item.name || "";
      nameInput.addEventListener("input", () => {
        item.name = nameInput.value;
        setBookDirty(true);
        autosizeTextarea(nameInput);
      });
      nameCell.appendChild(nameInput);

      const tdPrice = document.createElement("td");
      tdPrice.className = "price-col-price";
      tdPrice.appendChild(bookNumberInput(item.price, v => { item.price = v; }));

      tr.append(
        textCell("group", "price-col-cat", "หมวด"),
        nameCell,
        textCell("unit", "book-col-unit", "หน่วย"),
        textCell("brand", "book-col-brand", "ยี่ห้อ"),
        tdPrice,
        bookDeleteCell(() => {
          bookDraft.items = bookDraft.items.filter(i => i !== item);
          setBookDirty(true);
          renderBookItems();
        })
      );
      bookItemsEl.appendChild(tr);
      // ต่อเข้า DOM แล้วเท่านั้นถึงจะขยายความสูงได้ถูกต้อง (ดู autosizeTextarea)
      autosizeTextarea(nameInput);
    });
  }

  document.getElementById("bookItemSearch").addEventListener("input", (e) => {
    bookItemQuery = e.target.value;
    renderBookItems();
  });

  document.getElementById("bookAddItemBtn").addEventListener("click", () => {
    bookDraft.items.unshift({
      key: "k" + Date.now() + randomSuffix(),
      group: "", name: "", unit: "", brand: "", price: 0, isNew: true
    });
    bookItemQuery = "";
    document.getElementById("bookItemSearch").value = "";
    setBookDirty(true);
    renderBookItems();
    const first = bookItemsEl.querySelector("input");
    if (first) first.focus();
  });

  document.getElementById("bookAddLabourBtn").addEventListener("click", () => {
    const max = bookDraft.labour.reduce((m, r) => Math.max(m, Number(r.days) || 0), 0);
    bookDraft.labour.push({ days: max + 1, wage: 0, supervision: 0 });
    setBookDirty(true);
    renderBookLabour();
  });

  document.getElementById("bookAddTierBtn").addEventListener("click", () => {
    bookDraft.profitTiers.push({ max: null, pct: 0 });
    setBookDirty(true);
    renderBookTiers();
  });

  ["bookName", "bookFrom", "bookStatus", "bookNote", "bookOverhead"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => setBookDirty(true));
  });

  document.getElementById("bookBackBtn").addEventListener("click", () => {
    if (bookDirtyFlag && !confirm("มีการแก้ไขที่ยังไม่ได้บันทึก ออกจากหน้านี้ใช่หรือไม่?")) return;
    setBookDirty(false);
    priceBookMode.hidden = true;
    setQuotationTab("prices");
  });

  document.getElementById("bookSaveBtn").addEventListener("click", async () => {
    hideError(bookError);
    const name = document.getElementById("bookName").value.trim();
    if (!name) { showError(bookError, "กรุณาตั้งชื่องวด"); return; }

    const btn = document.getElementById("bookSaveBtn");
    bookDraft.effectiveFrom = document.getElementById("bookFrom").value || todayDateString();
    bookDraft.note = document.getElementById("bookNote").value.trim();
    const overhead = quoParseNumber(document.getElementById("bookOverhead").value);
    bookDraft.overheadPct = Number.isNaN(overhead) ? 0 : overhead;
    bookDraft.labour = bookDraft.labour
      .filter(r => Number(r.days) > 0)
      .map(r => ({ days: Number(r.days), wage: quoRound2(r.wage), supervision: quoRound2(r.supervision) }));
    bookDraft.profitTiers = bookDraft.profitTiers
      .map(t => ({ max: Number(t.max) > 0 ? Number(t.max) : null, pct: Number(t.pct) || 0 }));
    bookDraft.items = bookDraft.items
      .filter(i => String(i.name || "").trim())
      .map(i => ({
        key: i.key || ("k" + Date.now() + randomSuffix()),
        group: String(i.group || "").trim(),
        name: String(i.name).trim(),
        unit: String(i.unit || "").trim(),
        brand: String(i.brand || "").trim(),
        price: quoRound2(i.price)
      }));

    setBusy(btn, true, "กำลังบันทึก...");
    try {
      const saved = await backend.saveWorkItem("price_book", {
        id: bookEditing ? bookEditing.id : newWorkItemId(),
        title: name,
        status: document.getElementById("bookStatus").value,
        data: bookDraft
      });
      const index = priceBooks.findIndex(b => String(b.id) === String(saved.id));
      if (index === -1) priceBooks.unshift(saved);
      else priceBooks[index] = saved;
      bookEditing = saved;
      bookDraft = JSON.parse(JSON.stringify(saved.data || {}));
      document.getElementById("bookDeleteBtn").hidden = false;
      document.getElementById("bookTitleText").textContent = "แก้ไขงวดราคา";
      setBookDirty(false);
      renderBookLabour();
      renderBookTiers();
      renderBookItems();
      flashBookSaved("บันทึกงวดราคาแล้ว");
    } catch (err) {
      showError(bookError, moduleErrorText(err));
    } finally {
      setBusy(btn, false);
    }
  });

  document.getElementById("bookDeleteBtn").addEventListener("click", async () => {
    if (!bookEditing) return;
    if (!confirm("ลบงวด “" + bookEditing.title
      + "” ใช่หรือไม่?\n(ใบเสนอราคาที่คิดราคาจากงวดนี้ไปแล้วไม่ได้รับผลกระทบ)")) return;
    const btn = document.getElementById("bookDeleteBtn");
    setBusy(btn, true, "กำลังลบ...");
    try {
      await backend.deleteWorkItem(bookEditing.id);
      priceBooks = priceBooks.filter(b => String(b.id) !== String(bookEditing.id));
      setBookDirty(false);
      priceBookMode.hidden = true;
      setQuotationTab("prices");
    } catch (err) {
      showError(bookError, moduleErrorText(err));
    } finally {
      setBusy(btn, false);
    }
  });

  // ------------------------------------------------------ อัปเดตราคาจาก Excel
  document.getElementById("bookPasteBtn").addEventListener("click", () => {
    pricePasteInput.value = "";
    pricePasteError.hidden = true;
    pricePasteModal.hidden = false;
    pricePasteInput.focus();
  });
  document.getElementById("pricePasteCancelBtn").addEventListener("click", () => {
    pricePasteModal.hidden = true;
  });
  pricePasteModal.addEventListener("click", (e) => {
    if (e.target === pricePasteModal) pricePasteModal.hidden = true;
  });

  /**
   * วางตารางจาก Excel -- จับคู่ด้วยชื่อรายการ ราคาที่ตรงกันอัปเดตทับ ชื่อที่ไม่มีใน
   * งวดถูกเพิ่มเป็นรายการใหม่และทำเครื่องหมายไว้ให้ตรวจ ยังไม่เขียนลงฐานข้อมูลจน
   * กว่าจะกด "บันทึกงวด" -- วางผิดยังกดย้อนกลับทิ้งได้ทั้งชุด
   */
  document.getElementById("pricePasteApplyBtn").addEventListener("click", () => {
    pricePasteError.hidden = true;
    const lines = pricePasteInput.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) {
      pricePasteError.textContent = "ยังไม่ได้วางข้อมูล";
      pricePasteError.hidden = false;
      return;
    }

    const byName = new Map(bookDraft.items.map(i => [String(i.name || "").trim().toLowerCase(), i]));
    let updated = 0;
    let added = 0;
    let skipped = 0;

    lines.forEach(line => {
      const cells = line.split("\t").map(c => c.trim());
      if (cells.length < 2) { skipped += 1; return; }
      // ชื่ออยู่ช่องแรก ราคาอยู่ช่องสุดท้ายที่อ่านเป็นตัวเลขได้
      const priceCell = cells.slice().reverse().find(c => c && !Number.isNaN(quoParseNumber(c)));
      const price = quoParseNumber(priceCell);
      const name = cells[0];
      if (!name || !priceCell || Number.isNaN(price)) { skipped += 1; return; }

      const found = byName.get(name.toLowerCase());
      if (found) {
        found.price = quoRound2(price);
        updated += 1;
      } else {
        const item = {
          key: "k" + Date.now() + randomSuffix(),
          group: cells.length > 2 ? cells[1] : "",
          name: name, unit: "", brand: "", price: quoRound2(price), isNew: true
        };
        bookDraft.items.push(item);
        byName.set(name.toLowerCase(), item);
        added += 1;
      }
    });

    setBookDirty(true);
    renderBookItems();
    pricePasteModal.hidden = true;
    flashBookSaved("อัปเดตราคา " + updated + " รายการ · เพิ่มใหม่ " + added + " รายการ"
      + (skipped ? " · ข้าม " + skipped + " บรรทัด" : "")
      + " -- ตรวจในตารางแล้วกด “บันทึกงวด”");
  });

  // ------------------------------------------- รายการงวดในแท็บ "ราคาและค่าแรง"
  function renderPriceBooksSection() {
    const wrap = document.createElement("div");
    wrap.className = "book-list";

    const head = document.createElement("div");
    head.className = "book-list-head";
    const title = document.createElement("h3");
    title.textContent = "งวดราคาอุปกรณ์และค่าแรง (ใช้กับเครื่องคำนวณ EV Charger)";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-primary";
    addBtn.textContent = "+ สร้างงวดใหม่";
    addBtn.addEventListener("click", () => {
      const current = currentPriceBook();
      if (current && confirm("สร้างงวดใหม่โดยคัดลอกราคาทั้งหมดจาก “" + current.title
        + "” มาแก้ต่อ ใช่หรือไม่?\n(กดยกเลิกเพื่อสร้างงวดเปล่า)")) {
        openPriceBook(current, { copy: true });
      } else {
        openPriceBook(null);
      }
    });
    head.append(title, addBtn);
    wrap.appendChild(head);

    if (!priceBooks.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = "ยังไม่มีงวดราคา -- กด “+ สร้างงวดใหม่”";
      wrap.appendChild(empty);
      return wrap;
    }

    const current = currentPriceBook();
    priceBooks
      .slice()
      .sort((a, b) => String((b.data && b.data.effectiveFrom) || "")
        .localeCompare(String((a.data && a.data.effectiveFrom) || "")))
      .forEach(book => {
        const card = document.createElement("div");
        card.className = "book-card";
        if (current && String(current.id) === String(book.id)) card.classList.add("is-current");

        const info = document.createElement("div");
        info.className = "book-card-info";
        const name = document.createElement("div");
        name.className = "book-card-name";
        name.textContent = book.title;
        if (current && String(current.id) === String(book.id)) {
          const tag = document.createElement("span");
          tag.className = "request-badge tone-success";
          tag.textContent = "งวดปัจจุบัน";
          name.appendChild(tag);
        }
        if (book.status === "ยกเลิก") {
          const tag = document.createElement("span");
          tag.className = "request-badge tone-danger";
          tag.textContent = "ยกเลิก";
          name.appendChild(tag);
        }
        const meta = document.createElement("div");
        meta.className = "book-card-meta";
        const count = book.data && Array.isArray(book.data.items) ? book.data.items.length : 0;
        const from = book.data && book.data.effectiveFrom ? formatThaiDate(book.data.effectiveFrom) : "-";
        const overhead = book.data && book.data.overheadPct !== undefined ? book.data.overheadPct : "-";
        meta.textContent = "เริ่มใช้ " + from + " · " + count + " รายการ · ค่าดำเนินการ " + overhead + "%"
          + (book.data && book.data.note ? " · " + book.data.note : "");
        info.append(name, meta);

        const actions = document.createElement("div");
        actions.className = "book-card-actions";
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn btn-ghost";
        editBtn.textContent = "แก้ไข";
        editBtn.addEventListener("click", () => openPriceBook(book));
        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "btn btn-ghost";
        copyBtn.textContent = "สร้างงวดใหม่จากงวดนี้";
        copyBtn.addEventListener("click", () => openPriceBook(book, { copy: true }));
        actions.append(editBtn, copyBtn);

        card.append(info, actions);
        wrap.appendChild(card);
      });

    return wrap;
  }

  /** ล้างหน้าจอส่วนราคา/เครื่องคำนวณตอนออกจากระบบ */
  function clearPricingScreens() {
    priceBooks = [];
    priceBooksLoaded = false;
    bookEditing = null;
    bookDraft = null;
    evQty = new Map();
    evBookId = null;
    evDays = null;
    evReturnToQuotation = false;
    evItemsEl.innerHTML = "";
    evSummaryEl.innerHTML = "";
    bookItemsEl.innerHTML = "";
    bookLabourEl.innerHTML = "";
    bookTiersEl.innerHTML = "";
    pricePasteInput.value = "";
    pricePasteModal.hidden = true;
    evCalcMode.hidden = true;
    priceBookMode.hidden = true;
    setBookDirty(false);
  }

  // ================================ คำนวณราคางานติดตั้ง/รื้อถอนอุปกรณ์ป้องกัน
  /**
   * ราคาต่อรายการคิดจากสองทาง แล้วใช้ทางที่ "สูงกว่า" เสมอ
   *
   *   (ก) โปรแกรมประมาณการของ กฟภ. -- กรอกค่าวัสดุกับค่าแรง ที่เหลือคิดให้:
   *       ติดตั้ง   ค่าควบคุมงาน = 30% ของค่าแรง
   *                 ค่าขนส่ง     = 5% ของค่าวัสดุ
   *                 ค่าเบ็ดเตล็ด = 5% ของ (วัสดุ + แรง + ควบคุมงาน + ขนส่ง)
   *                 ค่าดำเนินการ = 5% ของ (วัสดุ + แรง + ควบคุมงาน + ขนส่ง + เบ็ดเตล็ด)
   *                 ราคาสุทธิ    = ผลรวมทั้งหกก้อน
   *       รื้อถอน   ไม่มีค่าวัสดุ (ไม่ได้ซื้อของมาติด) และสองก้อนกลับด้านกัน:
   *                 ค่าเบ็ดเตล็ด = 35% ของค่าแรง  แล้ว ค่าขนส่ง = 25% ของค่าเบ็ดเตล็ด
   *                 ค่าดำเนินการ = 5% ของ (แรง + ควบคุมงาน + ขนส่ง + เบ็ดเตล็ด)
   *                 ราคาสุทธิ    = แรง + ควบคุมงาน + ขนส่ง + เบ็ดเตล็ด + ดำเนินการ
   *
   *   (ข) ราคาสืบจากท้องตลาด -- ต้องมีบริษัทที่สืบและวันที่สืบกำกับ ใช้ครั้งล่าสุด
   *
   *   ต้นทุนจริง = max(ก, ข)
   *   + ค่าดำเนินการ 7.5% ของต้นทุนจริง      = ต้นทุนรวม
   *   + กำไรขั้นต้น (ร้อยละของต้นทุนรวม)      = ค่าบริการ (ก่อน VAT 7%)
   *
   * ทุกก้อนปัดเศษขึ้นเป็นจำนวนเต็มบาท (ก่อน VAT 7%) ตามที่เจ้าของระบบกำหนด --
   * ตรงกับกระดาษคำนวณของแผนกทุกช่อง ยกเว้นค่าวัสดุกับค่าแรงที่เป็นค่ากรอกเอง
   * จึงคงทศนิยมตามที่กรอก และยอดรวมซึ่งเป็นผลบวกของค่าเหล่านั้น
   *
   * อัตรากำไรขั้นต้นใช้ "ตารางเดียวกับ EV Charger" (profitTiers ของ price_book)
   * ยกเว้นใบที่มีค่าบริการบำรุงรักษาด้วย ซึ่งคิดแค่ 10% -- ติ๊กเองในหน้าคำนวณ
   */
  const PROTECT_MAINTENANCE_PROFIT_PCT = 10;
  const PROTECT_OUTER_OVERHEAD_PCT = 7.5;

  let protectItems = [];
  let protectItemsLoaded = false;
  let protectQty = new Map();       // id ของรายการ -> จำนวน
  let protectPeriod = "";           // งวดพัสดุที่เลือกใช้คำนวณ
  let protectBookId = null;         // งวดราคา EV ที่ยืมตารางกำไรมาใช้
  let protectSearchQuery = "";
  let protectReturnToQuotation = false;
  let protectCatalogKind = "install";
  // ประเภทงานที่ถูกย่อไว้ในหน้าคำนวณ -- ตั้งต้นย่องานรื้อถอน เปิดงานติดตั้งไว้
  // เพราะงานที่เสนอลูกค้าส่วนใหญ่เป็นงานติดตั้ง
  let protectCollapsedKinds = new Set(["remove"]);
  let protectSurveyEditing = null;  // รายการที่กำลังแก้ประวัติราคาสืบ
  let protectSurveyDraft = [];

  const protectCalcMode = document.getElementById("protectCalcMode");
  const protectCatalogMode = document.getElementById("protectCatalogMode");
  const protectPeriodSelect = document.getElementById("protectPeriod");
  const protectBookSelect = document.getElementById("protectBook");
  const protectItemsEl = document.getElementById("protectItems");
  const protectSummaryEl = document.getElementById("protectSummary");
  const protectSummaryNote = document.getElementById("protectSummaryNote");
  const protectError = document.getElementById("protectError");
  const protectSearch = document.getElementById("protectSearch");
  const protectOnlyPicked = document.getElementById("protectOnlyPicked");
  const protectPickedCount = document.getElementById("protectPickedCount");
  const protectSubtitle = document.getElementById("protectSubtitle");
  const protectHasMaintenance = document.getElementById("protectHasMaintenance");
  const protectCatalogRows = document.getElementById("protectCatalogRows");
  const protectCatalogError = document.getElementById("protectCatalogError");
  const protectCatalogPeriod = document.getElementById("protectCatalogPeriod");
  const protectSurveyModal = document.getElementById("protectSurveyModal");
  const protectSurveyRows = document.getElementById("protectSurveyRows");
  const protectSurveyError = document.getElementById("protectSurveyError");

  const PROTECT_KIND_LABEL = { install: "งานติดตั้งใหม่", remove: "งานรื้อถอน" };

  async function ensureProtectItems(force) {
    if (protectItemsLoaded && !force) return;
    try {
      protectItems = await backend.loadWorkItems("protect_item");
      protectItemsLoaded = true;
    } catch (err) {
      protectItems = [];
      showError(quotationError, moduleErrorText(err));
    }
  }

  function protectData(item) {
    return item && item.data ? item.data : {};
  }

  function protectEstimates(item) {
    const list = protectData(item).estimates;
    return Array.isArray(list) ? list : [];
  }

  function protectSurveys(item) {
    const list = protectData(item).surveys;
    return Array.isArray(list) ? list : [];
  }

  /** ชื่องวดพัสดุทั้งหมดที่มีในรายการ ใหม่สุดขึ้นก่อน (เรียงแบบ "3/2569" ได้ถูก) */
  function protectPeriodList() {
    const seen = new Set();
    protectItems.forEach(item => {
      protectEstimates(item).forEach(e => {
        const period = String(e.period || "").trim();
        if (period) seen.add(period);
      });
    });
    return Array.from(seen).sort((a, b) => comparePeriod(b, a));
  }

  /** เทียบงวดแบบ "งวด/ปี" -- ปีก่อน แล้วค่อยงวด ไม่ใช่เรียงตัวอักษรซึ่ง 10 จะมาก่อน 2 */
  function comparePeriod(a, b) {
    const pa = String(a).split("/").map(v => Number(v.replace(/\D/g, "")) || 0);
    const pb = String(b).split("/").map(v => Number(v.replace(/\D/g, "")) || 0);
    const ya = pa[1] || 0, yb = pb[1] || 0;
    if (ya !== yb) return ya - yb;
    return (pa[0] || 0) - (pb[0] || 0);
  }

  /**
   * ค่าวัสดุ/ค่าแรงของรายการนี้ในงวดที่เลือก -- ถ้างวดนั้นไม่มีค่าของรายการนี้
   * ใช้งวดที่เก่ากว่าและใกล้ที่สุดแทน (ราคาที่ยังไม่ถูกแก้ในงวดใหม่ถือว่าคงเดิม)
   * ไม่ใช้งวดที่ใหม่กว่าเด็ดขาด -- การคิดราคาย้อนงวดต้องไม่ดึงราคาอนาคตมาใช้
   */
  function protectEstimateFor(item, period) {
    const list = protectEstimates(item);
    if (!list.length) return null;
    const exact = list.find(e => String(e.period || "") === String(period));
    if (exact) return exact;
    const older = list
      .filter(e => comparePeriod(e.period, period) <= 0)
      .sort((a, b) => comparePeriod(b.period, a.period));
    return older[0] || null;
  }

  /** ราคาสืบครั้งล่าสุด (วันที่ใหม่สุด) -- ค่าเริ่มต้นที่ระบบใช้เสมอ */
  function protectLatestSurvey(item) {
    const list = protectSurveys(item).filter(sv => Number(sv.price) > 0);
    if (!list.length) return null;
    return list.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
  }

  /** ราคาสุทธิตามโปรแกรมประมาณการ กฟภ. -- คืนทุกก้อนไว้โชว์ในตารางด้วย */
  function protectEstimateBreakdown(workKind, materialCost, labourCost) {
    const material = workKind === "remove" ? 0 : quoRound2(materialCost);
    const labour = quoRound2(labourCost);
    const supervision = ceilBaht(labour * 0.30);

    let misc, transport;
    if (workKind === "remove") {
      // รื้อถอน: ค่าเบ็ดเตล็ดมาจากค่าแรง แล้วค่าขนส่งมาจากค่าเบ็ดเตล็ดอีกที
      misc = ceilBaht(labour * 0.35);
      transport = ceilBaht(misc * 0.25);
    } else {
      transport = ceilBaht(material * 0.05);
      misc = ceilBaht((material + labour + supervision + transport) * 0.05);
    }

    const base = material + labour + supervision + transport + misc;
    const operation = ceilBaht(base * 0.05);
    const net = quoRound2(base + operation);
    return { material, labour, supervision, transport, misc, operation, net };
  }

  /** คิดราคาหนึ่งรายการจนจบ -- ราคาต่อหน่วย ยังไม่คูณจำนวน */
  function computeProtectRow(item, period, book, hasMaintenance) {
    const d = protectData(item);
    const workKind = d.workKind === "remove" ? "remove" : "install";
    const est = protectEstimateFor(item, period);
    const breakdown = protectEstimateBreakdown(
      workKind,
      est ? est.materialCost : 0,
      est ? est.labourCost : 0
    );
    const survey = protectLatestSurvey(item);
    const surveyPrice = survey ? quoRound2(survey.price) : 0;

    // ใช้ราคาที่สูงกว่าเสมอ -- ถ้ายังไม่มีราคาสืบก็ใช้ราคาประมาณการไปก่อน
    const usedSurvey = surveyPrice > breakdown.net;
    const realCost = usedSurvey ? surveyPrice : breakdown.net;
    // ทุกก้อนที่คิดเป็นร้อยละ ปัดเศษขึ้นเป็นจำนวนเต็มบาทเหมือนสี่ก้อนในใบประมาณการ
    // ส่วนยอดรวมเป็นแค่ผลบวก จึงคงทศนิยมไว้ (ราคาสืบหรือค่าแรงอาจมีสตางค์)
    const overhead = ceilBaht(realCost * PROTECT_OUTER_OVERHEAD_PCT / 100);
    const totalCost = quoRound2(realCost + overhead);
    const profitPct = hasMaintenance
      ? PROTECT_MAINTENANCE_PROFIT_PCT
      : profitPctFor(book, totalCost);
    const profit = ceilBaht(totalCost * profitPct / 100);
    const service = ceilBaht(totalCost + profit);

    return {
      id: item.id,
      code: d.code || "",
      name: item.title || "",
      workKind,
      period: est ? est.period : "",
      ...breakdown,
      surveyPrice,
      surveyCompany: survey ? survey.company || "" : "",
      surveyDate: survey ? survey.date || "" : "",
      usedSurvey,
      realCost,
      overheadPct: PROTECT_OUTER_OVERHEAD_PCT,
      overhead,
      totalCost,
      profitPct,
      profit,
      service
    };
  }

  /** รวมทั้งใบ -- ค่าบริการต่อหน่วยปัดขึ้นเต็มบาทแล้วค่อยคูณจำนวน */
  function computeProtectTotal() {
    const book = priceBookById(protectBookId);
    const hasMaintenance = protectHasMaintenance.checked;
    const lines = [];
    protectItems.forEach(item => {
      const qty = Number(protectQty.get(String(item.id))) || 0;
      if (qty <= 0) return;
      const row = computeProtectRow(item, protectPeriod, book, hasMaintenance);
      row.qty = qty;
      row.amount = quoRound2(row.service * qty);
      lines.push(row);
    });
    const total = quoRound2(lines.reduce((sum, l) => sum + l.amount, 0));
    return {
      period: protectPeriod,
      bookId: book ? book.id : null,
      bookTitle: book ? book.title : "",
      hasMaintenance,
      lines,
      total
    };
  }

  // ------------------------------------------------------------ เครื่องคำนวณ
  async function openProtectCalc(options) {
    const opts = options || {};
    hideError(protectError);
    protectReturnToQuotation = Boolean(opts.fromQuotation);
    quotationListMode.hidden = true;
    quotationFormMode.hidden = true;
    evCalcMode.hidden = true;
    priceBookMode.hidden = true;
    protectCatalogMode.hidden = true;
    protectCalcMode.hidden = false;
    window.scrollTo(0, 0);

    protectItemsEl.innerHTML = '<div class="request-empty">กำลังโหลดรายการ...</div>';
    await ensureProtectItems();
    await ensurePriceBooks();

    const prev = opts.fromQuotation ? quoProtectCalc : null;
    protectQty = new Map();
    if (prev && Array.isArray(prev.lines)) {
      prev.lines.forEach(l => protectQty.set(String(l.id), Number(l.qty) || 0));
    }
    const periods = protectPeriodList();
    protectPeriod = (prev && prev.period) || periods[0] || "";
    const book = (prev && priceBookById(prev.bookId)) || currentPriceBook();
    protectBookId = book ? book.id : null;
    protectHasMaintenance.checked = Boolean(prev && prev.hasMaintenance);
    protectSearch.value = "";
    protectSearchQuery = "";
    protectOnlyPicked.checked = false;
    protectCollapsedKinds = new Set(["remove"]);

    renderProtectPeriodOptions();
    renderProtectBookOptions();
    renderProtectItems();
    protectSubtitle.textContent = protectReturnToQuotation
      ? "คิดราคาแล้วกด “ใส่ราคาในใบเสนอราคา” เพื่อกลับไปที่ใบเดิม"
      : "คิดราคาแล้วกด “ใส่ราคาในใบเสนอราคา” เพื่อสร้างใบใหม่จากราคานี้";
  }

  function renderProtectPeriodOptions() {
    const periods = protectPeriodList();
    protectPeriodSelect.innerHTML = "";
    if (!periods.length) {
      const option = document.createElement("option");
      option.textContent = "ยังไม่มีงวดพัสดุ -- กด “จัดการรายการ/ราคา”";
      protectPeriodSelect.appendChild(option);
      protectPeriodSelect.disabled = true;
      return;
    }
    protectPeriodSelect.disabled = false;
    periods.forEach((period, index) => {
      const option = document.createElement("option");
      option.value = period;
      option.textContent = "งวด " + period + (index === 0 ? " — งวดล่าสุด" : "");
      protectPeriodSelect.appendChild(option);
    });
    if (!periods.includes(protectPeriod)) protectPeriod = periods[0];
    protectPeriodSelect.value = protectPeriod;
  }

  function renderProtectBookOptions() {
    protectBookSelect.innerHTML = "";
    const usable = priceBooks.filter(b => b.status !== "ยกเลิก" || String(b.id) === String(protectBookId));
    if (!usable.length) {
      const option = document.createElement("option");
      option.textContent = "ยังไม่มีงวดราคา -- ใช้กำไร 0%";
      protectBookSelect.appendChild(option);
      protectBookSelect.disabled = true;
      protectBookId = null;
      return;
    }
    protectBookSelect.disabled = false;
    const current = currentPriceBook();
    usable
      .slice()
      .sort((a, b) => String((b.data && b.data.effectiveFrom) || "")
        .localeCompare(String((a.data && a.data.effectiveFrom) || "")))
      .forEach(book => {
        const option = document.createElement("option");
        option.value = String(book.id);
        const tag = current && String(current.id) === String(book.id) ? " — งวดปัจจุบัน" : "";
        option.textContent = book.title + tag;
        protectBookSelect.appendChild(option);
      });
    if (protectBookId && priceBookById(protectBookId)) protectBookSelect.value = String(protectBookId);
    else protectBookId = protectBookSelect.value;
  }

  function renderProtectItems() {
    const query = protectSearchQuery.trim().toLowerCase();
    const book = priceBookById(protectBookId);
    const hasMaintenance = protectHasMaintenance.checked;
    protectItemsEl.innerHTML = "";

    const shown = protectItems.filter(item => {
      if (protectOnlyPicked.checked && !(Number(protectQty.get(String(item.id))) > 0)) return false;
      if (!query) return true;
      return [item.title, protectData(item).code, protectData(item).group]
        .some(v => String(v || "").toLowerCase().includes(query));
    });

    if (!shown.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = protectItems.length
        ? "ไม่พบรายการที่ค้นหา"
        : "ยังไม่มีรายการอุปกรณ์ป้องกัน -- กด “จัดการรายการ/ราคา” เพื่อเพิ่ม";
      protectItemsEl.appendChild(empty);
      renderProtectSummary();
      return;
    }

    // แยกหัวข้อตามประเภทงาน (ติดตั้ง/รื้อถอน) ก่อน แล้วค่อยเรียงตามรหัสพัสดุ
    ["install", "remove"].forEach(kind => {
      const rows = shown.filter(item => (protectData(item).workKind === "remove" ? "remove" : "install") === kind);
      if (!rows.length) return;

      const collapsed = protectCollapsedKinds.has(kind);
      const pickedCount = rows.filter(item =>
        Number(protectQty.get(String(item.id))) > 0).length;

      const head = document.createElement("button");
      head.type = "button";
      head.className = "ev-group";
      head.classList.toggle("is-collapsed", collapsed);
      head.setAttribute("aria-expanded", String(!collapsed));

      const arrow = document.createElement("span");
      arrow.className = "ev-group-arrow";
      arrow.textContent = "\u25be";
      arrow.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "ev-group-label";
      label.textContent = PROTECT_KIND_LABEL[kind];

      const count = document.createElement("span");
      count.className = "ev-group-count";
      count.textContent = pickedCount > 0
        ? rows.length + " รายการ · เลือกแล้ว " + pickedCount
        : rows.length + " รายการ";

      head.append(arrow, label, count);
      head.addEventListener("click", () => {
        if (protectCollapsedKinds.has(kind)) protectCollapsedKinds.delete(kind);
        else protectCollapsedKinds.add(kind);
        renderProtectItems();
      });
      protectItemsEl.appendChild(head);

      if (collapsed) return;

      rows.forEach(item => {
        const calc = computeProtectRow(item, protectPeriod, book, hasMaintenance);
        const row = document.createElement("div");
        row.className = "ev-item protect-item";

        const name = document.createElement("div");
        name.className = "ev-item-name";
        name.textContent = calc.name;
        const meta = document.createElement("span");
        meta.className = "ev-item-brand";
        const bits = [];
        if (calc.code) bits.push(calc.code);
        bits.push("EST. " + formatMoney(calc.net));
        if (calc.surveyPrice > 0) {
          bits.push("สืบ " + formatMoney(calc.surveyPrice)
            + (calc.surveyDate ? " (" + formatThaiDate(calc.surveyDate) + ")" : ""));
        }
        meta.textContent = bits.join(" · ");
        name.appendChild(meta);

        const price = document.createElement("div");
        price.className = "ev-item-price";
        price.textContent = formatMoney(calc.service);
        const which = document.createElement("span");
        which.className = "protect-src";
        which.textContent = calc.usedSurvey ? "ใช้ราคาสืบ" : "ใช้ราคาประมาณการ";
        price.appendChild(which);

        const qtyWrap = document.createElement("div");
        qtyWrap.className = "ev-item-qty";
        const minus = document.createElement("button");
        minus.type = "button";
        minus.className = "ev-step";
        minus.textContent = "−";
        minus.setAttribute("aria-label", "ลดจำนวน " + calc.name);
        const qty = document.createElement("input");
        qty.type = "text";
        qty.inputMode = "decimal";
        qty.className = "ev-qty-input";
        const current = Number(protectQty.get(String(item.id))) || 0;
        qty.value = current > 0 ? String(current) : "";
        qty.placeholder = "0";
        qty.setAttribute("aria-label", "จำนวน " + calc.name);
        const plus = document.createElement("button");
        plus.type = "button";
        plus.className = "ev-step";
        plus.textContent = "+";
        plus.setAttribute("aria-label", "เพิ่มจำนวน " + calc.name);

        const amount = document.createElement("div");
        amount.className = "ev-item-amount";

        const paint = () => {
          const value = Number(protectQty.get(String(item.id))) || 0;
          amount.textContent = value > 0 ? formatMoney(quoRound2(calc.service * value)) : "";
          row.classList.toggle("is-picked", value > 0);
        };
        const setQty = (value) => {
          const next = Math.max(0, quoRound2(value));
          if (next > 0) protectQty.set(String(item.id), next);
          else protectQty.delete(String(item.id));
          paint();
          renderProtectSummary();
        };

        qty.addEventListener("input", () => {
          const value = quoParseNumber(qty.value);
          setQty(Number.isNaN(value) ? 0 : value);
        });
        minus.addEventListener("click", () => {
          const value = Math.max(0, (Number(protectQty.get(String(item.id))) || 0) - 1);
          qty.value = value > 0 ? String(value) : "";
          setQty(value);
        });
        plus.addEventListener("click", () => {
          const value = (Number(protectQty.get(String(item.id))) || 0) + 1;
          qty.value = String(value);
          setQty(value);
        });

        qtyWrap.append(minus, qty, plus);
        row.append(name, price, qtyWrap, amount);
        protectItemsEl.appendChild(row);
        paint();
      });
    });

    renderProtectSummary();
  }

  function renderProtectSummary() {
    const calc = computeProtectTotal();
    protectPickedCount.textContent = calc.lines.length
      ? "เลือกแล้ว " + calc.lines.length + " รายการ"
      : "ยังไม่ได้เลือกรายการ";

    protectSummaryEl.innerHTML = "";
    if (!calc.lines.length) {
      const dt = document.createElement("dt");
      dt.textContent = "รวมทั้งสิ้น";
      dt.classList.add("is-grand");
      const dd = document.createElement("dd");
      dd.textContent = formatMoney(0);
      dd.classList.add("is-grand");
      protectSummaryEl.append(dt, dd);
    } else {
      calc.lines.forEach(line => {
        const dt = document.createElement("dt");
        dt.textContent = line.name;
        const hint = document.createElement("span");
        hint.className = "ev-summary-hint";
        hint.textContent = formatMoney(line.service) + " x " + line.qty
          + (line.usedSurvey ? " · ราคาสืบ" : " · ประมาณการ")
          + " · กำไร " + line.profitPct + "%";
        dt.appendChild(hint);
        const dd = document.createElement("dd");
        dd.textContent = formatMoney(line.amount);
        protectSummaryEl.append(dt, dd);
      });
      const dt = document.createElement("dt");
      dt.textContent = "รวมทั้งสิ้น (ก่อน VAT)";
      dt.classList.add("is-grand");
      const dd = document.createElement("dd");
      dd.textContent = formatMoney(calc.total);
      dd.classList.add("is-grand");
      protectSummaryEl.append(dt, dd);
    }

    const parts = [];
    if (calc.period) parts.push("งวดพัสดุ " + calc.period);
    if (calc.bookTitle) parts.push("อัตรากำไรจาก “" + calc.bookTitle + "”");
    if (calc.hasMaintenance) parts.push("คิดกำไรขั้นต้น 10% เพราะใบนี้มีค่าบริการบำรุงรักษา");
    parts.push("ทุกก้อนปัดเศษขึ้นเป็นจำนวนเต็มบาท (ก่อน VAT 7%)");
    protectSummaryNote.textContent = parts.join(" · ");
    return calc;
  }

  protectPeriodSelect.addEventListener("change", () => {
    protectPeriod = protectPeriodSelect.value;
    renderProtectItems();
  });
  protectBookSelect.addEventListener("change", () => {
    protectBookId = protectBookSelect.value;
    renderProtectItems();
  });
  protectHasMaintenance.addEventListener("change", renderProtectItems);
  protectSearch.addEventListener("input", () => {
    protectSearchQuery = protectSearch.value;
    renderProtectItems();
  });
  protectOnlyPicked.addEventListener("change", renderProtectItems);

  document.getElementById("protectResetBtn").addEventListener("click", () => {
    if (!protectQty.size) return;
    if (!confirm("ล้างจำนวนที่เลือกไว้ทั้งหมดใช่หรือไม่?")) return;
    protectQty = new Map();
    renderProtectItems();
  });

  document.getElementById("protectBackBtn").addEventListener("click", () => {
    protectCalcMode.hidden = true;
    if (protectReturnToQuotation) {
      protectReturnToQuotation = false;
      quotationFormMode.hidden = false;
    } else {
      setQuotationTab("docs");
    }
  });

  document.getElementById("quotationProtectBtn").addEventListener("click", () => {
    openProtectCalc({ fromQuotation: true });
  });

  /**
   * ใส่ราคาเข้าใบเสนอราคา -- แยกเป็นบรรทัดต่อรายการ (ต่างจาก EV ที่รวมเป็นก้อนเดียว)
   * เพราะลูกค้าสั่งงานอุปกรณ์ป้องกันเป็นรายชิ้น และราคาต่อหน่วยที่โชว์คือ "ค่าบริการ"
   * ที่รวมกำไรแล้ว ไม่ใช่ต้นทุน จึงเปิดเผยได้ตามปกติ
   */
  document.getElementById("protectApplyBtn").addEventListener("click", () => {
    hideError(protectError);
    const calc = computeProtectTotal();
    if (!calc.lines.length) {
      showError(protectError, "ยังไม่ได้เลือกรายการ -- ใส่จำนวนอย่างน้อยหนึ่งรายการก่อน");
      return;
    }
    calc.calculatedAt = Date.now();

    protectCalcMode.hidden = true;
    if (protectReturnToQuotation) {
      protectReturnToQuotation = false;
      quotationFormMode.hidden = false;
    } else {
      quotationTab = "docs";
      quoTabBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.quoTab === "docs"));
      openQuotationForm(null);
    }

    quoLineModel = quoLineModel.filter(line => !line.fromProtect);
    calc.lines.forEach(line => {
      quoLineModel.push({
        description: line.name,
        unitPrice: line.service,
        qty: line.qty,
        fromProtect: true
      });
    });
    quoProtectCalc = calc;
    quoVatEnabled.checked = true;
    renderQuoLines();
    setQuoDirty(true);
    scheduleQuoLayout(0);
    flashQuoSaved("ใส่ " + calc.lines.length + " รายการ รวม "
      + formatMoney(calc.total) + " บาท (ก่อน VAT) แล้ว");
  });

  // ------------------------------------------------ จัดการรายการ/ราคา
  async function openProtectCatalog() {
    hideError(protectCatalogError);
    quotationListMode.hidden = true;
    quotationFormMode.hidden = true;
    evCalcMode.hidden = true;
    priceBookMode.hidden = true;
    protectCalcMode.hidden = true;
    protectCatalogMode.hidden = false;
    window.scrollTo(0, 0);
    await ensureProtectItems();
    renderProtectCatalogPeriods();
    renderProtectCatalog();
  }

  function renderProtectCatalogPeriods() {
    const periods = protectPeriodList();
    protectCatalogPeriod.innerHTML = "";
    if (!periods.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "ยังไม่มีงวดพัสดุ";
      protectCatalogPeriod.appendChild(option);
      protectPeriod = "";
      return;
    }
    periods.forEach((period, index) => {
      const option = document.createElement("option");
      option.value = period;
      option.textContent = "งวด " + period + (index === 0 ? " — ล่าสุด" : "");
      protectCatalogPeriod.appendChild(option);
    });
    if (!periods.includes(protectPeriod)) protectPeriod = periods[0];
    protectCatalogPeriod.value = protectPeriod;
  }

  function renderProtectCatalog() {
    protectCatalogRows.innerHTML = "";
    const rows = protectItems.filter(item =>
      (protectData(item).workKind === "remove" ? "remove" : "install") === protectCatalogKind);

    document.getElementById("protectCatalogSubtitle").textContent =
      PROTECT_KIND_LABEL[protectCatalogKind] + " · " + rows.length + " รายการ"
      + (protectPeriod ? " · งวด " + protectPeriod : "");

    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.className = "request-empty";
      td.textContent = "ยังไม่มีรายการ -- กด “+ เพิ่มรายการ”";
      tr.appendChild(td);
      protectCatalogRows.appendChild(tr);
      return;
    }

    rows.forEach(item => protectCatalogRows.appendChild(buildProtectRow(item)));
    // ต่อเข้า DOM แล้วเท่านั้นถึงจะขยายความสูงได้ถูกต้อง (ดู autosizeTextarea)
    protectCatalogRows.querySelectorAll("textarea.price-name-input").forEach(autosizeTextarea);
  }

  function buildProtectRow(item) {
    const tr = document.createElement("tr");
    const d = protectData(item);
    const workKind = d.workKind === "remove" ? "remove" : "install";
    if (item.isNew) tr.classList.add("price-row-dirty");

    const markDirty = () => {
      tr.classList.add("price-row-dirty");
      saveBtn.disabled = false;
      refreshNet();
    };

    const textInput = (value, placeholder) => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = value || "";
      if (placeholder) input.placeholder = placeholder;
      input.addEventListener("input", markDirty);
      return input;
    };

    const code = textInput(d.code || "", "รหัสพัสดุ");
    const name = document.createElement("textarea");
    name.className = "price-name-input";
    name.rows = 1;
    name.placeholder = "ชื่อรายการ";
    name.value = item.title || "";
    name.addEventListener("input", () => { markDirty(); autosizeTextarea(name); });

    const est = protectEstimateFor(item, protectPeriod);
    const numInput = (value) => {
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.value = Number(value) > 0 ? formatMoney(value) : "";
      input.placeholder = "0.00";
      input.addEventListener("input", markDirty);
      input.addEventListener("blur", () => {
        if (!input.value.trim()) return;
        const parsed = quoParseNumber(input.value);
        if (!Number.isNaN(parsed)) input.value = formatMoney(parsed);
      });
      return input;
    };
    const material = numInput(est ? est.materialCost : 0);
    const labour = numInput(est ? est.labourCost : 0);
    // งานรื้อถอนไม่มีค่าวัสดุในสูตร -- ปิดช่องไว้ไม่ให้กรอกแล้วเข้าใจผิดว่าถูกคิด
    if (workKind === "remove") {
      material.disabled = true;
      material.value = "";
      material.placeholder = "ไม่ใช้";
    }

    const netCell = document.createElement("td");
    netCell.className = "price-col-price protect-net";
    const refreshNet = () => {
      const breakdown = protectEstimateBreakdown(
        workKind, quoParseNumber(material.value) || 0, quoParseNumber(labour.value) || 0);
      netCell.textContent = formatMoney(breakdown.net);
    };
    refreshNet();

    const surveyCell = document.createElement("td");
    surveyCell.className = "protect-col-survey";
    const surveyBtn = document.createElement("button");
    surveyBtn.type = "button";
    surveyBtn.className = "btn btn-ghost protect-survey-btn";
    const latest = protectLatestSurvey(item);
    surveyBtn.textContent = latest
      ? formatMoney(latest.price) + (latest.date ? " · " + formatThaiDate(latest.date) : "")
      : "+ เพิ่มราคาสืบ";
    surveyBtn.addEventListener("click", () => openProtectSurvey(item));
    surveyCell.appendChild(surveyBtn);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-primary";
    saveBtn.textContent = "บันทึก";
    saveBtn.disabled = !item.isNew;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-ghost";
    delBtn.textContent = item.isNew ? "ยกเลิก" : "ลบ";

    saveBtn.addEventListener("click", async () => {
      hideError(protectCatalogError);
      const title = name.value.trim();
      if (!title) { showError(protectCatalogError, "กรุณากรอกชื่อรายการ"); name.focus(); return; }
      if (!protectPeriod) {
        showError(protectCatalogError, "ยังไม่มีงวดพัสดุ -- กด “+ งวดพัสดุใหม่” ก่อน");
        return;
      }
      const materialCost = quoParseNumber(material.value) || 0;
      const labourCost = quoParseNumber(labour.value) || 0;
      if (Number.isNaN(materialCost) || Number.isNaN(labourCost)) {
        showError(protectCatalogError, "ค่าวัสดุและค่าแรงต้องเป็นตัวเลข");
        return;
      }

      // เขียนทับค่าของงวดที่เลือกเท่านั้น งวดอื่นคงเดิม -- ราคาย้อนหลังต้องไม่ถูกแก้
      const estimates = protectEstimates(item).filter(e => String(e.period) !== String(protectPeriod));
      estimates.push({
        period: protectPeriod,
        materialCost: quoRound2(workKind === "remove" ? 0 : materialCost),
        labourCost: quoRound2(labourCost)
      });
      estimates.sort((a, b) => comparePeriod(a.period, b.period));

      setBusy(saveBtn, true, "กำลังบันทึก...");
      try {
        const saved = await backend.saveWorkItem("protect_item", {
          id: item.id,
          title,
          status: "",
          data: {
            code: code.value.trim(),
            workKind,
            group: d.group || "",
            estimates,
            surveys: protectSurveys(item)
          }
        });
        const index = protectItems.indexOf(item);
        if (index === -1) protectItems.push(saved);
        else protectItems[index] = saved;
        renderProtectCatalogPeriods();
        renderProtectCatalog();
      } catch (err) {
        showError(protectCatalogError, moduleErrorText(err));
        setBusy(saveBtn, false);
      }
    });

    delBtn.addEventListener("click", async () => {
      if (item.isNew) {
        protectItems = protectItems.filter(p => p !== item);
        renderProtectCatalog();
        return;
      }
      if (!confirm("ลบรายการ “" + item.title + "” ใช่หรือไม่?\n(ใบเสนอราคาที่คิดราคาไปแล้วไม่ได้รับผลกระทบ)")) return;
      setBusy(delBtn, true, "กำลังลบ...");
      try {
        await backend.deleteWorkItem(item.id);
        protectItems = protectItems.filter(p => p !== item);
        protectQty.delete(String(item.id));
        renderProtectCatalog();
      } catch (err) {
        showError(protectCatalogError, moduleErrorText(err));
        setBusy(delBtn, false);
      }
    });

    const cells = [
      ["protect-col-code", code],
      ["", name],
      ["price-col-price", material],
      ["price-col-price", labour]
    ];
    cells.forEach(([cls, el]) => {
      const td = document.createElement("td");
      if (cls) td.className = cls;
      td.appendChild(el);
      tr.appendChild(td);
    });
    tr.appendChild(netCell);
    tr.appendChild(surveyCell);
    const actions = document.createElement("td");
    actions.className = "price-col-actions";
    actions.append(saveBtn, " ", delBtn);
    tr.appendChild(actions);
    return tr;
  }

  document.querySelectorAll("[data-protect-kind]").forEach(btn => {
    btn.addEventListener("click", () => {
      protectCatalogKind = btn.dataset.protectKind;
      document.querySelectorAll("[data-protect-kind]").forEach(b =>
        b.classList.toggle("active", b === btn));
      renderProtectCatalog();
    });
  });

  protectCatalogPeriod.addEventListener("change", () => {
    protectPeriod = protectCatalogPeriod.value;
    renderProtectCatalog();
  });

  document.getElementById("protectManageBtn").addEventListener("click", openProtectCatalog);
  document.getElementById("protectCatalogBackBtn").addEventListener("click", () => {
    protectCatalogMode.hidden = true;
    openProtectCalc({ fromQuotation: protectReturnToQuotation });
  });

  document.getElementById("protectAddItemBtn").addEventListener("click", () => {
    protectItems.unshift({
      id: newWorkItemId(),
      title: "",
      data: { code: "", workKind: protectCatalogKind, group: "", estimates: [], surveys: [] },
      isNew: true,
      sortOrder: -1
    });
    renderProtectCatalog();
    const first = protectCatalogRows.querySelector("input");
    if (first) first.focus();
  });

  /**
   * งวดพัสดุใหม่ -- ไม่คัดลอกราคาไปล่วงหน้า เพราะ protectEstimateFor() ใช้ค่าจาก
   * งวดเก่าที่ใกล้ที่สุดอยู่แล้วเมื่องวดใหม่ยังไม่มีค่าของรายการนั้น จึงแก้เฉพาะ
   * รายการที่ราคาขยับจริง ไม่ต้องไล่บันทึกทุกแถว
   */
  document.getElementById("protectAddPeriodBtn").addEventListener("click", () => {
    const suggestion = nextProtectPeriod();
    const period = prompt("ชื่องวดพัสดุใหม่ (เช่น 4/2569)", suggestion);
    if (period === null) return;
    const name = period.trim();
    if (!name) return;
    if (protectPeriodList().includes(name)) {
      protectPeriod = name;
      renderProtectCatalogPeriods();
      renderProtectCatalog();
      return;
    }
    // งวดยังไม่มีรายการไหนใช้ -- ใส่ไว้ในตัวเลือกชั่วคราวจนกว่าจะบันทึกแถวแรก
    const option = document.createElement("option");
    option.value = name;
    option.textContent = "งวด " + name + " (ยังไม่มีราคา)";
    protectCatalogPeriod.prepend(option);
    protectPeriod = name;
    protectCatalogPeriod.value = name;
    renderProtectCatalog();
  });

  function nextProtectPeriod() {
    const periods = protectPeriodList();
    if (!periods.length) {
      const year = new Date().getFullYear() + 543;
      return "1/" + year;
    }
    const parts = String(periods[0]).split("/");
    const no = Number(String(parts[0]).replace(/\D/g, "")) || 0;
    return (no + 1) + "/" + (parts[1] || "");
  }

  // ------------------------------------------------------------ ราคาสืบ
  function openProtectSurvey(item) {
    protectSurveyEditing = item;
    protectSurveyDraft = protectSurveys(item).map(sv => ({
      company: sv.company || "",
      date: sv.date || "",
      price: Number(sv.price) || 0
    }));
    if (!protectSurveyDraft.length) protectSurveyDraft.push({ company: "", date: todayDateString(), price: 0 });
    document.getElementById("protectSurveyTitle").textContent = "ราคาสืบ: " + (item.title || "รายการใหม่");
    hideError(protectSurveyError);
    renderProtectSurveyRows();
    protectSurveyModal.hidden = false;
  }

  function renderProtectSurveyRows() {
    protectSurveyRows.innerHTML = "";
    const latest = protectSurveyDraft
      .filter(sv => Number(sv.price) > 0)
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];

    protectSurveyDraft.forEach((sv, index) => {
      const tr = document.createElement("tr");
      if (sv === latest) tr.classList.add("protect-survey-latest");

      const company = document.createElement("input");
      company.type = "text";
      company.value = sv.company || "";
      company.placeholder = "ชื่อบริษัทที่สืบราคา";
      company.addEventListener("input", () => { sv.company = company.value; });

      const date = document.createElement("input");
      date.type = "date";
      date.value = sv.date || "";
      date.addEventListener("change", () => { sv.date = date.value; renderProtectSurveyRows(); });

      const price = document.createElement("input");
      price.type = "text";
      price.inputMode = "decimal";
      price.value = Number(sv.price) > 0 ? formatMoney(sv.price) : "";
      price.placeholder = "0.00";
      price.addEventListener("input", () => {
        const parsed = quoParseNumber(price.value);
        sv.price = Number.isNaN(parsed) ? 0 : parsed;
      });
      price.addEventListener("blur", () => {
        if (!price.value.trim()) return;
        const parsed = quoParseNumber(price.value);
        if (!Number.isNaN(parsed)) price.value = formatMoney(parsed);
        renderProtectSurveyRows();
      });

      [company, date, price].forEach((el, i) => {
        const td = document.createElement("td");
        if (i === 1) td.className = "protect-col-date";
        if (i === 2) td.className = "price-col-price";
        td.appendChild(el);
        tr.appendChild(td);
      });

      const actions = document.createElement("td");
      actions.className = "price-col-actions";
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-ghost";
      del.textContent = "ลบ";
      del.addEventListener("click", () => {
        protectSurveyDraft.splice(index, 1);
        renderProtectSurveyRows();
      });
      actions.appendChild(del);
      tr.appendChild(actions);
      protectSurveyRows.appendChild(tr);
    });
  }

  document.getElementById("protectSurveyAddBtn").addEventListener("click", () => {
    protectSurveyDraft.push({ company: "", date: todayDateString(), price: 0 });
    renderProtectSurveyRows();
  });
  document.getElementById("protectSurveyCancelBtn").addEventListener("click", () => {
    protectSurveyModal.hidden = true;
    protectSurveyEditing = null;
  });
  protectSurveyModal.addEventListener("click", (e) => {
    if (e.target === protectSurveyModal) {
      protectSurveyModal.hidden = true;
      protectSurveyEditing = null;
    }
  });

  document.getElementById("protectSurveySaveBtn").addEventListener("click", async () => {
    if (!protectSurveyEditing) return;
    hideError(protectSurveyError);
    const rows = protectSurveyDraft.filter(sv => Number(sv.price) > 0 || String(sv.company || "").trim());
    // บริษัทและวันที่เป็นหลักฐานอ้างอิงของราคาสืบ ไม่มีสองอย่างนี้ราคาก็ใช้ยืนยันไม่ได้
    const bad = rows.find(sv => !String(sv.company || "").trim() || !sv.date || !(Number(sv.price) > 0));
    if (bad) {
      showError(protectSurveyError, "ทุกแถวต้องมีชื่อบริษัท วันที่สืบ และราคามากกว่า 0");
      return;
    }

    const item = protectSurveyEditing;
    const btn = document.getElementById("protectSurveySaveBtn");
    setBusy(btn, true, "กำลังบันทึก...");
    try {
      const d = protectData(item);
      const saved = await backend.saveWorkItem("protect_item", {
        id: item.id,
        title: item.title || "",
        status: "",
        data: {
          code: d.code || "",
          workKind: d.workKind === "remove" ? "remove" : "install",
          group: d.group || "",
          estimates: protectEstimates(item),
          surveys: rows.map(sv => ({
            company: String(sv.company).trim(),
            date: sv.date,
            price: quoRound2(sv.price)
          }))
        }
      });
      const index = protectItems.indexOf(item);
      if (index === -1) protectItems.push(saved);
      else protectItems[index] = saved;
      protectSurveyModal.hidden = true;
      protectSurveyEditing = null;
      renderProtectCatalog();
    } catch (err) {
      showError(protectSurveyError, moduleErrorText(err));
    } finally {
      setBusy(btn, false);
    }
  });

  /** ล้างหน้าจออุปกรณ์ป้องกันตอนออกจากระบบ */
  function clearProtectScreens() {
    protectItems = [];
    protectItemsLoaded = false;
    protectQty = new Map();
    protectPeriod = "";
    protectBookId = null;
    protectSurveyEditing = null;
    protectSurveyDraft = [];
    protectItemsEl.innerHTML = "";
    protectSummaryEl.innerHTML = "";
    protectCatalogRows.innerHTML = "";
    protectSurveyRows.innerHTML = "";
    protectSurveyModal.hidden = true;
    protectCalcMode.hidden = true;
    protectCatalogMode.hidden = true;
  }

  // -------------------------------------------- ระบบรับฟังเสียงของลูกค้า (VOC)
  const vocListMode = document.getElementById("vocListMode");
  const vocFormMode = document.getElementById("vocFormMode");
  const vocList = document.getElementById("vocList");
  const vocCount = document.getElementById("vocCount");
  const vocError = document.getElementById("vocError");
  const vocSearch = document.getElementById("vocSearch");
  const vocChips = document.getElementById("vocChips");
  const vocForm = document.getElementById("vocForm");
  const vocFormError = document.getElementById("vocFormError");
  const vocFormTitle = document.getElementById("vocFormTitle");
  const vocFormSubtitle = document.getElementById("vocFormSubtitle");
  const vocDeleteBtn = document.getElementById("vocDeleteBtn");

  const VOC_STATUS_TONE = {
    "รับเรื่อง": "warning",
    "กำลังดำเนินการ": "warning",
    "ส่งต่อหน่วยงานอื่น": "info",
    "แก้ไขแล้ว": "success",
    "แจ้งผลลูกค้าแล้ว": "success",
    "ยุติเรื่อง": "info"
  };

  let vocCases = [];
  let vocEditing = null;
  let vocQuery = "";
  let vocFilter = "all";

  async function openVocView() {
    showView("voc");
    vocListMode.hidden = false;
    vocFormMode.hidden = true;
    hideError(vocError);
    vocList.innerHTML = '<div class="request-empty">กำลังโหลด...</div>';
    try {
      vocCases = await backend.loadWorkItems("voc");
    } catch (err) {
      vocCases = [];
      showError(vocError, moduleErrorText(err));
    }
    renderVocList();
  }

  function renderVocChips() {
    const statuses = Array.from(document.getElementById("vocStatus").options).map(o => o.value);
    const chips = [{ key: "all", label: "ทั้งหมด", count: vocCases.length }]
      .concat(statuses.map(status => ({
        key: status,
        label: status,
        count: vocCases.filter(c => c.status === status).length
      })));

    vocChips.innerHTML = "";
    chips.forEach(chip => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "status-chip";
      if (chip.key === vocFilter) btn.classList.add("active");
      if (!chip.count) btn.classList.add("is-empty");
      const label = document.createElement("span");
      label.textContent = chip.label;
      const count = document.createElement("span");
      count.className = "status-chip-count";
      count.textContent = String(chip.count);
      btn.append(label, count);
      btn.addEventListener("click", () => {
        vocFilter = chip.key;
        renderVocList();
      });
      vocChips.appendChild(btn);
    });
  }

  function renderVocList() {
    renderVocChips();
    const query = vocQuery.trim().toLowerCase();
    const filtered = vocCases.filter(item => {
      if (vocFilter !== "all" && item.status !== vocFilter) return false;
      if (!query) return true;
      const d = item.data || {};
      return [item.title, d.name, d.phone, d.ca, d.detail, d.category, d.location, d.owner]
        .some(v => String(v || "").toLowerCase().includes(query));
    });

    vocCount.textContent = `ทั้งหมด ${filtered.length} เรื่อง`;
    vocList.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "request-empty";
      empty.textContent = query || vocFilter !== "all" ? "ไม่พบเรื่องที่ค้นหา" : "ยังไม่มีเรื่องจากลูกค้า";
      vocList.appendChild(empty);
      return;
    }

    filtered.forEach(item => {
      const d = item.data || {};
      const card = document.createElement("div");
      card.className = "request-card request-card-clickable";

      const top = document.createElement("div");
      top.className = "request-card-top";

      const badges = document.createElement("div");
      badges.className = "request-badges";

      if (d.type) {
        const typeEl = document.createElement("span");
        typeEl.className = "request-badge tone-info";
        typeEl.textContent = d.type;
        badges.appendChild(typeEl);
      }
      if (d.category) {
        const catEl = document.createElement("span");
        catEl.className = "request-badge request-badge-purpose";
        catEl.textContent = d.category;
        badges.appendChild(catEl);
      }
      const statusEl = document.createElement("span");
      statusEl.className = `request-badge request-badge-status tone-${VOC_STATUS_TONE[item.status] || "info"}`;
      statusEl.textContent = item.status || "รับเรื่อง";
      badges.appendChild(statusEl);

      const dateEl = document.createElement("span");
      dateEl.className = "request-date";
      dateEl.textContent = d.date ? formatThaiDate(d.date) : "";
      top.append(badges, dateEl);

      const title = document.createElement("div");
      title.className = "request-name";
      title.textContent = item.title || "(ไม่ระบุเรื่อง)";

      card.append(top, title);

      if (d.name) {
        const who = document.createElement("div");
        who.className = "request-meta";
        who.textContent = `ผู้แจ้ง: ${d.name}${d.channel ? ` · ${d.channel}` : ""}`;
        card.appendChild(who);
      }
      if (d.owner) {
        const owner = document.createElement("div");
        owner.className = "request-meta";
        owner.textContent = `ผู้รับผิดชอบ: ${d.owner}`;
        card.appendChild(owner);
      }
      // เกินกำหนดแล้วแต่ยังไม่ปิดเรื่อง -- นี่คือสิ่งที่หน้าจอนี้มีไว้เพื่อตอบ
      if (d.dueDate && !d.closedDate && d.dueDate < todayDateString()) {
        const overdue = document.createElement("div");
        overdue.className = "request-meta request-meta-queue";
        overdue.textContent = `เกินกำหนดแล้ว (กำหนด ${formatThaiDate(d.dueDate)})`;
        card.appendChild(overdue);
      }

      card.addEventListener("click", () => openVocForm(item));
      vocList.appendChild(card);
    });
  }

  function openVocForm(item) {
    vocEditing = item || null;
    vocListMode.hidden = true;
    vocFormMode.hidden = false;
    hideError(vocFormError);
    window.scrollTo(0, 0);

    const d = item ? (item.data || {}) : {};
    vocFormTitle.textContent = item ? "รายละเอียดเรื่อง" : "รับเรื่องใหม่";
    vocFormSubtitle.textContent = item
      ? `รับเรื่องโดย: ${item.createdByName || "-"}`
      : "กรอกข้อมูลแล้วกดบันทึก";

    document.getElementById("vocDate").value = d.date || todayDateString();
    document.getElementById("vocChannel").value = d.channel || "เคาน์เตอร์บริการ";
    document.getElementById("vocType").value = d.type || "ข้อร้องเรียน";
    document.getElementById("vocCategory").value = d.category || "กระแสไฟฟ้าขัดข้อง";
    document.getElementById("vocName").value = d.name || "";
    document.getElementById("vocPhone").value = d.phone || "";
    document.getElementById("vocCa").value = d.ca || "";
    document.getElementById("vocLocation").value = d.location || "";
    document.getElementById("vocSubject").value = item ? (item.title || "") : "";
    document.getElementById("vocDetail").value = d.detail || "";
    document.getElementById("vocStatus").value = item ? (item.status || "รับเรื่อง") : "รับเรื่อง";
    document.getElementById("vocOwner").value = d.owner || "";
    document.getElementById("vocDueDate").value = d.dueDate || "";
    document.getElementById("vocClosedDate").value = d.closedDate || "";
    document.getElementById("vocAction").value = d.action || "";

    vocDeleteBtn.hidden = !item;
  }

  document.getElementById("vocAddBtn").addEventListener("click", () => openVocForm(null));
  document.getElementById("vocBackToListBtn").addEventListener("click", () => {
    vocFormMode.hidden = true;
    vocListMode.hidden = false;
    renderVocList();
  });

  vocSearch.addEventListener("input", () => {
    vocQuery = vocSearch.value;
    renderVocList();
  });

  vocForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(vocFormError);

    const subject = document.getElementById("vocSubject").value.trim();
    const name = document.getElementById("vocName").value.trim();
    if (!subject) { showError(vocFormError, "กรุณากรอกเรื่อง"); return; }
    if (!name) { showError(vocFormError, "กรุณากรอกชื่อผู้แจ้ง"); return; }

    // เบอร์โทรเป็นทางเดียวที่จะแจ้งผลกลับ -- ตรวจรูปแบบเดียวกับทุกฟอร์มในระบบ
    // แต่ไม่บังคับกรอก เพราะเรื่องที่มาทางหนังสือร้องเรียนอาจไม่มีเบอร์ติดมา
    const phoneRaw = document.getElementById("vocPhone").value.trim();
    let phone = "";
    if (phoneRaw) {
      const parsed = readPhoneField(phoneRaw, "เบอร์โทรศัพท์", false);
      if (parsed.error) { showError(vocFormError, parsed.error); return; }
      phone = parsed.value;
    }

    const btn = vocForm.querySelector('button[type="submit"]');
    setBusy(btn, true, "กำลังบันทึก...");
    try {
      await backend.saveWorkItem("voc", {
        id: vocEditing ? vocEditing.id : newWorkItemId(),
        title: subject,
        status: document.getElementById("vocStatus").value,
        data: {
          date: document.getElementById("vocDate").value,
          channel: document.getElementById("vocChannel").value,
          type: document.getElementById("vocType").value,
          category: document.getElementById("vocCategory").value,
          name,
          phone,
          ca: document.getElementById("vocCa").value.trim(),
          location: document.getElementById("vocLocation").value.trim(),
          detail: document.getElementById("vocDetail").value.trim(),
          owner: document.getElementById("vocOwner").value.trim(),
          dueDate: document.getElementById("vocDueDate").value,
          closedDate: document.getElementById("vocClosedDate").value,
          action: document.getElementById("vocAction").value.trim()
        }
      });
      await openVocView();
    } catch (err) {
      showError(vocFormError, moduleErrorText(err));
    } finally {
      setBusy(btn, false);
    }
  });

  vocDeleteBtn.addEventListener("click", async () => {
    if (!vocEditing) return;
    if (!confirm("ลบเรื่องนี้ใช่หรือไม่?")) return;
    setBusy(vocDeleteBtn, true, "กำลังลบ...");
    try {
      await backend.deleteWorkItem(vocEditing.id);
      await openVocView();
    } catch (err) {
      showError(vocFormError, moduleErrorText(err));
    } finally {
      setBusy(vocDeleteBtn, false);
    }
  });

  /**
   * เมนูซ้ายของงานธุรกิจเสริม -- สำเนาเดียวกันอยู่ทั้งหน้าโบรชัวร์และหน้าเสนอราคา
   * เมนูจึงไม่หายไปตอนสลับหน้า เหมือนงานประเภทอื่น ปุ่มที่กำลังเปิดอยู่ใส่ active
   * ไว้ใน markup ของหน้านั้นแล้ว ที่นี่จึงมีแต่การสลับหน้า
   */
  document.querySelectorAll("[data-side-nav]").forEach(item => {
    const key = item.dataset.sideNav;
    if (key === "sheet") {
      // URL อยู่ที่ SERVICES ที่เดียว ไม่ฝังซ้ำใน index.html ให้ต้องแก้สองที่
      const link = (SERVICES.sideBusiness.links || [])[0];
      if (link) item.href = link.url;
      else item.hidden = true;
      return;
    }
    item.addEventListener("click", () => {
      saveNavState({ card: "sideBusiness", module: key });
      if (key === "brochure") openBrochureView();
      if (key === "quotation") openQuotationView();
    });
  });

  // ทั้งสองหน้าเป็นทางเข้าแรกของงานธุรกิจเสริมแล้ว ปุ่มย้อนกลับจึงกลับหน้าแรก
  // เหมือนหน้างานอื่น (เดิมกลับไปที่การ์ดกลาง ซึ่งตอนนี้ไม่มีแล้ว -- ถ้าไม่แก้
  // ปุ่มย้อนกลับของหน้าโบรชัวร์จะวนกลับมาที่ตัวเอง)
  document.getElementById("brochureBackBtn").addEventListener("click", enterApp);
  document.getElementById("quotationBackBtn").addEventListener("click", () => {
    // ถอยทีละขั้น: จากกระดาษกลับรายการก่อน แล้วค่อยออกไปหน้าแรก
    if (!quotationFormMode.hidden) {
      if (!quoConfirmLeave()) return;
      setQuoDirty(false);
      showQuotationList();
      return;
    }
    enterApp();
  });
  document.getElementById("vocBackBtn").addEventListener("click", () => enterApp());

  /**
   * ล้างข้อมูลของทั้งสามโมดูลออกจากหน้าจอตอนออกจากระบบ
   *
   * เหตุผลเดียวกับ clearWorkspaceScreens(): การออกจากระบบในแอปนี้ไม่ได้โหลดหน้าใหม่
   * แค่สลับ hidden ของ <section> ชื่อลูกค้า เบอร์โทร และเนื้อหาเรื่องร้องเรียน
   * ที่วาดไว้แล้วจึงยังอยู่ใน DOM ให้คนถัดไปที่เครื่องเดียวกันเปิด devtools อ่านได้
   */
  function clearModuleScreens() {
    // หน้างาน (ขอใช้ไฟฟ้า/ขยายเขตฯ) ต้องไม่ค้างเป็นโหมดหน้างานให้คนถัดไป
    leaveWorkMode();
    brochures = [];
    vocCases = [];
    brochureEditing = null;
    vocEditing = null;
    brochureEditPaths = [];
    vocQuery = "";
    vocFilter = "all";
    brochureList.innerHTML = "";
    vocList.innerHTML = "";
    vocChips.innerHTML = "";
    vocSearch.value = "";
    vocForm.reset();
    clearQuotationScreens();
    closeBrochureEditor();
    closeBrochureViewer();
  }

  init();
})();
