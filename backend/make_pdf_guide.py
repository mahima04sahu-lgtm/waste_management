import sys
from pathlib import Path

base_dir = Path(__file__).resolve().parent.parent
md_file = base_dir / 'HAZGUARD_SYSTEM_GUIDE.md'
html_file = base_dir / 'frontend' / 'guide.html'

with open(md_file, 'r', encoding='utf-8') as f:
    text = f.read()

# Simple markdown to HTML conversion if markdown package available, else fallback
try:
    import markdown
    html_body = markdown.markdown(text, extensions=['tables', 'fenced_code'])
except ImportError:
    import html
    html_body = f"<pre style='white-space: pre-wrap;'>{html.escape(text)}</pre>"

template = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HazGuard / WasteGuard - Technical Documentation & Implementation Guide</title>
<style>
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #1e293b;
    max-width: 920px;
    margin: 40px auto;
    padding: 0 24px;
    background: #ffffff;
  }}
  h1 {{ color: #0284c7; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 24px; }}
  h2 {{ color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 36px; }}
  h3 {{ color: #0369a1; margin-top: 20px; }}
  pre {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    font-family: Consolas, monospace;
    font-size: 13px;
    line-height: 1.45;
  }}
  code {{
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: Consolas, monospace;
    font-size: 13px;
    color: #0f172a;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 24px 0;
    font-size: 14px;
  }}
  th, td {{
    border: 1px solid #cbd5e1;
    padding: 10px 14px;
    text-align: left;
  }}
  th {{ background: #f1f5f9; font-weight: 700; color: #0f172a; }}
  blockquote {{
    border-left: 4px solid #0284c7;
    margin: 16px 0;
    padding: 8px 16px;
    background: #f0f9ff;
    color: #0369a1;
    border-radius: 0 4px 4px 0;
  }}
  .print-btn {{
    position: fixed;
    top: 20px;
    right: 24px;
    padding: 10px 20px;
    background: #0284c7;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(2, 132, 199, 0.3);
    z-index: 1000;
    transition: all 0.2s;
  }}
  .print-btn:hover {{
    background: #0369a1;
    transform: translateY(-1px);
  }}
  @media print {{
    .print-btn {{ display: none !important; }}
    body {{ max-width: 100%; margin: 15mm; padding: 0; }}
    h1, h2, h3 {{ page-break-after: avoid; }}
    pre, table {{ page-break-inside: avoid; }}
  }}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
{html_body}
</body>
</html>"""

with open(html_file, 'w', encoding='utf-8') as f:
    f.write(template)

print("Generated HTML guide at:", html_file)
