import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { formatDate } from '@/lib/utils';
import fs from 'fs';
import path from 'path';

// ─── PKR Currency Formatter ───
const formatPKR = (amount: number) => {
  if (!amount && amount !== 0) return 'Rs 0';
  return 'Rs ' + Math.round(amount).toLocaleString('en-PK');
};

// ─── Load logo as base64 ───
function getLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo-dark.webp');
    const buf = fs.readFileSync(logoPath);
    return 'data:image/webp;base64,' + buf.toString('base64');
  } catch {
    return '';
  }
}

// ─── Shared CSS for payslip (single source of truth) ───
const payslipCSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    padding: 20px;
    color: #1e293b;
    background: #fff;
    font-size: 11px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .payslip-container {
    max-width: 210mm;
    margin: 0 auto 30px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    page-break-after: always;
  }
  .header {
    background: #1e293b;
    color: white;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .header-logo img {
    height: 32px;
    object-fit: contain;
    filter: brightness(0) invert(1);
  }
  .company-name { font-size: 18px; font-weight: 700; }
  .company-sub { font-size: 9px; opacity: 0.7; margin-top: 1px; }
  .header-right { text-align: right; }
  .header-right .slip-title {
    font-size: 13px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 2px;
    opacity: 0.9;
  }
  .header-right .slip-period {
    font-size: 11px; opacity: 0.7; margin-top: 2px;
  }
  .content { padding: 20px 24px; }

  .employee-info {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 18px;
    padding: 12px 14px;
    background: #f8fafc;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }
  .info-group label {
    display: block;
    font-size: 8px;
    text-transform: uppercase;
    color: #94a3b8;
    margin-bottom: 2px;
    letter-spacing: 0.6px;
    font-weight: 600;
  }
  .info-group span {
    font-size: 11px;
    font-weight: 600;
    color: #1e293b;
  }

  .attendance-summary {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-bottom: 18px;
  }
  .attendance-item {
    text-align: center;
    padding: 10px 6px;
    background: #f8fafc;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }
  .attendance-value {
    font-size: 17px;
    font-weight: 700;
    color: #1e293b;
  }
  .attendance-value.warn { color: #d97706; }
  .attendance-value.danger { color: #dc2626; }
  .attendance-label {
    font-size: 8px;
    color: #64748b;
    text-transform: uppercase;
    margin-top: 2px;
    font-weight: 600;
    letter-spacing: 0.4px;
  }

  .salary-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    margin-bottom: 18px;
  }
  .earnings, .deductions {
    border-radius: 6px;
    padding: 14px;
    border: 1px solid #e2e8f0;
  }
  .earnings { border-left: 3px solid #059669; }
  .deductions { border-left: 3px solid #dc2626; }
  .section-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
  }
  .earnings .section-title { color: #059669; }
  .deductions .section-title { color: #dc2626; }
  .item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 10.5px;
  }
  .item-label { color: #475569; }
  .item-detail { font-size: 8px; color: #94a3b8; margin-top: 1px; }
  .item-value { font-weight: 600; color: #1e293b; font-family: 'Courier New', monospace; font-size: 10.5px; }
  .earnings .item-value { color: #059669; }
  .deductions .item-value { color: #dc2626; }
  .total-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0 2px;
    margin-top: 6px;
    border-top: 1px solid #e2e8f0;
    font-weight: 700;
    font-size: 11px;
  }
  .earnings .total-row { color: #059669; }
  .deductions .total-row { color: #dc2626; }

  .deduction-subsection {
    border-top: 1px dashed #e2e8f0;
    padding-top: 6px;
    margin-top: 6px;
  }
  .deduction-subsection-label {
    font-size: 8px;
    font-weight: 700;
    color: #b91c1c;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 3px;
  }

  .net-salary-section {
    background: #1e293b;
    border-radius: 8px;
    padding: 18px 20px;
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
  }
  .net-salary-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    opacity: 0.8;
    font-weight: 600;
  }
  .net-salary-value {
    font-size: 26px;
    font-weight: 800;
    font-family: 'Courier New', monospace;
    letter-spacing: 1px;
  }

  .bank-details {
    background: #f8fafc;
    border-radius: 6px;
    padding: 12px 14px;
    margin-bottom: 14px;
    border: 1px solid #e2e8f0;
  }
  .bank-details h3 {
    font-size: 10px;
    color: #475569;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
  }
  .bank-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .status-section {
    text-align: center;
    margin-bottom: 10px;
  }
  .status-badge {
    display: inline-block;
    padding: 4px 14px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .status-paid { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
  .status-processed { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
  .status-draft { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
  .status-cancelled { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

  .footer {
    text-align: center;
    padding: 12px 24px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .footer p {
    margin: 1px 0;
    color: #94a3b8;
    font-size: 8.5px;
  }
  .footer .gen-date {
    margin-top: 4px;
    font-size: 8px;
    color: #cbd5e1;
  }

  .action-bar {
    display: flex;
    justify-content: center;
    gap: 10px;
    padding: 12px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }
  .btn-print {
    background: #1e293b;
    color: #fff;
  }
  .btn-print:hover {
    background: #0f172a;
  }
  .btn-save {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
  }
  .btn-save:hover {
    background: #e2e8f0;
  }

  @media print {
    body { padding: 0; background: white; }
    .payslip-container { box-shadow: none; border-radius: 0; border: none; margin: 0; }
    .action-bar { display: none !important; }
  }
`;

// ─── Generate single payslip HTML div ───
function generatePayslipHTML(payroll: any, logoBase64: string) {
  const emp = payroll.employee;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const periodMonth = monthNames[payroll.month - 1];
  const periodYear = payroll.year;

  const totalEarnings =
    payroll.basicSalary +
    (payroll.hra || 0) +
    (payroll.da || 0) +
    (payroll.ta || 0) +
    (payroll.medicalAllowance || 0) +
    (payroll.otherAllowances || 0);

  const absentDed = payroll.absentDeduction || 0;
  const totalDeductions =
    (payroll.pf || 0) +
    (payroll.esi || 0) +
    (payroll.professionalTax || 0) +
    (payroll.tds || 0) +
    (payroll.lateDeduction || 0) +
    absentDed +
    (payroll.otherDeductions || 0) +
    (payroll.manualDeduction || 0);

  // Logo HTML
  const logoHTML = logoBase64
    ? `<div class="header-logo"><img src="${logoBase64}" alt="Logo" /></div>`
    : '';

  return `
    <div class="payslip-container">
      <div class="header">
        <div class="header-left">
          ${logoHTML}
          <div>
            <div class="company-name">Salary Slip</div>
          </div>
        </div>
        <div class="header-right">
          <div class="slip-period">${periodMonth} ${periodYear}</div>
        </div>
      </div>
      
      <div class="content">
        <div class="employee-info">
          <div class="info-group">
            <label>Employee Name</label>
            <span>${emp.firstName} ${emp.lastName}</span>
          </div>
          <div class="info-group">
            <label>Employee Code</label>
            <span>${emp.employeeCode || '-'}</span>
          </div>
          <div class="info-group">
            <label>Department</label>
            <span>${emp.department?.name || '-'}</span>
          </div>
          <div class="info-group">
            <label>Designation</label>
            <span>${emp.designation || '-'}</span>
          </div>
          <div class="info-group">
            <label>Date of Joining</label>
            <span>${emp.joiningDate ? formatDate(emp.joiningDate) : '-'}</span>
          </div>
          <div class="info-group">
            <label>CNIC / NIC</label>
            <span>${emp.panNumber || '-'}</span>
          </div>
        </div>
        
        ${payroll.notes ? `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
          <span style="color: #3b82f6; font-size: 14px;">&#9432;</span>
          <span style="font-size: 11px; color: #1e40af;">${payroll.notes}</span>
        </div>
        ` : ''}
        
        <div class="attendance-summary">
          <div class="attendance-item">
            <div class="attendance-value">${payroll.workingDays}</div>
            <div class="attendance-label">Working Days</div>
          </div>
          <div class="attendance-item">
            <div class="attendance-value">${payroll.presentDays}</div>
            <div class="attendance-label">Present</div>
          </div>
          <div class="attendance-item">
            <div class="attendance-value${payroll.leaveDays > 0 ? ' warn' : ''}">${payroll.leaveDays}</div>
            <div class="attendance-label">Leave</div>
          </div>
          <div class="attendance-item">
            <div class="attendance-value${payroll.lateDays > 0 ? ' warn' : ''}">${payroll.lateDays}</div>
            <div class="attendance-label">Late</div>
          </div>
          <div class="attendance-item">
            <div class="attendance-value${payroll.halfDays > 0 ? ' warn' : ''}">${payroll.halfDays}</div>
            <div class="attendance-label">Half Day</div>
          </div>
          <div class="attendance-item">
            <div class="attendance-value${payroll.absentDays > 0 ? ' danger' : ''}">${payroll.absentDays}</div>
            <div class="attendance-label">Absent</div>
          </div>
        </div>
        
        <div class="salary-details">
          <div class="earnings">
            <div class="section-title">Earnings</div>
            <div class="item">
              <span class="item-label">Basic Salary</span>
              <span class="item-value">${formatPKR(payroll.basicSalary)}</span>
            </div>
            ${payroll.hra ? `<div class="item"><span class="item-label">House Rent Allowance</span><span class="item-value">${formatPKR(payroll.hra)}</span></div>` : ''}
            ${payroll.da ? `<div class="item"><span class="item-label">Dearness Allowance</span><span class="item-value">${formatPKR(payroll.da)}</span></div>` : ''}
            ${payroll.ta ? `<div class="item"><span class="item-label">Transport Allowance</span><span class="item-value">${formatPKR(payroll.ta)}</span></div>` : ''}
            ${payroll.medicalAllowance ? `<div class="item"><span class="item-label">Medical Allowance</span><span class="item-value">${formatPKR(payroll.medicalAllowance)}</span></div>` : ''}
            ${payroll.otherAllowances ? `<div class="item"><span class="item-label">Other Allowances</span><span class="item-value">${formatPKR(payroll.otherAllowances)}</span></div>` : ''}
            ${payroll.overtime ? `<div class="item"><span class="item-label">Overtime</span><span class="item-value">${formatPKR(payroll.overtime)}</span></div>` : ''}
            ${payroll.bonus ? `<div class="item"><span class="item-label">Bonus</span><span class="item-value">${formatPKR(payroll.bonus)}</span></div>` : ''}
            <div class="total-row">
              <span>Total Earnings</span>
              <span>${formatPKR(totalEarnings)}</span>
            </div>
          </div>
          
          <div class="deductions">
            <div class="section-title">Deductions</div>
            ${payroll.tds ? `<div class="item"><span class="item-label">Income Tax (FBR)</span><span class="item-value">${formatPKR(payroll.tds)}</span></div>` : ''}
            ${payroll.pf ? `<div class="item"><span class="item-label">Provident Fund</span><span class="item-value">${formatPKR(payroll.pf)}</span></div>` : ''}
            ${payroll.esi ? `<div class="item"><span class="item-label">EOBI</span><span class="item-value">${formatPKR(payroll.esi)}</span></div>` : ''}
            ${payroll.professionalTax ? `<div class="item"><span class="item-label">Professional Tax</span><span class="item-value">${formatPKR(payroll.professionalTax)}</span></div>` : ''}
            ${payroll.otherDeductions ? `<div class="item"><span class="item-label">Other Deductions</span><span class="item-value">${formatPKR(payroll.otherDeductions)}</span></div>` : ''}
            
            ${(payroll.lateDeduction > 0 || absentDed > 0) ? `
            <div class="deduction-subsection">
              <div class="deduction-subsection-label">Attendance Deductions</div>
              ${payroll.lateDeduction > 0 ? `
              <div class="item">
                <div>
                  <span class="item-label">Late Deduction</span>
                  <div class="item-detail">${payroll.lateDays} late day(s)</div>
                </div>
                <span class="item-value">${formatPKR(payroll.lateDeduction)}</span>
              </div>` : ''}
              ${absentDed > 0 ? `
              <div class="item">
                <div>
                  <span class="item-label">Absent Deduction</span>
                  <div class="item-detail">${payroll.absentDays} absent day(s)${payroll.halfDays > 0 ? ` incl. ${payroll.halfDays} half day(s)` : ''}</div>
                </div>
                <span class="item-value">${formatPKR(absentDed)}</span>
              </div>` : ''}
            </div>` : ''}
            
            ${payroll.manualDeductions && payroll.manualDeductions.length > 0 ? `
            <div class="deduction-subsection">
              <div class="deduction-subsection-label">Manual Deductions</div>
              ${payroll.manualDeductions.map((d: { label: string; amount: number; reason?: string | null }) => `
                <div class="item">
                  <div>
                    <span class="item-label">${d.label}</span>
                    ${d.reason ? `<div class="item-detail">${d.reason}</div>` : ''}
                  </div>
                  <span class="item-value">${formatPKR(d.amount)}</span>
                </div>
              `).join('')}
            </div>` : payroll.manualDeduction ? `
            <div class="deduction-subsection">
              <div class="deduction-subsection-label">Manual Deductions</div>
              <div class="item">
                <div>
                  <span class="item-label">Manual Deduction</span>
                  ${payroll.deductionReason ? `<div class="item-detail">${payroll.deductionReason}</div>` : ''}
                </div>
                <span class="item-value">${formatPKR(payroll.manualDeduction)}</span>
              </div>
            </div>` : ''}
            <div class="total-row">
              <span>Total Deductions</span>
              <span>${formatPKR(totalDeductions)}</span>
            </div>
          </div>
        </div>
        
        <div class="net-salary-section">
          <div>
            <div class="net-salary-label">Net Salary Payable</div>
          </div>
          <div class="net-salary-value">${formatPKR(payroll.netSalary)}</div>
        </div>
        
        ${emp.bankName || emp.bankAccountNumber ? `
        <div class="bank-details">
          <h3>Bank Details</h3>
          <div class="bank-grid">
            ${emp.bankName ? `<div class="info-group"><label>Bank Name</label><span>${emp.bankName}</span></div>` : ''}
            ${emp.bankAccountNumber ? `<div class="info-group"><label>Account Number</label><span>XXXX${emp.bankAccountNumber.slice(-4)}</span></div>` : ''}
            ${emp.ifscCode ? `<div class="info-group"><label>Branch Code</label><span>${emp.ifscCode}</span></div>` : ''}
          </div>
        </div>` : ''}
        
        <div class="status-section">
          <span class="status-badge status-${payroll.status.toLowerCase()}">${payroll.status}</span>
          ${payroll.paidAt ? `<p style="margin-top: 6px; color: #64748b; font-size: 10px;">Paid on: ${formatDate(payroll.paidAt)}</p>` : ''}
        </div>
      </div>
      
      <div class="footer">
        <p>This is a computer-generated payslip and does not require a signature.</p>
        <p>For any queries, please contact the HR department.</p>
        <p class="gen-date">Generated on: ${new Date().toLocaleString('en-PK')}</p>
      </div>
    </div>
  `;
}

// ─── Wrap payslip(s) in full HTML document ───
function wrapInDocument(title: string, payslipContent: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${payslipCSS}</style>
</head>
<body>
  <div class="action-bar">
    <button class="action-btn btn-print" onclick="window.print()">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H9v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
      Print / Save as PDF
    </button>
    <button class="action-btn btn-save" onclick="window.close()">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      Close
    </button>
  </div>
  ${payslipContent}
</body>
</html>`;
}

// ─── Prisma employee select fields ───
const employeeSelectFields = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  joiningDate: true,
  designation: true,
  bankName: true,
  bankAccountNumber: true,
  ifscCode: true,
  panNumber: true,
  department: { select: { name: true } },
};

// GET /api/payroll/payslip - Download payslip(s)
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await authenticate(req);
    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const singleId = searchParams.get('id');
    const bulkIds = searchParams.get('ids');

    // ── Bulk payslip download ──
    if (bulkIds) {
      const ids = bulkIds.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
      }

      const payrolls = await prisma.payrollRecord.findMany({
        where: { id: { in: ids } },
        include: {
          employee: { select: employeeSelectFields },
          manualDeductions: true,
        },
      });

      if (payrolls.length === 0) {
        return NextResponse.json({ error: 'No payroll records found' }, { status: 404 });
      }

      // Check permissions for employee role
      if (user.role === 'EMPLOYEE') {
        const employee = await prisma.employee.findFirst({
          where: { userId: user.userId },
          select: { id: true },
        });
        const filtered = payrolls.filter(p => p.employeeId === employee?.id);
        if (filtered.length === 0) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }

      const logo = getLogoBase64();
      const payslipsHTML = payrolls.map(p => generatePayslipHTML(p, logo)).join('\n');
      const html = wrapInDocument('Payslips - Bulk Download', payslipsHTML);

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="payslips_bulk_${new Date().toISOString().split('T')[0]}.html"`,
        },
      });
    }

    // ── Single payslip download ──
    if (!singleId) {
      return NextResponse.json({ error: 'Payroll record ID is required' }, { status: 400 });
    }

    const payroll = await prisma.payrollRecord.findUnique({
      where: { id: singleId },
      include: {
        employee: { select: employeeSelectFields },
        manualDeductions: true,
      },
    });

    if (!payroll) {
      return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 });
    }

    // Permission check
    if (user.role === 'EMPLOYEE') {
      const employee = await prisma.employee.findFirst({
        where: { userId: user.userId },
        select: { id: true },
      });
      if (payroll.employeeId !== employee?.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const logo = getLogoBase64();
    const payslipContent = generatePayslipHTML(payroll, logo);
    const title = `Payslip - ${payroll.employee.firstName} ${payroll.employee.lastName} - ${monthNames[payroll.month - 1]} ${payroll.year}`;
    const html = wrapInDocument(title, payslipContent);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="payslip_${payroll.employee.employeeCode || payroll.employeeId}_${payroll.month}_${payroll.year}.html"`,
      },
    });
  } catch (error) {
    console.error('Payslip error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
