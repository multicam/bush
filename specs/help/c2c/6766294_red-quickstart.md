# C2C: RED V-RAPTOR and KOMODO QuickStart Guide

> Source: https://help.frame.io/en/articles/6766294-c2c-red-v-raptor-and-komodo-quickstart-guide
> Category: c2c

---

RED Digital Cinema cameras can upload all files they record, including proxy files, directly into your Frame.io project.

 

C2C is currently enabled on the following RED Digital Cinema cameras:

[V-RAPTOR](https://www.red.com/v-raptor)[V-RAPTOR [X]](https://www.red.com/v-raptor)[V-RAPTOR XL](https://www.red.com/v-raptor-xl)[V-RAPTOR XL [X]](https://www.red.com/v-raptor-xl)[V-RAPTOR XE](https://www.red.com/camera/V~RAPTOR/productcategory/Camera-BRAINs?keywords=XE)[KOMODO](https://www.red.com/komodo)[KOMODO-X](https://www.red.com/komodo-x)
 

Use this guide to quickly set up your supported RED Digital Cinema camera for C2C with settings recommended by Frame.io.

 

**What you&#x27;ll need**A supported camera body (see above)

Firmware version [1.4.2 or higher](https://www.red.com/downloads) for V-RAPTOR and V-RAPTOR XL or [1.7.5 or higher](https://www.red.com/downloads/komodo) for KOMODO and KOMODO-X installedA local network with [internet access](https://blog.frame.io/2021/03/15/connecting-your-set-to-the-internet/)[RED Approved](https://www.red.com/third-party-accessories) camera mediaA RED recommended USB to ethernet adapter (optional)*

[Sabrent USB Type-C 5 Gigabit Adapter](https://www.bhphotovideo.com/c/product/1627768-REG/sabrent_nt_ss5g_usb_a_or_c_to_5_gigabit.html)
Access to Frame.io or the Frame.io iOS app

A Frame.io Project

*Specific to V3 accounts:**Ensure C2C Connections are enabled in your project settings**Ensure you have C2C Device management permissions within the account the project is hosted in*
 

**If you are uploading REDCODE RAW (R3D), it is recommended you use an ethernet connection, which can transfer data up to 2Gbps. KOMODO cameras require a [Link Adapter](https://www.red.com/red-komodo-link-adaptor) in order to use an ethernet adapter.* 

**Setup**Power the camera and let it boot. Make sure the camera card is loaded and properly formatted by the camera.

Connect the camera to your internet-connected network (WiFi or ethernet). Follow the guides for [V-RAPTOR](https://docs.red.com/955-0199/955-0199_V1.3_Rev-B_RED_PS_V-RAPTOR_8K_VV_Operation_Guide/Content/5_How_To/1_Intro_How_To.htm), [V-RAPTOR XL](https://docs.red.com/955-0203/955-0203_V1.3+Rev-B+RED+PS,+V-RAPTOR+XL+8K+VV+Operation+Guide+HTML/Content/5_How_To/1_Intro_How_To.htm), [KOMODO](https://docs.red.com/955-0196_v1.6/Content/5_How_To/1_Intro_How_To_WIFI.htm), and [KOMODO-X](https://docs.red.com/955-0196_v1.6/Content/5_How_To/1_Intro_How_To_WIFI.htm) to connect to a network. REDCODE RAW (R3D) files can be large. If you&#x27;re uploading R3Ds, it is recommended you use an ethernet connection. [Click here](#h_a18f3c0e88) for more information.On the camera, navigate to **Communication** from the Main Menu and open the **Cloud Upload** menu. 

Press the `SEL` button to toggle **Enable** to *ON* and make sure *Frame.io* is selected as the **Service**. 

Open the **Upload File Types** menu to toggle the files that will upload to Frame.io. If you have a slower network, you might want to exclude R3D and upload ProRes only. 

**NOTE**: *KOMODO cameras do not have a proxy mode and can only upload R3Ds **or** ProRes, depending on the recording format.* 

With Frame.io set as the **Service** and the **Upload File Types** configured, open the **Frame.io** menu. 

Next to **Connect**, select *OK*. If the camera is connected to the internet, this will generate a six-digit code. In Frame.io on the web or in the iOS app, navigate to or create the Project you would like to upload to. Follow the pairing instructions in our [Getting Started Guide](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_9ccc272c8a) to connect your device to that Project. 

Once paired, press the `MENU` button to return to the **Cloud Upload** menu. 

**NOTE**: *once paired, the camera will begin uploading any media on the current card that matches the settings configured under **Upload File Types**. It is recommended that you start with an empty (formatted) camera card.* 

The camera will begin uploading as soon as you cut the camera. You can monitor transfers from the **Cloud Upload** menu.
 

**Troubleshooting****My files are uploading slowly**Files created by the RED cameras can be large. Make sure you have a network with enough bandwidth to move the files. If you are using a slower network, you can use the **Upload File Types** menu to upload ProRes only. 

Here are the bandwidth speeds you would need to achieve *real-time uploads* with select REDCODE resolutions and codecs.Resolution

HQ

MQ

LQ

ELQ

8K 24fps

3.57Gbps (446MBps)

2.5Gbps (312MBps)

1.56Gbps (195MBps)

832Mbps (104MBps)

6K 24fps

2.01Gbps (251MBps)

1.41Gbps (176MBps)

880Mbps (110MBps)

544Mbps (68MBps)

If you are uploading REDCODE RAW, it is recommended you use an ethernet connection, which can transfer data up to 2Gbps.

 

**I&#x27;m not seeing some of my file types (R3D, MOV, CDL, LUT, WAV) on Frame.io**Make sure all the files necessary for your workflow are enabled under **Communication &gt; Cloud Upload &gt; Upload File Types**. If you&#x27;re trying to upload ProRes, make sure the camera is set to upload ProRes or has ProRes Proxy Record enabled (on V-Raptor and V-Raptor XL) in the Format menu. 

**My camera isn&#x27;t uploading**First, make sure your camera is still connected to the network and that the network is connected to the internet. If you&#x27;re using an ethernet connection, make sure the ethernet cable and the USB cable are securely connected.

 

Additionally, your camera will not upload while it is recording. The upload queue will pause while the camera is rolling, then resume once the take cuts.

 

**I can&#x27;t access the Cloud Upload Menu**Make sure you have a formatted camera card loaded in the camera. The camera needs media to be present in order to change settings under **Cloud Upload**. 

**The Connect button in the Frame.io Menu is greyed out**Make sure your camera is connected to the web and that your system date and time on the camera are correct. The camera must be able to reach the Frame.io servers in order to connect to a Project.

 

**I can&#x27;t play my R3D files on Frame.io**Frame.io does not currently support R3D playback.

 

Related ArticlesC2C: ZoeLog QuickStart GuideC2C: Atomos CONNECT QuickStart GuideC2C: Fujifilm QuickStart GuideC2C: Getting Started with Camera to CloudC2C: Canon QuickStart Guide

---
*This article was automatically converted from the Frame.io Help Center.*
