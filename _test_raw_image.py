import socket, time, json
def raw_post(path, body):
    t0 = time.time()
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(10)
    s.connect(('127.0.0.1', 8080))
    payload = json.dumps(body).encode()
    req = (f"POST {path} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\n"
           f"Content-Length: {len(payload)}\r\nConnection: close\r\n\r\n").encode() + payload
    s.sendall(req)
    data = b""
    while True:
        chunk = s.recv(4096)
        if not chunk: break
        data += chunk
    s.close()
    return round((time.time()-t0)*1000,1), len(data)

path = r'E:\AI_Studio\NCR_tool\Singan2_Lai_GBVE_SR_AI\uploads\singan2_1788341459_18467_12_100D_B.dat'
print('image raw record=0 x3:')
for i in range(3):
    print('  ', raw_post('/api/image', {'dat_path':path,'record':0,'wave':0,'mode':'raw'}))
print('image raw record=500 x3:')
for i in range(3):
    print('  ', raw_post('/api/image', {'dat_path':path,'record':500,'wave':0,'mode':'raw'}))
print('image 2byte record=0 x3:')
for i in range(3):
    print('  ', raw_post('/api/image', {'dat_path':path,'record':0,'wave':0,'mode':'2byte'}))
print('small-image record=0 x3:')
for i in range(3):
    print('  ', raw_post('/api/small-image', {'dat_path':path,'record':0}))
