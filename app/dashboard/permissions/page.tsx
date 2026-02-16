'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

interface Permission {
  id: string;
  module: string;
  action: string;
  label: string;
  description?: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  department?: { id: string; name: string };
  appRole?: { id: string; name: string; color: string } | null;
  appRoleId?: string | null;
}

interface AppRole {
  id: string;
  name: string;
  color: string;
  permissions: {
    id: string;
    permissionId: string;
    scope: 'ALL' | 'DEPARTMENT' | 'SELF';
    permission: Permission;
  }[];
}

interface EmployeePermData {
  roleId: string | null;
  roleName: string | null;
  rolePermissions: {
    id: string;
    module: string;
    action: string;
    label: string;
    scope: string;
    source: 'role';
  }[];
  individualPermissions: {
    id: string;
    module: string;
    action: string;
    label: string;
    scope: string;
    granted: boolean;
    source: 'individual';
  }[];
}

export default function PermissionsPage() {
  const { allowed, loading: permLoading } = useRequirePermission('roles', 'manage');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Permissions" />;
  return <PermissionsPageContent />;
}

function PermissionsPageContent() {
  const { token, hasPermission } = useAuth();
  const toast = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [modules, setModules] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [empPermissions, setEmpPermissions] = useState<EmployeePermData | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

  // Track employee's role assignment
  const [assignedRoleId, setAssignedRoleId] = useState<string>('');
  // Track individual permission overrides
  const [individualPerms, setIndividualPerms] = useState<Map<string, { scope: 'ALL' | 'DEPARTMENT' | 'SELF'; granted: boolean }>>(new Map());

  const canManage = hasPermission('roles', 'manage');

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.data || []);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [token]);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/permissions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllPermissions(data.data || []);
        setModules(data.modules || {});
      }
    } catch { /* silent */ }
  }, [token]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRoles(data.data || []);
      }
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchEmployees();
      fetchPermissions();
      fetchRoles();
    }
  }, [token, fetchEmployees, fetchPermissions, fetchRoles]);

  const selectEmployee = async (emp: Employee) => {
    setSelectedEmployee(emp);
    try {
      const res = await fetch(`/api/employees/${emp.id}/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmpPermissions(data.data);
        setAssignedRoleId(data.data.roleId || '');
        // Load individual permissions
        const indPerms = new Map<string, { scope: 'ALL' | 'DEPARTMENT' | 'SELF'; granted: boolean }>();
        data.data.individualPermissions.forEach((ip: { id: string; scope: string; granted: boolean }) => {
          indPerms.set(ip.id, { scope: ip.scope as 'ALL' | 'DEPARTMENT' | 'SELF', granted: ip.granted });
        });
        setIndividualPerms(indPerms);
      }
    } catch {
      toast.error('Failed to load employee permissions');
    }
  };

  const handleSave = async () => {
    if (!selectedEmployee || !canManage) return;
    setSaving(true);

    const permArray = Array.from(individualPerms.entries()).map(([permId, val]) => ({
      permissionId: permId,
      scope: val.scope,
      granted: val.granted,
    }));

    try {
      const res = await fetch(`/api/employees/${selectedEmployee.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          appRoleId: assignedRoleId || null,
          permissions: permArray,
        }),
      });

      if (res.ok) {
        toast.success('Permissions saved successfully!');
        // Refresh employee list
        fetchEmployees();
        selectEmployee(selectedEmployee);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const toggleIndividualPerm = (permId: string) => {
    const newPerms = new Map(individualPerms);
    const fromRole = rolePermIds.has(permId);
    const existing = newPerms.get(permId);
    
    if (existing) {
      if (fromRole && existing.granted) {
        // Currently granted override on a role perm → switch to deny override
        newPerms.set(permId, { scope: existing.scope, granted: false });
      } else {
        // Remove the individual override entirely
        newPerms.delete(permId);
      }
    } else {
      if (fromRole) {
        // Permission comes from role, create a deny override to revoke it
        newPerms.set(permId, { scope: 'ALL', granted: false });
      } else {
        // No role perm, create a grant override
        newPerms.set(permId, { scope: 'ALL', granted: true });
      }
    }
    setIndividualPerms(newPerms);
  };

  const setIndPermScope = (permId: string, scope: 'ALL' | 'DEPARTMENT' | 'SELF') => {
    const newPerms = new Map(individualPerms);
    const existing = newPerms.get(permId);
    if (existing) {
      newPerms.set(permId, { ...existing, scope });
    }
    setIndividualPerms(newPerms);
  };

  // Get currently assigned role's permissions
  const currentRolePerms = roles.find(r => r.id === assignedRoleId)?.permissions || [];
  const rolePermIds = new Set(currentRolePerms.map(rp => rp.permission.id));

  // Group permissions by module
  const groupedPermissions = allPermissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {});

  const SCOPE_COLORS = {
    ALL: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    DEPARTMENT: 'bg-blue-100 text-blue-700 border-blue-300',
    SELF: 'bg-amber-100 text-amber-700 border-amber-300',
  };

  const filteredEmployees = employees.filter(emp => {
    const matchSearch = !searchTerm || 
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = !filterDepartment || emp.department?.id === filterDepartment;
    return matchSearch && matchDept;
  });

  const departments = [...new Map(employees.filter(e => e.department).map(e => [e.department!.id, e.department!])).values()];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="skeleton w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <div className="skeleton h-6 w-56 rounded-lg" />
            <div className="skeleton h-4 w-40 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="skeleton h-9 w-full rounded-lg" />
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="skeleton w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-4 w-32 rounded-lg" />
                  <div className="skeleton h-3 w-20 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="skeleton h-6 w-40 rounded-lg" />
            <div className="space-y-3">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-4 w-4 rounded" />
                  <div className="skeleton h-4 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
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
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Permissions Management</h1>
            <p className="text-teal-100 text-sm mt-0.5">Assign roles and individual permissions to employees</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="lg:col-span-1">
          <Card>
            <div className="p-4 border-b border-slate-200">
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {departments.length > 0 && (
                <select
                  className="mt-2 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 hover:border-slate-300 transition-all duration-200 appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', backgroundRepeat: 'no-repeat', paddingRight: '2.5rem' }}
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                >
                  <option value="">All Departments</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {filteredEmployees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => selectEmployee(emp)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    selectedEmployee?.id === emp.id ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {emp.firstName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {emp.department?.name || 'No Department'} • {emp.employeeCode}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              {filteredEmployees.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">No employees found</div>
              )}
            </div>
          </Card>
        </div>

        {/* Permission Editor */}
        <div className="lg:col-span-2">
          {selectedEmployee ? (
            <Card>
              <div className="p-5 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {selectedEmployee.department?.name || 'No Department'} • {selectedEmployee.email}
                    </p>
                  </div>
                  {canManage && (
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Permissions'}
                    </Button>
                  )}
                </div>

                {/* Role Assignment */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Role</label>
                  <select
                    className="w-full sm:w-64 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 hover:border-slate-300 transition-all duration-200 appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', backgroundRepeat: 'no-repeat', paddingRight: '2.5rem' }}
                    value={assignedRoleId}
                    onChange={(e) => setAssignedRoleId(e.target.value)}
                    disabled={!canManage}
                  >
                    <option value="">No Role</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  {assignedRoleId && (
                    <p className="text-xs text-slate-500 mt-1">
                      Role provides {currentRolePerms.length} permission{currentRolePerms.length !== 1 ? 's' : ''}. Individual overrides below.
                    </p>
                  )}
                </div>
              </div>

              {/* Scope Legend */}
              <div className="px-5 pt-4">
                <div className="flex flex-wrap gap-3 mb-4 p-3 bg-slate-50 rounded-lg text-xs">
                  <span className={`px-2 py-0.5 rounded-full border ${SCOPE_COLORS.ALL}`}>ALL = All employees</span>
                  <span className={`px-2 py-0.5 rounded-full border ${SCOPE_COLORS.DEPARTMENT}`}>DEPT = Own department only</span>
                  <span className={`px-2 py-0.5 rounded-full border ${SCOPE_COLORS.SELF}`}>SELF = Own data only</span>
                </div>
              </div>

              {/* Permissions Grid */}
              <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
                {Object.entries(groupedPermissions).map(([moduleName, modulePerms]) => (
                  <div key={moduleName} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50">
                      <span className="text-sm font-medium text-slate-700 capitalize">
                        {modules[moduleName] || moduleName}
                      </span>
                    </div>
                    <div className="px-4 py-2 space-y-1.5">
                      {modulePerms.map(perm => {
                        const fromRole = rolePermIds.has(perm.id);
                        const hasIndividual = individualPerms.has(perm.id);
                        const indPerm = individualPerms.get(perm.id);
                        const rolePerm = currentRolePerms.find(rp => rp.permission.id === perm.id);
                        
                        // Determine effective checked state
                        const isGranted = hasIndividual 
                          ? indPerm!.granted 
                          : fromRole;
                        
                        // Determine if denied via override  
                        const isDenied = hasIndividual && !indPerm!.granted && fromRole;

                        return (
                          <div key={perm.id} className={`flex items-center gap-3 py-1.5 ${isDenied ? 'opacity-60' : ''}`}>
                            <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={isGranted}
                                onChange={() => toggleIndividualPerm(perm.id)}
                                className="flex-shrink-0 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                disabled={!canManage}
                              />
                              <span className={`text-sm truncate ${isDenied ? 'line-through text-slate-400' : 'text-slate-600'}`}>{perm.label}</span>
                              {fromRole && !hasIndividual && (
                                <Badge variant="info" className="text-[10px] flex-shrink-0">from role</Badge>
                              )}
                              {hasIndividual && indPerm?.granted && (
                                <Badge variant="warning" className="text-[10px] flex-shrink-0">override</Badge>
                              )}
                              {isDenied && (
                                <Badge variant="danger" className="text-[10px] flex-shrink-0">denied</Badge>
                              )}
                            </label>
                            {isGranted && (
                              <div className="flex gap-1 flex-shrink-0">
                                {(['ALL', 'DEPARTMENT', 'SELF'] as const).map(scope => {
                                  const currentScope = hasIndividual ? indPerm?.scope : rolePerm?.scope;
                                  return (
                                    <button
                                      key={scope}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        if (!canManage) return;
                                        if (!hasIndividual) {
                                          // Create individual override
                                          const newPerms = new Map(individualPerms);
                                          newPerms.set(perm.id, { scope, granted: true });
                                          setIndividualPerms(newPerms);
                                        } else {
                                          setIndPermScope(perm.id, scope);
                                        }
                                      }}
                                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                        currentScope === scope
                                          ? SCOPE_COLORS[scope]
                                          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                      }`}
                                    >
                                      {scope === 'DEPARTMENT' ? 'DEPT' : scope}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-12 text-center text-slate-400">
                <svg className="w-16 h-16 mx-auto mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
                <p className="font-medium text-slate-500">Select an employee</p>
                <p className="text-sm mt-1">Choose an employee from the list to manage their permissions</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
