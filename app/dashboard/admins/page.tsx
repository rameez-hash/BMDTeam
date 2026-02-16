'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useToast } from '@/app/hooks/useToast';
import AccessDenied from '@/app/components/AccessDenied';
import { Button, Input } from '@/app/components/ui';

interface Admin {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profileImage?: string;
  designation?: string;
  joiningDate?: string;
  department?: { id: string; name: string };
  user?: { id: string; role: string; isActive: boolean; lastLogin?: string; email?: string; createdAt: string };
}

export default function AdminsPage() {
  const { user, token } = useAuth();

  if (user?.role !== 'ADMIN') {
    return <AccessDenied module="Admins" />;
  }

  return <AdminsPageContent />;
}

function AdminsPageContent() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editAdmin, setEditAdmin] = useState<Admin | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAdmins = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admins', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.data || []);
      }
    } catch {
      toast.error('Failed to load admins');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const openEdit = (admin: Admin) => {
    setEditAdmin(admin);
    setEditCode(admin.employeeCode || '');
    setEditFirstName(admin.firstName || '');
    setEditLastName(admin.lastName || '');
    setEditEmail(admin.email || '');
    setEditDesignation(admin.designation || '');
  };

  const closeEdit = () => {
    setEditAdmin(null);
    setEditCode('');
    setEditFirstName('');
    setEditLastName('');
    setEditEmail('');
    setEditDesignation('');
  };

  const handleSaveEdit = async () => {
    if (!editAdmin || !token) return;
    if (!editCode.trim()) {
      toast.error('Employee code is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${editAdmin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employeeCode: editCode.trim(),
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          email: editEmail.trim(),
          designation: editDesignation.trim(),
        }),
      });
      if (res.ok) {
        toast.success('Admin details updated');
        closeEdit();
        fetchAdmins();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update admin');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Administrators</h1>
              <p className="text-teal-100 text-sm mt-0.5">
                {admins.length} admin{admins.length !== 1 ? 's' : ''} with full system access
              </p>
            </div>
          </div>
          <a
            href="/dashboard/employees"
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add New Admin
          </a>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-amber-800">Admin accounts have full system access</p>
          <p className="text-xs text-amber-600 mt-1">
            Admins bypass all permission checks and can access everything. To add a new admin, go to Employees → Add Employee → set System Role to &quot;Admin&quot;.
          </p>
        </div>
      </div>

      {/* Admin Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <p className="text-lg font-medium">No administrators found</p>
          <p className="text-sm mt-1">Add admins from the Employees page with System Role set to Admin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {admins.map((admin) => {
            const isSelf = admin.user?.id === (user as any)?.id;
            return (
              <div
                key={admin.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-red-500 to-rose-500 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-white/90 text-xs font-mono">{admin.employeeCode}</span>
                    {isSelf && (
                      <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                        You
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    admin.user?.isActive 
                      ? 'bg-emerald-400/20 text-white' 
                      : 'bg-red-400/20 text-white'
                  }`}>
                    {admin.user?.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    {admin.profileImage ? (
                      <img
                        src={admin.profileImage}
                        alt={`${admin.firstName} ${admin.lastName}`}
                        className="w-12 h-12 rounded-full object-cover border-2 border-slate-100"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center text-white font-bold text-lg">
                        {admin.firstName?.[0]}{admin.lastName?.[0]}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        {admin.firstName} {admin.lastName}
                      </h3>
                      <p className="text-xs text-slate-500">{admin.designation || 'Administrator'}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">{admin.email}</span>
                    </div>
                    {admin.phone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{admin.phone}</span>
                      </div>
                    )}
                    {admin.department && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span>{admin.department.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer Info */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>Joined {formatDate(admin.joiningDate || admin.user?.createdAt)}</span>
                    <button
                      onClick={() => openEdit(admin)}
                      className="text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeEdit}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-500 to-rose-500 rounded-t-2xl px-6 py-4">
              <h3 className="text-lg font-bold text-white">Edit Admin</h3>
              <p className="text-white/80 text-sm">{editAdmin.firstName} {editAdmin.lastName}</p>
            </div>
            <div className="p-6 space-y-4">
              <Input
                label="Employee Code / ID"
                value={editCode}
                onChange={e => setEditCode(e.target.value)}
                placeholder="e.g. ADM-001"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  value={editFirstName}
                  onChange={e => setEditFirstName(e.target.value)}
                  placeholder="First name"
                />
                <Input
                  label="Last Name"
                  value={editLastName}
                  onChange={e => setEditLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
              <Input
                label="Email"
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                placeholder="admin@company.com"
              />
              <Input
                label="Designation"
                value={editDesignation}
                onChange={e => setEditDesignation(e.target.value)}
                placeholder="e.g. System Administrator"
              />
            </div>
            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={closeEdit}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
