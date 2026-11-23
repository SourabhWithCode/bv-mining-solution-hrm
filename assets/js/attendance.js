const SHIFT_KEY='shift-board-v1',KEY='hr-attendance-v1';
const $=id=>document.getElementById(id);
const workingShifts=new Set(['first','second','night']);
const shiftLabels={first:'1st shift',second:'2nd shift',night:'Night shift',rest:'Rest'};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
let db;try{db=JSON.parse(localStorage.getItem(KEY))||{days:{},auto:{}}}catch{db={days:{},auto:{}}}
db.days??={};db.auto??={};db.manualClear??={};
let date=today(),timer;
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('toast').classList.remove('show'),1800)}
function ensureShiftAttendance(employees,shiftState){
 const assigned=shiftState?.schedule?.[date]||{};db.days[date]??={};db.auto[date]??={};db.manualClear[date]??={};let changed=false;
 employees.forEach(employee=>{
  const id=employee.id,scheduled=workingShifts.has(assigned[id]);
  if(scheduled&&!db.manualClear[date][id]&&(!db.days[date][id]||db.auto[date][id])){if(db.days[date][id]!=='Present'||!db.auto[date][id])changed=true;db.days[date][id]='Present';db.auto[date][id]=true}
  else if(!scheduled&&(db.auto[date][id]||db.manualClear[date][id])){if(db.auto[date][id])delete db.days[date][id];delete db.auto[date][id];delete db.manualClear[date][id];changed=true}
 });
 if(changed)save();
}
function render(){
 $('attDate').value=date;
 let shiftState={members:[],schedule:{}};try{shiftState=JSON.parse(localStorage.getItem(SHIFT_KEY))||shiftState}catch{}
 const employees=shiftState.members||[];ensureShiftAttendance(employees,shiftState);
 const assigned=shiftState.schedule?.[date]||{},day=db.days[date]||{},auto=db.auto[date]||{};
 const query=$('search').value.trim().toLowerCase();
 const filtered=employees.filter(e=>`${e.name||e.employeeNameAadhaar||''} ${e.employeeCode||e.empCode||''} ${e.designation||''}`.toLowerCase().includes(query));
 const counts={Present:0,Absent:0,Late:0,'Half day':0,unmarked:0};
 employees.forEach(e=>{const status=day[e.id]||'';if(status)counts[status]++;else counts.unmarked++});
 $('presentCount').textContent=counts.Present;$('absentCount').textContent=counts.Absent;$('lateCount').textContent=counts.Late;$('halfCount').textContent=counts['Half day'];$('unmarkedCount').textContent=counts.unmarked;
 $('summary').textContent=`${employees.length} employees · ${counts.unmarked} not marked`;
 if(!employees.length){$('table').innerHTML='<div class="empty">No employees found. Add employees in the Shift Board first.</div>';return}
 if(!filtered.length){$('table').innerHTML='<div class="empty">No matching employees.</div>';return}
 $('table').innerHTML=`<div class="tablewrap"><table class="table"><thead><tr><th>Employee</th><th>Assigned shift</th><th>Attendance status</th>${window.HRDB.canEdit?'<th>Actions</th>':''}</tr></thead><tbody>${filtered.map(employee=>{const status=day[employee.id]||'',shift=assigned[employee.id]||'rest',name=employee.name||employee.employeeNameAadhaar||employee.employeeCode||'Employee',saved=Object.prototype.hasOwnProperty.call(db.days?.[date]||{},employee.id)||Object.prototype.hasOwnProperty.call(db.manualClear?.[date]||{},employee.id);return `<tr><td><div class="person">${esc(name)}</div><div class="sub">${esc(employee.employeeCode||employee.empCode||'')} · ${esc(employee.designation||'')}</div></td><td>${shiftLabels[shift]||'Rest'}</td><td><select class="status" data-status-id="${esc(employee.id)}" ${window.HRDB.canEdit||!saved?'':'data-existing-record'}><option value="" ${!status?'selected':''}>Not marked</option>${['Present','Absent','Late','Half day'].map(value=>`<option value="${value}" ${status===value?'selected':''}>${value}</option>`).join('')}</select>${auto[employee.id]?'<div class="sub auto-note">Auto-marked from shift</div>':''}</td>${window.HRDB.canEdit?`<td><button class="delete-attendance" type="button" data-delete-id="${esc(employee.id)}" ${status?'':'disabled'}>Delete</button></td>`:''}</tr>`}).join('')}</tbody></table></div>`;
 $('table').querySelectorAll('[data-status-id]').forEach(select=>select.onchange=()=>{const id=select.dataset.statusId;db.days[date]??={};db.auto[date]??={};db.manualClear[date]??={};if(select.value){db.days[date][id]=select.value;delete db.manualClear[date][id]}else{delete db.days[date][id];if(workingShifts.has(assigned[id]))db.manualClear[date][id]=true}delete db.auto[date][id];save();render();toast('Attendance saved')});
 $('table').querySelectorAll('[data-delete-id]').forEach(button=>button.onclick=()=>{const id=button.dataset.deleteId;if(!db.days[date]?.[id])return;if(!window.confirm('Delete this attendance record for the selected date?'))return;db.days[date]??={};db.auto[date]??={};db.manualClear[date]??={};delete db.days[date][id];delete db.auto[date][id];if(workingShifts.has(assigned[id]))db.manualClear[date][id]=true;save();render();toast('Attendance record deleted')});
}
$('attDate').onchange=event=>{date=event.target.value||today();render()};
$('search').oninput=render;
window.addEventListener('storage',render);
render();
