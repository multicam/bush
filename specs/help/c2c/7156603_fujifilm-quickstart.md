# C2C: Fujifilm QuickStart Guide

> Source: https://help.frame.io/en/articles/7156603-c2c-fujifilm-quickstart-guide
> Category: c2c

---

Fujifilm cameras can shoot stills and video and automatically upload them directly into your Frame.io C2C Project.

 

C2C is currently enabled on the following Fujifilm cameras:

[X-H2](https://fujifilm-x.com/global/products/cameras/x-h2/) (firmware version 2.00 or later; firmware version 4.00 or later is required to use C2C without the FT-XH accessory grip)[X-H2S](https://fujifilm-x.com/global/products/cameras/x-h2s/) (firmware version 4.00 or later; firmware version 6.00 or later is required to use C2C without the FT-XH accessory grip)[GFX100 II](https://fujifilm-x.com/global/products/cameras/gfx100-ii/)[GFX100S II](https://fujifilm-x.com/global/products/cameras/gfx100s-ii/)[X100VI](https://fujifilm-x.com/en-us/products/cameras/x100vi/)[X-T50](https://fujifilm-x.com/global/products/cameras/x-t50/)[X-T5](https://fujifilm-x.com/global/products/cameras/x-t5/) (firmware version 3.01 or later)[X-S20](https://fujifilm-x.com/global/products/cameras/x-s20/) (firmware version 2.01 or later)[X-M5](https://fujifilm-x.com/global/products/cameras/x-m5/)[GFX100RF](https://www.fujifilm-x.com/en-us/products/cameras/gfx100rf/)[X-E5](https://www.fujifilm-x.com/global/products/cameras/x-e5/)[X-T30 III](https://www.fujifilm-x.com/global/products/cameras/x-t30-iii/)
Use this guide to quickly setup your Fujifilm camera for C2C with settings recommended by Frame.io.

 

For more in depth support on Fujifilm&#x27;s Camera to Cloud integrations, please visit Fujifilm&#x27;s C2C [support hub](https://fujifilm-x.com/en-us/exposure-center-series/camera-to-cloud-support/). 

**What you&#x27;ll need**Supported Fujifilm camera body (see above)

If you are using the [FT-XH File Transmitter](https://fujifilm-x.com/en-us/products/accessories/ft-xh/) accessory, you will need [firmware version 2.00](https://fujifilm-x.com/global/support/download/firmware/accessories/ft-xh/) or laterSupported camera body with [up to date firmware](https://fujifilm-x.com/global/support/download/firmware/cameras/)Properly formatted media card

Internet access (local network, hot spot, or smartphone tether)

Access to Frame.io or the Frame.io iOS app

A Frame.io Project

*Specific to V3 accounts:**Ensure C2C Connections are enabled in your project settings**Ensure you have C2C Device management permissions within the account the project is hosted in*
 

**Setup**If you are using the FT-XH accessory grip with your camera, connect it to your camera body. Refer to the manual from Fujifilm for more information.

Power the camera on and open the main menu.

Navigate to the **Network/USB Setting** menu and open the **Frame.io Camera to Cloud** submenu.In the **Frame.io Camera to Cloud** menu, select **Connect**. Follow the on screen prompts to connect the camera to a network (refer to your camera&#x27;s documentation for more information on connecting to networks).If you are connecting to a network for the first time, or have no current Frame.io Project connected, you will be prompted to get a new pairing code. Select **Get New Pairing Code**. If your device is already connected to a Project, skip to **Step 7** for recommended settings.In Frame.io on the web or in the iOS app, navigate to or create the Project you would like to upload to. Follow the pairing instructions in our [Getting Started Guide](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_9ccc272c8a) to connect your device to that Project.Once connected to a network or paired to a Project, open the Select File Type option in the Frame.io Camera to Cloud menu. Use this menu to select the types of files you would like to send to Frame.io. If you have limited bandwidth, try using smaller filetypes. For example, you can use `JPG` instead of `RAW` for photos or you can upload video proxies if your camera supports them. Refer to your camera&#x27;s manual for more information about setting up recording types. Press **Back** when done to return to the **Frame.io Camera to Cloud** menu.You can use the **Upload Setting** option to further configure other settings like upload behavior (**Note**: **Auto Image Transfer** is set to `OFF` by default — turn this `ON` to enable automatic uploads).To connect your device to a different Frame.io Project, use the **Get Pairing Code** option in the **Frame.io Camera to Cloud** menu to generate a new six-digit code and, using the instructions in our [Getting Started Guide](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud#h_9ccc272c8a), enter this code into the new Project.
 

**Troubleshooting****Connect and/or Disconnect is greyed out or I can&#x27;t connect to a network**First, make sure you have a charged battery in the camera body. If you are using the FT-XH accessory grip, make sure those batteries are charged as well.

 

On the X-H2 and X-H2S cameras the **Connect** and **Disconnect** options in the **Frame.io Camera to Cloud** menu are unavailable when the camera body can&#x27;t detect the FT-XH File Transmitter accessory when using firmware older than version 6.00. Make sure the File Transmitter is securely attached to the camera. Refer to the documentation from Fujifilm for information on installation. 

### My files are taking a long time to uploadIf you have limited bandwidth, try using the **Select File Type** option in the Frame.io Camera to Cloud menu. For example, if you&#x27;re shooting stills, you can turn off `RAW` and upload only the smaller `JPG` files. 

You can also use the **Select Image and Transfer** option under **Upload Setting** to select the specific individual files you want to upload. 

### My files aren&#x27;t uploading to Frame.ioFirst, make sure you have a charged battery in the camera body as well as the grip and that the date and time of the camera are up to date.

 

Additionally, make sure **Auto Image Transfer Order** is set to `ON` (this is set to `OFF` by default) and **Transfer/Suspend** is set to `Transfer` in the **Upload Setting** option of the **Frame.io Camera to Cloud** menu. This will make sure your files upload automatically. There&#x27;s also an option to let the camera continue to upload when it powers off under the **Upload Setting** menu. 

Finally, make sure you have your desired filetypes (ie, JPG, RAW, MOV - Proxy, MOV - ProRes) selected under in the **Select File Type** option of the **Frame.io Camera to Cloud** menu. 

If you&#x27;d like to choose which images or videos to upload, you can use the **Select Image &amp; Transfer** function in the **Upload Setting** option of the **Frame.io Camera to Cloud** and manually upload. 

### My Wireless LAN connection fails when trying to connect to a new networkIn order to connect to a new network, the camera must fail to connect to the previously saved network first. Once this process is complete, you can connect to a new network. Refer to your camera&#x27;s documentation for more information on connecting to networks.

 

**Note**: You can also hit the `BACK` button on the camera body to cancel the process and then connect to the new network. 

**Access Point Setting is greyed out when connecting to a network.****Access Point** **Setting** is unavailable while an HDMI cable is connected to the camera. To configure **Access Point** **Setting**, disconnect the HDMI cable, configure the setting, then reattach the HDMI cable. 

### I&#x27;m seeing invalid characters instead of numbers when getting my pairing code.In some rare cases, you may see odd characters instead of numbers when the camera loses its internet connection as it&#x27;s requesting a pairing code from Frame.io. Hit the `BACK` button on the camera body to cancel the connection process. Make sure you have a stable connection and try again. 

### The video files I offloaded locally from my camera are shorter than the proxies I uploaded with C2C.In some cases, offloading files directly from the camera to a computer may result in files limited to 4GB. It it recommended you offload large video files to a computer using a card reader instead of a USB connection to the camera body.
​ Related ArticlesC2C: Teradek Cube QuickStart GuideC2C: Panasonic Lumix QuickStart GuideC2C: Canon QuickStart GuideC2C: Nikon QuickStart GuideC2C: Leica QuickStart Guide

---
*This article was automatically converted from the Frame.io Help Center.*
