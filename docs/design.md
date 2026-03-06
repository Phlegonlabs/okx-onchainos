# Trading Strategy Agent Gateway - Design System

## Theme

Dark theme, modern fintech aesthetic. Clean, data-dense, professional.

## Colors

```
Background:     #09090b (zinc-950)
Surface:        #18181b (zinc-900)
Surface Hover:  #27272a (zinc-800)
Border:         #3f3f46 (zinc-700)
Text Primary:   #fafafa (zinc-50)
Text Secondary: #a1a1aa (zinc-400)
Accent:         #3b82f6 (blue-500)
Accent Hover:   #2563eb (blue-600)
Success:        #22c55e (green-500)
Danger:         #ef4444 (red-500)
Warning:        #f59e0b (amber-500)
```

## Typography

- Font: `Inter` (via next/font)
- Headings: semibold
- Body: regular, text-sm / text-base
- Monospace: `JetBrains Mono` for numbers, addresses, code

## Components

### Strategy Card
- Name + asset badge
- Win rate (green/red), avg return, total signals
- Price per signal in USD
- Hover: slight scale + border glow

### Signal Table
- Columns: Date, Action (buy/sell badge), Token, Entry, SL, TP, Outcome, Return%
- Buy = green badge, Sell = red badge
- Win = green text, Loss = red text

### Performance Chart
- Simple line chart (cumulative return %)
- Dark background, accent line color
- Lightweight charting lib (recharts or chart.js)

## Layout

- Max width: 1200px centered
- Sidebar: none (simple top nav)
- Grid: 1 col mobile, 2-3 col desktop for strategy cards
- Spacing: consistent 4/8/16/24px scale

## Responsive

- Mobile-first
- Cards stack vertically on small screens
- Table scrolls horizontally on mobile
