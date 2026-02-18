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
  customFieldsApi,
  extractMemberCollection,
  getErrorMessage,
  type MemberAttributes,
  type AccountRole,
  type CustomFieldAttributes,
  type CustomFieldType,
} from "@/web/lib/api";
import styles from "./settings.module.css";

type SettingsTab = "profile" | "account" | "team" | "custom-fields" | "notifications" | "security" | "billing";

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

  // Custom fields management state
  const [customFields, setCustomFields] = useState<CustomFieldAttributes[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldAttributes | null>(null);
  const [fieldForm, setFieldForm] = useState({
    name: "",
    type: "text" as CustomFieldType,
    description: "",
    options: "",
    isVisibleByDefault: true,
    editableBy: "full_access" as "admin" | "full_access",
  });
  const [fieldFormLoading, setFieldFormLoading] = useState(false);
  const [fieldFormError, setFieldFormError] = useState<string | null>(null);
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);

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

  // Fetch custom fields
  const fetchCustomFields = useCallback(async () => {
    if (!currentAccount?.id) return;

    setFieldsLoading(true);
    setFieldsError(null);

    try {
      const response = await customFieldsApi.list(currentAccount.id, { limit: 100 });
      setCustomFields(response.data.map((item) => item.attributes));
    } catch (error) {
      console.error("Failed to fetch custom fields:", error);
      setFieldsError(getErrorMessage(error));
    } finally {
      setFieldsLoading(false);
    }
  }, [currentAccount?.id]);

  // Fetch custom fields when custom-fields tab is active
  useEffect(() => {
    if (activeTab === "custom-fields" && currentAccount?.id) {
      fetchCustomFields();
    }
  }, [activeTab, currentAccount?.id, fetchCustomFields]);

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

  // Open create field modal
  const handleCreateField = () => {
    setEditingField(null);
    setFieldForm({
      name: "",
      type: "text",
      description: "",
      options: "",
      isVisibleByDefault: true,
      editableBy: "full_access",
    });
    setFieldFormError(null);
    setShowFieldModal(true);
  };

  // Open edit field modal
  const handleEditField = (field: CustomFieldAttributes) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      type: field.type,
      description: field.description || "",
      options: field.options?.join(", ") || "",
      isVisibleByDefault: field.isVisibleByDefault,
      editableBy: field.editableBy,
    });
    setFieldFormError(null);
    setShowFieldModal(true);
  };

  // Handle save field (create or update)
  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount?.id || !fieldForm.name.trim()) return;

    setFieldFormLoading(true);
    setFieldFormError(null);

    try {
      const options = fieldForm.type === "single_select" || fieldForm.type === "multi_select"
        ? fieldForm.options.split(",").map((o) => o.trim()).filter(Boolean)
        : undefined;

      if (editingField) {
        // Update existing field
        await customFieldsApi.update(editingField.slug, {
          name: fieldForm.name,
          description: fieldForm.description || undefined,
          options,
          is_visible_by_default: fieldForm.isVisibleByDefault,
          editable_by: fieldForm.editableBy,
        });
        setCustomFields((prev) =>
          prev.map((f) =>
            f.slug === editingField.slug
              ? { ...f, name: fieldForm.name, description: fieldForm.description, options: options ?? null, isVisibleByDefault: fieldForm.isVisibleByDefault, editableBy: fieldForm.editableBy }
              : f
          )
        );
      } else {
        // Create new field
        const response = await customFieldsApi.create(currentAccount.id, {
          name: fieldForm.name,
          type: fieldForm.type,
          description: fieldForm.description || undefined,
          options,
          is_visible_by_default: fieldForm.isVisibleByDefault,
          editable_by: fieldForm.editableBy,
        });
        setCustomFields((prev) => [...prev, response.data.attributes]);
      }
      setShowFieldModal(false);
    } catch (error) {
      console.error("Failed to save custom field:", error);
      setFieldFormError(getErrorMessage(error));
    } finally {
      setFieldFormLoading(false);
    }
  };

  // Handle delete field
  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("Are you sure you want to delete this custom field? All data stored in this field will be lost.")) {
      setDeleteFieldId(null);
      return;
    }

    try {
      await customFieldsApi.delete(fieldId);
      setCustomFields((prev) => prev.filter((f) => f.slug !== fieldId));
    } catch (error) {
      console.error("Failed to delete custom field:", error);
      alert(getErrorMessage(error));
    } finally {
      setDeleteFieldId(null);
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
    { id: "custom-fields", label: "Custom Fields", adminOnly: true },
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

            {activeTab === "custom-fields" && (isOwner || isContentAdmin) && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>Custom Fields</h2>
                    <p className={styles.sectionDescription}>
                      Create and manage custom metadata fields for your assets.
                    </p>
                  </div>
                  <Button variant="primary" onClick={handleCreateField}>
                    Add Field
                  </Button>
                </div>

                {fieldsLoading ? (
                  <div className={styles.loading}>Loading fields...</div>
                ) : fieldsError ? (
                  <div className={styles.errorContainer}>
                    <p className={styles.error}>{fieldsError}</p>
                    <Button variant="secondary" onClick={fetchCustomFields}>
                      Try Again
                    </Button>
                  </div>
                ) : customFields.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No custom fields defined yet.</p>
                    <p className={styles.emptyHint}>
                      Custom fields let you add custom metadata to assets beyond the built-in fields.
                    </p>
                  </div>
                ) : (
                  <div className={styles.fieldList}>
                    {customFields.map((field) => (
                      <div key={field.slug} className={styles.fieldItem}>
                        <div className={styles.fieldInfo}>
                          <span className={styles.fieldName}>{field.name}</span>
                          <div className={styles.fieldMeta}>
                            <Badge variant="default">{field.type.replace("_", " ")}</Badge>
                            {field.description && (
                              <span className={styles.fieldDescription}>{field.description}</span>
                            )}
                          </div>
                          {field.options && field.options.length > 0 && (
                            <div className={styles.fieldOptions}>
                              Options: {field.options.join(", ")}
                            </div>
                          )}
                        </div>
                        <div className={styles.fieldActions}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditField(field)}
                          >
                            Edit
                          </Button>
                          {isOwner && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeleteFieldId(field.slug);
                                handleDeleteField(field.slug);
                              }}
                              disabled={deleteFieldId === field.slug}
                            >
                              {deleteFieldId === field.slug ? "Deleting..." : "Delete"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Create/Edit Field Modal */}
                {showFieldModal && (
                  <div className={styles.modal}>
                    <div className={styles.modalContent}>
                      <div className={styles.modalHeader}>
                        <h3 className={styles.modalTitle}>
                          {editingField ? "Edit Field" : "Create Custom Field"}
                        </h3>
                        <button
                          className={styles.modalClose}
                          onClick={() => setShowFieldModal(false)}
                        >
                          ×
                        </button>
                      </div>
                      <form onSubmit={handleSaveField}>
                        <div className={styles.modalBody}>
                          {fieldFormError && (
                            <p className={styles.error}>{fieldFormError}</p>
                          )}
                          <div className={styles.formGroup}>
                            <label className={styles.label}>Field Name</label>
                            <Input
                              value={fieldForm.name}
                              onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                              placeholder="e.g., Episode Number"
                              required
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.label}>Field Type</label>
                            <select
                              value={fieldForm.type}
                              onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value as CustomFieldType })}
                              className={styles.select}
                              disabled={!!editingField}
                            >
                              <option value="text">Text</option>
                              <option value="textarea">Text Area</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                              <option value="single_select">Single Select</option>
                              <option value="multi_select">Multi Select</option>
                              <option value="checkbox">Checkbox</option>
                              <option value="user">User</option>
                              <option value="url">URL</option>
                              <option value="rating">Rating</option>
                            </select>
                            {editingField && (
                              <span className={styles.helperText}>Field type cannot be changed after creation</span>
                            )}
                          </div>
                          {(fieldForm.type === "single_select" || fieldForm.type === "multi_select") && (
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Options</label>
                              <Input
                                value={fieldForm.options}
                                onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })}
                                placeholder="Option 1, Option 2, Option 3"
                              />
                              <span className={styles.helperText}>Separate options with commas</span>
                            </div>
                          )}
                          <div className={styles.formGroup}>
                            <label className={styles.label}>Description (optional)</label>
                            <Input
                              value={fieldForm.description}
                              onChange={(e) => setFieldForm({ ...fieldForm, description: e.target.value })}
                              placeholder="Help text for this field"
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.label}>Editable By</label>
                            <select
                              value={fieldForm.editableBy}
                              onChange={(e) => setFieldForm({ ...fieldForm, editableBy: e.target.value as "admin" | "full_access" })}
                              className={styles.select}
                            >
                              <option value="full_access">Full Access and above</option>
                              <option value="admin">Admin only</option>
                            </select>
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={fieldForm.isVisibleByDefault}
                                onChange={(e) => setFieldForm({ ...fieldForm, isVisibleByDefault: e.target.checked })}
                                className={styles.checkbox}
                              />
                              Visible by default in projects
                            </label>
                          </div>
                        </div>
                        <div className={styles.modalFooter}>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setShowFieldModal(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="primary"
                            disabled={fieldFormLoading || !fieldForm.name.trim()}
                          >
                            {fieldFormLoading ? "Saving..." : (editingField ? "Save Changes" : "Create Field")}
                          </Button>
                        </div>
                      </form>
                    </div>
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
