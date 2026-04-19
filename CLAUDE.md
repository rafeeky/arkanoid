# Arkanoid — TypeScript Prototype → Unity C# Port

## Project intent

TypeScript로 2D 알카노이드 프로토타입을 빠르게 만들고, 이후 Unity(C#)로 포팅하는 2단계 프로젝트.
개발자는 퀘스트/레벨 디자이너 출신. 코드 구조는 "Unity MonoBehaviour로 옮기기 쉬움"이 1순위 우선.

## Stack

- TypeScript (strict mode)
- Phaser 3 또는 PixiJS (상황 보고 결정, 기본은 Phaser 3)
- Vite (dev server + bundler)
- Node LTS

## Architecture rules (포팅 친화)

1. **엔티티는 독립 컴포넌트로 분리.** 공·패들·블록·파워업·레벨은 각각 자기 파일, 자기 클래스.
   Unity에서 1 파일 = 1 MonoBehaviour로 대응시킬 수 있게.
2. **상속 대신 컴포지션.** 기능 묶음은 작은 클래스로 쪼개서 조합. C# 포팅 시 MonoBehaviour 여러 개 붙이는 식으로 대응.
3. **글로벌 상태 금지.** 싱글톤이나 모듈 레벨 변수로 상태 공유하지 말 것. 생성자/메서드 인자로 주입.
   (Unity에서 ScriptableObject나 의존성 주입으로 옮기기 쉬움)
4. **물리 로직은 프레임워크 API에 의존하지 말 것.** 충돌·반사·속도 계산은 순수 함수로 분리.
   Phaser 물리에 깊이 묶으면 Unity 포팅 시 다 뜯어야 함.
5. **레벨 데이터는 JSON/YAML로 외부화.** 블록 배치, 파워업 확률 등은 코드에 하드코딩 금지.
   Unity에서 그대로 ScriptableObject나 JSON asset으로 재사용 가능해야 함.
6. **네이밍은 C# 관례에 가깝게.** 클래스 PascalCase, 메서드 camelCase (TS) → C#에서 PascalCase로 한 번에 치환 가능.

## What NOT to do

- Phaser의  같은 호출을 게임 로직 안에 섞지 말 것. 렌더/게임로직 레이어 분리.
- DOM 직접 조작 금지 (캔버스 밖 UI라도 추상화 레이어 둘 것).
- TS-only 기능 (decorator 실험 기능, 유니온 타입 남발) 최소화. C#으로 옮길 때 고생함.

## Current status

프로젝트 초기 상태. 아직 package.json 없음.

## Commit convention

모든 커밋 메시지는 Conventional Commits(영문) + **한글 작업 요약 trailer**를 포함한다.

포맷:
```
<type>(<scope>): <summary>

- English bullet points of changes

Agent: <에이전트 이름>
작업: <한 줄 한글 요약>
세부: <3~5줄 한글 세부 설명. 변경 파일 요지, 수정 의도>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

- `<에이전트 이름>`은 실제 작업한 sub-agent (`core-logic-engineer`, `view-engineer`, `tester`, `arkanoid-lead` 중 하나). 여러 에이전트가 참여한 경우 `core-logic-engineer + view-engineer`처럼 병기.
- 한글 trailer는 필수. 영문 섹션만 있는 커밋은 만들지 않는다.
- 커밋 메시지는 HEREDOC으로 작성해 포맷 유지.
