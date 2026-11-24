const KEY = 'shift-board-v1';
const columns = [['srNo','Sr. No.'],['employeeCode','Employee Code'],['employeeNameAadhaar','Name of the Employee (As Per Aadhaar)'],['firstName','First Name'],['surname','Surname'],['gender','Gender'],['fatherName',"Father's Name"],['spouseName','Spouse Name'],['dob','DOB'],['nationality','Nationality'],['educationLevel','Education Level'],['dojDcs','DOJ DCS'],['designation','Designation'],['department','Department'],['categoryAddressHs','Category Address (HS/S/SS/US)'],['employmentType','Type of Employment'],['mobile','Mobile'],['uanNumber','UAN Number'],['pan','PAN'],['esic','ESIC'],['ip','PF'],['lwf','LWF'],['aadhaar','AADHAAR'],['bankAccount','Bank A/c No.'],['bank','Bank'],['branchIfsc','Branch (IFSC)'],['presentAddress','Present Add.'],['permanentAddress','Permanent Add.'],['identificationMark','Mark Of Identification'],['tokenNumber','Token Number issued'],['firstAppointmentOwner','Date of First Appointment with Owner'],['ageFitnessCertificate','Certificate of age/fitness taken (14 to 18 years)'],['medical','Medical'],['placeOfEmployment','Place of Employment'],['vocationalTrainingNumber','Certificate of Vocational Training Number'],['vocationalTrainingDate','Certificate of Vocational Training Date'],['vocationalTrainingExpiryDate','VTC Expiry Date'],['nominee','Nominee'],['nomineeAddress','Nominee Address'],['emergencyContactName','Emergency Contact Name'],['emergencyContactRelation','Emergency Contact Relation'],['emergencyContactAddress','Emergency Contact Address'],['emergencyContactNumber','Emergency Contact Number'],['remarks','Remarks'],['location','Location'],['bloodGroup','Blood Group'],['medicalDate','Medical Date'],['medicalExpiryDate','Medical Expiry Date'],['vtBasic','VT Basic'],['vtSpecial','VT Special'],['authorisation','Authorisation'],['authorisationDate','Authorisation Date'],['authorisationExpiryDate','Authorisation Expiry Date'],['newAppointments','New Appointments'],['addressCategory','Address Category']];
const dateFields = new Set(['dob','dojDcs','firstAppointmentOwner','vocationalTrainingDate','vocationalTrainingExpiryDate','medicalDate','medicalExpiryDate','authorisationDate','authorisationExpiryDate']);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let employees = [];
try { const data = JSON.parse(localStorage.getItem(KEY)) || {}; employees = Array.isArray(data.members) ? data.members : []; } catch {}
const statuses = ['Active','Suspended','Resigned','Transferred'];
const canManageStatus = () => window.HRDB.role === 'admin';

function ensureStatusControls() {
  const filters = document.querySelector('.filters');
  if (!document.getElementById('filterStatus')) {
    const select = document.createElement('select');
    select.id = 'filterStatus';
    select.setAttribute('aria-label','Filter by employee status');
    select.innerHTML = '<option value="">All employee statuses</option>' + statuses.map(status=>`<option>${status}</option>`).join('');
    filters.append(select);
  }
  if (!document.getElementById('statusHistoryPanel')) {
    const panel = document.createElement('section');
    panel.id = 'statusHistoryPanel';
    panel.className = 'panel history-panel';
    panel.innerHTML = '<div class="history-head"><div><h2>Employee status history</h2><p>Past suspensions, reactivations and other status changes with their reasons.</p></div></div><div id="statusHistory" class="history-body">Loading status history…</div>';
    document.querySelector('.panel').after(panel);
  }
  if (!document.getElementById('statusDialog')) {
    const dialog = document.createElement('dialog');
    dialog.id = 'statusDialog';
    dialog.className = 'employee-edit-dialog status-dialog';
    dialog.innerHTML = '<form id="statusForm"><div class="edit-head"><div><span class="eyebrow">Employment status</span><h2>Change employee status</h2><p>Enter a reason. The change will be added to status history.</p></div><button class="edit-close" type="button" aria-label="Close">×</button></div><div class="status-form-fields"><label>New status<select name="status" required></select></label><label>Reason<textarea name="reason" maxlength="500" rows="4" required placeholder="Reason for status change"></textarea></label></div><div class="edit-actions"><button class="button" type="button" id="cancelStatus">Cancel</button><button class="button save-button" type="submit">Save status</button></div></form>';
    document.body.append(dialog);
    dialog.querySelector('[name="status"]').innerHTML = statuses.map(status=>`<option>${status}</option>`).join('');
    dialog.querySelector('.edit-close').onclick = () => dialog.close();
    document.getElementById('cancelStatus').onclick = () => dialog.close();
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
    document.getElementById('statusForm').addEventListener('submit',saveStatus);
  }
}

function get(employee, key) {
  if (key === 'employeeCode') return employee.employeeCode ?? employee.empCode ?? '';
  if (key === 'employeeNameAadhaar') return employee.employeeNameAadhaar ?? employee.name ?? '';
  return employee[key] ?? '';
}
function searchText(employee) {
  const name = [get(employee,'employeeNameAadhaar'),employee.name,employee.firstName,employee.surname,[employee.firstName,employee.surname].filter(Boolean).join(' ')].filter(Boolean).join(' ');
  return (get(employee,'employeeCode')+' '+name+' '+columns.map(([key])=>get(employee,key)).join(' ')).toLowerCase();
}
function setUpEditDialog() {
  if (document.getElementById('employeeEditDialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'employeeEditDialog';
  dialog.className = 'employee-edit-dialog';
  dialog.innerHTML = `<form id="employeeEditForm"><div class="edit-head"><div><span class="eyebrow">Employee master data</span><h2>Edit employee</h2><p>Update the record details and save your changes.</p></div><button class="edit-close" type="button" aria-label="Close">×</button></div><div class="edit-fields" id="employeeEditFields"></div><div class="edit-actions"><button class="button" type="button" id="cancelEmployeeEdit">Cancel</button><button class="button save-button" type="submit">Save changes</button></div></form>`;
  document.body.append(dialog);
  const fields = document.getElementById('employeeEditFields');
  fields.innerHTML = columns.filter(([key])=>key!=='srNo').map(([key,label])=>`<label>${esc(label)}<input name="${esc(key)}" type="${dateFields.has(key)?'date':'text'}" autocomplete="off"></label>`).join('');
  const close = () => dialog.close();
  dialog.querySelector('.edit-close').addEventListener('click',close);
  document.getElementById('cancelEmployeeEdit').addEventListener('click',close);
  dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
  document.getElementById('employeeEditForm').addEventListener('submit',saveEmployee);
}
function render() {
  ensureStatusControls();
  const query = document.getElementById('search').value.trim().toLowerCase();
  [['filterDepartment','department','All departments'],['filterDesignation','designation','All designations'],['filterLocation','location','All locations'],['filterEmploymentType','employmentType','All employment types']].forEach(([id,key,label])=>{
    const select=document.getElementById(id),selected=select.value,values=[...new Set(employees.map(employee=>String(employee[key]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    select.innerHTML='<option value="">'+label+'</option>'+values.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join('');select.value=values.includes(selected)?selected:'';
  });
  const dept=document.getElementById('filterDepartment').value,designation=document.getElementById('filterDesignation').value,location=document.getElementById('filterLocation').value,type=document.getElementById('filterEmploymentType').value,status=document.getElementById('filterStatus').value;
  const rows=employees.filter(employee=>searchText(employee).includes(query)&&(!dept||employee.department===dept)&&(!designation||employee.designation===designation)&&(!location||employee.location===location)&&(!type||employee.employmentType===type)&&(!status||(employee.employmentStatus||'Active')===status)).sort((a,b)=>(Number(a.srNo)||0)-(Number(b.srNo)||0));
  document.getElementById('count').textContent=rows.length+' of '+employees.length+' employees';
  const table=document.getElementById('tablewrap');
  if(!rows.length){table.innerHTML='<div class="empty">No employee records found. Add records from the Employee Records page.</div>';return}
  const canEdit=window.HRDB.canEdit;
  table.innerHTML='<table><thead><tr>'+columns.map(([,label])=>'<th>'+esc(label)+'</th>').join('')+'<th>Employment status</th>'+(canEdit||canManageStatus()?'<th class="actions-heading">Actions</th>':'')+'</tr></thead><tbody>'+rows.map(employee=>'<tr>'+columns.map(([key])=>'<td title="'+esc(get(employee,key))+'">'+(esc(get(employee,key))||'—')+'</td>').join('')+'<td><span class="employment-status status-'+esc((employee.employmentStatus||'Active').toLowerCase())+'">'+esc(employee.employmentStatus||'Active')+'</span></td>'+(canEdit||canManageStatus()?'<td class="row-actions">'+(canManageStatus()?'<button class="row-edit" type="button" data-action="status" data-id="'+esc(employee.id)+'">Change status</button>':'')+(canEdit?'<button class="row-edit" type="button" data-action="edit" data-id="'+esc(employee.id)+'">Edit</button><button class="row-delete" type="button" data-action="delete" data-id="'+esc(employee.id)+'">Delete</button>':'')+'</td>':'')+'</tr>').join('')+'</tbody></table>';
  table.querySelectorAll('[data-action="status"]').forEach(button=>button.addEventListener('click',()=>openStatusDialog(button.dataset.id)));
  table.querySelectorAll('[data-action="edit"]').forEach(button=>button.addEventListener('click',()=>openEditor(button.dataset.id)));
  table.querySelectorAll('[data-action="delete"]').forEach(button=>button.addEventListener('click',()=>deleteEmployee(button.dataset.id,button)));
}
function openStatusDialog(id) {
  const employee=employees.find(row=>String(row.id)===String(id));if(!employee)return;
  const dialog=document.getElementById('statusDialog'),form=document.getElementById('statusForm');
  form.dataset.employeeId=id;form.elements.status.value=employee.employmentStatus||'Active';form.elements.reason.value='';
  dialog.querySelector('h2').textContent=`Change status · ${get(employee,'employeeCode')||get(employee,'employeeNameAadhaar')||'Employee'}`;
  dialog.showModal();
}
async function saveStatus(event) {
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');
  button.disabled=true;button.textContent='Saving…';
  try {
    const {error}=await window.HRDB.client.rpc('set_employee_status',{p_employee_id:form.dataset.employeeId,p_status:form.elements.status.value,p_reason:form.elements.reason.value.trim()});
    if(error)throw error;
    window.HRDB.status('Employee status updated and added to history.');
    document.getElementById('statusDialog').close();
    setTimeout(()=>location.reload(),350);
  } catch(error) { window.HRDB.status('Could not change employee status: '+(error.message||''),true); }
  finally {button.disabled=false;button.textContent='Save status';}
}
async function loadStatusHistory() {
  const target=document.getElementById('statusHistory');
  const {data,error}=await window.HRDB.client.from('employee_status_history').select('id,employee_id,old_status,new_status,reason,changed_by,changed_at').order('changed_at',{ascending:false}).limit(200);
  if(error){target.textContent='Could not load status history. Run employee-actions-migration.sql in Supabase.';return}
  if(!data?.length){target.textContent='No employee status changes have been recorded.';return}
  const people=new Map(employees.map(person=>[person.id,person]));
  const actorIds=[...new Set(data.map(row=>row.changed_by).filter(Boolean))];
  let actors=new Map();
  if(actorIds.length){const result=await window.HRDB.client.from('user_profiles').select('id,full_name,email').in('id',actorIds);if(!result.error)actors=new Map((result.data||[]).map(actor=>[actor.id,actor]))}
  target.innerHTML='<div class="history-table-wrap"><table><thead><tr><th>Date</th><th>Employee</th><th>Status change</th><th>Reason</th><th>Changed by</th></tr></thead><tbody>'+data.map(row=>{const person=people.get(row.employee_id)||{},actor=actors.get(row.changed_by)||{};return '<tr><td>'+esc(new Date(row.changed_at).toLocaleString('en-IN'))+'</td><td>'+esc(get(person,'employeeCode')||get(person,'employeeNameAadhaar')||'Employee')+'</td><td>'+esc(row.old_status)+' → '+esc(row.new_status)+'</td><td>'+esc(row.reason)+'</td><td>'+esc(actor.full_name||actor.email||'User')+'</td></tr>'}).join('')+'</tbody></table></div>';
}
function openEditor(id) {
  const employee=employees.find(row=>String(row.id)===String(id));if(!employee)return;
  setUpEditDialog();const dialog=document.getElementById('employeeEditDialog'),form=document.getElementById('employeeEditForm');form.dataset.employeeId=id;
  columns.filter(([key])=>key!=='srNo').forEach(([key])=>{form.elements[key].value=get(employee,key)||''});
  dialog.showModal();
}
const snake = value => value.replace(/[A-Z]/g,letter=>'_'+letter.toLowerCase());
function toDatabaseRow(form) {
  const row={updated_at:new Date().toISOString()};
  columns.filter(([key])=>key!=='srNo').forEach(([key])=>{
    let value=form.elements[key].value.trim();if((dateFields.has(key)||key==='employeeCode')&&!value)value=null;
    const column=key==='employeeNameAadhaar'?'employee_name':snake(key);row[column]=value;
  });
  return row;
}
async function saveEmployee(event) {
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),id=form.dataset.employeeId;
  button.disabled=true;button.textContent='Saving…';
  try {
    const result=await window.HRDB.client.from('employees').update(toDatabaseRow(form)).eq('id',id).select('id').single();
    if(result.error)throw result.error;
    window.HRDB.status('Employee record updated.');document.getElementById('employeeEditDialog').close();setTimeout(()=>location.reload(),350);
  } catch(error) { window.HRDB.status('Could not update employee: '+(error.message||'Check database access.'),true); }
  finally { button.disabled=false;button.textContent='Save changes'; }
}
async function deleteEmployee(id,button) {
  const employee=employees.find(row=>String(row.id)===String(id));if(!employee)return;
  const code=get(employee,'employeeCode')||get(employee,'employeeNameAadhaar')||'this employee';
  if(!window.confirm(`Permanently delete ${code}? This cannot be undone.`))return;
  button.disabled=true;button.textContent='Deleting…';
  try {
    const result=await window.HRDB.client.from('employees').delete().eq('id',id).select('id').single();
    if(result.error)throw result.error;
    window.HRDB.status('Employee record deleted.');setTimeout(()=>location.reload(),350);
  } catch(error) {
    window.HRDB.status('Could not delete employee. Existing shift, attendance, leave, or stock history may be linked to this record. '+(error.message||''),true);
    button.disabled=false;button.textContent='Delete';
  }
}
function csv(value){let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'}
ensureStatusControls();
document.getElementById('search').addEventListener('input',render);
['filterDepartment','filterDesignation','filterLocation','filterEmploymentType','filterStatus'].forEach(id=>document.getElementById(id).addEventListener('change',render));
document.getElementById('export').addEventListener('click',()=>{const data=[[...columns.map(([,label])=>label),'Employment Status'],...employees.slice().sort((a,b)=>(Number(a.srNo)||0)-(Number(b.srNo)||0)).map(employee=>[...columns.map(([key])=>get(employee,key)),employee.employmentStatus||'Active'])];const blob=new Blob(['\ufeff'+data.map(row=>row.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='employees-data.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
render();
loadStatusHistory();
