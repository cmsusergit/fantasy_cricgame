import urllib.request
import re
import xml.etree.ElementTree as ET
import json

# Setup user-agent
req_headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

with open("/home/user1/game/fantasy_cricmanager/scratch_named_svgs.json", 'r') as f:
    named_svgs = json.load(f)

# Mapping from name to original SVGSilh ID
id_to_name = {
    "1751138": "valkyrie_helmet",
    "1474438": "unicorn",
    "312815": "crest_filigree",
    "2023216": "ram_horns",
    "2029413": "demon_horns",
    "312825": "shield_filigree",
    "1394534": "dragon_fire",
    "1526166": "gargoyle_statue",
    "1898502": "tree_of_life",
    "1566741": "wizard_magic",
    "1526802": "gargoyle_wings",
    "312835": "crown_filigree",
    "1837456": "archer_bow",
    "2101945": "elven_bow",
    "1332804": "crest_ornament",
    "312837": "star_filigree",
    "1721875": "dragon_serpent",
    "986054": "mystic_symbol",
    "1539624": "hunter_bow",
    "1578289": "siren_tail"
}

scraped_details = {}

for sid, name in id_to_name.items():
    url = f"https://svgsilh.com/svg/{sid}.svg"
    print(f"Scraping SVG details for {name} ({sid}) from {url}...")
    try:
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req) as response:
            svg_content = response.read().decode('utf-8')
        
        # Extract viewBox
        viewbox_match = re.search(r'viewBox="([^"]+)"', svg_content)
        viewbox = viewbox_match.group(1) if viewbox_match else "0 0 24 24"
        
        # Extract transform
        transform_match = re.search(r'<g[^>]*transform="([^"]+)"', svg_content)
        transform = transform_match.group(1) if transform_match else ""
        
        # Extract paths
        root = ET.fromstring(svg_content.encode('utf-8'))
        paths = []
        for path in root.findall('.//{http://www.w3.org/2000/svg}path'):
            d = path.attrib.get('d')
            if d:
                paths.append(d)
        
        d_path = " ".join(paths)
        
        scraped_details[name] = {
            "viewBox": viewbox,
            "transform": transform,
            "d": d_path
        }
        print(f"Processed {name} successfully.")
    except Exception as e:
        print(f"Failed to scrape details for {name}: {e}")

# Save output
output_path = "/home/user1/game/fantasy_cricmanager/scratch_svg_details.json"
with open(output_path, 'w') as f:
    json.dump(scraped_details, f, indent=2)

print(f"Saved {len(scraped_details)} detailed SVGs to {output_path}")
