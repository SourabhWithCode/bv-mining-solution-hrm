(() => {
  const {client,status}=window.HRDB;
  const form=document.getElementById('createUserForm');
  const feedback=document.getElementById('feedback');
  const createButton=document.getElementById('createButton');
  const rows=document.getElementById('userRows');
  const roleName={admin:'Admin',hr:'HR',supervisor:'Supervisor',viewer:'Viewer'};

  function message(text,error=false){feedback.textContent=text;feedback.classList.toggle('error',error)}

  async function loadUsers(){
    rows.innerHTML='<tr><td class="empty" colspan="3">Loading users…</td></tr>';
    const {data,error}=await client.from('user_profiles').select('full_name,designation,email,role,created_at').order('created_at',{ascending:false});
    if(error){rows.innerHTML='';const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.className='empty';td.textContent=`Could not load users: ${error.message}`;tr.append(td);rows.append(tr);return}
    rows.replaceChildren();
    if(!data?.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.className='empty';td.textContent='No application users found.';tr.append(td);rows.append(tr);return}
    data.forEach(user=>{const tr=document.createElement('tr'),name=document.createElement('td'),email=document.createElement('td'),designation=document.createElement('td'),role=document.createElement('td'),badge=document.createElement('span'),created=document.createElement('td');name.textContent=user.full_name||'—';email.textContent=user.email;designation.textContent=user.designation||'—';badge.className='role';badge.textContent=roleName[user.role]||user.role;role.append(badge);created.textContent=user.created_at?new Date(user.created_at).toLocaleDateString():'—';tr.append(name,email,designation,role,created);rows.append(tr)});
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();message('');createButton.disabled=true;createButton.textContent='Creating…';
    const values=new FormData(form);
    try{
      const {data,error}=await client.functions.invoke('admin-create-user',{body:{fullName:String(values.get('fullName')).trim(),designation:String(values.get('designation')).trim(),email:String(values.get('email')).trim(),role:String(values.get('role')),password:String(values.get('password'))}});
      if(error){let detail=error.message;try{const body=await error.context.json();if(body?.error)detail=body.error}catch{}throw new Error(detail)}
      message(`Created ${data.email} as ${roleName[data.role]||data.role}. Share the temporary password securely.`);
      form.reset();await loadUsers();
    }catch(error){console.error(error);message(error.message||'Could not create account. Check that the Edge Function has been deployed.',true)}
    finally{createButton.disabled=false;createButton.textContent='Create user'}
  });
  document.getElementById('refreshUsers').addEventListener('click',loadUsers);
  loadUsers();
})();
