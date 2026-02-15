# C2C: Canon QuickStart Guide

> Source: https://help.frame.io/en/articles/10070093-c2c-canon-quickstart-guide
> Category: c2c

---

Canon cameras can automatically upload proxy video directly into your Frame.io C2C Project.

 

C2C is currently enabled on the following Canon cameras:

[C400](https://www.usa.canon.com/shop/p/eos-c400?srsltid=AfmBOorwNLsJeoZHvJyJWmM4SDKNd-_8jAuYk68NZafCPckvn7lJRI_7) ([firmware version 1.0.2.1 or later](https://www.usa.canon.com/support/p/eos-c400))[C80](https://www.usa.canon.com/shop/p/eos-c80?srsltid=AfmBOop8YEePsombSTtsWzVVQY7tN5gTuWJLAAGd0Eg_KNioMUFc0_Vk) ([firmware version 1.0.1.1 or later](https://www.usa.canon.com/support/p/eos-c80))[C50](https://www.usa.canon.com/shop/p/eos-c50)
Use this guide to quickly setup your Canon camera for C2C with settings recommended by Frame.io.

 

**What you&#x27;ll need**Supported Canon camera body (see above)

Properly formatted SD card

Internet access (local network, hot spot, or smartphone tether)

Access to Frame.io or the Frame.io iOS app

A Frame.io Project

*Specific to Frame.io Legacy accounts:*Ensure C2C Connections are enabled in your project settings

Ensure you have C2C Device management permissions within the account the project is hosted in

 

**Setup**Power the camera on and open the main menu.

Before we connect to a network, we&#x27;ll need to set up the camera to record proxies. Navigate to the **Record/Media Setup** menu in the main menu and scroll over to page 4.Set **2nd Card Rec. Functions** to **CFX Main/SD Proxy Rec**. Next, select the codec you want to use under **Rec Format**.Navigate to the **Network Setting** menu from the main menu and open the **New Connection Setting Wizard**.Scroll down in the list and select **Frame.io**, then select **New Comm Setting**. Choose either **WiFi** or **Ethernet**, depending on your connection. If you&#x27;re using WiFi, find your network in the list and enter the password.Select **Automatic** for your **IP Address Setting (IPv4)** and **Disable** for your **TCP/IP (IPv6)** setting.Select **Create New Func. Setting** to save the network connection to the camera. Then select Create New Pairing to start the Frame.io pairing process. Select **OK** to generate the six-digit pairing code.In Frame.io on the web or in the iOS app, navigate to or create the Project you would like to upload to. Follow the pairing instructions in our [Getting Started Guide](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_9ccc272c8a) to connect your device to that Project.Once connected to a network and paired to a Project, select the file types you would like to upload. These can be configured later as well.

Finally, select an available **Conn. Setting Save Dest.** to save this connection to the camera.Navigate to the **Frame.io** menu in the Network Settings menu to configure addition settings for your Frame.io connection. We&#x27;ll go through some recommended settings below.Set **Pause Uploading** to `Disable`. If you need to pause uploads, you can enable this setting later. Enabling this setting will allow the camera to build an upload queue of assets to upload once it is disabled.Set **Auto Upload On Recording** to `On`. This will allow the camera to upload automatically. If this setting is `Off`, assets can be manually uploaded later.To connect your device to a different Frame.io Project, use the **Revoke Pairing** option. Then select **Execute Pairing** to generate a new six-digit code and, using the instructions in our [Getting Started Guide](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_9ccc272c8a), enter this code into the new Project.
 

**Troubleshooting****My camera won&#x27;t connect or upload to Frame.io**First, make sure your local network has internet access and that your camera can connect to it. If you can&#x27;t connect over WiFi, try connecting over Ethernet.

 

See our [Internet Connection Guide](https://help.frame.io/en/articles/8571967-c2c-complete-internet-connection-guide) for more information. 

Finally, make sure your camera&#x27;s time, date, and timezone is correct. You can set this in the **Wrench** menu of the main menu. 

## I see &quot;Invalid Root Certificate&quot; when trying to connect to Frame.ioMake sure your camera&#x27;s time, date, and timezone are correct. You can set this in the **Wrench** menu of the main menu. 

Make sure to note the Date Format (ie, 12 hour or 24 hour time) to ensure your time is correct. You can change the Date Format by going to the **Wrench** menu of the main menu and selecting `[Date Format]`. 

## My files are taking a long time to uploadIf you have limited bandwidth, try using a smaller proxy size. You can set this on page 4 of the **Record/Media Setup** menu. If you currently have XF-AVC, try setting this to XF-AVC S and setting the **Resolution** or **Bitrate** lower. 

You can also set **Auto Upload On Recording** in the **Network Settings &gt; Frame.io** menu to `Off`. This will allow you to manually upload only the clips you want to use. 

## My files aren&#x27;t uploading to Frame.ioFirst, make sure the camera is set to record proxies. The cameras do not upload main or RAW formats at this time. To enable proxies, follow steps 2 to 3 above.

 

Additionally, make sure **Auto Upload On recording** is set to `ON` and **Pause Uploading** is set to `Disable` in the **Network Settings &gt; Frame.io** menu. This will make sure your files upload automatically. 

Finally, make sure you have your desired filetypes (ie, XF-AVC, XF-AVC S) selected under in the **Auto Upload File Types** option of the **Network Settings &gt; Frame.io** menu. 

## I can&#x27;t use an Ethernet adapter while on battery on my C50Due to power supply restrictions, the Canon C50 cannot use an Ethernet adapter while on battery power. Please connect the camera to AC power to use the Ethernet adapter.

Related ArticlesC2C: Teradek Cube QuickStart GuideC2C: Fujifilm QuickStart GuideC2C: Panasonic Lumix QuickStart GuideC2C: Nikon QuickStart GuideC2C: Leica QuickStart Guide

---
*This article was automatically converted from the Frame.io Help Center.*
