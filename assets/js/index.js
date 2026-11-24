const SHIFT_KEY='shift-board-v1';
const ISSUE_KEY='hr-item-issues-v1';
const LEAVE_KEY='hr-leave-v1';
const STOCK_KEY='hr-ppe-stock-v1';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
function leaveDate(value){if(!value)return '—';const date=new Date(`${value}T12:00:00`);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'}).format(date)}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
let selectedDate=today();
const overtimeOverrides={};
let blastSummaryRequest=0;
async function renderBlastSummary(date){
 const request=++blastSummaryRequest;
 $('blastSummaryDate').textContent=`Blast counts for ${leaveDate(date)}.`;
 ['blastFirst','blastSecond','blastNight','blastTotal'].forEach(id=>$(id).textContent='…');
 const {data,error}=await window.HRDB.client.rpc('get_mining_blast_summary',{p_report_date:date});
 if(request!==blastSummaryRequest)return;
 if(error){console.error(error);['blastFirst','blastSecond','blastNight','blastTotal'].forEach(id=>$(id).textContent='—');$('blastSummaryDate').textContent='Could not load blast totals. Apply the Mining Report database migration.';return}
 const totals={first:0,second:0,night:0};(data||[]).forEach(row=>{if(Object.hasOwn(totals,row.shift))totals[row.shift]=Number(row.blast_count)||0});
 $('blastFirst').textContent=totals.first;$('blastSecond').textContent=totals.second;$('blastNight').textContent=totals.night;$('blastTotal').textContent=totals.first+totals.second+totals.night;
}
function render(){
 const date=selectedDate;
 $('dashboardDate').value=date;
 const dateLabel=new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(date+'T12:00:00'));
 $('overviewLabel').textContent=date===today()?"Today's overview":dateLabel;
 $('shiftSectionTitle').textContent=date===today()?"Today's shift distribution":`${dateLabel} shift distribution`;
 const shift=read(SHIFT_KEY,{members:[],schedule:{}});
 const members=shift.members||[];
 const assignments=(shift.schedule||{})[date]||{};
 const counts={first:0,second:0,night:0,rest:0};
 members.forEach(m=>counts[assignments[m.id]||'rest']++);
 const total=members.length,duty=counts.first+counts.second+counts.night;
 $('totalCount').textContent=total;$('dutyCount').textContent=duty;$('restCount').textContent=counts.rest;
 $('firstCount').textContent=counts.first;$('secondCount').textContent=counts.second;$('nightCount').textContent=counts.night;$('restShiftCount').textContent=counts.rest;
 [['first',counts.first],['second',counts.second],['night',counts.night],['rest',counts.rest]].forEach(([key,n])=>$(key+'Bar').style.width=(total?Math.round(n/total*100):0)+'%');
 const issue=read(ISSUE_KEY,{records:[]});
 const records=(issue.records||[]).filter(r=>r.date===date);
 $('ppeCount').textContent=records.length;
 $('ppePeople').textContent=`${new Set(records.map(r=>r.person.toLocaleLowerCase())).size} employees`;
 renderLeaveRequests();
 renderOvertimeRequests(shift,date,assignments);
 renderLowStockAlerts();
 renderBlastSummary(date);
 $('miningReportPageLink').hidden=!window.HRDB.hasPageAccess('mining_report');
 $('leavePageLink').hidden=!window.HRDB.hasPageAccess('leave');
 $('shiftBoardPageLink').hidden=!window.HRDB.hasPageAccess('shift_board');
}
function renderLeaveRequests(){
 const records=read(LEAVE_KEY,[]);
 const requests=Array.isArray(records)?records:[];
 const counts={Pending:0,Approved:0,Rejected:0,Cancelled:0};
 requests.forEach(request=>{const status=request.status||'Pending';if(Object.hasOwn(counts,status))counts[status]++});
 $('leaveSummary').textContent=`${counts.Pending} pending · ${counts.Approved} approved · ${counts.Rejected} rejected`;
 const latest=[...requests].sort((a,b)=>String(b.createdAt||b.start||'').localeCompare(String(a.createdAt||a.start||''))).slice(0,8);
 if(!latest.length){$('dashboardLeaveRequests').innerHTML='<div class="leave-empty">No leave requests have been submitted yet.</div>';return}
 $('dashboardLeaveRequests').innerHTML=`<table class="leave-table"><thead><tr><th>Employee</th><th>Leave type</th><th>Leave dates</th><th>Request status</th></tr></thead><tbody>${latest.map(request=>{
  const status=request.status||'Pending';const tone=String(status).toLowerCase();
  const dates=request.start===request.end?leaveDate(request.start):`${leaveDate(request.start)} – ${leaveDate(request.end)}`;
  return `<tr><td><strong>${esc(request.employee||'Employee')}</strong>${request.employeeCode?`<span class="leave-sub">${esc(request.employeeCode)}</span>`:''}</td><td>${esc(request.type||'—')}</td><td>${esc(dates)}</td><td><span class="leave-badge ${esc(tone)}">${esc(status)}</span></td></tr>`;
 }).join('')}</tbody></table>`;
}
function renderOvertimeRequests(shift,date,assignments){
 const members=new Map((shift.members||[]).map(member=>[member.id,member]));
 const overtime={...((shift.overtime||{})[date]||{}),...(overtimeOverrides[date]||{})};
 const requests=Object.entries(overtime).filter(([,entry])=>Number(entry?.hours)>0).map(([employeeId,entry])=>({employeeId,entry,member:members.get(employeeId)||{}}));
 const counts={Pending:0,Approved:0,Rejected:0};
 requests.forEach(request=>{const status=request.entry.approvalStatus||'Pending';if(Object.hasOwn(counts,status))counts[status]++});
 $('overtimeSummary').textContent=`${counts.Pending} pending · ${counts.Approved} approved · ${counts.Rejected} rejected · ${date}`;
 if(!requests.length){$('dashboardOvertimeRequests').innerHTML='<div class="leave-empty">No overtime requests for this date.</div>';return}
 const admin=window.HRDB.role==='admin';
 $('dashboardOvertimeRequests').innerHTML=`<table class="leave-table"><thead><tr><th>Employee</th><th>Shift</th><th>OT hours</th><th>Reason</th><th>Request status</th></tr></thead><tbody>${requests.map(({employeeId,entry,member})=>{
  const status=entry.approvalStatus||'Pending',tone=status.toLowerCase();
  const name=member.name||member.employeeNameAadhaar||member.employeeCode||'Employee';
  const code=member.employeeCode||member.empCode||'';
  const shiftName=({first:'1st shift',second:'2nd shift',night:'Night shift',rest:'Rest'})[assignments[employeeId]||'rest'];
  const statusControl=admin
   ? `<select class="overtime-status-select ${esc(tone)}" data-overtime-status="${esc(employeeId)}" data-work-date="${esc(date)}" aria-label="Overtime request status for ${esc(name)}">${['Pending','Approved','Rejected'].map(option=>`<option ${status===option?'selected':''}>${option}</option>`).join('')}</select>${entry.approvedAt?`<small class="overtime-meta">Reviewed ${esc(new Date(entry.approvedAt).toLocaleString('en-IN'))}</small>`:''}`
   : `<span class="overtime-status ${esc(tone)}">${esc(status)}</span>${entry.approvedAt?`<small class="overtime-meta">Reviewed ${esc(new Date(entry.approvedAt).toLocaleString('en-IN'))}</small>`:''}`;
  return `<tr><td><strong>${esc(name)}</strong>${code?`<span class="leave-sub">${esc(code)}</span>`:''}</td><td>${esc(shiftName)}</td><td>${Number(entry.hours)} h</td><td>${esc(entry.reason||'—')}</td><td>${statusControl}</td></tr>`;
 }).join('')}</tbody></table>`;
 $('dashboardOvertimeRequests').querySelectorAll('[data-overtime-status]').forEach(select=>select.addEventListener('change',async()=>{
  const status=select.value,employeeId=select.dataset.overtimeStatus,workDate=select.dataset.workDate;
  const approver=status==='Pending'?null:window.HRDB.user.id;
  const approvedAt=status==='Pending'?null:new Date().toISOString();
  select.disabled=true;
  const {error}=await window.HRDB.client.from('overtime_entries').update({approval_status:status,approved_by:approver,approved_at:approvedAt,updated_at:new Date().toISOString()}).eq('employee_id',employeeId).eq('work_date',workDate).select('id').single();
  if(error){window.HRDB.status(`Could not update overtime request: ${error.message}`,true);render();return}
  overtimeOverrides[workDate]||={};
  overtimeOverrides[workDate][employeeId]={approvalStatus:status,approvedBy:approver||'',approvedAt:approvedAt||''};
  window.HRDB.status(`Overtime request ${status.toLowerCase()}.`);
  render();
 }));
}
function renderLowStockAlerts(){
 const issue=read(ISSUE_KEY,{items:[],itemCategories:{},records:[]});
 const stock=read(STOCK_KEY,{opening:{},minimum:{},movements:[]});
 const items=[...new Set(issue.items||[])];
 const records=issue.records||[],movements=stock.movements||[];
 const alerts=items.map(item=>{
  const key=String(item).toLowerCase();
  const issued=records.filter(record=>String(record.item||'').toLowerCase()===key).reduce((sum,record)=>sum+Number(record.quantity||1),0);
  const moved=movements.filter(move=>String(move.item||'').toLowerCase()===key).reduce((sum,move)=>sum+Number(move.quantity||0)*(move.type==='in'||move.type==='return'?1:-1),0);
  const available=Number(stock.opening?.[item]||0)+moved-issued;
  const minimum=Number(stock.minimum?.[item]||0);
  return {item,category:issue.itemCategories?.[item]||'Other',available,minimum};
 }).filter(item=>item.available<0||(item.minimum>0&&item.available<=item.minimum)).sort((a,b)=>a.available-b.available);
 const critical=alerts.filter(item=>item.available<0).length;
 const configuredCount=items.filter(item=>Number(stock.minimum?.[item]||0)>0).length;
 $('lowStockSummary').textContent=alerts.length?`${alerts.length} item${alerts.length===1?'':'s'} need restocking · ${critical} stock shortfall${critical===1?'':'s'}`:configuredCount?'All items are above their minimum stock levels.':'Set minimum levels in Stock & Returns to enable low stock alerts.';
 $('stockManagementLink').hidden=!window.HRDB.hasPageAccess('stock_returns');
 if(!alerts.length){$('dashboardLowStock').innerHTML=`<div class="leave-empty">${configuredCount?'No items are at or below their minimum stock level.':'Set a minimum stock level for each item on the Stock & Returns page to activate alerts.'}</div>`;return}
 $('dashboardLowStock').innerHTML=`<table class="leave-table"><thead><tr><th>Category</th><th>Item</th><th>Available</th><th>Minimum level</th><th>Alert</th></tr></thead><tbody>${alerts.map(item=>{
  const critical=item.available<0;
  return `<tr><td>${esc(item.category)}</td><td><strong>${esc(item.item)}</strong></td><td>${item.available}</td><td>${item.minimum}</td><td><span class="stock-alert-badge ${critical?'critical':'low'}">${critical?'Stock shortfall':'Low stock'}</span></td></tr>`;
 }).join('')}</tbody></table>`;
}
function moveDate(amount){
 const d=new Date(selectedDate+'T12:00:00');d.setDate(d.getDate()+amount);
 selectedDate=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 render();
}
$('dashboardDate').addEventListener('change',e=>{selectedDate=e.target.value||today();render()});
$('prevDate').addEventListener('click',()=>moveDate(-1));
$('nextDate').addEventListener('click',()=>moveDate(1));
render();window.addEventListener('storage',render);
