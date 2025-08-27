package ch.guessthat.repository;

import ch.guessthat.model.CardEntity;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class CardWriteDao {
    private final NamedParameterJdbcTemplate jdbc;

    @Transactional
    public Optional<UUID> insertCardIfNew(CardEntity cardEntity) {
        var sql = """
      INSERT IGNORE INTO cards (id, language, category, difficulty, target, norm_target, created_at)
      VALUES (:id, :lang, :cat, :diff, :target, :norm, NOW())
      """;
        var parameterSource = new MapSqlParameterSource()
                .addValue("id", cardEntity.getId().toString())
                .addValue("lang", cardEntity.getLanguage())
                .addValue("cat", cardEntity.getCategory())
                .addValue("diff", cardEntity.getDifficulty())
                .addValue("target", cardEntity.getTarget())
                .addValue("norm", cardEntity.getNormTarget());

        int rows = jdbc.update(sql, parameterSource);
        if (rows == 0) return Optional.empty();

        insertForbidden(cardEntity.getId(), cardEntity.getForbidden());
        return Optional.of(cardEntity.getId());
    }

    private void insertForbidden(UUID cardId, List<String> words) {
        if (words == null || words.isEmpty()) return;
        var sql = "INSERT INTO card_forbidden (card_id, word) VALUES (:id, :w)";
        var batch = words.stream()
                .map(w -> new MapSqlParameterSource().addValue("id", cardId.toString()).addValue("w", w))
                .toArray(MapSqlParameterSource[]::new);
        jdbc.batchUpdate(sql, batch);
    }
}
