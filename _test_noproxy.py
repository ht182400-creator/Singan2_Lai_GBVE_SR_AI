import urllib.request, time
# 禁用代理，避免 Windows WPAD/PAC 探测拖慢每次请求
proxy = urllib.request.ProxyHandler({})
opener = urllib.request.build_opener(proxy)
urllib.request.install_opener(opener)

def t(url, data=None, hdr=None):
    t0 = time.time()
    if data is None:
        with urllib.request.urlopen(url, timeout=10) as r:
            b = r.read()
    else:
        req = urllib.request.Request(url, data=data, headers=hdr or {}, method='POST')
        with urllib.request.urlopen(req, timeout=10) as r:
            b = r.read()
    return round((time.time()-t0)*1000,1), len(b)

print('health x3:')
for i in range(3):
    print('  ', t('http://localhost:8080/health'))
path = r'E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\uploads\singan2_1788341459_18467_12_100D_B.dat'
body = ('{"dat_path":"%s","record":0,"wave":0,"mode":"raw"}' % path).encode()
print('image raw x3:')
for i in range(3):
    print('  ', t('http://localhost:8080/api/image', body, {'Content-Type':'application/json'}))
print('image raw record=500 x3:')
b2 = ('{"dat_path":"%s","record":500,"wave":0,"mode":"raw"}' % path).encode()
for i in range(3):
    print('  ', t('http://localhost:8080/api/image', b2, {'Content-Type':'application/json'}))
