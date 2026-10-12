package com.gymapp.integration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles({"test", "prod"})
@TestPropertySource(properties = {
        "app.cors.allowed-origins=",
        "app.sms.provider=msg91",
        "app.sms.msg91.auth-key=dummy-test-key-for-prod-profile",
        "app.sms.msg91.template-id=dummy-template-id",
        "app.sms.msg91.sender-id=GYMHLK",
        "app.sms.msg91.entity-id=dummy-entity-id"
})
public class ProdCorsIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Prod profile with empty allowed-origins rejects preflight OPTIONS with 403 and no CORS headers")
    void testProdProfileEmptyListDisallowsPreflight() throws Exception {
        mockMvc.perform(options("/api/members")
                .header(HttpHeaders.ORIGIN, "http://localhost:8081")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization, Content-Type"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    @DisplayName("Prod profile with empty allowed-origins does not return CORS headers on simple request")
    void testProdProfileEmptyListDisallowsSimpleRequest() throws Exception {
        mockMvc.perform(get("/api/auth/send-otp")
                .header(HttpHeaders.ORIGIN, "http://localhost:8081"))
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
