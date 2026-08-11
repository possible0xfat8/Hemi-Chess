const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'hemi-profile-storage';

// Check if R2 is configured
const isR2Enabled = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);

let r2Client = null;

if (isR2Enabled) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  console.log('[R2] Client initialized for bucket:', R2_BUCKET_NAME);
} else {
  console.log('[R2] Not configured - avatar uploads disabled');
  console.log('[R2] Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY to .env');
}

/**
 * Upload avatar to R2
 * @param {string} walletAddress - User's wallet address
 * @param {Buffer} imageBuffer - Processed image buffer
 * @param {string} contentType - Image MIME type
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function uploadAvatar(walletAddress, imageBuffer, contentType) {
  if (!isR2Enabled) {
    return { success: false, error: 'R2 storage not configured' };
  }

  try {
    const key = `avatars/${walletAddress.toLowerCase()}.jpg`;
    
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1 year
    });

    await r2Client.send(command);

    // R2 public URL (you need to set up a custom domain or use R2 public access)
    const publicUrl = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${key}`;
    
    console.log(`[R2] Avatar uploaded for ${walletAddress.slice(0, 8)}`);
    return { success: true, url: publicUrl };
  } catch (error) {
    console.error('[R2] Upload error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete avatar from R2
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteAvatar(walletAddress) {
  if (!isR2Enabled) {
    return { success: false, error: 'R2 storage not configured' };
  }

  try {
    const key = `avatars/${walletAddress.toLowerCase()}.jpg`;
    
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    
    console.log(`[R2] Avatar deleted for ${walletAddress.slice(0, 8)}`);
    return { success: true };
  } catch (error) {
    console.error('[R2] Delete error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if avatar exists
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<boolean>}
 */
async function avatarExists(walletAddress) {
  if (!isR2Enabled) return false;

  try {
    const key = `avatars/${walletAddress.toLowerCase()}.jpg`;
    
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get avatar URL
 * @param {string} walletAddress - User's wallet address
 * @returns {string|null}
 */
function getAvatarUrl(walletAddress) {
  if (!isR2Enabled || !walletAddress) return null;
  
  const key = `avatars/${walletAddress.toLowerCase()}.jpg`;
  return `https://pub-${R2_ACCOUNT_ID}.r2.dev/${key}`;
}

module.exports = {
  isR2Enabled,
  uploadAvatar,
  deleteAvatar,
  avatarExists,
  getAvatarUrl,
};
