const KEY = 'hr-leave-v1';
const SHIFT_KEY = 'shift-board-v1';
const $ = id => document.getElementById(id);

let records;
try {
  records = JSON.parse(localStorage.getItem(KEY)) || [];
} catch {
  records = [];
}

let timer;
function save() {
  localStorage.setItem(KEY, JSON.stringify(records));
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => $('toast').classList.remove('show'), 1600);
}
function refreshPeople() {
  let names = [];
  try {
    names = JSON.parse(localStorage.getItem(SHIFT_KEY))?.members?.map(member => member.name) || [];
  } catch {}
  $('people').innerHTML = [...new Set(names)].map(name => `<option value="${esc(name)}">`).join('');
}
function render() {
  refreshPeople();
  const query = $('search').value.trim().toLowerCase();
  const filter = $('statusFilter').value;
  const list = records
    .filter(record => (`${record.employee} ${record.type}`).toLowerCase().includes(query) && (filter === 'All' || record.status === filter))
    .sort((a, b) => b.start.localeCompare(a.start));

  if (!list.length) {
    $('requests').innerHTML = '<div class="empty">No leave requests match these filters.</div>';
    return;
  }

  const canApprove = window.HRDB.canEdit;
  const statusTone = { Pending: 'pending', Approved: 'approved', Rejected: 'rejected', Cancelled: 'cancelled' };
  $('requests').innerHTML = `<div class="tablewrap"><table class="table"><thead><tr><th>Employee</th><th>Leave type</th><th>Dates</th><th>Reason</th><th>Status</th></tr></thead><tbody>${list.map(record => {
    const status = record.status || 'Pending';
    const tone = statusTone[status] || 'pending';
    const statusCell = canApprove
      ? `<select class="status" data-status="${esc(status)}" data-id="${esc(record.id)}">${['Pending', 'Approved', 'Rejected', 'Cancelled'].map(option => `<option ${status === option ? 'selected' : ''}>${option}</option>`).join('')}</select>`
      : `<span class="leave-status status-${tone}">${esc(status)}</span>`;
    return `<tr><td>${esc(record.employee)}</td><td>${esc(record.type)}</td><td>${esc(record.start)}${record.end === record.start ? '' : ` – ${esc(record.end)}`}</td><td>${esc(record.reason || '—')}</td><td>${statusCell}</td></tr>`;
  }).join('')}</tbody></table></div>`;

  $('requests').querySelectorAll('[data-id]').forEach(select => {
    select.addEventListener('change', () => {
      if (!window.HRDB.canEdit) return;
      const record = records.find(item => item.id === select.dataset.id);
      if (!record) return;
      select.dataset.status = select.value;
      record.status = select.value;
      record.updatedAt = new Date().toISOString();
      save();
      toast('Request status updated');
    });
  });
}

$('leaveForm').addEventListener('submit', event => {
  event.preventDefault();
  const employee = $('employee').value.trim();
  const type = $('leaveType').value;
  const start = $('startDate').value;
  const end = $('endDate').value;
  const reason = $('reason').value.trim();
  if (end < start) {
    toast('End date must be on or after the start date');
    return;
  }
  records.push({ id: crypto.randomUUID(), employee, employeeCode: '', type, start, end, reason, status: 'Pending', submittedBy: window.HRDB.user?.id, createdAt: new Date().toISOString() });
  save();
  $('leaveForm').reset();
  render();
  toast('Leave request submitted');
});

$('search').addEventListener('input', render);
$('statusFilter').addEventListener('change', render);
window.addEventListener('storage', render);
render();
