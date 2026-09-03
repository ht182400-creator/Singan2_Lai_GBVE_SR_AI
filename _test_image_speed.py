import json, urllib.request, time
url = 'http://localhost:8080/api/image'
path = r'E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\uploads\singan2_1788341459_18467_12_100D_B.dat'
body = json.dumps({'dat_path': path, 'record': 0, 'wave': 0, 'mode': 'raw'}).encode()
req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'}, method='POST')
for i in range(3):
    t0 = time.time()
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read().decode()
            j = json.loads(data)
            print(f'run {i+1}: {round((time.time()-t0)*1000,1)} ms, width={j.get("width")}, height={j.get("height")}, data_len={len(j.get("data",""))}')
    except Exception as e:
        print(f'run {i+1}: ERROR {e}')

# cache stats
req2 = urllib.request.Request('http://localhost:8080/api/cache/stats', method='GET')
with urllib.request.urlopen(req2) as r:
    print('cache stats:', r.read().decode())
