import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});

function apiKey(legacyName:string,mapName:string):string|null{
  const legacy=Deno.env.get(legacyName);
  if(legacy)return legacy;
  const raw=Deno.env.get(mapName);
  if(!raw)return null;
  try{const keys=JSON.parse(raw);const candidate=keys.default??Object.values(keys)[0];return typeof candidate==='string'?candidate:null}catch{return null}
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({error:'Use POST to create a user.'},405);

  const url=Deno.env.get('SUPABASE_URL');
  const publishable=apiKey('SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEYS');
  const secret=apiKey('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS');
  if(!url||!publishable||!secret)return json({error:'Supabase function keys are not configured.'},500);

  const authorization=req.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return json({error:'Sign in with an administrator account first.'},401);
  const token=authorization.slice(7);
  const caller=createClient(url,publishable,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await caller.auth.getUser(token);
  if(userError||!userData.user)return json({error:'Your session is invalid. Sign in again.'},401);

  const {data:profile,error:profileError}=await caller.from('user_profiles').select('role').eq('id',userData.user.id).maybeSingle();
  if(profileError)return json({error:`Could not verify your role: ${profileError.message}`},403);
  if(profile?.role!=='admin')return json({error:'Only administrators can create accounts.'},403);

  let input:Record<string,unknown>;
  try{input=await req.json()}catch{return json({error:'Request body must be valid JSON.'},400)}
  const fullName=typeof input.fullName==='string'?input.fullName.trim():'';
  const designation=typeof input.designation==='string'?input.designation.trim():'';
  const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
  const password=typeof input.password==='string'?input.password:'';
  const role=typeof input.role==='string'?input.role:'';
  if(!fullName||fullName.length>120)return json({error:'Enter a name up to 120 characters.'},400);
  if(!designation||designation.length>80)return json({error:'Enter a designation up to 80 characters.'},400);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Enter a valid email address.'},400);
  if(password.length<6||password.length>12)return json({error:'Temporary password must be 6 to 12 characters.'},400);
  if(!['admin','hr','supervisor','viewer'].includes(role))return json({error:'Choose a valid access role.'},400);

  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName,designation}});
  if(createError)return json({error:createError.message},400);
  if(!created.user)return json({error:'Supabase did not return the new account.'},500);

  const {error:profileWriteError}=await admin.from('user_profiles').upsert({id:created.user.id,email,full_name:fullName,designation,role},{onConflict:'id'});
  if(profileWriteError){await admin.auth.admin.deleteUser(created.user.id);return json({error:`Could not save the application role: ${profileWriteError.message}`},500)}
  return json({id:created.user.id,email,fullName,role},201);
});
