import test from 'node:test';
import assert from 'node:assert/strict';
import {createUserSchema,patchUserSchema,changePasswordSchema} from '../src/modules/users/users.schema.js';
test('user schemas reject identity injection and sparse updates do not default role',()=>{
  assert.deepEqual(patchUserSchema.parse({is_active:false}),{is_active:false});
  assert.equal(patchUserSchema.safeParse({}).success,false);
  assert.equal(createUserSchema.safeParse({email:'x@example.com',display_name:'X',password:'short'}).success,false);
  assert.equal(patchUserSchema.safeParse({tenant_id:'other'}).success,false);
  assert.equal(changePasswordSchema.safeParse({current_password:'long-password',new_password:'long-password'}).success,false);
});