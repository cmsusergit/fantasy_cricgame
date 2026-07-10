import urllib.request
import re
import json

# Setup user-agent
req_headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

with open("/home/user1/game/fantasy_cricmanager/scratch_svgs.json", 'r') as f:
    svg_data = json.load(f)

named_svgs = {}

for sid, path_d in svg_data.items():
    url = f"https://svgsilh.com/image/{sid}.html"
    print(f"Fetching details for {sid} from {url}...")
    try:
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
        
        # Find page title or keywords
        title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE)
        name = f"icon_{sid}"
        if title_match:
            title_text = title_match.group(1)
            # Clean up title text to get a simple identifier, e.g. "free vector graphic silhouette of dragon" -> "dragon"
            # Extract keywords like dragon, wizard, castle, sword, wolf, pegasus, elf, fairy, etc.
            keywords = ['dragon', 'wolf', 'sword', 'shield', 'wizard', 'castle', 'unicorn', 'pegasus', 'phoenix', 'fairy', 'elf', 'goblin', 'dwarf', 'warrior', 'knight', 'crown', 'monster', 'witch', 'magic', 'demon', 'devil', 'angel', 'helmet', 'axe', 'spear', 'bow', 'arrow']
            found_kws = []
            for kw in keywords:
                if kw in title_text.lower():
                    found_kws.append(kw)
            if found_kws:
                name = "_".join(found_kws)
            else:
                # Fallback to words in title
                clean_title = re.sub(r'[^a-zA-Z\s]', '', title_text)
                words = [w.lower() for w in clean_title.split() if len(w) > 3 and w.lower() not in ['free', 'vector', 'graphic', 'silhouette', 'silhouettes', 'clipart', 'clip', 'art', 'black', 'white', 'isolated', 'design', 'image', 'svgsilh']]
                if words:
                    name = "_".join(words[:2])
        
        # Avoid duplicate names
        base_name = name
        counter = 1
        while name in named_svgs:
            name = f"{base_name}_{counter}"
            counter += 1
            
        named_svgs[name] = path_d
        print(f"Assigned name: {name} for ID: {sid}")
    except Exception as e:
        print(f"Failed to fetch details for {sid}: {e}")
        named_svgs[f"icon_{sid}"] = path_d

# Save final result
output_path = "/home/user1/game/fantasy_cricmanager/scratch_named_svgs.json"
with open(output_path, 'w') as f:
    json.dump(named_svgs, f, indent=2)

print(f"Saved {len(named_svgs)} named SVGs to {output_path}")
