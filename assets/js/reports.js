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
makeReport();
