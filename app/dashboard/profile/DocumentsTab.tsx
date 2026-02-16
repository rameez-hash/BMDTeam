'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';

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
  isApproved?: boolean;
  documentField?: { id: string; name: string };
}

export default function DocumentsTab({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const toast = useToast();
  const { token } = useAuth();
  const [docFields, setDocFields] = useState<DocumentField[]>([]);
  const [employeeDocs, setEmployeeDocs] = useState<EmployeeDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [loadingFields, setLoadingFields] = useState(true);

  const fetchDocFields = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/document-fields', { headers });
      if (res.ok) {
        const data = await res.json();
        setDocFields((data.data || []).filter((f: DocumentField) => f.isActive));
      }
    } catch { /* silent */ } finally {
      setLoadingFields(false);
    }
  }, [token]);

  const fetchEmployeeDocs = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/employees/documents?employeeId=${employeeId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEmployeeDocs(data.data || data || []);
      }
    } catch { /* silent */ }
  }, [token, employeeId]);

  useEffect(() => {
    fetchDocFields();
    fetchEmployeeDocs();
  }, [fetchDocFields, fetchEmployeeDocs]);

  const handleDocUpload = async (fieldId: string, file: File) => {
    setUploading(true);
    setUploadingFieldId(fieldId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'documents');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData,
      });
      if (!uploadRes.ok) { toast.error('Upload failed'); return; }
      const uploadData = await uploadRes.json();

      const docHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) docHeaders['Authorization'] = `Bearer ${token}`;

      const docRes = await fetch('/api/employees/documents', {
        method: 'POST',
        headers: docHeaders,
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

      if (docRes.ok) {
        toast.success('Document uploaded successfully');
        fetchEmployeeDocs();
      } else {
        const d = await docRes.json();
        toast.error(d.error || 'Failed to save document');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      setUploadingFieldId(null);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/documents?id=${docId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        toast.success('Document deleted');
        fetchEmployeeDocs();
      } else {
        toast.error('Failed to delete');
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loadingFields) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {docFields.length > 0 ? (
        docFields.map(field => {
          const fieldDocs = employeeDocs.filter(d => d.documentFieldId === field.id);
          const canUploadToField = canEdit && field.employeeCanEdit;
          return (
            <Card key={field.id} className="border border-slate-200" padding={false}>
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
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
                      <Badge variant="success" size="sm">You can upload</Badge>
                    ) : (
                      <Badge variant="default" size="sm">Admin managed</Badge>
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
                          {canUploadToField && (
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

                {canUploadToField && (
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
              </div>
            </Card>
          );
        })
      ) : (
        <Card className="bg-slate-50" padding={false}>
          <div className="text-center p-8">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-600 font-medium">No document fields configured</p>
            <p className="text-sm text-slate-400 mt-1">Contact admin to configure document fields</p>
          </div>
        </Card>
      )}

      {/* Show any existing docs not linked to a field */}
      {(() => {
        const unlinkedDocs = employeeDocs.filter(d => !d.documentFieldId);
        if (unlinkedDocs.length === 0) return null;
        return (
          <Card className="border border-slate-200" padding={false}>
            <div className="p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Other Documents</h3>
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
                    <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        );
      })()}
    </div>
  );
}
