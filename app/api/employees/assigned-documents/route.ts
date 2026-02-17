export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'documents', 'manage');
    if (!perm.allowed) {
      return NextResponse.json(
        { error: 'Permission denied: Cannot assign documents' },
        { status: 403 }
      );
    }

    const data = await request.json();
    const { employeeId, title, description, filePath, fileType, expiryDate } = data;

    if (!employeeId || !title || !filePath) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const document = await prisma.assignedDocument.create({
      data: {
        employeeId,
        title,
        description,
        filePath,
        fileType: fileType || 'application/pdf',
        assignedBy: user!.employeeDbId || user!.userId,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        assignedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error('Assign document error:', error);
    return NextResponse.json(
      { error: 'Failed to assign document' },
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

    const documents = await prisma.assignedDocument.findMany({
      where: { employeeId },
      orderBy: { assignedAt: 'desc' },
    });

    // Check if any documents have expired
    const now = new Date();
    const enrichedDocuments = documents.map((doc) => ({
      ...doc,
      isExpired: doc.expiryDate ? doc.expiryDate < now : false,
      daysToExpire: doc.expiryDate
        ? Math.ceil(
            (doc.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          )
        : null,
    }));

    return NextResponse.json(enrichedDocuments);
  } catch (error) {
    console.error('Fetch assigned documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
