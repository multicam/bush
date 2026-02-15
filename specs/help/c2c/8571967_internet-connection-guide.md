# C2C: Complete Internet Connection Guide

> Source: https://help.frame.io/en/articles/8571967-c2c-complete-internet-connection-guide
> Category: c2c

---

Camera to Cloud requires the internet to both pair devices and upload assets to your Frame.io Project. Bringing the internet into your production space might be a new addition to your toolkit, but well worth it for the workflows it can unlock.

 

Just like with our mobile phones, it can be frustrating when the network doesn&#x27;t behave how we expect it to — especially when we&#x27;re relying on it for work. It can also often feel difficult to understand what&#x27;s happening and what makes it actually work correctly.

 

This article is designed to help answer all your questions about internet, networking, and connecting your set to the cloud. For convenience, we&#x27;ve split it into a few different sections:

[Introduction to the network](#h_89913c6cfa) — this section focuses on defining common terms and covers the basics of what you need for camera to cloud.[Understanding your network needs](#h_577a59ca52) — this section gives you tools to identify how your network might behave as well as how to figure out what your network and bandwidth needs might be.[Troubleshooting](#h_11d88acff7) — this section covers common networking troubleshooting tips and includes a networking checklist. If you already have a network and are experiencing issues, feel free to start here.
This article has a lot of useful information about connectivity and setting up your network, but if you want to skip directly to troubleshooting common issues, jump down to our section on [Common Connection Issues](#h_c00329578d). 

# Introduction to the networkThere are a lot of terms here that might seem interchangeable. Terms like &quot;network&quot;, &quot;internet&quot;, and &quot;connection&quot;. It may be helpful to define a few of these. Let&#x27;s take a look.

 

**network**: a general term for the infrastructure devices use to communicate with each other. WiFi, internet, and cellular systems are all types of *networks*. In this guide, &quot;network&quot; will generally refer to your *local network*. The local network is the network that connects the devices near you to each other. At home, your local network is the WiFi you connect your phone or computer to. They are controlled by a device called the *router*. It is important to bear in mind that a local network by itself does not necessarily have an internet connection. 

**internet**: while we all know what the internet is, we are defining it in this guide as the connection between your local network and remote servers and websites (like Frame.io). A device, like a modem, connects the internet from your *Internet Service Provider* (or ISP) to your local network. 

**connection**: a *connection* is the link between a device and a network. The bridge between your C2C device to WiFi or between your modem to the internet are both *connections*. 

**bandwidth**: *bandwidth* is the amount of data can pass through a network connection — effectively, a connection&#x27;s speed. This is typically measured in megabits per second (Mbps). 

## Connecting a Camera to Cloud Device to the Internet Let&#x27;s break down what you need to do to get your C2C device uploading to Frame.io.

 

First, your device needs to connect to the local network. This can be a WiFi connection, an Ethernet connection, or perhaps even a USB tether to a modem or hotspot. The available connections will depend on your C2C device&#x27;s physical capabilities. In most cases, the local network is created and maintained by a router.

 

Second, the local network needs to be able to get to the internet and, eventually, the Frame.io servers. In order to connect your local network to the internet, you&#x27;ll need a modem. The modem can connect to a traditional ISP (like at your home or in your office), to a cellular provider (like on your phone or hotspot), or even to a satellite provider. It then shares its connection from the provider with your router and its local network.

 

*Basic network diagram* 

In most common network setups, your router and modem are usually two separate devices. However, in some instances, like when using a mobile hotspot, your modem may create its own local network.

 

Whether your router and modem are two independent devices or combined into one, they serve two different connections — and both need to be functioning in order to use C2C. Your C2C device will need to be able to connect to the local network and the local network will need to have an active internet connection in order for assets to upload.

 

# Understanding your network needsIn addition to understanding how you need to connect your C2C device to the internet, you also need to figure out how much throughput, or speed, you&#x27;ll need to upload effectively — this is called *bandwidth*. 

In order to know how much bandwidth you&#x27;ll need, you&#x27;ll also need to understand the size of your assets. This is usually measured by the amount of data that is written per second to create the file. This is called *bitrate*. 

Generally speaking, if you want to be able to upload in relative-time (meaning a one minute long clip will take one minute to upload), you&#x27;ll need to make sure your bandwidth (internet speed) is consistent with the bitrate of your assets. This is a little bit like driving 60mph on the highway. For every minute, you&#x27;ll go a mile. It&#x27;s a good baseline that&#x27;s easy to understand — a slower speed will cover fewer miles and a faster speed will cover more miles in the same amount of time.

 

## Figuring out how long assets will take to uploadA common question is to ask &quot;how long does it take to upload assets with C2C&quot;? This might seem like a basic spec of the platform, but it&#x27;s a complicated question in reality. The simple answer is that C2C *can* upload your asset in relative-time — ie, in the same amount of time it is long. The real question is &quot;what bandwidth requirements do I need to achieve relative-time uploads or faster?&quot; The good news is that we can easily figure this out. 

Your bandwidth requirements depend on a lot of independent factors including how big the assets are, how long the assets are, how many devices are uploading on your network, and your workflow needs.

 

Let&#x27;s look at a simple example — and, yes, this will be a little bit of math. But stick with us! First we need to understand how these values relate to each other. We have 5 total values: `number of cameras,` `asset length`, `asset bitrate`, `bandwidth`, and `upload target time`. If we multiply the `length of the clip` by the `bitrate of the clip`, we can figure out how much data we&#x27;ve generated for a single camera. To figure out our total data for all cameras, we just need to multiply *that* number by the `number of cameras` (since each camera will generate that much data). 

To find our required speed, we just need to divide our total amount of data by our `upload target time` — which is how long it should reasonably take for an asset to upload. Remember, to achieve relative-time uploads, this should be the same amount of time as the clip is long. 

If we wrote that out as an expression, it would look like this:

 

```
( (length * asset bitrate) * cameras ) / upload target time = bandwidth
``` 

What does this look like with real numbers? Let&#x27;s say you record **one** camera (generating one asset) for **60** seconds at a bitrate of **1Mbps** (megabits per second). What internet bandwidth would we need to be able to upload the clip in **60** seconds? 

( (60s * 1Mbps) * 1 camera ) / 60s upload = bandwidth
&gt; ( (60Mb) * 1 camera ) / 60s upload = bandwidth
&gt; 60Mb / 60s upload = bandwidth
&gt; 1Mbps = bandwidth 

Solving this expression, we would get `1Mbps` for `bandwidth`. So, in order to upload an asset in &quot;relative-time&quot; (ie, a 60 second clip takes 60 seconds to upload), our internet bandwidth needs to be the same as our assets&#x27; bitrate. 

*Bandwidth requirements for a single camera * 

What happens when we shoot on **two** cameras? If we plug that into the same expression above, we can see that since we&#x27;ve doubled our total bitrate and runtime (we now have *two* 60 second assets at 1Mbps), we need double the bandwidth. 

( (60s * 1Mbps) * 2 cameras ) / 60s upload = bandwidth
&gt; ( 60Mb * 2 cameras ) / 60s upload = bandwidth
&gt; 120Mb / 60s upload = bandwidth
&gt; 2Mbps = bandwidth 

We&#x27;ve doubled the data, so our bandwidth also needs to be doubled.

 

*Bandwidth requirements for two cameras* 

Conversely, how do we figure out what bandwidth we need if we want to accelerate our workflow and upload in *half* the time? If our clips are **60s** long, we want to upload both of them in **30s** each. We can use the same expression to figure that out as well. Let&#x27;s take a look: 

( (60s * 1Mbps) * 2 cameras ) / 30s upload = bandwidth
&gt; ( 60Mb * 2 cameras ) / 30s upload = bandwidth
&gt; 120Mb / 30s upload = bandwidth
&gt; 4Mbps = bandwidth 

This tells us that for two cameras we would need `4Mbps` of bandwidth in order to upload two cameras in half the time. 

*Bandwidth requirements for two cameras and half relative-time* 

Let&#x27;s look at one last example. If we increase the bitrate of the assets to `5Mbps`, we can see that we&#x27;ll need 5 times more network bandwidth to upload in &quot;relative-time&quot; for a single camera: 

( (60s * 5Mbps) * 1 camera ) / 60s upload = bandwidth
&gt; ( 300Mb * 1 camera ) / 60s upload = bandwidth
&gt; 300Mb / 60s upload = bandwidth
&gt; 5Mbps = bandwidth 

*Bandwidth for a single camera recording 5Mbps assets* 

If we increased this to two cameras we would need 10Mbps of bandwidth, and so on.

 

## Figuring out your required bandwidthHow do we apply this moving forward? The expression we used above is helpful, but you don&#x27;t always know how long your clips will be. Figuring out your &quot;relative-time&quot; bandwidth requirement is as simple as calculating your total bitrate. You can do this by multiplying the number of devices that are uploading by the asset bitrate:

 

```
devices * asset bitrate = total bitrate
``` 

Remember, you would need internet bandwidth equal to your `total bitrate` to upload a 60 second clip in 60 seconds. A bandwidth value higher than that will result in faster uploads and bandwidth lower than that will result in slower uploads. 

## What about still photography?Calculating bandwidth needs for still photography is a little more complicated. The bandwidth you use is determined by the size, format, and quantity of images you&#x27;re capturing and uploading. What resolution are you shooting? Are you uploading JPEGs or RAW files? How many images are you capturing at once?

 

Additionally, photo cameras that support Camera to Cloud also allow you to upload all images automatically or pick which ones you want to upload manually. For this guide, we&#x27;re going to assume that the camera is uploading all images automatically since that workflow has more pressing bandwidth requirements.

 

Just like video, we can use a target of maximum acceptable upload time (ie, what&#x27;s the longest amount of time after image capture are you willing to wait for the image to become available) to figure out a minimum acceptable bandwidth. This formula is fairly simple: we just need to divide the size of our image (in mega**bits**, not mega**bytes**) by our maximum upload time in order to get the `bandwidth`. 

```
image size / upload target time = bandwidth
``` 

Let&#x27;s look at a real world example. A full resolution RAW file from the [Fujifilm X-H2S](https://help.frame.io/en/articles/7156603-c2c-fujifilm-quickstart-guide) camera, which is 26 megapixels, is about 60 megabytes. Nearly all computer systems represent file sizes in **bytes**, not **bits**. Since bandwidth speeds are in mega**bits** per second, we need to convert the unit of our image size. Luckily this is simple. Just multiply the value in mega**bytes** (MB) by **8** to get mega**bits** (Mb). So **60MB** becomes **480Mb**. 

Unlike video, however, there is no time element to photos and so there is no such thing as a &quot;relative-time&quot; to target. What&#x27;s a reasonable amount of time to expect an image to upload? This ultimately depends on your workflow needs, but let&#x27;s assume that, for most workflows and the sake of this example, an upload time after capture of over **10** seconds starts to feel too slow. 

With those two pieces of information, we get the following results:

 

480Mb / 10s = bandwidth
&gt; 48Mbps = bandwidth 

In this case, we would need *at least* `48Mbps` for each of our RAW images to upload within **10** seconds. Remember, a bandwidth higher than that will give us faster upload speeds and a bandwidth lower than that will give us slower upload speeds. 

But file size isn&#x27;t the only factor. This formula and method work great if you&#x27;re shooting on one camera and only a few images per minute (ie, no more than 1 image for every span of your `upload target time`). If your workflow has you shooting at high framerates with multiple photographers, we can modify the formula a bit to get a clearer picture of our bandwidth needs. 

We want to be able to account for the amount of images being captured in total, so we need to multiply our `image size` (remember, in mega**bits**) by those factors. 

Our new formula will look something like this:

 

```
( devices * framerate * image size ) / upload target time = bandwidth
``` 

`Framerate` should be expressed as a factor of your `upload target time` — that is, how many images do you estimate will be captured within that given timeframe. For example, using our same guideline of **10** seconds, a `framerate` of **1** would mean that I expect to capture **1** image every **10** seconds. This is going to be subjective, so you&#x27;ll have to make your best guess. 

Let&#x27;s expand on our previous example. Let&#x27;s say we now have 3 photographers, and they will be capturing an average of roughly **5** images every **10** seconds *each*. I made this guess based on their shooting burst speed and how often they&#x27;ll be attempting to capture moments (ie, time with their finger on the shutter). Again, this is subjective and might not be easily quantified. Talk to your photographers to get a sense of how they shoot. When in doubt, skew higher. 

Let&#x27;s see what our new bandwidth needs are.

 

( 3 cameras * 5 images per target time * 480Mb ) / 10s = bandwidth
&gt; 7200Mb / 10s = bandwidth
&gt; 720Mbps = bandwidth 

As you can see, shooting RAW images requires quite a lot of bandwidth. Almost a gigabit per second! In this case, it might be beneficial to upload just JPGs, which are considerably smaller. For the same camera, a JPG is about **7.5MB** (or **60Mb**). 

Accounting for the new `image size`, we can figure out the bandwidth needs for the adjusted workflow. 

( 3 cameras * 5 images per target time * 60Mb ) / 10s = bandwidth
&gt; 900Mb / 10s = bandwidth
&gt; 90Mbps = bandwidth 

For our examples here, we used images from the Fujifilm X-H2S camera. The image size of your workflow will depend on the camera system you&#x27;re using. Shoot a few sample images and see how large the files are to get your `image size`. 

# TroubleshootingThe internet is a key ingredient to deploying C2C workflows — so what do you do when you can&#x27;t connect? In this section, we&#x27;ll walk through some common issues and how to address them.

 

There are several elements that can affect whether or not you can connect and upload to Frame.io. When identifying possible issues with your network or connectivity, the first thing you should do is ensure you have some connection basics covered. Let’s walk through our Connection Checklist as a way to start troubleshooting.

 

## Connection ChecklistPreparing for your network needs is a necessary part of pre-production when using Camera to Cloud enabled workflows. Using information from our [Introduction to the Network](#h_89913c6cfa) section, let&#x27;s go through a basic checklist. If you&#x27;re seeing connection or uploading issues, start here. 

### Make sure your C2C device has connected to the local networkThe first step is to get your C2C device on the local network. On most networks, this is just like connecting your phone or your computer to WiFi. You search for the network name and enter the password.

 

However, some networks, like hotels, require users to sign into a mini-webpage before connecting to the network. This is called a *captive portal*. Most hardware devices that support C2C can&#x27;t connect to these networks. 

There are some solutions to dealing with extra-secure networks like ones with captive portals.

Some networks may let you connect a router to an ethernet wall jack. This allows your to create your own local network that your C2C devices can connect to. **Before connecting your own network equipment to a facility&#x27;s network, be sure to check with that facility&#x27;s IT team to confirm that it is safe to do so**. 

Some travel routers, like the GL-iNet [Slate](https://www.gl-inet.com/products/gl-a1300/) or GL-iNet [Beryl](https://www.gl-inet.com/products/gl-mt1300/), allow you to bridge the facility&#x27;s protected network to the router&#x27;s own network. You can use a computer or phone to connect your travel router to the network with the captive portal. Once connected, the travel router will create its own local network that your C2C devices can connect to. 

Use your own cellular modem or hotspot. Bringing your own cellular modem lets you have your own internet source and local network anywhere you go. Your C2C devices will only have to remember the local network generated by your modem, preventing you from needing to reconnect whenever you get to a new location.

 

### Make sure your local network has internetJust because you can connect to your local network doesn&#x27;t mean you can get to the internet — remember, the connection from the local network to the internet is separate connection than the one from your device to the local network. Your C2C device may report it&#x27;s connected to the local network even if the local network doesn&#x27;t have internet.

 

The easiest way to check if your local network has internet is to connect your phone or computer to the same network and try to get to a webpage.

*Pro-Tip**: Use a news website as your test webpage. Some browsers may cache frequently visited websites locally. A news site will have articles that are recent, which makes it easier to confirm that the content is live and not cached.*If you can&#x27;t get online, you should check to make sure your local network is being provided internet by a modem. If you&#x27;re using a cellular modem or hotspot, make sure it has a cellular signal.

 

### Make sure your C2C device can stay connected to the local networkIf your C2C device frequently disconnects from the local network, your asset upload performance will be affected. Even if you have the [appropriate amount of bandwidth](#h_f973b2dfeb) on the network and internet connection, your C2C device can&#x27;t take advantage of it if it&#x27;s not connected to the network. Networks that devices consistently disconnect from usually suffer from coverage issues — meaning the network struggles to provide enough signal for the space that it&#x27;s in. 

Local networks have a limited range and your device may disconnect if you move it too far from the network router. Additionally, large industrial spaces, like warehouses, commercial offices, and sound stages, are constructed with a lot of steel. The steel may inhibit the radio signals of your WiFi router and reduce network coverage in these spaces. Both of these issues can be solved by a network with multiple access points (like a mesh network).

 

If you&#x27;re running into coverage issues, there are a few things you can try.

First, you can try moving your router or access point closer to where your C2C device is operating.

Second, you can try deploying more access points for your network. This may require upgrading from a typical wireless router to a network system that supports multiply access points, like mesh networking.

Third, most C2C devices support wired ethernet connections and any wired connection will eliminate WiFi issues at the expense of being tethered to a router or access point.

Finally, mobile hotspots and modems usually don&#x27;t have high-performance WiFi routers. If you are using a mobile solution for your internet and it has an ethernet port, you can connect a router to your hotspot or modem to improve its WiFi coverage and performance.

 

However, even if your device does disconnect from the network, the assets it records will be saved and queued for upload once the device gets reconnected.

 

## Common Connection IssuesWhile this guide has been designed to be a comprehensive resource for making sure your C2C devices are connected and uploading, networks can be tricky and you may run into isolated issues or you may not be able to immediately diagnose the root cause of a specific issue you&#x27;re experiencing.

 

### Assets aren&#x27;t uploadingWhen you&#x27;re not seeing assets from your C2C device appear on Frame.io, there are several things to check.

 

The first thing to look at is to make sure your device is recording and creating assets. If there are no assets being created, nothing will be uploaded to Frame.io, and you&#x27;re not experiencing a network issue at all. For external recorders, make sure you have a solid video connection between your camera and your recorder, your recorder is set up for your camera, your camera is set up to send record triggers, and that your recorder&#x27;s media is formatted and compatible with your device. For cameras, make sure you have the desired asset format configured to upload and that the camera is set to create that asset type.

 

Next, make sure your device is properly paired to the correct Frame.io Project. Most devices provide ways to see which Project it&#x27;s currently paired to. Any assets created before your device has been paired to the correct Project may not upload after being paired.

 

Finally, make sure [your device is connected to the network](#h_cd5a813418) and the [network has internet](#h_d8e449f230). 

### Can&#x27;t generate pairing codeYour C2C device needs to be able to reach the internet in order to generate a pairing code. If your C2C device can&#x27;t generate a pairing code, it most likely does not have a connection to the internet. Make sure [your device is connected to the network](#h_cd5a813418) and the [network has internet](#h_d8e449f230). 

### Connection failsThe first thing you want to do is make sure your local network has enough signal for your C2C device to successfully connect to. Check out our sections on [connecting to a local network](#h_cd5a813418) and [keeping your device connected](#h_f29de6de21). 

Some devices may fail a connection if the device can&#x27;t reach the internet. Make sure your [network has internet](#h_d8e449f230) and try again. 

### My C2C device can&#x27;t get to the internet, but my phone or computer canThere are some types of networks many hardware devices can&#x27;t fully navigate. This is typically due to security measures on the network.

 

Some public networks, like at hotels, require the user to fill out a &quot;captive portal&quot;. These are forms that typically ask the user for identifying information (like your hotel room number or your last name) in order to protect the network from rogue clients. Most C2C hardware devices can&#x27;t connect to these types of networks. You can try to connect the device or a router to an available ethernet port or use a travel router to bridge the protected network to your device. Check out our section on [connecting your device to the local network](#h_cd5a813418) for more information. 

Other private networks, like corporate, school, or government networks, may have enterprise-grade security to prevent rogue clients from connecting. Some C2C devices support enterprise-grade WiFi security, but many do not. If you can&#x27;t connect to one of these networks, make sure you talk to the facility&#x27;s IT and/or network team.

Related ArticlesC2C: Fujifilm QuickStart GuideC2C: Getting Started with Camera to CloudC2C: Canon QuickStart GuideC2C: Nikon QuickStart GuideC2C: Leica QuickStart Guide

---
*This article was automatically converted from the Frame.io Help Center.*
