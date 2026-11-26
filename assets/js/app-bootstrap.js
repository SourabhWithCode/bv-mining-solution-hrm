(() => {
  const client = window.hrmClient;
  let loadingOverlay;
  function showLoading(){
    if(!document.body)return;
    if(!document.getElementById('hrdbLoadingStyle')){const style=document.createElement('style');style.id='hrdbLoadingStyle';style.textContent='@keyframes hrdbSpin{to{transform:rotate(360deg)}}.hrdb-loading{position:fixed;z-index:20000;inset:0;display:grid;place-items:center;padding:24px;background:linear-gradient(145deg,#f3f7f3,#e8f0ea);transition:opacity .2s ease,visibility .2s ease}.hrdb-loading[hidden]{display:none}.hrdb-loading-card{width:min(100%,360px);padding:30px 24px;border:1px solid #e2eae4;border-radius:20px;background:#fff;text-align:center;box-shadow:0 20px 65px #123f3214;font:14px system-ui;color:#17211e}.hrdb-loading-mark{width:42px;height:42px;display:grid;place-items:center;margin:0 auto 15px;border-radius:14px;background:linear-gradient(145deg,#176b52,#123f32);color:white;font-weight:800}.hrdb-loading-spinner{width:30px;height:30px;margin:0 auto 14px;border:3px solid #dce9e0;border-top-color:#176b52;border-radius:50%;animation:hrdbSpin .8s linear infinite}.hrdb-loading-title{font-weight:700;font-size:15px}.hrdb-loading-copy{margin-top:5px;color:#78837e;font-size:12px}';document.head.append(style)}
    if(!loadingOverlay){loadingOverlay=document.createElement('div');loadingOverlay.id='hrdbLoadingScreen';loadingOverlay.className='hrdb-loading';loadingOverlay.setAttribute('role','status');loadingOverlay.setAttribute('aria-live','polite');loadingOverlay.innerHTML='<div class="hrdb-loading-card"><div class="hrdb-loading-mark">BV</div><div class="hrdb-loading-spinner" aria-hidden="true"></div><div class="hrdb-loading-title">Loading BV Mining Solution</div><div class="hrdb-loading-copy">Preparing your workspace…</div></div>';document.body.append(loadingOverlay)}
    loadingOverlay.hidden=false;
  }
  function hideLoading(){if(loadingOverlay)loadingOverlay.hidden=true}
  showLoading();
  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;
  const key = { shift:'shift-board-v1', attendance:'hr-attendance-v1', leave:'hr-leave-v1', issue:'hr-item-issues-v1', stock:'hr-ppe-stock-v1' };
  const fields = ['employeeCode','employeeNameAadhaar','firstName','surname','gender','fatherName','spouseName','dob','nationality','educationLevel','dojDcs','designation','department','categoryAddressHs','employmentType','employmentStatus','mobile','uanNumber','pan','esic','ip','lwf','aadhaar','bankAccount','bank','branchIfsc','presentAddress','permanentAddress','identificationMark','tokenNumber','firstAppointmentOwner','ageFitnessCertificate','medical','placeOfEmployment','vocationalTrainingNumber','vocationalTrainingDate','vocationalTrainingExpiryDate','nominee','nomineeAddress','emergencyContactName','emergencyContactRelation','emergencyContactAddress','emergencyContactNumber','remarks','location','bloodGroup','medicalDate','medicalExpiryDate','vtBasic','vtSpecial','authorisation','authorisationDate','authorisationExpiryDate','newAppointments','addressCategory'];
  const dateFields = new Set(['dob','dojDcs','firstAppointmentOwner','vocationalTrainingDate','vocationalTrainingExpiryDate','medicalDate','medicalExpiryDate','authorisationDate','authorisationExpiryDate']);
  const snake = value => value.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase());
  const parse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
  const setCache = (name, value) => nativeSet.call(localStorage, name, JSON.stringify(value));
  const outboxKey='hr-offline-outbox-v1', miningOutboxKey='hr-offline-mining-reports-v1', databaseOutboxKey='hr-offline-database-ops-v1', profileCacheKey='hr-user-profile-cache-v1', onlineBaselineKey='hr-online-data-baseline-v1';
  let offlineIndicator=null,retryTimer=null,retrying=false,deviceSessionId='',deviceSessionInvalidated=false,deviceSessionTimer=null,deviceSessionCheckBusy=false;
  const readOutbox=()=>parse(localStorage.getItem(outboxKey),[]);
  const writeOutbox=value=>nativeSet.call(localStorage,outboxKey,JSON.stringify(value));
  const readMiningOutbox=()=>parse(localStorage.getItem(miningOutboxKey),[]);
  const writeMiningOutbox=value=>nativeSet.call(localStorage,miningOutboxKey,JSON.stringify(value));
  const readDatabaseOutbox=()=>parse(localStorage.getItem(databaseOutboxKey),[]);
  const writeDatabaseOutbox=value=>nativeSet.call(localStorage,databaseOutboxKey,JSON.stringify(value));
  function pendingCount(){return readOutbox().filter(job=>job.ownerId===user?.id).length+readMiningOutbox().filter(job=>job.ownerId===user?.id).length+readDatabaseOutbox().filter(job=>job.ownerId===user?.id).length}
  function hasOtherAccountPending(){return [...readOutbox(),...readMiningOutbox(),...readDatabaseOutbox()].some(job=>job.ownerId&&job.ownerId!==user?.id)}
  function renderSyncIndicator(){
    if(!document.body)return;
    if(!offlineIndicator){offlineIndicator=document.createElement('section');offlineIndicator.id='hrdbOfflineSync';offlineIndicator.className='hrdb-offline-sync';offlineIndicator.setAttribute('aria-label','Offline sync status');offlineIndicator.innerHTML='<span class="hrdb-sync-label" aria-live="polite"></span><button type="button" class="hrdb-sync-retry">Sync now</button>';offlineIndicator.querySelector('button').addEventListener('click',()=>{reconcileTrackedChanges();if(!pendingCount())status('No offline changes are waiting to sync.');retryPending()});document.querySelector('.hrdb-side-nav')?.after(offlineIndicator);if(!offlineIndicator.isConnected)document.body.append(offlineIndicator)}
    if(!offlineIndicator.closest('.hrdb-sidebar'))document.querySelector('.hrdb-side-nav')?.after(offlineIndicator);
    const count=pendingCount(),label=offlineIndicator.querySelector('.hrdb-sync-label'),button=offlineIndicator.querySelector('button');
    const otherAccount=hasOtherAccountPending();offlineIndicator.hidden=false;
    label.textContent=otherAccount&&count===0?'Pending changes belong to another account':!navigator.onLine?`${count?count+' pending change'+(count===1?'':'s')+' · ':''}Offline · saved on this device`:retrying?'Syncing saved changes…':lastSyncError?`Sync needs attention · ${count} change${count===1?'':'s'} pending`:count?`${count} change${count===1?'':'s'} waiting to sync`:'All changes synced';offlineIndicator.title=lastSyncError?.message||'';
    button.disabled=!navigator.onLine||retrying||(otherAccount&&count===0);button.textContent=retrying?'Syncing…':count?'Retry sync':'Check sync';button.style.opacity=button.disabled?'.65':'1';
  }
  function rememberStorageChange(name,value,previousValue){
    const items=readOutbox(),id=`storage:${user.id}:${name}`,existing=items.find(item=>item.id===id),job={id,type:'storage',ownerId:user.id,key:name,value,previousValue:existing?existing.previousValue:previousValue,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),revision:crypto.randomUUID(),attempts:existing?.attempts||0};
    if(existing)Object.assign(existing,job);else items.push(job);writeOutbox(items);renderSyncIndicator();return job;
  }
  function reconcileTrackedChanges(){
    if(!user||!navigator.onLine)return;
    const baseline=parse(localStorage.getItem(onlineBaselineKey),{});
    for(const name of Object.values(key)){
      const value=localStorage.getItem(name),previousValue=baseline[name];
      if(value!==null&&typeof previousValue==='string'&&value!==previousValue)rememberStorageChange(name,value,previousValue);
    }
  }
  function saveOnlineBaseline(name,value){const baseline=parse(localStorage.getItem(onlineBaselineKey),{});baseline[name]=value;nativeSet.call(localStorage,onlineBaselineKey,JSON.stringify(baseline))}
  function isNetworkError(error){return !navigator.onLine||/failed to fetch|networkerror|network request failed|fetch failed|load failed|offline/i.test(String(error?.message||error||''))}
  const deviceSessionKey=userId=>`bv-active-device-session:${userId}`;
  async function claimActiveDeviceSession(){
    if(!user||!navigator.onLine)return false;
    const keyName=deviceSessionKey(user.id),candidate=deviceSessionId||localStorage.getItem(keyName)||crypto.randomUUID(),{error}=await client.rpc('claim_active_device_session',{p_session_id:candidate});
    if(error)throw error;deviceSessionId=candidate;deviceSessionInvalidated=false;nativeSet.call(localStorage,keyName,candidate);return true;
  }
  async function invalidateDeviceSession(){
    if(deviceSessionInvalidated)return;deviceSessionInvalidated=true;clearInterval(deviceSessionTimer);status('This account was signed in on another device. Signing out…',true);
    try{await client.auth.signOut()}finally{location.replace('login.html?reason=session-replaced')}
  }
  async function verifyActiveDeviceSession(){
    if(deviceSessionInvalidated)return false;if(!navigator.onLine)return Boolean(deviceSessionId);
    if(!deviceSessionId)return claimActiveDeviceSession();
    if(deviceSessionCheckBusy)return true;deviceSessionCheckBusy=true;
    try{const{data,error}=await client.rpc('is_active_device_session',{p_session_id:deviceSessionId});if(error){if(isNetworkError(error))return true;throw error}if(data!==true){await invalidateDeviceSession();return false}return true}
    finally{deviceSessionCheckBusy=false}
  }
  function startDeviceSessionGuard(){
    clearInterval(deviceSessionTimer);deviceSessionTimer=setInterval(()=>verifyActiveDeviceSession().catch(error=>console.warn('Device session check failed:',error)),10000);
    window.addEventListener('online',()=>verifyActiveDeviceSession().catch(error=>console.warn('Device session check failed:',error)));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)verifyActiveDeviceSession().catch(error=>console.warn('Device session check failed:',error))});
  }
  async function releaseActiveDeviceSession(){if(!deviceSessionId||!navigator.onLine)return;try{await client.rpc('release_active_device_session',{p_session_id:deviceSessionId})}catch(error){console.warn('Device session release failed:',error)}}
  function scheduleRetry(attempts=0){if(retryTimer||!navigator.onLine||!pendingCount())return;const delay=Math.min(300000,5000*(2**Math.min(attempts,6)));retryTimer=setTimeout(()=>{retryTimer=null;retryPending()},delay)}
  function restorePendingCaches(){for(const job of readOutbox())if(job.ownerId===user?.id&&job.type==='storage'&&job.key&&job.value)nativeSet.call(localStorage,job.key,job.value)}
  function restorePendingDatabaseOps(){
    const state=parse(localStorage.getItem(key.shift),{members:[],schedule:{}}),members=state.members||[];
    for(const operation of readDatabaseOutbox().filter(job=>job.ownerId===user?.id)){
      const id=operation.recordId||operation.args?.p_employee_id,member=members.find(row=>String(row.id)===String(id));if(!member)continue;
      if(operation.table==='employees'&&operation.action==='delete'){state.members=members.filter(row=>String(row.id)!==String(id));continue}
      if(operation.table==='employees'&&operation.action==='update'){
        for(const field of fields){const column=field==='employeeNameAadhaar'?'employee_name':snake(field);if(Object.hasOwn(operation.payload||{},column))member[field]=operation.payload[column]??''}
        if(Object.hasOwn(operation.payload||{},'employment_status'))member.employmentStatus=operation.payload.employment_status;
        if(Object.hasOwn(operation.payload||{},'is_active'))member.isActive=operation.payload.is_active;
        member.empCode=member.employeeCode||'';member.name=member.employeeNameAadhaar||[member.firstName,member.surname].filter(Boolean).join(' ')||member.empCode||`Employee ${member.srNo||''}`;
      }
      if(operation.action==='rpc'&&operation.name==='set_employee_status'){member.employmentStatus=operation.args.p_status;member.isActive=!['Suspended','Resigned'].includes(member.employmentStatus)}
    }
    state.overtime=state.overtime||{};
    for(const operation of readDatabaseOutbox().filter(job=>job.ownerId===user?.id&&job.table==='overtime_entries'&&job.action==='update')){
      const date=operation.match?.work_date,id=operation.match?.employee_id;if(!date||!id)continue;state.overtime[date]=state.overtime[date]||{};state.overtime[date][id]={...(state.overtime[date][id]||{}),hours:Number(state.overtime[date][id]?.hours)||0,reason:state.overtime[date][id]?.reason||'',approvalStatus:operation.payload.approval_status||'Pending',approvedBy:operation.payload.approved_by||'',approvedAt:operation.payload.approved_at||''};
    }
    setCache(key.shift,state);
  }
  function registerOfflineShell(){if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))navigator.serviceWorker.register('service-worker.js').catch(error=>console.warn('Offline app shell could not be cached:',error))}
  async function syncMiningOperation(operation){
    if(operation.type==='insert'){
      const existing=check(await client.from('mining_reports').select('id').eq('id',operation.recordId).maybeSingle());
      if(existing)return;
      check(await client.from('mining_reports').insert({...operation.payload,id:operation.recordId}));return;
    }
    const result=check(await client.from('mining_reports').update(operation.payload).eq('id',operation.recordId).select('id').single());if(!result)throw new Error('Mining Report was not updated. It may be outside the 24-hour edit window.');
  }
  async function syncDatabaseOperation(operation){
    if(operation.action==='rpc'&&operation.name==='set_employee_status'){
      const current=check(await client.from('employees').select('employment_status').eq('id',operation.args.p_employee_id).single()),target=operation.args.p_status;
      if(current.employment_status===target)return;
      if(current.employment_status!==operation.expectedStatus)throw new Error('Employee status changed elsewhere while offline. Review the current status before retrying.');
      const{error}=await client.rpc(operation.name,operation.args);if(error)throw error;return;
    }
    const table=operation.table;if(!['employees','employee_warnings','overtime_entries'].includes(table))throw new Error('This offline database action is not supported.');
    if(operation.action==='insert'){
      const existing=check(await client.from(table).select('id').eq('id',operation.recordId).maybeSingle());if(existing)return;
      const{error}=await client.from(table).insert({...operation.payload,id:operation.recordId});if(error&&error.code!=='23505')throw error;return;
    }
    if(operation.action==='update'){
      let query=client.from(table).update(operation.payload);if(operation.match)for(const[column,value]of Object.entries(operation.match))query=query.eq(column,value);else query=query.eq('id',operation.recordId);const result=check(await query.select('id').single());if(!result)throw new Error('The record was not updated. Check its permissions.');return;
    }
    if(operation.action==='delete'){
      const existing=check(await client.from(table).select('id').eq('id',operation.recordId).maybeSingle());if(!existing)return;
      check(await client.from(table).delete().eq('id',operation.recordId).select('id').single());return;
    }
    throw new Error('Unsupported offline database action.');
  }
  async function retryPending(){
    if(retrying||deviceSessionInvalidated)return false;
    if(!navigator.onLine){lastSyncError=new Error('Device is offline. Changes are saved on this device and will retry when online.');renderSyncIndicator();return false}
    if(pendingCount()&&!(await verifyActiveDeviceSession()))return false;
    retrying=true;lastSyncError=null;renderSyncIndicator();
    let activeJob=null;
    try{
      while(true){
        const timeline=[...readOutbox().filter(job=>job.ownerId===user?.id).map(job=>({...job,_queue:'storage'})),...readMiningOutbox().filter(job=>job.ownerId===user?.id).map(job=>({...job,_queue:'mining'})),...readDatabaseOutbox().filter(job=>job.ownerId===user?.id).map(job=>({...job,_queue:'database'}))].sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
        if(!timeline.length)break;
        const job=activeJob=timeline[0];
        if(job._queue==='storage'){
          const data=parse(job.value,null),previous=parse(job.previousValue,null);if(data)await syncKey(job.key,data,previous);saveOnlineBaseline(job.key,job.value);
          const items=readOutbox(),current=items.find(item=>item.id===job.id);
          if(current?.revision===job.revision)writeOutbox(items.filter(item=>item.id!==job.id));
        }else if(job._queue==='mining'){
          await syncMiningOperation(job);
          const items=readMiningOutbox();writeMiningOutbox(items.filter(item=>item.id!==job.id));
        }else{
          await syncDatabaseOperation(job);
          const items=readDatabaseOutbox();writeDatabaseOutbox(items.filter(item=>item.id!==job.id));
        }
      }
      lastSyncError=null;return true;
    }catch(error){
      lastSyncError=error;
      const items=readOutbox(),job=items.find(item=>item.id===activeJob?.id);
      if(job){job.attempts=(job.attempts||0)+1;job.error=error.message||String(error);writeOutbox(items)}
      const mine=readMiningOutbox(),mineJob=mine.find(item=>item.id===activeJob?.id);if(mineJob){mineJob.attempts=(mineJob.attempts||0)+1;mineJob.error=error.message||String(error);writeMiningOutbox(mine)}
      const db=readDatabaseOutbox(),dbJob=db.find(item=>item.id===activeJob?.id);if(dbJob){dbJob.attempts=(dbJob.attempts||0)+1;dbJob.error=error.message||String(error);writeDatabaseOutbox(db)}
      console.error(error);status(`Sync pending: ${error.message||'Check your network and access.'}`,true);scheduleRetry(job?.attempts||mineJob?.attempts||dbJob?.attempts||0);return false;
    }finally{retrying=false;renderSyncIndicator()}
  }
  function queueMiningReport(operation){
    const items=readMiningOutbox(),existing=items.find(item=>item.recordId===operation.recordId&&item.ownerId===user?.id);
    const job={id:existing?.id||operation.recordId,type:existing?.type==='insert'?'insert':operation.type,ownerId:user.id,recordId:operation.recordId,payload:{...(existing?.payload||{}),...operation.payload},createdAt:existing?.createdAt||new Date().toISOString(),attempts:existing?.attempts||0};
    if(existing)Object.assign(existing,job);else items.push(job);writeMiningOutbox(items);renderSyncIndicator();
    queue=queue.then(()=>retryPending());return job;
  }
  function queueDatabaseWrite(operation){
    const items=readDatabaseOutbox(),matchKey=Object.entries(operation.match||{}).map(([field,value])=>`${field}:${value}`).join(':'),id=operation.action==='rpc'?`rpc:${operation.name}:${operation.args.p_employee_id}`:`${operation.table}:${operation.action}:${operation.recordId||matchKey}`,existing=items.find(item=>item.id===id&&item.ownerId===user?.id);
    const job={...existing,...operation,id,ownerId:user.id,createdAt:existing?.createdAt||new Date().toISOString(),attempts:existing?.attempts||0,expectedStatus:existing?.expectedStatus??operation.expectedStatus};if(existing)Object.assign(existing,job);else items.push(job);writeDatabaseOutbox(items);renderSyncIndicator();queue=queue.then(()=>retryPending());return job;
  }
  const status = (message, error=false) => {
    let el=document.getElementById('hrdbStatus');
    if(!el){el=document.createElement('div');el.id='hrdbStatus';el.style.cssText='position:fixed;z-index:9999;left:12px;right:12px;bottom:12px;max-width:760px;margin:auto;padding:10px 14px;border-radius:10px;background:#173d30;color:white;font:13px system-ui;box-shadow:0 8px 30px #0002';document.body.appendChild(el)}
    el.style.background=error?'#982f27':'#173d30';el.textContent=message;el.hidden=false;clearTimeout(el._timer);if(!error)el._timer=setTimeout(()=>{el.hidden=true},2200);
  };
  const check = result => { if(result.error) throw result.error; return result.data; };
  let role='', user=null, employeeRows=[], queue=Promise.resolve(), pageAccess={}, lastSyncError=null;
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
  async function confirmRows(query,count,label){const result=check(await query.select('*'));if((result||[]).length!==count)throw new Error(`${label} was not confirmed by Supabase. Check access and retry.`)}
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
    const onlineBaseline=Object.fromEntries(Object.values(key).map(name=>[name,localStorage.getItem(name)]));nativeSet.call(localStorage,onlineBaselineKey,JSON.stringify(onlineBaseline));
  }
  const membersNow=()=>parse(localStorage.getItem(key.shift),{members:[]}).members||[];
  const memberByCode=(code)=>membersNow().find(m=>String(m.employeeCode||m.empCode||'').trim().toLowerCase()===String(code||'').trim().toLowerCase());
  const memberByName=(name)=>membersNow().find(m=>String(m.name||m.employeeNameAadhaar||'').trim().toLowerCase()===String(name||'').trim().toLowerCase());
  async function omitExisting(table,rows,columns,compareColumns=[]){if(!rows.length)return rows;const selected=[...new Set([...columns,...compareColumns])];let query=client.from(table).select(selected.join(','));for(const column of columns)query=query.in(column,[...new Set(rows.map(row=>row[column]).filter(value=>value!==null&&value!==undefined))]);const existing=check(await query),keyOf=row=>columns.map(column=>String(row[column])).join('\u001f'),byKey=new Map((existing||[]).map(row=>[keyOf(row),row]));for(const row of rows){const found=byKey.get(keyOf(row));if(found&&compareColumns.some(column=>String(found[column]??'')!==String(row[column]??'')))throw new Error(`Offline sync conflict in ${table}: a record with the same key already has different data. Review it online before retrying.`)}return rows.filter(row=>!byKey.has(keyOf(row)))}
  async function syncEmployees(state,previous){if(!pageAccess.employee_records)return;const oldIds=new Set((previous?.members||[]).map(m=>m.id));let rows=cleanRows((state.members||[]).filter(m=>role==='admin'||!oldIds.has(m.id)).map(member=>{const row=employeeRow(member);if(role==='admin'&&oldIds.has(member.id)){delete row.employment_status;delete row.is_active}return row}));if(role!=='admin')rows=await omitExisting('employees',rows,['id']);if(rows.length)await confirmRows(role==='admin'?client.from('employees').upsert(rows,{onConflict:'id'}):client.from('employees').insert(rows),rows.length,'Employee records')}
  async function syncShift(state,previous){
    await syncEmployees(state,previous);
    const assignments=[];Object.entries(state.schedule||{}).forEach(([date,entries])=>Object.entries(entries||{}).forEach(([employeeId,shift])=>{if(role!=='admin'&&Object.hasOwn(previous?.schedule?.[date]||{},employeeId))return;assignments.push({employee_id:employeeId,work_date:date,shift,updated_by:user.id,updated_at:new Date().toISOString()})}));
    const missingAssignments=role==='admin'?assignments:await omitExisting('shift_assignments',assignments,['employee_id','work_date'],['shift']);if(missingAssignments.length)await confirmRows(role==='admin'?client.from('shift_assignments').upsert(missingAssignments,{onConflict:'employee_id,work_date'}):client.from('shift_assignments').insert(missingAssignments),missingAssignments.length,'Shift assignments');
    const ot=[];Object.entries(state.overtime||{}).forEach(([date,entries])=>Object.entries(entries||{}).forEach(([employeeId,value])=>{if(Number(value?.hours)>0&&(role==='admin'||!Object.hasOwn(previous?.overtime?.[date]||{},employeeId)))ot.push({employee_id:employeeId,work_date:date,hours:Number(value.hours),reason:value.reason||'',approval_status:value.approvalStatus||'Pending',approved_by:role==='admin'?(value.approvedBy||null):null,approved_at:role==='admin'?(value.approvedAt||null):null,recorded_by:value.recordedBy||user.id,updated_at:new Date().toISOString()})}));
    const missingOt=role==='admin'?ot:await omitExisting('overtime_entries',ot,['employee_id','work_date'],['hours','reason']);if(missingOt.length)await confirmRows(role==='admin'?client.from('overtime_entries').upsert(missingOt,{onConflict:'employee_id,work_date'}):client.from('overtime_entries').insert(missingOt),missingOt.length,'Overtime entries');
    if(role==='admin')for(const [date,entries] of Object.entries(previous?.overtime||{}))for(const employeeId of Object.keys(entries||{}))if(!Number(state.overtime?.[date]?.[employeeId]?.hours))check(await client.from('overtime_entries').delete().eq('employee_id',employeeId).eq('work_date',date));
  }
  async function syncAttendance(state,previous){const rows=[],rowKeys=new Set();Object.entries(state.days||{}).forEach(([date,entries])=>Object.entries(entries||{}).forEach(([employeeId,statusValue])=>{if(role!=='admin'&&(Object.hasOwn(previous?.days?.[date]||{},employeeId)||Object.hasOwn(previous?.manualClear?.[date]||{},employeeId)))return;rows.push({employee_id:employeeId,attendance_date:date,status:statusValue,updated_by:user.id,updated_at:new Date().toISOString()});rowKeys.add(`${date}:${employeeId}`)}));Object.entries(state.manualClear||{}).forEach(([date,entries])=>Object.keys(entries||{}).forEach(employeeId=>{const k=`${date}:${employeeId}`;if(rowKeys.has(k)||role!=='admin'&&(Object.hasOwn(previous?.days?.[date]||{},employeeId)||Object.hasOwn(previous?.manualClear?.[date]||{},employeeId)))return;rows.push({employee_id:employeeId,attendance_date:date,status:null,updated_by:user.id,updated_at:new Date().toISOString()});rowKeys.add(k)}));const missingRows=role==='admin'?rows:await omitExisting('attendance',rows,['employee_id','attendance_date'],['status']);if(missingRows.length)await confirmRows(role==='admin'?client.from('attendance').upsert(missingRows,{onConflict:'employee_id,attendance_date'}):client.from('attendance').insert(missingRows),missingRows.length,'Attendance records');if(role==='admin')for(const source of [previous?.days,previous?.manualClear])for(const [date,entries] of Object.entries(source||{}))for(const employeeId of Object.keys(entries||{}))if(!state.days?.[date]?.[employeeId]&&!state.manualClear?.[date]?.[employeeId])check(await client.from('attendance').delete().eq('employee_id',employeeId).eq('attendance_date',date))}
  async function syncLeave(records,previous){const oldRows=new Map((previous||[]).map(r=>[r.id,r])),newRows=new Map((records||[]).map(r=>[r.id,r]));for(const r of records||[]){const old=oldRows.get(r.id);if(old){const isOwner=old.submittedBy===user.id;if(role==='director'){if(isOwner){if(old.status==='Pending'&&old.status===r.status&&(old.employee!==r.employee||old.type!==r.type||old.start!==r.start||old.end!==r.end||old.reason!==r.reason)){const m=memberByName(r.employee)||(r.employeeCode&&memberByCode(r.employeeCode));if(m)check(await client.from('leave_requests').update({employee_id:m.id,leave_type:r.type,start_date:r.start,end_date:r.end,reason:r.reason||'',updated_at:new Date().toISOString()}).eq('id',r.id).select('id').single())}}else if(old.status!==r.status)check(await client.from('leave_requests').update({status:r.status,updated_at:new Date().toISOString()}).eq('id',r.id).select('id').single());continue}if(role==='admin'){const m=memberByName(r.employee)||(r.employeeCode&&memberByCode(r.employeeCode));if(!m)continue;const row={id:r.id,employee_id:m.id,leave_type:r.type,start_date:r.start,end_date:r.end,reason:r.reason||'',status:r.status||'Pending',submitted_by:r.submittedBy||user.id,updated_at:new Date().toISOString()};await confirmRows(client.from('leave_requests').upsert(row,{onConflict:'id'}),1,'Leave request');continue}if(isOwner&&old.status==='Pending'&&old.status===r.status&&(old.employee!==r.employee||old.type!==r.type||old.start!==r.start||old.end!==r.end||old.reason!==r.reason)){const m=memberByName(r.employee)||(r.employeeCode&&memberByCode(r.employeeCode));if(m)check(await client.from('leave_requests').update({employee_id:m.id,leave_type:r.type,start_date:r.start,end_date:r.end,reason:r.reason||'',updated_at:new Date().toISOString()}).eq('id',r.id).select('id').single())}continue}const m=memberByName(r.employee)||(r.employeeCode&&memberByCode(r.employeeCode));if(!m)continue;const row={id:r.id,employee_id:m.id,leave_type:r.type,start_date:r.start,end_date:r.end,reason:r.reason||'',status:r.status||'Pending',submitted_by:r.submittedBy||user.id,updated_at:new Date().toISOString()};const existing=check(await client.from('leave_requests').select('id').eq('id',r.id).maybeSingle());if(!existing)await confirmRows(client.from('leave_requests').insert(row),1,'Leave request')}for(const old of previous||[])if(!newRows.has(old.id)&&(role==='admin'||(old.submittedBy===user.id&&old.status==='Pending')))check(await client.from('leave_requests').delete().eq('id',old.id))}
  async function syncItems(issueData,stockData){const names=issueData.items||[];if(!names.length)return[];if(role==='admin'){const items=names.map(item=>({item_name:item,category:issueData.itemCategories?.[item]||'Other',opening_stock:Math.max(0,Number(stockData.opening?.[item])||0),minimum_stock:Math.max(0,Number(stockData.minimum?.[item])||0),is_active:true}));const saved=check(await client.from('ppe_items').upsert(items,{onConflict:'item_name'}).select('id,item_name'));if(saved.length!==items.length)throw new Error('PPE items were not confirmed by Supabase.');return saved}const existing=check(await client.from('ppe_items').select('id,item_name').in('item_name',names));const found=new Set(existing.map(x=>x.item_name));const fresh=names.filter(item=>!found.has(item)).map(item=>({item_name:item,category:issueData.itemCategories?.[item]||'Other',opening_stock:0,minimum_stock:0,is_active:true}));if(fresh.length)await confirmRows(client.from('ppe_items').insert(fresh),fresh.length,'PPE items');const saved=check(await client.from('ppe_items').select('id,item_name').in('item_name',names));if(saved.length!==names.length)throw new Error('PPE items were not confirmed by Supabase.');return saved}
  async function syncIssues(issueData,previous){const stock=parse(localStorage.getItem(key.stock),{opening:{},movements:[]}),items=await syncItems(issueData,stock),itemsByName=new Map(items.map(x=>[x.item_name,x.id])),oldIds=new Set((previous?.records||[]).map(r=>r.id)),rows=[];for(const r of issueData.records||[]){if(role!=='admin'&&oldIds.has(r.id))continue;const m=memberByCode(r.employeeCode)||memberByName(r.person),itemId=itemsByName.get(r.item);if(!m||!itemId)continue;rows.push({id:r.id,employee_id:m.id,item_id:itemId,issue_date:r.date,quantity:Number(r.quantity)||1,issued_by:user.id})}const missingRows=role==='admin'?rows:await omitExisting('ppe_issues',rows,['employee_id','item_id','issue_date'],['quantity']);if(missingRows.length)await confirmRows(role==='admin'?client.from('ppe_issues').upsert(missingRows,{onConflict:'employee_id,item_id,issue_date'}):client.from('ppe_issues').insert(missingRows),missingRows.length,'PPE issues')}
  async function syncStock(stockData,previous){const issue=parse(localStorage.getItem(key.issue),{items:[],itemCategories:{},records:[]}),items=await syncItems(issue,stockData),itemsByName=new Map(items.map(x=>[x.item_name,x.id])),oldIds=new Set((previous?.movements||[]).map(r=>r.id)),rows=[];for(const r of stockData.movements||[]){if(role!=='admin'&&oldIds.has(r.id))continue;const itemId=itemsByName.get(r.item);if(!itemId)continue;const employee=memberByName(r.employee);rows.push({id:r.id,item_id:itemId,movement_type:r.type==='return'?'return':'received',quantity:Number(r.quantity)||1,movement_date:r.date,employee_id:employee?.id||null,note:r.note||'',recorded_by:user.id})}const missingRows=role==='admin'?rows:await omitExisting('ppe_stock_movements',rows,['id'],['item_id','movement_type','quantity','movement_date','employee_id','note']);if(missingRows.length)await confirmRows(role==='admin'?client.from('ppe_stock_movements').upsert(missingRows,{onConflict:'id'}):client.from('ppe_stock_movements').insert(missingRows),missingRows.length,'Stock movements')}
  async function syncKey(name,value,previousValue){const parsed=parse(value,null),previous=parse(previousValue,null);if(!parsed)return;if(name===key.shift)return syncShift(parsed,previous);if(name===key.attendance)return syncAttendance(parsed,previous);if(name===key.leave)return syncLeave(parsed,previous);if(name===key.issue)return syncIssues(parsed,previous);if(name===key.stock)return syncStock(parsed,previous)}
  function wireStorage(){Storage.prototype.setItem=function(name,value){const tracked=this===localStorage&&Object.values(key).includes(name);const old=this.getItem(name);nativeSet.call(this,name,value);if(tracked){rememberStorageChange(name,value,old);lastSyncError=null;queue=queue.then(async()=>{if(await retryPending())status('Saved to Supabase')}).catch(error=>{lastSyncError=error;console.error(error);status('Sync pending: '+(error.message||'Check connection and access.'),true);renderSyncIndicator()})}}}
  async function boot(){
    showLoading();
    try{
      const {data:{session}}=await client.auth.getSession();if(!session){hideLoading();location.replace('login.html');return false}user=session.user;deviceSessionId=localStorage.getItem(deviceSessionKey(user.id))||'';
      if(navigator.onLine){try{if(deviceSessionId){if(!(await verifyActiveDeviceSession()))return false}else await claimActiveDeviceSession()}catch(error){if(!isNetworkError(error))throw error;status('Cannot verify this device session while offline. It will be checked when the connection returns.',true)}}
      let profile;
      try{profile=check(await client.from('user_profiles').select('role,email,full_name,designation,page_access').eq('id',user.id).single());nativeSet.call(localStorage,profileCacheKey,JSON.stringify({userId:user.id,profile}))}
      catch(error){const cached=parse(localStorage.getItem(profileCacheKey),null);if(!cached||cached.userId!==user.id||!isNetworkError(error))throw error;profile=cached.profile;status('Offline mode: using the last saved account permissions.',true)}
      role=profile.role;
      const allRoles=['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager','director'];
      const defaults={admin:['dashboard','employee_records','employees_data','shift_board','mining_report','attendance','monthly_attendance','leave','stock_management','ppe_issue_records','stock_returns','reports','accounting','audit_log','user_management'],hr:['dashboard','employee_records','employees_data','attendance','monthly_attendance','leave','reports','accounting'],accountant:['dashboard','leave','accounting'],store:['dashboard','leave','stock_management','ppe_issue_records','stock_returns'],mechanical:['dashboard','leave'],mine_mate:['dashboard','leave','shift_board','mining_report'],foreman:['dashboard','leave','shift_board','mining_report'],project_manager:['dashboard','leave'],assistant_project_manager:['dashboard','leave'],director:['dashboard','leave','accounting']};
      pageAccess=profile.page_access&&Object.keys(profile.page_access).length?profile.page_access:Object.fromEntries((defaults[role]||['dashboard','leave']).map(key=>[key,true]));
      const page=location.pathname.split('/').pop()||'index.html';
      const pageKey={'employee-records.html':'employee_records','employees-data.html':'employees_data','attendance.html':'attendance','monthly-attendance.html':'monthly_attendance','leave.html':'leave','samaan-issue.html':'stock_management','ppe-stock.html':'stock_returns','ppe-issue-records.html':'ppe_issue_records','reports.html':'reports','accounting.html':'accounting','payroll.html':'accounting','financial-reports.html':'accounting','mining-report.html':'mining_report','shift-dashboard.html':'shift_board','index.html':'dashboard'};
      const adminOnlyPage=['admin-users.html','audit-log.html'].includes(page);const pageDenied=adminOnlyPage?role!=='admin':role!=='admin'&&pageKey[page]&&pageAccess[pageKey[page]]!==true;
      if(pageDenied){hideLoading();location.replace('404.html?reason=restricted');return false}
      registerOfflineShell();
      try{await loadCache()}
      catch(error){const hasLocalData=Object.values(key).some(name=>localStorage.getItem(name)!==null)||pendingCount()>0;if(!hasLocalData||!isNetworkError(error))throw error;status('Offline mode: showing saved data on this device.',true)}
      restorePendingCaches();restorePendingDatabaseOps();wireStorage();
      renderSidebar(profile);
      if(role!=='admin'&&!['accounting.html','payroll.html','financial-reports.html'].includes(page))applyRoleRestrictions();
      startDeviceSessionGuard();renderSyncIndicator();window.addEventListener('offline',renderSyncIndicator);window.addEventListener('online',()=>{reconcileTrackedChanges();renderSyncIndicator();queue=queue.then(async()=>{if(await verifyActiveDeviceSession())await retryPending()})});
      reconcileTrackedChanges();
      if(navigator.onLine&&pendingCount())queue=queue.then(()=>retryPending());
      hideLoading();
      return true;
    }catch(error){hideLoading();throw error}
  }
  function applyRoleRestrictions(){
    document.body.classList.add('hrdb-readonly');
    if(!document.getElementById('hrdbReadonlyStyle')){const style=document.createElement('style');style.id='hrdbReadonlyStyle';style.textContent='.hrdb-readonly-notice{margin:-18px 0 22px;padding:10px 13px;border:1px solid #eadcb6;border-radius:10px;background:#fff9e9;color:#765b20;font:600 12px system-ui}.hrdb-readonly input:disabled,.hrdb-readonly select:disabled,.hrdb-readonly textarea:disabled{opacity:.68;cursor:not-allowed}.hrdb-readonly button:disabled{opacity:.55;cursor:not-allowed}';document.head.append(style)}
    const top=document.querySelector('header.top');if(top&&!document.querySelector('.hrdb-readonly-notice')){const notice=document.createElement('div');notice.className='hrdb-readonly-notice';notice.textContent='You can add new records. Only an Admin can edit or delete saved records.';top.after(notice)}
    const apply=()=>{
      document.querySelectorAll('[data-admin-only]').forEach(element=>{element.hidden=true;element.disabled=true});
      document.querySelectorAll('[data-existing-record]').forEach(element=>{element.disabled=true});
      if(!window.HRDB.canApprove)document.querySelectorAll('#requests select.status').forEach(element=>{element.disabled=true});
      document.querySelectorAll('.row-edit,.row-delete,.delete-attendance,[data-action="edit"]:not([data-owner-action]),[data-action="delete"]:not([data-owner-action])').forEach(element=>{element.disabled=true;element.hidden=true});
      document.querySelectorAll('form[data-edit-form]').forEach(form=>{form.hidden=true});
      document.querySelectorAll('button').forEach(button=>{if(button.hasAttribute('data-owner-action'))return;const text=button.textContent.trim().replace(/^[^a-z]+/i,'');if(/^(edit|delete|save changes|update|approve|reject|remove)(\b|\s)/i.test(text)){button.hidden=true;button.disabled=true}});
    };
    apply();
    const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});
  }
  function renderSidebar(profile){
    if(document.querySelector('.hrdb-sidebar'))return;
    const roleLabel={admin:'Admin',hr:'HR',accountant:'Accountant',store:'Store',mechanical:'Mechanical',mine_mate:'Mine Mate',foreman:'Foreman',project_manager:'Project Manager',assistant_project_manager:'Assistant Project Manager',director:'Director'}[role]||role;
    const displayName=user.user_metadata?.full_name||user.user_metadata?.name||profile.full_name||profile.email||user.email||'User';
    const designation=profile.designation||user.user_metadata?.designation;
    const pages=[
      ['Dashboard','index.html',['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager','director']],
      ['Employee Records','employee-records.html',['admin','hr']],
      ['Employees Data','employees-data.html',['admin','hr']],
      ['Shift Board','shift-dashboard.html',['admin','mine_mate','foreman']],
      ['Mining Report','mining-report.html',['admin','mine_mate','foreman']],
      ['Attendance','attendance.html',['admin','hr']],
      ['Monthly Attendance','monthly-attendance.html',['admin','hr']],
      ['Leave','leave.html',['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager','director']],
      ['Stock Management','samaan-issue.html',['admin','store']],
      ['PPE Issue Records','ppe-issue-records.html',['admin','store']],
      ['Stock & Returns','ppe-stock.html',['admin','store']],
      ['Reports','reports.html',['admin','hr']],['Accounting','accounting.html',['admin','hr','accountant','director']]
    ];
    const style=document.createElement('style');
    style.textContent=`.hrdb-sidebar{position:fixed;z-index:10001;inset:0 auto 0 0;width:232px;padding:20px 14px;background:#123f32;color:#f5fbf7;display:flex;flex-direction:column;gap:18px;box-shadow:8px 0 28px #132a1d12;font:14px system-ui;transform:translateX(-105%);transition:transform .2s ease}.hrdb-sidebar-brand{display:flex;align-items:center;gap:10px;padding:3px 7px 16px;border-bottom:1px solid #ffffff26}.hrdb-sidebar-mark{width:38px;height:38px;border-radius:12px;background:#ffffff20;display:grid;place-items:center;font-weight:800}.hrdb-sidebar-brand strong{font-size:14px}.hrdb-sidebar-brand small{display:block;color:#c5d8ce;font-size:11px;margin-top:3px}.hrdb-side-nav{display:grid;gap:4px;overflow:auto}.hrdb-side-nav a{color:#d8e6de;text-decoration:none;padding:10px 12px;border-radius:9px;font-weight:600}.hrdb-side-nav a:hover,.hrdb-side-nav a[aria-current=page]{background:#ffffff1b;color:white}.hrdb-side-group{display:grid;gap:3px;margin-top:4px}.hrdb-side-group-label{padding:8px 12px 4px;color:#a7c8b4;font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase}.hrdb-side-group .hrdb-side-child{margin-left:12px}.hrdb-offline-sync{display:grid;gap:9px;padding:12px;border:1px solid #ffffff30;border-radius:11px;background:#ffffff0d;color:#e5efe8;font:600 12px/1.45 system-ui}.hrdb-sync-label{overflow-wrap:anywhere}.hrdb-sync-retry{width:100%;border:0;border-radius:8px;background:#d7aa31;color:#202820;padding:9px 10px;font:700 12px system-ui;cursor:pointer}.hrdb-sync-retry:disabled{cursor:default;opacity:.65}.hrdb-side-account{margin-top:auto;border-top:1px solid #ffffff26;padding:15px 7px 0}.hrdb-side-account strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:13px}.hrdb-side-account span{display:block;color:#b8d7c6;font-size:11px;margin:3px 0 12px}.hrdb-signout{width:100%;border:1px solid #ffffff45;border-radius:9px;background:transparent;color:white;padding:10px 12px;text-align:left;font:600 13px system-ui;cursor:pointer}.hrdb-signout:hover{background:#ffffff17}.hrdb-sidebar-open .hrdb-sidebar{transform:translateX(0)}.hrdb-menu-toggle{display:inline-flex;position:fixed;z-index:10002;left:12px;top:12px;width:42px;height:42px;align-items:center;justify-content:center;border:1px solid #d9e3dc;border-radius:11px;background:#fff;color:#123f32;font-size:21px;box-shadow:0 3px 12px #123f3218;cursor:pointer;transition:left .2s ease}.hrdb-sidebar-open .hrdb-menu-toggle{left:242px}.hrdb-sidebar-backdrop{position:fixed;z-index:10000;inset:0;background:#10231d75;opacity:0;pointer-events:none;transition:opacity .2s ease}.hrdb-sidebar-open .hrdb-sidebar-backdrop{opacity:1;pointer-events:auto}`;
    document.head.append(style);document.body.classList.add('hrdb-with-sidebar');
    const sidebar=document.createElement('aside');sidebar.className='hrdb-sidebar';sidebar.setAttribute('aria-label','Main menu');
    sidebar.innerHTML='<div class="hrdb-sidebar-brand"><div class="hrdb-sidebar-mark">BV</div><div><strong>BV Mining Solution</strong><small>Workforce management</small></div></div>';
    const nav=document.createElement('nav');nav.className='hrdb-side-nav';
    const current=location.pathname.split('/').pop()||'index.html';
    const pageKey={'index.html':'dashboard','employee-records.html':'employee_records','employees-data.html':'employees_data','shift-dashboard.html':'shift_board','mining-report.html':'mining_report','attendance.html':'attendance','monthly-attendance.html':'monthly_attendance','leave.html':'leave','samaan-issue.html':'stock_management','ppe-issue-records.html':'ppe_issue_records','ppe-stock.html':'stock_returns','reports.html':'reports','accounting.html':'accounting'};
    const pageNavigation={
      'employee-records.html':[['Employees Data','employees-data.html'],['Shift Board','shift-dashboard.html']],
      'employees-data.html':[['Employee Records','employee-records.html']],
      'attendance.html':[['Monthly Attendance','monthly-attendance.html'],['Leave','leave.html'],['Reports','reports.html']],
      'leave.html':[['Attendance','attendance.html'],['Reports','reports.html']],
      'monthly-attendance.html':[['Attendance','attendance.html']],
      'accounting.html':[['Payroll & Payslips','payroll.html'],['Financial Reports','financial-reports.html']],
      'payroll.html':[['Accounting Dashboard','accounting.html'],['Payroll & Payslips','payroll.html'],['Financial Reports','financial-reports.html']],
      'financial-reports.html':[['Accounting Dashboard','accounting.html'],['Payroll & Payslips','payroll.html'],['Financial Reports','financial-reports.html']],
      'reports.html':[['Attendance','attendance.html'],['Leave','leave.html']],
      'ppe-issue-records.html':[['Stock Management','samaan-issue.html'],['Stock & Returns','ppe-stock.html']],
      'ppe-stock.html':[['Stock Management','samaan-issue.html'],['Reports','reports.html']],
      'samaan-issue.html':[['PPE Issue Records','ppe-issue-records.html'],['Stock & Returns','ppe-stock.html']]
    };
    const canShowMenuLink=href=>href==='index.html'||role==='admin'||(['admin-users.html','audit-log.html'].includes(href)?false:pageAccess[pageKey[href]]===true);
    const pageLinks=current==='index.html'
      ?pages.filter(([,href])=>{
        const hiddenMenuPages=new Set(['employees-data.html','monthly-attendance.html','ppe-issue-records.html','ppe-stock.html','reports.html','accounting.html']);
        return !hiddenMenuPages.has(href)&&canShowMenuLink(href);
      })
      :[['HR Home','index.html'],...(pageNavigation[current]||[])].filter(([,href])=>canShowMenuLink(href));
    pageLinks.forEach(([label,href])=>{const link=document.createElement('a');link.href=href;link.textContent=label;if(current===href)link.setAttribute('aria-current','page');nav.append(link)});
    if(current==='index.html'){
      const hasAccounting=role==='admin'||pageAccess.accounting===true,hasReports=role==='admin'||pageAccess.reports===true;
      if(hasAccounting||hasReports){const group=document.createElement('div');group.className='hrdb-side-group';if(hasAccounting){const accounting=document.createElement('a');accounting.href='accounting.html';accounting.textContent='Accounting';if(['accounting.html','payroll.html','financial-reports.html'].includes(current))accounting.setAttribute('aria-current','page');group.append(accounting)}else{const label=document.createElement('span');label.className='hrdb-side-group-label';label.textContent='Accounting';group.append(label)}if(hasReports){const reports=document.createElement('a');reports.className='hrdb-side-child';reports.href='reports.html';reports.textContent='Reports';if(current==='reports.html')reports.setAttribute('aria-current','page');group.append(reports)}nav.append(group)}
      if(role==='admin'){const approvals=document.createElement('a');approvals.href='audit-log.html';approvals.textContent='Audit Log & Approvals';if(current==='audit-log.html')approvals.setAttribute('aria-current','page');nav.append(approvals);const users=document.createElement('a');users.href='admin-users.html';users.textContent='User Management';if(current==='admin-users.html')users.setAttribute('aria-current','page');nav.append(users)}
    }
    sidebar.append(nav);
    const account=document.createElement('div');account.className='hrdb-side-account';
    const name=document.createElement('strong');name.textContent=displayName;name.title=displayName;
    const badge=document.createElement('span');badge.textContent=designation?`${designation} · ${roleLabel}`:roleLabel;
    const button=document.createElement('button');button.type='button';button.className='hrdb-signout';button.textContent='Log out';button.setAttribute('aria-label','Log out of BV Mining Solution');
    button.onclick=async()=>{button.disabled=true;button.textContent='Logging out…';try{await releaseActiveDeviceSession();const{error}=await client.auth.signOut();if(error)throw error;Object.values(key).forEach(k=>nativeRemove.call(localStorage,k));location.replace('login.html')}catch(error){button.disabled=false;button.textContent='Log out';status(`Could not log out: ${error.message}`,true)}};
    account.append(name,badge,button);sidebar.append(account);document.body.prepend(sidebar);
    const toggle=document.createElement('button');toggle.className='hrdb-menu-toggle';toggle.type='button';toggle.setAttribute('aria-label','Open navigation menu');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';document.body.append(toggle);
    const backdrop=document.createElement('div');backdrop.className='hrdb-sidebar-backdrop';backdrop.setAttribute('aria-hidden','true');document.body.append(backdrop);
    const close=()=>{document.body.classList.remove('hrdb-sidebar-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation menu')};
    const open=()=>{document.body.classList.add('hrdb-sidebar-open');toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','Close navigation menu')};
    toggle.onclick=()=>toggle.getAttribute('aria-expanded')==='true'?close():open();backdrop.onclick=close;nav.addEventListener('click',e=>{if(e.target.closest('a'))close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true')close()});
  }
  window.HRDB={client,boot,status,hideLoading,get role(){return role},get user(){return user},get canEdit(){return role==='admin'},get canApprove(){return role==='admin'||role==='director'},hasPageAccess:page=>role==='admin'||pageAccess[page]===true,flush:()=>queue.then(()=>{if(pendingCount())throw lastSyncError||new Error('Changes are still waiting to sync.')}),flushKey:name=>queue.then(()=>{const job=readOutbox().find(item=>item.ownerId===user?.id&&item.key===name);if(job)throw new Error(job.error||lastSyncError?.message||'This update is still waiting to sync.')}),queueMiningReport,getPendingMiningReports:()=>readMiningOutbox().filter(job=>job.ownerId===user?.id),queueDatabaseWrite,getPendingDatabaseOps:()=>readDatabaseOutbox().filter(job=>job.ownerId===user?.id),retrySync:()=>queue=queue.then(()=>retryPending())};
})();
