import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {once} from 'node:events';
import argon2 from 'argon2';
import {loadEnv} from '../src/config/env.js';
import {createDatabase} from '../src/db/pool.js';
import {createApp} from '../src/app.js';
import {runRetentionJob} from '../src/jobs/retention-job.js';
const config=loadEnv(),admin=createDatabase(config),name='users_test_'+randomBytes(8).toString('hex');
let db,server,created=false;
try {
  await admin.pool.query(`CREATE DATABASE "${name}"`);created=true;
  const url=config.DATABASE_URL?new URL(config.DATABASE_URL):null;if(url)url.pathname='/'+name;
  db=createDatabase({...config,POSTGRES_DB:name,DATABASE_URL:url?.toString()});
  const dir=new URL('../db/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(v=>v.endsWith('.sql')).sort())await db.pool.query(await readFile(new URL(file,dir),'utf8'));
  const password=randomBytes(24).toString('hex'),hash=await argon2.hash(password);
  const users=[],cookies=[];
  for(let i=0;i<2;i++) {
    const tenant=(await db.pool.query('INSERT INTO tenants(slug,name,retention_days) VALUES($1,$1,$2) RETURNING id',['t'+i,i?30:7])).rows[0];
    const user=(await db.pool.query(`INSERT INTO users(tenant_id,email,password_hash,display_name,role) VALUES($1,$2,$3,'Admin','admin') RETURNING *`,[tenant.id,`admin${i}@test.invalid`,hash])).rows[0];users.push(user);
    const token=randomBytes(32).toString('hex');cookies.push('session='+token);
    await db.pool.query("INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 hour')",[user.id,createHash('sha256').update(token).digest('hex')]);
  }
  server=createApp({config,pool:db.pool,checkDatabase:db.check}).listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=(path,method='GET',body,cookie=cookies[0],origin=config.FRONTEND_ORIGIN)=>fetch(base+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal((await request('/users','GET',undefined,'')).status,401);
  assert.equal((await request('/users','POST',{},cookies[0],'https://evil.invalid')).status,403);
  assert.equal((await request('/users/'+users[0].id,'PATCH',{role:'viewer'})).status,409);
  assert.equal((await request('/users/'+users[1].id,'PATCH',{is_active:false})).status,404);
  const input={email:'viewer@test.invalid',display_name:'Viewer',password,role:'viewer'};
  const response=await request('/users','POST',input);assert.equal(response.status,201);
  const viewer=(await response.json()).data;assert.equal(viewer.password_hash,undefined);
  assert.equal((await request('/users','POST',input)).status,409);
  assert.equal((await request('/users','POST',{...input,email:'x@test.invalid',tenant_id:users[1].tenant_id})).status,400);
  const login=await request('/auth/login','POST',{email:input.email,password},'');assert.equal(login.status,200);
  const vc=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/users','GET',undefined,vc)).status,403);
  const wrong=await request('/auth/change-password','POST',{current_password:'wrong',new_password:password+'x'},vc);assert.equal(wrong.status,401);
  assert.equal((await request('/auth/change-password','POST',{current_password:password,new_password:password+'x'},vc)).status,204);
  assert.equal((await request('/auth/me','GET',undefined,vc)).status,401);
  const login2=await request('/auth/login','POST',{email:input.email,password:password+'x'},'');assert.equal(login2.status,200);
  const vc2=login2.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/users/'+viewer.id,'PATCH',{is_active:false})).status,200);
  assert.equal((await request('/auth/me','GET',undefined,vc2)).status,401);
  const list=(await (await request('/users')).json()).data;assert.equal(list.length,2);assert.ok(list.every(v=>!('password_hash'in v)&&v.tenant_id===users[0].tenant_id));
  // Race two admin demotions: tenant advisory lock must leave one active admin.
  const second=await request('/users','POST',{...input,email:'second@test.invalid',role:'admin'});
  const secondUser=(await second.json()).data;
  const demotions=await Promise.all([request('/users/'+users[0].id,'PATCH',{role:'viewer'}),request('/users/'+secondUser.id,'PATCH',{role:'viewer'})]);
  assert.ok(demotions.some(r=>r.status===200));
  assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM users WHERE tenant_id=$1 AND role='admin' AND is_active",[users[0].tenant_id])).rows[0].n,1);
  for(const user of users)await db.pool.query(`INSERT INTO logs(tenant_id,event_timestamp,ingested_at,source,event_type,raw)
    VALUES($1,clock_timestamp()-interval '1 year',clock_timestamp()-interval '8 days','api','test','old'),
    ($1,clock_timestamp()-interval '1 year',clock_timestamp(),'api','test','new')`,[user.tenant_id]);
  await db.pool.query(`INSERT INTO user_sessions(user_id,token_hash,created_at,last_seen_at,expires_at)
    VALUES($1,'expired-test',clock_timestamp()-interval '20 days',clock_timestamp()-interval '20 days',clock_timestamp()-interval '10 days')`,[users[0].id]);
  const dry=await runRetentionJob(db.pool);assert.equal(dry.eligible_logs,1);assert.equal(dry.eligible_sessions,1);
  const applied=await runRetentionJob(db.pool,{dryRun:false,batchSize:1});assert.equal(applied.deleted_logs,1);assert.equal(applied.deleted_sessions,1);
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM logs')).rows[0].n,3);
  assert.equal((await runRetentionJob(db.pool)).eligible_logs,0);
  console.log('Users/retention integration PASS: permissions, tenant isolation, password verification, session revocation, concurrent last-admin protection, per-tenant retention and dry run.');
} finally {
  if(server)await new Promise(r=>server.close(r));await db?.close();
  if(created)await admin.pool.query(`DROP DATABASE "${name}"`);await admin.close();
}