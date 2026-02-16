'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import { useToast } from '../../components/ui/Toast';
import { Card, Button, Badge, Modal, Input, Select } from '@/app/components/ui';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface OnboardingItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  isRequired: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  documentUrl: string | null;
  notes: string | null;
  sortOrder: number;
}

interface Onboarding {
  id: string;
  employeeId: string;
  status: string;
  startDate: string;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
  items: OnboardingItem[];
  template: { title: string } | null;
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string;
    profileImage: string | null;
    department: { name: string } | null;
  } | null;
}

interface Template {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  items: { id: string; title: string; description: string | null; category: string; isRequired: boolean; sortOrder: number }[];
  _count?: { onboardings: number };
}

export default function OnboardingPage() {
  const { allowed, loading: permLoading } = useRequirePermission('onboarding', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Onboarding" />;
  return <OnboardingPageContent />;
}

function OnboardingPageContent() {
  const { user, token, hasPermission } = useAuth();
  const toast = useToast();
  const isAdmin = hasPermission('onboarding', 'manage');

  const [activeTab, setActiveTab] = useState<'onboardings' | 'templates'>('onboardings');
  const [onboardings, setOnboardings] = useState<Onboarding[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOnboarding, setSelectedOnboarding] = useState<Onboarding | null>(null);

  // Assign form
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    templateId: '',
    dueDate: '',
    notes: '',
  });

  // Template form
  const [templateForm, setTemplateForm] = useState({
    title: '',
    description: '',
    items: [{ title: '', description: '', category: 'General', isRequired: true }] as { title: string; description: string; category: string; isRequired: boolean }[],
  });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const fetchOnboardings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      const res = await fetch(`/api/onboarding?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOnboardings(data.onboardings || []);
        setEmployees(data.employees || []);
        setTemplates(data.templates || []);
      }
    } catch {
      toast.error('Failed to fetch onboarding data');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/onboarding?view=templates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      toast.error('Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'onboardings') fetchOnboardings();
    else fetchTemplates();
  }, [activeTab, fetchOnboardings, fetchTemplates]);

  const handleAssign = async () => {
    if (!assignForm.employeeId) {
      toast.error('Please select an employee');
      return;
    }
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'assign_onboarding', ...assignForm }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to assign onboarding');
      }
      toast.success('Onboarding assigned successfully');
      setShowAssignModal(false);
      setAssignForm({ employeeId: '', templateId: '', dueDate: '', notes: '' });
      fetchOnboardings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign onboarding');
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateForm.title || !templateForm.items.some(i => i.title.trim())) {
      toast.error('Title and at least one item required');
      return;
    }
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create_template',
          title: templateForm.title,
          description: templateForm.description,
          items: templateForm.items.filter(i => i.title.trim()),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create template');
      }
      toast.success('Template created successfully');
      setShowTemplateModal(false);
      setTemplateForm({ title: '', description: '', items: [{ title: '', description: '', category: 'General', isRequired: true }] });
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create template');
    }
  };

  const handleToggleItem = async (itemId: string, currentCompleted: boolean) => {
    try {
      await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'toggle_item', itemId, completed: !currentCompleted }),
      });
      if (selectedOnboarding) {
        setSelectedOnboarding(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map(i =>
              i.id === itemId ? { ...i, isCompleted: !currentCompleted, completedAt: !currentCompleted ? new Date().toISOString() : null } : i
            ),
          };
        });
      }
      fetchOnboardings();
    } catch {
      toast.error('Failed to update item');
    }
  };

  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  const handleDocumentUpload = async (itemId: string, file: File) => {
    try {
      setUploadingItemId(itemId);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'onboarding');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      const uploadData = await uploadRes.json();
      const documentUrl = uploadData.data.url;

      // Save document URL to the onboarding item
      await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'toggle_item', itemId, completed: true, documentUrl }),
      });

      // Update local state
      if (selectedOnboarding) {
        setSelectedOnboarding(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map(i =>
              i.id === itemId ? { ...i, isCompleted: true, completedAt: new Date().toISOString(), documentUrl } : i
            ),
          };
        });
      }
      fetchOnboardings();
      toast.success('Document uploaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setUploadingItemId(null);
    }
  };

  const getFileIcon = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-red-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    );
    if (['doc', 'docx'].includes(ext)) return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-blue-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    );
    if (['xls', 'xlsx', 'csv'].includes(ext)) return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-green-600">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.75" />
      </svg>
    );
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-purple-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 3h18a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-1.5 1.5H3a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 3 3Zm12 6.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
      </svg>
    );
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-400">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    );
  };

  const getFileName = (url: string) => {
    const parts = url.split('/');
    const fullName = parts[parts.length - 1] || 'document';
    // Remove the userId_timestamp_ prefix
    const match = fullName.match(/^[^_]+_\d+_(.+)$/);
    return match ? match[1].replace(/_/g, ' ') : fullName;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDelete = async (id: string, type: 'onboarding' | 'template') => {
    openConfirm({ title: `Delete ${type === 'template' ? 'Template' : 'Onboarding'}`, message: `Delete this ${type}? This cannot be undone.`, variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/onboarding?id=${id}&type=${type}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          toast.success('Deleted successfully');
          if (type === 'template') fetchTemplates();
          else fetchOnboardings();
        } else {
          toast.error('Failed to delete');
        }
      } catch {
        toast.error('Failed to delete');
      }
    }});
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_status', onboardingId: id, status: newStatus }),
      });
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
      if (selectedOnboarding?.id === id) {
        setSelectedOnboarding(prev => prev ? { ...prev, status: newStatus } : prev);
      }
      fetchOnboardings();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const addTemplateItem = () => {
    setTemplateForm(prev => ({
      ...prev,
      items: [...prev.items, { title: '', description: '', category: 'General', isRequired: true }],
    }));
  };

  const removeTemplateItem = (idx: number) => {
    setTemplateForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
      COMPLETED: { variant: 'success', label: 'Completed' },
      IN_PROGRESS: { variant: 'warning', label: 'In Progress' },
      NOT_STARTED: { variant: 'default', label: 'Not Started' },
      OVERDUE: { variant: 'danger', label: 'Overdue' },
    };
    const c = config[status] || { variant: 'default' as const, label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const getProgress = (items: OnboardingItem[]) => {
    if (!items.length) return 0;
    return Math.round((items.filter(i => i.isCompleted).length / items.length) * 100);
  };

  const categories = ['General', 'IT Setup', 'HR Documents', 'Training', 'Compliance', 'Benefits', 'Other'];

  const statusOptions = [
    { label: 'All Status', value: 'ALL' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Not Started', value: 'NOT_STARTED' },
    { label: 'Overdue', value: 'OVERDUE' },
  ];

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Onboarding</h1>
              <p className="text-teal-100 text-sm mt-0.5">Manage employee onboarding workflows and checklists</p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setShowTemplateModal(true)} size="sm" className="!bg-white/90 !text-teal-700 hover:!bg-white border-0 shadow-sm font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 mr-1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              New Template
            </Button>
            <Button variant="ghost" onClick={() => setShowAssignModal(true)} size="sm" className="!bg-white !text-teal-700 hover:!bg-teal-50 border-0 shadow-md font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 mr-1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
              </svg>
              Assign Onboarding
            </Button>
          </div>
        )}
        </div>
      </div>

      {/* Summary Stats */}
      {isAdmin && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{onboardings.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4">
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">In Progress</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{onboardings.filter(o => o.status === 'IN_PROGRESS').length}</p>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 p-4">
            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Completed</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{onboardings.filter(o => o.status === 'COMPLETED').length}</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4">
            <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Overdue</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{onboardings.filter(o => o.status === 'OVERDUE').length}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      {isAdmin && (
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('onboardings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'onboardings' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Onboardings
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'templates' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Templates
          </button>
        </div>
      )}

      {activeTab === 'onboardings' && (
        <>
          {/* Status Filter */}
          <div className="flex items-center gap-3 flex-wrap">
            {statusOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  statusFilter === opt.value 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {opt.label}
                {opt.value !== 'ALL' && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    statusFilter === opt.value ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {onboardings.filter(o => opt.value === 'ALL' ? true : o.status === opt.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Onboarding Cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="skeleton w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-3/4 rounded-lg" />
                      <div className="skeleton h-3 w-1/2 rounded-lg" />
                    </div>
                  </div>
                  <div className="skeleton h-2 w-full rounded-full mb-3" />
                  <div className="space-y-2">
                    <div className="skeleton h-3 w-full rounded-lg" />
                    <div className="skeleton h-3 w-4/5 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : onboardings.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-16 h-16 mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                <p className="text-lg font-medium text-gray-500">No onboarding records</p>
                <p className="text-sm text-gray-400 mt-1">Assign an onboarding to get started</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {onboardings.map(ob => {
                const progress = getProgress(ob.items);
                const completed = ob.items.filter(i => i.isCompleted).length;
                const total = ob.items.length;

                return (
                  <div
                    key={ob.id}
                    className="bg-white rounded-xl border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => { setSelectedOnboarding(ob); setShowDetailModal(true); }}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-semibold text-sm">
                            {ob.employee ? `${ob.employee.firstName[0]}${ob.employee.lastName[0]}` : '??'}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm group-hover:text-emerald-600 transition-colors">
                              {ob.employee ? `${ob.employee.firstName} ${ob.employee.lastName}` : 'Unknown'}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {ob.employee?.department?.name || 'No Department'} • {ob.employee?.employeeCode}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(ob.status)}
                      </div>

                      {ob.template && (
                        <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                          {ob.template.title}
                        </p>
                      )}

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-gray-600">{completed}/{total} tasks</span>
                          <span className="text-xs font-bold text-emerald-600">{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-emerald-400' : progress > 0 ? 'bg-amber-400' : 'bg-gray-300'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>
                          {ob.dueDate
                            ? `Due ${new Date(ob.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                            : `Started ${new Date(ob.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(ob.id, 'onboarding'); }}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && isAdmin && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="skeleton h-5 w-2/3 rounded-lg mb-3" />
                  <div className="skeleton h-3 w-full rounded-lg mb-4" />
                  <div className="space-y-2">
                    <div className="skeleton h-3 w-4/5 rounded-lg" />
                    <div className="skeleton h-3 w-3/5 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-16 h-16 mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <p className="text-lg font-medium text-gray-500">No templates yet</p>
                <p className="text-sm text-gray-400 mt-1">Create a template to streamline onboarding</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {templates.map(tpl => (
                <div key={tpl.id} className="bg-white rounded-xl border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-violet-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">{tpl.title}</h3>
                        {tpl._count && (
                          <p className="text-xs text-gray-400">{tpl._count.onboardings} used</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={tpl.isActive ? 'success' : 'default'}>
                      {tpl.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {tpl.description && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{tpl.description}</p>
                  )}

                  <div className="space-y-1.5 mb-4">
                    {tpl.items.slice(0, 4).map(item => (
                      <div key={item.id} className="flex items-center gap-2 text-xs text-gray-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <span className="truncate">{item.title}</span>
                        {item.isRequired && <span className="text-red-400">*</span>}
                      </div>
                    ))}
                    {tpl.items.length > 4 && (
                      <p className="text-xs text-gray-400 pl-3.5">+{tpl.items.length - 4} more items</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">{tpl.items.length} items</span>
                    <button
                      onClick={() => handleDelete(tpl.id, 'template')}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedOnboarding && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => { setShowDetailModal(false); setSelectedOnboarding(null); }}
          title={`Onboarding - ${selectedOnboarding.employee?.firstName} ${selectedOnboarding.employee?.lastName}`}
        >
          <div className="space-y-4">
            {/* Employee Info Bar */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-base">
                {selectedOnboarding.employee ? `${selectedOnboarding.employee.firstName[0]}${selectedOnboarding.employee.lastName[0]}` : '??'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900">
                  {selectedOnboarding.employee ? `${selectedOnboarding.employee.firstName} ${selectedOnboarding.employee.lastName}` : 'Unknown'}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedOnboarding.employee?.department?.name || 'No Department'} • {selectedOnboarding.employee?.employeeCode}
                </p>
              </div>
              {getStatusBadge(selectedOnboarding.status)}
            </div>

            {/* Status Update Buttons (Admin) */}
            {isAdmin && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-500 mr-1">Set Status:</span>
                {['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'].map(s => (
                  <button
                    key={s}
                    onClick={() => handleUpdateStatus(selectedOnboarding.id, s)}
                    disabled={selectedOnboarding.status === s}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      selectedOnboarding.status === s
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-700 cursor-default'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}

            {/* Progress Summary */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {selectedOnboarding.template && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                      {selectedOnboarding.template.title}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-emerald-600">{getProgress(selectedOnboarding.items)}%</span>
              </div>
              <div className="w-full bg-white/60 rounded-full h-2.5">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${getProgress(selectedOnboarding.items)}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 mt-2">
                {selectedOnboarding.items.filter(i => i.isCompleted).length} of {selectedOnboarding.items.length} tasks completed
              </p>
            </div>

            {/* Info bar */}
            <div className="flex items-center gap-3 text-xs text-gray-400 px-1">
              <span className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                {selectedOnboarding.items.filter(i => i.documentUrl).length} documents attached
              </span>
              {selectedOnboarding.dueDate && (
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  Due {new Date(selectedOnboarding.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>

            {/* Grouped items */}
            {(() => {
              const grouped = selectedOnboarding.items.reduce((acc, item) => {
                if (!acc[item.category]) acc[item.category] = [];
                acc[item.category].push(item);
                return acc;
              }, {} as Record<string, OnboardingItem[]>);

              return Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{category}</h4>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                      {items.filter(i => i.isCompleted).length}/{items.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map(item => (
                      <div
                        key={item.id}
                        className={`rounded-xl border transition-all ${item.isCompleted ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-gray-200 hover:border-emerald-300'}`}
                      >
                        <div className="flex items-start gap-3 p-3">
                          <button
                            onClick={() => handleToggleItem(item.id, item.isCompleted)}
                            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${item.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-emerald-400'}`}
                          >
                            {item.isCompleted && (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${item.isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                {item.title}
                              </span>
                              {item.isRequired && <span className="text-[10px] text-red-400 font-bold bg-red-50 px-1.5 py-0.5 rounded">Required</span>}
                            </div>
                            {item.description && (
                              <p className={`text-xs mt-0.5 ${item.isCompleted ? 'text-gray-300' : 'text-gray-500'}`}>{item.description}</p>
                            )}

                            {/* Document Section */}
                            {item.documentUrl ? (
                              <div className="mt-2 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                                {getFileIcon(item.documentUrl)}
                                <span className="text-xs text-gray-700 truncate flex-1">{getFileName(item.documentUrl)}</span>
                                <a
                                  href={item.documentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                  </svg>
                                  View
                                </a>
                              </div>
                            ) : (
                              <div className="mt-2">
                                <label className="group flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-emerald-600 transition-colors">
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleDocumentUpload(item.id, file);
                                      e.target.value = '';
                                    }}
                                    disabled={uploadingItemId === item.id}
                                  />
                                  {uploadingItemId === item.id ? (
                                    <span className="flex items-center gap-1.5 text-emerald-600">
                                      <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Uploading...
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1.5 border border-dashed border-gray-300 group-hover:border-emerald-400 rounded-lg px-3 py-1.5 transition-colors">
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                      </svg>
                                      Attach Document
                                    </span>
                                  )}
                                </label>
                              </div>
                            )}

                            {item.completedAt && (
                              <p className="text-[10px] text-emerald-500 mt-1.5 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                                Completed {new Date(item.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}

            {/* Notes */}
            {selectedOnboarding.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-medium text-amber-700 mb-1">Notes</p>
                <p className="text-xs text-amber-600">{selectedOnboarding.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Onboarding">
          <div className="space-y-4">
            <Select
              label="Employee"
              value={assignForm.employeeId}
              onChange={(e) => setAssignForm(prev => ({ ...prev, employeeId: e.target.value }))}
              options={[{ label: 'Select Employee', value: '' }, ...employees.map(e => ({ label: `${e.firstName} ${e.lastName} (${e.employeeCode})`, value: e.id }))]}
            />
            <Select
              label="Template (Optional)"
              value={assignForm.templateId}
              onChange={(e) => setAssignForm(prev => ({ ...prev, templateId: e.target.value }))}
              options={[{ label: 'No Template - Custom Items', value: '' }, ...templates.map(t => ({ label: `${t.title} (${t.items?.length || 0} items)`, value: t.id }))]}
            />
            <Input
              label="Due Date (Optional)"
              type="date"
              value={assignForm.dueDate}
              onChange={(e) => setAssignForm(prev => ({ ...prev, dueDate: e.target.value }))}
            />
            <Input
              label="Notes (Optional)"
              value={assignForm.notes}
              onChange={(e) => setAssignForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional notes..."
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Cancel</Button>
              <Button onClick={handleAssign}>Assign Onboarding</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <Modal isOpen={showTemplateModal} onClose={() => setShowTemplateModal(false)} title="Create Template">
          <div className="space-y-4">
            <Input
              label="Template Name"
              value={templateForm.title}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Standard Employee Onboarding"
            />
            <Input
              label="Description"
              value={templateForm.description}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this template..."
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Checklist Items</label>
                <button onClick={addTemplateItem} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                  + Add Item
                </button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {templateForm.items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-gray-50 rounded-lg p-3">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Task title"
                        value={item.title}
                        onChange={(e) => {
                          const items = [...templateForm.items];
                          items[idx].title = e.target.value;
                          setTemplateForm(prev => ({ ...prev, items }));
                        }}
                      />
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Select
                            value={item.category}
                            onChange={(e) => {
                              const items = [...templateForm.items];
                              items[idx].category = e.target.value;
                              setTemplateForm(prev => ({ ...prev, items }));
                            }}
                            options={categories.map(c => ({ label: c, value: c }))}
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={item.isRequired}
                            onChange={(e) => {
                              const items = [...templateForm.items];
                              items[idx].isRequired = e.target.checked;
                              setTemplateForm(prev => ({ ...prev, items }));
                            }}
                            className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                          />
                          Required
                        </label>
                      </div>
                    </div>
                    {templateForm.items.length > 1 && (
                      <button
                        onClick={() => removeTemplateItem(idx)}
                        className="text-gray-300 hover:text-red-500 mt-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
              <Button onClick={handleCreateTemplate}>Create Template</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
    <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={() => confirmDialog.onConfirm()} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} />
    </>
  );
}
