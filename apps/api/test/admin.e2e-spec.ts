import request from 'supertest';
import { buildApp, tearDown, TestCtx } from './helpers/setup';

describe('Admin', () => {
  let ctx: TestCtx;
  let adminToken: string;
  let regId: string;
  beforeAll(async () => {
    ctx = await buildApp();
    const created = await request(ctx.app.getHttpServer())
      .post('/registrations')
      .field('name_th', 'Linus Torvalds')
      .field('email', 'linus@example.com')
      .field('phone', '+66800000004')
      .field('password', 'longenoughpw')
      .field('organization', 'Linux Foundation');
    // Lookup to fetch id
    const lookup = await request(ctx.app.getHttpServer())
      .post('/auth/lookup')
      .send({ reference_code: created.body.reference_code, password: 'longenoughpw' });
    const userToken = lookup.body.token;
    const me = await request(ctx.app.getHttpServer()).get('/registrations/me').set('Authorization', `Bearer ${userToken}`);
    regId = me.body.id;

    const admin = await request(ctx.app.getHttpServer())
      .post('/auth/admin')
      .send({ username: 'admin', password: 'pw-admin' });
    adminToken = admin.body.token;
  });
  afterAll(async () => { await tearDown(ctx); });

  it('lists registrations without password_hash', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/admin/registrations')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const r of res.body) expect(r).not.toHaveProperty('password_hash');
  });

  it('gets a single registration with documents', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/admin/registrations/${regId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(regId);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('downloads a PDF name tag', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/admin/registrations/${regId}/nametag.pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    const body: Buffer = res.body as any;
    expect(body.slice(0, 4).toString('ascii')).toBe('%PDF');
  });
});
