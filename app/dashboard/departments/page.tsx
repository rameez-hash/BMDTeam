'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';

interface DeptEmployee {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode?: string;
  designation?: string;
  employmentStatus?: string;
  profileImage?: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  _count?: { employees: number };
  employees?: DeptEmployee[];
}

export default function DepartmentsPage() {
  const { allowed, loading: permLoading } = useRequirePermission('departments', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Departments" />;
  return <DepartmentsPageContent />;
}

function DepartmentsPageContent() {
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.data || []);
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchDepartments();
  }, [token, fetchDepartments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const url = editingDepartment 
        ? `/api/departments?id=${editingDepartment.id}` 
        : '/api/departments';
      const method = editingDepartment ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save department');
      }

      setShowModal(false);
      setEditingDepartment(null);
      resetForm();
      fetchDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (dept: Department) => {
    setEditingDepartment(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    openConfirm({ title: 'Delete Department', message: `Are you sure you want to delete "${name}" department?`, variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/departments?id=${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Failed to delete department');
          return;
        }
        fetchDepartments();
        toast.success('Department deleted successfully!');
      } catch (error) {
        toast.error('Failed to delete department');
      }
    }});
  };

  const resetForm = () => {
    setFormData({ name: '', code: '', description: '' });
    setError('');
  };

  const openAddModal = () => {
    resetForm();
    setEditingDepartment(null);
    setShowModal(true);
  };

  const columns = [
    {
      key: 'name',
      header: 'Department',
      render: (dept: Department) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-slate-900">{dept.name}</p>
            <p className="text-sm text-slate-500 font-mono">{dept.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (dept: Department) => (
        <span className="text-slate-600">{dept.description || '-'}</span>
      ),
    },
    {
      key: 'employees',
      header: 'Employees',
      render: (dept: Department) => (
        <div>
          <button
            onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
            className="flex items-center gap-1 hover:text-emerald-600 transition-colors"
          >
            <Badge variant="info">{dept._count?.employees || 0}</Badge>
            <svg className={`w-3 h-3 transition-transform ${expandedDept === dept.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedDept === dept.id && dept.employees && dept.employees.length > 0 && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {dept.employees.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => router.push(`/dashboard/employees/${emp.id}`)}
                  className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-50 cursor-pointer text-xs"
                >
                  <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-[10px] font-semibold text-emerald-700 flex-shrink-0">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <span className="text-slate-700 truncate">{emp.firstName} {emp.lastName}</span>
                  <span className="text-slate-400 truncate">({emp.employeeCode})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (dept: Department) => (
        <Badge variant={dept.isActive ? 'success' : 'default'}>
          {dept.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (dept: Department) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleEdit(dept)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(dept.id, dept.name)}>
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6" suppressHydrationWarning>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl skeleton" />
            <div className="space-y-2"><div className="h-6 w-40 skeleton rounded" /><div className="h-4 w-56 skeleton rounded" /></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-start justify-between"><div className="w-12 h-12 rounded-xl skeleton" /><div className="w-16 h-6 skeleton rounded" /></div>
              <div className="h-5 w-2/3 skeleton rounded" />
              <div className="h-4 w-1/2 skeleton rounded" />
              <div className="h-4 w-full skeleton rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" suppressHydrationWarning>
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Departments</h1>
            <p className="text-teal-100 text-sm mt-0.5">Manage organizational departments · {departments.length} total</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-slate-600'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 ${viewMode === 'table' ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-slate-600'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
          <Button onClick={openAddModal}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Department
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <Card key={dept.id} className="hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(dept)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(dept.id, dept.name)} className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{dept.name}</h3>
              <p className="text-sm text-slate-500 font-mono">{dept.code}</p>
              <p className="text-sm text-slate-500 mt-2 line-clamp-2">{dept.description || 'No description'}</p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {dept._count?.employees || 0} Employees
                  <svg className={`w-3 h-3 transition-transform ${expandedDept === dept.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <Badge variant={dept.isActive ? 'success' : 'default'} size="sm">
                  {dept.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {expandedDept === dept.id && dept.employees && dept.employees.length > 0 && (
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                  {dept.employees.map((emp) => (
                    <div
                      key={emp.id}
                      onClick={() => router.push(`/dashboard/employees/${emp.id}`)}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      {emp.profileImage ? (
                        <img src={emp.profileImage} alt={emp.firstName} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-semibold text-emerald-700">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-slate-500 truncate">{emp.designation || 'N/A'} · {emp.employeeCode}</p>
                      </div>
                      <Badge
                        variant={emp.employmentStatus === 'ACTIVE' ? 'success' : emp.employmentStatus === 'PROBATION' ? 'info' : emp.employmentStatus === 'SUSPENDED' || emp.employmentStatus === 'TERMINATED' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {emp.employmentStatus}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              {expandedDept === dept.id && (!dept.employees || dept.employees.length === 0) && (
                <div className="mt-3 text-center py-3 text-sm text-slate-400">No employees in this department</div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card padding={false}>
          <Table columns={columns} data={departments} emptyMessage="No departments found" />
        </Card>
      )}

      {departments.length === 0 && !loading && (
        <Card>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900">No departments yet</h3>
            <p className="text-slate-500 mt-1">Get started by creating your first department</p>
            <Button onClick={openAddModal} className="mt-4">
              Add Department
            </Button>
          </div>
        </Card>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingDepartment(null); resetForm(); }}
        title={editingDepartment ? 'Edit Department' : 'Add New Department'}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}
          <Input
            label="Department Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Human Resources"
            required
          />
          <Input
            label="Department Code *"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="e.g., HR"
            required
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Department description..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {editingDepartment ? 'Update' : 'Add'} Department
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={() => confirmDialog.onConfirm()} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} />
    </div>
  );
}
