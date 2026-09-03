import urllib.request, time
def t(url, data=None, hdr=None):
    t0 = time.time()
    if data is None:
        with urllib.request.urlopen(url) as r:
            b = r.read()
    else:
        req = urllib.request.Request(url, data=data, headers=hdr or {}, method='POST')
        with urllib.request.urlopen(req) as r:
            b = r.read()
    return round((time.time()-t0)*1000,1), len(b)

print('health:', t('http://localhost:8080/health'))
path = r'E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\uploads\singan2_1788341459_18467_12_100D_B.dat'
body = ('{"dat_path":"%s","record":0,"wave":0,"mode":"raw"}' % path).encode()
print('image raw:', t('http://localhost:8080/api/image', body, {'Content-Type':'application/json'}))

# concurrent: 2 simultaneous image requests
import threading
res = {}
def worker(i):
    _, _ = t('http://localhost:8080/api/image', body, {'Content-Type':'application/json'})
    res[i] = True
ts = [threading.Thread(target=worker, args=(i,)) for i in range(2)]
a=time.time()
for x in ts: x.start()
for x in ts: x.join()
print('2 concurrent total ms:', round((time.time()-a)*1000,1))
