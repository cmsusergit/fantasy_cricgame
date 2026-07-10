import json

with open("/home/user1/game/fantasy_cricmanager/scratch_svg_details.json", 'r') as f:
    svg_details = json.load(f)

# Include original basic symbols as well for max choices
svg_details['sword'] = {
    "viewBox": "0 0 24 24",
    "transform": "",
    "d": "M12 5.5l1.2 1.8v5h-2.4v-5L12 5.5z M10 13.5h4v1h-4v-1z M11.2 14.5h1.6v4h-1.6v-4z"
}
svg_details['crown'] = {
    "viewBox": "0 0 24 24",
    "transform": "",
    "d": "M6 14.5l1.5-4.5 2.5 2.5 2-4 2 4 2.5-2.5 1.5 4.5H6z M6 15.5h12v1H6v-1z"
}
svg_details['lightning'] = {
    "viewBox": "0 0 24 24",
    "transform": "",
    "d": "M13.5 5L7 13.5h4v5l6.5-8.5h-4V5z"
}
svg_details['star'] = {
    "viewBox": "0 0 24 24",
    "transform": "",
    "d": "M12 6.2l1.5 3.1 3.4.5-2.4 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4-2.4-2.4 3.4-.5L12 6.2z"
}
svg_details['wolf'] = {
    "viewBox": "0 0 24 24",
    "transform": "",
    "d": "M12 6.5l-2.5 3 0.7 1.8-1.2 0.7v1.2l1.8-0.7 1.2 1.8 1.2-1.8 1.8 0.7v-1.2l-1.2-0.7 0.7-1.8-2.5-3z"
}
svg_details['dragon'] = {
    "viewBox": "0 0 24 24",
    "transform": "",
    "d": "M12 5.5c-0.8 0.6-1.5 1.5-1.5 2.4s0.6 1.5 1.2 2.1l-1.8 2.4-0.6-0.6H8v1.2l1.5 0.3-0.9 2.1H13.2c1.5 0 2.7-1.2 2.7-2.7s-1.5-1.8-2.7-1.5l-1.2-1.8c0.9 0 1.5-0.6 1.5-1.5s-0.6-1.5-1.5-1.5z"
}

# Generate symbols string
dict_entries = []
for name, details in svg_details.items():
    escaped_d = details["d"].replace('"', '\\"')
    escaped_tf = details["transform"].replace('"', '\\"')
    dict_entries.append(f'    "{name}": {{ viewBox: "{details["viewBox"]}", transform: "{escaped_tf}", d: "{escaped_d}" }}')

dict_str = ",\n".join(dict_entries)

code = f"""<script lang="ts">
  interface Props {{
    logo: string;
    size?: number;
    color?: string;
  }}
  
  let {{ logo = 'logo_shield', size = 24, color = 'currentColor' }}: Props = $props();

  // Custom logo format: "custom|shape|bgColor|symbol|symbolColor"
  const isCustom = $derived(logo.startsWith('custom|'));
  const parts = $derived(isCustom ? logo.split('|') : []);
  
  // Custom parts
  const bgShape = $derived(parts[1] || 'shield');
  const bgColor = $derived(parts[2] || '#1e40af');
  const symbol = $derived(parts[3] || 'sword');
  const symbolColor = $derived(parts[4] || '#fbbf24');

  // Predefined SVG paths for shapes (viewbox 0 0 24 24)
  const shapes: Record<string, string> = {{
    shield: 'M12 2L3 6v6c0 5.5 4.5 10 9 10s9-4.5 9-10V6l-9-4z',
    circle: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    diamond: 'M12 2L2 12l10 10 10-10L12 2z',
    hexagon: 'M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z'
  }};

  // Predefined SVG details for center symbols
  const symbols: Record<string, {{ viewBox: string; transform: string; d: string }}> = {{
{dict_str}
  }};

  // Convert old predefined string names for compatibility
  const legacyLogo = $derived((() => {{
    if (logo === 'logo_shield') return 'custom|shield|#1e40af|star|#fbbf24';
    if (logo === 'logo_lightning') return 'custom|circle|#ea580c|lightning|#facc15';
    if (logo === 'logo_crown') return 'custom|shield|#7c3aed|crown|#fbbf24';
    if (logo === 'logo_sword') return 'custom|hexagon|#334155|sword|#cbd5e1';
    if (logo === 'logo_star') return 'custom|diamond|#059669|star|#facc15';
    return null;
  }})());
</script>

{{#if isCustom}}
  <svg viewBox="0 0 24 24" width={{size}} height={{size}} style="display: inline-block; vertical-align: middle;">
    <!-- Background Base Shape -->
    {{#if shapes[bgShape]}}
      <path d={{shapes[bgShape]}} fill={{bgColor}} />
    {{/if}}
    
    <!-- Center Emblem Symbol -->
    {{#if symbols[symbol]}}
      {{@const sym = symbols[symbol]}}
      <svg viewBox={{sym.viewBox}} width="13" height="13" x="5.5" y="5.5">
        <g transform={{sym.transform}} fill={{symbolColor}}>
          <path d={{sym.d}} />
        </g>
      </svg>
    {{/if}}
  </svg>
{{#else if legacyLogo}}
  {{@const legacyParts = legacyLogo.split('|')}}
  <svg viewBox="0 0 24 24" width={{size}} height={{size}} style="display: inline-block; vertical-align: middle;">
    <path d={{shapes[legacyParts[1]]}} fill={{legacyParts[2]}} />
    {{#if symbols[legacyParts[3]]}}
      {{@const sym = symbols[legacyParts[3]]}}
      <svg viewBox={{sym.viewBox}} width="13" height="13" x="5.5" y="5.5">
        <g transform={{sym.transform}} fill={{legacyParts[4]}}>
          <path d={{sym.d}} />
        </g>
      </svg>
    {{/if}}
  </svg>
{{#else}}
  <!-- Render raw text/emoji fallback -->
  <span style="font-size: {{size * 0.8}}px; line-height: 1; display: inline-block; vertical-align: middle;">{{logo}}</span>
{{/if}}
"""

with open("/home/user1/game/fantasy_cricmanager/src/lib/components/team/TeamLogo.svelte", 'w') as f:
    f.write(code)

print("Successfully wrote TeamLogo.svelte with full scraped vector symbols!")
