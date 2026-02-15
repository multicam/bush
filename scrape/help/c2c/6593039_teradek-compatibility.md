# C2C: Camera Compatibility for Teradek Encoders

> Source: https://help.frame.io/en/articles/6593039-c2c-camera-compatibility-for-teradek-encoders
> Category: c2c

---

Teradek makes several encoders that support C2C workflows. Each encoder fits a different workflow. Click below to find out which one works best for you.

[Serv 4K](https://teradek.com/products/serv-4k?variant=41818556334258)[Prism Flex](https://teradek-store.myshopify.com/products/prism-flex?variant=41702458949810)[Prism Mobile](https://teradek.com/pages/prism-mobile)[Serv Micro](https://teradek.com/products/serv-micro?variant=42319723069618) (HDMI)[Cube 655](https://teradek.com/collections/cube/products/cube-655?variant=40353875001522) / [605](https://teradek.com/collections/cube/products/cube-605?variant=40353875067058)
*Note**: Cube 755 and Serv Pro do not currently support Frame.io C2C*Teradek Cube, Serv 4K, and Prism Flex support automatic recording with major cinema cameras over SDI. Camera systems from ARRI, RED, SONY, and Canon support triggers, timecode, and clipnames. Other cameras may support triggers and timecode, but not clipname. Without clipname information from the camera, the filenames of the proxies can be configured on the encoder.
​
Some cinema cameras need to have their record triggers enabled before they can trigger the encoder. Once this setting is configured, it will stay active until it is disabled.*Note**: the tables in this article describe cameras that are compatible with Teradek&#x27;s automatic recording. Teradek encoders can be triggered to record any video source or camera manually. When recording manually, you will not receive clipname. Timecode may pass through.*See the table below for Teradek Serv 4K, Prism, and Cube camera support via SDI.

**Camera****Record Trigger****Trigger on by Default****Record Trigger Setting Name****Timecode****Clipname**RED

**Yes****Yes****N/A****Yes****Yes**Panavision DXL2

**Yes****Yes****N/A****Yes****Yes**ARRI ALEXA* &amp; Amira

**Yes****Yes****N/A****Yes****Yes**Canon C80 &amp; C400

**Yes**No

Rec Command: On

**Yes****Yes**Canon C300mkIII &amp; C500mkII

**Yes**No

Rec Command: On

**Yes****Yes**Sony Venice &amp; Burano Family**

**Yes**No

HD SDI Remote I/F

**Yes****Yes**Sony F5/F55

**Yes**No

HD SDI Remote I/F

**Yes****Yes**Sony FS/FX Family (except FX3/30)

**Yes**No

HD SDI Remote I/F

**Yes****Yes**Canon Legacy C Series

**Yes**No

Rec Command: On

**Yes**No

Panasonic Varicam Family

**Yes**No

SDI REC REMOTE

**Yes**No

Panasonic EVA1

**Yes**No

SDI REC REMOTE

**Yes**No

 

* *Alexa 35 cameras are supported with Serv and Prism firmware 2.11 and higher and Cube 600 series firmware 8.2.23 and higher.*
** *On Venice, this setting is only accessible by entering the **Full Menu**. To change this setting, hold the **Menu** button on the camera for **2 seconds**.* 

Teradek Serv Micro supports automatic recording with several cameras over HDMI. Since HDMI ancillary data does not have the same standards as SDI, cameras may trigger recording and even send timecode, but may not send clipname information. Without clipname information from the camera, the filenames of the proxies can be configured on the encoder.

 

See the table below for Teradek Serv Micro camera support via HDMI.

**Camera****Manufacturer****Record Trigger****Trigger on by Default****Record Trigger Setting Name****Timecode****Clipname**A7R III

Sony

**Yes**No

Rec Control: On

**Yes***No

GH5**

Panasonic

**Yes**No

HDMI Rec Output

**Yes***No

X-H2S

Fujifilm

**Yes**No

HDMI Rec Control

**Yes**No

XC10

Canon

**Yes**No

HDMI Rec Command

**Yes***No

Pocket Cinema Camera

Blackmagic

**Yes****Yes****N/A****Yes**No

* *Please refer to your camera&#x27;s documentation to ensure timecode output is enabled.*
** *Make sure the GH5 is set to record in any format except MP4 or MP4 HEVC*Related ArticlesC2C: Camera to Cloud Camera Compatibility GuideC2C: Teradek Cube QuickStart GuideC2C: Teradek Serv and Prism QuickStart GuideC2C: Camera Compatibility for Atomos RecordersC2C: Getting Started with Camera to Cloud

---
*This article was automatically converted from the Frame.io Help Center.*
