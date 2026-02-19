'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

interface Employee {
  id: string;
  employeeCode?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profileImage?: string;
  designation?: string;
  employmentStatus?: string;
  employmentType?: string;
  joiningDate?: string;
  attendanceStartDate?: string;
  confirmationDate?: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  nic?: string;
  probationMonths?: number;
  noticePeriodMonths?: number;
  emergencyContacts?: { id?: string; name: string; phone: string; relationship: string }[];
  department?: { id: string; name: string };
  shift?: { id: string; name: string };
  user?: { role: string; isActive: boolean };
  salary?: {
    basicSalary: number;
    grossSalary: number;
    netSalary: number;
    hra?: number;
    da?: number;
    ta?: number;
    medicalAllowance?: number;
    otherAllowances?: number;
    pfEnabled?: boolean;
    pf?: number;
    professionalTax?: number;
    tds?: number;
    bankName?: string;
    bankAccountNumber?: string;
    ifscCode?: string;
    panNumber?: string;
  };
  bankName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  panNumber?: string;
  branchAddress?: string;
}

interface Department {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  name: string;
  startTime?: string;
  endTime?: string;
}

interface AppRole {
  id: string;
  name: string;
  color: string;
  _count?: { employees: number };
}

export default function EmployeesPage() {
  const { allowed, loading: permLoading } = useRequirePermission('employees', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Employees" />;
  return <EmployeesPageContent />;
}

function EmployeesPageContent() {
  const { token, user: currentUser, hasPermission } = useAuth();
  const toast = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [appRoles, setAppRoles] = useState<AppRole[]>([]);
  const [taxSlabs, setTaxSlabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('basic');
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [newEmployeeCredentials, setNewEmployeeCredentials] = useState<{
    employeeCode: string;
    email: string;
    password: string;
  } | null>(null);
  const [showViewCredentialsModal, setShowViewCredentialsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN';
  const isHR = currentUser?.role === 'HR';
  const canManage = hasPermission('employees', 'manage') || hasPermission('employees', 'create');

  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Documents for add/edit modal
  const [docFields, setDocFields] = useState<any[]>([]);
  const [pendingDocs, setPendingDocs] = useState<Record<string, File>>({});
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [modalEmergencyContacts, setModalEmergencyContacts] = useState<{ id?: string; name: string; phone: string; relationship: string }[]>([]);

  const [formData, setFormData] = useState({
    // Basic Info
    profileImage: '',
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    nationality: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
    nic: '',
    // Employment Details
    joiningDate: '',
    attendanceStartDate: '',
    departmentId: '',
    designation: '',
    shiftId: '',
    employmentType: 'PERMANENT',
    employmentStatus: 'ACTIVE',
    probationMonths: '',
    noticePeriodMonths: '',
    confirmationDate: '',
    appRoleId: '',
    systemRole: 'EMPLOYEE',
    // Salary Details
    basicSalary: '',
    hra: '',
    da: '',
    ta: '',
    medicalAllowance: '',
    otherAllowances: '',
    pfEnabled: false,
    pf: '',
    professionalTax: '',
    tds: '',
    // Bank Details
    bankName: '',
    bankAccountNumber: '',
    ifscCode: '',
    panNumber: '',
    branchAddress: '',
  });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const fetchEmployees = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (searchTerm) params.append('search', searchTerm);
      if (filterDepartment) params.append('departmentId', filterDepartment);

      const res = await fetch(`/api/employees?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.data || []);
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  }, [token, searchTerm, filterDepartment]);

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
    }
  }, [token]);

  const fetchShifts = useCallback(async () => {
    try {
      const res = await fetch('/api/shifts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setShifts(data.data || []);
      }
    } catch (error) {
      // Silent error handling
    }
  }, [token]);

  const fetchAppRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAppRoles(data.data || []);
      }
    } catch (error) {
      // Silent error handling
    }
  }, [token]);

  const fetchTaxSlabs = useCallback(async () => {
    try {
      const res = await fetch('/api/tax-slabs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTaxSlabs(data.data || []);
      }
    } catch (error) {
      // Silent error handling
    }
  }, [token]);

  const fetchDocFields = useCallback(async () => {
    try {
      const res = await fetch('/api/document-fields', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocFields((data.data || []).filter((f: any) => f.isActive));
      }
    } catch { /* silent */ }
  }, [token]);

  // Calculate tax based on Pakistan tax slabs
  const calculateTax = (monthlyIncome: number): number => {
    if (!taxSlabs || taxSlabs.length === 0) return 0;
    
    // Convert monthly income to annual
    const annualIncome = monthlyIncome * 12;
    let remainingIncome = annualIncome;
    let totalAnnualTax = 0;

    for (const slab of taxSlabs) {
      if (remainingIncome <= 0) break;
      
      const slabMax = slab.maxIncome || Infinity;
      const slabRange = slabMax - slab.minIncome;
      const taxableInThisSlab = Math.min(remainingIncome, slabRange);
      
      totalAnnualTax += taxableInThisSlab * (slab.taxRate / 100);
      remainingIncome -= taxableInThisSlab;
    }

    // Convert annual tax back to monthly
    const monthlyTax = totalAnnualTax / 12;
    return Math.round(monthlyTax * 100) / 100;
  };

  // Auto-calculate TDS when salary components change
  useEffect(() => {
    const grossSalary = (parseFloat(formData.basicSalary) || 0) + 
                        (parseFloat(formData.hra) || 0) + 
                        (parseFloat(formData.da) || 0) + 
                        (parseFloat(formData.ta) || 0) + 
                        (parseFloat(formData.medicalAllowance) || 0) + 
                        (parseFloat(formData.otherAllowances) || 0);
    
    if (grossSalary > 0 && taxSlabs.length > 0) {
      const calculatedTds = calculateTax(grossSalary);
      // Always update TDS to ensure it's recalculated with current tax slabs
      if (Math.abs(parseFloat(formData.tds || '0') - calculatedTds) > 0.01) {
        setFormData(prev => ({ ...prev, tds: calculatedTds.toString() }));
      }
    }
  }, [
    formData.basicSalary,
    formData.hra,
    formData.da,
    formData.ta,
    formData.medicalAllowance,
    formData.otherAllowances,
    taxSlabs
  ]);

  useEffect(() => {
    if (token) {
      fetchEmployees();
      fetchDepartments();
      fetchShifts();
      fetchAppRoles();
      fetchTaxSlabs();
      fetchDocFields();
    }
  }, [token, fetchEmployees, fetchDepartments, fetchShifts, fetchAppRoles, fetchTaxSlabs]);

  const uploadPendingDocs = async (employeeId: string) => {
    for (const [fieldId, file] of Object.entries(pendingDocs)) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'documents');
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!uploadRes.ok) continue;
        const uploadData = await uploadRes.json();
        await fetch('/api/employees/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            employeeId,
            documentFieldId: fieldId,
            title: file.name,
            filePath: uploadData.url || uploadData.data?.url || uploadData.filePath,
            fileSize: file.size,
            fileType: file.name.split('.').pop()?.toUpperCase() || 'OTHER',
            documentType: 'OTHER',
          }),
        });
      } catch { /* best effort */ }
    }
    setPendingDocs({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    // Client-side validation
    const errors: string[] = [];

    // Basic Info - Required Fields
    if (!formData.firstName.trim()) {
      errors.push('First name is required');
    }
    if (!formData.lastName.trim()) {
      errors.push('Last name is required');
    }
    if (!formData.email.trim()) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.push('Invalid email format');
    }
    if (!editingEmployee && !formData.password.trim()) {
      errors.push('Password is required');
    } else if (!editingEmployee && formData.password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    // Employment Details - Required Fields
    if (!formData.departmentId) {
      errors.push('Department is required');
    }
    if (!formData.joiningDate) {
      errors.push('Joining date is required');
    }

    if (errors.length > 0) {
      setError(errors.join(', '));
      setSubmitting(false);
      return;
    }

    try {
      const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : '/api/employees';
      const method = editingEmployee ? 'PUT' : 'POST';

      // Prepare data - remove employeeCode, let backend auto-generate.
      const { employeeCode: _, systemRole, ...submitData } = { ...formData, role: formData.systemRole || 'EMPLOYEE' };

      // Remove password if editing and not changed
      if (editingEmployee && !formData.password) {
        delete (submitData as Record<string, unknown>).password;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...submitData, emergencyContacts: modalEmergencyContacts }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save employee');
      }

      // Show credentials modal for new employees
      if (!editingEmployee && data.data?.employeeCode) {
        // Upload pending documents for the new employee
        const newEmployeeId = data.data.id;
        if (newEmployeeId && Object.keys(pendingDocs).length > 0) {
          await uploadPendingDocs(newEmployeeId);
        }
        setNewEmployeeCredentials({
          employeeCode: data.data.employeeCode,
          email: formData.email,
          password: formData.password,
        });
        setShowCredentialsModal(true);
        setSuccess(`Employee added successfully! Employee Code: ${data.data.employeeCode}`);
      } else if (editingEmployee) {
        // Upload pending documents for existing employee
        if (Object.keys(pendingDocs).length > 0) {
          await uploadPendingDocs(editingEmployee.id);
        }
        setSuccess('Employee updated successfully!');
      }

      setShowModal(false);
      setEditingEmployee(null);
      resetForm();
      fetchEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setImagePreview(employee.profileImage || null);
    setFormData({
      // Basic Info
      profileImage: employee.profileImage || '',
      employeeCode: employee.employeeCode || '',
      firstName: employee.firstName || '',
      lastName: employee.lastName || '',
      email: employee.email || '',
      password: '',
      phone: employee.phone || '',
      dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.split('T')[0] : '',
      gender: employee.gender || '',
      maritalStatus: employee.maritalStatus || '',
      nationality: employee.nationality || '',
      address: employee.address || '',
      city: employee.city || '',
      state: employee.state || '',
      country: employee.country || '',
      zipCode: employee.zipCode || '',
      nic: employee.nic || '',
      // Employment Details
      joiningDate: employee.joiningDate ? employee.joiningDate.split('T')[0] : '',
      attendanceStartDate: employee.attendanceStartDate ? employee.attendanceStartDate.split('T')[0] : '',
      departmentId: employee.department?.id || '',
      designation: employee.designation || '',
      shiftId: employee.shift?.id || '',
      employmentType: employee.employmentType || 'PERMANENT',
      employmentStatus: employee.employmentStatus || 'ACTIVE',
      probationMonths: employee.probationMonths?.toString() || '',
      noticePeriodMonths: employee.noticePeriodMonths?.toString() || '',
      confirmationDate: employee.confirmationDate ? employee.confirmationDate.split('T')[0] : '',
      appRoleId: (employee as any).appRoleId || '',
      systemRole: employee.user?.role || 'EMPLOYEE',
      // Salary Details
      basicSalary: employee.salary?.basicSalary?.toString() || '',
      hra: employee.salary?.hra?.toString() || '',
      da: employee.salary?.da?.toString() || '',
      ta: employee.salary?.ta?.toString() || '',
      medicalAllowance: employee.salary?.medicalAllowance?.toString() || '',
      otherAllowances: employee.salary?.otherAllowances?.toString() || '',
      pfEnabled: employee.salary?.pfEnabled || false,
      pf: employee.salary?.pf?.toString() || '',
      professionalTax: employee.salary?.professionalTax?.toString() || '',
      tds: employee.salary?.tds?.toString() || '',
      // Bank Details
      bankName: employee.bankName || '',
      bankAccountNumber: employee.bankAccountNumber || '',
      ifscCode: employee.ifscCode || '',
      panNumber: employee.panNumber || '',
      branchAddress: employee.branchAddress || '',
    });
    setModalEmergencyContacts(employee.emergencyContacts || []);
    setActiveTab('basic');
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    openConfirm({ title: 'Delete Employee', message: 'Are you sure you want to delete this employee?', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/employees/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          fetchEmployees();
          toast.success('Employee deleted successfully!');
        } else {
          const data = await res.json();
          toast.error(data.error || 'Failed to delete employee');
        }
      } catch (error) {
        toast.error('Failed to delete employee');
      }
    }});
  };

  const handleViewCredentials = (employee: Employee) => {
    setSelectedEmployee(employee);
    setResetPassword('');
    setShowViewCredentialsModal(true);
  };

  const handleResetPasswordSubmit = async () => {
    if (!selectedEmployee) return;
    if (!resetPassword || resetPassword.length < 6) {
      toast.warning('Password must be at least 6 characters');
      return;
    }

    setResettingPassword(true);
    try {
      const res = await fetch(`/api/employees/${selectedEmployee.id}/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword: resetPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Password reset successfully! New password: ' + data.data.newPassword);
        setResetPassword('');
      } else {
        toast.error(data.error || 'Failed to reset password');
      }
    } catch (error) {
      toast.error('Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const resetForm = () => {
    setImagePreview(null);
    setFormData({
      profileImage: '',
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      dateOfBirth: '',
      gender: '',
      maritalStatus: '',
      nationality: '',
      address: '',
      city: '',
      state: '',
      country: '',
      zipCode: '',
      nic: '',
      joiningDate: '',
      attendanceStartDate: '',
      departmentId: '',
      designation: '',
      shiftId: '',
      employmentType: 'PERMANENT',
      employmentStatus: 'ACTIVE',
      probationMonths: '',
      noticePeriodMonths: '',
      confirmationDate: '',
      appRoleId: '',
      systemRole: 'EMPLOYEE',
      basicSalary: '',
      hra: '',
      da: '',
      ta: '',
      medicalAllowance: '',
      otherAllowances: '',
      pfEnabled: false,
      pf: '',
      professionalTax: '',
      tds: '',
      bankName: '',
      bankAccountNumber: '',
      ifscCode: '',
      panNumber: '',
      branchAddress: '',
    });
    setActiveTab('basic');
    setError('');
    setSuccess('');
    setPendingDocs({});
    setModalEmergencyContacts([]);
  };

  const openAddModal = () => {
    resetForm();
    setEditingEmployee(null);
    setShowModal(true);
  };

  // Handle profile image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPEG, PNG, GIF, WEBP)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setUploadingImage(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('type', 'profile');

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: uploadFormData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload image');
      }

      const data = await res.json();
      setFormData(prev => ({ ...prev, profileImage: data.data.url }));
      setImagePreview(data.data.url);
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, profileImage: '' }));
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calculate gross and net salary
  const grossSalary = (parseFloat(formData.basicSalary) || 0) + 
                      (parseFloat(formData.hra) || 0) + 
                      (parseFloat(formData.da) || 0) + 
                      (parseFloat(formData.ta) || 0) + 
                      (parseFloat(formData.medicalAllowance) || 0) + 
                      (parseFloat(formData.otherAllowances) || 0);
  
  // Auto-calculate PF if enabled (default 12% of basic salary)
  const pfAmount = formData.pfEnabled ? (parseFloat(formData.basicSalary) || 0) * 0.12 : 0;
  
  const totalDeductions = pfAmount + 
                          (parseFloat(formData.professionalTax) || 0) + 
                          (parseFloat(formData.tds) || 0);
  
  const netSalary = grossSalary - totalDeductions;

  const getEmploymentTypeBadge = (type: string) => {
    const colors: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'default'> = {
      PERMANENT: 'success',
      CONTRACT: 'warning',
      TEMPORARY: 'info',
      INTERN: 'default',
      PART_TIME: 'info',
      REMOTE: 'success',
      FREELANCER: 'warning',
      CONSULTANT: 'info',
    };
    const labels: Record<string, string> = {
      PERMANENT: 'Permanent', CONTRACT: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Intern',
      PART_TIME: 'Part-Time', REMOTE: 'Remote', FREELANCER: 'Freelancer', CONSULTANT: 'Consultant',
    };
    return <Badge variant={colors[type] || 'default'}>{labels[type] || type.replace(/_/g, ' ')}</Badge>;
  };

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (emp: Employee) => (
        <span className="text-sm font-mono font-semibold text-emerald-600">{emp.employeeCode || '-'}</span>
      ),
    },
    {
      key: 'name',
      header: 'Employee',
      render: (emp: Employee) => (
        <div className="flex items-center gap-3">
          {emp.profileImage ? (
            <img
              src={emp.profileImage}
              alt={`${emp.firstName} ${emp.lastName}`}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
              {emp.firstName[0]}{emp.lastName[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate text-sm">{emp.firstName} {emp.lastName}</p>
            <p className="text-xs text-slate-500 truncate">{emp.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (emp: Employee) => emp.department?.name || '-',
    },
    {
      key: 'designation',
      header: 'Designation',
      render: (emp: Employee) => emp.designation || '-',
    },
    {
      key: 'type',
      header: 'Type',
      render: (emp: Employee) => getEmploymentTypeBadge(emp.employmentType || 'PERMANENT'),
    },
    {
      key: 'role',
      header: 'Role',
      render: (emp: Employee) => {
        const roleName = (emp as any).appRole?.name;
        if (emp.user?.role === 'ADMIN') {
          return <Badge variant="danger">Admin</Badge>;
        }
        return <Badge variant="default">{roleName || 'No Role'}</Badge>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (emp: Employee) => {
        const status = emp.employmentStatus || 'ACTIVE';
        const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
          ACTIVE: 'success', INACTIVE: 'default', ON_LEAVE: 'warning', PROBATION: 'info',
          SUSPENDED: 'danger', RESIGNED: 'warning', TERMINATED: 'danger',
          ON_NOTICE: 'warning', RETIRED: 'default', ABSCONDED: 'danger',
        };
        const statusLabels: Record<string, string> = {
          ACTIVE: 'Active', INACTIVE: 'Inactive', ON_LEAVE: 'On Leave', PROBATION: 'Probation',
          SUSPENDED: 'Suspended', RESIGNED: 'Resigned', TERMINATED: 'Terminated',
          ON_NOTICE: 'On Notice', RETIRED: 'Retired', ABSCONDED: 'Absconded',
        };
        return (
          <Badge variant={statusColors[status] || 'default'}>
            {statusLabels[status] || status.replace(/_/g, ' ')}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (emp: Employee) => (
        <div className="flex items-center gap-1.5">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => window.location.href = `/dashboard/employees/${emp.employeeCode || emp.id}`}
            title="View Profile"
            className="text-emerald-600 hover:bg-emerald-50 p-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Button>
          {canManage && (
            <>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => handleEdit(emp)}
                title="Edit Employee"
                className="text-emerald-600 hover:bg-emerald-50 p-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => handleViewCredentials(emp)}
                title="View Login Credentials"
                className="text-purple-600 hover:bg-purple-50 p-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </Button>
              {isAdmin && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => handleDelete(emp.id)}
                  title="Delete Employee"
                  className="text-red-600 hover:bg-red-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  const tabs = [
    { id: 'basic', name: 'Information', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )},
    { id: 'employment', name: 'Employment', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M3 8a2 2 0 012-2h14a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    )},
    { id: 'salary', name: 'Salary', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { id: 'emergency', name: 'Emergency', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )},
    { id: 'bank', name: 'Bank Details', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    )},
    { id: 'documents', name: 'Documents', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )},
  ];

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl skeleton" />
              <div className="space-y-2">
                <div className="h-6 w-32 skeleton rounded" />
                <div className="h-4 w-48 skeleton rounded" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton-row" />)}
          </div>
        </div>
      )}

      {!loading && <>
      {/* Success Message */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-emerald-800">{success}</p>
              <p className="text-sm text-emerald-600">The employee can now login with their email and password.</p>
            </div>
          </div>
          <button
            onClick={() => setSuccess('')}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Employees</h1>
              <p className="text-teal-100 text-sm mt-0.5">Manage your workforce · {employees.length} total</p>
            </div>
          </div>
          {canManage && (
            <Button variant="ghost" onClick={openAddModal} className="!bg-white !text-teal-700 hover:!bg-teal-50 border-0 shadow-md font-semibold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Active</p>
              <p className="text-2xl font-bold text-emerald-900">{employees.filter(e => e.employmentStatus === 'ACTIVE').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 border border-blue-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Departments</p>
              <p className="text-2xl font-bold text-blue-900">{departments.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 border border-amber-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Contract</p>
              <p className="text-2xl font-bold text-amber-900">{employees.filter(e => e.employmentType === 'CONTRACT').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-xl border border-rose-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-100 border border-rose-200 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-xs font-medium text-rose-600 uppercase tracking-wide">Probation</p>
              <p className="text-2xl font-bold text-rose-900">{employees.filter(e => e.employmentStatus === 'PROBATION').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <Card padding={false}>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Search by name, email, or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            <Select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              options={[
                { value: '', label: 'All Departments' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
              className="w-full sm:w-48"
            />
            <Button onClick={fetchEmployees} variant="secondary">
              Search
            </Button>
          </div>
        </CardHeader>
        <Table columns={columns} data={employees} loading={loading} emptyMessage="No employees found" />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingEmployee(null); resetForm(); }}
        title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}
        size="xl"
      >
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mx-4 sm:mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-red-800">Validation Error</h4>
                  <p className="mt-1 text-sm text-red-600 break-words">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError('')}
                  className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-slate-200 px-6 pt-4">
            <div className="flex gap-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium whitespace-nowrap transition-all rounded-t-lg ${
                    activeTab === tab.id
                      ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/50'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className={activeTab === tab.id ? 'text-emerald-600' : 'text-slate-400'}>{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                {/* Profile Image Upload */}
                <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="relative">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Profile Preview"
                        className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg">
                        {formData.firstName?.[0]?.toUpperCase() || formData.lastName?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                        title="Remove Image"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 mb-1">Profile Photo</p>
                    <p className="text-xs text-slate-500 mb-3">Upload a profile picture (JPEG, PNG, GIF, WEBP - Max 5MB)</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="profile-upload"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? (
                        <>
                          <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Upload Photo
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Show Employee Code when editing */}
                {editingEmployee && editingEmployee.employeeCode && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600 font-medium">Employee Code</p>
                      <p className="text-lg font-bold text-emerald-800">{editingEmployee.employeeCode}</p>
                    </div>
                  </div>
                )}

                {/* Info for new employee */}
                {!editingEmployee && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                    <span className="font-medium">💡 Note:</span> Employee Code will be auto-generated (e.g., BMD-1, BMD-2) when you save.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="First Name *"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                  <Input
                    label="Last Name *"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Email *"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                  <Input
                    label={editingEmployee ? 'Password (leave blank to keep)' : 'Password *'}
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingEmployee}
                    placeholder={editingEmployee ? '••••••••' : 'Enter password'}
                    rightIcon={
                      showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )
                    }
                    onRightIconClick={() => setShowPassword(!showPassword)}
                  />
                </div>

                <Input
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 XXXXXXXXXX"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Date of Birth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                  <Select
                    label="Gender"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    options={[
                      { value: '', label: 'Select Gender' },
                      { value: 'MALE', label: 'Male' },
                      { value: 'FEMALE', label: 'Female' },
                      { value: 'OTHER', label: 'Other' },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Marital Status"
                    value={formData.maritalStatus}
                    onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                    options={[
                      { value: '', label: 'Select Marital Status' },
                      { value: 'SINGLE', label: 'Single' },
                      { value: 'MARRIED', label: 'Married' },
                      { value: 'DIVORCED', label: 'Divorced' },
                      { value: 'WIDOWED', label: 'Widowed' },
                    ]}
                  />
                  <Input
                    label="NIC / CNIC"
                    value={formData.nic}
                    onChange={(e) => setFormData({ ...formData, nic: e.target.value })}
                    placeholder="XXXXX-XXXXXXX-X"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Nationality"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    placeholder="e.g., Pakistani"
                  />
                  <Input
                    label="City"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <Input
                  label="Address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="State / Province"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                  <Input
                    label="Country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>

                <Input
                  label="Zip / Postal Code"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                />

              </div>
            )}

            {/* Employment Tab */}
            {activeTab === 'employment' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Department *"
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    options={[
                      { value: '', label: 'Select Department' },
                      ...departments.map((d) => ({ value: d.id, label: d.name })),
                    ]}
                    required
                  />
                  <Input
                    label="Designation"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g., Manager, Developer, HR Officer"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {isAdmin && (
                    <Select
                      label="System Role"
                      value={formData.systemRole}
                      onChange={(e) => setFormData({ ...formData, systemRole: e.target.value })}
                      options={[
                        { value: 'EMPLOYEE', label: 'Employee' },
                        { value: 'ADMIN', label: 'Admin (Full Access)' },
                      ]}
                    />
                  )}
                  <Select
                    label="Role (Permissions)"
                    value={formData.appRoleId}
                    onChange={(e) => setFormData({ ...formData, appRoleId: e.target.value })}
                    options={[
                      { value: '', label: 'No Role' },
                      ...appRoles.map(r => ({ value: r.id, label: r.name })),
                    ]}
                  />
                  <Select
                    label="Shift"
                    value={formData.shiftId}
                    onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                    options={[
                      { value: '', label: 'Select Shift' },
                      ...shifts.map((shift) => ({
                        value: shift.id,
                        label: shift.startTime && shift.endTime ? `${shift.name} (${shift.startTime} - ${shift.endTime})` : shift.name,
                      })),
                    ]}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Joining Date *"
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                    required
                  />
                  <Input
                    label="Attendance Start Date"
                    type="date"
                    value={formData.attendanceStartDate}
                    onChange={(e) => setFormData({ ...formData, attendanceStartDate: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Employment Type *"
                    value={formData.employmentType}
                    onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                    options={[
                      { value: 'PERMANENT', label: 'Permanent' },
                      { value: 'CONTRACT', label: 'Contract' },
                      { value: 'TEMPORARY', label: 'Temporary' },
                      { value: 'INTERN', label: 'Intern' },
                      { value: 'PART_TIME', label: 'Part-Time' },
                      { value: 'REMOTE', label: 'Remote' },
                      { value: 'FREELANCER', label: 'Freelancer' },
                      { value: 'CONSULTANT', label: 'Consultant' },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Employment Status *"
                    value={formData.employmentStatus}
                    onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value })}
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'ON_LEAVE', label: 'On Leave' },
                      { value: 'PROBATION', label: 'Probation' },
                      { value: 'SUSPENDED', label: 'Suspended' },
                      { value: 'RESIGNED', label: 'Resigned' },
                      { value: 'TERMINATED', label: 'Terminated' },
                      { value: 'ON_NOTICE', label: 'On Notice Period' },
                      { value: 'RETIRED', label: 'Retired' },
                      { value: 'ABSCONDED', label: 'Absconded' },
                    ]}
                  />
                </div>

                {/* Conditional Probation Period Field */}
                {formData.employmentStatus === 'PROBATION' && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <Select
                      label="Probation Period (Months) *"
                      value={formData.probationMonths}
                      onChange={(e) => setFormData({ ...formData, probationMonths: e.target.value })}
                      options={[
                        { value: '', label: 'Select Duration' },
                        { value: '1', label: '1 Month' },
                        { value: '2', label: '2 Months' },
                        { value: '3', label: '3 Months' },
                        { value: '4', label: '4 Months' },
                        { value: '5', label: '5 Months' },
                        { value: '6', label: '6 Months' },
                        { value: '9', label: '9 Months' },
                        { value: '12', label: '12 Months' },
                      ]}
                      required
                    />
                  </div>
                )}

                {/* Conditional Notice Period Field */}
                {formData.employmentStatus === 'ON_NOTICE' && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <Select
                      label="Notice Period (Months) *"
                      value={formData.noticePeriodMonths}
                      onChange={(e) => setFormData({ ...formData, noticePeriodMonths: e.target.value })}
                      options={[
                        { value: '', label: 'Select Duration' },
                        { value: '1', label: '1 Month' },
                        { value: '2', label: '2 Months' },
                        { value: '3', label: '3 Months' },
                        { value: '4', label: '4 Months' },
                        { value: '6', label: '6 Months' },
                      ]}
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {/* Salary Tab */}
            {activeTab === 'salary' && (
              <div className="space-y-6">
                {/* Section Title */}
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-base font-semibold text-slate-900">Salary Structure</h3>
                  <p className="text-xs text-slate-500 mt-1">Configure employee salary components and deductions</p>
                </div>

                {/* Earnings Section */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">Earnings</h4>
                      <p className="text-xs text-slate-500">Monthly salary components</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Input
                      label="Basic Salary *"
                      type="number"
                      value={formData.basicSalary}
                      onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })}
                      placeholder="0.00"
                      hint="Base monthly salary"
                    />
                    <Input
                      label="House Rent Allowance (HRA)"
                      type="number"
                      value={formData.hra}
                      onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                      placeholder="0.00"
                      hint="Housing allowance"
                    />
                    <Input
                      label="Dearness Allowance (DA)"
                      type="number"
                      value={formData.da}
                      onChange={(e) => setFormData({ ...formData, da: e.target.value })}
                      placeholder="0.00"
                      hint="Cost of living adjustment"
                    />
                    <Input
                      label="Transport Allowance (TA)"
                      type="number"
                      value={formData.ta}
                      onChange={(e) => setFormData({ ...formData, ta: e.target.value })}
                      placeholder="0.00"
                      hint="Travel/commute allowance"
                    />
                    <Input
                      label="Medical Allowance"
                      type="number"
                      value={formData.medicalAllowance}
                      onChange={(e) => setFormData({ ...formData, medicalAllowance: e.target.value })}
                      placeholder="0.00"
                      hint="Healthcare allowance"
                    />
                    <Input
                      label="Other Allowances"
                      type="number"
                      value={formData.otherAllowances}
                      onChange={(e) => setFormData({ ...formData, otherAllowances: e.target.value })}
                      placeholder="0.00"
                      hint="Additional benefits"
                    />
                  </div>
                </div>

                {/* Deductions Section */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">Deductions</h4>
                      <p className="text-xs text-slate-500">Statutory and other deductions</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {/* Provident Fund Toggle */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="pfEnabled"
                            checked={formData.pfEnabled}
                            onChange={(e) => setFormData({ ...formData, pfEnabled: e.target.checked })}
                            className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                          />
                          <label htmlFor="pfEnabled" className="flex flex-col">
                            <span className="font-semibold text-slate-900 text-sm">Enable Provident Fund (PF)</span>
                            <span className="text-xs text-slate-500">Automatically deduct PF from salary</span>
                          </label>
                        </div>
                      </div>
                      {formData.pfEnabled && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <div className="flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-slate-600">PF will be calculated automatically based on global settings</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Professional Tax"
                        type="number"
                        value={formData.professionalTax}
                        onChange={(e) => setFormData({ ...formData, professionalTax: e.target.value })}
                        placeholder="0.00"
                        hint="Monthly professional tax"
                      />
                      <div className="relative">
                        <Input
                          label="Income Tax (FBR)"
                          type="number"
                          value={formData.tds}
                          onChange={(e) => setFormData({ ...formData, tds: e.target.value })}
                          placeholder="0.00"
                          readOnly
                          className="bg-slate-50"
                          hint="Auto-calculated based on income"
                        />
                        <span className="absolute right-3 top-8 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded">
                          AUTO
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Salary Summary */}
                <div className="border-t border-slate-200 pt-4">
                  <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <h4 className="font-semibold text-slate-900">Salary Summary</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Gross Salary</span>
                        <span className="font-semibold text-emerald-600">Rs {grossSalary.toLocaleString()}</span>
                      </div>
                      
                      {/* Individual Deductions */}
                      {(pfAmount > 0 || Number(formData.professionalTax) > 0 || Number(formData.tds) > 0) && (
                        <div className="border-t border-emerald-200 pt-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Deductions</p>
                          <div className="space-y-2">
                            {pfAmount > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 pl-2">• Provident Fund</span>
                                <span className="font-medium text-red-600">- Rs {pfAmount.toLocaleString()}</span>
                              </div>
                            )}
                            {Number(formData.professionalTax) > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 pl-2">• Professional Tax</span>
                                <span className="font-medium text-red-600">- Rs {Number(formData.professionalTax).toLocaleString()}</span>
                              </div>
                            )}
                            {Number(formData.tds) > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 pl-2">• Income Tax</span>
                                <span className="font-medium text-red-600">- Rs {Number(formData.tds).toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                              <span className="text-sm font-medium text-slate-700">Total Deductions</span>
                              <span className="font-semibold text-red-600">- Rs {totalDeductions.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="border-t border-emerald-200 pt-3 flex justify-between items-center">
                        <span className="font-bold text-slate-900">Net Salary</span>
                        <span className="font-bold text-xl text-emerald-600">Rs {netSalary.toLocaleString()}</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Emergency Contact Tab */}
            {activeTab === 'emergency' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Emergency Contacts</h3>
                      <p className="text-xs text-slate-500">People to contact in case of emergency</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {modalEmergencyContacts.map((contact, index) => (
                    <div key={index} className="p-4 bg-red-50/50 rounded-xl border border-red-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Contact {index + 1}</span>
                        <button type="button" onClick={() => setModalEmergencyContacts(modalEmergencyContacts.filter((_, i) => i !== index))}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Input label="Name" value={contact.name} onChange={(e) => { const updated = [...modalEmergencyContacts]; updated[index] = { ...updated[index], name: e.target.value }; setModalEmergencyContacts(updated); }} placeholder="Full name" />
                        <Input label="Phone" value={contact.phone} onChange={(e) => { const updated = [...modalEmergencyContacts]; updated[index] = { ...updated[index], phone: e.target.value }; setModalEmergencyContacts(updated); }} placeholder="+92 XXX XXXXXXX" />
                        <Input label="Relationship" value={contact.relationship} onChange={(e) => { const updated = [...modalEmergencyContacts]; updated[index] = { ...updated[index], relationship: e.target.value }; setModalEmergencyContacts(updated); }} placeholder="e.g., Father, Mother" />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setModalEmergencyContacts([...modalEmergencyContacts, { name: '', phone: '', relationship: '' }])}
                    className="w-full py-3 border-2 border-dashed border-red-200 hover:border-red-300 rounded-xl text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50/50 transition-colors flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    Add Emergency Contact
                  </button>
                </div>
              </div>
            )}

            {/* Bank Details Tab */}
            {activeTab === 'bank' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Bank Name"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="e.g., HBL, MCB, UBL"
                  />
                  <Input
                    label="Account Number"
                    value={formData.bankAccountNumber}
                    onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                    placeholder="Enter account number"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="IBAN"
                    value={formData.ifscCode}
                    onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                    placeholder="PK00XXXX0000000000000000"
                  />
                  <Input
                    label="Branch Address"
                    value={formData.branchAddress}
                    onChange={(e) => setFormData({ ...formData, branchAddress: e.target.value })}
                    placeholder="Branch name / address"
                  />
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-4">
                {docFields.length > 0 ? (
                  docFields.map(field => {
                    const pendingFile = pendingDocs[field.id];
                    return (
                      <div key={field.id} className="border border-slate-200 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900">{field.name}</h3>
                              {field.description && <p className="text-xs text-slate-400">{field.description}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {field.isRequired && <Badge variant="danger" size="sm">Required</Badge>}
                          </div>
                        </div>

                        {pendingFile ? (
                          <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-200">
                            <div className="flex items-center gap-3">
                              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" /></svg>
                              <div>
                                <p className="text-sm font-medium text-slate-900">{pendingFile.name}</p>
                                <p className="text-xs text-slate-400">{(pendingFile.size / 1024).toFixed(1)} KB · Will upload on save</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPendingDocs(prev => { const n = { ...prev }; delete n[field.id]; return n; })}
                              className="text-red-400 hover:text-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium rounded-xl cursor-pointer transition-colors border border-emerald-200">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Select File
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setPendingDocs(prev => ({ ...prev, [field.id]: file }));
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-slate-500 text-sm">No document fields configured yet</p>
                    <p className="text-xs text-slate-400 mt-1">Configure in Settings → Document Fields</p>
                  </div>
                )}
                {Object.keys(pendingDocs).length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-sm text-blue-700">
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {Object.keys(pendingDocs).length} document(s) will be uploaded when you save the employee.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-6 border-t bg-slate-50">
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {editingEmployee ? 'Update Employee' : 'Add Employee'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Credentials Modal */}
      <Modal
        isOpen={showCredentialsModal}
        onClose={() => setShowCredentialsModal(false)}
        title="🎉 Employee Created Successfully!"
        size="md"
      >
        <div className="p-6">
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-emerald-900 mb-1">Employee Account Created</h3>
                <p className="text-sm text-emerald-700">
                  Please save these login credentials. The employee can use these to access the system.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                Employee Code
              </label>
              <div className="flex items-center justify-between gap-3">
                <code className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-lg text-lg font-mono font-bold text-emerald-600">
                  {newEmployeeCredentials?.employeeCode}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(newEmployeeCredentials?.employeeCode || '');
                  }}
                  className="p-3 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                  title="Copy Employee Code"
                >
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                Email Address
              </label>
              <div className="flex items-center justify-between gap-3">
                <code className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-lg font-mono text-slate-700">
                  {newEmployeeCredentials?.email}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(newEmployeeCredentials?.email || '');
                  }}
                  className="p-3 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                  title="Copy Email"
                >
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Temporary Password
                </span>
              </label>
              <div className="flex items-center justify-between gap-3">
                <code className="flex-1 px-4 py-3 bg-white border border-amber-300 rounded-lg text-lg font-mono font-bold text-amber-700">
                  {newEmployeeCredentials?.password}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(newEmployeeCredentials?.password || '');
                  }}
                  className="p-3 bg-amber-200 hover:bg-amber-300 rounded-lg transition-colors"
                  title="Copy Password"
                >
                  <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-amber-700 mt-2 flex items-start gap-1">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Employee can change password after first login</span>
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Login Instructions:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Employee can login using either <strong>Employee Code</strong> or <strong>Email</strong></li>
                  <li>Password is required for authentication</li>
                  <li>Recommend changing password after first login</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={() => setShowCredentialsModal(false)} className="min-w-32">
              Got it!
            </Button>
          </div>
        </div>
      </Modal>

      {/* View/Reset Credentials Modal */}
      <Modal
        isOpen={showViewCredentialsModal}
        onClose={() => setShowViewCredentialsModal(false)}
        title="🔐 Employee Login Credentials"
        size="md"
      >
        <div className="p-6">
          {selectedEmployee && (
            <>
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <h3 className="text-lg font-semibold text-emerald-900 mb-2">
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </h3>
                <p className="text-sm text-emerald-700">
                  {selectedEmployee.department?.name || 'Employee'}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Employee Code
                  </label>
                  <div className="flex items-center justify-between gap-3">
                    <code className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-lg text-lg font-mono font-bold text-emerald-600">
                      {selectedEmployee.employeeCode}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedEmployee.employeeCode || '');
                        toast.success('Employee Code copied!');
                      }}
                      className="p-3 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                      title="Copy Employee Code"
                    >
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Email Address
                  </label>
                  <div className="flex items-center justify-between gap-3">
                    <code className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-lg font-mono text-slate-700">
                      {selectedEmployee.email}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedEmployee.email || '');
                        toast.success('Email copied!');
                      }}
                      className="p-3 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                      title="Copy Email"
                    >
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Reset Password
                </h4>
                <div className="space-y-3">
                  <Input
                    label="New Password"
                    type={showResetPassword ? "text" : "password"}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    hint="Employee will use this password for their next login"
                    rightIcon={
                      showResetPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )
                    }
                    onRightIconClick={() => setShowResetPassword(!showResetPassword)}
                  />
                  <Button
                    onClick={handleResetPasswordSubmit}
                    loading={resettingPassword}
                    disabled={!resetPassword || resetPassword.length < 6}
                    className="w-full"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset Password
                  </Button>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-800">
                    Employee can login using <strong>Employee Code</strong> or <strong>Email</strong> with their password
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
      <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={() => confirmDialog.onConfirm()} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} />
      </>}
    </div>
  );
}
