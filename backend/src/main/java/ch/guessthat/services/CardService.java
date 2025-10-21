package ch.guessthat.services;

import ch.guessthat.config.OpenAIProperties;
import ch.guessthat.util.SafetyFilters;
import com.openai.client.OpenAIClient;
import com.openai.models.ChatModel;
import com.openai.models.responses.ResponseCreateParams;
import com.openai.models.responses.StructuredResponse;
import com.openai.models.responses.StructuredResponseCreateParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

import static ch.guessthat.records.RecordManager.*;
import static ch.guessthat.util.ConfigLoader.loadConfig;

@Slf4j
@Service
@RequiredArgsConstructor
public class CardService {
    private final OpenAIClient openAI;
    private final OpenAIProperties props;

    @Value("${app.config.max-gen-count}")
    private int maxGenCount;

    @Value("${app.config.prompt-template-file}")
    private String promptTemplateFile;

    public List<CardDto> getOrGenerate(String lang, String category, String difficulty, int count) throws IOException {
        log.info("GEN start model={} lang={} cat={} diff={} count={}", props.getModel(), lang, category, difficulty, count);
        int batch = Math.min(count, maxGenCount);

        CardBatch batchOut = requestBatch(lang, category, difficulty, batch);

        int beforeFilter = batchOut.cards().size();

        HashSet<String> seen = new HashSet<>();

        List<CardDto> filtered = batchOut.cards().stream()
                .filter(Objects::nonNull)
                .filter(card -> lang.equalsIgnoreCase(card.language()))
                .filter(CardService::valid)
                .filter(card -> nonDuplicateTarget(card, seen))
                .filter(CardService::nonEmptyForbidden)
                .filter(CardService::maxForbidden)
                .filter(SafetyFilters::isFamilyFriendly)
                .filter(SafetyFilters::passesStemExclusion)
                .filter(card -> seen.add(card.target().toLowerCase()))
                .limit(count)
                .collect(Collectors.toList());

        log.info("GEN parsed beforeFilter={} afterFilter={}", beforeFilter, filtered.size());

        return filtered;
    }

    private static boolean valid(CardDto card) {
        return card.target() != null && !card.target().isBlank();
    }

    private static boolean nonDuplicateTarget(CardDto card, HashSet<String> seen) {
        return !seen.contains(card.target().toLowerCase());
    }

    private static boolean nonEmptyForbidden(CardDto card) {
        return card.forbidden() != null && !card.forbidden().isEmpty();
    }

    private static boolean maxForbidden(CardDto card) {
        return card.forbidden().size() <= 7;
    }

    private CardBatch requestBatch(String lang, String category, String difficulty, int count) throws IOException {


        long startPromptTimer = System.currentTimeMillis();

        StructuredResponseCreateParams<CardBatch> requestBuilder = ResponseCreateParams.builder()
                .model(props.getModel())
                .input(getPrompt(lang, category, difficulty, count))
                .temperature(props.getTemperature().floatValue())
                .text(CardBatch.class)
                .build();

        StructuredResponse<CardBatch> response = openAI.responses().create(requestBuilder);

        CardBatch parsed = response.output().stream()
                .flatMap(item -> item.message().stream())
                .flatMap(message -> message.content().stream())
                .flatMap(content -> content.outputText().stream())
                .findFirst().orElseThrow(() -> new IllegalStateException("Could not parse card batch"));

        if (log.isDebugEnabled()) {
            response.usage().stream().findFirst().ifPresent(
                    tokenUsage -> log.debug("GEN tokenUsage input={} output={} total={}"
                            , tokenUsage.inputTokens(),
                            tokenUsage.outputTokens(),
                            tokenUsage.inputTokens() + tokenUsage.outputTokens()));
        }

        log.info("GEN done durationMs={}", System.currentTimeMillis() - startPromptTimer);

        return parsed != null ? parsed : new CardBatch(List.of());
    }

    private String getPrompt(String lang, String category, String difficulty, int count) throws IOException {
        String promptTemplate = loadConfig("openai", promptTemplateFile);
        return promptTemplate
                .replace("{LANG}", lang)
                .replace("{COUNT}", Integer.toString(count))
                .replace("{CATEGORY}", category)
                .replace("{DIFFICULTY}", difficulty);
    }
}