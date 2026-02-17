export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { verifyToken } from '../../../lib/auth';
import { checkPermission } from '../../../lib/permissions';

// GET all document fields
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const fields = await prisma.documentField.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { documents: true }
        }
      }
    });

    return NextResponse.json({ data: fields });
  } catch (error) {
    console.error('Error fetching document fields:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create a new document field
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check permission
    const permission = await checkPermission(decoded.userId, decoded.role, 'documents', 'manage');
    if (!permission.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, isRequired, employeeCanEdit } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Field name is required' }, { status: 400 });
    }

    // Check for duplicate name
    const existing = await prisma.documentField.findUnique({
      where: { name: name.trim() }
    });
    if (existing) {
      return NextResponse.json({ error: 'A document field with this name already exists' }, { status: 400 });
    }

    // Get max sort order
    const maxSort = await prisma.documentField.aggregate({
      _max: { sortOrder: true }
    });

    const field = await prisma.documentField.create({
      data: {
        name: name.trim(),
        description: description || null,
        isRequired: isRequired || false,
        employeeCanEdit: employeeCanEdit || false,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      }
    });

    return NextResponse.json({ data: field }, { status: 201 });
  } catch (error) {
    console.error('Error creating document field:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT update a document field
export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const permission = await checkPermission(decoded.userId, decoded.role, 'documents', 'manage');
    if (!permission.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, isRequired, employeeCanEdit, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Field id is required' }, { status: 400 });
    }

    if (name) {
      const existing = await prisma.documentField.findFirst({
        where: { name: name.trim(), NOT: { id } }
      });
      if (existing) {
        return NextResponse.json({ error: 'A document field with this name already exists' }, { status: 400 });
      }
    }

    const field = await prisma.documentField.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(isRequired !== undefined && { isRequired }),
        ...(employeeCanEdit !== undefined && { employeeCanEdit }),
        ...(isActive !== undefined && { isActive }),
      }
    });

    return NextResponse.json({ data: field });
  } catch (error) {
    console.error('Error updating document field:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE a document field
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const permission = await checkPermission(decoded.userId, decoded.role, 'documents', 'manage');
    if (!permission.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Field id is required' }, { status: 400 });
    }

    // Check if there are linked documents
    const docCount = await prisma.employeeDocument.count({
      where: { documentFieldId: id }
    });

    if (docCount > 0) {
      // Soft delete
      await prisma.documentField.update({
        where: { id },
        data: { isActive: false }
      });
      return NextResponse.json({ message: 'Document field deactivated (has linked documents)' });
    }

    await prisma.documentField.delete({ where: { id } });
    return NextResponse.json({ message: 'Document field deleted' });
  } catch (error) {
    console.error('Error deleting document field:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
