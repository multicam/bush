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
import { X } from "lucide-react";

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
      <div className="p-8 max-w-[80rem] mx-auto sm:p-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary m-0">Settings</h1>
        </div>

        <div className="grid grid-cols-[200px_1fr] gap-8 md:grid-cols-1 md:gap-0">
          {/* Sidebar Navigation */}
          <nav className="flex flex-col gap-1 md:flex-row md:overflow-x-auto md:pb-2 md:mb-4 md:gap-2">
            {filteredTabs.map((tab) => (
              <button
                key={tab.id}
                className={`px-4 py-3 text-sm font-medium text-secondary bg-transparent border-none rounded-lg cursor-pointer text-left transition-colors md:whitespace-nowrap hover:text-primary hover:bg-surface-2 ${activeTab === tab.id ? "text-accent bg-[rgba(0,102,255,0.1)]" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="min-w-0">
            {activeTab === "profile" && (
              <section className="bg-surface-2 border border-border-default rounded-xl p-6">
                <h2 className="text-lg font-semibold text-primary m-0 mb-2">Profile Settings</h2>
                <p className="text-sm text-secondary mb-6">
                  Update your personal information and preferences.
                </p>

                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-16 h-16 flex items-center justify-center bg-surface-3 rounded-full text-xl font-semibold text-secondary">
                      {initials}
                    </div>
                    <Button variant="secondary" size="sm">
                      Change Avatar
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
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

                  <div className="flex justify-end mt-4 pt-4 border-t border-border-default">
                    <Button variant="primary">Save Changes</Button>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "account" && (
              <section className="bg-surface-2 border border-border-default rounded-xl p-6">
                <h2 className="text-lg font-semibold text-primary m-0 mb-2">Account Settings</h2>
                <p className="text-sm text-secondary mb-6">
                  Manage your account details and preferences.
                </p>

                {currentAccount && (
                  <div className="p-4 bg-surface-1 border border-border-default rounded-lg mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-base font-semibold text-primary m-0">{currentAccount.name}</h3>
                      <Badge variant="default">{currentAccount.role.replace("_", " ")}</Badge>
                    </div>
                    <div className="flex gap-8 sm:flex-col sm:gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-secondary uppercase tracking-wide">Plan</span>
                        <span className="text-sm font-medium text-primary">Pro</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-secondary uppercase tracking-wide">Storage</span>
                        <span className="text-sm font-medium text-primary">479 GB / 2 TB</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-secondary uppercase tracking-wide">Members</span>
                        <span className="text-sm font-medium text-primary">15 / 25</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-8 p-4 bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.2)] rounded-lg">
                  <h3 className="text-sm font-semibold text-red-500 m-0 mb-2">Danger Zone</h3>
                  <p className="text-xs text-secondary mb-4">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <Button variant="danger">Delete Account</Button>
                </div>
              </section>
            )}

            {activeTab === "team" && (isOwner || isContentAdmin) && (
              <section className="bg-surface-2 border border-border-default rounded-xl p-6">
                <h2 className="text-lg font-semibold text-primary m-0 mb-2">Team Management</h2>
                <p className="text-sm text-secondary mb-6">
                  Manage team members and their permissions.
                </p>

                {/* Invite Form */}
                <form onSubmit={handleInviteMember} className="mb-6 p-4 bg-surface-1 border border-border-default rounded-lg">
                  <div className="flex gap-4 items-end sm:flex-col sm:items-stretch">
                    <div className="flex-1">
                      <Input
                        label="Email Address"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@example.com"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-primary">Role</label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as AccountRole)}
                        className="px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-1 text-primary cursor-pointer min-w-[140px] focus:outline-none focus:border-accent focus:ring-2 focus:ring-[rgba(0,102,255,0.1)] disabled:opacity-60 disabled:cursor-not-allowed"
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
                    <p className="text-red-500 text-sm mt-2">{inviteError}</p>
                  )}
                </form>

                {/* Members List */}
                {membersLoading ? (
                  <div className="p-8 text-center text-secondary">Loading members...</div>
                ) : membersError ? (
                  <div className="p-4 text-center">
                    <p className="text-red-500 text-sm mt-2">{membersError}</p>
                    <Button variant="secondary" onClick={fetchMembers}>
                      Try Again
                    </Button>
                  </div>
                ) : members.length === 0 ? (
                  <p className="p-8 text-center text-secondary">No team members found.</p>
                ) : (
                  <div className="flex flex-col border border-border-default rounded-lg overflow-hidden">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between px-4 py-3.5 border-b border-border-default bg-surface-1 last:border-b-0">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-primary">
                            {member.user.first_name && member.user.last_name
                              ? `${member.user.first_name} ${member.user.last_name}`
                              : member.user.email}
                          </span>
                          <span className="text-xs text-secondary">
                            {member.user.email}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {roleUpdateLoading === member.id ? (
                            <span className="text-xs text-secondary">Updating...</span>
                          ) : member.user.id === user?.id ? (
                            <Badge variant={getRoleBadgeVariant(member.role)}>
                              {formatRole(member.role)} (You)
                            </Badge>
                          ) : (
                            <>
                              <select
                                value={member.role}
                                onChange={(e) => handleRoleUpdate(member.id, e.target.value as AccountRole)}
                                className="px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-1 text-primary cursor-pointer min-w-[140px] mr-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-[rgba(0,102,255,0.1)] disabled:opacity-60 disabled:cursor-not-allowed"
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
              <section className="bg-surface-2 border border-border-default rounded-xl p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-primary m-0 mb-2">Custom Fields</h2>
                    <p className="text-sm text-secondary">
                      Create and manage custom metadata fields for your assets.
                    </p>
                  </div>
                  <Button variant="primary" onClick={handleCreateField}>
                    Add Field
                  </Button>
                </div>

                {fieldsLoading ? (
                  <div className="p-8 text-center text-secondary">Loading fields...</div>
                ) : fieldsError ? (
                  <div className="p-4 text-center">
                    <p className="text-red-500 text-sm mt-2">{fieldsError}</p>
                    <Button variant="secondary" onClick={fetchCustomFields}>
                      Try Again
                    </Button>
                  </div>
                ) : customFields.length === 0 ? (
                  <div className="p-8 text-center text-secondary">
                    <p>No custom fields defined yet.</p>
                    <p className="text-sm text-secondary mt-2">
                      Custom fields let you add custom metadata to assets beyond the built-in fields.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col border border-border-default rounded-lg overflow-hidden">
                    {customFields.map((field) => (
                      <div key={field.slug} className="flex items-center justify-between p-4 border-b border-border-default bg-surface-1 last:border-b-0">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-primary">{field.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="default">{field.type.replace("_", " ")}</Badge>
                            {field.description && (
                              <span className="text-xs text-secondary">{field.description}</span>
                            )}
                          </div>
                          {field.options && field.options.length > 0 && (
                            <div className="text-xs text-secondary italic">
                              Options: {field.options.join(", ")}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
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
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
                    <div className="bg-surface-1 rounded-xl w-full max-w-[500px] max-h-[90vh] overflow-y-auto shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)]">
                      <div className="flex justify-between items-center px-6 py-4 border-b border-border-default">
                        <h3 className="text-base font-semibold text-primary m-0">
                          {editingField ? "Edit Field" : "Create Custom Field"}
                        </h3>
                        <button
                          className="bg-none border-none text-secondary cursor-pointer p-0 leading-none hover:text-primary"
                          onClick={() => setShowFieldModal(false)}
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                      <form onSubmit={handleSaveField}>
                        <div className="p-6">
                          {fieldFormError && (
                            <p className="text-red-500 text-sm mb-4">{fieldFormError}</p>
                          )}
                          <div className="mb-4 last:mb-0">
                            <label className="block text-sm font-medium text-primary mb-1.5">Field Name</label>
                            <Input
                              value={fieldForm.name}
                              onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                              placeholder="e.g., Episode Number"
                              required
                            />
                          </div>
                          <div className="mb-4 last:mb-0">
                            <label className="block text-sm font-medium text-primary mb-1.5">Field Type</label>
                            <select
                              value={fieldForm.type}
                              onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value as CustomFieldType })}
                              className="px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-1 text-primary cursor-pointer min-w-[140px] w-full focus:outline-none focus:border-accent focus:ring-2 focus:ring-[rgba(0,102,255,0.1)] disabled:opacity-60 disabled:cursor-not-allowed"
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
                              <span className="block text-xs text-secondary mt-1">Field type cannot be changed after creation</span>
                            )}
                          </div>
                          {(fieldForm.type === "single_select" || fieldForm.type === "multi_select") && (
                            <div className="mb-4 last:mb-0">
                              <label className="block text-sm font-medium text-primary mb-1.5">Options</label>
                              <Input
                                value={fieldForm.options}
                                onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })}
                                placeholder="Option 1, Option 2, Option 3"
                              />
                              <span className="block text-xs text-secondary mt-1">Separate options with commas</span>
                            </div>
                          )}
                          <div className="mb-4 last:mb-0">
                            <label className="block text-sm font-medium text-primary mb-1.5">Description (optional)</label>
                            <Input
                              value={fieldForm.description}
                              onChange={(e) => setFieldForm({ ...fieldForm, description: e.target.value })}
                              placeholder="Help text for this field"
                            />
                          </div>
                          <div className="mb-4 last:mb-0">
                            <label className="block text-sm font-medium text-primary mb-1.5">Editable By</label>
                            <select
                              value={fieldForm.editableBy}
                              onChange={(e) => setFieldForm({ ...fieldForm, editableBy: e.target.value as "admin" | "full_access" })}
                              className="px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-1 text-primary cursor-pointer min-w-[140px] w-full focus:outline-none focus:border-accent focus:ring-2 focus:ring-[rgba(0,102,255,0.1)] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <option value="full_access">Full Access and above</option>
                              <option value="admin">Admin only</option>
                            </select>
                          </div>
                          <div className="mb-4 last:mb-0">
                            <label className="flex items-center gap-2 text-sm text-primary cursor-pointer">
                              <input
                                type="checkbox"
                                checked={fieldForm.isVisibleByDefault}
                                onChange={(e) => setFieldForm({ ...fieldForm, isVisibleByDefault: e.target.checked })}
                                className="w-4 h-4 cursor-pointer"
                              />
                              Visible by default in projects
                            </label>
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-default bg-surface-2">
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
              <section className="bg-surface-2 border border-border-default rounded-xl p-6">
                <h2 className="text-lg font-semibold text-primary m-0 mb-2">Notification Preferences</h2>
                <p className="text-sm text-secondary mb-6">
                  Choose how and when you want to be notified.
                </p>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between p-4 bg-surface-1 border border-border-default rounded-lg">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-primary">Email Notifications</span>
                      <span className="text-xs text-secondary">
                        Receive email notifications for important updates
                      </span>
                    </div>
                    <input type="checkbox" defaultChecked className="w-10 h-6 cursor-pointer" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-1 border border-border-default rounded-lg">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-primary">Comment Mentions</span>
                      <span className="text-xs text-secondary">
                        Get notified when someone mentions you in a comment
                      </span>
                    </div>
                    <input type="checkbox" defaultChecked className="w-10 h-6 cursor-pointer" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-1 border border-border-default rounded-lg">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-primary">Share Activity</span>
                      <span className="text-xs text-secondary">
                        Notifications when someone views or downloads your shares
                      </span>
                    </div>
                    <input type="checkbox" className="w-10 h-6 cursor-pointer" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-1 border border-border-default rounded-lg">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-primary">Weekly Digest</span>
                      <span className="text-xs text-secondary">
                        Receive a weekly summary of activity
                      </span>
                    </div>
                    <input type="checkbox" defaultChecked className="w-10 h-6 cursor-pointer" />
                  </div>
                </div>

                <div className="flex justify-end mt-4 pt-4 border-t border-border-default">
                  <Button variant="primary">Save Preferences</Button>
                </div>
              </section>
            )}

            {activeTab === "security" && (
              <section className="bg-surface-2 border border-border-default rounded-xl p-6">
                <h2 className="text-lg font-semibold text-primary m-0 mb-2">Security Settings</h2>
                <p className="text-sm text-secondary mb-6">
                  Manage your security preferences and active sessions.
                </p>

                <div className="mb-8 last:mb-0">
                  <h3 className="text-sm font-semibold text-primary m-0 mb-1">Two-Factor Authentication</h3>
                  <p className="text-xs text-secondary mb-3">
                    Add an extra layer of security to your account.
                  </p>
                  <Button variant="secondary">Enable 2FA</Button>
                </div>

                <div className="mb-8 last:mb-0">
                  <h3 className="text-sm font-semibold text-primary m-0 mb-1">Active Sessions</h3>
                  <div className="mb-3">
                    <div className="flex items-center justify-between px-4 py-3 bg-surface-1 border border-border-default rounded-lg">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-primary">Current Session</span>
                        <span className="text-xs text-secondary">Chrome on macOS</span>
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
              <section className="bg-surface-2 border border-border-default rounded-xl p-6">
                <h2 className="text-lg font-semibold text-primary m-0 mb-2">Billing & Subscription</h2>
                <p className="text-sm text-secondary mb-6">
                  Manage your subscription and billing information.
                </p>

                <div className="p-5 bg-surface-1 border border-border-default rounded-lg mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-primary m-0">Pro Plan</h3>
                    <Badge variant="primary">Active</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-secondary m-0">$29/month - 2 TB storage - 25 team members</p>
                    <p className="text-xs text-secondary mt-1">Renews on March 15, 2024</p>
                  </div>
                </div>

                <div className="flex gap-3">
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
