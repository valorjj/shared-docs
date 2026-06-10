export type LegalDoc = 'privacy' | 'terms'

export type LegalSection = { heading: string; paragraphs: string[] }

export type LegalContent = {
  title: string
  updated: string
  sections: LegalSection[]
}

export const LEGAL_CONTENT: Record<LegalDoc, LegalContent> = {
  privacy: {
    title: '개인정보 처리방침',
    updated: '시행일: 2026년 6월 10일',
    sections: [
      { heading: '수집하는 정보', paragraphs: [
        'Google 계정으로 로그인할 때 이메일 주소, 이름, 프로필 사진을 받습니다.',
        '서비스를 이용하며 작성한 메모, 시트, 계산 기록, 그 밖의 콘텐츠가 저장됩니다.',
      ]},
      { heading: '이용 목적', paragraphs: [
        '수집한 정보는 로그인과 본인 식별, 그리고 워크스페이스 데이터를 제공하는 데에만 사용합니다.',
      ]},
      { heading: '보관과 파기', paragraphs: [
        '모든 데이터는 자체 서버에 비공개로 저장됩니다.',
        '계정이나 콘텐츠를 삭제하면 관련 데이터도 함께 삭제됩니다.',
      ]},
      { heading: '제3자 제공', paragraphs: [
        '수집한 정보를 판매하거나 외부에 제공하지 않습니다. Google 로그인은 인증 목적에만 사용됩니다.',
      ]},
      { heading: '문의', paragraphs: [
        '개인정보 관련 문의는 jeongjin@ecoletree.com 으로 보내주세요.',
        '본 서비스는 비상업적 개인 프로젝트입니다.',
      ]},
    ],
  },
  terms: {
    title: '이용약관',
    updated: '시행일: 2026년 6월 10일',
    sections: [
      { heading: '서비스 제공', paragraphs: [
        '본 서비스는 "있는 그대로" 제공되며, 가용성이나 정확성을 보장하지 않습니다.',
        '비상업적 개인 프로젝트로 운영되며, 사전 고지 없이 변경되거나 중단될 수 있습니다.',
      ]},
      { heading: '이용자의 책임', paragraphs: [
        '이용자는 불법이거나 타인의 권리를 침해하는 콘텐츠를 게시하지 않습니다.',
        '작성한 콘텐츠에 대한 책임은 이용자 본인에게 있습니다.',
      ]},
      { heading: '이용 제한', paragraphs: [
        '약관을 위반하거나 운영상 필요한 경우 계정 이용이 제한될 수 있습니다.',
      ]},
      { heading: '준거', paragraphs: [
        '본 약관은 한국어를 기준으로 해석합니다.',
      ]},
    ],
  },
}
