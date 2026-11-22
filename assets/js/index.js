const SHIFT_KEY='shift-board-v1';
const ISSUE_KEY='hr-item-issues-v1';
const $=id=>document.getElementById(id);
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
let selectedDate=today();
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
}
function moveDate(amount){
 const d=new Date(selectedDate+'T12:00:00');d.setDate(d.getDate()+amount);
 selectedDate=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 render();
}
$('dashboardDate').addEventListener('change',e=>{selectedDate=e.target.value||today();render()});
$('prevDate').addEventListener('click',()=>moveDate(-1));
$('nextDate').addEventListener('click',()=>moveDate(1));
$('todayBtn').addEventListener('click',()=>{selectedDate=today();render()});
render();window.addEventListener('storage',render);
