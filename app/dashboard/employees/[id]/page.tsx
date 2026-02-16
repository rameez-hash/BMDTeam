'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

interface Employee {
  id: string;
  employeeCode?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profileImage?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  employmentStatus?: string;
  employmentType?: string;
  joiningDate?: string;
  confirmationDate?: string;
  probationPeriod?: number;
  department?: { id: string; name: string };
  designation?: string;
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
    pf?: number;
    esi?: number;
    professionalTax?: number;
    tds?: number;
    otherDeductions?: number;
  };
  bankDetails?: {
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

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  address?: string;
  isPrimary: boolean;
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
  expiryDate?: string;
  description?: string;
  documentField?: { id: string; name: string };
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user: currentUser } = useAuth();
  const toast = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Emergency Contacts
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', email: '', address: '', isPrimary: false });
  const [contactSaving, setContactSaving] = useState(false);

  // Documents
  const [docFields, setDocFields] = useState<DocumentField[]>([]);
  const [employeeDocs, setEmployeeDocs] = useState<EmployeeDoc[]>([]);
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // History
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const isAdmin = currentUser?.role === 'ADMIN';
  const isHR = currentUser?.role === 'HR';
  const canManage = isAdmin || isHR;
  const isOwnProfile = currentUser?.employee?.id === params.id;

  useEffect(() => {
    if (token && params.id) {
      fetchEmployee();
    }
  }, [token, params.id]);

  useEffect(() => {
    if (token && params.id && activeTab === 'emergency') {
      fetchContacts();
    }
  }, [token, params.id, activeTab]);

  useEffect(() => {
    if (token && params.id && activeTab === 'documents') {
      fetchDocFields();
      fetchEmployeeDocs();
    }
  }, [token, params.id, activeTab]);

  useEffect(() => {
    if (token && params.id && activeTab === 'history') {
      fetchHistory();
    }
  }, [token, params.id, activeTab, employee]);

  const fetchHistory = async () => {
    try {
      // Use the employee's actual UUID, not the URL param which could be an employee code
      const empId = employee?.id || params.id;
      const res = await fetch(`/api/promotions?employeeId=${empId}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryRecords(data.data || []);
      }
    } catch { /* silent */ }
  };

  const fetchEmployee = async () => {
    try {
      const res = await fetch(`/api/employees/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmployee(data.data);
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

  const fetchContacts = async () => {
    try {
      const res = await fetch(`/api/employees/${params.id}/emergency-contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.data || []);
      }
    } catch { /* silent */ }
  };

  const fetchDocFields = async () => {
    try {
      const res = await fetch('/api/document-fields', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocFields((data.data || []).filter((f: DocumentField) => f.isActive));
      }
    } catch { /* silent */ }
  };

  const fetchEmployeeDocs = async () => {
    try {
      const res = await fetch(`/api/employees/documents?employeeId=${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmployeeDocs(data.data || []);
      }
    } catch { /* silent */ }
  };

  const handleEdit = () => {
    router.push(`/dashboard/employees/${params.id}/edit`);
  };

  // ─── Emergency Contact handlers ───
  const handleSaveContact = async () => {
    if (!contactForm.name || !contactForm.relationship || !contactForm.phone) {
      toast.error('Name, relationship and phone are required');
      return;
    }
    setContactSaving(true);
    try {
      const method = editingContact ? 'PUT' : 'POST';
      const body = editingContact
        ? { contactId: editingContact.id, ...contactForm }
        : contactForm;
      const res = await fetch(`/api/employees/${params.id}/emergency-contacts`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(editingContact ? 'Contact updated' : 'Contact added');
        setShowContactForm(false);
        setEditingContact(null);
        setContactForm({ name: '', relationship: '', phone: '', email: '', address: '', isPrimary: false });
        fetchContacts();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed');
      }
    } catch { toast.error('Failed'); } finally { setContactSaving(false); }
  };

  const handleDeleteContact = async (contactId: string) => {
    openConfirm({
      title: 'Delete Contact',
      message: 'Are you sure you want to delete this emergency contact?',
      variant: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/employees/${params.id}/emergency-contacts?contactId=${contactId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) { toast.success('Contact deleted'); fetchContacts(); }
          else { toast.error('Failed to delete'); }
        } catch { toast.error('Failed'); }
      },
    });
  };

  // ─── Document upload handler ───
  const handleDocUpload = async (fieldId: string, file: File) => {
    setUploading(true);
    setUploadingFieldId(fieldId);
    try {
      // Upload file first
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

      // Create document record
      const docRes = await fetch(`/api/employees/documents`, {
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

  const [togglingAccount, setTogglingAccount] = useState(false);

  const toggleAccountLock = () => {
    const isCurrentlyActive = employee?.user?.isActive;
    openConfirm({
      title: isCurrentlyActive ? 'Lock Account' : 'Unlock Account',
      message: isCurrentlyActive
        ? `Are you sure you want to lock ${employee?.firstName} ${employee?.lastName}'s account? They will not be able to log in.`
        : `Are you sure you want to unlock ${employee?.firstName} ${employee?.lastName}'s account? They will be able to log in again.`,
      variant: isCurrentlyActive ? 'danger' : 'info',
      confirmText: isCurrentlyActive ? 'Lock Account' : 'Unlock Account',
      onConfirm: async () => {
        closeConfirm();
        setTogglingAccount(true);
        try {
          const res = await fetch('/api/employees/toggle-active', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ employeeId: employee?.id, isActive: !isCurrentlyActive }),
          });
          if (res.ok) {
            toast.success(isCurrentlyActive ? 'Account locked successfully' : 'Account unlocked successfully');
            fetchEmployee();
          } else {
            const data = await res.json();
            toast.error(data.error || 'Failed to update account status');
          }
        } catch { toast.error('Failed to update account status'); }
        finally { setTogglingAccount(false); }
      },
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'Rs 0';
    return `Rs ${amount.toLocaleString('en-PK')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status?: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
      ACTIVE: 'success', INACTIVE: 'default', ON_LEAVE: 'warning', PROBATION: 'info',
      SUSPENDED: 'danger', RESIGNED: 'warning', TERMINATED: 'danger',
      ON_NOTICE: 'warning', RETIRED: 'default', ABSCONDED: 'danger',
    };
    const labels: Record<string, string> = {
      ACTIVE: 'Active', INACTIVE: 'Inactive', ON_LEAVE: 'On Leave', PROBATION: 'Probation',
      SUSPENDED: 'Suspended', RESIGNED: 'Resigned', TERMINATED: 'Terminated',
      ON_NOTICE: 'On Notice', RETIRED: 'Retired', ABSCONDED: 'Absconded',
    };
    return (
      <Badge variant={variants[status || 'ACTIVE'] || 'default'}>
        {labels[status || 'ACTIVE'] || (status || 'ACTIVE').replace(/_/g, ' ')}
      </Badge>
    );
  };

  const getEmploymentTypeBadge = (type?: string) => {
    const variants: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'default'> = {
      PERMANENT: 'success', CONTRACT: 'warning', TEMPORARY: 'info', INTERN: 'default',
      PART_TIME: 'info', REMOTE: 'success', FREELANCER: 'warning', CONSULTANT: 'info',
    };
    const labels: Record<string, string> = {
      PERMANENT: 'Permanent', CONTRACT: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Intern',
      PART_TIME: 'Part-Time', REMOTE: 'Remote', FREELANCER: 'Freelancer', CONSULTANT: 'Consultant',
    };
    return (
      <Badge variant={variants[type || 'PERMANENT'] || 'default'}>
        {labels[type || 'PERMANENT'] || (type || 'PERMANENT').replace(/_/g, ' ')}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!employee) {
    return null;
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📋' },
    { id: 'employment', name: 'Employment', icon: '💼' },
    { id: 'salary', name: 'Salary', icon: '💰' },
    { id: 'bank', name: 'Bank', icon: '🏦' },
    { id: 'documents', name: 'Documents', icon: '📄' },
    { id: 'emergency', name: 'Emergency', icon: '🚨' },
    { id: 'history', name: 'History', icon: '📈' },
  ];

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/employees')}
          className="hover:bg-slate-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Button>
      </div>

      {/* Profile Card */}
      <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white overflow-hidden">
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Profile Image */}
            <div className="relative">
              {employee.profileImage ? (
                <img
                  src={employee.profileImage}
                  alt={`${employee.firstName} ${employee.lastName}`}
                  className="w-32 h-32 rounded-2xl object-cover border-4 border-white/20 shadow-xl"
                />
              ) : (
                <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white font-bold text-4xl border-4 border-white/20 shadow-xl">
                  {employee.firstName[0]}{employee.lastName[0]}
                </div>
              )}
              {/* Active/Inactive indicator */}
              <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-lg ${employee.user?.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}>
                {employee.user?.isActive ? (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                )}
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <h1 className="text-3xl font-bold">
                  {employee.firstName} {employee.lastName}
                </h1>
                {getStatusBadge(employee.employmentStatus)}
                {getEmploymentTypeBadge(employee.employmentType)}
                {!employee.user?.isActive && (
                  <Badge variant="danger">Account Deactivated</Badge>
                )}
              </div>
              
              <div className="space-y-2 text-white/90">
                <p className="text-lg">{employee.designation || 'N/A'}</p>
                <p className="text-sm">{employee.department?.name || 'N/A'}</p>
                <div className="flex flex-wrap gap-4 mt-4 justify-center sm:justify-start">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">{employee.email}</span>
                  </div>
                  {employee.phone && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="text-sm">{employee.phone}</span>
                    </div>
                  )}
                  {employee.employeeCode && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                      <span className="text-sm font-mono">{employee.employeeCode}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              {canManage && (
                <>
                  <Button
                    onClick={handleEdit}
                    variant="secondary"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </Button>

                  <Button
                    onClick={toggleAccountLock}
                    disabled={togglingAccount}
                    variant={employee.user?.isActive ? 'danger' : 'success'}
                  >
                    {employee.user?.isActive ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                    )}
                    {togglingAccount ? 'Processing...' : (employee.user?.isActive ? 'Lock Account' : 'Unlock Account')}
                  </Button>
                </>
              )}
              {isOwnProfile && (
                <Button
                  onClick={() => router.push('/dashboard/profile')}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  My Profile
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl">
        <div className="flex overflow-x-auto px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
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

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeTab === 'overview' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <div className="space-y-4">
                <InfoRow label="Full Name" value={`${employee.firstName} ${employee.lastName}`} />
                <InfoRow label="Email" value={employee.email} />
                <InfoRow label="Phone" value={employee.phone || '-'} />
                <InfoRow label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
                <InfoRow label="Gender" value={employee.gender || '-'} />
                <InfoRow label="Address" value={employee.address || '-'} />
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Joining Date" value={formatDate(employee.joiningDate)} icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
                <StatCard label="Employment Type" value={({ PERMANENT: 'Permanent', CONTRACT: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Intern', PART_TIME: 'Part-Time', REMOTE: 'Remote', FREELANCER: 'Freelancer', CONSULTANT: 'Consultant' } as Record<string, string>)[employee.employmentType || 'PERMANENT'] || (employee.employmentType || 'Permanent')} icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
                <StatCard label="Role" value={employee.user?.role || 'EMPLOYEE'} icon={<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
                <StatCard label="Account Status" value={employee.user?.isActive ? 'Active' : 'Deactivated'} icon={<svg className={`w-5 h-5 ${employee.user?.isActive ? 'text-emerald-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
              </div>
            </Card>
          </>
        )}

        {activeTab === 'employment' && (
          <>
            <Card>
              <CardHeader><CardTitle>Employment Details</CardTitle></CardHeader>
              <div className="space-y-4">
                <InfoRow label="Employee Code" value={employee.employeeCode || '-'} />
                <InfoRow label="Department" value={employee.department?.name || '-'} />
                <InfoRow label="Designation" value={employee.designation || '-'} />
                <InfoRow label="Employment Type" value={({ PERMANENT: 'Permanent', CONTRACT: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Intern', PART_TIME: 'Part-Time', REMOTE: 'Remote', FREELANCER: 'Freelancer', CONSULTANT: 'Consultant' } as Record<string, string>)[employee.employmentType || 'PERMANENT'] || (employee.employmentType || 'Permanent')} />
                <InfoRow label="Employment Status" value={({ ACTIVE: 'Active', INACTIVE: 'Inactive', ON_LEAVE: 'On Leave', PROBATION: 'Probation', SUSPENDED: 'Suspended', RESIGNED: 'Resigned', TERMINATED: 'Terminated', ON_NOTICE: 'On Notice', RETIRED: 'Retired', ABSCONDED: 'Absconded' } as Record<string, string>)[employee.employmentStatus || 'ACTIVE'] || (employee.employmentStatus || 'Active')} />
                <InfoRow label="Joining Date" value={formatDate(employee.joiningDate)} />
                <InfoRow label="Confirmation Date" value={formatDate(employee.confirmationDate)} />
              </div>
            </Card>
            <Card>
              <CardHeader><CardTitle>System Access</CardTitle></CardHeader>
              <div className="space-y-4">
                <InfoRow label="User Role" value={employee.user?.role || 'EMPLOYEE'} />
                <InfoRow label="Account Status" value={employee.user?.isActive ? 'Active' : 'Deactivated'} />
                <InfoRow label="Email" value={employee.email} />
              </div>
            </Card>
          </>
        )}

        {activeTab === 'salary' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Monthly Salary Breakdown</CardTitle>
                <p className="text-xs text-slate-500 mt-1">Tax is calculated on annual income then divided by 12</p>
              </CardHeader>
              <div className="space-y-4">
                <InfoRow label="Basic Salary" value={formatCurrency(employee.salary?.basicSalary)} isBold />
                <InfoRow label="HRA" value={formatCurrency(employee.salary?.hra)} />
                <InfoRow label="Dearness Allowance" value={formatCurrency(employee.salary?.da)} />
                <InfoRow label="Transport Allowance" value={formatCurrency(employee.salary?.ta)} />
                <InfoRow label="Medical Allowance" value={formatCurrency(employee.salary?.medicalAllowance)} />
                <InfoRow label="Other Allowances" value={formatCurrency(employee.salary?.otherAllowances)} />
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <InfoRow label="Gross Monthly Salary" value={formatCurrency(employee.salary?.grossSalary)} isBold isHighlight />
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Monthly Deductions</CardTitle>
                <p className="text-xs text-slate-500 mt-1">Income Tax calculated annually and divided by 12</p>
              </CardHeader>
              <div className="space-y-4">
                <InfoRow label="Provident Fund (PF)" value={formatCurrency(employee.salary?.pf)} />
                <InfoRow label="ESI" value={formatCurrency(employee.salary?.esi)} />
                <InfoRow label="Professional Tax" value={formatCurrency(employee.salary?.professionalTax)} />
                <InfoRow label="Income Tax (FBR)" value={formatCurrency(employee.salary?.tds)} />
                <InfoRow label="Other Deductions" value={formatCurrency(employee.salary?.otherDeductions)} />
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <InfoRow label="Net Monthly Salary" value={formatCurrency(employee.salary?.netSalary)} isBold isHighlight highlightColor="emerald" />
                </div>
              </div>
            </Card>
          </>
        )}

        {activeTab === 'bank' && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Bank Account Details</CardTitle></CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoRow label="Bank Name" value={employee.bankDetails?.bankName || employee.bankName || '-'} />
              <InfoRow label="Account Number" value={employee.bankDetails?.bankAccountNumber || employee.bankAccountNumber || '-'} />
              <InfoRow label="IBAN" value={employee.bankDetails?.ifscCode || employee.ifscCode || '-'} />
              <InfoRow label="Branch Address" value={employee.branchAddress || '-'} />
            </div>
          </Card>
        )}

        {/* ═══ DOCUMENTS TAB ═══ */}
        {activeTab === 'documents' && (
          <div className="lg:col-span-2 space-y-4">
            {docFields.length > 0 ? (
              docFields.map(field => {
                const fieldDocs = employeeDocs.filter(d => d.documentFieldId === field.id);
                const canUpload = canManage || (isOwnProfile && field.employeeCanEdit);
                return (
                  <Card key={field.id} className="border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
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
                              {doc.isApproved && <Badge variant="success" size="sm">Approved</Badge>}
                              <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              </a>
                              {canUpload && (
                                <button onClick={() => handleDeleteDoc(doc.id)} className="text-red-400 hover:text-red-600">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No document uploaded</p>
                    )}

                    {canUpload && (
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
                    )}
                  </Card>
                );
              })
            ) : (
              <Card>
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-slate-600 font-medium">No document fields configured</p>
                  <p className="text-sm text-slate-400 mt-1">Ask admin to create document fields in Settings → Document Fields</p>
                </div>
              </Card>
            )}

            {/* Also show any existing documents without a field link */}
            {(() => {
              const unlinkedDocs = employeeDocs.filter(d => !d.documentFieldId);
              if (unlinkedDocs.length === 0) return null;
              return (
                <Card className="border border-slate-200">
                  <h3 className="font-semibold text-slate-900 mb-4">Other Documents</h3>
                  <div className="space-y-2">
                    {unlinkedDocs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{doc.title}</p>
                            <p className="text-xs text-slate-400">{doc.documentType || 'Other'} · {formatFileSize(doc.fileSize)} · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {/* ═══ EMERGENCY CONTACTS TAB ═══ */}
        {activeTab === 'emergency' && (
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Emergency Contacts</h3>
              {(canManage || isOwnProfile) && (
                <Button size="sm" onClick={() => {
                  setEditingContact(null);
                  setContactForm({ name: '', relationship: '', phone: '', email: '', address: '', isPrimary: false });
                  setShowContactForm(true);
                }}>
                  + Add Contact
                </Button>
              )}
            </div>

            {showContactForm && (
              <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
                <h3 className="font-bold text-slate-900 mb-4">{editingContact ? 'Edit Contact' : 'New Emergency Contact'}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <Input label="Name *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Contact name" />
                  <Input label="Relationship *" value={contactForm.relationship} onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })} placeholder="e.g. Father, Spouse" />
                  <Input label="Phone *" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="Phone number" />
                  <Input label="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} placeholder="Email (optional)" />
                  <div className="sm:col-span-2">
                    <Input label="Address" value={contactForm.address} onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })} placeholder="Address (optional)" />
                  </div>
                </div>
                <label className="flex items-center gap-2 mb-4 cursor-pointer">
                  <input type="checkbox" checked={contactForm.isPrimary} onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-sm text-slate-700 font-medium">Primary contact</span>
                </label>
                <div className="flex gap-2 justify-end">
                  <Button variant="secondary" onClick={() => { setShowContactForm(false); setEditingContact(null); }}>Cancel</Button>
                  <Button onClick={handleSaveContact} loading={contactSaving}>{editingContact ? 'Update' : 'Add'}</Button>
                </div>
              </Card>
            )}

            {contacts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contacts.map(c => (
                  <Card key={c.id} className={`border ${c.isPrimary ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'} group`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.isPrimary ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                          <svg className={`w-5 h-5 ${c.isPrimary ? 'text-emerald-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900">{c.name}</h4>
                          <p className="text-xs text-slate-500">{c.relationship}</p>
                        </div>
                      </div>
                      {c.isPrimary && <Badge variant="success" size="sm">Primary</Badge>}
                    </div>
                    <div className="space-y-1.5 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {c.phone}
                      </div>
                      {c.email && (
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          {c.email}
                        </div>
                      )}
                      {c.address && (
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {c.address}
                        </div>
                      )}
                    </div>
                    {(canManage || isOwnProfile) && (
                      <div className="flex gap-2 pt-3 mt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="secondary" onClick={() => {
                          setEditingContact(c);
                          setContactForm({ name: c.name, relationship: c.relationship, phone: c.phone, email: c.email || '', address: c.address || '', isPrimary: c.isPrimary });
                          setShowContactForm(true);
                        }}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteContact(c.id)}>Delete</Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-slate-600 font-medium">No emergency contacts added</p>
                  <p className="text-sm text-slate-400 mt-1">Add emergency contacts for this employee</p>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={() => confirmDialog.onConfirm()} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} />

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl">📈</span>
                Promotion & Increment History
              </CardTitle>
            </CardHeader>
            <div className="p-6">
              {historyRecords.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-5xl block mb-4">📋</span>
                  <p className="text-slate-600 font-medium">No history records</p>
                  <p className="text-sm text-slate-400 mt-1">Promotions, increments, and transfers will appear here</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-teal-400 to-slate-200" />

                  <div className="space-y-6">
                    {historyRecords.map((h: any, idx: number) => {
                      const typeConfig: Record<string, { icon: string; color: string; border: string }> = {
                        PROMOTION: { icon: '🎉', color: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-500' },
                        INCREMENT: { icon: '💰', color: 'bg-blue-100 text-blue-700', border: 'border-blue-500' },
                        TRANSFER: { icon: '🔄', color: 'bg-amber-100 text-amber-700', border: 'border-amber-500' },
                        PROMOTION_WITH_INCREMENT: { icon: '🚀', color: 'bg-purple-100 text-purple-700', border: 'border-purple-500' },
                        DEMOTION: { icon: '⬇️', color: 'bg-red-100 text-red-700', border: 'border-red-500' },
                        ROLE_CHANGE: { icon: '🔀', color: 'bg-slate-100 text-slate-700', border: 'border-slate-500' },
                        STATUS_CHANGE: { icon: '📋', color: 'bg-orange-100 text-orange-700', border: 'border-orange-500' },
                        TYPE_CHANGE: { icon: '🏷️', color: 'bg-cyan-100 text-cyan-700', border: 'border-cyan-500' },
                      };
                      const tc = typeConfig[h.type] || typeConfig.ROLE_CHANGE;
                      const typeLabel = h.type.replace(/_/g, ' ');
                      return (
                        <div key={h.id} className="relative pl-16">
                          {/* Timeline dot */}
                          <div className={`absolute left-[14px] w-9 h-9 rounded-full flex items-center justify-center border-4 border-white shadow-md bg-white z-10`}>
                            <span className="text-lg">{tc.icon}</span>
                          </div>

                          <div className={`bg-white rounded-xl border-2 ${tc.border} p-4 shadow-sm`}>
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tc.color}`}>{typeLabel}</span>
                              <span className="text-xs text-slate-400">
                                {new Date(h.effectiveDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>

                            <div className="space-y-2 text-sm">
                              {h.oldDesignation && h.newDesignation && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-slate-500">Designation:</span>
                                  <span className="line-through text-slate-400">{h.oldDesignation}</span>
                                  <span className="text-emerald-600">→</span>
                                  <span className="font-semibold text-slate-900">{h.newDesignation}</span>
                                </div>
                              )}
                              {h.oldDepartment && h.newDepartment && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-slate-500">Department:</span>
                                  <span className="line-through text-slate-400">{h.oldDepartment.name}</span>
                                  <span className="text-blue-600">→</span>
                                  <span className="font-semibold text-slate-900">{h.newDepartment.name}</span>
                                </div>
                              )}
                              {h.oldBasicSalary != null && h.newBasicSalary != null && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-slate-500">Salary:</span>
                                  <span className="line-through text-slate-400">Rs {h.oldBasicSalary.toLocaleString()}</span>
                                  <span className="text-amber-600">→</span>
                                  <span className="font-semibold text-slate-900">Rs {h.newBasicSalary.toLocaleString()}</span>
                                  {h.oldBasicSalary > 0 && (
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                                      h.newBasicSalary >= h.oldBasicSalary ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {(((h.newBasicSalary - h.oldBasicSalary) / h.oldBasicSalary) * 100).toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              )}
                              {h.oldEmploymentType && h.newEmploymentType && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-slate-500">Emp. Type:</span>
                                  <span className="line-through text-slate-400">{h.oldEmploymentType.replace(/_/g, ' ')}</span>
                                  <span className="text-teal-600">→</span>
                                  <span className="font-semibold text-slate-900">{h.newEmploymentType.replace(/_/g, ' ')}</span>
                                </div>
                              )}
                              {h.oldEmploymentStatus && h.newEmploymentStatus && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-slate-500">Status:</span>
                                  <span className="line-through text-slate-400">{h.oldEmploymentStatus.replace(/_/g, ' ')}</span>
                                  <span className="text-purple-600">→</span>
                                  <span className="font-semibold text-slate-900">{h.newEmploymentStatus.replace(/_/g, ' ')}</span>
                                </div>
                              )}
                              {h.reason && (
                                <p className="text-slate-500 italic mt-2">Reason: {h.reason}</p>
                              )}
                              {h.remarks && (
                                <p className="text-slate-400 text-xs mt-1">Notes: {h.remarks}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Helper Components
const InfoRow = ({ 
  label, 
  value, 
  isBold = false, 
  isHighlight = false,
  highlightColor = 'emerald'
}: { 
  label: string; 
  value: string; 
  isBold?: boolean; 
  isHighlight?: boolean;
  highlightColor?: 'emerald' | 'emerald';
}) => (
  <div className={`flex justify-between items-center py-2 ${isHighlight ? `bg-${highlightColor}-50 px-4 rounded-lg` : ''}`}>
    <span className="text-sm text-slate-600">{label}</span>
    <span className={`text-sm text-slate-900 ${isBold ? 'font-semibold' : ''} ${isHighlight ? `text-${highlightColor}-700 text-lg` : ''}`}>
      {value}
    </span>
  </div>
);

const StatCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
    <div className="flex items-start justify-between mb-2">
      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
        {icon}
      </div>
    </div>
    <p className="text-xs text-slate-600 mb-1">{label}</p>
    <p className="text-lg font-semibold text-slate-900">{value}</p>
  </div>
);
