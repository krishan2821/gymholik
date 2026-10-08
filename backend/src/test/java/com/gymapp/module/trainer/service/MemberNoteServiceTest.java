package com.gymapp.module.trainer.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.trainer.dto.MemberNoteRequest;
import com.gymapp.module.trainer.dto.MemberNoteResponse;
import com.gymapp.module.trainer.entity.MemberNote;
import com.gymapp.module.trainer.repository.MemberNoteRepository;
import com.gymapp.module.trainer.repository.TrainerAssignmentRepository;
import com.gymapp.security.JwtDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("MemberNoteService Unit Tests")
class MemberNoteServiceTest {

    @Mock MemberNoteRepository memberNoteRepository;
    @Mock MemberRepository memberRepository;
    @Mock UserRepository userRepository;
    @Mock TrainerAssignmentRepository trainerAssignmentRepository;

    @InjectMocks MemberNoteService memberNoteService;

    private static final String GYM_ID = "gym-test";
    private static final String TRAINER_ID = "trainer-1";
    private static final String MEMBER_ID = "member-1";

    @BeforeEach
    void setUp() {
        TenantContext.setGymId(GYM_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    private void authenticateAsTrainer() {
        var auth = new UsernamePasswordAuthenticationToken(TRAINER_ID, null,
                List.of(new SimpleGrantedAuthority("ROLE_TRAINER")));
        auth.setDetails(new JwtDetails(TRAINER_ID, GYM_ID, "TRAINER"));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void authenticateAsOwner() {
        var auth = new UsernamePasswordAuthenticationToken("owner-1", null,
                List.of(new SimpleGrantedAuthority("ROLE_OWNER")));
        auth.setDetails(new JwtDetails("owner-1", GYM_ID, "OWNER"));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("createNote — trainer creates note for actively assigned member")
    void testCreateNote_TrainerAssigned_Success() {
        authenticateAsTrainer();

        Member member = Member.builder().id(MEMBER_ID).gymId(GYM_ID).name("Alice").build();
        User trainer = User.builder().id(TRAINER_ID).name("Bob").build();

        when(memberRepository.findByIdAndGymId(MEMBER_ID, GYM_ID)).thenReturn(Optional.of(member));
        when(trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                GYM_ID, TRAINER_ID, MEMBER_ID, "ACTIVE")).thenReturn(true);
        when(memberNoteRepository.save(any(MemberNote.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findByIdAndGymId(TRAINER_ID, GYM_ID)).thenReturn(Optional.of(trainer));

        MemberNoteRequest req = new MemberNoteRequest();
        req.setType("WORKOUT");
        req.setText("Leg day completed");
        req.setWeightKg(72.5);

        MemberNoteResponse res = memberNoteService.createNote(MEMBER_ID, req);

        assertThat(res.getType()).isEqualTo("WORKOUT");
        assertThat(res.getText()).isEqualTo("Leg day completed");
        assertThat(res.getWeightKg()).isEqualTo(72.5);
    }

    @Test
    @DisplayName("createNote — trainer creating note for non-assigned member returns 404/not found")
    void testCreateNote_TrainerNotAssigned_ThrowsNotFound() {
        authenticateAsTrainer();

        Member member = Member.builder().id(MEMBER_ID).gymId(GYM_ID).name("Alice").build();

        when(memberRepository.findByIdAndGymId(MEMBER_ID, GYM_ID)).thenReturn(Optional.of(member));
        when(trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                GYM_ID, TRAINER_ID, MEMBER_ID, "ACTIVE")).thenReturn(false);

        MemberNoteRequest req = new MemberNoteRequest();
        req.setType("WORKOUT");
        req.setText("Attempting note on unassigned member");

        assertThatThrownBy(() -> memberNoteService.createNote(MEMBER_ID, req))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Member not found");
    }

    @Test
    @DisplayName("getNotes — trainer reading notes for non-assigned member returns 404/not found")
    void testGetNotes_TrainerNotAssigned_ThrowsNotFound() {
        authenticateAsTrainer();

        Member member = Member.builder().id(MEMBER_ID).gymId(GYM_ID).name("Alice").build();
        when(memberRepository.findByIdAndGymId(MEMBER_ID, GYM_ID)).thenReturn(Optional.of(member));
        when(trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                GYM_ID, TRAINER_ID, MEMBER_ID, "ACTIVE")).thenReturn(false);

        assertThatThrownBy(() -> memberNoteService.getNotesForMember(MEMBER_ID))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Member not found");
    }

    @Test
    @DisplayName("getNotes — owner can read notes for any member")
    void testGetNotes_Owner_Success() {
        authenticateAsOwner();

        Member member = Member.builder().id(MEMBER_ID).gymId(GYM_ID).name("Alice").build();
        MemberNote note = MemberNote.builder()
                .id("note-1")
                .gymId(GYM_ID)
                .memberId(MEMBER_ID)
                .trainerId(TRAINER_ID)
                .type("DIET")
                .text("High protein diet plan")
                .build();

        User trainer = User.builder().id(TRAINER_ID).name("Trainer Bob").build();

        when(memberRepository.findByIdAndGymId(MEMBER_ID, GYM_ID)).thenReturn(Optional.of(member));
        when(memberNoteRepository.findByGymIdAndMemberIdOrderByCreatedAtDesc(GYM_ID, MEMBER_ID))
                .thenReturn(List.of(note));
        when(userRepository.findByGymIdAndIdIn(GYM_ID, List.of(TRAINER_ID))).thenReturn(List.of(trainer));

        List<MemberNoteResponse> res = memberNoteService.getNotesForMember(MEMBER_ID);

        assertThat(res).hasSize(1);
        assertThat(res.get(0).getTrainerName()).isEqualTo("Trainer Bob");
        assertThat(res.get(0).getType()).isEqualTo("DIET");
    }
}
