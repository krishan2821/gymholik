package com.gymapp.module.dashboard.service;

import com.gymapp.common.TenantContext;
import com.gymapp.module.dashboard.dto.DashboardResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import com.gymapp.module.dashboard.dto.DailyCollectionResponse;
import com.gymapp.module.dashboard.dto.ExpiringMemberResponse;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.member.entity.Member;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.aggregation.DateOperators;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final MongoTemplate mongoTemplate;
    
    private final Map<String, CachedDashboard> cache = new ConcurrentHashMap<>();

    private record CachedDashboard(DashboardResponse data, LocalDateTime expiry) {}

    public DashboardResponse getDashboardData() {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new com.gymapp.common.exception.AppException(
                    com.gymapp.common.exception.ErrorCode.ACCESS_DENIED, "Trainers cannot access the dashboard");
        }

        String gymId = TenantContext.getGymId();
        LocalDateTime now = LocalDateTime.now();

        // Check cache
        CachedDashboard cached = cache.get(gymId);
        DashboardResponse baseResponse;
        if (cached != null && now.isBefore(cached.expiry())) {
            baseResponse = cached.data();
        } else {
            baseResponse = computeDashboardData(gymId, now);
            cache.put(gymId, new CachedDashboard(baseResponse, now.plusSeconds(60)));
        }

        boolean isOwner = com.gymapp.security.SecurityUtils.isOwner();
        boolean staffCanSeeFull = false;
        if (com.gymapp.security.SecurityUtils.isStaff()) {
            Gym gym = mongoTemplate.findById(gymId, Gym.class);
            if (gym != null && gym.isStaffCanSeeFullPhone()) {
                staffCanSeeFull = true;
            }
        }
        boolean canSeeFullPhone = isOwner || staffCanSeeFull;

        List<ExpiringMemberResponse> mappedList = baseResponse.getExpiringSoonList().stream()
                .map(m -> ExpiringMemberResponse.builder()
                        .memberId(m.getMemberId())
                        .memberName(m.getMemberName())
                        .phone(canSeeFullPhone ? m.getPhone() : com.gymapp.common.PhoneMasker.mask(m.getPhone()))
                        .daysLeft(m.getDaysLeft())
                        .build())
                .collect(Collectors.toList());

        return DashboardResponse.builder()
                .activeMembers(baseResponse.getActiveMembers())
                .todayCollection(baseResponse.getTodayCollection())
                .monthCollection(baseResponse.getMonthCollection())
                .expiringSoon(baseResponse.getExpiringSoon())
                .expiringSoonList(mappedList)
                .newJoinings(baseResponse.getNewJoinings())
                .todayAttendance(baseResponse.getTodayAttendance())
                .totalDue(baseResponse.getTotalDue())
                .last7DaysCollection(baseResponse.getLast7DaysCollection())
                .subscriptionDaysRemaining(baseResponse.getSubscriptionDaysRemaining())
                .build();
    }

    private DashboardResponse computeDashboardData(String gymId, LocalDateTime now) {

        LocalDate today = LocalDate.now();
        LocalDateTime startOfToday = today.atStartOfDay();
        LocalDateTime endOfToday = today.plusDays(1).atStartOfDay();
        LocalDateTime startOfMonth = YearMonth.from(today).atDay(1).atStartOfDay();
        LocalDate next5Days = today.plusDays(5);
        LocalDateTime last7DaysStart = today.minusDays(6).atStartOfDay();

        // 1. Active Members
        var activeMembersFuture = java.util.concurrent.CompletableFuture.supplyAsync(() ->
            mongoTemplate.count(
                    new Query(Criteria.where("gymId").is(gymId).and("status").is("ACTIVE")),
                    "members")
        );

        // 2. Today Collection
        var todayColFuture = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            Aggregation todayColAgg = Aggregation.newAggregation(
                    Aggregation.match(Criteria.where("gymId").is(gymId)
                            .and("paidAt").gte(startOfToday).lt(endOfToday)
                            .and("type").is("PAYMENT")),
                    Aggregation.group().sum("amountPaise").as("total")
            );
            return getSumFromResult(mongoTemplate.aggregate(todayColAgg, "payments", Map.class));
        });

        // 3. Month Collection
        var monthColFuture = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            Aggregation monthColAgg = Aggregation.newAggregation(
                    Aggregation.match(Criteria.where("gymId").is(gymId)
                            .and("paidAt").gte(startOfMonth).lt(endOfToday)
                            .and("type").is("PAYMENT")),
                    Aggregation.group().sum("amountPaise").as("total")
            );
            return getSumFromResult(mongoTemplate.aggregate(monthColAgg, "payments", Map.class));
        });

        // 4. Expiring Soon List
        var expiringSoonFuture = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            List<Member> expiringMembers = mongoTemplate.find(
                    new Query(Criteria.where("gymId").is(gymId)
                            .and("currentExpiry").gte(today).lte(next5Days)
                            .and("status").is("ACTIVE")),
                    Member.class
            );
            
            return expiringMembers.stream().map(m -> ExpiringMemberResponse.builder()
                    .memberId(m.getId())
                    .memberName(m.getName())
                    .phone(m.getPhone())
                    .daysLeft(ChronoUnit.DAYS.between(today, m.getCurrentExpiry()))
                    .build()).collect(Collectors.toList());
        });

        // 5. New Joinings
        var newJoiningsFuture = java.util.concurrent.CompletableFuture.supplyAsync(() ->
            mongoTemplate.count(
                    new Query(Criteria.where("gymId").is(gymId)
                            .and("joiningDate").gte(startOfMonth.toLocalDate())),
                    "members")
        );

        // 6. Today Attendance
        var todayAttendanceFuture = java.util.concurrent.CompletableFuture.supplyAsync(() ->
            mongoTemplate.count(
                    new Query(Criteria.where("gymId").is(gymId).and("date").is(today)),
                    "attendances")
        );

        // 7. Total Due
        var totalDueFuture = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            Aggregation dueAgg = Aggregation.newAggregation(
                    Aggregation.match(Criteria.where("gymId").is(gymId).and("currentDuePaise").gt(0)),
                    Aggregation.group().sum("currentDuePaise").as("total")
            );
            return getSumFromResult(mongoTemplate.aggregate(dueAgg, "members", Map.class));
        });

        // 8. Last 7 Days Collection
        var last7DaysFuture = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            Aggregation agg = Aggregation.newAggregation(
                    Aggregation.match(Criteria.where("gymId").is(gymId)
                            .and("paidAt").gte(last7DaysStart).lt(endOfToday)
                            .and("type").is("PAYMENT")),
                    Aggregation.project("amountPaise")
                            .and(DateOperators.DateToString.dateOf("paidAt").toString("%Y-%m-%d").withTimezone(DateOperators.Timezone.valueOf("UTC"))).as("dateStr"),
                    Aggregation.group("dateStr").sum("amountPaise").as("totalAmount")
            );
            
            AggregationResults<Map> results = mongoTemplate.aggregate(agg, "payments", Map.class);
            Map<String, Long> mapped = results.getMappedResults().stream()
                    .collect(Collectors.toMap(
                            m -> (String) m.get("_id"),
                            m -> ((Number) m.get("totalAmount")).longValue()
                    ));
                    
            List<DailyCollectionResponse> dailyList = new ArrayList<>();
            for (int i = 6; i >= 0; i--) {
                LocalDate d = today.minusDays(i);
                long amount = mapped.getOrDefault(d.toString(), 0L);
                dailyList.add(DailyCollectionResponse.builder().date(d).amountPaise(amount).build());
            }
            return dailyList;
        });
        
        // 9. Subscription Days Remaining
        var subscriptionFuture = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            Gym gym = mongoTemplate.findById(gymId, Gym.class);
            if (gym != null && gym.getSubscriptionValidTill() != null) {
                long days = ChronoUnit.DAYS.between(today, gym.getSubscriptionValidTill());
                return Math.max(0, days);
            }
            return 0L;
        });

        java.util.concurrent.CompletableFuture.allOf(
                activeMembersFuture, todayColFuture, monthColFuture,
                expiringSoonFuture, newJoiningsFuture, todayAttendanceFuture, 
                totalDueFuture, last7DaysFuture, subscriptionFuture
        ).join();

        List<ExpiringMemberResponse> expiringList = expiringSoonFuture.join();

        DashboardResponse response = DashboardResponse.builder()
                .activeMembers(activeMembersFuture.join())
                .todayCollection(todayColFuture.join())
                .monthCollection(monthColFuture.join())
                .expiringSoon(expiringList.size())
                .expiringSoonList(expiringList)
                .newJoinings(newJoiningsFuture.join())
                .todayAttendance(todayAttendanceFuture.join())
                .totalDue(totalDueFuture.join())
                .last7DaysCollection(last7DaysFuture.join())
                .subscriptionDaysRemaining(subscriptionFuture.join())
                .build();

        return response;
    }

    private long getSumFromResult(AggregationResults<Map> results) {
        if (results.getMappedResults().isEmpty()) {
            return 0L;
        }
        Object total = results.getMappedResults().get(0).get("total");
        if (total instanceof Number n) {
            return n.longValue();
        }
        return 0L;
    }
}
