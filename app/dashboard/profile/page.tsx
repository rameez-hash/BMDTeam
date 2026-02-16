'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import Image from 'next/image';
import DocumentsTab from './DocumentsTab';

interface EmergencyContact {
  id?: string;
  name: string;
  phone: string;
  relationship: string;
}

interface EmployeeProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
  nic?: string;
  bloodGroup?: string;
  joiningDate?: string;
  employmentStatus?: string;
  employmentType?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  profileImage?: string;
  employeeCode?: string;
  designation?: string;
  panNumber?: string;
  bankName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  branchAddress?: string;
  department?: { name: string };
  shift?: { id: string; name: string; startTime?: string; endTime?: string };
  reportingManager?: { id: string; firstName: string; lastName: string; employeeCode: string };
  appRole?: { id: string; name: string; color: string };
  salary?: {
    basicSalary: number;
    grossSalary: number;
    netSalary: number;
    hra: number;
    da: number;
    ta: number;
    medicalAllowance: number;
    otherAllowances: number;
    pf: number;
    esi: number;
    professionalTax: number;
    tds: number;
    otherDeductions: number;
  };
  emergencyContacts?: EmergencyContact[];
}

export default function ProfilePage() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [formData, setFormData] = useState({
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
    panNumber: '',
    bankName: '',
    bankAccountNumber: '',
    ifscCode: '',
    branchAddress: '',
  });
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);

  const PAKISTAN_BANKS = [
    'Allied Bank Limited (ABL)',
    'Askari Bank Limited',
    'Bank Alfalah Limited',
    'Bank Al-Habib Limited',
    'Bank of Punjab (BOP)',
    'Faysal Bank Limited',
    'Habib Bank Limited (HBL)',
    'Habib Metropolitan Bank',
    'JS Bank Limited',
    'MCB Bank Limited',
    'Meezan Bank Limited',
    'National Bank of Pakistan (NBP)',
    'Silk Bank Limited',
    'Soneri Bank Limited',
    'Standard Chartered Pakistan',
    'Summit Bank Limited',
    'United Bank Limited (UBL)',
    'Zarai Taraqiati Bank Limited',
    'Easypaisa (Telenor Microfinance Bank)',
    'JazzCash (Mobilink Microfinance Bank)',
    'SadaPay',
    'NayaPay',
  ];
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user?.employee) {
          setProfile(data.user.employee);
          setFormData({
            phone: data.user.employee.phone || '',
            address: data.user.employee.address || '',
            city: data.user.employee.city || '',
            state: data.user.employee.state || '',
            country: data.user.employee.country || '',
            zipCode: data.user.employee.zipCode || '',
            panNumber: data.user.employee.panNumber || '',
            bankName: data.user.employee.bankName || '',
            bankAccountNumber: data.user.employee.bankAccountNumber || '',
            ifscCode: data.user.employee.ifscCode || '',
            branchAddress: data.user.employee.branchAddress || '',
          });
          setEmergencyContacts(data.user.employee.emergencyContacts || []);
        }
      }
    } catch (error) {
      toast.error('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchProfile();
  }, [token, fetchProfile]);

  useEffect(() => {
    if (token && profile?.id && activeTab === 'history') {
      fetchHistory();
    }
  }, [token, profile?.id, activeTab]);

  const fetchHistory = async () => {
    if (!profile?.id) return;
    try {
      const res = await fetch(`/api/promotions?employeeId=${profile.id}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryRecords(data.data || []);
      }
    } catch { /* silent */ }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/employees/${profile?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...formData, emergencyContacts }),
      });
      if (res.ok) {
        setEditMode(false);
        fetchProfile();
        toast.success('Profile updated successfully!');
      } else {
        toast.error('Failed to update profile');
      }
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });
      
      if (res.ok) {
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordError('');
        toast.success('Password changed successfully!');
      } else {
        const data = await res.json();
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError('Failed to change password');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setImageError('');

    try {
      // Upload file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'profile');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || 'Failed to upload image');
      }

      const uploadData = await uploadRes.json();

      // Update profile with new image URL
      const updateRes = await fetch(`/api/employees/${profile?.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ profileImage: uploadData.data.url }),
      });

      if (!updateRes.ok) {
        throw new Error('Failed to update profile image');
      }

      // Refresh profile
      fetchProfile();
      toast.success('Profile image updated successfully!');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to upload image';
      setImageError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-48 bg-white rounded-2xl skeleton" />
        <div className="h-64 bg-white rounded-2xl skeleton" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-slate-500">Profile not found</p>
        </div>
      </Card>
    );
  }

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  const formatGender = (g?: string) => g ? g.charAt(0) + g.slice(1).toLowerCase() : '—';
  const formatMarital = (m?: string) => m ? m.charAt(0) + m.slice(1).toLowerCase() : '—';
  const formatEmploymentType = (t?: string) => {
    const map: Record<string, string> = { PERMANENT: 'Permanent', CONTRACT: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Intern', PART_TIME: 'Part-Time', REMOTE: 'Remote', FREELANCER: 'Freelancer', CONSULTANT: 'Consultant' };
    return t ? (map[t] || t) : '—';
  };

  const totalDeductions = profile.salary ? (profile.salary.pf + profile.salary.esi + profile.salary.professionalTax + profile.salary.tds + profile.salary.otherDeductions) : 0;

  const tabs = [
    { id: 'personal', name: 'Personal', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { id: 'employment', name: 'Employment', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M3 8a2 2 0 012-2h14a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /></svg> },
    { id: 'salary', name: 'Salary', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { id: 'documents', name: 'Documents', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { id: 'security', name: 'Security', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> },
    { id: 'history', name: 'History', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
  ];

  // Helper to render an info item beautifully
  const InfoItem = ({ icon, label, value, className = '' }: { icon: React.ReactNode; label: string; value: string | React.ReactNode; className?: string }) => (
    <div className={`flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors ${className}`}>
      <div className="w-9 h-9 rounded-lg bg-white shadow-sm border border-slate-200/60 flex items-center justify-center flex-shrink-0 text-slate-500">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        <div className="text-sm font-medium text-slate-800 mt-0.5 truncate">{value || '—'}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ══════ Profile Hero ══════ */}
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
        {/* Cover gradient */}
        <div className="h-36 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxLjUiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-60" />
          {/* Edit + Photo buttons top-right */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
              className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-white transition-colors" title="Change Photo">
              {uploadingImage ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              )}
            </button>
            <button onClick={() => setEditMode(!editMode)}
              className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-white transition-colors" title={editMode ? 'Cancel Edit' : 'Edit Profile'}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleImageUpload} className="hidden" />

        {/* Profile info centered */}
        <div className="relative px-6 pb-6">
          <div className="flex flex-col items-center -mt-16">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-28 h-28 rounded-2xl bg-white shadow-lg border-4 border-white overflow-hidden">
                {profile.profileImage ? (
                  <Image src={profile.profileImage} alt={`${profile.firstName} ${profile.lastName}`} width={112} height={112} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-emerald-600 bg-emerald-50">{profile.firstName[0]}{profile.lastName[0]}</div>
                )}
              </div>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
                className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                {uploadingImage ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                }
              </button>
            </div>

            {/* Name + info */}
            <h1 className="text-xl font-bold text-slate-900 mt-4">{profile.firstName} {profile.lastName}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{profile.designation || 'Employee'}{profile.department?.name ? ` · ${profile.department.name}` : ''}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              <Badge variant={['ACTIVE'].includes(profile.employmentStatus || '') ? 'success' : ['SUSPENDED', 'TERMINATED', 'ABSCONDED'].includes(profile.employmentStatus || '') ? 'danger' : ['ON_LEAVE', 'ON_NOTICE', 'RESIGNED'].includes(profile.employmentStatus || '') ? 'warning' : ['PROBATION'].includes(profile.employmentStatus || '') ? 'info' : 'default'}>{({ ACTIVE: 'Active', INACTIVE: 'Inactive', ON_LEAVE: 'On Leave', PROBATION: 'Probation', SUSPENDED: 'Suspended', RESIGNED: 'Resigned', TERMINATED: 'Terminated', ON_NOTICE: 'On Notice', RETIRED: 'Retired', ABSCONDED: 'Absconded' } as Record<string, string>)[profile.employmentStatus || ''] || profile.employmentStatus || 'Active'}</Badge>
              {profile.employeeCode && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md font-mono">{profile.employeeCode}</span>}
              {profile.appRole && <span className="text-xs px-2.5 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: profile.appRole.color || '#6B7280' }}>{profile.appRole.name}</span>}
            </div>
            {imageError && <p className="text-red-500 text-sm mt-2">{imageError}</p>}

            {/* Quick stats row */}
            <div className="flex gap-6 mt-5 pt-5 border-t border-slate-100 w-full max-w-lg justify-center">
              <div className="text-center">
                <p className="text-xs text-slate-400 font-medium">Joined</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' }) : '—'}</p>
              </div>
              <div className="w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-xs text-slate-400 font-medium">Shift</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{profile.shift?.name || '—'}</p>
              </div>
              <div className="w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-xs text-slate-400 font-medium">Department</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{profile.department?.name || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ Pill Tabs ══════ */}
      <div className="flex gap-2 overflow-x-auto pb-1 px-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 hover:border-slate-300'
            }`}>
            <span className={activeTab === tab.id ? 'text-emerald-100' : 'text-slate-400'}>{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </div>

      {/* ═══ PERSONAL TAB ═══ */}
      {activeTab === 'personal' && (
        <div className="space-y-6">
          {editMode ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-5 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div>
                Edit Personal Information
              </h3>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="First Name" value={profile.firstName} disabled />
                  <Input label="Last Name" value={profile.lastName} disabled />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Email" value={profile.email} disabled />
                  <Input label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+92 XXX XXXXXXX" />
                </div>
                <Input label="Address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Street address" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="City" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                  <Input label="State / Province" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Country" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
                  <Input label="Zip / Postal Code" value={formData.zipCode} onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })} />
                </div>
                {/* ── Emergency Contacts ── */}
                <div className="border-t border-slate-100 pt-5 mt-5">
                  <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center"><svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></div>
                    Emergency Contacts
                  </h4>
                  <div className="space-y-3">
                    {emergencyContacts.map((contact, index) => (
                      <div key={index} className="p-4 bg-red-50/50 rounded-xl border border-red-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Contact {index + 1}</span>
                          <button type="button" onClick={() => setEmergencyContacts(emergencyContacts.filter((_, i) => i !== index))}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Input label="Name" value={contact.name} onChange={(e) => { const updated = [...emergencyContacts]; updated[index] = { ...updated[index], name: e.target.value }; setEmergencyContacts(updated); }} placeholder="Contact name" />
                          <Input label="Phone" value={contact.phone} onChange={(e) => { const updated = [...emergencyContacts]; updated[index] = { ...updated[index], phone: e.target.value }; setEmergencyContacts(updated); }} placeholder="+92 XXX XXXXXXX" />
                          <Input label="Relationship" value={contact.relationship} onChange={(e) => { const updated = [...emergencyContacts]; updated[index] = { ...updated[index], relationship: e.target.value }; setEmergencyContacts(updated); }} placeholder="e.g., Father, Mother" />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setEmergencyContacts([...emergencyContacts, { name: '', phone: '', relationship: '' }])}
                      className="w-full py-3 border-2 border-dashed border-red-200 hover:border-red-300 rounded-xl text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50/50 transition-colors flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      Add Emergency Contact
                    </button>
                  </div>
                </div>

                {/* ── Bank Details (Pakistan) ── */}
                <div className="border-t border-slate-100 pt-5 mt-5">
                  <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center"><svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21" /></svg></div>
                    Bank Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank Name</label>
                      <select value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white">
                        <option value="">Select Bank</option>
                        {PAKISTAN_BANKS.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                      </select>
                    </div>
                    <Input label="Account Number" value={formData.bankAccountNumber} onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })} placeholder="Enter account number" />
                    <Input label="IBAN" value={formData.ifscCode} onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })} placeholder="PK00XXXX0000000000000000" />
                    <Input label="Branch Address" value={formData.branchAddress} onChange={(e) => setFormData({ ...formData, branchAddress: e.target.value })} placeholder="Branch name / address" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="secondary" type="button" onClick={() => setEditMode(false)}>Cancel</Button>
                  <Button type="submit">Save Changes</Button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Basic Info */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg></div>
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} label="Full Name" value={`${profile.firstName} ${profile.lastName}`} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} label="Email" value={profile.email} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 5z" /></svg>} label="Phone" value={profile.phone || '—'} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>} label="Employee Code" value={<span className="font-mono">{profile.employeeCode || '—'}</span>} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} label="Date of Birth" value={formatDate(profile.dateOfBirth)} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} label="Gender" value={formatGender(profile.gender)} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>} label="Marital Status" value={formatMarital(profile.maritalStatus)} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>} label="CNIC Number" value={profile.nic || profile.panNumber || '—'} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="Nationality" value={profile.nationality || '—'} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>} label="Blood Group" value={profile.bloodGroup || '—'} />
                </div>
              </div>

              {/* Address */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg></div>
                  Address
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <InfoItem className="md:col-span-2 xl:col-span-3" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} label="Address" value={profile.address || '—'} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} label="City" value={profile.city || '—'} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>} label="State / Province" value={profile.state || '—'} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="Country" value={profile.country || '—'} />
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></div>
                  Emergency Contacts
                </h3>
                {profile.emergencyContacts && profile.emergencyContacts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {profile.emergencyContacts.map((c, i) => (
                      <div key={c.id || i} className="flex items-center gap-3 p-4 bg-red-50/50 rounded-xl border border-red-100">
                        <div className="w-10 h-10 bg-white rounded-lg shadow-sm border border-red-200/60 flex items-center justify-center text-red-600 font-bold text-sm flex-shrink-0">
                          {c.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.relationship} · {c.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-6">No emergency contacts on file</p>
                )}
              </div>

              {/* Bank & Tax */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21" /></svg></div>
                  Bank Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} label="Bank Name" value={profile.bankName || '—'} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>} label="Account Number" value={profile.bankAccountNumber || '—'} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>} label="IBAN" value={profile.ifscCode || '—'} />
                  <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} label="Branch Address" value={profile.branchAddress || '—'} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ EMPLOYMENT TAB ═══ */}
      {activeTab === 'employment' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></div>
            Employment Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} label="Department" value={profile.department?.name || '—'} />
            <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M3 8a2 2 0 012-2h14a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /></svg>} label="Designation" value={profile.designation || '—'} />
            <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} label="Role" value={profile.appRole?.name || '—'} />
            <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="Shift" value={profile.shift ? (profile.shift.startTime ? `${profile.shift.name} (${profile.shift.startTime} - ${profile.shift.endTime})` : profile.shift.name) : '—'} />
            <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} label="Reporting Manager" value={profile.reportingManager ? `${profile.reportingManager.firstName} ${profile.reportingManager.lastName} (${profile.reportingManager.employeeCode})` : '—'} />
            <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} label="Date of Joining" value={formatDate(profile.joiningDate)} />
            <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} label="Employment Type" value={formatEmploymentType(profile.employmentType)} />
            <InfoItem icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="Employment Status" value={<Badge variant={['ACTIVE'].includes(profile.employmentStatus || '') ? 'success' : ['SUSPENDED', 'TERMINATED', 'ABSCONDED'].includes(profile.employmentStatus || '') ? 'danger' : ['ON_LEAVE', 'ON_NOTICE', 'RESIGNED'].includes(profile.employmentStatus || '') ? 'warning' : ['PROBATION'].includes(profile.employmentStatus || '') ? 'info' : 'default'}>{({ ACTIVE: 'Active', INACTIVE: 'Inactive', ON_LEAVE: 'On Leave', PROBATION: 'Probation', SUSPENDED: 'Suspended', RESIGNED: 'Resigned', TERMINATED: 'Terminated', ON_NOTICE: 'On Notice', RETIRED: 'Retired', ABSCONDED: 'Absconded' } as Record<string, string>)[profile.employmentStatus || ''] || profile.employmentStatus || '—'}</Badge>} />
          </div>
        </div>
      )}

      {/* ═══ SALARY TAB ═══ */}
      {activeTab === 'salary' && (
        <div className="space-y-6">
          {profile.salary ? (
            <>
              {/* Net Salary Banner */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-6 text-white">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxLjUiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-60" />
                <div className="relative">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <p className="text-sm font-medium text-emerald-100">Net Monthly Salary</p>
                      <p className="text-xs text-white/60 mt-0.5">After all deductions</p>
                    </div>
                    <p className="font-bold text-4xl tracking-tight">Rs {profile.salary.netSalary.toLocaleString()}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/20">
                    <div className="text-center">
                      <p className="text-xs text-white/60">Annual Gross</p>
                      <p className="font-bold text-lg mt-0.5">Rs {(profile.salary.grossSalary * 12).toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-white/60">Annual Deductions</p>
                      <p className="font-bold text-lg mt-0.5 text-rose-200">Rs {(totalDeductions * 12).toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-white/60">Annual Net</p>
                      <p className="font-bold text-lg mt-0.5">Rs {(profile.salary.netSalary * 12).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Earnings */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" /></svg></div>
                    Earnings
                  </h3>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                      <span className="text-slate-600">Basic Salary</span>
                      <span className="font-medium text-slate-800">Rs {profile.salary.basicSalary.toLocaleString()}</span>
                    </div>
                    {profile.salary.hra > 0 && <div className="flex justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"><span className="text-slate-600">HRA</span><span className="font-medium text-slate-800">Rs {profile.salary.hra.toLocaleString()}</span></div>}
                    {profile.salary.da > 0 && <div className="flex justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"><span className="text-slate-600">Dearness Allowance</span><span className="font-medium text-slate-800">Rs {profile.salary.da.toLocaleString()}</span></div>}
                    {profile.salary.ta > 0 && <div className="flex justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"><span className="text-slate-600">Transport Allowance</span><span className="font-medium text-slate-800">Rs {profile.salary.ta.toLocaleString()}</span></div>}
                    {profile.salary.medicalAllowance > 0 && <div className="flex justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"><span className="text-slate-600">Medical Allowance</span><span className="font-medium text-slate-800">Rs {profile.salary.medicalAllowance.toLocaleString()}</span></div>}
                    {profile.salary.otherAllowances > 0 && <div className="flex justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"><span className="text-slate-600">Other Allowances</span><span className="font-medium text-slate-800">Rs {profile.salary.otherAllowances.toLocaleString()}</span></div>}
                    <div className="flex justify-between pt-3 mt-2 font-semibold bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                      <span className="text-emerald-800">Gross Salary</span>
                      <span className="text-emerald-600">Rs {profile.salary.grossSalary.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                    Deductions
                  </h3>
                  <div className="space-y-1">
                    {profile.salary.tds > 0 && <div className="flex justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"><span className="text-slate-600">Income Tax (FBR)</span><span className="font-medium text-rose-600">- Rs {profile.salary.tds.toLocaleString()}</span></div>}
                    {profile.salary.pf > 0 && <div className="flex justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"><span className="text-slate-600">Provident Fund (PF)</span><span className="font-medium text-rose-600">- Rs {profile.salary.pf.toLocaleString()}</span></div>}
                    {profile.salary.esi > 0 && <div className="flex justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"><span className="text-slate-600">ESI</span><span className="font-medium text-rose-600">- Rs {profile.salary.esi.toLocaleString()}</span></div>}
                    {profile.salary.professionalTax > 0 && <div className="flex justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"><span className="text-slate-600">Professional Tax</span><span className="font-medium text-rose-600">- Rs {profile.salary.professionalTax.toLocaleString()}</span></div>}
                    {profile.salary.otherDeductions > 0 && <div className="flex justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"><span className="text-slate-600">Other Deductions</span><span className="font-medium text-rose-600">- Rs {profile.salary.otherDeductions.toLocaleString()}</span></div>}
                    {totalDeductions === 0 && <p className="text-sm text-slate-400 text-center py-6">No deductions</p>}
                    {totalDeductions > 0 && (
                      <div className="flex justify-between pt-3 mt-2 font-semibold bg-rose-50 p-3 rounded-xl border border-rose-100">
                        <span className="text-rose-800">Total Deductions</span>
                        <span className="text-rose-600">- Rs {totalDeductions.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tax Info */}
              <div className="flex gap-3 bg-blue-50 p-4 rounded-2xl border border-blue-200">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Tax Calculation</p>
                  <p className="text-xs leading-relaxed text-blue-700">Income Tax is calculated on annual income (monthly × 12) according to Pakistan Income Tax Act 2025-2026. Monthly Tax: <strong>Rs {profile.salary.tds.toLocaleString()}</strong> | Annual Tax: <strong>Rs {(profile.salary.tds * 12).toLocaleString()}</strong></p>
                </div>
              </div>

              {/* PF Balance Card */}
              {profile.salary.pf > 0 && (
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-200 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-violet-100 border border-violet-200 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-violet-900">Provident Fund</p>
                      <p className="text-xs text-violet-600">Monthly: Rs {profile.salary.pf.toLocaleString()} (Employee) + Rs {profile.salary.pf.toLocaleString()} (Company)</p>
                    </div>
                    <a
                      href="/dashboard/provident-fund"
                      className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-200 transition-colors"
                    >
                      View Ledger →
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-slate-600 font-medium">Salary information not available yet</p>
                <p className="text-sm text-slate-400 mt-1">Please contact your HR department</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ DOCUMENTS TAB ═══ */}
      {activeTab === 'documents' && (
        <DocumentsTab employeeId={profile.id} canEdit={true} />
      )}

      {/* ═══ SECURITY TAB ═══ */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg></div>
            Change Password
          </h3>
            <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {passwordError}
                </div>
              )}
              <Input
                type={showCurrentPassword ? "text" : "password"}
                label="Current Password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                required
                rightIcon={
                  showCurrentPassword ? (
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
                onRightIconClick={() => setShowCurrentPassword(!showCurrentPassword)}
              />
              <Input
                type={showNewPassword ? "text" : "password"}
                label="New Password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
                rightIcon={
                  showNewPassword ? (
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
                onRightIconClick={() => setShowNewPassword(!showNewPassword)}
              />
              <Input
                type={showConfirmPassword ? "text" : "password"}
                label="Confirm New Password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
                rightIcon={
                  showConfirmPassword ? (
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
                onRightIconClick={() => setShowConfirmPassword(!showConfirmPassword)}
              />
              <Button type="submit">Update Password</Button>
            </form>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">📈</span>
              Promotion & Increment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyRecords.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-5xl block mb-4">📋</span>
                <p className="text-slate-600 font-medium">No history records yet</p>
                <p className="text-sm text-slate-400 mt-1">Your promotions, increments, and transfers will appear here</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-teal-400 to-slate-200" />
                <div className="space-y-6">
                  {historyRecords.map((h: any) => {
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
                        <div className="absolute left-[14px] w-9 h-9 rounded-full flex items-center justify-center border-4 border-white shadow-md bg-white z-10">
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
                            {h.reason && <p className="text-slate-500 italic mt-2">Reason: {h.reason}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
