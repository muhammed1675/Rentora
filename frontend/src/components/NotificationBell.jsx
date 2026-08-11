import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useNotifications } from '../lib/notifications';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications(user?.id, user?.role);

  if (!user) return null;

  const handleClick = (n) => {
    if (!n.read_at) markAsRead(n);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-full p-2 text-primary hover:bg-white"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="badge-pop absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <span className="text-sm font-semibold text-primary">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            You're all caught up.
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-1 border-b border-black/5 px-4 py-3 last:border-0 hover:bg-black/[0.02] ${!n.read_at ? 'bg-primary/[0.04]' : ''}`}
                >
                  <button onClick={() => handleClick(n)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                        {n.source === 'broadcast' && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">Announcement</span>
                        )}
                        {n.title}
                      </span>
                      {!n.read_at && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                    </div>
                    <span className="text-xs leading-5 text-muted-foreground">{n.body}</span>
                    <span className="mt-0.5 text-[11px] text-muted-foreground/70">{timeAgo(n.created_at)}</span>
                  </button>
                  <button
                    onClick={() => deleteNotification(n)}
                    aria-label="Delete notification"
                    className="flex-shrink-0 rounded-full p-1.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="border-t border-black/5 px-4 py-2.5 text-center">
          <button
            onClick={() => navigate('/notifications')}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Compact bell for the mobile header: taps straight through to the
// notifications page instead of opening a popover.
export function NotificationBellLink({ className = '' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications(user?.id, user?.role);

  if (!user) return null;

  return (
    <button
      onClick={() => navigate('/notifications')}
      className={`relative rounded-full p-2 text-primary hover:bg-white ${className}`}
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="badge-pop absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}