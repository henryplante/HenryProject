package com.clearpath.review.web.setup;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.clearpath.review.support.AbstractPostgresIT;
import com.clearpath.review.support.TestFixtures;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@AutoConfigureMockMvc
class SetupCrudIT extends AbstractPostgresIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    private Cookie sessionCookie;
    private String adminEmail;

    @BeforeEach
    void login() throws Exception {
        adminEmail = "admin-" + System.nanoTime() + "@example.com";
        TestFixtures.insertUser(jdbcTemplate, passwordEncoder, adminEmail, "Admin", "demo-demo");
        MvcResult login = mockMvc.perform(post("/api/session/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + adminEmail + "\",\"password\":\"demo-demo\"}"))
                .andExpect(status().isOk())
                .andReturn();
        sessionCookie = login.getResponse().getCookie("clearpath_session");
    }

    @Test
    void userGroupAndProductCrud() throws Exception {
        MvcResult groupResult = mockMvc.perform(post("/api/groups")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Legal\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.memberIds").isArray())
                .andReturn();
        String groupId = objectMapper.readTree(groupResult.getResponse().getContentAsString()).get("id").asText();

        MvcResult userResult = mockMvc.perform(post("/api/users")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Carol","email":"carol@example.com","password":"secret","groupIds":["%s"]}
                                """
                                .formatted(groupId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.groupIds[0]").value(groupId))
                .andReturn();
        String userId = objectMapper.readTree(userResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(put("/api/groups/" + groupId + "/members")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userIds\":[\"" + userId + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.memberIds[0]").value(userId));

        mockMvc.perform(get("/api/groups").cookie(sessionCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + groupId + "')].memberIds[0]").value(userId));

        mockMvc.perform(patch("/api/users/" + userId)
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Carol Updated\",\"email\":\"carol@example.com\",\"groupIds\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groupIds").isEmpty());

        String productBody =
                """
                {"name":"Widget","approvalLifetimeDays":365,"steps":[{"position":1,"name":"Review","requirements":[{"groupId":"%s","approvalsRequired":1}]}]}
                """
                        .formatted(groupId);

        MvcResult productResult = mockMvc.perform(post("/api/products")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.steps[0].requirements[0].groupName").value("Legal"))
                .andReturn();
        String productId =
                objectMapper.readTree(productResult.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(get("/api/products/" + productId).cookie(sessionCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.steps[0].position").value(1));

        mockMvc.perform(post("/api/products")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Widget\",\"approvalLifetimeDays\":30,\"steps\":[{\"position\":1,\"name\":\"S\",\"requirements\":[{\"groupId\":\""
                                + groupId + "\",\"approvalsRequired\":1}]}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION"));
    }

    @Test
    void productStepValidationRejectsEmptySteps() throws Exception {
        UUID groupId = TestFixtures.insertGroup(jdbcTemplate, "Ops-" + System.nanoTime());

        mockMvc.perform(post("/api/products")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Bad\",\"approvalLifetimeDays\":30,\"steps\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION"));
    }

    @Test
    void duplicateEmailRejected() throws Exception {
        mockMvc.perform(post("/api/users")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"X\",\"email\":\"" + adminEmail + "\",\"password\":\"x\",\"groupIds\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Email already in use"));
    }

    @Test
    void replacingProductKeepingStepPositionsSucceeds() throws Exception {
        UUID groupId = TestFixtures.insertGroup(jdbcTemplate, "Replace-" + System.nanoTime());
        String body =
                """
                {"name":"Replaceable-%d","approvalLifetimeDays":90,"steps":[{"position":1,"name":"One","requirements":[{"groupId":"%s","approvalsRequired":1}]},{"position":2,"name":"Two","requirements":[{"groupId":"%s","approvalsRequired":2}]}]}
                """
                        .formatted(System.nanoTime(), groupId, groupId);
        MvcResult created = mockMvc.perform(post("/api/products")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        String productId =
                objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(put("/api/products/" + productId)
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body.replace("\"approvalLifetimeDays\":90", "\"approvalLifetimeDays\":30")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approvalLifetimeDays").value(30))
                .andExpect(jsonPath("$.steps.length()").value(2))
                .andExpect(jsonPath("$.steps[1].requirements[0].approvalsRequired").value(2));
    }

    @Test
    void groupAndProductNamesAreUniqueIgnoringCase() throws Exception {
        String name = "CaseCheck-" + System.nanoTime();
        UUID groupId = TestFixtures.insertGroup(jdbcTemplate, name);
        mockMvc.perform(post("/api/groups")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name.toUpperCase() + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Group name already in use"));

        String productName = "CaseProduct-" + System.nanoTime();
        String product = "{\"name\":\"%s\",\"approvalLifetimeDays\":30,\"steps\":[{\"position\":1,\"name\":\"S\",\"requirements\":[{\"groupId\":\"%s\",\"approvalsRequired\":1}]}]}";
        mockMvc.perform(post("/api/products")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(product.formatted(productName, groupId)))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/products")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(product.formatted(productName.toLowerCase(), groupId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Product name already in use"));
    }

    @Test
    void malformedParametersUseTheErrorEnvelope() throws Exception {
        mockMvc.perform(get("/api/materials/not-a-uuid").cookie(sessionCookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION"));
        mockMvc.perform(get("/api/materials").param("status", "bogus").cookie(sessionCookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION"));
        mockMvc.perform(post("/api/groups")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION"));
    }

    @Test
    void optionalFieldsAreOmittedRatherThanNull() throws Exception {
        mockMvc.perform(get("/api/materials").cookie(sessionCookie))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/session").cookie(sessionCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value(adminEmail));
    }
}
