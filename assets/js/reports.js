const SHIFT='shift-board-v1',ATT='hr-attendance-v1',LEAVE='hr-leave-v1',ISSUE='hr-item-issues-v1',STOCK='hr-ppe-stock-v1';
const $=id=>document.getElementById(id);
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
let current={headers:[],rows:[],name:'report'};
function within(d,a,b){return d>=a&&d<=b}
function makeReport(){
 const type=$('reportType').value,from=$('fromDate').value,to=$('toDate').value;
 if(!from||!to||from>to){$('summary').textContent='Choose a valid date range.';$('report').innerHTML='';current={headers:[],rows:[],name:'report'};return}
 let headers=[],rows=[],name=type;const team=read(SHIFT,{members:[],schedule:{}});const employees=team.members||[];
 if(type==='shifts'){
  headers=['Date','Employee Code','Employee','Designation','Shift'];const dates=Object.keys(team.schedule||{}).filter(d=>within(d,from,to)).sort();rows=dates.flatMap(d=>employees.map(e=>[d,e.empCode||'',e.name,e.designation||'',(team.schedule[d]||{})[e.id]||'Rest']));
 }else if(type==='attendance'){
  headers=['Date','Employee Code','Employee','Designation','Status'];const att=read(ATT,{days:{}});rows=Object.entries(att.days||{}).filter(([d])=>within(d,from,to)).sort(([a],[b])=>a.localeCompare(b)).flatMap(([d,statuses])=>employees.filter(e=>statuses[e.id]).map(e=>[d,e.empCode||'',e.name,e.designation||'',statuses[e.id]]));
 }else if(type==='leave'){
  headers=['Employee','Leave Type','Start Date','End Date','Reason','Status'];rows=read(LEAVE,[]).filter(r=>r.start<=to&&r.end>=from).sort((a,b)=>a.start.localeCompare(b.start)).map(r=>[r.employee,r.type,r.start,r.end,r.reason||'',r.status]);
 }else if(type==='ppe'){
  headers=['Date','Employee','Item','Quantity'];rows=(read(ISSUE,{records:[]}).records||[]).filter(r=>within(r.date,from,to)).sort((a,b)=>a.date.localeCompare(b.date)).map(r=>[r.date,r.person,r.item,Number(r.quantity||1)]);
 }else{
  headers=['Date','Movement','Item','Quantity','Employee','Note'];rows=(read(STOCK,{movements:[]}).movements||[]).filter(r=>within(r.date,from,to)).sort((a,b)=>a.date.localeCompare(b.date)).map(r=>[r.date,r.type==='return'?'Return':'Stock received',r.item,Number(r.quantity),r.employee||'',r.note||'']);name='ppe-stock-movements';
 }
 current={headers,rows,name};$('summary').textContent=`${rows.length} ${rows.length===1?'record':'records'} · ${from} to ${to}`;
 if(!rows.length){$('report').innerHTML='<div class="empty">No records found for this report and date range.</div>';return}
 const safe=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 $('report').innerHTML=`<div class="tablewrap"><table class="table"><thead><tr>${headers.map(h=>`<th>${safe(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${safe(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function csvCell(v){let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
$('generate').onclick=makeReport;$('reportType').onchange=makeReport;$('fromDate').value=`${today().slice(0,7)}-01`;$('toDate').value=today();
$('export').onclick=()=>{if(!current.headers.length){makeReport();if(!current.headers.length)return}const content=[current.headers,...current.rows].map(row=>row.map(csvCell).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'}));a.download=`hr-${current.name}-${$('fromDate').value}-to-${$('toDate').value}.csv`;a.click();URL.revokeObjectURL(a.href)};
function localDateString(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function monthlyWindow(){const now=new Date(),end=today(),currentStart=localDateString(new Date(now.getFullYear(),now.getMonth(),1)),previousStart=localDateString(new Date(now.getFullYear(),now.getMonth()-1,1));return{from:previousStart,to:end,currentStart}}
function monthLabel(date){return new Date(`${date}T12:00:00`).toLocaleDateString('en',{month:'long',year:'numeric'})}
function downloadRows(headers,rows,filename){const content=[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function employeeMap(members){return new Map((members||[]).map(member=>[String(member.id),member]))}
function isNetworkFailureForReport(error){return !navigator.onLine||/failed to fetch|networkerror|network request failed|fetch failed|load failed|offline/i.test(String(error?.message||error||''))}
function cachedMiningReports(){let cached=[];try{cached=JSON.parse(localStorage.getItem('hr-mining-reports-cache-v1'))||[]}catch{}const rows=new Map(cached.map(row=>[row.id,{...row}]));for(const operation of window.HRDB.getPendingMiningReports?.()||[]){if(operation.type==='insert')rows.set(operation.recordId,{id:operation.recordId,...operation.payload});else if(rows.has(operation.recordId))rows.set(operation.recordId,{...rows.get(operation.recordId),...operation.payload})}return[...rows.values()]}
function bundleRow(date,period,module,employeeCode='',employee='',shift='',location='',item='',status='',quantity='',hours='',details=''){return[period,date,module,employeeCode,employee,shift,location,item,status,quantity,hours,details]}
async function exportMonthlyBundle(){
 const button=$('exportMonthlyBundle'),windowRange=monthlyWindow(),state=read(SHIFT,{members:[],schedule:{},overtime:{}}),members=state.members||[],byId=employeeMap(members),rows=[];
 const periodFor=date=>date<windowRange.currentStart?'Previous Month':'Current Month';
 const add=(...values)=>rows.push(bundleRow(...values));
 button.disabled=true;button.textContent='Preparing CSV…';
 try{
  Object.entries(state.schedule||{}).filter(([date])=>within(date,windowRange.from,windowRange.to)).forEach(([date,assignments])=>Object.entries(assignments||{}).forEach(([id,shift])=>{const member=byId.get(String(id))||{};add(date,periodFor(date),'Shift',member.empCode||member.employeeCode||'',member.name||member.employeeNameAadhaar||'',shift||'Rest','','','','','','')}));
  const attendance=read(ATT,{days:{}});Object.entries(attendance.days||{}).filter(([date])=>within(date,windowRange.from,windowRange.to)).forEach(([date,statuses])=>Object.entries(statuses||{}).forEach(([id,status])=>{const member=byId.get(String(id))||{};add(date,periodFor(date),'Attendance',member.empCode||member.employeeCode||'',member.name||member.employeeNameAadhaar||'',(state.schedule?.[date]||{})[id]||'', '', '',status)}));
  read(LEAVE,[]).filter(record=>record.start<=windowRange.to&&record.end>=windowRange.from).forEach(record=>add(record.start||'',periodFor(record.start||windowRange.from),'Leave',record.employeeCode||'',record.employee||'', '', '',record.type||'',record.status||'', '', '',`End: ${record.end||''}; Reason: ${record.reason||''}`));
  Object.entries(state.overtime||{}).filter(([date])=>within(date,windowRange.from,windowRange.to)).forEach(([date,entries])=>Object.entries(entries||{}).forEach(([id,entry])=>{if(!entry||!Number(entry.hours))return;const member=byId.get(String(id))||{};add(date,periodFor(date),'Overtime',member.empCode||member.employeeCode||'',member.name||member.employeeNameAadhaar||'',(state.schedule?.[date]||{})[id]||'', '', '',entry.approvalStatus||entry.status||'Pending','',''+Number(entry.hours),entry.reason||'')}));
  (read(ISSUE,{records:[]}).records||[]).filter(record=>within(record.date,windowRange.from,windowRange.to)).forEach(record=>add(record.date,periodFor(record.date),'PPE Issue',record.employeeCode||'',record.person||'', '', '',record.item||'','Issued',Number(record.quantity||1)));
  (read(STOCK,{movements:[]}).movements||[]).filter(record=>within(record.date,windowRange.from,windowRange.to)).forEach(record=>add(record.date,periodFor(record.date),'Stock Movement','',record.employee||'','','',record.item||'',record.type==='return'?'Return':'Received',Number(record.quantity||0),'',record.note||''));
  if(window.HRDB.hasPageAccess('mining_report')){
   let miningRows=[];
   try{const{data,error}=await window.HRDB.client.from('mining_reports').select('*').gte('report_date',windowRange.from).lte('report_date',windowRange.to).order('report_date');if(error)throw error;miningRows=data||[];localStorage.setItem('hr-mining-reports-cache-v1',JSON.stringify(miningRows))}
   catch(error){if(!isNetworkFailureForReport(error))throw new Error(`Could not load Mining Reports for export: ${error.message}`);miningRows=cachedMiningReports().filter(record=>within(record.report_date,windowRange.from,windowRange.to));window.HRDB.status('Offline export used the last cached Mining Reports and pending entries.')}
   miningRows.forEach(record=>add(record.report_date,periodFor(record.report_date),'Mining Report',record.employee_code||'',record.reporter_name||'',record.shift||'',record.location_level||'',`Blasts: ${Number(record.blast_count)||0}`,'Submitted',record.manpower||'', '',[`Operator: ${record.operator_name||record.operator||''}`,`Manpower: ${record.manpower_names||''}`,`Mechanics: ${record.mechanic_names||record.mechanic||''}`,`Work done: ${record.work_done||''}`,`Pending work: ${record.pending_work||''}`,`Machine status: ${record.machine_status||''}`,`Maintenance: ${record.maintenance||''}`,`Idle time: ${record.idle_time_hours||0} h`,`Remarks: ${record.remarks||''}`].join('; ')));
  }
  rows.sort((a,b)=>String(a[1]).localeCompare(String(b[1]))||String(a[2]).localeCompare(String(b[2]))||String(a[3]).localeCompare(String(b[3])));
  downloadRows(['Period','Date','Module','Employee Code','Employee','Shift','Location / Level','Item / Report','Status','Quantity / Manpower','Hours','Details'],rows,`bv-mining-monthly-data-${windowRange.from}-to-${windowRange.to}.csv`);
  window.HRDB.status(`Monthly CSV downloaded with ${rows.length} records${window.HRDB.hasPageAccess('mining_report')?'':' (Mining Reports were excluded because page access is not assigned).'}`);
 }catch(error){console.error(error);window.HRDB.status(error.message||'Could not prepare the monthly CSV.',true)}finally{button.disabled=false;button.textContent='Download Previous + Current Month CSV'}
}
$('monthlyExportRange').textContent=`${monthLabel(monthlyWindow().from)} + ${monthLabel(monthlyWindow().currentStart)} through today`;
$('exportMonthlyBundle').addEventListener('click',exportMonthlyBundle);
makeReport();
