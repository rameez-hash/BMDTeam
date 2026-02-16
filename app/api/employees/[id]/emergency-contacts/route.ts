import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

// Resolve employee ID from UUID or employeeCode
async function resolveEmployeeId(slug: string): Promise<string | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  if (isUUID) return slug;
  const emp = await prisma.employee.findFirst({ where: { employeeCode: slug }, select: { id: true } });
  return emp?.id || null;
}

// GET /api/employees/[id]/emergency-contacts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    const { id: slug } = await params;
    const employeeId = await resolveEmployeeId(slug);
    if (!employeeId) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const contacts = await prisma.emergencyContact.findMany({
      where: { employeeId },
      orderBy: { isPrimary: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: contacts,
    });
  } catch (error) {
    console.error('Get emergency contacts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/employees/[id]/emergency-contacts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { id: slug } = await params;
    const body = await request.json();

    const employeeId = await resolveEmployeeId(slug);
    const employee = employeeId ? await prisma.employee.findUnique({
      where: { id: employeeId },
    }) : null;

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const isOwnProfile = employee.userId === user!.userId;
    const editPerm = await checkPermission(user!.userId, user!.role, 'employees', 'edit');

    if (!isOwnProfile && !editPerm.allowed) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const { name, relationship, phone, email, address, isPrimary } = body;

    if (!name || !relationship || !phone) {
      return NextResponse.json(
        { error: 'Name, relationship, and phone are required' },
        { status: 400 }
      );
    }

    // If this is primary, remove primary from others
    if (isPrimary) {
      await prisma.emergencyContact.updateMany({
        where: { employeeId: employeeId! },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.emergencyContact.create({
      data: {
        employeeId: employeeId!,
        name,
        relationship,
        phone,
        email,
        address,
        isPrimary: isPrimary || false,
      },
    });

    return NextResponse.json({
      success: true,
      data: contact,
    }, { status: 201 });
  } catch (error) {
    console.error('Create emergency contact error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/employees/[id]/emergency-contacts
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { id: slug2 } = await params;
    const body = await request.json();
    const { contactId, name, relationship, phone, email, address, isPrimary } = body;

    if (!contactId) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    const empId = await resolveEmployeeId(slug2);
    const employee = empId ? await prisma.employee.findUnique({ where: { id: empId } }) : null;
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const isOwnProfile = employee.userId === user!.userId;
    const editPerm = await checkPermission(user!.userId, user!.role, 'employees', 'edit');
    if (!isOwnProfile && !editPerm.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (isPrimary) {
      await prisma.emergencyContact.updateMany({
        where: { employeeId: empId!, NOT: { id: contactId } },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.emergencyContact.update({
      where: { id: contactId },
      data: {
        ...(name !== undefined && { name }),
        ...(relationship !== undefined && { relationship }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(isPrimary !== undefined && { isPrimary }),
      },
    });

    return NextResponse.json({ success: true, data: contact });
  } catch (error) {
    console.error('Update emergency contact error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/employees/[id]/emergency-contacts
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { id: slug3 } = await params;
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    const empId3 = await resolveEmployeeId(slug3);
    const employee = empId3 ? await prisma.employee.findUnique({ where: { id: empId3 } }) : null;
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const isOwnProfile = employee.userId === user!.userId;
    const editPerm = await checkPermission(user!.userId, user!.role, 'employees', 'edit');
    if (!isOwnProfile && !editPerm.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await prisma.emergencyContact.delete({ where: { id: contactId } });

    return NextResponse.json({ success: true, message: 'Contact deleted' });
  } catch (error) {
    console.error('Delete emergency contact error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}