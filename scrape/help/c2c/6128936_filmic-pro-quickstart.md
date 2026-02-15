# C2C: Filmic Pro QuickStart Guide

> Source: https://help.frame.io/en/articles/6128936-c2c-filmic-pro-quickstart-guide
> Category: c2c

---

[Filmic Pro](https://www.filmicpro.com/) is one of the most advanced and widely-used smartphone camera applications for recording video content on both iOS and Android smartphone devices. Filmic Pro provides video content creators of all kinds with a variety of custom tools and precise control of camera settings that go beyond what is typically provided by native smartphone camera applications. With Frame.io C2C, you can now upload transcoded proxy files of your Filmic Pro captured content directly to your Frame.io Project for instant distribution and review.
​
Use this guide to quickly setup Filmic Pro for C2C with settings recommended by Frame.io. 

# What you&#x27;ll needFilmic Pro application installed on a compatible iOS/Android smartphone. For iOS, make sure you have an iPhone 11 or newer. For Android, visit Filmic&#x27;s [support site](https://www.filmicpro.com/support/) for more information.A connection to the [internet](https://blog.frame.io/2021/03/15/connecting-your-set-to-the-internet/) (WiFi or cellular)A Frame.io project

*Specific to V3 accounts:**Ensure C2C Connections are enabled in your project settings**Ensure you have C2C Device management permissions within the account the project is hosted in*
 

# SetupLaunch the Filmic Pro application and enter the main menu by pressing the gear icon on the bottom-right section of the screen. 

In the main menu, enter the Frame.io menu.

In the Frame.io menu, click “Log in”. 

Enter your account credentials then click “Allow” when prompted by Filmic Pro to grant upload permissions for Frame.io.

Once logged in, select which Frame.io account you would like to work in, followed by which project within the selected account you would like to upload assets to.

Once connected to a Project, you will be returned to the Frame.io menu. Use the lower section of the Frame.io menu to select what Proxy Quality* and Upload Method** you would like to apply to your assets. We recommend setting Upload Method to Auto.

Navigate back to the main menu to configure any custom camera setting you would like for your original camera files.

Now, once you cut on recordings in Filmic Pro a proxy file of your clip will make its way up to Frame.io moments later.

* *Proxy Quality options are 720p/1.5Mbps, 1080p LQ/3Mbps, or 1080p HQ/10Mbps*
** *Upload Method options are Auto, Prompt, and Off. Auto will upload proxies to Frame.io automatically, Prompt will ask permission to upload each clip once cut, and Off will disable proxy upload* 

# Troubleshooting**Why does the timecode of my proxy files start at 00:00:00:00?**At the moment, timecode is not supported in Filmic Pro proxy files. To ensure TC metadata of transcoded proxy files will match the Filmic original camera files, Filmic will default timecode to a Rec Run format when Frame.io Camera to Cloud is enabled. 
​ 

## Why are my clips taking a long time to upload?Clips are uploaded to Frame via an internet connection. It is possible you may experience a limited internet connection in certain areas due to low signal strength or congestion of cellular and WiFi networks. 
​
There are a collection of free smartphone applications, such as [Ookla](https://www.speedtest.net/apps), that measure the download and upload speed of your current internet connection in Mb/s. This will allow you to run speed tests on any internet connection you connect your phone to. This will allow you to determine what the fastest available network may be.
​
Another option to reduce upload time is to consider selecting a lower proxy quality in the Frame.io menu in order to reduce proxy file size.
​
​Related ArticlesC2C: Aaton Cantar QuickStart GuideC2C: ZoeLog QuickStart GuideC2C: Accsoon QuickStart GuideC2C: Mavis Camera QuickStart GuideC2C: Leica QuickStart Guide

---
*This article was automatically converted from the Frame.io Help Center.*
