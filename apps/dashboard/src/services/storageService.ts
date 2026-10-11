import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, isOfflineMode, isTestEnv } from '../lib/firestore.js';

export interface UploadedAssetResult {
  downloadUrl: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  width?: number | undefined;
  height?: number | undefined;
  durationSeconds?: number | undefined;
}

export type SupportedAssetCategory = 'image' | 'video' | 'animated' | 'all';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Validates a file before uploading to Firebase Storage.
 */
export function validateCreativeFile(file: File, category: SupportedAssetCategory = 'all'): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const isLottieJson = (mime === 'application/json' || mime === 'text/json' || name.endsWith('.json'));

  const isImage = mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp' || mime === 'image/gif';
  const isVideo = mime === 'video/mp4' || mime === 'video/webm';
  const isAnimated = mime === 'image/gif' || isLottieJson;

  if (category === 'image' && !isImage) {
    return { valid: false, error: 'Only JPG, PNG, WebP, and GIF images are supported.' };
  }

  if (category === 'video' && !isVideo) {
    return { valid: false, error: 'Only MP4 and WebM video formats are supported.' };
  }

  if (category === 'animated' && !isAnimated) {
    return { valid: false, error: 'Only GIF and Lottie (.json) files are supported for animated creatives.' };
  }

  if (category === 'all' && !isImage && !isVideo && !isAnimated) {
    return { valid: false, error: 'Unsupported file type. Please upload a valid image, MP4/WebM video, or Lottie JSON.' };
  }

  // Size validation
  if (isVideo && file.size > MAX_VIDEO_SIZE_BYTES) {
    return { valid: false, error: `Video size exceeds ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)}MB limit.` };
  }

  if (!isVideo && file.size > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: `File size exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB limit.` };
  }

  return { valid: true };
}

/**
 * Helper to inspect image dimensions in browser.
 */
function getImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.URL || !file.type.startsWith('image/')) {
      return resolve({});
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      resolve({});
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  });
}

/**
 * Helper to inspect video dimensions and duration in browser.
 */
function getVideoMetadata(file: File): Promise<{ width?: number; height?: number; durationSeconds?: number }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.URL || !file.type.startsWith('video/')) {
      return resolve({});
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: Math.round(video.duration * 100) / 100,
      });
      URL.revokeObjectURL(objectUrl);
    };
    video.onerror = () => {
      resolve({});
      URL.revokeObjectURL(objectUrl);
    };
    video.src = objectUrl;
  });
}

/**
 * Uploads a creative file directly to Firebase Storage under /campaign-assets/{campaignId}/...
 */
export async function uploadCreativeAsset(
  file: File,
  campaignId: string,
  folder = 'main',
  onProgress?: (progressPct: number) => void,
): Promise<UploadedAssetResult> {
  const validation = validateCreativeFile(file, 'all');
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file for creative upload');
  }

  // Extract dimensions/duration if possible in browser
  const isVideo = file.type.startsWith('video/');
  let dimensions: { width?: number; height?: number; durationSeconds?: number } = {};
  try {
    if (isVideo) {
      dimensions = await getVideoMetadata(file);
    } else if (file.type.startsWith('image/')) {
      dimensions = await getImageDimensions(file);
    }
  } catch {
    // Non-blocking metadata extraction
  }

  // Offline / Test mock fallback
  if (isOfflineMode || isTestEnv) {
    if (onProgress) onProgress(100);
    const mockUrl = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : `https://mock.storage.local/campaign-assets/${campaignId}/${file.name}`;
    return {
      downloadUrl: mockUrl,
      storagePath: `campaign-assets/${campaignId}/${folder}/${file.name}`,
      mimeType: file.type || 'application/octet-stream',
      fileSizeBytes: file.size,
      width: dimensions.width,
      height: dimensions.height,
      durationSeconds: dimensions.durationSeconds,
    };
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${Date.now()}_${cleanName}`;
  const storagePath = `campaign-assets/${campaignId}/${folder}/${filename}`;
  const fileRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(fileRef, file, {
    contentType: file.type,
    customMetadata: {
      campaignId,
      uploadedAt: new Date().toISOString(),
      originalName: file.name,
    },
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) onProgress(progress);
        }
      },
      (error) => {
        reject(new Error(`Storage upload failed: ${error.message}`));
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            downloadUrl,
            storagePath,
            mimeType: file.type || 'application/octet-stream',
            fileSizeBytes: file.size,
            width: dimensions.width,
            height: dimensions.height,
            durationSeconds: dimensions.durationSeconds,
          });
        } catch (err: any) {
          reject(new Error(`Failed to retrieve download URL: ${err.message}`));
        }
      },
    );
  });
}
