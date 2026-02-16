/**
 * Bush Platform - Settings Page
 *
 * Account and workspace settings management.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import { useState } from "react";
import { AppLayout } from "@/web/components/layout";
import { Button, Input, Badge } from "@/web/components/ui";
import { useAuth, useHasRole } from "@/web/context";
import { getDisplayName, getUserInitials } from "@/web/lib/auth";
import styles from "./settings.module.css";

type SettingsTab = "profile" | "account" | "team" | "notifications" | "security" | "billing";

export default function SettingsPage() {
  const { user, currentAccount } = useAuth();
  const isOwner = useHasRole("owner");
  const isContentAdmin = useHasRole("content_admin");
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const _displayName = user ? getDisplayName(user) : "User";
  const initials = user ? getUserInitials(user) : "?";

  const tabs: { id: SettingsTab; label: string; adminOnly?: boolean }[] = [
    { id: "profile", label: "Profile" },
    { id: "account", label: "Account" },
    { id: "team", label: "Team", adminOnly: true },
    { id: "notifications", label: "Notifications" },
    { id: "security", label: "Security" },
    { id: "billing", label: "Billing", adminOnly: true },
  ];

  const filteredTabs = tabs.filter(
    (tab) => !tab.adminOnly || (tab.adminOnly && (isOwner || isContentAdmin))
  );

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Settings</h1>
        </div>

        <div className={styles.layout}>
          {/* Sidebar Navigation */}
          <nav className={styles.sidebar}>
            {filteredTabs.map((tab) => (
              <button
                key={tab.id}
                className={`${styles.navItem} ${activeTab === tab.id ? styles.active : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className={styles.content}>
            {activeTab === "profile" && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Profile Settings</h2>
                <p className={styles.sectionDescription}>
                  Update your personal information and preferences.
                </p>

                <div className={styles.form}>
                  <div className={styles.avatarSection}>
                    <div className={styles.avatarLarge}>{initials}</div>
                    <Button variant="secondary" size="sm">
                      Change Avatar
                    </Button>
                  </div>

                  <div className={styles.formRow}>
                    <Input
                      label="First Name"
                      defaultValue={user?.firstName || ""}
                      placeholder="Enter first name"
                    />
                    <Input
                      label="Last Name"
                      defaultValue={user?.lastName || ""}
                      placeholder="Enter last name"
                    />
                  </div>

                  <Input
                    label="Email"
                    type="email"
                    defaultValue={user?.email || ""}
                    disabled
                    helperText="Email is managed by your authentication provider"
                  />

                  <Input
                    label="Display Name"
                    defaultValue={user?.displayName || ""}
                    placeholder="Enter display name"
                  />

                  <div className={styles.formActions}>
                    <Button variant="primary">Save Changes</Button>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "account" && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Account Settings</h2>
                <p className={styles.sectionDescription}>
                  Manage your account details and preferences.
                </p>

                {currentAccount && (
                  <div className={styles.accountInfo}>
                    <div className={styles.accountHeader}>
                      <h3 className={styles.accountName}>{currentAccount.name}</h3>
                      <Badge variant="default">{currentAccount.role.replace("_", " ")}</Badge>
                    </div>
                    <div className={styles.accountStats}>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Plan</span>
                        <span className={styles.statValue}>Pro</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Storage</span>
                        <span className={styles.statValue}>479 GB / 2 TB</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Members</span>
                        <span className={styles.statValue}>15 / 25</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.dangerZone}>
                  <h3 className={styles.dangerTitle}>Danger Zone</h3>
                  <p className={styles.dangerDescription}>
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <Button variant="danger">Delete Account</Button>
                </div>
              </section>
            )}

            {activeTab === "team" && (isOwner || isContentAdmin) && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Team Management</h2>
                <p className={styles.sectionDescription}>
                  Manage team members and their permissions.
                </p>

                <div className={styles.teamActions}>
                  <Button variant="primary">Invite Team Member</Button>
                </div>

                <div className={styles.memberList}>
                  {/* Mock team members */}
                  <div className={styles.memberItem}>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>John Doe</span>
                      <span className={styles.memberEmail}>john@example.com</span>
                    </div>
                    <Badge variant="primary">Owner</Badge>
                  </div>
                  <div className={styles.memberItem}>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>Jane Smith</span>
                      <span className={styles.memberEmail}>jane@example.com</span>
                    </div>
                    <Badge variant="success">Content Admin</Badge>
                  </div>
                  <div className={styles.memberItem}>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>Bob Wilson</span>
                      <span className={styles.memberEmail}>bob@example.com</span>
                    </div>
                    <Badge variant="default">Member</Badge>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "notifications" && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Notification Preferences</h2>
                <p className={styles.sectionDescription}>
                  Choose how and when you want to be notified.
                </p>

                <div className={styles.notificationOptions}>
                  <div className={styles.notificationItem}>
                    <div className={styles.notificationInfo}>
                      <span className={styles.notificationLabel}>Email Notifications</span>
                      <span className={styles.notificationDescription}>
                        Receive email notifications for important updates
                      </span>
                    </div>
                    <input type="checkbox" defaultChecked className={styles.toggle} />
                  </div>
                  <div className={styles.notificationItem}>
                    <div className={styles.notificationInfo}>
                      <span className={styles.notificationLabel}>Comment Mentions</span>
                      <span className={styles.notificationDescription}>
                        Get notified when someone mentions you in a comment
                      </span>
                    </div>
                    <input type="checkbox" defaultChecked className={styles.toggle} />
                  </div>
                  <div className={styles.notificationItem}>
                    <div className={styles.notificationInfo}>
                      <span className={styles.notificationLabel}>Share Activity</span>
                      <span className={styles.notificationDescription}>
                        Notifications when someone views or downloads your shares
                      </span>
                    </div>
                    <input type="checkbox" className={styles.toggle} />
                  </div>
                  <div className={styles.notificationItem}>
                    <div className={styles.notificationInfo}>
                      <span className={styles.notificationLabel}>Weekly Digest</span>
                      <span className={styles.notificationDescription}>
                        Receive a weekly summary of activity
                      </span>
                    </div>
                    <input type="checkbox" defaultChecked className={styles.toggle} />
                  </div>
                </div>

                <div className={styles.formActions}>
                  <Button variant="primary">Save Preferences</Button>
                </div>
              </section>
            )}

            {activeTab === "security" && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Security Settings</h2>
                <p className={styles.sectionDescription}>
                  Manage your security preferences and active sessions.
                </p>

                <div className={styles.securitySection}>
                  <h3 className={styles.subsectionTitle}>Two-Factor Authentication</h3>
                  <p className={styles.subsectionDescription}>
                    Add an extra layer of security to your account.
                  </p>
                  <Button variant="secondary">Enable 2FA</Button>
                </div>

                <div className={styles.securitySection}>
                  <h3 className={styles.subsectionTitle}>Active Sessions</h3>
                  <div className={styles.sessionList}>
                    <div className={styles.sessionItem}>
                      <div className={styles.sessionInfo}>
                        <span className={styles.sessionDevice}>Current Session</span>
                        <span className={styles.sessionLocation}>Chrome on macOS</span>
                      </div>
                      <Badge variant="success">Active</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Sign out all other sessions
                  </Button>
                </div>
              </section>
            )}

            {activeTab === "billing" && isOwner && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Billing & Subscription</h2>
                <p className={styles.sectionDescription}>
                  Manage your subscription and billing information.
                </p>

                <div className={styles.planInfo}>
                  <div className={styles.planHeader}>
                    <h3 className={styles.planName}>Pro Plan</h3>
                    <Badge variant="primary">Active</Badge>
                  </div>
                  <div className={styles.planDetails}>
                    <p>$29/month • 2 TB storage • 25 team members</p>
                    <p className={styles.planRenewal}>Renews on March 15, 2024</p>
                  </div>
                </div>

                <div className={styles.billingActions}>
                  <Button variant="secondary">Upgrade Plan</Button>
                  <Button variant="ghost">Update Payment Method</Button>
                  <Button variant="ghost">View Invoices</Button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
