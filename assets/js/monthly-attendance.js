const $=id=>document.getElementById(id);
const workShifts=new Set(['first','second','night']);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const today=new Date(),monthField=$('month');
monthField.value=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
let employees=[];try{employees=JSON.parse(localStorage.getItem('shift-board-v1'))?.members||[]}catch{}
let attendanceRows=[],shiftRows=[],visibleRows=[];
const statusNames={Present:'Present',Absent:'Absent',Late:'Late','Half day':'Half day',Rest:'Rest','Not marked':'Not marked','—':'Unscheduled'};
function monthRange(value){const [year,month]=value.split('-').map(Number);const last=new Date(year,month,0).getDate();return{start:`${value}-01`,end:`${value}-${String(last).padStart(2,'0')}`,days:last,year,month}}
async function fetchMonth(table,columns,dateColumn,start,end){
  const all=[];let offset=0;
  while(true){
    const result=await window.HRDB.client.from(table).select(columns).gte(dateColumn,start).lte(dateColumn,end).order(dateColumn).order('employee_id').range(offset,offset+999);
    if(result.error)throw result.error;const rows=result.data||[];all.push(...rows);if(rows.length<1000)break;offset+=1000;
  }
  return all;
}
function statusFor(employeeId,date,schedule,attendance){
  const key=`${date}:${employeeId}`;
  if(attendance.has(key)){const value=attendance.get(key);return value===null?'Not marked':value}
  const shift=schedule.get(key);
  if(workShifts.has(shift))return 'Present';
  if(shift==='rest')return 'Rest';
  return '—';
}
function dateLabel(year,month,day){return new Date(year,month-1,day).toLocaleDateString('en-IN',{weekday:'short',day:'numeric'})}
function buildData(){
  const {days,year,month}=monthRange(monthField.value),attendance=new Map(),schedule=new Map();
  attendanceRows.forEach(row=>attendance.set(`${row.attendance_date}:${row.employee_id}`,row.status));
  shiftRows.forEach(row=>schedule.set(`${row.work_date}:${row.employee_id}`,row.shift));
  const query=$('search').value.trim().toLocaleLowerCase();
  visibleRows=employees.filter(employee=>`${employee.employeeCode||employee.empCode||''} ${employee.name||employee.employeeNameAadhaar||''} ${employee.firstName||''} ${employee.surname||''} ${employee.designation||''}`.toLocaleLowerCase().includes(query)).sort((a,b)=>(Number(a.srNo)||0)-(Number(b.srNo)||0));
  const totals={Present:0,Absent:0,Late:0,'Half day':0,Rest:0,'Not marked':0};
  const dayTotals=visibleRows.map(employee=>Array.from({length:days},(_,index)=>{
    const date=`${monthField.value}-${String(index+1).padStart(2,'0')}`,status=statusFor(employee.id,date,schedule,attendance);if(status in totals)totals[status]++;return status;
  }));
  $('employeeTotal').textContent=visibleRows.length;$('presentTotal').textContent=totals.Present;$('absentTotal').textContent=totals.Absent;$('lateTotal').textContent=totals.Late;$('halfTotal').textContent=totals['Half day'];
  $('summary').textContent=`${visibleRows.length} of ${employees.length} employees · ${totals.Rest} rest days · ${totals['Not marked']} deleted/unmarked records`;
  $('monthTitle').textContent=new Date(year,month-1,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'})+' attendance register';
  if(!visibleRows.length){$('tablewrap').innerHTML='<div class="empty">No matching employee records.</div>';return}
  const dayHeaders=Array.from({length:days},(_,index)=>{const label=dateLabel(year,month,index+1).split(' ');return `<th class="day-head" title="${escape(new Date(year,month-1,index+1).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}">${index+1}<small>${escape(label[0])}</small></th>`}).join('');
  const rows=visibleRows.map((employee,rowIndex)=>{
    const values=dayTotals[rowIndex],counts={Present:0,Absent:0,Late:0,'Half day':0,Rest:0,'Not marked':0};values.forEach(status=>{if(status in counts)counts[status]++});
    const name=employee.name||employee.employeeNameAadhaar||[employee.firstName,employee.surname].filter(Boolean).join(' ')||'Employee';
    const cells=values.map((status,index)=>`<td class="day-cell ${statusClass(status)}" title="${escape(dateLabel(year,month,index+1))}: ${escape(statusNames[status]||'Unscheduled')}">${statusShort(status)}</td>`).join('');
    return `<tr><td class="sr-cell">${escape(employee.srNo||'—')}</td><td class="code-cell">${escape(employee.employeeCode||employee.empCode||'—')}</td><td class="name-cell"><strong>${escape(name)}</strong><small>${escape(employee.designation||'')}</small></td>${cells}<td class="total-cell">${counts.Present}</td><td class="total-cell">${counts.Absent}</td><td class="total-cell">${counts.Late}</td><td class="total-cell">${counts['Half day']}</td><td class="total-cell">${counts.Rest}</td><td class="total-cell">${counts['Not marked']}</td></tr>`;
  }).join('');
  $('tablewrap').innerHTML=`<table><thead><tr><th class="sticky sr-cell">Sr.</th><th class="sticky code-cell">Employee Code</th><th class="sticky name-cell">Employee Name</th>${dayHeaders}<th class="total-head">P</th><th class="total-head">A</th><th class="total-head">L</th><th class="total-head">HD</th><th class="total-head">Rest</th><th class="total-head">Unmarked</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function statusClass(status){return {'Present':'present','Absent':'absent','Late':'late','Half day':'half','Rest':'rest','Not marked':'unmarked'}[status]||'unscheduled'}
function statusShort(status){return {'Present':'P','Absent':'A','Late':'L','Half day':'HD','Rest':'R','Not marked':'—','—':'·'}[status]||'·'}
async function load(){
  $('tablewrap').innerHTML='<div class="empty">Loading monthly attendance…</div>';$('summary').textContent='Loading attendance…';
  try{const range=monthRange(monthField.value);[attendanceRows,shiftRows]=await Promise.all([fetchMonth('attendance','employee_id,attendance_date,status','attendance_date',range.start,range.end),fetchMonth('shift_assignments','employee_id,work_date,shift','work_date',range.start,range.end)]);buildData()}
  catch(error){$('tablewrap').innerHTML='<div class="empty error">Could not load monthly attendance. '+escape(error.message||'Please check database access.')+'</div>';window.HRDB.status('Could not load monthly attendance: '+(error.message||'Check database access.'),true)}
}
function csv(value){let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'}
monthField.addEventListener('change',load);$('search').addEventListener('input',buildData);
$('export').addEventListener('click',()=>{
  const {days}=monthRange(monthField.value),attendance=new Map(),schedule=new Map();attendanceRows.forEach(row=>attendance.set(`${row.attendance_date}:${row.employee_id}`,row.status));shiftRows.forEach(row=>schedule.set(`${row.work_date}:${row.employee_id}`,row.shift));
  const header=['Sr. No.','Employee Code','Employee Name','Designation',...Array.from({length:days},(_,index)=>`${monthField.value}-${String(index+1).padStart(2,'0')}`),'Present','Absent','Late','Half day','Rest','Not marked'];
  const rows=visibleRows.map(employee=>{const values=Array.from({length:days},(_,index)=>statusFor(employee.id,`${monthField.value}-${String(index+1).padStart(2,'0')}`,schedule,attendance));const counts={Present:0,Absent:0,Late:0,'Half day':0,Rest:0,'Not marked':0};values.forEach(status=>{if(status in counts)counts[status]++});return[employee.srNo||'',employee.employeeCode||employee.empCode||'',employee.name||employee.employeeNameAadhaar||[employee.firstName,employee.surname].filter(Boolean).join(' '),employee.designation||'',...values.map(value=>statusNames[value]||'Unscheduled'),counts.Present,counts.Absent,counts.Late,counts['Half day'],counts.Rest,counts['Not marked']]});
  const blob=new Blob(['\ufeff'+[header,...rows].map(row=>row.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`monthly-attendance-${monthField.value}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
load();
