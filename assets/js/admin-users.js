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
  const roleName = { admin: 'Admin', hr: 'HR', accountant: 'Accountant', store: 'Store', mechanical: 'Mechanical', mine_mate: 'Mine Mate', foreman: 'Foreman', project_manager: 'Project Manager', assistant_project_manager: 'Assistant Project Manager' };

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
    setMessage(editFeedback, '');
    dialog.showModal();
    document.getElementById('editFullName').focus();
  }

  async function loadUsers() {
    rows.innerHTML = '<tr><td class="empty" colspan="6">Loading users…</td></tr>';
    const { data, error } = await client.from('user_profiles')
      .select('id,full_name,designation,email,role,created_at')
      .order('created_at', { ascending: false });
    if (error) {
      rows.replaceChildren();
      const row = document.createElement('tr');
      const cell = addCell(row, `Could not load users: ${error.message}`);
      cell.colSpan = 6;
      cell.className = 'empty';
      rows.append(row);
      return;
    }
    rows.replaceChildren();
    if (!data?.length) {
      const row = document.createElement('tr');
      const cell = addCell(row, 'No application users found.');
      cell.colSpan = 6;
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
          password: String(values.get('password'))
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
    try {
      const updated = await invokeManager({
        action: 'update',
        userId: String(values.get('userId')),
        fullName: String(values.get('fullName')).trim(),
        designation: String(values.get('designation')).trim(),
        role: String(values.get('role'))
      });
      dialog.close();
      setMessage(feedback, `Updated ${updated.email}: ${roleName[updated.role] || updated.role}.`);
      await loadUsers();
    } catch (error) {
      setMessage(editFeedback, error.message || 'Could not update this account.', true);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save changes';
    }
  });

  document.getElementById('cancelEdit').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.getElementById('refreshUsers').addEventListener('click', loadUsers);
  loadUsers();
})();
