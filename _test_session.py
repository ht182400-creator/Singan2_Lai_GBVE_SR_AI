import json, urllib.request
url = 'http://localhost:8080/api/session/open'
path = r'E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\uploads\singan2_1788341459_18467_12_100D_B.dat'
body = json.dumps({'dat_path': path}).encode()
req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'}, method='POST')
try:
    with urllib.request.urlopen(req) as r:
        print(r.read().decode())
except Exception as e:
    print('ERROR:', e)
