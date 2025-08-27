package ch.guessthat.util;

import java.text.Normalizer;
import java.util.Locale;

public class TextNorm {
    public static String normLower(String text) {
        if (text == null) return "";
        var normalizedText = Normalizer.normalize(text, Normalizer.Form.NFKC);
        var noMarks = normalizedText.replaceAll("\\p{M}+", "");
        return noMarks.toLowerCase(Locale.ROOT).trim();
    }
}
