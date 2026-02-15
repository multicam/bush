# C2C: Teradek Serv and Prism QuickStart Guide

> Source: https://help.frame.io/en/articles/6128763-c2c-teradek-serv-and-prism-quickstart-guide
> Category: c2c

---

Use this guide to get started with the Teradek Serv 4K, Prism Mobile, and Prism Flex.

 

The Teradek encoders are SDI, H.264/HEVC video encoder. They can encode a video signal from your camera as a 1080p or 2160p proxy and automatically upload clips into your Frame.io C2C Project. They also supports 10bit Rec.2020 HDR recording.
​
Use this guide to quickly setup your Teradek Serv 4K for C2C with settings recommended by Frame.io. 

# What you&#x27;ll need1 Teradek Serv or Prism device per camera

The latest firmware from Teradek installed on the Serv 4K

[C2C compatible camera system](https://help.frame.io/en/articles/4886030-c2c-camera-to-cloud-camera-compatibility-guide) with SDI record triggers enabledSD card (class 6 or higher) formatted as ExFAT

SDI cable

A local network with [internet access](https://blog.frame.io/2021/03/15/connecting-your-set-to-the-internet/)Access to Frame.io or the Frame.io iOS app

Access to the Teradek Serv app for iOS or Android

A Frame.io Project

*Specific to V3 accounts:**Ensure C2C Connections are enabled in your project settings**Ensure you have C2C Device management permissions within the account the project is hosted in*
 

# SetupThis will walk you through basic recommended settings. These settings can be adjusted based on your desired workflow, but the configuration presented here is a good place to start. For this guide, we’ll configure Serv 4K for 10-bit SDR HEVC.

Power Serv 4K by connecting it to power and moving the power switch to the On (`|`) position. Connect one end of the SDI cable to an SDI out port on the camera and the other end to the SDI in port on Serv 4K.Next, we’ll need to connect Serv 4K to an internet-connected network, which we&#x27;ll need to connect the device to Frame.io. First, make sure Serv 4K is in Access Point mode. Press the Menu button (hamburger) until the WiFi Menu appears.

Then, press the Stream button (circle) until you get to the Network Mode menu. If it says **Wifi:Client**, press and hold the Stream button to switch to **Access Point**.With your mobile device, connect to Serv 4K’s WiFi network through its access point. Once connected, use the Teradek Serv app to connect to Serv 4K.

Once connected to Serv 4K in the Teradek Serv app, tap on Settings, then Network. To connect to a WiFi network, select Wireless. Use the UI to change the WiFi mode to Client and use the tools in this menu to connect to your WiFi network.

Once you’ve found the WiFi network or entered its name and password, tap Confirm. This will connect Serv 4K to the WiFi network and disconnect your mobile device from Serv 4K. Switch your mobile device to the WiFi network to continue set up.

On your mobile device’s browser or on a computer connected to the WiFi network, enter Serv 4K’s IP address to access the WebUI. Serv 4K’s IP address can be found in the WiFi menu on the front of the device.

Next, we&#x27;ll configure some settings on your Serv 4K.

 

Under the Recording Setup menu, check the following settings:

Recording

Enabled

Format

MP4

Auto-Record

On Camera Event

Camera SDI Metadata

This should be set to match your camera system

Timecode

On

Under the Video Settings menu, check the following settings:

Video Input

Auto

Codec

HEVC

Resolution

Auto

Bitrate

5000*

Framerate Selection

Auto

KFI Mode

Key Frame Interval

Key Frame Interval

1

Colorimetry

BT.709

Expand the Advanced panel and configure the following settings:

Bit Depth

10-bit**

Bitrate Control Method

Constant Bitrate

Chroma Subsampling

4:2:0

Under Audio Settings, set the Audio Input to match your audio configuration (*Embedded*, *Analog*, or *Mixed*). 

Follow the instructions below to connect your Serv 4K to Frame.io:

First, follow the prompts in the C2C Connections tab on Frame.io or in the Frame.io iOS app.

Generate Serv 4K’s pairing code in Serv 4K’s WebUI under Cloud Services &gt; Frame.io &gt; Link Device.

You&#x27;re now set up to upload to Frame.io. Double check your camera&#x27;s [record trigger settings](https://help.frame.io/en/articles/6593039-c2c-camera-compatibility-for-teradek-encoders) if you&#x27;re not seeing the Teradek record.
**This is a recommended starting point for the best balance between quality and upload performance. You may want to adjust this based on your needs.*
***10-bit may be difficult to decode in your NLE. If so, set this to 8-bit*.
​
Further configuration is available by using Serv 4K’s WebUI. You can access the WebUI by entering Serv 4K’s IP address into a browser on a computer or mobile device connected to the same local network. Quick settings (like encoding settings) are available in the Teradek Serv app.
​Related ArticlesC2C: Teradek Cube QuickStart GuideC2C: Aaton Cantar QuickStart GuideC2C: ZoeLog QuickStart GuideC2C: Filmic Pro QuickStart GuideC2C: Accsoon QuickStart Guide

---
*This article was automatically converted from the Frame.io Help Center.*
