'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onMenuClick: () => void;
  user: any;
  onLogout: () => void;
}

interface NotifPopup {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string;
}

// Play a pleasant notification chime using Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    // Two-tone chime: C5 then E5
    const frequencies = [523.25, 659.25];
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.4);
    });

    // Close context after sound finishes
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // Audio not supported or blocked — silently ignore
  }
}

// Show native browser/Electron notification
function showNativeNotification(title: string, body: string, icon?: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: icon || '/iconbmd.png', tag: 'bmd-hrms' });
    }
  } catch {
    // Native notifications not supported
  }
}

export default function Header({ onMenuClick, user, onLogout }: HeaderProps) {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPopups, setNotifPopups] = useState<NotifPopup[]>([]);
  const prevNotifIds = useRef<Set<string>>(new Set());
  const isFirstFetch = useRef(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Request native notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Dismiss a popup notification
  const dismissPopup = useCallback((id: string) => {
    setNotifPopups(prev => prev.filter(p => p.id !== id));
  }, []);

  // Handle clicking a popup notification
  const handlePopupClick = useCallback((popup: NotifPopup) => {
    dismissPopup(popup.id);
    if (popup.link) {
      router.push(popup.link);
    } else {
      router.push('/dashboard/notifications');
    }
  }, [dismissPopup, router]);

  // Fetch notifications with real-time detection
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/notifications?limit=10', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const notifs = data.notifications || [];
          const newCount = data.unreadCount || 0;

          if (isFirstFetch.current) {
            // First load: track IDs but don't popup
            prevNotifIds.current = new Set(notifs.map((n: any) => n.id));
            isFirstFetch.current = false;
          } else {
            // Subsequent polls: detect new notifications
            const brandNew = notifs.filter((n: any) => !prevNotifIds.current.has(n.id) && !n.isRead);
            if (brandNew.length > 0) {
              // Play sound
              playNotificationSound();

              // Show popup for each new notification (max 3)
              const popups: NotifPopup[] = brandNew.slice(0, 3).map((n: any) => ({
                id: n.id,
                title: n.title,
                message: n.message,
                type: n.type,
                link: n.link,
              }));
              setNotifPopups(prev => [...prev, ...popups]);

              // Auto-dismiss popups after 6 seconds
              popups.forEach(p => {
                setTimeout(() => {
                  setNotifPopups(prev => prev.filter(pp => pp.id !== p.id));
                }, 6000);
              });

              // Native browser/Electron notification for the latest
              const latest = brandNew[0];
              showNativeNotification(latest.title, latest.message);
            }
            prevNotifIds.current = new Set(notifs.map((n: any) => n.id));
          }

          setNotifications(notifs);
          setUnreadCount(newCount);
        }
      } catch {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Poll every 10s for near real-time
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: string, link?: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id })
      });
      // Remove from dropdown once read
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
      // Navigate to link if provided
      if (link) {
        setShowNotifications(false);
        router.push(link);
      }
    } catch {}
  };

  const handleNotifClick = (n: any) => {
    if (!n.isRead) {
      markAsRead(n.id, n.link);
    } else if (n.link) {
      setShowNotifications(false);
      router.push(n.link);
    }
  };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const getNotifIcon = (type: string) => {
    const ic = "w-4 h-4";
    switch (type) {
      case 'LEAVE_REQUEST': case 'LEAVE_APPROVED': case 'LEAVE_REJECTED':
        return <svg className={`${ic} text-blue-500`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
      case 'PAYROLL_GENERATED': case 'PAYROLL_PAID':
        return <svg className={`${ic} text-emerald-500`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>;
      case 'ATTENDANCE_CORRECTION':
        return <svg className={`${ic} text-amber-500`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
      case 'ANNOUNCEMENT':
        return <svg className={`${ic} text-purple-500`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15" /></svg>;
      case 'ONBOARDING':
        return <svg className={`${ic} text-emerald-500`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09zM12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" /></svg>;
      case 'OVERTIME':
        return <svg className={`${ic} text-yellow-500`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
      case 'DOCUMENT':
        return <svg className={`${ic} text-slate-500`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
      case 'PROMOTION':
        return <svg className={`${ic} text-teal-500`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>;
      default:
        return <svg className={`${ic} text-slate-400`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>;
    }
  };

  const getPopupIcon = (type: string) => {
    switch (type) {
      case 'LEAVE_REQUEST': case 'LEAVE_APPROVED': case 'LEAVE_REJECTED':
        return '📋';
      case 'PAYROLL_GENERATED': case 'PAYROLL_PAID':
        return '💰';
      case 'ATTENDANCE_CORRECTION':
        return '⏰';
      case 'ANNOUNCEMENT':
        return '📢';
      case 'ONBOARDING':
        return '🚀';
      case 'OVERTIME':
        return '⚡';
      case 'DOCUMENT':
        return '📄';
      case 'PROMOTION':
        return '🎉';
      default:
        return '🔔';
    }
  };

  const getPopupColor = (type: string) => {
    switch (type) {
      case 'LEAVE_APPROVED': case 'PAYROLL_PAID': case 'ONBOARDING':
        return 'border-l-emerald-500 bg-emerald-50/80';
      case 'LEAVE_REJECTED':
        return 'border-l-red-500 bg-red-50/80';
      case 'PAYROLL_GENERATED':
        return 'border-l-blue-500 bg-blue-50/80';
      case 'ATTENDANCE_CORRECTION':
        return 'border-l-amber-500 bg-amber-50/80';
      case 'ANNOUNCEMENT':
        return 'border-l-purple-500 bg-purple-50/80';
      case 'PROMOTION':
        return 'border-l-teal-500 bg-teal-50/80';
      default:
        return 'border-l-teal-500 bg-teal-50/80';
    }
  };

  return (
    <>
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/80">
      <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center">
            <Image src="/logo-rename.png" alt="BMD Digital" width={32} height={32} className="object-contain" priority />
          </div>

          {/* Search */}
          <div className="hidden md:flex items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="w-64 lg:w-80 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:border-emerald-300 transition-all"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{unreadCount} new</span>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                      <p className="text-sm text-slate-500">No notifications</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 ${!n.isRead ? 'bg-emerald-50/30' : ''}`}
                      >
                        <span className="text-lg flex-shrink-0 mt-0.5">{getNotifIcon(n.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.isRead ? 'font-semibold text-slate-900' : 'text-slate-700'} truncate`}>{n.title}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{getTimeAgo(n.createdAt)}</p>
                        </div>
                        {!n.isRead && <span className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0 mt-2" />}
                      </button>
                    ))
                  )}
                </div>
                <Link
                  href="/dashboard/notifications"
                  onClick={() => setShowNotifications(false)}
                  className="block text-center text-sm font-medium text-emerald-600 hover:bg-slate-50 py-3 border-t border-slate-100 transition-colors"
                >
                  View all notifications
                </Link>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {user?.employee?.profileImage ? (
                <img
                  src={user.employee.profileImage}
                  alt="Profile"
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-semibold text-xs">
                  {user?.employee?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="hidden sm:block text-left max-w-[120px]">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email}
                </p>
                <p className="text-[10px] text-slate-500">{user?.role}</p>
              </div>
              <svg className={`w-4 h-4 text-slate-400 transition-transform hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900">
                    {user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : 'User'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
                </div>
                
                <Link href="/dashboard/profile" className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm text-slate-700">My Profile</span>
                </Link>

                <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm text-slate-700">Settings</span>
                </Link>

                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={() => { setShowUserMenu(false); onLogout(); }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors w-full text-left"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    <span className="text-sm font-medium text-red-600">Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

    {/* Floating Notification Popups - Bottom Right */}
    {notifPopups.length > 0 && (
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none" style={{ maxWidth: '380px' }}>
        {notifPopups.map((popup, idx) => (
          <div
            key={popup.id}
            className={`pointer-events-auto border-l-4 ${getPopupColor(popup.type)} backdrop-blur-sm rounded-xl shadow-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-3xl`}
            style={{
              animation: `slideInRight 0.4s ease-out ${idx * 0.1}s both`,
            }}
            onClick={() => handlePopupClick(popup)}
          >
            <div className="p-4 flex items-start gap-3">
              <span className="text-2xl flex-shrink-0 mt-0.5">{getPopupIcon(popup.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{popup.title}</p>
                <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{popup.message}</p>
                <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Just now — Click to view
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismissPopup(popup.id); }}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Progress bar for auto-dismiss */}
            <div className="h-0.5 bg-slate-200/50">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                style={{ animation: 'shrinkWidth 6s linear forwards' }}
              />
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Popup animation styles */}
    <style jsx>{`
      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(100%) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }
      @keyframes shrinkWidth {
        from { width: 100%; }
        to { width: 0%; }
      }
    `}</style>
    </>
  );
}


