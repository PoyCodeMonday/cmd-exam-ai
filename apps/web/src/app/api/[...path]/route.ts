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
  handler = serverlessExpress({
    app,
    // Treat these as binary so the handler base64-encodes the response body
    // instead of stringifying it (which corrupts non-ASCII bytes in PDFs etc.).
    binarySettings: {
      contentTypes: [
        'application/pdf',
        'application/octet-stream',
        'image/*',
        'application/zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
      ],
    },
  });
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
  // Belt-and-braces: if the response is base64-encoded OR the content-type
  // looks binary, decode/encode through a Buffer so we don't accidentally
  // utf-8-mangle binary bytes anywhere downstream.
  const ct = (respHeaders.get('content-type') || '').toLowerCase();
  const looksBinary = /^(application\/(pdf|octet-stream|zip|msword|vnd\.openxmlformats)|image\/)/.test(ct);
  let respBody: BodyInit;
  if (result.isBase64Encoded) {
    respBody = Buffer.from(result.body || '', 'base64');
  } else if (looksBinary && typeof result.body === 'string') {
    // serverless-express handed us binary bytes as a "latin1" string. Convert
    // back to a Buffer using latin1 so byte values are preserved.
    respBody = Buffer.from(result.body, 'latin1');
  } else {
    respBody = result.body;
  }
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
