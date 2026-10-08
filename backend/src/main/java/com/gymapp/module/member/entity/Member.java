package com.gymapp.module.member.entity;

import com.gymapp.common.TenantDocument;
import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;

import lombok.experimental.SuperBuilder;

@Document(collection = "members")
@CompoundIndexes({
    @CompoundIndex(name = "gymId_phone_idx", def = "{'gymId': 1, 'phone': 1}", unique = true),
    @CompoundIndex(name = "gymId_memberCode_idx", def = "{'gymId': 1, 'memberCode': 1}", unique = true),
    @CompoundIndex(name = "gymId_status_idx", def = "{'gymId': 1, 'status': 1}"),
    @CompoundIndex(name = "gymId_status_lastAttendance_idx", def = "{'gymId': 1, 'status': 1, 'lastAttendanceDate': 1}"),
    @CompoundIndex(name = "gymId_createdAt_idx", def = "{'gymId': 1, 'createdAt': -1}")
})
@Getter @Setter @SuperBuilder @NoArgsConstructor @AllArgsConstructor
public class Member extends TenantDocument {
    private String memberCode;
    private String name;
    private String phone;
    private String gender;
    private LocalDate dob;
    private String address;
    private String photoPath;
    private LocalDate joiningDate;
    private String status;
    private LocalDate currentExpiry;
    private long currentDuePaise;
    private LocalDate lastAttendanceDate;
}
