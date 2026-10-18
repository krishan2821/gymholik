package com.gymapp.module.payment.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MemberPaymentContextResponse {
    private String memberId;
    private String memberName;
    private String memberCode;
    private String phone;
    private long totalDuePaise;
    private List<MembershipDueItem> memberships;
}
