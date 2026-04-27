// CCM Accident Assistant | Built: 2026-04-27 08:42 AM EDT
/**
 * CCM Accident Assistant — Upload Photo API
 * POST /api/upload-photo
 * Body: { image: base64string, mediaType: string, filename: string, claimRef: string, category: string }
 *
 * Uploads photo to Vercel Blob and returns public URL.
 */

import { put } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, mediaType, filename, claimRef, category } = req.body || {};
  if (!image || !filename) return res.status(400).json({ error: 'Missing image or filename' });

  try {
    // Convert base64 to Buffer
    const buffer = Buffer.from(image, 'base64');

    // Build a clean filename: claimRef_category_timestamp.ext
    const ext = mediaType === 'application/pdf' ? 'pdf'
               : mediaType === 'image/png'  ? 'png'
               : mediaType === 'image/heic' ? 'heic'
               : 'jpg';
    const safeCategory = (category||'photo').replace(/[^a-zA-Z0-9]/g, '_');
    const safeRef      = (claimRef||'unknown').replace(/[^a-zA-Z0-9\-]/g, '_');
    const ts           = Date.now();
    const blobName     = `claims/${safeRef}/${safeCategory}_${ts}.${ext}`;

    const blob = await put(blobName, buffer, {
      access: 'public',
      contentType: mediaType || 'image/jpeg',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    res.status(200).json({
      success: true,
      url: blob.url,
      filename: blobName,
      category,
    });

  } catch (err) {
    console.error('upload-photo error:', err);
    res.status(500).json({ error: 'Upload failed', detail: err.message });
  }
}
