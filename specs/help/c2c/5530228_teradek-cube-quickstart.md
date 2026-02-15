# C2C: Teradek Cube QuickStart Guide

> Source: https://help.frame.io/en/articles/5530228-c2c-teradek-cube-quickstart-guide
> Category: c2c

---

The [Teradek Cube 600](https://teradek.com/products/cube-655?variant=40353875001522#cube-ng) series is an SDI, H.264 video encoder. It can encode a video signal from your camera as a 1080p proxy and automatically upload clips into your Frame.io C2C Project. 

Use this guide to quickly setup your Teradek Cube 600 series for C2C with settings recommended by Frame.io.

 

**What you&#x27;ll need**1 Teradek Cube 600 series per camera

The [latest firmware](https://teradek.com/pages/downloads#cube-ng) from Teradek installed on the Cube[C2C compatible camera system](https://help.frame.io/en/articles/4886030-c2c-camera-to-cloud-camera-compatibility-guide) with SDI record triggers enabledSD card formatted as FAT32 or ExFAT

SDI cable

A local network with [internet access](https://blog.frame.io/2021/03/15/connecting-your-set-to-the-internet/)Access to Frame.io or the Frame.io iOS app

A Frame.io Project

*Specific to V3 accounts:**Ensure C2C Connections are enabled in your project settings**Ensure you have C2C Device management permissions within the account the project is hosted in*
 

**Setup**Power the Cube by connecting it to power and moving the power switch to the **On** (`|`) position then connect one end of the SDI cable to an SDI out port on the camera and the other end to the Cube. The Cube will display `Initializing Encoder` while it boots. Once it says `Ready`, you can continue with setup.Connect the Cube to your internet-connected network using the **Network Setup** menu. The internet is required to pair the device to Frame.io.Under the **Recording Setup** menu, check the following settings:**Recording**: *On***Trigger**: *Camera***Camera**: This should be set to match your camera system. **Note**: for ALEXA cameras, *ARRI* should be selected instead of *ARRI/Canon*.
Under the **Video Setup** menu, check the following settings:**Input**: *Auto***Res**: *Native***Native Framerate**: *Yes***Bitrate**: *3.5Mbps**
Under **Audio Setup**, set the **Audio Source** to match your audio configuration.Finally, pair your Cube to your Frame.io Project by following the prompts in the **C2C Connections** tab on Frame.io or in the Frame.io iOS app. You can generate the Cube&#x27;s pairing code under **Recording Setup **&gt; **Frame.io** &gt; **Pair**.
**This is a recommended starting point for the best balance between quality and upload performance. You may want to adjust this based on your needs.* 

Further configuration is available by using the Cube&#x27;s WebUI. You can access the WebUI by entering the Cube&#x27;s IP address into a browser on a computer or mobile device connected to the same local network.

 

**Troubleshooting****My camera isn’t triggering a record on the Cube.**When the Cube 655 is recording, you will see `⬤**REC**` in the upper-right corner of the device&#x27;s display. The WebUI will also say `Recording`. If you are not seeing these indicators, try the following troubleshooting steps:Make sure the camera system you are using supports run/stop record triggers and that they are enabled. [Click here](https://help.frame.io/en/articles/4886030-c2c-camera-to-cloud-camera-compatibility-guide) for more information on Frame.io C2C camera compatibility.Make sure there are no devices in the video pipeline that may be stripping the record triggers from the SDI stream (this can include certain transmitters, monitors, or other video processing devices).

In the Cube WebUI, make sure **Trigger** is set to **Camera** under **Recording** &gt; **Settings**.In the Cube WebUI, make sure **Camera** is set to match your camera system under **Recording** &gt; **Settings** (ie, RED, ARRI Alexa, etc).Make sure the SD card is formatted, mounted, and has enough free space to record to.

Finally, you can disable and re-enable **Recording** in the Cube WebUI by going to **Recording**, selecting **Disable**, then **Apply**, then **Enable** and **Apply**.
If these steps don’t work, please see [Teradek Support](https://support.teradek.com/hc/en-us) or your camera’s documentation for more information.
​**My Cube isn’t recording clipname or timecode from the SDI stream.**Make sure your camera system supports sending clipname and timecode over its SDI stream. [Click here](https://help.frame.io/en/articles/4886030-c2c-camera-to-cloud-camera-compatibility-guide) for more information about Frame.io C2C camera compatibility. If your camera system supports both, and you are still not seeing clipname and timecode, try the following troubleshooting steps:In the Cube WebUI, make sure **Camera** is set to match your camera system under **Recording** &gt; **Settings**.Make sure **Sync Pts.** (or **Sync Timecode to Video**) under **SDI Ancillary Data** in the **Video/Audio Input** pane is set to **Enabled**.Make sure there are no devices in the video pipeline that may be stripping the record triggers from the SDI stream (this can include certain transmitters, monitors, or other video processing devices).

If these steps don’t work, please see [Teradek Support](https://support.teradek.com/hc/en-us) or your camera’s documentation for more information.
​**I’m not getting audio on my proxies.**If you are attempting to send audio over the SDI from the camera, make sure **Embedded** is selected under **Audio Input **in the **Video/Audio Input** pane in the WebUI. If you are attempting to send audio to the 3.5mm port on the device, make sure **Analog** is selected. If you are still seeing an issue, make sure the settings for your audio mode match your audio signal. Refer to [Teradek Support](https://support.teradek.com/hc/en-us) for more information.
​**I’m seeing a large delay between the start of my original camera files and the start of my proxies.**To reduce the start delay, you can change the **Key Frame Interval** setting under **Encoding**. We recommend setting this between **0.5** and **2.0**.
​**The timecode on my proxies doesn’t match the timecode of my original camera files.**Make sure **Sync Pts.** (or **Sync Timecode to Video**) under **SDI Ancillary Data** in the **Video/Audio Input **pane is set to **Enabled**.Make sure the camera system you are using supports passing timecode through the SDI and that they are enabled. [Click here](https://help.frame.io/en/articles/4886030-c2c-camera-to-cloud-camera-compatibility-guide) for more information on Frame.io C2C camera compatibility.If the timecode clock of the camera was changed (such as after a jamsync), you may need to reconnect the SDI to the Cube or reboot it.

Related ArticlesC2C: Teradek Serv and Prism QuickStart GuideC2C: Fujifilm QuickStart GuideC2C: Panasonic Lumix QuickStart GuideC2C: Nikon QuickStart GuideC2C: Leica QuickStart Guide

---
*This article was automatically converted from the Frame.io Help Center.*
