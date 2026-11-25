(() => {
  const { client } = window.HRDB;
  const form = document.getElementById('createUserForm');
  const feedback = document.getElementById('feedback');
  const createButton = document.getElementById('createButton');
  const rows = document.getElementById('userRows');
  const dialog = document.getElementById('editUserDialog');
  const editForm = document.getElementById('editUserForm');
  const editFeedback = document.getElementById('editFeedback');
  const saveButton = document.getElementById('saveUser');
  const roleName = { admin: 'Admin', hr: 'HR', accountant: 'Accountant', store: 'Store', mechanical: 'Mechanical', mine_mate: 'Mine Mate', foreman: 'Foreman', project_manager: 'Project Manager', assistant_project_manager: 'Assistant Project Manager', director:'Director' };
  const roles = ['admin','hr','accountant','store','mechanical','mine_mate','foreman','project_manager','assistant_project_manager','director'];
  const pages = [
    ['dashboard','Dashboard',roles],['employee_records','Employee Records',['admin','hr']],['employees_data','Employees Data',['admin','hr']],
    ['shift_board','Shift Board',['admin','mine_mate','foreman']],['mining_report','Mining Report',['admin','mine_mate','foreman']],
    ['attendance','Attendance',['admin','hr']],['monthly_attendance','Monthly Attendance',['admin','hr']],['leave','Leave',roles],
    ['stock_management','Stock Management',['admin','store']],['ppe_issue_records','PPE Issue Records',['admin','store']],
    ['stock_returns','Stock & Returns',['admin','store']],['reports','Reports',['admin','hr']],['accounting','Accounting',['admin','hr','accountant','director']],['audit_log','Audit Log & Approvals',['admin']],['user_management','User Management',['admin']]
  ];
  const adminOnlyPages=new Set(['audit_log','user_management']);
  const defaultAccess = role => Object.fromEntries(pages.filter(([, , allowed])=>allowed.includes(role)).map(([key])=>[key,true]));
  const selectedKeys = (access,role) => {
    if(role==='admin')return pages.map(([key])=>key);
    const effective=access&&Object.keys(access).length?access:defaultAccess(role);
    return pages.filter(([key])=>!adminOnlyPages.has(key)&&effective[key]===true).map(([key])=>key);
  };
  function renderAccessOptions(container,role,access){
    const isAdmin=role==='admin';const selected=new Set(selectedKeys(access,role));
    container.replaceChildren();
    pages.forEach(([key,label,allowed])=>{
      const roleRestricted=key==='accounting'&&!allowed.includes(role);const canGrant=isAdmin||(!adminOnlyPages.has(key)&&!roleRestricted);const item=document.createElement('label');item.className=`access-option${canGrant?'':' unavailable'}`;
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.name='pageAccess';checkbox.value=key;checkbox.checked=isAdmin||selected.has(key);checkbox.disabled=isAdmin||!canGrant||key==='dashboard';
      const text=document.createElement('span');text.textContent=label;
      item.append(checkbox,text);if(!canGrant){const hint=document.createElement('small');hint.textContent=roleRestricted?'Restricted to Admin, HR, Accountant, and Director':'Admin only';item.append(hint)}container.append(item);
    });
    const note=document.createElement('p');note.className='access-note';note.textContent=isAdmin?'Admin has full access to every page.':'Choose any page for this user. Dashboard access is always on; Audit Log and User Management are Admin only.';container.append(note);
  }
  const collectAccess=(container,role)=>role==='admin'?Object.fromEntries(pages.map(([key])=>[key,true])):Object.fromEntries([...container.querySelectorAll('input[name="pageAccess"]:checked')].map(input=>[input.value,true]));
  const accessSummary=(user)=>user.role==='admin'?'Full access':selectedKeys(user.page_access,user.role).map(key=>pages.find(page=>page[0]===key)?.[1]).filter(Boolean).join(', ')||'Dashboard only';
  const sameAccess=(left,right)=>JSON.stringify(Object.keys(left||{}).filter(key=>left[key]===true).sort())===JSON.stringify(Object.keys(right||{}).filter(key=>right[key]===true).sort());

  function setMessage(target, text, error = false) {
    target.textContent = text;
    target.classList.toggle('error', error);
  }

  async function invokeManager(body) {
    const { data, error } = await client.functions.invoke('admin-manage-user', { body });
    if (error) {
      let detail = error.message;
      try {
        const response = await error.context.json();
        if (response?.error) detail = response.error;
      } catch {}
      throw new Error(detail);
    }
    return data;
  }

  function addCell(row, value) {
    const cell = document.createElement('td');
    cell.textContent = value || '—';
    row.append(cell);
    return cell;
  }

  function showEdit(user) {
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editFullName').value = user.full_name || '';
    document.getElementById('editDesignation').value = user.designation || '';
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editRole').value = user.role || 'accountant';
    renderAccessOptions(document.getElementById('editPageAccessOptions'),user.role||'accountant',user.page_access);
    setMessage(editFeedback, '');
    dialog.showModal();
    document.getElementById('editFullName').focus();
  }

  async function loadUsers() {
    rows.innerHTML = '<tr><td class="empty" colspan="7">Loading users…</td></tr>';
    const { data, error } = await client.from('user_profiles')
      .select('id,full_name,designation,email,role,page_access,created_at')
      .order('created_at', { ascending: false });
    if (error) {
      rows.replaceChildren();
      const row = document.createElement('tr');
      const cell = addCell(row, `Could not load users: ${error.message}`);
      cell.colSpan = 7;
      cell.className = 'empty';
      rows.append(row);
      return;
    }
    rows.replaceChildren();
    if (!data?.length) {
      const row = document.createElement('tr');
      const cell = addCell(row, 'No application users found.');
      cell.colSpan = 7;
      cell.className = 'empty';
      rows.append(row);
      return;
    }

    const currentUserId = window.HRDB.user?.id;
    data.forEach(user => {
      const row = document.createElement('tr');
      addCell(row, user.full_name);
      addCell(row, user.email);
      addCell(row, user.designation);
      const roleCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'role';
      badge.textContent = roleName[user.role] || user.role || '—';
      roleCell.append(badge);
      row.append(roleCell);
      addCell(row, accessSummary(user));
      addCell(row, user.created_at ? new Date(user.created_at).toLocaleDateString() : '—');

      const actions = document.createElement('td');
      actions.className = 'actions-cell';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'row-action';
      edit.textContent = 'Edit';
      edit.setAttribute('aria-label', `Edit ${user.full_name || user.email}`);
      edit.addEventListener('click', () => showEdit(user));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'row-action danger';
      remove.textContent = 'Delete';
      remove.disabled = user.id === currentUserId;
      remove.title = remove.disabled ? 'You cannot delete your own account here.' : 'Delete this application account';
      remove.setAttribute('aria-label', `Delete ${user.full_name || user.email}`);
      remove.addEventListener('click', () => deleteUser(user, remove));
      actions.append(edit, remove);
      row.append(actions);
      rows.append(row);
    });
  }

  async function deleteUser(user, button) {
    const label = user.full_name ? `${user.full_name} (${user.email})` : user.email;
    if (!window.confirm(`Permanently delete ${label}'s app account? They will no longer be able to sign in.`)) return;
    button.disabled = true;
    button.textContent = 'Deleting…';
    try {
      await invokeManager({ action: 'delete', userId: user.id });
      setMessage(feedback, `Deleted ${label}.`);
      await loadUsers();
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Delete';
      setMessage(feedback, error.message || 'Could not delete this account.', true);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setMessage(feedback, '');
    createButton.disabled = true;
    createButton.textContent = 'Creating…';
    const values = new FormData(form);
    try {
      const { data, error } = await client.functions.invoke('admin-create-user', {
        body: {
          fullName: String(values.get('fullName')).trim(),
          designation: String(values.get('designation')).trim(),
          email: String(values.get('email')).trim(),
          role: String(values.get('role')),
          password: String(values.get('password')),
          pageAccess: collectAccess(document.getElementById('createPageAccessOptions'),String(values.get('role')))
        }
      });
      if (error) {
        let detail = error.message;
        try { const response = await error.context.json(); if (response?.error) detail = response.error; } catch {}
        throw new Error(detail);
      }
      setMessage(feedback, `Created ${data.email} as ${roleName[data.role] || data.role}. Share the temporary password securely.`);
      form.reset();
      await loadUsers();
    } catch (error) {
      console.error(error);
      setMessage(feedback, error.message || 'Could not create account. Check that the Edge Function has been deployed.', true);
    } finally {
      createButton.disabled = false;
      createButton.textContent = 'Create user';
    }
  });

  editForm.addEventListener('submit', async event => {
    event.preventDefault();
    setMessage(editFeedback, '');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';
    const values = new FormData(editForm);
    const role=String(values.get('role'));
    const requestedPageAccess=collectAccess(document.getElementById('editPageAccessOptions'),role);
    try {
      const updated = await invokeManager({
        action: 'update',
        userId: String(values.get('userId')),
        fullName: String(values.get('fullName')).trim(),
        designation: String(values.get('designation')).trim(),
        role,
        pageAccess: requestedPageAccess
      });
      if(!updated?.pageAccess||!sameAccess(updated.pageAccess,requestedPageAccess))throw new Error('The deployed admin-manage-user function did not confirm these page permissions. Deploy the latest function, then save again.');
      dialog.close();
      setMessage(feedback, `Updated ${updated.email}: ${roleName[updated.role] || updated.role} and page access.`);
      await loadUsers();
    } catch (error) {
      setMessage(editFeedback, error.message || 'Could not update this account.', true);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save changes';
    }
  });

  document.getElementById('cancelEdit').addEventListener('click', () => dialog.close());
  document.getElementById('role').addEventListener('change',event=>renderAccessOptions(document.getElementById('createPageAccessOptions'),event.target.value,defaultAccess(event.target.value)));
  document.getElementById('editRole').addEventListener('change',event=>renderAccessOptions(document.getElementById('editPageAccessOptions'),event.target.value,defaultAccess(event.target.value)));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.getElementById('refreshUsers').addEventListener('click', loadUsers);
  renderAccessOptions(document.getElementById('createPageAccessOptions'),document.getElementById('role').value,defaultAccess(document.getElementById('role').value));
  loadUsers();
})();
