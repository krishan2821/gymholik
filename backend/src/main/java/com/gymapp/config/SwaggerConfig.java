package com.gymapp.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI openAPI() {
        final String schemeName = "Bearer Auth";

        return new OpenAPI()
                .info(new Info()
                        .title("Gym Management API")
                        .description("Multi-tenant SaaS Gym Management System — all protected endpoints require a Bearer JWT.")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("GymHolik Team")
                                .email("dev@gymholik.com")))
                // Attach the security scheme globally so Swagger sends the token on every call
                .addSecurityItem(new SecurityRequirement().addList(schemeName))
                .components(new Components()
                        .addSecuritySchemes(schemeName, new SecurityScheme()
                                .name(schemeName)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
