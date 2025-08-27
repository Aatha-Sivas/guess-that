package ch.guessthat.records;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public class RecordManager {
    public record CardDto(
            @NotBlank
            String id,
            @NotBlank
            String language,
            @NotBlank
            String category,
            @NotBlank
            String difficulty,
            @NotBlank
            String target,
            @NotEmpty
            List<String> forbidden
    ) {}

    public record CardBatch(List<CardDto> cards) {}
}
