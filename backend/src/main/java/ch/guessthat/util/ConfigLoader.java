package ch.guessthat.util;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;


public class ConfigLoader {

    public static String loadConfig(String folderName, String filename) throws IOException {
        String resourcePath = Paths.get(folderName.trim(), filename.trim()).toString();
        ClassLoader cl = ConfigLoader.class.getClassLoader();
        try (InputStream in = cl.getResourceAsStream(resourcePath)) {
            if (in == null) {
                throw new IOException("Resource '" + resourcePath + "' not found on classpath");
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
