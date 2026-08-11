# Profile Picture Upload Feature

## Overview
Users can now upload custom profile pictures that are stored in Cloudflare R2 and displayed throughout the application.

---

## Backend Implementation

### 1. R2 Storage Service (`backend/services/r2Storage.js`)
- **S3-compatible client** configured for Cloudflare R2
- **Functions:**
  - `uploadAvatar(walletAddress, imageBuffer, contentType)` - Upload processed images
  - `deleteAvatar(walletAddress)` - Delete user avatars
  - `avatarExists(walletAddress)` - Check if avatar exists
  - `getAvatarUrl(walletAddress)` - Get public avatar URL

### 2. API Endpoints (`backend/server.js`)
- **POST** `/api/player/:playerId/avatar` - Upload avatar
  - Accepts multipart/form-data with 'avatar' field
  - Validates file type (JPEG, PNG, WebP)
  - Max file size: 5MB
  - Processes image with Sharp:
    - Resizes to 400x400px
    - Converts to JPEG
    - Quality: 85%
    - Progressive encoding
  - Returns `{ success: true, avatarUrl: "..." }`

- **GET** `/api/player/:playerId/avatar` - Get avatar URL
  - Returns `{ avatarUrl: "..." }`

- **DELETE** `/api/player/:playerId/avatar` - Delete avatar
  - Returns `{ success: true }`

### 3. Database Integration (`backend/supabase.js`)
- **New function:** `updatePlayerAvatar(playerId, avatarUrl)`
- **Migration:** `backend/migrations/003_add_avatar_url.sql`
  - Adds `avatar_url TEXT` column to `players` table
  - Creates index for faster lookups

### 4. Dependencies Installed
```bash
npm install @aws-sdk/client-s3 multer sharp
```

### 5. Environment Variables (`.env`)
```env
R2_ACCOUNT_ID=1ed3976077de985fd1e4771609069703
R2_ACCESS_KEY_ID=e55f0e91883d8289837155e93820761a
R2_SECRET_ACCESS_KEY=b218881944731b659c94f8eea55f507c41848127e618336f5a51c60edba36c79
R2_BUCKET_NAME=hemi-profile-storage
```

---

## Frontend Implementation

### 1. Avatar Upload Component (`src/components/AvatarUpload.tsx`)
- **Features:**
  - File selection with drag-and-drop support
  - Image preview before upload
  - Upload progress indication
  - Delete existing avatar
  - Error handling and validation
  - Responsive design (mobile & desktop)

- **Props:**
  ```typescript
  interface AvatarUploadProps {
    currentAvatarUrl?: string | null;
    walletAddress: string;
    onUploadSuccess?: (avatarUrl: string) => void;
  }
  ```

### 2. Profile Pages Updated

#### Own Profile (`src/components/game/ProfileClient.tsx`)
- Shows current avatar or default initial
- Includes AvatarUpload component
- Refreshes stats after upload
- Avatar displays in header

#### Other User Profile (`src/components/game/UserProfileClient.tsx`)
- Displays user's avatar
- Falls back to initial if no avatar
- Shows "Add Friend" button for non-friends

### 3. Avatar Display Locations

#### Leaderboard (`src/components/Leaderboard.tsx`)
- Desktop table view: Avatar with username
- Mobile card view: Avatar with rank badge
- Clickable to view user profile

#### Friends List (`src/components/FriendsList.tsx`)
- Friend cards: Avatar with username and stats
- Search results: Avatar with player info
- Different gradient colors for friends vs search results

### 4. Avatar Fallback
- If no avatar: Shows first letter of username
- Colored background (orange gradient)
- Consistent across all components

---

## Setup Instructions

### 1. Database Migration
Run the migration to add the `avatar_url` column:
```sql
-- Execute backend/migrations/003_add_avatar_url.sql
-- in your Supabase SQL editor
```

### 2. Configure R2 Bucket
You need to configure the R2 bucket for public access:

#### Option A: R2 Public Access (Recommended)
1. Go to Cloudflare Dashboard → R2
2. Select `hemi-profile-storage` bucket
3. Go to Settings → Public Access
4. Enable "Allow Access" with custom domain or R2.dev subdomain
5. Update `r2Storage.js` with your public URL format

#### Option B: Custom Domain
1. Add a custom domain to your R2 bucket
2. Update the `getAvatarUrl()` function in `r2Storage.js`:
   ```javascript
   function getAvatarUrl(walletAddress) {
     if (!isR2Enabled || !walletAddress) return null;
     const key = `avatars/${walletAddress.toLowerCase()}.jpg`;
     return `https://your-custom-domain.com/${key}`;
   }
   ```

### 3. Start Backend
```bash
cd backend
npm start  # or npm run dev for development
```

### 4. Start Frontend
```bash
bun run dev
```

---

## File Structure

```
backend/
├── services/
│   └── r2Storage.js          # R2 storage service
├── migrations/
│   └── 003_add_avatar_url.sql # Database migration
├── server.js                  # Avatar upload endpoints
├── supabase.js               # updatePlayerAvatar function
└── .env                      # R2 credentials

src/
├── components/
│   ├── AvatarUpload.tsx      # Avatar upload UI component
│   ├── Leaderboard.tsx       # Shows avatars in leaderboard
│   ├── FriendsList.tsx       # Shows avatars in friends
│   └── game/
│       ├── ProfileClient.tsx      # Own profile with upload
│       └── UserProfileClient.tsx  # Other user profiles
```

---

## API Usage Examples

### Upload Avatar
```typescript
const formData = new FormData();
formData.append('avatar', file);

const response = await fetch(
  `${BACKEND_URL}/api/player/${walletAddress}/avatar`,
  { method: 'POST', body: formData }
);

const result = await response.json();
// { success: true, avatarUrl: "https://..." }
```

### Get Avatar URL
```typescript
const response = await fetch(
  `${BACKEND_URL}/api/player/${walletAddress}/avatar`
);

const result = await response.json();
// { avatarUrl: "https://..." }
```

### Delete Avatar
```typescript
const response = await fetch(
  `${BACKEND_URL}/api/player/${walletAddress}/avatar`,
  { method: 'DELETE' }
);

const result = await response.json();
// { success: true }
```

---

## Testing Checklist

- [ ] Run database migration
- [ ] Configure R2 bucket public access
- [ ] Start backend server (check R2 logs)
- [ ] Upload an avatar from profile page
- [ ] Verify avatar appears in profile header
- [ ] Check avatar in leaderboard
- [ ] Check avatar in friends list
- [ ] Delete avatar and verify removal
- [ ] Test with different image formats (JPEG, PNG, WebP)
- [ ] Test file size validation (>5MB should fail)
- [ ] Test mobile responsiveness

---

## Troubleshooting

### Issue: Avatars not showing
- Check R2 bucket has public access enabled
- Verify R2 credentials in `.env`
- Check browser console for CORS errors
- Ensure avatar URLs are publicly accessible

### Issue: Upload fails
- Check backend logs for errors
- Verify file size is under 5MB
- Ensure file type is JPEG, PNG, or WebP
- Check R2 account has sufficient storage

### Issue: Images are not resized
- Verify Sharp is installed: `npm list sharp`
- Check backend can write to temp directory
- Review server logs for Sharp errors

---

## Security Considerations

1. **File Validation:** Only JPEG, PNG, WebP allowed
2. **Size Limit:** 5MB maximum
3. **Image Processing:** All images resized/converted server-side
4. **Storage:** Files stored with wallet address as key (prevents collisions)
5. **Access Control:** Only authenticated users can upload to their own profile

---

## Future Enhancements

- [ ] Image cropping UI in frontend
- [ ] Multiple image quality/size options
- [ ] Avatar moderation system
- [ ] Default avatar selection (generated patterns)
- [ ] GIF/animated avatar support
- [ ] Avatar change history
- [ ] Bulk avatar migration tools

---

## Git Commits

1. `Add profile picture upload with R2, clickable leaderboard profiles, and footer to all pages`
2. `Add frontend avatar upload UI and display avatars in profiles`
3. `Display avatars in Leaderboard and Friends list`

Repository: https://github.com/possible0xfat8/Hemi-Chess
