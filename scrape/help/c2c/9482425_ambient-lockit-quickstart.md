# C2C: Ambient Lockit Real Time Logging QuickStart Guide

> Source: https://help.frame.io/en/articles/9482425-c2c-ambient-lockit-real-time-logging-quickstart-guide
> Category: c2c

---

[Ambient](https://ambient.de/en/) has long been an industry leader in the space of production timecode (TC) systems. They’ve created a collection of devices that operate within a wireless ecosystem called the “Ambient Communication Network” (ACN), which allows supported timecode enabled devices to communicate and stay in timecode sync. 

Ambient&#x27;s Lockit devices provide timecode to cameras and audio devices, but they can also record timecode-stamped markers for use in post-production. With Frame.io C2C, Ambient Lockit devices can upload those markers to Frame.io. As a Frame.io [Real Time Logging](#h_4e9d41fbbf) device, markers uploaded from supported Lockit devices can be automatically applied to C2C video assets with matching timecode as comments in Frame.io.
​
C2C is currently supported on the following WiFi-enabled Lockit devices (ie, [Host Devices](#h_51305d3818)):[ACN-LP “Lockit+”](https://ambient.de/en/timecode-metadata/timecode-generators/1175/acn-lp-lockit-metadata-interface)
Ambient devices that can send markers to C2C enabled Lockit devices (ie, [Sub Devices](#h_51305d3818)):[ACN-CL “Lockit”](https://ambient.de/en/timecode-metadata/timecode-generators/754/acn-cl-lockit-timecode-and-sync-generator)[ACN-LS2 “Lockit Slate Take 2”](https://ambient.de/en/brands/ambient/669/acn-ls2-lockitslate-take-2-timecode-slat)[ACN-NL-L “NanoLockit”](https://ambient.de/en/timecode-metadata/timecode-generators/759/acn-nl-l-nanolockit-timecode-logging)[NanoLockit Logger App for iOS](https://faq.ambient.de/hc/en-001/articles/25553023110418-How-to-make-logs-from-the-NanoLogger-App-appear-in-Frame-io-C2C) (does not require Lockit+)
 

**Host and Sub Devices**The Ambient C2C integration introduces the concept of Host Devices and Sub Devices into C2C Connections. **Host Devices** have the ability to connect to Frame.io as a C2C Connection, just as you&#x27;d expect. Host Devices pair directly to a Project and upload assets or metadata to Frame.io. 

**Sub Devices**, on the other hand, connect to Host Devices instead of Frame.io. Sub Devices typically don&#x27;t have their own internet connection and send their assets (or metadata) to Host Devices., but do not directly upload to Frame.io. The Host Devices upload the Sub Devices&#x27; assets or metadata to [Frame.io](http://frame.io/) as discrete channels. 

## Lockit+In the Ambient ecosystem, the Lockit+ serves as the main hub for connectivity with your other Ambient devices used on set — it is a **Host Device**, meaning it can connect directly to [Frame.io](http://frame.io/) once connected to the internet. Across set, it serves as the main source of accurate wireless timecode distribution through ACN. 

## Lockit, NanoLockit, Lockit Slate Take 2The Lockit, NanoLockit, and Lockit Slate Take 2 are all timecode accurate production devices that can be configured to live downstream from a Host Device — the Lockit+. These Sub Devices will receive continuous jam sync wirelessly from the Lockit+. These devices do not support C2C Connection on their own, but instead send their metadata to the Lockit+ Host Device, allowing productions to gather live feedback from strategic stakeholders across set.

 

## NanoLockit Logger for iOSThe NanoLockit Logger for iOS functions just like a NanoLockit, except on your iPhone. The iOS app, however, does not require a Host Device to connect to Frame.io since it can use your iPhone&#x27;s internet connection. The NanoLockit Logger app can sync to ACN or sync to timecode manually by entering a timecode value or capturing it from a running timecode display with your iPhone&#x27;s camera.

 

# Real Time Logging with Frame.ioReal Time Logging (RTL) is a feature of Frame.io C2C that can automatically apply markers from supported devices as comments on C2C video assets that have matching timecode.

 

Frame.io allows you to assign custom comment values to the physical buttons on the Lockit+ as well as any of its Sub Devices. When a user presses one of these buttons, the Ambient devices record a marker that&#x27;s stamped with that timecode. That marker is then sent to Frame.io and when the corresponding video arrives via C2C, that marker is applied at the correct timecode as a comment.

 

For example, let&#x27;s say you&#x27;re filming an interview. The camera is connected to Frame.io C2C and is timecode synced to the Ambient system. The director can pre-assign buttons on a handheld Sub Device (like a NanoLockit) to things like &quot;good moment&quot; or &quot;good quote&quot;. During the interview, the director can then press the corresponding button for the note they want to record. Once the camera cuts at the end of the interview, the video asset is uploaded to Frame.io via C2C and then every button push the director made is automatically applied to the take as a comment that reads &quot;good moment&quot; or &quot;good quote&quot;.

 

This, combined with a C2C video solution, gives you a take that has good (or bad!) moments all identified by timecode and as markers — moments after the camera cuts. Creatives no longer have to go back and pore over footage to try and remember the moments they liked.

 

Read this article to learn how you can leverage Ambient’s ACN to streamline post production workflows using Real Time Logging.

​**What you’ll need **Lockit+ with battery charged to at least 30% and firmware version 2.6.0 or later

Lockit+ 12V AC Power Supply

Camera that can accept External TC from the Ambient Lockit+ or connected Lockit Sub Device *(refer to Ambient documentation for information on configuring Ambient devices to send or receive timecode or use ACN)*Timecode jamming cable (check your camera’s TC input specs)

A local network with Internet access

# Recommended, but not requiredLockit Sub Devices (Lockit, Nanolockit, Lockit Slate Take 2) with latest firmware

USB-C to Ethernet adapter for LockIt+ hardwired network connection

Portable 12V power bank​

# SetupBecause the Ambient integration has Host Devices and Sub Devices, as well as being a Real Time Logging device, there are a few additional setup steps required compared to other C2C Connections.

 

## Setting up the Lockit+ with Frame.ioLockit+ can broadcast a local WiFi network, giving users browser-based access to all the Lockit+ features on mobile or desktop devices. Per default the WiFi name and password are both the serial number of your Lockit+. You can find the serial number under the battery. Once connected to the Wifi of your Lockit+ you can access the web interface by entering &quot;`10.0.0.1`&quot; or &quot;`{serialnumber}.local`&quot; (Example: `LPA00042.local`) in the address field of your browser. The default password is the same as the WiFi name. If you forget your WiFi password, you can reset the WiFi and LAN settings in the **Shutdown Menu** by long pressing the power button to pull up the **Shutdown Menu** and then holding the green and red buttons to perform the Wifi+Lan reset. In the browser, if the RTC (real-time clock) is not set you will see a warning message to set RTC. Select **set RTC** if needed. In the web interface you have access to comprehensive options and settings you can configure. To connect to a WiFi connection click the System/Device Configuration tab. This WiFi connection should have your internet connection you&#x27;ll use to connect to Frame.io.

Click on **Configure WiFi** and then **WiFi Client**. Select your desired network from the list of available networks and click **Connect WiFi Client**. Then enter the WiFi password. The Lockit+ will now be connected to this WiFi network and no longer be accessible on its own host network that you just used to configure it — this means the web interface will no longer be responsive.Connect your computer to the same WiFi network you just configured on the Lockit+ and type “`{serialnumber}.local`” (Example: `LPA00042.local`) in the address field of your browser. To connect to Frame.io, click on the Frame.io tab on the left hand side. Clickthe connect button and this will give you a 6 digit pairing code. Pair your Lockit+ to your Frame.io project by following the prompts in the C2C Connections tab on Frame.io or in the Frame.io iOS app. 

**Setting up Real Time Logging through ACN**Before you can connect Sub Devices to the Lockit+, you need to configure and enable ACN (Ambient Communication Network). The ACN utilizes an extremely reliable, proprietary 2.4 GHz network with 16 selectable channels for communication between devices to minimize lag and interference with other radio sources. All gathered information is buffered until it is successfully received and stored. ACN is required to connect other Ambient devices to the LockIt+.
​### Enabling ACNPower up the Lockit+ and start it in C-Jam (continuous jam) mode as the master by pressing and holding the Green button and then tapping the power button. The icon on the display will switch to **M**. All other Lockits (that are on the same ACN channel) will now automatically follow the C-Jam Master and display an **ACN icon **at the lower right of the display. The LockIt+ will remember that it has been set to C-Jam Master. It will automatically start in C-Jam Master mode when booted via the power button afterwards. 

### Setting frame rate and ACN channel To set the project frame rate press the green and red buttons simultaneously to select the access menu. Then press the green and red buttons simultaneously on the Project Rate: menu and toggle the appropriate frame rate. 

To set the ACN channel press the green and red buttons simultaneously to select the ACN Channel: 11-26 / off. Note: all Ambient devices will need to be set to the same ACN channel. 

All Ambient devices should have the same framerate as the cameras. This should be exact — if the camera is set to 23.98 and the Ambient devices are set to 24, RTL will not work. Now that your ACN is properly set up, we can connect Sub Devices.

 

**Connecting Sub Devices **### Lockit and Lockit SlateTo turn on the Lockit, long press the power button. All Lockit devices that are jammed via a C-Jam or TX Master automatically switch to ACN Receiver Mode, indicated by the ACN logo in the lower right of the display. Note that just one unit is allowed to be the C-Jam Master within an ACN channel. A second master will be blocked and will also automatically follow the C-Jam Master and display an ACN icon at the lower right of the display.

Make sure the Lockit is set to the same ACN channel as the Lockit+ Host Device already configured. To set the ACN channel make sure the unit is powered on by long pressing the power button. Then press the green and red buttons to pull of the access menu and go to the single press the green or red buttons to scroll to the ACN channel selection and set the ACN channel. 

Once the Lockit is set to the same ACN channel it will display a ACN icon in the lower right portion of the display. 

### NanoLockitTo configure the settings on the NanoLockit you will need to download and install the Lockit Toolbox, available here: [https://ambient.de/en/downloads](https://ambient.de/en/downloads)With the Lockit Toolbox you can configure your settings for the NanoLockit by connecting your NanoLockit to your computer over USB. Make sure to set the ACN channel to the same channel your TX master and other devices are set to.

**Frame.io Real Time Logging Configuration**Now that your Host Device is paired to Frame.io and your Sub Devices are connected to your Host Device, we can configure our Real Time Logging settings. This will allow us to assign comments to buttons as well as choose which C2C video devices we want comments to apply to.

In Frame.io, navigate to the C2C Connections tab.

Locate your Lockit+ device in your C2C Connections, click on the three dot button on its card, and select **Edit Logging Buttons**.In this window, you can choose which C2C video devices you want markers to apply to, add an offset, what comments are assigned to which button on which device, and to whom the comments will belong.

**Note**: comments do *not* have to belong to the user that connected the Lockit+. For example, the DIT can pair and configure the devices for the director, and comments will appear on Frame.io from the director. 

# Troubleshooting 

### My markers aren&#x27;t applying to my C2C videosMarkers can only be applied as comments to videos that have overlapping timecode, are recorded on the same day, and if the Ambient Lockit device is configured to apply markers to the C2C video device the video came from in the Real Time Logging [configure menu](#h_645fabef4b). 

First, make sure your camera is timecode synced to the Ambient Lockit system. Please refer to your camera&#x27;s documentation on the timecode syncing process. If you&#x27;re using an external C2C encoder, the camera is the device that needs to be synced to timecode and the C2C encoder will detect the timecode from the camera.

 

If you&#x27;re synced to timecode and markers still aren&#x27;t applying, make sure the camera&#x27;s framerate and the framerate of the Ambient devices match. This needs to be exact. For example, if the camera is set to 23.98 and the Ambient devices are set to 24, markers will not apply. They would *both* need to be 23.98 or 24. 

The next thing to check is to make sure your Ambient device and C2C video device are in the same timezone so Frame.io can identify that their assets and metadata were recorded on the same day. You can check or change the timezone of any C2C device by opening the three dot menu on the device&#x27;s card.

 

Finally, open the Real Time Logging [configure menu](#h_645fabef4b) from the three dot button on the Host Device&#x27;s card in your C2C Connections tab on Frame.io. In this menu, you can select, per Sub Device, which C2C video devices get markers applied. Make sure your C2C video device is configured to receive markers from the desired Ambient device. 

Related ArticlesC2C: Teradek Cube QuickStart GuideC2C: ZoeLog QuickStart GuideC2C: Canon QuickStart GuideC2C: Nikon QuickStart GuideC2C: Mavis Camera QuickStart Guide

---
*This article was automatically converted from the Frame.io Help Center.*
