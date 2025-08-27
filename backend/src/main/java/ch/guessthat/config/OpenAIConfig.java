package ch.guessthat.config;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class OpenAIConfig {
    @Bean
    public OpenAIClient openAIClient(OpenAIProperties props) {
        return OpenAIOkHttpClient.builder()
                .fromEnv()
                .timeout(Duration.ofSeconds(60))
                .maxRetries(3)
                .build();
    }
}
