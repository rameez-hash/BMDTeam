'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';

interface AttendanceCorrection {
  id: string;
  date: string;
  requestType: string;
  status: string;
  reason: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  originalCheckIn?: string;
  originalCheckOut?: string;
  rejectionReason?: string | null;
  createdAt: string;
  approvedBy?: { firstName: string; lastName: string };
  approvedAt?: string;
  employee?: { firstName: string; lastName: string; employeeCode?: string };
}

export default function AttendanceCorrectionTab({ employeeId }: { employeeId: string }) {
  const { token } = useAuth();
  const toast = useToast();
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingLoading, setFetchingLoading] = useState(false);

  const [formData, setFormData] = useState({
    date: '',
    requestType: 'MISSING_CHECKOUT',
    requestedCheckIn: '',
    requestedCheckOut: '',
    reason: '',
  });

  const fetchCorrections = useCallback(async () => {
    if (!token) return;
    setFetchingLoading(true);
    try {
      const res = await fetch('/api/attendance/corrections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCorrections(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch corrections:', error);
    } finally {
      setFetchingLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCorrections();
  }, [fetchCorrections]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.reason) {
      toast.error('Please fill in date and reason');
      return;
    }
    if (!token) return;

    // Build full ISO datetime strings by combining the date with the time
    let requestedCheckIn: string | null = null;
    let requestedCheckOut: string | null = null;

    if (formData.requestedCheckIn) {
      requestedCheckIn = new Date(`${formData.date}T${formData.requestedCheckIn}:00`).toISOString();
    }
    if (formData.requestedCheckOut) {
      const coDate = new Date(`${formData.date}T${formData.requestedCheckOut}:00`);
      // Night shift: if check-out time is before check-in time, it means next day
      if (formData.requestedCheckIn && formData.requestedCheckOut < formData.requestedCheckIn) {
        coDate.setDate(coDate.getDate() + 1);
      }
      requestedCheckOut = coDate.toISOString();
    }

    setLoading(true);
    try {
      const res = await fetch('/api/attendance/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          date: formData.date,
          requestedCheckIn,
          requestedCheckOut,
          reason: formData.reason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Correction request submitted successfully!');
        setShowForm(false);
        setFormData({ date: '', requestType: 'MISSING_CHECKOUT', requestedCheckIn: '', requestedCheckOut: '', reason: '' });
        fetchCorrections();
      } else {
        toast.error(data.error || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Failed to submit correction:', error);
      toast.error('Failed to submit correction request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'danger';
      default: return 'default';
    }
  };

  const getRequestTypeLabel = (type: string): string => {
    const labels: { [key: string]: string } = {
      MISSING_CHECKIN: '❌ Missing Check-in',
      MISSING_CHECKOUT: '❌ Missing Check-out',
      WRONG_TIME: '⏰ Wrong Time',
    };
    return labels[type] || type;
  };

  const fmtTime = (iso?: string | null) => {
    if (!iso) return null;
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };

  return (
    <div className="space-y-6">

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Attendance Correction Requests</h3>
        <Button onClick={() => { const today = (() => { const _d = new Date(); return `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`; })(); setFormData({ date: today, requestType: 'MISSING_CHECKOUT', requestedCheckIn: '', requestedCheckOut: '', reason: '' }); setShowForm(true); }} size="sm">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Request
        </Button>
      </div>

      {/* ═══ Correction Request Modal ═══ */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Request Attendance Correction" size="md">
        <form onSubmit={handleSubmitRequest} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date *"
              type="date"
              value={formData.date}
              min="2024-01-01"
              max={(() => { const _d = new Date(); return `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`; })()}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <Select
              label="Correction Type"
              value={formData.requestType}
              onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
              options={[
                { value: 'MISSING_CHECKIN', label: 'Missing Check-in' },
                { value: 'MISSING_CHECKOUT', label: 'Missing Check-out' },
                { value: 'WRONG_TIME', label: 'Wrong Time' },
              ]}
            />
          </div>

          {(formData.requestType === 'MISSING_CHECKIN' || formData.requestType === 'WRONG_TIME') && (
            <Input
              label="Requested Check-in Time"
              type="time"
              value={formData.requestedCheckIn}
              onChange={(e) => setFormData({ ...formData, requestedCheckIn: e.target.value })}
            />
          )}

          {(formData.requestType === 'MISSING_CHECKOUT' || formData.requestType === 'WRONG_TIME') && (
            <Input
              label="Requested Check-out Time"
              type="time"
              value={formData.requestedCheckOut}
              onChange={(e) => setFormData({ ...formData, requestedCheckOut: e.target.value })}
            />
          )}

          {formData.requestedCheckIn && formData.requestedCheckOut && formData.requestedCheckOut < formData.requestedCheckIn && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg>
              <span>Night shift detected — check-out will be recorded as next day ({(() => { const d = new Date(formData.date); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); })()})</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason *</label>
            <textarea
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
              rows={3}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Please explain why you need this correction..."
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>

      {fetchingLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2"><div className="skeleton h-4 w-32 rounded-lg" /><div className="skeleton h-4 w-16 rounded-lg" /></div>
                  <div className="flex items-center gap-3"><div className="skeleton h-3 w-20 rounded-lg" /><div className="skeleton h-3 w-36 rounded-lg" /></div>
                </div>
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : corrections.length > 0 ? (
        <div className="space-y-3">
          {corrections.map((correction) => (
            <div key={correction.id} className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Type + date */}
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900 text-sm">{getRequestTypeLabel(correction.requestType)}</h3>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {new Date(correction.date).toLocaleDateString('en-PK', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Reason */}
                  <p className="text-xs text-slate-500 mt-1">{correction.reason}</p>

                  {/* Times: Original → Requested */}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                    {(correction.originalCheckIn || correction.originalCheckOut) && (
                      <>
                        <span className="text-slate-400 font-medium">Original:</span>
                        {correction.originalCheckIn && <span className="text-slate-500">In {fmtTime(correction.originalCheckIn)}</span>}
                        {correction.originalCheckOut && <span className="text-slate-500">Out {fmtTime(correction.originalCheckOut)}</span>}
                        <span className="text-slate-300">→</span>
                      </>
                    )}
                    {(correction.requestedCheckIn || correction.requestedCheckOut) && (
                      <>
                        <span className="text-blue-500 font-medium">Requested:</span>
                        {correction.requestedCheckIn && (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            In: {fmtTime(correction.requestedCheckIn)}
                          </span>
                        )}
                        {correction.requestedCheckOut && (
                          <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                            Out: {fmtTime(correction.requestedCheckOut)}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Approved info */}
                  {correction.status === 'APPROVED' && correction.approvedBy && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {correction.approvedBy.firstName} {correction.approvedBy.lastName}
                      </span>
                      {correction.approvedAt && (
                        <span className="text-[10px] text-slate-400">on {new Date(correction.approvedAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</span>
                      )}
                      {correction.rejectionReason && (
                        <span className="text-[10px] text-emerald-600 italic">&ldquo;{correction.rejectionReason}&rdquo;</span>
                      )}
                    </div>
                  )}

                  {/* Rejected info */}
                  {correction.status === 'REJECTED' && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {correction.approvedBy && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          {correction.approvedBy.firstName} {correction.approvedBy.lastName}
                        </span>
                      )}
                      {correction.rejectionReason && (
                        <span className="text-[10px] text-red-600 italic">&ldquo;{correction.rejectionReason}&rdquo;</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right side */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={getStatusColor(correction.status)}>{correction.status}</Badge>
                  <span className="text-[10px] text-slate-400">
                    {new Date(correction.createdAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.251 2.251 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
          <h3 className="font-semibold text-slate-700">No Correction Requests</h3>
          <p className="text-sm text-slate-500">Submit a request to correct your attendance</p>
        </div>
      )}
    </div>
  );
}
