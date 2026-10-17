# 쇼호스트 이채원 · moshim.kr/chaewon

모심(moshim) 프로젝트로 만든 쇼호스트 이채원의 경력·소개 페이지.

- 페이지: `chaewon/` (정적 HTML · CSS · ES 모듈, 빌드 단계 없음)
- 모션: GSAP 3.15(ScrollTrigger · SplitText · Flip · DrawSVG · MorphSVG · ScrambleText) · Lenis · WebGL 셰이더 2종 · 캔버스 하트 파티클. 라이브러리와 Pretendard 폰트는 `chaewon/vendor`, `chaewon/fonts`에 들어 있어 외부 CDN이 필요 없다.
- 이미지: `python3 tools/build_assets.py` 가 `source/`(로컬 전용, 커밋하지 않음)의 원본 사진과 쇼호스트 PDF에서 `chaewon/img/*.webp`, `chaewon/og.jpg`를 만든다. 메인 사진 누끼는 `tools/liftmask.swift`(macOS Vision)로 마스크를 뽑고 `tools/refine_cut.py`로 다듬는다.
- 배포: GitHub Pages(`main` 브랜치 루트). 루트 `index.html`은 `chaewon/`으로 넘겨 준다. 커스텀 도메인은 `moshim.kr`.
