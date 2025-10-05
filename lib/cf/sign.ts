import crypto from 'crypto';

export type CfParams = Record<string, string | number | boolean | undefined>;

export function signCfRequest(methodName: string, params: CfParams): { url: string } {
  const apiKey = process.env.CF_KEY;
  const apiSecret = process.env.CF_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error('Missing CF_KEY/CF_SECRET');
  }

  const baseParams: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ),
    apiKey,
    time: String(Math.floor(Date.now() / 1000)),
  };

  const sorted = Object.entries(baseParams).sort(([ak, av], [bk, bv]) => {
    if (ak === bk) return av.localeCompare(bv);
    return ak.localeCompare(bk);
  });
  const query = sorted.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

  const rand = crypto.randomBytes(3).toString('hex'); // 6 chars
  const sigBase = `${rand}/${methodName}?${sorted.map(([k, v]) => `${k}=${v}`).join('&')}#${apiSecret}`;
  const hash = crypto.createHash('sha512').update(sigBase).digest('hex');
  const apiSig = `${rand}${hash}`;

  const url = `https://codeforces.com/api/${methodName}?${query}&apiSig=${apiSig}`;
  return { url };
}

