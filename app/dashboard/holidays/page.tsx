'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  isOptional?: boolean;
  description?: string;
}

export default function HolidaysPage() {
  const { allowed, loading: permLoading } = useRequirePermission('holidays', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Holidays" />;
  return <HolidaysPageContent />;
}

function HolidaysPageContent() {
  const { token, user, hasPermission } = useAuth();
  const toast = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    date: '',
    type: 'PUBLIC',
    isOptional: false,
    description: '',
  });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const canManage = hasPermission?.('holidays', 'manage') || user?.role === 'ADMIN' || user?.role === 'HR';

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await fetch(`/api/holidays?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHolidays(data.data || data.holidays || []);
      }
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
    } finally {
      setLoading(false);
    }
  }, [token, year]);

  useEffect(() => {
    if (token) fetchHolidays();
  }, [token, fetchHolidays]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingHoliday ? `/api/holidays?id=${editingHoliday.id}` : '/api/holidays';
      const method = editingHoliday ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: formData.name,
          date: formData.date,
          type: formData.type,
          isOptional: formData.isOptional,
          description: formData.description,
          year: new Date(formData.date).getFullYear(),
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingHoliday(null);
        resetForm();
        fetchHolidays();
        toast?.success?.(
          editingHoliday
            ? `Holiday "${formData.name}" updated — attendance records synced automatically`
            : `Holiday "${formData.name}" added — marked as HOLIDAY in attendance for all employees`
        );
      } else {
        const data = await res.json();
        toast?.error?.(data.error || 'Failed to save holiday');
      }
    } catch (error) {
      console.error('Failed to save holiday:', error);
      toast?.error?.('Failed to save holiday');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      date: holiday.date.split('T')[0],
      type: holiday.type,
      isOptional: holiday.isOptional || false,
      description: holiday.description || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    openConfirm({ title: 'Delete Holiday', message: 'Are you sure you want to delete this holiday? This will also remove HOLIDAY attendance records for all employees on this date.', variant: 'danger', confirmText: 'Delete Holiday', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/holidays?id=${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          fetchHolidays();
          toast?.success?.('Holiday deleted — attendance records removed for this date');
        } else {
          const data = await res.json();
          toast?.error?.(data.error || 'Failed to delete holiday');
        }
      } catch (error) {
        console.error('Failed to delete holiday:', error);
        toast?.error?.('Failed to delete holiday');
      }
    }});
  };

  const resetForm = () => {
    setFormData({ name: '', date: '', type: 'PUBLIC', isOptional: false, description: '' });
  };

  const getTypeBadge = (type: string, isOptional?: boolean) => {
    const variants: Record<string, 'success' | 'info' | 'warning'> = {
      PUBLIC: 'success',
      COMPANY: 'info',
      RESTRICTED: 'warning',
    };
    return (
      <span className="flex items-center gap-1.5">
        <Badge variant={variants[type] || 'default'}>{type}</Badge>
        {isOptional && <Badge variant="warning">Optional</Badge>}
      </span>
    );
  };

  // Group holidays by month
  const groupedHolidays = holidays.reduce((acc, holiday) => {
    const month = new Date(holiday.date).toLocaleDateString('en-US', { month: 'long' });
    if (!acc[month]) acc[month] = [];
    acc[month].push(holiday);
    return acc;
  }, {} as Record<string, Holiday[]>);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-24 bg-white rounded-2xl skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Holidays</h1>
              <p className="text-teal-100 text-sm mt-0.5">View and manage company holidays</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white text-sm font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-sm"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                <option key={y} value={y} className="text-slate-900 bg-white">{y}</option>
              ))}
            </select>
            {canManage && (
              <Button variant="ghost" onClick={() => { resetForm(); setEditingHoliday(null); setShowModal(true); }} className="!bg-white !text-teal-700 hover:!bg-teal-50 border-0 shadow-md font-semibold text-sm px-4 py-2">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Holiday
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Public Holidays</p>
              <p className="text-2xl font-bold text-emerald-900">{holidays.filter((h) => h.type === 'PUBLIC').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 border border-blue-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Company Holidays</p>
              <p className="text-2xl font-bold text-blue-900">{holidays.filter((h) => h.type === 'COMPANY').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 border border-amber-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Optional Holidays</p>
              <p className="text-2xl font-bold text-amber-900">{holidays.filter((h) => h.isOptional).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Holiday List by Month */}
      {Object.keys(groupedHolidays).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedHolidays).map(([month, monthHolidays]) => (
            <div key={month}>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">{month}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthHolidays.map((holiday) => (
                  <Card key={holiday.id} className="hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-emerald-100 rounded-xl flex flex-col items-center justify-center">
                          <span className="text-lg font-bold text-emerald-600">
                            {new Date(holiday.date).getDate()}
                          </span>
                          <span className="text-xs text-emerald-500">
                            {new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'short' })}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-900">{holiday.name}</h4>
                          <div className="mt-1">{getTypeBadge(holiday.type, holiday.isOptional)}</div>
                          {holiday.description && (
                            <p className="text-sm text-slate-500 mt-2">{holiday.description}</p>
                          )}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(holiday)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(holiday.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-slate-500">No holidays found for {year}</p>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingHoliday(null); }}
        title={editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Holiday Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
          <Select
            label="Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            options={[
              { value: 'PUBLIC', label: 'Public Holiday' },
              { value: 'COMPANY', label: 'Company Holiday' },
              { value: 'RESTRICTED', label: 'Restricted Holiday' },
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={formData.isOptional}
              onChange={(e) => setFormData({ ...formData, isOptional: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Optional Holiday (employees can choose to work)
          </label>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingHoliday ? 'Update Holiday' : 'Add Holiday'}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={() => confirmDialog.onConfirm()} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} />
    </div>
  );
}
