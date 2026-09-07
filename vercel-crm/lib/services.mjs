import { getDb } from "./db.mjs";
import {
  ROLES,
  USER_STATUS,
  LEAD_STATUSES,
  APPOINTMENT_STATUSES,
  SERVICES,
  BOOKING_SOURCES,
  FOLLOWUP_CHANNELS,
  FOLLOWUP_OUTCOMES,
  text,
  phone,
  phoneKey,
  id,
  token,
  tokenHash,
  same,
  date,
  time,
  allowed,
  todayCairo,
  hashPassword,
  verifyPassword,
  validatePassword,
  formatDateTime,
} from "./core.mjs";

const sql = () => getDb();
const ok = (payload) => ({ success: true, ...payload });

async function audit(user, action, entityType, entityId, details = "") {
  await sql()`INSERT INTO audit_log (emp_code, emp_name, action, entity_type, entity_id, details) VALUES (${user.empCode}, ${user.name}, ${action}, ${entityType}, ${entityId}, ${String(details).slice(0, 4000)})`;
}

async function session(rawToken, roles) {
  if (!rawToken) throw new Error("AUTH_REQUIRED");
  const rows =
    await sql()`SELECT u.emp_code, u.emp_name, u.role, u.status, u.must_change_password
    FROM sessions s JOIN users u ON u.emp_code=s.emp_code
    WHERE s.token_hash=${tokenHash(rawToken)} AND s.expires_at > now() LIMIT 1`;
  const row = rows[0];
  if (!row || row.status !== USER_STATUS.ACTIVE)
    throw new Error("AUTH_REQUIRED");
  if (roles && !roles.includes(row.role)) throw new Error("FORBIDDEN");
  return {
    empCode: row.emp_code,
    name: row.emp_name,
    role: row.role,
    status: row.status,
    mustChangePassword: row.must_change_password,
  };
}

function canManage(user, lead) {
  if (user.role === ROLES.ADMIN) return;
  if (!same(user.name, lead.sales_rep)) throw new Error("FORBIDDEN");
}

const leadView = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email,
  whatsapp: row.whatsapp,
  contactMethods: row.contact_methods,
  requestType: row.request_type,
  branch: row.branch,
  formRequestId: row.form_request_id,
  status: row.status,
  campaign: row.campaign,
  salesRep: row.sales_rep,
  bookingSource: row.booking_source,
  bookingDate: row.booking_date ? String(row.booking_date).slice(0, 10) : "",
  country: row.country,
  createdAt: formatDateTime(row.created_at),
  updatedAt: formatDateTime(row.updated_at),
  notes: row.notes,
});

const appointmentView = (row) => ({
  id: row.id,
  clientId: row.client_id,
  clientName: row.client_name,
  service: row.service,
  date: row.appointment_date ? String(row.appointment_date).slice(0, 10) : "",
  time: String(row.appointment_time || "").slice(0, 5),
  status: row.status,
  sessionNum: row.session_number,
  bookingSource: row.booking_source,
  bookingDate: row.booking_date ? String(row.booking_date).slice(0, 10) : "",
  country: row.country,
  branch: row.branch,
  formRequestId: row.form_request_id,
  createdAt: formatDateTime(row.created_at),
  updatedAt: formatDateTime(row.updated_at),
});

async function getLeadForUser(user, leadId) {
  const rows =
    await sql()`SELECT * FROM leads WHERE id=${text(leadId, 80, true)} LIMIT 1`;
  if (!rows[0]) throw new Error("LEAD_NOT_FOUND");
  canManage(user, rows[0]);
  return rows[0];
}

async function loginUser(empCode, password, rememberMe) {
  const code = text(empCode, 50, true).toLowerCase();
  const rows =
    await sql()`SELECT * FROM users WHERE lower(emp_code)=${code} LIMIT 1`;
  const user = rows[0];
  if (user?.blocked_until && new Date(user.blocked_until) > new Date())
    return {
      success: false,
      code: "LOGIN_BLOCKED",
      message: "تم إيقاف محاولات الدخول مؤقتًا. حاول مرة أخرى بعد 15 دقيقة.",
    };
  if (
    !user ||
    user.status !== USER_STATUS.ACTIVE ||
    !verifyPassword(password, user.password_hash)
  ) {
    if (user)
      await sql()`UPDATE users SET failed_login_attempts=failed_login_attempts+1, blocked_until=CASE WHEN failed_login_attempts+1>=5 THEN now()+interval '15 minutes' ELSE blocked_until END WHERE emp_code=${user.emp_code}`;
    return {
      success: false,
      code: "INVALID_CREDENTIALS",
      message: "كود الموظف أو كلمة المرور غير صحيحة.",
    };
  }
  await sql()`UPDATE users SET failed_login_attempts=0, blocked_until=NULL WHERE emp_code=${user.emp_code}`;
  const raw = token();
  const hours = rememberMe ? 24 * 30 : 12;
  await sql()`INSERT INTO sessions (token_hash, emp_code, expires_at) VALUES (${tokenHash(raw)}, ${user.emp_code}, now() + (${hours} * interval '1 hour'))`;
  const safeUser = {
    empCode: user.emp_code,
    name: user.emp_name,
    role: user.role,
    mustChangePassword: user.must_change_password,
  };
  await audit(safeUser, "LOGIN", "User", user.emp_code);
  return ok({ token: raw, user: safeUser });
}

async function verifyToken(raw) {
  try {
    return { valid: true, user: await session(raw) };
  } catch {
    return { valid: false };
  }
}

async function logoutUser(raw) {
  if (raw) await sql()`DELETE FROM sessions WHERE token_hash=${tokenHash(raw)}`;
  return ok({ message: "تم تسجيل الخروج." });
}

async function changeMyPassword(raw, currentPassword, newPassword) {
  const user = await session(raw);
  const rows =
    await sql()`SELECT password_hash FROM users WHERE emp_code=${user.empCode}`;
  if (!verifyPassword(currentPassword, rows[0]?.password_hash))
    return {
      success: false,
      code: "INVALID_CURRENT_PASSWORD",
      message: "كلمة المرور الحالية غير صحيحة.",
    };
  const password = validatePassword(newPassword, user.empCode);
  await sql()`UPDATE users SET password_hash=${hashPassword(password)}, must_change_password=false, password_changed_at=now() WHERE emp_code=${user.empCode}`;
  await audit(user, "PASSWORD_CHANGED", "User", user.empCode);
  return ok({ message: "تم تغيير كلمة المرور بنجاح." });
}

async function getSalesTeam(raw) {
  await session(raw);
  const rows =
    await sql()`SELECT emp_code, emp_name FROM sales_team WHERE status=${USER_STATUS.ACTIVE} ORDER BY emp_name`;
  return ok({
    team: rows.map((r) => ({
      empCode: r.emp_code,
      name: r.emp_name,
      role: ROLES.SALES,
    })),
  });
}

async function getLeadsData(raw) {
  const user = await session(raw);
  const rows =
    user.role === ROLES.ADMIN
      ? await sql()`SELECT * FROM leads ORDER BY created_at DESC`
      : await sql()`SELECT * FROM leads WHERE lower(sales_rep)=lower(${user.name}) ORDER BY created_at DESC`;
  return ok({ leads: rows.map(leadView) });
}

async function resolveRep(user, requested = "") {
  if (user.role === ROLES.SALES) return user.name;
  const rep = text(requested, 160);
  if (!rep) return "";
  const rows =
    await sql()`SELECT emp_name FROM sales_team WHERE lower(emp_name)=lower(${rep}) AND status=${USER_STATUS.ACTIVE}`;
  if (!rows[0]) throw new Error("INVALID_SALES_AGENT");
  return rows[0].emp_name;
}

async function addLead(raw, data = {}) {
  const user = await session(raw);
  const leadPhone = phone(data.phone);
  const duplicate =
    await sql()`SELECT id,name FROM leads WHERE phone_key=${phoneKey(leadPhone)} LIMIT 1`;
  if (duplicate[0])
    return {
      success: false,
      code: "DUPLICATE_PHONE",
      message: `رقم الهاتف مسجل بالفعل للعميل ${duplicate[0].name} (${duplicate[0].id}).`,
    };
  const leadId = id("L");
  const rep = await resolveRep(user, data.assignedSalesRep);
  const status = allowed(data.status, LEAD_STATUSES, "جديد");
  const bookingSource = allowed(data.bookingSource, BOOKING_SOURCES);
  await sql()`INSERT INTO leads (id,name,phone,phone_key,email,whatsapp,contact_methods,request_type,branch,status,campaign,sales_rep,booking_source,booking_date,country,notes)
    VALUES (${leadId},${text(data.name, 160, true)},${leadPhone},${phoneKey(leadPhone)},${text(data.email, 220)},${data.whatsapp ? phone(data.whatsapp) : ""},${text(data.contactMethods, 160)},${text(data.requestType, 160)},${text(data.branch, 100)},${status},${text(data.campaign || "Direct / Organic", 160)},${rep},${bookingSource},${data.bookingDate ? date(data.bookingDate) : null},${text(data.country, 100)},${text(data.notes, 1500)})`;
  await audit(
    user,
    "LEAD_CREATED",
    "Lead",
    leadId,
    JSON.stringify({ status, rep }),
  );
  return ok({ id: leadId, message: `تم إضافة العميل بنجاح برقم ${leadId}.` });
}

async function updateLeadStatus(raw, leadId, newStatus) {
  const user = await session(raw);
  const lead = await getLeadForUser(user, leadId);
  const status = allowed(newStatus, LEAD_STATUSES);
  await sql()`UPDATE leads SET status=${status}, updated_at=now() WHERE id=${lead.id}`;
  await audit(
    user,
    "LEAD_STATUS_CHANGED",
    "Lead",
    lead.id,
    `${lead.status} -> ${status}`,
  );
  return ok({ message: "تم تحديث حالة العميل." });
}

async function updateLead(raw, data = {}) {
  const user = await session(raw);
  const lead = await getLeadForUser(user, data.id);
  const leadPhone = phone(data.phone);
  const dup =
    await sql()`SELECT id,name FROM leads WHERE phone_key=${phoneKey(leadPhone)} AND id<>${lead.id} LIMIT 1`;
  if (dup[0])
    return {
      success: false,
      code: "DUPLICATE_PHONE",
      message: `رقم الهاتف مسجل بالفعل للعميل ${dup[0].name} (${dup[0].id}).`,
    };
  const rep =
    user.role === ROLES.ADMIN && Object.hasOwn(data, "assignedSalesRep")
      ? await resolveRep(user, data.assignedSalesRep)
      : lead.sales_rep;
  await sql()`UPDATE leads SET name=${text(data.name, 160, true)}, phone=${leadPhone}, phone_key=${phoneKey(leadPhone)}, email=${text(data.email, 220)}, whatsapp=${data.whatsapp ? phone(data.whatsapp) : ""}, contact_methods=${text(data.contactMethods, 160)}, branch=${text(data.branch, 100)}, campaign=${text(data.campaign, 160)}, sales_rep=${rep}, booking_source=${allowed(data.bookingSource, BOOKING_SOURCES)}, booking_date=${data.bookingDate ? date(data.bookingDate) : null}, country=${text(data.country, 100)}, notes=${text(data.notes, 1500)}, updated_at=now() WHERE id=${lead.id}`;
  await audit(user, "LEAD_UPDATED", "Lead", lead.id);
  return ok({ message: "تم تحديث بيانات العميل بنجاح." });
}

async function assignLeadsBulk(raw, leadIds, salesAgentName) {
  const user = await session(raw, [ROLES.ADMIN]);
  const rep = await resolveRep(user, salesAgentName);
  const ids = Array.isArray(leadIds)
    ? leadIds.map((v) => text(v, 80)).filter(Boolean)
    : [];
  if (!ids.length) throw new Error("MISSING_REQUIRED_FIELDS");
  const updated =
    await sql()`UPDATE leads SET sales_rep=${rep}, updated_at=now() WHERE id=ANY(${ids}::text[]) RETURNING id`;
  for (const row of updated)
    await audit(user, "LEAD_BULK_ASSIGNED", "Lead", row.id, rep);
  return ok({
    assigned: updated.length,
    failed: ids.length - updated.length,
    details: {
      success: updated.map((r) => ({ leadId: r.id, assignedTo: rep })),
      failed: [],
    },
  });
}

async function archiveLead(raw, leadId) {
  const user = await session(raw, [ROLES.ADMIN]);
  const lead = await getLeadForUser(user, leadId);
  await sql()`UPDATE leads SET status='مؤرشف',updated_at=now() WHERE id=${lead.id}`;
  await audit(user, "LEAD_ARCHIVED", "Lead", lead.id);
  return ok({ message: `تم أرشفة العميل ${lead.name} بنجاح.` });
}

async function createAppointment(raw, data = {}) {
  const user = await session(raw);
  const service = allowed(data.service, SERVICES);
  const apptDate = date(data.date, true);
  const apptTime = time(data.time);
  if (apptDate < todayCairo())
    return {
      success: false,
      code: "PAST_DATE",
      message: "لا يمكن إنشاء حجز في تاريخ سابق.",
    };
  let lead;
  if (data.isNewClient) {
    const result = await addLead(raw, {
      name: data.clientName || data.name,
      phone: data.clientPhone || data.phone,
      email: data.clientEmail || data.email,
      whatsapp: data.clientWhatsapp || data.whatsapp,
      contactMethods: data.contactMethods,
      requestType: data.requestType || service,
      status: service === "عملية زراعة شعر" ? "تم حجز عملية" : "تم حجز كشف",
      campaign: data.clientCampaign || data.campaign || "Direct / Booking",
      assignedSalesRep:
        data.assignedSalesRep || data.salesRep || data.newClientSalesRep,
      bookingSource: data.bookingSource,
      bookingDate: data.bookingDate || apptDate,
      country: data.country || data.clientCountry,
      branch: data.branch,
      notes: data.clientNotes || data.notes,
    });
    if (!result.success) return result;
    lead = (await sql()`SELECT * FROM leads WHERE id=${result.id}`)[0];
  } else lead = await getLeadForUser(user, data.clientId);
  const apptId = id("A");
  const status = service === "عملية زراعة شعر" ? "تم حجز عملية" : "تم حجز كشف";
  await sql()`UPDATE leads SET status=${status},booking_source=${allowed(data.bookingSource, BOOKING_SOURCES)},booking_date=${data.bookingDate ? date(data.bookingDate) : apptDate},country=${text(data.country || data.clientCountry || lead.country, 100)},updated_at=now() WHERE id=${lead.id}`;
  await sql()`INSERT INTO appointments (id,client_id,client_name,service,appointment_date,appointment_time,status,session_number,booking_source,booking_date,country,branch)
    VALUES (${apptId},${lead.id},${lead.name},${service},${apptDate},${apptTime},'مؤكد',${Math.max(1, Math.min(100, Number(data.sessionNum) || 1))},${allowed(data.bookingSource, BOOKING_SOURCES)},${data.bookingDate ? date(data.bookingDate) : apptDate},${text(data.country || data.clientCountry || lead.country, 100)},${text(data.branch, 100)})`;
  await audit(user, "APPOINTMENT_CREATED", "Appointment", apptId);
  return ok({
    id: apptId,
    leadId: lead.id,
    message: `تم إنشاء الحجز بنجاح برقم ${apptId}.`,
  });
}

async function getAppointmentsData(raw) {
  const user = await session(raw);
  const rows =
    user.role === ROLES.ADMIN
      ? await sql()`SELECT a.* FROM appointments a ORDER BY appointment_date DESC, appointment_time DESC`
      : await sql()`SELECT a.* FROM appointments a JOIN leads l ON l.id=a.client_id WHERE lower(l.sales_rep)=lower(${user.name}) ORDER BY a.appointment_date DESC,a.appointment_time DESC`;
  return ok({ appointments: rows.map(appointmentView) });
}

async function updateAppointmentStatus(raw, appointmentId, newStatus) {
  const user = await session(raw);
  const rows =
    await sql()`SELECT a.*,l.sales_rep FROM appointments a JOIN leads l ON l.id=a.client_id WHERE a.id=${text(appointmentId, 80, true)}`;
  if (!rows[0]) throw new Error("APPOINTMENT_NOT_FOUND");
  canManage(user, rows[0]);
  const status = allowed(newStatus, APPOINTMENT_STATUSES);
  await sql()`UPDATE appointments SET status=${status},updated_at=now() WHERE id=${rows[0].id}`;
  await audit(
    user,
    "APPOINTMENT_STATUS_CHANGED",
    "Appointment",
    rows[0].id,
    status,
  );
  return ok({ message: "تم تحديث حالة الحجز." });
}

async function updateAppointment(raw, appointmentId, data = {}) {
  const user = await session(raw);
  const rows =
    await sql()`SELECT a.*,l.sales_rep FROM appointments a JOIN leads l ON l.id=a.client_id WHERE a.id=${text(appointmentId, 80, true)}`;
  if (!rows[0]) throw new Error("APPOINTMENT_NOT_FOUND");
  canManage(user, rows[0]);
  await sql()`UPDATE appointments SET service=${allowed(data.service, SERVICES)},appointment_date=${date(data.date, true)},appointment_time=${time(data.time)},session_number=${Math.max(1, Math.min(100, Number(data.sessionNum) || 1))},booking_source=${allowed(data.bookingSource, BOOKING_SOURCES)},booking_date=${data.bookingDate ? date(data.bookingDate) : rows[0].booking_date},country=${text(data.country || rows[0].country, 100)},branch=${text(data.branch || rows[0].branch, 100)},updated_at=now() WHERE id=${rows[0].id}`;
  await audit(user, "APPOINTMENT_UPDATED", "Appointment", rows[0].id);
  return ok({ message: "تم تحديث بيانات الحجز." });
}

async function archiveAppointment(raw, appointmentId) {
  const user = await session(raw, [ROLES.ADMIN]);
  await sql()`UPDATE appointments SET status='مؤرشف',updated_at=now() WHERE id=${text(appointmentId, 80, true)}`;
  await audit(user, "APPOINTMENT_ARCHIVED", "Appointment", appointmentId);
  return ok({ message: "تم أرشفة الحجز." });
}

async function getLeadFollowups(raw, leadId) {
  const user = await session(raw);
  const lead = await getLeadForUser(user, leadId);
  const rows =
    await sql()`SELECT * FROM followups WHERE lead_id=${lead.id} ORDER BY created_at DESC`;
  return ok({
    followups: rows.map((r) => ({
      id: r.id,
      leadId: r.lead_id,
      leadName: r.lead_name,
      channel: r.channel,
      outcome: r.outcome,
      notes: r.notes,
      nextDate: r.next_date ? String(r.next_date).slice(0, 10) : "",
      createdByCode: r.created_by_code,
      createdByName: r.created_by_name,
      createdAt: formatDateTime(r.created_at),
    })),
  });
}

async function addLeadFollowup(raw, data = {}) {
  const user = await session(raw);
  const lead = await getLeadForUser(user, data.leadId);
  const followupId = id("F");
  const channel = allowed(data.channel, FOLLOWUP_CHANNELS);
  const outcome = allowed(data.outcome, FOLLOWUP_OUTCOMES);
  await sql()`INSERT INTO followups(id,lead_id,lead_name,channel,outcome,notes,next_date,created_by_code,created_by_name) VALUES(${followupId},${lead.id},${lead.name},${channel},${outcome},${text(data.notes, 1500)},${data.nextDate ? date(data.nextDate) : null},${user.empCode},${user.name})`;
  const statusMap = {
    "تم التواصل": "تم التواصل",
    مهتم: "مؤهل لكشف",
    "غير مهتم": "مستبعد",
    "تم الحجز": "تم حجز كشف",
  };
  if (statusMap[outcome])
    await sql()`UPDATE leads SET status=${statusMap[outcome]},updated_at=now() WHERE id=${lead.id}`;
  await audit(user, "FOLLOWUP_CREATED", "Followup", followupId);
  return ok({ id: followupId, message: "تم تسجيل المتابعة بنجاح." });
}

async function addSalesTeamMember(raw, data = {}) {
  const user = await session(raw, [ROLES.ADMIN]);
  const code = text(data.empCode, 50, true).toUpperCase(),
    name = text(data.empName, 160, true);
  await sql()`INSERT INTO sales_team(emp_code,emp_name) VALUES(${code},${name})`;
  await audit(user, "ADD_SALES_TEAM_MEMBER", "Sales_Team", code);
  return ok({
    empCode: code,
    empName: name,
    status: USER_STATUS.ACTIVE,
    message: "تمت إضافة الموظف.",
  });
}

async function createSalesAccountForSalesMember(raw, empCode) {
  const user = await session(raw, [ROLES.ADMIN]);
  const code = text(empCode, 50, true).toUpperCase();
  const rows =
    await sql()`SELECT * FROM sales_team WHERE upper(emp_code)=${code} AND status=${USER_STATUS.ACTIVE}`;
  if (!rows[0]) throw new Error("MEMBER_NOT_FOUND");
  await sql()`INSERT INTO users(emp_code,emp_name,password_hash,role,status,must_change_password) VALUES(${code},${rows[0].emp_name},${hashPassword(code)},${ROLES.SALES},${USER_STATUS.ACTIVE},true) ON CONFLICT(emp_code) DO UPDATE SET emp_name=excluded.emp_name,password_hash=excluded.password_hash,role=excluded.role,status=excluded.status,must_change_password=true`;
  await sql()`DELETE FROM sessions WHERE emp_code=${code}`;
  await audit(user, "CREATE_SALES_ACCOUNT", "User", code);
  return ok({
    empCode: code,
    empName: rows[0].emp_name,
    temporaryPassword: code,
    message:
      "تم إنشاء حساب السيلز. كود الدخول وكلمة المرور المؤقتة هما كود الموظف.",
  });
}

async function getSalesTeamList(raw) {
  await session(raw, [ROLES.ADMIN]);
  const rows =
    await sql()`SELECT s.*,u.role account_role,u.status account_status FROM sales_team s LEFT JOIN users u ON upper(u.emp_code)=upper(s.emp_code) ORDER BY s.created_at DESC`;
  return ok({
    members: rows.map((r) => ({
      empCode: r.emp_code,
      empName: r.emp_name,
      status: r.status,
      createdAt: formatDateTime(r.created_at),
      updatedAt: formatDateTime(r.updated_at),
      hasAccount: Boolean(r.account_role),
      accountRole: r.account_role || "",
      accountStatus: r.account_status || "",
    })),
  });
}

async function dashboard(raw) {
  await session(raw, [ROLES.ADMIN]);
  const [leadRows, apptRows] = await Promise.all([
    sql()`SELECT id,status,campaign,sales_rep FROM leads WHERE status<>'مؤرشف'`,
    sql()`SELECT status,service,client_id FROM appointments WHERE status<>'مؤرشف'`,
  ]);
  const surgery = new Set(
    apptRows
      .filter((a) => a.service === "عملية زراعة شعر")
      .map((a) => a.client_id),
  );
  const consult = new Set(
    apptRows
      .filter(
        (a) =>
          a.service === "كشف وتقييم بصيلات" || a.service === "استشارة فيديو",
      )
      .map((a) => a.client_id),
  );
  const aggregate = (key, label) => {
    const m = new Map();
    for (const l of leadRows) {
      const k = l[key] || "غير محدد";
      const x = m.get(k) || {
        [label]: k,
        leads: 0,
        consultations: 0,
        surgeries: 0,
      };
      x.leads++;
      if (consult.has(l.id)) x.consultations++;
      if (surgery.has(l.id)) x.surgeries++;
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => b.leads - a.leads);
  };
  return ok({
    kpis: {
      totalLeads: leadRows.length,
      unassignedLeads: leadRows.filter((l) => !l.sales_rep).length,
      bookedSurgeries: surgery.size,
      bookedConsultations: consult.size,
      conversionRate: leadRows.length
        ? Math.round((surgery.size / leadRows.length) * 100)
        : 0,
      totalAppointments: apptRows.length,
      confirmedAppointments: apptRows.filter((a) => a.status === "مؤكد").length,
      attendedAppointments: apptRows.filter((a) => a.status === "تم الحضور")
        .length,
      cancelledAppointments: apptRows.filter((a) => a.status === "إلغاء")
        .length,
    },
    campaignStats: aggregate("campaign", "campaign"),
    salesStats: aggregate("sales_rep", "salesRep"),
  });
}

function matchesFilters(row, f = {}) {
  const d = String(row.booking_date || row.appointment_date || "").slice(0, 10);
  return (
    (!f.dateFrom || d >= f.dateFrom) &&
    (!f.dateTo || d <= f.dateTo) &&
    (!f.bookingDate || d === f.bookingDate) &&
    (!f.bookingSource || row.booking_source === f.bookingSource) &&
    (!f.salesAgent || same(row.sales_rep, f.salesAgent)) &&
    (!f.country ||
      String(row.country || "")
        .toLowerCase()
        .includes(String(f.country).toLowerCase()))
  );
}
function breakdown(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = r[key] || "غير محدد",
      x = m.get(k) || { key: k, total: 0, actual: 0, expected: 0 };
    x.total++;
    if (r._actual) x.actual++;
    else x.expected++;
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
async function report(raw, type, filters = {}) {
  await session(raw, [ROLES.ADMIN]);
  let rows;
  if (type === "booking")
    rows =
      await sql()`SELECT l.id,l.name,l.status,l.booking_source,l.booking_date,l.sales_rep,l.country FROM leads l WHERE l.status<>'مؤرشف'`;
  else
    rows =
      await sql()`SELECT a.id,a.client_name name,a.status,a.booking_source,a.booking_date,a.appointment_date,a.service,l.sales_rep,a.country FROM appointments a JOIN leads l ON l.id=a.client_id WHERE a.status<>'مؤرشف'`;
  if (type === "operation")
    rows = rows.filter((r) => r.service === "عملية زراعة شعر");
  if (type === "consultation")
    rows = rows.filter(
      (r) => r.service === "كشف وتقييم بصيلات" || r.service === "استشارة فيديو",
    );
  rows = rows
    .filter((r) => matchesFilters(r, filters))
    .map((r) => ({
      ...r,
      _actual:
        type === "booking"
          ? ["تم حجز كشف", "تم حجز عملية"].includes(r.status)
          : r.status === "تم الحضور",
    }));
  if (filters.resultType === "actual") rows = rows.filter((r) => r._actual);
  if (filters.resultType === "expected") rows = rows.filter((r) => !r._actual);
  const cap =
    type === "booking"
      ? "Bookings"
      : type === "operation"
        ? "Operations"
        : "Consultations";
  const details = rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    bookingSource: r.booking_source,
    bookingDate: r.booking_date ? String(r.booking_date).slice(0, 10) : "",
    date: r.appointment_date ? String(r.appointment_date).slice(0, 10) : "",
    salesRep: r.sales_rep,
    country: r.country,
  }));
  return ok({
    summary: {
      [`total${cap}`]: rows.length,
      [`actual${cap}`]: rows.filter((r) => r._actual).length,
      [`expected${cap}`]: rows.filter((r) => !r._actual).length,
    },
    bySource: breakdown(rows, "booking_source"),
    bySalesAgent: breakdown(rows, "sales_rep"),
    byCountry: breakdown(rows, "country"),
    byDate: breakdown(
      rows,
      type === "booking" ? "booking_date" : "appointment_date",
    ),
    details,
  });
}

async function exportReport(raw, type, filters = {}) {
  const result = await report(raw, type, filters);
  const headers = [
    "ID",
    "Name",
    "Status",
    "Booking Source",
    "Booking Date",
    "Sales Rep",
    "Country",
  ];
  const esc = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  const csv =
    "\uFEFF" +
    [
      headers,
      ...result.details.map((x) => [
        x.id,
        x.name,
        x.status,
        x.bookingSource,
        x.bookingDate || x.date,
        x.salesRep,
        x.country,
      ]),
    ]
      .map((r) => r.map(esc).join(","))
      .join("\r\n");
  return ok({
    fileName: `${type}-report-${todayCairo()}.csv`,
    mimeType: "text/csv;charset=utf-8",
    data: Buffer.from(csv).toString("base64"),
  });
}

async function submitRequest(data = {}) {
  const requestType = allowed(data.requestType, [
    "clinic_appointment",
    "video_consultation",
    "online_assessment",
    "callback",
  ]);
  const name = text(data.name, 160, true),
    age = Number(data.age),
    leadPhone = phone(data.phone),
    whatsapp = phone(data.whatsapp);
  if (
    !Number.isFinite(age) ||
    age < 12 ||
    age > 100 ||
    data.privacyConsent !== true
  )
    throw new Error("MISSING_REQUIRED_FIELDS");
  const requestId = id("CMR");
  let lead = (
    await sql()`SELECT * FROM leads WHERE phone_key=${phoneKey(leadPhone)} LIMIT 1`
  )[0];
  if (!lead) {
    const leadId = id("L");
    await sql()`INSERT INTO leads(id,name,phone,phone_key,email,whatsapp,contact_methods,request_type,status,campaign,booking_source,booking_date,country,form_request_id,notes) VALUES(${leadId},${name},${leadPhone},${phoneKey(leadPhone)},${text(data.email, 220)},${whatsapp},${Array.isArray(data.preferredContactMethod) ? data.preferredContactMethod.join(", ") : text(data.preferredContactMethod, 160)},${requestType},'جديد',${text(data.utmCampaign || data.source || "Direct", 160)},${normalizeSource(data.source)},${data.appointmentDate || null},${text(data.country, 100, true)},${requestId},${text(data.notes, 1500)})`;
    lead = (await sql()`SELECT * FROM leads WHERE id=${leadId}`)[0];
  } else
    await sql()`UPDATE leads SET name=${name},email=${text(data.email, 220)},whatsapp=${whatsapp},request_type=${requestType},form_request_id=${requestId},updated_at=now() WHERE id=${lead.id}`;
  let appointmentId = null;
  if (["clinic_appointment", "video_consultation"].includes(requestType)) {
    const apptDate = date(data.appointmentDate, true);
    if (apptDate < todayCairo()) throw new Error("INVALID_DATE");
    appointmentId = id("A");
    const service =
      requestType === "clinic_appointment"
        ? "كشف وتقييم بصيلات"
        : "استشارة فيديو";
    await sql()`INSERT INTO appointments(id,client_id,client_name,service,appointment_date,appointment_time,status,booking_source,booking_date,country,form_request_id) VALUES(${appointmentId},${lead.id},${name},${service},${apptDate},${time(data.appointmentTime)},'مؤكد',${normalizeSource(data.source)},${apptDate},${text(data.country, 100)},${requestId})`;
  }
  await sql()`INSERT INTO requests(id,request_type,gender,name,age,email,country,phone,whatsapp,contact_methods,appointment_date,appointment_time,smoker,previous_diseases,diabetes,main_concern,hair_loss_duration,notes,source,utm_medium,utm_campaign,page_url,user_agent,lead_id,appointment_id) VALUES(${requestId},${requestType},${text(data.gender, 30, true)},${name},${age},${text(data.email, 220)},${text(data.country, 100, true)},${leadPhone},${whatsapp},${Array.isArray(data.preferredContactMethod) ? data.preferredContactMethod.join(", ") : text(data.preferredContactMethod, 160)},${data.appointmentDate || null},${data.appointmentTime || null},${text(data.smoker, 30)},${text(data.previousDiseases, 30)},${text(data.diabetes, 30)},${text(data.mainConcern, 500)},${text(data.hairLossDuration, 100)},${text(data.notes, 1500)},${text(data.source, 160)},${text(data.utmMedium, 160)},${text(data.utmCampaign, 160)},${text(data.pageUrl, 1000)},${text(data.userAgent, 1000)},${lead.id},${appointmentId})`;
  const files = [];
  if (data.images)
    for (const [kind, value] of Object.entries(data.images)) {
      for (const f of Array.isArray(value) ? value : [value])
        if (f?.url) files.push({ kind, ...f });
    }
  for (const f of files)
    await sql()`INSERT INTO request_files(request_id,kind,name,mime_type,blob_url,pathname) VALUES(${requestId},${f.kind},${text(f.name, 255, true)},${text(f.mimeType, 120, true)},${text(f.url, 2000, true)},${text(f.pathname, 1000)})`;
  await sql()`INSERT INTO followups(id,lead_id,lead_name,channel,outcome,notes,created_by_code,created_by_name) VALUES(${id("F")},${lead.id},${name},'أخرى','متابعة لاحقة',${"طلب جديد من النموذج: " + requestId},'FORM','Public Form')`;
  return ok({ requestId, leadId: lead.id, appointmentId });
}
function normalizeSource(value) {
  const s = String(value || "").toLowerCase();
  if (s.includes("facebook")) return "Facebook";
  if (s.includes("instagram")) return "Instagram";
  if (s.includes("google")) return "Google";
  return "أخرى";
}

export const methods = {
  loginUser,
  verifyToken,
  logoutUser,
  changeMyPassword,
  getSalesTeam,
  getLeadsData,
  addLead,
  updateLeadStatus,
  updateLead,
  assignLeadsBulk,
  archiveLead,
  createAppointment,
  getAppointmentsData,
  updateAppointmentStatus,
  updateAppointment,
  archiveAppointment,
  getLeadFollowups,
  addLeadFollowup,
  addSalesTeamMember,
  createSalesAccountForSalesMember,
  getSalesTeamList,
  getAdminDashboardStats: dashboard,
  getBookingReport: (t, f) => report(t, "booking", f),
  getOperationReport: (t, f) => report(t, "operation", f),
  getConsultationReport: (t, f) => report(t, "consultation", f),
  exportReportToPDF: (t, type, f) => exportReport(t, type, f),
  exportReportToExcel: (t, type, f) => exportReport(t, type, f),
  submitRequest,
  getClinicOptions: async () =>
    ok({
      timeSlots: Array.from(
        { length: 24 },
        (_, i) => `${String(i).padStart(2, "0")}:00`,
      ),
    }),
  getAvailableTimes: async () =>
    ok({
      slots: Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, "0")}:00`,
        available: true,
      })),
    }),
};

