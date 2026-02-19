'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../context/AuthContext';
import { Card, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Input, Select } from '../../../../components/ui/Input';
import { Badge } from '../../../../components/ui/Badge';
import { useToast } from '../../../../components/ui/Toast';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';

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

interface DocumentField {
  id: string;
  name: string;
  description?: string;
  isRequired: boolean;
  employeeCanEdit: boolean;
  isActive: boolean;
}

interface EmployeeDoc {
  id: string;
  documentFieldId?: string;
  documentType?: string;
  title: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  isApproved: boolean;
  documentField?: { id: string; name: string };
}

export default function EditEmployeePage() {
  const params = useParams();
  const router = useRouter();
  const { token, user: currentUser } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [taxSlabs, setTaxSlabs] = useState<any[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  // Documents
  const [docFields, setDocFields] = useState<DocumentField[]>([]);
  const [employeeDocs, setEmployeeDocs] = useState<EmployeeDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);

  // Account status (controlled via toggle)
  const [employeeActive, setEmployeeActive] = useState(true);
  const [employeeUUID, setEmployeeUUID] = useState<string>('');
  const [togglingAccount, setTogglingAccount] = useState(false);

  // Emergency Contacts
  const [emergencyContacts, setEmergencyContacts] = useState<{ id?: string; name: string; relationship: string; phone: string; email?: string; address?: string; isPrimary?: boolean }[]>([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', email: '', address: '' });
  const [savingContact, setSavingContact] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const isAdmin = currentUser?.role === 'ADMIN';
  const isHR = currentUser?.role === 'HR';
  const canManage = isAdmin || isHR;

  const [formData, setFormData] = useState({
    // Basic Info
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    // Employment Details
    joiningDate: '',
    attendanceStartDate: '',
    departmentId: '',
    designation: '',
    shiftId: '',
    employmentType: 'PERMANENT',
    employmentStatus: 'ACTIVE',
    probationPeriod: '',
    noticePeriodMonths: '',
    role: 'EMPLOYEE',
    // Salary Details
    basicSalary: '',
    hra: '',
    da: '',
    ta: '',
    medicalAllowance: '',
    otherAllowances: '',
    pf: '',
    esi: '',
    professionalTax: '',
    tds: '',
    otherDeductions: '',
    // Bank Details
    bankName: '',
    bankAccountNumber: '',
    ifscCode: '',
    panNumber: '',
    branchAddress: '',
  });

  useEffect(() => {
    if (!canManage) {
      toast.error('You do not have permission to edit employees');
      router.push('/dashboard/employees');
      return;
    }
    if (token && params.id) {
      fetchEmployee();
      fetchDepartments();
      fetchShifts();
      fetchTaxSlabs();
      fetchDocFields();
      fetchEmployeeDocs();
    }
  }, [token, params.id, canManage]);

  const fetchEmployee = async () => {
    try {
      const res = await fetch(`/api/employees/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const emp = data.data;
        setFormData({
          employeeCode: emp.employeeCode || '',
          firstName: emp.firstName || '',
          lastName: emp.lastName || '',
          email: emp.email || '',
          phone: emp.phone || '',
          dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '',
          gender: emp.gender || '',
          address: emp.address || '',
          city: emp.city || '',
          state: emp.state || '',
          postalCode: emp.postalCode || '',
          country: emp.country || '',
          joiningDate: emp.joiningDate ? emp.joiningDate.split('T')[0] : '',
          attendanceStartDate: emp.attendanceStartDate ? emp.attendanceStartDate.split('T')[0] : '',
          departmentId: emp.department?.id || '',
          designation: emp.designation || '',
          shiftId: emp.shift?.id || '',
          employmentType: emp.employmentType || 'PERMANENT',
          employmentStatus: emp.employmentStatus || 'ACTIVE',
          probationPeriod: emp.probationPeriod?.toString() || '',
          noticePeriodMonths: emp.noticePeriodMonths?.toString() || '',
          role: emp.user?.role || 'EMPLOYEE',
          basicSalary: emp.salary?.basicSalary?.toString() || '',
          hra: emp.salary?.hra?.toString() || '',
          da: emp.salary?.da?.toString() || '',
          ta: emp.salary?.ta?.toString() || '',
          medicalAllowance: emp.salary?.medicalAllowance?.toString() || '',
          otherAllowances: emp.salary?.otherAllowances?.toString() || '',
          pf: emp.salary?.pf?.toString() || '',
          esi: emp.salary?.esi?.toString() || '',
          professionalTax: emp.salary?.professionalTax?.toString() || '',
          tds: emp.salary?.tds?.toString() || '',
          otherDeductions: emp.salary?.otherDeductions?.toString() || '',
          bankName: emp.bankDetails?.bankName || emp.bankName || '',
          bankAccountNumber: emp.bankDetails?.bankAccountNumber || emp.bankAccountNumber || '',
          ifscCode: emp.bankDetails?.ifscCode || emp.ifscCode || '',
          panNumber: emp.bankDetails?.panNumber || emp.panNumber || '',
          branchAddress: emp.branchAddress || '',
        });
        setEmployeeActive(emp.user?.isActive !== false);
        setEmployeeUUID(emp.id);
        if (emp.emergencyContacts) setEmergencyContacts(emp.emergencyContacts);
      } else {
        toast.error('Failed to load employee details');
        router.push('/dashboard/employees');
      }
    } catch (error) {
      toast.error('Failed to load employee details');
      router.push('/dashboard/employees');
    } finally {
      setLoading(false);
    }
  };

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
        setDocFields((data.data || []).filter((f: DocumentField) => f.isActive));
      }
    } catch { /* silent */ }
  }, [token]);

  const fetchEmployeeDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/employees/documents?employeeId=${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmployeeDocs(data.data || []);
      }
    } catch { /* silent */ }
  }, [token, params.id]);

  const handleDocUpload = async (fieldId: string, file: File) => {
    setUploading(true);
    setUploadingFieldId(fieldId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'documents');
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!uploadRes.ok) { toast.error('Upload failed'); return; }
      const uploadData = await uploadRes.json();
      const docRes = await fetch('/api/employees/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          employeeId: params.id,
          documentFieldId: fieldId,
          title: file.name,
          filePath: uploadData.url || uploadData.data?.url || uploadData.filePath,
          fileSize: file.size,
          fileType: file.name.split('.').pop()?.toUpperCase() || 'OTHER',
          documentType: 'OTHER',
        }),
      });
      if (docRes.ok) {
        toast.success('Document uploaded');
        fetchEmployeeDocs();
      } else {
        const d = await docRes.json();
        toast.error(d.error || 'Failed to save document');
      }
    } catch { toast.error('Upload failed'); } finally {
      setUploading(false);
      setUploadingFieldId(null);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    openConfirm({
      title: 'Delete Document',
      message: 'Are you sure you want to delete this document?',
      variant: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/documents?id=${docId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) { toast.success('Document deleted'); fetchEmployeeDocs(); }
          else { toast.error('Failed to delete'); }
        } catch { toast.error('Failed'); }
      },
    });
  };

  // ─── Emergency Contact Handlers ───
  const fetchEmergencyContacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/employees/${params.id}/emergency-contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmergencyContacts(data.data || []);
      }
    } catch { /* silent */ }
  }, [token, params.id]);

  const handleSaveContact = async () => {
    if (!contactForm.name || !contactForm.phone || !contactForm.relationship) {
      toast.error('Name, relationship and phone are required');
      return;
    }
    setSavingContact(true);
    try {
      const url = `/api/employees/${params.id}/emergency-contacts`;
      const method = editingContact ? 'PUT' : 'POST';
      const body = editingContact ? { ...contactForm, contactId: editingContact.id } : contactForm;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(editingContact ? 'Contact updated' : 'Contact added');
        setShowContactForm(false);
        setEditingContact(null);
        setContactForm({ name: '', relationship: '', phone: '', email: '', address: '' });
        fetchEmergencyContacts();
      } else {
        toast.error('Failed to save contact');
      }
    } catch { toast.error('Failed to save contact'); }
    finally { setSavingContact(false); }
  };

  const handleDeleteContact = (contactId: string) => {
    openConfirm({
      title: 'Delete Emergency Contact',
      message: 'Are you sure you want to delete this emergency contact?',
      variant: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/employees/${params.id}/emergency-contacts?contactId=${contactId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) { toast.success('Contact deleted'); fetchEmergencyContacts(); }
          else { toast.error('Failed to delete'); }
        } catch { toast.error('Failed'); }
      },
    });
  };

  useEffect(() => {
    if (token && params.id && activeTab === 'emergency') {
      fetchEmergencyContacts();
    }
  }, [token, params.id, activeTab, fetchEmergencyContacts]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
      if (Math.abs(parseFloat(formData.tds) - calculatedTds) > 0.01) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`/api/employees/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Employee updated successfully!');
        router.push(`/dashboard/employees/${params.id}`);
      } else {
        toast.error(data.error || 'Failed to update employee');
      }
    } catch (error) {
      toast.error('Failed to update employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Calculate gross and net salary
  const grossSalary = (parseFloat(formData.basicSalary) || 0) + 
                      (parseFloat(formData.hra) || 0) + 
                      (parseFloat(formData.da) || 0) + 
                      (parseFloat(formData.ta) || 0) + 
                      (parseFloat(formData.medicalAllowance) || 0) + 
                      (parseFloat(formData.otherAllowances) || 0);
  
  const totalDeductions = (parseFloat(formData.pf) || 0) + 
                          (parseFloat(formData.esi) || 0) + 
                          (parseFloat(formData.professionalTax) || 0) + 
                          (parseFloat(formData.tds) || 0) + 
                          (parseFloat(formData.otherDeductions) || 0);
  
  const netSalary = grossSalary - totalDeductions;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'basic', name: 'Basic Info', icon: '👤' },
    { id: 'employment', name: 'Employment', icon: '💼' },
    { id: 'salary', name: 'Salary', icon: '💰' },
    { id: 'emergency', name: 'Emergency', icon: '🚨' },
    { id: 'bank', name: 'Bank Details', icon: '🏦' },
    { id: 'documents', name: 'Documents', icon: '📄' },
    { id: 'account', name: 'Account', icon: '🔒' },
  ];

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/dashboard/employees/${params.id}`)}
            className="hover:bg-slate-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Edit Employee</h1>
            <p className="text-slate-500">Update employee information</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Tabs */}
        <Card className="mb-6">
          <div className="border-b border-slate-200">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'basic' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Employee Code"
                  name="employeeCode"
                  value={formData.employeeCode}
                  onChange={handleChange}
                  placeholder="EMP001"
                />
                <Input
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                />
                <Select
                  label="Gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Select Gender' },
                    { value: 'MALE', label: 'Male' },
                    { value: 'FEMALE', label: 'Female' },
                    { value: 'OTHER', label: 'Other' },
                  ]}
                />
                <Input
                  label="Address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="md:col-span-2"
                />
                <Input
                  label="City"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                />
                <Input
                  label="State"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                />
                <Input
                  label="Postal Code"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                />
                <Input
                  label="Country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                />
              </div>
            )}

            {activeTab === 'employment' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Joining Date"
                  type="date"
                  name="joiningDate"
                  value={formData.joiningDate}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Attendance Start Date"
                  type="date"
                  name="attendanceStartDate"
                  value={formData.attendanceStartDate}
                  onChange={handleChange}
                />
                <Select
                  label="Department"
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  required
                  options={[
                    { value: '', label: 'Select Department' },
                    ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
                  ]}
                />
                <Input
                  label="Designation"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  placeholder="e.g. Software Engineer, Manager"
                />
                <Select
                  label="Shift"
                  name="shiftId"
                  value={formData.shiftId}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Select Shift' },
                    ...shifts.map((shift) => ({
                      value: shift.id,
                      label: shift.startTime && shift.endTime ? `${shift.name} (${shift.startTime} - ${shift.endTime})` : shift.name,
                    })),
                  ]}
                />
                <Select
                  label="Employment Type"
                  name="employmentType"
                  value={formData.employmentType}
                  onChange={handleChange}
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
                <Select
                  label="Employment Status"
                  name="employmentStatus"
                  value={formData.employmentStatus}
                  onChange={handleChange}
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
                {formData.employmentStatus === 'PROBATION' && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg col-span-full">
                    <Select
                      label="Probation Period (Months) *"
                      name="probationPeriod"
                      value={formData.probationPeriod}
                      onChange={handleChange}
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
                    />
                  </div>
                )}
                {formData.employmentStatus === 'ON_NOTICE' && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg col-span-full">
                    <Select
                      label="Notice Period (Months) *"
                      name="noticePeriodMonths"
                      value={formData.noticePeriodMonths || ''}
                      onChange={handleChange}
                      options={[
                        { value: '', label: 'Select Duration' },
                        { value: '1', label: '1 Month' },
                        { value: '2', label: '2 Months' },
                        { value: '3', label: '3 Months' },
                        { value: '4', label: '4 Months' },
                        { value: '6', label: '6 Months' },
                      ]}
                    />
                  </div>
                )}
                <Select
                  label="User Role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  options={[
                    { value: 'EMPLOYEE', label: 'Employee' },
                    { value: 'MANAGER', label: 'Manager' },
                    { value: 'HR', label: 'HR' },
                    ...(isAdmin ? [{ value: 'ADMIN', label: 'Admin' }] : []),
                  ]}
                />
              </div>
            )}

            {activeTab === 'salary' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">💵 Monthly Earnings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Basic Salary (Monthly)"
                      type="number"
                      name="basicSalary"
                      value={formData.basicSalary}
                      onChange={handleChange}
                      required
                    />
                    <Input
                      label="HRA"
                      type="number"
                      name="hra"
                      value={formData.hra}
                      onChange={handleChange}
                    />
                    <Input
                      label="Dearness Allowance (DA)"
                      type="number"
                      name="da"
                      value={formData.da}
                      onChange={handleChange}
                    />
                    <Input
                      label="Transport Allowance (TA)"
                      type="number"
                      name="ta"
                      value={formData.ta}
                      onChange={handleChange}
                    />
                    <Input
                      label="Medical Allowance"
                      type="number"
                      name="medicalAllowance"
                      value={formData.medicalAllowance}
                      onChange={handleChange}
                    />
                    <Input
                      label="Other Allowances"
                      type="number"
                      name="otherAllowances"
                      value={formData.otherAllowances}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">📉 Deductions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Provident Fund (PF)"
                      type="number"
                      name="pf"
                      value={formData.pf}
                      onChange={handleChange}
                    />
                    <Input
                      label="ESI"
                      type="number"
                      name="esi"
                      value={formData.esi}
                      onChange={handleChange}
                    />
                    <Input
                      label="Professional Tax"
                      type="number"
                      name="professionalTax"
                      value={formData.professionalTax}
                      onChange={handleChange}
                    />
                    <div className="relative">
                      <Input
                        label="Income Tax (FBR)"
                        type="number"
                        name="tds"
                        value={formData.tds}
                        onChange={handleChange}
                        readOnly
                        className="bg-gray-50"
                      />
                      <span className="absolute right-3 top-9 text-xs text-gray-500">
                        ✨ Auto
                      </span>
                    </div>
                    <Input
                      label="Other Deductions"
                      type="number"
                      name="otherDeductions"
                      value={formData.otherDeductions}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Gross Monthly Salary</p>
                      <p className="text-2xl font-bold text-emerald-600">Rs {grossSalary.toLocaleString('en-PK')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Total Deductions</p>
                      <p className="text-2xl font-bold text-red-600">Rs {totalDeductions.toLocaleString('en-PK')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Net Monthly Salary</p>
                      <p className="text-2xl font-bold text-emerald-600">Rs {netSalary.toLocaleString('en-PK')}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'bank' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Bank Name"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  placeholder="e.g., HBL, MCB, UBL"
                />
                <Input
                  label="Account Number"
                  name="bankAccountNumber"
                  value={formData.bankAccountNumber}
                  onChange={handleChange}
                  placeholder="Enter account number"
                />
                <Input
                  label="IBAN"
                  name="ifscCode"
                  value={formData.ifscCode}
                  onChange={handleChange}
                  placeholder="PK00XXXX0000000000000000"
                />
                <Input
                  label="Branch Address"
                  name="branchAddress"
                  value={formData.branchAddress}
                  onChange={handleChange}
                  placeholder="Branch name / address"
                />
              </div>
            )}

            {/* Emergency Contacts Tab */}
            {activeTab === 'emergency' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Emergency Contacts</h3>
                  <Button type="button" size="sm" onClick={() => { setShowContactForm(true); setEditingContact(null); setContactForm({ name: '', relationship: '', phone: '', email: '', address: '' }); }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Contact
                  </Button>
                </div>

                {showContactForm && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
                    <h3 className="font-bold text-slate-900 mb-2">{editingContact ? 'Edit Contact' : 'New Emergency Contact'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Name *" value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                      <Input label="Relationship *" value={contactForm.relationship} onChange={e => setContactForm(f => ({ ...f, relationship: e.target.value }))} placeholder="e.g., Father, Mother, Spouse" />
                      <Input label="Phone *" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="+92 XXX XXXXXXX" />
                      <Input label="Email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="Optional" />
                    </div>
                    <Input label="Address" value={contactForm.address} onChange={e => setContactForm(f => ({ ...f, address: e.target.value }))} placeholder="Optional" />
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="secondary" size="sm" onClick={() => { setShowContactForm(false); setEditingContact(null); }}>Cancel</Button>
                      <Button type="button" size="sm" onClick={handleSaveContact} disabled={savingContact}>
                        {savingContact ? 'Saving...' : editingContact ? 'Update' : 'Save'}
                      </Button>
                    </div>
                  </div>
                )}

                {emergencyContacts.length > 0 ? (
                  <div className="space-y-3">
                    {emergencyContacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600 font-bold text-lg border border-red-200">
                            {contact.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{contact.name}</p>
                            <p className="text-sm text-slate-500">{contact.relationship} · {contact.phone}</p>
                            {contact.email && <p className="text-xs text-slate-400">{contact.email}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => { setEditingContact(contact); setContactForm({ name: contact.name, relationship: contact.relationship, phone: contact.phone, email: contact.email || '', address: contact.address || '' }); setShowContactForm(true); }} className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button type="button" onClick={() => handleDeleteContact(contact.id!)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !showContactForm ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <p className="text-slate-600 font-medium">No emergency contacts added</p>
                    <p className="text-sm text-slate-400 mt-1">Add emergency contacts for this employee</p>
                  </div>
                ) : null}
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-4">
                {docFields.length > 0 ? (
                  docFields.map(field => {
                    const fieldDocs = employeeDocs.filter(d => d.documentFieldId === field.id);
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
                            {field.employeeCanEdit ? (
                              <Badge variant="success" size="sm">Employee editable</Badge>
                            ) : (
                              <Badge variant="default" size="sm">Admin only</Badge>
                            )}
                          </div>
                        </div>

                        {fieldDocs.length > 0 ? (
                          <div className="space-y-2">
                            {fieldDocs.map(doc => (
                              <div key={doc.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">{doc.title}</p>
                                    <p className="text-xs text-slate-400">{formatFileSize(doc.fileSize)} · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  </a>
                                  <button type="button" onClick={() => handleDeleteDoc(doc.id)} className="text-red-400 hover:text-red-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No document uploaded</p>
                        )}

                        <div className="mt-3">
                          <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium rounded-xl cursor-pointer transition-colors border border-emerald-200">
                            {uploading && uploadingFieldId === field.id ? (
                              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            )}
                            Upload
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleDocUpload(field.id, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-slate-600 font-medium">No document fields configured</p>
                    <p className="text-sm text-slate-400 mt-1">Configure document fields in Settings → Document Fields</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'account' && (
              <div className="space-y-6">
                <div className={`p-6 rounded-xl border-2 ${employeeActive ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${employeeActive ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {employeeActive ? (
                          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        ) : (
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Account Status</h3>
                        <p className="text-sm text-slate-500">
                          {employeeActive ? 'This account is active. The employee can log in.' : 'This account is locked. The employee cannot log in.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={employeeActive ? 'success' : 'danger'} size="sm">{employeeActive ? 'Active' : 'Locked'}</Badge>
                      <button
                        type="button"
                        disabled={togglingAccount}
                        onClick={async () => {
                          const newState = !employeeActive;
                          const action = newState ? 'unlock' : 'lock';
                          if (!confirm(`Are you sure you want to ${action} this account?`)) return;
                          setTogglingAccount(true);
                          try {
                            const res = await fetch('/api/employees/toggle-active', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ employeeId: employeeUUID, isActive: newState }),
                            });
                            if (res.ok) {
                              setEmployeeActive(newState);
                              toast.success(newState ? 'Account unlocked' : 'Account locked');
                            } else {
                              const data = await res.json();
                              toast.error(data.error || 'Failed to update');
                            }
                          } catch { toast.error('Failed to update account status'); }
                          finally { setTogglingAccount(false); }
                        }}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          employeeActive ? 'bg-emerald-500 focus:ring-emerald-500' : 'bg-red-400 focus:ring-red-400'
                        } ${togglingAccount ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${employeeActive ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">Toggle this switch to lock or unlock the employee&apos;s account. Locked accounts cannot log in. Account is also auto-locked when status is set to Suspended, Terminated, Resigned, or Absconded.</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(`/dashboard/employees/${params.id}`)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Update Employee
          </Button>
        </div>
      </form>

      <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={() => confirmDialog.onConfirm()} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} />
    </div>
  );
}
