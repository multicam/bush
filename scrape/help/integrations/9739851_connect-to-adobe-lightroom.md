# Connect Frame.io to Adobe Lightroom

> Source: https://help.frame.io/en/articles/9739851-connect-frame-io-to-adobe-lightroom
> Category: integrations

---

## Explaining Frame.io‘s connection to LightroomFrame.io’s connection to Lightroom allows users to connect a [Frame.io Version 4](https://frame.io/v4) project directly to an Adobe Lightroom account for seamless image transfer into the full Lightroom ecosystem (desktop, web, and mobile). 

Paired with Frame.io’s Camera to Cloud (C2C) technology, users can leverage automatic image transfer which allows all C2C image assets to push directly to Lightroom once uploaded to Frame.io. This enables a scalable collaborative workflow that can connect multiple cameras to individual Frame.io projects, and multiple Frame.io projects to the same Lightroom account.

Frame.io allows for two types of image transfer into Lightroom: automatic and manual transfer. Automatic transfer only applies to images uploaded through Camera to Cloud and will automatically copy C2C images into Lightroom once they upload to Frame.io. Manual transfer allows users to select images in Frame.io for transfer to Lightroom. 

For more information on Camera to Cloud, please refer to our [C2C Support Articles](https://help.frame.io/en/collections/8960335-frame-io-c2c).​**Note:*** [Frame.io](http://frame.io/) connection to Adobe Lightroom only supports images at this time.*Let’s get started.

 

## What you&#x27;ll needActive Frame.io Version 4 account (free or paid)

Active Adobe ID with Lightroom entitlement

For automatic transfer, a C2C supported device

For manual transfer, image assets in a Frame.io project

 

## Getting StartedEnter a Frame.io Version 4 project through the web app and navigate to the C2C Connections tab, located to the bottom-left of your workspace.
​ 

From within the C2C Connections page of your project, click Connect Lightroom in the top-right of the workspace. This will launch an in-app prompt to “Sign in with Adobe ID”.

 

Select “Sign in with Adobe ID”. This will briefly take you to an Adobe webpage for sign in. If you have multiple Profiles, make sure you select the same Profile you are using in Lightroom. After selecting a Profile, you&#x27;ll be returned to Frame.io and Lightroom will be connected. You&#x27;ll also have the ability to enable automatic transfer of C2C assets to your connected Lightroom account.​

 

To manually send images to Adobe Lightroom, select a single asset or multiple assets, right click, and select “Send to Lightroom”.
​ 

 Begin shooting! With auto transfer to Lightroom enabled, Camera to Cloud image files will automatically push to your connected Adobe Lightroom account once they arrive to Frame.io.

*Note:** “Automatically send new C2C uploads” will be enabled by default. If you would prefer to send files to Lightroom manually, this setting can be disabled here.*## FAQs**Q: Where will photos land in Lightroom? Can I direct photos to a chosen Lr album?****A:** All files can be found in the “All Files” and “Recently Added” sections of Adobe Lightroom. From there, users are free to organize photos into albums of their choice. Any images sent to Lightroom will also be accessible anywhere you can view recently uploaded assets to Adobe Lightroom (Adobe CC, Photoshop, etc.)
​**Q: Can photos be sent back to Frame.io from Lightroom?****A: **Files will need to be rendered out of Lightroom and uploaded back to Frame.io. 

**Q: What image formats are currently supported for transfer to Lightroom?****A:** 3fr, arq, arw, avif, cr2, cr3, crw, dcr, dng, dxo, erf, fff, gpr, hif, heic, heif, iiq, jfif, jpe, jpeg, jpg, jxl, kdc, mef, mfw, mos, mrw, nef, nrw, orf, pef, png, psd, raf, raw, rw2, rwl, sr2, srf, srw, tif, tiff, x3f 

**Q: Is storage shared between Frame.io and Adobe Lightroom?****A:** No. Frame.io and Lightroom storage are managed by separate plans. 

**Q: Can I connect more than one Frame.io project to my Lightroom account?****A:** Yes! Any project a user can access can be connected to their Lightroom account. 

**Q: Can I connect more than one Lightroom account to an individual Frame.io project?****A:** No. A Frame.io project can only connect to one Lightroom account at a time. 

**Q: How can I switch which Lightroom account my project is connected to?****A: **Any user can disconnect an active Lightroom connection (even if not their own) and then reconnect to their own account. You can only connect a Lightroom account that uses the same email as the actively signed in Frame.io user. 

**Q: Can I connect my Frame.io project to another users’ Adobe Lightroom?****A: **You must be logged into Frame.io with the same email address as the Adobe Lightroom account you want to connect. 

If you would like another user to connect their Lightroom account, you can add that user to your Frame.io project under the same email address that they use for Lightroom. Once added, they&#x27;ll have the ability to connect their Lightroom account.

 

Similarly, if you use different email addresses for Frame.io and Lightroom, you can invite the email used for your Lightroom account to your Frame.io project, then can proceed with connection by logging in to Frame.io with the email tied to your Lightroom account.

 

**Q: Does this work with Lightroom Classic?****A: **Adobe Lightroom has the ability to sync files from the Cloud into Lightroom Classic. Once your photos are transferred to Lightroom, then you can sync these to a Lightroom Classic catalog. See: [Set up Lightroom Classic for sync](https://helpx.adobe.com/lightroom-classic/help/lightroom-mobile-desktop-features.html)
​**Q: Can I see a queue of my transferring files?****A: **Not at this time. 

**Q: What happens if I send the same file to Lightroom more than once?****A:** It will only transfer once. 

**Q: What do I do if not all of my files upload from my C2C device?****A: **If there is still an active upload queue on your C2C device, keep it powered on and connected to the internet to complete upload. 

**Q: My files are not showing up in Lightroom, what do I do?****A: **There are a few possible reasons files may not show up in Lightroom. Follow the below troubleshooting steps:#### Check that your files have uploaded to Frame.ioIf you are using C2C and expect to see automatic transfer to Lightroom, make sure the files were uploaded from the camera to Frame.io first. This will help determine if there is an issue with your connection to Lightroom or with your [local connectivity](https://help.frame.io/en/articles/8571967-c2c-complete-internet-connection-guide).#### Give it a few more moments for Lightroom to display newly imported assets.Most files transfer within a few seconds, but they do not always show up immediately in Lightroom, as Lightroom may take a few moments to update with newly imported files.

 

Lightroom Classic and Lightroom Mobile both poll every 30 seconds for new files, so you may need to wait up to 30 seconds for images to import.

 

Lightroom web will not automatically update, you need to refresh the browser.

#### Make sure you are logged in to the same Adobe Creative Cloud Profile both in Frame.io and in Lightroom.Some users may have multiple Profiles associated with their Adobe Creative Cloud logins. To change Profiles, logout of Adobe Creative Cloud in Lightroom or the Frame.io connection to Lightroom and log back in.

*Note*: if you do not see the Profile Picker when logging back in, try logging in with a private or incognito window in your browser.#### If you’re using Camera to Cloud and expect to see automatic transfer into Lightroom, confirm your Frame.io connection has auto transfer enabled.Auto transfer is enabled by default, but if disabled, C2C uploads will not transfer automatically.

#### Try looking at “Recently Added” or sort by “Import Date”.When viewing “All Photos” sorted by &quot;Capture Date&quot; in Lightroom, manually transferred images may appear deeper into your view, depending on the date they were actually captured. Changing your sort order to “Import Date” or viewing your “Recently Added” images should allow you to see the assets that have most recently arrived to Lightroom, regardless of capture date.

#### Confirm file type is supported for transfer to Lightroom.Video files are not yet supported so C2C uploads of video will not show up in Lightroom.

 

Manually sending unsupported files will prompt the following error: 

 

Related ArticlesFrame.io Transfer: Download and upload files, folders, and projects on your desktopC2C: Frame.io Camera to Cloud FAQsC2C: ZoeLog QuickStart GuideC2C: Fujifilm QuickStart GuideC2C: Getting Started with Camera to Cloud

---
*This article was automatically converted from the Frame.io Help Center.*
