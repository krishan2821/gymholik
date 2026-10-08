package com.gymapp.module.payment.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MemberDueResponse {
    private String memberId;
    private String memberCode;
    private String memberName;
    private String phone;
    private String membershipId;
    private long totalDuePaise;
}
