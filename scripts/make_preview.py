import base64
import os

os.makedirs('docs/mocks', exist_ok=True)

comps = [
    ('a', 'A안 · 고객 맥락과 기록을 나란히 (3분할 고정)', '고객정보 23%, 상담 이력 32%, 실시간 기록 45%, 상단 통화 조작 고정', '.impeccable/mocks/decision/a.png'),
    ('b', 'B안 · 처리할 일과 상담 흐름 중심 (인바운드 큐 중심)', '좌측 처리 대기열 22%, 중앙 고객 및 실시간 상담 46%, 우측 과거 이력 및 후속 업무 32%', '.impeccable/mocks/decision/b.png'),
    ('c', 'C안 · 익숙한 CRM의 넓은 상담 기록 (표준 CRM)', '좌측 고객 요약, 중앙 상단 통화 및 넓은 서식 메모, 중앙 하단 전체 이력 그리드 표, 우측 빠른 액션', '.impeccable/mocks/decision/c.png')
]

cards_html = []
for key, title, desc, path in comps:
    with open(path, 'rb') as f:
        data = f.read()
        b64 = base64.b64encode(data).decode('utf-8')
    with open(f'docs/mocks/{key}.png', 'wb') as out_f:
        out_f.write(data)
    card = f"""    <section class="card">
      <div class="badge">옵션 {key.upper()}</div>
      <h2>{title}</h2>
      <p class="desc">{desc}</p>
      <div class="img-wrap">
        <img src="data:image/png;base64,{b64}" alt="{title}" />
      </div>
    </section>"""
    cards_html.append(card)

joined_cards = '\n'.join(cards_html)
full_html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>hellow 상담사 화면 UI 시안 3종 비교</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 40px 24px;
      line-height: 1.6;
    }}
    header {{
      max-width: 1400px;
      margin: 0 auto 36px;
      text-align: center;
    }}
    h1 {{ font-size: 2rem; font-weight: 700; margin-bottom: 8px; color: #ffffff; }}
    .subtitle {{ font-size: 1.1rem; color: #94a3b8; }}
    .container {{
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 48px;
    }}
    .card {{
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }}
    .badge {{
      display: inline-block;
      padding: 4px 12px;
      background: #3b82f6;
      color: #fff;
      font-weight: 700;
      font-size: 0.85rem;
      border-radius: 9999px;
      margin-bottom: 12px;
    }}
    .card h2 {{
      font-size: 1.4rem;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 6px;
    }}
    .card .desc {{
      color: #94a3b8;
      font-size: 0.95rem;
      margin-bottom: 20px;
    }}
    .img-wrap {{
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #475569;
      background: #000;
    }}
    .img-wrap img {{
      width: 100%;
      height: auto;
      display: block;
    }}
  </style>
</head>
<body>
  <header>
    <h1>hellow 상담사 작업 화면 UI 시안 비교</h1>
    <p class="subtitle">한 화면에서 고객정보·이력·통화 조작·상담 기록을 모두 처리하는 고밀도 워크스페이스</p>
  </header>
  <main class="container">
{joined_cards}
  </main>
</body>
</html>
"""

# ensure no trailing whitespace on any line
lines = [l.rstrip() for l in full_html.split('\n')]
clean_html = '\n'.join(lines) + '\n'

with open('docs/mocks/preview.html', 'w', encoding='utf-8') as f:
    f.write(clean_html)
print('preview.html cleaned and rewritten!')
