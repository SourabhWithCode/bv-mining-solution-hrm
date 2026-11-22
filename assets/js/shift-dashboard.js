const KEY='shift-board-v1';
const options=[['first','1st shift'],['second','2nd shift'],['night','Night shift'],['rest','Rest']];
const shiftNames={first:'1st shift',second:'2nd shift',night:'Night shift',rest:'Rest'};
let state;
try{state=JSON.parse(localStorage.getItem(KEY))||{members:[],schedule:{}}}catch{state={members:[],schedule:{}}}
state.overtime=state.overtime||{};
const $=id=>document.getElementById(id);
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
let selected=today();
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function labelDate(s){return new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(s+'T12:00:00'))}
function initials(n){return String(n||'Employee').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
let timer;
function showToast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('toast').classList.remove('show'),1800)}
function renderShiftBreakdown(day){const groups={first:[],second:[],night:[],rest:[]};state.members.forEach(m=>{const shift=day[m.id]||'rest';(groups[shift]||groups.rest).push(m.name||m.employeeNameAadhaar||m.employeeCode||'Employee')});$('shiftBreakdown').innerHTML=Object.entries(groups).map(([key,names])=>'<div class="shiftcard"><div class="shiftcardtop"><span>'+shiftNames[key]+'</span><span>'+names.length+' people</span></div><div class="shiftcardcount">'+names.length+'</div><div class="shiftcardnames">'+(names.length?names.map(escapeHtml).join(' · '):'No employees assigned')+'</div></div>').join('')}
function render(){
 $('dateInput').value=selected;
 $('dateTitle').textContent=selected===today()?"Today's schedule":labelDate(selected);
 const day=state.schedule[selected]||{};
 const overtime=state.overtime[selected]||{};
 const counts={first:0,second:0,night:0,rest:0};
 state.members.forEach(m=>counts[day[m.id]||'rest']++);
 $('totalCount').textContent=state.members.length;$('firstCount').textContent=counts.first;$('secondCount').textContent=counts.second;$('nightCount').textContent=counts.night;$('restCount').textContent=counts.rest;
 $('memberSummary').textContent=`${state.members.length} ${state.members.length===1?'member':'members'}`;
 renderShiftBreakdown(day);
 const otEntries=Object.values(overtime).filter(x=>Number(x?.hours)>0);$('otHoursTotal').textContent=otEntries.reduce((sum,x)=>sum+Number(x.hours||0),0).toFixed(2)+' h';$('otPeopleCount').textContent='· '+otEntries.length+' employee'+(otEntries.length===1?'':'s');
 if(!state.members.length){$('roster').innerHTML='<div class="empty">No employees yet.<br>Add an employee on the right to start scheduling.</div>'}
 else{$('roster').innerHTML=`<div class="tablewrap"><table class="table"><thead><tr><th>Member</th><th>Shift</th><th>OT hours</th><th>OT reason</th></tr></thead><tbody>${state.members.map(m=>{const val=day[m.id]||'rest',ot=overtime[m.id]||{},name=m.name||m.employeeNameAadhaar||m.employeeCode||'Employee';return `<tr><td><div class="person"><div class="avatar">${initials(name)}</div>${escapeHtml(name)}</div></td><td><select class="select" data-id="${m.id}">${options.map(([v,l])=>`<option value="${v}" ${val===v?'selected':''}>${l}</option>`).join('')}</select></td><td><input class="otinput" type="number" min="0" max="24" step="0.25" value="${Number(ot.hours)||''}" data-ot-hours="${m.id}" aria-label="Overtime hours for ${escapeHtml(name)}"></td><td><input class="reasoninput" maxlength="100" value="${escapeHtml(ot.reason||'')}" data-ot-reason="${m.id}" placeholder="Reason (optional)"></td></tr>`}).join('')}</tbody></table></div>`;$('roster').querySelectorAll('select[data-id]').forEach(s=>s.onchange=()=>{state.schedule[selected]??={};state.schedule[selected][s.dataset.id]=s.value;save();render()});$('roster').querySelectorAll('[data-ot-hours],[data-ot-reason]').forEach(input=>input.onchange=()=>{state.overtime[selected]??={};const id=input.dataset.otHours||input.dataset.otReason;state.overtime[selected][id]??={hours:'',reason:''};if(input.dataset.otHours)state.overtime[selected][id].hours=Math.min(24,Math.max(0,Number(input.value)||0));else state.overtime[selected][id].reason=input.value.trim();if(!state.overtime[selected][id].hours&&!state.overtime[selected][id].reason)delete state.overtime[selected][id];save();render();showToast('Overtime updated')})}
 const query=$('searchInput').value.trim().toLocaleLowerCase();
 const matches=query?state.members.filter(m=>`${m.name||''} ${m.employeeNameAadhaar||''} ${m.firstName||''} ${m.surname||''} ${m.employeeCode||m.empCode||''} ${m.designation||''}`.toLocaleLowerCase().includes(query)):[];
 $('members').innerHTML=!query?'<div class="empty" style="padding:20px 5px">Enter an Employee Code or name to find a person.</div>':matches.length?matches.map(m=>{const val=day[m.id]||'rest',name=m.name||m.employeeNameAadhaar||m.employeeCode||m.empCode||'Employee';return `<div class="member"><div class="membername"><div class="avatar">${initials(name)}</div><span>${escapeHtml(name)}<small class="membermeta">${escapeHtml(m.employeeCode||m.empCode||'No employee code')} · ${escapeHtml(m.designation||'')}</small></span></div><select class="quickselect" data-shift="${m.id}" aria-label="${escapeHtml(name)} shift">${options.map(([v,l])=>`<option value="${v}" ${val===v?'selected':''}>${l}</option>`).join('')}</select></div>`}).join(''):'<div class="empty" style="padding:20px 5px">No employee found for that code or name.</div>';
 $('members').querySelectorAll('[data-shift]').forEach(s=>s.onchange=()=>{state.schedule[selected]??={};state.schedule[selected][s.dataset.shift]=s.value;save();render();showToast('Shift updated')});
}
$('searchInput').addEventListener('input',render);
$('dateInput').addEventListener('change',e=>{selected=e.target.value||today();render()});
$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);
function move(n){const d=new Date(selected+'T12:00:00');d.setDate(d.getDate()+n);selected=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;render()}
$('todayBtn').onclick=()=>{selected=today();render()};
render();





