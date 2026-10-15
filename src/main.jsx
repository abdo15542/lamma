import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const rootEl = document.getElementById("root");

function diag(msg, ok) {
  const d = document.createElement("div");
  d.style.cssText = "padding:14px;margin:12px;border-radius:12px;font-size:14px;line-height:1.9;direction:rtl;text-align:right;font-family:monospace;white-space:pre-wrap;" + (ok ? "background:#ecfdf5;color:#065f46;border:1px solid #6ee7b7" : "background:#fef2f2;color:#991b1b;border:1px solid #fca5a5");
  d.textContent = msg;
  rootEl.appendChild(d);
}

diag("\u2714 الـ JavaScript حُمِّل ونُفِّذ داخل التطبيق", true);

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  diag("\u274c مفاتيح Supabase غير محقونة!\nURL = " + (url || "undefined") + "\nKEY = " + (key ? "موجود" : "undefined"), false);
} else {
  diag("\u2714 المفاتيح محقونة: URL يبدأ بـ " + String(url).slice(0, 30), true);
}

import("./App.jsx").then((mod) => {
  diag("\u2714 تم تحميل App.jsx، جاري عرض الواجهة...", true);
  ReactDOM.createRoot(rootEl).render(<mod.default />);
}).catch((e) => {
  diag("\u274c خطأ عند تشغيل التطبيق:\n" + (e && e.message ? e.message : String(e)), false);
});
