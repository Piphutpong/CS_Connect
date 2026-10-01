// ส่งต่อ URL เดิมบน GitHub Pages ไปยัง hosting ใหม่ -- QR ที่พิมพ์แจกไปแล้วชี้มาที่นี่
// คงชื่อหน้า + query (?tn=) + hash ไว้ครบ ใช้ replace เพื่อไม่ให้ปุ่มย้อนกลับวนกลับมาหน้านี้
(function () {
  "use strict";
  var TARGET = "https://cs-connect.pages.dev"; // เช่น https://cs-connect.pages.dev (ไม่มี / ท้าย)
  var page = location.pathname.replace(/^\/CS_Connect/, "") || "/";
  location.replace(TARGET + page + location.search + location.hash);
})();
