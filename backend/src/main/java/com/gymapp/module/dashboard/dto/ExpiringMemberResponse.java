package com.gymapp.module.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ExpiringMemberResponse {
    private String memberId;
    private String memberName;
    private String phone;
    private long daysLeft;
}
