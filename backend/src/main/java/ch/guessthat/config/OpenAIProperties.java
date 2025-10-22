package ch.guessthat.config;


import com.openai.models.ChatModel;
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
    private String model = ChatModel.GPT_5_MINI.asString();
    private Integer maxOutputTokens = 128000;
}