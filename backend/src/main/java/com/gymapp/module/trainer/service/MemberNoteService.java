package com.gymapp.module.trainer.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.trainer.dto.MemberNoteRequest;
import com.gymapp.module.trainer.dto.MemberNoteResponse;
import com.gymapp.module.trainer.entity.MemberNote;
import com.gymapp.module.trainer.repository.MemberNoteRepository;
import com.gymapp.module.trainer.repository.TrainerAssignmentRepository;
import com.gymapp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MemberNoteService {

    private final MemberNoteRepository memberNoteRepository;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;
    private final TrainerAssignmentRepository trainerAssignmentRepository;

    @Transactional
    public MemberNoteResponse createNote(String memberId, MemberNoteRequest request) {
        String gymId = TenantContext.getGymId();
        String callerUserId = SecurityUtils.getCurrentUserId();

        Member member = memberRepository.findByIdAndGymId(memberId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        if (member.getStatus() != null && !"ACTIVE".equalsIgnoreCase(member.getStatus())) {
            throw new AppException(ErrorCode.MEMBER_INACTIVE, "Cannot create notes for inactive member");
        }

        if (SecurityUtils.isTrainer()) {
            boolean isAssigned = trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                    gymId, callerUserId, memberId, "ACTIVE");
            if (!isAssigned) {
                throw new AppException(ErrorCode.MEMBER_NOT_FOUND, "Member not found");
            }
        } else if (!SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Only trainers and owners can create member notes");
        }

        MemberNote note = MemberNote.builder()
                .gymId(gymId)
                .memberId(memberId)
                .trainerId(callerUserId)
                .type(request.getType().toUpperCase())
                .text(request.getText())
                .weightKg(request.getWeightKg())
                .bodyMeasurements(request.getBodyMeasurements())
                .build();

        note = memberNoteRepository.save(note);
        User author = userRepository.findByIdAndGymId(callerUserId, gymId).orElse(null);

        return mapToResponse(note, author != null ? author.getName() : null);
    }

    public List<MemberNoteResponse> getNotesForMember(String memberId) {
        String gymId = TenantContext.getGymId();
        String callerUserId = SecurityUtils.getCurrentUserId();

        Member member = memberRepository.findByIdAndGymId(memberId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        if (SecurityUtils.isTrainer()) {
            boolean isAssigned = trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                    gymId, callerUserId, memberId, "ACTIVE");
            if (!isAssigned) {
                throw new AppException(ErrorCode.MEMBER_NOT_FOUND, "Member not found");
            }
        } else if (!SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        List<MemberNote> notes = memberNoteRepository.findByGymIdAndMemberIdOrderByCreatedAtDesc(gymId, memberId);

        List<String> trainerIds = notes.stream().map(MemberNote::getTrainerId).distinct().toList();
        Map<String, String> authorNames = userRepository.findByGymIdAndIdIn(gymId, trainerIds).stream()
                .collect(Collectors.toMap(User::getId, User::getName));

        return notes.stream()
                .map(n -> mapToResponse(n, authorNames.get(n.getTrainerId())))
                .toList();
    }

    @Transactional
    public MemberNoteResponse updateNote(String memberId, String noteId, MemberNoteRequest request) {
        String gymId = TenantContext.getGymId();
        String callerUserId = SecurityUtils.getCurrentUserId();

        Member member = memberRepository.findByIdAndGymId(memberId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        if (SecurityUtils.isTrainer()) {
            boolean isAssigned = trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                    gymId, callerUserId, memberId, "ACTIVE");
            if (!isAssigned) {
                throw new AppException(ErrorCode.MEMBER_NOT_FOUND, "Member not found");
            }
        } else if (!SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        MemberNote note = memberNoteRepository.findByIdAndGymId(noteId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Note not found"));

        if (!note.getMemberId().equals(memberId)) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Note not found");
        }

        // Only author trainer or OWNER can edit note
        if (SecurityUtils.isTrainer() && !callerUserId.equals(note.getTrainerId())) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "You can only edit your own notes");
        }

        note.setType(request.getType().toUpperCase());
        note.setText(request.getText());
        note.setWeightKg(request.getWeightKg());
        note.setBodyMeasurements(request.getBodyMeasurements());

        note = memberNoteRepository.save(note);
        User author = userRepository.findByIdAndGymId(note.getTrainerId(), gymId).orElse(null);
        return mapToResponse(note, author != null ? author.getName() : null);
    }

    private MemberNoteResponse mapToResponse(MemberNote note, String trainerName) {
        return MemberNoteResponse.builder()
                .id(note.getId())
                .memberId(note.getMemberId())
                .trainerId(note.getTrainerId())
                .trainerName(trainerName)
                .type(note.getType())
                .text(note.getText())
                .weightKg(note.getWeightKg())
                .bodyMeasurements(note.getBodyMeasurements())
                .createdAt(note.getCreatedAt())
                .build();
    }
}
