package ch.guessthat.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "cards",
        uniqueConstraints = @UniqueConstraint(name="uq_cards_lang_norm", columnNames={"language","norm_target"})
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CardEntity {
    @Id
    @Column(columnDefinition = "char(36)")
    private UUID id;

    @Column(nullable=false, length=16)
    private String language;

    @Column(nullable=false, length=32)
    private String category;

    @Column(nullable=false, length=16)
    private String difficulty;

    @Column(nullable=false, length=255)
    private String target;

    @Column(name="norm_target", nullable=false, length=255)
    private String normTarget;

    @Column(name="created_at", nullable=false)
    private OffsetDateTime createdAt;

    @ElementCollection
    @CollectionTable(name="card_forbidden", joinColumns=@JoinColumn(name="card_id"))
    @Column(name="word", nullable=false, length=255)
    private List<String> forbidden = new ArrayList<>();
}