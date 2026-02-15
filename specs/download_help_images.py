#!/usr/bin/env python3
"""
Frame.io Help Documentation Image Downloader
Downloads all images from help.frame.io articles
"""

import os
import urllib.request
import ssl
import re
from pathlib import Path

# Create directories
BASE = Path("/home/jean-marc/src/bush/specs/images")
HELP_DIR = BASE / "help_docs"
HELP_DIR.mkdir(parents=True, exist_ok=True)

# SSL context
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

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
        print(f"  ✗ Failed: {str(e)[:50]}")
        return False

# Comprehensive list of images from help documentation
HELP_IMAGES = [
    # Watermarking
    "https://downloads.intercomcdn.com/i/o/1201665158/352aef8d85447585aa1299cc/Screenshot+2024-10-02+at+12_29_28%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1326351714/dcefcc0d3f20063257f9ef6d12de/Screenshot+2025-01-08+at+11_27_42%E2%80%AFAM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1991508711/8e3f95cf9aee26c8aa738676b87a/Screenshot+2026-01-26+at+1_27_01%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1991508476/1eda8c34bf6b0556f087de638645/Screenshot+2026-01-26+at+1_27_13%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1326340572/298f6f87c03725d06ad50e004080/Screenshot+2025-01-08+at+11_20_52%E2%80%AFAM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1326357228/70135639c563e0c87d95a4603de0/Screenshot+2025-01-08+at+11_30_44%E2%80%AFAM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1203374404/7f302d26f9c3aa0a7223941485c7/Screenshot-2B2024-10-02-2Bat-2B5_13_05-E2-80-AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1379446779/292ddde23b17b45ca4427272a46e/Screenshot+2025-02-13+at+2_07_15%E2%80%AFPM.png",
    
    # User permissions
    "https://downloads.intercomcdn.com/i/o/1193380307/c422ca4a6161c4750e7ac019/Screenshot+2024-09-25+at+5_38_33%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1644009692/c4781fa9f95470e886de8a404d5e/ws_NEW.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1644113716/f2898b70e2462296cc9d0df9cfd8/pp_NEW.png",
    "https://downloads.intercomcdn.com/i/o/1193381097/27c867597bc76155248be57a/Screenshot+2024-09-25+at+5_37_30%E2%80%AFPM.png",
    
    # Asset lifecycle
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1642485272/935f08cbd9e6fa886e9525ba381d/Screenshot+2025-07-28+at+4_23_15%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1642507963/3712b21794c57f3563a9cd9522f9/Screenshot+2025-07-28+at+4_40_44%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1642527152/4e2505f90e5462a5d9f90d5f16d6/Screenshot+2025-07-28+at+4_57_11%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1642532802/8da5ae006ed7581ba44efbe5b6d8/Screenshot+2025-07-28+at+5_02_11%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1642530484/473f0eb587b93bec83659ab0729c/Screenshot+2025-07-28+at+5_00_17%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1642545905/0402f2b806880665c2cf9a40600c/Screenshot+2025-07-28+at+5_12_27%E2%80%AFPM.png",
    
    # Transcription
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1445083249/90ca81235ad9c97db34d1d515bbe/efcc6419-7b63-417b-a500-1d4e79571a80",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1690347949/4a26760cbf95422e32e3d037e1ec/Screenshot+2025-08-25+at+4_13_35%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1454763221/6a8cef0200e77fe6e36d1233fd40/Screenshot+2025-04-02+at+11_02_31%E2%80%AFAM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1557783160/161c7d3064b078ddc1e682e8475b/Screenshot+2025-06-05+at+11_48_47%E2%80%AFAM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1454774421/0e2d1e5d05743a8f91bf5f4fd0ea/Screenshot+2025-04-02+at+11_03_08%E2%80%AFAM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1454772046/47335977b573fff3f5990a64bb2d/Screenshot+2025-04-02+at+11_04_46%E2%80%AFAM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1667257219/10dc8ea4f2259ade6a7edaa17906/Screenshot+2025-08-12+at+3_08_00%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1667264348/2863a0174484e633a6e9953009c3/Screenshot+2025-08-12+at+3_01_49%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1667266786/306db56246c72faad9f0c7e6d1ee/Screenshot+2025-08-12+at+2_59_21%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1667282306/483b490dc18442d309cd62e55ef7/Screenshot+2025-08-12+at+3_28_28%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1667273166/4cadfd89a9ac78108862b9da2f02/Screenshot+2025-08-12+at+3_20_28%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1667273060/1e693837d53872f268bd22036e6c/Screenshot+2025-08-12+at+3_20_20%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1577748024/75f963f170b73fc376bd18a2aff0/Screenshot%2B2025-06-18%2Bat%2B5_36_23-E2-80-AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1577731984/7c8b5e2dd454901bfabc5719b241/Screenshot+2025-06-18+at+5_24_43%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1577718833/0367efaee2571f05636cf254404d/Screenshot+2025-06-18+at+5_13_52%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1557771442/741acc77081829144553db9bad71/Screenshot+2025-06-05+at+12_54_41%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1514790244/a8df1acab81fa7bd1c41639cb6e8/Screenshot+2025-05-08+at+1_55_35%E2%80%AFPM.png",
    
    # Metadata
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1661139421/36aeb4ac6cb408b92695824a5bae/V4_FileManagement_OrganizeAssets_L.gif",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1590327414/2bf4f323e72eef92f2c2fbcabba1/Screenshot+2025-06-26+at+4_05_15%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/998466245/c138544bb224a6ceb6368958/f1e76e8a-aeb3-4fce-a4f7-8be055ef0c7a",
    "https://downloads.intercomcdn.com/i/o/998466879/12c42da3aa4b7f22a0acf408/1a44f527-b997-4135-9dcd-709fbde860f5",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1661196551/3146d28f5dda527e8731f21d5711/Screenshot+2025-08-08+at+2_47_55%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1661170058/892ac779358dce9af2db4ab585a3/Screenshot+2025-08-08+at+2_32_37%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1661191917/e9ad809c23403c662b76a2c363cd/Screenshot+2025-08-08+at+2_45_46%E2%80%AFPM.png",
    
    # Shares
    "https://downloads.intercomcdn.com/i/o/999523012/a3e7446e9403daadee748d9e/69b93039-ccf5-4c0c-a0fc-3bbe77c59341",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1879459910/77f0cf3aa2070b67a4045c7b2658/Screenshot+2025-12-11+at+1_22_12%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1391038552/fbc0c10823ce2cc0646221e4ae7f/Screenshot+2025-02-20+at+3_37_16%E2%80%AFPM.png",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1828955028/2df2e5743ac97be83cf5c85596ab/1.jpg",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1828956710/f585dfbc701cb8ac6be5924bcf5d/2.jpg",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1828955983/d10f96e13476699a65381d7a28a1/7.jpg",
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1828959242/cad9d648d9da32294493e8291c5d/3.jpg",
    "https://downloads.intercomcdn.com/i/o/1201561876/e2be814c7992ce24cfd93bf7/Screenshot+2024-10-02+at+11_20_03%E2%80%AFAM.png",
    "https://downloads.intercomcdn.com/i/o/1174128120/c3ac110d7f019b7c0a484e4b/image-2024-4-2_17-7-2.png",
    
    # Comments and annotation
    "https://downloads.intercomcdn.com/i/o/1191895496/d173a3771d44d530bcdf6bac/Screenshot+2024-09-24+at+7_24_07PM.png",
    "https://downloads.intercomcdn.com/i/o/1191895950/6d8b2a5eeef6af67c85059d4/Screenshot+2024-09-24+at+7_24_45PM.png",
    "https://downloads.intercomcdn.com/i/o/1175522418/b85f698c4266e4b81e6c90cd/Screenshot+2024-09-10+at+2_22_17PM.png",
]

def main():
    total = len(HELP_IMAGES)
    success = 0
    
    print("=" * 60)
    print("Frame.io Help Documentation Image Downloader")
    print("=" * 60)
    print(f"\nDownloading {total} images...")
    
    for i, url in enumerate(HELP_IMAGES):
        # Generate filename
        name = url.split("/")[-1]
        name = name.split("?")[0]
        # Clean up URL encoding
        name = name.replace("%2B", "+").replace("%2F", "/").replace("%20", " ")
        # Truncate long names
        if len(name) > 80:
            name = name[:80]
        # Add extension if missing
        if not any(name.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".gif", ".webp"]):
            name += ".png"
        
        filename = f"{i:03d}_{name}"
        output_path = HELP_DIR / filename
        
        if download(url, output_path):
            success += 1
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total attempted: {total}")
    print(f"Successfully downloaded: {success}")
    print(f"Failed: {total - success}")
    print(f"\nOutput directory: {HELP_DIR}")
    print(f"Files: {len(list(HELP_DIR.glob('*')))} images")

if __name__ == "__main__":
    main()
