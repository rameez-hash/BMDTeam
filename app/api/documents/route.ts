export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { parseDateUTC } from '@/lib/utils';

// GET /api/documents - Get all employee documents
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    const where: any = {};
    
    // Check permission and apply scope
    const viewPerm = await checkPermission(user!.userId, user!.role, 'documents', 'view');
    if (!viewPerm.allowed) {
      // Even without doc permission, employees can see their own
      const emp = await prisma.employee.findUnique({ where: { userId: user!.userId } });
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      where.employeeId = emp.id;
    } else if (viewPerm.scope === 'SELF') {
      const emp = await prisma.employee.findUnique({ where: { userId: user!.userId } });
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      where.employeeId = emp.id;
    } else if (viewPerm.scope === 'DEPARTMENT') {
      const emp = await prisma.employee.findUnique({ where: { userId: user!.userId } });
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      const deptEmployees = await prisma.employee.findMany({
        where: { departmentId: emp.departmentId },
        select: { id: true },
      });
      where.employeeId = { in: deptEmployees.map(e => e.id) };
      if (employeeId) where.employeeId = employeeId;
    } else if (employeeId) {
      where.employeeId = employeeId;
    }

    if (type) where.documentType = type;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Non-admin users can only see documents with visibility 'ALL'
    const isAdminOrHR = user!.role === 'ADMIN' || user!.role === 'HR';
    if (!isAdminOrHR) {
      where.visibility = 'ALL';
    }

    const documents = await prisma.employeeDocument.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true, profileImage: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    // Get unique employees for filter dropdown
    const employees = await prisma.employee.findMany({
      where: { employmentStatus: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      orderBy: { firstName: 'asc' },
    });

    return NextResponse.json({ documents, employees });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// POST /api/documents - Upload a document
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const body = await request.json();
    const { employeeId, documentType, title, filePath, fileSize, fileType, description, expiryDate, visibility } = body;

    // Only users with manage permission can upload
    const managePerm = await checkPermission(user!.userId, user!.role, 'documents', 'manage');
    if (!managePerm.allowed) {
      return NextResponse.json({ error: 'You do not have permission to upload documents' }, { status: 403 });
    }

    let targetEmployeeId = employeeId;
    if (!targetEmployeeId) {
      const emp = await prisma.employee.findUnique({ where: { userId: user!.userId } });
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      targetEmployeeId = emp.id;
    }

    const document = await prisma.employeeDocument.create({
      data: {
        employeeId: targetEmployeeId,
        documentType: documentType || 'OTHER',
        title,
        filePath,
        fileSize: fileSize || 0,
        fileType: fileType || 'PDF',
        uploadedBy: user!.userId,
        description,
        expiryDate: expiryDate ? parseDateUTC(expiryDate) : null,
        visibility: visibility || 'ALL',
        isApproved: managePerm.allowed,
        approvedBy: managePerm.allowed ? user!.userId : null,
        approvedAt: managePerm.allowed ? new Date() : null,
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
      },
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

// PUT /api/documents - Update/approve a document
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const body = await request.json();
    const { id, action, ...updateData } = body;

    if (action === 'approve') {
      const approvePerm = await checkPermission(user!.userId, user!.role, 'documents', 'manage');
      if (!approvePerm.allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const doc = await prisma.employeeDocument.update({
        where: { id },
        data: { isApproved: true, approvedBy: user!.userId, approvedAt: new Date() },
      });
      return NextResponse.json(doc);
    }

    const doc = await prisma.employeeDocument.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(doc);
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

// DELETE /api/documents
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Document ID required' }, { status: 400 });

    // Check if user owns the document or has manage permission
    const doc = await prisma.employeeDocument.findUnique({ where: { id }, include: { employee: true } });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const isOwner = doc.employee.userId === user!.userId;
    const managePerm = await checkPermission(user!.userId, user!.role, 'documents', 'manage');
    if (!isOwner && !managePerm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    await prisma.employeeDocument.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
