# Published Prompt Portal

출간 도서에 수록된 프롬프트와 출처를 제공하는 정적 사이트입니다. 운영 주소는 https://nanalab.kr/ppp/ 입니다.

## 콘텐츠 원본

- `content/books.json`: 도서 ID, 출간명, 저자, 출판사, 연도, 표지, 서점 링크를 한 번만 저장합니다.
- `content/prompts/{book_id}.json`: 프롬프트 본문, 분류, 순서, 도서 참조, 대화 묶음을 저장합니다.
- `content/integrity.json`: 본문의 SHA-256과 전체 건수를 검증합니다. 본문 수정 시에는 출처를 대조한 뒤 해당 해시를 함께 갱신해야 합니다.
- `templates/`: 공통 HTML과 등재 요청 안내 원본입니다.
- `src/js/`, `style.css`: 동작과 스타일 원본입니다.

생성된 HTML, `src/generated/`, `src/prompts/all.json`, `script.js`, `sitemap.xml`, `generated-manifest.json`은 직접 편집하지 않습니다. `src/prompts/all.json`은 이전 클라이언트용 호환 내보내기이며 현재 화면에서는 불러오지 않습니다. 분류별 중복 JSON은 제거했습니다.

## 빌드와 검증

Python 3.10 이상과 JavaScript 문법 검사용 Node.js가 필요합니다. 사이트 생성에는 외부 Python 패키지가 필요하지 않습니다.

```sh
python scripts/build_site.py
python scripts/build_site.py --check
python scripts/validate_content.py
node --check script.js
git diff --check
```

Windows 작업공간에서는 AGENTS.md의 지정 RTK 실행 파일로 명령 출력을 압축합니다. 압축 출력이 불충분한 경우 `rtk bypass`로 원문과 종료 코드를 확인합니다. CI는 생성물 일치, 본문 무결성, 내부 링크, 표지, 출처 쪽수, 메타데이터와 사이트맵을 검사합니다.

GitHub Pages는 main의 생성된 파일을 배포합니다. `.nojekyll`로 프롬프트 본문이 템플릿 언어로 해석되는 것을 방지합니다. 새 데이터 반영 후 반드시 빌드·검증 결과와 함께 커밋합니다.

## URL과 데이터 로딩

- `/ppp/`: 최근 추가 10개 대화 묶음.
- `/ppp/prompts/`: 전체 목록, 페이지당 20개 대화 묶음.
- `/ppp/prompts/{group_id}/`: 전체 입력 순서와 출처를 담은 상세 HTML.
- `/ppp/books/`, `/ppp/books/{book_id}/`: 출처 도서와 도서별 목록.
- `/ppp/categories/{category}/`: 분류별 목록.
- `/ppp/search/?q=...`: 검색. 질의가 있을 때만 검색 색인을 불러옵니다.

본문과 탐색 링크는 HTML에 포함되어 JavaScript 없이 읽을 수 있습니다. 팝업은 클릭한 대화 묶음의 JSON만 요청합니다. CSS·JS·데이터 파일명에 콘텐츠 해시를 사용하며 매 요청에 시간값을 붙여 캐시를 무효화하지 않습니다.

상세·도서·분류 페이지는 고유 title, description, canonical과 소셜 메타데이터를 갖습니다. 상세에는 CreativeWork와 출처 Book, 탐색 경로에는 BreadcrumbList를 제공합니다. 짧은 독립 응답 138건과 검색 화면은 `noindex,follow`로 유지합니다. 실제 검색 등록 여부와 순위는 별도 검색엔진 처리 결과입니다. 사이트맵은 `/ppp/sitemap.xml`입니다.

## 대화 순서와 본문 쪽수

`group_id`는 첫 프롬프트의 ID를 가리킵니다. 같은 묶음의 `sequence`는 입력 순서를 나타내며 도서를 넘어서 연결할 수 없습니다. 상세 URL의 소문자 ID는 생성 시 사용하고 원본 ID는 유지합니다. 후속 입력은 `#turn-{id}`로 직접 연결할 수 있습니다.

`printed_page`는 PDF를 렌더링하여 본문에 실제 인쇄된 쪽수를 확인한 경우에만 정수로 기록하고 `page_verified: true`를 함께 지정합니다. 화면에는 `본문 56p.` 형식으로 표시합니다. PDF 뷰어 순번과 펼침면에서 계산한 추정치는 사용하지 않습니다. 확인하지 못한 경우 두 필드를 생략합니다.

서점 링크에는 로고만 표시하고 스크린리더용 이름을 제공합니다. 같은 맥락을 준비하라는 반복 안내는 제거했습니다. 실제 사용에 필요한 구체적인 원문 주석은 유지합니다.

## 기존 제출 양식 가져오기

`update_rule/sample.zip`의 두 시트 양식을 계속 지원합니다. 가져오기에만 `pandas`, `openpyxl`이 필요합니다.

```sh
python update_data.py submission.xlsx --dry-run
python update_data.py submission.xlsx
python update_data.py new-book.xlsx --book-id new-book --dry-run
```

기존 도서는 출간명으로 연결합니다. 새 도서에는 `--book-id`와 유효한 서지정보·표지·서점 링크가 필요합니다. 분류와 중복 본문을 확인하며 원본 JSON에만 추가한 후 빌드와 검증을 실행합니다. 실패하면 이번 가져오기의 원본 변경을 되돌리고 생성물도 복원합니다. 제출 양식의 페이지 숫자를 인쇄 쪽수로 자동 변환하지 않습니다. 대화 묶음과 확인된 쪽수는 검토 후 원본에 지정합니다.
