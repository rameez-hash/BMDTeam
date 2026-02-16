'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';

interface PFContribution {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
  runningBalance: number;
  basicSalary: number;
  pfRate: number;
  notes: string | null;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    department: { name: string } | null;
  };
}

interface EmployeeBalance {
  employeeId: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  department: string;
  totalEmployee: number;
  totalEmployer: number;
  totalBalance: number;
  pfEnabled: boolean;
  monthsContributed: number;
}

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatPKR(amount: number): string {
  return 'Rs ' + Math.round(amount).toLocaleString('en-PK');
}

export default function ProvidentFundPage() {
  const { token, user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [contributions, setContributions] = useState<PFContribution[]>([]);
  const [employeeBalances, setEmployeeBalances] = useState<EmployeeBalance[]>([]);
  const [summary, setSummary] = useState({ totalEmployeeContribution: 0, totalEmployerContribution: 0, totalContribution: 0 });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [view, setView] = useState<'overview' | 'ledger'>('overview');
  const [selectedEmpName, setSelectedEmpName] = useState('');

  const isAdmin = user?.role === 'ADMIN';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/provident-fund?year=${selectedYear}`;
      if (selectedEmployee) {
        url += `&employeeId=${selectedEmployee}`;
      }
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const res = await response.json();
      if (res.success) {
        setContributions(res.data);
        setEmployeeBalances(res.employeeBalances || []);
        setSummary(res.summary);
      }
    } catch {
      toast.error('Failed to load PF data');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedEmployee, token]);

  useEffect(() => {
    if (token) fetchData();
  }, [token, fetchData]);

  const viewEmployeeLedger = (emp: EmployeeBalance) => {
    setSelectedEmployee(emp.employeeId);
    setSelectedEmpName(emp.firstName + ' ' + emp.lastName);
    setView('ledger');
  };

  const backToOverview = () => {
    setSelectedEmployee('');
    setSelectedEmpName('');
    setView('overview');
  };

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Provident Fund</h1>
              <p className="text-teal-100 text-sm mt-0.5">Employee & Company PF contributions tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {view === 'ledger' && (
              <button
                onClick={backToOverview}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Overview
              </button>
            )}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl text-white text-sm font-medium border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 appearance-none cursor-pointer"
            >
              {years.map(y => (
                <option key={y} value={y} className="text-slate-900">{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 border border-blue-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Employee Contribution</p>
              <p className="text-xl font-bold text-blue-900">{formatPKR(summary.totalEmployeeContribution)}</p>
            </div>
          </div>
          <p className="text-xs text-blue-500">Deducted from salary ({selectedYear})</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Employer Contribution</p>
              <p className="text-xl font-bold text-emerald-900">{formatPKR(summary.totalEmployerContribution)}</p>
            </div>
          </div>
          <p className="text-xs text-emerald-500">Company match ({selectedYear})</p>
        </div>
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-violet-100 border border-violet-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-violet-600 uppercase tracking-wide">Total PF ({selectedYear})</p>
              <p className="text-xl font-bold text-violet-900">{formatPKR(summary.totalContribution)}</p>
            </div>
          </div>
          <p className="text-xs text-violet-500">Employee + Employer combined</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <div className="flex items-center justify-center gap-3">
            <svg className="w-5 h-5 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-slate-500 text-sm">Loading PF data...</span>
          </div>
        </div>
      ) : view === 'overview' ? (
        /* OVERVIEW - Employee Balances */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="font-semibold text-slate-900">Employee PF Balances — {selectedYear}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Click on an employee to view their detailed ledger</p>
          </div>
          {employeeBalances.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-600 font-medium">No PF contributions found</p>
              <p className="text-sm text-slate-400 mt-1">PF contributions are automatically recorded when payroll is generated for employees with PF enabled</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Employee</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Department</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Employee PF</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Employer PF</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Balance</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Months</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeeBalances.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 text-sm">{emp.firstName} {emp.lastName}</p>
                            <p className="text-xs text-slate-500 font-mono">{emp.employeeCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{emp.department}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-blue-600">{formatPKR(emp.totalEmployee)}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-emerald-600">{formatPKR(emp.totalEmployer)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-violet-700 text-sm">{formatPKR(emp.totalBalance)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {emp.monthsContributed}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => viewEmployeeLedger(emp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          View Ledger
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* LEDGER VIEW - Individual Employee */
        <div className="space-y-4">
          {/* Employee Info */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                {selectedEmpName.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedEmpName}</h2>
                <p className="text-sm text-slate-500">PF Ledger — {selectedYear}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Current Balance</p>
                <p className="text-2xl font-bold text-violet-700">
                  {contributions.length > 0 ? formatPKR(contributions[0].runningBalance) : formatPKR(0)}
                </p>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-900">Monthly Contributions</h3>
            </div>
            {contributions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500">No contributions found for {selectedYear}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Month</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Basic Salary</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Rate</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Employee PF</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Employer PF</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Total</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...contributions].reverse().map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3.5 text-sm font-medium text-slate-900">
                          {monthNames[c.month]} {c.year}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-right text-slate-600">{formatPKR(c.basicSalary)}</td>
                        <td className="px-6 py-3.5 text-sm text-right text-slate-600">{c.pfRate}%</td>
                        <td className="px-6 py-3.5 text-sm text-right font-medium text-blue-600">{formatPKR(c.employeeContribution)}</td>
                        <td className="px-6 py-3.5 text-sm text-right font-medium text-emerald-600">{formatPKR(c.employerContribution)}</td>
                        <td className="px-6 py-3.5 text-sm text-right font-semibold text-slate-900">{formatPKR(c.totalContribution)}</td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="font-bold text-violet-700 text-sm">{formatPKR(c.runningBalance)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td className="px-6 py-3 text-sm font-bold text-slate-900" colSpan={3}>Total ({selectedYear})</td>
                      <td className="px-6 py-3 text-sm text-right font-bold text-blue-700">
                        {formatPKR(contributions.reduce((s, c) => s + c.employeeContribution, 0))}
                      </td>
                      <td className="px-6 py-3 text-sm text-right font-bold text-emerald-700">
                        {formatPKR(contributions.reduce((s, c) => s + c.employerContribution, 0))}
                      </td>
                      <td className="px-6 py-3 text-sm text-right font-bold text-slate-900">
                        {formatPKR(contributions.reduce((s, c) => s + c.totalContribution, 0))}
                      </td>
                      <td className="px-6 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="flex gap-3 bg-blue-50 p-4 rounded-xl border border-blue-200">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">How PF Works</p>
              <p className="text-xs leading-relaxed text-blue-700">
                Provident Fund is calculated at 12% of basic salary. Both the employee and the company contribute equally.
                Employee&apos;s share is deducted from salary, while the company&apos;s share is an additional cost borne by the employer.
                PF contributions are automatically recorded when payroll is generated.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
