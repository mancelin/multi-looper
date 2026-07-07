/** m:ss.mmm */
export function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

/** m:ss */
export function fmtS(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Accepts `m:ss.mmm`, `ss.mmm`, or plain seconds. Returns null when unparseable. */
export function parseTime(str: string | null | undefined): number | null {
  if (str == null) return null;
  const v = String(str).trim();
  if (!v) return null;
  let sec: number;
  if (v.includes(":")) {
    const [mPart, sPart] = v.split(":");
    const m = parseFloat(mPart);
    const s = parseFloat(sPart);
    if (!isFinite(m) || !isFinite(s)) return null;
    sec = m * 60 + s;
  } else {
    sec = parseFloat(v);
  }
  return isFinite(sec) ? sec : null;
}
