import { NextRequest } from 'next/server';
import { signCfRequest } from '@/lib/cf/sign';

let lastCallTs = 0;

export async function GET(req: NextRequest) {
  const method = req.nextUrl.searchParams.get('method');
  if (!method) {
    return new Response(JSON.stringify({ error: 'Missing method' }), { status: 400 });
  }

  const now = Date.now();
  const elapsed = now - lastCallTs;
  const minIntervalMs = 2000;
  if (elapsed < minIntervalMs) {
    await new Promise((r) => setTimeout(r, minIntervalMs - elapsed));
  }

  const params: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    if (k !== 'method') params[k] = v;
  });

  try {
    const { url } = signCfRequest(method, params);
    const cfRes = await fetch(url, { next: { revalidate: 10 } });
    lastCallTs = Date.now();
    return new Response(cfRes.body, { status: cfRes.status, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

