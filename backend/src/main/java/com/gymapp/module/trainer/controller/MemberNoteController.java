package com.gymapp.module.trainer.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.trainer.dto.MemberNoteRequest;
import com.gymapp.module.trainer.dto.MemberNoteResponse;
import com.gymapp.module.trainer.service.MemberNoteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/members/{memberId}/notes")
@RequiredArgsConstructor
@Tag(name = "Member Notes", description = "Workout, diet, and progress notes by trainers and owners")
@SecurityRequirement(name = "bearerAuth")
public class MemberNoteController {

    private final MemberNoteService memberNoteService;

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER', 'TRAINER')")
    @Operation(summary = "Create a note for a member", description = "TRAINER (only for assigned members) or OWNER")
    public ResponseEntity<ApiResponse<MemberNoteResponse>> createNote(
            @PathVariable String memberId,
            @Valid @RequestBody MemberNoteRequest request) {
        MemberNoteResponse response = memberNoteService.createNote(memberId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Note created successfully", response));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER', 'TRAINER')")
    @Operation(summary = "List notes for a member", description = "TRAINER (only for assigned members) or OWNER")
    public ResponseEntity<ApiResponse<List<MemberNoteResponse>>> getNotes(@PathVariable String memberId) {
        List<MemberNoteResponse> response = memberNoteService.getNotesForMember(memberId);
        return ResponseEntity.ok(ApiResponse.success("Notes fetched successfully", response));
    }

    @PutMapping("/{noteId}")
    @PreAuthorize("hasAnyRole('OWNER', 'TRAINER')")
    @Operation(summary = "Update an existing note", description = "TRAINER (can edit own notes for assigned member) or OWNER")
    public ResponseEntity<ApiResponse<MemberNoteResponse>> updateNote(
            @PathVariable String memberId,
            @PathVariable String noteId,
            @Valid @RequestBody MemberNoteRequest request) {
        MemberNoteResponse response = memberNoteService.updateNote(memberId, noteId, request);
        return ResponseEntity.ok(ApiResponse.success("Note updated successfully", response));
    }
}
