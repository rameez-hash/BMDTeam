import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { sendEmail, getPasswordResetEmail } from '@/lib/email';

// POST /api/auth/forgot-password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email (check both User.email and Employee.email)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase().trim() },
          { employee: { email: email.toLowerCase().trim() } },
        ],
      },
      include: {
        employee: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      return NextResponse.json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.',
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to database
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExp },
    });

    // Build reset link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    request.headers.get('origin') || 
                    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    // Send email
    const recipientEmail = user.employee?.email || user.email;
    const name = user.employee 
      ? `${user.employee.firstName} ${user.employee.lastName}` 
      : user.email;

    const sent = await sendEmail({
      to: recipientEmail,
      subject: 'Password Reset - BMD HRMS',
      html: getPasswordResetEmail(name, resetLink),
    });

    if (!sent) {
      console.error('Failed to send password reset email to:', recipientEmail);
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
