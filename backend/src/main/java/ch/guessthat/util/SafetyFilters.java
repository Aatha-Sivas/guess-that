package ch.guessthat.util;

import java.util.Arrays;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static ch.guessthat.util.ConfigLoader.loadConfig;
import static ch.guessthat.records.RecordManager.*;

public class SafetyFilters {
    private static final Pattern PROFANITY = Pattern.compile(getProfanityList(), Pattern.CASE_INSENSITIVE);


    private static String getProfanityList() {
        try {
            String content = loadConfig("", "filter_profanity_list.txt");
            return "(" + Arrays.stream(content.split("\\R"))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.joining("|"))
                    + ")";
        } catch (Exception e) {
            // Removed profanity...
            return "";
        }
    }

    public static boolean isFamilyFriendly(CardDto card) {
        if (PROFANITY.matcher(card.target()).find()) return false;
        for (String forbiddenWord : card.forbidden()) {
            if (PROFANITY.matcher(forbiddenWord).find()) {
                return false;
            }
        }

        return true;
    }

    public static boolean passesStemExclusion(CardDto card) {
        String targetWord = TextNorm.normLower(card.target());
        for (String forbiddenWord : card.forbidden()) {
            String normalizedWord = TextNorm.normLower(forbiddenWord);
            if (normalizedWord.contains(forbiddenWord) || targetWord.contains(normalizedWord)) return false;
        }
        return true;
    }
}
