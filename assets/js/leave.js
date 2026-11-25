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
let editingId = '';
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
function formatSubmittedAt(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (!list.length) {
    $('requests').innerHTML = '<div class="empty">No leave requests match these filters.</div>';
    return;
  }

  const canApprove = window.HRDB.canApprove;
  const statusOptions = window.HRDB.role==='admin' ? ['Pending','Approved','Rejected','Cancelled'] : ['Pending','Approved','Rejected'];
  const statusTone = { Pending: 'pending', Approved: 'approved', Rejected: 'rejected', Cancelled: 'cancelled' };
    $('requests').innerHTML = `<div class="tablewrap"><table class="table"><thead><tr><th>Employee</th><th>Leave type</th><th>Leave dates</th><th>Applied on</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead><tbody>${list.map(record => {
    const status = record.status || 'Pending';
    const tone = statusTone[status] || 'pending';
    const statusCell = canApprove && (window.HRDB.role==='admin' || status!=='Cancelled')
      ? `<select class="status" data-status="${esc(status)}" data-id="${esc(record.id)}">${statusOptions.map(option => `<option ${status === option ? 'selected' : ''}>${option}</option>`).join('')}</select>`
      : `<span class="leave-status status-${tone}">${esc(status)}</span>`;
    const canManage = window.HRDB.role === 'admin' || (record.submittedBy === window.HRDB.user?.id && status === 'Pending');
    const actions = canManage ? `<button type="button" class="row-action" data-owner-action data-action="edit" data-id="${esc(record.id)}">Edit</button><button type="button" class="row-action danger" data-owner-action data-action="delete" data-id="${esc(record.id)}">Delete</button>` : '—';
    return `<tr><td>${esc(record.employee)}</td><td>${esc(record.type)}</td><td>${esc(record.start)}${record.end === record.start ? '' : ` – ${esc(record.end)}`}</td><td>${esc(formatSubmittedAt(record.createdAt))}</td><td>${esc(record.reason || '—')}</td><td>${statusCell}</td><td>${actions}</td></tr>`;
  }).join('')}</tbody></table></div>`;

  $('requests').querySelectorAll('[data-id]').forEach(select => {
    if (select.tagName === 'BUTTON') return;
    select.addEventListener('change', () => {
      if (!window.HRDB.canApprove) return;
      const record = records.find(item => item.id === select.dataset.id);
      if (!record) return;
      select.dataset.status = select.value;
      record.status = select.value;
      record.updatedAt = new Date().toISOString();
      save();
      toast('Request status updated');
    });
  });
  $('requests').querySelectorAll('button[data-action="edit"]').forEach(button => button.addEventListener('click', () => editRequest(button.dataset.id)));
  $('requests').querySelectorAll('button[data-action="delete"]').forEach(button => button.addEventListener('click', () => deleteRequest(button.dataset.id)));
}

function editRequest(id) {
  const record = records.find(item => item.id === id);
  if (!record || (window.HRDB.role !== 'admin' && (record.submittedBy !== window.HRDB.user?.id || record.status !== 'Pending'))) return;
  editingId = id;
  $('leaveSubmit').setAttribute('data-owner-action', '');
  $('employee').value = record.employee || '';
  $('leaveType').value = record.type || '';
  $('startDate').value = record.start || '';
  $('endDate').value = record.end || '';
  $('reason').value = record.reason || '';
  $('leaveSubmit').textContent = 'Save changes';
  $('cancelLeaveEdit').hidden = false;
  $('formTitle').textContent = 'Edit leave request';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetLeaveForm() {
  editingId = '';
  $('leaveForm').reset();
  $('leaveSubmit').textContent = 'Submit request';
  $('leaveSubmit').removeAttribute('data-owner-action');
  $('cancelLeaveEdit').hidden = true;
  $('formTitle').textContent = 'New leave request';
}

function deleteRequest(id) {
  const record = records.find(item => item.id === id);
  if (!record || (window.HRDB.role !== 'admin' && (record.submittedBy !== window.HRDB.user?.id || record.status !== 'Pending'))) return;
  if (!window.confirm('Delete this leave request? This cannot be undone.')) return;
  records = records.filter(item => item.id !== id);
  if (editingId === id) resetLeaveForm();
  save();
  render();
  toast('Leave request deleted');
}

$('leaveForm').addEventListener('submit', async event => {
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
  const isUpdate = Boolean(editingId);
  if (isUpdate) {
    const record = records.find(item => item.id === editingId);
    if (!record || (window.HRDB.role !== 'admin' && (record.submittedBy !== window.HRDB.user?.id || record.status !== 'Pending'))) return;
    Object.assign(record, { employee, type, start, end, reason, updatedAt: new Date().toISOString() });
  } else {
    records.push({ id: crypto.randomUUID(), employee, employeeCode: '', type, start, end, reason, status: 'Pending', submittedBy: window.HRDB.user?.id, createdAt: new Date().toISOString() });
  }
  save();
  let updateSynced = true;
  if (isUpdate) {
    try {
      await window.HRDB.flushKey(KEY);
    } catch (error) {
      updateSynced = false;
      window.HRDB.status(`Leave edit is kept on this device but is not synced yet: ${error.message || 'Check Supabase access.'}`, true);
    }
  }
  resetLeaveForm();
  render();
  toast(isUpdate ? (updateSynced ? 'Leave request updated' : 'Leave edit waiting to sync') : 'Leave request submitted');
});

$('cancelLeaveEdit').addEventListener('click', resetLeaveForm);

$('search').addEventListener('input', render);
$('statusFilter').addEventListener('change', render);
window.addEventListener('storage', render);
render();
