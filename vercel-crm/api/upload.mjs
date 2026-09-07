import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const response = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const meta = JSON.parse(clientPayload || '{}');
        const allowedTypes = ['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'];
        if (!allowedTypes.includes(meta.mimeType)) throw new Error('نوع الملف غير مسموح.');
        return { allowedContentTypes: allowedTypes, maximumSizeInBytes: 6 * 1024 * 1024, addRandomSuffix: true, tokenPayload: JSON.stringify({ mimeType: meta.mimeType }) };
      },
      onUploadCompleted: async () => {}
    });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'UPLOAD_FAILED' });
  }
}

