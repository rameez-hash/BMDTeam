export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { formatDate } from '@/lib/utils';

// GET /api/payroll/payslip/[id] - Download payslip
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { id } = await params;

    const payroll = await prisma.payrollRecord.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
            department: { select: { name: true } },
          },
        },
        manualDeductions: true,
      },
    });

    if (!payroll) {
      return NextResponse.json(
        { error: 'Payroll record not found' },
        { status: 404 }
      );
    }

    // Check authorization - owner can view own, others need payroll.view permission
    if (payroll.employee.userId !== user!.userId) {
      const perm = await checkPermission(user!.userId, user!.role, 'payroll', 'view');
      if (!perm.allowed) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Payslip - ${payroll.employee.firstName} ${payroll.employee.lastName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2563eb; margin: 0; }
    .header p { margin: 5px 0; color: #666; }
    .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .info-box { width: 48%; }
    .info-box h3 { color: #2563eb; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .earnings-deductions { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .column { width: 48%; }
    .column h3 { background: #2563eb; color: white; padding: 10px; margin: 0; }
    .column table { width: 100%; border-collapse: collapse; }
    .column td { padding: 10px; border-bottom: 1px solid #eee; }
    .column td:last-child { text-align: right; }
    .total-row { font-weight: bold; background: #f5f5f5; }
    .net-pay { text-align: center; background: #2563eb; color: white; padding: 20px; margin-top: 20px; }
    .net-pay h2 { margin: 0; font-size: 28px; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>PAYSLIP</h1>
    <p>${monthNames[payroll.month - 1]} ${payroll.year}</p>
  </div>
  
  <div class="info-section">
    <div class="info-box">
      <h3>Employee Details</h3>
      <div class="info-row"><span>Name:</span><span>${payroll.employee.firstName} ${payroll.employee.lastName}</span></div>
      <div class="info-row"><span>Employee Code:</span><span>${payroll.employee.employeeCode}</span></div>
      <div class="info-row"><span>Department:</span><span>${payroll.employee.department?.name || '-'}</span></div>
      <div class="info-row"><span>Designation:</span><span>${payroll.employee.designation || '-'}</span></div>
    </div>
    <div class="info-box">
      <h3>Attendance Summary</h3>
      <div class="info-row"><span>Working Days:</span><span>${payroll.workingDays}</span></div>
      <div class="info-row"><span>Present Days:</span><span>${payroll.presentDays}</span></div>
      <div class="info-row"><span>Leave Days:</span><span>${payroll.leaveDays}</span></div>
      <div class="info-row"><span>Absent Days:</span><span>${payroll.absentDays}</span></div>
      <div class="info-row"><span>Half Days:</span><span>${payroll.halfDays}</span></div>
      <div class="info-row"><span>Late Days:</span><span>${payroll.lateDays}</span></div>
    </div>
  </div>
  
  <div class="earnings-deductions">
    <div class="column">
      <h3>Earnings</h3>
      <table>
        <tr><td>Basic Salary</td><td>Rs ${Math.round(payroll.basicSalary).toLocaleString('en-PK')}</td></tr>
        <tr><td>HRA</td><td>Rs ${Math.round(payroll.hra).toLocaleString('en-PK')}</td></tr>
        <tr><td>DA</td><td>Rs ${Math.round(payroll.da).toLocaleString('en-PK')}</td></tr>
        <tr><td>Transport Allowance</td><td>Rs ${Math.round(payroll.ta).toLocaleString('en-PK')}</td></tr>
        <tr><td>Medical Allowance</td><td>Rs ${Math.round(payroll.medicalAllowance).toLocaleString('en-PK')}</td></tr>
        <tr><td>Other Allowances</td><td>Rs ${Math.round(payroll.otherAllowances).toLocaleString('en-PK')}</td></tr>
        ${payroll.overtime > 0 ? `<tr><td>Overtime</td><td>Rs ${Math.round(payroll.overtime).toLocaleString('en-PK')}</td></tr>` : ''}
        ${payroll.bonus > 0 ? `<tr><td>Bonus</td><td>Rs ${Math.round(payroll.bonus).toLocaleString('en-PK')}</td></tr>` : ''}
        <tr class="total-row"><td><strong>Gross Earnings</strong></td><td><strong>Rs ${Math.round(payroll.grossEarnings).toLocaleString('en-PK')}</strong></td></tr>
      </table>
    </div>
    <div class="column">
      <h3>Deductions</h3>
      <table>
        ${payroll.tds > 0 ? `<tr><td>Income Tax (FBR)</td><td>Rs ${Math.round(payroll.tds).toLocaleString('en-PK')}</td></tr>` : ''}
        ${payroll.pf > 0 ? `<tr><td>Provident Fund</td><td>Rs ${Math.round(payroll.pf).toLocaleString('en-PK')}</td></tr>` : ''}
        ${payroll.esi > 0 ? `<tr><td>EOBI</td><td>Rs ${Math.round(payroll.esi).toLocaleString('en-PK')}</td></tr>` : ''}
        ${payroll.professionalTax > 0 ? `<tr><td>Professional Tax</td><td>Rs ${Math.round(payroll.professionalTax).toLocaleString('en-PK')}</td></tr>` : ''}
        ${payroll.lateDeduction > 0 ? `<tr><td>Late Deduction</td><td>Rs ${Math.round(payroll.lateDeduction).toLocaleString('en-PK')}</td></tr>` : ''}
        ${payroll.otherDeductions > 0 ? `<tr><td>Absent Deduction</td><td>Rs ${Math.round(payroll.otherDeductions).toLocaleString('en-PK')}</td></tr>` : ''}
        ${payroll.manualDeductions && payroll.manualDeductions.length > 0 ? payroll.manualDeductions.map((d: { label: string; amount: number; reason?: string | null }) => `<tr><td>${d.label}${d.reason ? ` <small style="color:#999">(${d.reason})</small>` : ''}</td><td>Rs ${Math.round(d.amount).toLocaleString('en-PK')}</td></tr>`).join('') : ''}
        <tr class="total-row"><td><strong>Total Deductions</strong></td><td><strong>Rs ${Math.round(payroll.totalDeductions).toLocaleString('en-PK')}</strong></td></tr>
      </table>
    </div>
  </div>
  
  <div class="net-pay">
    <p>Net Pay</p>
    <h2>Rs ${Math.round(payroll.netSalary).toLocaleString('en-PK')}</h2>
  </div>
  
  <div class="footer">
    <p>This is a computer generated payslip and does not require signature.</p>
    <p>Generated on: ${formatDate(new Date(), 'dd MMM yyyy')}</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="payslip_${payroll.employee.employeeCode}_${payroll.month}_${payroll.year}.html"`,
      },
    });
  } catch (error) {
    console.error('Download payslip error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
