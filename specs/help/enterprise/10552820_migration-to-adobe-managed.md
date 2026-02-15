# Understanding the Migration to Adobe Managed Frame Subscriptions and Users

> Source: https://help.frame.io/en/articles/10552820-understanding-the-migration-to-adobe-managed-frame-subscriptions-and-users
> Category: enterprise

---

# What is happening to my Enterprise Frame.io account? Adobe is enhancing how you manage your Frame.io subscriptions and users, unifying your experience across all your Adobe products and setting the stage to take advantage of new innovations on our product roadmap. As part of this change, Adobe is migrating your subscriptions and users to the Adobe Admin Console. This is a necessary migration and will not affect any workspace, project, file, or integration. 

 

# What is changing? Following the migration, your subscription and user management will move from the Frame.io web app to the Adobe Admin Console. 

**System Admins **will manage Frame.io licenses on Adobe Admin Console along with any other Adobe products in your organization.** **Your organization assigns System Admin roles. **Frame.io Content Admins and Account Owners **will be assigned the **Product Admin** role in Adobe Admin Console. **Product Admins** will be able to manage licenses and users via Adobe Admin Console. To learn more about Frame.io User and Role Management via Adobe Admin Console, visit this article [here](https://help.frame.io/en/articles/9888212-frame-io-user-and-role-management-via-adobe-admin-console). **Users **will sign in with Adobe Identity. Users may sign in using a new or existing Adobe Identity – either an Adobe ID or Adobe Federated ID (SSO) - depending on how your System Admin set up your organization. *Users do not have access to Adobe Admin Console unless they are also assigned a Product or System Admin role.* 
**Note:** Only one Frame.io account can be associated to each Adobe Admin Console. # Migration Journey First, Adobe will migrate your licenses to Adobe Admin Console. 

This will not impact user management or the way your users log in to Frame.io. 

Continue managing user access in the Frame.io web app until user migration to Adobe Admin Console is complete. 

**Pre-Migration Requirements** Your **Frame.io Account** must be on **V4** **System Admins **will receive an email notification prompting them to log into Adobe Admin Console If your Frame.io users currently login with SSO to login to Frame.io and you intend to use Adobe SSO following the migration, we recommend System Admins set up Adobe SSO on your Adobe Admin Console prior to user migration starting 

If required, one System Admin may need to log in to Adobe Admin Console through the link in this email and click to consent to the user migration 

**Schedule User Migration** Once all pre-migration requirements are satisfied, Adobe will automatically schedule your user migration approximately 30 days in the future. **System Admins **and **Frame.io Content Admins **will receive an email notification with the scheduled migration date. Contact support to request a change to this migration date. Another reminder will be sent the day before your scheduled migration date. 
**Prepare Users for Migration Day** On the scheduled migration date, your migration will be automatically triggered around midnight of your organization’s billing country. Contact support to request a specific time of day to ensure migration occurs outside of business hours.

**Users **will receive an email notification prompting them to create a new Adobe Identity or login with their existing Adobe Identity to access Frame.io. Once the migration is complete, **Users **will need to refresh and login using their new or existing Adobe Identity – either an Adobe ID or Adobe Federated ID (SSO) - before being able to resume activity. 
**User Migration Complete** **System Admins **and **Frame.io Content Admins **(now also Product Admins in Adobe Admin Console) will receive an email notification when user migration is complete. All users log in with Adobe Identity. 

User access is managed through Adobe Admin Console only. 

## What about Frame.io V4 API Access? Following the successful migration of your Frame.io users to Adobe Admin Console and Adobe Identity, you will also gain access to the **Frame.io V4 APIs**, which have been built on the Adobe Developer Console to support our long-term integration strategy. Review the V4 API Doc to assess breaking changes in your existing API integrations, which are available [here.](https://developer.adobe.com/frameio/) 

## What about Secure Reviewers? Users who are granted access to specific share links are NOT administered via the Adobe Admin Console since they do not require a paid license. Those users will continue to be managed within the Frame.io web application only. 

 

# Get Support If you have any questions about the migration, you can get support by emailing [support@frame.io](mailto:support@frame.io). Related ArticlesFrame.io User and Role Management via Adobe Admin ConsoleWhat to expect when updating to V4: A comprehensive guide for Enterprise customersEnterprise V4 Starter Quick LinksConnecting to Adobe authenticationSyncing User Groups from the Admin
Console

---
*This article was automatically converted from the Frame.io Help Center.*
