package com.gymapp.module.member.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.common.PagedResponse;
import com.gymapp.module.member.dto.CreateMemberRequest;
import com.gymapp.module.member.dto.MemberResponse;
import com.gymapp.module.member.dto.UpdateMemberRequest;
import com.gymapp.module.member.dto.MembershipResponse;
import com.gymapp.module.member.dto.RenewMembershipRequest;
import com.gymapp.module.member.service.MemberService;
import com.gymapp.module.member.service.PhotoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLConnection;

@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
@Tag(name = "Members", description = "Member management endpoints")
@SecurityRequirement(name = "bearerAuth")
public class MemberController {

    private final MemberService memberService;
    private final PhotoService photoService;

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Create a new member", description = "Creates a member and their first membership")
    public ResponseEntity<ApiResponse<MemberResponse>> createMember(
            @Valid @RequestBody CreateMemberRequest request) {
        MemberResponse response = memberService.createMember(request);
        return ResponseEntity.ok(ApiResponse.success("Member created successfully", response));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF', 'TRAINER')")
    @Operation(summary = "Get members", description = "Get paginated list of active members, optionally search by name/phone")
    public ResponseEntity<ApiResponse<PagedResponse<MemberResponse>>> getMembers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "All") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<MemberResponse> response = memberService.getMembers(search, status, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success("Members fetched successfully", response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF', 'TRAINER')")
    @Operation(summary = "Get member details")
    public ResponseEntity<ApiResponse<MemberResponse>> getMember(@PathVariable String id) {
        MemberResponse response = memberService.getMemberById(id);
        return ResponseEntity.ok(ApiResponse.success("Member details fetched successfully", response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Update member details")
    public ResponseEntity<ApiResponse<MemberResponse>> updateMember(
            @PathVariable String id,
            @Valid @RequestBody UpdateMemberRequest request) {
        MemberResponse response = memberService.updateMember(id, request);
        return ResponseEntity.ok(ApiResponse.success("Member updated successfully", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER')")
    @Operation(summary = "Soft delete a member")
    public ResponseEntity<ApiResponse<Void>> deleteMember(@PathVariable String id) {
        memberService.deleteMember(id);
        return ResponseEntity.ok(ApiResponse.success("Member deleted successfully"));
    }

    @PostMapping("/{id}/renew")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Renew a membership")
    public ResponseEntity<ApiResponse<MembershipResponse>> renewMembership(
            @PathVariable String id,
            @Valid @RequestBody RenewMembershipRequest request) {
        MembershipResponse response = memberService.renewMembership(id, request);
        return ResponseEntity.ok(ApiResponse.success("Membership renewed successfully", response));
    }

    @PostMapping(value = "/{id}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Upload member photo")
    public ResponseEntity<ApiResponse<String>> uploadPhoto(
            @PathVariable String id,
            @RequestParam("file") MultipartFile file) {
        String photoUrl = photoService.uploadPhoto(id, file);
        return ResponseEntity.ok(ApiResponse.success("Photo uploaded successfully", photoUrl));
    }

    @GetMapping("/{id}/photo")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF', 'TRAINER')")
    @Operation(summary = "Get member photo", description = "Serves the actual image file securely")
    public ResponseEntity<Resource> getPhoto(@PathVariable String id) {
        Resource file = photoService.loadPhotoAsResource(id);
        
        String mimeType = URLConnection.guessContentTypeFromName(file.getFilename());
        if (mimeType == null) {
            mimeType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mimeType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getFilename() + "\"")
                .body(file);
    }
}
