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

1. **TS = layer-first, Unity = object-first (의도된 두 단계).**
   - TS prototype: MVVM + FSM + Hexagonal 책임 계층(Input/Flow/Gameplay/Presentation/Audio/Persistence/Definitions/Asset)으로 분리. 엔티티별 *데이터 형태*는 별도 파일(`BlockState.ts` 등), 엔티티의 *충돌 응답* 은 `src/gameplay/entities/{Block,Bar,Wall}.ts` 가 소유. 이 분할은 Unity 포팅의 발판이지만 TS 자체로 "1 엔티티 1 GameObject" 는 아님.
   - Unity 포팅 (M4+): `GameObject` 가 Transform 을 소유, `BoxCollider2D` + `SpriteRenderer` + `BlockBehaviour` 등 컴포넌트가 그 Transform 에 종속. 성모님 원칙 ("오브젝트가 좌표를 소유, 콜리전과 스프라이트가 거기 종속") 이 컴포넌트 모델로 강제됨.
   - TS 의 `entities/{Block,Bar,Wall}.ts` 는 이미 Unity 의 entity component 매핑 형태를 *함수 모듈* 로 흉내내고 있다. Unity 가서는 MonoBehaviour 메서드로 그대로 옮긴다.
2. **상속 대신 컴포지션.** 기능 묶음은 작은 클래스/함수로 쪼개서 조합. C# 포팅 시 MonoBehaviour 여러 개 붙이는 식으로 대응.
3. **글로벌 상태 금지.** 싱글톤이나 모듈 레벨 변수로 상태 공유하지 말 것. 생성자/메서드 인자로 주입.
   (Unity에서 ScriptableObject나 의존성 주입으로 옮기기 쉬움)
4. **물리 로직은 프레임워크 API에 의존하지 말 것.** 충돌·반사·속도 계산은 순수 함수로 분리.
   Phaser 물리에 깊이 묶으면 Unity 포팅 시 다 뜯어야 함. 물리 튜닝 값은 `GameplayConfig.physics` 데이터로.
5. **레벨 데이터는 JSON/YAML로 외부화.** 블록 배치, 파워업 확률, 물리 튜닝 등은 코드에 하드코딩 금지.
   Unity에서 그대로 ScriptableObject나 JSON asset으로 재사용 가능해야 함.
6. **네이밍은 C# 관례에 가깝게.** 클래스 PascalCase, 메서드 camelCase (TS) → C#에서 PascalCase로 한 번에 치환 가능.
7. **객체가 자기 좌표/충돌/스프라이트의 단일 소스.** 두 레이어가 같은 데이터를 독립 해석하면 안 됨 (이를 어겨 발생한 좌표 드리프트 사례: architecture.md §14-3 좌표 규약 참조).

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
