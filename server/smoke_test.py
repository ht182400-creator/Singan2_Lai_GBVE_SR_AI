# -*- coding: utf-8 -*-
"""M3 服务冒烟测试：启动 singan2_server，覆盖 /health、/api/analyze-path、
/api/analyze（多部件上传）、以及缺字段报错分支，校验与基准一致。"""
import json
import os
import sys
import time
import subprocess
import urllib.request
import urllib.error

EXE = 'e:/AI_Studio/NCR_tool/Singan2_Lai_GBVE_SR_AI/build/server/Debug/singan2_server.exe'
DAT = 'e:/AI_Studio/NCR_tool/Singan2_Lai_GBVE_SR_AI/data/2A_DA_111017_115542.dat'
ZFILE = 'e:/AI_Studio/NCR_tool/Singan2_Lai_GBVE_SR_AI/data/ZAR/X_ATB_ZAR_132006050001.txt'
BASE = 'http://127.0.0.1:8080'

# 基准（来自 poc/output/s2_result_rec0.json，与 test_algo 一致）
EXPECT_S2 = [3834, 7010, 17488, 36016, 5318, 468, 6309, 468, 3920, 15629,
             6150, 2892, 18733, 1280, 421, 310]
EXPECT_ETC = [39675, 55723]  # etc[10], etc[11]


def wait_health():
    for _ in range(40):
        try:
            r = urllib.request.urlopen(BASE + '/health', timeout=1)
            if r.status == 200:
                return True
        except Exception:
            time.sleep(0.3)
    return False


def check_result(resp):
    s2 = resp.get('s2', [])
    etc = resp.get('etc', [])
    fails = 0
    for i in range(16):
        a = s2[i + 1] if len(s2) > i + 1 else None
        e = EXPECT_S2[i]
        mark = 'OK' if a == e else 'X'
        if a != e:
            fails += 1
        print('  S2[%d] actual=%s expect=%s %s' % (i + 1, a, e, mark))
    for (ei, e) in [(10, EXPECT_ETC[0]), (11, EXPECT_ETC[1])]:
        a = etc[ei] if len(etc) > ei else None
        mark = 'OK' if a == e else 'X'
        if a != e:
            fails += 1
        print('  etc[%d] actual=%s expect=%s %s' % (ei, a, e, mark))
    return fails


def multipart_post(url, fields, files):
    """极简 multipart/form-data 编码发送。"""
    boundary = '----singan2testboundary'
    parts = []
    for k, v in fields.items():
        parts.append(('--' + boundary + '\r\n').encode())
        parts.append(('Content-Disposition: form-data; name="%s"\r\n\r\n' % k).encode())
        parts.append(('%s\r\n' % v).encode())
    for k, path in files.items():
        data = open(path, 'rb').read()
        parts.append(('--' + boundary + '\r\n').encode())
        parts.append(('Content-Disposition: form-data; name="%s"; filename="%s"\r\n' % (k, os.path.basename(path))).encode())
        parts.append(b'Content-Type: application/octet-stream\r\n\r\n')
        parts.append(data)
        parts.append(b'\r\n')
    parts.append(('--' + boundary + '--\r\n').encode())
    body = b''.join(parts)
    req = urllib.request.Request(url, data=body,
                                headers={'Content-Type': 'multipart/form-data; boundary=' + boundary,
                                         'Content-Length': str(len(body))})
    return urllib.request.urlopen(req, timeout=60)


def main():
    proc = subprocess.Popen([EXE, '8080'], stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL)
    total = 0
    try:
        if not wait_health():
            print('FAIL: 服务未启动')
            return 1

        # 1) /api/analyze-path
        print('[1] /api/analyze-path')
        body = json.dumps({'dat_path': DAT, 'zfile_path': ZFILE,
                           'record': 0, 'kin': 1, 'country': 0}).encode('utf-8')
        req = urllib.request.Request(BASE + '/api/analyze-path', data=body,
                                    headers={'Content-Type': 'application/json'})
        r = urllib.request.urlopen(req, timeout=30)
        total += check_result(json.loads(r.read().decode('utf-8')))

        # 2) /api/analyze 多部件上传
        print('[2] /api/analyze (multipart upload)')
        r = multipart_post(BASE + '/api/analyze',
                           {'record': '0', 'kin': '1', 'country': '0',
                            'zfile_path': ZFILE}, {'dat': DAT})
        total += check_result(json.loads(r.read().decode('utf-8')))

        # 3) /api/analyze 缺 dat 字段 -> 400
        print('[3] /api/analyze 缺 dat 字段 (期望 400)')
        try:
            multipart_post(BASE + '/api/analyze', {}, {})
            print('  FAIL: 未返回 400')
            total += 1
        except urllib.error.HTTPError as e:
            ok = (e.code == 400)
            print('  HTTP %d %s' % (e.code, 'OK' if ok else 'X'))
            if not ok:
                total += 1

        print('SMOKE_RESULT: %s (%d fails)' % ('PASS' if total == 0 else 'FAIL', total))
        return 0 if total == 0 else 1
    finally:
        proc.kill()


if __name__ == '__main__':
    sys.exit(main())

