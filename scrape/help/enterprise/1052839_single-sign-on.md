# Single Sign-On (SSO)

> Source: https://help.frame.io/en/articles/1052839-single-sign-on-sso
> Category: enterprise

---

Currently, we support any platform that conforms to the SAML2 protocol for SSO (ADFS / Okta, etc.). What we&#x27;ll need from you to integrate with your Identity Provider is:

An X509 certificate

An entry point URL for your service

Additionally, you&#x27;ll need to configure your service to send over an email address for the user as the UserId, and their name as either FirstName / LastName or a single Name field.
​The URL you&#x27;ll need from our side will be:

[https://sso.frame.io/companyname/connect/saml/callback](https://sso.frame.io/companyname/connect/saml/callback)
Where** &#x27;company_name&#x27;** is the name of the company as a string with no special characters and all lowercase **(fullcompanyname)** in your case. 

As a note, our SSO works across all our platforms (iOS / Premiere / After Effects), and once it is enabled, any users on your domain(s) will be required to use it to access Frame.io.

 

Once you have these details, we can enable SSO on your account and set up the service.

 

We assign your account an Account Manager. They&#x27;ll be available directly through email communication with the information provided above. Your Account Manager will walk you through the proper SSO configuration, so you can expect this to be a quick and straightforward set-up.

 

*Note:** Users must be invited to your Workspace before they sign in so they are attached to the SSO flow.*Related ArticlesMandatory account two-factor authentication (2FA)What to expect when updating to V4: A comprehensive guide for Enterprise customersEnterprise V4 Starter Quick LinksUnderstanding the Migration to Adobe Managed Frame Subscriptions and UsersConnecting to Adobe authentication

---
*This article was automatically converted from the Frame.io Help Center.*
