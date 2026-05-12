import request from 'supertest';
import { buildApp, tearDown, TestCtx } from './helpers/setup';
import { REFERENCE_CODE_REGEX } from '../src/registrations/ref-code.util';

describe('Registrations', () => {
  let ctx: TestCtx;
  beforeAll(async () => { ctx = await buildApp(); });
  afterAll(async () => { await tearDown(ctx); });

  function submit(fields: Record<string, string>, files: Array<[string, Buffer, string]> = []) {
    const r = request(ctx.app.getHttpServer()).post('/registrations');
    for (const [k, v] of Object.entries(fields)) r.field(k, v);
    for (const [name, buf, filename] of files) r.attach('documents', buf, filename);
    return r;
  }

  it('creates a registration with files and returns a reference code', async () => {
    const res = await submit(
      {
        name_th: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '+66800000001',
        password: 'super-secret-1',
        organization: 'Analytical Engines Co.',
        dietary: 'vegetarian',
        tshirt_size: 'M',
      },
      [
        ['documents', Buffer.from('%PDF-1.4 fake pdf 1'), 'a.pdf'],
        ['documents', Buffer.from('%PDF-1.4 fake pdf 2'), 'b.pdf'],
      ],
    );
    expect(res.status).toBe(201);
    expect(res.body.reference_code).toMatch(REFERENCE_CODE_REGEX);
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('rejects missing required fields', async () => {
    const res = await submit({ name_th: '', email: 'x', phone: '', password: '' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid email', async () => {
    const res = await submit({ name_th: 'A', email: 'not-an-email', phone: '+12345', password: 'longenoughpw' });
    expect(res.status).toBe(400);
  });

  it('rejects short password', async () => {
    const res = await submit({ name_th: 'A', email: 'a@b.co', phone: '+12345', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects disallowed file mime types', async () => {
    const res = await submit(
      { name_th: 'A', email: 'a@b.co', phone: '+12345', password: 'longenoughpw' },
      [['documents', Buffer.from('MZ\x90'), 'a.exe']],
    );
    expect(res.status).toBe(400);
  });

  it('retries on reference code collision', async () => {
    // Force the next insertRegistration to use a duplicate code, then a free one.
    const first = await submit({
      name_th: 'Seed', email: 's@e.co', phone: '+12345', password: 'longenoughpw',
    });
    expect(first.status).toBe(201);
    const dupCode = first.body.reference_code;
    ctx.forceCodes = [dupCode]; // collision, retry should pick a fresh random
    const second = await submit({
      name_th: 'Second', email: 's2@e.co', phone: '+12345', password: 'longenoughpw',
    });
    expect(second.status).toBe(201);
    expect(second.body.reference_code).not.toBe(dupCode);
  });

  it('user can download their own document, but not another users', async () => {
    // owner A
    const a = await submit(
      { name_th: 'A', email: 'a@own.co', phone: '+12345', password: 'longenoughpw' },
      [['documents', Buffer.from('%PDF-A'), 'a.pdf']],
    );
    const tokA = (await request(ctx.app.getHttpServer())
      .post('/auth/lookup')
      .send({ reference_code: a.body.reference_code, password: 'longenoughpw' })).body.token;
    const meA = await request(ctx.app.getHttpServer())
      .get('/registrations/me').set('Authorization', `Bearer ${tokA}`);
    const docA = meA.body.documents[0];
    expect(docA.download_path).toMatch(/^\/registrations\/me\/documents\/.+\/download$/);

    // owner B
    const b = await submit(
      { name_th: 'B', email: 'b@own.co', phone: '+12345', password: 'longenoughpw' },
      [['documents', Buffer.from('%PDF-B'), 'b.pdf']],
    );
    const tokB = (await request(ctx.app.getHttpServer())
      .post('/auth/lookup')
      .send({ reference_code: b.body.reference_code, password: 'longenoughpw' })).body.token;

    // A downloads own doc -> 200 with bytes
    const ownDl = await request(ctx.app.getHttpServer())
      .get(docA.download_path).set('Authorization', `Bearer ${tokA}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(ownDl.status).toBe(200);
    expect((ownDl.body as Buffer).toString('utf-8')).toBe('%PDF-A');

    // B tries to download A's doc -> 404 (not 403 — we don't leak existence)
    const cross = await request(ctx.app.getHttpServer())
      .get(docA.download_path).set('Authorization', `Bearer ${tokB}`);
    expect(cross.status).toBe(404);
  });

  it('lookup + me + patch + add doc + delete doc flow', async () => {
    const created = await submit(
      { name_th: 'Grace', email: 'grace@example.com', phone: '+66800000002', password: 'longenoughpw' },
      [['documents', Buffer.from('%PDF-orig'), 'orig.pdf']],
    );
    expect(created.status).toBe(201);
    const code = created.body.reference_code;

    const lookup = await request(ctx.app.getHttpServer())
      .post('/auth/lookup')
      .send({ reference_code: code, password: 'longenoughpw' });
    expect(lookup.status).toBe(200);
    const token = lookup.body.token;

    const me = await request(ctx.app.getHttpServer()).get('/registrations/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.name).toBe('Grace');
    expect(me.body.documents).toHaveLength(1);

    const patch = await request(ctx.app.getHttpServer())
      .patch('/registrations/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name_th: 'Grace Hopper', phone: '+66800000099' });
    expect(patch.status).toBe(200);
    expect(patch.body.name).toBe('Grace Hopper');
    expect(patch.body.phone).toBe('+66800000099');

    const add = await request(ctx.app.getHttpServer())
      .post('/registrations/me/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('documents', Buffer.from('%PDF-new'), 'new.pdf');
    expect(add.status).toBe(201);
    expect(add.body.documents).toHaveLength(2);

    const origId = me.body.documents[0].id;
    const del = await request(ctx.app.getHttpServer())
      .delete(`/registrations/me/documents/${origId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(del.body.documents).toHaveLength(1);
    expect(del.body.documents[0].filename).toBe('new.pdf');
  });
});
