export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { formatDate, formatTime, getMonthRange, getWorkDays , parseDateUTC } from '@/lib/utils';
import fs from 'fs';
import path from 'path';

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

// GET /api/attendance/download - Download monthly attendance report (CSV or PDF)
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const employeeId = searchParams.get('employeeId');
    const format = searchParams.get('format') || 'csv';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    const perm = await checkPermission(user!.userId, user!.role, 'attendance', 'export');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    let start: Date, end: Date;
    if (startDate && endDate) {
      start = parseDateUTC(startDate);
      end = parseDateUTC(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      const range = getMonthRange(month, year);
      start = range.start;
      end = range.end;
    }

    let employeeIds: string[] = [];
    if (perm.scope === 'ALL') {
      if (employeeId) {
        employeeIds = [employeeId];
      } else {
        const allEmployees = await prisma.employee.findMany({
          where: {
            employmentStatus: 'ACTIVE',
            user: { role: { not: 'ADMIN' } },
          },
          select: { id: true },
        });
        employeeIds = allEmployees.map(e => e.id);
      }
    } else if (perm.scope === 'DEPARTMENT') {
      const currentEmp = await prisma.employee.findUnique({ where: { userId: user!.userId }, select: { departmentId: true } });
      if (employeeId) {
        const targetEmp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } });
        if (targetEmp?.departmentId === currentEmp?.departmentId) {
          employeeIds = [employeeId];
        } else {
          return NextResponse.json({ error: 'Access denied - employee not in your department' }, { status: 403 });
        }
      } else {
        const deptEmployees = await prisma.employee.findMany({
          where: { departmentId: currentEmp?.departmentId, employmentStatus: 'ACTIVE' },
          select: { id: true },
        });
        employeeIds = deptEmployees.map(e => e.id);
      }
    } else {
      employeeIds = user!.employeeDbId ? [user!.employeeDbId] : [];
    }

    // Fetch employees with shift info
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } },
        designation: true,
        shift: {
          select: {
            name: true,
            startTime: true,
            endTime: true,
            breakDuration: true,
            graceTime: true,
            standardWorkHours: true,
            workDays: true,
          },
        },
      },
      orderBy: { employeeCode: 'asc' },
    });

    const whereClause: Record<string, unknown> = {
      employeeId: { in: employeeIds },
      date: { gte: start, lte: end },
    };
    if (status) whereClause.status = status;

    const attendance = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
        breaks: true,
      },
      orderBy: [{ employee: { employeeCode: 'asc' } }, { date: 'asc' }],
    });

    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: start, lte: end } },
    });
    const holidayMap = new Map<string, string>();
    holidays.forEach(h => { holidayMap.set(formatDate(h.date), h.name); });

    const allDates: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      allDates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const attendanceMap = new Map<string, typeof attendance[0]>();
    attendance.forEach(a => {
      attendanceMap.set(`${a.employeeId}_${formatDate(a.date)}`, a);
    });

    // Helpers
    const fmtShiftTime = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    const fmtHrMin = (decimalHours: number) => {
      const sign = decimalHours >= 0 ? '+' : '-';
      const abs = Math.abs(decimalHours);
      const h = Math.floor(abs);
      const m = Math.round((abs - h) * 60);
      if (h > 0 && m > 0) return `${sign}${h}h ${m}m`;
      if (h > 0) return `${sign}${h}h`;
      return `${sign}${m}m`;
    };

    const fmtWorkHrMin = (decimalHours: number) => {
      const h = Math.floor(decimalHours);
      const m = Math.round((decimalHours - h) * 60);
      if (h > 0 && m > 0) return `${h}h ${m}m`;
      if (h > 0) return `${h}h 0m`;
      return `${m}m`;
    };

    const getCheckInLabel = (checkIn: Date, shiftStart: string) => {
      const [sh, sm] = shiftStart.split(':').map(Number);
      const sd = new Date(checkIn); sd.setHours(sh, sm, 0, 0);
      const diff = Math.round((checkIn.getTime() - sd.getTime()) / 60000);
      if (diff > 5) {
        const h = Math.floor(diff / 60), m = diff % 60;
        return { text: h > 0 ? `${h}h ${m}m Late` : `${m}m Late`, color: '#dc2626', icon: '🔴' };
      } else if (diff < -5) {
        const a = Math.abs(diff), h = Math.floor(a / 60), m = a % 60;
        return { text: h > 0 ? `${h}h ${m}m Early` : `${m}m Early`, color: '#059669', icon: '🟢' };
      }
      return { text: 'On Time', color: '#6b7280', icon: '⚪' };
    };

    const isRecordLate = (rec: { checkIn: Date | null; isLate: boolean }, shiftStart: string, grace: number) => {
      if (rec.isLate) return true;
      if (!rec.checkIn) return false;
      const ci = new Date(rec.checkIn);
      const [sh, sm] = shiftStart.split(':').map(Number);
      const sd = new Date(ci); sd.setHours(sh, sm, 0, 0);
      const diff = Math.round((ci.getTime() - sd.getTime()) / 60000);
      return diff > grace;
    };

    const getCheckOutLabel = (workHours: number, stdHours: number) => {
      const diff = Math.round((workHours - stdHours) * 60);
      if (diff > 15) {
        const h = Math.floor(diff / 60), m = diff % 60;
        return { text: h > 0 ? `+${h}h ${m}m OT` : `+${m}m OT`, color: '#0891b2', icon: '⏱️' };
      } else if (diff < -15) {
        const a = Math.abs(diff), h = Math.floor(a / 60), m = a % 60;
        return { text: h > 0 ? `${h}h ${m}m Early` : `${m}m Early`, color: '#d97706', icon: '⚡' };
      }
      return { text: 'Full Day', color: '#6b7280', icon: '✅' };
    };

    // CSV
    const headers = [
      'Employee Code', 'Employee Name', 'Department', 'Shift', 'Date', 'Day',
      'Shift Start', 'Shift End', 'Check In', 'Check Out', 'Work Hours', 'Extra Hours',
      'Check In Status', 'Check Out Status', 'Breaks', 'Break Duration', 'Location', 'Status', 'Late', 'Late Minutes',
    ];

    const rows: string[][] = [];
    for (const emp of employees) {
      const sName = emp.shift?.name || 'General';
      const sStart = emp.shift?.startTime || '09:00';
      const sEnd = emp.shift?.endTime || '18:00';
      const std = emp.shift?.standardWorkHours || 9;
      const csvGrace = emp.shift?.graceTime || 15;
      const empWorkDays = getWorkDays(emp.shift?.workDays);
      for (const date of allDates) {
        const ds = formatDate(date);
        const rec = attendanceMap.get(`${emp.id}_${ds}`);
        const isWk = !empWorkDays.includes(date.getDay());
        const hName = holidayMap.get(ds);
        const dn = date.toLocaleDateString('en-US', { weekday: 'short' });
        let st = 'ABSENT', ci = '-', co = '-', wh = '-', eh = '-', cis = '-', cos = '-', brk = '0', lt = 'No', lm = '0';
        let brkDurStr = '-', locStr = '-';
        if (rec) {
          st = rec.status; ci = rec.checkIn ? formatTime(rec.checkIn) : '-';
          co = rec.checkOut ? formatTime(rec.checkOut) : '-';
          wh = rec.workHours ? fmtWorkHrMin(rec.workHours) : '-';
          const ex = (rec.workHours || 0) - std;
          eh = Math.abs(ex) > 0.08 ? fmtHrMin(ex) : '0m';
          if (rec.checkIn) cis = getCheckInLabel(new Date(rec.checkIn), sStart).text;
          if (rec.checkOut && rec.workHours) cos = getCheckOutLabel(rec.workHours, std).text;
          brk = rec.breaks.length.toString();
          const totalBrkMin = rec.breaks.reduce((s, b) => s + (b.duration || 0), 0);
          const brkDurH = Math.floor(totalBrkMin / 60), brkDurM = totalBrkMin % 60;
          brkDurStr = brkDurH > 0 ? `${brkDurH}h ${brkDurM}m` : `${brkDurM}m`;
          locStr = rec.workLocation || 'OFFICE';
          const csvLate = isRecordLate(rec, sStart, csvGrace);
          lt = csvLate ? 'Yes' : 'No'; lm = rec.lateMinutes.toString();
          if (csvLate) st = `${st} (Late)`;
        } else if (isWk) { st = 'WEEKEND'; } else if (hName) { st = `HOLIDAY (${hName})`; }
        rows.push([emp.employeeCode, `${emp.firstName} ${emp.lastName}`, emp.department?.name || '', sName, ds, dn, fmtShiftTime(sStart), fmtShiftTime(sEnd), ci, co, wh, eh, cis, cos, brk, brkDurStr, locStr, st, lt, lm]);
      }
    }

    // Overall stats
    const totalPresent = attendance.filter(a => a.status === 'PRESENT').length;
    const totalAbsent = attendance.filter(a => a.status === 'ABSENT').length;
    let totalLate = 0;
    attendance.forEach(a => {
      const emp = employees.find(e => e.id === a.employeeId);
      const sStart = emp?.shift?.startTime || '09:00';
      const grace = emp?.shift?.graceTime || 15;
      if (isRecordLate(a, sStart, grace)) totalLate++;
    });
    const totalOnLeave = attendance.filter(a => a.status === 'ON_LEAVE').length;
    const totalHours = attendance.reduce((s, a) => s + (a.workHours || 0), 0);
    const totalExtraHours = attendance.reduce((s, a) => {
      const emp = employees.find(e => e.id === a.employeeId);
      const std = emp?.shift?.standardWorkHours || 9;
      return (a.workHours && a.workHours > std) ? s + (a.workHours - std) : s;
    }, 0);

    if (format === 'pdf') {
      const dateRangeText = `${formatDate(start, 'dd MMM yyyy')} to ${formatDate(end, 'dd MMM yyyy')}`;
      const monthName = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const logoBase64 = getLogoBase64();

      let empHTML = '';
      for (const emp of employees) {
        const name = `${emp.firstName} ${emp.lastName}`;
        const recs = attendance.filter(a => a.employeeId === emp.id);
        const pres = recs.filter(a => a.status === 'PRESENT').length;
        const late = recs.filter(a => isRecordLate(a, emp.shift?.startTime || '09:00', emp.shift?.graceTime || 15)).length;
        const leave = recs.filter(a => a.status === 'ON_LEAVE').length;
        const hrs = recs.reduce((s, a) => s + (a.workHours || 0), 0);
        const half = recs.filter(a => a.status === 'HALF_DAY').length;
        const sName = emp.shift?.name || 'General';
        const sStart = emp.shift?.startTime || '09:00';
        const sEnd = emp.shift?.endTime || '18:00';
        const std = emp.shift?.standardWorkHours || 9;
        const brkDur = emp.shift?.breakDuration || 60;
        const grace = emp.shift?.graceTime || 15;
        const sLabel = sName.toLowerCase().includes('shift') ? sName : `${sName} Shift`;
        const extraH = recs.reduce((s, a) => (a.workHours && a.workHours > std) ? s + (a.workHours - std) : s, 0);
        const shortH = recs.reduce((s, a) => (a.workHours && a.workHours > 0 && a.workHours < std) ? s + (std - a.workHours) : s, 0);

        const pdfWorkDays = getWorkDays(emp.shift?.workDays);
        let wkCnt = 0, holCnt = 0;
        allDates.forEach(d => { if (!pdfWorkDays.includes(d.getDay())) wkCnt++; else if (holidayMap.has(formatDate(d))) holCnt++; });
        const workDays = allDates.length - wkCnt - holCnt;

        let absCnt = recs.filter(a => a.status === 'ABSENT').length;
        for (const d of allDates) {
          const ds = formatDate(d);
          if (!attendanceMap.has(`${emp.id}_${ds}`) && pdfWorkDays.includes(d.getDay()) && !holidayMap.has(ds) && d < today) absCnt++;
        }

        const avgH = pres > 0 ? hrs / pres : 0;
        const onTime = recs.filter(a => a.status === 'PRESENT' && !isRecordLate(a, sStart, grace)).length;
        const attPct = workDays > 0 ? Math.round((pres / workDays) * 100) : 0;

        let dayRows = '';
        for (const d of allDates) {
          const ds = formatDate(d);
          const rec = attendanceMap.get(`${emp.id}_${ds}`);
          const isWk = !pdfWorkDays.includes(d.getDay());
          const hName = holidayMap.get(ds);
          const dn = d.toLocaleDateString('en-US', { weekday: 'short' });
          const dNum = d.getDate();
          const isTdy = d.getTime() === today.getTime();

          let rc = '', stHTML = '', ciHTML = '<span class="dim">—</span>', coHTML = '<span class="dim">—</span>';
          let hHTML = '<span class="dim">—</span>', exHTML = '<span class="dim">—</span>', ciTag = '', coTag = '';

          if (rec) {
            const stMap: Record<string, { c: string; b: string; l: string }> = {
              PRESENT: { c: '#059669', b: '#f0fdf4', l: 'Present' },
              ABSENT: { c: '#dc2626', b: '#fef2f2', l: 'Absent' },
              HALF_DAY: { c: '#d97706', b: '#fffbeb', l: 'Half Day' },
              ON_LEAVE: { c: '#7c3aed', b: '#f5f3ff', l: 'Leave' },
              HOLIDAY: { c: '#2563eb', b: '#eff6ff', l: 'Holiday' },
              WEEKEND: { c: '#9ca3af', b: '#f8fafc', l: 'Weekend' },
            };
            const si = stMap[rec.status] || { c: '#6b7280', b: '#f8fafc', l: rec.status };
            stHTML = `<span class="pill" style="background:${si.b};color:${si.c};border:1px solid ${si.c}33">${si.l}</span>`;
            if (rec.checkIn) {
              const lb = getCheckInLabel(new Date(rec.checkIn), sStart);
              ciHTML = `<b>${formatTime(rec.checkIn)}</b>`;
              ciTag = `<span class="tag" style="background:${lb.color}12;color:${lb.color};border:1px solid ${lb.color}30">${lb.icon} ${lb.text}</span>`;
            }
            if (rec.checkOut) {
              coHTML = `<b>${formatTime(rec.checkOut)}</b>`;
              if (rec.workHours) {
                const lb = getCheckOutLabel(rec.workHours, std);
                coTag = `<span class="tag" style="background:${lb.color}12;color:${lb.color};border:1px solid ${lb.color}30">${lb.icon} ${lb.text}</span>`;
              }
            }
            hHTML = rec.workHours ? `<b>${fmtWorkHrMin(rec.workHours)}</b>` : '<span class="dim">—</span>';
            if (rec.workHours) {
              const ex = rec.workHours - std;
              exHTML = ex > 0.08 ? `<span class="ex-plus">${fmtHrMin(ex)}</span>` : ex < -0.08 ? `<span class="ex-minus">${fmtHrMin(ex)}</span>` : `<span class="ex-zero">0m</span>`;
            }
            // Add Late tag after Present status — dynamically check
            const isDynLate = isRecordLate(rec, sStart, grace);
            if (isDynLate && (rec.status === 'PRESENT' || rec.status === 'HALF_DAY')) {
              stHTML += ` <span class="pill" style="background:#fef2f2;color:#dc2626;border:1px solid #dc262633;margin-left:2px">Late</span>`;
            }
            if (rec.status === 'ABSENT') rc = 'ra'; else if (rec.status === 'ON_LEAVE') rc = 'rl';
          } else if (isWk) {
            rc = 'rw';
            stHTML = `<span class="pill" style="background:#f8fafc;color:#9ca3af;border:1px solid #9ca3af33">Weekend</span>`;
          } else if (hName) {
            rc = 'rh';
            stHTML = `<span class="pill" style="background:#eff6ff;color:#2563eb;border:1px solid #2563eb33">${hName}</span>`;
          } else if (d < today) {
            rc = 'ra';
            stHTML = `<span class="pill" style="background:#fef2f2;color:#dc2626;border:1px solid #dc262633">Absent</span>`;
          } else {
            rc = 'ru'; stHTML = '<span class="dim">—</span>';
          }

          // Break info
          let brkHTML = '<span class="dim">—</span>';
          if (rec && rec.breaks.length > 0) {
            const totalBrkMin = rec.breaks.reduce((s, b) => s + (b.duration || 0), 0);
            const brkH = Math.floor(totalBrkMin / 60), brkM = totalBrkMin % 60;
            const brkStr = brkH > 0 ? `${brkH}h ${brkM}m` : `${brkM}m`;
            brkHTML = `<b>${brkStr}</b><br><span class="tag" style="background:#f0fdf412;color:#64748b;border:1px solid #e2e8f030">${rec.breaks.length} break${rec.breaks.length > 1 ? 's' : ''}</span>`;
          }

          // Location info
          let locHTML = '<span class="dim">—</span>';
          if (rec && rec.workLocation && !['WEEKEND','HOLIDAY'].includes(rec.status)) {
            const locMap: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
              'OFFICE': { emoji: '🏢', label: 'Office', color: '#475569', bg: '#f8fafc' },
              'REMOTE': { emoji: '🏠', label: 'Remote', color: '#0284c7', bg: '#f0f9ff' },
              'HYBRID': { emoji: '🔄', label: 'Hybrid', color: '#7c3aed', bg: '#f5f3ff' },
            };
            const loc = locMap[rec.workLocation] || locMap['OFFICE'];
            locHTML = `<span class="pill" style="background:${loc.bg};color:${loc.color};border:1px solid ${loc.color}33">${loc.emoji} ${loc.label}</span>`;
          }

          dayRows += `<tr class="${rc}${isTdy ? ' rt' : ''}"><td class="tl"><div class="dc"><span class="dnum">${String(dNum).padStart(2, '0')}</span><span class="dname${isWk ? ' dwk' : ''}">${dn}</span></div></td><td class="tc">${ciHTML}<br>${ciTag}</td><td class="tc">${coHTML}<br>${coTag}</td><td class="tc">${brkHTML}</td><td class="tc">${hHTML}</td><td class="tc">${exHTML}</td><td class="tc">${locHTML}</td><td class="tc">${stHTML}</td></tr>`;
        }

        empHTML += `<div class="es">
<div class="eh"><div class="el"><div class="ea">${emp.firstName[0]}${emp.lastName[0]}</div><div><div class="en">${name}</div><div class="em">${emp.employeeCode} &bull; ${emp.department?.name || 'N/A'} &bull; ${emp.designation || 'N/A'}</div></div></div><div class="er">${sLabel} &bull; ${fmtShiftTime(sStart)}–${fmtShiftTime(sEnd)} &bull; ${std}h/day</div></div>
<div class="sr"><div class="sc"><div class="sv">${pres}</div><div class="sl">Present</div></div><div class="sc"><div class="sv c-r">${absCnt}</div><div class="sl">Absent</div></div><div class="sc"><div class="sv c-y">${late}</div><div class="sl">Late</div></div><div class="sc"><div class="sv c-p">${leave}</div><div class="sl">Leave</div></div><div class="sc"><div class="sv">${half}</div><div class="sl">Half</div></div><div class="sc"><div class="sv">${hrs.toFixed(1)}</div><div class="sl">Hours</div></div><div class="sc"><div class="sv">+${extraH.toFixed(1)}</div><div class="sl">Extra</div></div><div class="sc"><div class="sv">-${shortH.toFixed(1)}</div><div class="sl">Short</div></div></div>
<div class="sm">${allDates.length} Total &bull; ${workDays} Working &bull; ${wkCnt} Wknd &bull; ${holCnt} Hol &nbsp;|&nbsp; ${attPct}% Att. &bull; ${avgH.toFixed(1)}h/day avg &bull; ${onTime}/${pres} OnTime</div>
<table class="dt"><thead><tr><th class="thl">Day</th><th>Check In</th><th>Check Out</th><th>Break</th><th>Hours</th><th>+/−</th><th>Location</th><th>Status</th></tr></thead><tbody>${dayRows}</tbody></table></div>`;
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Attendance Report — ${monthName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1e293b;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:11px}
.pg{max-width:210mm;margin:0 auto;padding:20px 24px}

/* Action bar */
.ab{display:flex;justify-content:center;gap:10px;padding:12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:100}
.ab button{display:inline-flex;align-items:center;gap:6px;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .15s}
.ab .bp{background:#1e293b;color:#fff}.ab .bp:hover{background:#0f172a}
.ab .bc{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}.ab .bc:hover{background:#e2e8f0}

/* Header */
.hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:2px solid #1e293b;margin-bottom:16px}
.hdr-l{display:flex;align-items:center;gap:12px}
.hdr-l img{height:36px;object-fit:contain}
.hdr-l .fb{width:36px;height:36px;background:#1e293b;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#fff}
.hdr h1{font-size:14px;font-weight:700;letter-spacing:-.3px;text-align:center;margin-top:6px}
.hdr .co{font-size:10px;color:#64748b;margin-top:1px}
.hdr-r{text-align:right;font-size:10px;color:#64748b;line-height:1.5}

/* Summary stats */
.stats{display:flex;gap:0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:16px}
.st{flex:1;text-align:center;padding:10px 4px;border-right:1px solid #e2e8f0}
.st:last-child{border-right:none}
.st .v{font-size:18px;font-weight:700}
.st .l{font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-top:2px}

/* Employee section */
.es{margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;page-break-inside:avoid}
.eh{background:#1e293b;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center}
.el{display:flex;align-items:center;gap:10px}
.ea{width:34px;height:34px;background:rgba(255,255,255,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.en{font-size:14px;font-weight:600}
.em{font-size:9px;opacity:.7;margin-top:1px}
.er{font-size:10px;opacity:.8}

/* Stats row */
.sr{display:grid;grid-template-columns:repeat(8,1fr);border-bottom:1px solid #e2e8f0;background:#f8fafc}
.sc{text-align:center;padding:8px 2px;border-right:1px solid #e2e8f0}
.sc:last-child{border-right:none}
.sv{font-size:15px;font-weight:700}
.sl{font-size:7px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;margin-top:1px}
.c-r{color:#dc2626}.c-y{color:#d97706}.c-p{color:#7c3aed}

/* Summary bar */
.sm{padding:6px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:9px;color:#64748b;text-align:center}

/* Table */
.dt{width:100%;border-collapse:collapse}
.dt th{background:#f1f5f9;color:#475569;padding:6px 4px;text-align:center;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e2e8f0}
.thl{text-align:left!important;padding-left:12px!important;width:60px}
.dt td{padding:5px 4px;border-bottom:1px solid #f1f5f9;font-size:10px;vertical-align:middle}
.tc{text-align:center}
.tl{padding-left:12px!important}
.dc{display:flex;align-items:center;gap:4px}
.dnum{font-size:13px;font-weight:700;width:22px}
.dname{font-size:9px;font-weight:500;color:#64748b}
.dwk{color:#d97706!important}
.dim{color:#cbd5e1}

/* Pills & tags */
.pill{display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:600;white-space:nowrap}
.tag{display:inline-block;padding:1px 5px;border-radius:3px;font-size:8px;font-weight:500;margin-top:1px;white-space:nowrap}

/* Row variants */
.rw{background:#fafaf9}.ra{background:#fef2f2}.rl{background:#faf5ff}.ru{background:#fafafa}
.rt{border-left:2px solid #1e293b}

/* Footer */
.rf{margin-top:20px;text-align:center;font-size:9px;color:#94a3b8;padding:12px 0;border-top:1px solid #e2e8f0}

@media print{
  body{background:#fff;padding:0}
  .pg{padding:10px 16px;max-width:100%}
  .es{page-break-inside:avoid;break-inside:avoid}
  .ab{display:none!important}
  .hdr{margin-bottom:10px}
}
</style></head><body>
<div class="ab">
<button class="bp" onclick="window.print()"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H9v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg> Print / Save as PDF</button>
<button class="bc" onclick="window.close()"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg> Close</button>
</div>
<div class="pg">
<div class="hdr"><div class="hdr-l">${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : '<div class="fb">B</div>'}<div><h1>Attendance Report</h1></div></div><div class="hdr-r">${monthName}<br>${dateRangeText}<br>${employees.length} Employee(s)<br>Generated: ${new Date().toLocaleDateString()}</div></div>
<div class="stats"><div class="st"><div class="v">${employees.length}</div><div class="l">Employees</div></div><div class="st"><div class="v">${totalPresent}</div><div class="l">Present</div></div><div class="st"><div class="v c-r">${totalAbsent}</div><div class="l">Absent</div></div><div class="st"><div class="v c-y">${totalLate}</div><div class="l">Late</div></div><div class="st"><div class="v c-p">${totalOnLeave}</div><div class="l">On Leave</div></div><div class="st"><div class="v">${totalHours.toFixed(1)}</div><div class="l">Total Hrs</div></div><div class="st"><div class="v">+${totalExtraHours.toFixed(1)}</div><div class="l">Extra Hrs</div></div></div>
${empHTML}
<div class="rf">HR Management System &bull; ${new Date().toLocaleString()}</div>
</div></body></html>`;

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="attendance_report_${formatDate(start)}_to_${formatDate(end)}.html"`,
        },
      });
    }

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="attendance_${year}_${month.toString().padStart(2, '0')}.csv"`,
      },
    });
  } catch (error) {
    console.error('Download attendance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
