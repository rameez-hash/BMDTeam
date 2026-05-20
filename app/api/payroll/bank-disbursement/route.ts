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
      <td class="col-no">${String(r.no).padStart(2, '0')}</td>
      <td class="col-name">${escapeHtml(r.name)}</td>
      <td class="col-cnic">${escapeHtml(r.cnic)}</td>
      <td class="col-acct">${escapeHtml(r.account)}</td>
      <td class="col-amt">${formatAmount(r.amount)}</td>
      <td class="col-bank">${escapeHtml(r.bank)}</td>
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
      margin: 15mm 18mm 18mm 18mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      min-height: 297mm;
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #000;
      background: #fff;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
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
      width: 174mm;
      max-width: 174mm;
      margin: 0 auto;
      min-height: 260mm;
      padding: 0 2mm;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 340px;
      height: 340px;
      opacity: 0.055;
      z-index: 0;
      pointer-events: none;
      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
      ${watermarkStyle}
    }
    @media print {
      .watermark { opacity: 0.065; }
    }
    .letter-content {
      position: relative;
      z-index: 1;
      width: 100%;
      margin: 0 auto;
    }
    .letterhead {
      text-align: center;
      margin: 0 auto 18pt;
      padding: 14pt 12pt 12pt;
      background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
      border: 1pt solid #e2e8f0;
      border-radius: 2pt;
    }
    .letterhead-rule {
      height: 3pt;
      background: #0f766e;
      margin: 10pt auto 0;
      width: 100%;
      max-width: 140mm;
    }
    .letterhead-rule-thin {
      height: 0.5pt;
      background: #94a3b8;
      margin: 2pt auto 0;
      width: 100%;
      max-width: 140mm;
    }
    .header-logo {
      height: 56px;
      width: auto;
      max-width: 220px;
      object-fit: contain;
      display: block;
      margin: 0 auto 8pt;
    }
    .letterhead-sub {
      font-size: 9pt;
      color: #0f766e;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 600;
    }
    .letter-body {
      width: 100%;
      margin: 0 auto;
      padding: 0 4mm;
    }
    .date-to { margin-bottom: 10pt; }
    .to-block { margin-bottom: 8pt; }
    .to-block p { margin: 0; }
    .para {
      margin-bottom: 10pt;
      text-align: justify;
      hyphens: auto;
    }
    .table-wrap {
      width: 100%;
      margin: 10pt auto 14pt;
      overflow: visible;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      table-layout: auto;
    }
    .data-table thead th {
      font-weight: 700;
      text-align: left;
      padding: 5pt 8pt 6pt 0;
      vertical-align: bottom;
      border: none;
      border-bottom: 1.5pt solid #000;
      white-space: nowrap;
    }
    .data-table thead th.col-amt-h {
      text-align: right;
      padding-right: 12pt;
      padding-left: 12pt;
    }
    .data-table thead th.col-bank-h {
      padding-left: 12pt;
      min-width: 72pt;
    }
    .data-table tbody td {
      padding: 5pt 8pt 5pt 0;
      vertical-align: top;
      border: none;
      line-height: 1.3;
    }
    .data-table .col-no {
      width: 28pt;
      padding-right: 6pt;
      white-space: nowrap;
    }
    .data-table .col-name {
      min-width: 72pt;
      max-width: 95pt;
      word-wrap: break-word;
    }
    .data-table .col-cnic {
      min-width: 68pt;
      max-width: 82pt;
      word-break: break-all;
      font-size: 9pt;
    }
    .data-table .col-acct {
      min-width: 72pt;
      max-width: 88pt;
      word-break: break-all;
      font-size: 9pt;
    }
    .data-table .col-amt {
      text-align: right;
      white-space: nowrap;
      padding-left: 12pt;
      padding-right: 12pt;
      min-width: 52pt;
      font-weight: 600;
    }
    .data-table .col-bank {
      padding-left: 12pt;
      min-width: 78pt;
      max-width: 95pt;
      word-wrap: break-word;
    }
    .signatory {
      margin-top: 10pt;
      margin-bottom: 14pt;
      font-weight: 600;
      color: #0f766e;
    }
    .letter-footer {
      margin-top: 18pt;
      padding: 12pt 4mm 0;
      border-top: 1pt solid #cbd5e1;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      gap: 14pt;
      max-width: 100%;
    }
    .footer-logo {
      height: 36px;
      width: auto;
      object-fit: contain;
      flex-shrink: 0;
      opacity: 0.9;
    }
    .footer-text {
      flex: 1;
      text-align: left;
    }
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
      <div class="letterhead-rule"></div>
      <div class="letterhead-rule-thin"></div>
    </header>
    <div class="letter-body">
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
    <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th class="col-no">No</th>
          <th class="col-name">Employee Name</th>
          <th class="col-cnic">CNIC</th>
          <th class="col-acct">Account Number</th>
          <th class="col-amt-h">Amount</th>
          <th class="col-bank-h">Bank</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    </div>
    <p class="para">
      We confirm that sufficient funds have been maintained in our account to cover the total
      disbursement amount.
    </p>
    <p class="para">
      Kindly process the salary credits to the respective employee accounts at your earliest
      convenience.
    </p>
    <p class="signatory">${COMPANY.name}</p>
    </div>
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
