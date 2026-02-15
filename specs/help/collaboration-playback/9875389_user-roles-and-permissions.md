# User Roles and Permissions

> Source: https://help.frame.io/en/articles/9875389-user-roles-and-permissions
> Category: collaboration-playback

---

This overview will step you through expanded roles and permissions for all user types in a Frame.io V4 account.

 

# Account RolesUsers are added to Frame.io V4 accounts with an Account Role that defines their relationship to the account itself. Those include:

**Account Owner - **Each account has one (and that user can only be the owner of one account). They can see all and do all. 
**Content Admins - **These users can see all content in the account but cannot update plans or billing. 
**Members or Guests - **These users can authenticate into this account, manage their profile and notification settings. 
**Reviewers **– You will see any user you have explicitly added to a secure share as a Reviewer in your account. These users can access Shares you have added them to after authenticating into Frame.io.
If you set up a user as a Member or Guest, they also will need to have permission granted to them inside all other resources (Workspaces, Projects, etc.).

 

If a user is set up with permission on a Workspace, it will also cascade down to all internal Projects within the Workspace. Similarly, your permissions on a Project cascade to all internal files and folders within that Project.

 

Any permissions changed below the highest inherited one will not affect overall their permissions. For example, if a user has Full Access on a Workspace, you cannot lower their permissions to Comment Only within an internal Project by assigning those permissions since the Full Access permissions still inherit downward.

 

## Restricted Projects Restricted projects are only visible to people directly invited. These projects are the exception to full inheritance when updating to V4. Because they break the inheritance chain from the parent resource, you can choose to add any users back into their restricted projects if needed.

*Note:** Owners and Content Admins retain access to all resources, even restricted ones.*Restricted Projects are only accessible by those users directly invited to the Project (and Account Owners and Content Admins). Users invited to the Workspace do not inherit access to Restricted Projects, however a user can be re-invited directly to a Restricted Project in order to grant them access.

 

There are no limitations on who you can invite to a Restricted Project (other than the 1 Project limit on Guests).

*Note:** Any Private Projects you have in a Legacy (V3) account will be converted into Restricted Projects in V4 with the same users having access.*## Account Permissions Permissions granted to you based on your Account Role apply account wide. They are distinct from the permissions you get from being invited to a specific Resource (Workspace or Project).

 

 

# User Permissions### User Permission Quick Definitions **Full Access **– User with full abilities within a Frame.io resource. 
**Edit &amp; Share** – User with the ability to upload and manage assets, share, comment, view, and download. 
**Edit **– User with the same abilities as “Edit &amp; Share” without share and download privileges. 
**Comment Only** – User who can comment and view assets only. 
**View Only** – User who can view assets only. 
 

## Workspace Permissions Below are the actions a user can take if granted these resource permissions on a Workspace.

*Note:** Account Owners and Content Admins have all permissions on Workspaces and Projects, and are not listed here explicitly.* 

** Edit &amp; Share and Edit cannot make restricted projects*
​* *## Project Permissions Below are the actions a user can take if granted these resource permissions on a Project. Remember if a user has these permissions on the Workspace, they will inherit them to the Project.

*​Note:** Account Owners and Content Admins have all permissions on Workspaces and Projects, and are not listed here explicitly.* 

 

## External Permissions While there is no permission for external actions in an account, below are the actions a user can take if a Share link is given to them.

*This takes place outside of the Frame.io account, so the permissions only apply if a user is logged into their Frame.io account when viewing the Share link. Otherwise, all users default to Reviewer and the settings applied to that Share link.* 

## Difference between Comment Only / View Only and Reviewer These three roles/permissions in Frame.io exist as ways to heavily limit what a user can do inside of or outside of an account. The benefit of permissions in Frame.io V4 is that any account user can be given permissions with granularity across multiple Workspaces or Projects. For example, you now have more control over whether you want a user to have Full Access in one Project, Comment Only in another, and then apply View Only in a third one.

 

While you can invite a user to have Comment Only or View Only access across your entire Workspace, keep in mind that:

This user will be a paid seat with very restricted access to the given resource 

Share links allow anyone to be a Reviewer, and they are a cost-effective way to allow a user to have View Only or Comment Only access (based on your share settings) and be able to share as much content as you need with them for free

So, it might not be recommended you set a user as Comment Only or View Only as the only role in your account but do whatever works best for your team. Be flexible and apply the access you feel is appropriate for any given user in your account!

Related ArticlesGetting Started: What is a User?Adobe Premiere Frame.io V4 Comments Panel OverviewFrame.io User and Role Management via Adobe Admin ConsoleWhat to expect when updating to V4: A comprehensive guide for Enterprise customersWhat to expect when updating to V4: A comprehensive guide for updating your account on a Free, Pro, or Team Plan

---
*This article was automatically converted from the Frame.io Help Center.*
