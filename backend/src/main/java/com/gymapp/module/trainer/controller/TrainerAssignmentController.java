package com.gymapp.module.trainer.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.common.PagedResponse;
import com.gymapp.module.trainer.dto.AssignMembersRequest;
import com.gymapp.module.trainer.dto.AssignmentResponse;
import com.gymapp.module.trainer.dto.ReassignTrainerRequest;
import com.gymapp.module.trainer.service.TrainerAssignmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trainer-assignments")
@RequiredArgsConstructor
@Tag(name = "Trainer Assignments", description = "Member to Trainer assignments — OWNER only")
@SecurityRequirement(name = "bearerAuth")
public class TrainerAssignmentController {

    private final TrainerAssignmentService trainerAssignmentService;

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Assign member(s) to trainer (bulk)", description = "OWNER only")
    public ResponseEntity<ApiResponse<List<AssignmentResponse>>> assignMembers(
            @Valid @RequestBody AssignMembersRequest request) {
        List<AssignmentResponse> response = trainerAssignmentService.assignMembers(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Members assigned successfully", response));
    }

    @PostMapping("/{id}/end")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "End an assignment", description = "OWNER only")
    public ResponseEntity<ApiResponse<AssignmentResponse>> endAssignment(@PathVariable String id) {
        AssignmentResponse response = trainerAssignmentService.endAssignment(id);
        return ResponseEntity.ok(ApiResponse.success("Assignment ended successfully", response));
    }

    @PostMapping("/reassign")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Reassign all members from one trainer to another", description = "OWNER only")
    public ResponseEntity<ApiResponse<Void>> reassignAll(
            @Valid @RequestBody ReassignTrainerRequest request) {
        trainerAssignmentService.reassignAll(request);
        return ResponseEntity.ok(ApiResponse.success("Members reassigned successfully"));
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "List assignments", description = "OWNER only. Filter by trainerId, memberId, status.")
    public ResponseEntity<ApiResponse<PagedResponse<AssignmentResponse>>> getAssignments(
            @RequestParam(required = false) String trainerId,
            @RequestParam(required = false) String memberId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<AssignmentResponse> response = trainerAssignmentService.getAssignments(
                trainerId, memberId, status, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success("Assignments fetched successfully", response));
    }
}
