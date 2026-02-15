# Storage Connect for Frame.io: Registering Assets

> Source: https://help.frame.io/en/articles/12356206-storage-connect-for-frame-io-registering-assets
> Category: enterprise

---

**Storage Connect** allows Frame.io’s Enterprise customers to use their own cloud storage endpoint as the backing storage of Frame.io. Today when a user uploads an asset to Frame.io, the asset flows through the application stack and is stored in Frame.io’s Amazon S3 bucket. Similarly, playback and delivery of an asset is serviced from a Frame.io managed Amazon S3 bucket. 

Use your own AWS S3 as the source of truth while keeping Frame.io as the single surface to browse, search, share, and review. You can now connect: 

**One primary S3 bucket (read/write)** — where new uploads from Frame.io land. **Any number of additional S3 buckets (read‑only)** — make existing media in S3 visible and playable in Frame.io **without copying or duplicating** originals. 
Frame.io generates lightweight **proxies (thumbnails, previews, playback)** while originals remain in your S3. To register files that already live in your connected buckets, use the **V4 Public API: Import File** endpoint. *Note:** This offering is available to both net-new and existing Frame.io customers using Storage Connect. To enable existing customers, Frame.io offers a one-time migration of existing customer data historically stored in Frame.io’s managed Amazon S3 bucket to the customer-managed Amazon S3 bucket for general availability.*The below information is designed to inform net-new and existing Frame.io customers with a step-by-step guide configuring their S3 bucket for compatibility with Storage Connect.  

 

**Prerequisites** Frame.io **Enterprise** account with **Storage Connect** enabled for your org. Access to create/update **AWS IAM roles/policies** and **S3 bucket** permissions. Access to the **Frame.io V4 Public API** (for the *Import File* endpoint used to register existing objects from read‑only buckets). 
*Note:** For the exact IAM **trust** configuration and account mapping, your Frame.io contact (CSM / Implementation specialist) will provide the current OIDC/role setup and will validate permissions during onboarding. ***Key Concepts** **Primary (read/write) bucket**: The S3 bucket that receives originals when users upload to Frame. Frame requires **read + write** permissions here. **Read‑only buckets**: One or more S3 buckets that Frame can **read**, but **not write**. Assets are made visible in Frame by calling the **Import File** API (no copying of originals). **Proxies**: Frame generates derivatives (thumbnails, previews, and streaming proxies) so assets are playable in Frame even while originals remain in your S3. 
**Part A — Configure the Primary Read/Write S3 Bucket** **Choose or create the S3 bucket** you will use as your primary storage. 
**Create an IAM Role for Frame.io** (trusted by the Frame.io identity provider) and attach an IAM policy that grants **read/write** to the bucket/prefix. 
Example policy skeleton (replace ARNs and restrict to required prefixes where possible): 

{ 
 &quot;Version&quot;: &quot;2012-10-17&quot;, 
 &quot;Statement&quot;: [ 
 { 
 &quot;Sid&quot;: &quot;ListPrimaryBucket&quot;, 
 &quot;Effect&quot;: &quot;Allow&quot;, 
 &quot;Action&quot;: [&quot;s3:ListBucket&quot;], 
 &quot;Resource&quot;: &quot;arn:aws:s3:::YOUR_PRIMARY_BUCKET&quot; 
 }, 
 { 
 &quot;Sid&quot;: &quot;RWPrimaryObjects&quot;, 
 &quot;Effect&quot;: &quot;Allow&quot;, 
 &quot;Action&quot;: [ 
 &quot;s3:GetObject&quot;, 
 &quot;s3:PutObject&quot;, 
 &quot;s3:DeleteObject&quot;, 
 &quot;s3:AbortMultipartUpload&quot;, 
 &quot;s3:ListMultipartUploadParts&quot; 
 ], 
 &quot;Resource&quot;: &quot;arn:aws:s3:::YOUR_PRIMARY_BUCKET/*&quot; 
 } 
 ] 
} **Provide details to Frame.io**: the IAM Role ARN, bucket name, and any preferred object prefixes. Frame.io will complete the mapping so uploads from your users in Frame target this bucket. 
​**Validate** by performing a test upload in Frame to confirm originals land in your S3 and proxies appear in Frame. 
**Part B — Add One or More Read‑Only S3 Buckets** You can associate additional S3 buckets as **read‑only sources**. Frame will read objects for proxy generation and playback, but will not write new objects to these buckets. **Choose your additional S3 buckets** (and optional folder prefixes) to expose in Frame.
​**Create (or update) an IAM Role** used by Frame to grant **read‑only** access to each bucket/prefix. 
Example policy skeleton per bucket (adjust ARNs/prefixes and add for each bucket): 

{ 
 &quot;Version&quot;: &quot;2012-10-17&quot;, 
 &quot;Statement&quot;: [ 
 { 
 &quot;Sid&quot;: &quot;ListReadOnlyBucket&quot;, 
 &quot;Effect&quot;: &quot;Allow&quot;, 
 &quot;Action&quot;: [&quot;s3:ListBucket&quot;], 
 &quot;Resource&quot;: &quot;arn:aws:s3:::YOUR_RO_BUCKET&quot; 
 }, 
 { 
 &quot;Sid&quot;: &quot;ReadObjects&quot;, 
 &quot;Effect&quot;: &quot;Allow&quot;, 
 &quot;Action&quot;: [&quot;s3:GetObject&quot;, &quot;s3:GetObjectVersion&quot;], 
 &quot;Resource&quot;: &quot;arn:aws:s3:::YOUR_RO_BUCKET/*&quot; 
 } 
 ] 
} **Provide details to Frame.io**: the same Role ARN (or distinct ARNs per bucket), each **bucket name** and optional **prefix** that should be exposed as read‑only.
​Proceed to **register existing files** from these read‑only buckets using the **Import File** API (below). 
**Part C — Register Existing S3 Objects in Frame (Import API)** When you add a read‑only bucket, your media already lives in S3. Use the **Import File** endpoint to register those S3 objects into your Frame projects/folders **without copying** the originals. 
​**What the Import does** Creates a File asset in Frame that **points to your S3 object**. Triggers Frame to generate **proxies** for browsing/playback. Leaves the **original** file in-place in your S3. 
**Before you call the API** Ensure Storage Connect mappings are complete (Frame.io has your Role ARN, buckets, and prefixes). 

Have an OAuth token with the required **file** scopes. Identify the destination **container** in Frame (project root or folder asset ID) where the imported file should appear. Identify the S3 **bucket** and **object key** to import. 
**Example (pseudocode cURL)** Use the official API reference for the exact path and fields. The structure below illustrates the intent. 

# PSEUDOCODE — see the &quot;Import File&quot; endpoint docs for the exact URL &amp; schema 

curl -X POST &quot;https://api.frame.io/v4/files.import_file&quot; \ 
 -H &quot;Authorization: Bearer $TOKEN&quot; \ 
 -H &quot;Content-Type: application/json&quot; \ 
 -d &#x27;{ 
 &quot;container_id&quot;: &quot;&lt;FRAME_FOLDER_OR_PROJECT_ASSET_ID&gt;&quot;, 
 &quot;external&quot;: { 
 &quot;provider&quot;: &quot;s3&quot;, 
 &quot;bucket&quot;: &quot;my-readonly-bucket&quot;, 
 &quot;key&quot;: &quot;Marketing/2025/hero.mov&quot; 
 }, 
 &quot;display_name&quot;: &quot;hero.mov&quot; 
 }&#x27; 

**Verify in Frame** Open your destination **Project/Folder** — imported files appear like any other assets. Playback should be immediately available once **proxies** finish generating. Check **asset details** to confirm the storage location is your S3. 
**Behavior &amp; Notes** **Uploads** in any of the Frame clients (web iOS, transfer app, etc), go to the **primary read/write** bucket. **Imported** assets from read‑only buckets remain in place; **deleting** an asset in Frame does **not** delete the original in a read‑only bucket. (Respect your org’s deletion policies for the read/write bucket.) **Lifecycle/archival**: If objects move to Glacier or are temporarily unavailable, previously generated proxies may continue to allow browsing; original retrieval will depend on S3 tier and availability. 
**Troubleshooting** **403/AccessDenied** on import/playback → verify IAM policy includes s3:GetObject for the object ARN. **Objects not discovered** → confirm bucket/prefix mapping matches the object keys you’re importing. **Proxies not generating** → confirm the file type is supported and IAM allows reads; check for transient S3 errors. **Rate limiting** on bulk import → add retry with exponential backoff; throttle concurrency. 
**FAQ** **Q: How many read‑only buckets can I add? ****A: **Any number. Map each bucket (and optional prefixes) with read‑only permissions. 

**Q: Do I need to move or copy my existing library into Frame? ****A:** No. Use the **Import File** API to register in place. 

**Q: Can I remove a bucket later? ****A:** Yes. Removing a read‑only bucket unpublishes those assets from Frame (your originals remain in S3). 

**Q: Does Frame ever write to my read‑only buckets? ****A:** No. Frame reads objects to generate proxies and stream originals when needed; writes occur only to the primary read/write bucket. 

**Related Links** [Storage Connect overview](https://help.frame.io/en/articles/9179936-storage-connect-for-frame-io) (Help Center) [Storage Connect announcement ](https://blog.frame.io/2023/09/13/introducing-frame-io-storage-connect/)(Frame.io Insider blog) Frame.io V4 API Reference — **Import File** endpoint [AWS S3 &amp; IAM documentation for bucket policies ](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security_iam_service-with-iam.html)
*This guide reflects the latest Storage Connect capability: one primary read/write bucket plus multiple read‑only buckets, with registration via the Import File API so you can work in Frame without duplicating originals.* **Important limitation:** SSE‑KMS–encrypted buckets/objects are **not supported** by Storage Connect at this time. 

Related ArticlesC2C: Frame.io Camera to Cloud FAQsMicrosoft Office Support for Frame.ioStorage Connect for Frame.ioConnect Frame.io to Adobe LightroomFrame.io Cloud Storage

---
*This article was automatically converted from the Frame.io Help Center.*
