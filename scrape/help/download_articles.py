#!/usr/bin/env python3
"""
Frame.io Help Article Downloader - Fetches all articles and saves as local MD files
"""

import os
import re
import time
import urllib.request
import ssl
from pathlib import Path
from html.parser import HTMLParser

# Create directories
BASE = Path("/home/jean-marc/src/bush/specs/help")
for subdir in ["getting-started", "upload-organize", "collaboration-playback", "integrations", 
               "account-settings", "c2c", "enterprise", "security"]:
    (BASE / subdir).mkdir(parents=True, exist_ok=True)

# SSL context
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}

class ArticleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_article = False
        self.in_title = False
        self.in_content = False
        self.title = ""
        self.content = []
        self.current_tag = None
        self.current_attrs = {}
        
    def handle_starttag(self, tag, attrs):
        self.current_tag = tag
        self.current_attrs = dict(attrs)
        
        if tag == "h1":
            self.in_title = True
        elif tag == "article":
            self.in_article = True
        elif tag == "div" and 'article_body' in dict(attrs).get('class', ''):
            self.in_content = True
            
    def handle_endtag(self, tag):
        if tag == "h1":
            self.in_title = False
        elif tag == "article":
            self.in_article = False
        elif tag == "div":
            self.in_content = False
        self.current_tag = None
        
    def handle_data(self, data):
        if self.in_title and not self.title:
            self.title = data.strip()
        if self.in_content:
            self.content.append(data)

def fetch_article(url):
    """Fetch article content from URL"""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            return resp.read().decode('utf-8')
    except Exception as e:
        print(f"  ✗ Fetch failed: {e}")
        return None

def extract_content(html):
    """Extract title and content from HTML"""
    # Extract title
    title_match = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
    title = title_match.group(1) if title_match else "Untitled"
    
    # Extract article body
    body_match = re.search(r'<div[^>]*class="[^"]*article_body[^"]*"[^>]*>(.*?)</div>\s*</div>\s*</article>', 
                          html, re.DOTALL)
    
    if body_match:
        body = body_match.group(1)
    else:
        # Try alternative pattern
        body_match = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
        body = body_match.group(1) if body_match else ""
    
    return title, body

def html_to_markdown(html):
    """Convert HTML content to Markdown"""
    # Remove scripts and styles
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    
    # Convert headers
    html = re.sub(r'<h1[^>]*>([^<]+)</h1>', r'# \1', html)
    html = re.sub(r'<h2[^>]*>([^<]+)</h2>', r'## \1', html)
    html = re.sub(r'<h3[^>]*>([^<]+)</h3>', r'### \1', html)
    html = re.sub(r'<h4[^>]*>([^<]+)</h4>', r'#### \1', html)
    
    # Convert paragraphs
    html = re.sub(r'<p[^>]*>([^<]*)</p>', r'\1\n\n', html)
    
    # Convert links
    html = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>([^<]*)</a>', r'[\2](\1)', html)
    
    # Convert bold and italic
    html = re.sub(r'<strong[^>]*>([^<]*)</strong>', r'**\1**', html)
    html = re.sub(r'<b[^>]*>([^<]*)</b>', r'**\1**', html)
    html = re.sub(r'<em[^>]*>([^<]*)</em>', r'*\1*', html)
    html = re.sub(r'<i[^>]*>([^<]*)</i>', r'*\1*', html)
    
    # Convert lists
    html = re.sub(r'<li[^>]*>([^<]*)</li>', r'- \1\n', html)
    html = re.sub(r'<ul[^>]*>', '', html)
    html = re.sub(r'</ul>', '\n', html)
    html = re.sub(r'<ol[^>]*>', '', html)
    html = re.sub(r'</ol>', '\n', html)
    
    # Convert code
    html = re.sub(r'<code[^>]*>([^<]*)</code>', r'`\1`', html)
    html = re.sub(r'<pre[^>]*>([^<]*)</pre>', r'```\n\1\n```', html)
    
    # Convert line breaks
    html = re.sub(r'<br\s*/?>', '\n', html)
    
    # Remove remaining tags
    html = re.sub(r'<[^>]+>', '', html)
    
    # Clean up whitespace
    html = re.sub(r'\n{3,}', '\n\n', html)
    html = re.sub(r' {2,}', ' ', html)
    
    return html.strip()

def save_article(url, filepath, category):
    """Fetch and save article as markdown"""
    if filepath.exists():
        print(f"  ⊙ Exists: {filepath.name}")
        return True
    
    html = fetch_article(url)
    if not html:
        return False
    
    title, body = extract_content(html)
    content = html_to_markdown(body)
    
    # Create frontmatter
    md = f"""# {title}

> Source: {url}
> Category: {category}

---

{content}

---
*This article was automatically converted from the Frame.io Help Center.*
"""
    
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(md)
        print(f"  ✓ Saved: {filepath.name}")
        return True
    except Exception as e:
        print(f"  ✗ Save failed: {e}")
        return False

# All help articles organized by category
ARTICLES = {
    "getting-started": [
        ("9090632-welcome-to-frame-io", "Welcome to Frame.io!"),
        ("9090642-getting-started-what-is-a-user", "What is a User?"),
        ("9090684-getting-started-how-do-i-leave-comments", "How do I leave comments?"),
        ("9092142-getting-started-how-to-share-with-others", "How do I share with others?"),
        ("9092149-getting-started-how-do-i-use-metadata", "How do I use metadata?"),
        ("9090654-getting-started-how-do-i-upload-media", "How do I upload media?"),
        ("10150181-getting-started-what-are-the-pricing-plans-you-offer", "Pricing Plans"),
        ("11534393-what-to-expect-when-updating-to-v4-a-comprehensive-guide-for-updating-your-account-on-a-free-pro-or-team-plan", "Updating to V4 (Free/Pro/Team)"),
        ("9084073-frame-io-v4-legacy-feature-comparison", "V4 vs Legacy Feature Comparison"),
    ],
    "upload-organize": [
        ("9101001-workspace-overview", "Workspace Overview"),
        ("9101006-project-settings", "Project Settings"),
        ("9917377-managing-active-and-inactive-projects", "Managing Active and Inactive Projects"),
        ("9101044-creating-folders-and-restricted-folders", "Creating Folders and Restricted Folders"),
        ("9101026-uploading-your-media", "Uploading Your Media"),
        ("9101042-collections-overview", "Collections Overview"),
        ("9101037-metadata-overview", "Metadata Overview"),
        ("9092149-getting-started-how-do-i-use-metadata", "How do I use metadata?"),
        ("9101079-enhanced-search-with-media-intelligence", "Enhanced Search"),
        ("9101068-version-stacking", "Version Stacking"),
        ("13116383-requesting-and-granting-project-access", "Requesting and Granting Project Access"),
        ("9101065-moving-media-within-your-account", "Moving Media"),
        ("9101060-copying-media-within-your-account", "Copying Media"),
        ("10513996-recovering-recently-deleted-assets", "Recovering Deleted Assets"),
        ("9436564-supported-file-types-on-frame-io", "Supported File Types"),
        ("9101084-how-can-i-download-files", "How Can I Download Files?"),
        ("9101011-switching-between-accounts-on-the-project-page", "Switching Between Accounts"),
        ("9101032-panel-overview", "Panel Overview"),
        ("4305435-hdr-overview", "HDR Overview"),
    ],
    "collaboration-playback": [
        ("9875389-user-roles-and-permissions", "User Roles and Permissions"),
        ("9105219-adding-and-removing-users-to-a-workspace", "Adding Users to Workspace"),
        ("9105225-adding-and-removing-users-in-a-project", "Adding Users to Project"),
        ("9105232-shares-in-frame-io", "Shares in Frame.io"),
        ("9105242-share-links-explained-for-clients", "Share Links Explained for Clients"),
        ("13181549-share-notifications", "Share Notifications"),
        ("9105251-commenting-on-your-media", "Commenting on Your Media"),
        ("9105278-comments-panel-overview", "Comments Panel Overview"),
        ("9105290-how-to-copy-and-paste-comments", "Copy and Paste Comments"),
        ("9105287-adding-attachments-to-your-comments", "Adding Attachments to Comments"),
        ("9105309-comment-printing-and-comment-exporting", "Comment Printing and Exporting"),
        ("9105311-player-page-features", "Player Page Features"),
        ("9952618-comparison-viewer", "Comparison Viewer"),
        ("10966531-frame-io-transcription-overview", "Transcription Overview"),
        ("10926922-highlighting-documents-with-text-markups", "Text Markups"),
        ("9105330-multipage-pdf-viewer", "Multipage PDF Viewer"),
        ("9105322-image-viewer-on-the-player-page", "Image Viewer"),
        ("12893213-html-review-for-frame-io", "HTML Review"),
        ("10535490-move-smoothly-in-the-viewer-with-asset-navigation", "Asset Navigation"),
        ("9090526-microsoft-office-support-for-frame-io", "Microsoft Office Support"),
        ("9105337-keyboard-shortcuts", "Keyboard Shortcuts"),
        ("9105374-in-app-notifications", "In-App Notifications"),
    ],
    "integrations": [
        ("12833113-adobe-premiere-frame-io-v4-panel-overview-25-6-and-later", "Adobe Premiere V4 Panel (25.6+)"),
        ("9859849-adobe-premiere-frame-io-v4-comments-panel-overview", "Adobe Premiere Comments Panel"),
        ("9739851-connect-frame-io-to-adobe-lightroom", "Connect to Adobe Lightroom"),
        ("12242607-adobe-workfront-integration-overview", "Adobe Workfront Integration"),
        ("3978929-frame-io-transfer-download-and-upload-files-folders-and-projects-on-your-desktop", "Transfer App Overview"),
        ("5063743-upload-and-download-in-frame-io-transfer", "Transfer Upload/Download"),
        ("5063744-log-file-and-edl-support-in-frame-io-transfer", "EDL Support in Transfer"),
        ("1224711-how-to-download-the-ios-app-for-iphone-and-ipad", "Download iOS App"),
        ("9105533-getting-started-in-the-ios-app", "Getting Started iOS"),
        ("9105536-commenting-and-the-player-page-on-the-ios-app", "Commenting on iOS"),
        ("9105544-uploading-files-on-the-ios-app", "Uploading on iOS"),
        ("9105562-image-viewer-on-ios", "Image Viewer iOS"),
        ("9105565-sharing-assets-on-the-ios-app", "Sharing on iOS"),
        ("9105575-download-assets-from-the-ios-app", "Download from iOS"),
        ("9105633-moving-copying-assets-and-folders-on-the-ios-app", "Move/Copy on iOS"),
        ("9971623-restricted-projects-on-the-ios-app", "Restricted Projects iOS"),
        ("9958716-inactive-projects-on-the-ios-app", "Inactive Projects iOS"),
        ("9958555-push-notifications-on-the-ios-app", "Push Notifications iOS"),
        ("56992-android-app", "Android App?"),
        ("1779288-using-the-frame-io-mac-app", "Using Mac App"),
        ("16871-installing-and-uninstalling-the-frame-io-mac-app", "Install/Uninstall Mac App"),
        ("1772691-creating-watch-folders-with-the-frame-io-mac-app", "Watch Folders"),
        ("1772720-changing-the-frame-io-project-your-connected-watch-folder", "Change Watch Folder Project"),
        ("1772708-disconnecting-a-watch-folder", "Disconnect Watch Folder"),
        ("6084818-watch-frame-io-with-the-apple-tv-app", "Apple TV App"),
        ("6125946-authenticating-the-frame-io-apple-tv-app", "Apple TV Authentication"),
        ("4128691-import-comments-into-resolve-with-edl", "Import Comments to Resolve"),
        ("11870181-build-workflows-with-zapier", "Zapier Integration"),
    ],
    "account-settings": [
        ("9105488-where-to-find-account-settings", "Where to Find Account Settings"),
        ("9105503-how-do-i-change-my-password", "Change Password"),
        ("9105500-how-do-i-change-my-email", "Change Email"),
        ("9105514-notification-settings", "Notification Settings"),
        ("9105496-adding-storage-to-my-account", "Adding Storage"),
        ("10606574-branding-settings", "Branding Settings"),
        ("9105511-updating-your-billing-information", "Updating Billing"),
        ("9105518-view-and-download-invoices-payment-receipts", "View Invoices"),
        ("2673548-plan-limits-in-frame-io", "Plan Limits"),
        ("9105512-switching-between-accounts", "Switching Accounts"),
        ("9105522-how-do-i-cancel-my-subscription", "Cancel Subscription"),
    ],
    "c2c": [
        ("8896457-c2c-getting-started-with-camera-to-cloud", "Getting Started with C2C"),
        ("8571967-c2c-complete-internet-connection-guide", "Internet Connection Guide"),
        ("5091124-camera-to-cloud-training-series", "C2C Training Series"),
        ("4886030-c2c-camera-to-cloud-camera-compatibility-guide", "Camera Compatibility"),
        ("4886926-c2c-troubleshooting", "C2C Troubleshooting"),
        ("4887091-c2c-frame-io-camera-to-cloud-faqs", "C2C FAQs"),
        ("6079079-c2c-complete-proxy-workflow-guide", "Proxy Workflow Guide"),
        ("6593039-c2c-camera-compatibility-for-teradek-encoders", "Teradek Compatibility"),
        ("6593893-c2c-camera-compatibility-for-atomos-recorders", "Atomos Compatibility"),
        # QuickStart Guides
        ("6424924-c2c-atomos-connect-quickstart-guide", "Atomos CONNECT QuickStart"),
        ("6128763-c2c-teradek-serv-and-prism-quickstart-guide", "Teradek Serv/Prism QuickStart"),
        ("7156603-c2c-fujifilm-quickstart-guide", "Fujifilm QuickStart"),
        ("9179663-c2c-panasonic-lumix-quickstart-guide", "Panasonic LUMIX QuickStart"),
        ("10070093-c2c-canon-quickstart-guide", "Canon QuickStart"),
        ("6766294-c2c-red-v-raptor-and-komodo-quickstart-guide", "RED QuickStart"),
        ("10273793-c2c-nikon-quickstart-guide", "Nikon QuickStart"),
        ("13162126-c2c-leica-quickstart-guide", "Leica QuickStart"),
        ("10826792-c2c-mavis-camera-quickstart-guide", "Mavis Camera QuickStart"),
        ("6128936-c2c-filmic-pro-quickstart-guide", "Filmic Pro QuickStart"),
        ("9482425-c2c-ambient-lockit-real-time-logging-quickstart-guide", "Ambient Lockit QuickStart"),
        ("8279122-c2c-accsoon-quickstart-guide", "Accsoon QuickStart"),
        ("5530228-c2c-teradek-cube-quickstart-guide", "Teradek Cube QuickStart"),
        ("6136709-c2c-pomfort-livegrade-quickstart-guide", "Pomfort LiveGrade QuickStart"),
        ("6133587-c2c-viviana-cloud-box-quickstart-guide", "Viviana Cloud Box QuickStart"),
        ("6029980-c2c-sound-devices-8-series-quickstart-guide", "Sound Devices QuickStart"),
        ("6037561-c2c-magic-viewfinder-quickstart-guide", "Magic ViewFinder QuickStart"),
        ("6037494-c2c-zoelog-quickstart-guide", "ZoeLog QuickStart"),
        ("6137039-c2c-filmdatabox-quickstart-guide", "FilmDataBox QuickStart"),
        ("6030058-c2c-aaton-cantar-quickstart-guide", "Aaton Cantar QuickStart"),
    ],
    "enterprise": [
        ("9918010-enterprise-v4-starter-quick-links", "Enterprise V4 Starter Links"),
        ("9893008-what-to-expect-when-updating-to-v4-a-comprehensive-guide-for-enterprise-customers", "Updating to V4 (Enterprise)"),
        ("10604901-e-learning-for-enterprise-customers", "E-Learning for Enterprise"),
        ("10552820-understanding-the-migration-to-adobe-managed-frame-subscriptions-and-users", "Migration to Adobe Managed"),
        ("9888212-frame-io-user-and-role-management-via-adobe-admin-console", "Adobe Admin Console"),
        ("11758018-connecting-to-adobe-authentication", "Adobe Authentication"),
        ("9949507-manage-your-multiple-workspaces", "Manage Multiple Workspaces"),
        ("12832120-track-your-share-links-with-frame-io-inbox-beta", "Frame.io Inbox (Beta)"),
        ("10966551-create-and-manage-access-groups", "Access Groups"),
        ("13706126-syncing-user-groups-from-the-admin-console", "Sync User Groups"),
        ("9859752-content-security", "Content Security"),
        ("9948588-watermarking-in-v4", "Watermarking in V4"),
        ("12091837-forensic-watermarking", "Forensic Watermarking"),
        ("9949543-secure-sharing", "Secure Sharing"),
        ("12091832-digital-rights-management-drm", "Digital Rights Management"),
        ("11869776-asset-lifecycle-management", "Asset Lifecycle Management"),
        ("1052839-single-sign-on-sso", "Single Sign-On"),
        ("4766300-mandatory-account-two-factor-authentication-2fa", "Mandatory 2FA"),
        ("4766302-set-up-two-factor-authentication-2fa", "Set Up 2FA"),
        ("9179936-storage-connect-for-frame-io", "Storage Connect"),
        ("12356206-storage-connect-for-frame-io-registering-assets", "Storage Connect Registering"),
        ("11025260-frame-io-cloud-storage", "Cloud Storage"),
    ],
    "security": [
        ("6046971-frame-io-system-requirements", "System Requirements"),
        ("9092154-frame-io-support", "Frame.io Support"),
    ],
}

def main():
    total = sum(len(articles) for articles in ARTICLES.values())
    success = 0
    failed = []
    
    print("=" * 70)
    print("Frame.io Help Article Downloader")
    print("=" * 70)
    print(f"\nTotal articles to process: {total}")
    print()
    
    for category, articles in ARTICLES.items():
        print(f"\n📁 {category.upper()} ({len(articles)} articles)")
        print("-" * 50)
        
        for slug, title in articles:
            url = f"https://help.frame.io/en/articles/{slug}"
            # Create safe filename
            safe_title = re.sub(r'[^\w\s-]', '', title)
            safe_title = re.sub(r'[-\s]+', '-', safe_title).lower()[:60]
            filename = f"{slug.split('-')[0]}_{safe_title}.md"
            filepath = BASE / category / filename
            
            if save_article(url, filepath, category):
                success += 1
            else:
                failed.append((url, title))
            
            time.sleep(0.2)  # Rate limiting
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total: {total}")
    print(f"Success: {success}")
    print(f"Failed: {len(failed)}")
    
    if failed:
        print("\nFailed articles:")
        for url, title in failed:
            print(f"  - {title}: {url}")
    
    print(f"\nOutput directory: {BASE}")

if __name__ == "__main__":
    main()
