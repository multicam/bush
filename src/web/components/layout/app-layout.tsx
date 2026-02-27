/**
 * Bush Platform - App Layout Component
 *
 * Main layout wrapper with icon rail sidebar that expands on hover.
 * Reference: specs/20-design-foundations.md - App Shell Layout
 *
 * Design principles:
 * - Icon rail: 64px wide, expands to 240px on hover
 * - No fixed top header bar - page-level headers are part of content scroll
 * - Quiet until needed: sidebar is thin rail until hovered
 */
"use client";

import { type ReactNode, useState, useEffect } from "react";
import { useAuth, useHasRole, useTheme } from "@/web/context";
import { Avatar, Badge } from "@/web/components/ui";
import { getDisplayName } from "@/web/lib/auth";
import { notificationsApi } from "@/web/lib/api";
import { useUserEvents } from "@/web/hooks/use-realtime";
import { NotificationBell, NotificationDropdown } from "@/web/components/notifications";
import {
  LayoutDashboard,
  Briefcase,
  FolderOpen,
  FileText,
  Layers,
  Share2,
  Settings,
  Sun,
  Moon,
  LogOut,
  User,
  ChevronDown,
} from "lucide-react";
import type { AuthState } from "@/auth";

interface AppLayoutProps {
  children: ReactNode;
}

type Account = NonNullable<AuthState["currentAccount"]>;

export function AppLayout({ children }: AppLayoutProps) {
  const { user, currentAccount, accounts, switchAccount, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isOwner = useHasRole("owner");
  const isContentAdmin = useHasRole("content_admin");
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const displayName = user ? getDisplayName(user) : "User";

  // Fetch unread count on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchUnreadCount() {
      try {
        const response = await notificationsApi.getUnreadCount();
        if (!cancelled) {
          setUnreadCount(response.data.attributes.count);
        }
      } catch (error) {
        console.error("Failed to fetch unread count:", error);
      }
    }

    fetchUnreadCount();

    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to real-time notification events to update unread count
  useUserEvents(user?.id, {
    eventFilter: "notification.created",
    onEvent: () => {
      setUnreadCount((prev) => prev + 1);
    },
  });

  const handleSwitchAccount = async (accountId: string) => {
    await switchAccount(accountId);
    setShowAccountMenu(false);
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    setShowUserMenu(false);
    setShowAccountMenu(false);
  };

  const handleMarkAllRead = () => {
    setUnreadCount(0);
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Icon Rail Sidebar */}
      <aside
        className={`
          flex flex-col relative
          bg-surface-0 border-r border-border-default
          transition-all duration-slow ease-default
          ${isExpanded ? "w-60" : "w-16"}
        `}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-border-default">
          <span className={`font-bold text-text-primary transition-opacity duration-normal ${isExpanded ? "text-xl" : "text-xl text-center w-full"}`}>
            {isExpanded ? "Bush" : "B"}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto">
          <NavItem
            href="/dashboard"
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            expanded={isExpanded}
          />
          <NavItem
            href="/workspaces"
            icon={<Briefcase size={20} />}
            label="Workspaces"
            expanded={isExpanded}
          />
          <NavItem
            href="/projects"
            icon={<FolderOpen size={20} />}
            label="Projects"
            expanded={isExpanded}
          />
          <NavItem
            href="/files"
            icon={<FileText size={20} />}
            label="Files"
            expanded={isExpanded}
          />
          <NavItem
            href="/collections"
            icon={<Layers size={20} />}
            label="Collections"
            expanded={isExpanded}
          />
          <NavItem
            href="/shares"
            icon={<Share2 size={20} />}
            label="Shares"
            expanded={isExpanded}
          />
        </nav>

        {/* Footer - Settings, Theme Toggle, User */}
        <div className="border-t border-border-default py-2">
          {(isOwner || isContentAdmin) && (
            <NavItem
              href="/settings"
              icon={<Settings size={20} />}
              label="Settings"
              expanded={isExpanded}
            />
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`
              w-full flex items-center gap-3 px-4 py-3
              text-text-secondary hover:text-text-primary hover:bg-surface-2
              transition-colors duration-fast
            `}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            {isExpanded && (
              <span className="text-sm font-medium">
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            )}
          </button>

          {/* Account Switcher (if multiple accounts) */}
          {accounts.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3
                  text-text-secondary hover:text-text-primary hover:bg-surface-2
                  transition-colors duration-fast
                `}
              >
                <div className="w-5 h-5 flex items-center justify-center text-xs font-medium bg-surface-2 rounded">
                  {currentAccount?.name?.charAt(0).toUpperCase() || "A"}
                </div>
                {isExpanded && (
                  <>
                    <span className="flex-1 text-left text-sm font-medium truncate">
                      {currentAccount?.name || "Select Account"}
                    </span>
                    <ChevronDown size={16} className="text-text-muted" />
                  </>
                )}
              </button>

              {/* Account Dropdown */}
              {showAccountMenu && isExpanded && (
                <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-surface-2 border border-border-default rounded-md shadow-lg overflow-hidden">
                  {accounts.map((account: Account) => (
                    <button
                      key={account.id}
                      onClick={() => handleSwitchAccount(account.id)}
                      className={`
                        w-full px-3 py-2 text-left text-sm
                        hover:bg-surface-3 transition-colors
                        ${account.id === currentAccount?.id ? "text-accent font-medium" : "text-text-primary"}
                      `}
                    >
                      {account.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={handleNotificationClick}
              className={`
                w-full flex items-center gap-3 px-4 py-3
                text-text-secondary hover:text-text-primary hover:bg-surface-2
                transition-colors duration-fast
              `}
              aria-label="Notifications"
            >
              <NotificationBell
                unreadCount={unreadCount}
                isOpen={showNotifications}
                onClick={() => {}}
              />
              {isExpanded && (
                <span className="text-sm font-medium">Notifications</span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute bottom-full left-0 mb-1 w-80 mx-2">
                <NotificationDropdown
                  isOpen={showNotifications}
                  onClose={() => setShowNotifications(false)}
                  unreadCount={unreadCount}
                  onMarkAllRead={handleMarkAllRead}
                />
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`
                w-full flex items-center gap-3 px-4 py-3
                text-text-secondary hover:text-text-primary hover:bg-surface-2
                transition-colors duration-fast
              `}
            >
              <Avatar size="sm" name={displayName} />
              {isExpanded && (
                <>
                  <span className="flex-1 text-left text-sm font-medium truncate">
                    {displayName}
                  </span>
                  {currentAccount && (
                    <Badge variant="default" size="sm">
                      {currentAccount.role.replace("_", " ")}
                    </Badge>
                  )}
                </>
              )}
            </button>

            {/* User Dropdown */}
            {showUserMenu && isExpanded && (
              <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-surface-2 border border-border-default rounded-md shadow-lg overflow-hidden">
                <a
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-3 transition-colors"
                >
                  <User size={16} />
                  Profile
                </a>
                <a
                  href="/settings"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-3 transition-colors"
                >
                  <Settings size={16} />
                  Settings
                </a>
                <div className="border-t border-border-default" />
                <button
                  onClick={logout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-status-error hover:bg-surface-3 transition-colors"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 min-w-0 bg-surface-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

/**
 * Nav Item Component
 *
 * Sidebar navigation item with icon and optional label.
 * Labels fade in after sidebar width transition completes.
 */
interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  expanded: boolean;
}

function NavItem({ href, icon, label, expanded }: NavItemProps) {
  return (
    <a
      href={href}
      className={`
        flex items-center gap-3 px-4 py-3 mx-2 my-0.5 rounded-md
        text-text-secondary hover:text-text-primary hover:bg-surface-2
        transition-colors duration-fast
      `}
    >
      <span className="flex-shrink-0">{icon}</span>
      {expanded && (
        <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
          {label}
        </span>
      )}
    </a>
  );
}
