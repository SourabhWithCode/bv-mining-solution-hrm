const $=id=>document.getElementById(id);
const miningCacheKey='hr-mining-reports-cache-v1';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const shiftLabel=value=>({first:'1st shift',second:'2nd shift',night:'Night shift'})[value]||value||'—';
let reports=[];
let profileName='';
let editWindowTimer;
const reporterName=()=>profileName||window.HRDB.user?.user_metadata?.full_name||window.HRDB.user?.user_metadata?.name||window.HRDB.user?.email||'User';
function readShiftBoard(){try{return JSON.parse(localStorage.getItem('shift-board-v1'))||{members:[],schedule:{}}}catch{return {members:[],schedule:{}}}}
function memberDisplayName(member){return member.name||member.employeeNameAadhaar||[member.firstName,member.surname].filter(Boolean).join(' ')||member.employeeCode||member.empCode||'Employee'}
function readCachedReports(){try{return JSON.parse(localStorage.getItem(miningCacheKey))||[]}catch{return[]}}
function withPendingMiningReports(source){const rows=new Map((source||[]).map(row=>[row.id,{...row}]));for(const operation of window.HRDB.getPendingMiningReports?.()||[]){if(operation.type==='insert')rows.set(operation.recordId,{id:operation.recordId,...operation.payload});else if(rows.has(operation.recordId))rows.set(operation.recordId,{...rows.get(operation.recordId),...operation.payload})}return[...rows.values()]}
function matchesActiveFilters(report){return(!$('filterFrom').value||report.report_date>=$('filterFrom').value)&&(!$('filterTo').value||report.report_date<=$('filterTo').value)&&(!$('filterShift').value||report.shift===$('filterShift').value)}
function refreshShiftRoster(){
 if($('reportId').value)return;
 const date=$('reportDate').value,shift=$('reportShift').value,state=readShiftBoard();
 const assignments=state.schedule?.[date]||{};
 const assigned=(state.members||[]).filter(member=>assignments[member.id]===shift);
 const allNames=assigned.map(memberDisplayName);
 const operatorNames=assigned.filter(member=>/\boperator\b/i.test(member.designation||'')).map(memberDisplayName);
 const mechanicNames=assigned.filter(member=>/\bmechanic\b/i.test(member.designation||'')).map(memberDisplayName);
 $('reportManpower').value=String(assigned.length);
 $('reportManpowerNames').value=allNames.join('\n');
 $('reportOperatorName').value=operatorNames.join('\n');
 $('reportMechanicNames').value=mechanicNames.join('\n');
}
function formValues(){return {report_date:$('reportDate').value,shift:$('reportShift').value,location_level:$('reportLocation').value.trim(),operator_name:$('reportOperatorName').value.trim(),manpower:Number($('reportManpower').value||0),manpower_names:$('reportManpowerNames').value.trim(),mechanic_names:$('reportMechanicNames').value.trim(),blast_count:Number($('reportBlasts').value),work_done:$('reportWork').value.trim(),pending_work:$('reportPending').value.trim(),machine_status:$('reportMachine').value,maintenance:$('reportMaintenance').value.trim(),idle_time_hours:Number($('reportIdle').value||0),remarks:$('reportRemarks').value.trim()}}
function resetForm(){ $('reportForm').reset();$('reportDate').value=dateToday();$('reportBlasts').value='0';$('reportManpower').value='0';$('reportIdle').value='0';$('reportId').value='';$('reporterName').value=reporterName();$('formTitle').textContent='New Shift Report';$('saveReport').textContent='Save report';$('saveReport').removeAttribute('data-owner-action');$('cancelEdit').hidden=true;refreshShiftRoster() }
async function loadReports(){
 $('reportRows').innerHTML='<tr><td class="report-loading" colspan="16">Loading reports…</td></tr>';
 let query=window.HRDB.client.from('mining_reports').select('*').order('report_date',{ascending:false}).order('shift').order('created_at',{ascending:false}).limit(1000);
 if($('filterFrom').value)query=query.gte('report_date',$('filterFrom').value);
 if($('filterTo').value)query=query.lte('report_date',$('filterTo').value);
 if($('filterShift').value)query=query.eq('shift',$('filterShift').value);
 try{
  const{data,error}=await query;if(error)throw error;
  const allData=data||[];localStorage.setItem(miningCacheKey,JSON.stringify(allData));reports=withPendingMiningReports(allData).filter(matchesActiveFilters);
 }catch(error){
  console.error(error);reports=withPendingMiningReports(readCachedReports()).filter(matchesActiveFilters);
  if(!navigator.onLine||/failed to fetch|networkerror|network request failed/i.test(String(error.message||error))){window.HRDB.status('Offline: showing the last saved Mining Reports. New changes will sync when connected.',true)}
  else if(!reports.length){$('reportRows').innerHTML=`<tr><td class="empty" colspan="16">Could not load reports: ${esc(error.message)}. Run database/mining-reports-migration.sql in Supabase SQL Editor.</td></tr>`;return}
 }
 renderRows();
}
function renderRows(){
 const body=$('reportRows');
 if(!reports.length){body.innerHTML='<tr><td class="empty" colspan="16">No shift reports match these filters.</td></tr>';return}
 const admin=window.HRDB.role==='admin';
 body.innerHTML=reports.map(r=>{const ownerCanEdit=!admin&&r.reporter_id===window.HRDB.user?.id&&canEditReport(r);const actions=admin?`<button class="report-action" data-action="edit" data-id="${esc(r.id)}">Edit</button><button class="report-action delete" data-action="delete" data-id="${esc(r.id)}">Delete</button>`:ownerCanEdit?`<button class="report-action" data-owner-action data-action="edit" data-id="${esc(r.id)}">Edit · 24h window</button>`:'—';return `<tr><td>${esc(r.report_date)}</td><td>${esc(shiftLabel(r.shift))}</td><td>${esc(r.location_level)}</td><td><strong>${Number(r.blast_count)||0}</strong></td><td>${esc(r.reporter_name)}</td><td>${esc(r.operator_name||r.operator||'—')}</td><td>${Number(r.manpower)||0}</td><td>${esc(r.manpower_names||'—').replace(/\n/g,'<br>')}</td><td>${esc(r.mechanic_names||r.mechanic||'—').replace(/\n/g,'<br>')}</td><td>${esc(r.work_done||'—').replace(/\n/g,'<br>')}</td><td>${esc(r.pending_work||'—').replace(/\n/g,'<br>')}</td><td>${esc(r.machine_status||'—')}</td><td>${esc(r.maintenance||'—').replace(/\n/g,'<br>')}</td><td>${Number(r.idle_time_hours)||0} h</td><td>${esc(r.remarks||'—').replace(/\n/g,'<br>')}</td><td>${actions}</td></tr>`}).join('');
 body.querySelectorAll('[data-action="edit"]').forEach(button=>button.addEventListener('click',()=>editReport(button.dataset.id)));
 body.querySelectorAll('[data-action="delete"]').forEach(button=>button.addEventListener('click',()=>deleteReport(button.dataset.id)));
 clearTimeout(editWindowTimer);
 const expiry=reports.filter(r=>r.reporter_id===window.HRDB.user?.id&&canEditReport(r)).reduce((soonest,r)=>Math.min(soonest,new Date(r.created_at).getTime()+24*60*60*1000),Infinity);
 if(Number.isFinite(expiry))editWindowTimer=setTimeout(renderRows,Math.max(0,expiry-Date.now())+250);
}
function canEditReport(report){
 if(window.HRDB.role==='admin')return true;
 if(report.reporter_id!==window.HRDB.user?.id||!report.created_at)return false;
 const age=Date.now()-new Date(report.created_at).getTime();
 return age>=0&&age<24*60*60*1000;
}
function editReport(id){
 const r=reports.find(row=>row.id===id);if(!r)return;
 if(!canEditReport(r)){window.HRDB.status('Only the report author can edit it within 24 hours of submission.',true);return}
 $('reportId').value=r.id;$('reportDate').value=r.report_date;$('reportShift').value=r.shift;$('reportLocation').value=r.location_level;$('reporterName').value=r.reporter_name;$('reportBlasts').value=r.blast_count;$('reportManpower').value=r.manpower;$('reportManpowerNames').value=r.manpower_names||'';$('reportOperatorName').value=r.operator_name||r.operator||'';$('reportMechanicNames').value=r.mechanic_names||r.mechanic||'';$('reportWork').value=r.work_done||'';$('reportPending').value=r.pending_work||'';$('reportMachine').value=r.machine_status||'';$('reportMaintenance').value=r.maintenance||'';$('reportIdle').value=r.idle_time_hours||0;$('reportRemarks').value=r.remarks||'';
 $('formTitle').textContent='Edit Shift Report';$('saveReport').textContent='Update report';$('saveReport').setAttribute('data-owner-action','');$('cancelEdit').hidden=false;window.scrollTo({top:0,behavior:'smooth'});
}
async function deleteReport(id){
 if(!confirm('Delete this mining report? This cannot be undone.'))return;
 const {error}=await window.HRDB.client.from('mining_reports').delete().eq('id',id);
 if(error){window.HRDB.status(`Could not delete report: ${error.message}`,true);return}
 window.HRDB.status('Mining report deleted.');await loadReports();
}
function isNetworkFailure(error){return !navigator.onLine||/failed to fetch|networkerror|network request failed|fetch failed|load failed|offline/i.test(String(error?.message||error||''))}
async function submitReport(event){
 event.preventDefault();const payload=formValues();
 if(payload.manpower<0||payload.blast_count<0||payload.idle_time_hours<0||payload.idle_time_hours>24){window.HRDB.status('Check manpower, blast count, and idle time values.',true);return}
 const id=$('reportId').value,button=$('saveReport');if(id){const existing=reports.find(row=>row.id===id);if(!existing||!canEditReport(existing)){window.HRDB.status('This report can no longer be edited. The author edit window is 24 hours.',true);return}}button.disabled=true;
 try{
  const now=new Date().toISOString();
  if(id){
   const update={...payload,updated_at:now};
   if(!navigator.onLine){window.HRDB.queueMiningReport({type:'update',recordId:id,payload:update});reports=reports.map(row=>row.id===id?{...row,...update}:row);window.HRDB.status('Report saved on this device. It will sync when the network returns.')}
   else try{const{error}=await window.HRDB.client.from('mining_reports').update(update).eq('id',id).select('id').single();if(error)throw error;window.HRDB.status('Mining report updated.')}
   catch(error){if(!isNetworkFailure(error))throw error;window.HRDB.queueMiningReport({type:'update',recordId:id,payload:update});reports=reports.map(row=>row.id===id?{...row,...update}:row);window.HRDB.status('Connection lost. The report edit is saved on this device and will sync automatically.')}
  }else{
   const recordId=crypto.randomUUID(),newReport={...payload,reporter_id:window.HRDB.user.id,reporter_name:reporterName(),created_at:now,updated_at:now};
   if(!navigator.onLine){window.HRDB.queueMiningReport({type:'insert',recordId,payload:newReport});reports=withPendingMiningReports(reports);window.HRDB.status('Report saved on this device. It will sync when the network returns.')}
   else try{const{error}=await window.HRDB.client.from('mining_reports').insert({...newReport,id:recordId});if(error)throw error;window.HRDB.status('Mining report saved.')}
   catch(error){if(!isNetworkFailure(error))throw error;window.HRDB.queueMiningReport({type:'insert',recordId,payload:newReport});reports=withPendingMiningReports(reports);window.HRDB.status('Connection lost. The report is saved on this device and will sync automatically.')}
  }
  resetForm();renderRows();if(navigator.onLine)await loadReports();
 }catch(error){console.error(error);window.HRDB.status(`Could not save mining report: ${error.message}`,true)}finally{button.disabled=false}
}
$('reportForm').addEventListener('submit',submitReport);
$('cancelEdit').addEventListener('click',resetForm);
$('reportDate').addEventListener('change',refreshShiftRoster);
$('reportShift').addEventListener('change',refreshShiftRoster);
$('applyFilters').addEventListener('click',loadReports);
$('clearFilters').addEventListener('click',()=>{$('filterFrom').value='';$('filterTo').value='';$('filterShift').value='';loadReports()});
$('reporterName').value=reporterName();$('reportDate').value=dateToday();
window.HRDB.client.from('user_profiles').select('full_name').eq('id',window.HRDB.user.id).maybeSingle().then(({data})=>{if(data?.full_name){profileName=data.full_name;$('reporterName').value=profileName}});
refreshShiftRoster();
window.addEventListener('storage',event=>{if(event.key==='shift-board-v1')refreshShiftRoster()});
loadReports();
