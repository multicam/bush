#!/usr/bin/env python3
"""
Frame.io Screenshot Downloader - Simple version using urllib
"""

import os
import urllib.request
import ssl
from pathlib import Path

# Create directories
BASE = Path("/home/jean-marc/src/bush/specs/images")
for subdir in ["main", "help", "features"]:
    (BASE / subdir).mkdir(parents=True, exist_ok=True)

# SSL context
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# User agent
HEADERS = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}

def download(url, path):
    """Download URL to path"""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            data = resp.read()
        with open(path, 'wb') as f:
            f.write(data)
        print(f"  ✓ {Path(path).name}")
        return True
    except Exception as e:
        print(f"  ✗ {url[:50]}...: {e}")
        return False

# Images to download
IMAGES = {
    "main": [
        # Homepage hero
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/35a9863ebfda8e9c5bd9dc696b213ee703d99697-3840x2160.jpg",
        # Platform screenshots
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/09047391b603288d084c4d88f3254476df80f4ad-5600x2400.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/b6c5d5168ab8cda14357525cf3eb0974ca4be554-3840x2161.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/0ddbda5917afb98fcd0e050dc16d59dd1f32c5fc-1280x2369.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/51fbc66c2cb5413619404ff13038d7c60c75e5a4-7509x3957.png",
        # Security
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/29e73c0b95f1b741111f392a1873d422cd81760a-2001x1384.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/2f21b75e27c2799449a30ea061e90182053e6758-2001x1384.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/d8e48ca33dda52d256b552ceac37c15be6700163-2281x1200.png",
        # C2C
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/00bd8d500d59567f9406bfda7631b761cdf22f20-2801x1200.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/07cb6bc9abfbd098336a56bc8d8f4d73e7d59ab7-4561x2400.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/c212efabef49fa4e62ec0f2e2963fdbd90d9a7d1-2801x1200.png",
        # Workflow cards
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/36d11ff293608f88b5224a50f80c25db768f370a-390x500.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/7c771fbba0c494be5706c341fa8c64f8b3fbcd64-2x500.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/0f8956cbcb6b1884336786bb240a9b59a340c915-391x500.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/3121d6999a46b21e34d055d2d1eca0522b136846-391x420.png",
        # Review
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/ac5aec40019ec5c29549d2d729b61f1485c07289-4560x2400.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/51abd47a95174619391883d1af92fe660f931197-2500x1729.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/f8461f2e3d40c16822d486ee40f881981d3de267-2281x1200.png",
        # Integrations
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/b703031f472b88507bca6295fcf673b1e08fd3b2-1008x696.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/cccbfe5451d737060df0cf7709485e8eb443a3c9-1008x696.png",
    ],
    "help": [
        # Metadata
        "https://downloads.intercomcdn.com/i/o/998466245/c138544bb224a6ceb6368958/f1e76e8a-aeb3-4fce-a4f7-8be055ef0c7a",
        "https://downloads.intercomcdn.com/i/o/998466879/12c42da3aa4b7f22a0acf408/1a44f527-b997-4135-9dcd-709fbde860f5",
        "https://downloads.intercomcdn.com/i/o/998468018/cb2d22ae7ef12bb041824030/6c37036c-1226-4267-8a1a-6cb500d46c26",
        # Comments
        "https://downloads.intercomcdn.com/i/o/999527449/3cd2a1c6a3dd3c931fab32f8/60e3aff4-9866-42d6-84b2-bda80bb2e97d",
        "https://downloads.intercomcdn.com/i/o/999528020/f659675cb5740465e321f6c6/f024d9e5-121f-42aa-ae27-8e3a09d171ed",
        "https://downloads.intercomcdn.com/i/o/999528772/2452f29fad1c3fdd9ee73c77/6e646efd-ba02-49a1-825d-927835673541",
        # Anchored comments
        "https://downloads.intercomcdn.com/i/o/1191895496/d173a3771d44d530bcdf6bac/Screenshot+2024-09-24+at+7_24_07PM.png",
        "https://downloads.intercomcdn.com/i/o/1191895950/6d8b2a5eeef6af67c85059d4/Screenshot+2024-09-24+at+7_24_45PM.png",
        "https://downloads.intercomcdn.com/i/o/1175522418/b85f698c4266e4b81e6c90cd/Screenshot+2024-09-10+at+2_22_17PM.png",
        # Shares
        "https://downloads.intercomcdn.com/i/o/999523012/a3e7446e9403daadee748d9e/69b93039-ccf5-4c0c-a0fc-3bbe77c59341",
        "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1828955028/2df2e5743ac97be83cf5c85596ab/1.jpg",
        "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1828956710/f585dfbc701cb8ac6be5924bcf5d/2.jpg",
        "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1828955983/d10f96e13476699a65381d7a28a1/7.jpg",
        "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1828959242/cad9d648d9da32294493e8291c5d/3.jpg",
        # More help
        "https://downloads.intercomcdn.com/i/o/999529547/af8923c6fd514eb96234953a/c5d45503-490a-47b4-bc23-b54f905f2f1b",
        "https://downloads.intercomcdn.com/i/o/999529306/04f557596d32f6fd5ce3e89d/e974a018-9381-4685-a99f-403f3b195230",
    ],
    "features": [
        # What's new
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/6e28c89b7cf3d1e629ed87e15228af9979cf6a1b-1920x1275.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/71c12b560def38c0dffaf79824f93a6799a92f3f-1920x1275.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/1871aedc4af015a122141725e23afd8e98c9ca57-1920x1275.jpg",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/501c7e02f80302da138cd3983e474d7605d7b319-1920x1275.jpg",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/c4accc1a8c19902ffe58543548a2d6ae4a77a5e2-1920x1275.jpg",
        # Resources
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/31f7b80692771bb18ac9a083979dbb8820f1d323-5760x3840.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/344f6c251d419e8ddb413861658b5180fd77f46e-2880x2880.png",
        # C2C
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/a2c90814534dc31fdc81dbefd314654acd62f521-4720x1280.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/b5720a3dc939732d6db898cb8bace9591dc1289b-2880x2160.jpg",
        # Customer stories
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/aa387d9c706777b8eddf2aac8e1cee1034454ce8-1424x966.png",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/d392a1273e7ab249b3bf72ee1a5aaf03fed9e764-3840x2160.jpg",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/79ff0bfd13d269172f4b5592608d6be24aa6c08b-3840x2160.jpg",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/265544c0518f0e10aea129983ae1d3b59be0f9c4-1600x1200.jpg",
        "https://cdn.sanity.io/images/s6lu43cv/production-v4/dc9c6067ac39d4bf21f7490c85eb41b884d0b91b-4096x2311.png",
    ],
}

def main():
    total = 0
    success = 0
    
    print("=" * 60)
    print("Frame.io Screenshot Downloader")
    print("=" * 60)
    
    for category, urls in IMAGES.items():
        print(f"\n📁 {category.upper()} ({len(urls)} images)")
        print("-" * 40)
        
        output_dir = BASE / category
        i = 0
        
        for url in urls:
            total += 1
            # Generate filename
            name = url.split("/")[-1]
            name = name.split("?")[0]  # Remove query params
            if len(name) > 60:
                name = name[:60]
            if not any(name.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".gif", ".webp"]):
                name += ".png"
            filename = f"{i:03d}_{name}"
            output_path = output_dir / filename
            
            if download(url, output_path):
                success += 1
            i += 1
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total attempted: {total}")
    print(f"Successfully downloaded: {success}")
    print(f"Failed: {total - success}")
    print(f"\nDirectory: {BASE}")
    
    for subdir in ["main", "help", "features"]:
        count = len(list((BASE / subdir).glob("*")))
        print(f"  {subdir}/: {count} files")

if __name__ == "__main__":
    main()
