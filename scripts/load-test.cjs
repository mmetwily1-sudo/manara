// اختبار حمل P0: دفعات متزامنة على المسارات الساخنة (قراءة) — p50/p95/أخطاء
const B = "http://localhost:3000";
const ROUTES = ["/api/health", "/login", "/join", "/parent", "/progress", "/api/push/public-key"];
async function burst(n, perRoute) {
  const lat = [];
  let err = 0;
  const jobs = [];
  for (let i = 0; i < n; i++) {
    const r = ROUTES[i % ROUTES.length];
    jobs.push((async () => {
      const t0 = Date.now();
      try {
        const res = await fetch(B + r);
        await res.text();
        if (res.status >= 500) err++;
        lat.push(Date.now() - t0);
      } catch { err++; }
    })());
  }
  await Promise.all(jobs);
  lat.sort((a, b) => a - b);
  const q = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * p))] : 0);
  console.log(`N=${n} p50=${q(0.5)}ms p95=${q(0.95)}ms max=${q(1)}ms err=${err}`);
  void perRoute;
}
(async () => {
  for (const n of [20, 50, 100, 200]) {
    // eslint-disable-next-line no-await-in-loop
    await burst(n);
    await new Promise((r) => setTimeout(r, 2000));
  }
})().catch((e) => console.log("FATAL:" + e.message));
