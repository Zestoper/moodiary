from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey  # 필요한 컬럼 타입들
from sqlalchemy.sql import func                                              # SQL 함수 (현재 시각 등)
from sqlalchemy.orm import relationship                                      # 테이블 간 관계 정의
from ..core.database import Base                                             # 모든 모델의 부모 클래스


class Consultation(Base):
    __tablename__ = "consultations"  # MySQL에서 생성될 테이블 이름

    id = Column(Integer, primary_key=True, index=True)  # 상담 고유 ID. 자동 증가
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # 어느 유저의 상담인지
    situation = Column(Text, nullable=False)        # 유저가 입력한 상황 설명. 예: "남자친구가 연락을 안 해요"
    my_action = Column(Text, nullable=True)         # 내가 한 행동. 선택 입력
    partner_action = Column(Text, nullable=True)    # 상대방이 한 행동. 선택 입력
    # verdict: Claude가 판단한 잘잘못 결과. 예: "당신 잘못", "상대방 잘못", "둘 다 잘못"
    verdict = Column(String(50), nullable=True)     # 판정 결과. Claude 응답 후 채워짐
    message_script = Column(Text, nullable=True)    # Claude가 생성한 화해 문자 스크립트. Claude 응답 후 채워짐
    created_at = Column(DateTime, server_default=func.now())  # 상담 생성 시각. 자동 입력

    # relationship: consultation.user 로 연결된 User 객체에 바로 접근 가능
    # backref="consultations": user.consultations 로 유저의 상담 목록도 접근 가능
    user = relationship("User", backref="consultations")
