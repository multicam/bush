# C2C: Complete Proxy Workflow Guide

> Source: https://help.frame.io/en/articles/6079079-c2c-complete-proxy-workflow-guide
> Category: c2c

---

While there are many integrations in the Camera to Cloud (C2C) ecosystem that can upload camera original files to Frame.io, many workflows still require proxies. In fact, the first C2C Connections were proxy only. Proxies from C2C Connections can help you and your team instantly view takes, organize footage, and start editing.

 

*Want to learn more about C2C Connections? Check out our [C2C Getting Started Guide](https://help.frame.io/en/articles/8896457-c2c-getting-started-with-camera-to-cloud).* 

If you&#x27;re editing with proxies from C2C Connections, eventually you may want to go back to the original, high-quality files from the camera. If you&#x27;re unfamiliar with proxy or online/offline workflows, this process can sometimes feel like jumping straight into the deep end. The good news is that C2C enabled cameras and external video recorders with automatic recording create proxies that have the same name and timecode as the original files, making it possible to switch from one to the other.
​
In this guide, we’ll explain what proxies are, how and when to use them, and how to switch from proxies created by C2C Connections back to the original files in various editing tools. 

# What are Proxies?The term &quot;proxy&quot; can often have several different uses and meanings. Generally speaking, proxies are files that are used in place of camera original files. A file that can act on the original&#x27;s behalf — hence, &quot;proxy&quot;. These are files that are, in some capacity, friendlier for the current workflow stage. They may be smaller, lower resolution, or in a different codec that&#x27;s more suited to the current tool or computer system.

 

In the context of Camera to Cloud, however, we&#x27;ll want to attach a specific definition to &quot;proxy&quot; in order to avoid confusion. Let&#x27;s explore that below.

 

## Defining a Proxy FileFor the purposes of Camera to Cloud, and in our documentation here, proxies can be considered files used for editing. These are similar in use to dailies transcodes made by an assistant editor or dailies lab. Proxies from C2C Connections are designed to be used in offline/online workflows. This means that editors are meant to cut with the proxies all the way until the project is ready to color correct or export. When cutting with proxies, the project is &quot;offline&quot;. Once the project is ready to finalize, then you can switch to the originals. When the project has switched to the originals, it is &quot;online&quot;.

 

Proxies can come in many different forms, but they all have several things in common. They will have codecs that are easier to upload and edit with. They often will have some color correction applied if the camera is shooting in log (although, this is certainly not always the case). They may have embedded audio — although this is often &quot;scratch&quot; (ie, unmixed) audio. Most importantly, however, they will have the same clipname and timecode as the original file, which is necessary for switching to the originals later on.

 

Similar to transcodes used in a dailies process, proxies from C2C Connections may not be exactly the same as the camera originals. While their clipnames and timecode will be the same, they will often be different resolutions and different codecs than the originals. Additionally, any proxies made by a C2C Connection that is an **external device** may have different start and end timecode values to the camera original files. This is normal! 

**External devices** are recorders that record a video signal from the camera in order to make proxies. They are independent from the camera and require a flag (known as a record trigger) from the camera to know when to start and stop recording. There is a small delay that is introduced between when the camera starts recording and when the external device actually receives this flag (this is physics!). The timecode values of every frame will match, but the proxies will start and end a few frames later than the camera files. This may affect the way some editing tools are able to switch between proxies and originals, but we&#x27;ll cover that in detail below. 

Alternatively, some C2C Connections can upload proxies made **internally** — that is, proxies made by the same device that makes the original files. For example, some cameras that support C2C directly can create and upload their own proxies instead of relying on an external device. Proxies made internally will not have start and end timecode mismatches with the originals since they are being made at the same time by the same device. 

**A note about using Atomos recorders**Atomos recorders are C2C enabled **external** devices. However, they can behave both as an **external** device and an **internal** device depending on the workflow being used. 

Like other C2C enabled external devices, some Atomos recorders support automatic recording to create proxies externally. You can find a list of Atomos devices that support automatic recording [here](https://help.frame.io/en/articles/6593893-c2c-camera-compatibility-for-atomos-recorders). 

However, Atomos devices can also be used as primary recorders. They&#x27;re able to record high-quality video files in addition to proxies. This workflow is often used on cameras that can&#x27;t record the filetypes supported by the Atomos devices (like ProRes, ProRes RAW, and DNxHD).

 

These high-resolution video files are meant to be used instead of any files made by the camera, and then the camera files are either not recorded or are discarded. In these use cases, the proxies made by the Atomos are considered **internal** proxies because they are made by the same device as the originals (which, again, would be the high-resolution files also made by the Atomos). 

## Why use Proxies?So, why go through all the hassle? Doesn&#x27;t this introduce extra steps in your workflow? For some workflows, yes, it might add some additional steps. But many workflows already rely on proxy files and this would instead be an adaptation.

 

Even if, for some workflows, proxy files add what might look like additional complication, there are quite a few benefits. Proxy files created by C2C Connections are smaller than the original files and this enables them to upload faster, allowing you to upload files on networks with slower connections — meaning you or your team can get to work sooner. They&#x27;re also recorded in codecs that are more universally compatible, making them extremely versatile for all sorts of steps in the workflow.

 

Finally, proxies from external devices allow you to upload clips from cameras that otherwise have no ability to upload to the cloud. By creating web-friendly proxy files in real-time, you can bridge the gap between cameras from yesterday and the workflows of today.

 

## Relinking vs ConformingOne of the main advantages of uploading proxies to Frame.io is that you can make editable files available to your post-production team near instantly. These light-weight files allow your team to start working while you&#x27;re still shooting. In many cases, that means that you will eventually have to switch your timeline from the proxy files to your original files.

 

When you&#x27;re ready to finalize your project, your workflow may require you to use the original files to color correct and render from. Switching from the light-weight proxy files to original files usually happens in one of two ways, depending on the tool you are using or your post-production workflow: relinking or conforming.

 

### Relinking*Relinking* is a fairly general term, but it usually means telling your editing software where to find your files after you&#x27;ve started using them. It&#x27;s called &quot;re-linking&quot; because it is primarily used when your media storage location gets moved or goes offline. 

However, when we&#x27;re using proxies, an editing tool&#x27;s relink function can be used to instead tell it to look at the camera original files. Doing this is usually as simple as selecting the proxies from your bin or timeline that you want to replace, then using the editor&#x27;s built-in relink tool to locate the camera original files on your storage. Because the proxies (as we defined above) have the same name and timecode, your editor will consider them to be the same clips and seamlessly switch from the proxies to the original.

 

Every editing tool&#x27;s relink function works a little differently, and may even have a different name. Each individual editing tool may also have a different process for internal proxies (those created by the same device as the originals, such as a camera or when using an [Atomos device](#h_7059370ead) as your main recorder) and for proxies created by an external device. 

We&#x27;ll cover the relinking process for several different tools in the sections later in this article. Use the shortcuts below to jump the tool you are using in your workflow:

[Adobe Premiere Pro]()[Final Cut Pro]()[DaVinci Resolve](#h_5733b73b1d)[AVID Media Composer](#h_93886d8e93)
### Conforming*Conforming* is a lot like relinking in concept but is very different in practice and is usually part of the *[online](https://blog.frame.io/2021/03/01/frameio-c2c-dailies-workflows/)*[ process](https://blog.frame.io/2021/03/01/frameio-c2c-dailies-workflows/). Conforming is typically used in workflows that use separate editing and finishing tools. Just like relinking, it allows you to switch from the proxy files to the camera original files. However, where relinking tells your editing tool to use different files in the same timeline, the conforming process rebuilds your timeline with the camera original files from scratch. 

To rebuild your timeline, you usually create a file that describes your edits. This is typically an EDL or XML file created in your editing tool. EDLs and XMLs are essentially lists that outline specifically what portion of a clip is used (described by the clip&#x27;s timecode), exactly where in the timeline it&#x27;s placed (described by the timeline&#x27;s timecode), and in exactly what order. In order to successfully conform from EDL or XML lists, the files you edited with (referred to as your *offline* files) need to have the same name and timecode as the camera original files. 

The EDL or XML file lets you then take your timeline — described in a list of clips and their timecodes — to a different piece of software, often a finishing tool such as a color-corrector. Because your internal or external proxies will have the same clipname and timecode as your originals, the XML or EDL will act like a blueprint for finishing tool to be able to accurately rebuild the timeline with camera original files.

 

# Adobe Premiere ProAdobe Premiere Pro has tools that enable you to leverage powerful proxy workflows. You can easily relink back to the original files after you’ve started editing, but you can also create a workflow where you can switch between the proxies and the original files on the fly for better performance on your machine.
​## RelinkingRelinking is the simplest way to move from the C2C proxies to your original files. Let’s step through that process below.

You can begin organizing, logging, and cutting with the C2C proxies.

When you’re ready to relink to your original media, select all the proxy files in your bin you want to relink to the originals. Right click and select “Make Offline”. Make sure you select “Media files remain on disk” and click “OK”.

Selecting the same clips in the bin, right click and select “Link Media”. We’ll need to double check some settings in the Link Media window.

In the Link Media window, under Match File Properties, make sure “File Name” is checked. If you are using proxies from an external device, make sure &quot;Media Start&quot; is **unchecked**. If you&#x27;re using internal proxies (such as from a camera or from an Atomos), make sure “Media Start” is **checked**. The others should be unchecked.Then, to the right in the Link Media window, make sure “Align Timecode”, “Relink others automatically”, and “Use Media Browser to locate files” are all **checked**. Click “Locate”.In the media browser, Premiere Pro will ask you to find the file that matches the one in the Last Path box. Navigate to your high resolution originals and find the corresponding file. Click “OK”.

Premiere Pro will relink all the originals it can find in the current folder. If your originals are across multiple folders, you may have to repeat the process until you locate each set of originals.

Your clips are now relinked to the originals and you can continue your work. If you want to learn more about the Adobe Premiere Pro relinking tool, check out [this article](https://helpx.adobe.com/premiere-pro/using/relinking-media.html?x-product=CCHome%2F1.0&amp;x-product-location=Search%3AForums%3Alink%2F3.2.3&amp;mv2=cch). 

If you want the ability to switch between using the proxy files and the originals on the fly (perhaps to help manage performance), you can use Premiere Pro’s proxy workflow. We’ve outlined that workflow below.
​## Using a Proxy WorkflowPremiere Pro’s proxy workflow allows you to connect both proxy media and original media to the same clip. With both proxies and originals connected, you can switch between them on the fly to better leverage performance in your project and on your computer.

*Note**: This function only works with internal proxies (such as from a camera or an Atomos device).*Here’s how you set that up.

You can begin organizing, logging, and cutting with the C2C proxies.

When you’re ready to connect your original media, select all the proxy files in your bin you want to connect to original media. Right click and select Proxy &gt; Reconnect High Resolution Files. We’ll need to double check some settings in the Reconnect Full Resolution Media window.

In the Reconnect Full Resolution Media window, under Match File Properties, make sure “File Name” and “Media Start” are checked. The others should be unchecked.

Then, to the right in the Reconnect Full Resolution Media window, make sure “Relink others automatically” and “Use Media Browser to locate files” are all checked. Click “Attach”.

In the media browser, Premiere Pro will ask you to find the first file in the list of the Reconnect Full Resolution Media window. If you aren’t sure which file it’s asking you to find, it will tell you in the header of the Reconnect Full Resolution Media window (at the very top). Navigate to your originals and select the corresponding file. Click “OK”.

Premiere Pro will connect all the originals it can find in the current folder to the proxies. If your originals are across multiple folders, you may have to repeat the process until you locate each set of originals.

Your clips are now connected to both the proxies and the original media. You can switch between viewing the proxies and the originals in the Viewer by using the resolution command.

 

If you want to learn more about using the proxy tool in Adobe Premiere Pro, check out [this article](https://helpx.adobe.com/premiere-pro/using/ingest-proxy-workflow.html).
​## ScalingIf you are linking lower resolution proxies (ie, 1920x1080) to higher resolution originals (ie, 3840x2160), it is recommended to create a timeline with the resolution of the originals. When you place a proxy in the timeline, you may notice it is smaller than the frame. You can right click on the clip in the timeline and select Set to Frame Size.

 

However, if you have edited in a sequence that matches the resolution of the proxies, you may have to either rescale the clips or change the resolution of the sequence once they’ve been relinked. If your clips look cropped or “blown up” after relinking, you’ll need to rescale.
​
To rescale the clips, follow the guide below. This will automatically scale your newly linked originals to the frame size of the sequence.Select the clips you want to scale in the sequence.

Go to Clip &gt; Video Options &gt; Scale to Frame Size.

If instead you want to change the resolution of the sequence (say, from HD to UHD), follow the guide below.

Select the sequence you want to modify in the bin.

Right click and select Sequence Settings.

In the Sequence Settings window, under Video, change the Frame Size Horizontal and Vertical fields to match your originals.

# Final Cut ProFinal Cut Pro combines relinking and proxy workflows into the same concept. When you import clips into Final Cut Pro, it assumes that these clips are originals. We can relink these back to our original files, but then we can also separately re-connect the proxies if we want to use a proxy workflow. We’ll cover both of these below.
​## RelinkingThe first thing we’ll do is just simply relink from our proxies to the original media. Remember, Final Cut Pro assumes that whatever media is imported first is an original.

You can begin organizing, logging, and cutting with the C2C proxies.

When you’re ready to connect your original media, select all the proxy files in your Event you want to connect back to original media. Go to File &gt; Relink Files &gt; Original Media.

You can either select specific clips to relink or click on “Locate All” to relink all clips.

Use Finder to locate your originals. You can select a folder that contains your originals or an individual clip that matches your proxies.

Final Cut Pro will relink all the originals it can find in the current folder to the proxies. If your originals are across multiple folders, you may have to repeat the process until you locate each set of originals. Click “Choose”.

Final Cut Pro will also tell you which clips it was able to relink. Check for errors and click “Relink Files” when ready.

*Note**: Final Cut Pro requires that files have matching audio configurations in order to relink successfully.*Your clips are now relinked to the original files. If you want the ability to switch between using the proxy files and the originals on the fly, you can use Final Cut Pro’s proxy workflow. We’ve outlined that workflow below.
​## Using a Proxy WorkflowWe can also leverage Final Cut Pro’s proxy workflow to connect both the proxy and the original to the same clip. To get started, make sure you’ve already done the [Final Cut Pro Relinking](#h_d10a5b667f) process above.After you’ve relinked your clips to the original media, we can re-attach the proxies. Select all the clips you want to attach proxies to in your Event then go to File &gt; Relink Files &gt; Proxy Media.

You can either select specific clips to relink or click on “Locate All” to relink all clips.

Use Finder to locate your proxies. You can select a folder that contains your proxies or an individual clip that matches your originals.

Final Cut Pro will connect all the proxies it can find in the current folder to the originals. If your proxies are across multiple folders, you may have to repeat the process until you locate each set of proxies. Click “Choose”.

Final Cut Pro will also tell you which clips it was able to connect. Check for errors and click “Relink Files” when ready.

Your clips are now connected to both the proxies and the original media. You can switch between viewing the proxies and the originals in the Viewer by going to View and selecting “Proxy Preferred” or “Proxy Only”.

 

 

## ScalingIf you are linking lower resolution proxies (ie, 1920x1080) to higher resolution originals (ie, 3840x2160), it is recommended to create a Project with the resolution of the originals.

 

If you have started editing in a Project that matches the resolution of the proxies, you may have to either rescale the clips or change the resolution of the Project once they’ve been relinked. If your clips look cropped or “blown up” after relinking, you’ll need to rescale.
​
To rescale the clips, follow the guide below. This will automatically scale your newly linked originals to the frame size of the Project.Select the clips you want to scale in the Project.

Open the Inspector by clicking on the icon along the top bar or by pressing CMD + 4.

In the Inspector, expand Spatial Conform by double clicking on it.

Use the dropdown menu under Type to select “Fit”. If “Fit” is already selected, you may need to select it again for Final Cut Pro to apply the scale to the clips.

If instead you want to change the resolution of the Project (say, from HD to UHD), follow the guide below.

Select the Project you want to modify in the Event.

Open the Inspector by clicking on the icon along the top bar or by pressing CMD + 4.

In the Inspector window, select Modify.

In the Project Settings window, use the Video dropdown to select your format (ie, 4K).

Next, under the Resolution dropdown, choose the resolution that matches your originals (ie, 3840x2160).

# DaVinci ResolveIn this section, we’ll discuss proxy workflows in DaVinci Resolve as an NLE. If you’re looking for conform information, see the [Conform section](#h_cc73f1ac94) below.
​
DaVinci Resolve also allows for easy relinking as well as proxy workflows. Similar to Final Cut Pro, you can relink to the original media, then re-attach the proxies if you want to use a proxy workflow. These workflows are available in both DaVinci Resolve and DaVinci Resolve Studio.
​## RelinkingThe first thing we’ll do in Resolve is relink the proxy files back to the high-resolution originals. This can be done either from the Media Pool page or from the Media Pool panel in the Edit page.

*Note**: Relinking (and the proxy workflow) in Resolve only works for internal proxies (such as from a camera or an Atomos device). See the section on [Reconform From Bins](#h_b3ebe78181) below if you are using proxies from an external device.*You can begin organizing, logging, and cutting with the C2C proxies.

When you’re ready to connect your original media, select all the proxy files in the Media Pool you want to connect back to original media. Right click and select “Relink Selected Clips”.

Use Finder to locate your originals. Select the folder that contains the originals that match your proxies. Click “Open”.

Resolve will relink all the originals it can find in the current folder to the proxies. If your originals are across multiple folders, you may have to repeat the process until you locate each set of originals.

Your clips are now relinked to the originals and you can continue your work. If you want the ability to switch between using the proxy files and the originals on the fly (perhaps to help manage performance), you can use Resolve’s proxy workflow. We&#x27;ve outlined that workflow below.
​## Using a Proxy WorkflowOnce the proxies are relinked back to the high-resolution originals, you can then re-attach your proxies to the relinked clips to use a proxy workflow if desired. To get started, make sure you perform the relinking process outlined in the previous section. Like relinking, this can be done from the Media Pool page or the Media Pool panel in the Edit page.

After you’ve relinked your clips to the original media, we can re-attach the proxies. Select all the clips you want to attach proxies to in the Media Pool then right click and select “Link Proxy Media”.

Use Finder to locate your proxies. Select the folder that contains the proxies that match your originals. Click “Open”.

Resolve will attach all the proxies it can find in the current folder to the originals. If your proxies are across multiple folders, you may have to repeat the process until you locate each set of proxies.

Your clips are now connected to both the proxies and the original media. You can switch between viewing the proxies and the originals in the Viewer by going to Playback &gt; Use Proxy Media if Available.

 

## Reconform from BinsIf you&#x27;re editing in DaVinci Resolve and have C2C proxies from an external device, you&#x27;ll need to use Resolve&#x27;s **Reconform from Bins** method to switch from your proxies to your originals. We cover the concept of [Conform](#h_6b6c57f989) in more detail below, but conforming differs slightly from relinking in that you&#x27;re *reassembling* the timeline with new media rather than simply changing the filepath of your existing media. Resolve will see your proxy media and your original media as two distinct, unrelated sets of clips. 

This can affect your editing process in a couple of ways. First, any logging data applied to the proxies in Resolve will not translate over to the original media after the conform. Second, conforming to your original will inherit any audio configuration and resolution from your originals. For these reasons, **it is recommended that any conform (including this Reconform from Bins method) is done only once the edit is locked**, but before final audio mix, color-correction, or effects are applied. 

Resolve&#x27;s Reconform from Bins method allows you to essentially perform an internal, automatic conform, offering a streamlined way to switch from proxies created by an external C2C device to your originals. We&#x27;ve outlined that workflow below.

After you&#x27;ve locked your edit on your proxy timeline, make sure you import all your original media into the Media Pool. It is recommended that you organize your original media in a bin that&#x27;s separated from your proxies.

In order to protect your work, it&#x27;s a good idea to duplicate your timeline and perform the Reconform from Bins on the new timeline.

Before you&#x27;re able to perform a Reconform from Bins, you&#x27;ll need to make sure **Conform Lock** is disabled on each clip in the timeline — this is enabled by default. Select all the clips in your timeline, right-click, and select **Reconform from Bins Enabled**.Your timeline is now ready to be reconformed. I can do this by right-clicking on the timeline in the Media Pool and selecting **Timelines&gt; Reconform from Bins**. This will open a Conform from Bins window.In the Choose Conform Bins pane, make sure any bins that have the proxy media are *not* selected. In most cases, all you will need to select are the bins with your original media. However, you may also need to select your audio or graphics files if any.Under Conform Options, make sure to select **Timecode &gt; Source Timecode**. Next, you will need to select **Reel Name Using** and the appropriate method. For most workflows, you can use **Source file name**.Once selected, hit **OK**. The clips in your timeline will now be replaced with the originals.
Any un-conformed media will be labeled in the timeline and you can resolve on a clip-by-clip basis. If you&#x27;re having trouble getting Resolve to conform your clips, you can try adjusting your settings in the Conform Options pane of the **Conform from Bins** window. 

Some cameras, like RED, may create originals that have different a clipname values and filenames. In these instances, the camera will send the clipname value to the external device and the original might have some extra information in the filename. For RED cameras, you may want to select **Embedded source clip metadata** when choosing your **Reel Name Using** options in the Conform Options pane of the Conform from Bins window. Additionally, you may need to also adjust **Conform Options** in your **Project Settings**. For example, when using RED cameras, you may have to enable **Limit reel name matching to** and set it to the number of characters that overlap (leaving out the segment index — ie, `_001`).
AVID Media ComposerAVID Media Composer is designed to maintain strong organization through its powerful database. As such, it needs media in one of its own native codecs — DNxHD or DNxHR. For any C2C proxy workflows, it is recommended that both the C2C proxies and the originals are both processed from their original codecs to a DNxHD or DNxHR flavor that matches the rest of your workflow. This can be done in a dailies tool, in a transcoding tool like Adobe Media Encoder, or in Media Composer natively.

 

Additionally, relinking in Media Composer only works with internal proxies (such as from a camera or an Atomos device). If you have proxies from an external C2C device, you will need to do a [conform](#h_6b6c57f989) in a finishing tool to switch to the originals.
​
For internal proxies, Media Composer allows easy relinking between the proxy transcodes and the originals transcodes. In fact, it’s the same relinking process you would use for any other media within Media Composer.
​
Before beginning the process in this guide, make sure you transcode the C2C proxies and originals into an AVID codec. Both the proxies and the originals should be transcoded into the same codec. For this example, we’ll be using DNxHD 36.Import your transcoded C2C proxies into your bin in the method that matches the rest of your AVID workflow. You can begin organizing, logging, and cutting with the C2C proxies.

When you’re ready to relink your original media, place the transcoded originals into a valid “Avid MediaFiles” numbered folder — it’s recommended that you make a new numbered folder for the new media. Be sure not to go back into AVID Media Composer until this media is fully copied into the folder. If it’s helpful, you can quit Media Composer while the files are copied, then reopen it when the copy is complete.

Before going back into Media Composer, remove the transcoded proxy media from its “Avid MediaFiles” numbered folder. (If you don’t know where it lives, you can right click on the clip in the AVID bin and select **Reveal File**.) This can go anywhere, just as long as it’s not in any “Avid MediaFiles” numbered folder. This will make sure Media Composer can no longer see it. It does not have to be deleted.Go back into or re-open AVID Media Composer and your project. AVID Media Composer will scan the new numbered folder.

Once Media Composer has finished scanning, select all the clips in the bin you want to relink back to the transcoded original media. Right click and select **Relink**.In the Relink window, make sure you select the settings that make sense for your configuration. It is recommended that you specify which drive the “Avid MediaFiles” numbered folder with the transcoded originals is under **Media on drive**. Next, it is also recommended to uncheck **Relink only to media from the current project**.When your relink settings are configured, click **OK**.Once the clips are relinked, it is recommended to “seal” the “Avid MediaFiles” numbered folder containing the transcoded originals. Leaving Media Composer running, navigate to the numbered folder in Finder or Windows Explorer. Rename the folder to something that either fits into your organizational structure or clearly labels what it contains.

You can now work with AVID files transcoded from the high-resolution originals. The relink process will make sure none of the work you’ve already done with the C2C proxies will be lost and your transition should be seamless. Once your edit is complete, you can conform back to the native (untranscoded) originals during the online process.

 

# ConformThe process of conforming is very similar to relinking, in that it allows you to move from proxies to originals, but is slightly different in some important ways. In relinking, you&#x27;re essentially telling your editing software to look for the same files elsewhere — effectively changing the filepath of your media. Conforming, on the other hand, is the process of completely rebuilding the timeline itself. This is typical for projects that are already using an offline/online workflow, but may be new for some projects.

 

&quot;Offline&quot; refers to the part of the workflow that uses the proxy files — which themselves are often called offline files. Once your edit is locked and you&#x27;re ready to finalize your project, you move to the &quot;online&quot; phase, where you are working with your originals. The online phase is usually where effects, color correction, and the audio mix happen, and is often done in a dedicated tool like DaVinci Resolve, Autodesk Flame, or Assimilate Scratch. Conform is the link that transitions your project from the offline phase to the online phase.

 

Since the timeline is being rebuilt rather than replacing the clips directly in the existing timeline, your conform tool just needs to know name of the clips being used, which sections of those clips are being used (shown in timecode), and where in the timeline they appear. This provides an environment that has looser restrictions than relinking workflows, making conforming equally effective for workflows with either external C2C devices or internal proxies. This information is stored in a &quot;list&quot; file that is exported from your editor and then imported into your conform tool.

 

These list files are usually either formatted as an EDL or XML. EDLs are older and much simpler, typically only carrying the clip names and timecodes, but are much more universally compatible. Any effects, including geometry, are not recorded in an EDL. XMLs, on the other hand, may have more basic effects included, like geometry, and will likewise exclude any complex effects, but are less universally compatible than EDLs. Regardless of which format of list file you use, it is recommended that any complex effects, color correction, or audio mixing are left until the online phase of your workflow.

 

You can export your list of choice (EDL, XML, etc) from your editing tool. Once you have your list, you can then import that into your conform or finishing tool of choice. Each tool works a little differently, but you&#x27;ll need to make sure you organize your original media and your proxy media separately both on disk and in your bins. Proxies made by C2C devices that support automatic recording — both external devices and internal integrations — will have clipnames and timecode that match the originals and should conform accurately.

 

There are several resources available to learn how to conform in your chosen tool. A good place to start would be the [Frame.io blog](https://blog.frame.io/?s=conform).Related ArticlesC2C: Camera to Cloud Camera Compatibility GuideC2C: TroubleshootingC2C: Frame.io Camera to Cloud FAQsC2C: Filmic Pro QuickStart GuideC2C: Getting Started with Camera to Cloud

---
*This article was automatically converted from the Frame.io Help Center.*
