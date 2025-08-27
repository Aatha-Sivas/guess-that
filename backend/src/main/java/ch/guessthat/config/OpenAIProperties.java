package ch.guessthat.config;


import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "openai")
public class OpenAIProperties {
    private String baseUrl;
    private String apiKey;
    private String organization;
    private String project;
    private String model = "gpt-4.1-mini";
    private Double temperature = 0.2;
    private Integer maxOutputTokens = 1200;
}