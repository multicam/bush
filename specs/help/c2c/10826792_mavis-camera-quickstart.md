# C2C: Mavis Camera QuickStart Guide

> Source: https://help.frame.io/en/articles/10826792-c2c-mavis-camera-quickstart-guide
> Category: c2c

---

The [Mavis Camera app](https://mavis.cloud/camera/) is a powerful, professional camera app for iPhone. The Mavis Camera app allows you to record high-quality video on a smartphone with professional features such as monitoring tools, timecode sync, and manual exposure tools.
​
Use this guide to quickly setup Mavis Camera for C2C with settings recommended by Frame.io. 

# What you&#x27;ll needMavis Camera app version 7.0.0 or later installed on your iPhone from the App Store

Mavis Pro Pack (in-app purchase for $14.99)*

A connection to the [internet](https://blog.frame.io/2021/03/15/connecting-your-set-to-the-internet/) (WiFi or cellular)A Frame.io project

*Specific to V3 accounts:**Ensure C2C Connections are enabled in your project settings**Ensure you have C2C Device management permissions within the account the project is hosted in*
* You do not need the **Mavis C2C Pack** to use Frame.io Camera to Cloud, only the **Pro Pack** ($14.99 one-time purchase) is required 

# SetupLaunch the Mavis Camera app and enter the cloud menu by pushing the cloud icon in the upper right (in landscape mode) or lower left (portrait mode).

Select **Adobe Frame.io** (Pair) from the list.In the Frame.io menu, you can either log in to your Frame.io Account and select your Project by hitting **Pair** or use the six-digit pairing code to connect your MAVIS Camera app to a Frame.io Project.If you choose to use the six-digit pairing code, open Frame.io in your web browser or the Frame.io iOS app and navigate to or create the Project you would like to upload to. Follow the pairing instructions in our [Getting Started Guide](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_9ccc272c8a) to connect your device to that Project.Once you have your MAVIS Camera app connected to a Frame.io Project, open the cloud menu again by pushing the same cloud icon. Then select **Edit**.In this menu, you can configure how the Frame.io connection behaves. We recommend setting **Upload Type** to **Progressive Upload** so clips can upload while you&#x27;re shooting.
# Atomos Ninja PhoneYou can also use your Mavis Camera app to record video from Atomos Ninja Phone hardware. To learn more, please see our [Atomos CONNECT Quickstart Guide](https://help.frame.io/en/articles/6424924-c2c-atomos-connect-quickstart-guide). 

# Troubleshooting**Why does the timecode of my files start at 00:00:00:00?**Make sure you enable timecode in the Mavis Camera app main settings, under **Timecode**.
​ 

## Why are my clips taking a long time to upload?The Frame.io connection defaults to uploading after you stop recording (**End of File Upload**). You can change this behavior by tapping the cloud icon in the upper right (in landscape mode) or the lower left (in portrait mode) to open the cloud menu. Select the **Edit** option (only visible after the app has been paired to a Frame.io Project). Under **Upload Type**, select **Progressive Upload**. This will upload your clips as you&#x27;re shooting them, making them available to use and view shortly after cut. 

**Why does my framerate look wrong in Premiere Pro?**The iPhone records video in *variable framerate* instead of *constant framerate*, like a traditional camera would. Premiere Pro will display the variable framerate value instead of the embedded constant equivalent. However, Premiere Pro, video players, and other NLEs will treat your clip as the constant framerate equivalent (this will be the framerate you selected in the app: 24, 23.98, 29.97, etc). 

**Can I re-upload or manually upload clips to Frame.io?**Yes! You can access you clips by tapping the folder icon. Any clips that have been uploaded to Frame.io will have a cloud icon to the right of their name. To manually upload any clips that have not yet been uploaded, swipe right on the clip and tap the cloud upload button.

 

You can upload multiple clips at once by tapping **Select** in the upper left, tapping the check box next to the clips you want to upload, then tapping the cloud upload button in the bottom left. When prompted, tap **Continue**. 

To reupload a clip, you need to first reset its upload status. To reset the upload status, swipe right on the clip and tap the red cloud button. Once the status is cleared, you can use any of the methods described above to manually upload the clip.

Related ArticlesC2C: ZoeLog QuickStart GuideC2C: Teradek Serv and Prism QuickStart GuideC2C: Atomos CONNECT QuickStart GuideC2C: Fujifilm QuickStart GuideC2C: Leica QuickStart Guide

---
*This article was automatically converted from the Frame.io Help Center.*
