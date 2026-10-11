package com.gymapp.module.auth.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GymAddress {
    private String line1;
    private String line2;
    private String state;
    private String district;
    private String pincode;
}
