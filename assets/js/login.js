const client=window.hrmClient,form=document.getElementById('loginForm'),errorBox=document.getElementById('error'),button=document.getElementById('submit');
const sessionKey=userId=>`bv-active-device-session:${userId}`;
if(new URLSearchParams(location.search).get('reason')==='session-replaced'){errorBox.textContent='This account was signed in on another device, so this session was logged out.';errorBox.classList.add('show')}
client.auth.getSession().then(({data})=>{if(data.session)location.replace('index.html')});
form.addEventListener('submit',async event=>{
  event.preventDefault();errorBox.classList.remove('show');button.disabled=true;button.textContent='Signing in…';
  try{
    const {data,error}=await client.auth.signInWithPassword({email:document.getElementById('email').value.trim(),password:document.getElementById('password').value});if(error)throw error;
    const profile=await client.from('user_profiles').select('role').eq('id',data.user.id).maybeSingle();if(profile.error||!profile.data)throw new Error('This account has no HR role profile yet. Ask the administrator to finish setup.');
    const key=sessionKey(data.user.id),deviceSessionId=localStorage.getItem(key)||crypto.randomUUID();
    const {error:sessionError}=await client.rpc('claim_active_device_session',{p_session_id:deviceSessionId});if(sessionError)throw new Error(/function .*claim_active_device_session.* does not exist|schema cache/i.test(sessionError.message)?'Single-device login setup is missing. Run database/device-session-migration.sql in Supabase SQL Editor, then try again.':`Could not activate this device session: ${sessionError.message}`);
    localStorage.setItem(key,deviceSessionId);location.replace('index.html');
  }catch(error){await client.auth.signOut();errorBox.textContent=error.message||'Sign in failed.';errorBox.classList.add('show');button.disabled=false;button.textContent='Sign in'}
});
