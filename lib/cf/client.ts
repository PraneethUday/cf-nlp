export async function cf(method: string, params: Record<string, string | number | boolean> = {}) {
  const url = new URL('/api/cf', typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  url.searchParams.set('method', method);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`CF error: ${res.status}`);
  const json = await res.json();
  if (json.status !== 'OK') throw new Error(json.comment || 'CF API failed');
  return json.result;
}

