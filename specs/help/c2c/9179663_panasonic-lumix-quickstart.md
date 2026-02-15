# C2C: Panasonic Lumix QuickStart Guide

> Source: https://help.frame.io/en/articles/9179663-c2c-panasonic-lumix-quickstart-guide
> Category: c2c

---

Refer to this guide for Camera to Cloud setup, recommended practices, and troubleshooting specific to the Panasonic Lumix S5 II and S5 IIX camera models. For further reference, you can access the user manuals for both of these cameras on Panasonic’s website [here](https://help.na.panasonic.com/manuals?c=lumix).
​
The S5 II and S5 IIX cameras can capture stills and video with the ability to automatically upload files directly into your Frame.io C2C enabled Project.
​
C2C is currently supported for the following cameras:[LUMIX S5II](https://shop.panasonic.com/products/s5m2-full-frame-mirrorless-camera-body)[LUMIX S5IIX](https://shop.panasonic.com/products/s5m2x-full-frame-mirrorless-camera-body)[LUMIX GH7](https://shop.panasonic.com/products/gh7-mirrorless-camera-body?pr_prod_strat=e5_desc&amp;pr_rec_id=4bf946d6a&amp;pr_rec_pid=9093696880948&amp;pr_ref_pid=9093698322740&amp;pr_seq=uniform)[LUMIX S1RII](https://shop.panasonic.com/products/lumix-s1rii-full-frame-mirrorless-digital-camera-dc-s1rm2)[LUMIX S1II](https://shop.panasonic.com/products/lumix-s1ii-full-frame-camera-partially-stacked-sensor-dc-s1m2)[LUMIX S1IIE](https://shop.panasonic.com/products/lumix-s1iie-full-frame-camera-dc-s1m2e)
**What you&#x27;ll need**Supported Panasonic camera body with the [latest firmware](https://www.panasonic.com/global/consumer/lumix/s/firmware_update.html)[Supported Camera Media](https://eww.pavc.panasonic.co.jp/dscoi/DC-S5M2/html/DC-S5M2_DVQP2839_eng/0007.html)Local network with Internet access

Access to Frame.io or the [Frame.io iOS app](https://help.frame.io/en/articles/9105533-getting-started-in-the-ios-app)A Frame.io Project

*Specific to V3 accounts:**Ensure C2C Connections are enabled in your project settings**Ensure you have C2C Device management permissions within the account the project is hosted in*
 

**Setup**Power the camera on and open the main menu. Navigate to the **Setup Menu** (Wrench Icon).Navigate to page** IN/OUT 1** and enter the **Frame.io **menu.Enter **Connection Setup** and select your preferred **Connection Method **for internet connection (USB Tethering or Wi-Fi). 

**Note**: *Tether only supported by S5IIX. iPhone 15 not currently supported.* 

Once connected, navigate back to the Frame.io menu and set **Frame.io Connection** to **On**.In Frame.io on the web or in the iOS app, navigate to or create the Project you would like to upload to. Follow the pairing instructions in our [Getting Started Guide](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_9ccc272c8a) to connect your device to that Project.Once you’re authenticated to your Frame.io Project, make sure to confirm your upload preferences in the **Upload Setup **page of the camera’s Frame.io menuEnter **Upload File Format** to select which supported formats you would like uploaded to Frame.io.Change **Auto Upload to Queue** to **On** if you would like selected formats to automatically upload as captured - leave this setting to **Off** if you would like to manually select files for upload.Enter **Upload Status** for a detailed look at your current upload progress.
**Troubleshooting**### My files are taking a long time to uploadYour camera can only upload as fast as your internet connection allows.
​
If you have limited bandwidth, consider what file types your camera is set to upload in the **Upload File Format** menu. If you’re uploading RAW image files and also want images available quickly on Frame.io, it might be good to consider setting the camera to capture both RAW and JPG, but set the **Upload File Format** to only JPG.
​
You also have the option to disable automatic uploads so that you can manually select which photos you would specifically like to upload. To do this, set **Auto Upload to Queue** to **Off** and select **Send Images to Frame.io** in the **Frame.io** menu to manually select and upload images.
​
A third option to consider is what technical specs are required of the assets you’re capturing and uploading. Evaluate the image quality of the available formats to see what may be suitable for your intended use case. JPGs images and Proxy video files are great for quick social media distribution and team review and approval.
​### My files aren&#x27;t uploading to Frame.ioFirst, ensure your local network has internet connection. It is possible that a camera can be connected to a WiFi access point that doesn’t have internet connection or could have additional security settings that could restrict internet access to the camera.

 

[Click here](https://help.frame.io/en/articles/8571967-c2c-complete-internet-connection-guide) for our Complete Internet Connection Guide.
​
With internet connection confirmed, make sure that your camera is set to capture the format you would like to upload. The S5II and S5IIX currently support uploading Proxy video, JPG, and RAW files.
​
Then, navigate to the **Frame.io** menu and enter the **Upload Setup** menu. Enter **Upload File Format**, select the formats you would like to enable for upload, and press the `Display` button to save your settings.
​
​**Note**: Ensure you hit `Display` to save your format selections. If you hit the `Back` button, any modified selections will not be saved.
​
Next, enter the **Upload Status** menu and check the setting **Auto Upload to Queue**. If this is set to **ON**, selected formats will automatically upload. If this is set to **OFF**, files will not automatically upload. Captured files can always be manually uploaded afterwards by selecting the option **Send Images to Frame.io** in the Frame.io menu.
​
To view current upload status navigate to **Upload Status** inside of the **Upload Setup** page.
​### I’m shooting video and am not seeing files uploadIt’s possible the camera may be set to a **Rec Format** or **Rec Quality** that does not support Proxy recording. Proxy video is not supported for MP4 File Format or S&amp;Q recording.
Max capture frame rate currently available for upload is 59.94p, which can be selected in **Rec Quality** settings.
​### My camera takes a long time to boot up with C2C enabledEach time your camera is rebooted with C2C enabled, it will automatically look to reconnect to its last selected WiFi network to establish internet connection for upload, which can take about 20 seconds to complete from when the camera is turned on.

 

### My camera lost power and my queued files aren’t uploading after a power restoreIn situations when you are using an external power source and the power is removed before uploads complete, the upload queue may not save. If your queued assets are not uploading once power is restored, you can manually upload them from the **Frame.io** menu by selecting **Send Images to Frame.io**. 

### My files aren&#x27;t uploading after attempting a network changeCheck your queue from the **Frame.io** menu by selecting **Upload Setup** then **Upload Status**. This will tell you how many files are left in your queue as well as the upload performance. If your queue is cleared, you can re-add files to your queue from the **Frame.io** menu by selecting **Send Images to Frame.io**. 

### I&#x27;m seeing &quot;Proxy recording cannot be performed because the recording medias&quot; are different when trying to record videoMake sure you are recording in a proxy-supported framerate, resolution, and recording media. Please refer to the Proxy Recording section of your camera&#x27;s manual for more information.
​
​
​Related ArticlesC2C: Teradek Cube QuickStart GuideC2C: Fujifilm QuickStart GuideC2C: Canon QuickStart GuideC2C: Nikon QuickStart GuideC2C: Leica QuickStart Guide

---
*This article was automatically converted from the Frame.io Help Center.*
