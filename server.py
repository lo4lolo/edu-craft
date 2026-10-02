# -*- coding: utf-8 -*-
"""
에듀 크래프트 LAN 서버 (파이썬 3.8+ , 추가 설치 없음)

- 이 폴더의 게임 파일을 웹으로 보여 주고 (http://이_컴퓨터_IP:8080)
- 같은 와이파이의 기기들이 한 세계에서 함께 놀 수 있도록 웹소켓(/ws)으로 메시지를 중계합니다.
- 세계 계산과 저장은 '방장' 브라우저가 합니다. 서버는 전달만 합니다.

실행:  python server.py [포트]
"""
import asyncio, base64, hashlib, json, mimetypes, os, socket, struct, sys, webbrowser
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('font/woff', '.woff')
mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('application/manifest+json', '.webmanifest')

clients = {}      # id -> Client
rooms = {}        # room_id -> {'id','name','host'(client id),'host_name','members':set()}
counter = [0]


def local_ips():
    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ips.append(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if ip not in ips and not ip.startswith('127.'):
                ips.append(ip)
    except Exception:
        pass
    return ips or ['127.0.0.1']


class Client:
    def __init__(self, cid, writer):
        self.id = cid
        self.writer = writer
        self.room = None
        self.name = '?'
        self.lock = asyncio.Lock()
        self.closed = False

    async def send(self, obj):
        if self.closed:
            return
        data = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        n = len(data)
        if n < 126:
            header = struct.pack('!BB', 0x81, n)
        elif n < 65536:
            header = struct.pack('!BBH', 0x81, 126, n)
        else:
            header = struct.pack('!BBQ', 0x81, 127, n)
        try:
            async with self.lock:
                self.writer.write(header + data)
                await self.writer.drain()
        except Exception:
            self.closed = True


async def read_frame(reader):
    """웹소켓 프레임 하나 읽기 → (opcode, payload)"""
    h = await reader.readexactly(2)
    fin = h[0] & 0x80
    opcode = h[0] & 0x0F
    masked = h[1] & 0x80
    n = h[1] & 0x7F
    if n == 126:
        n = struct.unpack('!H', await reader.readexactly(2))[0]
    elif n == 127:
        n = struct.unpack('!Q', await reader.readexactly(8))[0]
    if n > 64 * 1024 * 1024:
        raise ValueError('frame too large')
    mask = await reader.readexactly(4) if masked else None
    data = await reader.readexactly(n) if n else b''
    if mask:
        data = bytes(b ^ mask[i & 3] for i, b in enumerate(data)) if n < 4096 else _unmask(data, mask)
    return fin, opcode, data


def _unmask(data, mask):
    # 긴 데이터는 정수 XOR 로 빠르게
    m = int.from_bytes(mask * (len(data) // 4 + 1), 'little')
    d = int.from_bytes(data, 'little')
    return (d ^ (m & ((1 << (8 * len(data))) - 1))).to_bytes(len(data), 'little')


def room_list():
    out = []
    for r in rooms.values():
        out.append({'id': r['id'], 'name': r['name'], 'host': r['host_name'], 'players': len(r['members']) + 1})
    return out


async def handle_ws_message(c, msg):
    t = msg.get('type')
    if t == 'list':
        await c.send({'type': 'rooms', 'rooms': room_list()})
    elif t == 'host':
        counter[0] += 1
        rid = 'r%d' % counter[0]
        rooms[rid] = {'id': rid, 'name': str(msg.get('name', '세계'))[:40], 'host': c.id, 'host_name': str(msg.get('host', '?'))[:16], 'members': set()}
        c.room = rid
        await c.send({'type': 'hosted', 'room': rid})
        print('  [방 열림] %s (방장: %s)' % (rooms[rid]['name'], rooms[rid]['host_name']))
    elif t == 'join':
        r = rooms.get(msg.get('room'))
        if not r:
            await c.send({'type': 'error', 'message': '방을 찾을 수 없어요'})
            return
        c.room = r['id']
        c.name = str(msg.get('name', '?'))[:16]
        r['members'].add(c.id)
        await c.send({'type': 'joined', 'room': r['id'], 'id': c.id})
        host = clients.get(r['host'])
        if host:
            await host.send({'type': 'peer-join', 'id': c.id, 'name': c.name})
        print('  [입장] %s → %s' % (c.name, r['name']))
    elif t == 'msg':
        r = rooms.get(c.room)
        if not r:
            return
        to = msg.get('to')
        data = msg.get('data')
        out = {'type': 'msg', 'from': c.id, 'data': data}
        if c.id == r['host']:
            if to == '*':
                targets = list(r['members'])
            else:
                targets = [to]
        else:
            targets = [r['host']]
        for tid in targets:
            t_c = clients.get(tid)
            if t_c and t_c.room == r['id']:
                await t_c.send(out)


async def leave(c):
    r = rooms.get(c.room)
    if not r:
        return
    if r['host'] == c.id:
        print('  [방 닫힘] %s' % r['name'])
        for mid in list(r['members']):
            m = clients.get(mid)
            if m:
                await m.send({'type': 'closed'})
                m.room = None
        del rooms[r['id']]
    else:
        r['members'].discard(c.id)
        host = clients.get(r['host'])
        if host:
            await host.send({'type': 'peer-leave', 'id': c.id})
        print('  [퇴장] %s' % c.name)


async def websocket(reader, writer, headers):
    key = headers.get('sec-websocket-key', '')
    accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
    writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n' % accept).encode())
    await writer.drain()
    counter[0] += 1
    c = Client('c%d' % counter[0], writer)
    clients[c.id] = c
    buf = b''
    try:
        while True:
            fin, op, data = await read_frame(reader)
            if op == 8:
                break
            if op == 9:
                try:
                    writer.write(struct.pack('!BB', 0x8A, len(data)) + data)
                    await writer.drain()
                except Exception:
                    break
                continue
            if op in (1, 2, 0):
                buf += data
                if not fin:
                    continue
                text, buf = buf, b''
                try:
                    msg = json.loads(text.decode('utf-8'))
                except Exception:
                    continue
                await handle_ws_message(c, msg)
    except (asyncio.IncompleteReadError, ConnectionError, ValueError, OSError):
        pass
    finally:
        c.closed = True
        await leave(c)
        clients.pop(c.id, None)
        try:
            writer.close()
        except Exception:
            pass


async def serve_file(writer, path, head_only, port):
    if path == '/api/info':
        body = json.dumps({'opuscraft': True, 'port': port, 'urls': ['http://%s:%d' % (ip, port) for ip in local_ips()]}, ensure_ascii=False).encode()
        writer.write(b'HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nCache-Control: no-store\r\nContent-Length: %d\r\nConnection: close\r\n\r\n' % len(body) + (b'' if head_only else body))
        await writer.drain()
        return
    rel = unquote(path.split('?')[0]).lstrip('/') or 'index.html'
    full = os.path.normpath(os.path.join(ROOT, rel))
    if not full.startswith(ROOT) or not os.path.isfile(full):
        body = '찾을 수 없어요'.encode()
        writer.write(b'HTTP/1.1 404 Not Found\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: %d\r\nConnection: close\r\n\r\n' % len(body) + body)
        await writer.drain()
        return
    ctype = mimetypes.guess_type(full)[0] or 'application/octet-stream'
    if ctype.startswith('text/') or ctype in ('application/javascript', 'application/json'):
        ctype += '; charset=utf-8'
    size = os.path.getsize(full)
    writer.write(('HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %d\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n' % (ctype, size)).encode())
    if not head_only:
        with open(full, 'rb') as f:
            while True:
                chunk = f.read(65536)
                if not chunk:
                    break
                writer.write(chunk)
                await writer.drain()
    await writer.drain()


def make_handler(port):
    async def handle(reader, writer):
        try:
            line = await asyncio.wait_for(reader.readline(), 15)
            if not line:
                writer.close()
                return
            parts = line.decode('latin-1').split()
            if len(parts) < 2:
                writer.close()
                return
            method, target = parts[0], parts[1]
            headers = {}
            while True:
                h = await asyncio.wait_for(reader.readline(), 15)
                if h in (b'\r\n', b'\n', b''):
                    break
                k, _, v = h.decode('latin-1').partition(':')
                headers[k.strip().lower()] = v.strip()
            path = urlparse(target).path
            if path == '/ws' and 'websocket' in headers.get('upgrade', '').lower():
                await websocket(reader, writer, headers)
                return
            await serve_file(writer, path, method == 'HEAD', port)
        except Exception:
            pass
        finally:
            try:
                writer.close()
            except Exception:
                pass
    return handle


async def main():
    port = next((int(a) for a in sys.argv[1:] if a.isdigit()), 8080)
    server = None
    for p in range(port, port + 20):
        try:
            server = await asyncio.start_server(make_handler(p), '0.0.0.0', p)
            port = p
            break
        except OSError:
            continue
    if not server:
        print('사용할 수 있는 포트를 찾지 못했어요.')
        return
    print('=' * 60)
    print('  에듀 크래프트 LAN 서버가 켜졌어요!')
    print('=' * 60)
    print('  이 컴퓨터에서:      http://localhost:%d' % port)
    for ip in local_ips():
        print('  같은 와이파이 기기:  http://%s:%d' % (ip, port))
    print('-' * 60)
    print('  * 다른 노트북/휴대폰 브라우저에 위 주소를 입력하세요.')
    print('  * 방화벽 허용 창이 뜨면 "허용"을 눌러 주세요.')
    print('  * 끄려면 이 창을 닫거나 Ctrl+C 를 누르세요.')
    print('=' * 60)
    try:
        if '--no-browser' not in sys.argv:
            webbrowser.open('http://localhost:%d' % port)
    except Exception:
        pass
    async with server:
        await server.serve_forever()


if __name__ == '__main__':
    try:
        if sys.platform == 'win32':
            try:
                sys.stdout.reconfigure(encoding='utf-8')
            except Exception:
                pass
        asyncio.run(main())
    except KeyboardInterrupt:
        print('\n서버를 껐어요.')
