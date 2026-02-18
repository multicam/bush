/**
 * Bush Platform - Settings Page
 *
 * Account and workspace settings management.
 * Reference: IMPLEMENTATION_PLAN.md 1.7a
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/web/components/layout";
import { Button, Input, Badge } from "@/web/components/ui";
import { useAuth, useHasRole } from "@/web/context";
import { getDisplayName, getUserInitials } from "@/web/lib/auth";
import {
  membersApi,
  extractMemberCollection,
  getErrorMessage,
  type MemberAttributes,
  type AccountRole,
} from "@/web/lib/api";
import styles from "./settings.module.css";

type SettingsTab = "profile" | "account" | "team" | "notifications" | "security" | "billing";

interface Member extends MemberAttributes {
  id: string;
}

export default function SettingsPage() {
  const { user, currentAccount } = useAuth();
  const isOwner = useHasRole("owner");
  const isContentAdmin = useHasRole("content_admin");
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Team management state
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AccountRole>("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [roleUpdateLoading, setRoleUpdateLoading] = useState<string | null>(null);

  const _displayName = user ? getDisplayName(user) : "User";
  const initials = user ? getUserInitials(user) : "?";

  // Fetch team members
  const fetchMembers = useCallback(async () => {
    if (!currentAccount?.id) return;

    setMembersLoading(true);
    setMembersError(null);

    try {
      const response = await membersApi.list(currentAccount.id, { limit: 100 });
      const memberList = extractMemberCollection(response);
      setMembers(memberList as Member[]);
    } catch (error) {
      console.error("Failed to fetch members:", error);
      setMembersError(getErrorMessage(error));
    } finally {
      setMembersLoading(false);
    }
  }, [currentAccount?.id]);

  // Fetch members when team tab is active
  useEffect(() => {
    if (activeTab === "team" && currentAccount?.id) {
      fetchMembers();
    }
  }, [activeTab, currentAccount?.id, fetchMembers]);

  // Handle invite member
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount?.id || !inviteEmail.trim()) return;

    setInviteLoading(true);
    setInviteError(null);

    try {
      const response = await membersApi.invite(currentAccount.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      const newMember = extractMemberCollection({ data: [response.data], links: {}, meta: { total_count: 1, page_size: 1, has_more: false } })[0];
      setMembers((prev) => [...prev, newMember as Member]);
      setInviteEmail("");
      setInviteRole("member");
    } catch (error) {
      console.error("Failed to invite member:", error);
      setInviteError(getErrorMessage(error));
    } finally {
      setInviteLoading(false);
    }
  };

  // Handle role update
  const handleRoleUpdate = async (memberId: string, newRole: AccountRole) => {
    if (!currentAccount?.id) return;

    setRoleUpdateLoading(memberId);

    try {
      await membersApi.updateRole(currentAccount.id, memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } catch (error) {
      console.error("Failed to update role:", error);
      alert(getErrorMessage(error));
    } finally {
      setRoleUpdateLoading(null);
    }
  };

  // Handle remove member
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!currentAccount?.id) return;

    if (!confirm(`Are you sure you want to remove ${memberName} from the account?`)) {
      return;
    }

    try {
      await membersApi.remove(currentAccount.id, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (error) {
      console.error("Failed to remove member:", error);
      alert(getErrorMessage(error));
    }
  };

  // Get role badge variant
  const getRoleBadgeVariant = (role: AccountRole): "primary" | "success" | "default" => {
    switch (role) {
      case "owner":
        return "primary";
      case "content_admin":
        return "success";
      default:
        return "default";
    }
  };

  // Format role display
  const formatRole = (role: AccountRole): string => {
    return role.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

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

                {/* Invite Form */}
                <form onSubmit={handleInviteMember} className={styles.inviteForm}>
                  <div className={styles.inviteRow}>
                    <Input
                      label="Email Address"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@example.com"
                      required
                    />
                    <div className={styles.inviteSelect}>
                      <label className={styles.selectLabel}>Role</label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as AccountRole)}
                        className={styles.select}
                      >
                        <option value="member">Member</option>
                        <option value="guest">Guest</option>
                        <option value="reviewer">Reviewer</option>
                        {isOwner && (
                          <>
                            <option value="content_admin">Content Admin</option>
                            <option value="owner">Owner</option>
                          </>
                        )}
                      </select>
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={inviteLoading || !inviteEmail.trim()}
                    >
                      {inviteLoading ? "Inviting..." : "Invite"}
                    </Button>
                  </div>
                  {inviteError && (
                    <p className={styles.error}>{inviteError}</p>
                  )}
                </form>

                {/* Members List */}
                {membersLoading ? (
                  <div className={styles.loading}>Loading members...</div>
                ) : membersError ? (
                  <div className={styles.errorContainer}>
                    <p className={styles.error}>{membersError}</p>
                    <Button variant="secondary" onClick={fetchMembers}>
                      Try Again
                    </Button>
                  </div>
                ) : members.length === 0 ? (
                  <p className={styles.emptyState}>No team members found.</p>
                ) : (
                  <div className={styles.memberList}>
                    {members.map((member) => (
                      <div key={member.id} className={styles.memberItem}>
                        <div className={styles.memberInfo}>
                          <span className={styles.memberName}>
                            {member.user.first_name && member.user.last_name
                              ? `${member.user.first_name} ${member.user.last_name}`
                              : member.user.email}
                          </span>
                          <span className={styles.memberEmail}>
                            {member.user.email}
                          </span>
                        </div>
                        <div className={styles.memberActions}>
                          {roleUpdateLoading === member.id ? (
                            <span className={styles.updating}>Updating...</span>
                          ) : member.user.id === user?.id ? (
                            <Badge variant={getRoleBadgeVariant(member.role)}>
                              {formatRole(member.role)} (You)
                            </Badge>
                          ) : (
                            <>
                              <select
                                value={member.role}
                                onChange={(e) => handleRoleUpdate(member.id, e.target.value as AccountRole)}
                                className={`${styles.select} ${styles.roleSelect}`}
                                disabled={
                                  // Only owner can change owner/content_admin roles
                                  ((member.role === "owner" || member.role === "content_admin") && !isOwner) ||
                                  // Content admins can only modify member/guest/reviewer
                                  (isContentAdmin && !isOwner && (member.role === "owner" || member.role === "content_admin"))
                                }
                              >
                                <option value="member">Member</option>
                                <option value="guest">Guest</option>
                                <option value="reviewer">Reviewer</option>
                                {isOwner && (
                                  <>
                                    <option value="content_admin">Content Admin</option>
                                    <option value="owner">Owner</option>
                                  </>
                                )}
                              </select>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMember(
                                  member.id,
                                  member.user.first_name && member.user.last_name
                                    ? `${member.user.first_name} ${member.user.last_name}`
                                    : member.user.email
                                )}
                                disabled={
                                  // Content admins cannot remove owners or content admins
                                  (isContentAdmin && !isOwner && (member.role === "owner" || member.role === "content_admin"))
                                }
                              >
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
