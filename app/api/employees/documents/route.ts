import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const contentType = request.headers.get('content-type') || '';

    // Support JSON body (file already uploaded via /api/upload)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { employeeId, documentFieldId, title, filePath, fileSize, fileType, documentType } = body;

      if (!employeeId || !title || !filePath) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Verify access
      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      const isOwn = employee.userId === user!.userId;
      if (!isOwn) {
        const perm = await checkPermission(user!.userId, user!.role, 'documents', 'manage');
        if (!perm.allowed) {
          return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }
      }

      // If employee is uploading, check if the field allows employee edits
      if (isOwn && documentFieldId) {
        const field = await prisma.documentField.findUnique({ where: { id: documentFieldId } });
        if (field && !field.employeeCanEdit) {
          return NextResponse.json({ error: 'You cannot upload documents for this field' }, { status: 403 });
        }
      }

      const document = await prisma.employeeDocument.create({
        data: {
          employeeId,
          documentFieldId: documentFieldId || null,
          documentType: documentType || null,
          title,
          filePath,
          fileSize: fileSize || 0,
          fileType: fileType || 'OTHER',
          uploadedBy: user!.userId,
          uploadedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, data: document, message: 'Document created' }, { status: 201 });
    }

    // Original FormData flow
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string;
    const employeeId = formData.get('employeeId') as string;

    if (!file || !documentType || !employeeId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate document type
    const validTypes = ['NIC', 'PASSPORT', 'DRIVING_LICENSE', 'BANK_STATEMENT', 'EDUCATION_CERTIFICATE', 'OTHER'];
    if (!validTypes.includes(documentType)) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      );
    }

    // Verify employee ownership (or documents permission)
    if (user!.userId !== employeeId) {
      const perm = await checkPermission(user!.userId, user!.role, 'documents', 'manage');
      if (!perm.allowed) {
        return NextResponse.json(
          { error: 'Forbidden: Can only upload documents for yourself' },
          { status: 403 }
        );
      }
    }

    // Save file to uploads directory
    const buffer = await file.arrayBuffer();
    const fs = await import('fs/promises');
    const path = await import('path');
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
    await fs.mkdir(uploadsDir, { recursive: true });
    const uniqueName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = `/uploads/documents/${uniqueName}`;
    await fs.writeFile(path.join(uploadsDir, uniqueName), Buffer.from(buffer));

    // Determine file type from extension
    const ext = file.name.split('.').pop()?.toUpperCase() || 'OTHER';

    // Create document record
    const document = await prisma.employeeDocument.create({
      data: {
        employeeId,
        documentType: documentType as any,
        title: file.name,
        filePath,
        fileSize: file.size,
        fileType: ext,
        uploadedBy: user!.userId,
        uploadedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      document,
      message: 'Document uploaded successfully',
    });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Missing employeeId' },
        { status: 400 }
      );
    }

    // Verify access
    if (user!.userId !== employeeId) {
      const perm = await checkPermission(user!.userId, user!.role, 'documents', 'view');
      if (!perm.allowed) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        documentField: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: documents });
  } catch (error) {
    console.error('Fetch documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
