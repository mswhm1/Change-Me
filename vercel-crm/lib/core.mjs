import crypto from 'node:crypto';

export const ROLES = Object.freeze({ ADMIN: 'Admin', SALES: 'Sales' });
export const USER_STATUS = Object.freeze({ ACTIVE: 'نشط', SUSPENDED: 'موقوف' });
export const LEAD_STATUSES = Object.freeze(['جديد', 'تم التواصل', 'مؤهل لكشف', 'تم حجز كشف', 'تم حجز عملية', 'مستبعد', 'مؤرشف']);
export const APPOINTMENT_STATUSES = Object.freeze(['معلق', 'مؤكد', 'تم الحضور', 'إلغاء', 'إعادة جدولة', 'مؤرشف']);
export const SERVICES = Object.freeze(['كشف وتقييم بصيلات', 'استشارة فيديو', 'عملية زراعة شعر', 'جلسة بلازما (PRP)', 'جلسة ميزوثيرابي', 'متابعة ما بعد العملية']);
export const BOOKING_SOURCES = Object.freeze(['Facebook', 'Instagram', 'Google', 'من خلال صديق', 'أخرى']);
export const FOLLOWUP_CHANNELS = Object.freeze(['WhatsApp', 'اتصال هاتفي', 'بريد إلكتروني', 'زيارة', 'أخرى']);
export const FOLLOWUP_OUTCOMES = Object.freeze(['تم التواصل', 'لم يرد', 'متابعة لاحقة', 'مهتم', 'غير مهتم', 'تم الحجز']);

export const text = (value, max = 1500, required = false) => {
  const result = String(value ?? '').trim().slice(0, max);
  if (required && !result) throw new Error('MISSING_REQUIRED_FIELDS');
  return result;
};

export function englishDigits(value) {
  return String(value ?? '').replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0));
}

export function phone(value) {
  const result = englishDigits(value).trim();
  if (!/^[+()\-\s0-9]{7,24}$/.test(result)) throw new Error('INVALID_PHONE');
  return result;
}

export const phoneKey = value => englishDigits(value).replace(/\D/g, '').replace(/^00/, '');
export const id = prefix => `${prefix}-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
export const token = () => crypto.randomBytes(32).toString('hex');
export const tokenHash = raw => crypto.createHash('sha256').update(String(raw)).digest('hex');
export const same = (a, b) => String(a ?? '').trim().toLocaleLowerCase('ar') === String(b ?? '').trim().toLocaleLowerCase('ar');
export const todayCairo = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function date(value, required = false) {
  const result = text(value, 10, required);
  if (result && !/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error('INVALID_DATE');
  return result;
}

export function time(value) {
  const result = englishDigits(value);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(result)) throw new Error('INVALID_TIME');
  return result;
}

export function allowed(value, choices, fallback = '') {
  const result = text(value || fallback, 160);
  if (result && !choices.includes(result)) throw new Error('INVALID_VALUE');
  return result;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password) + (process.env.AUTH_SECRET || ''), salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [kind, saltHex, hashHex] = String(stored || '').split(':');
  if (kind !== 'scrypt' || !saltHex || !hashHex) return false;
  const actual = crypto.scryptSync(String(password) + (process.env.AUTH_SECRET || ''), Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function validatePassword(value, empCode) {
  const password = String(value || '');
  if (password.length < 10 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || same(password, empCode)) throw new Error('WEAK_PASSWORD');
  return password;
}

export const formatDateTime = value => value ? new Date(value).toISOString() : '';

export function publicError(error) {
  const code = String(error?.message || error || 'UNKNOWN_ERROR');
  const messages = {
    AUTH_REQUIRED: 'انتهت الجلسة أو يلزم تسجيل الدخول.', FORBIDDEN: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
    MISSING_REQUIRED_FIELDS: 'يرجى استكمال الحقول المطلوبة.', INVALID_PHONE: 'رقم الهاتف غير صالح.',
    INVALID_DATE: 'التاريخ غير صالح.', INVALID_TIME: 'الوقت غير صالح.', INVALID_VALUE: 'إحدى القيم غير مسموح بها.',
    WEAK_PASSWORD: 'كلمة المرور يجب أن تكون 10 أحرف على الأقل وتحتوي على حروف وأرقام.',
    DATABASE_NOT_CONFIGURED: 'قاعدة البيانات غير مهيأة بعد.'
  };
  return { success: false, code, message: messages[code] || 'تعذر تنفيذ الطلب. حاول مرة أخرى.' };
}

