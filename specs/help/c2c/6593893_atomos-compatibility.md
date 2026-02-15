# C2C: Camera Compatibility for Atomos Recorders

> Source: https://help.frame.io/en/articles/6593893-c2c-camera-compatibility-for-atomos-recorders
> Category: c2c

---

The Atomos NINJA with an Atomos CONNECT module, SHOGUN CONNECT, and ZATO CONNECT each support a large amount of both HDMI and SDI cameras. Please see Atomos’ support pages for full compatibility information.

[Atomos NINJA V camera support](https://www.atomos.com/compatible-cameras?product=ninja-v)[Atomos NINJA V+ camera support](https://www.atomos.com/compatible-cameras/?product=ninja-v-plus)[Atomos NINJA camera support](https://www.atomos.com/compatible-cameras?product=ninja)[Atomos NINJA Ultra camera support](https://www.atomos.com/compatible-cameras?product=ninja-ultra)Atomos NINJA TX camera support (coming soon)

[Atomos Ninja Phone camera support](https://www.atomos.com/compatible-cameras/?_products=ninja-phone)[Atomos SHOGUN CONNECT camera support](https://www.atomos.com/compatible-cameras/?product=shogun-7)[Atomos ZATO CONNECT camera support](https://www.atomos.com/compatible-cameras/?product=zato-connect)
Check [this table](https://atomos.zendesk.com/hc/en-us/articles/5252721373583) to see what Atomos recording formats are compatible with Frame.io C2C enabled. 

## Automatic SDI Camera RecordingSome Atomos devices support automatic recording over SDI. Automatic recording means that the camera can trigger the Atomos device to record as well as send timecode and clipname data to the Atomos device. This allows the Atomos device to create relinkable proxy files.

 

Atomos devices that support automatic recording:

Ninja TX

Ninja Ultra

Ninja V+ (with firmware 11.04.01 or higher and the Ninja V+ Feature Pack)

Shogun Connect

Shogun Ultra

See the table below for automatic camera support via SDI.

**Camera****Record Trigger****Trigger on by Default****Record Trigger Setting Name****Timecode****Clipname**RED

**Yes****Yes****N/A****Yes****Yes**Panavision DXL2

**Yes****Yes****N/A****Yes****Yes**ARRI ALEXA &amp; Amira

**Yes****Yes****N/A****Yes****Yes**Canon C80 &amp; C400

**Yes**No

Rec Command: On

**Yes****Yes**Canon C300mkIII &amp; C500mkII

**Yes**No

Rec Command: On

**Yes****Yes**Sony Venice &amp; Burano Family*

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

* *On Venice, this setting is only accessible by entering the **Full Menu**. To change this setting, hold the **Menu** button on the camera for **2 seconds**.**Note**: Atomos recorders can also be triggered to record any video source or camera manually. When recording manually, you will not receive clipname. Timecode may pass through.* 

Related ArticlesC2C: Camera to Cloud Camera Compatibility GuideC2C: Teradek Cube QuickStart GuideC2C: Atomos CONNECT QuickStart GuideC2C: Camera Compatibility for Teradek EncodersC2C: Getting Started with Camera to Cloud

---
*This article was automatically converted from the Frame.io Help Center.*
