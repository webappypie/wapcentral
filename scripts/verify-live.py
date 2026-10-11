import urllib.request
import json
import re

print("--- 1. Live Index.html & Bundle Verification ---")
req = urllib.request.Request(
    'https://wapcentral-prod.web.app/index.html',
    headers={'User-Agent': 'Mozilla/5.0'}
)
html = urllib.request.urlopen(req).read().decode('utf-8')
print("index.html fetched successfully.")

m = re.search(r'src="(/assets/index-[^"]+\.js)"', html)
if not m:
    print("Could not find index-*.js in index.html!")
    print(html)
else:
    script_path = m.group(1)
    print(f"Active Live Script: {script_path}")
    bundle_url = f"https://wapcentral-prod.web.app{script_path}"
    bundle_content = urllib.request.urlopen(bundle_url).read().decode('utf-8', errors='ignore')
    print(f"Bundle Size: {len(bundle_content)} bytes")
    print(f"Contains '0.2.1': {'0.2.1' in bundle_content}")
    print(f"Contains 'v0.2.0': {'v0.2.0' in bundle_content}")
    print(f"Contains 'Production': {'Production' in bundle_content}")

print("\n--- 2. Live Admin API Health Verification ---")
health_urls = [
    'https://wapcentral-prod.web.app/api/admin/health',
    'https://wapcentral-admin-api-174781611765.asia-south1.run.app/health'
]

for url in health_urls:
    try:
        res = urllib.request.urlopen(url)
        body = json.loads(res.read().decode('utf-8'))
        print(f"Endpoint: {url}")
        print(f"Status: {res.status}")
        print("Body:", json.dumps(body, indent=2))
    except Exception as e:
        print(f"Failed {url}: {e}")

print("\n--- 3. Live AI Providers Verification ---")
providers_url = 'https://wapcentral-prod.web.app/api/admin/v1/ai/providers'
try:
    res = urllib.request.urlopen(providers_url)
    body = json.loads(res.read().decode('utf-8'))
    print(f"Endpoint: {providers_url}")
    print(f"Status: {res.status}")
    print("Body:", json.dumps(body, indent=2))
except Exception as e:
    print(f"Failed {providers_url}: {e}")
