import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const assignablePages=['dashboard','employee_records','employees_data','shift_board','mining_report','attendance','monthly_attendance','leave','stock_management','ppe_issue_records','stock_returns','reports'];
const rolePages:Record<string,string[]>={admin:[...assignablePages,'audit_log','user_management'],hr:assignablePages,accountant:assignablePages,store:assignablePages,mechanical:assignablePages,mine_mate:assignablePages,foreman:assignablePages,project_manager:assignablePages,assistant_project_manager:assignablePages,director:assignablePages};
function pageAccess(input:unknown,role:string):Record<string,boolean>|null{
  const allowed=rolePages[role]||[];if(input===undefined)return Object.fromEntries(allowed.map(key=>[key,true]));
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const requested=input as Record<string,unknown>;if(Object.keys(requested).some(key=>requested[key]===true&&!allowed.includes(key)))return null;
  return Object.fromEntries(allowed.filter(key=>key==='dashboard'||requested[key]===true).map(key=>[key,true]));
}

function apiKey(legacyName: string, mapName: string): string | null {
  const legacy = Deno.env.get(legacyName);
  if (legacy) return legacy;
  const raw = Deno.env.get(mapName);
  if (!raw) return null;
  try {
    const keys = JSON.parse(raw);
    const candidate = keys.default ?? Object.values(keys)[0];
    return typeof candidate === 'string' ? candidate : null;
  } catch {
    return null;
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST to manage an application user.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const publishable = apiKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
  const secret = apiKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS');
  if (!url || !publishable || !secret) return json({ error: 'Supabase function keys are not configured.' }, 500);

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in with an administrator account first.' }, 401);
  const token = authorization.slice(7);
  const caller = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Your session is invalid. Sign in again.' }, 401);
  const { data: callerProfile, error: callerProfileError } = await caller.from('user_profiles')
    .select('role').eq('id', userData.user.id).maybeSingle();
  if (callerProfileError) return json({ error: `Could not verify your role: ${callerProfileError.message}` }, 403);
  if (callerProfile?.role !== 'admin') return json({ error: 'Only administrators can manage application users.' }, 403);

  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }
  const action = typeof input.action === 'string' ? input.action : '';
  const userId = typeof input.userId === 'string' ? input.userId : '';
  if (!['update', 'delete'].includes(action)) return json({ error: 'Choose update or delete.' }, 400);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return json({ error: 'A valid application user is required.' }, 400);
  }
  if (action === 'delete' && userId === userData.user.id) return json({ error: 'You cannot delete your own account here.' }, 400);

  const admin = createClient(url, secret, { global: { headers: { 'x-audit-actor-id': userData.user.id } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: target, error: targetError } = await admin.from('user_profiles')
    .select('id,email,full_name,designation,role,page_access').eq('id', userId).maybeSingle();
  if (targetError) return json({ error: `Could not load that account: ${targetError.message}` }, 500);
  if (!target) return json({ error: 'Application user not found.' }, 404);

  if (action === 'delete') {
    if (target.role === 'admin') {
      const { count, error: countError } = await admin.from('user_profiles')
        .select('id', { count: 'exact', head: true }).eq('role', 'admin');
      if (countError) return json({ error: `Could not verify the administrator count: ${countError.message}` }, 500);
      if ((count ?? 0) <= 1) return json({ error: 'The last administrator cannot be deleted. Promote another user to Admin first.' }, 409);
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) return json({ error: deleteError.message }, 400);
    return json({ id: userId, email: target.email, deleted: true });
  }

  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  const designation = typeof input.designation === 'string' ? input.designation.trim() : '';
  const role = typeof input.role === 'string' ? input.role : '';
  if (!fullName || fullName.length > 120) return json({ error: 'Enter a name up to 120 characters.' }, 400);
  if (!designation || designation.length > 80) return json({ error: 'Enter a designation up to 80 characters.' }, 400);
  if (!['admin', 'hr', 'accountant', 'store', 'mechanical', 'mine_mate', 'foreman', 'project_manager', 'assistant_project_manager', 'director'].includes(role)) return json({ error: 'Choose a valid access role.' }, 400);
  const selectedPageAccess=pageAccess(input.pageAccess,role);
  if(!selectedPageAccess)return json({error:'Page access contains pages that are not available for this role.'},400);
  if (userId === userData.user.id && role !== 'admin') return json({ error: 'You cannot remove your own Admin role.' }, 400);

  if (target.role === 'admin' && role !== 'admin') {
    const { count, error: countError } = await admin.from('user_profiles')
      .select('id', { count: 'exact', head: true }).eq('role', 'admin');
    if (countError) return json({ error: `Could not verify the administrator count: ${countError.message}` }, 500);
    if ((count ?? 0) <= 1) return json({ error: 'The last administrator cannot be demoted. Promote another user to Admin first.' }, 409);
  }

  const { data: authResult, error: authReadError } = await admin.auth.admin.getUserById(userId);
  if (authReadError || !authResult.user) return json({ error: authReadError?.message || 'Auth account not found.' }, 404);
  const previousMetadata = authResult.user.user_metadata ?? {};
  const nextMetadata = { ...previousMetadata, full_name: fullName, designation };
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, { user_metadata: nextMetadata });
  if (authUpdateError) return json({ error: authUpdateError.message }, 400);

  const { error: profileUpdateError } = await admin.from('user_profiles').update({
    full_name: fullName,
    designation,
    role,
    page_access:selectedPageAccess,
  }).eq('id', userId);
  if (profileUpdateError) {
    await admin.auth.admin.updateUserById(userId, { user_metadata: previousMetadata });
    return json({ error: `Could not save the application profile: ${profileUpdateError.message}` }, 500);
  }
  return json({ id: userId, email: target.email, fullName, designation, role, pageAccess:selectedPageAccess, updated: true });
});
