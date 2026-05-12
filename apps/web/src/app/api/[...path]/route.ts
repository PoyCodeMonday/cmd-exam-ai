import { getExpressApp } from 'api';
import serverlessExpress from '@vendia/serverless-express';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

// Cache handler between warm invocations
let handler: ReturnType<typeof serverlessExpress> | null = null;

async function getHandler() {
  if (handler) return handler;
  const app = await getExpressApp();
  handler = serverlessExpress({ app });
  return handler;
}

async function toNodeReq(req: Request): Promise<{ method: string; url: string; headers: Record<string, string>; body: Buffer | null }> {
  const url = new URL(req.url);
  // Strip /api prefix — Nest routes are mounted at the root.
  const trimmed = url.pathname.replace(/^\/api/, '') + url.search;
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });
  let body: Buffer | null = null;
  if (!['GET', 'HEAD'].includes(req.method)) {
    body = Buffer.from(await req.arrayBuffer());
    headers['content-length'] = String(body.length);
  }
  return { method: req.method, url: trimmed || '/', headers, body };
}

async function forward(req: Request): Promise<Response> {
  const h = await getHandler();
  const { method, url, headers, body } = await toNodeReq(req);

  // Build a fake API Gateway v2 event for serverless-express.
  const event = {
    version: '2.0',
    routeKey: '$default',
    rawPath: url.split('?')[0],
    rawQueryString: url.includes('?') ? url.split('?')[1] : '',
    cookies: [],
    headers,
    requestContext: {
      accountId: 'anonymous',
      apiId: 'local',
      domainName: headers['host'] || 'localhost',
      domainPrefix: 'local',
      http: {
        method,
        path: url.split('?')[0],
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: headers['user-agent'] || '',
      },
      requestId: Math.random().toString(36).slice(2),
      routeKey: '$default',
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    body: body ? body.toString('base64') : undefined,
    isBase64Encoded: !!body,
  };
  const result: any = await (h as any)(event, {});
  const respHeaders = new Headers();
  for (const [k, v] of Object.entries(result.headers || {})) {
    if (typeof v === 'string') respHeaders.set(k, v);
  }
  const respBody = result.isBase64Encoded
    ? Buffer.from(result.body || '', 'base64')
    : result.body;
  return new Response(respBody, {
    status: result.statusCode || 200,
    headers: respHeaders,
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
export const OPTIONS = forward;
