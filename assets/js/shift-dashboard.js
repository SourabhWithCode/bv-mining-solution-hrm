const KEY = 'shift-board-v1';
const shiftOptions = [['first','1st shift'],['second','2nd shift'],['night','Night shift'],['rest','Rest']];
const shiftNames = Object.fromEntries(shiftOptions);
let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || { members: [], schedule: {} }; }
catch { state = { members: [], schedule: {} }; }
state.overtime ||= {};
const $ = id => document.getElementById(id);
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};
let selected = today();
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
function activeMembers() {
  return state.members.filter(member => member.isActive !== false && !['Suspended','Resigned'].includes(member.employmentStatus || 'Active'));
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function labelDate(value) {
  return new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${value}T12:00:00`));
}
function initials(value) {
  return String(value || 'Employee').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
}
let timer;
function showToast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(()=>$('toast').classList.remove('show'),1800);
}
function updateAutoAttendance(date, employeeId, shift) {
  const attendanceKey = 'hr-attendance-v1';
  let attendance;
  try { attendance = JSON.parse(localStorage.getItem(attendanceKey)) || {days:{},auto:{},manualClear:{}}; }
  catch { attendance = {days:{},auto:{},manualClear:{}}; }
  attendance.days ||= {}; attendance.auto ||= {}; attendance.manualClear ||= {};
  attendance.days[date] ||= {}; attendance.auto[date] ||= {}; attendance.manualClear[date] ||= {};
  if (['first','second','night'].includes(shift)) {
    delete attendance.manualClear[date][employeeId];
    if (!attendance.days[date][employeeId] || attendance.auto[date][employeeId]) {
      attendance.days[date][employeeId] = 'Present';
      attendance.auto[date][employeeId] = true;
    }
  } else {
    delete attendance.manualClear[date][employeeId];
    if (attendance.auto[date][employeeId]) {
      delete attendance.days[date][employeeId];
      delete attendance.auto[date][employeeId];
    }
  }
  localStorage.setItem(attendanceKey,JSON.stringify(attendance));
}
function renderShiftBreakdown(day) {
  const groups = {first:[],second:[],night:[],rest:[]};
  activeMembers().forEach(member => {
    const shift = day[member.id] || 'rest';
    (groups[shift] || groups.rest).push(member.name || member.employeeNameAadhaar || member.employeeCode || 'Employee');
  });
  $('shiftBreakdown').innerHTML = Object.entries(groups).map(([key,names]) =>
    `<div class="shiftcard"><div class="shiftcardtop"><span>${shiftNames[key]}</span><span>${names.length} people</span></div><div class="shiftcardcount">${names.length}</div><div class="shiftcardnames">${names.length ? names.map(escapeHtml).join(' · ') : 'No employees assigned'}</div></div>`
  ).join('');
}
function render() {
  $('dateInput').value = selected;
  $('dateTitle').textContent = selected === today() ? "Today's schedule" : labelDate(selected);
  $('rosterTitle').textContent = selected === today() ? "Today's team" : `${labelDate(selected)} team`;
  const day = state.schedule[selected] || {};
  const overtime = state.overtime[selected] || {};
  const members = activeMembers();
  const counts = {first:0,second:0,night:0,rest:0};
  members.forEach(member => counts[day[member.id] || 'rest']++);
  $('totalCount').textContent = members.length;
  $('firstCount').textContent = counts.first;
  $('secondCount').textContent = counts.second;
  $('nightCount').textContent = counts.night;
  $('restCount').textContent = counts.rest;
  $('memberSummary').textContent = `${members.length} ${members.length === 1 ? 'member' : 'members'}`;
  renderShiftBreakdown(day);

  const overtimeEntries = Object.values(overtime).filter(entry => Number(entry?.hours) > 0);
  $('otHoursTotal').textContent = overtimeEntries.reduce((sum,entry)=>sum+Number(entry.hours||0),0).toFixed(2)+' h';
  $('otPeopleCount').textContent = `· ${overtimeEntries.length} employee${overtimeEntries.length === 1 ? '' : 's'}`;

  if (!members.length) {
    $('roster').innerHTML = '<div class="empty">No active employees available for scheduling.<br>Check Employee status in Employees Data.</div>';
  } else {
    $('roster').innerHTML = `<div class="tablewrap"><table class="table"><thead><tr><th>Member</th><th>Shift</th><th>OT hours</th><th>OT reason</th></tr></thead><tbody>${members.map(member=>{
      const shift = day[member.id] || 'rest';
      const overtimeRecord = overtime[member.id] || {};
      const hours = Number(overtimeRecord.hours) || 0;
      const name = member.name || member.employeeNameAadhaar || member.employeeCode || 'Employee';
      const savedShift = Object.hasOwn(day,member.id);
      const savedOt = Object.hasOwn(overtime,member.id);
      return `<tr><td><div class="person"><div class="avatar">${initials(name)}</div>${escapeHtml(name)}</div><small class="employee-code">${escapeHtml(member.employeeCode||member.empCode||'')}</small></td><td><select class="select" data-shift="${escapeHtml(member.id)}" ${window.HRDB.canEdit||!savedShift?'':'data-existing-record'}>${shiftOptions.map(([value,label])=>`<option value="${value}" ${shift===value?'selected':''}>${label}</option>`).join('')}</select></td><td><input class="otinput" type="number" min="0" max="24" step="0.25" value="${hours||''}" data-ot-hours="${escapeHtml(member.id)}" ${window.HRDB.canEdit||!savedOt?'':'data-existing-record'} aria-label="Overtime request hours for ${escapeHtml(name)}"></td><td><input class="reasoninput" maxlength="100" value="${escapeHtml(overtimeRecord.reason||'')}" data-ot-reason="${escapeHtml(member.id)}" ${window.HRDB.canEdit||!savedOt?'':'data-existing-record'} placeholder="Overtime request reason"></td></tr>`;
    }).join('')}</tbody></table></div>`;
    $('roster').querySelectorAll('[data-shift]').forEach(select=>select.onchange=()=>{
      state.schedule[selected] ||= {};
      state.schedule[selected][select.dataset.shift] = select.value;
      updateAutoAttendance(selected,select.dataset.shift,select.value);
      save(); render(); showToast('Shift and attendance updated');
    });
    $('roster').querySelectorAll('[data-ot-hours],[data-ot-reason]').forEach(input=>input.onchange=()=>{
      state.overtime[selected] ||= {};
      const id = input.dataset.otHours || input.dataset.otReason;
      state.overtime[selected][id] ||= {hours:'',reason:'',approvalStatus:'Pending'};
      if (input.dataset.otHours) {
        const previousHours = Number(state.overtime[selected][id].hours) || 0;
        const hours = Number(input.value) || 0;
        state.overtime[selected][id].hours = Math.min(24,Math.max(0,hours));
        if (previousHours !== Number(state.overtime[selected][id].hours) && state.overtime[selected][id].approvalStatus !== 'Pending') {
          state.overtime[selected][id].approvalStatus = 'Pending';
          state.overtime[selected][id].approvedBy = '';
          state.overtime[selected][id].approvedAt = '';
        }
        if (hours > 0 && !state.overtime[selected][id].approvalStatus) state.overtime[selected][id].approvalStatus = 'Pending';
      } else {
        const reason = input.value.trim();
        if (reason !== (state.overtime[selected][id].reason || '') && state.overtime[selected][id].approvalStatus !== 'Pending') {
          state.overtime[selected][id].approvalStatus = 'Pending';
          state.overtime[selected][id].approvedBy = '';
          state.overtime[selected][id].approvedAt = '';
        }
        state.overtime[selected][id].reason = reason;
      }
      if (!Number(state.overtime[selected][id].hours) && !state.overtime[selected][id].reason) delete state.overtime[selected][id];
      save(); render(); showToast('Overtime updated');
    });
  }

  const query = $('searchInput').value.trim().toLocaleLowerCase();
  const matches = query ? members.filter(member=>`${member.name||''} ${member.employeeNameAadhaar||''} ${member.firstName||''} ${member.surname||''} ${member.employeeCode||member.empCode||''} ${member.designation||''}`.toLocaleLowerCase().includes(query)) : [];
  $('members').innerHTML = !query
    ? '<div class="empty" style="padding:20px 5px">Enter an Employee Code or name to find a person.</div>'
    : matches.length ? matches.map(member=>{
      const shift = day[member.id] || 'rest';
      const name = member.name || member.employeeNameAadhaar || member.employeeCode || member.empCode || 'Employee';
      const savedShift = Object.hasOwn(day,member.id);
      return `<div class="member"><div class="membername"><div class="avatar">${initials(name)}</div><span>${escapeHtml(name)}<small class="membermeta">${escapeHtml(member.employeeCode||member.empCode||'No employee code')} · ${escapeHtml(member.designation||'')}</small></span></div><select class="quickselect" data-quick-shift="${escapeHtml(member.id)}" ${window.HRDB.canEdit||!savedShift?'':'data-existing-record'} aria-label="${escapeHtml(name)} shift">${shiftOptions.map(([value,label])=>`<option value="${value}" ${shift===value?'selected':''}>${label}</option>`).join('')}</select></div>`;
    }).join('') : '<div class="empty" style="padding:20px 5px">No employee found for that code or name.</div>';
  $('members').querySelectorAll('[data-quick-shift]').forEach(select=>select.onchange=()=>{
    state.schedule[selected] ||= {};
    state.schedule[selected][select.dataset.quickShift] = select.value;
    updateAutoAttendance(selected,select.dataset.quickShift,select.value);
    save(); render(); showToast('Shift and attendance updated');
  });
}
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g,'""')}"`;
}
function exportShiftReport() {
  const day = state.schedule[selected] || {};
  const overtime = state.overtime[selected] || {};
  const rows = [[
    'Work Date','Employee Code','Employee Name','Designation','Department','Location','Shift','Overtime Hours','Overtime Reason'
  ]];
  activeMembers().forEach(member=>{
    const record = overtime[member.id] || {};
    rows.push([
      selected,member.employeeCode||member.empCode||'',member.name||member.employeeNameAadhaar||'',member.designation||'',member.department||'',member.location||'',shiftNames[day[member.id]||'rest'],Number(record.hours)||0,record.reason||''
    ]);
  });
  const blob = new Blob(['\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `bv-mining-shift-report-${selected}.csv`; anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('searchInput').addEventListener('input',render);
$('dateInput').addEventListener('change',event=>{selected=event.target.value||today();render()});
$('prev').onclick=()=>move(-1);
$('next').onclick=()=>move(1);
function move(amount) {
  const date = new Date(`${selected}T12:00:00`);
  date.setDate(date.getDate()+amount);
  selected = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  render();
}
$('todayBtn').onclick=()=>{selected=today();render()};
$('exportShiftReport').addEventListener('click',exportShiftReport);
render();
