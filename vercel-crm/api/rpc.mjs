import { methods } from '../lib/services.mjs';
import { publicError } from '../lib/core.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' });
  try {
    const { method, args = [] } = req.body || {};
    if (!Object.hasOwn(methods, method) || !Array.isArray(args)) return res.status(400).json({ success: false, code: 'UNKNOWN_METHOD', message: 'العملية المطلوبة غير معروفة.' });
    return res.status(200).json(await methods[method](...args));
  } catch (error) {
    console.error('rpc failure', error);
    return res.status(200).json(publicError(error));
  }
}

