package com.gymapp.module.attendance.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.common.PagedResponse;
import com.gymapp.module.attendance.dto.AbsentMemberResponse;
import com.gymapp.module.attendance.dto.AttendanceRecordResponse;
import com.gymapp.module.attendance.dto.CheckInRequest;
import com.gymapp.module.attendance.dto.CheckInResponse;
import com.gymapp.module.attendance.service.AttendanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
@Tag(name = "Attendance", description = "Member check-in and attendance tracking")
@SecurityRequirement(name = "bearerAuth")
public class AttendanceController {

    private final AttendanceService attendanceService;

    @PostMapping("/checkin")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Check in a member (supports QR code)")
    public ResponseEntity<ApiResponse<CheckInResponse>> checkIn(@Valid @RequestBody CheckInRequest request) {
        CheckInResponse response = attendanceService.checkIn(request);
        String message = response.isMembershipExpiredWarning() 
                ? "Checked in successfully. WARNING: Membership has expired!" 
                : "Checked in successfully.";
        return ResponseEntity.ok(ApiResponse.success(message, response));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF', 'TRAINER')")
    @Operation(summary = "Get attendance for a specific date")
    public ResponseEntity<ApiResponse<PagedResponse<AttendanceRecordResponse>>> getAttendance(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        LocalDate queryDate = date != null ? date : LocalDate.now();
        PagedResponse<AttendanceRecordResponse> response = attendanceService.getAttendanceByDate(
                queryDate, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "checkInTime")));
        
        return ResponseEntity.ok(ApiResponse.success("Attendance fetched successfully", response));
    }

    @GetMapping("/absent")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF', 'TRAINER')")
    @Operation(summary = "Get members absent for N or more days")
    public ResponseEntity<ApiResponse<PagedResponse<AbsentMemberResponse>>> getAbsentMembers(
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<AbsentMemberResponse> response = attendanceService.getAbsentMembers(days, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success("Absent members fetched successfully", response));
    }

    @GetMapping("/members/{memberId}")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF', 'TRAINER')")
    @Operation(summary = "Get a member's attendance history")
    public ResponseEntity<ApiResponse<PagedResponse<AttendanceRecordResponse>>> getMemberAttendanceHistory(
            @PathVariable String memberId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<AttendanceRecordResponse> response = attendanceService.getMemberAttendanceHistory(
                memberId, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "date", "checkInTime")));
        return ResponseEntity.ok(ApiResponse.success("Member attendance history fetched successfully", response));
    }
}
