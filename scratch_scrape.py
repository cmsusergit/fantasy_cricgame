import urllib.request
import re
import xml.etree.ElementTree as ET
import json

# Setup user-agent
req_headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# Fetch index
print("Fetching index page...")
req = urllib.request.Request('https://svgsilh.com/tag/fantasy-1.html', headers=req_headers)
with urllib.request.urlopen(req) as response:
    html = response.read().decode('utf-8')

# Find SVG IDs
svg_ids = re.findall(r'/svg/(\d+)\.svg', html)
svg_ids = list(set(svg_ids))  # De-duplicate
print(f"Found {len(svg_ids)} SVG IDs: {svg_ids}")

# Take the first 25
selected_ids = svg_ids[:25]
svg_data = {}

for sid in selected_ids:
    url = f"https://svgsilh.com/svg/{sid}.svg"
    print(f"Fetching {url}...")
    try:
        sreq = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(sreq) as sresp:
            svg_content = sresp.read()
        
        # Parse XML
        # Remove namespace or register it to find path
        root = ET.fromstring(svg_content)
        
        paths = []
        # Find all paths
        for path in root.findall('.//{http://www.w3.org/2000/svg}path'):
            d = path.attrib.get('d')
            if d:
                paths.append(d)
        
        if paths:
            # Join paths if multiple, but usually just one main path on SVGSilh
            svg_data[sid] = " ".join(paths)
            print(f"Successfully extracted path for {sid}")
    except Exception as e:
        print(f"Failed to process {sid}: {e}")

# Save output
output_path = "/home/user1/game/fantasy_cricmanager/scratch_svgs.json"
with open(output_path, 'w') as f:
    json.dump(svg_data, f, indent=2)

print(f"Saved {len(svg_data)} SVG paths to {output_path}")
