(() => {
  const client = window.HRDB.client;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
  const moduleNames = {
    user_profiles:'User management', employees:'Employees', shift_assignments:'Shift board',
    attendance:'Attendance', leave_requests:'Leave', ppe_items:'Stock items',
    ppe_issues:'PPE issues', ppe_stock_movements:'Stock movements', overtime_entries:'Overtime'
  };
  let events = [];
  let filteredEvents = [];

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { dateStyle:'medium', timeStyle:'short' }).format(date);
  }

  async function loadApprovals() {
    const target = $('approvals');
    target.innerHTML = '<div class="empty">Loading approvals…</div>';
    const { data: requests, error } = await client.from('leave_requests')
      .select('id,employee_id,leave_type,start_date,end_date,reason,status,submitted_by,created_at')
      .eq('status','Pending').order('created_at',{ascending:true});
    if (error) {
      target.innerHTML = `<div class="error">Could not load pending leave requests: ${esc(error.message)}</div>`;
      return;
    }
    const pending = requests || [];
    $('pendingCount').textContent = `${pending.length} pending`;
    if (!pending.length) {
      target.innerHTML = '<div class="empty">There are no leave requests waiting for approval.</div>';
      return;
    }
    const employeeIds = [...new Set(pending.map(request => request.employee_id).filter(Boolean))];
    let people = new Map();
    if (employeeIds.length) {
      const { data, error: peopleError } = await client.from('employees').select('id,employee_name,employee_code').in('id',employeeIds);
      if (peopleError) {
        target.innerHTML = `<div class="error">Could not load employee names: ${esc(peopleError.message)}</div>`;
        return;
      }
      people = new Map((data || []).map(person => [person.id,person]));
    }
    target.innerHTML = `<table class="table"><thead><tr><th>Employee</th><th>Leave type</th><th>Dates</th><th>Reason</th><th>Applied</th><th>Decision</th></tr></thead><tbody>${pending.map(request => {
      const person = people.get(request.employee_id) || {};
      const name = person.employee_name || person.employee_code || 'Employee';
      const dates = request.start_date === request.end_date ? esc(request.start_date) : `${esc(request.start_date)} – ${esc(request.end_date)}`;
      return `<tr><td><strong>${esc(name)}</strong><div class="muted">${esc(person.employee_code || '')}</div></td><td>${esc(request.leave_type)}</td><td>${dates}</td><td>${esc(request.reason || '—')}</td><td>${esc(formatDate(request.created_at))}</td><td><div class="actions"><button class="button approve" type="button" data-decision="Approved" data-id="${esc(request.id)}">Approve</button><button class="button reject" type="button" data-decision="Rejected" data-id="${esc(request.id)}">Reject</button></div></td></tr>`;
    }).join('')}</tbody></table>`;
    target.querySelectorAll('[data-decision]').forEach(button => button.addEventListener('click', () => decideLeave(button)));
  }

  async function decideLeave(button) {
    const requestId = button.dataset.id;
    const decision = button.dataset.decision;
    button.disabled = true;
    const label = button.textContent;
    button.textContent = 'Saving…';
    const { error } = await client.from('leave_requests')
      .update({ status:decision, updated_at:new Date().toISOString() })
      .eq('id',requestId);
    if (error) {
      window.HRDB.status(`Could not ${decision.toLowerCase()} leave: ${error.message}`,true);
      button.disabled = false;
      button.textContent = label;
      return;
    }
    window.HRDB.status(`Leave request ${decision.toLowerCase()}.`);
    await Promise.all([loadApprovals(),loadAudit()]);
  }

  async function loadAudit() {
    const table = $('auditTable');
    table.innerHTML = '<div class="empty">Loading audit history…</div>';
    const { data, error } = await client.from('audit_logs').select('*').order('event_at',{ascending:false}).limit(500);
    if (error) {
      table.innerHTML = `<div class="error">Could not load audit history: ${esc(error.message)}</div>`;
      $('auditSummary').textContent = '';
      return;
    }
    events = data || [];
    const modules = [...new Set(events.map(event => event.table_name))].sort();
    const selectedModule = $('moduleFilter').value;
    $('moduleFilter').innerHTML = '<option value="">All modules</option>' + modules.map(module => `<option value="${esc(module)}">${esc(moduleNames[module] || module)}</option>`).join('');
    if (modules.includes(selectedModule)) $('moduleFilter').value = selectedModule;
    renderAudit();
  }

  function renderAudit() {
    const query = $('auditSearch').value.trim().toLowerCase();
    const module = $('moduleFilter').value;
    const from = $('fromDate').value;
    const to = $('toDate').value;
    filteredEvents = events.filter(event => {
      const day = String(event.event_at || '').slice(0,10);
      const haystack = `${event.actor_name || ''} ${event.actor_email || ''} ${event.table_name || ''} ${event.action || ''} ${event.record_id || ''} ${JSON.stringify(event.changes || {})}`.toLowerCase();
      return (!query || haystack.includes(query)) && (!module || event.table_name === module) && (!from || day >= from) && (!to || day <= to);
    });
    $('auditSummary').textContent = `Showing ${filteredEvents.length} of ${events.length} audit events (maximum 500 loaded).`;
    if (!filteredEvents.length) {
      $('auditTable').innerHTML = '<div class="empty">No audit events match these filters.</div>';
      return;
    }
    $('auditTable').innerHTML = `<table class="table"><thead><tr><th>Date / time</th><th>Actor</th><th>Action</th><th>Module</th><th>Record</th><th>Changes</th></tr></thead><tbody>${filteredEvents.map(event => {
      const changes = event.changes || {};
      const keys = Object.keys(changes).filter(key => !['before','after'].includes(key));
      const summary = keys.length ? keys.join(', ') : event.action === 'INSERT' ? 'New record' : event.action === 'DELETE' ? 'Record removed' : 'Record updated';
      return `<tr><td>${esc(formatDate(event.event_at))}</td><td><strong>${esc(event.actor_name || 'System')}</strong><div class="muted">${esc(event.actor_email || '')}</div></td><td><span class="status status-${esc(event.action.toLowerCase())}">${esc(event.action)}</span></td><td>${esc(moduleNames[event.table_name] || event.table_name)}</td><td>${esc(event.record_id || '—')}</td><td><details><summary>${esc(summary)}</summary><pre>${esc(JSON.stringify(changes,null,2))}</pre></details></td></tr>`;
    }).join('')}</tbody></table>`;
  }

  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g,'""')}"`;
  }
  $('exportAudit').addEventListener('click',() => {
    const rows = [['Date / time','Actor','Email','Action','Module','Record ID','Changes'],...filteredEvents.map(event => [event.event_at,event.actor_name,event.actor_email,event.action,moduleNames[event.table_name] || event.table_name,event.record_id,JSON.stringify(event.changes || {})])];
    const blob = new Blob(['\ufeff'+rows.map(row => row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'bv-mining-audit-log.csv'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  });
  ['auditSearch','moduleFilter','fromDate','toDate'].forEach(id => $(id).addEventListener(id === 'auditSearch' ? 'input' : 'change',renderAudit));
  $('clearFilters').addEventListener('click',() => { $('auditSearch').value=''; $('moduleFilter').value=''; $('fromDate').value=''; $('toDate').value=''; renderAudit(); });

  Promise.all([loadApprovals(),loadAudit()]).catch(error => window.HRDB.status(`Could not load audit page: ${error.message}`,true));
})();
