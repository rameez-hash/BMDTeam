export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

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
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
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
  }[]
) {
  const monthName = MONTH_NAMES[month - 1];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const dateStr = formatLetterDate();

  const tableRows = rows
    .map(
      (r) => `
    <tr>
      <td class="c-no">${r.no}</td>
      <td class="c-name">${escapeHtml(r.name)}</td>
      <td class="c-cnic">${escapeHtml(r.cnic)}</td>
      <td class="c-acct">${escapeHtml(r.account)}</td>
      <td class="c-amt">${formatAmount(r.amount)}</td>
      <td class="c-bank">${escapeHtml(r.bank)}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Salary Disbursement - ${monthName} ${year}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #000;
      background: #fff;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { max-width: 210mm; margin: 0 auto; padding: 8px 4px 24px; }
    .action-bar {
      display: flex; justify-content: center; padding: 10px;
      background: #f1f5f9; border-bottom: 1px solid #e2e8f0;
      margin-bottom: 12px;
    }
    @media print { .action-bar { display: none !important; } body { padding: 0; } }
    .btn {
      padding: 8px 22px; background: #0f766e; color: #fff; border: none;
      border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .date-line { margin-bottom: 14px; }
    .salutation { margin-bottom: 12px; }
    .body-text { margin-bottom: 14px; text-align: justify; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 16px;
      font-size: 9.5pt;
    }
    th, td {
      border: 1px solid #000;
      padding: 5px 6px;
      vertical-align: top;
    }
    th {
      font-weight: 700;
      text-align: left;
      background: #fff;
    }
    .c-no { width: 28px; text-align: center; }
    .c-name { min-width: 120px; }
    .c-cnic { min-width: 110px; }
    .c-acct { min-width: 100px; }
    .c-amt { text-align: right; white-space: nowrap; }
    .c-bank { min-width: 80px; }
    .closing { margin-top: 14px; margin-bottom: 20px; }
    .sign-off { margin-top: 8px; font-weight: 600; }
    .footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #ccc;
      font-size: 9pt;
      line-height: 1.5;
    }
    .doc-title {
      margin-top: 32px;
      text-align: center;
      font-size: 13pt;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="page">
    <p class="date-line"><strong>Date:</strong> ${dateStr}</p>
    <p class="salutation">To,<br>The Branch Manager<br>Dear Sir/Madam,</p>
    <p class="body-text">
      We request you to kindly disburse the salaries of our employees as per the details mentioned
      below, for the month of <strong>${monthName} ${year}</strong>. The total amount to be credited is
      <strong>Rs.${formatAmount(total)}</strong> and the details are as follows:
    </p>
    <table>
      <thead>
        <tr>
          <th class="c-no">No</th>
          <th class="c-name">Employee Name</th>
          <th class="c-cnic">CNIC</th>
          <th class="c-acct">Account Number</th>
          <th class="c-amt">Amount</th>
          <th class="c-bank">Bank</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <p class="body-text">
      We confirm that sufficient funds have been maintained in our account to cover the total
      disbursement amount.
    </p>
    <p class="body-text">
      Kindly process the salary credits to the respective employee accounts at your earliest
      convenience.
    </p>
    <p class="sign-off">${COMPANY.name}</p>
    <div class="footer">
      ${COMPANY.phone} | ${COMPANY.email} | ${COMPANY.website}<br>
      ${COMPANY.address}
    </div>
    <p class="doc-title">Request for Salary Disbursement</p>
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
      cnic: r.employee.panNumber?.trim() || '—',
      account: r.employee.bankAccountNumber?.trim() || '—',
      amount: r.netSalary,
      bank: r.employee.bankName?.trim() || '—',
    }));

    const html = generateBankDisbursementHTML(month, year, rows);
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
