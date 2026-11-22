(() => {
  const client = window.hrmClient;
  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;
  const key = { shift:'shift-board-v1', attendance:'hr-attendance-v1', leave:'hr-leave-v1', issue:'hr-item-issues-v1', stock:'hr-ppe-stock-v1' };
  const fields = ['employeeCode','employeeNameAadhaar','firstName','surname','gender','fatherName','spouseName','dob','nationality','educationLevel','dojDcs','designation','department','categoryAddressHs','employmentType','mobile','uanNumber','pan','esic','ip','lwf','aadhaar','bankAccount','bank','branchIfsc','presentAddress','permanentAddress','identificationMark','tokenNumber','firstAppointmentOwner','ageFitnessCertificate','medical','placeOfEmployment','vocationalTrainingNumber','vocationalTrainingDate','vocationalTrainingExpiryDate','nominee','nomineeAddress','emergencyContactName','emergencyContactRelation','emergencyContactAddress','emergencyContactNumber','remarks','location','bloodGroup','medicalDate','medicalExpiryDate','vtBasic','vtSpecial','authorisation','authorisationDate','authorisationExpiryDate','newAppointments','addressCategory'];
  const dateFields = new Set(['dob','dojDcs','firstAppointmentOwner','vocationalTrainingDate','vocationalTrainingExpiryDate','medicalDate','medicalExpiryDate','authorisationDate','authorisationExpiryDate']);
  const snake = value => value.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase());
  const parse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
  const setCache = (name, value) => nativeSet.call(localStorage, name, JSON.stringify(value));
  const status = (message, error=false) => {
    let el=document.getElementById('hrdbStatus');
    if(!el){el=document.createElement('div');el.id='hrdbStatus';el.style.cssText='position:fixed;z-index:9999;left:12px;right:12px;bottom:12px;max-width:760px;margin:auto;padding:10px 14px;border-radius:10px;background:#173d30;color:white;font:13px system-ui;box-shadow:0 8px 30px #0002';document.body.appendChild(el)}
    el.style.background=error?'#982f27':'#173d30';el.textContent=message;el.hidden=false;clearTimeout(el._timer);if(!error)el._timer=setTimeout(()=>{el.hidden=true},2200);
  };
  const check = result => { if(result.error) throw result.error; return result.data; };
  let role='', user=null, employeeRows=[], queue=Promise.resolve();
  const camelEmployee = row => {
    const m={id:row.id,srNo:row.serial_no||'',isActive:row.is_active!==false};
    for(const field of fields)m[field]=row[field==='employeeNameAadhaar'?'employee_name':snake(field)]??'';
    m.empCode=m.employeeCode||'';m.name=m.employeeNameAadhaar||[m.firstName,m.surname].filter(Boolean).join(' ')||m.empCode||`Employee ${m.srNo}`;
    return m;
  };
  const employeeRow = m => {
    const row={id:m.id,is_active:m.isActive!==false,updated_at:new Date().toISOString()};
    const serial=Number(m.srNo);if(serial>0)row.serial_no=serial;
    for(const field of fields){const col=field==='employeeNameAadhaar'?'employee_name':snake(field);let value=m[field]??'';if(dateFields.has(field)&&!value)value=null;if(field==='employeeCode'&&!value)value=null;row[col]=value}
    return row;
  };
  const cleanRows = rows => rows.filter(Boolean);
  async function loadCache(){
    const isHr=['admin','hr'].includes(role);
    const empResult=check(await client.from(isHr?'employees':'employee_directory').select('*').order(isHr?'serial_no':'employee_code'));
    employeeRows=empResult||[];
    const members=employeeRows.map(camelEmployee);
    const nextSrNo=Math.max(1,...members.map(m=>Number(m.srNo)||0))+1;
    const [shiftRows,attendanceRows,leaveRows,itemRows,issueRows,movementRows,otRows]=await Promise.all([
      client.from('shift_assignments').select('employee_id,work_date,shift'),
      client.from('attendance').select('employee_id,attendance_date,status'),
      client.from('leave_requests').select('*'),
      client.from('ppe_items').select('*'),
      client.from('ppe_issues').select('*'),
      client.from('ppe_stock_movements').select('*'),
      client.from('overtime_entries').select('*')
    ].map(p=>p.then(check)));
    const schedule={},overtime={};(shiftRows||[]).forEach(r=>{schedule[r.work_date]??={};schedule[r.work_date][r.employee_id]=r.shift});(otRows||[]).forEach(r=>{overtime[r.work_date]??={};overtime[r.work_date][r.employee_id]={hours:Number(r.hours),reason:r.reason||''}});
    setCache(key.shift,{members,schedule,overtime,nextSrNo});
    const days={};(attendanceRows||[]).forEach(r=>{days[r.attendance_date]??={};days[r.attendance_date][r.employee_id]=r.status});setCache(key.attendance,{days});
    const byId=new Map(members.map(m=>[m.id,m]));
    setCache(key.leave,(leaveRows||[]).map(r=>({id:r.id,employee:byId.get(r.employee_id)?.name||'',employeeCode:byId.get(r.employee_id)?.employeeCode||'',type:r.leave_type,start:r.start_date,end:r.end_date,reason:r.reason||'',status:r.status,createdAt:r.created_at,updatedAt:r.updated_at})));
    const items=itemRows||[],itemsById=new Map(items.map(i=>[i.id,i.item_name])),categories=Object.fromEntries(items.map(i=>[i.item_name,i.category||'Other']));
    const records=(issueRows||[]).map(r=>({id:r.id,employeeCode:byId.get(r.employee_id)?.employeeCode||'',person:byId.get(r.employee_id)?.name||'',item:itemsById.get(r.item_id)||'',date:r.issue_date,quantity:r.quantity}));
    setCache(key.issue,{items:items.map(i=>i.item_name),itemCategories:categories,records});
    const opening=Object.fromEntries(items.map(i=>[i.item_name,Number(i.opening_stock)||0]));
    const movements=(movementRows||[]).map(r=>({id:r.id,type:r.movement_type==='return'?'return':'in',item:itemsById.get(r.item_id)||'',quantity:r.quantity,date:r.movement_date,employee:byId.get(r.employee_id)?.name||'',note:r.note||''}));
    setCache(key.stock,{opening,movements});
  }
  const membersNow=()=>parse(localStorage.getItem(key.shift),{members:[]}).members||[];
  const memberByCode=(code)=>membersNow().find(m=>String(m.employeeCode||m.empCode||'').trim().toLowerCase()===String(code||'').trim().toLowerCase());
  const memberByName=(name)=>membersNow().find(m=>String(m.name||m.employeeNameAadhaar||'').trim().toLowerCase()===String(name||'').trim().toLowerCase());
  async function syncEmployees(state){if(!['admin','hr'].includes(role))return;const rows=cleanRows((state.members||[]).map(employeeRow));if(rows.length)check(await client.from('employees').upsert(rows,{onConflict:'id'}))}
  async function syncShift(state,previous){
    await syncEmployees(state);
    const assignments=[];Object.entries(state.schedule||{}).forEach(([date,entries])=>Object.entries(entries||{}).forEach(([employeeId,shift])=>assignments.push({employee_id:employeeId,work_date:date,shift,updated_by:user.id,updated_at:new Date().toISOString()})));
    if(assignments.length)check(await client.from('shift_assignments').upsert(assignments,{onConflict:'employee_id,work_date'}));
    const ot=[];Object.entries(state.overtime||{}).forEach(([date,entries])=>Object.entries(entries||{}).forEach(([employeeId,value])=>{if(Number(value?.hours)>0)ot.push({employee_id:employeeId,work_date:date,hours:Number(value.hours),reason:value.reason||'',recorded_by:user.id,updated_at:new Date().toISOString()})}));
    if(ot.length)check(await client.from('overtime_entries').upsert(ot,{onConflict:'employee_id,work_date'}));
    for(const [date,entries] of Object.entries(previous?.overtime||{}))for(const employeeId of Object.keys(entries||{}))if(!Number(state.overtime?.[date]?.[employeeId]?.hours))check(await client.from('overtime_entries').delete().eq('employee_id',employeeId).eq('work_date',date));
  }
  async function syncAttendance(state,previous){const rows=[];Object.entries(state.days||{}).forEach(([date,entries])=>Object.entries(entries||{}).forEach(([employeeId,statusValue])=>rows.push({employee_id:employeeId,attendance_date:date,status:statusValue,updated_by:user.id,updated_at:new Date().toISOString()})));if(rows.length)check(await client.from('attendance').upsert(rows,{onConflict:'employee_id,attendance_date'}));for(const [date,entries] of Object.entries(previous?.days||{}))for(const employeeId of Object.keys(entries||{}))if(!state.days?.[date]?.[employeeId])check(await client.from('attendance').delete().eq('employee_id',employeeId).eq('attendance_date',date))}
  async function syncLeave(records){for(const r of records||[]){const m=memberByCode(r.employeeCode)||memberByName(r.employee);if(!m)continue;const row={id:r.id,employee_id:m.id,leave_type:r.type,start_date:r.start,end_date:r.end,reason:r.reason||'',status:r.status||'Pending',submitted_by:user.id,updated_at:new Date().toISOString()};check(await client.from('leave_requests').upsert(row,{onConflict:'id'}))}}
  async function syncItems(issueData,stockData){const items=(issueData.items||[]).map(item=>({item_name:item,category:issueData.itemCategories?.[item]||'Other',opening_stock:Math.max(0,Number(stockData.opening?.[item])||0),is_active:true}));return items.length?check(await client.from('ppe_items').upsert(items,{onConflict:'item_name'}).select('id,item_name')):[]}
  async function syncIssues(issueData){const stock=parse(localStorage.getItem(key.stock),{opening:{},movements:[]}),items=await syncItems(issueData,stock),itemsByName=new Map(items.map(x=>[x.item_name,x.id])),rows=[];for(const r of issueData.records||[]){const m=memberByCode(r.employeeCode)||memberByName(r.person),itemId=itemsByName.get(r.item);if(!m||!itemId)continue;rows.push({id:r.id,employee_id:m.id,item_id:itemId,issue_date:r.date,quantity:Number(r.quantity)||1,issued_by:user.id})}if(rows.length)check(await client.from('ppe_issues').upsert(rows,{onConflict:'employee_id,item_id,issue_date'}))}
  async function syncStock(stockData){const issue=parse(localStorage.getItem(key.issue),{items:[],itemCategories:{},records:[]}),items=await syncItems(issue,stockData),itemsByName=new Map(items.map(x=>[x.item_name,x.id])),rows=[];for(const r of stockData.movements||[]){const itemId=itemsByName.get(r.item);if(!itemId)continue;const employee=memberByName(r.employee);rows.push({id:r.id,item_id:itemId,movement_type:r.type==='return'?'return':'received',quantity:Number(r.quantity)||1,movement_date:r.date,employee_id:employee?.id||null,note:r.note||'',recorded_by:user.id})}if(rows.length)check(await client.from('ppe_stock_movements').upsert(rows,{onConflict:'id'}))}
  async function syncKey(name,value,previousValue){const parsed=parse(value,null),previous=parse(previousValue,null);if(!parsed)return;if(name===key.shift)return syncShift(parsed,previous);if(name===key.attendance)return syncAttendance(parsed,previous);if(name===key.leave)return syncLeave(parsed);if(name===key.issue)return syncIssues(parsed);if(name===key.stock)return syncStock(parsed)}
  function wireStorage(){Storage.prototype.setItem=function(name,value){const old=this.getItem(name);nativeSet.call(this,name,value);if(this===localStorage&&Object.values(key).includes(name)){queue=queue.then(()=>syncKey(name,value,old)).then(()=>status('Saved to Supabase')).catch(error=>{console.error(error);status('Supabase save failed: '+(error.message||'Check connection and access'),true)})}}}
  async function boot(){
    const {data:{session}}=await client.auth.getSession();if(!session){location.replace('login.html');return false}user=session.user;
    const profile=check(await client.from('user_profiles').select('role,email,full_name,designation').eq('id',user.id).single());role=profile.role;
    const page=location.pathname.split('/').pop()||'index.html';const access={ 'admin-users.html':['admin'],'employee-records.html':['admin','hr'],'employees-data.html':['admin','hr'],'attendance.html':['admin','hr','supervisor'],'leave.html':['admin','hr'],'samaan-issue.html':['admin','hr'],'ppe-stock.html':['admin','hr'],'ppe-issue-records.html':['admin','hr','supervisor','viewer'],'reports.html':['admin','hr','supervisor'],'shift-dashboard.html':['admin','hr','supervisor','viewer'],'index.html':['admin','hr','supervisor','viewer']};
    if(access[page]&&!access[page].includes(role)){document.body.innerHTML='<main style="max-width:600px;margin:15vh auto;padding:24px;font:16px system-ui"><h1>Access restricted</h1><p>Your account role does not have access to this page.</p><button id="signout">Sign out</button></main>';document.getElementById('signout').onclick=()=>client.auth.signOut().then(()=>location.replace('login.html'));return false}
    await loadCache();wireStorage();
    const header=document.querySelector('header.top');if(header){const account=document.createElement('div');account.className='hrdb-account';account.style.cssText='display:flex;align-items:center;gap:10px;margin-left:auto;flex-wrap:wrap';if(role==='admin'){const usersLink=document.createElement('a');usersLink.href='admin-users.html';usersLink.textContent='User management';usersLink.style.cssText='white-space:nowrap;background:#fff;border:1px solid #d9e3dc;border-radius:9px;padding:9px 13px;color:#33443b;font:600 13px system-ui;text-decoration:none';account.append(usersLink)}const identity=document.createElement('div');identity.style.cssText='display:flex;flex-direction:column;gap:2px;text-align:right;line-height:1.2';const name=document.createElement('strong');name.textContent=user.user_metadata?.full_name||user.user_metadata?.name||profile.full_name||profile.email||user.email||'User';name.style.cssText='font:700 13px system-ui;color:#26372f';const roleLabel={admin:'Admin',hr:'HR',supervisor:'Supervisor',viewer:'Viewer'}[role]||role;const designation=profile.designation||user.user_metadata?.designation;const roleBadge=document.createElement('span');roleBadge.textContent=designation?`${designation} · ${roleLabel}`:roleLabel;roleBadge.style.cssText='font:600 11px system-ui;color:#176b52';identity.append(name,roleBadge);const button=document.createElement('button');button.type='button';button.className='hrdb-signout';button.textContent='Log out';button.setAttribute('aria-label','Log out of BV Mining Solution');button.style.cssText='white-space:nowrap;background:#fff;border:1px solid #d9e3dc;border-radius:9px;padding:9px 13px;color:#33443b;font:600 13px system-ui;cursor:pointer';button.onclick=async()=>{button.disabled=true;button.textContent='Logging out…';try{const{error}=await client.auth.signOut();if(error)throw error;Object.values(key).forEach(k=>nativeRemove.call(localStorage,k));location.replace('login.html')}catch(error){button.disabled=false;button.textContent='Log out';status(`Could not log out: ${error.message}`,true)}};account.append(identity,button);header.append(account)}
    return true;
  }
  window.HRDB={client,boot,status,get role(){return role},get user(){return user},flush:()=>queue};
})();
