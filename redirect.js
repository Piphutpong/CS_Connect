// ส่งต่อ URL เดิมบน GitHub Pages ไปยัง hosting ใหม่ -- QR ที่พิมพ์แจกไปแล้วชี้มาที่นี่
// คงชื่อหน้า + query (?tn=) + hash ไว้ครบ ใช้ replace เพื่อไม่ให้ปุ่มย้อนกลับวนกลับมาหน้านี้
// หน้าแอปเจ้าหน้าที่ (index) ติด ?moved=github ไปด้วย ให้แอปขึ้นป้ายบอกให้เปลี่ยน bookmark
// หน้าลูกค้า (track/qr) ไม่ติด -- ลูกค้าไม่ต้องรู้เรื่องย้ายที่อยู่
(function () {
  "use strict";
  var TARGET = "https://cs-connect.pages.dev"; // ไม่มี / ท้าย
  var page = location.pathname.replace(/^\/CS_Connect/, "") || "/";
  var search = location.search;
  if (page === "/" || page === "/index.html") {
    search += (search ? "&" : "?") + "moved=github";
  }
  location.replace(TARGET + page + search + location.hash);
})();
