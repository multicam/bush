/**
 * Bush Platform - App Layout Component
 *
 * Main layout wrapper with sidebar, header, and content area.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import { type ReactNode, useState } from "react";
import { useAuth, useHasRole } from "@/web/context";
import { Avatar, Badge } from "@/web/components/ui";
import { getDisplayName } from "@/web/lib/auth";
import type { AuthState } from "@/auth";
import styles from "./app-layout.module.css";

interface AppLayoutProps {
  children: ReactNode;
}

type Account = NonNullable<AuthState["currentAccount"]>;

export function AppLayout({ children }: AppLayoutProps) {
  const { user, currentAccount, accounts, switchAccount, logout } = useAuth();
  const isOwner = useHasRole("owner");
  const isContentAdmin = useHasRole("content_admin");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const accountName = currentAccount?.name || "Select Account";
  const displayName = user ? getDisplayName(user) : "User";

  const handleSwitchAccount = async (accountId: string) => {
    await switchAccount(accountId);
    setShowAccountMenu(false);
  };

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ""}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            {sidebarCollapsed ? "B" : "Bush"}
          </div>
        </div>

        <nav className={styles.nav}>
          <a href="/dashboard" className={styles.navItem}>
            <span className={styles.navIcon}>📊</span>
            {!sidebarCollapsed && <span>Dashboard</span>}
          </a>
          <a href="/workspaces" className={styles.navItem}>
            <span className={styles.navIcon}>🗂️</span>
            {!sidebarCollapsed && <span>Workspaces</span>}
          </a>
          <a href="/projects" className={styles.navItem}>
            <span className={styles.navIcon}>📁</span>
            {!sidebarCollapsed && <span>Projects</span>}
          </a>
          <a href="/files" className={styles.navItem}>
            <span className={styles.navIcon}>📄</span>
            {!sidebarCollapsed && <span>Files</span>}
          </a>
          <a href="/collections" className={styles.navItem}>
            <span className={styles.navIcon}>📑</span>
            {!sidebarCollapsed && <span>Collections</span>}
          </a>
          <a href="/shares" className={styles.navItem}>
            <span className={styles.navIcon}>🔗</span>
            {!sidebarCollapsed && <span>Shares</span>}
          </a>
        </nav>

        <div className={styles.sidebarFooter}>
          {(isOwner || isContentAdmin) && (
            <a href="/settings" className={styles.navItem}>
              <span className={styles.navIcon}>⚙️</span>
              {!sidebarCollapsed && <span>Settings</span>}
            </a>
          )}
        </div>

        <button
          className={styles.collapseBtn}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? "→" : "←"}
        </button>
      </aside>

      {/* Main content area */}
      <div className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            {/* Account switcher */}
            {accounts.length > 1 ? (
              <div className={styles.dropdownContainer}>
                <button
                  className={styles.accountSwitcher}
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                >
                  <span>{accountName}</span>
                  <span className={styles.dropdownArrow}>▼</span>
                </button>
                {showAccountMenu && (
                  <div className={styles.dropdownMenu}>
                    {accounts.map((account: Account) => (
                      <button
                        key={account.id}
                        className={`${styles.dropdownItem} ${account.id === currentAccount?.id ? styles.selected : ""}`}
                        onClick={() => handleSwitchAccount(account.id)}
                      >
                        {account.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className={styles.accountName}>{accountName}</span>
            )}
          </div>

          <div className={styles.headerRight}>
            {/* User menu */}
            <div className={styles.dropdownContainer}>
              <button
                className={styles.userButton}
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <Avatar size="sm" name={displayName} />
                <span className={styles.userName}>{displayName}</span>
                {currentAccount && (
                  <Badge variant="default" size="sm">
                    {currentAccount.role.replace("_", " ")}
                  </Badge>
                )}
              </button>
              {showUserMenu && (
                <div className={`${styles.dropdownMenu} ${styles.right}`}>
                  <a href="/profile" className={styles.dropdownItem}>Profile</a>
                  <a href="/settings" className={styles.dropdownItem}>Settings</a>
                  <div className={styles.dropdownSeparator} />
                  <button className={styles.dropdownItem} onClick={logout}>Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
