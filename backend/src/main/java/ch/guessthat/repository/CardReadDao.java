package ch.guessthat.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

import static ch.guessthat.records.RecordManager.*;

@Repository
@RequiredArgsConstructor
public class CardReadDao {

    private final NamedParameterJdbcTemplate jdbc;


    @Transactional(readOnly = true)
    public List<CardDto> drawRandom(String lang, String category, String difficulty, int count) {
        final String sql = """
            SELECT c.id, c.language, c.category, c.difficulty, c.target
            FROM cards c
            WHERE c.language = :lang AND c.category = :cat AND c.difficulty = :diff
            ORDER BY RAND()
            LIMIT %d
            """.formatted(count);

        return getRow(sql, lang, category, difficulty);
    }

    @Transactional(readOnly = true)
    public List<CardDto> drawLatest(String lang, String category, String difficulty, int count, int offset) {
        final String sql = """
            SELECT c.id, c.language, c.category, c.difficulty, c.target
            FROM cards c
            WHERE c.language = :lang AND c.category = :cat AND c.difficulty = :diff
            ORDER BY c.created_at DESC
            LIMIT %d OFFSET %d
            """.formatted(count, offset);

        return getRow(sql, lang, category, difficulty);
    }

    private Map<UUID, List<String>> loadForbidden(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();

        final String sql = """
            SELECT cf.card_id, cf.word
            FROM card_forbidden cf
            WHERE cf.card_id IN (:ids)
            """;

        var params = new MapSqlParameterSource().addValue(
                "ids",
                ids.stream().map(UUID::toString).collect(Collectors.toList())
        );

        Map<UUID, List<String>> out = new HashMap<>();
        jdbc.query(sql, params, rs -> {
            UUID id = UUID.fromString(rs.getString("card_id"));
            String word = rs.getString("word");
            out.computeIfAbsent(id, k -> new ArrayList<>()).add(word);
        });
        return out;
    }

    private List<CardDto> getRow(
            String sql,
            String lang,
            String category,
            String difficulty) {
        var params = new MapSqlParameterSource()
                .addValue("lang", lang)
                .addValue("cat", category)
                .addValue("diff", difficulty);

        List<CardRow> rows = jdbc.query(sql, params, (rs, i) -> new CardRow(
                UUID.fromString(rs.getString("id")),
                rs.getString("language"),
                rs.getString("category"),
                rs.getString("difficulty"),
                rs.getString("target")
        ));

        if (rows.isEmpty()) return List.of();

        Map<UUID, List<String>> forbById = loadForbidden(rows.stream().map(r -> r.id).toList());

        List<CardDto> out = new ArrayList<>(rows.size());
        for (CardRow r : rows) {
            out.add(new CardDto(
                    r.id.toString(),
                    r.language,
                    r.category,
                    r.difficulty,
                    r.target,
                    forbById.getOrDefault(r.id, List.of())
            ));
        }
        return out;
    }

    /** Lightweight internal row holder. */
    private record CardRow(UUID id, String language, String category, String difficulty, String target) {}
}
