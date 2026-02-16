import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';

// GET /api/admins - List all admin users (only accessible by ADMIN)
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    if (user!.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const admins = await prisma.employee.findMany({
      where: {
        user: { role: 'ADMIN' },
      },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true, lastLogin: true, createdAt: true } },
        department: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, data: admins });
  } catch (error) {
    console.error('Get admins error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
