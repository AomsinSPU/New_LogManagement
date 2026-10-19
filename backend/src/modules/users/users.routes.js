import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { pageSchema,idSchema } from '../alerts/alerts.schema.js';
import { createUserSchema,patchUserSchema,changePasswordSchema } from './users.schema.js';
import { createUsersService } from './users.service.js';
import { httpError } from '../../middleware/http-error.js';
function mutationLimit() {
  const entries=new Map();
  return (req,res,next)=>{
    if(req.method==='GET')return next();
    const now=Date.now();
    for(const [key,value] of entries)if(value.until<=now)entries.delete(key);
    const key=req.auth.user_id;
    if(!entries.has(key)) {
      if(entries.size>=10000)return next(httpError(429));
      entries.set(key,{count:0,until:now+900000});
    }
    const value=entries.get(key);
    if(++value.count>20){res.set('Retry-After',String(Math.ceil((value.until-now)/1000)));return next(httpError(429));}
    next();
  };
}
export function createUsersRouter({pool,config}) {
  const router=Router(), service=createUsersService(pool);
  router.use(authenticate({pool}),authorize('admin'),csrfProtection(config),mutationLimit());
  router.get('/',validate({query:pageSchema}),async(req,res)=>res.json(await service.list(req.auth,req.validated.query)));
  router.post('/',validate({body:createUserSchema}),async(req,res)=>res.status(201).json({data:await service.create(req.auth,req.validated.body)}));
  router.patch('/:id',validate({params:idSchema,body:patchUserSchema}),async(req,res)=>res.json({data:await service.patch(req.auth,req.validated.params.id,req.validated.body)}));
  return router;
}
export function passwordChangeHandlers({pool,config}) {
  const service=createUsersService(pool);
  return [authenticate({pool}),csrfProtection(config),mutationLimit(),validate({body:changePasswordSchema}),async(req,res)=>{
    await service.changePassword(req.auth,req.validated.body);
    res.clearCookie('session',{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'lax',path:'/'});
    res.status(204).end();
  }];
}