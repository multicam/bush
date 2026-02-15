# C2C: Camera to Cloud Camera Compatibility Guide

> Source: https://help.frame.io/en/articles/4886030-c2c-camera-to-cloud-camera-compatibility-guide
> Category: c2c

---

Frame.io C2C can work with several different supported cameras. What does a supported camera mean? Some cameras have Frame.io C2C enabled internally. This means they can support Frame.io C2C directly.

 

Cameras that do not have Frame.io C2C built in can use an external recorder. External recorders create proxy files recorded from a video signal that they can upload to Frame.io.

 

Whether or not a camera is compatible with an external recorder for Frame.io C2C depends on the desired workflow. For instance, a relinkable proxy workflow requires a camera needs to be able to send clipname, timecode, and a record trigger to the recorder.

 

These three things ensure that the proxies the recorder is making will have the same name, timecode, and start and stop as the camera original file. This is necessary to allow the uploaded proxy file to be relinked in post production. We call this &quot;automatic recording&quot;.

 

Several C2C enabled recorders support automatic recording. See below for camera compatibility information on C2C enabled recorders with automated recording.

[Camera Compatibility for Teradek Encoders](https://help.frame.io/en/articles/6593039-c2c-camera-compatibility-for-teradek-encoders)[Camera Compatibility for Atomos Recorders](https://help.frame.io/en/articles/6593893-c2c-camera-compatibility-for-atomos-recorders)
However, not all workflows need the uploaded files to match back to the camera original files with clipname or start and stop. All C2C enabled external recorders can still record any video signal they can receive.

Related ArticlesC2C: TroubleshootingC2C: Frame.io Camera to Cloud FAQsC2C: Teradek Cube QuickStart GuideC2C: Teradek Serv and Prism QuickStart GuideC2C: Getting Started with Camera to Cloud

---
*This article was automatically converted from the Frame.io Help Center.*
