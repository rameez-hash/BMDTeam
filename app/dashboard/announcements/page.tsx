'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Badge } from '../../components/ui/Badge';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  createdBy?: { email: string };
}

export default function AnnouncementsPage() {
  const { allowed, loading: permLoading } = useRequirePermission('announcements', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Announcements" />;
  return <AnnouncementsPageContent />;
}

function AnnouncementsPageContent() {
  const { token, user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'NORMAL',
    expiresAt: '',
  });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'HR';

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.data || data.announcements || []);
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchAnnouncements();
  }, [token, fetchAnnouncements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingAnnouncement ? `/api/announcements?id=${editingAnnouncement.id}` : '/api/announcements';
      const method = editingAnnouncement ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          publishDate: new Date().toISOString(),
          expiryDate: formData.expiresAt || null,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingAnnouncement(null);
        resetForm();
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Failed to save announcement:', error);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      expiresAt: announcement.expiresAt?.split('T')[0] || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    openConfirm({ title: 'Delete Announcement', message: 'Are you sure you want to delete this announcement?', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/announcements?id=${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) fetchAnnouncements();
      } catch (error) {
        console.error('Failed to delete announcement:', error);
      }
    }});
  };

  const resetForm = () => {
    setFormData({ title: '', content: '', priority: 'NORMAL', expiresAt: '' });
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'danger' | 'warning' | 'default'> = {
      HIGH: 'danger',
      NORMAL: 'warning',
      LOW: 'default',
    };
    return <Badge variant={variants[priority] || 'default'}>{priority}</Badge>;
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'HIGH') {
      return (
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-white rounded-2xl skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Announcements</h1>
              <p className="text-teal-100 text-sm mt-0.5">Company-wide announcements and updates</p>
            </div>
          </div>
          {isAdmin && (
            <Button variant="ghost" onClick={() => { resetForm(); setEditingAnnouncement(null); setShowModal(true); }} className="!bg-white !text-teal-700 hover:!bg-teal-50 border-0 shadow-md font-semibold">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Announcement
            </Button>
          )}
        </div>
      </div>

      {/* Announcements List */}
      {announcements.length > 0 ? (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id} className={`${announcement.priority === 'HIGH' ? 'border-l-4 border-l-red-500' : ''}`}>
              <div className="flex items-start gap-4">
                {getPriorityIcon(announcement.priority)}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-slate-900">{announcement.title}</h3>
                    {getPriorityBadge(announcement.priority)}
                    {!announcement.isActive && <Badge variant="default">Inactive</Badge>}
                  </div>
                  <p className="text-slate-600 whitespace-pre-wrap">{announcement.content}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>
                        Posted {new Date(announcement.createdAt).toLocaleDateString()}
                      </span>
                      {announcement.expiresAt && (
                        <span>
                          Expires {new Date(announcement.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(announcement)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(announcement.id)}>
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            <p className="mt-2 text-slate-500">No announcements yet</p>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingAnnouncement(null); }}
        title={editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Content</label>
            <textarea
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={5}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Announcement content..."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'NORMAL', label: 'Normal' },
                { value: 'HIGH', label: 'High (Urgent)' },
              ]}
            />
            <Input
              label="Expires On (Optional)"
              type="date"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingAnnouncement ? 'Update' : 'Publish'}</Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={() => confirmDialog.onConfirm()} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} />
    </div>
  );
}
