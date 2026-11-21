"""Runs every browser check in Chromium and WebKit. Dummy data only.

Usage (from anywhere):  python e2e/run_all.py [chromium] [webkit]
Starts its own Vite dev server on port 5173 and always stops it, including on failure.
"""
import os
import signal
import socket
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEV_PORT = 5173
DEV_SCRIPTS = ('setup_flow.py', 'restore_flow.py', 'share_flow.py')  # share_flow reuses restore_flow's backup file
BUILD_SCRIPTS = ('update_flow.py',)  # builds dist/ and serves it itself


def port_open(port: int) -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0


def start_dev_server() -> subprocess.Popen:
    if port_open(DEV_PORT):
        sys.exit(f'Port {DEV_PORT} is already in use; stop that server first.')
    kwargs = {'cwd': ROOT, 'stdout': subprocess.DEVNULL, 'stderr': subprocess.DEVNULL, 'shell': True}
    if os.name != 'nt':
        kwargs['start_new_session'] = True
    proc = subprocess.Popen(f'npx vite --port {DEV_PORT} --strictPort --host 127.0.0.1', **kwargs)
    deadline = time.time() + 60
    while not port_open(DEV_PORT):
        if proc.poll() is not None or time.time() > deadline:
            stop(proc)
            sys.exit('Dev server did not start.')
        time.sleep(0.5)
    return proc


def stop(proc: subprocess.Popen) -> None:
    """Stops the server and its children (npx spawns node, which a plain kill would leave running)."""
    if proc.poll() is not None:
        return
    if os.name == 'nt':
        subprocess.run(['taskkill', '/T', '/F', '/PID', str(proc.pid)], capture_output=True)
    else:
        os.killpg(proc.pid, signal.SIGTERM)
    proc.wait(timeout=10)


def run(engine: str, script: str) -> int:
    print(f'=== {engine}: {script}', flush=True)
    return subprocess.run([sys.executable, os.path.join(HERE, script)], env={**os.environ, 'ENGINE': engine}).returncode


def main() -> int:
    engines = sys.argv[1:] or ['chromium', 'webkit']
    failed = 0
    server = start_dev_server()
    try:
        for engine in engines:
            for script in DEV_SCRIPTS:
                failed |= run(engine, script)
    finally:
        stop(server)
    for engine in engines:
        for script in BUILD_SCRIPTS:
            failed |= run(engine, script)
    print('ALL PASSED' if not failed else 'SOME CHECKS FAILED')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
