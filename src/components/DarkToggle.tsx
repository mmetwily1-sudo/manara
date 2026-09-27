"use client";

import { useEffect, useState } from "react";

/** مفتاح الوضع الداكن — يُحفظ محلياً ويُطبق على html */
export default function DarkToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const on = localStorage.getItem("manara.theme") === "dark";
      setDark(on);
      document.documentElement.classList.toggle("dark", on);
    } catch {}
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem("manara.theme", next ? "dark" : "light"); } catch {}
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <button onClick={toggle} title="الوضع الداكن" className="btn-secondary !px-3 !py-2 text-small">
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
