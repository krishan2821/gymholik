package com.gymapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.module.auth.dto.*;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.member.dto.CreateMemberRequest;
import com.gymapp.module.plan.dto.PlanRequest;
import com.gymapp.module.trainer.dto.ApproveTrainerRequest;
import com.gymapp.module.trainer.dto.AssignMembersRequest;
import com.gymapp.module.trainer.dto.CreateTrainerRequest;
import com.gymapp.module.trainer.dto.MemberNoteRequest;
import com.gymapp.module.trainer.dto.ReassignTrainerRequest;
import com.gymapp.module.trainer.dto.UpdateTrainerRequest;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestPropertySource(properties = "app.otp.dev-fixed-code=123456")
public class TrainerAccessIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

    private String gymA_Id;
    private String gymB_Id;
    private String gymA_OwnerToken;
    private String gymB_OwnerToken;

    private String gymA_PlanId;
    private String gymB_PlanId;

    private String gymA_M1_Id;
    private String gymA_M2_Id;
    private String gymB_MB_Id;

    private String gymA_TypeId;
    private String gymB_TypeId;

    private String gymA_TrainerId;
    private String gymB_TrainerId;
    private String gymA_TrainerToken;
    private String gymB_TrainerToken;

    private String gymA_StaffId;
    private String gymA_StaffToken;

    private String gymA_Assignment_M1_Id;

    @BeforeAll
    void setup() throws Exception {
        // 1. Register Gym A + Owner A via OTP complete-registration
        JsonNode dataA = registerGymViaOtpToken(
                mockMvc, objectMapper, "Alpha Gym", "Alpha Owner", "9851111111", "alpha@gym.com");
        gymA_Id = dataA.path("user").path("gymId").asText();
        gymA_OwnerToken = "Bearer " + dataA.path("accessToken").asText();

        // 2. Register Gym B + Owner B via OTP complete-registration
        JsonNode dataB = registerGymViaOtpToken(
                mockMvc, objectMapper, "Beta Gym", "Beta Owner", "9852222222", "beta@gym.com");
        gymB_Id = dataB.path("user").path("gymId").asText();
        gymB_OwnerToken = "Bearer " + dataB.path("accessToken").asText();

        // 3. Create Plans
        gymA_PlanId = createPlan(gymA_OwnerToken, "Plan Alpha");
        gymB_PlanId = createPlan(gymB_OwnerToken, "Plan Beta");

        // 4. Create Members
        gymA_M1_Id = createMember(gymA_OwnerToken, "Member One", "9850000001", LocalDate.of(1995, 3, 25), "101 Alpha Rd", gymA_PlanId);
        gymA_M2_Id = createMember(gymA_OwnerToken, "Member Two", "9850000002", LocalDate.of(1997, 7, 14), "202 Alpha Rd", gymA_PlanId);
        gymB_MB_Id = createMember(gymB_OwnerToken, "Member Beta", "9850000003", LocalDate.of(1996, 5, 10), "303 Beta Blvd", gymB_PlanId);

        // 5. Create ACTIVE Trainer A in Gym A via POST /api/trainers (no immediate members)
        MvcResult typesA = mockMvc.perform(get("/api/trainer-types")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk()).andReturn();
        gymA_TypeId = objectMapper.readTree(typesA.getResponse().getContentAsString()).path("data").get(0).path("id").asText();

        CreateTrainerRequest createTrainerA = CreateTrainerRequest.builder()
                .name("Trainer Alpha")
                .phone("9859999991")
                .trainerTypeIds(List.of(gymA_TypeId))
                .build();
        MvcResult trainerARes = mockMvc.perform(post("/api/trainers")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createTrainerA)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status", is("ACTIVE")))
                .andExpect(jsonPath("$.data.active", is(true)))
                .andReturn();
        gymA_TrainerId = objectMapper.readTree(trainerARes.getResponse().getContentAsString()).path("data").path("id").asText();
        gymA_TrainerToken = bearerTokenForUser(gymA_TrainerId, gymA_Id, "TRAINER");

        // 6. Create ACTIVE Trainer B in Gym B via POST /api/trainers
        MvcResult typesB = mockMvc.perform(get("/api/trainer-types")
                .header("Authorization", gymB_OwnerToken))
                .andExpect(status().isOk()).andReturn();
        gymB_TypeId = objectMapper.readTree(typesB.getResponse().getContentAsString()).path("data").get(0).path("id").asText();

        CreateTrainerRequest createTrainerB = CreateTrainerRequest.builder()
                .name("Trainer Beta")
                .phone("9859999992")
                .trainerTypeIds(List.of(gymB_TypeId))
                .build();
        MvcResult trainerBRes = mockMvc.perform(post("/api/trainers")
                .header("Authorization", gymB_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createTrainerB)))
                .andExpect(status().isCreated())
                .andReturn();
        gymB_TrainerId = objectMapper.readTree(trainerBRes.getResponse().getContentAsString()).path("data").path("id").asText();
        gymB_TrainerToken = bearerTokenForUser(gymB_TrainerId, gymB_Id, "TRAINER");

        // 7. Create Staff A in Gym A via POST /api/staff
        CreateStaffRequest staffReq = new CreateStaffRequest();
        staffReq.setName("Staff Alpha");
        staffReq.setPhone("9858888881");
        MvcResult staffARes = mockMvc.perform(post("/api/staff")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(staffReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.role", is("STAFF")))
                .andExpect(jsonPath("$.data.status", is("ACTIVE")))
                .andReturn();
        gymA_StaffId = objectMapper.readTree(staffARes.getResponse().getContentAsString()).path("data").path("id").asText();
        gymA_StaffToken = bearerTokenForUser(gymA_StaffId, gymA_Id, "STAFF");
    }

    private String createPlan(String token, String name) throws Exception {
        PlanRequest req = new PlanRequest();
        req.setName(name);
        req.setDurationDays(30);
        req.setPricePaise(150000L);
        MvcResult res = mockMvc.perform(post("/api/plans")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).path("data").path("id").asText();
    }

    private String createMember(String token, String name, String phone, LocalDate dob, String address, String planId) throws Exception {
        CreateMemberRequest req = new CreateMemberRequest();
        req.setName(name);
        req.setPhone(phone);
        req.setGender("MALE");
        req.setDob(dob);
        req.setAddress(address);
        req.setPlanId(planId);
        MvcResult res = mockMvc.perform(post("/api/members")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).path("data").path("id").asText();
    }

    @Test
    @Order(1)
    void test1_trainerWithNoAssignments_seesEmptyMembersList() throws Exception {
        // A trainer with no assignments sees an empty members list
        mockMvc.perform(get("/api/members")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(0)))
                .andExpect(jsonPath("$.data.totalElements", is(0)));
    }

    @Test
    @Order(2)
    void test2_ownerAssignsM1NotM2_trainerSeesOnlyM1_M2Returns404_searchM2ReturnsNothing() throws Exception {
        // Owner assigns member M1 but not M2
        AssignMembersRequest assignReq = new AssignMembersRequest();
        assignReq.setTrainerId(gymA_TrainerId);
        assignReq.setMemberIds(List.of(gymA_M1_Id));
        assignReq.setNotes("First assignment");

        MvcResult assignRes = mockMvc.perform(post("/api/trainer-assignments")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(assignReq)))
                .andExpect(status().isCreated()).andReturn();

        gymA_Assignment_M1_Id = objectMapper.readTree(assignRes.getResponse().getContentAsString())
                .path("data").get(0).path("id").asText();

        // Trainer sees only M1 in members list
        mockMvc.perform(get("/api/members")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].id", is(gymA_M1_Id)))
                .andExpect(jsonPath("$.data.content[0].name", is("Member One")));

        // GET M2 returns 404
        mockMvc.perform(get("/api/members/" + gymA_M2_Id)
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isNotFound());

        // Searching M2's name returns nothing
        mockMvc.perform(get("/api/members?search=Member Two")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(0)))
                .andExpect(jsonPath("$.data.totalElements", is(0)));

        // Searching M2's phone returns nothing
        mockMvc.perform(get("/api/members?search=9850000002")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(0)))
                .andExpect(jsonPath("$.data.totalElements", is(0)));

        // Searching M1 returns M1
        mockMvc.perform(get("/api/members?search=Member One")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].id", is(gymA_M1_Id)));
    }

    @Test
    @Order(3)
    void test3_trainerResponseJson_neverContainsRawPhoneAddressOrDob() throws Exception {
        // Assert on GET member by ID
        MvcResult res = mockMvc.perform(get("/api/members/" + gymA_M1_Id)
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.phone", is("XXXXXX0001")))
                .andExpect(jsonPath("$.data.address").doesNotExist())
                .andExpect(jsonPath("$.data.dob").doesNotExist())
                .andReturn();

        String rawJson = res.getResponse().getContentAsString();
        assertThat(rawJson).doesNotContain("9850000001");
        assertThat(rawJson).doesNotContain("101 Alpha Rd");
        assertThat(rawJson).doesNotContain("1995-03-25");
        assertThat(rawJson).contains("XXXXXX0001");

        // Assert on GET members list
        MvcResult listRes = mockMvc.perform(get("/api/members")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].phone", is("XXXXXX0001")))
                .andExpect(jsonPath("$.data.content[0].address").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].dob").doesNotExist())
                .andReturn();

        String listRawJson = listRes.getResponse().getContentAsString();
        assertThat(listRawJson).doesNotContain("9850000001");
        assertThat(listRawJson).doesNotContain("101 Alpha Rd");
        assertThat(listRawJson).doesNotContain("1995-03-25");
        assertThat(listRawJson).contains("XXXXXX0001");
    }

    @Test
    @Order(4)
    void test4_staffResponseMaskedByDefault_showsFullPhoneOnlyAfterOwnerEnablesSetting_trainerNeverSeesIt() throws Exception {
        // STAFF response is masked by default
        MvcResult resStaffDefault = mockMvc.perform(get("/api/members/" + gymA_M1_Id)
                .header("Authorization", gymA_StaffToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.phone", is("XXXXXX0001")))
                .andExpect(jsonPath("$.data.address").doesNotExist())
                .andExpect(jsonPath("$.data.dob").doesNotExist())
                .andReturn();

        String staffDefaultJson = resStaffDefault.getResponse().getContentAsString();
        assertThat(staffDefaultJson).doesNotContain("9850000001");
        assertThat(staffDefaultJson).contains("XXXXXX0001");
        assertThat(staffDefaultJson).doesNotContain("101 Alpha Rd");
        assertThat(staffDefaultJson).doesNotContain("1995-03-25");

        // Staff can search by full 10-digit phone number, but returned JSON has masked phone
        MvcResult staffSearchRes = mockMvc.perform(get("/api/members?search=9850000001")
                .header("Authorization", gymA_StaffToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].phone", is("XXXXXX0001")))
                .andExpect(jsonPath("$.data.content[0].address").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].dob").doesNotExist())
                .andReturn();
        assertThat(staffSearchRes.getResponse().getContentAsString()).doesNotContain("9850000001");
        assertThat(staffSearchRes.getResponse().getContentAsString()).contains("XXXXXX0001");

        // Owner enables staffCanSeeFullPhone
        GymSettingsRequest settingsReq = new GymSettingsRequest();
        settingsReq.setName("Alpha Gym");
        settingsReq.setStaffCanSeeFullPhone(true);
        mockMvc.perform(put("/api/gym")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(settingsReq)))
                .andExpect(status().isOk());

        // STAFF response shows the full phone after owner enables setting
        MvcResult resStaffUnmasked = mockMvc.perform(get("/api/members/" + gymA_M1_Id)
                .header("Authorization", gymA_StaffToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.phone", is("9850000001")))
                .andExpect(jsonPath("$.data.address").doesNotExist())
                .andExpect(jsonPath("$.data.dob").doesNotExist())
                .andReturn();

        String staffUnmaskedJson = resStaffUnmasked.getResponse().getContentAsString();
        assertThat(staffUnmaskedJson).contains("9850000001");
        assertThat(staffUnmaskedJson).doesNotContain("XXXXXX0001");
        assertThat(staffUnmaskedJson).doesNotContain("101 Alpha Rd");
        assertThat(staffUnmaskedJson).doesNotContain("1995-03-25");

        // A TRAINER never sees it even then
        MvcResult resTrainer = mockMvc.perform(get("/api/members/" + gymA_M1_Id)
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.phone", is("XXXXXX0001")))
                .andExpect(jsonPath("$.data.address").doesNotExist())
                .andExpect(jsonPath("$.data.dob").doesNotExist())
                .andReturn();

        String trainerJson = resTrainer.getResponse().getContentAsString();
        assertThat(trainerJson).doesNotContain("9850000001");
        assertThat(trainerJson).contains("XXXXXX0001");
        assertThat(trainerJson).doesNotContain("101 Alpha Rd");
        assertThat(trainerJson).doesNotContain("1995-03-25");
    }

    @Test
    @Order(5)
    void test5_trainerGets403OnForbiddenEndpoints() throws Exception {
        // Payments
        mockMvc.perform(get("/api/payments")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/payments")
                .header("Authorization", gymA_TrainerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"memberId\":\"" + gymA_M1_Id + "\",\"membershipId\":\"dummy\",\"amountPaise\":1000,\"mode\":\"CASH\"}"))
                .andExpect(status().isForbidden());

        // Dues
        mockMvc.perform(get("/api/dues")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/payments/dues")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        // Receipts
        mockMvc.perform(get("/api/payments/nonexistent/receipt")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        // Dashboard
        mockMvc.perform(get("/api/dashboard")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        // Staff
        mockMvc.perform(post("/api/staff")
                .header("Authorization", gymA_TrainerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Hacked Staff\",\"phone\":\"9859999000\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/staff")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/staff")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));

        // Plans management
        mockMvc.perform(post("/api/plans")
                .header("Authorization", gymA_TrainerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Trainer Plan\",\"durationDays\":30,\"pricePaise\":1000}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/plans")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/plans/" + gymA_PlanId)
                .header("Authorization", gymA_TrainerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Trainer Plan\",\"durationDays\":30,\"pricePaise\":1000}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/plans/" + gymA_PlanId)
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        // Settings
        mockMvc.perform(get("/api/gym")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/gym")
                .header("Authorization", gymA_TrainerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Hacked Gym\"}"))
                .andExpect(status().isForbidden());

        // Assignment endpoints
        mockMvc.perform(post("/api/trainer-assignments")
                .header("Authorization", gymA_TrainerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"trainerId\":\"" + gymA_TrainerId + "\",\"memberIds\":[\"" + gymA_M1_Id + "\"]}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/trainer-assignments")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/trainer-assignments/" + gymA_Assignment_M1_Id + "/end")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/trainer-assignments/reassign")
                .header("Authorization", gymA_TrainerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"fromTrainerId\":\"" + gymA_TrainerId + "\",\"toTrainerId\":\"dummy\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(6)
    void test6_crossGymTrainerAssignmentAndActions_returns404() throws Exception {
        // Trainer of Gym A cannot be assigned members of Gym B
        AssignMembersRequest assignCrossReq1 = new AssignMembersRequest();
        assignCrossReq1.setTrainerId(gymA_TrainerId);
        assignCrossReq1.setMemberIds(List.of(gymB_MB_Id));

        mockMvc.perform(post("/api/trainer-assignments")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(assignCrossReq1)))
                .andExpect(status().isNotFound());

        // Owner B tries to assign Gym A member to Gym B trainer
        AssignMembersRequest assignCrossReq2 = new AssignMembersRequest();
        assignCrossReq2.setTrainerId(gymB_TrainerId);
        assignCrossReq2.setMemberIds(List.of(gymA_M1_Id));

        mockMvc.perform(post("/api/trainer-assignments")
                .header("Authorization", gymB_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(assignCrossReq2)))
                .andExpect(status().isNotFound());

        // Owner B tries to assign Gym A trainer to Gym B member
        AssignMembersRequest assignCrossReq3 = new AssignMembersRequest();
        assignCrossReq3.setTrainerId(gymA_TrainerId);
        assignCrossReq3.setMemberIds(List.of(gymB_MB_Id));

        mockMvc.perform(post("/api/trainer-assignments")
                .header("Authorization", gymB_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(assignCrossReq3)))
                .andExpect(status().isNotFound());

        // Owner of Gym B cannot update trainer types of Gym A (expect 404)
        ApproveTrainerRequest updateTypesReq = new ApproveTrainerRequest();
        updateTypesReq.setTrainerTypeIds(List.of("dummy-type"));
        mockMvc.perform(put("/api/trainers/" + gymA_TrainerId + "/types")
                .header("Authorization", gymB_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateTypesReq)))
                .andExpect(status().isNotFound());

        // Owner of Gym B cannot end assignment of Gym A (expect 404)
        mockMvc.perform(post("/api/trainer-assignments/" + gymA_Assignment_M1_Id + "/end")
                .header("Authorization", gymB_OwnerToken))
                .andExpect(status().isNotFound());

        // Owner of Gym B cannot fetch trainer of Gym A (expect 404)
        mockMvc.perform(get("/api/trainers/" + gymA_TrainerId)
                .header("Authorization", gymB_OwnerToken))
                .andExpect(status().isNotFound());

        // Owner of Gym B cannot deactivate trainer of Gym A (expect 404)
        mockMvc.perform(put("/api/trainers/" + gymA_TrainerId + "/deactivate")
                .header("Authorization", gymB_OwnerToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @Order(7)
    void test7_endingAssignment_immediatelyRemovesMemberFromTrainerListAndNotesAccess() throws Exception {
        // Trainer A can create note for assigned member M1
        MemberNoteRequest noteReq = new MemberNoteRequest();
        noteReq.setType("WORKOUT");
        noteReq.setText("5x5 Back squats and overhead press");
        noteReq.setWeightKg(72.5);

        mockMvc.perform(post("/api/members/" + gymA_M1_Id + "/notes")
                .header("Authorization", gymA_TrainerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(noteReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.text", is("5x5 Back squats and overhead press")));

        // Trainer A can read notes for M1
        mockMvc.perform(get("/api/members/" + gymA_M1_Id + "/notes")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));

        // Owner ends the assignment
        mockMvc.perform(post("/api/trainer-assignments/" + gymA_Assignment_M1_Id + "/end")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk());

        // Ending an assignment immediately removes the member from the trainer's list
        mockMvc.perform(get("/api/members")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(0)))
                .andExpect(jsonPath("$.data.totalElements", is(0)));

        // GET member by ID returns 404
        mockMvc.perform(get("/api/members/" + gymA_M1_Id)
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isNotFound());

        // Trainer cannot read notes of unassigned member -> returns 404
        mockMvc.perform(get("/api/members/" + gymA_M1_Id + "/notes")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isNotFound());

        // Trainer cannot create note for unassigned member -> returns 404
        mockMvc.perform(post("/api/members/" + gymA_M1_Id + "/notes")
                .header("Authorization", gymA_TrainerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(noteReq)))
                .andExpect(status().isNotFound());
    }

    @Test
    @Order(8)
    void test8_deactivatingTrainer_endsAllTheirAssignments() throws Exception {
        // Owner assigns both M1 and M2 to Trainer A
        AssignMembersRequest assignReq = new AssignMembersRequest();
        assignReq.setTrainerId(gymA_TrainerId);
        assignReq.setMemberIds(List.of(gymA_M1_Id, gymA_M2_Id));
        assignReq.setNotes("Bulk re-assignment before deactivation test");

        mockMvc.perform(post("/api/trainer-assignments")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(assignReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data", hasSize(2)));

        // Verify active assignments count is 2
        mockMvc.perform(get("/api/trainer-assignments?trainerId=" + gymA_TrainerId + "&status=ACTIVE")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(2)));

        // Owner deactivates the trainer
        mockMvc.perform(put("/api/trainers/" + gymA_TrainerId + "/deactivate")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("INACTIVE")))
                .andExpect(jsonPath("$.data.active", is(false)));

        // Deactivating a trainer ends all their assignments: ACTIVE count is now 0
        mockMvc.perform(get("/api/trainer-assignments?trainerId=" + gymA_TrainerId + "&status=ACTIVE")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(0)));

        // Assignments are ENDED
        mockMvc.perform(get("/api/trainer-assignments?trainerId=" + gymA_TrainerId + "&status=ENDED")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(greaterThanOrEqualTo(2))));
    }

    @Test
    @Order(9)
    void test9_trainerCannotReadNotesOfUnassignedMember() throws Exception {
        // Reactivate Trainer A and assign only M1
        User trainerA = userRepository.findById(gymA_TrainerId).orElseThrow();
        trainerA.setActive(true);
        trainerA.setStatus("ACTIVE");
        trainerA.setTokenVersion(0);
        userRepository.save(trainerA);

        AssignMembersRequest assignReq = new AssignMembersRequest();
        assignReq.setTrainerId(gymA_TrainerId);
        assignReq.setMemberIds(List.of(gymA_M1_Id));
        assignReq.setNotes("Assign only M1");

        mockMvc.perform(post("/api/trainer-assignments")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(assignReq)))
                .andExpect(status().isCreated());

        // Owner creates a note on M2 (unassigned member)
        MemberNoteRequest ownerNoteReq = new MemberNoteRequest();
        ownerNoteReq.setType("GENERAL");
        ownerNoteReq.setText("Owner confidential assessment for M2");

        mockMvc.perform(post("/api/members/" + gymA_M2_Id + "/notes")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(ownerNoteReq)))
                .andExpect(status().isCreated());

        // Owner can read M2 notes
        mockMvc.perform(get("/api/members/" + gymA_M2_Id + "/notes")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));

        // Trainer cannot read notes of unassigned member M2 -> returns 404
        mockMvc.perform(get("/api/members/" + gymA_M2_Id + "/notes")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isNotFound());

        // Trainer cannot create notes for unassigned member M2 -> returns 404
        MemberNoteRequest trainerNoteReq = new MemberNoteRequest();
        trainerNoteReq.setType("WORKOUT");
        trainerNoteReq.setText("Attempted note on unassigned member");

        mockMvc.perform(post("/api/members/" + gymA_M2_Id + "/notes")
                .header("Authorization", gymA_TrainerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(trainerNoteReq)))
                .andExpect(status().isNotFound());
    }

    @Test
    @Order(10)
    void test10_securityAudits_noPiiInErrors_andIndexVerification() throws Exception {
        // 1. Trainer gets 403 on owner-only endpoints
        mockMvc.perform(get("/api/trainers")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/trainer-types")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/trainer-assignments")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/audit-logs")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/staff")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/gym")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        // 2. Error message for unassigned member contains NO member PII (name/phone)
        MvcResult errResult = mockMvc.perform(get("/api/members/" + gymA_M2_Id)
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isNotFound())
                .andReturn();
        String errBody = errResult.getResponse().getContentAsString();
        assertThat(errBody).doesNotContain("Member Two");
        assertThat(errBody).doesNotContain("9850000002");
        assertThat(errBody).doesNotContain("202 Alpha Rd");

        // 3. Verify collection indexes in Mongo
        List<String> assignmentIdxNames = mongoTemplate.indexOps("trainer_assignments").getIndexInfo()
                .stream().map(org.springframework.data.mongodb.core.index.IndexInfo::getName).toList();
        assertThat(assignmentIdxNames)
                .contains("gym_trainer_status_idx", "gym_member_status_idx", "gym_trainer_member_idx", "gym_trainer_member_active_unique");

        List<String> noteIdxNames = mongoTemplate.indexOps("member_notes").getIndexInfo()
                .stream().map(org.springframework.data.mongodb.core.index.IndexInfo::getName).toList();
        assertThat(noteIdxNames)
                .contains("gym_member_created_idx", "gym_trainer_created_idx");

        List<String> typeIdxNames = mongoTemplate.indexOps("trainer_types").getIndexInfo()
                .stream().map(org.springframework.data.mongodb.core.index.IndexInfo::getName).toList();
        assertThat(typeIdxNames)
                .contains("gym_name_unique_idx", "gym_active_idx");

        List<String> auditIdxNames = mongoTemplate.indexOps("audit_logs").getIndexInfo()
                .stream().map(org.springframework.data.mongodb.core.index.IndexInfo::getName).toList();
        assertThat(auditIdxNames)
                .contains("gym_timestamp_idx", "gym_action_timestamp_idx", "gym_actor_timestamp_idx");
    }

    @Test
    @Order(11)
    void test11_reviewedFixes_andHardening() throws Exception {
        // 1. GET /api/attendance/members/{memberId} returns 404 for non-existent member or member from Gym B (even for OWNER)
        mockMvc.perform(get("/api/attendance/members/nonexistent_member_id")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MEMBER_NOT_FOUND"));

        mockMvc.perform(get("/api/attendance/members/" + gymB_MB_Id)
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MEMBER_NOT_FOUND"));

        // 2. Reassigning trainer: same trainer returns 400 VALIDATION_ERROR
        ReassignTrainerRequest sameTrainerReq = new ReassignTrainerRequest();
        sameTrainerReq.setFromTrainerId(gymA_TrainerId);
        sameTrainerReq.setToTrainerId(gymA_TrainerId);
        mockMvc.perform(post("/api/trainer-assignments/reassign")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(sameTrainerReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));

        // Reassigning from non-trainer user returns 404 TRAINER_NOT_FOUND
        ReassignTrainerRequest nonTrainerReq = new ReassignTrainerRequest();
        nonTrainerReq.setFromTrainerId(gymA_M1_Id); // Member ID, not trainer
        nonTrainerReq.setToTrainerId(gymA_TrainerId);
        mockMvc.perform(post("/api/trainer-assignments/reassign")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(nonTrainerReq)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("TRAINER_NOT_FOUND"));

        // 3. Create a temporary member M3, assign to Gym A trainer, then delete M3
        CreateMemberRequest m3Req = new CreateMemberRequest();
        m3Req.setName("Member Three");
        m3Req.setPhone("9850000003");
        m3Req.setGender("FEMALE");
        m3Req.setPlanId(gymA_PlanId);
        m3Req.setStartDate(LocalDate.now());

        MvcResult m3Res = mockMvc.perform(post("/api/members")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(m3Req)))
                .andExpect(status().isOk()).andReturn();
        String m3Id = objectMapper.readTree(m3Res.getResponse().getContentAsString()).path("data").path("id").asText();

        // Assign M3 to trainer
        AssignMembersRequest assignM3 = new AssignMembersRequest();
        assignM3.setTrainerId(gymA_TrainerId);
        assignM3.setMemberIds(List.of(m3Id));
        mockMvc.perform(post("/api/trainer-assignments")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(assignM3)))
                .andExpect(status().isCreated());

        // Trainer sees M3
        mockMvc.perform(get("/api/members/" + m3Id)
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isOk());

        // Now Owner deletes M3 -> soft delete + auto-ends trainer assignment
        mockMvc.perform(delete("/api/members/" + m3Id)
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk());

        // Trainer now gets 404 when querying deleted M3
        mockMvc.perform(get("/api/members/" + m3Id)
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("MEMBER_NOT_FOUND"));

        // Trainer list does NOT include deleted member M3
        mockMvc.perform(get("/api/members")
                .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[*].id", not(hasItem(m3Id))));

        // Attempting to create a note for inactive M3 fails with 422 MEMBER_INACTIVE (for owner too)
        MemberNoteRequest noteM3 = new MemberNoteRequest();
        noteM3.setType("WORKOUT");
        noteM3.setText("Workout note for deleted member");
        mockMvc.perform(post("/api/members/" + m3Id + "/notes")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(noteM3)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error").value("MEMBER_INACTIVE"));

        // 4. Verify new index definitions on attendances and members
        List<String> attendanceIdxNames = mongoTemplate.indexOps("attendances").getIndexInfo()
                .stream().map(org.springframework.data.mongodb.core.index.IndexInfo::getName).toList();
        assertThat(attendanceIdxNames).contains("gymId_date_memberId_idx");

        List<String> memberIdxNames = mongoTemplate.indexOps("members").getIndexInfo()
                .stream().map(org.springframework.data.mongodb.core.index.IndexInfo::getName).toList();
        assertThat(memberIdxNames).contains("gymId_status_lastAttendance_idx");
    }

    @Test
    @Order(12)
    void test12_ownerCreatesAndUpdatesTrainerAndStaff_otpLogin_sessionInvalidation_andAuditLogs() throws Exception {
        // 1. Owner A cannot read or change a trainer of Gym B (404)
        mockMvc.perform(get("/api/trainers/" + gymB_TrainerId)
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isNotFound());

        UpdateTrainerRequest patchGymBReq = UpdateTrainerRequest.builder()
                .name("Hacked Name")
                .build();
        mockMvc.perform(patch("/api/trainers/" + gymB_TrainerId)
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(patchGymBReq)))
                .andExpect(status().isNotFound());

        // 2. Trainer and staff get 403 on POST /api/trainers, PATCH /api/trainers/{id}, POST /api/staff, PATCH /api/staff/{id}
        CreateTrainerRequest forbiddenTrainerReq = CreateTrainerRequest.builder()
                .name("Unauthorized Trainer")
                .phone("9857777701")
                .trainerTypeIds(List.of(gymA_TypeId))
                .build();
        for (String nonOwnerToken : List.of(gymA_TrainerToken, gymA_StaffToken)) {
            mockMvc.perform(post("/api/trainers")
                    .header("Authorization", nonOwnerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(forbiddenTrainerReq)))
                    .andExpect(status().isForbidden());

            mockMvc.perform(patch("/api/trainers/" + gymA_TrainerId)
                    .header("Authorization", nonOwnerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Forbidden Edit\"}"))
                    .andExpect(status().isForbidden());

            mockMvc.perform(post("/api/staff")
                    .header("Authorization", nonOwnerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Forbidden Staff\",\"phone\":\"9857777702\"}"))
                    .andExpect(status().isForbidden());

            mockMvc.perform(patch("/api/staff/" + gymA_StaffId)
                    .header("Authorization", nonOwnerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"active\":false}"))
                    .andExpect(status().isForbidden());
        }

        // 3. Duplicate phone (from same gym OR another gym) is rejected with 409 PHONE_ALREADY_REGISTERED & neutral message
        CreateTrainerRequest dupPhoneReq = CreateTrainerRequest.builder()
                .name("Dup Trainer")
                .phone("9859999992") // Trainer B's phone in Gym B!
                .trainerTypeIds(List.of(gymA_TypeId))
                .build();
        MvcResult dupTrainerRes = mockMvc.perform(post("/api/trainers")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dupPhoneReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("PHONE_ALREADY_REGISTERED"))
                .andReturn();
        String dupBody = dupTrainerRes.getResponse().getContentAsString();
        assertThat(dupBody).doesNotContain("Beta Gym").doesNotContain(gymB_Id);

        CreateStaffRequest dupStaffReq = new CreateStaffRequest();
        dupStaffReq.setName("Dup Staff");
        dupStaffReq.setPhone("9859999992"); // Trainer B's phone in Gym B
        MvcResult dupStaffRes = mockMvc.perform(post("/api/staff")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dupStaffReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("PHONE_ALREADY_REGISTERED"))
                .andReturn();
        assertThat(dupStaffRes.getResponse().getContentAsString()).doesNotContain("Beta Gym").doesNotContain(gymB_Id);

        // 4. Owner creates a trainer with immediate member assignment (M2) and trainer signs in through OTP
        CreateTrainerRequest newTrainerReq = CreateTrainerRequest.builder()
                .name("Coach Vikram")
                .phone("9856666601")
                .trainerTypeIds(List.of(gymA_TypeId))
                .memberIds(List.of(gymA_M2_Id))
                .build();
        MvcResult createVikramRes = mockMvc.perform(post("/api/trainers")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(newTrainerReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Coach Vikram"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.active").value(true))
                .andExpect(jsonPath("$.data.activeAssignmentsCount").value(1))
                .andReturn();
        String vikramId = objectMapper.readTree(createVikramRes.getResponse().getContentAsString())
                .path("data").path("id").asText();

        // Coach Vikram signs in via OTP
        mockMvc.perform(post("/api/auth/send-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9856666601\"}"))
                .andExpect(status().isOk());

        MvcResult verifyVikramRes = mockMvc.perform(post("/api/auth/verify-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9856666601\",\"otp\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isNewUser").value(false))
                .andExpect(jsonPath("$.data.user.id").value(vikramId))
                .andExpect(jsonPath("$.data.user.role").value("TRAINER"))
                .andExpect(jsonPath("$.data.user.gymId").value(gymA_Id))
                .andReturn();
        String vikramToken = "Bearer " + objectMapper.readTree(verifyVikramRes.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();

        // Coach Vikram sees only assigned member M2 and never a full phone number
        MvcResult vikramMembersRes = mockMvc.perform(get("/api/members")
                .header("Authorization", vikramToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].id").value(gymA_M2_Id))
                .andExpect(jsonPath("$.data.content[0].phone").value("XXXXXX0002"))
                .andReturn();
        assertThat(vikramMembersRes.getResponse().getContentAsString()).doesNotContain("9850000002");

        // 5. PATCH /api/trainers/{id} — change name and phone; old session is invalidated (tokenVersion bumped)
        UpdateTrainerRequest changePhoneReq = UpdateTrainerRequest.builder()
                .name("Coach Vikram Updated")
                .phone("9856666602")
                .build();
        mockMvc.perform(patch("/api/trainers/" + vikramId)
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(changePhoneReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Coach Vikram Updated"))
                .andExpect(jsonPath("$.data.phone").value("9856666602"));

        // Old token (tokenVersion=0) must now be rejected with 401
        mockMvc.perform(get("/api/members")
                .header("Authorization", vikramToken))
                .andExpect(status().isUnauthorized());

        // Sign in with new phone via OTP
        mockMvc.perform(post("/api/auth/send-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9856666602\"}"))
                .andExpect(status().isOk());
        MvcResult verifyNewPhoneRes = mockMvc.perform(post("/api/auth/verify-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9856666602\",\"otp\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.id").value(vikramId))
                .andReturn();
        String vikramTokenV1 = "Bearer " + objectMapper.readTree(verifyNewPhoneRes.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();

        mockMvc.perform(get("/api/members")
                .header("Authorization", vikramTokenV1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)));

        // 6. PATCH /api/trainers/{id} — deactivate trainer: ends assignments, invalidates tokens, blocks OTP sign-in
        UpdateTrainerRequest deactivateReq = UpdateTrainerRequest.builder()
                .active(false)
                .build();
        mockMvc.perform(patch("/api/trainers/" + vikramId)
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(deactivateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("INACTIVE"))
                .andExpect(jsonPath("$.data.active").value(false))
                .andExpect(jsonPath("$.data.activeAssignmentsCount").value(0));

        // Existing token is rejected
        mockMvc.perform(get("/api/members")
                .header("Authorization", vikramTokenV1))
                .andExpect(status().isUnauthorized());

        // Active assignments for Vikram are 0
        mockMvc.perform(get("/api/trainer-assignments?trainerId=" + vikramId + "&status=ACTIVE")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(0)));

        // Deactivated trainer cannot sign in via OTP -> 403 ACCOUNT_INACTIVE
        User vikramEntity = userRepository.findById(vikramId).orElseThrow();
        // Clear rate limit window for 9856666602 in otp_requests so we can send OTP immediately
        mongoTemplate.remove(new org.springframework.data.mongodb.core.query.Query(
                org.springframework.data.mongodb.core.query.Criteria.where("phone").is("9856666602")), "otp_requests");

        mockMvc.perform(post("/api/auth/send-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9856666602\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/auth/verify-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"9856666602\",\"otp\":\"123456\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("ACCOUNT_INACTIVE"));

        // Reactivate trainer via PATCH /api/trainers/{id}
        UpdateTrainerRequest reactivateReq = UpdateTrainerRequest.builder()
                .active(true)
                .build();
        mockMvc.perform(patch("/api/trainers/" + vikramId)
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reactivateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.active").value(true));

        // 7. PATCH /api/staff/{id} — deactivate and reactivate staff; cross-gym returns 404
        mockMvc.perform(patch("/api/staff/" + gymA_StaffId)
                .header("Authorization", gymB_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(patch("/api/staff/" + gymA_StaffId)
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("INACTIVE"))
                .andExpect(jsonPath("$.data.active").value(false));

        mockMvc.perform(patch("/api/staff/" + gymA_StaffId)
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.active").value(true));

        // 8. Verify Audit Logs: TRAINER_CREATED, STAFF_CREATED, TRAINER_UPDATED, TRAINER_DEACTIVATED, TRAINER_PHONE_CHANGED
        // and verify NO phone numbers appear in audit log details
        MvcResult auditRes = mockMvc.perform(get("/api/audit-logs?size=100")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andReturn();
        String auditJson = auditRes.getResponse().getContentAsString();
        assertThat(auditJson).contains("TRAINER_CREATED");
        assertThat(auditJson).contains("STAFF_CREATED");
        assertThat(auditJson).contains("TRAINER_UPDATED");
        assertThat(auditJson).contains("TRAINER_DEACTIVATED");
        assertThat(auditJson).contains("TRAINER_PHONE_CHANGED");
        assertThat(auditJson)
                .doesNotContain("9856666601")
                .doesNotContain("9856666602")
                .doesNotContain("9858888881")
                .doesNotContain("9859999991");
    }
}
