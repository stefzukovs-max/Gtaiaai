#!/usr/bin/env python3
"""One-shot: carve game/lumen-harbor.html into src/.

Every piece is a verbatim byte range of the original, and src/manifest.json
records their order, so tools/build.py can concatenate them back into a
byte-identical file. Run once; after that, edit src/ and run the build.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'src')
GAME = os.path.join(ROOT, 'game', 'lumen-harbor.html')

# Titles that do not begin "LH.Something", named by hand so the tree reads.
OVERRIDE = {
    'LUMEN HARBOR':                    'css/00-tokens',
    'HUD.':                            'css/01-hud',
    'FRONT END':                       'css/02-front',
    'MOBILE FIRST.':                   'css/03-mobile',
    'The figure':                      'js/figure',
    'The districts':                   'js/districts',
    'THE CATALOGUE.':                  'js/catalogue',
    'Server handlers for the':         'js/activity-handlers',
    'Mission and social handlers':     'js/mission-handlers',
    'Realm handlers':                  'js/realm-handlers',
}


def name_for(title):
    for prefix, name in OVERRIDE.items():
        if title.startswith(prefix):
            return name
    m = re.match(r'LH\.([A-Za-z]+)', title)
    if m:
        return 'js/' + m.group(1)
    raise SystemExit('unnamed section: %r — add it to OVERRIDE' % title[:60])


def main():
    # Kept for provenance, not for reuse: src/ is the source now, and
    # re-running this would overwrite it with whatever the built file says.
    if os.path.exists(os.path.join(SRC, 'manifest.json')) and '--force' not in sys.argv:
        raise SystemExit('src/ already exists — this script has done its job. '
                         'Pass --force only if you mean to re-carve from game/.')
    raw = open(GAME, 'rb').read()
    lines = raw.split(b'\n')
    # byte offset of the start of each 1-based line
    off, at = [0, 0], 0
    for ln in lines:
        at += len(ln) + 1
        off.append(at)

    def find(pat):
        return [i + 1 for i, ln in enumerate(lines) if re.match(pat, ln.decode('utf8', 'replace'))]

    banners   = find(r'/\* ={10,}')
    style_at  = find(r'<style>$')[0]
    script_at = find(r'<script>$')[0]
    close_at  = find(r'</script>$')[0]

    # Cut points: the head ends at <style>, each banner starts a section,
    # the DOM shell sits between </style> and <script>, and the tail is
    # everything from </script>.
    cuts = [1, style_at + 1] + [b for b in banners] + [close_at]
    cuts = sorted(set(cuts))

    pieces = []
    for i, start in enumerate(cuts):
        end = cuts[i + 1] if i + 1 < len(cuts) else len(lines) + 1
        blob = raw[off[start]:off[end]] if end <= len(lines) else raw[off[start]:]
        if start == 1:
            path = 'shell/00-head.html'
        elif start == close_at:
            path = 'shell/02-tail.html'
        else:
            title = lines[start].decode('utf8', 'replace').strip()
            path = name_for(title) + ('.css' if start < script_at else '.js')
            # the DOM between </style> and <script> rides with the last CSS
            # section, so pull it into its own shell file instead
            if start < script_at <= end - 1:
                head_end = off[close_at]  # placeholder, fixed below
        pieces.append({'start': start, 'end': end, 'path': path, 'blob': blob})

    # Split the section that straddles </style>…<script> into css + shell.
    out = []
    for p in pieces:
        if p['start'] < script_at < p['end']:
            split_at = off[style_at + 1 + (0)]  # recomputed below
            cut = off[find(r'</style>$')[0]]
            out.append({'path': p['path'], 'blob': raw[off[p['start']]:cut]})
            out.append({'path': 'shell/01-body.html', 'blob': raw[cut:off[p['end']]]})
        else:
            out.append({'path': p['path'], 'blob': p['blob']})

    # number the js/css files in order so the tree sorts the way it builds
    n = {'js': 0, 'css': 0}
    manifest = []
    for p in out:
        path = p['path']
        d = path.split('/')[0]
        if d in n and not re.search(r'/\d\d-', path):
            base = path.split('/')[1]
            path = '%s/%02d-%s' % (d, n[d], base)
        if d in n:
            n[d] += 1
        full = os.path.join(SRC, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        open(full, 'wb').write(p['blob'])
        manifest.append(path)

    open(os.path.join(SRC, 'manifest.json'), 'w').write(
        json.dumps({'order': manifest}, indent=2) + '\n')
    print('wrote %d pieces' % len(manifest))
    for m in manifest:
        print('  ', m)


main()
