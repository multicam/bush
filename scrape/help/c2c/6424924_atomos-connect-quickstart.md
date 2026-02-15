# C2C: Atomos CONNECT QuickStart Guide

> Source: https://help.frame.io/en/articles/6424924-c2c-atomos-connect-quickstart-guide
> Category: c2c

---

The Atomos products are HDMI and SDI monitor recorders. C2C supported Atomos devices can upload proxy files of recorded clips to authenticated Frame.io projects.

 

Atomos supports C2C on the following devices:

[NINJA V](https://www.bhphotovideo.com/c/product/1401565-REG/atomos_atomnjav01_ninja_v_5_4k.html?fromDisList=y)/[V+](https://www.bhphotovideo.com/c/product/1637656-REG/atomos_atomnjvpl1_ninja_v_5_8k.html?fromDisList=y) (OS10 and OS11)[NINJA (2023)](https://www.atomos.com/products/ninja)[NINJA Ultra](https://www.atomos.com/products/ninja-ultra)[NINJA TX](https://www.atomos.com/explore/ninja-series/)[NINJA Phone](https://www.atomos.com/explore/ninja-phone/)[SHOGUN CONNECT](https://www.bhphotovideo.com/c/product/1702074-REG/atomos_atomshgc01_shogun_connect_7_hdr.html?fromDisList=y) (OS10 and OS11)[SHOGUN (2023)](https://www.atomos.com/explore/shogun/)[SHOGUN ULTRA](https://www.atomos.com/explore/shogun-ultra/)
Atomos NINJA 2023, V/V+, and Ultra monitors require an [Atomos CONNECT](https://www.atomos.com/accessories/atomos-connect) module. NINJA TX monitors do not.
​
Use this guide to quickly setup your supported Atomos device for C2C with settings recommended by Frame.io. 

*Note*: Some Atomos devices only support certain framerates, codecs, and resolutions while using Connect Mode. [Click here](https://atomos.zendesk.com/hc/en-us/articles/5252721373583) to see a list of supported codecs and framerates in Connect Mode. 

**What you&#x27;ll need**1 supported Atomos device per camera

If you are using NINJA devices (except for the NINJA TX or NINJA Phone), each monitor will need an Atomos CONNECT Module

The [latest firmware](https://www.atomos.com/product-support) from Atomos installed on the device (**v11.10** or later)*Any HDMI or SDI camera. [Click here](https://help.frame.io/en/articles/6593893-c2c-camera-compatibility-for-atomos-recorders) for more information on camera compatibilityAn Atomos [compatible drive](https://www.atomos.com/compatible-drives/?product=ninja-v) formatted by the Atomos deviceSDI or HDMI cable (some DSLR or mirrorless cameras may require a mini or micro HDMI connection)

A local network with [internet access](https://help.frame.io/en/articles/8571967-c2c-complete-internet-connection-guide)Access to Frame.io or the Frame.io iOS app

A Frame.io project

*Specific to Frame.io Legacy accounts:**Ensure C2C Connections are enabled in your project settings**Ensure you have C2C Device management permissions within the account the project is hosted in*
 

**Note: Atomos Cloud Studio has been deprecated in favor of MAVIS Cloud, which does not include support for C2C. To connect your Atomos device to C2C, make sure to use the [method below](#h_61021d9257) to connect directly to Frame.io.* 

If you are using NINJA Phone, you&#x27;ll need the following:

A supported mobile device. [Click here](https://www.atomos.com/explore/ninja-phone/) for more information on supported devicesThe Atomos NINJA Phone App from the App Store or Google Play Store or the Mavis Camera app from the App Store

**Setup**## Monitor-RecordersIf you are using a monitor-recorder (ie, NINJA, SHOGUN, ZATO), follow these instructions. See below for [NINJA Phone](https://help.frame.io/en/articles/6424924-c2c-atomos-connect-quickstart-guide#h_0180d0e54a) and connecting from [Atomos Cloud Studio](https://help.frame.io/en/articles/6424924-c2c-atomos-connect-quickstart-guide#h_eb1a1a5fa3).If you’re using a NINJA, make sure the [Atomos CONNECT](https://www.atomos.com/accessories/atomos-connect) module is attached. The SHOGUN CONNECT does not need an additional module.Attach a power source to your Atomos device and power it up.

On the Atomos device, use the Main Menu to navigate to the WiFi menu and connect your Atomos device to a WiFi network. You may need to toggle WiFi on first. Alternatively, if you’re using Ethernet, use the Network menu and set it to DHCP mode.

Next, head to the Connect menu and select **Frame.io**. This will generate your device&#x27;s pairing code.Follow the prompts in the **C2C Connections** tab on Frame.io or in the Frame.io iOS app.Once paired to Frame.io, you can use the Connect menu on your Atomos device to configure your proxy and upload settings as well as unpair the device.

## NINJA PhoneIf you are using NINJA Phone, follow these instructions.

Attach and connect your phone to the NINJA Phone device.

Attach a power source to your NINJA Phone and power it up.

In the NINJA Phone App or Mavis Camera app, tap the Connection button to open the Connection menu.

If Adobe Frame.io is not currently active, tap **Change Service** and select Adobe Frame.io.Log in with your Frame.io user. After submitting your credentials, tap **Allow** to grant the NINJA Phone App or Mavis Camera app to upload to your accounts.Once access has been granted, select the Account and Project you would like to upload to.

Finally, configure your Upload Type. Progressive Upload will upload files as you&#x27;re recording and End of File will upload files as soon as you cut.

When everything is configured, tap **Done**.If you are using the Mavis Camera app, open **Settings** by selecting the three dot button and change **Input Source** to **Ninja Phone**.To change Accounts, Projects, or Upload Type, tap the Connection button then **Edit**.
 

**Troubleshooting****Proxies aren&#x27;t uploading from my device**First, make sure your device is connected to the internet, paired to your Atomos.Cloud account, and connected to a Frame.io Project. On Atomos.Cloud, make sure the Frame.io destination is enabled. You can use the three-dot menu to change the Frame.io project it is connected to.

 

Once you&#x27;ve confirmed that the Atomos device is connected properly, use the Date Time page of the Main Menu to make sure the Timezone, Date, and Time settings are accurate. After the device is connected to the web, it should automatically set the timezone.

 

**Note**: it is important that the Atomos device isn&#x27;t set to any Date or Time in the future. This may prevent uploads to Frame.io. 

## I&#x27;m unable to record ProRes RAW while using C2CProRes RAW recording while using C2C is only available on the NINJA V+ (with OS11 feature pack), NINJA ULTRA, NINJA TX, SHOGUN CONNECT (with OS11), and SHOGUN ULTRA at this time.

 

## I don&#x27;t see Frame.io as an option under the Connect menu on my deviceMake sure your device has been updated to OS 11.10 or later. Earlier versions of the Atomos firmware required Atomos Cloud Studio. Once updated, you should be able to see Frame.io as an option in the Connect menu.

 

## What&#x27;s the difference between the MAVIS Camera App and the Ninja Phone App?The MAVIS Camera App is a mobile camera app that supports C2C connections to Frame.io, and you can learn more about using it [here](https://help.frame.io/en/articles/10826792-c2c-mavis-camera-quickstart-guide). In addition to being a camera app, the MAVIS Camera App also supports inputs from the Ninja Phone hardware. The Ninja Phone App is a dedicated app for Ninja Phone provided by Atomos. You can use either app on your supported device to record from Ninja Phone hardware. 

## I was just migrated to MAVIS Cloud from Atomos Cloud Studio, and I don&#x27;t see Camera to Cloud as an optionMAVIS Cloud does not support connections to Frame.io Camera to Cloud. To use C2C, please connect to Frame.io directly using the six-digit code method described [here](#h_61021d9257). 

## I can no longer connect my ZATO Connect to Frame.ioThe ZATO Connect does not support a direct connection to Frame.io C2C at this time.

Related ArticlesC2C: ZoeLog QuickStart GuideC2C: Camera Compatibility for Atomos RecordersC2C: Getting Started with Camera to CloudC2C: Nikon QuickStart GuideC2C: Mavis Camera QuickStart Guide

---
*This article was automatically converted from the Frame.io Help Center.*
