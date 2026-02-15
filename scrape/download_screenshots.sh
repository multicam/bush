#!/bin/bash
#
# Frame.io UI Screenshot Downloader
# Downloads UI screenshots from Frame.io CDN URLs
#

set -e

# Directories
BASE_DIR="/home/jean-marc/src/bush/specs/images"
MAIN_DIR="$BASE_DIR/main"
HELP_DIR="$BASE_DIR/help"
FEATURES_DIR="$BASE_DIR/features"

# Create directories
mkdir -p "$MAIN_DIR" "$HELP_DIR" "$FEATURES_DIR"

# User agent
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Download function
download() {
    local url="$1"
    local output="$2"
    
    # Skip if already exists
    if [ -f "$output" ]; then
        echo "  ⊙ Exists: $(basename "$output")"
        return 0
    fi
    
    # Try curl first
    if curl -sS -L --max-time 30 -A "$UA" -o "$output" "$url" 2>/dev/null; then
        # Check if file is valid (not empty, not HTML error)
        if [ -s "$output" ] && ! grep -q "<!DOCTYPE html>" "$output" 2>/dev/null; then
            echo "  ✓ Downloaded: $(basename "$output")"
            return 0
        fi
    fi
    
    # Try wget as fallback
    if command -v wget &>/dev/null; then
        if wget -q --timeout=30 -U "$UA" -O "$output" "$url" 2>/dev/null; then
            if [ -s "$output" ] && ! grep -q "<!DOCTYPE html>" "$output" 2>/dev/null; then
                echo "  ✓ Downloaded (wget): $(basename "$output")"
                return 0
            fi
        fi
    fi
    
    # Failed
    rm -f "$output" 2>/dev/null
    echo "  ✗ Failed: $(basename "$output")"
    return 1
}

# Counter
TOTAL=0
SUCCESS=0

echo "=============================================================="
echo "Frame.io UI Screenshot Downloader"
echo "=============================================================="

# ============================================================
# SECTION 1: Main Website Images (Sanity CDN)
# ============================================================
echo ""
echo "SECTION 1: Main Website Images"
echo "--------------------------------------------------------------"

# These are actual image URLs extracted from frame.io
MAIN_IMAGES=(
    # Homepage and general
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/35a9863ebfda8e9c5bd9dc696b213ee703d99697-3840x2160.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/09047391b603288d084c4d88f3254476df80f4ad-5600x2400.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/b6c5d5168ab8cda14357525cf3eb0974ca4be554-3840x2161.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/0ddbda5917afb98fcd0e050dc16d59dd1f32c5fc-1280x2369.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/51fbc66c2cb5413619404ff13038d7c60c75e5a4-7509x3957.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/29e73c0b95f1b741111f392a1873d422cd81760a-2001x1384.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/d8e48ca33dda52d256b552ceac37c15be6700163-2281x1200.png"
    
    # Workflow and features
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/36d11ff293608f88b5224a50f80c25db768f370a-390x500.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/7c771fbba0c494be5706c341fa8c64f8b3fbcd64-2x500.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/0f8956cbcb6b1884336786bb240a9b59a340c915-391x500.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/3121d6999a46b21e34d055d2d1eca0522b136846-391x420.png"
    
    # Review and playback
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/ac5aec40019ec5c29549d2d729b61f1485c07289-4560x2400.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/51abd47a95174619391883d1af92fe660f931197-2500x1729.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/f8461f2e3d40c16822d486ee40f881981d3de267-2281x1200.png"
    
    # C2C and integrations
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/00bd8d500d59567f9406bfda7631b761cdf22f20-2801x1200.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/07cb6bc9abfbd098336a56bc8d8f4d73e7d59ab7-4561x2400.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/c212efabef49fa4e62ec0f2e2963fdbd90d9a7d1-2801x1200.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/b703031f472b88507bca6295fcf673b1e08fd3b2-1008x696.png"
    
    # Sharing
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/a00b38847f1b954a075f5dc87594384ae26ad07a-4272x2400.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/cccbfe5451d737060df0cf7709485e8eb443a3c9-1008x696.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/93e3e09a466cd9faf23424a0ab8dbafbaa743ce1-4096x1896.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/efa8da8a50778f92ad63eb3c6e495f02a1d2be05-5601x2400.png"
    
    # Security
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/2f21b75e27c2799449a30ea061e90182053e6758-2001x1384.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/937442e2ca6be1a913ba0798cce39a729abf762d-2281x1200.png"
    
    # Enterprise
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/2ba5e4d97cabf27e4cc25b4247fd237ebdf32e88-4942x5497.png"
    "https://cdn.sanity.io/images/s6lu34cv/production-v4/40cf364ae7e73f3aae2c89aedbefc6693c674a7f-7680x4320.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/f30e535288ce6f5e421e40cb2716588872b20e66-3840x2160.png"
    
    # Resources
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/d6dd9c1d81c648d77200108b9326bd9ca6a5073f-2880x1921.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/344f6c251d419e8ddb413861658b5180fd77f46e-2880x2880.png"
    
    # Case studies
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/aa387d9c706777b8eddf2aac8e1cee1034454ce8-1424x966.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/d392a1273e7ab249b3bf72ee1a5aaf03fed9e764-3840x2160.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/79ff0bfd13d269172f4b5592608d6be24aa6c08b-3840x2160.jpg"
)

i=0
for url in "${MAIN_IMAGES[@]}"; do
    ((TOTAL++))
    # Extract extension and create filename
    ext="${url##*.}"
    ext=$(echo "$ext" | cut -d'?' -f1)
    filename="$(printf '%03d' $i)_${url##*/production-v4/}"
    filename=$(echo "$filename" | cut -c1-80)
    filename="${filename%.png}.${ext}"
    filename=$(echo "$filename" | sed 's/?.*//')
    
    if download "$url" "$MAIN_DIR/$filename"; then
        ((SUCCESS++))
    fi
    ((i++))
done

# ============================================================
# SECTION 2: Help Documentation Images (Intercom CDN)
# ============================================================
echo ""
echo "SECTION 2: Help Documentation Images"
echo "--------------------------------------------------------------"

HELP_IMAGES=(
    # Collections and metadata
    "https://downloads.intercomcdn.com/i/o/998468018/cb2d22ae7ef12bb041824030/6c37036c-1226-4267-8a1a-6cb500d46c26"
    "https://downloads.intercomcdn.com/i/o/998466245/c138544bb224a6ceb6368958/f1e76e8a-aeb3-4fce-a4f7-8be055ef0c7a"
    "https://downloads.intercomcdn.com/i/o/998466879/12c42da3aa4b7f22a0acf408/1a44f527-b997-4135-9dcd-709fbde860f5"
    "https://downloads.intercomcdn.com/i/o/998558480/b1ce0479db1caa7fee0dde79/91ea5d1c-73a9-48ba-a9cd-49243a1b9a99"
    
    # Comments
    "https://downloads.intercomcdn.com/i/o/999527449/3cd2a1c6a3dd3c931fab32f8/60e3aff4-9866-42d6-84b2-bda80bb2e97d"
    "https://downloads.intercomcdn.com/i/o/999528020/f659675cb5740465e321f6c6/f024d9e5-121f-42aa-ae27-8e3a09d171ed"
    "https://downloads.intercomcdn.com/i/o/999528772/2452f29fad1c3fdd9ee73c77/6e646efd-ba02-49a1-825d-927835673541"
    "https://downloads.intercomcdn.com/i/o/1191895496/d173a3771d44d530bcdf6bac/Screenshot+2024-09-24+at+7_24_07PM.png"
    "https://downloads.intercomcdn.com/i/o/1191895950/6d8b2a5eeef6af67c85059d4/Screenshot+2024-09-24+at+7_24_45PM.png"
    "https://downloads.intercomcdn.com/i/o/1175522418/b85f698c4266e4b81e6c90cd/Screenshot+2024-09-10+at+2_22_17PM.png"
    
    # Sharing
    "https://downloads.intercomcdn.com/i/o/999523012/a3e7446e9403daadee748d9e/69b93039-ccf5-4c0c-a0fc-3bbe77c59341"
    "https://downloads.intercomcdn.com/i/o/1201561876/e2be814c7992ce24cfd93bf7/Screenshot+2024-10-02+at+11_20_03AM.png"
    
    # Metadata
    "https://downloads.intercomcdn.com/i/o/998468018/cb2d22ae7ef12bb041824030/6c37036c-1226-4267-8a1a-6cb500d46c26"
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1661139421/36aeb4ac6cb408b92695824a5bae/V4_FileManagement_OrganizeAssets_L.gif"
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1590327414/2bf4f323e72eef92f2c2fbcabba1/Screenshot+2025-06-26+at+4_05_15PM.png"
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1661170058/892ac779358dce9af2db4ab585a3/Screenshot+2025-08-08+at+2_32_37PM.png"
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1661196551/3146d28f5dda527e8731f21d5711/Screenshot+2025-08-08+at+2_47_55PM.png"
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1661191917/e9ad809c23403c662b76a2c363cd/Screenshot+2025-08-08+at+2_45_46PM.png"
    
    # Shares
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1828955028/2df2e5743ac97be83cf5c85596ab/1.jpg"
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1828956710/f585dfbc701cb8ac6be5924bcf5d/2.jpg"
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1828955983/d10f96e13476699a65381d7a28a1/7.jpg"
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1828959242/cad9d648d9da32294493e8291c5d/3.jpg"
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1391038552/fbc0c10823ce2cc0646221e4ae7f/Screenshot+2025-02-20+at+3_37_16PM.png"
    "https://downloads.intercomcdn.com/i/o/1174128120/c3ac110d7f019b7c0a484e4c/image-2024-4-2_17-7-2.png"
    
    # Comments panel
    "https://downloads.intercomcdn.com/i/o/999529547/af8923c6fd514eb96234953a/c5d45503-490a-47b4-bc23-b54f905f2f1b"
    "https://downloads.intercomcdn.com/i/o/999529306/04f557596d32f6fd5ce3e89d/e974a018-9381-4685-a99f-403f3b195230"
    
    # More help images
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1879459910/77f0cf3aa2070b67a4045c7b2658/Screenshot+2025-12-11+at+1_22_12PM.png"
    "https://downloads.intercomcdn.com/i/o/mbz4oxgz/1423088371/eedcc7c073bbf16f753d9abd9dfb/Screenshot+2025-03-14+at+1_37_06PM.png"
)

i=0
for url in "${HELP_IMAGES[@]}"; do
    ((TOTAL++))
    # Create filename
    filename="$(printf '%03d' $i)_${url##*/}"
    filename=$(echo "$filename" | cut -c1-80)
    # Add .png if no extension
    if [[ ! "$filename" =~ \.(png|jpg|jpeg|gif|webp)$ ]]; then
        filename="${filename}.png"
    fi
    
    if download "$url" "$HELP_DIR/$filename"; then
        ((SUCCESS++))
    fi
    ((i++))
done

# ============================================================
# SECTION 3: Features Page Images
# ============================================================
echo ""
echo "SECTION 3: Features Page Images"
echo "--------------------------------------------------------------"

FEATURES_IMAGES=(
    # C2C
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/a2c90814534dc31fdc81dbefd314654acd62f521-4720x1280.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/b703031f472b88507bca6295fcf673b1e08fd3b2-1008x696.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/cccbfe5451d737060df0cf7709485e8eb443a3c9-1008x696.png"
    
    # Integration logos
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/0ba91b342c066b3fffaae932a96c12434b9a7ef2-1077x744.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/b5720a3dc939732d6db898cb8bace9591dc1289b-2880x2160.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/88bc33498f4b2f4cbab9e8afe496cf5bdceea576-1296x720.png"
    
    # What's new
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/6e28c89b7cf3d1e629ed87e15228af9979cf6a1b-1920x1275.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/71c12b560def38c0dffaf79824f93a6799a92f3f-1920x1275.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/1871aedc4af015a122141725e23afd8e98c9ca57-1920x1275.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/501c7e02f80302da138cd3983e474d7605d7b319-1920x1275.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/c4accc1a8c19902ffe58543548a2d6ae4a77a5e2-1920x1275.jpg"
    
    # Resources
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/31f7b80692771bb18ac9a083979dbb8820f1d323-5760x3840.png"
    
    # Customer logos
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/5e453926c97418b884321841c89eb9102c67d24d-728x181.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/e1092c8c15f5db14bbba3b6983af02f1d1c69fb9-500x125.png"
    
    # Customer story images
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/aa387d9c706777b8eddf2aac8e1cee1034454ce8-1424x966.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/d392a1273e7ab249b3bf72ee1a5aaf03fed9e764-3840x2160.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/79ff0bfd13d269172f4b5592608d6be24aa6c08b-3840x2160.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/265544c0518f0e10aea129983ae1d3b59be0f9c4-1600x1200.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/dc9c6067ac39d4bf21f7490c85eb41b884d0b91b-4096x2311.png"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/4577ad80a16f1caa1ea4e9c2042149e8a87304ad-2112x1400.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/a3beb218a9f9afff0e60434ab4757d88fe02e8ce-2112x1400.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/6c71e18b016ffe6416feed78c257ec3f4cc56603-2112x1400.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/00ac01e4febd5eec7e3db57dc89f6fdbc1c8ed3d-2112x1400.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/b97444d983a7d8d4e1085e21b2a4fea85e8721c4-2112x1400.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/0250fb84881909e4f667fbcb1aea00361310633c-2112x1400.jpg"
    "https://cdn.sanity.io/images/s6lu43cv/production-v4/986adc2908061112f6f627b6f33228757ddb3e62-2112x1400.jpg"
)

i=0
for url in "${FEATURES_IMAGES[@]}"; do
    ((TOTAL++))
    ext="${url##*.}"
    ext=$(echo "$ext" | cut -d'?' -f1)
    filename="$(printf '%03d' $i)_${url##*/production-v4/}"
    filename=$(echo "$filename" | cut -c1-80)
    filename="${filename%.png}.${ext}"
    filename=$(echo "$filename" | sed 's/?.*//')
    
    if download "$url" "$FEATURES_DIR/$filename"; then
        ((SUCCESS++))
    fi
    ((i++))
done

# ============================================================
# SUMMARY
# ============================================================
echo ""
echo "=============================================================="
echo "SUMMARY"
echo "=============================================================="
echo "Total attempted: $TOTAL"
echo "Successfully downloaded: $SUCCESS"
echo "Failed: $((TOTAL - SUCCESS))"
echo ""
echo "Images by directory:"
echo "  main/:     $(ls -1 "$MAIN_DIR" 2>/dev/null | wc -l) files"
echo "  help/:     $(ls -1 "$HELP_DIR" 2>/dev/null | wc -l) files"
echo "  features/: $(ls -1 "$FEATURES_DIR" 2>/dev/null | wc -l) files"
echo ""
echo "Output directory: $BASE_DIR"
echo "=============================================================="
