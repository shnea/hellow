package kr.shnea.hellow;

import kr.shnea.hellow.customer.Customer;
import kr.shnea.hellow.customer.CustomerRepository;
import kr.shnea.hellow.queue.QueueItem;
import kr.shnea.hellow.queue.QueueItemRepository;
import kr.shnea.hellow.timeline.TimelineItem;
import kr.shnea.hellow.timeline.TimelineRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private final CustomerRepository customerRepository;
    private final QueueItemRepository queueItemRepository;
    private final TimelineRepository timelineRepository;

    public DataInitializer(CustomerRepository customerRepository,
                           QueueItemRepository queueItemRepository,
                           TimelineRepository timelineRepository) {
        this.customerRepository = customerRepository;
        this.queueItemRepository = queueItemRepository;
        this.timelineRepository = timelineRepository;
    }

    @Override
    public void run(String... args) {
        if (customerRepository.count() > 0) {
            return;
        }

        // 1. Initial Customers
        Customer cust1 = new Customer(
                "cust-1",
                Customer.CustomerType.CORPORATE,
                true,
                "김지우",
                "주식회사 테크솔루션",
                "경영총괄",
                "대표이사",
                "VIP",
                "010-8842-1205",
                "jw.kim@techsolution.kr",
                "이소연 선임 (본인)",
                "엔터프라이즈 v2.5 도입 협의 중, 기술 보안 질문서 검토 민감 고객",
                false
        );
        customerRepository.save(cust1);

        Customer custComp = new Customer(
                "cust-complainant",
                Customer.CustomerType.INDIVIDUAL,
                true,
                "최영수",
                "개인 고객",
                "",
                "일반 이용자",
                "Standard",
                "010-3341-8912",
                "ys.choi.personal@naver.com",
                "이소연 선임 (본인)",
                "결제 취소 지연 건으로 감정이 매우 격앙되어 있음. 정중하고 명확한 환불 일정 안내 필요 (주의 고객)",
                true
        );
        customerRepository.save(custComp);

        Customer custUnreg = new Customer(
                "cust-unregistered",
                Customer.CustomerType.INDIVIDUAL,
                false,
                "",
                "",
                "",
                "",
                "Standard",
                "010-7761-9923",
                "",
                "이소연 선임 (본인)",
                "",
                false
        );
        customerRepository.save(custUnreg);

        Customer cust2 = new Customer(
                "cust-2",
                Customer.CustomerType.CORPORATE,
                true,
                "박민호",
                "스마트물류시스템",
                "인프라개발실",
                "기술이사",
                "Gold",
                "010-2391-7741",
                "mh.park@smartlogis.co.kr",
                "이소연 선임 (본인)",
                "PostgreSQL 마이그레이션 기술 컨설팅 진행 중",
                false
        );
        customerRepository.save(cust2);

        // 2. Initial Queue Items
        queueItemRepository.save(new QueueItem(
                "queue-1",
                QueueItem.ItemType.CALL,
                Customer.CustomerType.CORPORATE,
                "김지우",
                "주식회사 테크솔루션",
                "010-8842-1205",
                "대기 01:28",
                "urgent",
                "엔터프라이즈 라이선스 갱신 및 WebRTC 연동 추가 문의 (인바운드 인입 중)",
                true,
                true,
                false
        ));

        queueItemRepository.save(new QueueItem(
                "queue-complainant",
                QueueItem.ItemType.CALL,
                Customer.CustomerType.INDIVIDUAL,
                "최영수",
                "개인 고객",
                "010-3341-8912",
                "대기 02:15",
                "urgent",
                "[긴급 컴플레인] 자동 결제 환불 5일 지연 강력 항의 및 즉시 승인 취소 요구",
                true,
                true,
                true
        ));

        queueItemRepository.save(new QueueItem(
                "queue-unregistered",
                QueueItem.ItemType.CALL,
                Customer.CustomerType.INDIVIDUAL,
                "미등록 고객",
                "신규 번호 인입",
                "010-7761-9923",
                "대기 00:45",
                "urgent",
                "서비스 이용 불만 상담 희망 (개인/일반 미등록 발신 번호)",
                true,
                false,
                false
        ));

        queueItemRepository.save(new QueueItem(
                "queue-2",
                QueueItem.ItemType.CALLBACK,
                Customer.CustomerType.CORPORATE,
                "박민호",
                "스마트물류시스템",
                "010-2391-7741",
                "오늘 14:30 약속",
                "urgent",
                "서버 이전 관련 데이터 마이그레이션 일정 재조율 요청",
                false,
                true,
                false
        ));

        // 3. Initial Timelines
        timelineRepository.save(new TimelineItem(
                "queue-1",
                TimelineItem.ChannelType.EMAIL,
                "한도윤 매니저",
                "엔터프라이즈 v2.5 견적서 및 보안 설문서 송부",
                "테크솔루션 보안 심의용 인프라 다이어그램 및 SOPS 암호화 보안 기준서를 첨부하여 이메일 송부 완료. 4월 초 대표 미팅 후 최종 라이선스 갱신 계약서 날인 예정.",
                false,
                null,
                "견적서발송,보안질문지,VIP"
        ));

        timelineRepository.save(new TimelineItem(
                "queue-1",
                TimelineItem.ChannelType.CALL,
                "이소연 선임",
                "정기 점검 사전 통화 (통화 완료: 05분 42초)",
                "통화 요약: LiveKit 실시간 음성 품질 점검 결과 양호. 분기 서버 유지보수 일정 안내하였으며 차주 중 추가 라이선스 상담 콜백 요청함.",
                true,
                "05:42",
                "정기점검,음질체크"
        ));

        timelineRepository.save(new TimelineItem(
                "queue-complainant",
                TimelineItem.ChannelType.CALL,
                "김상담 대리",
                "[컴플레인] 자동 결제 취소 요청 재접수",
                "고객이 3월 28일 정기 결제 해지 요청했으나 3월 31일 자동 청구됨. 5일째 환불 입금 확인 안 되어 심하게 불만 제기. 금일 중 회계팀 승인 약속함.",
                true,
                "08:14",
                "컴플레인,환불지연,주의고객"
        ));
    }
}
