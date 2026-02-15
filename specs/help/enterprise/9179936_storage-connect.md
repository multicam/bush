# Storage Connect for Frame.io

> Source: https://help.frame.io/en/articles/9179936-storage-connect-for-frame-io
> Category: enterprise

---

*Storage Connect is available for Enterprise customers on Frame.io V4.***Frame.io Storage Connect **allows Frame.io’s Enterprise customers to use their own cloud storage endpoint as the backing storage of Frame.io. Today when a user uploads an asset to Frame.io, the asset flows through the application stack and is stored in Frame.io’s Amazon S3 bucket. Similarly, playback and delivery of an asset is serviced from a Frame.io managed Amazon S3 bucket. 
​ 
With Storage Connect, an asset uploaded to Frame.io gets redirected to the customer’s connected storage, rather than Frame.io’s. This offering is available to both net-new and existing customers. To enable existing customers, Frame.io offers a one-time migration of existing customer data historically stored in Frame.io’s managed Amazon S3 bucket to the customer-managed Amazon S3 bucket for general availability. 
​ 
The below information is designed to inform net-new and existing Frame.io customers with a step-by-step guide configuring their S3 bucket for compatibility with Storage Connect. 
​# AWS S3 | SETUP &amp; GUIDELINES FOR NET NEW CUSTOMERSCustomers are to provide Frame.io with an **EMPTY** S3 bucket within the us-east-1 region. To ensure the bucket is properly configured to work securely with Frame.io, follow the steps below within the AWS Console.
​**Create AWS IAM OIDC Identity Provider** 

Visit the Identity and Access Management Dashboard (AWS IAM) at [https://console.aws.amazon.com/iam/](https://console.aws.amazon.com/iam/). From here, you will need to add Frame.io as a new trusted Identity Provider. Follow the steps below to do so.
​
​**Access Management &gt;** **Identity providers**Select **“Add Audience”****Provider Type:** OpenID Connect**Provider URL:** [https://tokens.storage.frame.io](https://tokens.storage.frame.io)Go to endpoint verification.

Choose **Get thumbprint** to verify the server certificate of your IdP.**Audience:** [https://tokens.storage.frame.io](https://tokens.storage.frame.io)
When you are done, choose **&quot;Add audience&quot;**.
Once created, navigate to and select the newly created provider and copy the **Amazon Resource Name (ARN).**The **ARN** can be found within the Summary section of the selected provider, this information will be required during the next step -- creating the IAM role.The ARN value will be formatted similar to the following...

`arn:aws:iam::1234567891234:oidc-provider/tokens.storage.frame.io`

*For more information on setting up AWS IAM OIDC identity provide, please reference [AWS official guides](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)*.
​**Create IAM Role** 

Now that [Frame.io](http://frame.io/) has been created as a trusted Identity Provider, a new **“Role”** can be created to securely give Frame.io access to your bucket. Move through the three steps with the information provided below to complete the configuration successfully.
​
​**Access Management &gt;** **Roles**
​
​**Step 1 | Select Trust Entity**Select **“Create Role”****Trusted Entity Type: **Custom trusted policy**Custom trust policy:**

{
&quot;Version&quot;: &quot;2012-10-17&quot;,
&quot;Statement&quot;: [
{
&quot;Effect&quot;: &quot;Allow&quot;,
&quot;Principal&quot;: {
&quot;Federated&quot;: &quot;IAM_OIDC_PROVIDER_ARN&quot;
},
&quot;Action&quot;: &quot;sts:AssumeRoleWithWebIdentity&quot;,
&quot;Condition&quot;: {
&quot;StringEquals&quot;: {
&quot;tokens.storage.frame.io:sub&quot;: [&quot;FRAMEIO_ACCOUNT_ID&quot;]
}
}
}
]
}*Copy and paste the above into the trust policy field — **Please be mindful of any formatting changes or fat-fingering when doing so.***
​
With the above JSON block in place, be sure to swap out the temporary variables accordingly with your specific customer values. Replace **IAM_OIDC_PROVIDER_ARN** with the AWS IAM OIDC identity ARN — copied from the previous steps — and replace **FRAMEIO_ACCOUNT_ID** with your Frame.io account ID provided by our support team. 
Double-check your work, then choose **Next**.
​
​**Step 2 | Add Permission**
​
To properly give Frame.io permission to access a customer&#x27;s S3 bucket or object key, a new policy will need to be created. 
​ 
Do not select or search through the provided AWS policies, rather, choose “**Create policy”. **A new browser tab will be opened. 
​ 
Select the **JSON **option and copy and paste the following into the field.
​{
&quot;Version&quot;: &quot;2012-10-17&quot;,
&quot;Statement&quot;: [
{
&quot;Action&quot;: [
&quot;s3:PutObject&quot;,
&quot;s3:ListMultipartUploadParts&quot;,
&quot;s3:GetObject&quot;
],
&quot;Effect&quot;: &quot;Allow&quot;,
&quot;Resource&quot;: &quot;arn:aws:s3:::BUCKET_NAME/*&quot;
}
]
}*Again, be mindful of any formatting changes or fat-fingering when doing so.*
​
Just as before, be sure to swap out the temporary variable accordingly with your customer specific value.  Replace **BUCKET_NAME **with your bucket name: 
Double-check your work, then choose **Next.** 
​ 
Provide a **Name **for your policy, and optional **Description** and **Tags, **then choose **Create Policy. **After you create the policy, close that tab and return to your original tab to finish creating the** “Role”**. 
​ 
Now that the custom policy has been created, refresh the browser tab to find and select the newly created policy, then choose **Next**. 
​
​**Step 3 | Name, Review, and Create**
​
Provide a **Name **and an optional **Description **for the role. Review the configuration and choose **Create Role.** 
​ 
Copy the **IAM Role ARN** to provide to your Frame.io Support team, we will need that and a few other pieces of information to update your backend account configuration accordingly.
​# AWS S3 | SETUP &amp; GUIDELINES FOR EXISTING CUSTOMERSTo ensure our existing customer’s success with Storage Connect, Frame.io offers a migration service of existing customer data. This service will copy objects from Frame.io’s managed storage to the customer provided target bucket within AWS us-east-1. Migration services define the differences between net-new and existing customer setup and guidelines. 
​ 
​**Step 1 | Success Plan** 
Working with your account team, develop a plan and timeline for migration to a Storage Connect enabled account. This will include defining the account/accounts to migrate, cleaning up and unarchiving projects as needed, and other general maintenance of the account/accounts. 
​ 
​**Step 2 | Frame.io Migration Service - Bucket Policy** 
With a defined migration plan in place, customers can grant Frame.io’s migration service access to their S3 bucket. 
​ 
Complete the steps defined for net-new customers above, then move forward with the addition of the **S3 Bucket Policy **listed below.  
​ 
To add this migration bucket policy, navigate to your target S3 bucket’s permissions. Once within the “Permissions” tab of your bucket, simply add the below JSON block to the “Bucket Policy” section and save the changes.  
​{
&quot;Version&quot;: &quot;2012-10-17&quot;,
 &quot;Statement&quot;: [
 {
 &quot;Sid&quot;: &quot;FrameioMigrationAccess&quot;,
 &quot;Effect&quot;: &quot;Allow&quot;,
 &quot;Action&quot;: &quot;s3:PutObject&quot;,
 &quot;Resource&quot;: &quot;arn:aws:s3:::BUCKET_NAME/*&quot;,
 &quot;Principal&quot;: {
 &quot;AWS&quot;: &quot;arn:aws:iam::745689021772:role/frameio-storage-connect-migration-access&quot;
 }
 }
 ]
}As always, be sure to swap out the temporary variable, BUCKET_NAME, accordingly with your customer specific value. 
​
​**Step 3 | Policy Clean-Up**
Upon completion of the migration service, customers should remove the below policy from the bucket.
​**Frame.io | ACCOUNT CONFIGURATION &amp; REQUIRED PARAMETERS**The last step in setting up your Frame.io connected storage is to provide your success team with a few key parameters. 
​
Coordinate and pass along the below information to your dedicated Customer Success Manager. From there, your account’s backend will be updated to establish the proper object routing to your S3 bucket or object key. Region: `us-east-1`**Bucket Name****Object Prefix****IAM Role ARN**
Once complete, users can expect to upload content via any Frame.io client and have the original media written to your provided customer storage base.
​
Remember, Frame.io will continue to store your generated proxies and thumbnails to ensure users have the best experience possible within the app. We take this measure as a** Business Continuity** precaution in the case Frame.io were to ever have a lapse in connectivity to the customer’s storage.**Registering Existing S3 Objects in Frame via Import API**Read‑only buckets can be added to your Frame account, keeping your original media in S3. Use the **Import File** endpoint to register those S3 objects into your Frame projects/folders **without copying** the originals.**What the Import does**Creates a File asset in Frame that **points to your S3 object**.Triggers Frame to generate **proxies** for browsing/playback.Leaves the **original** file in-place in your S3.
To learn more about registering assets view the guide [here](https://help.frame.io/en/articles/12356206-storage-connect-for-frame-io-registering-assets).
​**FA**QQ: Can I still use Storage Connect when migrating from Frame.io Legacy to Frame.io V4?**A: **Yes, Storage Connect is fully compatible on V4. 

**Q: Will S3 storage be the primary storage on my account?****A:** Yes, users can expect to upload content via any Frame.io client and have the original media written to your provided customer storage base. 

Frame.io will continue to store your generated proxies and thumbnails to ensure users have the best experience possible within the app. We take this measure as a Business Continuity precaution in the case Frame.io were to ever have a lapse in connectivity to the customer&#x27;s storage.

 

Q: Does the storage sit on the account level, Workspace, or project level?**A:** The storage will live on the Account level. 

**Q: Can I rename an object in the S3 bucket and still access it through Frame.io?**
​**A: **Not at this time. In the future, we may add a capability to “relink” an object to an asset in Frame.io.
​
​**Q: Can I use AWS S3 Lifecycle rules on my bucket to transition objects to cheaper storage types?**
​**A: **You may use your own AWS S3 Lifecycle rules to move objects to other storage types like IA or GIR, however this may incur additional AWS S3 costs if the objects are still actively reviewed within Frame.io.
​
​**Q: Can I move objects to Glacier?**
​**A:** We would advise not to move objects to Glacier. Frame.io will not detect this change and as a result, users will have a degraded experience when attempting to access the original media for download.
​
​**Q: What S3 storage classes are supported?**
​**A:** All classes with instant retrieval (ie Standard, Intelligent-Tiering,Standard-IA, Glacier Instant Retrieval). Not supported: Glacier Flexible Retrieval, Glacier Deep Archive. 

**Q: Can I still “archive” projects within the Frame.io web-app UI?****A:** With Storage Connect, the action of archiving a project will reorganize that project with the “Archived Projects” twirl-down menu of its respective team. 

However, there is no associated call to S3 with this action. It is up to the customer to implement their own lifecycle rules within AWS. The UI interaction by the end-user will have no effect of configured policies or triggers within AWS.

 

End-users can, of course, instantly “unarchive” a project as needed.
​
​**Q: Can I audit access to our S3 bucket?**
​**A:** Yes, you can use AWS CloudTrail to audit when Frame.io assumes the IAM role, and use AWS S3 Access Logs to audit all requests from Frame.io to the Amazon S3 bucket.
​
​**Q: What is Frame.io’s log retention policy?**
​**A:** Logs generated from Frame.io’s AWS environment will fall in line with our existing log retention policies.
​Related ArticlesFrame.io Security InformationAdding storage to my accountConnect Frame.io to Adobe LightroomFrame.io Cloud StorageStorage Connect for Frame.io: Registering Assets

---
*This article was automatically converted from the Frame.io Help Center.*
