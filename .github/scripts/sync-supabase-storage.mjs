#!/usr/bin/env node
/**
 * Downloads all objects from a Supabase Storage bucket to a local directory
 * using the Supabase Storage REST API (requires SUPABASE_SERVICE_ROLE_KEY).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'klasskit-media';
const OUT_DIR = process.env.BACKUP_STORAGE_DIR || '/tmp/backup/storage';
const CONCURRENCY = 8;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  apikey: SERVICE_ROLE_KEY,
};

async function listFolder(prefix = '') {
  const files = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${encodeURIComponent(BUCKET)}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefix,
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to list "${prefix}": HTTP ${res.status} ${await res.text()}`);
    }

    const entries = await res.json();
    if (!Array.isArray(entries) || entries.length === 0) break;

    for (const entry of entries) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folder placeholders have id === null in Supabase Storage list responses
      if (entry.id === null) {
        const nested = await listFolder(fullPath);
        files.push(...nested);
      } else {
        files.push(fullPath);
      }
    }

    if (entries.length < limit) break;
    offset += limit;
  }

  return files;
}

async function downloadFile(objectPath) {
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encodedPath}`, {
    headers,
  });

  if (!res.ok) {
    throw new Error(`Failed to download "${objectPath}": HTTP ${res.status} ${await res.text()}`);
  }

  const destPath = path.join(OUT_DIR, BUCKET, objectPath);
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buf);
  return buf.byteLength;
}

async function main() {
  console.log(`Listing objects in Supabase Storage bucket "${BUCKET}"...`);
  const files = await listFolder('');
  console.log(`Found ${files.length} object(s). Downloading with concurrency ${CONCURRENCY}...`);

  let index = 0;
  let totalBytes = 0;

  async function worker() {
    while (index < files.length) {
      const current = files[index++];
      const bytes = await downloadFile(current);
      totalBytes += bytes;
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker()));
  console.log(`Downloaded ${files.length} object(s) (${(totalBytes / (1024 * 1024)).toFixed(2)} MB) to ${path.join(OUT_DIR, BUCKET)}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
