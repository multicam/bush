"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/web/components/ui/avatar";
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from "@/web/components/ui/dropdown";
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from "@/web/components/ui/navbar";
import {
  Sidebar,
  SidebarBody,
  SidebarDivider,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from "@/web/components/ui/sidebar";
import { SidebarLayout } from "@/web/components/ui/sidebar-layout";
import { useAuth, useHasRole } from "@/web/context/auth-context";
import { useTheme } from "@/web/context/theme-context";
import { useUserEvents } from "@/web/hooks/use-realtime";
import { getDisplayName, getUserInitials } from "@/web/lib/auth";
import { notificationsApi } from "@/web/lib/api";
import {
  ArrowRightStartOnRectangleIcon,
  BellIcon,
  BriefcaseIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  HomeIcon,
  MoonIcon,
  ShareIcon,
  Square2StackIcon,
  SunIcon,
  UserCircleIcon,
} from "@/web/lib/icons";

interface AppLayoutProps {
  children: ReactNode;
}

interface InlineNotification {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const { user, currentAccount, accounts, switchAccount, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isOwner = useHasRole("owner");
  const isContentAdmin = useHasRole("content_admin");

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<InlineNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const displayName = user ? getDisplayName(user) : "User";
  const initials = user ? getUserInitials(user) : "U";
  const canAccessSettings = isOwner || isContentAdmin;

  const unreadLabel = useMemo(() => {
    if (!unreadCount || unreadCount <= 0 || isNaN(unreadCount)) {
      return null;
    }

    return unreadCount > 99 ? "99+" : String(unreadCount);
  }, [unreadCount]);

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

  useUserEvents(user?.id, {
    eventFilter: "notification.created",
    onEvent: () => {
      setUnreadCount((prev) => prev + 1);
    },
  });

  const loadNotifications = async () => {
    setNotificationsLoading(true);

    try {
      const response = await notificationsApi.list({ limit: 6 });
      setNotifications(
        response.data.map((item) => ({
          id: item.id,
          title: item.attributes.title,
          body: item.attributes.body,
          read: item.attributes.read,
        }))
      );
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleSwitchAccount = async (accountId: string) => {
    await switchAccount(accountId);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            <Dropdown>
              <DropdownButton
                as={NavbarItem}
                onClick={loadNotifications}
                aria-label="Open notifications"
              >
                <BellIcon />
                {unreadLabel && (
                  <span className="rounded-full bg-[#ff4017] px-1.5 text-xs font-semibold leading-5 text-white">
                    {unreadLabel}
                  </span>
                )}
              </DropdownButton>
              <DropdownMenu anchor="bottom end" className="min-w-80">
                <DropdownItem onClick={handleMarkAllRead} disabled={unreadCount === 0}>
                  <CheckIcon />
                  <DropdownLabel>Mark all as read</DropdownLabel>
                </DropdownItem>
                <DropdownDivider />
                {notificationsLoading && (
                  <DropdownItem disabled>
                    <DropdownLabel>Loading notifications...</DropdownLabel>
                  </DropdownItem>
                )}
                {!notificationsLoading && notifications.length === 0 && (
                  <DropdownItem disabled>
                    <DropdownLabel>No notifications</DropdownLabel>
                  </DropdownItem>
                )}
                {!notificationsLoading &&
                  notifications.map((notification) => (
                    <DropdownItem key={notification.id} href="/notifications">
                      <BellIcon />
                      <DropdownLabel>{notification.title}</DropdownLabel>
                    </DropdownItem>
                  ))}
              </DropdownMenu>
            </Dropdown>

            <Dropdown>
              <DropdownButton as={NavbarItem} aria-label="Open user menu">
                <Avatar src={user?.avatarUrl} initials={initials} square />
              </DropdownButton>
              <DropdownMenu anchor="bottom end" className="min-w-64">
                <DropdownItem href="/profile">
                  <UserCircleIcon />
                  <DropdownLabel>Profile</DropdownLabel>
                </DropdownItem>
                {canAccessSettings && (
                  <DropdownItem href="/settings">
                    <Cog6ToothIcon />
                    <DropdownLabel>Settings</DropdownLabel>
                  </DropdownItem>
                )}
                <DropdownDivider />
                <DropdownItem onClick={logout}>
                  <ArrowRightStartOnRectangleIcon />
                  <DropdownLabel>Log out</DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <Avatar
                  src={null}
                  initials={currentAccount?.name?.charAt(0).toUpperCase() || "A"}
                  alt={currentAccount?.name || "Current account"}
                />
                <SidebarLabel>{currentAccount?.name || "Select Account"}</SidebarLabel>
                <ChevronDownIcon />
              </DropdownButton>
              <DropdownMenu anchor="bottom start" className="min-w-80 lg:min-w-64">
                {accounts.length === 0 && (
                  <DropdownItem disabled>
                    <DropdownLabel>No accounts</DropdownLabel>
                  </DropdownItem>
                )}
                {accounts.map((account) => (
                  <DropdownItem key={account.id} onClick={() => handleSwitchAccount(account.id)}>
                    <Avatar
                      slot="icon"
                      src={null}
                      initials={account.name.charAt(0).toUpperCase()}
                      alt={account.name}
                    />
                    <DropdownLabel>{account.name}</DropdownLabel>
                    {account.id === currentAccount?.id && <CheckIcon />}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/dashboard" current={pathname.startsWith("/dashboard")}>
                <HomeIcon />
                <SidebarLabel>Dashboard</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/workspaces" current={pathname.startsWith("/workspaces")}>
                <BriefcaseIcon />
                <SidebarLabel>Workspaces</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/projects" current={pathname.startsWith("/projects")}>
                <FolderOpenIcon />
                <SidebarLabel>Projects</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/files" current={pathname.startsWith("/files")}>
                <DocumentTextIcon />
                <SidebarLabel>Files</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/collections" current={pathname.startsWith("/collections")}>
                <Square2StackIcon />
                <SidebarLabel>Collections</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/shares" current={pathname.startsWith("/shares")}>
                <ShareIcon />
                <SidebarLabel>Shares</SidebarLabel>
              </SidebarItem>
              {canAccessSettings && (
                <SidebarItem href="/settings" current={pathname.startsWith("/settings")}>
                  <Cog6ToothIcon />
                  <SidebarLabel>Settings</SidebarLabel>
                </SidebarItem>
              )}
            </SidebarSection>

            <SidebarSpacer />

            <SidebarSection>
              <Dropdown>
                <DropdownButton
                  as={SidebarItem}
                  onClick={loadNotifications}
                  aria-label="Open notifications"
                >
                  <BellIcon />
                  <SidebarLabel>Notifications</SidebarLabel>
                  {unreadLabel && (
                    <span className="rounded-full bg-[#ff4017] px-1.5 text-xs font-semibold leading-5 text-white">
                      {unreadLabel}
                    </span>
                  )}
                </DropdownButton>
                <DropdownMenu anchor="top start" className="min-w-80 lg:min-w-72">
                  <DropdownItem onClick={handleMarkAllRead} disabled={unreadCount === 0}>
                    <CheckIcon />
                    <DropdownLabel>Mark all as read</DropdownLabel>
                  </DropdownItem>
                  <DropdownDivider />
                  {notificationsLoading && (
                    <DropdownItem disabled>
                      <DropdownLabel>Loading notifications...</DropdownLabel>
                    </DropdownItem>
                  )}
                  {!notificationsLoading && notifications.length === 0 && (
                    <DropdownItem disabled>
                      <DropdownLabel>No notifications</DropdownLabel>
                    </DropdownItem>
                  )}
                  {!notificationsLoading &&
                    notifications.map((notification) => (
                      <DropdownItem key={notification.id} href="/notifications">
                        <BellIcon />
                        <DropdownLabel>{notification.title}</DropdownLabel>
                      </DropdownItem>
                    ))}
                  <DropdownDivider />
                  <DropdownItem href="/notifications">
                    <BellIcon />
                    <DropdownLabel>View all notifications</DropdownLabel>
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </SidebarSection>
          </SidebarBody>

          <SidebarFooter>
            <SidebarSection>
              <SidebarItem
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              >
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                <SidebarLabel>{theme === "dark" ? "Light Mode" : "Dark Mode"}</SidebarLabel>
              </SidebarItem>
            </SidebarSection>

            <SidebarDivider />

            <SidebarSection>
              <Dropdown>
                <DropdownButton as={SidebarItem}>
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar
                      src={user?.avatarUrl}
                      initials={initials}
                      className="size-10"
                      square
                      alt={displayName}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                        {displayName}
                      </span>
                      <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                        {user?.email || ""}
                      </span>
                    </span>
                  </span>
                  <ChevronUpIcon />
                </DropdownButton>
                <DropdownMenu anchor="top start" className="min-w-64">
                  <DropdownItem href="/profile">
                    <UserCircleIcon />
                    <DropdownLabel>Profile</DropdownLabel>
                  </DropdownItem>
                  {canAccessSettings && (
                    <DropdownItem href="/settings">
                      <Cog6ToothIcon />
                      <DropdownLabel>Settings</DropdownLabel>
                    </DropdownItem>
                  )}
                  <DropdownDivider />
                  <DropdownItem onClick={logout}>
                    <ArrowRightStartOnRectangleIcon />
                    <DropdownLabel>Log out</DropdownLabel>
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </SidebarSection>
          </SidebarFooter>
        </Sidebar>
      }
    >
      {children}
    </SidebarLayout>
  );
}
