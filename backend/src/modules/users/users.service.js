import argon2 from 'argon2';
import { httpError } from '../../middleware/http-error.js';
const columns = 'id,tenant_id,email,display_name,role,is_active,last_login_at,created_at,updated_at';
export function createUsersService(pool) {
  async function transaction(auth, work, admin = true) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serializes user mutations for last-admin invariant without locking login's tenant row.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,42))', [auth.tenant_id]);
      const { rows: [actor] } = await client.query(`SELECT u.* FROM users u JOIN tenants t ON t.id=u.tenant_id
        WHERE u.id=$1 AND u.tenant_id=$2 AND u.is_active AND t.is_active FOR UPDATE OF u`, [auth.user_id,auth.tenant_id]);
      if (!actor || (admin && actor.role !== 'admin')) throw httpError(403);
      const result = await work(client,actor);
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); if (error.code === '23505') throw httpError(409); throw error; }
    finally { client.release(); }
  }
  return {
    async list(auth, page) {
      const { rows } = await pool.query(`SELECT ${columns} FROM users WHERE tenant_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`,
        [auth.tenant_id,page.limit+1,page.offset]);
      return { data: rows.slice(0,page.limit), pagination: { ...page,has_more: rows.length>page.limit } };
    },
    async create(auth,input) {
      const hash = await argon2.hash(input.password,{ type: argon2.argon2id });
      return transaction(auth,async client => {
        const { rows:[user] } = await client.query(`INSERT INTO users(tenant_id,email,password_hash,display_name,role)
          VALUES($1,$2,$3,$4,$5) RETURNING ${columns}`, [auth.tenant_id,input.email,hash,input.display_name,input.role]);
        return user;
      });
    },
    async patch(auth,id,input) {
      return transaction(auth,async client => {
        const { rows:[user] } = await client.query('SELECT * FROM users WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[auth.tenant_id,id]);
        if (!user) throw httpError(404);
        if (user.is_active && user.role==='admin' && (input.is_active===false || input.role==='viewer')) {
          const { rows:[count] } = await client.query("SELECT count(*)::int AS n FROM users WHERE tenant_id=$1 AND is_active AND role='admin'",[auth.tenant_id]);
          if (count.n<=1) throw httpError(409);
        }
        const { rows:[updated] } = await client.query(`UPDATE users SET display_name=$3,role=$4,is_active=$5
          WHERE tenant_id=$1 AND id=$2 RETURNING ${columns}`,[auth.tenant_id,id,input.display_name??user.display_name,input.role??user.role,input.is_active??user.is_active]);
        if (updated.role!==user.role || !updated.is_active) await client.query('UPDATE user_sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND revoked_at IS NULL',[id]);
        return updated;
      });
    },
    async changePassword(auth,input) {
      // Verify outside transaction; recheck hash under lock to reject concurrent password changes.
      const { rows:[user] } = await pool.query('SELECT password_hash FROM users WHERE id=$1 AND tenant_id=$2',[auth.user_id,auth.tenant_id]);
      let valid=false;
      try { valid=await argon2.verify(user?.password_hash??'',input.current_password); } catch {}
      if (!valid) throw httpError(401);
      const hash=await argon2.hash(input.new_password,{type:argon2.argon2id});
      await transaction(auth,async (client,actor) => {
        if (actor.password_hash!==user.password_hash) throw httpError(409);
        await client.query('UPDATE users SET password_hash=$2 WHERE id=$1',[auth.user_id,hash]);
        await client.query('UPDATE user_sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND revoked_at IS NULL',[auth.user_id]);
      },false);
    },
  };
}