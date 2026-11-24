const KEY = "shift-board-v1";
const $ = (id) => document.getElementById(id);
const fieldIds = [
  "employeeCode",
  "employeeNameAadhaar",
  "firstName",
  "surname",
  "gender",
  "fatherName",
  "spouseName",
  "dob",
  "nationality",
  "educationLevel",
  "dojDcs",
  "designation",
  "department",
  "categoryAddressHs",
  "employmentType",
  "mobile",
  "uanNumber",
  "pan",
  "esic",
  "ip",
  "lwf",
  "aadhaar",
  "bankAccount",
  "bank",
  "branchIfsc",
  "presentAddress",
  "permanentAddress",
  "identificationMark",
  "tokenNumber",
  "firstAppointmentOwner",
  "ageFitnessCertificate",
  "medical",
  "placeOfEmployment",
  "vocationalTrainingNumber",
  "vocationalTrainingDate",
  "vocationalTrainingExpiryDate",
  "nominee",
  "nomineeAddress",
  "emergencyContactName",
  "emergencyContactRelation",
  "emergencyContactAddress",
  "emergencyContactNumber",
  "remarks",
  "location",
  "bloodGroup",
  "medicalDate",
  "medicalExpiryDate",
  "vtBasic",
  "vtSpecial",
  "authorisation",
  "authorisationDate",
  "authorisationExpiryDate",
  "newAppointments",
  "addressCategory",
];
let state;
try {
  state = JSON.parse(localStorage.getItem(KEY)) || {
    members: [],
    schedule: {},
  };
} catch {
  state = { members: [], schedule: {} };
}
state.members = state.members || [];
state.schedule = state.schedule || {};
const highestSrNo = Math.max(
  0,
  ...state.members.map((m) => Number(m.srNo) || 0),
);
let missingSerial = highestSrNo + 1;
state.members.forEach((m) => {
  if (!m.srNo) m.srNo = missingSerial++;
  if (!m.employeeCode) m.employeeCode = m.empCode || "";
  if (!m.employeeNameAadhaar) m.employeeNameAadhaar = m.name || "";
  if (!m.fatherName) m.fatherName = "";
  syncExpiry(m);
});
state.nextSrNo = Math.max(
  Number(state.nextSrNo) || 1,
  highestSrNo + 1,
  missingSerial,
);
let editingId = null,
  timer;
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}
function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function toast(s) {
  $("toast").textContent = s;
  $("toast").classList.add("show");
  clearTimeout(timer);
  timer = setTimeout(() => $("toast").classList.remove("show"), 1800);
}
function addFiveYears(value) {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return "";
  const year = y + 5;
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${year}-${String(m).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}
function syncExpiry(m) {
  m.vocationalTrainingExpiryDate = addFiveYears(m.vocationalTrainingDate);
  m.medicalExpiryDate = addFiveYears(m.medicalDate);
  m.authorisationExpiryDate = addFiveYears(m.authorisationDate);
}
function updateExpiryInputs() {
  $("vocationalTrainingExpiryDate").value = addFiveYears(
    $("vocationalTrainingDate").value,
  );
  $("medicalExpiryDate").value = addFiveYears($("medicalDate").value);
  $("authorisationExpiryDate").value = addFiveYears(
    $("authorisationDate").value,
  );
}
function displayName(m) {
  return (
    m.name ||
    m.employeeNameAadhaar ||
    `${m.firstName || ""} ${m.surname || ""}`.trim() ||
    m.empCode ||
    `Employee ${m.srNo}`
  );
}
function valueFor(m, k) {
  if (k === "employeeCode") return m.employeeCode ?? m.empCode ?? "";
  if (k === "employeeNameAadhaar") return m.employeeNameAadhaar ?? m.name ?? "";
  return m[k] ?? "";
}
function fieldLabel(k) {
  return document.querySelector(`label[for="${k}"]`)?.textContent || k;
}
function fields() {
  return [["srNo", "Sr. No."], ...fieldIds.map((k) => [k, fieldLabel(k)])];
}
function syncLegacy(m) {
  m.empCode = m.employeeCode || "";
  m.name =
    m.employeeNameAadhaar ||
    `${m.firstName || ""} ${m.surname || ""}`.trim() ||
    m.empCode ||
    `Employee ${m.srNo}`;
  m.designation = m.designation || "";
  m.mobile = m.mobile || "";
  m.fatherName = m.fatherName || "";
}
function resetForm() {
  editingId = null;
  $("employeeForm").reset();
  updateExpiryInputs();
  $("validationAlerts").classList.remove("show");
  $("validationAlerts").innerHTML = "";
  $("srNo").textContent = state.nextSrNo;
  $("formTitle").textContent = "Add employee record";
  $("saveButton").textContent = "Save employee record";
  $("cancelEdit").style.display = "none";
}
function dateDays(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - todayUtc) / 86400000);
}
function renderExpiry() {
  const types = [
    ["VTC", "vocationalTrainingExpiryDate"],
    ["Medical", "medicalExpiryDate"],
    ["Authorisation", "authorisationExpiryDate"],
  ];
  const alerts = [];
  state.members.forEach((m) =>
    types.forEach(([label, key]) => {
      const value = m[key];
      const days = dateDays(value);
      if (days !== null && days <= 90)
        alerts.push({
          id: m.id,
          name: displayName(m),
          code: m.empCode || m.employeeCode || "",
          label,
          date: value,
          days,
        });
    }),
  );
  alerts.sort((a, b) => a.days - b.days);
  const expired = alerts.filter((a) => a.days <= 0).length,
    due60 = alerts.filter((a) => a.days > 0 && a.days <= 60).length,
    due90 = alerts.filter((a) => a.days >= 61 && a.days <= 90).length;
  $("expiredCount").textContent = expired;
  $("due60Count").textContent = due60;
  $("due90Count").textContent = due90;
  if (!alerts.length) {
    $("expiryList").innerHTML =
      '<div class="no-expiry">No expired certificates or authorisations, and nothing is due within 90 days.</div>';
    return;
  }
  $("expiryList").innerHTML = alerts
    .map((a) => {
      const status =
        a.days < 0
          ? `Expired ${Math.abs(a.days)} days ago`
          : a.days === 0
            ? "Expired today"
            : a.days === 1
              ? "Expires in 1 day"
              : `Expires in ${a.days} days`;
      return `<div class="expiry-row"><div><div class="expiry-name">${esc(a.name)}${a.code ? ` · ${esc(a.code)}` : ""}</div><div class="expiry-meta">${esc(a.label)} · Expires ${esc(a.date)}</div></div><span class="expiry-badge ${a.days > 0 ? "soon" : ""}">${status}</span><button class="expiry-view" data-expiry-view="${a.id}">View record</button></div>`;
    })
    .join("");
  $("expiryList")
    .querySelectorAll("[data-expiry-view]")
    .forEach((b) => (b.onclick = () => showDetails(b.dataset.expiryView)));
}
function render() {
  renderExpiry();
  renderDataQuality();
}
function renderDataQuality() {
  const alerts = [];
  const requiredReview = [
    ["employeeCode", "Employee Code"],
    ["employeeNameAadhaar", "Employee name"],
    ["designation", "Designation"],
    ["department", "Department"],
    ["location", "Location"],
  ];
  state.members.forEach((m) => {
    const name = displayName(m);
    const code = m.employeeCode || m.empCode || "";
    requiredReview.forEach(([key, label]) => {
      const value = key === "employeeCode" ? code : key === "employeeNameAadhaar" ? (m.employeeNameAadhaar || m.name || "") : m[key];
      if (!String(value || "").trim()) alerts.push({ name, code, text: `Missing ${label}` });
    });
  });
  [
    ["employeeCode", "Employee Code"],
    ["mobile", "Mobile number"],
    ["aadhaar", "Aadhaar"],
    ["pan", "PAN"],
    ["uanNumber", "UAN Number"],
  ].forEach(([key, label]) => {
    const groups = new Map();
    state.members.forEach((m) => {
      const value = String(key === "employeeCode" ? (m.employeeCode || m.empCode || "") : m[key] || "").trim().toLowerCase();
      if (value) groups.set(value, [...(groups.get(value) || []), m]);
    });
    groups.forEach((members) => {
      if (members.length < 2) return;
      members.forEach((m) => alerts.push({
        name: displayName(m),
        code: m.employeeCode || m.empCode || "",
        text: `Duplicate ${label} found in ${members.length} employee records`,
      }));
    });
  });
  $("qualityCount").textContent = `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`;
  if (!alerts.length) {
    $("qualityList").innerHTML = '<div class="no-expiry">No missing key details or duplicate identifiers found.</div>';
    return;
  }
  $("qualityList").innerHTML = alerts.slice(0, 100).map((alert) =>
    `<div class="quality-row"><div><strong>${esc(alert.name)}${alert.code ? ` · ${esc(alert.code)}` : ""}</strong><div class="quality-meta">${esc(alert.text)}</div></div><span class="quality-tag">Review</span></div>`
  ).join("") + (alerts.length > 100 ? `<div class="no-expiry">Showing first 100 of ${alerts.length} alerts.</div>` : "");
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function loadWarningHistory() {
  const target = $("warningHistory");
  const { data, error } = await window.HRDB.client
    .from("employee_warnings")
    .select("id,employee_id,warning_date,reason,issued_by")
    .order("warning_date", { ascending: false })
    .limit(200);
  if (error) {
    target.innerHTML = `<div class="no-expiry">Could not load warnings. Run the Employee Actions database migration first. ${esc(error.message)}</div>`;
    return;
  }
  const warnings = data || [];
  if (!warnings.length) {
    target.innerHTML = '<div class="no-expiry">No employee warnings have been recorded.</div>';
    return;
  }
  const people = new Map(state.members.map((m) => [m.id, m]));
  const userIds = [...new Set(warnings.map((warning) => warning.issued_by).filter(Boolean))];
  let users = new Map();
  if (userIds.length) {
    const result = await window.HRDB.client.from("user_profiles").select("id,full_name,email").in("id", userIds);
    if (!result.error) users = new Map((result.data || []).map((user) => [user.id, user]));
  }
  target.innerHTML = warnings.map((warning) => {
    const person = people.get(warning.employee_id) || {};
    const issuer = users.get(warning.issued_by) || {};
    return `<div class="warning-row"><div><strong>${esc(person.id ? displayName(person) : "Employee record")}${person.employeeCode || person.empCode ? ` · ${esc(person.employeeCode || person.empCode)}` : ""}</strong><div class="warning-meta">Issued ${esc(warning.warning_date)} · By ${esc(issuer.full_name || issuer.email || "User")}</div><div class="warning-meta warning-reason">${esc(warning.reason)}</div></div><span class="warning-tag">Warning</span></div>`;
  }).join("");
}
function validationMessages(values) {
  const warnings = [];
  const duplicates = (key, value) =>
    value &&
    state.members.some(
      (m) =>
        m.id !== editingId &&
        String(value).trim().toLowerCase() ===
          String(m[key] || "")
            .trim()
            .toLowerCase(),
    );
  if (!values.employeeCode.trim())
    warnings.push(
      "Employee Code is blank; this record cannot be matched reliably during future imports.",
    );
  if (!values.employeeNameAadhaar.trim() && !values.firstName.trim())
    warnings.push("Employee name is blank.");
  const mobileDigits = values.mobile.replace(/\D/g, "");
  if (values.mobile && (mobileDigits.length < 10 || mobileDigits.length > 15))
    warnings.push("Mobile number should contain 10 to 15 digits.");
  const aadhaarDigits = values.aadhaar.replace(/\D/g, "");
  if (values.aadhaar && aadhaarDigits.length !== 12)
    warnings.push("Aadhaar should contain 12 digits.");
  if (values.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(values.pan.trim()))
    warnings.push("PAN format looks incorrect.");
  if (values.uanNumber && !/^\d{12}$/.test(values.uanNumber.replace(/\D/g, "")))
    warnings.push("UAN should contain 12 digits.");
  [
    ["mobile", "Mobile"],
    ["aadhaar", "Aadhaar"],
    ["pan", "PAN"],
    ["uanNumber", "UAN Number"],
  ].forEach(([key, label]) => {
    if (duplicates(key, values[key]))
      warnings.push(label + " is already used in another employee record.");
  });
  if (values.dob && values.dojDcs && values.dojDcs < values.dob)
    warnings.push("Date of joining is earlier than the date of birth.");
  return warnings;
}
function showValidation(values) {
  const box = $("validationAlerts");
  const warnings = validationMessages(values);
  box.classList.toggle("show", warnings.length > 0);
  box.innerHTML = warnings.length
    ? "<strong>Review these validation alerts (you can still save):</strong><ul>" +
      warnings.map((w) => "<li>" + esc(w) + "</li>").join("") +
      "</ul>"
    : "";
  return warnings;
}
function edit(id) {
  const m = state.members.find((x) => x.id === id);
  if (!m) return;
  editingId = id;
  fieldIds.forEach((k) => {
    const el = $(k);
    if (el) el.value = valueFor(m, k);
  });
  updateExpiryInputs();
  $("srNo").textContent = m.srNo;
  $("formTitle").textContent = `Edit employee record · SR ${m.srNo}`;
  $("saveButton").textContent = "Save changes";
  $("cancelEdit").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showDetails(id) {
  const m = state.members.find((x) => x.id === id);
  if (!m) return;
  $("detailTitle").textContent = displayName(m);
  $("detailSubtitle").textContent =
    `Serial number ${m.srNo}${m.empCode || m.employeeCode ? " · Employee code " + (m.empCode || m.employeeCode) : ""}`;
  $("detailGrid").innerHTML = fields()
    .map(
      ([k, label]) =>
        `<div class="detail"><label>${esc(label)}</label><span>${esc(k === "srNo" ? m.srNo : valueFor(m, k)) || "—"}</span></div>`,
    )
    .join("");
  $("detailDialog").showModal();
}
function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function exportCsv() {
  const cols = fields();
  const rows = [
    cols.map(([, label]) => label),
    ...state.members
      .slice()
      .sort((a, b) => Number(a.srNo) - Number(b.srNo))
      .map((m) => cols.map(([k]) => (k === "srNo" ? m.srNo : valueFor(m, k)))),
  ];
  const content = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + content], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `employee-records-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${state.members.length} employee records exported`);
}
$("vocationalTrainingDate").addEventListener("change", updateExpiryInputs);
$("medicalDate").addEventListener("change", updateExpiryInputs);
$("authorisationDate").addEventListener("change", updateExpiryInputs);
let pendingImport = [];
let pendingDuplicates = 0;
let pendingBlank = 0;
let pendingUpdates = 0;
function detectDelimiter(text) {
  const line =
    text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .find((x) => x.trim()) || "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      i++;
      continue;
    }
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && Object.prototype.hasOwnProperty.call(counts, ch))
      counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1]
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ",";
}
function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  if (cell !== "" || row.length) {
    row.push(cell);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
  }
  return rows;
}
function normHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
function parseDateValue(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const first = Number(m[1]),
      second = Number(m[2]),
      year = Number(m[3]);
    const day = first > 12 ? first : second,
      month = first > 12 ? second : first;
    if (month < 1 || month > 12 || day < 1 || day > 31) return "";
    return (
      String(year) +
      "-" +
      String(month).padStart(2, "0") +
      "-" +
      String(day).padStart(2, "0")
    );
  }
  if (/^\d{4}[/.-]\d{1,2}[/.-]\d{1,2}$/.test(v)) {
    const [y, mn, d] = v.split(/[/.-]/).map(Number);
    return (
      String(y) +
      "-" +
      String(mn).padStart(2, "0") +
      "-" +
      String(d).padStart(2, "0")
    );
  }
  if (/^\d+(\.0+)?$/.test(v)) {
    const serial = Math.floor(Number(v));
    if (serial > 0) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return (
        String(d.getUTCFullYear()) +
        "-" +
        String(d.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getUTCDate()).padStart(2, "0")
      );
    }
  }
  return "";
}
function importHeaders(headers) {
  const map = new Map();
  fields().forEach(([k, label]) => {
    map.set(normHeader(k), k);
    map.set(normHeader(label), k);
  });
  const aliases = {
    srno: "srNo",
    serialnumber: "srNo",
    empcode: "employeeCode",
    name: "employeeNameAadhaar",
    employeename: "employeeNameAadhaar",
    nameofemployeeasperaadhar: "employeeNameAadhaar",
    nameoftheemployeeasperaadhar: "employeeNameAadhaar",
    nameoftheemployeeasperaadhaar: "employeeNameAadhaar",
    employeenameasperaadhar: "employeeNameAadhaar",
    presentadd: "presentAddress",
    permanentadd: "permanentAddress",
    bankacno: "bankAccount",
    bankaccountno: "bankAccount",
    bankaccountnumber: "bankAccount",
    branchifsc: "branchIfsc",
    certificateofagefitnesstakenfor14to18year: "ageFitnessCertificate",
    certificateofagefitnesstakenfor14to18years: "ageFitnessCertificate",
    placeofemploymentundergroundopencastsurface: "placeOfEmployment",
    vtexpirydate: "vocationalTrainingExpiryDate",
    vtcexpirydate: "vocationalTrainingExpiryDate",
    medicalexpirydate: "medicalExpiryDate",
    authorisationexpirydate: "authorisationExpiryDate",
  };
  Object.entries(aliases).forEach(([h, k]) => map.set(h, k));
  return headers.map((h) => map.get(normHeader(h)) || null);
}
function previewCsv(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!rows.length) throw new Error("The CSV file is empty.");
  const headerIndex = rows.findIndex((r) => r.some((c) => c.trim() !== ""));
  const header = rows[headerIndex] || [];
  const mapped = importHeaders(header);
  if (!mapped.some((k) => k && k !== "srNo"))
    throw new Error(
      "No employee columns were recognized. Use the Employee Records CSV or include headers such as Employee Code and Employee Name.",
    );
  const dates = new Set([
    "dob",
    "dojDcs",
    "firstAppointmentOwner",
    "vocationalTrainingDate",
    "vocationalTrainingExpiryDate",
    "medicalDate",
    "medicalExpiryDate",
    "authorisationDate",
    "authorisationExpiryDate",
  ]);
  const existing = new Map();
  state.members.forEach((m) => {
    const c = String(m.empCode || m.employeeCode || "")
      .trim()
      .toLowerCase();
    if (c && !existing.has(c)) existing.set(c, m.id);
  });
  const seen = new Set(),
    accepted = [];
  let duplicates = 0,
    blank = 0,
    updates = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    const values = {};
    mapped.forEach((key, index) => {
      if (!key || key === "srNo") return;
      const raw = (row[index] || "").trim();
      values[key] = dates.has(key) ? parseDateValue(raw) : raw;
    });
    if (!Object.values(values).some((v) => String(v || "").trim() !== "")) {
      blank++;
      continue;
    }
    const code = String(values.employeeCode || "")
      .trim()
      .toLowerCase();
    if (code && seen.has(code)) {
      duplicates++;
      continue;
    }
    if (code) seen.add(code);
    if (code && existing.has(code)) {
      if (window.HRDB.role !== "admin") {
        duplicates++;
        continue;
      }
      const merged = Object.fromEntries(
        Object.entries(values).filter(([, v]) => String(v || "").trim() !== ""),
      );
      merged.__updateId = existing.get(code);
      accepted.push(merged);
      updates++;
    } else {
      accepted.push(values);
    }
  }
  return { accepted, duplicates, blank, updates };
}
async function readCsvFile(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder("utf-16le").decode(buffer);
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder("utf-16be").decode(buffer);
  let text = new TextDecoder("utf-8").decode(buffer);
  if (text.includes("\ufffd")) {
    try {
      text = new TextDecoder("windows-1252").decode(buffer);
    } catch {}
  }
  return text;
}
$("csvFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const preview = previewCsv(await readCsvFile(file));
    pendingImport = preview.accepted;
    pendingDuplicates = preview.duplicates;
    pendingBlank = preview.blank;
    pendingUpdates = preview.updates;
    $("confirmImport").disabled = !pendingImport.length;
    $("confirmImport").textContent =
      `Import ${pendingImport.length} record${pendingImport.length === 1 ? "" : "s"}`;
    $("importStatus").textContent =
      `${pendingImport.length} ready to import · ${pendingDuplicates} duplicate employee codes will be skipped · ${pendingBlank} blank rows ignored · ${pendingUpdates} existing records will be updated.`;
    if (!pendingImport.length) toast("No new employee rows to import");
  } catch (err) {
    pendingImport = [];
    $("confirmImport").disabled = true;
    $("confirmImport").textContent = "Import records";
    $("importStatus").textContent =
      err.message || "Could not read this CSV file.";
    toast("Could not read CSV file");
  }
  e.target.value = "";
});
$("confirmImport").addEventListener("click", () => {
  if (!pendingImport.length) return;
  const backup = JSON.stringify(state);
  let added = 0,
    updated = 0;
  try {
    pendingImport.forEach((values) => {
      const payload = { ...values };
      const targetId = payload.__updateId;
      delete payload.__updateId;
      if (targetId) {
        const m = state.members.find((x) => x.id === targetId);
        if (!m)
          throw new Error(
            "An employee record changed during import. Please choose the CSV again.",
          );
        Object.assign(m, payload);
        syncExpiry(m);
        syncLegacy(m);
        updated++;
      } else {
        const m = {
          id: crypto.randomUUID(),
          srNo: state.nextSrNo++,
          ...payload,
        };
        syncExpiry(m);
        syncLegacy(m);
        state.members.push(m);
        added++;
      }
    });
    save();
  } catch (err) {
    state = JSON.parse(backup);
    render();
    $("importStatus").textContent =
      err.message ||
      "Could not save imported records. Check available browser storage.";
    toast("Could not save imported records");
    return;
  }
  render();
  resetForm();
  pendingImport = [];
  $("confirmImport").disabled = true;
  $("confirmImport").textContent = "Import records";
  $("importStatus").textContent =
    `Imported ${added} new records · updated ${updated} existing records · skipped ${pendingDuplicates} duplicate rows · ignored ${pendingBlank} blank rows.`;
  toast(`Imported ${added} and updated ${updated} employee records`);
});
$("employeeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  updateExpiryInputs();
  const values = {};
  fieldIds.forEach((k) => {
    const el = $(k);
    values[k] = el ? el.value.trim() : "";
  });
  const code = values.employeeCode;
  const warnings = showValidation(values);
  if (warnings.length) toast("Review validation alerts before saving");
  if (
    code &&
    state.members.some(
      (m) =>
        m.id !== editingId &&
        String(m.empCode || m.employeeCode || "").toLowerCase() ===
          code.toLowerCase(),
    )
  ) {
    toast("That employee code is already in use");
    return;
  }
  let m = editingId ? state.members.find((x) => x.id === editingId) : null;
  const isNew = !m;
  if (!m) {
    m = { id: crypto.randomUUID(), srNo: state.nextSrNo++ };
    state.members.push(m);
  }
  Object.assign(m, values);
  m.srNo = m.srNo || state.nextSrNo++;
  syncExpiry(m);
  syncLegacy(m);
  save();
  render();
  resetForm();
  toast(isNew ? "Employee record saved" : "Employee record updated");
});
$("warningDate").value = localToday();
$("searchWarningEmployee").addEventListener("click", () => {
  const query = $("warningEmployeeSearch").value.trim().toLowerCase();
  const select = $("warningEmployee");
  const status = $("warningEmployeeMatch");
  select.disabled = true;
  select.innerHTML = '<option value="">No matching employee</option>';
  if (!query) { status.textContent = "Enter an Employee Code or name to search."; return; }
  const matches = state.members.filter((employee) => {
    const code = employee.employeeCode || employee.empCode || "";
    const name = `${employee.employeeNameAadhaar || employee.name || ""} ${employee.firstName || ""} ${employee.surname || ""}`;
    return `${code} ${name}`.toLowerCase().includes(query);
  }).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  if (!matches.length) { status.textContent = "No employee found. Check the code or name."; return; }
  select.innerHTML = '<option value="">Select employee</option>' + matches
    .map((employee) => `<option value="${esc(employee.id)}">${esc(displayName(employee))}${employee.employeeCode || employee.empCode ? ` · ${esc(employee.employeeCode || employee.empCode)}` : ""}</option>`)
    .join("");
  select.disabled = false;
  if (matches.length === 1) select.value = matches[0].id;
  status.textContent = `${matches.length} matching employee${matches.length === 1 ? "" : "s"} found.`;
});
$("warningEmployeeSearch").addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); $("searchWarningEmployee").click(); }
});
$("warningEmployeeSearch").addEventListener("input", () => {
  $("warningEmployee").disabled = true;
  $("warningEmployee").innerHTML = '<option value="">Search for an employee first</option>';
  $("warningEmployeeMatch").textContent = "";
});
$("warningForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const employeeId = $("warningEmployee").value;
  const warningDate = $("warningDate").value;
  const reason = $("warningReason").value.trim();
  if (!employeeId || !warningDate || !reason) return;
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = "Saving…";
  const { error } = await window.HRDB.client.from("employee_warnings").insert({
    employee_id: employeeId,
    warning_date: warningDate,
    reason,
    issued_by: window.HRDB.user.id,
  });
  button.disabled = false;
  button.textContent = "Record warning";
  if (error) {
    window.HRDB.status(`Could not record warning: ${error.message}`, true);
    return;
  }
  $("warningReason").value = "";
  window.HRDB.status("Employee warning recorded.");
  await loadWarningHistory();
});
cancelEdit.onclick = () => {
  resetForm();
  validationAlerts.classList.remove("show");
};
fieldIds.forEach((id) =>
  $(id)?.addEventListener("input", () => {
    const values = {};
    fieldIds.forEach((k) => (values[k] = $(k)?.value.trim() || ""));
    showValidation(values);
  }),
);
$("exportCsv").onclick = exportCsv;
$("closeDetails").onclick = () => $("detailDialog").close();
$("closeDetailsFooter").onclick = () => $("detailDialog").close();
$("detailDialog").addEventListener("click", (e) => {
  if (e.target === $("detailDialog")) $("detailDialog").close();
});
save();
resetForm();
render();
loadWarningHistory();
