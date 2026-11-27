import type React from 'react';

const ALTERNATE_ZIP_ENDPOINTS: Record<string, string> = {
  '/amasa-dist.zip': '/download/dist',
  '/download/dist': '/amasa-dist.zip',
  '/amasa-source.zip': '/download/source',
  '/download/source': '/amasa-source.zip',
  '/amasa-claude-starter.zip': '/download/claude-starter',
  '/download/claude-starter': '/amasa-claude-starter.zip',
  '/amasa-android-studio.zip': '/download/android-studio',
  '/download/android-studio': '/amasa-android-studio.zip',
};

async function fetchValidZipBuffer(url: string): Promise<ArrayBuffer> {
  const cacheBusterUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const response = await fetch(cacheBusterUrl, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Standard local file header ZIP magic bytes: 0x50 ('P'), 0x4B ('K'), 0x03, 0x04
  const isValidZipHeader =
    bytes.length > 1024 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;
  if (!isValidZipHeader) {
    throw new Error('Response is not a valid ZIP archive');
  }
  return buffer;
}

/**
 * Safely downloads a ZIP package via fetch + magic-byte ('PK\x03\x04') verification
 * so Service Workers or SPA fallback HTML pages can never be saved as an empty/corrupted .zip file.
 */
export async function downloadZipSafely(
  e: React.MouseEvent<HTMLAnchorElement>,
  url: string,
  filename: string
): Promise<void> {
  e.preventDefault();
  const candidates = [url];
  const alt = ALTERNATE_ZIP_ENDPOINTS[url];
  if (alt) candidates.push(alt);

  for (const targetUrl of candidates) {
    try {
      const buffer = await fetchValidZipBuffer(targetUrl);
      const blob = new Blob([buffer], { type: 'application/zip' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    } catch {
      // Try next endpoint candidate
    }
  }

  // Last resort: direct server link only if fetch itself was blocked by browser policy
  const fallbackLink = document.createElement('a');
  fallbackLink.href = `${url}?t=${Date.now()}`;
  fallbackLink.download = filename;
  document.body.appendChild(fallbackLink);
  fallbackLink.click();
  document.body.removeChild(fallbackLink);
}
