"""
咖哩海域 3D 化試點：呼叫 Meshy API 把 1 個地點圖(黃金梅利號) + 1 個角色(路飛)
轉成 3D 模型（角色額外做 Auto-Rigging，取得內建的跑步動畫 glb）。

用法：python generate_pilot.py
需要 brain_map_3d/.env 內有 MESHY_API_KEY=xxx（不進 git）。
"""
import base64
import json
import os
import time
import urllib.request
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)
IMG_DIR = os.path.join(REPO_ROOT, 'brain_map_img')

API_BASE = 'https://api.meshy.ai/openapi/v1'
POLL_INTERVAL_SEC = 5
POLL_TIMEOUT_SEC = 600


def load_api_key():
    env_path = os.path.join(HERE, '.env')
    with open(env_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('MESHY_API_KEY='):
                return line.split('=', 1)[1].strip()
    raise RuntimeError('brain_map_3d/.env 裡找不到 MESHY_API_KEY')


def api_request(method, path, api_key, body=None):
    url = API_BASE + path
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', 'Bearer ' + api_key)
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        raise RuntimeError('Meshy API 錯誤 ' + str(e.code) + '：' + e.read().decode('utf-8'))


def image_to_data_uri(path):
    ext = os.path.splitext(path)[1].lstrip('.').lower()
    mime = 'image/png' if ext == 'png' else 'image/jpeg'
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    return 'data:' + mime + ';base64,' + b64


def poll_until_done(path, api_key, label):
    start = time.time()
    while True:
        d = api_request('GET', path, api_key)
        status = d.get('status')
        progress = d.get('progress', 0)
        print('  [' + label + '] ' + str(status) + ' ' + str(progress) + '%')
        if status == 'SUCCEEDED':
            return d
        if status in ('FAILED', 'CANCELED'):
            raise RuntimeError(label + ' 失敗：' + json.dumps(d, ensure_ascii=False)[:300])
        if time.time() - start > POLL_TIMEOUT_SEC:
            raise RuntimeError(label + ' 逾時（超過 ' + str(POLL_TIMEOUT_SEC) + ' 秒）')
        time.sleep(POLL_INTERVAL_SEC)


def download(url, dest_path):
    urllib.request.urlretrieve(url, dest_path)
    size_kb = os.path.getsize(dest_path) / 1024
    print('  已下載：' + dest_path + '（' + str(round(size_kb, 1)) + ' KB）')


def remesh(api_key, input_task_id, target_polycount, label):
    print('提交 Remesh（減面到約 ' + str(target_polycount) + '）...')
    r = api_request('POST', '/remesh', api_key, {
        'input_task_id': input_task_id,
        'target_polycount': target_polycount,
        'target_formats': ['glb'],
    })
    remesh_task_id = r['result']
    result = poll_until_done('/remesh/' + remesh_task_id, api_key, label + '減面')
    return result['model_urls']['glb']


def generate_location_pilot(api_key):
    print('=== 試點1：地點（黃金梅利號 / node 0）===')
    src = os.path.join(IMG_DIR, 'godenmerry.png')
    data_uri = image_to_data_uri(src)
    print('提交 Image-to-3D...')
    r = api_request('POST', '/image-to-3d', api_key, {
        'image_url': data_uri,
        'enable_pbr': True,
    })
    task_id = r['result']
    print('task_id=' + task_id)
    result = poll_until_done('/image-to-3d/' + task_id, api_key, '地點生成')
    print('地點原始建模完成，consumed_credits=' + str(result.get('consumed_credits')))
    # 原始模型面數過高（實測60萬+面、33MB），網頁用途太重，先減面再下載
    glb_url = remesh(api_key, task_id, 30000, '地點')
    download(glb_url, os.path.join(HERE, 'loc_node0.glb'))
    print('地點試點完成（已減面）')


def generate_character_pilot(api_key):
    print('=== 試點2：角色（路飛，含 Auto-Rig + 跑步動畫）===')
    src = os.path.join(IMG_DIR, 'luffy.png')
    data_uri = image_to_data_uri(src)
    print('步驟1：提交 Image-to-3D...')
    r = api_request('POST', '/image-to-3d', api_key, {
        'image_url': data_uri,
        'enable_pbr': True,
    })
    task_id = r['result']
    print('task_id=' + task_id)
    result = poll_until_done('/image-to-3d/' + task_id, api_key, '角色建模')
    print('角色建模完成，consumed_credits=' + str(result.get('consumed_credits')))

    print('步驟1.5：提交 Remesh（Rigging 限制300,000面以下，先減面）...')
    remeshed_glb_url = remesh(api_key, task_id, 20000, '角色')

    print('步驟2：提交 Rigging（自動綁骨架＋內建跑步動畫）...')
    rig_r = api_request('POST', '/rigging', api_key, {
        'model_url': remeshed_glb_url,
    })
    rig_task_id = rig_r['result']
    print('rig_task_id=' + rig_task_id)
    rig_result = poll_until_done('/rigging/' + rig_task_id, api_key, '骨架綁定')

    anims = rig_result.get('result', {}).get('basic_animations', {})
    running_url = anims.get('running_glb_url')
    if not running_url:
        raise RuntimeError('rigging 完成但沒有 running_glb_url，實際回應：' +
                            json.dumps(rig_result, ensure_ascii=False)[:500])
    download(running_url, os.path.join(HERE, 'char_luffy_run.glb'))
    print('角色試點完成，consumed_credits=' + str(rig_result.get('consumed_credits')))


def main():
    api_key = load_api_key()
    generate_location_pilot(api_key)
    print()
    generate_character_pilot(api_key)
    print()
    print('=== 全部完成，結果存在 brain_map_3d/ ===')


if __name__ == '__main__':
    main()
