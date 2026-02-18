'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input, Select } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

interface Document {
  id: string;
  employeeId: string;
  documentType: string;
  title: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  description?: string;
  isApproved: boolean;
  expiryDate?: string;
  visibility: string;
  uploadedAt: string;
  employee: { firstName: string; lastName: string; employeeCode: string; profileImage?: string };
}

const DOC_TYPES = [
  { value: 'NIC', label: 'National ID Card (NIC)' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'EDUCATION_CERTIFICATE', label: 'Education Certificate' },
  { value: 'EXPERIENCE_LETTER', label: 'Experience Letter' },
  { value: 'MEDICAL_REPORT', label: 'Medical Report' },
  { value: 'OTHER', label: 'Other' },
];

const DOC_TYPE_ICONS: Record<string, string> = {
  NIC: 'ID', PASSPORT: 'PP', DRIVING_LICENSE: 'DL', BANK_STATEMENT: 'BS',
  EDUCATION_CERTIFICATE: 'EC', EXPERIENCE_LETTER: 'EL', MEDICAL_REPORT: 'MR', OTHER: 'DOC',
};

export default function DocumentsPage() {
  const { allowed, loading: permLoading } = useRequirePermission('documents', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Documents" />;
  return <DocumentsPageContent />;
}

function DocumentsPageContent() {
  const { user, token } = useAuth();
  const toast = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    documentType: 'OTHER', title: '', description: '', expiryDate: '', visibility: 'ALL',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'HR';
  const canManage = hasPermission('documents', 'manage');

  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedType) params.set('type', selectedType);
      if (search) params.set('search', search);
      const res = await fetch(`/api/documents?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [token, selectedType, search]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleUpload = async () => {
    if (!uploadFile || !uploadForm.title) {
      toast.error('Please fill in title and select a file');
      return;
    }
    setUploading(true);
    try {
      // First upload file
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('type', 'documents');
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const url = uploadData.url || uploadData.data?.url;
      const size = uploadData.size || uploadData.data?.size;

      // Then create document record
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...uploadForm,
          filePath: url,
          fileSize: size || uploadFile.size,
          fileType: uploadFile.name.split('.').pop()?.toUpperCase() || 'PDF',
        }),
      });
      if (res.ok) {
        toast.success('Document uploaded successfully');
        setShowUpload(false);
        setUploadForm({ documentType: 'OTHER', title: '', description: '', expiryDate: '', visibility: 'ALL' });
        setUploadFile(null);
        fetchDocuments();
      }
    } catch {
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await fetch('/api/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action: 'approve' }),
      });
      toast.success('Document approved');
      fetchDocuments();
    } catch {
      toast.error('Failed to approve document');
    }
  };

  const handleDelete = async (id: string) => {
    openConfirm({ title: 'Delete Document', message: 'Delete this document? This cannot be undone.', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      closeConfirm();
      try {
        await fetch(`/api/documents?id=${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Document deleted');
        fetchDocuments();
      } catch {
        toast.error('Failed to delete document');
      }
    }});
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Document Management</h1>
              <p className="text-teal-100 text-sm mt-0.5">{documents.length} documents · Manage company files securely</p>
            </div>
          </div>
          {canManage && (
            <Button variant="ghost" onClick={() => setShowUpload(true)} className="!bg-white !text-teal-700 hover:!bg-teal-50 border-0 shadow-md font-semibold">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload Document
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none cursor-pointer min-w-[160px]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', backgroundRepeat: 'no-repeat', paddingRight: '2.5rem' }}
        >
          <option value="">All Types</option>
          {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Documents Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex gap-3">
                <div className="skeleton w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded-lg" />
                  <div className="skeleton h-3 w-1/2 rounded-lg" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="skeleton h-3 w-20 rounded-lg" />
                <div className="skeleton h-3 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No documents</h3>
            <p className="text-sm text-slate-500">Upload your first document to get started</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(doc => (
            <div key={doc.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all group">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0 border border-emerald-200">
                  {DOC_TYPE_ICONS[doc.documentType] || 'DOC'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{doc.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Uploaded by {doc.employee.firstName} {doc.employee.lastName}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={doc.filePath}
                    target="_blank"
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Download"
                  >
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </a>
                  {canManage && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant={doc.isApproved ? 'success' : 'warning'} size="sm">
                  {doc.isApproved ? 'Approved' : 'Pending'}
                </Badge>
                <Badge variant="default" size="sm">
                  {DOC_TYPES.find(t => t.value === doc.documentType)?.label || doc.documentType}
                </Badge>
                {doc.visibility === 'ADMIN_ONLY' ? (
                  <Badge variant="warning" size="sm">🔒 Admin Only</Badge>
                ) : (
                  <Badge variant="info" size="sm">👥 Everyone</Badge>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>{doc.fileType} · {formatSize(doc.fileSize)}</span>
                <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
              </div>

              {!doc.isApproved && canManage && (
                <button
                  onClick={() => handleApprove(doc.id)}
                  className="mt-3 w-full py-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  Approve Document
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="Upload Document" size="md">
        <div className="space-y-4">
          <Input
            label="Document Title"
            value={uploadForm.title}
            onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g., NIC Front Copy"
            required
          />
          <Select
            label="Document Type"
            value={uploadForm.documentType}
            onChange={e => setUploadForm(p => ({ ...p, documentType: e.target.value }))}
            options={DOC_TYPES.map(t => ({ value: t.value, label: t.label }))}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">File</label>
            <div className="relative">
              <input
                type="file"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 file:cursor-pointer cursor-pointer border border-slate-200 rounded-xl"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              />
            </div>
          </div>
          <Input
            label="Description (Optional)"
            value={uploadForm.description}
            onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Brief description..."
          />
          <Input
            label="Expiry Date (Optional)"
            type="date"
            value={uploadForm.expiryDate}
            onChange={e => setUploadForm(p => ({ ...p, expiryDate: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Who can see this document?</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUploadForm(p => ({ ...p, visibility: 'ALL' }))}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all border ${
                  uploadForm.visibility === 'ALL'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                👥 Everyone
              </button>
              <button
                type="button"
                onClick={() => setUploadForm(p => ({ ...p, visibility: 'ADMIN_ONLY' }))}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all border ${
                  uploadForm.visibility === 'ADMIN_ONLY'
                    ? 'bg-amber-50 border-amber-300 text-amber-700 ring-2 ring-amber-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🔒 Admin Only
              </button>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowUpload(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleUpload} loading={uploading} className="flex-1">Upload</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={() => confirmDialog.onConfirm()} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} />
    </div>
  );
}
