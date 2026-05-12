import request from 'supertest';
import { buildApp, tearDown, TestCtx } from './helpers/setup';

describe('Auth', () => {
  let ctx: TestCtx;
  let refCode: string;
  beforeAll(async () => {
    ctx = await buildApp();
    const res = await request(ctx.app.getHttpServer())
      .post('/registrations')
      .field('name_th', 'Alan')
      .field('email', 'alan@example.com')
      .field('phone', '+66800000003')
      .field('password', 'longenoughpw');
    refCode = res.body.reference_code;
  });
  afterAll(async () => { await tearDown(ctx); });

  it('lookup with correct code+password returns token', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/lookup')
      .send({ reference_code: refCode, password: 'longenoughpw' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('lookup with wrong password returns 401', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/lookup')
      .send({ reference_code: refCode, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('lookup with unknown code returns 401 (no enumeration)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/lookup')
      .send({ reference_code: 'REG-000000', password: 'longenoughpw' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid reference code or password/i);
  });

  it('admin login with env credentials returns token', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/admin')
      .send({ username: 'admin', password: 'pw-admin' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('admin login with wrong password returns 401', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/admin')
      .send({ username: 'admin', password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('user token cannot hit admin endpoint (403)', async () => {
    const lookup = await request(ctx.app.getHttpServer())
      .post('/auth/lookup')
      .send({ reference_code: refCode, password: 'longenoughpw' });
    const userToken = lookup.body.token;
    const res = await request(ctx.app.getHttpServer())
      .get('/admin/registrations')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('no token returns 401 on admin endpoint', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/admin/registrations');
    expect(res.status).toBe(401);
  });
});
