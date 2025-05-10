// ─── 페르소나별 UI 텍스트 상수 ────────────────────────────────────────────────────

// 삭제/수정 확인 다이얼로그 텍스트. 선택된 페르소나에 따라 말투가 달라짐
export const PERSONA_CONFIRM = {
  friend: {
    deleteMsg:  '진짜 지울 거야?',
    confirmBtn: '응, 지울게',
    cancelBtn:  '아 아니야',
  },
  mentor: {
    deleteMsg:  '한번 더 생각해봐. 지우면 못 돌려.',
    confirmBtn: '그래도 지울게',
    cancelBtn:  '생각해볼게',
  },
  counselor: {
    deleteMsg:  '삭제하시겠어요? 되돌릴 수 없어요.',
    confirmBtn: '삭제합니다',
    cancelBtn:  '취소할게요',
  },
  cheerleader: {
    deleteMsg:  '진짜진짜 지울 거야?! 나중에 후회하면 어떡해!',
    confirmBtn: '지운다!!!',
    cancelBtn:  '안 지울래!',
  },
  simsimi: {
    deleteMsg:  '허허... 진짜 지워버릴 거야?',
    confirmBtn: 'ㅇㅇ 지워',
    cancelBtn:  'ㄴㄴ 둬',
  },
  realist: {
    deleteMsg:  '진짜 삭제할 거야? 다신 못 돌려.',
    confirmBtn: '지운다',
    cancelBtn:  '취소',
  },
};
