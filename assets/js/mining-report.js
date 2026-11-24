const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const shiftLabel=value=>({first:'1st shift',second:'2nd shift',night:'Night shift'})[value]||value||'—';
let reports=[];
let profileName='';
const reporterName=()=>profileName||window.HRDB.user?.user_metadata?.full_name||window.HRDB.user?.user_metadata?.name||window.HRDB.user?.email||'User';
function readShiftBoard(){try{return JSON.parse(localStorage.getItem('shift-board-v1'))||{members:[],schedule:{}}}catch{return {members:[],schedule:{}}}}
function memberDisplayName(member){return member.name||member.employeeNameAadhaar||[member.firstName,member.surname].filter(Boolean).join(' ')||member.employeeCode||member.empCode||'Employee'}
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
function resetForm(){ $('reportForm').reset();$('reportDate').value=dateToday();$('reportBlasts').value='0';$('reportManpower').value='0';$('reportIdle').value='0';$('reportId').value='';$('reporterName').value=reporterName();$('formTitle').textContent='New Shift Report';$('saveReport').textContent='Save report';$('cancelEdit').hidden=true;refreshShiftRoster() }
async function loadReports(){
 $('reportRows').innerHTML='<tr><td class="report-loading" colspan="16">Loading reports…</td></tr>';
 let query=window.HRDB.client.from('mining_reports').select('*').order('report_date',{ascending:false}).order('shift').order('created_at',{ascending:false}).limit(1000);
 if($('filterFrom').value)query=query.gte('report_date',$('filterFrom').value);
 if($('filterTo').value)query=query.lte('report_date',$('filterTo').value);
 if($('filterShift').value)query=query.eq('shift',$('filterShift').value);
 const {data,error}=await query;
 if(error){console.error(error);$('reportRows').innerHTML=`<tr><td class="empty" colspan="16">Could not load reports: ${esc(error.message)}. Run database/mining-reports-migration.sql in Supabase SQL Editor.</td></tr>`;return}
 reports=data||[];renderRows();
}
function renderRows(){
 const body=$('reportRows');
 if(!reports.length){body.innerHTML='<tr><td class="empty" colspan="16">No shift reports match these filters.</td></tr>';return}
 const admin=window.HRDB.role==='admin';
 body.innerHTML=reports.map(r=>`<tr><td>${esc(r.report_date)}</td><td>${esc(shiftLabel(r.shift))}</td><td>${esc(r.location_level)}</td><td><strong>${Number(r.blast_count)||0}</strong></td><td>${esc(r.reporter_name)}</td><td>${esc(r.operator_name||r.operator||'—')}</td><td>${Number(r.manpower)||0}</td><td>${esc(r.manpower_names||'—').replace(/\n/g,'<br>')}</td><td>${esc(r.mechanic_names||r.mechanic||'—').replace(/\n/g,'<br>')}</td><td>${esc(r.work_done||'—').replace(/\n/g,'<br>')}</td><td>${esc(r.pending_work||'—').replace(/\n/g,'<br>')}</td><td>${esc(r.machine_status||'—')}</td><td>${esc(r.maintenance||'—').replace(/\n/g,'<br>')}</td><td>${Number(r.idle_time_hours)||0} h</td><td>${esc(r.remarks||'—').replace(/\n/g,'<br>')}</td><td ${admin?'':'data-admin-only'}>${admin?`<button class="report-action" data-action="edit" data-id="${esc(r.id)}">Edit</button><button class="report-action delete" data-action="delete" data-id="${esc(r.id)}">Delete</button>`:'—'}</td></tr>`).join('');
 body.querySelectorAll('[data-action="edit"]').forEach(button=>button.addEventListener('click',()=>editReport(button.dataset.id)));
 body.querySelectorAll('[data-action="delete"]').forEach(button=>button.addEventListener('click',()=>deleteReport(button.dataset.id)));
}
function editReport(id){
 const r=reports.find(row=>row.id===id);if(!r)return;
 $('reportId').value=r.id;$('reportDate').value=r.report_date;$('reportShift').value=r.shift;$('reportLocation').value=r.location_level;$('reporterName').value=r.reporter_name;$('reportBlasts').value=r.blast_count;$('reportManpower').value=r.manpower;$('reportManpowerNames').value=r.manpower_names||'';$('reportOperatorName').value=r.operator_name||r.operator||'';$('reportMechanicNames').value=r.mechanic_names||r.mechanic||'';$('reportWork').value=r.work_done||'';$('reportPending').value=r.pending_work||'';$('reportMachine').value=r.machine_status||'';$('reportMaintenance').value=r.maintenance||'';$('reportIdle').value=r.idle_time_hours||0;$('reportRemarks').value=r.remarks||'';
 $('formTitle').textContent='Edit Shift Report';$('saveReport').textContent='Update report';$('cancelEdit').hidden=false;window.scrollTo({top:0,behavior:'smooth'});
}
async function deleteReport(id){
 if(!confirm('Delete this mining report? This cannot be undone.'))return;
 const {error}=await window.HRDB.client.from('mining_reports').delete().eq('id',id);
 if(error){window.HRDB.status(`Could not delete report: ${error.message}`,true);return}
 window.HRDB.status('Mining report deleted.');await loadReports();
}
async function submitReport(event){
 event.preventDefault();const payload=formValues();
 if(payload.manpower<0||payload.blast_count<0||payload.idle_time_hours<0||payload.idle_time_hours>24){window.HRDB.status('Check manpower, blast count, and idle time values.',true);return}
 const id=$('reportId').value,button=$('saveReport');button.disabled=true;
 try{
  let result;
  if(id)result=await window.HRDB.client.from('mining_reports').update({...payload,updated_at:new Date().toISOString()}).eq('id',id);
  else result=await window.HRDB.client.from('mining_reports').insert({...payload,reporter_id:window.HRDB.user.id,reporter_name:reporterName()});
  if(result.error)throw result.error;
  window.HRDB.status(id?'Mining report updated.':'Mining report saved.');resetForm();await loadReports();
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
