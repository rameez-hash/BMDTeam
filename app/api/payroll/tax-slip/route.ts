export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import {
  parseFinancialYear,
  payrollFinancialYearFilter,
  MONTH_NAMES,
} from '@/lib/financial-year';
import fs from 'fs';
import path from 'path';

const COMPANY_NAME = 'BMD Digital';

function getLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo-rename.png');
    const buf = fs.readFileSync(logoPath);
    return 'data:image/png;base64,' + buf.toString('base64');
  } catch {
    return '';
  }
}

const formatPKR = (amount: number) => 'Rs ' + Math.round(amount).toLocaleString('en-PK');

function generateTaxSlipHTML(
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string | null;
    designation: string | null;
    panNumber: string | null;
    department?: { name: string } | null;
    joiningDate: Date | null;
  },
  financialYear: string,
  periodLabel: string,
  months: { month: number; year: number; grossEarnings: number; tds: number; netSalary: number }[],
  logoBase64: string
) {
  const totalGross = months.reduce((s, m) => s + m.grossEarnings, 0);
  const totalTax = months.reduce((s, m) => s + m.tds, 0);
  const certNo = `TDS-${employee.employeeCode || 'EMP'}-${financialYear.replace('-', '')}`;
  const logoHTML = logoBase64
    ? `<img src="${logoBase64}" alt="Logo" style="height:40px;filter:brightness(0) invert(1);" />`
    : '';

  const rows = months
    .map(
      (m) => `
    <tr>
      <td>${MONTH_NAMES[m.month - 1]} ${m.year}</td>
      <td class="num">${formatPKR(m.grossEarnings)}</td>
      <td class="num tax">${formatPKR(m.tds)}</td>
      <td class="num">${formatPKR(m.netSalary)}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tax Deduction Certificate - ${employee.firstName} ${employee.lastName} - FY ${financialYear}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11px; color: #0f172a; background: #f1f5f9; padding: 16px; }
    .doc { max-width: 210mm; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; box-shadow: 0 4px 20px rgba(0,0,0,.06); }
    .header { background: linear-gradient(135deg, #0f766e, #134e4a); color: #fff; padding: 22px 28px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .company { font-size: 18px; font-weight: 700; }
    .sub { font-size: 9px; opacity: .85; letter-spacing: .1em; text-transform: uppercase; margin-top: 4px; }
    .title { text-align: right; }
    .title h1 { font-size: 14px; letter-spacing: .2em; text-transform: uppercase; }
    .title p { font-size: 11px; margin-top: 4px; opacity: .9; }
    .body { padding: 24px 28px; }
    .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
    .meta label { display: block; font-size: 8px; text-transform: uppercase; color: #64748b; letter-spacing: .06em; font-weight: 700; margin-bottom: 2px; }
    .meta span { font-size: 11px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 10.5px; }
    th { background: #0f766e; color: #fff; padding: 10px 12px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; }
    td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .num { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; }
    .tax { color: #b91c1c; }
    .totals { display: flex; justify-content: flex-end; margin-top: 8px; }
    .totals-box { background: #0f766e; color: #fff; padding: 14px 20px; border-radius: 6px; min-width: 260px; }
    .totals-box .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
    .totals-box .row.main { font-size: 14px; font-weight: 800; border-top: 1px solid rgba(255,255,255,.25); margin-top: 6px; padding-top: 8px; }
    .cert { margin-top: 20px; padding: 14px; border: 1px solid #e2e8f0; border-left: 4px solid #0d9488; background: #f0fdfa; font-size: 10px; line-height: 1.55; color: #334155; }
    .footer { text-align: center; padding: 14px; border-top: 1px solid #e2e8f0; background: #f8fafc; font-size: 8.5px; color: #64748b; }
    .action-bar { display: flex; justify-content: center; gap: 10px; padding: 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .btn { padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: #0f766e; color: #fff; }
    @media print { body { background: #fff; padding: 0; } .action-bar { display: none !important; } .doc { box-shadow: none; border: none; } }
  </style>
</head>
<body>
  <div class="action-bar">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="doc">
    <div class="header">
      <div class="header-top">
        <div>${logoHTML}<div class="company" style="margin-top:8px;">${COMPANY_NAME}</div><div class="sub">Tax withholding certificate</div></div>
        <div class="title">
          <h1>Tax Deduction Certificate</h1>
          <p>Financial Year ${financialYear}</p>
          <p style="font-size:9px;margin-top:6px;opacity:.8;">${periodLabel}</p>
        </div>
      </div>
    </div>
    <div class="body">
      <div class="meta">
        <div><label>Employee Name</label><span>${employee.firstName} ${employee.lastName}</span></div>
        <div><label>Employee Code</label><span>${employee.employeeCode || '—'}</span></div>
        <div><label>Department</label><span>${employee.department?.name || '—'}</span></div>
        <div><label>Designation</label><span>${employee.designation || '—'}</span></div>
        <div><label>CNIC / NTN</label><span>${employee.panNumber || '—'}</span></div>
        <div><label>Certificate No.</label><span>${certNo}</span></div>
      </div>
      <p style="font-size:10px;color:#475569;margin-bottom:8px;">
        This certificate confirms income tax (TDS) withheld from salary and remitted on behalf of the employee for the period below, for use in annual income tax return filing with FBR.
      </p>
      <table>
        <thead>
          <tr>
            <th>Pay period</th>
            <th style="text-align:right">Taxable gross</th>
            <th style="text-align:right">Tax withheld (TDS)</th>
            <th style="text-align:right">Net paid</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="totals">
        <div class="totals-box">
          <div class="row"><span>Total taxable gross</span><span>${formatPKR(totalGross)}</span></div>
          <div class="row main"><span>Total tax withheld</span><span>${formatPKR(totalTax)}</span></div>
        </div>
      </div>
      <div class="cert">
        <strong>Employer certification:</strong> ${COMPANY_NAME} certifies that the amounts shown above were deducted from the employee&apos;s salary as income tax (TDS) during financial year ${financialYear} (${periodLabel}). This document is issued for the employee&apos;s tax return and record purposes.
      </div>
    </div>
    <div class="footer">
      <p>Computer-generated tax certificate · ${new Date().toLocaleString('en-PK', { dateStyle: 'medium' })}</p>
      <p style="margin-top:4px;">Confidential — for the addressee and tax authorities only.</p>
    </div>
  </div>
</body>
</html>`;
}

// GET /api/payroll/tax-slip?employeeId=&financialYear=2025-2026
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');
    const financialYear = searchParams.get('financialYear');

    if (!employeeId || !financialYear) {
      return NextResponse.json({ error: 'employeeId and financialYear are required' }, { status: 400 });
    }

    const fyFilter = payrollFinancialYearFilter(financialYear);
    if (!fyFilter) {
      return NextResponse.json({ error: 'Invalid financial year' }, { status: 400 });
    }

    const viewPerm = await checkPermission(user!.userId, user!.role, 'payroll', 'view');
    if (!viewPerm.allowed || viewPerm.scope === 'SELF') {
      const own = await prisma.employee.findFirst({ where: { userId: user!.userId, id: employeeId } });
      if (!own) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        designation: true,
        panNumber: true,
        joiningDate: true,
        department: { select: { name: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const records = await prisma.payrollRecord.findMany({
      where: {
        employeeId,
        ...fyFilter,
        tds: { gt: 0 },
        status: { in: ['PAID', 'PROCESSED', 'DRAFT'] },
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      select: { month: true, year: true, grossEarnings: true, tds: true, netSalary: true },
    });

    if (records.length === 0) {
      return NextResponse.json({ error: 'No tax deductions found for this period' }, { status: 404 });
    }

    const parsed = parseFinancialYear(financialYear)!;
    const periodLabel = `July ${parsed.startYear} – June ${parsed.endYear}`;
    const logo = getLogoBase64();
    const html = generateTaxSlipHTML(employee, financialYear, periodLabel, records, logo);
    const filename = `tax_certificate_${employee.employeeCode || employeeId}_${financialYear}.html`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Tax slip error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
