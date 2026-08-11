import { useState, useRef } from 'react';
import { Upload, X, Loader2, Camera } from 'lucide-react';
import { getBackendUrl } from '@/lib/config';

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  walletAddress: string;
  onUploadSuccess?: (avatarUrl: string) => void;
}

export function AvatarUpload({ currentAvatarUrl, walletAddress, onUploadSuccess }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.[0]) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('avatar', fileInputRef.current.files[0]);

      const response = await fetch(
        `${getBackendUrl()}/api/player/${walletAddress.toLowerCase()}/avatar`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      
      if (result.success && result.avatarUrl) {
        setPreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onUploadSuccess?.(result.avatarUrl);
      } else {
        throw new Error('Upload failed');
      }
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      setError(err.message || 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete your profile picture?')) return;

    setUploading(true);
    setError(null);

    try {
      const response = await fetch(
        `${getBackendUrl()}/api/player/${walletAddress.toLowerCase()}/avatar`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }

      onUploadSuccess?.(null as any);
    } catch (err: any) {
      console.error('Avatar delete error:', err);
      setError(err.message || 'Failed to delete avatar');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Avatar Preview */}
        <div className="relative">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-[var(--surface-strong)] border-2 border-line flex items-center justify-center">
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            ) : currentAvatarUrl ? (
              <img src={currentAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-8 h-8 sm:w-12 sm:h-12 text-ink-faint" />
            )}
          </div>
          {(currentAvatarUrl || preview) && !uploading && (
            <button
              onClick={preview ? handleCancel : handleDelete}
              className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-danger-accent hover:bg-danger-accent/90 text-canvas flex items-center justify-center transition-colors"
              title={preview ? 'Cancel' : 'Delete avatar'}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1 w-full sm:w-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            onChange={handleFileSelect}
            className="hidden"
            id="avatar-upload"
          />

          {preview ? (
            <div className="flex gap-2">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 sm:flex-none px-4 py-2 bg-orange hover:bg-orange/90 disabled:bg-line text-canvas disabled:text-ink-faint rounded-lg font-semibold transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={uploading}
                className="px-4 py-2 bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink rounded-lg font-medium transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <label
              htmlFor="avatar-upload"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink rounded-lg font-medium transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              {currentAvatarUrl ? 'Change Picture' : 'Upload Picture'}
            </label>
          )}

          <p className="mt-2 text-xs text-ink-faint">
            JPEG, PNG or WebP. Max 5MB. Will be resized to 400x400px.
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-danger-accent/10 border border-danger-accent/30 text-danger-accent text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
