(() => {
  const client = window.hrmClient;
  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;
  const key = { shift:'shift-board-v1', attendance:'hr-attendance-v1', leave:'hr-leave-v1', issue:'hr-item-issues-v1', stock:'hr-ppe-stock-v1' };
  const fields = ['employeeCode','employeeNameAadhaar','firstName','surname','gender','fatherName','spouseName','dob','nationality','educationLevel','dojDcs','designation','department','categoryAddressHs','employmentType','employmentStatus','mobile','uanNumber','pan','esic','ip','lwf','aadhaar','bankAccount','bank','branchIfsc','presentAddress','permanentAddress','identificationMark','tokenNumber','firstAppointmentOwner','ageFitnessCertificate','medical','placeOfEmployment','vocationalTrainingNumber','vocationalTrainingDate','vocationalTrainingExpiryDate','nominee','nomineeAddress','emergencyContactName','emergencyContactRelation','emergencyContactAddress','emergencyContactNumber','remarks','location','bloodGroup','medicalDate','medicalExpiryDate','vtBasic','vtSpecial','authorisation','authorisationDate','authorisationExpiryDate','newAppointments','addressCategory'];
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
  let role='', user=null, employeeRows=[], queue=Promise.resolve(), pageAccess={};
  const camelEmployee = row => {
    const m={id:row.id,srNo:row.serial_no||'',isActive:row.is_active!==false,employmentStatus:row.employment_status||'Active'};
    for(const field of fields)m[field]=row[field==='employeeNameAadhaar'?'employee_name':snake(field)]??'';
    m.empCode=m.employeeCode||'';m.name=m.employeeNameAadhaar||[m.firstName,m.surname].filter(Boolean).join(' ')||m.empCode||`Employee ${m.srNo}`;
    return m;
  };
  const employeeRow = m => {
    const row={id:m.id,is_active:m.isActive!==false,employment_status:m.employmentStatus||'Active',updated_at:new Date().toISOString()};
    const serial=Number(m.srNo);if(serial>0)row.serial_no=serial;
    for(const field of fields){const col=field==='employeeNameAadhaar'?'employee_name':snake(field);let value=m[field]??'';if(dateFields.has(field)&&!value)value=null;if(field==='employeeCode'&&!value)value=null;row[col]=value}
    return row;
  };
  const cleanRows = rows => rows.filter(Boolean);
  async function loadCache(){
    const isHr=['admin','hr'].includes(role)||pageAccess.employee_records===true||pageAccess.employees_data===true;
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
    const schedule={},overtime={};(shiftRows||[]).forEach(r=>{schedule[r.work_date]??={};schedule[r.work_date][r.employee_id]=r.shift});(otRows||[]).forEach(r=>{overtime[r.work_date]??={};overtime[r.work_date][r.employee_id]={hours:Number(r.hours),reason:r.reason||'',approvalStatus:r.approval_status||'Pending',approvedBy:r.approved_by||'',approvedAt:r.approved_at||'',recordedBy:r.recorded_by||''}});
    setCache(key.shift,{members,schedule,overtime,nextSrNo});
    const days={},manualClear={};(attendanceRows||[]).forEach(r=>{if(r.status===null){manualClear[r.attendance_date]??={};manualClear[r.attendance_date][r.employee_id]=true}else{days[r.attendance_date]??={};days[r.attendance_date][r.employee_id]=r.status}});setCache(key.attendance,{days,manualClear});
    const byId=new Map(members.map(m=>[m.id,m]));
    setCache(key.leave,(leaveRows||[]).map(r=>({id:r.id,employee:byId.get(r.employee_id)?.name||'',employeeCode:byId.get(r.employee_id)?.employeeCode||'',type:r.leave_type,start:r.start_date,end:r.end_date,reason:r.reason||'',status:r.status,submittedBy:r.submitted_by,createdAt:r.created_at,updatedAt:r.updated_at})));
    const items=itemRows||[],itemsById=new Map(items.map(i=>[i.id,i.item_name])),categories=Object.fromEntries(items.map(i=>[i.item_name,i.category||'Other']));
    const records=(issueRows||[]).map(r=>({id:r.id,employeeCode:byId.get(r.employee_id)?.employeeCode||'',person:byId.get(r.employee_id)?.name||'',item:itemsById.get(r.item_id)||'',date:r.issue_date,quantity:r.quantity}));
    setCache(key.issue,{items:items.map(i=>i.item_name),itemCategories:categories,records});
    const opening=Object.fromEntries(items.map(i=>[i.item_name,Number(i.opening_stock)||0]));const minimum=Object.fromEntries(items.map(i=>[i.item_name,Number(i.minimum_stock)||0]));
    const movements=(movementRows||[]).map(r=>({id:r.id,type:r.movement_type==='return'?'return':'in',item:itemsById.get(r.item_id)||'',quantity:r.quantity,date:r.movement_date,employee:byId.get(r.employee_id)?.name||'',note:r.note||''}));
    setCache(key.stock,{opening,minimum,movements});
  }
  const membersNow=()=>parse(localStorage.getItem(key.shift),{members:[]}).members||[];
  const memberByCode=(code)=>membersNow().find(m=>String(m.employeeCode||m.empCode||'').trim().toLowerCase()===String(code||'').trim().toLowerCase());
  const memberByName=(name)=>membersNow().find(m=>String(m.name||m.employeeNameAadhaar||'').trim().toLowerCase()===String(name||'').trim().toLowerCase());
  async function syncEmployees(state,previous){if(!pageAccess.employee_records)return;const oldIds=new Set((previous?.members||[]).map(m=>m.id));const rows=cleanRows((state.members||[]).filter(m=>role==='admin'||!oldIds.has(m.id)).map(employeeRow));if(rows.length)check(await (role==='admin'?client.from('employees').upsert(rows,{onConflict:'id'}):client.from('employees').insert(rows)))}
  async function syncShift(state,previous){
    await syncEmployees(state,previous);
    const assignments=[];Object.entries(state.schedule||{}).forEach(([date,entries])=>Object.entries(entries||{}).forEach(([employeeId,shift])=>{if(role!=='admin'&&Object.hasOwn(previous?.schedule?.[date]||{},employeeId))return;assignments.push({employee_id:employeeId,work_date:date,shift,updated_by:user.id,updated_at:new Date().toISOString()})}));
    if(assignments.length)check(await (role==='admin'?client.from('shift_assignments').upsert(assignments,{onConflict:'employee_id,work_date'}):client.from('shift_assignments').insert(assignments)));
    const ot=[];Object.entries(state.overtime||{}).forEach(([date,entries])=>Object.entries(entries||{}).forEach(([employeeId,value])=>{if(Number(value?.hours)>0&&(role==='admin'||!Object.hasOwn(previous?.overtime?.[date]||{},employeeId)))ot.push({employee_id:employeeId,work_date:date,hours:Number(value.hours),reason:value.reason||'',approval_status:value.approvalStatus||'Pending',approved_by:role==='admin'?(value.approvedBy||null):null,approved_at:role==='admin'?(value.approvedAt||null):null,recorded_by:value.recordedBy||user.id,updated_at:new Date().toISOString()})}));
    if(ot.length)check(await (role==='admin'?client.from('overtime_entries').upsert(ot,{onConflict:'employee_id,work_date'}):client.from('overtime_entries').insert(ot)));
    if(role==='admin')for(const [date,entries] of Object.entries(previous?.overtime||{}))for(const employeeId of Object.keys(entries||{}))if(!Number(state.overtime?.[date]?.[employeeId]?.hours))check(await client.from('overtime_entries').delete().eq('employee_id',employeeId).eq('work_date',date));
  }
  async function syncAttendance(state,previous){const rows=[],rowKeys=new Set();Object.entries(state.days||{}).forEach(([date,entries])=>Object.entries(entries||{}).forEach(([employeeId,statusValue])=>{if(role!=='admin'&&(Object.hasOwn(previous?.days?.[date]||{},employeeId)||Object.hasOwn(previous?.manualClear?.[date]||{},employeeId)))return;rows.push({employee_id:employeeId,attendance_date:date,status:statusValue,updated_by:user.id,updated_at:new Date().toISOString()});rowKeys.add(`${date}:${employeeId}`)}));Object.entries(state.manualClear||{}).forEach(([date,entries])=>Object.keys(entries||{}).forEach(employeeId=>{const k=`${date}:${employeeId}`;if(rowKeys.has(k)||role!=='admin'&&(Object.hasOwn(previous?.days?.[date]||{},employeeId)||Object.hasOwn(previous?.manualClear?.[date]||{},employeeId)))return;rows.push({employee_id:employeeId,attendance_date:date,status:null,updated_by:user.id,updated_at:new Date().toISOString()});rowKeys.add(k)}));if(rows.length)check(await (role==='admin'?client.from('attendance').upsert(rows,{onConflict:'employee_id,attendance_date'}):client.from('attendance').insert(rows)));if(role==='admin')for(const source of [previous?.days,previous?.manualClear])for(const [date,entries] of Object.entries(source||{}))for(const employeeId of Object.keys(entries||{}))if(!state.days?.[date]?.[employeeId]&&!state.manualClear?.[date]?.[employeeId])check(await client.from('attendance').delete().eq('employee_id',employeeId).eq('attendance_date',date))}
  async function syncLeave(records,previous){const oldIds=new Set((previous||[]).map(r=>r.id));for(const r of records||[]){if(role!=='admin'&&oldIds.has(r.id))continue;const m=(r.employeeCode&&memberByCode(r.employeeCode))||memberByName(r.employee);if(!m)continue;const row={id:r.id,employee_id:m.id,leave_type:r.type,start_date:r.start,end_date:r.end,reason:r.reason||'',status:r.status||'Pending',submitted_by:r.submittedBy||user.id,updated_at:new Date().toISOString()};check(await (role==='admin'?client.from('leave_requests').upsert(row,{onConflict:'id'}):client.from('leave_requests').insert(row)))}}
  async function syncItems(issueData,stockData){const names=issueData.items||[];if(!names.length)return[];if(role==='admin'){const items=names.map(item=>({item_name:item,category:issueData.itemCategories?.[item]||'Other',opening_stock:Math.max(0,Number(stockData.opening?.[item])||0),minimum_stock:Math.max(0,Number(stockData.minimum?.[item])||0),is_active:true}));return check(await client.from('ppe_items').upsert(items,{onConflict:'item_name'}).select('id,item_name'))}const existing=check(await client.from('ppe_items').select('id,item_name').in('item_name',names));const found=new Set(existing.map(x=>x.item_name));const fresh=names.filter(item=>!found.has(item)).map(item=>({item_name:item,category:issueData.itemCategories?.[item]||'Other',opening_stock:0,minimum_stock:0,is_active:true}));if(fresh.length)check(await client.from('ppe_items').insert(fresh));return check(await client.from('ppe_items').select('id,item_name').in('item_name',names))}
  async function syncIssues(issueData,previous){const stock=parse(localStorage.getItem(key.stock),{opening:{},movements:[]}),items=await syncItems(issueData,stock),itemsByName=new Map(items.map(x=>[x.item_name,x.id])),oldIds=new Set((previous?.records||[]).map(r=>r.id)),rows=[];for(const r of issueData.records||[]){if(role!=='admin'&&oldIds.has(r.id))continue;const m=memberByCode(r.employeeCode)||memberByName(r.person),itemId=itemsByName.get(r.item);if(!m||!itemId)continue;rows.push({id:r.id,employee_id:m.id,item_id:itemId,issue_date:r.date,quantity:Number(r.quantity)||1,issued_by:user.id})}if(rows.length)check(await (role==='admin'?client.from('ppe_issues').upsert(rows,{onConflict:'employee_id,item_id,issue_date'}):client.from('ppe_issues').insert(rows)))}
  async function syncStock(stockData,previous){const issue=parse(localStorage.getItem(key.issue),{items:[],itemCategories:{},records:[]}),items=await syncItems(issue,stockData),itemsByName=new Map(items.map(x=>[x.item_name,x.id])),oldIds=new Set((previous?.movements||[]).map(r=>r.id)),rows=[];for(const r of stockData.movements||[]){if(role!=='admin'&&oldIds.has(r.id))continue;const itemId=itemsByName.get(r.item);if(!itemId)continue;const employee=memberByName(r.employee);rows.push({id:r.id,item_id:itemId,movement_type:r.type==='return'?'return':'received',quantity:Number(r.quantity)||1,movement_date:r.date,employee_id:employee?.id||null,note:r.note||'',recorded_by:user.id})}if(rows.length)check(await (role==='admin'?client.from('ppe_stock_movements').upsert(rows,{onConflict:'id'}):client.from('ppe_stock_movements').insert(rows)))}
  async function syncKey(name,value,previousValue){const parsed=parse(value,null),previous=parse(previousValue,null);if(!parsed)return;if(name===key.shift)return syncShift(parsed,previous);if(name===key.attendance)return syncAttendance(parsed,previous);if(name===key.leave)return syncLeave(parsed,previous);if(name===key.issue)return syncIssues(parsed,previous);if(name===key.stock)return syncStock(parsed,previous)}
  function wireStorage(){Storage.prototype.setItem=function(name,value){const tracked=this===localStorage&&Object.values(key).includes(name);const old=this.getItem(name);nativeSet.call(this,name,value);if(tracked){queue=queue.then(()=>syncKey(name,value,old)).then(()=>status('Saved to Supabase')).catch(error=>{console.error(error);status('Supabase save failed: '+(error.message||'Check connection and access'),true)})}}}
  async function boot(){
    const {data:{session}}=await client.auth.getSession();if(!session){location.replace('login.html');return false}user=session.user;
    const profile=check(await client.from('user_profiles').select('role,email,full_name,designation,page_access').eq('id',user.id).single());role=profile.role;
    const allRoles=['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager'];
    const defaults={admin:['dashboard','employee_records','employees_data','shift_board','mining_report','attendance','monthly_attendance','leave','stock_management','ppe_issue_records','stock_returns','reports','audit_log','user_management'],hr:['dashboard','employee_records','employees_data','attendance','monthly_attendance','leave','reports'],accountant:['dashboard','leave'],store:['dashboard','leave','stock_management','ppe_issue_records','stock_returns'],mechanical:['dashboard','leave'],mine_mate:['dashboard','leave','shift_board','mining_report'],foreman:['dashboard','leave','shift_board','mining_report'],project_manager:['dashboard','leave'],assistant_project_manager:['dashboard','leave']};
    pageAccess=profile.page_access&&Object.keys(profile.page_access).length?profile.page_access:Object.fromEntries((defaults[role]||['dashboard','leave']).map(key=>[key,true]));
    const page=location.pathname.split('/').pop()||'index.html';
    const pageKey={'employee-records.html':'employee_records','employees-data.html':'employees_data','attendance.html':'attendance','monthly-attendance.html':'monthly_attendance','leave.html':'leave','samaan-issue.html':'stock_management','ppe-stock.html':'stock_returns','ppe-issue-records.html':'ppe_issue_records','reports.html':'reports','mining-report.html':'mining_report','shift-dashboard.html':'shift_board','index.html':'dashboard'};
    const adminOnlyPage=['admin-users.html','audit-log.html'].includes(page);const pageDenied=adminOnlyPage?role!=='admin':role!=='admin'&&pageKey[page]&&pageAccess[pageKey[page]]!==true;
    if(pageDenied){document.body.innerHTML='<main style="max-width:600px;margin:15vh auto;padding:24px;font:16px system-ui"><h1>Access restricted</h1><p>Your account does not have access to this page. Contact an administrator if you need access.</p><button id="signout">Sign out</button></main>';document.getElementById('signout').onclick=()=>client.auth.signOut().then(()=>location.replace('login.html'));return false}
    await loadCache();wireStorage();
    renderSidebar(profile);
    if(role!=='admin')applyRoleRestrictions();
    return true;
  }
  function applyRoleRestrictions(){
    document.body.classList.add('hrdb-readonly');
    if(!document.getElementById('hrdbReadonlyStyle')){const style=document.createElement('style');style.id='hrdbReadonlyStyle';style.textContent='.hrdb-readonly-notice{margin:-18px 0 22px;padding:10px 13px;border:1px solid #eadcb6;border-radius:10px;background:#fff9e9;color:#765b20;font:600 12px system-ui}.hrdb-readonly input:disabled,.hrdb-readonly select:disabled,.hrdb-readonly textarea:disabled{opacity:.68;cursor:not-allowed}.hrdb-readonly button:disabled{opacity:.55;cursor:not-allowed}';document.head.append(style)}
    const top=document.querySelector('header.top');if(top&&!document.querySelector('.hrdb-readonly-notice')){const notice=document.createElement('div');notice.className='hrdb-readonly-notice';notice.textContent='You can add new records. Only an Admin can edit or delete saved records.';top.after(notice)}
    const apply=()=>{
      document.querySelectorAll('[data-admin-only]').forEach(element=>{element.hidden=true;element.disabled=true});
      document.querySelectorAll('[data-existing-record]').forEach(element=>{element.disabled=true});
      if(!window.HRDB.canEdit)document.querySelectorAll('#requests select.status').forEach(element=>{element.disabled=true});
      document.querySelectorAll('.row-edit,.row-delete,.delete-attendance,[data-action="edit"],[data-action="delete"]').forEach(element=>{element.disabled=true;element.hidden=true});
      document.querySelectorAll('form[data-edit-form]').forEach(form=>{form.hidden=true});
      document.querySelectorAll('button').forEach(button=>{const text=button.textContent.trim().replace(/^[^a-z]+/i,'');if(/^(edit|delete|save changes|update|approve|reject|remove)(\b|\s)/i.test(text)){button.hidden=true;button.disabled=true}});
    };
    apply();
    const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});
  }
  function renderSidebar(profile){
    if(document.querySelector('.hrdb-sidebar'))return;
    const roleLabel={admin:'Admin',hr:'HR',accountant:'Accountant',store:'Store',mechanical:'Mechanical',mine_mate:'Mine Mate',foreman:'Foreman',project_manager:'Project Manager',assistant_project_manager:'Assistant Project Manager'}[role]||role;
    const displayName=user.user_metadata?.full_name||user.user_metadata?.name||profile.full_name||profile.email||user.email||'User';
    const designation=profile.designation||user.user_metadata?.designation;
    const pages=[
      ['Dashboard','index.html',['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager']],
      ['Employee Records','employee-records.html',['admin','hr']],
      ['Employees Data','employees-data.html',['admin','hr']],
      ['Shift Board','shift-dashboard.html',['admin','mine_mate','foreman']],
      ['Mining Report','mining-report.html',['admin','mine_mate','foreman']],
      ['Attendance','attendance.html',['admin','hr']],
      ['Monthly Attendance','monthly-attendance.html',['admin','hr']],
      ['Leave','leave.html',['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager']],
      ['Stock Management','samaan-issue.html',['admin','store']],
      ['PPE Issue Records','ppe-issue-records.html',['admin','store']],
      ['Stock & Returns','ppe-stock.html',['admin','store']],
      ['Reports','reports.html',['admin','hr']]
    ];
    const style=document.createElement('style');
    style.textContent=`.hrdb-sidebar{position:fixed;z-index:10001;inset:0 auto 0 0;width:232px;padding:20px 14px;background:#123f32;color:#f5fbf7;display:flex;flex-direction:column;gap:18px;box-shadow:8px 0 28px #132a1d12;font:14px system-ui;transform:translateX(-105%);transition:transform .2s ease}.hrdb-sidebar-brand{display:flex;align-items:center;gap:10px;padding:3px 7px 16px;border-bottom:1px solid #ffffff26}.hrdb-sidebar-mark{width:38px;height:38px;border-radius:12px;background:#ffffff20;display:grid;place-items:center;font-weight:800}.hrdb-sidebar-brand strong{font-size:14px}.hrdb-sidebar-brand small{display:block;color:#c5d8ce;font-size:11px;margin-top:3px}.hrdb-side-nav{display:grid;gap:4px;overflow:auto}.hrdb-side-nav a{color:#d8e6de;text-decoration:none;padding:10px 12px;border-radius:9px;font-weight:600}.hrdb-side-nav a:hover,.hrdb-side-nav a[aria-current=page]{background:#ffffff1b;color:white}.hrdb-side-account{margin-top:auto;border-top:1px solid #ffffff26;padding:15px 7px 0}.hrdb-side-account strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:13px}.hrdb-side-account span{display:block;color:#b8d7c6;font-size:11px;margin:3px 0 12px}.hrdb-signout{width:100%;border:1px solid #ffffff45;border-radius:9px;background:transparent;color:white;padding:10px 12px;text-align:left;font:600 13px system-ui;cursor:pointer}.hrdb-signout:hover{background:#ffffff17}.hrdb-sidebar-open .hrdb-sidebar{transform:translateX(0)}.hrdb-menu-toggle{display:inline-flex;position:fixed;z-index:10002;left:12px;top:12px;width:42px;height:42px;align-items:center;justify-content:center;border:1px solid #d9e3dc;border-radius:11px;background:#fff;color:#123f32;font-size:21px;box-shadow:0 3px 12px #123f3218;cursor:pointer;transition:left .2s ease}.hrdb-sidebar-open .hrdb-menu-toggle{left:242px}.hrdb-sidebar-backdrop{position:fixed;z-index:10000;inset:0;background:#10231d75;opacity:0;pointer-events:none;transition:opacity .2s ease}.hrdb-sidebar-open .hrdb-sidebar-backdrop{opacity:1;pointer-events:auto}`;
    document.head.append(style);document.body.classList.add('hrdb-with-sidebar');
    const sidebar=document.createElement('aside');sidebar.className='hrdb-sidebar';sidebar.setAttribute('aria-label','Main menu');
    sidebar.innerHTML='<div class="hrdb-sidebar-brand"><div class="hrdb-sidebar-mark">BV</div><div><strong>BV Mining Solution</strong><small>Workforce management</small></div></div>';
    const nav=document.createElement('nav');nav.className='hrdb-side-nav';
    const current=location.pathname.split('/').pop()||'index.html';
    const pageKey={'index.html':'dashboard','employee-records.html':'employee_records','employees-data.html':'employees_data','shift-dashboard.html':'shift_board','mining-report.html':'mining_report','attendance.html':'attendance','monthly-attendance.html':'monthly_attendance','leave.html':'leave','samaan-issue.html':'stock_management','ppe-issue-records.html':'ppe_issue_records','ppe-stock.html':'stock_returns','reports.html':'reports'};
    pages.filter(([,href])=>role==='admin'||pageAccess[pageKey[href]]===true).forEach(([label,href])=>{const link=document.createElement('a');link.href=href;link.textContent=label;if(current===href)link.setAttribute('aria-current','page');nav.append(link)});
    if(role==='admin'){const approvals=document.createElement('a');approvals.href='audit-log.html';approvals.textContent='Audit Log & Approvals';if(current==='audit-log.html')approvals.setAttribute('aria-current','page');nav.append(approvals);const users=document.createElement('a');users.href='admin-users.html';users.textContent='User Management';if(current==='admin-users.html')users.setAttribute('aria-current','page');nav.append(users)}
    sidebar.append(nav);
    const account=document.createElement('div');account.className='hrdb-side-account';
    const name=document.createElement('strong');name.textContent=displayName;name.title=displayName;
    const badge=document.createElement('span');badge.textContent=designation?`${designation} · ${roleLabel}`:roleLabel;
    const button=document.createElement('button');button.type='button';button.className='hrdb-signout';button.textContent='Log out';button.setAttribute('aria-label','Log out of BV Mining Solution');
    button.onclick=async()=>{button.disabled=true;button.textContent='Logging out…';try{const{error}=await client.auth.signOut();if(error)throw error;Object.values(key).forEach(k=>nativeRemove.call(localStorage,k));location.replace('login.html')}catch(error){button.disabled=false;button.textContent='Log out';status(`Could not log out: ${error.message}`,true)}};
    account.append(name,badge,button);sidebar.append(account);document.body.prepend(sidebar);
    const toggle=document.createElement('button');toggle.className='hrdb-menu-toggle';toggle.type='button';toggle.setAttribute('aria-label','Open navigation menu');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';document.body.append(toggle);
    const backdrop=document.createElement('div');backdrop.className='hrdb-sidebar-backdrop';backdrop.setAttribute('aria-hidden','true');document.body.append(backdrop);
    const close=()=>{document.body.classList.remove('hrdb-sidebar-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation menu')};
    const open=()=>{document.body.classList.add('hrdb-sidebar-open');toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','Close navigation menu')};
    toggle.onclick=()=>toggle.getAttribute('aria-expanded')==='true'?close():open();backdrop.onclick=close;nav.addEventListener('click',e=>{if(e.target.closest('a'))close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true')close()});
  }
  window.HRDB={client,boot,status,get role(){return role},get user(){return user},get canEdit(){return role==='admin'},hasPageAccess:page=>role==='admin'||pageAccess[page]===true,flush:()=>queue};
})();
