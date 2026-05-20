export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import fs from 'fs';
import path from 'path';

function getLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo-rename.png');
    const buf = fs.readFileSync(logoPath);
    return 'data:image/png;base64,' + buf.toString('base64');
  } catch {
    return '';
  }
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const COMPANY = {
  name: 'BMD Digital.',
  phone: '0339-4222555',
  email: 'info@bmddigital.com',
  website: 'Bmddigital.com',
  address:
    'The Hive, 3rd Floor NASTP Building, Main Shahrah-e-Faisal Rd, Faisal Cantonment, Karachi Sindh',
};

function formatAmount(amount: number) {
  return Math.round(amount).toLocaleString('en-PK');
}

function formatLetterDate(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${m}-${year}`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateBankDisbursementHTML(
  month: number,
  year: number,
  rows: {
    no: number;
    name: string;
    cnic: string;
    account: string;
    amount: number;
    bank: string;
  }[],
  logoBase64: string
) {
  const monthName = MONTH_NAMES[month - 1];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const dateStr = formatLetterDate();

  const tableRows = rows
    .map(
      (r) => `
    <tr>
      <td>${String(r.no).padStart(2, '0')}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.cnic)}</td>
      <td>${escapeHtml(r.account)}</td>
      <td class="amt">${formatAmount(r.amount)}</td>
      <td>${escapeHtml(r.bank)}</td>
    </tr>`
    )
    .join('');

  const watermarkStyle = logoBase64
    ? `background-image: url('${logoBase64}');`
    : '';
  const headerLogo = logoBase64
    ? `<img src="${logoBase64}" alt="BMD Digital" class="header-logo" />`
    : '';
  const footerLogo = logoBase64
    ? `<img src="${logoBase64}" alt="" class="footer-logo" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Salary Disbursement - ${monthName} ${year}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 16mm 20mm 16mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 210mm;
      min-height: 297mm;
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #000;
      background: #fff;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .screen-bar {
      display: flex;
      justify-content: center;
      padding: 10px;
      background: #f1f5f9;
      border-bottom: 1px solid #ddd;
    }
    @media print {
      .screen-bar { display: none !important; }
      html, body { width: auto; min-height: auto; }
    }
    .screen-bar button {
      padding: 8px 24px;
      background: #0f766e;
      color: #fff;
      border: none;
      font-size: 12pt;
      cursor: pointer;
    }
    .page-sheet {
      position: relative;
      width: 100%;
      max-width: 178mm;
      margin: 0 auto;
      min-height: 255mm;
      overflow: hidden;
    }
    .watermark {
      position: fixed;
      top: 48%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 320px;
      height: 320px;
      opacity: 0.06;
      z-index: 0;
      pointer-events: none;
      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
      ${watermarkStyle}
    }
    @media print {
      .watermark {
        position: fixed;
        opacity: 0.07;
      }
    }
    .letter-content {
      position: relative;
      z-index: 1;
    }
    .letterhead {
      text-align: center;
      margin-bottom: 16pt;
      padding-bottom: 10pt;
      border-bottom: 2pt solid #0f766e;
    }
    .header-logo {
      height: 52px;
      width: auto;
      max-width: 200px;
      object-fit: contain;
      display: inline-block;
      margin-bottom: 6pt;
    }
    .letterhead-sub {
      font-size: 8.5pt;
      color: #475569;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-top: 2pt;
    }
    .date-to {
      margin-bottom: 10pt;
    }
    .to-block {
      margin-bottom: 10pt;
    }
    .to-block p { margin: 0; }
    .para {
      margin-bottom: 10pt;
      text-align: left;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 8pt 0 12pt;
      font-size: 10pt;
      table-layout: fixed;
    }
    .data-table thead th {
      font-weight: 700;
      text-align: left;
      padding: 0 4pt 4pt 0;
      vertical-align: bottom;
      border: none;
      border-bottom: 1pt solid #000;
    }
    .data-table tbody td {
      padding: 3pt 4pt 3pt 0;
      vertical-align: top;
      border: none;
      word-wrap: break-word;
    }
    .data-table col.col-no { width: 6%; }
    .data-table col.col-name { width: 22%; }
    .data-table col.col-cnic { width: 20%; }
    .data-table col.col-acct { width: 20%; }
    .data-table col.col-amt { width: 14%; }
    .data-table col.col-bank { width: 18%; }
    .data-table td.amt,
    .data-table th:nth-child(5) {
      text-align: right;
      padding-right: 0;
    }
    .signatory {
      margin-top: 10pt;
      margin-bottom: 14pt;
      font-weight: 600;
      color: #0f766e;
    }
    .letter-footer {
      margin-top: 18pt;
      padding-top: 12pt;
      border-top: 1pt solid #cbd5e1;
      display: flex;
      align-items: flex-start;
      gap: 12pt;
    }
    .footer-logo {
      height: 36px;
      width: auto;
      object-fit: contain;
      flex-shrink: 0;
      opacity: 0.9;
    }
    .footer-text { flex: 1; }
    .contact {
      font-size: 9.5pt;
      line-height: 1.45;
      margin-bottom: 2pt;
      color: #334155;
    }
    .doc-title {
      margin-top: 28pt;
      text-align: center;
      font-size: 12pt;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.03em;
    }
  </style>
</head>
<body>
  <div class="screen-bar">
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="page-sheet">
    ${logoBase64 ? '<div class="watermark" aria-hidden="true"></div>' : ''}
    <div class="letter-content">
    <header class="letterhead">
      ${headerLogo}
      <p class="letterhead-sub">Salary Disbursement Request</p>
    </header>
    <p class="date-to">Date: ${dateStr} To,</p>
    <div class="to-block">
      <p>The Branch Manager</p>
    </div>
    <p class="to-block">Dear Sir/Madam,</p>
    <p class="para">
      We request you to kindly disburse the salaries of our employees as per the details mentioned
      below, for the month of ${monthName} ${year}. The total amount to be credited is Rs.${formatAmount(total)} and the
      details are as follows:
    </p>
    <table class="data-table">
      <colgroup>
        <col class="col-no" />
        <col class="col-name" />
        <col class="col-cnic" />
        <col class="col-acct" />
        <col class="col-amt" />
        <col class="col-bank" />
      </colgroup>
      <thead>
        <tr>
          <th>No</th>
          <th>Employee Name</th>
          <th>CNIC</th>
          <th>Account Number</th>
          <th>Amount</th>
          <th>Bank</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <p class="para">
      We confirm that sufficient funds have been maintained in our account to cover the total
      disbursement amount.
    </p>
    <p class="para">
      Kindly process the salary credits to the respective employee accounts at your earliest
      convenience.
    </p>
    <p class="signatory">${COMPANY.name}</p>
    <div class="letter-footer">
      ${footerLogo}
      <div class="footer-text">
        <p class="contact">${COMPANY.phone} | ${COMPANY.email} | ${COMPANY.website}</p>
        <p class="contact">${COMPANY.address}</p>
      </div>
    </div>
    <p class="doc-title">Request for Salary Disbursement</p>
    </div>
  </div>
</body>
</html>`;
}

// GET /api/payroll/bank-disbursement?month=3&year=2026&departmentId=
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const managePerm = await checkPermission(user!.userId, user!.role, 'payroll', 'manage');
    const viewPerm = await checkPermission(user!.userId, user!.role, 'payroll', 'view');
    if (!managePerm.allowed && !viewPerm.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const month = parseInt(searchParams.get('month') || '', 10);
    const year = parseInt(searchParams.get('year') || '', 10);
    const departmentId = searchParams.get('departmentId') || '';

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Valid month and year are required' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      month,
      year,
      status: { not: 'CANCELLED' },
    };

    if (departmentId) {
      where.employee = { departmentId };
    }

    const records = await prisma.payrollRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            panNumber: true,
            bankAccountNumber: true,
            bankName: true,
          },
        },
      },
      orderBy: [{ employee: { firstName: 'asc' } }, { employee: { lastName: 'asc' } }],
    });

    if (records.length === 0) {
      return NextResponse.json(
        { error: `No payroll records for ${MONTH_NAMES[month - 1]} ${year}. Generate payroll first.` },
        { status: 404 }
      );
    }

    const rows = records.map((r, index) => ({
      no: index + 1,
      name: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
      cnic: r.employee.panNumber?.trim() || '',
      account: r.employee.bankAccountNumber?.trim() || '',
      amount: r.netSalary,
      bank: r.employee.bankName?.trim() || '',
    }));

    const logo = getLogoBase64();
    const html = generateBankDisbursementHTML(month, year, rows, logo);
    const filename = `Salary_Disbursement_${MONTH_NAMES[month - 1]}_${year}.html`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Bank disbursement error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
