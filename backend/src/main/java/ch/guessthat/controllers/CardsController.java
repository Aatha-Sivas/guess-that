package ch.guessthat.controllers;

import ch.guessthat.repository.CardReadDao;
import ch.guessthat.services.CardPersistenceService;
import ch.guessthat.services.CardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static ch.guessthat.records.RecordManager.*;

@RestController
@RequestMapping("/api/cards")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin
public class CardsController {
    private final CardService cardService;
    private final CardPersistenceService cardPersistenceService;
    private final CardReadDao reader;

    @Value("${app.config.max-draw-count}")
    private int maxDrawCount;

    @GetMapping("/download")
    public ResponseEntity<List<CardDto>> download(
            @RequestParam(defaultValue = "de-CH") String lang,
            @RequestParam(defaultValue = "family") String category,
            @RequestParam(defaultValue = "medium") String difficulty,
            @RequestParam(defaultValue = "50") int count
    ) {
        try {
            log.info("HTTP /download lang={} cat={} diff={} n={}", lang, category, difficulty, count);
            List<CardDto> generated = cardService.getOrGenerate(lang, category, difficulty, count);
            List<CardDto> inserted = cardPersistenceService.storeOnlyNew(generated);
            log.info("HTTP /download generated={} inserted={} duplicates={}",
                    generated.size(), inserted.size(), generated.size() - inserted.size());
            return ResponseEntity.ok(generated);
        } catch (Exception e) {
            log.info("HTTP /download ERROR {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }

    }

    @GetMapping("/draw")
    public ResponseEntity<List<CardDto>> draw(
            @RequestParam(defaultValue = "de-CH") String lang,
            @RequestParam(defaultValue = "family") String category,
            @RequestParam(defaultValue = "medium") String difficulty,
            @RequestParam(required = false) Integer count,
            @RequestParam(required = false)  Integer offset
    ) {
        try {
            final int requestedCount = (count == null ? maxDrawCount : count);
            final int limit = Math.max(1, Math.min(requestedCount, maxDrawCount));
            final int requestedOffset = (offset == null ? 0 : offset);
            final int off = Math.max(0, requestedOffset);

            log.info("HTTP /draw lang={} cat={} diff={} n={}", lang, category, difficulty, count);
            List<CardDto> cardDtoList = reader.drawLatest(lang, category, difficulty, limit, off);
            log.info("HTTP /draw returned={}", cardDtoList.size());
            return ResponseEntity.ok(cardDtoList);
        } catch (Exception e) {
            log.info("HTTP /draw ERROR {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }

    }


}