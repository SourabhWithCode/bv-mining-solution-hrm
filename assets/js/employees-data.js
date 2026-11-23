const KEY = 'shift-board-v1';
const columns = [['srNo','Sr. No.'],['employeeCode','Employee Code'],['employeeNameAadhaar','Name of the Employee (As Per Aadhaar)'],['firstName','First Name'],['surname','Surname'],['gender','Gender'],['fatherName',"Father's Name"],['spouseName','Spouse Name'],['dob','DOB'],['nationality','Nationality'],['educationLevel','Education Level'],['dojDcs','DOJ DCS'],['designation','Designation'],['department','Department'],['categoryAddressHs','Category Address (HS/S/SS/US)'],['employmentType','Type of Employment'],['mobile','Mobile'],['uanNumber','UAN Number'],['pan','PAN'],['esic','ESIC'],['ip','PF'],['lwf','LWF'],['aadhaar','AADHAAR'],['bankAccount','Bank A/c No.'],['bank','Bank'],['branchIfsc','Branch (IFSC)'],['presentAddress','Present Add.'],['permanentAddress','Permanent Add.'],['identificationMark','Mark Of Identification'],['tokenNumber','Token Number issued'],['firstAppointmentOwner','Date of First Appointment with Owner'],['ageFitnessCertificate','Certificate of age/fitness taken (14 to 18 years)'],['medical','Medical'],['placeOfEmployment','Place of Employment'],['vocationalTrainingNumber','Certificate of Vocational Training Number'],['vocationalTrainingDate','Certificate of Vocational Training Date'],['vocationalTrainingExpiryDate','VTC Expiry Date'],['nominee','Nominee'],['nomineeAddress','Nominee Address'],['emergencyContactName','Emergency Contact Name'],['emergencyContactRelation','Emergency Contact Relation'],['emergencyContactAddress','Emergency Contact Address'],['emergencyContactNumber','Emergency Contact Number'],['remarks','Remarks'],['location','Location'],['bloodGroup','Blood Group'],['medicalDate','Medical Date'],['medicalExpiryDate','Medical Expiry Date'],['vtBasic','VT Basic'],['vtSpecial','VT Special'],['authorisation','Authorisation'],['authorisationDate','Authorisation Date'],['authorisationExpiryDate','Authorisation Expiry Date'],['newAppointments','New Appointments'],['addressCategory','Address Category']];
const dateFields = new Set(['dob','dojDcs','firstAppointmentOwner','vocationalTrainingDate','vocationalTrainingExpiryDate','medicalDate','medicalExpiryDate','authorisationDate','authorisationExpiryDate']);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let employees = [];
try { const data = JSON.parse(localStorage.getItem(KEY)) || {}; employees = Array.isArray(data.members) ? data.members : []; } catch {}

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
  const query = document.getElementById('search').value.trim().toLowerCase();
  [['filterDepartment','department','All departments'],['filterDesignation','designation','All designations'],['filterLocation','location','All locations'],['filterEmploymentType','employmentType','All employment types']].forEach(([id,key,label])=>{
    const select=document.getElementById(id),selected=select.value,values=[...new Set(employees.map(employee=>String(employee[key]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    select.innerHTML='<option value="">'+label+'</option>'+values.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join('');select.value=values.includes(selected)?selected:'';
  });
  const dept=document.getElementById('filterDepartment').value,designation=document.getElementById('filterDesignation').value,location=document.getElementById('filterLocation').value,type=document.getElementById('filterEmploymentType').value;
  const rows=employees.filter(employee=>searchText(employee).includes(query)&&(!dept||employee.department===dept)&&(!designation||employee.designation===designation)&&(!location||employee.location===location)&&(!type||employee.employmentType===type)).sort((a,b)=>(Number(a.srNo)||0)-(Number(b.srNo)||0));
  document.getElementById('count').textContent=rows.length+' of '+employees.length+' employees';
  const table=document.getElementById('tablewrap');
  if(!rows.length){table.innerHTML='<div class="empty">No employee records found. Add records from the Employee Records page.</div>';return}
  const canEdit=window.HRDB.canEdit;
  table.innerHTML='<table><thead><tr>'+columns.map(([,label])=>'<th>'+esc(label)+'</th>').join('')+(canEdit?'<th class="actions-heading">Actions</th>':'')+'</tr></thead><tbody>'+rows.map(employee=>'<tr>'+columns.map(([key])=>'<td title="'+esc(get(employee,key))+'">'+(esc(get(employee,key))||'—')+'</td>').join('')+(canEdit?'<td class="row-actions"><button class="row-edit" type="button" data-action="edit" data-id="'+esc(employee.id)+'">Edit</button><button class="row-delete" type="button" data-action="delete" data-id="'+esc(employee.id)+'">Delete</button></td>':'')+'</tr>').join('')+'</tbody></table>';
  table.querySelectorAll('[data-action="edit"]').forEach(button=>button.addEventListener('click',()=>openEditor(button.dataset.id)));
  table.querySelectorAll('[data-action="delete"]').forEach(button=>button.addEventListener('click',()=>deleteEmployee(button.dataset.id,button)));
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
document.getElementById('search').addEventListener('input',render);
['filterDepartment','filterDesignation','filterLocation','filterEmploymentType'].forEach(id=>document.getElementById(id).addEventListener('change',render));
document.getElementById('export').addEventListener('click',()=>{const data=[columns.map(([,label])=>label),...employees.slice().sort((a,b)=>(Number(a.srNo)||0)-(Number(b.srNo)||0)).map(employee=>columns.map(([key])=>get(employee,key)))];const blob=new Blob(['\ufeff'+data.map(row=>row.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='employees-data.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
render();
