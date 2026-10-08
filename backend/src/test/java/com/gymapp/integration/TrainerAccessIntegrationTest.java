package com.gymapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.module.auth.dto.*;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.member.dto.CreateMemberRequest;
import com.gymapp.module.member.dto.MemberResponse;
import com.gymapp.module.plan.dto.PlanRequest;
import com.gymapp.module.trainer.dto.ApproveTrainerRequest;
import com.gymapp.module.trainer.dto.AssignMembersRequest;
import com.gymapp.module.trainer.dto.MemberNoteRequest;
import com.gymapp.module.trainer.dto.ReassignTrainerRequest;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TrainerAccessIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

    private String gymA_Code;
    private String gymB_Code;
    private String gymA_OwnerToken;
    private String gymB_OwnerToken;

    private String gymA_PlanId;
    private String gymB_PlanId;

    private String gymA_M1_Id;
    private String gymA_M2_Id;
    private String gymB_MB_Id;

    private String gymA_TrainerId;
    private String gymB_TrainerId;
    private String gymA_TrainerToken;
    private String gymB_TrainerToken;

    private String gymA_StaffToken;

    private String gymA_Assignment_M1_Id;

    @BeforeAll
    void setup() throws Exception {
        if (loginRateLimiter != null) {
            loginRateLimiter.reset();
        }
        // 1. Register Gym A
        RegisterGymRequest regA = new RegisterGymRequest();
        regA.setGymName("Alpha Gym");
        regA.setOwnerName("Alpha Owner");
        regA.setOwnerPhone("9851111111");
        regA.setPassword("password123");

        MvcResult resRegA = mockMvc.perform(post("/api/auth/register-gym")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(regA)))
                .andExpect(status().isCreated()).andReturn();
        gymA_Code = objectMapper.readTree(resRegA.getResponse().getContentAsString()).path("data").path("gymCode").asText();

        // 2. Register Gym B
        RegisterGymRequest regB = new RegisterGymRequest();
        regB.setGymName("Beta Gym");
        regB.setOwnerName("Beta Owner");
        regB.setOwnerPhone("9852222222");
        regB.setPassword("password123");

        MvcResult resRegB = mockMvc.perform(post("/api/auth/register-gym")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(regB)))
                .andExpect(status().isCreated()).andReturn();
        gymB_Code = objectMapper.readTree(resRegB.getResponse().getContentAsString()).path("data").path("gymCode").asText();

        // 3. Login Owner A
        LoginRequest loginA = new LoginRequest();
        loginA.setGymCode(gymA_Code);
        loginA.setPhone("9851111111");
        loginA.setPassword("password123");
        MvcResult resLoginA = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginA)))
                .andExpect(status().isOk()).andReturn();
        gymA_OwnerToken = "Bearer " + objectMapper.readTree(resLoginA.getResponse().getContentAsString()).path("data").path("accessToken").asText();

        // 4. Login Owner B
        LoginRequest loginB = new LoginRequest();
        loginB.setGymCode(gymB_Code);
        loginB.setPhone("9852222222");
        loginB.setPassword("password123");
        MvcResult resLoginB = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginB)))
                .andExpect(status().isOk()).andReturn();
        gymB_OwnerToken = "Bearer " + objectMapper.readTree(resLoginB.getResponse().getContentAsString()).path("data").path("accessToken").asText();

        // 5. Create Plans
        gymA_PlanId = createPlan(gymA_OwnerToken, "Plan Alpha");
        gymB_PlanId = createPlan(gymB_OwnerToken, "Plan Beta");

        // 6. Create Members
        gymA_M1_Id = createMember(gymA_OwnerToken, "Member One", "9850000001", LocalDate.of(1995, 3, 25), "101 Alpha Rd", gymA_PlanId);
        gymA_M2_Id = createMember(gymA_OwnerToken, "Member Two", "9850000002", LocalDate.of(1997, 7, 14), "202 Alpha Rd", gymA_PlanId);
        gymB_MB_Id = createMember(gymB_OwnerToken, "Member Beta", "9850000003", LocalDate.of(1996, 5, 10), "303 Beta Blvd", gymB_PlanId);

        // 7. Register and Approve Trainer A in Gym A
        RegisterTrainerRequest regTrainerA = new RegisterTrainerRequest();
        regTrainerA.setName("Trainer Alpha");
        regTrainerA.setPhone("9859999991");
        regTrainerA.setPassword("trainer123");
        regTrainerA.setGymCode(gymA_Code);
        mockMvc.perform(post("/api/auth/register-trainer")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(regTrainerA)))
                .andExpect(status().isCreated());

        MvcResult pendingTrainersA = mockMvc.perform(get("/api/trainers?status=PENDING_APPROVAL")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode trainersArrayA = objectMapper.readTree(pendingTrainersA.getResponse().getContentAsString()).path("data");
        gymA_TrainerId = trainersArrayA.get(0).path("id").asText();

        MvcResult typesA = mockMvc.perform(get("/api/trainer-types")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk()).andReturn();
        String typeIdA = objectMapper.readTree(typesA.getResponse().getContentAsString()).path("data").get(0).path("id").asText();

        ApproveTrainerRequest approveReqA = new ApproveTrainerRequest();
        approveReqA.setTrainerTypeIds(List.of(typeIdA));
        mockMvc.perform(post("/api/trainers/" + gymA_TrainerId + "/approve")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(approveReqA)))
                .andExpect(status().isOk());

        LoginRequest loginTrainerA = new LoginRequest();
        loginTrainerA.setGymCode(gymA_Code);
        loginTrainerA.setPhone("9859999991");
        loginTrainerA.setPassword("trainer123");
        MvcResult resLoginTrainerA = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginTrainerA)))
                .andExpect(status().isOk()).andReturn();
        gymA_TrainerToken = "Bearer " + objectMapper.readTree(resLoginTrainerA.getResponse().getContentAsString()).path("data").path("accessToken").asText();

        // 8. Register and Approve Trainer B in Gym B
        RegisterTrainerRequest regTrainerB = new RegisterTrainerRequest();
        regTrainerB.setName("Trainer Beta");
        regTrainerB.setPhone("9859999992");
        regTrainerB.setPassword("trainer123");
        regTrainerB.setGymCode(gymB_Code);
        mockMvc.perform(post("/api/auth/register-trainer")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(regTrainerB)))
                .andExpect(status().isCreated());

        MvcResult pendingTrainersB = mockMvc.perform(get("/api/trainers?status=PENDING_APPROVAL")
                .header("Authorization", gymB_OwnerToken))
                .andExpect(status().isOk()).andReturn();
        gymB_TrainerId = objectMapper.readTree(pendingTrainersB.getResponse().getContentAsString()).path("data").get(0).path("id").asText();

        MvcResult typesB = mockMvc.perform(get("/api/trainer-types")
                .header("Authorization", gymB_OwnerToken))
                .andExpect(status().isOk()).andReturn();
        String typeIdB = objectMapper.readTree(typesB.getResponse().getContentAsString()).path("data").get(0).path("id").asText();

        ApproveTrainerRequest approveReqB = new ApproveTrainerRequest();
        approveReqB.setTrainerTypeIds(List.of(typeIdB));
        mockMvc.perform(post("/api/trainers/" + gymB_TrainerId + "/approve")
                .header("Authorization", gymB_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(approveReqB)))
                .andExpect(status().isOk());

        LoginRequest loginTrainerB = new LoginRequest();
        loginTrainerB.setGymCode(gymB_Code);
        loginTrainerB.setPhone("9859999992");
        loginTrainerB.setPassword("trainer123");
        MvcResult resLoginTrainerB = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginTrainerB)))
                .andExpect(status().isOk()).andReturn();
        gymB_TrainerToken = "Bearer " + objectMapper.readTree(resLoginTrainerB.getResponse().getContentAsString()).path("data").path("accessToken").asText();

        // 9. Create Staff A in Gym A
        CreateStaffRequest staffReq = new CreateStaffRequest();
        staffReq.setName("Staff Alpha");
        staffReq.setPhone("9858888881");
        staffReq.setPassword("staffpassword123");
        mockMvc.perform(post("/api/staff")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(staffReq)))
                .andExpect(status().isCreated());

        LoginRequest loginStaffA = new LoginRequest();
        loginStaffA.setGymCode(gymA_Code);
        loginStaffA.setPhone("9858888881");
        loginStaffA.setPassword("staffpassword123");
        MvcResult resLoginStaffA = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginStaffA)))
                .andExpect(status().isOk()).andReturn();
        gymA_StaffToken = "Bearer " + objectMapper.readTree(resLoginStaffA.getResponse().getContentAsString()).path("data").path("accessToken").asText();
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
        // Assert on the raw JSON string for the 10-digit number
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
                .content("{\"name\":\"Hacked Staff\",\"phone\":\"9859999000\",\"password\":\"hackedpass123\"}"))
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

        // Owner of Gym B cannot approve anything of Gym A (expect 404)
        ApproveTrainerRequest approveReq = new ApproveTrainerRequest();
        approveReq.setTrainerTypeIds(List.of("dummy-type"));
        mockMvc.perform(post("/api/trainers/" + gymA_TrainerId + "/approve")
                .header("Authorization", gymB_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(approveReq)))
                .andExpect(status().isNotFound());

        // Owner of Gym B cannot end assignment of Gym A (expect 404)
        mockMvc.perform(post("/api/trainer-assignments/" + gymA_Assignment_M1_Id + "/end")
                .header("Authorization", gymB_OwnerToken))
                .andExpect(status().isNotFound());

        // Owner of Gym B cannot reject trainer of Gym A (expect 404)
        mockMvc.perform(post("/api/trainers/" + gymA_TrainerId + "/reject")
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
}
