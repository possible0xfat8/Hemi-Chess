# Cloudflare R2 Setup Guide for Avatar Storage

## Step 1: Enable Public Access on Your R2 Bucket

### Option A: Using R2.dev Subdomain (Easiest)

1. **Go to Cloudflare Dashboard**
   - Navigate to R2 → Buckets
   - Click on your `hemi-profile-storage` bucket

2. **Enable Public Access**
   - Go to the "Settings" tab
   - Scroll to "Public Access"
   - Click "Connect Domain" → "Allow Access via R2.dev"
   - This will give you a URL like: `https://pub-{hash}.r2.dev`

3. **Update Backend Code**
   
   In `backend/services/r2Storage.js`, update the URL format:
   
   ```javascript
   // Replace YOUR_R2_DEV_SUBDOMAIN with the actual subdomain from step 2
   const R2_PUBLIC_URL = 'https://pub-xxxxxxxxxxxxx.r2.dev';
   
   // In uploadAvatar function:
   const publicUrl = `${R2_PUBLIC_URL}/${key}`;
   
   // In getAvatarUrl function:
   return `${R2_PUBLIC_URL}/${key}`;
   ```

### Option B: Using Custom Domain (Recommended for Production)

1. **Add Custom Domain**
   - In your bucket settings, click "Connect Domain"
   - Choose "Custom Domains"
   - Enter your domain (e.g., `cdn.hemichess.com` or `avatars.hemichess.com`)
   - Follow DNS setup instructions

2. **Update Backend Code**
   
   ```javascript
   const R2_PUBLIC_URL = 'https://cdn.hemichess.com';
   ```

---

## Step 2: Configure CORS (Required for Browser Uploads)

If you plan to allow direct browser uploads in the future, configure CORS:

1. Go to your bucket settings
2. Scroll to "CORS Policy"
3. Add this policy:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:8080",
      "https://your-frontend-domain.com"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Step 3: Update Environment Variable (Optional)

Add the public URL to your `.env` for easier configuration:

```env
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxx.r2.dev
```

Then update `r2Storage.js`:

```javascript
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

if (!R2_PUBLIC_URL) {
  console.warn('[R2] R2_PUBLIC_URL not set - avatars may not be publicly accessible');
}
```

---

## Step 4: Restart Backend Server

```bash
cd backend
npm start
```

---

## Verification Steps

1. **Upload a test avatar** from the profile page
2. **Check backend logs** for the uploaded URL
3. **Open the URL directly** in your browser - it should show the image
4. **If you get Access Denied**, the bucket isn't public yet

---

## Quick Fix Script

Add this to `backend/services/r2Storage.js` at the top:

```javascript
// Quick configuration - update this with your actual R2 public URL
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-REPLACE-WITH-YOUR-HASH.r2.dev';
```

Then in both `uploadAvatar` and `getAvatarUrl`, replace:

```javascript
// OLD
const publicUrl = `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

// NEW
const publicUrl = `${R2_PUBLIC_URL}/${key}`;
```

---

## Common Issues

### Issue: Images return 403 Forbidden
**Solution:** Enable public access in Cloudflare dashboard (Step 1)

### Issue: Images return 404 Not Found
**Solution:** Check the URL format matches your R2 setup

### Issue: CORS errors in browser
**Solution:** Configure CORS policy (Step 2)

### Issue: Can't find R2.dev subdomain
**Solution:** You must explicitly enable it in bucket settings → Public Access

---

## Testing Your Setup

Run this in your browser console when on the frontend:

```javascript
fetch('YOUR_R2_URL/avatars/test.jpg')
  .then(r => r.ok ? 'Public access works!' : 'Access denied')
  .then(console.log)
```

If you see "Access denied", follow Step 1 again carefully.
