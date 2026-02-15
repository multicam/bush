#!/usr/bin/env python3
"""
Frame.io UI Screenshot Downloader
Downloads UI screenshots from Frame.io website, help docs, and developer docs.
"""

import os
import re
import json
import requests
from urllib.parse import urljoin, urlparse
from pathlib import Path

# Base directories
BASE_DIR = Path("/home/jean-marc/src/bush/specs/images")
MAIN_DIR = BASE_DIR / "main"
HELP_DIR = BASE_DIR / "help"
ENTERPRISE_DIR = BASE_DIR / "enterprise"
FEATURES_DIR = BASE_DIR / "features"

# Create directories
for d in [MAIN_DIR, HELP_DIR, ENTERPRISE_DIR, FEATURES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Headers to mimic browser
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

# Image extensions to look for
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'}

def sanitize_filename(url):
    """Create safe filename from URL."""
    parsed = urlparse(url)
    path = parsed.path
    # Get the filename part
    filename = os.path.basename(path)
    # Remove query parameters
    filename = filename.split('?')[0]
    # Replace unsafe characters
    filename = re.sub(r'[^\w\-.]', '_', filename)
    return filename or 'image'

def download_image(url, output_path):
    """Download an image from URL."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        if response.status_code == 200:
            with open(output_path, 'wb') as f:
                f.write(response.content)
            print(f"  ✓ Downloaded: {output_path.name}")
            return True
        else:
            print(f"  ✗ Failed ({response.status_code}): {url}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def extract_image_urls(html_content, base_url):
    """Extract all image URLs from HTML content."""
    urls = set()
    
    # Match img src attributes
    img_pattern = r'<img[^>]+src=["\']([^"\']+)["\']'
    for match in re.finditer(img_pattern, html_content, re.IGNORECASE):
        url = match.group(1)
        if url.startswith('//'):
            url = 'https:' + url
        elif url.startswith('/'):
            url = urljoin(base_url, url)
        elif not url.startswith('http'):
            url = urljoin(base_url, url)
        urls.add(url)
    
    # Match srcset attributes
    srcset_pattern = r'srcset=["\']([^"\']+)["\']'
    for match in re.finditer(srcset_pattern, html_content, re.IGNORECASE):
        srcset = match.group(1)
        for part in srcset.split(','):
            url = part.strip().split()[0]
            if url.startswith('//'):
                url = 'https:' + url
            elif url.startswith('/'):
                url = urljoin(base_url, url)
            elif not url.startswith('http'):
                url = urljoin(base_url, url)
            urls.add(url)
    
    # Match background-image URLs in style attributes
    bg_pattern = r'url\(["\']?([^)"\']+)["\']?\)'
    for match in re.finditer(bg_pattern, html_content, re.IGNORECASE):
        url = match.group(1)
        if url.startswith('//'):
            url = 'https:' + url
        elif url.startswith('/'):
            url = urljoin(base_url, url)
        elif not url.startswith('http'):
            url = urljoin(base_url, url)
        urls.add(url)
    
    # Match CDN Sanity image URLs (common in Frame.io)
    sanity_pattern = r'https://cdn\.sanity\.io/images/[^"\'>\s]+'
    for match in re.finditer(sanity_pattern, html_content):
        urls.add(match.group(0))
    
    # Match downloads.intercomcdn.com URLs
    intercom_pattern = r'https://downloads\.intercomcdn\.com/[^"\'>\s]+'
    for match in re.finditer(intercom_pattern, html_content):
        urls.add(match.group(0))
    
    # Match files.buildwithfern.com URLs
    fern_pattern = r'https://files\.buildwithfern\.com/[^"\'>\s]+'
    for match in re.finditer(fern_pattern, html_content):
        urls.add(match.group(0))
    
    return urls

def is_image_url(url):
    """Check if URL points to an image."""
    parsed = urlparse(url)
    path = parsed.path.lower()
    return any(path.endswith(ext) for ext in IMAGE_EXTENSIONS) or \
           'image' in path or \
           'cdn.sanity.io' in url or \
           'intercomcdn' in url

def process_page(url, output_dir, page_name):
    """Process a single page and download its images."""
    print(f"\n📄 Processing: {page_name}")
    print(f"   URL: {url}")
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=60)
        if response.status_code != 200:
            print(f"   ✗ Failed to fetch page ({response.status_code})")
            return []
        
        html_content = response.text
        
        # Extract all image URLs
        image_urls = extract_image_urls(html_content, url)
        
        # Filter to only image URLs
        image_urls = {u for u in image_urls if is_image_url(u)}
        
        print(f"   Found {len(image_urls)} images")
        
        downloaded = []
        for img_url in sorted(image_urls):
            filename = sanitize_filename(img_url)
            # Add hash to avoid collisions
            url_hash = abs(hash(img_url)) % 10000
            name, ext = os.path.splitext(filename)
            if not ext or ext not in IMAGE_EXTENSIONS:
                ext = '.png'  # Default extension
            filename = f"{name}_{url_hash}{ext}"
            output_path = output_dir / filename
            
            if download_image(img_url, output_path):
                downloaded.append({
                    'url': img_url,
                    'filename': filename,
                    'page': page_name
                })
        
        return downloaded
        
    except Exception as e:
        print(f"   ✗ Error processing page: {e}")
        return []

def main():
    """Main function to download all screenshots."""
    print("=" * 60)
    print("Frame.io UI Screenshot Downloader")
    print("=" * 60)
    
    all_downloaded = []
    
    # ===== MAIN WEBSITE PAGES =====
    main_pages = [
        ("https://frame.io/", "home"),
        ("https://frame.io/pricing", "pricing"),
        ("https://frame.io/features/workflow-management", "features-workflow"),
        ("https://frame.io/features/file-management", "features-file-management"),
        ("https://frame.io/features/review-and-approval", "features-review"),
        ("https://frame.io/features/present", "features-present"),
        ("https://frame.io/features/c2c", "features-c2c"),
        ("https://frame.io/features/ios-ipad", "features-ios"),
        ("https://frame.io/transfer", "transfer"),
        ("https://frame.io/enterprise", "enterprise"),
        ("https://frame.io/enterprise/media-and-entertainment", "enterprise-me"),
        ("https://frame.io/enterprise/brands", "enterprise-brands"),
        ("https://frame.io/enterprise/agencies", "enterprise-agencies"),
        ("https://frame.io/enterprise/video-workflows", "enterprise-video"),
        ("https://frame.io/enterprise/photo-workflows", "enterprise-photo"),
        ("https://frame.io/centralized-platform", "centralized-platform"),
        ("https://frame.io/content-supply-chain", "content-supply-chain"),
        ("https://frame.io/integrations", "integrations"),
        ("https://frame.io/resources", "resources"),
        ("https://frame.io/whats-new", "whats-new"),
    ]
    
    print("\n" + "=" * 60)
    print("SECTION 1: Main Website")
    print("=" * 60)
    
    for url, name in main_pages:
        downloaded = process_page(url, MAIN_DIR, name)
        all_downloaded.extend(downloaded)
    
    # ===== HELP DOCUMENTATION PAGES =====
    help_pages = [
        ("https://help.frame.io/en/", "help-home"),
        ("https://help.frame.io/en/articles/9101001-workspace-overview", "workspace-overview"),
        ("https://help.frame.io/en/articles/9101042-collections-overview", "collections-overview"),
        ("https://help.frame.io/en/articles/9101037-metadata-overview", "metadata-overview"),
        ("https://help.frame.io/en/articles/9105251-commenting-on-your-media", "commenting"),
        ("https://help.frame.io/en/articles/9105232-shares-in-frame-io", "shares"),
        ("https://help.frame.io/en/articles/9105311-player-page-features", "player-features"),
        ("https://help.frame.io/en/articles/9952618-comparison-viewer", "comparison-viewer"),
        ("https://help.frame.io/en/articles/9875389-user-roles-and-permissions", "user-roles"),
        ("https://help.frame.io/en/articles/9948588-watermarking-in-v4", "watermarking"),
        ("https://help.frame.io/en/articles/9101079-enhanced-search-with-media-intelligence", "enhanced-search"),
    ]
    
    print("\n" + "=" * 60)
    print("SECTION 2: Help Documentation")
    print("=" * 60)
    
    for url, name in help_pages:
        downloaded = process_page(url, HELP_DIR, name)
        all_downloaded.extend(downloaded)
    
    # ===== ENTERPRISE PAGES =====
    enterprise_pages = [
        ("https://frame.io/enterprise", "enterprise-main"),
        ("https://frame.io/enterprise/media-and-entertainment", "enterprise-me"),
        ("https://frame.io/enterprise/brands", "enterprise-brands"),
        ("https://frame.io/enterprise/agencies", "enterprise-agencies"),
    ]
    
    print("\n" + "=" * 60)
    print("SECTION 3: Enterprise Pages")
    print("=" * 60)
    
    for url, name in enterprise_pages:
        downloaded = process_page(url, ENTERPRISE_DIR, name)
        all_downloaded.extend(downloaded)
    
    # ===== FEATURES PAGES =====
    features_pages = [
        ("https://frame.io/features/workflow-management", "workflow"),
        ("https://frame.io/features/file-management", "file-management"),
        ("https://frame.io/features/review-and-approval", "review-approval"),
        ("https://frame.io/features/present", "present"),
        ("https://frame.io/features/c2c", "c2c"),
        ("https://frame.io/features/ios-ipad", "ios-ipad"),
    ]
    
    print("\n" + "=" * 60)
    print("SECTION 4: Features Pages")
    print("=" * 60)
    
    for url, name in features_pages:
        downloaded = process_page(url, FEATURES_DIR, name)
        all_downloaded.extend(downloaded)
    
    # ===== SUMMARY =====
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total images downloaded: {len(all_downloaded)}")
    print(f"\nImages by directory:")
    for subdir in ['main', 'help', 'enterprise', 'features']:
        dir_path = BASE_DIR / subdir
        count = len(list(dir_path.glob('*'))) if dir_path.exists() else 0
        print(f"  {subdir}/: {count} images")
    
    # Save manifest
    manifest_path = BASE_DIR / "manifest.json"
    with open(manifest_path, 'w') as f:
        json.dump(all_downloaded, f, indent=2)
    print(f"\nManifest saved to: {manifest_path}")

if __name__ == "__main__":
    main()
