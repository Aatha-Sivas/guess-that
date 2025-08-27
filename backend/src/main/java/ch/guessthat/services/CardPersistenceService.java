package ch.guessthat.services;


import ch.guessthat.model.CardEntity;
import ch.guessthat.repository.CardWriteDao;
import ch.guessthat.util.TextNorm;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static ch.guessthat.records.RecordManager.CardDto;

@Slf4j
@Service
@RequiredArgsConstructor
public class CardPersistenceService {
    private final CardWriteDao writeDao;

    public List<CardDto> storeOnlyNew(List<CardDto> generated) {
        int attempted = generated.size();
        List<CardDto> inserted = new ArrayList<>();
        for (CardDto dto : generated) {
            CardEntity entity = toEntity(dto);
            var maybeId = writeDao.insertCardIfNew(entity);
            maybeId.ifPresent(id -> {
                inserted.add(new CardDto(
                        id.toString(),
                        entity.getLanguage(),
                        entity.getCategory(),
                        entity.getDifficulty(),
                        entity.getTarget(),
                        entity.getForbidden()
                ));
                log.debug("DB insert id={} target='{}' lang={} diff={} cat={}",
                        id, entity.getTarget(), entity.getLanguage(), entity.getDifficulty(), entity.getCategory());
            });
        }
        log.info("DB storeOnlyNew attempted={} inserted={} duplicates={}",
                attempted, inserted.size(), attempted - inserted.size());
        return inserted;
    }

    private CardEntity toEntity(CardDto d) {
        return CardEntity.builder()
                .id(UUID.randomUUID())
                .language(d.language())
                .category(d.category())
                .difficulty(d.difficulty())
                .target(d.target())
                .normTarget(TextNorm.normLower(d.target()))
                .createdAt(java.time.OffsetDateTime.now())
                .forbidden(Optional.ofNullable(d.forbidden()).orElseGet(List::of))
                .build();
    }
}