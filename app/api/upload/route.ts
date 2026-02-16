import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// Allowed file types by category
const FILE_TYPE_CONFIGS: Record<string, { types: string[]; maxSize: number; label: string }> = {
  profile: {
    types: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    label: 'JPEG, PNG, GIF, and WebP images',
  },
  documents: {
    types: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    ],
    maxSize: 25 * 1024 * 1024, // 25MB
    label: 'PDF, Word, Excel, PowerPoint, text files, and images',
  },
  onboarding: {
    types: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    ],
    maxSize: 15 * 1024 * 1024, // 15MB
    label: 'PDF, Word, Excel, text files, and images',
  },
};

// POST /api/upload - Upload file (profile image, documents, onboarding)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'profile';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get config for file type category
    const config = FILE_TYPE_CONFIGS[type] || FILE_TYPE_CONFIGS.profile;

    // Validate file type
    if (!config.types.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${config.label}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > config.maxSize) {
      const maxMB = Math.round(config.maxSize / (1024 * 1024));
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxMB}MB.` },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', type);
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename (preserve original name for documents)
    const ext = file.name.split('.').pop() || 'bin';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
    const filename = `${user!.userId}_${Date.now()}_${safeName}`;
    const filepath = path.join(uploadsDir, filename);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Return the public URL
    const publicUrl = `/uploads/${type}/${filename}`;

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        filename: file.name,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
