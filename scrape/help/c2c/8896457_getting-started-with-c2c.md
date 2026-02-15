# C2C: Getting Started with Camera to Cloud

> Source: https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud
> Category: c2c

---

Want to explore Camera to Cloud but aren&#x27;t sure where to start? Not sure how it fits into your workflow? Not sure what devices you need or what the requirements are? In this guide, we&#x27;ll cover exactly what it is, how it works, and how you can use it today.

 

# Additional Resources[Camera to Cloud FAQ](https://help.frame.io/en/articles/4887091-c2c-frame-io-camera-to-cloud-faqs)[Camera to Cloud General Troubleshooting](https://help.frame.io/en/articles/4886926-c2c-troubleshooting)
 

# What is Camera to CloudCamera to Cloud (C2C) is an ecosystem of third-party integrations that allow you to upload media into Frame.io immediately after capture or even during capture. These integrations can be cameras, proxy recorders, or other tools. You can use all of these different integrations to build a cloud-based workflow that works for you.

*Note**: C2C is an open ecosystem! If you are a manufacturer or developer and want to build a C2C integration into your tool, we invite you to explore our [developer page](https://developer.frame.io/)!* ## How it worksC2C is very simple. Each integrated tool — a device or an app — is called a C2C Connection. C2C Connections are paired to Projects in Frame.io. Once paired, C2C Connections upload the assets they create into that Project. Frame.io places the assets in a `Cloud_Devices` folder and sorts them exactly where they need to go automatically. 

Once the assets are on Frame.io, *they&#x27;re on Frame.io*! They&#x27;re available and behave just like any other video file, photo, or audio file in your Project. 

## What&#x27;s possible with C2C?C2C gives you a lot of freedom to create workflows that best suit the work you need to deliver. Your workflow is determined by the types of assets you need to receive from the shoot. Use this as your guide to choose the C2C Connections that work best for your project.

 

Some C2C Connections are cameras, and they can upload their original files (photos or videos) straight to the cloud. Other C2C Connections are devices that can create proxy files you can use for reviewing, for sharing, and even to start editing with. Others upload additional asset types like audio files and camera reports.

 

The magic happens when those assets become available to you — the creator. C2C can get you the assets you need, and now it&#x27;s up to you to start creating. Additionally, Frame.io has a [deep library of integrations](https://frame.io/integrations) you can use to access those assets.*Are you interested in exploring Camera to Cloud to send images to Lightroom? Check out our guide on the Frame.io connection to Lightroom [here](https://help.frame.io/en/articles/9739851-connect-frame-io-to-adobe-lightroom)!*# Setting UpSetting up your C2C Connection to upload to Frame.io is incredibly simple! For every C2C Connection, you need to do two things to get it set up: connect it to the internet and pair it to a Frame.io Project.

 

## ConnectingThe first thing you need to do is connect your C2C Connection to the internet. Your C2C Connection needs the internet to talk to Frame.io and get authorized to upload into a Project.

 

Each C2C device may have several different ways to connect to a network or the internet. Make sure you explore the available options on your device. For more information on connectivity, check out [this section](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_18ff5e79e6) below. 

## PairingOnce your C2C Connection is online, you&#x27;ll need to pair it to a Frame.io Project. The pairing process authorizes the C2C Connection to upload assets to Frame.io and is done in one of two ways: entering a six-digit code to the C2C Connections page on Frame.io or in the iOS app, or by logging in with your Frame.io username and password from the C2C Connection itself. Refer to your C2C Connections&#x27;s manual or [QuickStart Guide](https://help.frame.io/en/collections/8960336-quickstart-guides) to find out what method your device or tool uses. 

If you&#x27;re using Frame.io V3, make sure your project is set up to have **C2C Connections** enabled in **Project Settings** before adding any C2C Connections. 

### Six-Digit CodeIf your C2C Connection pairs to Frame.io with a six-digit code, you can add your device or tool to your Project by navigating to your C2C Connections tab on the web or iOS app.

 

Navigate to the Project you want to connect your device to, then select **C2C Connections** at the bottom of the navigation panel on the left of the screen. Once in the C2C Connections page, click **+ New C2C Connection**. 

On your C2C device, generate the six-digit code using the device&#x27;s Frame.io menu. Refer to your device&#x27;s manual or its [QuickStart Guide](https://help.frame.io/en/collections/8960336-quickstart-guides) to find this menu. 

On Frame.io, click **Device ready to connect** and enter the six-digit code. Verify that the device trying to connect to your Project is the correct device, then hit **Authorize**. 

Frame.io will now authorize the device to your Project. Choose if you would like to set up an expiration date or not and click **Finish**. 

### LoginSome C2C Connections, such as apps like Filmic Pro, require you to log in with your Frame.io username and password. Follow the prompts from the C2C Connection to log in to Frame.io and authorize the device or tool.

 

Once your C2C Connection is authorized, locate the Project you want to pair it to and select it.

*Note**: If you want to rename, pause, or remove a C2C Connection, click on the context menu on the C2C Connection&#x27;s card in the C2C Connections tab.*Your device is now paired to your Frame.io Project and is ready to start uploading assets!

 

## Finding assetsOnce assets begin to upload from your C2C Connections, you&#x27;ll want to be able to find them. Assets from C2C Connections always to the same place:

 

**Project &gt; Cloud_Devices &gt; Date &gt; Asset_Type &gt; Device_Name &gt; Assets** 

This structure ensures that assets always show up in your Project in a consistent place and eliminates confusion by keeping things organized. Frame.io creates these folders automatically and keeps your assets organized automatically.

 

All you have to do is [pair](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_9ccc272c8a) your C2C Connection to your Project, start creating assets, and Frame.io does the rest. 

# C2C ConnectionsThe Frame.io C2C ecosystem is made up of dozens of C2C Connections. Each C2C Connection is a device or tool built by a third party partner that creates an asset that uploads to Frame.io. These are cameras, encoders, audio recorders, apps, and more.

 

There are many C2C Connections to discover! We&#x27;ve listed all available C2C Connections below by type: [Native Camera Integrations](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_538104dd64), [External Video Encoders](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_f9a9c7b4aa), [Audio Devices](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_77cbe996b6), and [Connected Apps](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_77cbe996b6). 

## Native Camera IntegrationsThese cameras have Frame.io C2C built directly inside the camera. The camera can connect to the internet and upload its assets straight to Frame.io

 

## RED DIGITAL CINEMASupported RED cameras can upload R3D files as well as ProRes files.

V-RAPTOR family

KOMODO family

[Click here](https://help.frame.io/en/articles/6766294-c2c-red-v-raptor-and-komodo-quickstart-guide) for the RED DIGITAL CINEMA QuickStart Guide.

## FujifilmSupported Fujifilm cameras can upload both stills and video in all formats the camera can create.

X-H2 and X-H2S

GFX100 II

GFX100S II

X100VI

X-T5

X-T50

X-S20

X-M5

GFX100RF

X-E5

X-T30 III

[Click here](https://help.frame.io/en/articles/7156603-c2c-fujifilm-quickstart-guide) for the Fujifilm QuickStart Guide

## Panasonic LUMIXSupported Panasonic LUMIX cameras can upload both stills and video to Frame.io.

LUMIX S5II

LUMIX S5IIX

LUMIX GH7

LUMIX S1RII

LUMIX S1II

LUMIX S1IIE

[Click here](https://help.frame.io/en/articles/9179663-c2c-panasonic-lumix-quickstart-guide) for the Panasonic LUMIX QuickStart Guide

## CanonSupported Canon EOS cinema cameras can upload proxy video to Frame.io

EOS C80

EOS C400

EOS C50

## NikonSupported Nikon cameras can upload video and stills to Frame.io through the NX MobileAir app for iOS and Android.

Z6III

Z8

Z9

ZR

## LeicaSupported Leica cameras can upload both stills and video to Frame.io.

SL3

SL3-S

 

## External Video EncodersWhat do you do if your camera doesn&#x27;t support Frame.io C2C natively? In these situations, you can use an External Video Encoder to get files to Frame.io.

These devices don&#x27;t upload footage from the camera. Instead, they create either proxies or entirely new media files by recording a video signal from the camera or video source. External Video Encoders can help bridge the gap for cameras that do not have internet connections. 

For more information on camera compatibility for external devices, see our section on [Compatibility](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_b46dd3f038) below. 

For more information on working with [proxies](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_7d7230f781), see our section on proxies below. 

## TeradekTeradek encoders record video as H.264 or H.265 MP4 proxy files to upload to Frame.io. Proxy files made by Teradek devices can match the camera files for use in post production. See [this page](https://support.frame.io/en/articles/6593039-c2c-camera-compatibility-for-teradek-encoders) for more information on Teradek camera compatibility.Serv 4K

Serv Micro (HDMI only)

Prism Flex

Prism Mobile

[Click here](https://help.frame.io/en/articles/6128763-c2c-teradek-serv-and-prism-quickstart-guide) for the Teradek Serv and Prism QuickStart Guide

Legacy:

Cube 655

Cube 605

[Click here](https://help.frame.io/en/articles/5530228-c2c-teradek-cube-quickstart-guide) for the Teradek Cube QuickStart Guide

## AtomosAtomos devices are both monitors and recorders. They record high-resolution ProRes, ProRes RAW, and DNxHD or DNxHR files to be used as your main media as well as an H.265 MOV proxy file.

The Ultra series can be set to single-record mode to record only an H.265 proxy file at up to UHD resolution and can create automated proxy files that match the camera files. See [this page](https://help.frame.io/en/articles/6593893-c2c-camera-compatibility-for-atomos-recorders) for more information on Atomos Ultra camera compatibility. The Zato records only H.264 MOV files.Ninja V / V+ (requires Atomos Connect module)

Ninja 2023 (requires Atomos Connect module)

Ninja Ultra (requires Atomos Connect module)

Ninja TX

Ninja Phone

Shogun Connect

Shogun 2023

Shogun Ultra

Zato Connect

[Click here](https://help.frame.io/en/articles/6424924-c2c-atomos-connect-quickstart-guide) for the Atomos QuickStart Guide

## AccsoonAccsoon devices are small and lightweight H.264 encoders that turn your iPhone or iPad into a monitor and a recorder with the Accsoon SEE app. The app connects to Frame.io and uploads recorded videos into your Project.

SeeMo

SeeMo 4K

SeeMo Pro

CineView Master 4K

[Click here](https://help.frame.io/en/articles/8279122-c2c-accsoon-quickstart-guide) for the Accsoon QuickStart Guide

 

## Audio DevicesFrame.io C2C supports assets from all sorts of devices — including audio recorders! These are native integrations into your recorder or mixer that allow you to upload audio files directly from your device to a Frame.io Project.

 

## Sound DevicesSupported Sound Devices recorders and mixers can upload WAV files or AAC files to Frame.io.

Sound Devices 888

Sound Devices Scorpio

[Click here](https://help.frame.io/en/articles/6029980-c2c-sound-devices-8-series-quickstart-guide) for the Sound Devices QuickStart Guide 

## C2C Connected AppsSome C2C Connections are apps. These apps offer several different solutions to to C2C users such as mobile phone cameras, camera reports, and color grading metadata.

 

These differ from traditional Frame.io integrations because they upload into the C2C folder structure and appear as a C2C Connection in your C2C Connections tab.

 

Click on each C2C Connection to access its QuickStart Guide.

[Mavis Camera](https://mavis.cloud/camera/)[Filmic Pro](https://help.frame.io/en/articles/6128936-c2c-filmic-pro-quickstart-guide)[Viviana Cloud Box](https://help.frame.io/en/articles/6133587-c2c-viviana-cloud-box-quickstart-guide)[Pomfort LiveGrade](https://help.frame.io/en/articles/6136709-c2c-pomfort-livegrade-quickstart-guide)[ZoeLog](https://help.frame.io/en/articles/6037494-c2c-zoelog-quickstart-guide)[Magic ViewFinder](https://help.frame.io/en/articles/6037561-c2c-magic-viewfinder-quickstart-guide)
# CompatibilityFrame.io C2C can work with several different supported cameras. What does a supported camera mean? Some cameras have Frame.io C2C enabled internally. This means they can support Frame.io C2C directly. See our [section above](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_538104dd64) for a list of C2C enabled cameras. 

Cameras that do not have Frame.io C2C built in can use an external recorder. External recorders create proxy files recorded from a video signal that they can upload to Frame.io. See our [section above](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_f9a9c7b4aa) for a list of C2C enabled external recorders. 

Whether or not a camera is compatible with an external recorder for Frame.io C2C depends on the desired workflow. For instance, a relinkable proxy workflow requires a camera to be able to send clipname, timecode, and a record trigger to the external recorder.

 

These three things ensure that the proxies the recorder is making will have the same name, timecode, and start and stop as the camera original file. This is necessary to allow the uploaded proxy file to be relinked in post production. We call this &quot;automatic recording&quot;.

 

Several C2C enabled recorders support automatic recording. See below for camera compatibility information on C2C enabled recorders with automated recording.

[Camera Compatibility for Teradek Encoders](https://help.frame.io/en/articles/6593039-c2c-camera-compatibility-for-teradek-encoders)[Camera Compatibility for Atomos Recorders](https://help.frame.io/en/articles/6593893-c2c-camera-compatibility-for-atomos-recorders)
However, not all workflows need the uploaded files to match back to the camera original files in clipname or start and stop. All C2C enabled external recorders can still record any video signal they can receive.

 

# ConnectivityFrame.io Camera to Cloud requires an internet connection to pair a C2C Connection to a Project on Frame.io as well as upload assets. However, in the event of a network outage or unstable connections, each C2C Connection can still record while offline. The C2C Connection will then upload any recorded assets to Frame.io once they get reconnected to the network or internet.

 

In most situations, you can connect your C2C device to a local WiFi network that has internet access. In many circumstances, this is just like pairing your phone or computer to a WiFi network — just search for the network name and enter the password. Some devices support tethering to mobile hotspots or a mobile phone.

 

How much bandwidth do you need to upload to Frame.io with C2C? The answer to this question depends on a few things, but most importantly it depends on how large the assets are that you&#x27;re trying to upload. In general, you can use the following to figure out how much bandwidth you would need:

 

```
number of devices * asset bitrate = total bitrate
``` 

This multiplies the bitrate of the assets by the number of C2C devices uploading to get the total bandwidth that your set up will be using. For a good experience, it&#x27;s recommended that you have a network bandwidth that is equal to or greater than the `total bitrate`. 

Many C2C devices allow you to change the size of the uploaded assets or even the type of assets they can upload. Use these tools on your C2C devices to craft a workflow that creates a good balance between the assets you need and your available bandwidth.

 

Figuring out network requirements for photography is a little trickier, since your image file size and shooting rate can vary quite a bit. For simplicity, let&#x27;s look at an example where the shooting rate is low (ie, no more than 20 images per minute). Your key number will be your upload time — what is the maximum amount of time it should take an image to upload for your workflow (in seconds)? 5 seconds? 10 seconds? This will be up to you. Once you determine that, you can use the basic formula below to find your bandwidth requirements.

 

```
number of devices * ( asset size / upload target time ) = total bitrate
```*Note*: Your asset size will most likely be in mega**bytes**, and bandwidth is usually measured in mega**bits**. You can convert your calculated bitrate or your measured asset size to megabits by multiplying it by `8`.Have more questions about networking and bandwidth? Check out our [Complete Internet Connection Guide](https://help.frame.io/en/articles/8571967-c2c-complete-internet-connection-guide) for a deep dive on network setup, bandwidth calculation, connection checklists, and network troubleshooting. 

# ProxiesSeveral C2C Connections are designed to upload proxy files instead of camera originals. When using internal camera integrations, the proxy files can upload faster than the camera original files and can help speed up your workflow. In cases where your camera can&#x27;t connect directly to Frame.io (or can&#x27;t upload small enough files), [external video recorders](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_f9a9c7b4aa) can create proxies by recording the video output from your camera and upload those. 

The term &quot;proxy&quot; can apply to many different definitions and can serve many different uses. In our documentation and in the workflows we describe here, we will consider proxies to be editorial files rather than simply lower quality versions of the originals. Similar to transcodes in a dailies process, they may not be *exactly* the same as the camera original files. To qualify as proxies, they need to have the same name and timecode as the camera original files, but they may not have the same resolution or codec.*Note**: some external devices that use automatic recording may create proxy files that have different start and end timecode values as the camera originals — this is normal! For more information, check out our [Complete Proxy Workflow Guide](https://help.frame.io/en/articles/6079079-c2c-complete-proxy-workflow-guide).*Proxy files allow you to start working and editing without the large camera original files, but you may want to eventually switch to your camera original files once you&#x27;re ready to finalize your project. Switching from proxy files to camera original files can happen in one of two ways, depending on your workflow pipeline and the tool you are using: **relinking** or **conforming**. 

## Relinking*Relinking* can be a fairly general term, but it usually means telling your editing software where to find your files after you&#x27;ve started using them. It&#x27;s called &quot;re-linking&quot; because the method is primarily used for when your media storage location gets moved or goes offline. 

However, when we&#x27;re using proxies, an editing tool&#x27;s relink function can be used to instead tell it to look at the camera original files. Doing this is usually as simple as selecting the proxies from your bin or timeline that you want to replace, then using the editor&#x27;s built-in relink tool to locate the camera original files on your storage. Because the proxies (as we defined above) have the same name and timecode, your editor will consider them to be the same clips and seamlessly switch from the proxies to the original.

 

Every editing tool&#x27;s relink function works a little differently, and may even have a different name. Make sure you are familiar with your tool&#x27;s relinking function before deploying a proxy workflow.

 

For more detailed information on proxy workflows and relinking, check out our [Complete Proxy Workflow Guide](https://help.frame.io/en/articles/6079079-c2c-complete-proxy-workflow-guide). 

## Conforming**Conforming** is very similar to relinking, but is a little different. When you relink, you are telling your editing tool to use different files for the same timeline. When you conform, you&#x27;re rebuilding your timeline using the original files from scratch. 

This is typically done by creating a file that can describe your timeline — usually an EDL or XML — and then importing that file into a finishing tool like a color-corrector. The EDL or XML file is a list of every clip in the timeline, where they are in the timeline, and what part of the clip is used. Because the proxies will have the same name and timecode as the originals, your finishing tool will be able to rebuild the timeline using the original files instead.

 

For more detailed information on proxy workflows and relinking, check out our [Complete Proxy Workflow Guide](https://help.frame.io/en/articles/6079079-c2c-complete-proxy-workflow-guide).Related ArticlesC2C: Camera to Cloud Camera Compatibility GuideC2C: TroubleshootingC2C: Frame.io Camera to Cloud FAQsC2C: Panasonic Lumix QuickStart GuideC2C: Canon QuickStart Guide

---
*This article was automatically converted from the Frame.io Help Center.*
