'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

interface Permission {
  id: string;
  module: string;
  action: string;
  label: string;
  description?: string;
}

interface RolePermission {
  id: string;
  permissionId: string;
  scope: 'ALL' | 'DEPARTMENT' | 'SELF';
  permission: Permission;
}

interface AppRole {
  id: string;
  name: string;
  description?: string;
  color: string;
  isSystem: boolean;
  isActive: boolean;
  permissions: RolePermission[];
  _count: { employees: number };
}

interface PermissionModule {
  [key: string]: string;
}

export default function RolesPage() {
  const { allowed, loading: permLoading } = useRequirePermission('roles', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Roles" />;
  return <RolesPageContent />;
}

function RolesPageContent() {
  const { token, hasPermission } = useAuth();
  const toast = useToast();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modules, setModules] = useState<PermissionModule>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<AppRole | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canManage = hasPermission('roles', 'manage');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6B7280',
  });

  // Track selected permissions with scope
  const [selectedPerms, setSelectedPerms] = useState<Map<string, 'ALL' | 'DEPARTMENT' | 'SELF'>>(new Map());

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRoles(data.data || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/permissions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.data || []);
        setModules(data.modules || {});
      }
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchRoles();
      fetchPermissions();
    }
  }, [token, fetchRoles, fetchPermissions]);

  const openAddModal = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '', color: '#6B7280' });
    setSelectedPerms(new Map());
    setShowModal(true);
  };

  const openEditModal = (role: AppRole) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      color: role.color || '#6B7280',
    });
    const perms = new Map<string, 'ALL' | 'DEPARTMENT' | 'SELF'>();
    role.permissions.forEach(rp => {
      perms.set(rp.permission.id, rp.scope);
    });
    setSelectedPerms(perms);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSubmitting(true);

    const permsArray = Array.from(selectedPerms.entries()).map(([permId, scope]) => ({
      permissionId: permId,
      scope,
    }));

    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
      const method = editingRole ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...formData, permissions: permsArray }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(editingRole ? 'Role updated successfully!' : 'Role created successfully!');
        setShowModal(false);
        fetchRoles();
      } else {
        toast.error(data.error || 'Failed to save role');
      }
    } catch {
      toast.error('Failed to save role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    openConfirm({ title: 'Delete Role', message: 'Are you sure you want to delete this role?', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/roles/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          toast.success('Role deleted successfully!');
          fetchRoles();
        } else {
          const data = await res.json();
          toast.error(data.error || 'Failed to delete role');
        }
      } catch {
        toast.error('Failed to delete role');
      }
    }});
  };

  const togglePermission = (permId: string) => {
    const newPerms = new Map(selectedPerms);
    if (newPerms.has(permId)) {
      newPerms.delete(permId);
    } else {
      newPerms.set(permId, 'ALL');
    }
    setSelectedPerms(newPerms);
  };

  const setPermScope = (permId: string, scope: 'ALL' | 'DEPARTMENT' | 'SELF') => {
    const newPerms = new Map(selectedPerms);
    newPerms.set(permId, scope);
    setSelectedPerms(newPerms);
  };

  const toggleModuleAll = (moduleName: string) => {
    const modulePerms = permissions.filter(p => p.module === moduleName);
    const allSelected = modulePerms.every(p => selectedPerms.has(p.id));
    const newPerms = new Map(selectedPerms);
    if (allSelected) {
      modulePerms.forEach(p => newPerms.delete(p.id));
    } else {
      modulePerms.forEach(p => { if (!newPerms.has(p.id)) newPerms.set(p.id, 'ALL'); });
    }
    setSelectedPerms(newPerms);
  };

  // Group permissions by module
  const groupedPermissions = permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {});

  const SCOPE_COLORS = {
    ALL: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    DEPARTMENT: 'bg-blue-100 text-blue-700 border-blue-300',
    SELF: 'bg-amber-100 text-amber-700 border-amber-300',
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="skeleton w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <div className="skeleton h-6 w-48 rounded-lg" />
            <div className="skeleton h-4 w-32 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="skeleton h-5 w-28 rounded-lg" />
                <div className="skeleton h-6 w-16 rounded-full" />
              </div>
              <div className="space-y-3">
                {[1,2,3,4].map(j => (
                  <div key={j} className="flex items-center gap-2">
                    <div className="skeleton h-3 w-3 rounded" />
                    <div className="skeleton h-3 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Roles Management</h1>
              <p className="text-teal-100 text-sm mt-0.5">Create roles and assign permissions</p>
            </div>
          </div>
          {canManage && (
            <Button variant="ghost" onClick={openAddModal} className="!bg-white !text-teal-700 hover:!bg-teal-50 border-0 shadow-md font-semibold">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Role
            </Button>
          )}
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {roles.map((role) => (
          <Card key={role.id} className="relative flex flex-col">
            <div className="p-5 flex flex-col flex-1">
              {/* Header: Avatar + Name + System Badge */}
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm flex-shrink-0"
                  style={{ backgroundColor: role.color || '#6B7280' }}
                >
                  {role.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 truncate">{role.name}</h3>
                    {role.isSystem && (
                      <Badge variant="info" className="flex-shrink-0 text-[10px]">System</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-500 mt-1 mb-4 min-h-[2rem] line-clamp-2">
                {role.description || 'No description provided'}
              </p>

              {/* Stats Row */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium text-slate-600">{role._count.employees}</span> employee{role._count.employees !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  <span className="font-medium text-slate-600">{role.permissions.length}</span> permission{role.permissions.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Permission tags preview */}
              <div className="flex flex-wrap gap-1.5 mb-5 flex-1">
                {role.permissions.slice(0, 4).map(rp => (
                  <span key={rp.id} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${SCOPE_COLORS[rp.scope]}`}>
                    {rp.permission.label}
                  </span>
                ))}
                {role.permissions.length > 4 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                    +{role.permissions.length - 4} more
                  </span>
                )}
                {role.permissions.length === 0 && (
                  <span className="text-xs text-slate-400 italic">No permissions assigned</span>
                )}
              </div>

              {/* Actions - pinned to bottom */}
              {canManage && (
                <div className="flex gap-2 pt-3 border-t border-slate-100 mt-auto">
                  <Button variant="outline" size="sm" onClick={() => openEditModal(role)}>
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </Button>
                  {!role.isSystem && (
                    <Button variant="danger" size="sm" onClick={() => handleDelete(role.id)}>
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
        {roles.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-500">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <p className="font-medium text-slate-700">No roles created yet</p>
            <p className="text-sm mt-1 text-slate-400">Create your first role to get started</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingRole ? 'Edit Role' : 'Create New Role'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Role Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Role Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. HR Manager"
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  <span className="text-sm text-slate-500">{formData.color}</span>
                </div>
              </div>
            </div>
            <Input
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this role"
            />

            {/* Permissions */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Assign Permissions
              </h3>

              {/* Scope Legend */}
              <div className="flex flex-wrap gap-3 mb-4 p-3 bg-slate-50 rounded-lg text-xs">
                <span className={`px-2 py-0.5 rounded-full border ${SCOPE_COLORS.ALL}`}>ALL = All employees</span>
                <span className={`px-2 py-0.5 rounded-full border ${SCOPE_COLORS.DEPARTMENT}`}>DEPT = Own department only</span>
                <span className={`px-2 py-0.5 rounded-full border ${SCOPE_COLORS.SELF}`}>SELF = Own data only</span>
              </div>

              <div className="space-y-3">
                {Object.entries(groupedPermissions).map(([moduleName, modulePerms]) => {
                  const allSelected = modulePerms.every(p => selectedPerms.has(p.id));
                  const someSelected = modulePerms.some(p => selectedPerms.has(p.id));

                  return (
                    <div key={moduleName} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div
                        className="flex items-center justify-between px-4 py-2.5 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => toggleModuleAll(moduleName)}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => toggleModuleAll(moduleName)}
                            className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                            ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          />
                          <span className="text-sm font-medium text-slate-700 capitalize">
                            {modules[moduleName] || moduleName}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {modulePerms.filter(p => selectedPerms.has(p.id)).length}/{modulePerms.length}
                        </span>
                      </div>
                      <div className="px-4 py-2 space-y-1.5">
                        {modulePerms.map(perm => (
                          <div key={perm.id} className="flex items-center gap-3 py-1">
                            <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={selectedPerms.has(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                                className="flex-shrink-0 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                              />
                              <span className="text-sm text-slate-600 truncate">{perm.label}</span>
                            </label>
                            {selectedPerms.has(perm.id) && (
                              <div className="flex gap-1 flex-shrink-0">
                                {(['ALL', 'DEPARTMENT', 'SELF'] as const).map(scope => (
                                  <button
                                    key={scope}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setPermScope(perm.id, scope); }}
                                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                      selectedPerms.get(perm.id) === scope
                                        ? SCOPE_COLORS[scope]
                                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    {scope === 'DEPARTMENT' ? 'DEPT' : scope}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={() => confirmDialog.onConfirm()} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} />
    </div>
  );
}
